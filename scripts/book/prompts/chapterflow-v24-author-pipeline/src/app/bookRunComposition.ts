import { createHash, randomUUID } from "node:crypto";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";

import { createBookWriteLock } from "../books/bookLease.js";
import { createBookContentReader } from "../books/bookContentReader.js";
import { createCandidateStore } from "../books/candidateStore.js";
import { createFileSectionPackCache } from "../books/sectionPackCache.js";
import { createFileSectionAvoidStore } from "../books/sectionAvoidStore.js";
import { createCurrentPointerStore } from "../books/currentPointer.js";
import { createQcService } from "../qc/qcService.js";
import { createQcStore } from "../qc/qcStore.js";
import { CandidateRepairService } from "../qc/repairCoordinator.js";
import { FileRepairHistoryStore } from "../qc/repairHistoryStore.js";
import { createPromotionService } from "../release/promotionService.js";
import { createReviewServiceFactory } from "../review/reviewService.js";
import type { CanonicalReviewResult, ReviewService } from "../review/reviewTypes.js";
import { createRouteForRoleRoute, loadModelRoutingConfig, resolveRoleRoute } from "../runtime/codexRoute.js";
import { createExecutionPolicy } from "../runtime/executionPolicy.js";
import { createModelGateway } from "../runtime/modelGateway.js";
import { createProcessSupervisor } from "../runtime/processSupervisor.js";
import type { ProcessSupervisor } from "../runtime/processTypes.js";
import { createFileRunStore, createFileStageCoordinator, type RunSnapshot } from "../run-state/index.js";
import { CandidateQcEvaluator } from "./candidateQcEvaluator.js";
import { CandidateRepairApplicationPort } from "./candidateRepairApplicationPort.js";
import { createChapterFlowApp, type ChapterFlowApp } from "./createChapterFlowApp.js";
import { ModelGatewayReviewEvaluator } from "./modelGatewayReviewEvaluator.js";
import { createModelTaskRunner, type ModelTaskRunner } from "./modelTaskRunner.js";
import { SemanticPanelReviewEvaluator } from "./semanticPanelReviewEvaluator.js";
import { countQuizQuestions, freshQcRunDefinition, type BookRunEvent, type BookRunEventSink } from "./bookRunApplicationService.js";
import type { ChapterFlowClock, ChapterFlowIdFactory } from "./pipeline.js";

export interface ProductionBookRunComposition {
  readonly app: ChapterFlowApp;
  readonly contentReader: ReturnType<typeof createBookContentReader>;
  readonly currentPointerStore: ReturnType<typeof createCurrentPointerStore>;
  readonly reviewService: ReturnType<ReturnType<typeof createReviewServiceFactory>["create"]>;
  readonly qcService: ReturnType<typeof createQcService>;
}

function monotonicClock(): ChapterFlowClock {
  let last = 0;
  return {
    now(): string {
      const next = Math.max(Date.now(), last + 1);
      last = next;
      return new Date(next).toISOString();
    },
  };
}

function within(base: string, target: string): boolean {
  const path = relative(resolve(base), resolve(target));
  return path === "" || (!path.startsWith("..") && !isAbsolute(path));
}

function idFactory(): ChapterFlowIdFactory {
  return {
    nextRunId: () => `book-run-${randomUUID()}`,
    candidateId: (runId) => `${runId}-candidate`,
    modelAttemptId: (runId) => `${runId}-model`,
    reviewAttemptId: (runId) => `${runId}-review-attempt`,
    reviewId: (runId) => `${runId}-review`,
    qcRoundId: (runId) => `${runId}-qc`,
  };
}

