import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { BookRunApplicationService, type BookRunEvent } from "../../src/app/bookRunApplicationService.js";
import type { CandidateQcEvaluator } from "../../src/app/candidateQcEvaluator.js";
import type { CompilerApplicationPort } from "../../src/app/compilerApplicationPort.js";
import { ModelGatewayReviewEvaluator } from "../../src/app/modelGatewayReviewEvaluator.js";
import type { ModelTaskRunner } from "../../src/app/modelTaskRunner.js";
import type { ResearchCandidateApplicationPort } from "../../src/app/researchCandidateApplicationPort.js";
import { createBookWriteLock } from "../../src/books/bookLease.js";
import { createBookContentReader } from "../../src/books/bookContentReader.js";
import { createCandidateStore } from "../../src/books/candidateStore.js";
import { createCurrentPointerStore } from "../../src/books/currentPointer.js";
import type { CandidateInputFile, CandidateSnapshot } from "../../src/books/candidateTypes.js";
import { BOOK_PATTERN_AUDIT_LOGICAL_PATH, runBookPatternAudit } from "../../src/critics/bookPatternAudit.js";
import { createQcService } from "../../src/qc/qcService.js";
import { createPromotionService } from "../../src/release/promotionService.js";
import { createReviewServiceFactory } from "../../src/review/reviewService.js";
import { createFileRunStore } from "../../src/run-state/fileRunStore.js";
import { reconcileAttempt, RECONCILED_UNSETTLED_ON_RESUME } from "../../src/run-state/reconcileAttempt.js";
import { createFileStageCoordinator } from "../../src/run-state/stageCoordinator.js";
import { fixtureChapter } from "../model-bakeoff-helpers.js";
import { finishV25Tests, requiredTest, type TestContext } from "./harness.js";

const BOOK = "book-run-service";
const SOURCE_SHA = "a20d1cdab0fc33c4c1f840f4cf99089816e022d4";
const BOOK_RUN_ID = "book-run-main";
const COMPILER_RUN_ID = `compiler-run-${createHash("sha256").update(BOOK_RUN_ID).digest("hex").slice(0, 32)}`;
const COMPILED_CANDIDATE_ID = `${COMPILER_RUN_ID}-candidate`;

function jsonFile(logicalPath: string, value: unknown, kind: CandidateInputFile["kind"] = "SIDECAR"): CandidateInputFile {
  return { kind, logicalPath, mediaType: "application/json", bytes: Buffer.from(`${JSON.stringify(value)}\n`) };
}

async function stageCandidate(
  store: ReturnType<typeof createCandidateStore>,
  input: Readonly<{ candidateId: string; runId: string; files: readonly CandidateInputFile[]; parentCandidateId?: string; createdAt: string }>,
): Promise<CandidateSnapshot> {
  const staged = await store.stage({
    bookId: BOOK,
    candidateId: input.candidateId,
    ...(input.parentCandidateId === undefined ? {} : { parentCandidateId: input.parentCandidateId }),
    createdByRunId: input.runId,
    expectedInventory: input.files.map(({ bytes: _bytes, ...file }) => file),
    files: input.files,
    createdAt: input.createdAt,
  });
  assert.equal(staged.ok, true, JSON.stringify(staged));
  const opened = await store.open({ bookId: BOOK, selector: { kind: "CANDIDATE", candidateId: input.candidateId } });
  assert.ok(opened.ok);
  return opened.value;
}

requiredTest("book-run service joins exact review QC and local promotion with durable phase events", async (context: TestContext) => {
  const now = () => {
    const value = context.clock.now();
    context.clock.advance(1);
    return value;
  };
  const booksRoot = resolve(context.roots.tempRoot, "books");
  const runRoot = resolve(context.roots.tempRoot, "runs");
  mkdirSync(booksRoot, { recursive: true });
  const writeLock = createBookWriteLock({ booksRoot });
  const currentPointer = createCurrentPointerStore({ booksRoot, writeLock });
  const candidates = createCandidateStore({ booksRoot, writeLock, currentPointerStore: currentPointer });
  const reader = createBookContentReader({ booksRoot, currentPointerStore: currentPointer });
  const runStore = createFileRunStore(runRoot);
  const stageCoordinator = createFileStageCoordinator(runRoot);
  const chapter = fixtureChapter(BOOK, 1, "book-run-service");
  const seed = await stageCandidate(candidates, {
    candidateId: "seed-candidate",
    runId: "seed-run",
    createdAt: context.clock.now(),
    files: [jsonFile("inputs/chapter-index.json", [{ chapterId: chapter.chapterId, chapterNumber: 1, chapterTitle: chapter.title }])],
  });
  const compiled = await stageCandidate(candidates, {
    candidateId: COMPILED_CANDIDATE_ID,
    parentCandidateId: seed.manifest.candidateId,
    runId: COMPILER_RUN_ID,
    createdAt: context.clock.now(),
    files: [
      jsonFile(`content/chapters/${chapter.chapterId}.v21-native.chapter.json`, chapter, "CHAPTER"),
      jsonFile(BOOK_PATTERN_AUDIT_LOGICAL_PATH, runBookPatternAudit({
        bookId: BOOK,
        chapters: [chapter],
        requirePlanArtifacts: false,
        checkSourceAlignment: false,
      })),
    ],
  });

  let runnerCalls = 0;
  const runner: ModelTaskRunner = {
    async run(request) {
      runnerCalls += 1;
      const admittedAt = context.clock.now();
      const admitted = await runStore.admitAttempt({
        bookId: request.context.bookId,
        runId: request.context.runId,
        attemptId: request.context.attemptId,
        stageId: request.context.stageId,
        operationId: request.context.operationId,
        admittedAt,
        staleAt: new Date(Date.parse(admittedAt) + 60_000).toISOString(),
      });
      assert.equal(admitted.ok, true, JSON.stringify(admitted));
      const finished = await runStore.finishAttempt({
        bookId: request.context.bookId,
        runId: request.context.runId,
        attemptId: request.context.attemptId,
        outcome: "SUCCEEDED",
        finishedAt: context.clock.now(),
      });
      assert.equal(finished.ok, true, JSON.stringify(finished));
      return { attemptId: request.context.attemptId, outcome: "SUCCEEDED", output: { outcome: "PASS", issues: [] } };
    },
  };
  const reviews = createReviewServiceFactory({ booksRoot, contentReader: reader, now })
    .create(new ModelGatewayReviewEvaluator(runner));
  const qc = createQcService({ booksRoot, contentReader: reader, reviewService: reviews, writeLock, now });
  const promotion = createPromotionService({
    candidateStore: candidates,
    contentReader: reader,
    reviewService: reviews,
    qcService: qc,
    currentPointerStore: currentPointer,
    clock: now,
  });
  const research = {
    async run(request: { resumeRunId?: string; newRunId?: string }) {
      return {
        schemaVersion: "1" as const,
        bookId: BOOK,
        title: "Book Run Service",
        author: "Fixture Author",
        intakeRunId: request.resumeRunId ?? request.newRunId ?? BOOK_RUN_ID,
        researchRunId: "research-fixture",
        candidate: { candidateId: seed.manifest.candidateId, manifestDigest: seed.manifest.manifestDigest },
        indexLogicalPath: "inputs/chapter-index.json" as const,
        sectionTaskContextLogicalPath: "inputs/compiler-section-task-context.json" as const,
        sources: [],
        resumed: request.resumeRunId !== undefined,
      };
    },
  } as unknown as ResearchCandidateApplicationPort;
  let compilerRunPersisted = false;
  const compiler = {
    async run(request: { resumeRunId?: string }) {
      assert.equal(request.resumeRunId, COMPILER_RUN_ID);
      if (!compilerRunPersisted) {
        const created = await runStore.createRun({
          schemaVersion: "1",
          bookId: BOOK,
          runId: COMPILER_RUN_ID,
          commandId: "compiler-candidate",
          sourceGitSha: SOURCE_SHA,
          requiredStages: ["compiler-candidate"],
          requiredInventory: [],
          inputCandidate: { candidateId: seed.manifest.candidateId, manifestDigest: seed.manifest.manifestDigest },
          attemptLimits: { run: 4, byStage: { "compiler-candidate": 4 } },
          createdAt: context.clock.now(),
        });
        assert.ok(created.ok);
        const finished = await runStore.finishRun({
          bookId: BOOK,
          runId: COMPILER_RUN_ID,
          status: "COMPLETED",
          finishedAt: context.clock.now(),
        });
        assert.ok(finished.ok);
        compilerRunPersisted = true;
      }
      return {
        runId: COMPILER_RUN_ID,
        runStatus: "COMPLETED" as const,
        candidateId: compiled.manifest.candidateId,
        manifestDigest: compiled.manifest.manifestDigest,
      };
    },
  } as unknown as CompilerApplicationPort;
  const candidateQc = {
    async run(request: { roundId: string; canonicalReview: { reviewId: string } }) {
      return {
        ok: true as const,
        value: {
          roundId: request.roundId,
          candidate: { candidateId: compiled.manifest.candidateId, manifestDigest: compiled.manifest.manifestDigest },
          reviewId: request.canonicalReview.reviewId,
          outcome: "PASS" as const,
          issues: [],
        },
      };
    },
  } as unknown as CandidateQcEvaluator;
  const events: BookRunEvent[] = [];
  const sentinel = resolve(context.roots.tempRoot, "package-sentinel.json");
  writeFileSync(sentinel, "unchanged\n");
  const service = new BookRunApplicationService({
    research,
    compiler,
    contentReader: reader,
    candidateQc,
    reviews,
    qc,
    promotion,
    currentPointer,
    runStore,
    stageCoordinator,
    clock: { now },
    ids: {
      nextRunId: () => BOOK_RUN_ID,
      candidateId: (runId) => `${runId}-candidate`,
      modelAttemptId: (runId) => `${runId}-model`,
      reviewAttemptId: (runId) => `${runId}-review-attempt`,
      reviewId: (runId) => `${runId}-review`,
      qcRoundId: (runId) => `${runId}-qc`,
    },
    events: {
      async append(event) { events.push(event); },
      async read(bookId, runId) { return events.filter((event) => event.bookId === bookId && event.runId === runId); },
    },
    pipelineRoot: resolve(context.roots.base, "pipeline"),
  });
  const result = await service.run({
    bookId: BOOK,
    title: "Book Run Service",
    author: "Fixture Author",
    sourceGitSha: SOURCE_SHA,
    v25Root: resolve(context.roots.tempRoot, "v25"),
    attemptRoot: resolve(context.roots.attemptsRoot, "book-run"),
    regen: true,
    maxRepairRounds: 1,
    promoteLocal: true,
    signal: new AbortController().signal,
  });
  if (!result.ok) throw new Error(`BOOK_RUN_RESULT:${JSON.stringify(result.error)}`);
  assert.ok(result.ok);
  assert.equal(result.value.status, "PROMOTED");
  assert.equal(result.value.readback, "VERIFIED");
  assert.deepEqual(result.value.candidate, {
    candidateId: compiled.manifest.candidateId,
    manifestDigest: compiled.manifest.manifestDigest,
  });
  const pointer = await currentPointer.read(BOOK);
  assert.ok(pointer.ok && pointer.value);
  assert.equal(pointer.value.candidateId, compiled.manifest.candidateId);
  assert.deepEqual(events.filter((event) => event.status === "COMPLETED").map((event) => event.phase), [
    "intake", "research", "seed", "compile", "review", "fresh-qc", "promotion",
  ]);
  assert.ok(events.some((event) => event.phase === "repair" && event.status === "SKIPPED"));
  assert.equal(readFileSync(sentinel, "utf8"), "unchanged\n");

  const resumed = await service.run({
    bookId: BOOK,
    title: "Book Run Service",
    author: "Fixture Author",
    sourceGitSha: SOURCE_SHA,
    v25Root: resolve(context.roots.tempRoot, "v25"),
    attemptRoot: resolve(context.roots.attemptsRoot, "book-run"),
    resumeRunId: BOOK_RUN_ID,
    regen: true,
    maxRepairRounds: 1,
    promoteLocal: true,
    signal: new AbortController().signal,
  });
  if (!resumed.ok) throw new Error(`BOOK_RUN_RESUME_RESULT:${JSON.stringify(resumed.error)}`);
  assert.equal(resumed.value.status, "PROMOTED");
  assert.equal(resumed.value.bookRevision, 1, "post-CAS resume must not create another pointer revision");
  assert.equal(resumed.value.readback, "VERIFIED");
  assert.equal(runnerCalls, 1, "completed canonical review must resume without another model call");
  assert.equal(events.filter((event) => event.phase === "research" && event.status === "COMPLETED").length, 1);
  assert.equal(events.filter((event) => event.phase === "seed" && event.status === "COMPLETED").length, 1);
  const resumedPointer = await currentPointer.read(BOOK);
  assert.ok(resumedPointer.ok && resumedPointer.value);
  assert.equal(resumedPointer.value.revision, 1);
  assert.equal(readFileSync(sentinel, "utf8"), "unchanged\n");
});

