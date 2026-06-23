import assert from "node:assert/strict";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";

import { test, skip } from "./harness.js";
import { PIPELINE_DIR, STATE_CHAPTERS, makeChapter, runCli, writeFixtureBook } from "./helpers.js";
import { checkQcAttestation, attestationPath, chapterContentHash, loadAttestation, writeAttestation } from "../src/critics/qcAttestation.js";
import { runBookGate } from "../src/critics/bookGate.js";
import { AXIS_WEIGHTS, computeVerdict, type AxisId, type AxisScore } from "../src/critics/semantic/publishableBar.js";
import { REPO_ROOT } from "../src/lib/chapterPaths.js";
import type { ChapterV21 } from "../src/types.js";
import { checkManualKeyJudge, keyDerivationPath, keyPackDir, loadKeyPack, manualKeyJudgePath, writeKeyPacks, type KeyDerivation } from "../src/qc/manualKeyJudge.js";
import { currentMajorFindings, unresolvedMajors, waiverPath } from "../src/qc/majorDisposition.js";
import { openQcRound, qcRoundPath } from "../src/qc/qcRound.js";
import {
  barArtifactPath,
  confirmArtifactPath,
  evidenceMatrixPath,
  orchestratorRoundDir,
  qcSummaryPath,
  repairLedgerPath,
  repairPromptPath,
  roundRecordPath,
  submissionsDir,
  taskCardsDir,
  writeBarReadArtifact,
  writeConfirmReadArtifact,
} from "../src/qc/orchestrator/artifacts.js";
import { finalizeQcRound } from "../src/qc/orchestrator/finalize.js";
import { generateConfirmCandidates } from "../src/qc/orchestrator/index.js";
import { effectiveLedger, appendFindings } from "../src/qc/orchestrator/ledger.js";
import { checkSourceV2Gate, sourceHashFor, sourceSidecarPathFor } from "../src/qc/sourceV2Gate.js";
import { REQUIRED_SWEEP_FAMILIES, checkSweep, sweepRecordPath, writeSweepRecordFromSubmission } from "../src/qc/sweep.js";

const BOOK = "zz-fixture-finalize-evidence";
const GREEN_BOOK = "zz-fixture-finalize-green";
const MAJOR_BOOK = "zz-fixture-finalize-major";
const ROUND = "r-finalize";
const RUN = "20260612T000000Z";
const SOURCE_BOOK = "stillness-is-the-key";
const SOURCE_CHAPTER_NUMBER = 5;

// These tests CLONE a real gold chapter + its SOURCE SIDECAR (.chapterflow/runs), which is
// generated research data — never committed (fixture policy: no copyrighted source text in
// git). On the authoring box the sidecar is present and they run; in CI / a fresh checkout
// it's absent, so they SKIP (loudly) instead of hard-failing on the missing dependency —
// same contract as the gold-chapter tests. The hermetic (synthetic-fixture) tests below
// keep running everywhere.
const goldTest: (name: string, fn: () => void | Promise<void>) => void =
  sourceSidecarPathFor(SOURCE_BOOK, SOURCE_CHAPTER_NUMBER)
    ? test
    : (name) => skip(name, `gold source sidecar for ${SOURCE_BOOK} ch${SOURCE_CHAPTER_NUMBER} (.chapterflow/runs) not present`);

function cleanup(): void {
  for (const bookId of [BOOK, GREEN_BOOK, MAJOR_BOOK]) {
    for (const f of readdirSync(STATE_CHAPTERS)) {
      if (f.startsWith(`${bookId}-ch`)) rmSync(resolve(STATE_CHAPTERS, f), { force: true });
    }
    rmSync(resolve(REPO_ROOT, ".chapterflow/runs", bookId), { recursive: true, force: true });
    rmSync(orchestratorRoundDir(bookId, ROUND), { recursive: true, force: true });
    rmSync(keyPackDir(bookId, ROUND), { recursive: true, force: true });
    rmSync(qcRoundPath(bookId, ROUND), { force: true });
    rmSync(waiverPath(bookId), { force: true });
    rmSync(sweepRecordPath(bookId), { force: true });
    rmSync(resolve(PIPELINE_DIR, "state", "briefs", `${bookId}.manual-brief.json`), { force: true });
    rmSync(resolve(PIPELINE_DIR, "state", "shape-plans", `${bookId}.shape-plan.json`), { force: true });
    rmSync(resolve(PIPELINE_DIR, "state", "exemplar-plans", `${bookId}.exemplar-plan.json`), { force: true });
    for (const n of [1, 2, 3, 4, 5, 6]) {
      rmSync(attestationPath(bookId, n), { force: true });
      rmSync(manualKeyJudgePath(bookId, n), { force: true });
      rmSync(resolve(PIPELINE_DIR, "state", "plans", `${bookId}-ch${String(n).padStart(2, "0")}.manual-plan.json`), { force: true });
    }
  }
}

function clonedCleanChapter(bookId: string): ChapterV21 {
  const sourcePath = resolve(STATE_CHAPTERS, `${SOURCE_BOOK}-ch${String(SOURCE_CHAPTER_NUMBER).padStart(2, "0")}.v21-native.chapter.json`);
  const chapter = JSON.parse(readFileSync(sourcePath, "utf8")) as ChapterV21;
  chapter.chapterId = `${bookId}-ch${String(SOURCE_CHAPTER_NUMBER).padStart(2, "0")}`;
  return chapter;
}

