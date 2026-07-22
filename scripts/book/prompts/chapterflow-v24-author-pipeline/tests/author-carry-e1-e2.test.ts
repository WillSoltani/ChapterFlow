/**
 * WS4 E1 (durable acceptance) + E2 (review-carry ledger + regen-cap persistence).
 *
 * E1: deriveDurableAcceptance is TRUE only when EVERY chapter carries a FRESH
 * PUBLISHABLE attestation with dimensions.bookAcceptance===true AND the newest
 * persisted acceptance record is accepted at quorum. Any doubt (missing/stale/
 * tampered attestation, missing/rejected/below-quorum record) → NOT accepted.
 *
 * E2: carryReviewFor reuses a persisted PASS+valid review ONLY when contentHash +
 * docHash + bar + schema/hash versions all match and reviewer ≠ the current author;
 * every mismatch dimension (incl. a legacy record missing the new binding fields)
 * forces a miss. doAuthorReview reuses on a hit (spawns nothing) and re-reviews on
 * a miss. Regen counts persist across a simulated re-entry.
 *
 * Attestations live in the real state/qc (QC_DIR is not root-injectable) under
 * zz-fixture ids and are fully cleaned up; the review ledgers + acceptance records
 * use an INJECTED tmp stateRoot (never real state).
 */
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { test } from "./harness.js";
import { makeChapter, PIPELINE_DIR } from "./helpers.js";
import type { ChapterV21 } from "../src/types.js";
import {
  attestationPath,
  chapterContentHash,
  writeAttestation,
  type QcAttestation,
} from "../src/critics/qcAttestation.js";
import {
  CHAPTER_REVIEW_SCHEMA_VERSION,
  REVIEW_FACTORS,
  type ChapterReviewV1,
  type ReviewFactor,
} from "../src/artifacts/artifactTypes.js";
import { chapterReaderDocHash, REVIEW_DOC_HASH_VERSION } from "../src/review/readerReview.js";
import {
  appendReviewHistory,
  buildReviewClearsLedger,
  carryReviewFor,
  reviewClearsPath,
  writeReviewClearsLedger,
} from "../src/orchestrator/authorReviewLedger.js";
import {
  authorRegenLedgerPath,
  loadAuthorRegenLedger,
  recordRegenConsumed,
  regenConsumedFor,
} from "../src/orchestrator/authorRegenLedger.js";
import {
  deriveDurableAcceptance,
  loadNewestAcceptanceRecord,
} from "../src/orchestrator/authorAcceptanceState.js";
import {
  AUTHOR_BOOK_READERS,
  doAuthorReview,
  resolveAuthorReviewIo,
  type AuthorAcceptanceRecord,
  type AuthorReviewIo,
} from "../src/orchestrator/authorReview.js";
import { reviewDir } from "../src/orchestrator/authorReviewLedger.js";
import type { AutopilotDeps } from "../src/orchestrator/autopilot.js";

const BOOK = "zz-fixture-carry";
const BOOK_RUNS_DIR = join(PIPELINE_DIR, "state", "books", BOOK, "runs");
const BOOK_RUNS_DIR_EXISTED = existsSync(BOOK_RUNS_DIR);

function cleanupBookRuns(): void {
  if (!BOOK_RUNS_DIR_EXISTED) rmSync(BOOK_RUNS_DIR, { recursive: true, force: true });
}

// ── attestation fixtures (real state/qc, cleaned up) ──────────────────────────

function freshAcceptanceAttestation(ch: ChapterV21, over: Partial<QcAttestation> = {}): QcAttestation {
  return {
    schemaVersion: "qc-attest-v1",
    bookId: BOOK,
    chapterNumber: ch.number,
    chapterId: ch.chapterId,
    verdict: "PUBLISHABLE",
    contentHash: chapterContentHash(ch),
    hashVersion: "v2",
    reviewer: "codex-qc:author-review:r1",
    reviewedAt: new Date().toISOString(),
    roundId: "r1",
    roundRole: "confirm",
    reviewerSessionId: "reviewer-1",
    dimensions: { bookAcceptance: true },
    findings: [],
    ...over,
  };
}

