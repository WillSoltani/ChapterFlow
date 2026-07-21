import assert from "node:assert/strict";
import { lstatSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { createBookContentReader } from "../../src/books/bookContentReader.js";
import { createBookWriteLock } from "../../src/books/bookLease.js";
import { createCandidateStore } from "../../src/books/candidateStore.js";
import { createCurrentPointerStore } from "../../src/books/currentPointer.js";
import type { CandidateInputFile, CandidateStore } from "../../src/books/candidateTypes.js";
import type { PlannedArtifact } from "../../src/contracts/v4Core.js";
import { runAllCriticsFromCandidate } from "../../src/critics/runAllCritics.js";
import { runChapterGateComposite, runChapterGateCompositeFromCandidate } from "../../src/critics/chapterGateComposite.js";
import { runShipGateFromCandidate } from "../../src/critics/finalGate.js";
import { chapterContentHash, checkQcAttestationFromCandidate, type QcAttestation } from "../../src/critics/qcAttestation.js";
import { computeBookRubricMetricsFromCandidate } from "../../src/metrics/bookRubricMetrics.js";
import { runEvalBookProxy, selectSeededChapters } from "../../src/review/evalBookProxy.js";
import { runEvalReaderProxy, sampleChapters } from "../../src/review/evalReaderProxy.js";
import type { BookPackage, BookPackageV21, ChapterV21 } from "../../src/types.js";
import type { ChapterReviewV1 } from "../../src/artifacts/artifactTypes.js";
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
const ATTESTATION = "qc/attestation.json";
const QC_ROUND = "qc/round.json";

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

async function rig(context: TestContext, includeQc = false) {
  const lock = createBookWriteLock({ booksRoot: context.roots.booksRoot, timeoutMs: 1_000, pollMs: 1 });
  const pointer = createCurrentPointerStore({ booksRoot: context.roots.booksRoot, writeLock: lock });
  const store = createCandidateStore({ booksRoot: context.roots.booksRoot, writeLock: lock, currentPointerStore: pointer });
  const reader = createBookContentReader({ booksRoot: context.roots.booksRoot, currentPointerStore: pointer });
  const sourceChapters = chapters();
  const files: CandidateInputFile[] = [
    ...sourceChapters.map((chapter) => jsonFile(chapterPath(chapter.number), chapter, "CHAPTER")),
    jsonFile(PACKAGE, v21Package(sourceChapters)),
    jsonFile(LEGACY_PACKAGE, v13Package()),
    jsonFile(NAME_PLAN, { allocation: {}, diagnostics: { alreadyAuthored: [] } }),
    jsonFile(BRIEF, { rotationSchemaVersion: "v3", exampleCount: 4 }),
    jsonFile(SOURCE, {}),
    jsonFile(SOURCE_USE, { schemaVersion: "source-use-plan-v1", bookId: BOOK, chapterNumber: 1, units: {} }),
  ];
  if (includeQc) {
    const chapter = sourceChapters[0];
    const attestation: QcAttestation = {
      schemaVersion: "qc-attest-v1",
      bookId: BOOK,
      chapterNumber: 1,
      chapterId: chapter.chapterId,
      verdict: "PUBLISHABLE",
      contentHash: chapterContentHash(chapter),
      hashVersion: "v2",
      reviewer: "human:test",
      reviewedAt: CREATED,
    };
    files.push(jsonFile(ATTESTATION, attestation));
    files.push(jsonFile(QC_ROUND, {
      schemaVersion: "1",
      roundId: "round-1",
      candidate: { candidateId: CANDIDATE, manifestDigest: "0".repeat(64) },
      reviewId: "review-1",
      outcome: "PASS",
      issues: [],
      completedAt: CREATED,
    }));
  }
  const inventory = files.map(({ bytes: _bytes, ...entry }) => entry);
  const staged = await store.stage({ bookId: BOOK, candidateId: CANDIDATE, createdByRunId: "run-critic", expectedInventory: inventory, files, createdAt: CREATED });
  assert.ok(staged.ok);
  return { store, reader, files, chapters: sourceChapters, digest: staged.value.manifestDigest };
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

requiredTest("critics use candidate bytes despite conflicting legacy files", async (context) => {
  const input = await rig(context);
  writeFileSync(join(context.roots.stateRoot, `${BOOK}.v21.json`), JSON.stringify({ book: { bookId: "ambient-poison" } }));
  const report = await runAllCriticsFromCandidate(input.reader, { bookId: BOOK, candidateId: CANDIDATE, manifestDigest: input.digest, packageLogicalPath: LEGACY_PACKAGE, generatedAt: CREATED });
  assert.equal(report.bookId, BOOK);
  assert.equal(report.bookFile, LEGACY_PACKAGE);
  assert.equal(report.generatedAt, CREATED);
  await runShipGateFromCandidate(input.reader, { bookId: BOOK, candidateId: CANDIDATE, manifestDigest: input.digest, chapterLogicalPath: chapterPath(1), namePlanLogicalPath: NAME_PLAN, chapterBriefLogicalPath: BRIEF, sourceSidecarLogicalPath: SOURCE, sourceUsePlanLogicalPath: SOURCE_USE });
});

requiredTest("same immutable snapshot yields normalized metric parity", async (context) => {
  const input = await rig(context);
  const request = { bookId: BOOK, candidateId: CANDIDATE, manifestDigest: input.digest, chapterLogicalPaths: input.chapters.map((chapter) => chapterPath(chapter.number)) };
  const first = await computeBookRubricMetricsFromCandidate(input.reader, request);
  const second = await computeBookRubricMetricsFromCandidate(input.reader, request);
  assert.deepEqual({ ...first, generatedAt: "normalized" }, { ...second, generatedAt: "normalized" });
});

requiredTest("stale QC digest blocks without mutation", async (context) => {
  const input = await rig(context, true);
  const before = snapshotTree(context.roots.booksRoot);
  const findings = await checkQcAttestationFromCandidate(input.reader, { bookId: BOOK, candidateId: CANDIDATE, manifestDigest: input.digest, chapterLogicalPath: chapterPath(1), attestationLogicalPath: ATTESTATION, qcRoundLogicalPath: QC_ROUND, roundId: "round-1", reviewId: "review-1", enforce: true });
  assert.equal(findings[0]?.checkId, "QC0.stale_round_binding");
  assert.deepEqual(snapshotTree(context.roots.booksRoot), before);
});

requiredTest("missing candidate entry errors with no fallback", async (context) => {
  const input = await rig(context);
  writeFileSync(join(context.roots.stateRoot, "missing.json"), JSON.stringify(v13Package()));
  await assert.rejects(() => runAllCriticsFromCandidate(input.reader, { bookId: BOOK, candidateId: CANDIDATE, manifestDigest: input.digest, packageLogicalPath: "missing.json" }), /CANDIDATE_ENTRY_MISSING/);
});

requiredTest("fake evaluators preserve frozen sampling and judgments", async (context) => {
  const input = await rig(context);
  assert.deepEqual(selectSeededChapters(BOOK, input.chapters, 4).map((chapter) => chapter.number), [1, 3, 4, 5]);
  assert.deepEqual(sampleChapters(BOOK, input.chapters, 3).map((chapter) => chapter.number), [4, 1, 3]);
  let fakeEvaluations = 0;
  const persisted: ChapterReviewV1[] = [];
  const candidates = { [BOOK]: selection(input) };
  const readerCode = await runEvalReaderProxy([BOOK], { chapters: "3", bar: "80" }, {
    contentReader: input.reader,
    candidates,
    evaluate: async ({ docText }) => { fakeEvaluations++; return fakeChapterReview(docText); },
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
    bookCode = await runEvalBookProxy([BOOK], { readers: "1", json: true }, { contentReader: input.reader, candidates, evaluate: async ({ docText }) => { fakeEvaluations++; return fakeBookReview(docText, sampled); } });
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
  assert.equal(fakeEvaluations, 4);
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
  let blockedEvaluatorCalls = 0;
  let blockedPersistCalls = 0;
  const blockedDependencies = {
    contentReader: input.reader,
    candidates: {},
    evaluate: async (): Promise<string> => { blockedEvaluatorCalls++; throw new Error("forbidden evaluator executed"); },
  };
  assert.equal(await runEvalBookProxy([BOOK], { readers: "1" }, blockedDependencies), 0);
  assert.equal(await runEvalReaderProxy([BOOK], { chapters: "1" }, {
    ...blockedDependencies,
    persist: () => { blockedPersistCalls++; throw new Error("forbidden persistence executed"); },
  }), 2);
  assert.equal(blockedEvaluatorCalls, 0);
  assert.equal(blockedPersistCalls, 0);
  await runAllCriticsFromCandidate(input.reader, { bookId: BOOK, candidateId: CANDIDATE, manifestDigest: input.digest, packageLogicalPath: LEGACY_PACKAGE, generatedAt: CREATED });
  await computeBookRubricMetricsFromCandidate(input.reader, { bookId: BOOK, candidateId: CANDIDATE, manifestDigest: input.digest, chapterLogicalPaths: input.chapters.map((chapter) => chapterPath(chapter.number)) });
  const candidates = { [BOOK]: selection(input) };
  const sampled = selectSeededChapters(BOOK, input.chapters, 4);
  let fakeEvaluatorCalls = 0;
  await runEvalBookProxy([BOOK], { readers: "1" }, { contentReader: input.reader, candidates, evaluate: async ({ docText }) => { fakeEvaluatorCalls++; return fakeBookReview(docText, sampled); } });
  await runEvalReaderProxy([BOOK], { chapters: "1" }, { contentReader: input.reader, candidates, evaluate: async ({ docText }) => { fakeEvaluatorCalls++; return fakeChapterReview(docText); } });
  assert.equal(fakeEvaluatorCalls, 2, "only injected fake evaluators may execute");
  assert.deepEqual(snapshotTree(context.roots.booksRoot), before);
});

finishV25Tests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