function writeClonedSourceSidecar(bookId: string): void {
  const sourcePath = sourceSidecarPathFor(SOURCE_BOOK, SOURCE_CHAPTER_NUMBER);
  assert.ok(sourcePath, `missing source sidecar for ${SOURCE_BOOK} ch${SOURCE_CHAPTER_NUMBER}`);
  const sidecar = JSON.parse(readFileSync(sourcePath, "utf8"));
  sidecar.namedExamples = Array.isArray(sidecar.namedExamples) ? sidecar.namedExamples : [];
  for (const ex of sidecar.namedExamples) {
    ex.hardSpecifics = Array.isArray(ex.hardSpecifics) && ex.hardSpecifics.length >= 2
      ? ex.hardSpecifics
      : [`${ex.label ?? "Fixture"} marker`, `${ex.label ?? "Fixture"} decision`];
  }
  while (sidecar.namedExamples.length < 3) {
    const i = sidecar.namedExamples.length + 1;
    sidecar.namedExamples.push({
      id: `fixture-extra-${i}`,
      label: `Fixture Anchor ${i}`,
      summary: `Fixture Anchor ${i} provides an extra named source example for the source-v2 floor.`,
      hardSpecifics: [`Fixture Anchor ${i} marker`, `Fixture Anchor ${i} decision`],
      realWorld: true,
    });
  }
  const dir = resolve(REPO_ROOT, ".chapterflow/runs", bookId, RUN, "sidecars/source");
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, `ch${String(SOURCE_CHAPTER_NUMBER).padStart(2, "0")}.source.json`), JSON.stringify(sidecar, null, 2), "utf8");
}

function writeRoundRecord(bookId: string, chapters: ChapterV21[]): void {
  const path = roundRecordPath(bookId, ROUND);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify({
    schemaVersion: "qc-orchestrator-round-v1",
    bookId,
    roundId: ROUND,
    createdAt: "2026-06-12T00:00:00.000Z",
    chapters: chapters.map((ch) => ch.number),
    qcRoundFile: qcRoundPath(bookId, ROUND),
    preflight: {
      sourceV2Gate: { passed: true, findings: 0 },
      bookGate: { passed: true, findings: 0 },
      keyPack: { paths: [], error: undefined },
      sweepPack: { path: undefined, error: undefined },
      barPack: { packPath: undefined, templatePath: undefined, errors: [] },
    },
    taskCards: [],
    // Stamp creation-time hashes (mirrors createQcOrchestrationRound) so the
    // freshness gate sees a FRESH round and the downstream gates (e.g. the
    // major gate) actually run, instead of qc-auto short-circuiting on a
    // hashless round now that checkRoundFreshness fails closed.
    chapterContentHashes: Object.fromEntries(chapters.map((ch) => [String(ch.number), chapterContentHash(ch)])),
  }, null, 2) + "\n", "utf8");
}

function writePlanningArtifacts(bookId: string, chapters: ChapterV21[]): void {
  const briefPath = resolve(PIPELINE_DIR, "state", "briefs", `${bookId}.manual-brief.json`);
  mkdirSync(dirname(briefPath), { recursive: true });
  writeFileSync(briefPath, JSON.stringify({
    schemaVersion: "manual-book-brief-v1",
    bookId,
    title: "Finalize Fixture",
    audience: "test readers checking a no-api QC finalizer",
    corePromise: "Slow the first decision until the evidence is visible.",
  }, null, 2) + "\n", "utf8");
  for (const chapter of chapters) {
    const planPath = resolve(PIPELINE_DIR, "state", "plans", `${chapter.chapterId}.manual-plan.json`);
    mkdirSync(dirname(planPath), { recursive: true });
    writeFileSync(planPath, JSON.stringify({
      schemaVersion: "manual-chapter-plan-v1",
      bookId,
      chapterId: chapter.chapterId,
      chapterNumber: chapter.number,
      title: chapter.title,
      coreMove: "Pause the handoff, inspect the current signal, and decide from evidence.",
    }, null, 2) + "\n", "utf8");
  }
}

function sweepPassSubmission(bookId: string) {
  return {
    schemaVersion: "qc-sweep-submission-v1" as const,
    bookId,
    roundId: ROUND,
    role: "sweep" as const,
    reviewer: "codex-qc:sweep-fixture",
    verdict: "PASS" as const,
    checkedFamilies: [...REQUIRED_SWEEP_FAMILIES],
    findings: [],
  };
}

function writeRawSweepSubmission(bookId: string): void {
  const path = resolve(submissionsDir(bookId, ROUND, "sweep"), "sweep-pass.json");
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(sweepPassSubmission(bookId), null, 2) + "\n", "utf8");
}

function writeKeyDerivations(bookId: string, chapters: ChapterV21[]): void {
  writeKeyPacks(bookId, ROUND);
  for (const role of ["keyA", "keyB"] as const) {
    const rec: KeyDerivation = {
      schemaVersion: "manual-key-derive-v2",
      bookId,
      roundId: ROUND,
      role,
      derivedAt: "2026-06-12T00:00:00.000Z",
      chapters: chapters.map((chapter) => {
        const pack = loadKeyPack(bookId, ROUND, chapter.number);
        assert.ok(pack, `missing key pack for ch${chapter.number}`);
        const factId = pack.sourceFacts[0]?.id;
        assert.ok(factId, `missing source fact for ch${chapter.number}`);
        return {
          chapterNumber: chapter.number,
          chapterId: chapter.chapterId,
          packHash: pack.packHash,
          contentHash: pack.contentHash,
          sourceHash: pack.sourceHash,
          answers: chapter.quiz.questions.map((q, i) => ({
            questionIndex: i,
            choiceIndex: q.correctIndex,
            confidence: 0.96,
            reason: `The fixture sidecar fact supports the stored answer for question ${i + 1}, and both readers independently cite the same source.`,
            sourceFactIds: [factId],
          })),
        };
      }),
    };
    writeFileSync(keyDerivationPath(bookId, ROUND, role), JSON.stringify(rec, null, 2) + "\n", "utf8");
  }
}

function writeBarAndConfirm(bookId: string, chapters: ChapterV21[]): void {
  for (const chapter of chapters) {
    const contentHash = chapterContentHash(chapter);
    const sourceHash = sourceHashFor(bookId, chapter.number);
    assert.ok(sourceHash, `missing source hash for ch${chapter.number}`);
    const axes: AxisScore[] = (Object.keys(AXIS_WEIGHTS) as AxisId[])
      .filter((axis) => axis !== "quiz_key_correctness")
      .map((axis) => ({ axis, score: 0.94, tier: "PUBLISHABLE", hits: [] }));
    writeBarReadArtifact({
      schemaVersion: "qc-bar-read-v2",
      bookId,
      roundId: ROUND,
      role: "bar",
      reviewer: "codex-qc:bar-fixture",
      chapterNumber: chapter.number,
      chapterId: chapter.chapterId,
      contentHash,
      sourceHash,
      axes,
      notes: "Fixture bar read scores every non-key axis as publishable.",
      verdict: computeVerdict(chapter.chapterId, axes, true),
    });
    writeConfirmReadArtifact({
      schemaVersion: "qc-confirm-read-v1",
      bookId,
      roundId: ROUND,
      role: "confirm",
      reviewer: "codex-qc:confirm-fixture",
      chapterNumber: chapter.number,
      chapterId: chapter.chapterId,
      contentHash,
      decision: "PUBLISHABLE",
      reason: "Independent confirm read agrees that all required evidence is fresh, source-backed, and publishable for this fixture chapter.",
      findings: [],
    });
  }
}