function cleanupAttestations(chapters: ChapterV21[]): void {
  for (const ch of chapters) {
    const p = attestationPath(BOOK, ch.number);
    if (existsSync(p)) rmSync(p, { force: true });
  }
}

function mkAcceptanceRecord(over: Partial<AuthorAcceptanceRecord> = {}): AuthorAcceptanceRecord {
  return {
    schemaVersion: "author-acceptance-v1",
    bookId: BOOK,
    roundLabel: "",
    at: new Date().toISOString(),
    bar: 80,
    beatShipped: null,
    accepted: true,
    sampledChapters: [1, 2],
    docSha256: "abc",
    // Only validCount is read by the deriver; the rest of the verdict is opaque here.
    verdict: { validCount: AUTHOR_BOOK_READERS } as never,
    readers: [],
    ...over,
  };
}

/** Write an acceptance record into an injected tmp stateRoot. */
function writeAcceptanceRecord(stateRoot: string, record: AuthorAcceptanceRecord): void {
  const seg = (record.roundLabel || "").replace(/^-/, "").trim() || "round1";
  const dir = join(stateRoot, "reviews", BOOK);
  rmSync(dir, { recursive: true, force: true });
  writeFileSync(join(mkdirp(dir), `acceptance.${seg}.json`), JSON.stringify(record, null, 2) + "\n", "utf8");
}

function mkdirp(dir: string): string {
  mkdirSync(dir, { recursive: true });
  return dir;
}

// ── E1: durable acceptance ─────────────────────────────────────────────────────

test("E1: fresh bookAcceptance attestations on every chapter + a quorum-met accepted record → durably ACCEPTED", () => {
  const chapters = [makeChapter(BOOK, 1), makeChapter(BOOK, 2)];
  const root = mkdtempSync(join(tmpdir(), "e1-accept-"));
  try {
    for (const ch of chapters) writeAttestation(freshAcceptanceAttestation(ch));
    writeAcceptanceRecord(root, mkAcceptanceRecord());
    const r = deriveDurableAcceptance(BOOK, () => chapters, root);
    assert.ok(r.accepted, `expected accepted, got ${JSON.stringify(r)}`);
  } finally {
    cleanupAttestations(chapters);
    rmSync(root, { recursive: true, force: true });
  }
});

test("E1: any chapter with a STALE attestation (content edited) → NOT accepted (phase re-runs)", () => {
  const chapters = [makeChapter(BOOK, 1), makeChapter(BOOK, 2)];
  const root = mkdtempSync(join(tmpdir(), "e1-stale-"));
  try {
    // Write attestations bound to the ORIGINAL bytes, then EDIT ch2's content.
    for (const ch of chapters) writeAttestation(freshAcceptanceAttestation(ch));
    writeAcceptanceRecord(root, mkAcceptanceRecord());
    const edited = { ...chapters[1], keyTakeaway: chapters[1].keyTakeaway + " (edited after acceptance)" };
    const now = [chapters[0], edited];
    const r = deriveDurableAcceptance(BOOK, () => now, root);
    assert.ok(!r.accepted && /STALE/.test(r.reason), `expected stale rejection, got ${JSON.stringify(r)}`);
  } finally {
    cleanupAttestations(chapters);
    rmSync(root, { recursive: true, force: true });
  }
});

test("E1: an attestation WITHOUT dimensions.bookAcceptance → NOT accepted (a plain publishable is not a book-acceptance)", () => {
  const chapters = [makeChapter(BOOK, 1), makeChapter(BOOK, 2)];
  const root = mkdtempSync(join(tmpdir(), "e1-nobookacc-"));
  try {
    writeAttestation(freshAcceptanceAttestation(chapters[0]));
    writeAttestation(freshAcceptanceAttestation(chapters[1], { dimensions: { readerReviewPass: true } }));
    writeAcceptanceRecord(root, mkAcceptanceRecord());
    const r = deriveDurableAcceptance(BOOK, () => chapters, root);
    assert.ok(!r.accepted && /bookAcceptance/.test(r.reason), `got ${JSON.stringify(r)}`);
  } finally {
    cleanupAttestations(chapters);
    rmSync(root, { recursive: true, force: true });
  }
});

