import assert from "node:assert/strict";
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";

import { test } from "./harness.js";
import { PIPELINE_DIR, STATE_CHAPTERS, runCli, writeFixtureBook } from "./helpers.js";
import type { ChapterV21 } from "../src/types.js";
import { chapterContentHash, attestationPath, writeAttestation } from "../src/critics/qcAttestation.js";
import { AXIS_WEIGHTS, computeVerdict, type AxisId, type AxisScore } from "../src/critics/semantic/publishableBar.js";
import { REPO_ROOT } from "../src/lib/chapterPaths.js";
import { keyDerivationPath, keyPackDir, loadKeyPack, manualKeyJudgePath, writeKeyPacks, type KeyDerivation } from "../src/qc/manualKeyJudge.js";
import { qcRoundPath, openQcRound } from "../src/qc/qcRound.js";
import { repairLedgerPath, roundRecordPath, orchestratorRoundDir, writeBarReadArtifact, writeConfirmReadArtifact } from "../src/qc/orchestrator/artifacts.js";
import { REQUIRED_SWEEP_FAMILIES, sweepRecordPath, writeSweepRecordFromSubmission } from "../src/qc/sweep.js";
import { sourceHashFor, sourceSidecarPathFor } from "../src/qc/sourceV2Gate.js";
import { publishAfterQc, formatPreflightChecklist } from "../src/qc/publishAfterQc.js";

const GREEN_BOOK = "zz-fixture-publish-green";
const REVISE_BOOK = "zz-fixture-publish-revise";
const INCOMPLETE_BOOK = "zz-fixture-publish-incomplete";
const ROUND = "r-publish";
const RUN = "20260613T000000Z";
const SOURCE_BOOK = "stillness-is-the-key";
const SOURCE_CHAPTER_NUMBER = 5;

function cleanup(bookIds = [GREEN_BOOK, REVISE_BOOK, INCOMPLETE_BOOK]): void {
  for (const bookId of bookIds) {
    for (const f of readdirSync(STATE_CHAPTERS)) {
      if (f.startsWith(`${bookId}-ch`)) rmSync(resolve(STATE_CHAPTERS, f), { force: true });
    }
    rmSync(resolve(REPO_ROOT, ".chapterflow/runs", bookId), { recursive: true, force: true });
    rmSync(orchestratorRoundDir(bookId, ROUND), { recursive: true, force: true });
    rmSync(resolve(PIPELINE_DIR, "state", "qc-orchestrator", bookId), { recursive: true, force: true });
    rmSync(keyPackDir(bookId, ROUND), { recursive: true, force: true });
    rmSync(resolve(PIPELINE_DIR, "state", "qc-packs", bookId), { recursive: true, force: true });
    rmSync(qcRoundPath(bookId, ROUND), { force: true });
    rmSync(sweepRecordPath(bookId), { force: true });
    rmSync(resolve(PIPELINE_DIR, "state", "indexes", `${bookId}.json`), { force: true });
    rmSync(resolve(PIPELINE_DIR, "state", "briefs", `${bookId}.manual-brief.json`), { force: true });
    rmSync(resolve(PIPELINE_DIR, "state", "shape-plans", `${bookId}.shape-plan.json`), { force: true });
    rmSync(resolve(PIPELINE_DIR, "state", "venue-plans", `${bookId}.venue-plan.json`), { force: true });
    rmSync(resolve(PIPELINE_DIR, "state", "exemplar-plans", `${bookId}.exemplar-plan.json`), { force: true });
    rmSync(resolve(PIPELINE_DIR, "state", "plans", `${bookId}-ch05.manual-plan.json`), { force: true });
    rmSync(attestationPath(bookId, SOURCE_CHAPTER_NUMBER), { force: true });
    rmSync(manualKeyJudgePath(bookId, SOURCE_CHAPTER_NUMBER), { force: true });
  }
}

function clonedChapter(bookId: string): ChapterV21 {
  const sourcePath = resolve(STATE_CHAPTERS, `${SOURCE_BOOK}-ch${String(SOURCE_CHAPTER_NUMBER).padStart(2, "0")}.v21-native.chapter.json`);
  const chapter = JSON.parse(readFileSync(sourcePath, "utf8")) as ChapterV21;
  chapter.chapterId = `${bookId}-ch${String(SOURCE_CHAPTER_NUMBER).padStart(2, "0")}`;
  for (let i = 0; i < chapter.examples.length; i++) {
    (chapter.examples[i] as any).planSpec = {
      ...(chapter.examples[i] as any).planSpec,
      venue: `Fixture venue ${i + 1}`,
      exemplar: "",
    };
  }
  return chapter;
}