function setupGreenEvidence(bookId: string, chapters: ChapterV21[], opts: { rawSweepSubmission?: boolean } = {}): void {
  writeFixtureBook(STATE_CHAPTERS, chapters);
  writeClonedSourceSidecar(bookId);
  writePlanningArtifacts(bookId, chapters);
  openQcRound(bookId, ROUND);
  writeRoundRecord(bookId, chapters);
  writeKeyDerivations(bookId, chapters);
  writeSweepRecordFromSubmission(sweepPassSubmission(bookId));
  if (opts.rawSweepSubmission) writeRawSweepSubmission(bookId);
  writeBarAndConfirm(bookId, chapters);
}

function noApiQcBlockers(bookId: string, chapters: ChapterV21[]): string[] {
  const prev = process.env.CHAPTERFLOW_NO_API_CODEX_QC;
  try {
    process.env.CHAPTERFLOW_NO_API_CODEX_QC = "1";
    return [
      ...checkSourceV2Gate(bookId, chapters.map((ch) => ch.number)).findings.map((f) => f.checkId),
      ...chapters.flatMap((ch) => checkManualKeyJudge(ch, true).map((f) => f.checkId)),
      ...checkSweep(chapters, true).map((f) => f.checkId),
      ...unresolvedMajors(bookId, chapters, true).map(() => "QC4.major_unresolved"),
      ...chapters.flatMap((ch) => checkQcAttestation(ch, true).map((f) => f.checkId)),
    ];
  } finally {
    if (prev === undefined) delete process.env.CHAPTERFLOW_NO_API_CODEX_QC;
    else process.env.CHAPTERFLOW_NO_API_CODEX_QC = prev;
  }
}

test("finalize marks missing evidence NEEDS_MORE_QC and writes no PUBLISHABLE attestation", () => {
  const oldWarn = console.warn;
  try {
    console.warn = () => {};
    cleanup();
    writeFixtureBook(STATE_CHAPTERS, [makeChapter(BOOK, 1)]);
    const result = finalizeQcRound(BOOK, ROUND, { chapters: [1] });
    assert.equal(result.incomplete, true);
    assert.equal(result.chapters[0].finalVerdict, "NEEDS_MORE_QC");
    assert.equal(result.attestationsWritten, 0);
    assert.equal(existsSync(attestationPath(BOOK, 1)), false);
    assert.ok(existsSync(evidenceMatrixPath(BOOK, ROUND)));
    const matrix = JSON.parse(readFileSync(evidenceMatrixPath(BOOK, ROUND), "utf8"));
    assert.equal(matrix.chapters[0].finalVerdict, "NEEDS_MORE_QC");
  } finally {
    console.warn = oldWarn;
    cleanup();
  }
});

goldTest("finalize writes PUBLISHABLE attestation with evidence paths when all no-api QC evidence is green", () => {
  try {
    cleanup();
    const chapter = clonedCleanChapter(GREEN_BOOK);
    setupGreenEvidence(GREEN_BOOK, [chapter]);
    const result = finalizeQcRound(GREEN_BOOK, ROUND, { chapters: [SOURCE_CHAPTER_NUMBER] });
    assert.equal(result.allPublishable, true, JSON.stringify({
      finalVerdict: result.chapters[0].finalVerdict,
      reason: result.chapters[0].reason,
      checks: result.chapters[0].checks,
      majorStatus: result.chapters[0].majorStatus,
      bookGateFindings: runBookGate(GREEN_BOOK, [chapter]).findings.map((f) => ({ id: f.catalogId, severity: f.severity, message: f.message })),
    }));
    assert.equal(result.attestationsWritten, 1);
    const att = loadAttestation(GREEN_BOOK, SOURCE_CHAPTER_NUMBER);
    assert.equal(att?.verdict, "PUBLISHABLE");
    assert.equal(att?.evidence?.evidenceMatrixPath, evidenceMatrixPath(GREEN_BOOK, ROUND));
    assert.ok(att?.evidence?.manualKeyJudgePath);
    assert.ok(att?.evidence?.sweepPath);
    assert.ok(att?.evidence?.barReadPath);
    assert.ok(att?.evidence?.confirmReadPath);
    assert.deepEqual(noApiQcBlockers(GREEN_BOOK, [chapter]), []);
  } finally {
    cleanup();
  }
});

goldTest("finalize dryRun computes the same verdict but writes NOTHING durable (a preflight must not mutate QC state)", () => {
  try {
    cleanup();
    const chapter = clonedCleanChapter(GREEN_BOOK);
    setupGreenEvidence(GREEN_BOOK, [chapter]);
    // Real finalize first: writes the PUBLISHABLE attestation + evidence matrix + qc-summary + ledger.
    const real = finalizeQcRound(GREEN_BOOK, ROUND, { chapters: [SOURCE_CHAPTER_NUMBER] });
    assert.equal(real.allPublishable, true);
    assert.equal(real.attestationsWritten, 1);

    // Snapshot every durable artifact the dry-run must NOT touch.
    const watched = [
      attestationPath(GREEN_BOOK, SOURCE_CHAPTER_NUMBER),
      evidenceMatrixPath(GREEN_BOOK, ROUND),
      qcSummaryPath(GREEN_BOOK, ROUND),
      repairLedgerPath(GREEN_BOOK, ROUND),
    ];
    const before = watched.map((p) => (existsSync(p) ? readFileSync(p, "utf8") : null));

    // Dry-run: identical verdict, zero writes (regression guard for publish-after-qc
    // --dry-run, which used to re-finalize with attest:true and flip PUBLISHABLE→REVISE).
    const dry = finalizeQcRound(GREEN_BOOK, ROUND, { chapters: [SOURCE_CHAPTER_NUMBER], dryRun: true });
    assert.equal(dry.allPublishable, true, "dry-run must compute the same all-publishable verdict");
    assert.equal(dry.attestationsWritten, 0, "dry-run must write no attestations");

    const after = watched.map((p) => (existsSync(p) ? readFileSync(p, "utf8") : null));
    for (let i = 0; i < watched.length; i++) {
      assert.equal(after[i], before[i], `dry-run mutated ${watched[i]} — a preflight must be read-only`);
    }
  } finally {
    cleanup();
  }
});

