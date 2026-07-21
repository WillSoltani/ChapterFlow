/**
 * B5 — author-arch publish evidence (keyA/keyB manual key-judge records + the
 * roles.sweep-backed sweep attestation).
 *
 * THE deliverable test (the one B4 skipped and its verifier demanded): after
 * the evidence step runs against fixture state, the REAL untouchable promote
 * predicates — checkManualKeyJudge, checkSweep, checkQcAttestation — are
 * invoked in the no-API env against that state and must PASS for every
 * chapter. Everything is written through the REAL writers (writeKeyPacks /
 * validateAndWriteKeyDerivation / resolveManualKeyJudges / submitQcArtifact /
 * writeSweepRecordFromSubmission) on real fixture state (zz-fixture-* ids,
 * fully cleaned up) — spawns are fully stubbed (deps pattern from
 * tests/author-arch.test.ts): no live codex sessions.
 *
 * Also pinned: fail-closed independence (an evidence session that matches a
 * chapter's author session, or keyA===keyB), idempotency (re-runs write no
 * duplicate records and spawn nothing), the wrong-key catch surfacing as the
 * real CORRUPTION/NEEDS_ADJUDICATION failure (never auto-passed), a sweep read
 * with blocking findings failing the acceptance closed, and the lean session
 * budget (2 key readers + 1 sweep reader per book).
 */
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { test } from "./harness.js";
import { makeChapter, STATE_CHAPTERS, writeFixtureBook, writeResearchRunManifestFixture } from "./helpers.js";
import { CANONICAL_STATE, REPO_ROOT } from "../src/lib/chapterPaths.js";
import { loadQcRound, openQcRound, QC_ROUNDS_DIR } from "../src/qc/qcRound.js";
import {
  checkManualKeyJudge,
  keyDerivationPath,
  loadBookChapters,
  loadManualKeyJudge,
  QC_DIR,
  QC_PACKS_DIR,
} from "../src/qc/manualKeyJudge.js";
import { checkSweep, loadSweepHistory, loadSweepRecord } from "../src/qc/sweep.js";
import { attestationPath, checkQcAttestation, loadAttestation } from "../src/critics/qcAttestation.js";
import { checkBarConfirmArtifactsForPublishable, QC_ORCHESTRATOR_DIR } from "../src/qc/orchestrator/artifacts.js";
import { loadAuthorProvenance } from "../src/qc/sessionProvenance.js";
import {
  buildKeyJudgeDoc,
  renderBlindedChapterDoc,
  runKeyJudgeEvidence,
  runSweepEvidence,
  type AuthorEvidenceRound,
} from "../src/orchestrator/authorEvidence.js";
import { doAuthorReview, resolveAuthorReviewIo, type AuthorReviewIo } from "../src/orchestrator/authorReview.js";
import type { AutopilotDeps } from "../src/orchestrator/autopilot.js";
import { REVIEW_FACTORS } from "../src/artifacts/artifactTypes.js";
import type { ChapterV21 } from "../src/types.js";

const BOOK = "zz-fixture-author-evidence";
const RUN = "20260702T000000Z";
const ROUND = "r-authorev";

// ── fixture state (real writers, real state dirs, zz-fixture ids, full cleanup) ──

function sourceSidecar(chapterNumber: number): any {
  return {
    schemaVersion: "source-v2",
    chapterNumber,
    chapterTitle: `Chapter ${chapterNumber}`,
    centralConcept: { id: `ch${chapterNumber}.concept`, name: "Fixture concept", plainDefinition: "A test concept with concrete checks." },
    keyClaims: ["The fixture claim holds."],
    namedExamples: [
      { id: `ch${chapterNumber}.ex.a`, label: "Case Alpha", summary: "Alpha shows the move.", hardSpecifics: ["Alpha", "1999"], realWorld: true },
      { id: `ch${chapterNumber}.ex.b`, label: "Case Beta", summary: "Beta shows the miss.", hardSpecifics: ["Beta", "Toronto"], realWorld: true },
      { id: `ch${chapterNumber}.ex.c`, label: "Case Gamma", summary: "Gamma shows the limit.", hardSpecifics: ["Gamma", "42"], realWorld: true },
    ],
    hardEdge: "Do not invert the fixture claim.",
    paraphraseNotes: "Synthetic notes for a unit test.",
    testableFacts: Array.from({ length: 9 }, (_, i) => ({
      id: `fact${i}`,
      claim: `Claim ${i} is true.`,
      becauseMechanism: `Because mechanism ${i} explains the fixture.`,
      commonError: `Mistake ${i} is plausible.`,
      errorIsWhy: `Mistake ${i} ignores the mechanism.`,
    })),
  };
}

