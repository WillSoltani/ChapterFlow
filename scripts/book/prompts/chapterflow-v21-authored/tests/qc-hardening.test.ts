/**
 * Regression tests for the QC + publish hardening pass:
 *  - A2  checkRoundFreshness fails CLOSED (no/partial creation hashes ⇒ stale)
 *  - A3  isSemanticFinding keys on the semantic THEME set (so a finalizer-sourced
 *        sweep/axis finding can't be staled by a cosmetic edit), while a
 *        deterministic theme (book_gate/intra_book/source_v2) stays staleable
 *  - B1  submitQcArtifact rejects a non-approved reviewer at the ingest door
 *  - B2  session-independence is OFF by default and short-circuits on absence
 */

import assert from "node:assert/strict";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";

import { test } from "./harness.js";
import { PIPELINE_DIR, STATE_CHAPTERS, TMP_DIR, makeChapter, writeFixtureBook } from "./helpers.js";
import {
  chapterContentHash,
  checkQcAttestation,
  writeAttestation,
  attestationPath,
  type QcAttestation,
} from "../src/critics/qcAttestation.js";
import { checkRoundFreshness, isSemanticFinding, submitQcArtifact } from "../src/qc/orchestrator/index.js";
import { roundRecordPath } from "../src/qc/orchestrator/artifacts.js";
import { openQcRound, qcRoundPath } from "../src/qc/qcRound.js";
import { provenancePath, recordAuthorProvenance } from "../src/qc/sessionProvenance.js";

const BOOK = "zz-hardening-fixture";
const ROUND = "rtest-hardening";

function cleanup(): void {
  for (const n of [1, 2]) {
    rmSync(resolve(STATE_CHAPTERS, `${BOOK}-ch${String(n).padStart(2, "0")}.v21-native.chapter.json`), { force: true });
    rmSync(attestationPath(BOOK, n), { force: true });
    rmSync(provenancePath(`${BOOK}-ch${String(n).padStart(2, "0")}`), { force: true });
  }
  rmSync(resolve(PIPELINE_DIR, "state", "qc-orchestrator", BOOK), { recursive: true, force: true });
  rmSync(qcRoundPath(BOOK, ROUND), { force: true });
  rmSync(TMP_DIR, { recursive: true, force: true });
}

function withSession<T>(sessionId: string, fn: () => T): T {
  const prev = process.env.CHAPTERFLOW_SESSION_ID;
  try {
    process.env.CHAPTERFLOW_SESSION_ID = sessionId;
    return fn();
  } finally {
    if (prev === undefined) delete process.env.CHAPTERFLOW_SESSION_ID;
    else process.env.CHAPTERFLOW_SESSION_ID = prev;
  }
}

function writeRoundRecord(hashes: Record<string, string> | undefined): void {
  const path = roundRecordPath(BOOK, ROUND);
  mkdirSync(dirname(path), { recursive: true });
  const record: Record<string, unknown> = {
    schemaVersion: "qc-orchestrator-round-v1",
    bookId: BOOK,
    roundId: ROUND,
    createdAt: "2026-06-13T00:00:00.000Z",
    chapters: [1, 2],
    taskCards: [],
  };
  if (hashes) record.chapterContentHashes = hashes;
  writeFileSync(path, JSON.stringify(record, null, 2) + "\n", "utf8");
}

// ── A2: freshness fails closed ──────────────────────────────────────────────
test("checkRoundFreshness fails CLOSED when a round has no creation-time hashes", () => {
  try {
    cleanup();
    const chapters = [makeChapter(BOOK, 1), makeChapter(BOOK, 2)];
    writeFixtureBook(STATE_CHAPTERS, chapters);
    writeRoundRecord(undefined);
    const r = checkRoundFreshness(BOOK, ROUND);
    assert.equal(r.fresh, false, "a hashless round must be treated as stale, not fresh");
    assert.equal(r.missingHashes, true);
    assert.deepEqual(r.staleChapters.sort((a, b) => a - b), [1, 2]);
  } finally {
    cleanup();
  }
});