goldTest("deterministic majors are SURFACED and unresolved majors fail the major check by default", () => {
  // Production hardening contract: deterministic majors still surface for human
  // review, and they now block the major cleanliness check until a narrow,
  // content-bound reviewer waiver closes the exact finding/content.
  const prev = process.env.CHAPTERFLOW_NO_API_CODEX_QC;
  try {
    cleanup();
    const chapter = clonedCleanChapter(MAJOR_BOOK);
    chapter.tryThisNow = `${chapter.tryThisNow} This names a boundary condition for the reviewer.`;
    setupGreenEvidence(MAJOR_BOOK, [chapter], { rawSweepSubmission: true });
    const result = finalizeQcRound(MAJOR_BOOK, ROUND, { chapters: [SOURCE_CHAPTER_NUMBER] });
    // The fixture still trips a deterministic major — it stays VISIBLE:
    assert.ok(currentMajorFindings(MAJOR_BOOK, [chapter]).length > 0, "the deterministic major must still surface for human review / regression scan");
    // ...and unresolved majors now BLOCK the major cleanliness check:
    assert.equal(result.chapters[0].checks.majors, "FAIL");
    const matrix = JSON.parse(readFileSync(evidenceMatrixPath(MAJOR_BOOK, ROUND), "utf8"));
    assert.equal(matrix.chapters[0].majorStatus.status, "FAIL");
  } finally {
    if (prev === undefined) delete process.env.CHAPTERFLOW_NO_API_CODEX_QC;
    else process.env.CHAPTERFLOW_NO_API_CODEX_QC = prev;
    cleanup();
  }
});

goldTest("qc-auto reaches a genuine PASS end-to-end through the shared driver (confirm reads present)", () => {
  const prev = process.env.CHAPTERFLOW_NO_API_CODEX_QC;
  try {
    cleanup();
    const chapter = clonedCleanChapter(GREEN_BOOK);
    setupGreenEvidence(GREEN_BOOK, [chapter], { rawSweepSubmission: true });
    process.env.CHAPTERFLOW_NO_API_CODEX_QC = "1";
    const cli = runCli(["qc-auto", GREEN_BOOK, "--pass", "--round", ROUND, "--chapters", String(SOURCE_CHAPTER_NUMBER)]);
    assert.equal(cli.status, 0, cli.out);
    assert.match(cli.out, /QC AUTO PASS/);
    // Driver-rewire regression guard: confirm reads ARE on disk, so the dynamic-wave loop
    // being a no-op for qc-auto (submissionPresent:()=>true ⇒ 0 waves) must NOT falsely
    // demote a PUBLISHABLE chapter to NEEDS_MORE_QC — confirm reads come from the batch on
    // disk, and finalize reads ARTIFACTS, not cards.
    assert.doesNotMatch(cli.out, /NEEDS_MORE_QC/);
    assert.doesNotMatch(cli.out, /missing a fresh confirm/i);
  } finally {
    if (prev === undefined) delete process.env.CHAPTERFLOW_NO_API_CODEX_QC;
    else process.env.CHAPTERFLOW_NO_API_CODEX_QC = prev;
    cleanup();
  }
});

goldTest("finalize turns author-check REVISE into finalizer repair findings and prompt causes", () => {
  try {
    cleanup();
    const chapter = clonedCleanChapter(GREEN_BOOK);
    chapter.tryThisNow = "Source Moment 1.1 asks the reader to revisit the hard edge as the source cue.";
    setupGreenEvidence(GREEN_BOOK, [chapter]);
    const result = finalizeQcRound(GREEN_BOOK, ROUND, { chapters: [SOURCE_CHAPTER_NUMBER] });
    assert.equal(result.repairRequired, true);
    assert.equal(result.chapters[0].checks.authorCheck, "FAIL");
    assert.equal(result.chapters[0].finalVerdict, "REVISE");
    const ledger = effectiveLedger(GREEN_BOOK, ROUND);
    assert.ok(ledger.some((f) => f.sources.some((s) => s.sourceRole === "finalizer") && f.repairClass === "AC7.scaffold_leak"));
    const prompt = readFileSync(repairPromptPath(GREEN_BOOK, ROUND), "utf8");
    assert.match(prompt, /Why QC returned REVISE/);
    assert.match(prompt, /authorCheck=FAIL/);
    assert.match(prompt, /AC7\.scaffold_leak/);
    const cli = runCli(["qc-diagnose", GREEN_BOOK, "--round", ROUND]);
    assert.equal(cli.status, 0, cli.out);
    assert.match(cli.out, /QC DIAGNOSE/);
    assert.match(cli.out, /authorCheck=FAIL on 1\/1/);
  } finally {
    cleanup();
  }
});

goldTest("confirm-candidates writes confirm cards only for green candidates", () => {
  try {
    cleanup();
    const chapter = clonedCleanChapter(GREEN_BOOK);
    setupGreenEvidence(GREEN_BOOK, [chapter]);
    assert.equal(existsSync(resolve(taskCardsDir(GREEN_BOOK, ROUND), "confirm", `ch${String(SOURCE_CHAPTER_NUMBER).padStart(2, "0")}.md`)), false);
    const result = generateConfirmCandidates(GREEN_BOOK, ROUND, { chapters: [SOURCE_CHAPTER_NUMBER] });
    assert.equal(result.ok, true, result.errors.join("\n"));
    assert.deepEqual(result.candidates, [SOURCE_CHAPTER_NUMBER]);
    assert.ok(existsSync(resolve(taskCardsDir(GREEN_BOOK, ROUND), "confirm", `ch${String(SOURCE_CHAPTER_NUMBER).padStart(2, "0")}.md`)));
    const card = readFileSync(resolve(taskCardsDir(GREEN_BOOK, ROUND), "confirm", `ch${String(SOURCE_CHAPTER_NUMBER).padStart(2, "0")}.md`), "utf8");
    // The card must POINT to the real token in REVIEW-PACKET.md (the round persists only
    // salted hashes), not ship a bare placeholder that fails qc-submit verbatim.
    assert.match(card, /confirm token from REVIEW-PACKET\.md/i);
  } finally {
    cleanup();
  }
});

