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
  assert.equal(researchPortCalls, 2, "resume must rehydrate through research port");
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

finishV25Tests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
