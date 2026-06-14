import assert from "node:assert/strict";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";

import { test } from "./harness.js";
import { PIPELINE_DIR, STATE_CHAPTERS, makeChapter, runCli, writeFixtureBook } from "./helpers.js";
import { checkQcAttestation, attestationPath, chapterContentHash, loadAttestation } from "../src/critics/qcAttestation.js";
import { runBookGate } from "../src/critics/bookGate.js";
import { AXIS_WEIGHTS, computeVerdict, type AxisId, type AxisScore } from "../src/critics/semantic/publishableBar.js";
import { REPO_ROOT } from "../src/lib/chapterPaths.js";
import type { ChapterV21 } from "../src/types.js";
import { checkManualKeyJudge, keyDerivationPath, keyPackDir, loadKeyPack, manualKeyJudgePath, writeKeyPacks, type KeyDerivation } from "../src/qc/manualKeyJudge.js";
import { unresolvedMajors, waiverPath } from "../src/qc/majorDisposition.js";
import { openQcRound, qcRoundPath } from "../src/qc/qcRound.js";
import {
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
import { effectiveLedger } from "../src/qc/orchestrator/ledger.js";
import { checkSourceV2Gate, sourceHashFor, sourceSidecarPathFor } from "../src/qc/sourceV2Gate.js";
import { REQUIRED_SWEEP_FAMILIES, checkSweep, sweepRecordPath, writeSweepRecordFromSubmission } from "../src/qc/sweep.js";

const BOOK = "zz-fixture-finalize-evidence";
const GREEN_BOOK = "zz-fixture-finalize-green";
const MAJOR_BOOK = "zz-fixture-finalize-major";
const ROUND = "r-finalize";
const RUN = "20260612T000000Z";
const SOURCE_BOOK = "stillness-is-the-key";
const SOURCE_CHAPTER_NUMBER = 5;

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

test("finalize writes PUBLISHABLE attestation with evidence paths when all no-api QC evidence is green", () => {
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

test("finalize dryRun computes the same verdict but writes NOTHING durable (a preflight must not mutate QC state)", () => {
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

test("finalize and qc-auto refuse PASS when a current major is unresolved", () => {
  const prev = process.env.CHAPTERFLOW_NO_API_CODEX_QC;
  try {
    cleanup();
    const chapter = clonedCleanChapter(MAJOR_BOOK);
    chapter.tryThisNow = `${chapter.tryThisNow} This names a boundary condition for the reviewer.`;
    setupGreenEvidence(MAJOR_BOOK, [chapter], { rawSweepSubmission: true });
    const result = finalizeQcRound(MAJOR_BOOK, ROUND, { chapters: [SOURCE_CHAPTER_NUMBER] });
    assert.equal(result.allPublishable, false);
    assert.equal(result.chapters[0].checks.majors, "FAIL");
    assert.equal(result.chapters[0].finalVerdict, "REVISE");
    assert.equal(loadAttestation(MAJOR_BOOK, SOURCE_CHAPTER_NUMBER)?.verdict, "REVISE");
    const matrix = JSON.parse(readFileSync(evidenceMatrixPath(MAJOR_BOOK, ROUND), "utf8"));
    assert.equal(matrix.chapters[0].majorStatus.status, "FAIL");
    assert.equal(matrix.chapters[0].majorStatus.chapter.length > 0 || matrix.chapters[0].majorStatus.book.length > 0, true);
    process.env.CHAPTERFLOW_NO_API_CODEX_QC = "1";
    const cli = runCli(["qc-auto", MAJOR_BOOK, "--pass", "--round", ROUND, "--chapters", String(SOURCE_CHAPTER_NUMBER)]);
    assert.notEqual(cli.status, 0);
    assert.doesNotMatch(cli.out, /QC AUTO PASS/);
    // Guard against the hollow-test trap: qc-auto must refuse because of the
    // unresolved MAJOR, not because the round is stale (which would short-circuit
    // before the major gate and pass these assertions for the wrong reason).
    assert.doesNotMatch(cli.out, /STALE_ROUND/, "must reach the major gate, not short-circuit on staleness");
  } finally {
    if (prev === undefined) delete process.env.CHAPTERFLOW_NO_API_CODEX_QC;
    else process.env.CHAPTERFLOW_NO_API_CODEX_QC = prev;
    cleanup();
  }
});

test("finalize turns author-check REVISE into finalizer repair findings and prompt causes", () => {
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

test("confirm-candidates writes confirm cards only for green candidates", () => {
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
    assert.match(card, /<confirm-token>/);
  } finally {
    cleanup();
  }
});

test("finalize treats bar YELLOW without sub-floor hits as NEEDS_MORE_QC", () => {
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
    assert.equal(result.incomplete, true);
    assert.equal(result.repairRequired, false);
    assert.equal(result.chapters[0].finalVerdict, "NEEDS_MORE_QC");
    assert.match(result.chapters[0].reason, /sub-0\.6 axis without a cited hit/);
  } finally {
    cleanup();
  }
});