// E (PR2): confirm-candidate eligibility must be a SUBSET of finalize-publishable on
// the deterministic layer. Plan-enforcement is part of finalize's battery but was
// MISSING from confirm-candidates, so a chapter could be confirmed then REVISE at
// finalize on the same SP2. Non-vacuous: before the fix this chapter was a candidate.
goldTest("confirm-candidates SKIPS a plan-enforcement-failing chapter (parity with finalize; was the gap)", () => {
  try {
    cleanup();
    const chapter = clonedCleanChapter(GREEN_BOOK);
    setupGreenEvidence(GREEN_BOOK, [chapter]);
    // Same mismatched shape plan the WS-1 finalize test uses → exactly one SP2
    // plan-enforcement violation that finalize would REVISE on.
    const realFormats = chapter.examples.map((ex: any) => String(ex.planSpec.format));
    const allocation = [...realFormats];
    allocation[0] = realFormats[0] === "dialogue" ? "vignette" : "dialogue";
    writeShapePlan(GREEN_BOOK, SOURCE_CHAPTER_NUMBER, allocation);

    const result = generateConfirmCandidates(GREEN_BOOK, ROUND, { chapters: [SOURCE_CHAPTER_NUMBER] });
    assert.deepEqual(result.candidates, [], "a plan-enforcement-failing chapter must NOT be a confirm candidate");
    const skip = result.skipped.find((s) => s.chapterNumber === SOURCE_CHAPTER_NUMBER);
    assert.ok(skip, "the chapter must be in the skipped list");
    assert.ok(skip!.blockers.includes("planEnforcement"), `expected a planEnforcement blocker, got ${JSON.stringify(skip?.blockers)}`);
  } finally {
    cleanup();
  }
});

// E (parity, ledger severity): confirm-candidate eligibility must not be STRICTER than finalize
// on the LEDGER either. finalize's `openSerious` (finalize.ts) treats only blocker/major open
// findings as a repairLedger blocker; advisory/minor are non-blocking (finalize publishes a chapter
// carrying only those, repairLedger=NO_OPEN_BLOCKERS). generateConfirmCandidates used to skip on ANY
// open finding, so a clean, sweep-passing chapter with one advisory factual-accuracy nit was barred
// from its confirm read and stranded in NEEDS_MORE_QC forever (the factfulness non-certification bug).
// Non-vacuous: before the fix this chapter was skipped with a repairLedger blocker.
goldTest("confirm-candidates does NOT skip a chapter whose only open ledger finding is ADVISORY (parity with finalize)", () => {
  try {
    cleanup();
    const chapter = clonedCleanChapter(GREEN_BOOK);
    setupGreenEvidence(GREEN_BOOK, [chapter]);
    const r = appendFindings({
      bookId: GREEN_BOOK, roundId: ROUND, role: "sweep", submissionFile: "test://advisory",
      findings: [{
        chapterNumber: SOURCE_CHAPTER_NUMBER, unitId: `${chapter.chapterId}-hook`,
        repairClass: "factual_accuracy", severity: "advisory", quote: String(chapter.hook).slice(0, 24),
        problem: "An exact figure could not be verified against the source facts.",
        expectedFix: "Soften or attribute the figure.",
      }],
    });
    assert.equal(r.appended, 1, "the advisory finding must land in the ledger (not dropped as fabricated)");
    assert.ok(effectiveLedger(GREEN_BOOK, ROUND).some((f) => f.severity === "advisory" && f.status === "open"));
    const result = generateConfirmCandidates(GREEN_BOOK, ROUND, { chapters: [SOURCE_CHAPTER_NUMBER] });
    assert.deepEqual(result.candidates, [SOURCE_CHAPTER_NUMBER], `an advisory-only chapter must still be a confirm candidate, got skipped=${JSON.stringify(result.skipped)}`);
  } finally {
    cleanup();
  }
});

// Complement (non-vacuous the other way): a MAJOR open ledger finding STILL blocks confirm, so the
// severity filter narrowed the gate to match finalize rather than removing the repairLedger blocker.
goldTest("confirm-candidates STILL skips a chapter with a MAJOR open ledger finding (repairLedger blocker)", () => {
  try {
    cleanup();
    const chapter = clonedCleanChapter(GREEN_BOOK);
    setupGreenEvidence(GREEN_BOOK, [chapter]);
    appendFindings({
      bookId: GREEN_BOOK, roundId: ROUND, role: "sweep", submissionFile: "test://major",
      findings: [{
        chapterNumber: SOURCE_CHAPTER_NUMBER, unitId: `${chapter.chapterId}-hook`,
        repairClass: "factual_accuracy", severity: "major", quote: String(chapter.hook).slice(0, 24),
        problem: "A blocking factual error.", expectedFix: "Correct it.",
      }],
    });
    const result = generateConfirmCandidates(GREEN_BOOK, ROUND, { chapters: [SOURCE_CHAPTER_NUMBER] });
    assert.deepEqual(result.candidates, [], "a major-finding chapter must NOT be a confirm candidate");
    const skip = result.skipped.find((s) => s.chapterNumber === SOURCE_CHAPTER_NUMBER);
    assert.ok(skip?.blockers.includes("repairLedger"), `expected a repairLedger blocker, got ${JSON.stringify(skip?.blockers)}`);
  } finally {
    cleanup();
  }
});