requiredTest("explicit parent resume reuses completed research seed and permits one isolated deterministic compiler retry", async (context: TestContext) => {
  const now = () => {
    const value = context.clock.now();
    context.clock.advance(1);
    return value;
  };
  const booksRoot = resolve(context.roots.tempRoot, "retry-books");
  const runRoot = resolve(context.roots.tempRoot, "retry-runs");
  mkdirSync(booksRoot, { recursive: true });
  const writeLock = createBookWriteLock({ booksRoot });
  const currentPointer = createCurrentPointerStore({ booksRoot, writeLock });
  const candidates = createCandidateStore({ booksRoot, writeLock, currentPointerStore: currentPointer });
  const reader = createBookContentReader({ booksRoot, currentPointerStore: currentPointer });
  const runStore = createFileRunStore(runRoot);
  const stageCoordinator = createFileStageCoordinator(runRoot);
  const chapter = fixtureChapter(BOOK, 1, "book-run-retry");
  const seed = await stageCandidate(candidates, {
    candidateId: "retry-seed-candidate",
    runId: "retry-seed-run",
    createdAt: context.clock.now(),
    files: [jsonFile("inputs/chapter-index.json", [{ chapterId: chapter.chapterId, chapterNumber: 1, chapterTitle: chapter.title }])],
  });
  const retryRunId = `compiler-retry-1-run-${createHash("sha256").update(BOOK_RUN_ID).digest("hex").slice(0, 32)}`;

  let reviewCalls = 0;
  const runner: ModelTaskRunner = {
    async run(request) {
      reviewCalls += 1;
      const admittedAt = context.clock.now();
      const admitted = await runStore.admitAttempt({
        bookId: request.context.bookId,
        runId: request.context.runId,
        attemptId: request.context.attemptId,
        stageId: request.context.stageId,
        operationId: request.context.operationId,
        admittedAt,
        staleAt: new Date(Date.parse(admittedAt) + 60_000).toISOString(),
      });
      assert.equal(admitted.ok, true, JSON.stringify(admitted));
      const finished = await runStore.finishAttempt({
        bookId: request.context.bookId,
        runId: request.context.runId,
        attemptId: request.context.attemptId,
        outcome: "SUCCEEDED",
        finishedAt: context.clock.now(),
      });
      assert.equal(finished.ok, true, JSON.stringify(finished));
      return { attemptId: request.context.attemptId, outcome: "SUCCEEDED", output: { outcome: "PASS", issues: [] } };
    },
  };
  const reviews = createReviewServiceFactory({ booksRoot, contentReader: reader, now })
    .create(new ModelGatewayReviewEvaluator(runner));
  const qc = createQcService({ booksRoot, contentReader: reader, reviewService: reviews, writeLock, now });
  const promotion = createPromotionService({
    candidateStore: candidates,
    contentReader: reader,
    reviewService: reviews,
    qcService: qc,
    currentPointerStore: currentPointer,
    clock: now,
  });

  let researchPortCalls = 0;
  let researchModelCalls = 0;
  const research = {
    async run(request: { resumeRunId?: string; newRunId?: string; forceRefresh?: boolean }) {
      researchPortCalls += 1;
      if (request.resumeRunId === undefined) researchModelCalls += 13;
      else assert.equal(request.forceRefresh, true, "completed research resume must preserve original regen intent");
      return {
        schemaVersion: "1" as const,
        bookId: BOOK,
        title: "Book Run Service",
        author: "Fixture Author",
        intakeRunId: request.resumeRunId ?? request.newRunId ?? BOOK_RUN_ID,
        researchRunId: "research-retry-fixture",
        candidate: { candidateId: seed.manifest.candidateId, manifestDigest: seed.manifest.manifestDigest },
        indexLogicalPath: "inputs/chapter-index.json" as const,
        sectionTaskContextLogicalPath: "inputs/compiler-section-task-context.json" as const,
        sources: [],
        resumed: request.resumeRunId !== undefined,
      };
    },
  } as unknown as ResearchCandidateApplicationPort;

  const compilerRunIds: string[] = [];
  const compilerAttemptRoots: string[] = [];
  let compiled: CandidateSnapshot | undefined;
  const compiler = {
    async run(request: { resumeRunId?: string; attemptRoot: string }) {
      assert.ok(request.resumeRunId);
      compilerRunIds.push(request.resumeRunId);
      compilerAttemptRoots.push(request.attemptRoot);
      if (compilerRunIds.length === 1) {
        assert.equal(request.resumeRunId, COMPILER_RUN_ID);
        const created = await runStore.createRun({
          schemaVersion: "1",
          bookId: BOOK,
          runId: request.resumeRunId,
          commandId: "compiler-candidate",
          sourceGitSha: SOURCE_SHA,
          requiredStages: ["compiler-candidate"],
          requiredInventory: [],
          inputCandidate: { candidateId: seed.manifest.candidateId, manifestDigest: seed.manifest.manifestDigest },
          attemptLimits: { run: 4, byStage: { "compiler-candidate": 4 } },
          createdAt: context.clock.now(),
        });
        assert.ok(created.ok);
        const failed = await runStore.finishRun({
          bookId: BOOK,
          runId: request.resumeRunId,
          status: "FAILED",
          finishedAt: context.clock.now(),
          reason: "COMPILER_ASSEMBLY_BLOCKED:fixture deterministic gate failure",
        });
        assert.ok(failed.ok);
        throw new Error("COMPILER_ASSEMBLY_BLOCKED:fixture deterministic gate failure");
      }
      assert.equal(request.resumeRunId, retryRunId);
      assert.equal(request.attemptRoot, resolve(context.roots.attemptsRoot, "book-run-retry", "compiler-retry-1"));
      compiled = await stageCandidate(candidates, {
        candidateId: `${request.resumeRunId}-candidate`,
        parentCandidateId: seed.manifest.candidateId,
        runId: request.resumeRunId,
        createdAt: context.clock.now(),
        files: [
          jsonFile(`content/chapters/${chapter.chapterId}.v21-native.chapter.json`, chapter, "CHAPTER"),
          jsonFile(BOOK_PATTERN_AUDIT_LOGICAL_PATH, runBookPatternAudit({
            bookId: BOOK,
            chapters: [chapter],
            requirePlanArtifacts: false,
            checkSourceAlignment: false,
          })),
        ],
      });
      return {
        runId: request.resumeRunId,
        runStatus: "COMPLETED" as const,
        candidateId: compiled.manifest.candidateId,
        manifestDigest: compiled.manifest.manifestDigest,
      };
    },
  } as unknown as CompilerApplicationPort;
  const candidateQc = {
    async run(request: { candidate: CandidateSnapshot; roundId: string; canonicalReview: { reviewId: string } }) {
      return {
        ok: true as const,
        value: {
          roundId: request.roundId,
          candidate: { candidateId: request.candidate.manifest.candidateId, manifestDigest: request.candidate.manifest.manifestDigest },
          reviewId: request.canonicalReview.reviewId,
          outcome: "PASS" as const,
          issues: [],
        },
      };
    },
  } as unknown as CandidateQcEvaluator;
  const events: BookRunEvent[] = [];
  const service = new BookRunApplicationService({
    research,
    compiler,
    contentReader: reader,
    candidateQc,
    reviews,
    qc,
    promotion,
    currentPointer,
    runStore,
    stageCoordinator,
    clock: { now },
    ids: {
      nextRunId: () => BOOK_RUN_ID,
      candidateId: (runId) => `${runId}-candidate`,
      modelAttemptId: (runId) => `${runId}-model`,
      reviewAttemptId: (runId) => `${runId}-review-attempt`,
      reviewId: (runId) => `${runId}-review`,
      qcRoundId: (runId) => `${runId}-qc`,
    },
    events: {
      async append(event) { events.push(event); },
      async read(bookId, runId) { return events.filter((event) => event.bookId === bookId && event.runId === runId); },
    },
    pipelineRoot: resolve(context.roots.base, "pipeline"),
  });
  const request = {
    bookId: BOOK,
    title: "Book Run Service",
    author: "Fixture Author",
    sourceGitSha: SOURCE_SHA,
    v25Root: resolve(context.roots.tempRoot, "retry-v25"),
    attemptRoot: resolve(context.roots.attemptsRoot, "book-run-retry"),
    regen: true,
    maxRepairRounds: 1 as const,
    promoteLocal: false,
    signal: new AbortController().signal,
  };
  const first = await service.run(request);
  assert.equal(first.ok, false);
  if (first.ok) throw new Error("expected deterministic compiler failure");
  assert.equal(first.error.code, "BOOK_RUN_COMPILER_FAILED");
  assert.deepEqual(compilerRunIds, [COMPILER_RUN_ID], "initial call must not retry compiler automatically");
  assert.equal(researchModelCalls, 13);

  const resumed = await service.run({ ...request, resumeRunId: BOOK_RUN_ID });
  if (!resumed.ok) throw new Error(`BOOK_RUN_RETRY_RESULT:${JSON.stringify(resumed.error)}`);
  assert.equal(resumed.value.status, "READY");
  assert.ok(compiled);
  assert.deepEqual(resumed.value.candidate, {
    candidateId: compiled.manifest.candidateId,
    manifestDigest: compiled.manifest.manifestDigest,
  });
  assert.deepEqual(compilerRunIds, [COMPILER_RUN_ID, retryRunId]);
  assert.equal(compilerAttemptRoots[1], resolve(context.roots.attemptsRoot, "book-run-retry", "compiler-retry-1"));
  assert.equal(researchPortCalls, 1, "resume rehydrates the durable seed in-service and must NOT re-invoke the research port (task 11g)");
  assert.equal(researchModelCalls, 13, "resume must not repeat research model work");
  assert.equal(reviewCalls, 1);
  assert.equal(events.filter((event) => event.phase === "research" && event.status === "STARTED").length, 1);
  assert.equal(events.filter((event) => event.phase === "research" && event.status === "COMPLETED").length, 1);
  assert.equal(events.filter((event) => event.phase === "seed" && event.status === "STARTED").length, 1);
  assert.equal(events.filter((event) => event.phase === "seed" && event.status === "COMPLETED").length, 1);

  const exhaustedParentRunId = "book-run-compiler-retry-exhausted";
  const exhaustedBaseRunId = `compiler-run-${createHash("sha256").update(exhaustedParentRunId).digest("hex").slice(0, 32)}`;
  const exhaustedRetryRunId = `compiler-retry-1-run-${createHash("sha256").update(exhaustedParentRunId).digest("hex").slice(0, 32)}`;
  for (const [childRunId, reason] of [
    [exhaustedBaseRunId, "COMPILER_ASSEMBLY_BLOCKED:base deterministic gate failure"],
    [exhaustedRetryRunId, "MODEL_TASK_FAILED:single retry failed"],
  ] as const) {
    const created = await runStore.createRun({
      schemaVersion: "1",
      bookId: BOOK,
      runId: childRunId,
      commandId: "compiler-candidate",
      sourceGitSha: SOURCE_SHA,
      requiredStages: ["compiler-candidate"],
      requiredInventory: [],
      inputCandidate: { candidateId: seed.manifest.candidateId, manifestDigest: seed.manifest.manifestDigest },
      attemptLimits: { run: 4, byStage: { "compiler-candidate": 4 } },
      createdAt: now(),
    });
    assert.ok(created.ok);
    const failed = await runStore.finishRun({
      bookId: BOOK,
      runId: childRunId,
      status: "FAILED",
      finishedAt: now(),
      reason,
    });
    assert.ok(failed.ok);
  }
  const exhaustedAt = now();
  events.push(
    { schemaVersion: "1", runId: exhaustedParentRunId, bookId: BOOK, phase: "intake", status: "COMPLETED", at: exhaustedAt, detail: "expectedBookRevision=0" },
    { schemaVersion: "1", runId: exhaustedParentRunId, bookId: BOOK, phase: "research", status: "COMPLETED", at: exhaustedAt },
    { schemaVersion: "1", runId: exhaustedParentRunId, bookId: BOOK, phase: "seed", status: "COMPLETED", at: exhaustedAt, candidate: { candidateId: seed.manifest.candidateId, manifestDigest: seed.manifest.manifestDigest } },
    { schemaVersion: "1", runId: exhaustedParentRunId, bookId: BOOK, phase: "compile", status: "STARTED", at: exhaustedAt },
    { schemaVersion: "1", runId: exhaustedParentRunId, bookId: BOOK, phase: "compile", status: "FAILED", at: exhaustedAt, detail: "COMPILER_ASSEMBLY_BLOCKED:base deterministic gate failure" },
    { schemaVersion: "1", runId: exhaustedParentRunId, bookId: BOOK, phase: "compile", status: "STARTED", at: exhaustedAt },
    { schemaVersion: "1", runId: exhaustedParentRunId, bookId: BOOK, phase: "compile", status: "FAILED", at: exhaustedAt, detail: "MODEL_TASK_FAILED:single retry failed" },
  );
  const compilerCallsBeforeExhaustedResume = compilerRunIds.length;
  const exhausted = await service.run({ ...request, resumeRunId: exhaustedParentRunId });
  assert.equal(exhausted.ok, false);
  if (exhausted.ok) throw new Error("expected compiler retry exhaustion");
  assert.equal(exhausted.error.code, "BOOK_RUN_COMPILER_RETRY_EXHAUSTED");
  assert.equal(compilerRunIds.length, compilerCallsBeforeExhaustedResume, "retry exhaustion must not invoke compiler a third time");
  assert.equal(
    events.filter((event) => event.runId === exhaustedParentRunId && event.phase === "compile" && event.status === "STARTED").length,
    2,
    "retry exhaustion must stop before another compile phase starts",
  );
});