function rmMatching(dir: string, prefix: string): void {
  if (!existsSync(dir)) return;
  for (const f of readdirSync(dir)) {
    if (f.startsWith(prefix)) rmSync(resolve(dir, f), { recursive: true, force: true });
  }
}

function cleanup(): void {
  rmSync(resolve(REPO_ROOT, ".chapterflow/runs", BOOK), { recursive: true, force: true });
  rmMatching(STATE_CHAPTERS, `${BOOK}-ch`);
  rmMatching(QC_ROUNDS_DIR, `${BOOK}.`);
  rmSync(resolve(QC_PACKS_DIR, BOOK), { recursive: true, force: true });
  rmSync(resolve(QC_ORCHESTRATOR_DIR, BOOK), { recursive: true, force: true });
  rmMatching(QC_DIR, BOOK);
  rmMatching(resolve(CANONICAL_STATE, "provenance"), `${BOOK}-`);
  rmSync(resolve(REPO_ROOT, "scratch/review", BOOK), { recursive: true, force: true });
}

/** Chapters + sidecars + research manifest on real fixture state (no round). */
function setupState(): ChapterV21[] {
  cleanup();
  const chapters = [makeChapter(BOOK, 1), makeChapter(BOOK, 2)];
  writeFixtureBook(STATE_CHAPTERS, chapters);
  const runDir = resolve(REPO_ROOT, ".chapterflow/runs", BOOK, RUN);
  const sourceDir = resolve(runDir, "sidecars/source");
  mkdirSync(sourceDir, { recursive: true });
  writeResearchRunManifestFixture({
    runDir,
    bookId: BOOK,
    chapters: [{ number: 1, title: "Chapter 1" }, { number: 2, title: "Chapter 2" }],
  });
  for (const n of [1, 2]) {
    writeFileSync(resolve(sourceDir, `ch0${n}.source.json`), JSON.stringify(sourceSidecar(n), null, 2), "utf8");
  }
  return chapters;
}

/** setupState + a REAL opened QC round (tokens included — the evidence writers verify them). */
function setup(): { chapters: ChapterV21[]; round: AuthorEvidenceRound } {
  const chapters = setupState();
  const { record, tokens } = openQcRound(BOOK, ROUND);
  return { chapters, round: { roundId: record.roundId, tokens } };
}

async function withNoApiEnv<T>(fn: () => Promise<T> | T): Promise<T> {
  const prev = process.env.CHAPTERFLOW_NO_API_CODEX_QC;
  process.env.CHAPTERFLOW_NO_API_CODEX_QC = "1";
  try {
    return await fn();
  } finally {
    if (prev === undefined) delete process.env.CHAPTERFLOW_NO_API_CODEX_QC;
    else process.env.CHAPTERFLOW_NO_API_CODEX_QC = prev;
  }
}

// ── stubbed deps (tests/author-arch.test.ts pattern — no live codex) ──────────

type SpawnRec = { sessionId: string; task: string; sandbox?: string; reasoningEffort?: string };

function mkDeps(
  script: (o: { sessionId: string; task: string }) => { finalMessage?: string },
  mkSession?: (label: string, n: number) => string,
): { deps: AutopilotDeps; spawns: SpawnRec[] } {
  const spawns: SpawnRec[] = [];
  let n = 0;
  const deps = {
    runVerb: async () => ({ code: 0, stdout: "", stderr: "" }),
    spawn: (async (o: { sessionId: string; task: string; sandbox?: string; reasoningEffort?: string }) => {
      spawns.push({ sessionId: o.sessionId, task: o.task, sandbox: o.sandbox, reasoningEffort: o.reasoningEffort });
      const r = script(o);
      return { ok: true, exitCode: 0, finalMessage: r.finalMessage ?? "done", stdout: r.finalMessage ?? "", stderr: "", durationMs: 1, sessionId: o.sessionId };
    }) as unknown as AutopilotDeps["spawn"],
    mkSessionId: (label: string) => (mkSession ? mkSession(label, ++n) : `${label}#${++n}`),
    expectedChapterNumbers: () => [1, 2],
    logSession: () => {},
    log: () => {},
  } as unknown as AutopilotDeps;
  return { deps, spawns };
}

/** io with the review-doc scratch redirected to a tmp dir (everything else real). */
function mkEvIo(over: Partial<AuthorReviewIo> = {}): AuthorReviewIo {
  const dir = mkdtempSync(join(tmpdir(), "author-evidence-"));
  return resolveAuthorReviewIo({
    writeReviewDoc: (bookId, fileName, text) => {
      const abs = join(dir, `${bookId}-${fileName}`);
      writeFileSync(abs, text, "utf8");
      return { absPath: abs, relPath: abs };
    },
    persistReview: () => "/tmp/review.json",
    // Keep the E2E hermetic: don't write the Q6 acceptance record into the real
    // CANONICAL_STATE (its default target). The record's own unit coverage lives
    // in author-arch.test.ts.
    persistAcceptance: (bookId, record) => join(dir, `${bookId}-acceptance.${record.roundLabel || "round1"}.json`),
    // AUTO control-read + E2 regen-cap stubbed hermetic (no git / no real ledger).
    resolveBeatShipped: async () => ({ ok: true as const, composite: null, source: "none" as const }),
    regenConsumedFor: () => 0,
    recordRegenConsumed: () => {},
    ...over,
  });
}