test("E1: NO acceptance record → NOT accepted even with fresh attestations (never derive from attestations alone without the record)", () => {
  const chapters = [makeChapter(BOOK, 1), makeChapter(BOOK, 2)];
  const root = mkdtempSync(join(tmpdir(), "e1-norec-"));
  try {
    for (const ch of chapters) writeAttestation(freshAcceptanceAttestation(ch));
    const r = deriveDurableAcceptance(BOOK, () => chapters, root);
    assert.ok(!r.accepted && /no persisted acceptance record/.test(r.reason), `got ${JSON.stringify(r)}`);
  } finally {
    cleanupAttestations(chapters);
    rmSync(root, { recursive: true, force: true });
  }
});

test("E1: a BELOW-QUORUM acceptance record → NOT accepted (the record must meet the valid-reader quorum)", () => {
  const chapters = [makeChapter(BOOK, 1), makeChapter(BOOK, 2)];
  const root = mkdtempSync(join(tmpdir(), "e1-quorum-"));
  try {
    for (const ch of chapters) writeAttestation(freshAcceptanceAttestation(ch));
    writeAcceptanceRecord(root, mkAcceptanceRecord({ verdict: { validCount: AUTHOR_BOOK_READERS - 1 } as never }));
    const r = deriveDurableAcceptance(BOOK, () => chapters, root);
    assert.ok(!r.accepted && /quorum/.test(r.reason), `got ${JSON.stringify(r)}`);
  } finally {
    cleanupAttestations(chapters);
    rmSync(root, { recursive: true, force: true });
  }
});

test("E1: a REJECTED newest record → NOT accepted; loadNewestAcceptanceRecord picks the latest by timestamp", () => {
  const chapters = [makeChapter(BOOK, 1), makeChapter(BOOK, 2)];
  const root = mkdtempSync(join(tmpdir(), "e1-newest-"));
  try {
    for (const ch of chapters) writeAttestation(freshAcceptanceAttestation(ch));
    const dir = join(root, "reviews", BOOK);
    mkdirp(dir);
    // round1 accepted (older), round2 rejected (newer) — the newest wins.
    writeFileSync(join(dir, "acceptance.round1.json"), JSON.stringify(mkAcceptanceRecord({ roundLabel: "", at: "2026-07-03T00:00:00.000Z", accepted: true }), null, 2) + "\n", "utf8");
    writeFileSync(join(dir, "acceptance.round2.json"), JSON.stringify(mkAcceptanceRecord({ roundLabel: "-round2", at: "2026-07-03T01:00:00.000Z", accepted: false }), null, 2) + "\n", "utf8");
    const newest = loadNewestAcceptanceRecord(BOOK, root);
    assert.equal(newest?.roundLabel, "-round2", "newest by timestamp");
    const r = deriveDurableAcceptance(BOOK, () => chapters, root);
    assert.ok(!r.accepted && /not accepted/.test(r.reason), `got ${JSON.stringify(r)}`);
  } finally {
    cleanupAttestations(chapters);
    rmSync(root, { recursive: true, force: true });
  }
});

// ── E2: review-carry ledger ────────────────────────────────────────────────────