// P2 — turn the green single-chapter fixture into an INCREMENTAL round where ch5
// is carried (no fresh per-chapter reads this round, but a prior fresh PUBLISHABLE
// attestation). Cross-chapter signals (sweep/book-gate) stay live.
function setupCarriedChapter(opts: { attestationContentHash?: string } = {}): ChapterV21 {
  const chapter = clonedCleanChapter(GREEN_BOOK);
  setupGreenEvidence(GREEN_BOOK, [chapter]);
  rmSync(barArtifactPath(GREEN_BOOK, ROUND, SOURCE_CHAPTER_NUMBER), { force: true });
  rmSync(confirmArtifactPath(GREEN_BOOK, ROUND, SOURCE_CHAPTER_NUMBER), { force: true });
  const rr = JSON.parse(readFileSync(roundRecordPath(GREEN_BOOK, ROUND), "utf8"));
  rr.carriedChapters = [SOURCE_CHAPTER_NUMBER];
  rr.reviewChapters = [];
  writeFileSync(roundRecordPath(GREEN_BOOK, ROUND), JSON.stringify(rr, null, 2) + "\n", "utf8");
  writeAttestation({
    schemaVersion: "qc-attest-v1",
    bookId: GREEN_BOOK,
    chapterNumber: SOURCE_CHAPTER_NUMBER,
    chapterId: chapter.chapterId,
    verdict: "PUBLISHABLE",
    contentHash: opts.attestationContentHash ?? chapterContentHash(chapter),
    hashVersion: "v2",
    reviewer: "codex-qc:auto:r-prior",
    reviewedAt: "2026-01-01T00:00:00.000Z",
    roundId: "r-prior",
    roundRole: "attest",
  });
  return chapter;
}

goldTest("P2: an incremental round CARRIES an unchanged-PUBLISHABLE chapter without a fresh bar/confirm read", () => {
  try {
    cleanup();
    setupCarriedChapter();
    const result = finalizeQcRound(GREEN_BOOK, ROUND, { chapters: [SOURCE_CHAPTER_NUMBER] });
    assert.equal(result.chapters[0].finalVerdict, "PUBLISHABLE", JSON.stringify(result.chapters[0]));
    assert.equal(result.attestationsWritten, 0, "carried-green chapter keeps its prior attestation (no re-attest)");
    assert.equal(loadAttestation(GREEN_BOOK, SOURCE_CHAPTER_NUMBER)?.roundId, "r-prior", "prior attestation + its valid artifacts preserved for promote");
  } finally {
    cleanup();
  }
});

goldTest("P2 GUARD (Fix 2): an UNGROUNDED sweep FAIL does NOT demote a carried chapter and keeps its high-water-mark", () => {
  try {
    cleanup();
    setupCarriedChapter();
    // A stochastic sweep names the carried chapter but QUOTES a paraphrase that exists
    // NOWHERE in the chapter's text — the documented 7->1 divergence driver. The carried
    // chapter was independently swept clean at this exact hash, so an un-locatable mention
    // must not clobber its banked PUBLISHABLE. (Pre-fix this demoted it to REVISE and
    // overwrote the attestation.)
    writeSweepRecordFromSubmission({
      schemaVersion: "qc-sweep-submission-v1",
      bookId: GREEN_BOOK,
      roundId: ROUND,
      role: "sweep",
      reviewer: "codex-qc:sweep-fixture",
      verdict: "REVISE",
      checkedFamilies: [...REQUIRED_SWEEP_FAMILIES],
      findings: [{
        chapterNumber: SOURCE_CHAPTER_NUMBER,
        unitId: "quiz",
        repairClass: "repeated_unit",
        severity: "major",
        quote: "A reused review prompt shared across chapters that appears in no chapter at all.",
        problem: "Cross-chapter templating implicates this carried chapter.",
        expectedFix: "Vary the shared unit so it is chapter-specific.",
      }],
    });
    const result = finalizeQcRound(GREEN_BOOK, ROUND, { chapters: [SOURCE_CHAPTER_NUMBER] });
    assert.equal(result.chapters[0].finalVerdict, "PUBLISHABLE", "an ungrounded sweep mention must not un-bank a carried chapter");
    assert.equal(result.chapters[0].checks.sweep, "PASS", "the ungrounded FAIL is re-validated back to PASS");
    assert.equal(result.attestationsWritten, 0, "the prior PUBLISHABLE attestation is preserved (not overwritten)");
    assert.equal(loadAttestation(GREEN_BOOK, SOURCE_CHAPTER_NUMBER)?.roundId, "r-prior", "high-water-mark intact");
  } finally {
    cleanup();
  }
});

goldTest("P2 GUARD (Fix 2): a GROUNDED sweep FAIL STILL demotes a carried chapter (a real cross-chapter collision can't ship green)", () => {
  try {
    cleanup();
    const chapter = setupCarriedChapter();
    // The sweep quote is a VERBATIM slice of the carried chapter's own text → grounded →
    // a real defect → the chapter is still demoted and its attestation overwritten. This is
    // the floor: Fix 2 only neutralizes UNlocatable quotes, never grounded ones.
    const realQuote = String(chapter.examples?.[0]?.scenario ?? "").slice(0, 80);
    assert.ok(realQuote.replace(/[^a-z0-9]+/gi, " ").trim().length >= 20, "fixture must yield a discriminating verbatim quote");
    writeSweepRecordFromSubmission({
      schemaVersion: "qc-sweep-submission-v1",
      bookId: GREEN_BOOK,
      roundId: ROUND,
      role: "sweep",
      reviewer: "codex-qc:sweep-fixture",
      verdict: "REVISE",
      checkedFamilies: [...REQUIRED_SWEEP_FAMILIES],
      findings: [{
        chapterNumber: SOURCE_CHAPTER_NUMBER,
        unitId: "examples.ex01",
        repairClass: "scene_skeleton",
        severity: "major",
        quote: realQuote,
        problem: "A genuinely reused scene frame quoted verbatim from the chapter.",
        expectedFix: "Re-stage the scene so the frame is distinct.",
      }],
    });
    const result = finalizeQcRound(GREEN_BOOK, ROUND, { chapters: [SOURCE_CHAPTER_NUMBER] });
    assert.equal(result.chapters[0].checks.sweep, "FAIL", "a grounded sweep finding keeps the chapter FAILed");
    assert.equal(result.chapters[0].finalVerdict, "REVISE", "a real cross-chapter collision still demotes a carried chapter");
    assert.equal(loadAttestation(GREEN_BOOK, SOURCE_CHAPTER_NUMBER)?.verdict, "REVISE", "a real demotion overwrites the prior PUBLISHABLE so it is re-reviewed, never carried/promoted on a stale pass");
  } finally {
    cleanup();
  }
});