function eventSink(v25Root: string, bookId: string, requestedLog?: string): BookRunEventSink {
  const durable = resolve(v25Root, "book-run-events", `${bookId}.jsonl`);
  const targets = requestedLog === undefined || resolve(requestedLog) === durable
    ? [durable]
    : [durable, resolve(requestedLog)];
  return {
    async append(event): Promise<void> {
      const bytes = `${JSON.stringify(event)}\n`;
      for (const target of targets) {
        await mkdir(dirname(target), { recursive: true });
        await appendFile(target, bytes, { encoding: "utf8", mode: 0o600 });
      }
    },
    async read(expectedBookId, runId): Promise<readonly BookRunEvent[]> {
      if (expectedBookId !== bookId) throw new Error("book-run event sink book mismatch");
      let bytes: string;
      try {
        bytes = await readFile(durable, "utf8");
      } catch (cause) {
        if ((cause as NodeJS.ErrnoException).code === "ENOENT") return [];
        throw cause;
      }
      const events: BookRunEvent[] = [];
      for (const [index, line] of bytes.split("\n").entries()) {
        if (!line.trim()) continue;
        let value: unknown;
        try {
          value = JSON.parse(line);
        } catch {
          throw new Error(`book-run event log is corrupt at line ${index + 1}`);
        }
        if (value === null || typeof value !== "object" || Array.isArray(value)) {
          throw new Error(`book-run event log is corrupt at line ${index + 1}`);
        }
        const event = value as BookRunEvent;
        if (event.schemaVersion !== "1" || event.bookId !== bookId || typeof event.runId !== "string") {
          throw new Error(`book-run event log is corrupt at line ${index + 1}`);
        }
        if (event.runId === runId) events.push(event);
      }
      return events;
    },
  };
}

function exactReviewAttempt(
  snapshot: RunSnapshot,
  attemptId: string,
  outcome: CanonicalReviewResult["outcome"],
): boolean {
  if (snapshot.attempts.length !== 1 || snapshot.attempts[0].admission.attemptId !== attemptId) return false;
  if (outcome === "PASS" || outcome === "FAIL") return snapshot.attempts[0].status === "SUCCEEDED";
  return ["SUCCEEDED", "FAILED", "TIMED_OUT", "CANCELLED"].includes(snapshot.attempts[0].status);
}