// ── scripted reader replies ───────────────────────────────────────────────────

/** A key reader's honest derivation: every question, prose-derived (= stored
 *  key), high confidence, ≥40-char reason, citing the matching pack fact. */
function keyAnswersReply(chapters: ChapterV21[], mutate?: (chapterNumber: number, questionIndex: number, ans: any) => void): string {
  const out = chapters.map((ch) => ({
    chapterNumber: ch.number,
    packHash: "(echoed from the chapter header)",
    answers: ch.quiz.questions.map((q, i) => {
      const ans = {
        questionIndex: i,
        choiceIndex: q.correctIndex,
        confidence: "high",
        reason: `The chapter's early-check mechanism (fact${i}) forces this choice; the other options reopen exactly the negotiation the prose rules out.`,
        sourceFactIds: [`fact${i}`],
      };
      mutate?.(ch.number, i, ans);
      return ans;
    }),
  }));
  return "```json\n" + JSON.stringify({ chapters: out }) + "\n```";
}

function sweepReply(over: { verdict?: string; findings?: unknown[]; checkedFamilies?: string[] } = {}): string {
  return "```json\n" + JSON.stringify({
    verdict: over.verdict ?? "PASS",
    checkedFamilies: over.checkedFamilies ?? ["scene_skeleton", "persona_drift", "repeated_unit", "location_stamping"],
    findings: over.findings ?? [],
  }) + "\n```";
}

function blockingSweepFinding(chapters: ChapterV21[]): Record<string, unknown> {
  return {
    family: "persona_drift", // publish calibration: texture families are gate-advisory; blocking pins use a coherence family
    severity: "blocker",
    chapters: chapters.map((c) => c.number),
    unitId: "hook",
    repairClass: "persona_drift",
    quote: chapters[0].hook,
    problem: "both chapters open on the same drifting-record hook shell with only the nouns swapped",
    expectedFix: "rewrite chapter 2's hook on its own scene instead of the shared shell",
  };
}

/** Chapter/book reader replies for the end-to-end doAuthorReview runs (same
 *  shapes tests/author-arch.test.ts validated against the real adjudicators). */
function reviewReply(ch: ChapterV21): string {
  const body = {
    quizDerivation: { answers: ch.quiz.questions.map((q) => "abc"[q.correctIndex]), keyDisagreements: [], tells: [] },
    scores: Object.fromEntries(REVIEW_FACTORS.map((f) => [f, 90])),
    ship84: true,
    quotes: [{ quote: ch.title, why: "the strongest concrete moment" }],
    complaints: [],
    oneParagraphVerdict: "reads as one authored chapter",
  };
  return "```json\n" + JSON.stringify(body) + "\n```";
}

function bookReply(chapters: ChapterV21[]): string {
  const body = {
    gate_verdict: "PASS",
    book3_churn: "LOW",
    quizDerivation: Object.fromEntries(chapters.map((ch) => [String(ch.number), { answers: ch.quiz.questions.map((q) => "abc"[q.correctIndex]), keyDisagreements: [] }])),
    scores: Object.fromEntries(REVIEW_FACTORS.map((f) => [f, 90])),
    quotes: [{ quote: chapters[0].title, why: "individually authored" }],
    oneParagraphVerdict: "chapters feel individually authored",
  };
  return "```json\n" + JSON.stringify(body) + "\n```";
}

// ── blinding ──────────────────────────────────────────────────────────────────