function writeSourceSidecar(bookId: string): void {
  const sourcePath = sourceSidecarPathFor(SOURCE_BOOK, SOURCE_CHAPTER_NUMBER);
  assert.ok(sourcePath, `missing source sidecar for ${SOURCE_BOOK} ch${SOURCE_CHAPTER_NUMBER}`);
  const sidecar = JSON.parse(readFileSync(sourcePath, "utf8"));
  sidecar.namedExamples = [
    ...(Array.isArray(sidecar.namedExamples) ? sidecar.namedExamples : []),
    {
      id: "ch05.ex.fixture-deliberation",
      label: "Fixture deliberation protocol",
      summary: "A synthetic fixture example that gives the source-v2 gate a third named example without changing the chapter text under test.",
      teachesWhat: "Stillness can be practiced as a deliberate pause before action.",
      hardSpecifics: ["Fixture deliberation", "deliberate pause", "response choice"],
      realWorld: true,
    },
  ].slice(0, 3);
  const dir = resolve(REPO_ROOT, ".chapterflow/runs", bookId, RUN, "sidecars/source");
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, `ch${String(SOURCE_CHAPTER_NUMBER).padStart(2, "0")}.source.json`), JSON.stringify(sidecar, null, 2), "utf8");
}

function writeBookState(bookId: string, chapter: ChapterV21): void {
  writeFixtureBook(STATE_CHAPTERS, [chapter]);
  writeSourceSidecar(bookId);
  const indexPath = resolve(PIPELINE_DIR, "state", "indexes", `${bookId}.json`);
  mkdirSync(dirname(indexPath), { recursive: true });
  writeFileSync(indexPath, JSON.stringify([{ chapterNumber: chapter.number, chapterId: chapter.chapterId, chapterTitle: chapter.title }], null, 2) + "\n", "utf8");
  const briefPath = resolve(PIPELINE_DIR, "state", "briefs", `${bookId}.manual-brief.json`);
  mkdirSync(dirname(briefPath), { recursive: true });
  writeFileSync(briefPath, JSON.stringify({ schemaVersion: "manual-book-brief-v1", bookId, title: "Publish Fixture", author: "Test Author" }, null, 2) + "\n", "utf8");
  const planPath = resolve(PIPELINE_DIR, "state", "plans", `${chapter.chapterId}.manual-plan.json`);
  mkdirSync(dirname(planPath), { recursive: true });
  writeFileSync(planPath, JSON.stringify({ schemaVersion: "manual-chapter-plan-v1", bookId, chapterId: chapter.chapterId, chapterNumber: chapter.number, title: chapter.title, coreMove: "Use the fixture signal." }, null, 2) + "\n", "utf8");
  const shapePath = resolve(PIPELINE_DIR, "state", "shape-plans", `${bookId}.shape-plan.json`);
  const venuePath = resolve(PIPELINE_DIR, "state", "venue-plans", `${bookId}.venue-plan.json`);
  const exemplarPath = resolve(PIPELINE_DIR, "state", "exemplar-plans", `${bookId}.exemplar-plan.json`);
  mkdirSync(dirname(shapePath), { recursive: true });
  mkdirSync(dirname(venuePath), { recursive: true });
  mkdirSync(dirname(exemplarPath), { recursive: true });
  writeFileSync(shapePath, JSON.stringify({ bookId, allocation: { [String(chapter.number)]: chapter.examples.map((ex: any) => ex.planSpec.format) } }, null, 2) + "\n", "utf8");
  writeFileSync(venuePath, JSON.stringify({ bookId, allocation: { [String(chapter.number)]: chapter.examples.map((ex: any) => ex.planSpec.venue) } }, null, 2) + "\n", "utf8");
  writeFileSync(exemplarPath, JSON.stringify({ bookId, allocation: { [String(chapter.number)]: { forbidden: [] } } }, null, 2) + "\n", "utf8");
}