function dedicatedRepairReviewService(input: Readonly<{
  inner: ReviewService;
  runStore: ReturnType<typeof createFileRunStore>;
  stageCoordinator: ReturnType<typeof createFileStageCoordinator>;
  clock: ChapterFlowClock;
}>): ReviewService {
  return {
    screen: (candidate) => input.inner.screen(candidate),
    get: (bookId, reviewId) => input.inner.get(bookId, reviewId),
    async reviewCanonical(request) {
      const bookId = request.candidate.manifest.bookId;
      const observedAt = input.clock.now();
      const parent = await input.runStore.readRun(bookId, request.taskContext.runId, observedAt);
      if (!parent.ok) return { ok: false, error: { code: "REPAIR_REVIEW_RUN_UNAVAILABLE", message: parent.error.message } };
      const suffix = createHash("sha256").update(request.reviewId).digest("hex").slice(0, 32);
      const runId = `repair-review-run-${suffix}`;
      const attemptId = `repair-review-attempt-${suffix}`;
      let createdAt = observedAt;
      const prior = await input.runStore.readRun(bookId, runId, observedAt);
      if (prior.ok) createdAt = prior.value.definition.createdAt;
      else if (prior.error.code !== "NOT_FOUND") {
        return { ok: false, error: { code: "REPAIR_REVIEW_RUN_UNAVAILABLE", message: prior.error.message } };
      }
      const identity = {
        candidateId: request.candidate.manifest.candidateId,
        manifestDigest: request.candidate.manifest.manifestDigest,
      };
      const created = await input.runStore.createRun({
        schemaVersion: "1",
        bookId,
        runId,
        commandId: "canonical-review",
        sourceGitSha: parent.value.definition.sourceGitSha,
        requiredStages: ["canonical-review"],
        requiredInventory: request.candidate.manifest.entries.map(({ kind, logicalPath, mediaType }) => ({ kind, logicalPath, mediaType })),
        inputCandidate: identity,
        attemptLimits: { run: 1, byStage: { "canonical-review": 1 } },
        createdAt,
      });
      if (!created.ok) return { ok: false, error: { code: "REPAIR_REVIEW_RUN_UNAVAILABLE", message: created.error.message } };
      const uncertain = created.value.attempts.some((attempt) =>
        attempt.status === "ACTIVE" || attempt.status === "STALE" || attempt.status === "UNKNOWN");
      if (uncertain) {
        return { ok: false, error: { code: "REPAIR_REVIEW_ATTEMPT_UNCERTAIN", message: "canonical repair review attempt is unsettled" } };
      }
      const stored = await input.inner.get(bookId, request.reviewId);
      if (created.value.status === "COMPLETED") {
        if (!stored.ok
          || stored.value.reviewId !== request.reviewId
          || stored.value.candidate.candidateId !== identity.candidateId
          || stored.value.candidate.manifestDigest !== identity.manifestDigest
          || !exactReviewAttempt(created.value, attemptId, stored.value.outcome)) {
          return { ok: false, error: { code: "REPAIR_REVIEW_RUN_UNAVAILABLE", message: "completed repair review lacks exact model attempt and record" } };
        }
        return stored;
      }
      if (created.value.status !== "RUNNING") {
        return { ok: false, error: { code: "REPAIR_REVIEW_RUN_UNAVAILABLE", message: `canonical repair review run is ${created.value.status}` } };
      }
      if (created.value.attempts.length > 0 && !stored.ok) {
        return { ok: false, error: { code: "REPAIR_REVIEW_ATTEMPT_UNCERTAIN", message: "settled repair review call lacks durable record" } };
      }
      if (stored.ok && (!exactReviewAttempt(created.value, attemptId, stored.value.outcome)
        || stored.value.reviewId !== request.reviewId
        || stored.value.candidate.candidateId !== identity.candidateId
        || stored.value.candidate.manifestDigest !== identity.manifestDigest)) {
        return { ok: false, error: { code: "REPAIR_REVIEW_MISMATCH", message: "stored repair review lacks exact binding and settled model attempt" } };
      }
      const reviewed = stored.ok ? stored : await input.inner.reviewCanonical({
        reviewId: request.reviewId,
        candidate: request.candidate,
        taskContext: {
          ...request.taskContext,
          runId,
          attemptId,
          stageId: "canonical-review",
          operationId: "canonical-review",
        },
      });
      if (!reviewed.ok) {
        await input.runStore.finishRun({
          bookId,
          runId,
          status: "FAILED",
          finishedAt: input.clock.now(),
          reason: reviewed.error.message,
        });
        return reviewed;
      }
      if (reviewed.value.reviewId !== request.reviewId
        || reviewed.value.candidate.candidateId !== identity.candidateId
        || reviewed.value.candidate.manifestDigest !== identity.manifestDigest) {
        return { ok: false, error: { code: "REPAIR_REVIEW_MISMATCH", message: "repair review does not bind exact successor candidate" } };
      }
      const live = await input.runStore.readRun(bookId, runId, input.clock.now());
      if (!live.ok || live.value.attempts.some((attempt) =>
        attempt.status === "ACTIVE" || attempt.status === "STALE" || attempt.status === "UNKNOWN")) {
        return { ok: false, error: { code: "REPAIR_REVIEW_ATTEMPT_UNCERTAIN", message: "canonical repair review terminal readback failed" } };
      }
      if (!exactReviewAttempt(live.value, attemptId, reviewed.value.outcome)) {
        return { ok: false, error: { code: "REPAIR_REVIEW_ATTEMPT_UNCERTAIN", message: "repair review lacks exact settled attempt readback" } };
      }
      const checkpoint = await input.stageCoordinator.checkpoint({
        schemaVersion: "1",
        bookId,
        runId,
        stageId: "canonical-review",
        status: "COMPLETED",
        attemptIds: live.value.attempts.map((attempt) => attempt.admission.attemptId),
        candidate: identity,
        completedAt: input.clock.now(),
      });
      if (!checkpoint.ok) return { ok: false, error: { code: "REPAIR_REVIEW_RUN_UNAVAILABLE", message: checkpoint.error.message } };
      const finished = await input.runStore.finishRun({
        bookId,
        runId,
        status: "COMPLETED",
        finishedAt: input.clock.now(),
      });
      return finished.ok
        ? reviewed
        : { ok: false, error: { code: "REPAIR_REVIEW_RUN_UNAVAILABLE", message: finished.error.message } };
    },
  };
}

/** Dedicated run-state stage the reader-experience lane's model attempts live
 *  in. It is SEPARATE from the canonical-review run, whose attempt cap is a
 *  single review attempt — sharing that run would exhaust its capacity and
 *  violate the exact-single-attempt review invariant. */
const READER_LANE_STAGE = "reader-experience-review";
/** Generous per-run cap; a book-run reviews once, so at most one reader attempt
 *  per chapter (and per reader, in Task 9) lands in this run. */