test("blinded chapter doc: no answer key, no quiz explanations — prose and cards kept; pack questions carry the blinded choices", () => {
  const ch = makeChapter(BOOK, 1);
  const doc = renderBlindedChapterDoc(ch);
  assert.ok(!doc.includes("## ANSWER KEY"), "answer key section stripped");
  assert.ok(!doc.includes("Explanation:"), "per-question explanations (which argue for the stored key) stripped with the quiz section");
  assert.ok(!doc.includes("## Quiz"), "the reader-doc quiz section is replaced by the pack's blinded questions");
  assert.ok(doc.includes(ch.hook), "prose kept");
  assert.ok(doc.includes("## Review cards"), "sections after the quiz kept");

  // The key-judge doc re-renders questions FROM THE PACK: prompt + indexed choices only.
  const pack = {
    schemaVersion: "manual-key-pack-v1", bookId: BOOK, roundId: ROUND, chapterNumber: 1, chapterId: ch.chapterId,
    createdAt: "", contentHash: "", sourceHash: "", packHash: "deadbeef",
    sourceFacts: [{ id: "fact0", claim: "Claim 0 is true.", becauseMechanism: "m", commonError: "e", errorIsWhy: "w" }],
    questions: ch.quiz.questions.map((q, i) => ({ questionIndex: i, prompt: q.prompt, choices: q.choices })),
  } as never;
  const full = buildKeyJudgeDoc(BOOK, ROUND, [ch], new Map([[1, pack]]));
  assert.ok(full.includes("packHash deadbeef"), "pack hash named in the chapter header");
  assert.ok(full.includes("fact0: Claim 0 is true."), "source facts citable by id");
  assert.ok(full.includes(`Q0. ${ch.quiz.questions[0].prompt}`), "questions carry the pack's authoritative indexes");
  assert.ok(full.includes(`[0] ${ch.quiz.questions[0].choices[0]}`), "choices are indexed for choiceIndex");
  assert.ok(!full.includes("correctIndex"), "no stored key anywhere in the doc");
});

// ── key-judge evidence ────────────────────────────────────────────────────────

test("runKeyJudgeEvidence: two independent readers → real key-derive/key-resolve records; checkManualKeyJudge PASSES in no-API env", async () => {
  const { chapters, round } = setup();
  try {
    const { deps, spawns } = mkDeps((o) => (o.sessionId.includes("author-key-") ? { finalMessage: keyAnswersReply(chapters) } : {}));
    const r = await runKeyJudgeEvidence(BOOK, chapters, deps, mkEvIo(), round);
    assert.ok(r.ok, `expected ok, got ${JSON.stringify(r)}`);

    assert.equal(spawns.length, 2, "budget: exactly TWO key readers per book (book-level derivations)");
    assert.ok(spawns.every((s) => s.sandbox === "read-only"), "key readers are read-only");
    assert.ok(spawns.every((s) => s.reasoningEffort === "low"), "key derivation runs at low effort");

    const a = JSON.parse(readFileSync(keyDerivationPath(BOOK, ROUND, "keyA"), "utf8"));
    const b = JSON.parse(readFileSync(keyDerivationPath(BOOK, ROUND, "keyB"), "utf8"));
    assert.equal(a.schemaVersion, "manual-key-derive-v2");
    assert.equal(a.role, "keyA");
    assert.equal(b.role, "keyB");
    assert.ok(String(a.reviewerSessionId).startsWith("author-key-keyA"), "keyA record is stamped with the ACTUAL deriving reader session");
    assert.ok(String(b.reviewerSessionId).startsWith("author-key-keyB"), "keyB record is stamped with the ACTUAL deriving reader session");
    assert.notEqual(a.reviewerSessionId, b.reviewerSessionId, "the two blind keys came from different sessions");
    assert.equal(a.chapters.length, 2, "keyA covers every chapter");

    for (const ch of chapters) assert.equal(loadManualKeyJudge(BOOK, ch.number)?.status, "PASS");
    await withNoApiEnv(() => {
      for (const ch of loadBookChapters(BOOK)) {
        assert.deepEqual(checkManualKeyJudge(ch, true), [], `promote predicate must PASS for ch${ch.number}`);
      }
    });
  } finally {
    cleanup();
  }
});

test("runKeyJudgeEvidence: idempotent — a re-run over unchanged content spawns nothing and rewrites nothing", async () => {
  const { chapters, round } = setup();
  try {
    const first = await runKeyJudgeEvidence(BOOK, chapters, mkDeps((o) => (o.sessionId.includes("author-key-") ? { finalMessage: keyAnswersReply(chapters) } : {})).deps, mkEvIo(), round);
    assert.ok(first.ok && !first.skipped);
    const bytesBefore = readFileSync(keyDerivationPath(BOOK, ROUND, "keyA"), "utf8");

    const { deps, spawns } = mkDeps(() => ({}));
    const again = await runKeyJudgeEvidence(BOOK, chapters, deps, mkEvIo(), round);
    assert.ok(again.ok && again.skipped === true, "second run is a skip decided by the promote predicate itself");
    assert.equal(spawns.length, 0, "no reader sessions spawned on a satisfied re-run");
    assert.equal(readFileSync(keyDerivationPath(BOOK, ROUND, "keyA"), "utf8"), bytesBefore, "no duplicate/rewritten derivation records");
  } finally {
    cleanup();
  }
});

