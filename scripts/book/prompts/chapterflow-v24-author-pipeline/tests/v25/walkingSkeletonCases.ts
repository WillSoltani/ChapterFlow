import assert from "node:assert/strict";
import { realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, sep } from "node:path";

import { createChapterFlowApp } from "../../src/app/createChapterFlowApp.js";
import {
  WALKING_SKELETON_STAGES,
  type ChapterFlowIdFactory,
  type WalkingSkeletonInput,
} from "../../src/app/pipeline.js";
import { createBookContentReader } from "../../src/books/bookContentReader.js";
import { createBookWriteLock } from "../../src/books/bookLease.js";
import { createCandidateStore } from "../../src/books/candidateStore.js";
import type {
  BookContentReader,
  CandidateInputFile,
  CandidateStore,
} from "../../src/books/candidateTypes.js";
import {
  createCurrentPointerStore,
  type CurrentBookPointer,
  type CurrentPointerStore,
} from "../../src/books/currentPointer.js";
import type { BookWriteLock } from "../../src/books/leaseTypes.js";
import type { PlannedArtifact, Result, UtcIso } from "../../src/contracts/v4Core.js";
import { createQcService } from "../../src/qc/qcService.js";
import { createQcStore } from "../../src/qc/qcStore.js";
import type { QcService } from "../../src/qc/qcTypes.js";
import { createPromotionService } from "../../src/release/promotionService.js";
import type { PromotionService } from "../../src/release/promotionTypes.js";
import { createReviewServiceFactory } from "../../src/review/reviewService.js";
import type {
  CanonicalReviewEvaluator,
  CanonicalReviewResult,
  ReviewService,
} from "../../src/review/reviewTypes.js";
import { createFileRunStore } from "../../src/run-state/fileRunStore.js";
import type { RunStore } from "../../src/run-state/runStore.js";
import type { RunDefinition } from "../../src/run-state/runTypes.js";
import { createFileStageCoordinator } from "../../src/run-state/stageCoordinator.js";
import type { StageCoordinator } from "../../src/run-state/stageTypes.js";
import { requiredTest, type TestContext } from "./harness.js";
import { FakeClock } from "./fakes/fakeClock.js";
import {
  FakeExecutor,
  candidateGatewayOutput,
  zeroLiveCounters,
  type FakeExecutorPlan,
} from "./fakes/fakeExecutor.js";
import { FaultyFs } from "./fakes/faultyFs.js";

const SOURCE_GIT_SHA = "a".repeat(40);
const INVENTORY: readonly PlannedArtifact[] = Object.freeze([
  Object.freeze({ kind: "CHAPTER", logicalPath: "chapters/ch01.md", mediaType: "text/markdown" }),
  Object.freeze({ kind: "PROVENANCE", logicalPath: "provenance/source.json", mediaType: "application/json" }),
]);
const FILES: readonly CandidateInputFile[] = Object.freeze([
  Object.freeze({
    ...INVENTORY[0],
    bytes: new Uint8Array(Buffer.from("# Walking skeleton\n", "utf8")),
  }),
  Object.freeze({
    ...INVENTORY[1],
    bytes: new Uint8Array(Buffer.from('{"source":"fixture"}\n', "utf8")),
  }),
]);

type ReviewOutcome = CanonicalReviewResult["outcome"];

class FakeIds implements ChapterFlowIdFactory {
  readonly issuedRunIds: string[] = [];
  readonly #prefix: string;
  readonly #queued: string[];
  #sequence = 0;

  constructor(prefix: string, queued: readonly string[] = []) {
    this.#prefix = prefix;
    this.#queued = [...queued];
  }

  nextRunId(): string {
    const runId = this.#queued.shift() ?? `${this.#prefix}-run-${++this.#sequence}`;
    this.issuedRunIds.push(runId);
    return runId;
  }

  candidateId(runId: string): string { return `${runId}-candidate`; }
  modelAttemptId(runId: string): string { return `${runId}-model-attempt`; }
  reviewAttemptId(runId: string): string { return `${runId}-review-attempt`; }
  reviewId(runId: string): string { return `${runId}-review`; }
  qcRoundId(runId: string): string { return `${runId}-qc`; }
}