requiredTest("reconcile resume grants one operator-authorized compile attempt past an exhausted budget", async (context: TestContext) => {
  const now = () => {
    const value = context.clock.now();
    context.clock.advance(1);
    return value;
  };
  const booksRoot = resolve(context.roots.tempRoot, "op-retry-books");
  const runRoot = resolve(context.roots.tempRoot, "op-retry-runs");
  mkdirSync(booksRoot, { recursive: true });
  const writeLock = createBookWriteLock({ booksRoot });
  const currentPointer = createCurrentPointerStore({ booksRoot, writeLock });
  const candidates = createCandidateStore({ booksRoot, writeLock, currentPointerStore: currentPointer });
  const reader = createBookContentReader({ booksRoot, currentPointerStore: currentPointer });
  const runStore = createFileRunStore(runRoot);
  const stageCoordinator = createFileStageCoordinator(runRoot);
  const chapter = fixtureChapter(BOOK, 1, "book-run-op-retry");
  const seed = await stageCandidate(candidates, {
    candidateId: "op-retry-seed-candidate",
    runId: "op-retry-seed-run",
    createdAt: context.clock.now(),
    files: [jsonFile("inputs/chapter-index.json", [{ chapterId: chapter.chapterId, chapterNumber: 1, chapterTitle: chapter.title }])],
  });

  const PARENT_RUN_ID = "book-run-op-retry";
  const derive = (prefix: string) => `${prefix}-${createHash("sha256").update(PARENT_RUN_ID).digest("hex").slice(0, 32)}`;
  const baseRunId = derive("compiler-run");
  const retry1RunId = derive("compiler-retry-1-run");
  const opRetry1RunId = derive("compiler-operator-retry-1-run");
  const opRetry2RunId = derive("compiler-operator-retry-2-run");

  // Durable state: BOTH the base compile and its single deterministic retry have
  // already FAILED under a retryable deterministic gate reason — the exact
  // exhausted budget finding 12 describes.
  for (const [childRunId, reason] of [
    [baseRunId, "COMPILER_ASSEMBLY_BLOCKED:base deterministic gate failure"],
    [retry1RunId, "COMPILER_ASSEMBLY_BLOCKED:single retry failed"],
  ] as const) {
    const created = await runStore.createRun({
      schemaVersion: "1",
      bookId: BOOK,
      runId: childRunId,
      commandId: "compiler-candidate",
      sourceGitSha: SOURCE_SHA,
      requiredStages: ["compiler-candidate"],
      requiredInventory: [],
      inputCandidate: { candidateId: seed.manifest.candidateId, manifestDigest: seed.manifest.manifestDigest },
      attemptLimits: { run: 4, byStage: { "compiler-candidate": 4 } },
      createdAt: now(),
    });
    assert.ok(created.ok);
    const failed = await runStore.finishRun({ bookId: BOOK, runId: childRunId, status: "FAILED", finishedAt: now(), reason });
    assert.ok(failed.ok);
  }

  const runner: ModelTaskRunner = {
    async run(request) {
      const admittedAt = context.clock.now();
      const admitted = await runStore.admitAttempt({
        bookId: request.context.bookId,
        runId: request.context.runId,
        attemptId: request.context.attemptId,
        stageId: request.context.stageId,
        operationId: request.context.operationId,
        admittedAt,
        staleAt: new Date(Date.parse(admittedAt) + 60_000).toISOString(),
      });
      assert.equal(admitted.ok, true, JSON.stringify(admitted));
      const finished = await runStore.finishAttempt({
        bookId: request.context.bookId,
        runId: request.context.runId,
        attemptId: request.context.attemptId,
        outcome: "SUCCEEDED",
        finishedAt: context.clock.now(),
      });
      assert.equal(finished.ok, true, JSON.stringify(finished));
      return { attemptId: request.context.attemptId, outcome: "SUCCEEDED", output: { outcome: "PASS", issues: [] } };
    },
  };
  const reviews = createReviewServiceFactory({ booksRoot, contentReader: reader, now })
    .create(new ModelGatewayReviewEvaluator(runner));
  const qc = createQcService({ booksRoot, contentReader: reader, reviewService: reviews, writeLock, now });
  const promotion = createPromotionService({
    candidateStore: candidates,
    contentReader: reader,
    reviewService: reviews,
    qcService: qc,
    currentPointerStore: currentPointer,
    clock: now,
  });

  let researchPortCalls = 0;
  const research = {
    async run() {
      researchPortCalls += 1;
      throw new Error("research port must not be invoked on a durable-seed resume");
    },
  } as unknown as ResearchCandidateApplicationPort;

  const compilerRunIds: string[] = [];
  let staged: CandidateSnapshot | undefined;
  const compiler = {
    async run(request: { resumeRunId?: string }) {
      assert.ok(request.resumeRunId);
      compilerRunIds.push(request.resumeRunId);
      // The FIRST operator-authorized attempt (op-retry-1) also fails, recording a
      // durable FAILED run — the run returns to the exhausted state.
      if (request.resumeRunId === opRetry1RunId) {
        const created = await runStore.createRun({
          schemaVersion: "1",
          bookId: BOOK,
          runId: request.resumeRunId,
          commandId: "compiler-candidate",
          sourceGitSha: SOURCE_SHA,
          requiredStages: ["compiler-candidate"],
          requiredInventory: [],
          inputCandidate: { candidateId: seed.manifest.candidateId, manifestDigest: seed.manifest.manifestDigest },
          attemptLimits: { run: 4, byStage: { "compiler-candidate": 4 } },
          createdAt: context.clock.now(),
        });
        assert.ok(created.ok);
        const failed = await runStore.finishRun({
          bookId: BOOK,
          runId: request.resumeRunId,
          status: "FAILED",
          finishedAt: context.clock.now(),
          reason: "COMPILER_ASSEMBLY_BLOCKED:operator attempt one still fails",
        });
        assert.ok(failed.ok);
        throw new Error("COMPILER_ASSEMBLY_BLOCKED:operator attempt one still fails");
      }
      // The SECOND operator-authorized attempt (op-retry-2) succeeds.
      assert.equal(request.resumeRunId, opRetry2RunId);
      staged = await stageCandidate(candidates, {
        candidateId: `${request.resumeRunId}-candidate`,
        parentCandidateId: seed.manifest.candidateId,
        runId: request.resumeRunId,
        createdAt: context.clock.now(),
        files: [
          jsonFile(`content/chapters/${chapter.chapterId}.v21-native.chapter.json`, chapter, "CHAPTER"),
          jsonFile(BOOK_PATTERN_AUDIT_LOGICAL_PATH, runBookPatternAudit({
            bookId: BOOK,
            chapters: [chapter],
            requirePlanArtifacts: false,
            checkSourceAlignment: false,
          })),
        ],
      });
      return {
        runId: request.resumeRunId,
        runStatus: "COMPLETED" as const,
        candidateId: staged.manifest.candidateId,
        manifestDigest: staged.manifest.manifestDigest,
      };
    },
  } as unknown as CompilerApplicationPort;

  const candidateQc = {
    async run(request: { candidate: CandidateSnapshot; roundId: string; canonicalReview: { reviewId: string } }) {
      return {
        ok: true as const,
        value: {
          roundId: request.roundId,
          candidate: { candidateId: request.candidate.manifest.candidateId, manifestDigest: request.candidate.manifest.manifestDigest },
          reviewId: request.canonicalReview.reviewId,
          outcome: "PASS" as const,
          issues: [],
        },
      };
    },
  } as unknown as CandidateQcEvaluator;

  const events: BookRunEvent[] = [];
  const service = new BookRunApplicationService({
    research,
    compiler,
    contentReader: reader,
    candidateQc,
    reviews,
    qc,
    promotion,
    currentPointer,
    runStore,
    stageCoordinator,
    clock: { now },
    ids: {
      nextRunId: () => PARENT_RUN_ID,
      candidateId: (runId) => `${runId}-candidate`,
      modelAttemptId: (runId) => `${runId}-model`,
      reviewAttemptId: (runId) => `${runId}-review-attempt`,
      reviewId: (runId) => `${runId}-review`,
      qcRoundId: (runId) => `${runId}-qc`,
    },
    events: {
      async append(event) { events.push(event); },
      async read(bookId, runId) { return events.filter((event) => event.bookId === bookId && event.runId === runId); },
    },
    pipelineRoot: resolve(context.roots.base, "op-retry-pipeline"),
  });
  const request = {
    bookId: BOOK,
    title: "Book Run Service",
    author: "Fixture Author",
    sourceGitSha: SOURCE_SHA,
    v25Root: resolve(context.roots.tempRoot, "op-retry-v25"),
    attemptRoot: resolve(context.roots.attemptsRoot, "book-run-op-retry"),
    regen: true,
    maxRepairRounds: 1 as const,
    promoteLocal: false,
    signal: new AbortController().signal,
  };

  // Durable phase events: research+seed COMPLETED (rehydratable), then two compile
  // STARTED/FAILED pairs — the base compile and its single deterministic retry.
  const at = now();
  events.push(
    { schemaVersion: "1", runId: PARENT_RUN_ID, bookId: BOOK, phase: "intake", status: "COMPLETED", at, detail: "expectedBookRevision=0" },
    { schemaVersion: "1", runId: PARENT_RUN_ID, bookId: BOOK, phase: "research", status: "COMPLETED", at },
    { schemaVersion: "1", runId: PARENT_RUN_ID, bookId: BOOK, phase: "seed", status: "COMPLETED", at, candidate: { candidateId: seed.manifest.candidateId, manifestDigest: seed.manifest.manifestDigest } },
    { schemaVersion: "1", runId: PARENT_RUN_ID, bookId: BOOK, phase: "compile", status: "STARTED", at },
    { schemaVersion: "1", runId: PARENT_RUN_ID, bookId: BOOK, phase: "compile", status: "FAILED", at, detail: "COMPILER_ASSEMBLY_BLOCKED:base deterministic gate failure" },
    { schemaVersion: "1", runId: PARENT_RUN_ID, bookId: BOOK, phase: "compile", status: "STARTED", at },
    { schemaVersion: "1", runId: PARENT_RUN_ID, bookId: BOOK, phase: "compile", status: "FAILED", at, detail: "COMPILER_ASSEMBLY_BLOCKED:single retry failed" },
  );

  const operatorEvents = () => events.filter((event) =>
    event.runId === PARENT_RUN_ID && event.phase === "compile" && (event.detail ?? "").includes("action=OPERATOR_COMPILE_RETRY"));

  // (c) WITHOUT the flag the exhausted error is preserved verbatim — the compiler
  //     is never invoked and no operator authorization is recorded.
  const blocked = await service.run({ ...request, resumeRunId: PARENT_RUN_ID });
  assert.equal(blocked.ok, false);
  if (blocked.ok) throw new Error("expected exhausted budget without the reconcile flag");
  assert.equal(blocked.error.code, "BOOK_RUN_COMPILER_RETRY_EXHAUSTED");
  assert.equal(blocked.error.message, "single deterministic compiler retry already failed");
  assert.deepEqual(compilerRunIds, [], "exhausted budget must not invoke the compiler without operator consent");
  assert.equal(operatorEvents().length, 0);

  // (a)+(b) WITH the flag: exactly ONE fresh operator-authorized compile attempt
  //         starts a new compile control run and records a durable authorization
  //         event carrying the count of prior exhausted attempts. This first grant
  //         also fails (d): the run returns to the exhausted state.
  const firstGrant = await service.run({ ...request, resumeRunId: PARENT_RUN_ID, reconcileUnsettled: true });
  assert.equal(firstGrant.ok, false);
  if (firstGrant.ok) throw new Error("operator attempt one is wired to fail in this fixture");
  assert.equal(firstGrant.error.code, "BOOK_RUN_COMPILER_FAILED");
  assert.deepEqual(compilerRunIds, [opRetry1RunId], "the operator grant starts a NEW compile control run");
  assert.equal(operatorEvents().length, 1, "the operator authorization is durably recorded");
  assert.equal(operatorEvents()[0].status, "STARTED");
  assert.equal(operatorEvents()[0].detail, "action=OPERATOR_COMPILE_RETRY;priorExhaustedAttempts=2;operatorAttempt=1");
  assert.equal(researchPortCalls, 0, "the durable seed is rehydrated in-service; the research port is never called");

  // (c-again) WITHOUT the flag the run is exhausted again, verbatim — each grant is
  //           per-invocation consent, never a standing authorization.
  const blockedAgain = await service.run({ ...request, resumeRunId: PARENT_RUN_ID });
  assert.equal(blockedAgain.ok, false);
  if (blockedAgain.ok) throw new Error("a failed operator grant must return to the exhausted state");
  assert.equal(blockedAgain.error.code, "BOOK_RUN_COMPILER_RETRY_EXHAUSTED");
  assert.equal(blockedAgain.error.message, "single deterministic compiler retry already failed");
  assert.deepEqual(compilerRunIds, [opRetry1RunId], "no flag means no further compile attempt");
  assert.equal(operatorEvents().length, 1, "no additional authorization recorded without the flag");

  // (d) A FURTHER flagged resume grants again ONLY via the same explicit path — a
  //     distinct new control run, its own logged authorization with the growing
  //     prior-exhausted count. This second grant succeeds and drives the run READY.
  const secondGrant = await service.run({ ...request, resumeRunId: PARENT_RUN_ID, reconcileUnsettled: true });
  if (!secondGrant.ok) throw new Error(`SECOND_OPERATOR_GRANT:${JSON.stringify(secondGrant.error)}`);
  assert.equal(secondGrant.value.status, "READY");
  assert.ok(staged);
  assert.equal(secondGrant.value.candidate.candidateId, `${opRetry2RunId}-candidate`);
  assert.deepEqual(compilerRunIds, [opRetry1RunId, opRetry2RunId], "the second grant is a DISTINCT new compile control run");
  assert.equal(operatorEvents().length, 2, "each grant is one logged attempt");
  assert.equal(operatorEvents()[1].detail, "action=OPERATOR_COMPILE_RETRY;priorExhaustedAttempts=3;operatorAttempt=2");
});