test("checkRoundFreshness: matching hashes are fresh, a changed chapter is stale", () => {
  try {
    cleanup();
    const chapters = [makeChapter(BOOK, 1), makeChapter(BOOK, 2)];
    writeFixtureBook(STATE_CHAPTERS, chapters);
    const good = { "1": chapterContentHash(chapters[0]), "2": chapterContentHash(chapters[1]) };
    writeRoundRecord(good);
    assert.equal(checkRoundFreshness(BOOK, ROUND).fresh, true);

    writeRoundRecord({ ...good, "2": "deadbeefdeadbeef" });
    const r = checkRoundFreshness(BOOK, ROUND);
    assert.equal(r.fresh, false);
    assert.deepEqual(r.staleChapters, [2]);

    // A selected chapter missing from the map is stale, not silently fresh.
    writeRoundRecord({ "1": good["1"] });
    assert.equal(checkRoundFreshness(BOOK, ROUND).fresh, false);
    assert.deepEqual(checkRoundFreshness(BOOK, ROUND).staleChapters, [2]);
  } finally {
    cleanup();
  }
});

// ── A3: semantic-finding classification ─────────────────────────────────────
test("isSemanticFinding: semantic themes are semantic regardless of source role", () => {
  // sweep family re-injected by the finalizer (sourceRole 'finalizer', not 'sweep')
  assert.equal(isSemanticFinding(["finalizer"], "scene_skeleton", "scene_skeleton"), true);
  // a publishable-bar axis
  assert.equal(isSemanticFinding(["finalizer"], "prose_coherence", "prose_coherence"), true);
  assert.equal(isSemanticFinding([], "manual_keyjudge", "manual_keyjudge"), true);
  // source role alone still works
  assert.equal(isSemanticFinding(["sweep"], "anything", "anything"), true);
  assert.equal(isSemanticFinding(["bar"], "x"), true);
});

test("isSemanticFinding: deterministic finalizer themes stay staleable (NOT semantic)", () => {
  // These re-run cleanly at verify time, so they must go stale_after_repair, not
  // needs_qc_rerun — otherwise a clean deterministic fix can never clear them.
  assert.equal(isSemanticFinding(["finalizer"], "book_gate", "book_gate"), false);
  assert.equal(isSemanticFinding(["finalizer"], "intra_book", "intra_book"), false);
  assert.equal(isSemanticFinding(["finalizer"], "source_v2", "source_v2"), false);
  assert.equal(isSemanticFinding(["finalizer"], "examples", "examples"), false);
});

// ── B1: reviewer-identity at the submission ingest door ─────────────────────
function sweepSubmission(reviewer: string): unknown {
  return {
    schemaVersion: "qc-sweep-submission-v1",
    bookId: BOOK,
    roundId: ROUND,
    role: "sweep",
    reviewer,
    verdict: "PASS",
    checkedFamilies: ["scene_skeleton", "persona_drift", "repeated_unit", "location_stamping"],
    findings: [],
  };
}

test("submitQcArtifact rejects a non-approved reviewer and accepts an approved one", () => {
  try {
    cleanup();
    rmSync(qcRoundPath(BOOK, ROUND), { force: true });
    const opened = openQcRound(BOOK, ROUND);
    mkdirSync(TMP_DIR, { recursive: true });

    const bareFile = resolve(TMP_DIR, "sweep-bare.json");
    writeFileSync(bareFile, JSON.stringify(sweepSubmission("wave-a-sweep-codex")), "utf8");
    const bad = withSession("qc-hardening-submit-session", () => submitQcArtifact(BOOK, ROUND, "sweep", bareFile, opened.tokens.sweep));
    assert.equal(bad.ok, false, "a bare-string reviewer must be rejected");
    assert.match(bad.errors.join(" "), /not an approved QC role/);

    const okFile = resolve(TMP_DIR, "sweep-ok.json");
    writeFileSync(okFile, JSON.stringify(sweepSubmission("codex-qc:reviewer-1")), "utf8");
    const good = withSession("qc-hardening-submit-session", () => submitQcArtifact(BOOK, ROUND, "sweep", okFile, opened.tokens.sweep));
    assert.equal(good.ok, true, good.errors.join("; "));
  } finally {
    cleanup();
  }
});