test("runKeyJudgeEvidence: an evidence session matching a chapter's AUTHOR session fails closed before any spawn", async () => {
  const { chapters, round } = setup();
  try {
    const { deps, spawns } = mkDeps(() => ({}), (label, n) => (label.startsWith("author-key-keyA") ? "author-sess-1" : `${label}#${n}`));
    const io = mkEvIo({ authorSessionOf: () => "author-sess-1" });
    const r = await runKeyJudgeEvidence(BOOK, chapters, deps, io, round);
    assert.ok(!r.ok, "must fail closed");
    if (!r.ok) {
      assert.equal(r.category, "infra");
      assert.match(r.reason, /author session/);
    }
    assert.equal(spawns.length, 0, "the colliding session is refused BEFORE it reads anything");
    assert.ok(!existsSync(keyDerivationPath(BOOK, ROUND, "keyA")), "no derivation record from a non-independent session");
  } finally {
    cleanup();
  }
});

test("runKeyJudgeEvidence: keyA and keyB sharing one session fails closed (two blind keys must be independent)", async () => {
  const { chapters, round } = setup();
  try {
    const { deps, spawns } = mkDeps(
      (o) => (o.sessionId === "one-shared-session" ? { finalMessage: keyAnswersReply(chapters) } : {}),
      (label) => (label.startsWith("author-key-") ? "one-shared-session" : label),
    );
    const r = await runKeyJudgeEvidence(BOOK, chapters, deps, mkEvIo(), round);
    assert.ok(!r.ok, "must fail closed");
    if (!r.ok) assert.match(r.reason, /collides with another evidence role/);
    assert.equal(spawns.length, 1, "keyA ran; keyB was refused at mint time");
  } finally {
    cleanup();
  }
});

test("runKeyJudgeEvidence: both readers agreeing AGAINST the stored key = CORRUPTION — surfaced, never auto-passed; checkManualKeyJudge blocks", async () => {
  const { chapters, round } = setup();
  try {
    const wrong = (chapterNumber: number, questionIndex: number, ans: any) => {
      if (chapterNumber === 1 && questionIndex === 0) ans.choiceIndex = (chapters[0].quiz.questions[0].correctIndex + 1) % 3;
    };
    const { deps } = mkDeps((o) => (o.sessionId.includes("author-key-") ? { finalMessage: keyAnswersReply(chapters, wrong) } : {}));
    const r = await runKeyJudgeEvidence(BOOK, chapters, deps, mkEvIo(), round);
    assert.ok(!r.ok, "a wrong stored key must FAIL the evidence step");
    if (!r.ok) {
      assert.equal(r.category, "content", "the QC signal working = a content failure");
      assert.match(r.reason, /CORRUPTION/);
    }
    assert.equal(loadManualKeyJudge(BOOK, 1)?.status, "CORRUPTION", "the real record persists the wrong-key catch");
    assert.equal(loadManualKeyJudge(BOOK, 2)?.status, "PASS", "the clean chapter still resolves PASS");
    const findings = checkManualKeyJudge(loadBookChapters(BOOK)[0], true);
    assert.equal(findings.length, 1, "promote predicate blocks the corrupt chapter");
    assert.equal(findings[0].checkId, "QC2.manual_keyjudge_not_pass");
    assert.match(findings[0].message, /CORRUPTION/);
  } finally {
    cleanup();
  }
});

test("runKeyJudgeEvidence: keyA/keyB disagreement = NEEDS_ADJUDICATION — fail closed, promote blocks", async () => {
  const { chapters, round } = setup();
  try {
    const { deps } = mkDeps((o) => {
      if (o.sessionId.includes("author-key-keyB")) {
        return { finalMessage: keyAnswersReply(chapters, (chapterNumber, questionIndex, ans) => {
          if (chapterNumber === 1 && questionIndex === 0) ans.choiceIndex = (chapters[0].quiz.questions[0].correctIndex + 1) % 3;
        }) };
      }
      if (o.sessionId.includes("author-key-keyA")) return { finalMessage: keyAnswersReply(chapters) };
      return {};
    });
    const r = await runKeyJudgeEvidence(BOOK, chapters, deps, mkEvIo(), round);
    assert.ok(!r.ok);
    if (!r.ok) {
      assert.equal(r.category, "content");
      assert.match(r.reason, /NEEDS_ADJUDICATION/);
    }
    assert.equal(loadManualKeyJudge(BOOK, 1)?.status, "NEEDS_ADJUDICATION");
    const findings = checkManualKeyJudge(loadBookChapters(BOOK)[0], true);
    assert.equal(findings[0]?.checkId, "QC2.manual_keyjudge_not_pass");
  } finally {
    cleanup();
  }
});