requiredTest("reconcile resume un-wedges a RUNNING operator-retry compile run then grants the next slot on a further flagged resume", async (context: TestContext) => {
  // FINDING 25: an ENOSPC crash landed INSIDE an operator-retry compile grant — the
  // operator run was admitted (RUNNING) but the .writer.lock mkdir failed before its
  // section attempt could settle, leaving the run durably RUNNING with an
  // admitted-unsettled attempt. #grantOperatorCompileRetry used to fail closed on ANY
  // non-FAILED slot ("...is RUNNING, not re-grantable"), permanently wedging the
  // book-run: no flagged resume could ever settle the crashed run. The fix routes a
  // RUNNING operator slot through the same compiler resume+reconcile machinery (11c)
  // that already un-wedges a crashed BASE compiler run.
  const now = () => {
    const value = context.clock.now();
    context.clock.advance(1);
    return value;
  };
  const booksRoot = resolve(context.roots.tempRoot, "op-wedge-books");
  const runRoot = resolve(context.roots.tempRoot, "op-wedge-runs");
  mkdirSync(booksRoot, { recursive: true });
  const writeLock = createBookWriteLock({ booksRoot });
  const currentPointer = createCurrentPointerStore({ booksRoot, writeLock });
  const candidates = createCandidateStore({ booksRoot, writeLock, currentPointerStore: currentPointer });
  const reader = createBookContentReader({ booksRoot, currentPointerStore: currentPointer });
  const runStore = createFileRunStore(runRoot);
  const stageCoordinator = createFileStageCoordinator(runRoot);
  const chapter = fixtureChapter(BOOK, 1, "book-run-op-wedge");
  const seed = await stageCandidate(candidates, {
    candidateId: "op-wedge-seed-candidate",
    runId: "op-wedge-seed-run",
    createdAt: context.clock.now(),
    files: [jsonFile("inputs/chapter-index.json", [{ chapterId: chapter.chapterId, chapterNumber: 1, chapterTitle: chapter.title }])],
  });

  const PARENT_RUN_ID = "book-run-op-wedge";
  const derive = (prefix: string) => `${prefix}-${createHash("sha256").update(PARENT_RUN_ID).digest("hex").slice(0, 32)}`;
  const baseRunId = derive("compiler-run");
  const retry1RunId = derive("compiler-retry-1-run");
  const opRetry1RunId = derive("compiler-operator-retry-1-run");
  const opRetry2RunId = derive("compiler-operator-retry-2-run");
  const WEDGED_ATTEMPT_ID = "op-wedge-crashed-attempt-1";

  // base compile + its single deterministic retry BOTH FAILED under a retryable
  // deterministic gate reason — the exhausted budget that opens the operator path.
  for (const [childRunId, reason] of [
    [baseRunId, "COMPILER_ASSEMBLY_BLOCKED:base deterministic gate failure"],
    [retry1RunId, "COMPILER_ASSEMBLY_BLOCKED:single retry failed"],
  ] as const) {
    const created = await runStore.createRun({
      schemaVersion: "1",
      bookId: BOOK,
      runId: childRunId,
      commandId: "compiler-candidate",
      sourceGitSha: SOURCE_SHA,
      requiredStages: ["compiler-candidate"],
      requiredInventory: [],
      inputCandidate: { candidateId: seed.manifest.candidateId, manifestDigest: seed.manifest.manifestDigest },
      attemptLimits: { run: 4, byStage: { "compiler-candidate": 4 } },
      createdAt: now(),
    });
    assert.ok(created.ok);
    const failed = await runStore.finishRun({ bookId: BOOK, runId: childRunId, status: "FAILED", finishedAt: now(), reason });
    assert.ok(failed.ok);
  }

  // Crash simulation: the FIRST operator-retry grant was admitted (run RUNNING) but
  // crashed inside the grant before its section attempt could settle — a durably
  // RUNNING run carrying one admitted-unsettled (ACTIVE) attempt.
  {
    const created = await runStore.createRun({
      schemaVersion: "1",
      bookId: BOOK,
      runId: opRetry1RunId,
      commandId: "compiler-candidate",
      sourceGitSha: SOURCE_SHA,
      requiredStages: ["compiler-candidate"],
      requiredInventory: [],
      inputCandidate: { candidateId: seed.manifest.candidateId, manifestDigest: seed.manifest.manifestDigest },
      attemptLimits: { run: 4, byStage: { "compiler-candidate": 4 } },
      createdAt: now(),
    });
    assert.ok(created.ok);
    const admittedAt = now();
    const admitted = await runStore.admitAttempt({
      bookId: BOOK,
      runId: opRetry1RunId,
      attemptId: WEDGED_ATTEMPT_ID,
      stageId: "compiler-candidate",
      operationId: "compiler-candidate",
      admittedAt,
      staleAt: new Date(Date.parse(admittedAt) + 60_000).toISOString(),
    });
    assert.ok(admitted.ok, JSON.stringify(admitted));
  }
  {
    const wedged = await runStore.readRun(BOOK, opRetry1RunId, now());
    assert.ok(wedged.ok);
    assert.equal(wedged.value.status, "RUNNING", "precondition: the crashed operator run is durably RUNNING");
    assert.equal(
      wedged.value.attempts.filter((attempt) => attempt.status === "ACTIVE" || attempt.status === "STALE").length,
      1,
      "precondition: exactly one admitted-unsettled attempt",
    );
  }

  const runner: ModelTaskRunner = {
    async run(request) {
      const admittedAt = context.clock.now();
      const admitted = await runStore.admitAttempt({
        bookId: request.context.bookId,
        runId: request.context.runId,
        attemptId: request.context.attemptId,
        stageId: request.context.stageId,
        operationId: request.context.operationId,
        admittedAt,
        staleAt: new Date(Date.parse(admittedAt) + 60_000).toISOString(),
      });
      assert.equal(admitted.ok, true, JSON.stringify(admitted));
      const finished = await runStore.finishAttempt({
        bookId: request.context.bookId,
        runId: request.context.runId,
        attemptId: request.context.attemptId,
        outcome: "SUCCEEDED",
        finishedAt: context.clock.now(),
      });
      assert.equal(finished.ok, true, JSON.stringify(finished));
      return { attemptId: request.context.attemptId, outcome: "SUCCEEDED", output: { outcome: "PASS", issues: [] } };
    },
  };
  const reviews = createReviewServiceFactory({ booksRoot, contentReader: reader, now })
    .create(new ModelGatewayReviewEvaluator(runner));
  const qc = createQcService({ booksRoot, contentReader: reader, reviewService: reviews, writeLock, now });
  const promotion = createPromotionService({
    candidateStore: candidates,
    contentReader: reader,
    reviewService: reviews,
    qcService: qc,
    currentPointerStore: currentPointer,
    clock: now,
  });

  const research = {
    async run() {
      throw new Error("research port must not be invoked on a durable-seed resume");
    },
  } as unknown as ResearchCandidateApplicationPort;

  const compilerRunIds: string[] = [];
  let staged: CandidateSnapshot | undefined;
  const compiler = {
    async run(request: { resumeRunId?: string }) {
      assert.ok(request.resumeRunId);
      compilerRunIds.push(request.resumeRunId);
      if (request.resumeRunId === opRetry1RunId) {
        // Faithfully mirror the 11c compiler resume+reconcile machinery: settle each
        // admitted-unsettled attempt ABANDONED with the RECONCILED marker, drive the
        // crashed run to terminal FAILED, then surface the not-replayable error.
        const live = await runStore.readRun(BOOK, opRetry1RunId, context.clock.now());
        assert.ok(live.ok);
        for (const attempt of live.value.attempts.filter((a) => a.status === "ACTIVE" || a.status === "STALE")) {
          const settled = await reconcileAttempt(runStore, {
            bookId: BOOK,
            runId: opRetry1RunId,
            attemptId: attempt.admission.attemptId,
            outcome: "ABANDONED",
            finishedAt: now(),
            detail: RECONCILED_UNSETTLED_ON_RESUME,
          });
          assert.ok(settled.ok, JSON.stringify(settled));
        }
        const failed = await runStore.finishRun({
          bookId: BOOK,
          runId: opRetry1RunId,
          status: "FAILED",
          finishedAt: now(),
          reason: "COMPILER_ATTEMPT_NOT_REPLAYABLE:settled section work lacks durable candidate",
        });
        assert.ok(failed.ok);
        throw new Error("COMPILER_ATTEMPT_NOT_REPLAYABLE:settled section work lacks durable candidate");
      }
      // The NEXT operator slot (op-retry-2), granted on the further flagged resume, succeeds.
      assert.equal(request.resumeRunId, opRetry2RunId);
      staged = await stageCandidate(candidates, {
        candidateId: `${request.resumeRunId}-candidate`,
        parentCandidateId: seed.manifest.candidateId,
        runId: request.resumeRunId,
        createdAt: context.clock.now(),
        files: [
          jsonFile(`content/chapters/${chapter.chapterId}.v21-native.chapter.json`, chapter, "CHAPTER"),
          jsonFile(BOOK_PATTERN_AUDIT_LOGICAL_PATH, runBookPatternAudit({
            bookId: BOOK,
            chapters: [chapter],
            requirePlanArtifacts: false,
            checkSourceAlignment: false,
          })),
        ],
      });
      return {
        runId: request.resumeRunId,
        runStatus: "COMPLETED" as const,
        candidateId: staged.manifest.candidateId,
        manifestDigest: staged.manifest.manifestDigest,
      };
    },
  } as unknown as CompilerApplicationPort;

  const candidateQc = {
    async run(request: { candidate: CandidateSnapshot; roundId: string; canonicalReview: { reviewId: string } }) {
      return {
        ok: true as const,
        value: {
          roundId: request.roundId,
          candidate: { candidateId: request.candidate.manifest.candidateId, manifestDigest: request.candidate.manifest.manifestDigest },
          reviewId: request.canonicalReview.reviewId,
          outcome: "PASS" as const,
          issues: [],
        },
      };
    },
  } as unknown as CandidateQcEvaluator;

  const events: BookRunEvent[] = [];
  const service = new BookRunApplicationService({
    research,
    compiler,
    contentReader: reader,
    candidateQc,
    reviews,
    qc,
    promotion,
    currentPointer,
    runStore,
    stageCoordinator,
    clock: { now },
    ids: {
      nextRunId: () => PARENT_RUN_ID,
      candidateId: (runId) => `${runId}-candidate`,
      modelAttemptId: (runId) => `${runId}-model`,
      reviewAttemptId: (runId) => `${runId}-review-attempt`,
      reviewId: (runId) => `${runId}-review`,
      qcRoundId: (runId) => `${runId}-qc`,
    },
    events: {
      async append(event) { events.push(event); },
      async read(bookId, runId) { return events.filter((event) => event.bookId === bookId && event.runId === runId); },
    },
    pipelineRoot: resolve(context.roots.base, "op-wedge-pipeline"),
  });
  const request = {
    bookId: BOOK,
    title: "Book Run Service",
    author: "Fixture Author",
    sourceGitSha: SOURCE_SHA,
    v25Root: resolve(context.roots.tempRoot, "op-wedge-v25"),
    attemptRoot: resolve(context.roots.attemptsRoot, "book-run-op-wedge"),
    regen: true,
    maxRepairRounds: 1 as const,
    promoteLocal: false,
    signal: new AbortController().signal,
  };

  const at = now();
  events.push(
    { schemaVersion: "1", runId: PARENT_RUN_ID, bookId: BOOK, phase: "intake", status: "COMPLETED", at, detail: "expectedBookRevision=0" },
    { schemaVersion: "1", runId: PARENT_RUN_ID, bookId: BOOK, phase: "research", status: "COMPLETED", at },
    { schemaVersion: "1", runId: PARENT_RUN_ID, bookId: BOOK, phase: "seed", status: "COMPLETED", at, candidate: { candidateId: seed.manifest.candidateId, manifestDigest: seed.manifest.manifestDigest } },
    { schemaVersion: "1", runId: PARENT_RUN_ID, bookId: BOOK, phase: "compile", status: "STARTED", at },
    { schemaVersion: "1", runId: PARENT_RUN_ID, bookId: BOOK, phase: "compile", status: "FAILED", at, detail: "COMPILER_ASSEMBLY_BLOCKED:base deterministic gate failure" },
    { schemaVersion: "1", runId: PARENT_RUN_ID, bookId: BOOK, phase: "compile", status: "STARTED", at },
    { schemaVersion: "1", runId: PARENT_RUN_ID, bookId: BOOK, phase: "compile", status: "FAILED", at, detail: "COMPILER_ASSEMBLY_BLOCKED:single retry failed" },
  );

  const reconcileWedgeEvents = () => events.filter((event) =>
    event.runId === PARENT_RUN_ID && event.phase === "compile" && (event.detail ?? "").includes("action=OPERATOR_COMPILE_RECONCILE_WEDGED"));
  const operatorGrantEvents = () => events.filter((event) =>
    event.runId === PARENT_RUN_ID && event.phase === "compile" && (event.detail ?? "").includes("action=OPERATOR_COMPILE_RETRY"));

  // WITHOUT the flag the resume stays fail-closed exactly as before: the exhausted
  // budget error is returned verbatim, the crashed RUNNING run is never inspected, and
  // the compiler is never invoked. (The pre-fix FLAGGED resume failed here instead with
  // BOOK_RUN_COMPILER_RETRY_BLOCKED "...is RUNNING, not re-grantable" — the wedge.)
  const blocked = await service.run({ ...request, resumeRunId: PARENT_RUN_ID });
  assert.equal(blocked.ok, false);
  if (blocked.ok) throw new Error("expected fail-closed without the reconcile flag");
  assert.equal(blocked.error.code, "BOOK_RUN_COMPILER_RETRY_EXHAUSTED");
  assert.equal(blocked.error.message, "single deterministic compiler retry already failed");
  assert.deepEqual(compilerRunIds, [], "no-flag resume must not invoke the compiler");
  {
    const untouched = await runStore.readRun(BOOK, opRetry1RunId, now());
    assert.ok(untouched.ok);
    assert.equal(untouched.value.status, "RUNNING", "no-flag resume must leave the wedged run untouched");
  }

  // (a) WITH the flag: the crashed RUNNING operator run is routed through the compiler
  //     resume+reconcile machinery — its unsettled attempt settled ABANDONED with the
  //     RECONCILED marker, the run driven to terminal FAILED. Per-invocation consent is
  //     spent un-wedging; this invocation itself fails closed and grants NO fresh slot.
  const unwedge = await service.run({ ...request, resumeRunId: PARENT_RUN_ID, reconcileUnsettled: true });
  assert.equal(unwedge.ok, false);
  if (unwedge.ok) throw new Error("the un-wedge invocation drives the crashed run FAILED and fails closed");
  assert.equal(unwedge.error.code, "BOOK_RUN_COMPILER_FAILED");
  assert.deepEqual(compilerRunIds, [opRetry1RunId], "the wedged run is resumed through the compiler machinery, not a fresh slot");
  {
    const settledRun = await runStore.readRun(BOOK, opRetry1RunId, now());
    assert.ok(settledRun.ok);
    assert.equal(settledRun.value.status, "FAILED", "the wedged run is driven to terminal FAILED");
    const attempt = settledRun.value.attempts.find((a) => a.admission.attemptId === WEDGED_ATTEMPT_ID);
    assert.ok(attempt, "the crashed attempt is present");
    assert.equal(attempt.status, "ABANDONED", "the crashed attempt is settled ABANDONED by the reconcile");
    assert.equal(attempt.outcome, "ABANDONED");
  }
  assert.equal(reconcileWedgeEvents().length, 1, "every reconcile action is durably event-logged");
  assert.equal(reconcileWedgeEvents()[0].status, "STARTED");
  assert.equal(reconcileWedgeEvents()[0].detail, "action=OPERATOR_COMPILE_RECONCILE_WEDGED;operatorAttempt=1");
  assert.equal(operatorGrantEvents().length, 0, "un-wedging does NOT grant a fresh operator slot in the same invocation");

  // WITHOUT the flag after the un-wedge the run is exhausted verbatim again — consent
  // is never a standing authorization.
  const blockedAgain = await service.run({ ...request, resumeRunId: PARENT_RUN_ID });
  assert.equal(blockedAgain.ok, false);
  if (blockedAgain.ok) throw new Error("still exhausted without the flag");
  assert.equal(blockedAgain.error.code, "BOOK_RUN_COMPILER_RETRY_EXHAUSTED");
  assert.deepEqual(compilerRunIds, [opRetry1RunId], "no further compile attempt without the flag");

  // (b) A FURTHER flagged resume grants the NEXT operator slot (op-retry-2): the wedged
  //     op-retry-1 is now terminal FAILED so the grant loop steps past it to a distinct
  //     new control run, whose fresh compile drives the book-run READY.
  const grant = await service.run({ ...request, resumeRunId: PARENT_RUN_ID, reconcileUnsettled: true });
  if (!grant.ok) throw new Error(`NEXT_SLOT_GRANT:${JSON.stringify(grant.error)}`);
  assert.equal(grant.value.status, "READY");
  assert.ok(staged);
  assert.equal(grant.value.candidate.candidateId, `${opRetry2RunId}-candidate`);
  assert.deepEqual(compilerRunIds, [opRetry1RunId, opRetry2RunId], "the next slot is a DISTINCT new compile control run");
  assert.equal(operatorGrantEvents().length, 1, "exactly one fresh operator slot granted, on its own flagged invocation");
  assert.equal(operatorGrantEvents()[0].detail, "action=OPERATOR_COMPILE_RETRY;priorExhaustedAttempts=3;operatorAttempt=2");
  assert.equal(reconcileWedgeEvents().length, 1, "no additional un-wedge occurs on the grant invocation");
});