type ServiceCounters = {
  candidateStages: number;
  screeningCalls: number;
  canonicalReviewCalls: number;
  freshQcCalls: number;
  promotionCalls: number;
  pointerReads: number;
  pointerUpdates: number;
};

type Rig = {
  readonly app: ReturnType<typeof createChapterFlowApp>;
  readonly clock: FakeClock;
  readonly ids: FakeIds;
  readonly executor: FakeExecutor;
  readonly runStore: RunStore;
  readonly stageCoordinator: StageCoordinator;
  readonly candidateStore: CandidateStore;
  readonly contentReader: BookContentReader;
  readonly reviewService: ReviewService;
  readonly qcService: QcService;
  readonly promotionService: PromotionService;
  readonly currentPointerStore: CurrentPointerStore;
  readonly counters: ServiceCounters;
  readonly createdDefinitions: RunDefinition[];
  readonly stagedInventoryRefs: Array<readonly PlannedArtifact[]>;
  readonly stagedFileRefs: Array<readonly CandidateInputFile[]>;
};

type RigOptions = Readonly<{
  clock?: FakeClock;
  ids?: FakeIds;
  executorPlan?: FakeExecutorPlan;
  reviewOutcome?: ReviewOutcome;
  writeLock?: BookWriteLock;
  currentPointerStore?: CurrentPointerStore;
}>;

function expectOk<T>(result: Result<T>, label: string): T {
  if (!result.ok) throw new Error(`${label}: ${result.error.code}: ${result.error.message}`);
  return result.value;
}

function expectError<T>(result: Result<T>, code: string, label: string): void {
  assert.equal(result.ok, false, `${label}: expected ${code}`);
  if (result.ok) throw new Error(`${label}: unexpectedly succeeded`);
  assert.equal(result.error.code, code, label);
}

function reviewIssues(outcome: ReviewOutcome) {
  return outcome === "PASS"
    ? []
    : [{ code: `REVIEW_${outcome}`, severity: "BLOCKER" as const, message: `fixture ${outcome}` }];
}

function wrapRunStore(inner: RunStore, definitions: RunDefinition[]): RunStore {
  return {
    createRun: async (definition) => {
      definitions.push(definition);
      return inner.createRun(definition);
    },
    readRun: (bookId, runId, observedAt) => inner.readRun(bookId, runId, observedAt),
    admitAttempt: (admission) => inner.admitAttempt(admission),
    finishAttempt: (input) => inner.finishAttempt(input),
    requestCancel: (input) => inner.requestCancel(input),
    finishRun: (input) => inner.finishRun(input),
  };
}