function writeRoundRecord(bookId: string, chapter: ChapterV21): void {
  const path = roundRecordPath(bookId, ROUND);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify({
    schemaVersion: "qc-orchestrator-round-v1",
    bookId,
    roundId: ROUND,
    createdAt: "2026-06-13T00:00:00.000Z",
    chapters: [chapter.number],
    qcRoundFile: qcRoundPath(bookId, ROUND),
    preflight: {},
    taskCards: [],
  }, null, 2) + "\n", "utf8");
}

function sweepPassSubmission(bookId: string) {
  return {
    schemaVersion: "qc-sweep-submission-v1" as const,
    bookId,
    roundId: ROUND,
    role: "sweep" as const,
    reviewer: "codex-qc:publish-sweep",
    verdict: "PASS" as const,
    checkedFamilies: [...REQUIRED_SWEEP_FAMILIES],
    findings: [],
  };
}

function writeKeys(bookId: string, chapter: ChapterV21): void {
  writeKeyPacks(bookId, ROUND);
  for (const role of ["keyA", "keyB"] as const) {
    const pack = loadKeyPack(bookId, ROUND, chapter.number);
    assert.ok(pack, `missing key pack for ${chapter.chapterId}`);
    const factId = pack.sourceFacts[0]?.id;
    assert.ok(factId, "missing source fact");
    const rec: KeyDerivation = {
      schemaVersion: "manual-key-derive-v2",
      bookId,
      roundId: ROUND,
      role,
      derivedAt: "2026-06-13T00:00:00.000Z",
      chapters: [{
        chapterNumber: chapter.number,
        chapterId: chapter.chapterId,
        packHash: pack.packHash,
        contentHash: pack.contentHash,
        sourceHash: pack.sourceHash,
        answers: chapter.quiz.questions.map((q, i) => ({
          questionIndex: i,
          choiceIndex: q.correctIndex,
          confidence: 0.97,
          reason: `The fixture source facts support the stored answer for question ${i + 1}; both readers independently agree.`,
          sourceFactIds: [factId],
        })),
      }],
    };
    writeFileSync(keyDerivationPath(bookId, ROUND, role), JSON.stringify(rec, null, 2) + "\n", "utf8");
  }
}

function writeBarConfirm(bookId: string, chapter: ChapterV21): void {
  const sourceHash = sourceHashFor(bookId, chapter.number);
  assert.ok(sourceHash, "missing source hash");
  const axes: AxisScore[] = (Object.keys(AXIS_WEIGHTS) as AxisId[])
    .filter((axis) => axis !== "quiz_key_correctness")
    .map((axis) => ({ axis, score: 0.94, tier: "PUBLISHABLE", hits: [] }));
  writeBarReadArtifact({
    schemaVersion: "qc-bar-read-v2",
    bookId,
    roundId: ROUND,
    role: "bar",
    reviewer: "codex-qc:publish-bar",
    chapterNumber: chapter.number,
    chapterId: chapter.chapterId,
    contentHash: chapterContentHash(chapter),
    sourceHash,
    axes,
    notes: "Fixture publish bar read.",
    verdict: computeVerdict(chapter.chapterId, axes, true),
  });
  writeConfirmReadArtifact({
    schemaVersion: "qc-confirm-read-v1",
    bookId,
    roundId: ROUND,
    role: "confirm",
    reviewer: "codex-qc:publish-confirm",
    chapterNumber: chapter.number,
    chapterId: chapter.chapterId,
    contentHash: chapterContentHash(chapter),
    decision: "PUBLISHABLE",
    reason: "Independent fixture confirm read agrees that the chapter is publishable.",
    findings: [],
  });
}