// ── B2: session independence is opt-in and absence-safe ─────────────────────
test("session independence is OFF by default and short-circuits on absent ids", async () => {
  const { violatesSessionIndependence } = await import("../src/qc/sessionProvenance.js");
  const prev = process.env.CHAPTERFLOW_ENFORCE_SESSION_INDEPENDENCE;
  const prevNoApi = process.env.CHAPTERFLOW_NO_API_CODEX_QC;
  try {
    delete process.env.CHAPTERFLOW_ENFORCE_SESSION_INDEPENDENCE;
    delete process.env.CHAPTERFLOW_NO_API_CODEX_QC;
    assert.equal(violatesSessionIndependence("s1", "s1"), false, "off by default");
    process.env.CHAPTERFLOW_ENFORCE_SESSION_INDEPENDENCE = "1";
    assert.equal(violatesSessionIndependence("s1", "s1"), true, "same session author+reviewer ⇒ violation");
    assert.equal(violatesSessionIndependence("s1", "s2"), false, "different sessions ⇒ fine");
    assert.equal(violatesSessionIndependence(undefined, "s1"), false, "absent author ⇒ no block");
    assert.equal(violatesSessionIndependence("s1", undefined), false, "absent reviewer ⇒ no block");
  } finally {
    if (prev === undefined) delete process.env.CHAPTERFLOW_ENFORCE_SESSION_INDEPENDENCE;
    else process.env.CHAPTERFLOW_ENFORCE_SESSION_INDEPENDENCE = prev;
    if (prevNoApi === undefined) delete process.env.CHAPTERFLOW_NO_API_CODEX_QC;
    else process.env.CHAPTERFLOW_NO_API_CODEX_QC = prevNoApi;
  }
});

test("checkQcAttestation: enforcement ON but no author provenance ⇒ no findings (absence-safe)", () => {
  const prevEnf = process.env.CHAPTERFLOW_ENFORCE_SESSION_INDEPENDENCE;
  const prevNoApi = process.env.CHAPTERFLOW_NO_API_CODEX_QC;
  try {
    cleanup();
    delete process.env.CHAPTERFLOW_NO_API_CODEX_QC; // isolate from the no-api round-backing checks
    const ch = makeChapter(BOOK, 1);
    writeFixtureBook(STATE_CHAPTERS, [ch]);
    const att: QcAttestation = {
      schemaVersion: "qc-attest-v1",
      bookId: BOOK,
      chapterNumber: 1,
      chapterId: ch.chapterId,
      verdict: "PUBLISHABLE",
      contentHash: chapterContentHash(ch),
      hashVersion: "v2",
      reviewer: "codex-qc:reviewer-1",
      reviewedAt: "2026-06-13T00:00:00.000Z",
      reviewerSessionId: "qc-session-1",
    };
    writeAttestation(att);

    process.env.CHAPTERFLOW_ENFORCE_SESSION_INDEPENDENCE = "1";
    assert.deepEqual(checkQcAttestation(ch, true), [], "no author provenance ⇒ must not block (absence-safe)");

    // Same session authored AND reviewed ⇒ blocked.
    recordAuthorProvenance(ch.chapterId, "qc-session-1");
    const blocked = checkQcAttestation(ch, true);
    assert.equal(blocked.length, 1);
    assert.equal(blocked[0].checkId, "QC0.author_graded_own_work");

    // A different authoring session ⇒ clean again.
    recordAuthorProvenance(ch.chapterId, "author-session-9");
    assert.deepEqual(checkQcAttestation(ch, true), []);
  } finally {
    if (prevEnf === undefined) delete process.env.CHAPTERFLOW_ENFORCE_SESSION_INDEPENDENCE;
    else process.env.CHAPTERFLOW_ENFORCE_SESSION_INDEPENDENCE = prevEnf;
    if (prevNoApi === undefined) delete process.env.CHAPTERFLOW_NO_API_CODEX_QC;
    else process.env.CHAPTERFLOW_NO_API_CODEX_QC = prevNoApi;
    cleanup();
  }
});