function buildRig(context: TestContext, label: string, options: RigOptions = {}): Rig {
  const clock = options.clock ?? new FakeClock();
  const ids = options.ids ?? new FakeIds(label);
  const createdDefinitions: RunDefinition[] = [];
  const runStore = wrapRunStore(createFileRunStore(context.roots.stateRoot), createdDefinitions);
  const stageCoordinator = createFileStageCoordinator(context.roots.stateRoot);
  const writeLock = options.writeLock ?? createBookWriteLock({
    booksRoot: context.roots.booksRoot,
    timeoutMs: 2_000,
    pollMs: 1,
  });
  const pointerInner = options.currentPointerStore ?? createCurrentPointerStore({
    booksRoot: context.roots.booksRoot,
    writeLock,
  });
  const counters: ServiceCounters = {
    candidateStages: 0,
    screeningCalls: 0,
    canonicalReviewCalls: 0,
    freshQcCalls: 0,
    promotionCalls: 0,
    pointerReads: 0,
    pointerUpdates: 0,
  };
  const currentPointerStore: CurrentPointerStore = {
    read: async (bookId) => {
      counters.pointerReads += 1;
      return pointerInner.read(bookId);
    },
    compareAndSet: async (input) => {
      counters.pointerUpdates += 1;
      return pointerInner.compareAndSet(input);
    },
  };
  const candidateInner = createCandidateStore({
    booksRoot: context.roots.booksRoot,
    writeLock,
    currentPointerStore,
  });
  const stagedInventoryRefs: Array<readonly PlannedArtifact[]> = [];
  const stagedFileRefs: Array<readonly CandidateInputFile[]> = [];
  const candidateStore: CandidateStore = {
    stage: async (input) => {
      counters.candidateStages += 1;
      stagedInventoryRefs.push(input.expectedInventory);
      stagedFileRefs.push(input.files);
      return candidateInner.stage(input);
    },
    open: (input) => candidateInner.open(input),
  };
  const contentReader = createBookContentReader({
    booksRoot: context.roots.booksRoot,
    currentPointerStore,
  });
  const reviewOutcome = options.reviewOutcome ?? "PASS";
  const evaluator: CanonicalReviewEvaluator = {
    evaluate: async () => ({
      ok: true,
      value: { outcome: reviewOutcome, issues: reviewIssues(reviewOutcome) },
    }),
  };
  const reviewInner = createReviewServiceFactory({
    booksRoot: context.roots.booksRoot,
    contentReader,
    now: () => clock.now(),
  }).create(evaluator);
  const reviewService: ReviewService = {
    screen: async (candidate) => {
      counters.screeningCalls += 1;
      return reviewInner.screen(candidate);
    },
    reviewCanonical: async (input) => {
      counters.canonicalReviewCalls += 1;
      return reviewInner.reviewCanonical(input);
    },
    get: (bookId, reviewId) => reviewInner.get(bookId, reviewId),
  };
  const qcInner = createQcService({
    booksRoot: context.roots.booksRoot,
    contentReader,
    reviewService,
    writeLock,
    now: () => clock.now(),
    diagnosisId: () => `${label}-diagnosis`,
  });
  const qcService: QcService = {
    readStatus: (bookId) => qcInner.readStatus(bookId),
    runFresh: async (input) => {
      counters.freshQcCalls += 1;
      return qcInner.runFresh(input);
    },
    getRound: (bookId, roundId) => qcInner.getRound(bookId, roundId),
    diagnose: (bookId, roundId) => qcInner.diagnose(bookId, roundId),
    repairLedger: (request) => qcInner.repairLedger(request),
  };
  const promotionInner = createPromotionService({
    candidateStore,
    contentReader,
    reviewService,
    qcService,
    currentPointerStore,
    clock: () => clock.now(),
  });
  const promotionService: PromotionService = {
    promote: async (request) => {
      counters.promotionCalls += 1;
      return promotionInner.promote(request);
    },
  };
  const executor = new FakeExecutor(runStore, clock, {
    output: candidateGatewayOutput(FILES),
    ...options.executorPlan,
  });
  const app = createChapterFlowApp({
    runStore,
    stageCoordinator,
    modelGateway: executor,
    candidateStore,
    contentReader,
    reviewService,
    qcService,
    qcDiagnoses: createQcStore({ booksRoot: context.roots.booksRoot }),
    promotionService,
    clock,
    ids,
  });
  return {
    app,
    clock,
    ids,
    executor,
    runStore,
    stageCoordinator,
    candidateStore,
    contentReader,
    reviewService,
    qcService,
    promotionService,
    currentPointerStore,
    counters,
    createdDefinitions,
    stagedInventoryRefs,
    stagedFileRefs,
  };
}

function inputFor(
  context: TestContext,
  bookId: string,
  overrides: Partial<WalkingSkeletonInput> = {},
): WalkingSkeletonInput {
  return {
    bookId,
    commandId: "walking-skeleton",
    sourceGitSha: SOURCE_GIT_SHA,
    requiredInventory: INVENTORY.map((item) => ({ ...item })),
    modelAttemptLimit: 1,
    profileId: "attempt-write-json-v1",
    workDir: context.roots.base,
    prompt: {
      templateId: "walking-skeleton-v1",
      inputs: [{ name: "request", mediaType: "application/json", bytes: Buffer.from("{}\n", "utf8") }],
    },
    expectedBookRevision: 0,
    qcEvaluation: { outcome: "PASS", issues: [] },
    signal: new AbortController().signal,
    ...overrides,
  };
}

function definitionFor(input: WalkingSkeletonInput, runId: string, createdAt: UtcIso): RunDefinition {
  const limit = input.modelAttemptLimit ?? 1;
  return {
    schemaVersion: "1",
    bookId: input.bookId,
    runId,
    commandId: input.commandId,
    sourceGitSha: input.sourceGitSha,
    requiredStages: [...WALKING_SKELETON_STAGES],
    requiredInventory: input.requiredInventory.map((item) => ({ ...item })),
    ...(input.inputCandidate === undefined ? {} : { inputCandidate: { ...input.inputCandidate } }),
    attemptLimits: {
      run: limit,
      byStage: {
        [WALKING_SKELETON_STAGES[0]]: limit,
        [WALKING_SKELETON_STAGES[1]]: 0,
        [WALKING_SKELETON_STAGES[2]]: 0,
        [WALKING_SKELETON_STAGES[3]]: 0,
      },
    },
    createdAt,
  };
}