function setupGreen(bookId: string): void {
  const chapter = clonedChapter(bookId);
  writeBookState(bookId, chapter);
  openQcRound(bookId, ROUND);
  writeRoundRecord(bookId, chapter);
  writeKeys(bookId, chapter);
  writeSweepRecordFromSubmission(sweepPassSubmission(bookId));
  writeBarConfirm(bookId, chapter);
  writeAttestation({
    schemaVersion: "qc-attest-v1",
    bookId,
    chapterNumber: chapter.number,
    chapterId: chapter.chapterId,
    verdict: "PUBLISHABLE",
    contentHash: chapterContentHash(chapter),
    hashVersion: "v2",
    reviewer: "codex-qc:publish-confirm",
    reviewedAt: "2026-06-13T00:00:00.000Z",
    roundId: ROUND,
    roundRole: "confirm",
    dimensions: {
      keysCorrect: true,
      grounded: true,
      examplesDistinct: true,
      noCorruption: true,
      pedagogicallyUseful: true,
    },
    evidence: {
      orchestratorRoundId: ROUND,
      manualKeyJudgePath: manualKeyJudgePath(bookId, chapter.number),
      sweepPath: sweepRecordPath(bookId),
      repairLedgerPath: repairLedgerPath(bookId, ROUND),
    },
    findings: [],
    notes: "Synthetic publish-after-qc all-green fixture attestation.",
  });
}

function appendOpenLedgerFinding(bookId: string): void {
  const p = repairLedgerPath(bookId, ROUND);
  mkdirSync(dirname(p), { recursive: true });
  appendFileSync(p, JSON.stringify({
    schemaVersion: "qc-repair-ledger-event-v1",
    event: "finding",
    findingId: "qcf-publish-open",
    bookId,
    roundId: ROUND,
    chapterNumber: SOURCE_CHAPTER_NUMBER,
    unitId: "examples[0]",
    repairClass: "example_coherence",
    severity: "major",
    quote: "fixture quote",
    problem: "fixture open finding",
    expectedFix: "close the fixture finding",
    globalTheme: "example_coherence",
    status: "open",
    sources: [{ sourceRole: "bar", submissionFile: "fixture.json", observedAt: "2026-06-13T00:00:00.000Z" }],
    createdAt: "2026-06-13T00:00:00.000Z",
  }) + "\n", "utf8");
}

test("publish-after-qc fails when CHAPTERFLOW_NO_API_CODEX_QC is missing", () => {
  const prev = process.env.CHAPTERFLOW_NO_API_CODEX_QC;
  try {
    delete process.env.CHAPTERFLOW_NO_API_CODEX_QC;
    const result = publishAfterQc({ input: "missing-book", roundId: ROUND, dryRun: true });
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /CHAPTERFLOW_NO_API_CODEX_QC=1/);
  } finally {
    if (prev === undefined) delete process.env.CHAPTERFLOW_NO_API_CODEX_QC;
    else process.env.CHAPTERFLOW_NO_API_CODEX_QC = prev;
  }
});

test("publish-after-qc fails on missing book or missing round before publish", () => {
  const prev = process.env.CHAPTERFLOW_NO_API_CODEX_QC;
  try {
    process.env.CHAPTERFLOW_NO_API_CODEX_QC = "1";
    let result = publishAfterQc({ input: "definitely missing publish fixture", roundId: ROUND, dryRun: true });
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /Could not find a book/);
    cleanup([INCOMPLETE_BOOK]);
    writeBookState(INCOMPLETE_BOOK, clonedChapter(INCOMPLETE_BOOK));
    result = publishAfterQc({ input: INCOMPLETE_BOOK, roundId: ROUND, dryRun: true });
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /Missing QC round/);
  } finally {
    if (prev === undefined) delete process.env.CHAPTERFLOW_NO_API_CODEX_QC;
    else process.env.CHAPTERFLOW_NO_API_CODEX_QC = prev;
    cleanup([INCOMPLETE_BOOK]);
  }
});

test("publish-after-qc blocks incomplete QC and reports repair prompt resume path", () => {
  const prev = process.env.CHAPTERFLOW_NO_API_CODEX_QC;
  try {
    process.env.CHAPTERFLOW_NO_API_CODEX_QC = "1";
    cleanup([INCOMPLETE_BOOK]);
    const chapter = clonedChapter(INCOMPLETE_BOOK);
    writeBookState(INCOMPLETE_BOOK, chapter);
    openQcRound(INCOMPLETE_BOOK, ROUND);
    writeRoundRecord(INCOMPLETE_BOOK, chapter);
    const result = publishAfterQc({ input: INCOMPLETE_BOOK, roundId: ROUND, title: "Publish Fixture", author: "Test Author", dryRun: true });
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /QC is incomplete|not all-green/);
    assert.ok(result.next?.some((line) => line.includes("repair prompt:")));
  } finally {
    if (prev === undefined) delete process.env.CHAPTERFLOW_NO_API_CODEX_QC;
    else process.env.CHAPTERFLOW_NO_API_CODEX_QC = prev;
    cleanup([INCOMPLETE_BOOK]);
  }
});