test("checkQcAttestation: no-api mode classifies missing provenance as legacy/unknown and blocks certification", () => {
  const prevNoApi = process.env.CHAPTERFLOW_NO_API_CODEX_QC;
  try {
    cleanup();
    const ch = makeChapter(BOOK, 1);
    writeFixtureBook(STATE_CHAPTERS, [ch]);
    writeAttestation({
      schemaVersion: "qc-attest-v1",
      bookId: BOOK,
      chapterNumber: 1,
      chapterId: ch.chapterId,
      verdict: "PUBLISHABLE",
      contentHash: chapterContentHash(ch),
      hashVersion: "v2",
      reviewer: "codex-qc:reviewer-1",
      reviewedAt: "2026-06-13T00:00:00.000Z",
      roundId: ROUND,
      roundRole: "confirm",
    });

    process.env.CHAPTERFLOW_NO_API_CODEX_QC = "1";
    const findings = checkQcAttestation(ch, true);
    assert.equal(findings[0].checkId, "QC0.legacy_unknown_reviewer_session");
    assert.match(findings[0].message, /legacy\/unknown/i);
  } finally {
    if (prevNoApi === undefined) delete process.env.CHAPTERFLOW_NO_API_CODEX_QC;
    else process.env.CHAPTERFLOW_NO_API_CODEX_QC = prevNoApi;
    cleanup();
  }
});

// I5·W1 (promote side): a PUBLISHABLE attestation is a certificate that independence was verified when it
// was written, so a LATER-lost author sidecar (untracked → gone on a fresh checkout/resume) must not
// re-block it at promote. Crucially, this is done by trusting the certificate — NOT by manufacturing a
// synthetic author — so a RECORDED self-grade (author == reviewer) is still caught.
test("checkQcAttestation: a PUBLISHABLE attestation is not re-blocked on a LOST author sidecar, but a RECORDED self-grade still is (I5·W1)", () => {
  const prevNoApi = process.env.CHAPTERFLOW_NO_API_CODEX_QC;
  try {
    cleanup();
    const ch = makeChapter(BOOK, 1);
    writeFixtureBook(STATE_CHAPTERS, [ch]);
    const attest = (verdict: "PUBLISHABLE" | "REVISE") => writeAttestation({
      schemaVersion: "qc-attest-v1", bookId: BOOK, chapterNumber: 1, chapterId: ch.chapterId,
      verdict, contentHash: chapterContentHash(ch), hashVersion: "v2",
      reviewer: "codex-qc:reviewer-1", reviewerSessionId: "auto-finalize-xyz", // present → passes the reviewer-session check
      reviewedAt: "2026-06-13T00:00:00.000Z", roundId: ROUND, roundRole: "confirm",
    });
    process.env.CHAPTERFLOW_NO_API_CODEX_QC = "1";

    // (1) PUBLISHABLE + reviewer recorded + author sidecar ABSENT (lost on checkout) ⇒ NOT re-blocked on author.
    attest("PUBLISHABLE");
    const lostSidecar = checkQcAttestation(ch, true);
    assert.ok(!lostSidecar.some((f) => f.checkId === "QC0.legacy_unknown_author_session"),
      `a PUBLISHABLE attestation must not re-block on a lost author sidecar: ${JSON.stringify(lostSidecar)}`);

    // (2) The exemption does NOT launder a RECORDED self-grade: author sidecar present AND equal to the
    // reviewer session ⇒ author_graded_own_work still fires (caught at line 307, before the exemption).
    recordAuthorProvenance(ch.chapterId, "auto-finalize-xyz");
    const selfGrade = checkQcAttestation(ch, true);
    assert.ok(selfGrade.some((f) => f.checkId === "QC0.author_graded_own_work"),
      `a recorded author==reviewer self-grade must still be caught: ${JSON.stringify(selfGrade)}`);
  } finally {
    if (prevNoApi === undefined) delete process.env.CHAPTERFLOW_NO_API_CODEX_QC;
    else process.env.CHAPTERFLOW_NO_API_CODEX_QC = prevNoApi;
    cleanup();
  }
});