goldTest("P2 GUARD (Fix 2, generalized): an UNGROUNDED over-naming sweep FAIL does NOT demote a FRESHLY-reviewed chapter (not just carried ones)", () => {
  try {
    cleanup();
    // A FRESH (non-carried) chapter with green reads. The stochastic sweep OVER-NAMES it with a
    // distinctive quote that appears in NO chapter (the-undoing-project r20260620134645:
    // 'in the Hebrew University seminar room' named across all 12, present in exactly 1 — collapsed
    // the book 11/12 -> 0/12). The groundedness guard used to protect only CARRIED chapters; a
    // fabricated finding demotes a fresh chapter just as wrongly, so the guard now clears it for any.
    const chapter = clonedCleanChapter(GREEN_BOOK);
    setupGreenEvidence(GREEN_BOOK, [chapter]); // fresh per-chapter reads, NOT carried
    writeSweepRecordFromSubmission({
      schemaVersion: "qc-sweep-submission-v1",
      bookId: GREEN_BOOK,
      roundId: ROUND,
      role: "sweep",
      reviewer: "codex-qc:sweep-fixture",
      verdict: "REVISE",
      checkedFamilies: [...REQUIRED_SWEEP_FAMILIES],
      findings: [{
        chapterNumber: SOURCE_CHAPTER_NUMBER,
        unitId: "examples.ex01",
        repairClass: "scene_skeleton",
        severity: "major",
        quote: "in a fabricated seminar room that appears in no chapter whatsoever",
        problem: "An over-claimed cross-chapter scene frame, absent from this chapter's text.",
        expectedFix: "n/a",
      }],
    });
    const result = finalizeQcRound(GREEN_BOOK, ROUND, { chapters: [SOURCE_CHAPTER_NUMBER] });
    assert.equal(result.chapters[0].checks.sweep, "PASS", "an ungrounded over-naming clears for a fresh chapter too");
    assert.equal(result.chapters[0].finalVerdict, "PUBLISHABLE", "a freshly-reviewed chapter is not demoted by a fabricated sweep mention");
  } finally {
    cleanup();
  }
});

goldTest("P2: a carried chapter whose content CHANGED since its attestation is NOT carried (re-reviewed)", () => {
  try {
    cleanup();
    // Attestation hash deliberately does not match the current content → stale →
    // the round's carried hint is ignored and the chapter needs a fresh review.
    setupCarriedChapter({ attestationContentHash: "deadbeefdeadbeef" });
    const result = finalizeQcRound(GREEN_BOOK, ROUND, { chapters: [SOURCE_CHAPTER_NUMBER] });
    assert.equal(result.chapters[0].finalVerdict, "NEEDS_MORE_QC", "an edited carried chapter must be re-reviewed, never carried on a stale attestation");
  } finally {
    cleanup();
  }
});

goldTest("P1.4: a complete fresh positive read supersedes a STALE prior-round REVISE on identical content", () => {
  try {
    cleanup();
    const chapter = clonedCleanChapter(GREEN_BOOK);
    setupGreenEvidence(GREEN_BOOK, [chapter]); // bar=codex-qc:bar-fixture, confirm=codex-qc:confirm-fixture (DISTINCT)
    // Pre-seed a stale REVISE from a PRIOR round on byte-identical content — the
    // book-wide-major pin that the old finalizer could never release.
    writeAttestation({
      schemaVersion: "qc-attest-v1",
      bookId: GREEN_BOOK,
      chapterNumber: SOURCE_CHAPTER_NUMBER,
      chapterId: chapter.chapterId,
      verdict: "REVISE",
      contentHash: chapterContentHash(chapter),
      hashVersion: "v2",
      reviewer: "codex-qc:auto:r-prior",
      reviewedAt: "2026-01-01T00:00:00.000Z",
      roundId: "r-prior",
      findings: ["book-wide venue major (since resolved)"],
    });
    const result = finalizeQcRound(GREEN_BOOK, ROUND, { chapters: [SOURCE_CHAPTER_NUMBER] });
    assert.equal(result.chapters[0].finalVerdict, "PUBLISHABLE", JSON.stringify(result.chapters[0]));
    assert.match(result.chapters[0].reason, /superseded a stale prior-round/);
    const att = loadAttestation(GREEN_BOOK, SOURCE_CHAPTER_NUMBER);
    assert.equal(att?.verdict, "PUBLISHABLE");
    assert.ok(
      att?.history?.some((h) => h.verdict === "REVISE" && h.roundId === "r-prior"),
      `prior REVISE must be auditable in history: ${JSON.stringify(att?.history?.map((h) => h.verdict))}`,
    );
  } finally {
    cleanup();
  }
});

goldTest("P1.4: a SAME-reviewer confirm does NOT supersede a stale REVISE (author≠reviewer preserved)", () => {
  try {
    cleanup();
    const chapter = clonedCleanChapter(GREEN_BOOK);
    setupGreenEvidence(GREEN_BOOK, [chapter]);
    // Overwrite the confirm so its reviewer == the bar reviewer: not an independent read.
    writeConfirmReadArtifact({
      schemaVersion: "qc-confirm-read-v1",
      bookId: GREEN_BOOK,
      roundId: ROUND,
      role: "confirm",
      reviewer: "codex-qc:bar-fixture",
      chapterNumber: SOURCE_CHAPTER_NUMBER,
      chapterId: chapter.chapterId,
      contentHash: chapterContentHash(chapter),
      decision: "PUBLISHABLE",
      reason: "Same reviewer as the bar — not an independent confirm.",
      findings: [],
    });
    writeAttestation({
      schemaVersion: "qc-attest-v1",
      bookId: GREEN_BOOK,
      chapterNumber: SOURCE_CHAPTER_NUMBER,
      chapterId: chapter.chapterId,
      verdict: "REVISE",
      contentHash: chapterContentHash(chapter),
      hashVersion: "v2",
      reviewer: "codex-qc:auto:r-prior",
      reviewedAt: "2026-01-01T00:00:00.000Z",
      roundId: "r-prior",
      findings: ["prior REVISE"],
    });
    const result = finalizeQcRound(GREEN_BOOK, ROUND, { chapters: [SOURCE_CHAPTER_NUMBER] });
    assert.notEqual(result.chapters[0].finalVerdict, "PUBLISHABLE", "same-reviewer confirm must not launder a stale REVISE");
    assert.match(result.chapters[0].reason, /confirm reviewer must differ/);
    assert.equal(loadAttestation(GREEN_BOOK, SOURCE_CHAPTER_NUMBER)?.verdict, "REVISE", "stale REVISE attestation stays untouched");
  } finally {
    cleanup();
  }
});