requiredTest("resume after a crash inside fresh-qc reuses the durable judge run identity and completes", async (context: TestContext) => {
  const JUDGE_RUN_ID = `qc-judge-run-${createHash("sha256").update(BOOK_RUN_ID).digest("hex").slice(0, 32)}`;
  const now = () => {
    const value = context.clock.now();
    context.clock.advance(1);
    return value;
  };
  const booksRoot = resolve(context.roots.tempRoot, "books");
  const runRoot = resolve(context.roots.tempRoot, "runs");
  mkdirSync(booksRoot, { recursive: true });
  const writeLock = createBookWriteLock({ booksRoot });
  const currentPointer = createCurrentPointerStore({ booksRoot, writeLock });
  const candidates = createCandidateStore({ booksRoot, writeLock, currentPointerStore: currentPointer });
  const reader = createBookContentReader({ booksRoot, currentPointerStore: currentPointer });
  const runStore = createFileRunStore(runRoot);
  const stageCoordinator = createFileStageCoordinator(runRoot);
  const chapter = fixtureChapter(BOOK, 1, "book-run-service");
  const seed = await stageCandidate(candidates, {
    candidateId: "seed-candidate",
    runId: "seed-run",
    createdAt: context.clock.now(),
    files: [jsonFile("inputs/chapter-index.json", [{ chapterId: chapter.chapterId, chapterNumber: 1, chapterTitle: chapter.title }])],
  });
  const compiled = await stageCandidate(candidates, {
    candidateId: COMPILED_CANDIDATE_ID,
    parentCandidateId: seed.manifest.candidateId,
    runId: COMPILER_RUN_ID,
    createdAt: context.clock.now(),
    files: [
      jsonFile(`content/chapters/${chapter.chapterId}.v21-native.chapter.json`, chapter, "CHAPTER"),
      jsonFile(BOOK_PATTERN_AUDIT_LOGICAL_PATH, runBookPatternAudit({
        bookId: BOOK,
        chapters: [chapter],
        requirePlanArtifacts: false,
        checkSourceAlignment: false,
      })),
    ],
  });

  const runner: ModelTaskRunner = {
    async run(request) {
      const admittedAt = context.clock.now();
      const admitted = await runStore.admitAttempt({
        bookId: request.context.bookId,
        runId: request.context.runId,
        attemptId: request.context.attemptId,
        stageId: request.context.stageId,
        operationId: request.context.operationId,
        admittedAt,
        staleAt: new Date(Date.parse(admittedAt) + 60_000).toISOString(),
      });
      assert.equal(admitted.ok, true, JSON.stringify(admitted));
      const finished = await runStore.finishAttempt({
        bookId: request.context.bookId,
        runId: request.context.runId,
        attemptId: request.context.attemptId,
        outcome: "SUCCEEDED",
        finishedAt: context.clock.now(),
      });
      assert.equal(finished.ok, true, JSON.stringify(finished));
      return { attemptId: request.context.attemptId, outcome: "SUCCEEDED", output: { outcome: "PASS", issues: [] } };
    },
  };
  const reviews = createReviewServiceFactory({ booksRoot, contentReader: reader, now })
    .create(new ModelGatewayReviewEvaluator(runner));
  const qc = createQcService({ booksRoot, contentReader: reader, reviewService: reviews, writeLock, now });
  const promotion = createPromotionService({
    candidateStore: candidates,
    contentReader: reader,
    reviewService: reviews,
    qcService: qc,
    currentPointerStore: currentPointer,
    clock: now,
  });
  const research = {
    async run(request: { resumeRunId?: string; newRunId?: string }) {
      return {
        schemaVersion: "1" as const,
        bookId: BOOK,
        title: "Book Run Service",
        author: "Fixture Author",
        intakeRunId: request.resumeRunId ?? request.newRunId ?? BOOK_RUN_ID,
        researchRunId: "research-fixture",
        candidate: { candidateId: seed.manifest.candidateId, manifestDigest: seed.manifest.manifestDigest },
        indexLogicalPath: "inputs/chapter-index.json" as const,
        sectionTaskContextLogicalPath: "inputs/compiler-section-task-context.json" as const,
        sources: [],
        resumed: request.resumeRunId !== undefined,
      };
    },
  } as unknown as ResearchCandidateApplicationPort;
  let compilerRunPersisted = false;
  const compiler = {
    async run() {
      if (!compilerRunPersisted) {
        const created = await runStore.createRun({
          schemaVersion: "1",
          bookId: BOOK,
          runId: COMPILER_RUN_ID,
          commandId: "compiler-candidate",
          sourceGitSha: SOURCE_SHA,
          requiredStages: ["compiler-candidate"],
          requiredInventory: [],
          inputCandidate: { candidateId: seed.manifest.candidateId, manifestDigest: seed.manifest.manifestDigest },
          attemptLimits: { run: 4, byStage: { "compiler-candidate": 4 } },
          createdAt: context.clock.now(),
        });
        assert.ok(created.ok);
        const finished = await runStore.finishRun({ bookId: BOOK, runId: COMPILER_RUN_ID, status: "COMPLETED", finishedAt: context.clock.now() });
        assert.ok(finished.ok);
        compilerRunPersisted = true;
      }
      return {
        runId: COMPILER_RUN_ID,
        runStatus: "COMPLETED" as const,
        candidateId: compiled.manifest.candidateId,
        manifestDigest: compiled.manifest.manifestDigest,
      };
    },
  } as unknown as CompilerApplicationPort;
  // The fresh-qc judge run is created BEFORE this evaluator is invoked; throwing
  // here simulates a crash mid-judge (multi-minute per-question window), leaving
  // the judge run persisted as RUNNING with no committed QC round.
  let candidateQcCalls = 0;
  const candidateQc = {
    async run(request: { roundId: string; canonicalReview: { reviewId: string } }) {
      candidateQcCalls += 1;
      if (candidateQcCalls === 1) throw new Error("SIMULATED_CRASH_INSIDE_FRESH_QC");
      return {
        ok: true as const,
        value: {
          roundId: request.roundId,
          candidate: { candidateId: compiled.manifest.candidateId, manifestDigest: compiled.manifest.manifestDigest },
          reviewId: request.canonicalReview.reviewId,
          outcome: "PASS" as const,
          issues: [],
        },
      };
    },
  } as unknown as CandidateQcEvaluator;
  const events: BookRunEvent[] = [];
  const service = new BookRunApplicationService({
    research,
    compiler,
    contentReader: reader,
    candidateQc,
    reviews,
    qc,
    promotion,
    currentPointer,
    runStore,
    stageCoordinator,
    clock: { now },
    ids: {
      nextRunId: () => BOOK_RUN_ID,
      candidateId: (runId) => `${runId}-candidate`,
      modelAttemptId: (runId) => `${runId}-model`,
      reviewAttemptId: (runId) => `${runId}-review-attempt`,
      reviewId: (runId) => `${runId}-review`,
      qcRoundId: (runId) => `${runId}-qc`,
    },
    events: {
      async append(event) { events.push(event); },
      async read(bookId, runId) { return events.filter((event) => event.bookId === bookId && event.runId === runId); },
    },
    pipelineRoot: resolve(context.roots.base, "pipeline"),
  });
  const request = {
    bookId: BOOK,
    title: "Book Run Service",
    author: "Fixture Author",
    sourceGitSha: SOURCE_SHA,
    v25Root: resolve(context.roots.tempRoot, "v25"),
    attemptRoot: resolve(context.roots.attemptsRoot, "book-run"),
    regen: true,
    maxRepairRounds: 1 as const,
    promoteLocal: true,
    signal: new AbortController().signal,
  };

  // First run crashes inside the fresh-qc judge window.
  await assert.rejects(() => service.run(request), /SIMULATED_CRASH_INSIDE_FRESH_QC/);
  const crashedJudge = await runStore.readRun(BOOK, JUDGE_RUN_ID, context.clock.now());
  assert.ok(crashedJudge.ok, "judge run must be persisted after the crash");
  assert.equal(crashedJudge.value.status, "RUNNING", "crash mid-judge leaves the run RUNNING");
  const crashedCreatedAt = crashedJudge.value.definition.createdAt;
  assert.equal(events.some((event) => event.phase === "fresh-qc" && event.status === "STARTED"), true);
  assert.equal(events.some((event) => event.phase === "fresh-qc" && event.status === "COMPLETED"), false);

  // Resume must reuse the durable judge run identity (same createdAt) rather than
  // minting a fresh createdAt that conflicts, and drive fresh-qc to completion.
  const resumed = await service.run({ ...request, resumeRunId: BOOK_RUN_ID });
  if (!resumed.ok) throw new Error(`BOOK_RUN_FRESH_QC_RESUME:${JSON.stringify(resumed.error)}`);
  assert.equal(resumed.value.status, "PROMOTED");
  assert.equal(resumed.value.readback, "VERIFIED");
  const resumedJudge = await runStore.readRun(BOOK, JUDGE_RUN_ID, context.clock.now());
  assert.ok(resumedJudge.ok);
  assert.equal(resumedJudge.value.definition.createdAt, crashedCreatedAt, "resume must reuse the prior judge run createdAt");
  assert.equal(resumedJudge.value.status, "COMPLETED", "resume finishes the judge run");
  assert.equal(events.filter((event) => event.phase === "fresh-qc" && event.status === "COMPLETED").length, 1);
  const resumedPointer = await currentPointer.read(BOOK);
  assert.ok(resumedPointer.ok && resumedPointer.value);
});