test("publish-after-qc blocks REVISE evidence and prints repair prompt path", () => {
  const prev = process.env.CHAPTERFLOW_NO_API_CODEX_QC;
  try {
    process.env.CHAPTERFLOW_NO_API_CODEX_QC = "1";
    cleanup([REVISE_BOOK]);
    setupGreen(REVISE_BOOK);
    appendOpenLedgerFinding(REVISE_BOOK);
    const result = publishAfterQc({ input: REVISE_BOOK, roundId: ROUND, title: "Publish Fixture", author: "Test Author", dryRun: true });
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /REVISE|repairRequired=true|repair-ledger/);
    assert.ok(result.next?.some((line) => line.includes("repair prompt:")));
  } finally {
    if (prev === undefined) delete process.env.CHAPTERFLOW_NO_API_CODEX_QC;
    else process.env.CHAPTERFLOW_NO_API_CODEX_QC = prev;
    cleanup([REVISE_BOOK]);
  }
});

test("formatPreflightChecklist marks passed checks ✓ and failed checks ✗ with a count", () => {
  const out = formatPreflightChecklist([
    { check: "source-v2", blockers: [] },
    { check: "sweep", blockers: ["sweep BP30: ...", "sweep BP31: ..."] },
    { check: "majors", blockers: [] },
  ]);
  assert.match(out, /2\/3 checks passed/);
  assert.match(out, /✓ source-v2/);
  assert.match(out, /✗ sweep \(2 blocker\(s\)\)/);
  assert.match(out, /✓ majors/);
});

test("publish-after-qc all-green fixture passes dry-run without staging or publishing", () => {
  const prev = process.env.CHAPTERFLOW_NO_API_CODEX_QC;
  // Hermetic: this fixture is a synthetic green book with no source-verify record, so an
  // ambient CHAPTERFLOW_REQUIRE_SOURCE_VERIFY=1 (the operator's publish env, which the
  // publish wrapper used to leak into this self-test) would fail SV1 and make the
  // "every check passes" assertion env-dependent. Source-verify-when-required is covered
  // by the source-verify gate tests; pin it OFF here so this green-path test is deterministic.
  const prevSV = process.env.CHAPTERFLOW_REQUIRE_SOURCE_VERIFY;
  const stagedBefore = runCli(["help"]).status; // cheap CLI smoke; dry-run should not need git.
  assert.equal(stagedBefore, 0);
  try {
    process.env.CHAPTERFLOW_NO_API_CODEX_QC = "1";
    delete process.env.CHAPTERFLOW_REQUIRE_SOURCE_VERIFY;
    cleanup([GREEN_BOOK]);
    setupGreen(GREEN_BOOK);
    const pkgPath = resolve(REPO_ROOT, "book-packages", `${GREEN_BOOK}.v21.json`);
    rmSync(pkgPath, { force: true });
    const result = publishAfterQc({ input: GREEN_BOOK, roundId: ROUND, title: "Publish Fixture", author: "Test Author", dryRun: true });
    assert.equal(result.ok, true, result.errors.join("\n"));
    assert.equal(existsSync(pkgPath), false, "dry-run must not promote a package");
    assert.ok(result.next?.some((line) => line.includes("would promote")));
    // The definition-of-done checklist is populated and every item passed on the green fixture.
    assert.ok((result.checks?.length ?? 0) >= 10, "preflight checklist should enumerate every DoD check");
    assert.ok(result.checks!.every((c) => c.blockers.length === 0), "every preflight check should PASS on the all-green fixture");
  } finally {
    if (prev === undefined) delete process.env.CHAPTERFLOW_NO_API_CODEX_QC;
    else process.env.CHAPTERFLOW_NO_API_CODEX_QC = prev;
    if (prevSV === undefined) delete process.env.CHAPTERFLOW_REQUIRE_SOURCE_VERIFY;
    else process.env.CHAPTERFLOW_REQUIRE_SOURCE_VERIFY = prevSV;
    cleanup([GREEN_BOOK]);
  }
});