test("runKeyJudgeEvidence: the REAL token check gates key-derive (a wrong keyA token fails closed)", async () => {
  const { chapters, round } = setup();
  try {
    const { deps } = mkDeps((o) => (o.sessionId.includes("author-key-") ? { finalMessage: keyAnswersReply(chapters) } : {}));
    const badRound: AuthorEvidenceRound = { roundId: round.roundId, tokens: { ...round.tokens, keyA: "not-the-token" } };
    const r = await runKeyJudgeEvidence(BOOK, chapters, deps, mkEvIo(), badRound);
    assert.ok(!r.ok);
    if (!r.ok) {
      assert.equal(r.category, "infra");
      assert.match(r.reason, /Invalid keyA token/);
    }
    assert.ok(!existsSync(keyDerivationPath(BOOK, ROUND, "keyA")), "no record without a valid round token");
  } finally {
    cleanup();
  }
});

test("runKeyJudgeEvidence: a reader that never yields parseable JSON fails closed after ONE respawn", async () => {
  const { chapters, round } = setup();
  try {
    const { deps, spawns } = mkDeps(() => ({ finalMessage: "no json here" }));
    const r = await runKeyJudgeEvidence(BOOK, chapters, deps, mkEvIo(), round);
    assert.ok(!r.ok);
    if (!r.ok) {
      assert.equal(r.category, "infra");
      assert.match(r.reason, /no parseable JSON/);
    }
    assert.equal(spawns.length, 2, "initial + exactly one respawn for keyA, then fail closed");
  } finally {
    cleanup();
  }
});

test("runKeyJudgeEvidence: a missing source-v2 sidecar is an infra fail (key packs cannot be built), never a skip", async () => {
  const { chapters, round } = setup();
  try {
    rmSync(resolve(REPO_ROOT, ".chapterflow/runs", BOOK, RUN, "sidecars"), { recursive: true, force: true });
    const { deps, spawns } = mkDeps(() => ({}));
    const r = await runKeyJudgeEvidence(BOOK, chapters, deps, mkEvIo(), round);
    assert.ok(!r.ok);
    if (!r.ok) {
      assert.equal(r.category, "infra");
      assert.match(r.reason, /sidecar/i);
    }
    assert.equal(spawns.length, 0, "no reader is spawned when the packs cannot exist");
  } finally {
    cleanup();
  }
});

// ── sweep evidence ────────────────────────────────────────────────────────────

test("runSweepEvidence: one independent read → real qc-submit + sweep record backed by roles.sweep; checkSweep PASSES; idempotent re-run", async () => {
  const { chapters, round } = setup();
  try {
    const { deps, spawns } = mkDeps((o) => (o.sessionId.includes("author-sweep") ? { finalMessage: sweepReply() } : {}));
    const r = await runSweepEvidence(BOOK, chapters, deps, mkEvIo(), round);
    assert.ok(r.ok, `expected ok, got ${JSON.stringify(r)}`);
    assert.equal(spawns.length, 1, "budget: ONE sweep reader (checkSweep needs one roles.sweep-backed clear read)");
    assert.equal(spawns[0].sandbox, "read-only");

    const rec = loadSweepRecord(BOOK)!;
    assert.equal(rec.verdict, "PASS");
    assert.equal(rec.roundId, ROUND, "record cites the acceptance round (whose round file carries roles.sweep)");
    assert.ok(rec.reviewer.startsWith("codex-qc:author-sweep"), "approved reviewer role");
    assert.ok(String(rec.reviewerSessionId).startsWith("author-sweep"), "stamped with the ACTUAL sweep reader session");
    assert.ok(rec.rawSubmissionFile && existsSync(rec.rawSubmissionFile), "the raw submission is preserved as evidence");
    assert.deepEqual([...(rec.checkedFamilies ?? [])].sort(), ["location_stamping", "persona_drift", "repeated_unit", "scene_skeleton"]);

    assert.deepEqual(checkSweep(loadBookChapters(BOOK), true), [], "the untouchable promote predicate passes");

    const { deps: deps2, spawns: spawns2 } = mkDeps(() => ({}));
    const again = await runSweepEvidence(BOOK, chapters, deps2, mkEvIo(), round);
    assert.ok(again.ok && again.skipped === true);
    assert.equal(spawns2.length, 0, "no new session on a satisfied re-run");
    assert.equal(loadSweepHistory(BOOK).length, 1, "no duplicate sweep records");
  } finally {
    cleanup();
  }
});

test("runSweepEvidence: a read with BLOCKING findings fails closed (record persists; promote blocks) — never softened", async () => {
  const { chapters, round } = setup();
  try {
    const { deps } = mkDeps((o) => (o.sessionId.includes("author-sweep")
      ? { finalMessage: sweepReply({ verdict: "REVISE", findings: [blockingSweepFinding(chapters)] }) }
      : {}));
    const r = await runSweepEvidence(BOOK, chapters, deps, mkEvIo(), round);
    assert.ok(!r.ok, "a gating sweep read must FAIL the evidence step");
    if (!r.ok) {
      assert.equal(r.category, "content");
      assert.match(r.reason, /QC3\.sweep_not_pass/);
    }
    assert.equal(loadSweepRecord(BOOK)?.verdict, "REVISE", "the real REVISE record persists as evidence");
    const findings = checkSweep(loadBookChapters(BOOK), true);
    assert.ok(findings.some((f) => f.checkId === "QC3.sweep_not_pass"), "promote predicate blocks the book");
  } finally {
    cleanup();
  }
});