function writeShapePlan(bookId: string, chapterNumber: number, allocation: string[]): void {
  const dir = resolve(PIPELINE_DIR, "state", "shape-plans");
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, `${bookId}.shape-plan.json`), JSON.stringify({ schemaVersion: "shape-plan-v1", bookId, allocation: { [chapterNumber]: allocation }, carriedChapters: [] }, null, 2), "utf8");
}

goldTest("WS-1: a chapter that violates its dealt SHAPE plan REVISEs at finalize (SP2 shifted left from publish)", () => {
  try {
    cleanup();
    const chapter = clonedCleanChapter(GREEN_BOOK);
    setupGreenEvidence(GREEN_BOOK, [chapter]);
    // Deal a shape plan that matches every example EXCEPT example[0], whose dealt
    // shape we set to a value the chapter does NOT use → exactly one SP2 violation.
    const realFormats = chapter.examples.map((ex: any) => String(ex.planSpec.format));
    const allocation = [...realFormats];
    allocation[0] = realFormats[0] === "dialogue" ? "vignette" : "dialogue";
    writeShapePlan(GREEN_BOOK, SOURCE_CHAPTER_NUMBER, allocation);

    const result = finalizeQcRound(GREEN_BOOK, ROUND, { chapters: [SOURCE_CHAPTER_NUMBER] });
    // Before WS-1 this chapter was PUBLISHABLE at QC and only blocked at publish preflight.
    assert.equal(result.chapters[0].checks.planEnforcement, "FAIL");
    assert.equal(result.chapters[0].finalVerdict, "REVISE", JSON.stringify(result.chapters[0]));
    assert.match(result.chapters[0].reason, /dealt plan/);
    const ledger = effectiveLedger(GREEN_BOOK, ROUND);
    const sp = ledger.find((f) => f.repairClass === "SP2.shape_plan_mismatch");
    assert.ok(sp, `expected an SP2 finalizer finding: ${JSON.stringify(ledger.map((f) => f.repairClass))}`);
    assert.ok(sp!.sources.some((s) => s.sourceRole === "finalizer"));
    const prompt = readFileSync(repairPromptPath(GREEN_BOOK, ROUND), "utf8");
    assert.match(prompt, /SP2\.shape_plan_mismatch/);
  } finally {
    cleanup();
  }
});

goldTest("WS-1: a clean green chapter passes the new planEnforcement check (no false-REVISE)", () => {
  try {
    cleanup();
    const chapter = clonedCleanChapter(GREEN_BOOK);
    setupGreenEvidence(GREEN_BOOK, [chapter]);
    // No shape/exemplar plan on disk → SP2/SP5 skip; SP1/SP3 must still pass on a real chapter.
    const result = finalizeQcRound(GREEN_BOOK, ROUND, { chapters: [SOURCE_CHAPTER_NUMBER] });
    assert.equal(result.chapters[0].checks.planEnforcement, "PASS", JSON.stringify(result.chapters[0].checks));
    assert.equal(result.allPublishable, true);
  } finally {
    cleanup();
  }
});

goldTest("P1.5: finalize REVISEs a sub-0.6 bar axis even when it cited no hit (synthesises a repair target)", () => {
  try {
    cleanup();
    const chapter = clonedCleanChapter(GREEN_BOOK);
    setupGreenEvidence(GREEN_BOOK, [chapter]);
    const axes: AxisScore[] = (Object.keys(AXIS_WEIGHTS) as AxisId[])
      .filter((axis) => axis !== "quiz_key_correctness")
      .map((axis) => ({ axis, score: axis === "example_coherence" ? 0.55 : 0.94, tier: axis === "example_coherence" ? "GENERATED_DRAFT" : "PUBLISHABLE", hits: [] }));
    writeBarReadArtifact({
      schemaVersion: "qc-bar-read-v2",
      bookId: GREEN_BOOK,
      roundId: ROUND,
      role: "bar",
      reviewer: "codex-qc:bar-fixture",
      chapterNumber: SOURCE_CHAPTER_NUMBER,
      chapterId: chapter.chapterId,
      contentHash: chapterContentHash(chapter),
      sourceHash: sourceHashFor(GREEN_BOOK, SOURCE_CHAPTER_NUMBER),
      axes,
      notes: "The examples are weak but this artifact forgot to cite the exact hit.",
      verdict: computeVerdict(chapter.chapterId, axes, true),
    });
    const result = finalizeQcRound(GREEN_BOOK, ROUND, { chapters: [SOURCE_CHAPTER_NUMBER] });
    // No longer a dead-end: a sub-0.6 axis without a cited hit now REVISEs with a
    // synthetic, actionable repair finding instead of stranding in NEEDS_MORE_QC.
    assert.equal(result.repairRequired, true);
    assert.equal(result.chapters[0].finalVerdict, "REVISE");
    const ledger = effectiveLedger(GREEN_BOOK, ROUND);
    const synth = ledger.find((f) => f.repairClass === "example_coherence" && f.unitId === "bar.example_coherence");
    assert.ok(synth, `expected a synthesised example_coherence finding: ${JSON.stringify(ledger.map((f) => f.repairClass))}`);
    assert.match(synth!.problem, /below the 0\.60 floor/);
  } finally {
    cleanup();
  }
});
