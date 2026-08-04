import assert from "node:assert/strict";
import { lstatSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

import type { ModelTaskRunner } from "../../src/app/modelTaskRunner.js";
import { ModelGatewayReviewEvaluator } from "../../src/app/modelGatewayReviewEvaluator.js";
import { createBookContentReader } from "../../src/books/bookContentReader.js";
import { createBookWriteLock } from "../../src/books/bookLease.js";
import { createCandidateStore } from "../../src/books/candidateStore.js";
import { createCurrentPointerStore } from "../../src/books/currentPointer.js";
import type { CandidateInputFile, CandidateSnapshot, CandidateStore } from "../../src/books/candidateTypes.js";
import type { ModelTaskContext, PlannedArtifact } from "../../src/contracts/v4Core.js";
import { runAllCriticsFromCandidate } from "../../src/critics/runAllCritics.js";
import { runBookGate, runBookGateFromCandidate } from "../../src/critics/bookGate.js";
import { BOOK_PATTERN_AUDIT_LOGICAL_PATH } from "../../src/critics/bookPatternAudit.js";
import { runChapterGateComposite, runChapterGateCompositeFromCandidate } from "../../src/critics/chapterGateComposite.js";
import { runShipGateFromCandidate } from "../../src/critics/finalGate.js";
import { chapterContentHash, checkQcAttestationFromCandidate, type QcAttestation } from "../../src/critics/qcAttestation.js";
import { computeBookRubricMetricsFromCandidate } from "../../src/metrics/bookRubricMetrics.js";
import { runEvalBookProxy, selectSeededChapters } from "../../src/review/evalBookProxy.js";
import { runEvalReaderProxy, sampleChapters } from "../../src/review/evalReaderProxy.js";
import type { BookPackage, BookPackageV21, ChapterV21 } from "../../src/types.js";
import type { ChapterReviewV1 } from "../../src/artifacts/artifactTypes.js";
import type { QcRoundResult } from "../../src/qc/qcTypes.js";
import { fixtureChapter } from "../model-bakeoff-helpers.js";
import { finishV25Tests, requiredTest, type TestContext } from "./harness.js";

const BOOK = "critic-fixture";
const CANDIDATE = "candidate-critic";
const CREATED = "2026-07-21T12:00:00.000Z";
const PACKAGE = "packages/book.v21.json";
const LEGACY_PACKAGE = "packages/book.legacy.json";
const NAME_PLAN = "sidecars/name-plan.json";
const BRIEF = "sidecars/chapter-brief.json";
const SOURCE = "sidecars/source-sidecar.json";
const SOURCE_USE = "sidecars/source-use-plan.json";
const PATTERN_AUDIT = BOOK_PATTERN_AUDIT_LOGICAL_PATH;

type TreeEntry = { type: string; mode: string; mtimeNs: string; bytes?: string };

function snapshotTree(root: string): Record<string, TreeEntry> {
  const out: Record<string, TreeEntry> = {};
  const visit = (path: string): void => {
    const stat = lstatSync(path, { bigint: true });
    const key = relative(root, path).split(sep).join("/") || ".";
    out[key] = {
      type: stat.isDirectory() ? "directory" : stat.isFile() ? "file" : stat.isSymbolicLink() ? "symlink" : "other",
      mode: stat.mode.toString(),
      mtimeNs: stat.mtimeNs.toString(),
      ...(stat.isFile() ? { bytes: readFileSync(path).toString("base64") } : {}),
    };
    if (stat.isDirectory()) for (const name of readdirSync(path).sort()) visit(join(path, name));
  };
  visit(root);
  return out;
}

function v13Package(): BookPackage {
  return {
    schemaVersion: "legacy-fixture-v1",
    packageId: "legacy-package",
    createdAt: CREATED,
    contentOwner: "test",
    book: { bookId: BOOK, title: "Candidate package", author: "Fixture" },
    chapters: [],
  };
}

function chapters(): ChapterV21[] {
  return [1, 2, 3, 4, 5].map((n) => fixtureChapter(BOOK, n, `frozen-${n}`));
}

function v21Package(input = chapters()): BookPackageV21 {
  return {
    schemaVersion: "chapterflow-v21-authored",
    packageId: "candidate-package",
    createdAt: CREATED,
    contentOwner: "test",
    book: { bookId: BOOK, title: "Candidate package", author: "Fixture" },
    chapters: input,
  };
}

function jsonFile(logicalPath: string, value: unknown, kind: PlannedArtifact["kind"] = "SIDECAR"): CandidateInputFile {
  return { kind, mediaType: "application/json", logicalPath, bytes: Buffer.from(`${JSON.stringify(value)}\n`) };
}

function chapterPath(n: number): string {
  return `chapters/ch${String(n).padStart(2, "0")}.json`;
}

function patternAudit(bookId = BOOK, chapterCount = 5) {
  return {
    bookId,
    chapterCount,
    passed: true,
    findings: [],
    stats: {
      repeatedQuizExplanationGroups: 0,
      repeatedSurfaceFrameGroups: 0,
      repeatedExampleFrameGroups: 0,
      repeatedConcreteAnchors: 0,
      templatedBreakdownShellGroups: 0,
      shortParagraphDuplicateGroups: 0,
      literalSubstringGroups: 0,
      quizPositionTemplateDuplicates: 0,
      missingPlanChapters: [],
      missingBrief: false,
      sourceAlignmentWarnings: 0,
    },
  };
}

async function rig(context: TestContext) {
  const lock = createBookWriteLock({ booksRoot: context.roots.booksRoot, timeoutMs: 1_000, pollMs: 1 });
  const pointer = createCurrentPointerStore({ booksRoot: context.roots.booksRoot, writeLock: lock });
  const store = createCandidateStore({ booksRoot: context.roots.booksRoot, writeLock: lock, currentPointerStore: pointer });
  const reader = createBookContentReader({ booksRoot: context.roots.booksRoot, currentPointerStore: pointer });
  const sourceChapters = chapters();
  sourceChapters[0].breakdown.fastRead += " Marie Curie anchors this candidate teaching case.";
  sourceChapters[1].breakdown.fastRead += " Marie Curie anchors this candidate teaching case again.";
  const files: CandidateInputFile[] = [
    ...sourceChapters.map((chapter) => jsonFile(chapterPath(chapter.number), chapter, "CHAPTER")),
    jsonFile(PACKAGE, v21Package(sourceChapters)),
    jsonFile(LEGACY_PACKAGE, v13Package()),
    jsonFile(NAME_PLAN, { allocation: {}, diagnostics: { alreadyAuthored: [] } }),
    jsonFile(BRIEF, { rotationSchemaVersion: "v3", exampleCount: 4 }),
    jsonFile(SOURCE, {}),
    jsonFile(SOURCE_USE, { schemaVersion: "source-use-plan-v1", bookId: BOOK, chapterNumber: 1, units: {} }),
    jsonFile(PATTERN_AUDIT, patternAudit(BOOK, sourceChapters.length)),
  ];
  const inventory = files.map(({ bytes: _bytes, ...entry }) => entry);
  const staged = await store.stage({ bookId: BOOK, candidateId: CANDIDATE, createdByRunId: "run-critic", expectedInventory: inventory, files, createdAt: CREATED });
  assert.ok(staged.ok);
  return { store, reader, files, chapters: sourceChapters, digest: staged.value.manifestDigest };
}

async function stageVariant(
  input: Awaited<ReturnType<typeof rig>>,
  candidateId: string,
  files: CandidateInputFile[],
) {
  const staged = await input.store.stage({
    bookId: BOOK,
    candidateId,
    parentCandidateId: CANDIDATE,
    createdByRunId: `run-${candidateId}`,
    expectedInventory: files.map(({ bytes: _bytes, ...entry }) => entry),
    files,
    createdAt: CREATED,
  });
  assert.ok(staged.ok);
  return staged.value.manifestDigest;
}

function selection(input: Awaited<ReturnType<typeof rig>>) {
  return { candidateId: CANDIDATE, manifestDigest: input.digest, packageLogicalPath: PACKAGE };
}

function fakeChapterReview(docText: string): string {
  const quote = docText.split("\n").find((line) => line.trim().length > 8) ?? "Candidate package";
  const scores = Object.fromEntries(["retention", "quizzes", "transfer", "practical", "summaries", "tone", "limits", "insight", "density", "beginner"].map((key) => [key, 80]));
  return `\`\`\`json\n${JSON.stringify({ quizDerivation: { answers: [], mechanisms: [], confidence: [], ambiguities: [], tells: [] }, scores, ship84: true, quotes: [{ quote, why: "frozen fixture" }], complaints: [], oneParagraphVerdict: "frozen pass" })}\n\`\`\``;
}

function fakeBookReview(docText: string, sampled: readonly ChapterV21[]): string {
  const quote = docText.split("\n").find((line) => line.startsWith("==== CHAPTER"))!;
  const scores = Object.fromEntries(["retention", "quizzes", "transfer", "practical", "summaries", "tone", "limits", "insight", "density", "beginner"].map((key) => [key, 80]));
  const quizDerivation = Object.fromEntries(sampled.map((chapter) => [String(chapter.number), { answers: [] }]));
  return `\`\`\`json\n${JSON.stringify({ gate_verdict: "PASS", book3_churn: "LOW", quizDerivation, scores, quotes: [{ quote, why: "frozen fixture" }], oneParagraphVerdict: "frozen pass" })}\n\`\`\``;
}

function proxyTaskContext(workDir: string): ModelTaskContext {
  return {
    bookId: BOOK,
    runId: "run-critic",
    attemptId: "proxy-base",
    stageId: "eval-proxy",
    operationId: "eval-proxy",
    workDir,
    signal: new AbortController().signal,
  };
}

function fakeModelRunner(
  respond: (docText: string) => string,
  onCall: () => void,
): ModelTaskRunner {
  return {
    async run(request) {
      onCall();
      assert.equal(request.profileId, "pipeline-read-text-v1");
      assert.equal(request.prompt.templateId, "chapterflow-text-v1");
      assert.ok(request.prompt.inputs.some((input) => input.name === "review_task"));
      const document = request.prompt.inputs.find((input) => input.name === "candidate_document");
      assert.ok(document);
      return {
        attemptId: request.context.attemptId,
        outcome: "SUCCEEDED",
        output: respond(new TextDecoder().decode(document.bytes)),
      };
    },
  };
}

requiredTest("critics use candidate bytes despite conflicting legacy files", async (context) => {
  const input = await rig(context);
  writeFileSync(join(context.roots.stateRoot, `${BOOK}.v21.json`), JSON.stringify({ book: { bookId: "ambient-poison" } }));
  const unbound = runBookGate(BOOK, input.chapters, {
    get stateDir(): string { throw new Error("ambient state discovery attempted"); },
    get requirePlanArtifacts(): boolean { throw new Error("ambient plan discovery attempted"); },
    get checkSourceAlignment(): boolean { throw new Error("ambient source discovery attempted"); },
  });
  const unboundFinding = unbound.findings.find((finding) => finding.catalogId === "BOOK_PATTERN_AUDIT_UNBOUND");
  assert.equal(unbound.passed, false);
  assert.equal(unboundFinding?.message, "BOOK_PATTERN_AUDIT_UNBOUND: explicit candidate-bound patternAudit is required; ambient plan/source discovery is forbidden.");
  assert.equal(unbound.stats.patternAudit.passed, false);
  const beforeCandidateRead = snapshotTree(context.roots.booksRoot);
  const beforeAmbientState = snapshotTree(context.roots.stateRoot);
  const candidateWarnings: string[] = [];
  const priorWarn = console.warn;
  console.warn = (...args: unknown[]) => candidateWarnings.push(args.map(String).join(" "));
  let bound: Awaited<ReturnType<typeof runBookGateFromCandidate>>;
  try {
    bound = await runBookGateFromCandidate(input.reader, {
      bookId: BOOK,
      candidateId: CANDIDATE,
      manifestDigest: input.digest,
      chapterLogicalPaths: input.chapters.map((chapter) => chapterPath(chapter.number)),
      sourceSidecarLogicalPaths: input.chapters.map(() => SOURCE),
      patternAuditLogicalPath: PATTERN_AUDIT,
    });
  } finally {
    console.warn = priorWarn;
  }
  assert.deepEqual(snapshotTree(context.roots.booksRoot), beforeCandidateRead);
  assert.deepEqual(snapshotTree(context.roots.stateRoot), beforeAmbientState);
  assert.deepEqual(candidateWarnings, []);
  assert.equal(bound.findings.some((finding) => finding.catalogId === "BOOK_PATTERN_AUDIT_UNBOUND"), false);
  assert.equal(bound.findings.some((finding) => finding.catalogId === "BP26.exemplar_chapter_reuse"), true);
  assert.equal(bound.stats.patternAudit.passed, true);
  const report = await runAllCriticsFromCandidate(input.reader, { bookId: BOOK, candidateId: CANDIDATE, manifestDigest: input.digest, packageLogicalPath: LEGACY_PACKAGE, generatedAt: CREATED });
  assert.equal(report.bookId, BOOK);
  assert.equal(report.bookFile, LEGACY_PACKAGE);
  assert.equal(report.generatedAt, CREATED);
  await runShipGateFromCandidate(input.reader, { bookId: BOOK, candidateId: CANDIDATE, manifestDigest: input.digest, chapterLogicalPath: chapterPath(1), namePlanLogicalPath: NAME_PLAN, chapterBriefLogicalPath: BRIEF, sourceSidecarLogicalPath: SOURCE, sourceUsePlanLogicalPath: SOURCE_USE });
});

requiredTest("book gate and model evaluator reject missing malformed or mismatched frozen audits before authority", async (context) => {
  const input = await rig(context);
  const chapterLogicalPaths = input.chapters.map((chapter) => chapterPath(chapter.number));
  const gate = (candidateId: string, manifestDigest: string) => runBookGateFromCandidate(input.reader, {
    bookId: BOOK,
    candidateId,
    manifestDigest,
    chapterLogicalPaths,
    sourceSidecarLogicalPaths: chapterLogicalPaths.map(() => SOURCE),
    patternAuditLogicalPath: PATTERN_AUDIT,
  });
  const withoutAudit = input.files.filter((file) => file.logicalPath !== PATTERN_AUDIT);
  const missingDigest = await stageVariant(input, "candidate-audit-missing", withoutAudit);
  await assert.rejects(gate("candidate-audit-missing", missingDigest), /CANDIDATE_ENTRY_MISSING/);

  const replaceAudit = (bytes: Uint8Array): CandidateInputFile[] => input.files.map((file) => (
    file.logicalPath === PATTERN_AUDIT ? { ...file, bytes } : file
  ));
  const malformedDigest = await stageVariant(input, "candidate-audit-malformed", replaceAudit(Buffer.from("{")));
  await assert.rejects(gate("candidate-audit-malformed", malformedDigest), /CANDIDATE_ENTRY_INVALID/);
  const wrongBookDigest = await stageVariant(input, "candidate-audit-wrong-book", replaceAudit(Buffer.from(JSON.stringify(patternAudit("other-book")))));
  await assert.rejects(gate("candidate-audit-wrong-book", wrongBookDigest), /BOOK_PATTERN_AUDIT_MISMATCH: expected bookId/);
  const wrongCountDigest = await stageVariant(input, "candidate-audit-wrong-count", replaceAudit(Buffer.from(JSON.stringify(patternAudit(BOOK, 4)))));
  await assert.rejects(gate("candidate-audit-wrong-count", wrongCountDigest), /BOOK_PATTERN_AUDIT_MISMATCH: expected chapterCount 5/);
  const malformedShape = { ...patternAudit(), stats: { missingBrief: false } };
  const malformedShapeDigest = await stageVariant(input, "candidate-audit-wrong-shape", replaceAudit(Buffer.from(JSON.stringify(malformedShape))));
  await assert.rejects(gate("candidate-audit-wrong-shape", malformedShapeDigest), /BOOK_PATTERN_AUDIT_INVALID: stats shape/);
  const beforeReads = snapshotTree(context.roots.booksRoot);
  await assert.rejects(() => runBookGateFromCandidate(input.reader, {
    bookId: BOOK,
    candidateId: CANDIDATE,
    manifestDigest: input.digest,
    chapterLogicalPaths,
    patternAuditLogicalPath: PATTERN_AUDIT,
  }), /CANDIDATE_ENTRY_INVALID: one explicit source-v2 sidecar path is required per chapter/);
  await assert.rejects(gate("candidate-audit-missing", missingDigest), /CANDIDATE_ENTRY_MISSING/);
  await assert.rejects(gate("candidate-audit-malformed", malformedDigest), /CANDIDATE_ENTRY_INVALID/);
  await assert.rejects(gate("candidate-audit-wrong-book", wrongBookDigest), /BOOK_PATTERN_AUDIT_MISMATCH/);
  await assert.rejects(gate("candidate-audit-wrong-count", wrongCountDigest), /BOOK_PATTERN_AUDIT_MISMATCH/);
  await assert.rejects(gate("candidate-audit-wrong-shape", malformedShapeDigest), /BOOK_PATTERN_AUDIT_INVALID/);
  await assert.rejects(() => runBookGateFromCandidate(input.reader, {
    bookId: BOOK,
    candidateId: CANDIDATE,
    manifestDigest: input.digest,
    chapterLogicalPaths,
    sourceSidecarLogicalPaths: chapterLogicalPaths.map(() => SOURCE),
    patternAuditLogicalPath: "ambient/newest-audit.json",
  }), /CANDIDATE_ENTRY_INVALID: expected critics\/book-pattern-audit\.json/);

  let modelRuns = 0;
  const evaluator = new ModelGatewayReviewEvaluator({
    async run(request) {
      modelRuns += 1;
      return { attemptId: request.context.attemptId, outcome: "SUCCEEDED", output: { outcome: "PASS", issues: [] } };
    },
  });
  const opened = await input.reader.open({ bookId: BOOK, selector: { kind: "CANDIDATE", candidateId: CANDIDATE } });
  assert.ok(opened.ok);
  const evaluate = (candidate: CandidateSnapshot) => evaluator.evaluate({ candidate, taskContext: proxyTaskContext(context.roots.tempRoot) });
  const missingEvaluation = await evaluate({ ...opened.value, files: opened.value.files.filter((file) => file.logicalPath !== PATTERN_AUDIT) });
  assert.equal(missingEvaluation.ok, false);
  assert.equal(modelRuns, 0);
  const malformedEvaluation = await evaluate({
    ...opened.value,
    files: opened.value.files.map((file) => file.logicalPath === PATTERN_AUDIT ? { ...file, bytes: Buffer.from("{") } : file),
  });
  assert.equal(malformedEvaluation.ok, false);
  assert.equal(modelRuns, 0);
  const mismatchEvaluation = await evaluate({
    ...opened.value,
    files: opened.value.files.map((file) => file.logicalPath === PATTERN_AUDIT ? { ...file, bytes: Buffer.from(JSON.stringify(patternAudit("other-book"))) } : file),
  });
  assert.equal(mismatchEvaluation.ok, false);
  assert.equal(modelRuns, 0);
  const currentEvaluation = await evaluate({ ...opened.value, currentRevision: 1 });
  assert.equal(currentEvaluation.ok, false);
  assert.equal(modelRuns, 0);
  const validEvaluation = await evaluate(opened.value);
  assert.equal(validEvaluation.ok, true);
  assert.equal(modelRuns, 1);
  assert.deepEqual(snapshotTree(context.roots.booksRoot), beforeReads);
});

requiredTest("same immutable snapshot yields normalized metric parity", async (context) => {
  const input = await rig(context);
  const request = { bookId: BOOK, candidateId: CANDIDATE, manifestDigest: input.digest, chapterLogicalPaths: input.chapters.map((chapter) => chapterPath(chapter.number)) };
  const first = await computeBookRubricMetricsFromCandidate(input.reader, request);
  const second = await computeBookRubricMetricsFromCandidate(input.reader, request);
  assert.deepEqual({ ...first, generatedAt: "normalized" }, { ...second, generatedAt: "normalized" });
});

requiredTest("stale QC digest blocks without mutation", async (context) => {
  const input = await rig(context);
  assert.equal(input.files.some((file) => file.logicalPath.startsWith("qc/")), false);
  const before = snapshotTree(context.roots.booksRoot);
  const chapter = input.chapters[0];
  const attestation: QcAttestation = {
    schemaVersion: "qc-attest-v1",
    bookId: BOOK,
    chapterNumber: chapter.number,
    chapterId: chapter.chapterId,
    verdict: "PUBLISHABLE",
    contentHash: chapterContentHash(chapter),
    hashVersion: "v2",
    reviewer: "human:test",
    reviewedAt: CREATED,
    roundId: "round-1",
    roundRole: "attest",
    reviewerSessionId: "qc-review-session",
  };
  const exactRound: QcRoundResult = {
    schemaVersion: "1",
    roundId: "round-1",
    candidate: { candidateId: CANDIDATE, manifestDigest: input.digest },
    reviewId: "review-1",
    outcome: "PASS",
    issues: [],
    completedAt: CREATED,
  };
  const findings = await checkQcAttestationFromCandidate(input.reader, { bookId: BOOK, candidateId: CANDIDATE, manifestDigest: input.digest, chapterLogicalPath: chapterPath(1), attestation, qcRound: { ...exactRound, candidate: { ...exactRound.candidate, manifestDigest: "0".repeat(64) } }, roundId: "round-1", reviewId: "review-1", enforce: true });
  assert.equal(findings[0]?.checkId, "QC0.stale_round_binding");
  assert.equal(findings[0]?.message, "QC round candidate ID, manifest digest, round ID, review ID, and PASS outcome must match exactly.");
  const wrongChapter = await checkQcAttestationFromCandidate(input.reader, { bookId: BOOK, candidateId: CANDIDATE, manifestDigest: input.digest, chapterLogicalPath: chapterPath(1), attestation: { ...attestation, chapterNumber: input.chapters[1].number, chapterId: input.chapters[1].chapterId }, qcRound: exactRound, roundId: "round-1", reviewId: "review-1", enforce: true });
  assert.equal(wrongChapter[0]?.checkId, "QC0.stale_attestation_binding");
  assert.equal(wrongChapter[0]?.message, "QC attestation book ID, chapter number, chapter ID, and round ID must match opened chapter and request exactly.");
  const wrongRound = await checkQcAttestationFromCandidate(input.reader, { bookId: BOOK, candidateId: CANDIDATE, manifestDigest: input.digest, chapterLogicalPath: chapterPath(1), attestation: { ...attestation, roundId: "round-poison" }, qcRound: exactRound, roundId: "round-1", reviewId: "review-1", enforce: true });
  assert.equal(wrongRound[0]?.checkId, "QC0.stale_attestation_binding");
  assert.equal(wrongRound[0]?.message, "QC attestation book ID, chapter number, chapter ID, and round ID must match opened chapter and request exactly.");
  const exact = await checkQcAttestationFromCandidate(input.reader, { bookId: BOOK, candidateId: CANDIDATE, manifestDigest: input.digest, chapterLogicalPath: chapterPath(1), attestation, qcRound: exactRound, roundId: "round-1", reviewId: "review-1", enforce: true });
  assert.deepEqual(exact, []);
  assert.deepEqual(snapshotTree(context.roots.booksRoot), before);
});

requiredTest("missing candidate entry errors with no fallback", async (context) => {
  const input = await rig(context);
  writeFileSync(join(context.roots.stateRoot, "missing.json"), JSON.stringify(v13Package()));
  await assert.rejects(() => runAllCriticsFromCandidate(input.reader, { bookId: BOOK, candidateId: CANDIDATE, manifestDigest: input.digest, packageLogicalPath: "missing.json" }), /CANDIDATE_ENTRY_MISSING/);
});

requiredTest("fake model runners preserve frozen sampling and judgments", async (context) => {
  const input = await rig(context);
  assert.deepEqual(selectSeededChapters(BOOK, input.chapters, 4).map((chapter) => chapter.number), [1, 3, 4, 5]);
  assert.deepEqual(sampleChapters(BOOK, input.chapters, 3).map((chapter) => chapter.number), [4, 1, 3]);
  let fakeModelRuns = 0;
  const persisted: ChapterReviewV1[] = [];
  const candidates = { [BOOK]: selection(input) };
  const taskContexts = { [BOOK]: proxyTaskContext(context.roots.tempRoot) };
  const readerCode = await runEvalReaderProxy([BOOK], { chapters: "3", bar: "80" }, {
    contentReader: input.reader,
    candidates,
    runner: fakeModelRunner(fakeChapterReview, () => { fakeModelRuns++; }),
    taskContexts,
    persist: (_bookId, review) => persisted.push(review),
  });
  assert.deepEqual(persisted.map((review) => review.chapterNumber), [4, 1, 3]);
  for (const review of persisted) {
    assert.equal(review.valid, true);
    assert.equal(review.composite, 80);
    assert.equal(review.pass, true);
    assert.equal(review.ship84, true);
    assert.deepEqual(Object.values(review.scores), Array(10).fill(80));
  }
  const sampled = selectSeededChapters(BOOK, input.chapters, 4);
  const bookStdout: string[] = [];
  const originalLog = console.log;
  console.log = (...args: unknown[]) => { bookStdout.push(args.map(String).join(" ")); };
  let bookCode: number;
  try {
    bookCode = await runEvalBookProxy([BOOK], { readers: "1", json: true }, {
      contentReader: input.reader,
      candidates,
      runner: fakeModelRunner((docText) => fakeBookReview(docText, sampled), () => { fakeModelRuns++; }),
      taskContexts,
    });
  } finally {
    console.log = originalLog;
  }
  const payloadLine = bookStdout.find((line) => line.trimStart().startsWith("{") && line.includes('"books"'));
  assert.ok(payloadLine, "book proxy must emit JSON verdict payload");
  const payload = JSON.parse(payloadLine) as { books: Array<{ medianComposite: number; factors: Record<string, number>; gate: string; gateVotes: string; churn: string; validCount: number; readerCount: number; chapters: number[] }> };
  assert.equal(payload.books[0].medianComposite, 80);
  assert.deepEqual(Object.values(payload.books[0].factors), Array(10).fill(80));
  assert.equal(payload.books[0].gate, "PASS");
  assert.equal(payload.books[0].gateVotes, "1P/0F");
  assert.equal(payload.books[0].churn, "LOW");
  assert.equal(payload.books[0].validCount, 1);
  assert.equal(payload.books[0].readerCount, 1);
  assert.deepEqual(payload.books[0].chapters, [1, 3, 4, 5]);
  assert.equal(readerCode, 0);
  assert.equal(bookCode, 0);
  assert.equal(fakeModelRuns, 4);
});

requiredTest("all reader routes preserve bytes modes mtimes and entries with live counters zero", async (context) => {
  const input = await rig(context);
  const before = snapshotTree(context.roots.booksRoot);
  let unboundEvaluatorCalls = 0;
  let unboundPersistCalls = 0;
  const evaluatorTrap = new Proxy([], {
    get() {
      unboundEvaluatorCalls++;
      throw new Error("unbound evaluator executed");
    },
  }) as Array<{ checkId: string; severity: string; message: string }>;
  const malformed = {} as ChapterV21;
  const unboundDefault = await runChapterGateComposite(malformed, "/forbidden/chapter.json", "unbound-default");
  const unboundPath = await runChapterGateComposite(malformed, "/forbidden/chapter.json", "unbound-path", {
    gateAttemptStatePath: join(context.roots.tempRoot, "forbidden-gate-attempts.json"),
    keyJudgeFindings: evaluatorTrap,
  });
  const unboundStateOnly = await runChapterGateComposite(malformed, "/forbidden/chapter.json", "unbound-state", { gateAttemptState: {} });
  const unboundPersistOnly = await runChapterGateComposite(malformed, "/forbidden/chapter.json", "unbound-persist", {
    persistGateAttemptState: () => { unboundPersistCalls++; },
  });
  for (const result of [unboundDefault, unboundPath, unboundStateOnly, unboundPersistOnly]) {
    assert.equal(result.exitCode, 1);
    assert.equal(result.crashed, false);
    assert.match(result.report, /GATE_ATTEMPT_STATE_UNBOUND/);
  }
  assert.equal(unboundEvaluatorCalls, 0);
  assert.equal(unboundPersistCalls, 0);

  let gateState = {};
  let gatePersists = 0;
  const gateInput = {
    bookId: BOOK,
    candidateId: CANDIDATE,
    manifestDigest: input.digest,
    chapterLogicalPath: chapterPath(1),
    siblingLogicalPaths: [] as string[],
    sourceSidecarLogicalPath: SOURCE,
    siblingContextPath: join(context.roots.tempRoot, `${BOOK}-ch01.v21-native.chapter.json`),
    attemptKey: "candidate-third-strike",
    gateAttemptState: gateState,
    persistGateAttemptState: (next: typeof gateState) => { gatePersists++; gateState = next; },
  };
  const firstGate = await runChapterGateCompositeFromCandidate(input.reader, gateInput);
  gateInput.gateAttemptState = gateState;
  const secondGate = await runChapterGateCompositeFromCandidate(input.reader, gateInput);
  gateInput.gateAttemptState = gateState;
  const thirdGate = await runChapterGateCompositeFromCandidate(input.reader, gateInput);
  assert.equal(firstGate.exitCode, 1);
  assert.equal(secondGate.exitCode, 1);
  assert.equal(thirdGate.exitCode, 3);
  assert.match(thirdGate.report, /STUCK-BLOCKER/);
  assert.equal(gatePersists, 3, "bound attempt state persists exactly once per invocation");
  let failedPersistCalls = 0;
  const persistFailure = await runChapterGateCompositeFromCandidate(input.reader, {
    ...gateInput,
    attemptKey: "persist-failure",
    gateAttemptState: {},
    persistGateAttemptState: () => { failedPersistCalls++; throw new Error("injected persist failure"); },
  });
  assert.equal(failedPersistCalls, 1);
  assert.equal(persistFailure.exitCode, 1);
  assert.match(persistFailure.report, /GATE_ATTEMPT_STATE_PERSIST_FAILED: injected persist failure/);

  assert.equal(await runEvalBookProxy([BOOK], { readers: "1" }), 1, "book proxy must fail closed without injected evaluator");
  assert.equal(await runEvalReaderProxy([BOOK], { chapters: "1" }), 2, "reader proxy must fail closed without injected evaluator");
  let blockedRunnerCalls = 0;
  let blockedPersistCalls = 0;
  const blockedDependencies = {
    contentReader: input.reader,
    candidates: {},
    runner: fakeModelRunner(() => { throw new Error("forbidden runner executed"); }, () => { blockedRunnerCalls++; }),
    taskContexts: { [BOOK]: proxyTaskContext(context.roots.tempRoot) },
  };
  assert.equal(await runEvalBookProxy([BOOK], { readers: "1" }, blockedDependencies), 1);
  assert.equal(await runEvalReaderProxy([BOOK], { chapters: "1" }, {
    ...blockedDependencies,
    persist: () => { blockedPersistCalls++; throw new Error("forbidden persistence executed"); },
  }), 2);
  assert.equal(blockedRunnerCalls, 0);
  assert.equal(blockedPersistCalls, 0);
  await runAllCriticsFromCandidate(input.reader, { bookId: BOOK, candidateId: CANDIDATE, manifestDigest: input.digest, packageLogicalPath: LEGACY_PACKAGE, generatedAt: CREATED });
  await computeBookRubricMetricsFromCandidate(input.reader, { bookId: BOOK, candidateId: CANDIDATE, manifestDigest: input.digest, chapterLogicalPaths: input.chapters.map((chapter) => chapterPath(chapter.number)) });
  const candidates = { [BOOK]: selection(input) };
  const taskContexts = { [BOOK]: proxyTaskContext(context.roots.tempRoot) };
  const sampled = selectSeededChapters(BOOK, input.chapters, 4);
  let fakeRunnerCalls = 0;
  await runEvalBookProxy([BOOK], { readers: "1" }, {
    contentReader: input.reader,
    candidates,
    runner: fakeModelRunner((docText) => fakeBookReview(docText, sampled), () => { fakeRunnerCalls++; }),
    taskContexts,
  });
  await runEvalReaderProxy([BOOK], { chapters: "1" }, {
    contentReader: input.reader,
    candidates,
    runner: fakeModelRunner(fakeChapterReview, () => { fakeRunnerCalls++; }),
    taskContexts,
  });
  assert.equal(fakeRunnerCalls, 2, "only injected fake model runners may execute");
  assert.deepEqual(snapshotTree(context.roots.booksRoot), before);
});

finishV25Tests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