async function assertNoCandidateOrCurrent(rig: Rig, bookId: string, runId: string): Promise<void> {
  const candidate = await rig.contentReader.open({
    bookId,
    selector: { kind: "CANDIDATE", candidateId: rig.ids.candidateId(runId) },
  });
  assert.equal(candidate.ok, false);
  const current = await rig.contentReader.open({ bookId, selector: { kind: "CURRENT" } });
  assert.equal(current.ok, false);
}

function assertZeroLive(rig: Rig): void {
  assert.equal(zeroLiveCounters(rig.executor.counters), true);
}

export function registerWalkingSkeletonCases(): void {
  requiredTest("walking skeleton 1 happy path is durable and verified", async (context) => {
    const rig = buildRig(context, "happy");
    const input = inputFor(context, "happy-book");
    const result = expectOk(await rig.app.pipeline.run(input), "happy lifecycle");

    assert.equal(result.runStatus, "COMPLETED");
    assert.equal(result.readback, "VERIFIED");
    assert.equal(result.bookRevision, 1);
    assert.equal(rig.executor.counters.gatewayCalls, 1);
    assert.equal(rig.executor.counters.durableAdmissions, 1);
    assert.equal(rig.executor.counters.processObservations, 1);
    assert.equal(rig.executor.counters.terminalAttempts, 1);
    assert.deepEqual(rig.counters, {
      candidateStages: 1,
      screeningCalls: 1,
      canonicalReviewCalls: 1,
      freshQcCalls: 1,
      promotionCalls: 1,
      pointerReads: rig.counters.pointerReads,
      pointerUpdates: 1,
    });
    assert.equal(rig.createdDefinitions.length, 1);
    assert.equal(rig.stagedInventoryRefs[0], rig.createdDefinitions[0].requiredInventory);
    assert.equal(Object.isFrozen(rig.stagedInventoryRefs[0]), true);
    assert.equal(rig.stagedInventoryRefs[0].every(Object.isFrozen), true);
    assert.equal(rig.stagedFileRefs[0].every((file) => file.bytes instanceof Uint8Array), true);
    assert.deepEqual(
      rig.stagedFileRefs[0].map(({ kind, logicalPath, mediaType }) => ({ kind, logicalPath, mediaType })),
      INVENTORY,
    );
    assert.deepEqual(
      rig.stagedFileRefs[0].map((file) => Buffer.from(file.bytes).toString("utf8")),
      FILES.map((file) => Buffer.from(file.bytes).toString("utf8")),
    );
    const current = expectOk(
      await rig.contentReader.open({ bookId: input.bookId, selector: { kind: "CURRENT" } }),
      "happy CURRENT",
    );
    assert.equal(current.currentRevision, 1);
    assert.equal(current.manifest.candidateId, result.candidate.candidateId);
    assert.equal(current.manifest.manifestDigest, result.candidate.manifestDigest);
    const run = expectOk(await rig.runStore.readRun(input.bookId, result.runId, rig.clock.now()), "happy run");
    assert.equal(run.status, "COMPLETED");
    assertZeroLive(rig);
  });

  requiredTest("walking skeleton 2 budget and cancellation stop before process", async (context) => {
    const budget = buildRig(context, "budget");
    const budgetInput = inputFor(context, "budget-book", { modelAttemptLimit: 0 });
    const budgetResult = await budget.app.pipeline.run(budgetInput);
    assert.equal(budgetResult.ok, false);
    assert.equal(budget.executor.counters.gatewayCalls, 1);
    assert.equal(budget.executor.counters.durableAdmissions, 0);
    assert.equal(budget.executor.counters.processObservations, 0);
    assert.equal(budget.counters.candidateStages, 0);
    assert.equal(budget.counters.canonicalReviewCalls, 0);
    assert.equal(budget.counters.freshQcCalls, 0);
    assert.equal(budget.counters.promotionCalls, 0);
    const budgetRunId = budget.ids.issuedRunIds[0];
    await assertNoCandidateOrCurrent(budget, budgetInput.bookId, budgetRunId);
    const budgetRun = expectOk(
      await budget.runStore.readRun(budgetInput.bookId, budgetRunId, budget.clock.now()),
      "budget run",
    );
    assert.equal(budgetRun.status, "FAILED");

    const cancelled = buildRig(context, "cancelled");
    const controller = new AbortController();
    controller.abort();
    const cancelInput = inputFor(context, "cancelled-book", { signal: controller.signal });
    expectError(await cancelled.app.pipeline.run(cancelInput), "PIPELINE_CANCELLED", "cancelled lifecycle");
    assert.equal(cancelled.executor.counters.gatewayCalls, 0);
    assert.equal(cancelled.executor.counters.processObservations, 0);
    assert.equal(cancelled.counters.candidateStages, 0);
    assert.equal(cancelled.counters.canonicalReviewCalls, 0);
    assert.equal(cancelled.counters.freshQcCalls, 0);
    assert.equal(cancelled.counters.promotionCalls, 0);
    const cancelRunId = cancelled.ids.issuedRunIds[0];
    await assertNoCandidateOrCurrent(cancelled, cancelInput.bookId, cancelRunId);
    const cancelRun = expectOk(
      await cancelled.runStore.readRun(cancelInput.bookId, cancelRunId, cancelled.clock.now()),
      "cancelled run",
    );
    assert.equal(cancelRun.status, "CANCELLED");
    assertZeroLive(budget);
    assertZeroLive(cancelled);
  });

  requiredTest("walking skeleton 3 invalid gateway output never stages candidate", async (context) => {
    const directBytes = buildRig(context, "invalid-shape", {
      executorPlan: {
        output: {
          schemaVersion: "1",
          files: FILES.map((file) => ({ ...file, bytes: new Uint8Array(file.bytes) })),
        },
      },
    });
    const invalidInput = inputFor(context, "invalid-shape-book");
    expectError(
      await directBytes.app.pipeline.run(invalidInput),
      "PIPELINE_GATEWAY_OUTPUT_INVALID",
      "non-wire bytes",
    );
    assert.equal(directBytes.counters.candidateStages, 0);
    await assertNoCandidateOrCurrent(directBytes, invalidInput.bookId, directBytes.ids.issuedRunIds[0]);

    const mismatchedFile: CandidateInputFile = {
      kind: "CHAPTER",
      logicalPath: "chapters/wrong.md",
      mediaType: "text/markdown",
      bytes: Buffer.from("wrong\n", "utf8"),
    };
    const mismatch = buildRig(context, "inventory-mismatch", {
      executorPlan: { output: candidateGatewayOutput([mismatchedFile, FILES[1]]) },
    });
    const mismatchInput = inputFor(context, "inventory-mismatch-book");
    expectError(
      await mismatch.app.pipeline.run(mismatchInput),
      "PIPELINE_GATEWAY_OUTPUT_INVALID",
      "inventory mismatch",
    );
    assert.equal(mismatch.counters.candidateStages, 0);
    await assertNoCandidateOrCurrent(mismatch, mismatchInput.bookId, mismatch.ids.issuedRunIds[0]);
    assertZeroLive(directBytes);
    assertZeroLive(mismatch);
  });

  requiredTest("walking skeleton 4 screening canonical and QC authority stay separated", async (context) => {
    for (const outcome of ["FAIL", "ERROR"] as const) {
      const rig = buildRig(context, `canonical-${outcome.toLowerCase()}`, { reviewOutcome: outcome });
      const input = inputFor(context, `canonical-${outcome.toLowerCase()}-book`);
      expectError(await rig.app.pipeline.run(input), "PIPELINE_REVIEW_FAILED", `canonical ${outcome}`);
      assert.equal(rig.counters.screeningCalls, 1);
      assert.equal(rig.counters.canonicalReviewCalls, 1);
      assert.equal(rig.counters.freshQcCalls, 0);
      assert.equal(rig.counters.promotionCalls, 0);
      assert.equal((await rig.contentReader.open({ bookId: input.bookId, selector: { kind: "CURRENT" } })).ok, false);
      assertZeroLive(rig);
    }
    for (const outcome of ["FAIL", "ERROR"] as const) {
      const rig = buildRig(context, `qc-${outcome.toLowerCase()}`);
      const input = inputFor(context, `qc-${outcome.toLowerCase()}-book`, {
        qcEvaluation: {
          outcome,
          issues: [{ code: `QC_${outcome}`, severity: "BLOCKER", message: `fixture ${outcome}` }],
        },
      });
      expectError(await rig.app.pipeline.run(input), "PIPELINE_QC_FAILED", `QC ${outcome}`);
      assert.equal(rig.counters.screeningCalls, 1);
      assert.equal(rig.counters.canonicalReviewCalls, 1);
      assert.equal(rig.counters.freshQcCalls, 1);
      assert.equal(rig.counters.promotionCalls, 0);
      assert.equal((await rig.contentReader.open({ bookId: input.bookId, selector: { kind: "CURRENT" } })).ok, false);
      assertZeroLive(rig);
    }
  });

  requiredTest("walking skeleton 5 atomic crash visibility is absent old or complete", async (context) => {
    const clock = new FakeClock();
    const faulty = new FaultyFs();
    const lock = createBookWriteLock({ booksRoot: context.roots.booksRoot, timeoutMs: 2_000, pollMs: 1 });
    const pointer = createCurrentPointerStore({
      booksRoot: context.roots.booksRoot,
      writeLock: lock,
      atomicSeams: faulty.atomicSeams(),
    });
    const candidates = createCandidateStore({
      booksRoot: context.roots.booksRoot,
      writeLock: lock,
      currentPointerStore: pointer,
      seams: faulty.candidateSeams(),
    });
    const reader = createBookContentReader({ booksRoot: context.roots.booksRoot, currentPointerStore: pointer });
    const bookId = "atomic-book";
    const stage = (candidateId: string, text: string) => candidates.stage({
      bookId,
      candidateId,
      createdByRunId: `${candidateId}-run`,
      expectedInventory: [INVENTORY[0]],
      files: [{ ...INVENTORY[0], bytes: Buffer.from(text, "utf8") }],
      createdAt: clock.now(),
    });

    faulty.arm("candidate.before-finalize");
    assert.equal((await stage("candidate-before", "before\n")).ok, false);
    assert.equal((await reader.open({ bookId, selector: { kind: "CANDIDATE", candidateId: "candidate-before" } })).ok, false);

    faulty.arm("candidate.after-finalize");
    assert.equal((await stage("candidate-after", "after\n")).ok, false);
    const afterCandidate = expectOk(
      await reader.open({ bookId, selector: { kind: "CANDIDATE", candidateId: "candidate-after" } }),
      "candidate after-finalize",
    );
    assert.equal(Buffer.from(afterCandidate.files[0].bytes).toString("utf8"), "after\n");

    faulty.disarm();
    const oldManifest = expectOk(await stage("pointer-old", "old\n"), "old candidate");
    const beforeManifest = expectOk(await stage("pointer-before", "before pointer\n"), "before pointer candidate");
    const afterManifest = expectOk(await stage("pointer-after", "after pointer\n"), "after pointer candidate");
    const oldPointer: CurrentBookPointer = {
      schemaVersion: "1",
      bookId,
      candidateId: oldManifest.candidateId,
      manifestDigest: oldManifest.manifestDigest,
      revision: 1,
      updatedAt: clock.now(),
    };
    expectOk(await pointer.compareAndSet({ bookId, expectedRevision: 0, next: oldPointer }), "old pointer");

    faulty.arm("file.before-replace");
    const beforePointer: CurrentBookPointer = {
      schemaVersion: "1",
      bookId,
      candidateId: beforeManifest.candidateId,
      manifestDigest: beforeManifest.manifestDigest,
      revision: 2,
      updatedAt: clock.now(),
    };
    assert.equal((await pointer.compareAndSet({ bookId, expectedRevision: 1, next: beforePointer })).ok, false);
    const remainedOld = expectOk(await pointer.read(bookId), "pointer before-replace");
    assert.ok(remainedOld);
    assert.equal(remainedOld.candidateId, oldManifest.candidateId);
    assert.equal(remainedOld.revision, 1);

    faulty.arm("file.after-replace");
    const afterPointer: CurrentBookPointer = {
      schemaVersion: "1",
      bookId,
      candidateId: afterManifest.candidateId,
      manifestDigest: afterManifest.manifestDigest,
      revision: 2,
      updatedAt: clock.now(),
    };
    assert.equal((await pointer.compareAndSet({ bookId, expectedRevision: 1, next: afterPointer })).ok, false);
    const committed = expectOk(await pointer.read(bookId), "pointer after-replace");
    assert.ok(committed);
    assert.equal(committed.candidateId, afterManifest.candidateId);
    assert.equal(committed.revision, 2);
    const current = expectOk(await reader.open({ bookId, selector: { kind: "CURRENT" } }), "CURRENT after replace");
    assert.equal(current.currentRevision, 2);
    assert.equal(current.manifest.manifestDigest, afterManifest.manifestDigest);
  });

  requiredTest("walking skeleton 6 concurrent same revision promotions have one winner", async (context) => {
    const bookId = "pipeline-race-book";
    const lock = createBookWriteLock({ booksRoot: context.roots.booksRoot, timeoutMs: 5_000, pollMs: 1 });
    const rawPointer = createCurrentPointerStore({ booksRoot: context.roots.booksRoot, writeLock: lock });
    let readCount = 0;
    let casCount = 0;
    let phaseOneResolve!: () => void;
    let phaseTwoResolve!: () => void;
    const phaseOne = new Promise<void>((resolvePromise) => { phaseOneResolve = resolvePromise; });
    const phaseTwo = new Promise<void>((resolvePromise) => { phaseTwoResolve = resolvePromise; });
    const racingPointer: CurrentPointerStore = {
      read: async (requestedBookId) => {
        const observed = await rawPointer.read(requestedBookId);
        readCount += 1;
        if (readCount <= 2) {
          if (readCount === 2) phaseOneResolve();
          await phaseOne;
        } else if (readCount <= 4) {
          if (readCount === 4) phaseTwoResolve();
          await phaseTwo;
        }
        return observed;
      },
      compareAndSet: async (input) => {
        casCount += 1;
        return rawPointer.compareAndSet(input);
      },
    };
    const left = buildRig(context, "race-left", {
      clock: new FakeClock("2026-07-20T12:00:00.000Z", 1_000),
      ids: new FakeIds("race-left", ["race-left-run"]),
      writeLock: lock,
      currentPointerStore: racingPointer,
    });
    const right = buildRig(context, "race-right", {
      clock: new FakeClock("2026-07-20T13:00:00.000Z", 1_000),
      ids: new FakeIds("race-right", ["race-right-run"]),
      writeLock: lock,
      currentPointerStore: racingPointer,
    });
    const [leftResult, rightResult] = await Promise.all([
      left.app.pipeline.run(inputFor(context, bookId)),
      right.app.pipeline.run(inputFor(context, bookId)),
    ]);
    const results = [leftResult, rightResult];
    assert.equal(results.filter((result) => result.ok).length, 1);
    assert.equal(results.filter((result) => !result.ok).length, 1);
    assert.equal(left.counters.promotionCalls, 1);
    assert.equal(right.counters.promotionCalls, 1);
    assert.equal(casCount, 2);
    const winner = results.find((result) => result.ok);
    assert.ok(winner?.ok);
    const current = expectOk(
      await left.contentReader.open({ bookId, selector: { kind: "CURRENT" } }),
      "race CURRENT",
    );
    assert.equal(current.currentRevision, 1);
    assert.equal(current.manifest.candidateId, winner.value.candidate.candidateId);
    assertZeroLive(left);
    assertZeroLive(right);
  });

  requiredTest("walking skeleton 7 exact resume changed intent and uncertainty are fail closed", async (context) => {
    const ids = new FakeIds("resume", ["changed-intent-run"]);
    const rig = buildRig(context, "resume", { ids });
    const exactRunId = "exact-resume-run";
    const exactInput = inputFor(context, "resume-book", { resumeRunId: exactRunId });
    const definition = definitionFor(exactInput, exactRunId, rig.clock.now());
    expectOk(await rig.runStore.createRun(definition), "manual exact run");
    const staged = expectOk(await rig.candidateStore.stage({
      bookId: exactInput.bookId,
      candidateId: ids.candidateId(exactRunId),
      createdByRunId: exactRunId,
      expectedInventory: definition.requiredInventory,
      files: FILES,
      createdAt: rig.clock.now(),
    }), "manual exact candidate");
    expectOk(await rig.stageCoordinator.checkpoint({
      schemaVersion: "1",
      bookId: exactInput.bookId,
      runId: exactRunId,
      stageId: WALKING_SKELETON_STAGES[0],
      status: "COMPLETED",
      attemptIds: [],
      candidate: { candidateId: staged.candidateId, manifestDigest: staged.manifestDigest },
      completedAt: rig.clock.now(),
    }), "manual exact checkpoint");
    const resumed = expectOk(await rig.app.pipeline.run(exactInput), "exact resume");
    assert.equal(resumed.runId, exactRunId);
    assert.deepEqual(resumed.resumedStages, [WALKING_SKELETON_STAGES[0]]);
    assert.equal(rig.executor.counters.gatewayCalls, 0);

    const changed = expectOk(await rig.app.pipeline.run(inputFor(context, exactInput.bookId, {
      resumeRunId: exactRunId,
      commandId: "walking-skeleton-changed",
      expectedBookRevision: 1,
    })), "changed intent");
    assert.equal(changed.runId, "changed-intent-run");
    assert.deepEqual(changed.resumedStages, []);
    assert.equal(rig.executor.counters.gatewayCalls, 1);
    assert.equal(rig.executor.tasks[0].runId, "changed-intent-run");

    const uncertainRunId = "uncertain-resume-run";
    const uncertainInput = inputFor(context, "uncertain-book", { resumeRunId: uncertainRunId });
    const uncertainDefinition = definitionFor(uncertainInput, uncertainRunId, rig.clock.now());
    expectOk(await rig.runStore.createRun(uncertainDefinition), "uncertain run");
    const admittedAt = rig.clock.now();
    const staleAt = new Date(Date.parse(admittedAt) + 1_000).toISOString();
    expectOk(await rig.runStore.admitAttempt({
      bookId: uncertainInput.bookId,
      runId: uncertainRunId,
      attemptId: ids.modelAttemptId(uncertainRunId),
      stageId: WALKING_SKELETON_STAGES[0],
      operationId: "generate-candidate",
      admittedAt,
      staleAt,
    }), "uncertain admission");
    rig.clock.advance(5_000);
    const gatewayCallsBefore = rig.executor.counters.gatewayCalls;
    expectError(
      await rig.app.pipeline.run(uncertainInput),
      "PIPELINE_ATTEMPT_UNCERTAIN",
      "uncertain resume",
    );
    assert.equal(rig.executor.counters.gatewayCalls, gatewayCallsBefore);
    const uncertainRun = expectOk(
      await rig.runStore.readRun(uncertainInput.bookId, uncertainRunId, rig.clock.now()),
      "uncertain run readback",
    );
    assert.equal(uncertainRun.status, "RUNNING");
    assert.equal(uncertainRun.attempts[0].status, "STALE");
    assertZeroLive(rig);
  });

  requiredTest("walking skeleton 8 disposable roots and zero live counters", async (context) => {
    const rig = buildRig(context, "no-live");
    expectOk(await rig.app.pipeline.run(inputFor(context, "no-live-book")), "no-live lifecycle");
    const root = realpathSync(context.roots.base);
    const temporary = realpathSync(resolve(tmpdir()));
    assert.equal(root.startsWith(`${temporary}${sep}`), true);
    assert.equal(process.env.CHAPTERFLOW_NO_API_CODEX_QC, "1");
    assert.notEqual(process.env.CHAPTERFLOW_ALLOW_MODEL_GEN, "1");
    for (const name of [
      "OPENAI_API_KEY",
      "CODEX_API_KEY",
      "ANTHROPIC_API_KEY",
      "CHAPTERFLOW_PROVIDER",
    ]) {
      assert.equal(process.env[name], undefined, `${name} must stay absent`);
    }
    assertZeroLive(rig);
    assert.equal(rig.executor.counters.providerCalls, 0);
    assert.equal(rig.executor.counters.apiCalls, 0);
    assert.equal(rig.executor.counters.networkCalls, 0);
    assert.equal(rig.executor.counters.productionRootMutations, 0);
  });
}