const READER_LANE_ATTEMPT_CAP = 4096;

/**
 * A ModelTaskRunner the semantic panel uses ONLY for reader-experience tasks.
 * It provisions (once per parent review run) a dedicated reader-lane run with
 * its own attempt capacity, then redirects each reader task into that run,
 * keeping the caller-supplied per-chapter attemptId. The canonical-review run is
 * untouched, so its single-attempt invariant holds. The reader-lane run is left
 * RUNNING; it carries only advisory reader evidence and is never promoted from.
 */
function createReaderLaneRunner(deps: Readonly<{
  base: ModelTaskRunner;
  runStore: ReturnType<typeof createFileRunStore>;
  clock: ChapterFlowClock;
}>): ModelTaskRunner {
  const provisioned = new Set<string>();
  return {
    async run(request) {
      const { bookId } = request.context;
      const parentRunId = request.context.runId;
      const readerRunId = `reader-lane-run-${createHash("sha256").update(parentRunId).digest("hex").slice(0, 32)}`;
      if (!provisioned.has(readerRunId)) {
        const observedAt = deps.clock.now();
        const parent = await deps.runStore.readRun(bookId, parentRunId, observedAt);
        if (!parent.ok) {
          return { attemptId: request.context.attemptId, outcome: "FAILED", error: { code: "READER_LANE_PARENT_RUN_UNAVAILABLE", message: parent.error.message } };
        }
        let createdAt = observedAt;
        const prior = await deps.runStore.readRun(bookId, readerRunId, observedAt);
        if (prior.ok) createdAt = prior.value.definition.createdAt;
        else if (prior.error.code !== "NOT_FOUND") {
          return { attemptId: request.context.attemptId, outcome: "FAILED", error: { code: "READER_LANE_RUN_UNAVAILABLE", message: prior.error.message } };
        }
        const created = await deps.runStore.createRun({
          schemaVersion: "1",
          bookId,
          runId: readerRunId,
          commandId: "reader-experience-review",
          sourceGitSha: parent.value.definition.sourceGitSha,
          requiredStages: [READER_LANE_STAGE],
          requiredInventory: parent.value.definition.requiredInventory,
          ...(parent.value.definition.inputCandidate === undefined ? {} : { inputCandidate: parent.value.definition.inputCandidate }),
          attemptLimits: { run: READER_LANE_ATTEMPT_CAP, byStage: { [READER_LANE_STAGE]: READER_LANE_ATTEMPT_CAP } },
          createdAt,
        });
        if (!created.ok) {
          return { attemptId: request.context.attemptId, outcome: "FAILED", error: { code: "READER_LANE_RUN_UNAVAILABLE", message: created.error.message } };
        }
        provisioned.add(readerRunId);
      }
      return deps.base.run({
        ...request,
        context: { ...request.context, runId: readerRunId, stageId: READER_LANE_STAGE },
      });
    },
  };
}