test("runSweepEvidence: a sweep session matching a chapter's author session fails closed", async () => {
  const { chapters, round } = setup();
  try {
    const { deps, spawns } = mkDeps(() => ({}), (label, n) => (label.startsWith("author-sweep") ? "author-sess-9" : `${label}#${n}`));
    const io = mkEvIo({ authorSessionOf: (chapterId) => (chapterId.endsWith("ch02") ? "author-sess-9" : undefined) });
    const r = await runSweepEvidence(BOOK, chapters, deps, io, round);
    assert.ok(!r.ok);
    if (!r.ok) assert.match(r.reason, /author session/);
    assert.equal(spawns.length, 0);
    assert.equal(loadSweepRecord(BOOK), null, "no attestation from a non-independent session");
  } finally {
    cleanup();
  }
});

// ── THE deliverable: the evidence step + real promote predicates end to end ──

test("doAuthorReview E2E: acceptance produces keyA/keyB + sweep + attestation records and checkManualKeyJudge + checkSweep + checkQcAttestation ALL PASS in the no-API env", async () => {
  const chapters = setupState();
  try {
    const { deps, spawns } = mkDeps((o) => {
      if (o.sessionId.includes("author-book-reader")) return { finalMessage: bookReply(chapters) };
      const m = o.sessionId.match(/author-review-ch0*(\d+)/);
      if (m) return { finalMessage: reviewReply(chapters[Number(m[1]) - 1]) };
      if (o.sessionId.includes("author-key-")) return { finalMessage: keyAnswersReply(chapters) };
      if (o.sessionId.includes("author-sweep")) return { finalMessage: sweepReply() };
      return {};
    });
    // Everything real except the scratch doc location + review persistence:
    // real chapters on disk, real openQcRound, real key/sweep/bar/confirm/attest writers.
    const io: Partial<AuthorReviewIo> = mkEvIo();
    const result = await doAuthorReview(BOOK, deps, { maxParallel: 2, io });
    assert.equal(result, null, "review phase completes — the book is READY only after the evidence step");

    // Session budget: 2 chapter readers + 3 book readers (Q5) + 2 key readers + 1 sweep reader.
    assert.equal(spawns.filter((s) => s.sessionId.includes("author-review-ch")).length, 2);
    assert.equal(spawns.filter((s) => s.sessionId.includes("author-book-reader")).length, 3);
    assert.equal(spawns.filter((s) => s.sessionId.includes("author-key-")).length, 2, "TWO key readers per book — never per chapter");
    assert.equal(spawns.filter((s) => s.sessionId.includes("author-sweep")).length, 1, "ONE sweep reader");

    // THE PROOF: the real, untouchable promote predicates over the state the step wrote.
    const onDisk = loadBookChapters(BOOK);
    await withNoApiEnv(() => {
      for (const ch of onDisk) {
        const key = checkManualKeyJudge(ch, true);
        const parsedAttestation = loadAttestation(BOOK, ch.number, readFileSync(attestationPath(BOOK, ch.number)));
        assert.ok(parsedAttestation, `attestation bytes must parse for ch${ch.number}`);
        const authorProvenance = loadAuthorProvenance(ch.chapterId);
        const qcRound = parsedAttestation.roundId ? loadQcRound(BOOK, parsedAttestation.roundId) : null;
        const legacyRoundPresent = !!(
          parsedAttestation.roundRole &&
          qcRound?.roles?.[parsedAttestation.roundRole]
        );
        const artifactFindings = checkBarConfirmArtifactsForPublishable(ch, parsedAttestation, true);
        const att = checkQcAttestation(ch, true, {
          attestation: parsedAttestation,
          authorSessionId: authorProvenance?.authorSessionId,
          legacyRoundPresent,
          artifactFindings,
        });
        console.log(`  [proof] ch0${ch.number}: checkManualKeyJudge=${JSON.stringify(key)} checkQcAttestation=${JSON.stringify(att)}`);
        assert.deepEqual(key, [], `checkManualKeyJudge must PASS for ch${ch.number}`);
        assert.deepEqual(att, [], `checkQcAttestation must PASS for ch${ch.number}`);
      }
      const sweep = checkSweep(onDisk, true);
      console.log(`  [proof] book: checkSweep=${JSON.stringify(sweep)}`);
      assert.deepEqual(sweep, [], "checkSweep must PASS for the book");
    });
  } finally {
    cleanup();
  }
});