interface SuccessorResumeResult {
  readonly intakeRunId: string;
  readonly recoveredFromRunId?: string;
  readonly bookId?: string;
  readonly resumed?: boolean;
  /** Override the seed identity the successor intake reports. Defaults to the
   *  pre-staged seed candidate; a test models the real port minting a SECOND
   *  successor with a DIVERGENT candidate id by returning a different identity. */
  readonly candidate?: { readonly candidateId: string; readonly manifestDigest: string };
}

/**
 * Build a fully-wired book-run service whose research port models the finding-8
 * successor-recovery seam: the FIRST (fresh) research call fails mid-run — the
 * exact terminal-FAILED-during-research predecessor shape — and every resume
 * returns artifacts bound to a SUCCESSOR control-run id (not the resumed run),
 * as the real ResearchCandidateApplicationPort does when it opens a successor to
 * reuse durable chapters. The resume result is reconfigurable per call via
 * `control.onResume` so a test can present a genuine successor or a forged one.
 */
async function successorRecoveryHarness(
  context: TestContext,
  slug: string,
): Promise<{
  service: BookRunApplicationService;
  request: Parameters<BookRunApplicationService["run"]>[0];
  runStore: ReturnType<typeof createFileRunStore>;
  currentPointer: ReturnType<typeof createCurrentPointerStore>;
  seedCandidate: { candidateId: string; manifestDigest: string };
  control: { onResume: (resumeRunId: string) => SuccessorResumeResult };
  events: BookRunEvent[];
}> {
  const now = () => {
    const value = context.clock.now();
    context.clock.advance(1);
    return value;
  };
  const booksRoot = resolve(context.roots.tempRoot, `${slug}-books`);
  const runRoot = resolve(context.roots.tempRoot, `${slug}-runs`);
  mkdirSync(booksRoot, { recursive: true });
  const writeLock = createBookWriteLock({ booksRoot });
  const currentPointer = createCurrentPointerStore({ booksRoot, writeLock });
  const candidates = createCandidateStore({ booksRoot, writeLock, currentPointerStore: currentPointer });
  const reader = createBookContentReader({ booksRoot, currentPointerStore: currentPointer });
  const runStore = createFileRunStore(runRoot);
  const stageCoordinator = createFileStageCoordinator(runRoot);
  const chapter = fixtureChapter(BOOK, 1, "book-run-service");
  const seed = await stageCandidate(candidates, {
    candidateId: "seed-candidate",
    runId: "seed-run",
    createdAt: context.clock.now(),
    files: [jsonFile("inputs/chapter-index.json", [{ chapterId: chapter.chapterId, chapterNumber: 1, chapterTitle: chapter.title }])],
  });
  const compiled = await stageCandidate(candidates, {
    candidateId: COMPILED_CANDIDATE_ID,
    parentCandidateId: seed.manifest.candidateId,
    runId: COMPILER_RUN_ID,
    createdAt: context.clock.now(),
    files: [
      jsonFile(`content/chapters/${chapter.chapterId}.v21-native.chapter.json`, chapter, "CHAPTER"),
      jsonFile(BOOK_PATTERN_AUDIT_LOGICAL_PATH, runBookPatternAudit({
        bookId: BOOK,
        chapters: [chapter],
        requirePlanArtifacts: false,
        checkSourceAlignment: false,
      })),
    ],
  });
  const runner: ModelTaskRunner = {
    async run(request) {
      const admittedAt = context.clock.now();
      const admitted = await runStore.admitAttempt({
        bookId: request.context.bookId,
        runId: request.context.runId,
        attemptId: request.context.attemptId,
        stageId: request.context.stageId,
        operationId: request.context.operationId,
        admittedAt,
        staleAt: new Date(Date.parse(admittedAt) + 60_000).toISOString(),
      });
      assert.equal(admitted.ok, true, JSON.stringify(admitted));
      const finished = await runStore.finishAttempt({
        bookId: request.context.bookId,
        runId: request.context.runId,
        attemptId: request.context.attemptId,
        outcome: "SUCCEEDED",
        finishedAt: context.clock.now(),
      });
      assert.equal(finished.ok, true, JSON.stringify(finished));
      return { attemptId: request.context.attemptId, outcome: "SUCCEEDED", output: { outcome: "PASS", issues: [] } };
    },
  };
  const reviews = createReviewServiceFactory({ booksRoot, contentReader: reader, now })
    .create(new ModelGatewayReviewEvaluator(runner));
  const qc = createQcService({ booksRoot, contentReader: reader, reviewService: reviews, writeLock, now });
  const promotion = createPromotionService({
    candidateStore: candidates,
    contentReader: reader,
    reviewService: reviews,
    qcService: qc,
    currentPointerStore: currentPointer,
    clock: now,
  });
  const control: { onResume: (resumeRunId: string) => SuccessorResumeResult } = {
    onResume: (resumeRunId) => ({ intakeRunId: resumeRunId, recoveredFromRunId: resumeRunId }),
  };
  const research = {
    async run(request: { resumeRunId?: string; newRunId?: string }) {
      if (request.resumeRunId === undefined) {
        // Fresh run fails mid-research: intake COMPLETED, research STARTED then
        // FAILED, no seed — the finding-8 predecessor terminal-FAILED shape.
        throw new Error("RESEARCH_CH07_FAILED:simulated research failure");
      }
      const resolved = control.onResume(request.resumeRunId);
      return {
        schemaVersion: "1" as const,
        bookId: resolved.bookId ?? BOOK,
        title: "Book Run Service",
        author: "Fixture Author",
        intakeRunId: resolved.intakeRunId,
        researchRunId: "research-successor-fixture",
        ...(resolved.recoveredFromRunId === undefined ? {} : { recoveredFromRunId: resolved.recoveredFromRunId }),
        candidate: resolved.candidate ?? { candidateId: seed.manifest.candidateId, manifestDigest: seed.manifest.manifestDigest },
        indexLogicalPath: "inputs/chapter-index.json" as const,
        sectionTaskContextLogicalPath: "inputs/compiler-section-task-context.json" as const,
        sources: [],
        resumed: resolved.resumed ?? true,
      };
    },
  } as unknown as ResearchCandidateApplicationPort;
  let compilerRunPersisted = false;
  const compiler = {
    async run() {
      if (!compilerRunPersisted) {
        const created = await runStore.createRun({
          schemaVersion: "1",
          bookId: BOOK,
          runId: COMPILER_RUN_ID,
          commandId: "compiler-candidate",
          sourceGitSha: SOURCE_SHA,
          requiredStages: ["compiler-candidate"],
          requiredInventory: [],
          inputCandidate: { candidateId: seed.manifest.candidateId, manifestDigest: seed.manifest.manifestDigest },
          attemptLimits: { run: 4, byStage: { "compiler-candidate": 4 } },
          createdAt: context.clock.now(),
        });
        assert.ok(created.ok);
        const finished = await runStore.finishRun({ bookId: BOOK, runId: COMPILER_RUN_ID, status: "COMPLETED", finishedAt: context.clock.now() });
        assert.ok(finished.ok);
        compilerRunPersisted = true;
      }
      return {
        runId: COMPILER_RUN_ID,
        runStatus: "COMPLETED" as const,
        candidateId: compiled.manifest.candidateId,
        manifestDigest: compiled.manifest.manifestDigest,
      };
    },
  } as unknown as CompilerApplicationPort;
  const candidateQc = {
    async run(request: { roundId: string; canonicalReview: { reviewId: string } }) {
      return {
        ok: true as const,
        value: {
          roundId: request.roundId,
          candidate: { candidateId: compiled.manifest.candidateId, manifestDigest: compiled.manifest.manifestDigest },
          reviewId: request.canonicalReview.reviewId,
          outcome: "PASS" as const,
          issues: [],
        },
      };
    },
  } as unknown as CandidateQcEvaluator;
  const events: BookRunEvent[] = [];
  const service = new BookRunApplicationService({
    research,
    compiler,
    contentReader: reader,
    candidateQc,
    reviews,
    qc,
    promotion,
    currentPointer,
    runStore,
    stageCoordinator,
    clock: { now },
    ids: {
      nextRunId: () => BOOK_RUN_ID,
      candidateId: (runId) => `${runId}-candidate`,
      modelAttemptId: (runId) => `${runId}-model`,
      reviewAttemptId: (runId) => `${runId}-review-attempt`,
      reviewId: (runId) => `${runId}-review`,
      qcRoundId: (runId) => `${runId}-qc`,
    },
    events: {
      async append(event) { events.push(event); },
      async read(bookId, runId) { return events.filter((event) => event.bookId === bookId && event.runId === runId); },
    },
    pipelineRoot: resolve(context.roots.base, "pipeline"),
  });
  const request = {
    bookId: BOOK,
    title: "Book Run Service",
    author: "Fixture Author",
    sourceGitSha: SOURCE_SHA,
    v25Root: resolve(context.roots.tempRoot, `${slug}-v25`),
    attemptRoot: resolve(context.roots.attemptsRoot, `${slug}-book-run`),
    regen: true,
    maxRepairRounds: 1 as const,
    promoteLocal: false,
    signal: new AbortController().signal,
  };
  return {
    service,
    request,
    runStore,
    currentPointer,
    seedCandidate: { candidateId: seed.manifest.candidateId, manifestDigest: seed.manifest.manifestDigest },
    control,
    events,
  };
}