function mkReview(ch: ChapterV21, over: Partial<ChapterReviewV1> = {}): ChapterReviewV1 {
  const scores = Object.fromEntries(REVIEW_FACTORS.map((f) => [f, 90])) as Record<ReviewFactor, number>;
  return {
    schemaVersion: CHAPTER_REVIEW_SCHEMA_VERSION,
    chapterId: ch.chapterId,
    chapterNumber: ch.number,
    contentHash: chapterContentHash(ch),
    reviewerSessionId: "indep-reviewer-1",
    scores,
    composite: 90,
    ship84: true,
    pass: true,
    valid: true,
    keyCheck: { derived: [], matches: 9, of: 9, disagreements: [] },
    quotes: [{ quote: ch.title, why: "ok", verified: true }],
    tells: [],
    complaints: [],
    oneParagraphVerdict: "ships",
    bar: 84,
    docHash: chapterReaderDocHash(ch),
    hashVersion: REVIEW_DOC_HASH_VERSION,
    reviewedAt: new Date().toISOString(),
    ...over,
  };
}

test("E2: a PASS+valid review at matching content/doc/bar, reviewer ≠ author → carry HIT", () => {
  const ch = makeChapter(BOOK, 1);
  const root = mkdtempSync(join(tmpdir(), "e2-hit-"));
  try {
    appendReviewHistory(BOOK, mkReview(ch), root);
    const r = carryReviewFor(BOOK, ch, 84, "the-author-session", root);
    assert.ok(r.hit, `expected hit, got ${JSON.stringify(r)}`);
    if (r.hit) assert.equal(r.review.composite, 90);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("E2: each mismatch dimension forces a MISS — content, doc, bar, reviewer==author, pass=false, legacy record without binding fields", () => {
  const ch = makeChapter(BOOK, 1);
  const root = mkdtempSync(join(tmpdir(), "e2-miss-"));
  try {
    // (a) content mismatch: the persisted review is for DIFFERENT bytes.
    appendReviewHistory(BOOK, mkReview(ch, { contentHash: "deadbeefdeadbeef" }), root);
    assert.ok(!carryReviewFor(BOOK, ch, 84, "auth", root).hit, "content mismatch → miss");

    // (b) doc-hash mismatch (content matches but the rendered doc differs).
    rmSync(join(root, "reviews", BOOK), { recursive: true, force: true });
    appendReviewHistory(BOOK, mkReview(ch, { docHash: "0".repeat(64) }), root);
    assert.ok(!carryReviewFor(BOOK, ch, 84, "auth", root).hit, "doc hash mismatch → miss");

    // (c) bar mismatch.
    rmSync(join(root, "reviews", BOOK), { recursive: true, force: true });
    appendReviewHistory(BOOK, mkReview(ch, { bar: 80 }), root);
    assert.ok(!carryReviewFor(BOOK, ch, 84, "auth", root).hit, "bar mismatch → miss");

    // (d) reviewer == current author.
    rmSync(join(root, "reviews", BOOK), { recursive: true, force: true });
    appendReviewHistory(BOOK, mkReview(ch, { reviewerSessionId: "the-author" }), root);
    assert.ok(!carryReviewFor(BOOK, ch, 84, "the-author", root).hit, "reviewer==author → miss");

    // (e) not a PASS.
    rmSync(join(root, "reviews", BOOK), { recursive: true, force: true });
    appendReviewHistory(BOOK, mkReview(ch, { pass: false }), root);
    assert.ok(!carryReviewFor(BOOK, ch, 84, "auth", root).hit, "pass=false → miss");

    // (f) LEGACY record missing the E2 binding fields → never reusable.
    rmSync(join(root, "reviews", BOOK), { recursive: true, force: true });
    appendReviewHistory(BOOK, mkReview(ch, { bar: undefined, docHash: undefined, hashVersion: undefined }), root);
    assert.ok(!carryReviewFor(BOOK, ch, 84, "auth", root).hit, "legacy record without binding fields → miss");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("E2: the materialized clears cache is REBUILDABLE from history and deletable without loss", () => {
  const ch1 = makeChapter(BOOK, 1);
  const ch2 = makeChapter(BOOK, 2);
  const root = mkdtempSync(join(tmpdir(), "e2-cache-"));
  try {
    appendReviewHistory(BOOK, mkReview(ch1), root);
    appendReviewHistory(BOOK, mkReview(ch2, { pass: false }), root); // not a clear
    writeReviewClearsLedger(BOOK, root);
    const p = reviewClearsPath(BOOK, root);
    assert.ok(existsSync(p), "cache materialized");
    const cache1 = JSON.parse(readFileSync(p, "utf8"));
    assert.equal(cache1.clears.length, 1, "only the PASS review becomes a clear");
    assert.equal(cache1.clears[0].chapterNumber, 1);

    // Delete the cache → rebuild from history is byte-equivalent (minus updatedAt).
    rmSync(p, { force: true });
    const rebuilt = buildReviewClearsLedger(BOOK, root);
    assert.equal(rebuilt.clears.length, 1, "history alone rebuilds the same clear");
    assert.equal(rebuilt.clears[0].chapterNumber, 1);

    // The carry still hits from history alone (cache is never the evidence).
    assert.ok(carryReviewFor(BOOK, ch1, 84, "auth", root).hit, "history alone grants the carry");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("E2: content-keyed history keeps BOTH bytes — the OLD content still carries, the NEW content re-reviews", () => {
  const ch = makeChapter(BOOK, 1);
  const chEdited = { ...ch, keyTakeaway: ch.keyTakeaway + " v2" };
  const root = mkdtempSync(join(tmpdir(), "e2-hist-"));
  try {
    appendReviewHistory(BOOK, mkReview(ch), root);           // review of the OLD bytes
    appendReviewHistory(BOOK, mkReview(chEdited), root);     // review of the NEW bytes (different content → new file)
    const files = readdirSync(join(root, "reviews", BOOK)).filter((f) => f.endsWith(".review.json"));
    assert.equal(files.length, 2, "two distinct content-keyed history files");
    assert.ok(carryReviewFor(BOOK, ch, 84, "auth", root).hit, "old bytes still carry");
    assert.ok(carryReviewFor(BOOK, chEdited, 84, "auth", root).hit, "new bytes carry their own review");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// ── E2: regen-cap persistence ──────────────────────────────────────────────────

// ── E2 integration: doAuthorReview reuses a carry (spawns NO chapter reader) ────

function mkReviewDeps(bookReplyFor: (chapters: ChapterV21[]) => string, chapters: ChapterV21[]): { deps: AutopilotDeps; spawns: string[] } {
  const spawns: string[] = [];
  let n = 0;
  const deps = {
    spawn: (async (o: { sessionId: string; task: string }) => {
      spawns.push(o.sessionId);
      const msg = o.sessionId.includes("author-book-reader") ? bookReplyFor(chapters) : "done";
      return { ok: true, exitCode: 0, finalMessage: msg, stdout: msg, stderr: "", durationMs: 1, sessionId: o.sessionId };
    }) as unknown as AutopilotDeps["spawn"],
    mkSessionId: (label: string) => `${label}#${++n}`,
    logSession: () => {},
    expectedChapterNumbers: () => chapters.map((c) => c.number),
    log: () => {},
  } as unknown as AutopilotDeps;
  return { deps, spawns };
}

function bookAcceptReply(chapters: ChapterV21[]): string {
  const body = {
    gate_verdict: "PASS",
    book3_churn: "LOW",
    quizDerivation: Object.fromEntries(chapters.map((ch) => [String(ch.number), { answers: ch.quiz.questions.map((q) => "abc"[q.correctIndex]), keyDisagreements: [] }])),
    scores: Object.fromEntries(REVIEW_FACTORS.map((f) => [f, 90])),
    quotes: [{ quote: chapters[0].title, why: "authored" }],
    oneParagraphVerdict: "individually authored",
  };
  return "```json\n" + JSON.stringify(body) + "\n```";
}

test("E2 integration: doAuthorReview CARRIES a durable per-chapter review — spawns ZERO chapter readers (only the book-acceptance panel)", async () => {
  const chapters = [makeChapter(BOOK, 1), makeChapter(BOOK, 2)];
  // The 2-chapter fixture shares practice-opener families (fixture-intrinsic;
  // CHB7's cap is ceil(N/3)=1 at N=2) — diversify so the review-entry budget
  // check (live-added 2026-07-03) exercises the carry path, not the fixture.
  chapters[1].implementationPlan.twentyFourHourChallenge = "Before your next standup, write the one blocker sentence in your notes app.";
  chapters[1].implementationPlan.weeklyPractice = "Every Friday, count the open loops in your tracker and close exactly one.";
  chapters[1].tryThisNow = "When the next email lands, say the two-sentence triage script out loud.";
  // Pre-seed a fresh PASS+valid review for BOTH chapters into REAL state/reviews
  // (default stateRoot — the carry predicate reads there), reviewer ≠ author.
  rmSync(reviewDir(BOOK), { recursive: true, force: true });
  for (const ch of chapters) appendReviewHistory(BOOK, mkReview(ch, { bar: 84, reviewerSessionId: "prior-reviewer" }));
  try {
    const { deps, spawns } = mkReviewDeps(bookAcceptReply, chapters);
    const tmpDoc = mkdtempSync(join(tmpdir(), "e2-int-"));
    const io: Partial<AuthorReviewIo> = {
      loadChapters: () => chapters,
      authorSessionOf: () => "the-author-not-the-reviewer",
      chapterExists: () => true,
      writeReviewDoc: (bookId, fileName, text) => {
        const abs = join(tmpDoc, `${bookId}-${fileName}`);
        writeFileSync(abs, text, "utf8");
        return { absPath: abs, relPath: abs };
      },
      persistReview: () => "/tmp/r.json",
      persistAcceptance: () => "/tmp/a.json",
      acceptance: {
        openRound: () => ({ roundId: "r-int", tokens: {} }),
        writeBar: () => "/tmp/bar.json",
        writeConfirm: () => "/tmp/confirm.json",
        writeAttestation: () => "/tmp/att.json",
      },
      evidence: { runKeyJudge: async () => ({ ok: true }), runSweep: async () => ({ ok: true }) },
      resolveBeatShipped: async () => ({ ok: true, composite: null, source: "none" }),
      regenConsumedFor: () => 0,
      recordRegenConsumed: () => {},
    };
    const result = await doAuthorReview(BOOK, deps, { maxParallel: 2, bar: 84, io });
    assert.equal(result, null, `expected phase-complete (null), got ${JSON.stringify(result)}`);
    const chapterReaderSpawns = spawns.filter((s) => s.includes("author-review-ch"));
    assert.equal(chapterReaderSpawns.length, 0, "carry hit → NO chapter reader spawned");
    // The book-acceptance panel still runs (acceptance is never carried, E1 note).
    assert.equal(spawns.filter((s) => s.includes("author-book-reader")).length, AUTHOR_BOOK_READERS, "the acceptance panel still runs");
    rmSync(tmpDoc, { recursive: true, force: true });
  } finally {
    rmSync(reviewDir(BOOK), { recursive: true, force: true });
  }
});

test("F-06: the durable acceptance record carries the deterministic structural-sameness snapshot (telemetry, advisory by default)", async () => {
  const chapters = [makeChapter(BOOK, 1), makeChapter(BOOK, 2)];
  // Same diversification the E2 integration test needs so the review-entry budget
  // check exercises the carry path, not the fixture.
  chapters[1].implementationPlan.twentyFourHourChallenge = "Before your next standup, write the one blocker sentence in your notes app.";
  chapters[1].implementationPlan.weeklyPractice = "Every Friday, count the open loops in your tracker and close exactly one.";
  chapters[1].tryThisNow = "When the next email lands, say the two-sentence triage script out loud.";
  rmSync(reviewDir(BOOK), { recursive: true, force: true });
  for (const ch of chapters) appendReviewHistory(BOOK, mkReview(ch, { bar: 84, reviewerSessionId: "prior-reviewer" }));
  try {
    const { deps } = mkReviewDeps(bookAcceptReply, chapters);
    const tmpDoc = mkdtempSync(join(tmpdir(), "f06-int-"));
    const records: AuthorAcceptanceRecord[] = [];
    const io: Partial<AuthorReviewIo> = {
      loadChapters: () => chapters,
      authorSessionOf: () => "the-author-not-the-reviewer",
      chapterExists: () => true,
      writeReviewDoc: (bookId, fileName, text) => {
        const abs = join(tmpDoc, `${bookId}-${fileName}`);
        writeFileSync(abs, text, "utf8");
        return { absPath: abs, relPath: abs };
      },
      persistReview: () => "/tmp/r.json",
      persistAcceptance: (_bookId, record) => { records.push(record); return "/tmp/a.json"; },
      // Deterministic empty pool → the panel spawns fresh and persists exactly the
      // record we capture (never reads a stray on-disk acceptance read).
      listAcceptanceReads: () => [],
      acceptance: {
        openRound: () => ({ roundId: "r-int", tokens: {} }),
        writeBar: () => "/tmp/bar.json",
        writeConfirm: () => "/tmp/confirm.json",
        writeAttestation: () => "/tmp/att.json",
      },
      evidence: { runKeyJudge: async () => ({ ok: true }), runSweep: async () => ({ ok: true }) },
      resolveBeatShipped: async () => ({ ok: true, composite: null, source: "none" }),
      regenConsumedFor: () => 0,
      recordRegenConsumed: () => {},
    };
    const result = await doAuthorReview(BOOK, deps, { maxParallel: 2, bar: 84, io });
    assert.equal(result, null, `expected phase-complete (null), got ${JSON.stringify(result)}`);
    assert.ok(records.length >= 1, "an acceptance record was persisted");
    const snap = records[records.length - 1].structuralSameness;
    assert.ok(snap, "the acceptance record carries the structuralSameness telemetry field");
    assert.equal(snap!.mode, "advisory", "default mode is advisory (flag ships off)");
    assert.ok(Array.isArray(snap!.archAxes) && Array.isArray(snap!.contentOverCap), "snapshot carries both axis arrays");
    assert.equal(typeof snap!.archSevere, "boolean");
    assert.equal(typeof snap!.contentSevere, "boolean");
    // The telemetry field must NOT perturb the doc identity the pool keys on.
    assert.equal(typeof records[records.length - 1].docSha256, "string");
    rmSync(tmpDoc, { recursive: true, force: true });
  } finally {
    rmSync(reviewDir(BOOK), { recursive: true, force: true });
  }
});

test("E2: regen counts PERSIST across a simulated re-entry (a carried PASS never resets the budget)", () => {
  const root = mkdtempSync(join(tmpdir(), "e2-regen-"));
  const LIN = "abc123def456"; // fixed design lineage for the simulated entries
  try {
    assert.equal(regenConsumedFor(loadAuthorRegenLedger(BOOK, root), 1, LIN), 0, "starts empty");
    // "Entry 1" consumes ch1's regen.
    recordRegenConsumed(BOOK, 1, LIN, root);
    assert.ok(existsSync(authorRegenLedgerPath(BOOK, root)), "ledger persisted");
    // "Entry 2" (a fresh conductor invocation) LOADS the ledger — the count survived.
    const reloaded = loadAuthorRegenLedger(BOOK, root);
    assert.equal(regenConsumedFor(reloaded, 1, LIN), 1, "consumed count survived the re-entry");
    assert.equal(regenConsumedFor(reloaded, 2, LIN), 0, "an untouched chapter has a full budget");
    // Consuming again grows monotonically (never decrements).
    recordRegenConsumed(BOOK, 1, LIN, root);
    assert.equal(regenConsumedFor(loadAuthorRegenLedger(BOOK, root), 1, LIN), 2, "monotonic growth");
    // v2 lineage semantics: the SAME design keeps its cap; a NEW design (fresh
    // research / re-dealt brief) is a new original authoring with a fresh budget.
    assert.equal(regenConsumedFor(loadAuthorRegenLedger(BOOK, root), 1, "fresh-design1"), 0, "a new lineage has a fresh budget");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("author-carry fixtures remove owned run directories", () => {
  cleanupBookRuns();
});