test("doAuthorReview E2E: a sweep-FAIL book halts CONTENT at acceptance — it never becomes READY and no attestations are written", async () => {
  const chapters = setupState();
  try {
    const { deps } = mkDeps((o) => {
      if (o.sessionId.includes("author-book-reader")) return { finalMessage: bookReply(chapters) };
      const m = o.sessionId.match(/author-review-ch0*(\d+)/);
      if (m) return { finalMessage: reviewReply(chapters[Number(m[1]) - 1]) };
      if (o.sessionId.includes("author-key-")) return { finalMessage: keyAnswersReply(chapters) };
      if (o.sessionId.includes("author-sweep")) return { finalMessage: sweepReply({ verdict: "REVISE", findings: [blockingSweepFinding(chapters)] }) };
      return {};
    });
    const result = await doAuthorReview(BOOK, deps, { maxParallel: 2, io: mkEvIo() });
    assert.ok(result && result.status === "halt", "must halt, not return READY");
    if (result && result.status === "halt") {
      assert.equal(result.category, "content");
      assert.match(result.reason, /author publish evidence \(sweep\)/);
      assert.match(result.reason, /QC3\.sweep_not_pass/);
    }
    assert.ok(!existsSync(attestationPath(BOOK, 1)), "fail closed BEFORE the PUBLISHABLE attestations are written");
    assert.equal(loadSweepRecord(BOOK)?.verdict, "REVISE", "the disagreeing sweep read persists as evidence");
  } finally {
    cleanup();
  }
});

test("doAuthorReview E2E: a wrong stored quiz key halts CONTENT via the key-judge evidence (the honesty-independent catch)", async () => {
  const chapters = setupState();
  try {
    // BOTH independent readers derive the same prose-supported answer, which
    // disagrees with the stored key on ch1 Q1 — the CORRUPTION signal.
    const wrong = (chapterNumber: number, questionIndex: number, ans: any) => {
      if (chapterNumber === 1 && questionIndex === 0) ans.choiceIndex = (chapters[0].quiz.questions[0].correctIndex + 1) % 3;
    };
    const { deps } = mkDeps((o) => {
      if (o.sessionId.includes("author-book-reader")) return { finalMessage: bookReply(chapters) };
      const m = o.sessionId.match(/author-review-ch0*(\d+)/);
      if (m) return { finalMessage: reviewReply(chapters[Number(m[1]) - 1]) };
      if (o.sessionId.includes("author-key-")) return { finalMessage: keyAnswersReply(chapters, wrong) };
      if (o.sessionId.includes("author-sweep")) return { finalMessage: sweepReply() };
      return {};
    });
    const result = await doAuthorReview(BOOK, deps, { maxParallel: 2, io: mkEvIo() });
    assert.ok(result && result.status === "halt");
    if (result && result.status === "halt") {
      assert.equal(result.category, "content");
      assert.match(result.reason, /author publish evidence \(manual key-judge\)/);
      assert.match(result.reason, /CORRUPTION/);
    }
    assert.ok(!existsSync(attestationPath(BOOK, 1)), "no PUBLISHABLE attestation for a corrupt-key book");
  } finally {
    cleanup();
  }
});
test("runSweepEvidence: a validator REJECTION triggers exactly ONE format-retry with the errors in the task (live finding 2026-07-03)", async () => {
  const { chapters, round } = setup();
  try {
    let sweepSpawns = 0;
    const { deps } = mkDeps((o) => {
      if (!o.sessionId.includes("author-sweep")) return {};
      sweepSpawns++;
      if (sweepSpawns === 1) {
        // A finding with an EMPTY chapters array — the real validator rejects it.
        if (o.task.includes("YOUR PREVIOUS SUBMISSION WAS REJECTED")) throw new Error("attempt 1 must not carry a rejection note");
        return {
          finalMessage: sweepReply({
            verdict: "PASS",
            findings: [{ family: "repeated_unit", severity: "advisory", chapters: [], unitId: "examples[0].scenario", repairClass: "repeated_unit", quote: "shell", problem: "shell reuse across chapters", expectedFix: "vary it" }],
          }),
        };
      }
      if (!o.task.includes("YOUR PREVIOUS SUBMISSION WAS REJECTED")) throw new Error("attempt 2 must carry the validator errors");
      return { finalMessage: sweepReply() };
    });
    const r = await runSweepEvidence(BOOK, chapters, deps, mkEvIo(), round);
    assert.ok(r.ok, `retry must converge (got ${JSON.stringify(r)})`);
    assert.equal(sweepSpawns, 2, "exactly one format retry");
    assert.equal(loadSweepRecord(BOOK)!.verdict, "PASS", "the retried clean submission became the record");
  } finally {
    cleanup();
  }
});