/** Persist a COMPLETED research successor run in the given book's durable
 *  run-state — what the real port writes when it mints and finishes a successor. */
async function persistSuccessorRun(
  context: TestContext,
  runStore: ReturnType<typeof createFileRunStore>,
  args: { bookId: string; runId: string; inputCandidate: { candidateId: string; manifestDigest: string } },
): Promise<void> {
  const created = await runStore.createRun({
    schemaVersion: "1",
    bookId: args.bookId,
    runId: args.runId,
    commandId: "research-candidate-v1-successor",
    sourceGitSha: SOURCE_SHA,
    requiredStages: ["research", "seed-candidate"],
    requiredInventory: [],
    inputCandidate: args.inputCandidate,
    attemptLimits: { run: 4096, byStage: { research: 4096, "seed-candidate": 0 } },
    createdAt: context.clock.now(),
  });
  assert.ok(created.ok, JSON.stringify(created));
  const finished = await runStore.finishRun({ bookId: args.bookId, runId: args.runId, status: "COMPLETED", finishedAt: context.clock.now() });
  assert.ok(finished.ok, JSON.stringify(finished));
}

requiredTest("resume intake accepts a successor-recovery run whose durable provenance chains to the resumed run", async (context: TestContext) => {
  const SUCCESSOR_RUN_ID = "book-run-research-successor";
  const harness = await successorRecoveryHarness(context, "successor-accept");

  // First run fails during research (finding-8 predecessor shape).
  const first = await harness.service.run(harness.request);
  assert.equal(first.ok, false);
  if (first.ok) throw new Error("expected fresh research to fail");
  assert.equal(first.error.code, "BOOK_RUN_RESEARCH_FAILED");
  assert.equal(
    harness.events.some((event) => event.phase === "research" && event.status === "FAILED"),
    true,
    "predecessor must record a durable research FAILED event",
  );

  // The successor control run genuinely exists, COMPLETED, in THIS book's run-state.
  await persistSuccessorRun(context, harness.runStore, {
    bookId: BOOK,
    runId: SUCCESSOR_RUN_ID,
    inputCandidate: harness.seedCandidate,
  });
  harness.control.onResume = (resumeRunId) => ({ intakeRunId: SUCCESSOR_RUN_ID, recoveredFromRunId: resumeRunId });

  const resumed = await harness.service.run({ ...harness.request, resumeRunId: BOOK_RUN_ID, reconcileUnsettled: true });
  if (!resumed.ok) throw new Error(`BOOK_RUN_SUCCESSOR_RESUME:${JSON.stringify(resumed.error)}`);
  assert.equal(resumed.value.status, "READY");
  // The book-run reached the compiled candidate: the successor research artifacts
  // were intaken and the run continued through compile/review/qc.
  assert.equal(resumed.value.candidate.candidateId, COMPILED_CANDIDATE_ID);

  // The book-run continued under the resumed (predecessor) run id: research and
  // seed COMPLETED events are recorded against BOOK_RUN_ID, not the successor.
  assert.equal(
    harness.events.filter((event) => event.runId === BOOK_RUN_ID && event.phase === "research" && event.status === "COMPLETED").length,
    1,
  );
  assert.equal(
    harness.events.filter((event) => event.runId === BOOK_RUN_ID && event.phase === "seed" && event.status === "COMPLETED").length,
    1,
  );
});