export async function createProductionBookRunComposition(input: Readonly<{
  bookId: string;
  pipelineRoot: string;
  v25Root: string;
  attemptRoot: string;
  logPath?: string;
  processSupervisor?: ProcessSupervisor;
}>): Promise<ProductionBookRunComposition> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.bookId)) {
    throw new Error("BOOK_RUN_COMPOSITION_INVALID:bookId must be a lowercase-dash slug");
  }
  for (const [name, value] of [
    ["pipelineRoot", input.pipelineRoot],
    ["v25Root", input.v25Root],
    ["attemptRoot", input.attemptRoot],
  ] as const) {
    if (!isAbsolute(value)) throw new Error(`BOOK_RUN_COMPOSITION_INVALID:${name} must be absolute`);
  }
  if (input.logPath !== undefined && !isAbsolute(input.logPath)) {
    throw new Error("BOOK_RUN_COMPOSITION_INVALID:logPath must be absolute");
  }
  if (input.logPath !== undefined && within(input.pipelineRoot, input.logPath)) {
    throw new Error("BOOK_RUN_COMPOSITION_INVALID:logPath must be outside pipeline root");
  }
  for (const [name, value] of [["v25Root", input.v25Root], ["attemptRoot", input.attemptRoot]] as const) {
    if (within(input.pipelineRoot, value) || within(value, input.pipelineRoot)) {
      throw new Error(`BOOK_RUN_COMPOSITION_INVALID:${name} must be isolated from pipeline root`);
    }
  }
  await mkdir(input.v25Root, { recursive: true });
  await mkdir(input.attemptRoot, { recursive: true });

  const booksRoot = resolve(input.v25Root, "books");
  const runRoot = resolve(input.v25Root, "run-state");
  await mkdir(booksRoot, { recursive: true });
  await mkdir(runRoot, { recursive: true });
  const writeLock = createBookWriteLock({ booksRoot });
  const currentPointerStore = createCurrentPointerStore({ booksRoot, writeLock });
  const candidateStore = createCandidateStore({ booksRoot, writeLock, currentPointerStore });
  // Task 11y — durable cross-run section-pack reuse. Keyed under the same booksRoot
  // and guarded by the same book write lock as every other book store, so a compile
  // retry reuses gate-passed packs instead of re-drafting the whole book each round.
  const sectionPackCache = createFileSectionPackCache({ booksRoot, writeLock });
  // Task 11aa — durable cross-chapter assembly-avoid context, the sibling of the
  // section-pack cache under the same booksRoot and book write lock. Breaks the
  // assembly livelock: an assembly cross-chapter blocker evicts the implicated
  // cached packs and records here the phrase(s) their re-drafts must avoid.
  const sectionAvoidStore = createFileSectionAvoidStore({ booksRoot, writeLock });
  const contentReader = createBookContentReader({ booksRoot, currentPointerStore });
  const runStore = createFileRunStore(runRoot);
  const stageCoordinator = createFileStageCoordinator(runRoot);
  const clock = monotonicClock();
  const ids = idFactory();
  // Task 6: route selection is threaded through config/model-routing.json
  // rather than modelGateway.ts's hardcoded default. No per-task role is
  // threaded through yet (Task 7/8) — the whole gateway is wired to the
  // config's defaultRoute, which the shipped config pins to the same
  // codex/gpt-5.5/high mapping every role used before this change, so
  // behavior is unchanged. Fails closed (throws) if the config is invalid
  // or resolves to "claude-cli" before Task 7's route exists.
  const modelRoutingConfig = loadModelRoutingConfig();
  const modelRoute = createRouteForRoleRoute(resolveRoleRoute(modelRoutingConfig));
  const modelGateway = createModelGateway({
    runStore,
    processSupervisor: input.processSupervisor ?? createProcessSupervisor(),
    executionPolicy: createExecutionPolicy({ pipelineRoot: input.pipelineRoot, attemptRoot: input.attemptRoot }),
    route: modelRoute,
    now: () => clock.now(),
  });
  const runner = createModelTaskRunner(modelGateway);
  // Task 8: live canonical review = semantic panel — the baseline model review
  // plus the restored reader-experience lane. Reader tasks run through a
  // dedicated reader-lane run (createReaderLaneRunner) so the single-attempt
  // canonical-review run stays intact.
  const reviewService = createReviewServiceFactory({ booksRoot, contentReader, now: () => clock.now() })
    .create(new SemanticPanelReviewEvaluator({
      baseline: new ModelGatewayReviewEvaluator(runner, "attempt-read-json-v1"),
      runner: createReaderLaneRunner({ base: runner, runStore, clock }),
    }));
  const qcService = createQcService({
    booksRoot,
    contentReader,
    reviewService,
    writeLock,
    now: () => clock.now(),
  });
  const qcStore = createQcStore({ booksRoot });
  const promotionService = createPromotionService({
    candidateStore,
    contentReader,
    reviewService,
    qcService,
    currentPointerStore,
    clock: () => clock.now(),
  });
  const history = new FileRepairHistoryStore({ booksRoot, writeLock });
  const repairService = new CandidateRepairService({
    candidates: candidateStore,
    history,
    qc: qcService,
    diagnoses: qcStore,
  });
  // WITH the runner: a successor round must re-run the LLM answer-key judge.
  // A repair rewrites chapters INCLUDING their quizzes, and round 1 may have
  // FAILED precisely on QC1.wrong_quiz_key — an evaluator without a runner
  // silently skips the judge (candidateQcEvaluator runs it only when runner AND
  // taskContext are both present), so the successor round could PASS with
  // regenerated answer keys that were never verified and promote them.
  const repairQc = new CandidateQcEvaluator(contentReader, { runner });
  const repairApplication = new CandidateRepairApplicationPort({
    pipelineRoot: input.pipelineRoot,
    candidates: candidateStore,
    qc: qcService,
    history,
    diagnoses: qcStore,
    runner,
    repairs: repairService,
    reviews: dedicatedRepairReviewService({ inner: reviewService, runStore, stageCoordinator, clock }),
    successorQc: {
      async run(request) {
        // The judge needs its own run-state run (one admission per question
        // attempt; the repair run's capacity is sized to its chapter count and
        // cannot host judge attempts). Mirrors #runFreshQcWithJudge, including
        // its crash-safe ordering: the committed round is the durable
        // authority; the round commits BEFORE the run finishes COMPLETED.
        const judgeRunId = `${request.roundId}-judge`;
        const observedAt = clock.now();
        const committed = await qcService.getRound(request.bookId, request.roundId);
        if (committed.ok) return committed;
        let createdAt = observedAt;
        const prior = await runStore.readRun(request.bookId, judgeRunId, observedAt);
        if (prior.ok) {
          createdAt = prior.value.definition.createdAt;
          if (prior.value.status !== "RUNNING") {
            return {
              ok: false as const,
              error: { code: "REPAIR_QC_JUDGE_UNAVAILABLE", message: `successor QC judge run is ${prior.value.status} with no committed round` },
            };
          }
        } else if (prior.error.code !== "NOT_FOUND") {
          return { ok: false as const, error: { code: "REPAIR_QC_JUDGE_UNAVAILABLE", message: `${prior.error.code}:${prior.error.message}` } };
        }
        const created = await runStore.createRun(freshQcRunDefinition({
          bookId: request.bookId,
          runId: judgeRunId,
          sourceGitSha: request.sourceGitSha,
          candidate: request.candidate,
          createdAt,
          questionCount: countQuizQuestions(request.candidate),
        }));
        if (!created.ok) {
          return { ok: false as const, error: { code: "REPAIR_QC_JUDGE_UNAVAILABLE", message: `${created.error.code}:${created.error.message}` } };
        }
        if (created.value.status !== "RUNNING") {
          return { ok: false as const, error: { code: "REPAIR_QC_JUDGE_UNAVAILABLE", message: "successor QC judge run is not RUNNING" } };
        }
        const evaluation = await repairQc.run({
          candidate: request.candidate,
          canonicalReview: request.canonicalReview,
          roundId: request.roundId,
          taskContext: {
            bookId: request.bookId,
            runId: judgeRunId,
            attemptId: `qc-attempt-${judgeRunId}`,
            stageId: "fresh-qc",
            operationId: "fresh-qc",
            workDir: input.pipelineRoot,
            signal: request.signal,
          },
        });
        if (!evaluation.ok) {
          await runStore.finishRun({
            bookId: request.bookId,
            runId: judgeRunId,
            status: "FAILED",
            finishedAt: clock.now(),
            reason: evaluation.error.code,
          });
          return evaluation;
        }
        const round = await qcService.runFresh({
          roundId: request.roundId,
          candidate: request.candidate,
          canonicalReview: request.canonicalReview,
          evaluation: evaluation.value,
        });
        if (!round.ok) return round;
        await runStore.finishRun({
          bookId: request.bookId,
          runId: judgeRunId,
          status: "COMPLETED",
          finishedAt: clock.now(),
        });
        return round;
      },
    },
    runStore,
    stageCoordinator,
    clock,
  });
  const app = createChapterFlowApp({
    runStore,
    stageCoordinator,
    modelGateway,
    candidateStore,
    contentReader,
    reviewService,
    qcService,
    qcDiagnoses: qcStore,
    promotionService,
    clock,
    ids,
    pipelineRoot: input.pipelineRoot,
    modelTaskRunner: runner,
    currentPointerStore,
    bookRunEvents: eventSink(input.v25Root, input.bookId, input.logPath),
    repairApplication,
    sectionPackCache,
    sectionAvoidStore,
  });
  return { app, contentReader, currentPointerStore, reviewService, qcService };
}