requiredTest("resume intake rejects a foreign or forged successor with the exact MISMATCH error", async (context: TestContext) => {
  const harness = await successorRecoveryHarness(context, "successor-reject");

  const first = await harness.service.run(harness.request);
  assert.equal(first.ok, false);

  // (a) A successor id with NO run-state record in this book — a foreign research
  //     run — is rejected even though the returned provenance claims the chain.
  harness.control.onResume = (resumeRunId) => ({ intakeRunId: "book-run-foreign-no-state", recoveredFromRunId: resumeRunId });
  const foreign = await harness.service.run({ ...harness.request, resumeRunId: BOOK_RUN_ID, reconcileUnsettled: true });
  assert.equal(foreign.ok, false);
  if (foreign.ok) throw new Error("foreign successor must be rejected");
  assert.equal(foreign.error.code, "BOOK_RUN_RESEARCH_MISMATCH");
  assert.equal(foreign.error.message, "research intake does not bind exact production run and book");

  // (b) A successor that DOES have a COMPLETED run-state record but whose returned
  //     provenance names a predecessor OTHER than the resumed run is rejected: the
  //     chain must bind the exact run we asked to resume, not any claim.
  await persistSuccessorRun(context, harness.runStore, {
    bookId: BOOK,
    runId: "book-run-real-but-wrong-chain",
    inputCandidate: harness.seedCandidate,
  });
  harness.control.onResume = () => ({ intakeRunId: "book-run-real-but-wrong-chain", recoveredFromRunId: "book-run-some-other-run" });
  const forgedChain = await harness.service.run({ ...harness.request, resumeRunId: BOOK_RUN_ID, reconcileUnsettled: true });
  assert.equal(forgedChain.ok, false);
  if (forgedChain.ok) throw new Error("forged provenance chain must be rejected");
  assert.equal(forgedChain.error.code, "BOOK_RUN_RESEARCH_MISMATCH");

  // (c) A successor whose run-state lives under a DIFFERENT book is rejected: the
  //     durable record, not the returned bookId claim, is the source of truth.
  await persistSuccessorRun(context, harness.runStore, {
    bookId: "other-book",
    runId: "book-run-other-book-successor",
    inputCandidate: harness.seedCandidate,
  });
  harness.control.onResume = (resumeRunId) => ({ intakeRunId: "book-run-other-book-successor", recoveredFromRunId: resumeRunId });
  const foreignBook = await harness.service.run({ ...harness.request, resumeRunId: BOOK_RUN_ID, reconcileUnsettled: true });
  assert.equal(foreignBook.ok, false);
  if (foreignBook.ok) throw new Error("cross-book successor must be rejected");
  assert.equal(foreignBook.error.code, "BOOK_RUN_RESEARCH_MISMATCH");
});

requiredTest("resume after a successful recovery rehydrates the durable seed and does not mint a second successor", async (context: TestContext) => {
  const S1_RUN_ID = "book-run-research-successor-1";
  const harness = await successorRecoveryHarness(context, "post-recovery-rehydrate");

  // Fresh run fails during research (the finding-8 predecessor terminal-FAILED shape).
  const first = await harness.service.run(harness.request);
  assert.equal(first.ok, false);
  if (first.ok) throw new Error("expected fresh research to fail");

  // First recovery: a genuine successor S1 completes research+seed under the
  // resumed run, and the harness drives compile/review/qc to READY. Durable
  // research+seed COMPLETED events are now recorded under BOOK_RUN_ID bound to
  // S1's candidate identity — exactly the canary state finding 10 left behind.
  await persistSuccessorRun(context, harness.runStore, {
    bookId: BOOK,
    runId: S1_RUN_ID,
    inputCandidate: harness.seedCandidate,
  });
  let resumeResearchCalls = 0;
  harness.control.onResume = (resumeRunId) => {
    resumeResearchCalls += 1;
    return { intakeRunId: S1_RUN_ID, recoveredFromRunId: resumeRunId };
  };
  const recovery = await harness.service.run({ ...harness.request, resumeRunId: BOOK_RUN_ID, reconcileUnsettled: true });
  if (!recovery.ok) throw new Error(`FIRST_RECOVERY:${JSON.stringify(recovery.error)}`);
  assert.equal(recovery.value.status, "READY");
  assert.equal(resumeResearchCalls, 1, "the first recovery invokes the research port exactly once");
  assert.equal(
    harness.events.filter((event) => event.runId === BOOK_RUN_ID && event.phase === "research" && event.status === "COMPLETED").length,
    1,
  );
  assert.equal(
    harness.events.filter((event) => event.runId === BOOK_RUN_ID && event.phase === "seed" && event.status === "COMPLETED").length,
    1,
  );

  // The NEXT resume would, in the real port, re-read the still-terminal-FAILED
  // predecessor run and mint a SECOND successor whose candidate id DIVERGES from
  // S1's (the durable seed identity). Model that divergence: were the service to
  // re-invoke the port, it would receive a different identity — the verbatim live
  // BOOK_RUN_RESEARCH_MISMATCH. The fix must not call the port at all; it must
  // rehydrate the durable seed candidate instead.
  harness.control.onResume = () => {
    resumeResearchCalls += 1;
    return {
      intakeRunId: "book-run-research-successor-2",
      recoveredFromRunId: BOOK_RUN_ID,
      candidate: { candidateId: "research-seed-successor-2-divergent", manifestDigest: "d".repeat(64) },
    };
  };
  const callsBefore = resumeResearchCalls;

  const second = await harness.service.run({ ...harness.request, resumeRunId: BOOK_RUN_ID, reconcileUnsettled: true });
  if (!second.ok) throw new Error(`SECOND_RESUME:${JSON.stringify(second.error)}`);
  assert.equal(second.value.status, "READY");
  // Rehydrated from the durable seed record: the run reached the compiled candidate.
  assert.equal(second.value.candidate.candidateId, COMPILED_CANDIDATE_ID);
  // ZERO research port calls on the second resume — no second successor minted.
  assert.equal(resumeResearchCalls, callsBefore, "post-recovery resume must NOT re-invoke the research port");
  // Still exactly one durable research/seed COMPLETED under BOOK_RUN_ID.
  assert.equal(
    harness.events.filter((event) => event.runId === BOOK_RUN_ID && event.phase === "research" && event.status === "COMPLETED").length,
    1,
  );
  assert.equal(
    harness.events.filter((event) => event.runId === BOOK_RUN_ID && event.phase === "seed" && event.status === "COMPLETED").length,
    1,
  );
});

requiredTest("resume with durable seed events but a missing or mismatched candidate fails closed without re-researching", async (context: TestContext) => {
  const harness = await successorRecoveryHarness(context, "post-recovery-missing");

  const first = await harness.service.run(harness.request);
  assert.equal(first.ok, false);
  if (first.ok) throw new Error("expected fresh research to fail");

  let resumeResearchCalls = 0;
  harness.control.onResume = (resumeRunId) => {
    resumeResearchCalls += 1;
    return { intakeRunId: "book-run-should-not-be-reached", recoveredFromRunId: resumeRunId };
  };

  // (a) Durable research+seed COMPLETED events name a seed candidate that does not
  //     exist in the candidate store. Rehydrate must fail closed — never silently
  //     re-research.
  const missingParent = "book-run-missing-seed";
  const missingAt = context.clock.now();
  harness.events.push(
    { schemaVersion: "1", runId: missingParent, bookId: BOOK, phase: "intake", status: "COMPLETED", at: missingAt, detail: "expectedBookRevision=0" },
    { schemaVersion: "1", runId: missingParent, bookId: BOOK, phase: "research", status: "COMPLETED", at: missingAt },
    { schemaVersion: "1", runId: missingParent, bookId: BOOK, phase: "seed", status: "COMPLETED", at: missingAt, candidate: { candidateId: "research-seed-does-not-exist", manifestDigest: "e".repeat(64) } },
  );
  const missing = await harness.service.run({ ...harness.request, resumeRunId: missingParent, reconcileUnsettled: true });
  assert.equal(missing.ok, false);
  if (missing.ok) throw new Error("missing durable seed candidate must fail closed");
  assert.equal(missing.error.code, "BOOK_RUN_SEED_REHYDRATE_FAILED");

  // (b) Durable seed events name the REAL seed candidate id but a WRONG manifest
  //     digest. Rehydrate opens the candidate, sees the digest mismatch, and fails
  //     closed — the durable identity, not a re-research, is authoritative.
  const mismatchParent = "book-run-mismatched-seed";
  const mismatchAt = context.clock.now();
  harness.events.push(
    { schemaVersion: "1", runId: mismatchParent, bookId: BOOK, phase: "intake", status: "COMPLETED", at: mismatchAt, detail: "expectedBookRevision=0" },
    { schemaVersion: "1", runId: mismatchParent, bookId: BOOK, phase: "research", status: "COMPLETED", at: mismatchAt },
    { schemaVersion: "1", runId: mismatchParent, bookId: BOOK, phase: "seed", status: "COMPLETED", at: mismatchAt, candidate: { candidateId: harness.seedCandidate.candidateId, manifestDigest: "f".repeat(64) } },
  );
  const mismatch = await harness.service.run({ ...harness.request, resumeRunId: mismatchParent, reconcileUnsettled: true });
  assert.equal(mismatch.ok, false);
  if (mismatch.ok) throw new Error("mismatched durable seed digest must fail closed");
  assert.equal(mismatch.error.code, "BOOK_RUN_SEED_REHYDRATE_FAILED");

  // Neither fail-closed path re-invoked the research port.
  assert.equal(resumeResearchCalls, 0, "durable seed rehydrate failures must NOT silently re-research");
});

finishV25Tests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
