import { createHash } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";

import type { BookContentReader, CandidateSnapshot } from "../books/candidateTypes.js";
import type { CurrentPointerStore } from "../books/currentPointer.js";
import type { CandidateIdentity, Result, UtcIso } from "../contracts/v4Core.js";
import type { QcRoundResult, QcService } from "../qc/qcTypes.js";
import type { PromotionService } from "../release/promotionTypes.js";
import type { CanonicalReviewResult, ReviewService } from "../review/reviewTypes.js";
import type { RunStore } from "../run-state/runStore.js";
import type { RunDefinition, RunSnapshot } from "../run-state/runTypes.js";
import type { StageCoordinator } from "../run-state/stageTypes.js";
import type { CandidateRepairApplicationPort } from "./candidateRepairApplicationPort.js";
import type { CandidateQcEvaluator } from "./candidateQcEvaluator.js";
import type { CompilerApplicationPort } from "./compilerApplicationPort.js";
import type { ResearchCandidateApplicationPort } from "./researchCandidateApplicationPort.js";
import type { ChapterFlowClock, ChapterFlowIdFactory } from "./pipeline.js";

export const BOOK_RUN_PHASES = Object.freeze([
  "intake",
  "research",
  "seed",
  "compile",
  "review",
  "fresh-qc",
  "repair",
  "promotion",
] as const);

export type BookRunPhase = typeof BOOK_RUN_PHASES[number];

export interface BookRunEvent {
  readonly schemaVersion: "1";
  readonly runId: string;
  readonly bookId: string;
  readonly phase: BookRunPhase;
  readonly status: "STARTED" | "COMPLETED" | "SKIPPED" | "FAILED";
  readonly at: UtcIso;
  readonly detail?: string;
  readonly candidate?: CandidateIdentity;
}

export interface BookRunEventSink {
  append(event: BookRunEvent): Promise<void>;
  read?(bookId: string, runId: string): Promise<readonly BookRunEvent[]>;
}

export interface BookRunApplicationRequest {
  readonly bookId: string;
  readonly title: string;
  readonly author: string;
  readonly sourceGitSha: string;
  readonly v25Root: string;
  readonly attemptRoot: string;
  readonly resumeRunId?: string;
  readonly regen: boolean;
  readonly maxRepairRounds: 1;
  readonly promoteLocal: boolean;
  readonly signal: AbortSignal;
}

export interface BookRunApplicationResult {
  readonly schemaVersion: "1";
  readonly runId: string;
  readonly status: "READY" | "PROMOTED";
  readonly candidate: CandidateIdentity;
  readonly reviewId: string;
  readonly qcRoundId: string;
  readonly bookRevision?: number;
  readonly readback?: "VERIFIED";
}

export interface BookRunApplicationDependencies {
  readonly research: ResearchCandidateApplicationPort;
  readonly compiler: CompilerApplicationPort;
  readonly repair?: CandidateRepairApplicationPort;
  readonly contentReader: BookContentReader;
  readonly candidateQc: CandidateQcEvaluator;
  readonly reviews: ReviewService;
  readonly qc: QcService;
  readonly promotion: PromotionService;
  readonly currentPointer: CurrentPointerStore;
  readonly runStore: RunStore;
  readonly stageCoordinator: StageCoordinator;
  readonly clock: ChapterFlowClock;
  readonly ids: ChapterFlowIdFactory;
  readonly events: BookRunEventSink;
  readonly pipelineRoot: string;
}

const REVIEW_STAGE = "canonical-review" as const;
const FRESH_QC_STAGE = "fresh-qc" as const;
const RETRYABLE_COMPILER_FAILURES = Object.freeze([
  "COMPILER_ASSEMBLY_BLOCKED:",
  "COMPILER_SECTION_BLOCKED:",
  "COMPILER_SECTION_OUTPUT_INVALID:",
] as const);

function failed<T>(code: string, message: string): Result<T> {
  return { ok: false, error: { code, message } };
}

function identity(candidate: CandidateSnapshot): CandidateIdentity {
  return {
    candidateId: candidate.manifest.candidateId,
    manifestDigest: candidate.manifest.manifestDigest,
  };
}

function sameIdentity(left: CandidateIdentity, right: CandidateIdentity): boolean {
  return left.candidateId === right.candidateId && left.manifestDigest === right.manifestDigest;
}

function expectedRevisionFromEvents(events: readonly BookRunEvent[]): Result<number> {
  const values = events
    .filter((event) => event.phase === "intake" && event.status === "COMPLETED")
    .map((event) => /^expectedBookRevision=(\d+)$/.exec(event.detail ?? "")?.[1])
    .filter((value): value is string => value !== undefined)
    .map(Number);
  if (values.length === 0 || values.some((value) => !Number.isSafeInteger(value))) {
    return failed("BOOK_RUN_RESUME_UNAVAILABLE", "resume lacks durable original pointer revision");
  }
  if (new Set(values).size !== 1) {
    return failed("BOOK_RUN_RESUME_UNAVAILABLE", "resume pointer revision evidence conflicts");
  }
  return { ok: true, value: values[0] };
}

function completedResearchSeed(events: readonly BookRunEvent[]): Result<CandidateIdentity | null> {
  const researchCompleted = events.some((event) => event.phase === "research" && event.status === "COMPLETED");
  const seeds = events
    .filter((event) => event.phase === "seed" && event.status === "COMPLETED")
    .map((event) => event.candidate)
    .filter((candidate): candidate is CandidateIdentity => candidate !== undefined);
  if (!researchCompleted && seeds.length === 0) return { ok: true, value: null };
  if (!researchCompleted || seeds.length === 0) {
    return failed("BOOK_RUN_RESUME_UNAVAILABLE", "resume research and seed completion evidence is incomplete");
  }
  if (seeds.some((candidate) => !sameIdentity(candidate, seeds[0]))) {
    return failed("BOOK_RUN_RESUME_UNAVAILABLE", "resume seed completion evidence conflicts");
  }
  return { ok: true, value: seeds[0] };
}

function retryableCompilerFailure(detail: string | undefined): boolean {
  return detail !== undefined && RETRYABLE_COMPILER_FAILURES.some((prefix) => detail.startsWith(prefix));
}

function hasRetryableCompilerFailureEvent(events: readonly BookRunEvent[]): boolean {
  return events.some((event) =>
    event.phase === "compile" && event.status === "FAILED" && retryableCompilerFailure(event.detail));
}

function canonicalUtc(value: string): value is UtcIso {
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString() === value;
}

function safeNow(clock: ChapterFlowClock): Result<UtcIso> {
  try {
    const value = clock.now();
    return canonicalUtc(value)
      ? { ok: true, value }
      : failed("BOOK_RUN_CLOCK_INVALID", "clock must return canonical UTC ISO time");
  } catch {
    return failed("BOOK_RUN_CLOCK_INVALID", "clock failed");
  }
}

function derivedId(prefix: string, runId: string): string {
  return `${prefix}-${createHash("sha256").update(runId).digest("hex").slice(0, 32)}`;
}

function reviewDefinition(input: Readonly<{
  bookId: string;
  runId: string;
  sourceGitSha: string;
  candidate: CandidateSnapshot;
  createdAt: UtcIso;
}>): RunDefinition {
  return {
    schemaVersion: "1",
    bookId: input.bookId,
    runId: input.runId,
    commandId: "canonical-review",
    sourceGitSha: input.sourceGitSha,
    requiredStages: [REVIEW_STAGE],
    requiredInventory: input.candidate.manifest.entries.map(({ kind, logicalPath, mediaType }) => ({
      kind,
      logicalPath,
      mediaType,
    })),
    inputCandidate: identity(input.candidate),
    attemptLimits: { run: 1, byStage: { [REVIEW_STAGE]: 1 } },
    createdAt: input.createdAt,
  };
}

/** Total quiz questions across the candidate's chapters. The fresh-qc answer-key
 *  judge runs one model call per question, so this sizes the judge run's attempt
 *  capacity. Malformed chapters are surfaced as blockers by CandidateQcEvaluator;
 *  they contribute zero here and never under-block. */
export function countQuizQuestions(candidate: CandidateSnapshot): number {
  let total = 0;
  for (const file of candidate.files) {
    if (file.kind !== "CHAPTER") continue;
    try {
      const chapter = JSON.parse(Buffer.from(file.bytes).toString("utf8")) as { quiz?: { questions?: unknown } };
      if (Array.isArray(chapter.quiz?.questions)) total += (chapter.quiz.questions as unknown[]).length;
    } catch {
      // ignore — deterministic QC inputs gate re-parses and blocks malformed chapters
    }
  }
  return total;
}

/** Run definition for the dedicated fresh-qc answer-key-judge run. The judge is
 *  per-question model work the gateway admits against run-state, so it needs a
 *  live run whose stage capacity covers every quiz question. */
export function freshQcRunDefinition(input: Readonly<{
  bookId: string;
  runId: string;
  sourceGitSha: string;
  candidate: CandidateSnapshot;
  createdAt: UtcIso;
  questionCount: number;
}>): RunDefinition {
  const capacity = Math.max(1, input.questionCount);
  return {
    schemaVersion: "1",
    bookId: input.bookId,
    runId: input.runId,
    commandId: "fresh-qc",
    sourceGitSha: input.sourceGitSha,
    requiredStages: [FRESH_QC_STAGE],
    requiredInventory: input.candidate.manifest.entries.map(({ kind, logicalPath, mediaType }) => ({
      kind,
      logicalPath,
      mediaType,
    })),
    inputCandidate: identity(input.candidate),
    attemptLimits: { run: capacity, byStage: { [FRESH_QC_STAGE]: capacity } },
    createdAt: input.createdAt,
  };
}

function uncertainReviewAttempt(snapshot: RunSnapshot): boolean {
  return snapshot.attempts.some((attempt) =>
    attempt.status === "ACTIVE" || attempt.status === "STALE" || attempt.status === "UNKNOWN");
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

async function exactReview(
  dependencies: BookRunApplicationDependencies,
  input: Readonly<{
    bookId: string;
    sourceGitSha: string;
    parentRunId: string;
    candidate: CandidateSnapshot;
    attemptRoot: string;
    signal: AbortSignal;
  }>,
): Promise<Result<CanonicalReviewResult>> {
  const runId = derivedId("review-run", input.parentRunId);
  const reviewId = derivedId("review", input.parentRunId);
  const attemptId = derivedId("review-attempt", input.parentRunId);
  const observedAt = safeNow(dependencies.clock);
  if (!observedAt.ok) return observedAt;
  let createdAt = observedAt.value;
  const prior = await dependencies.runStore.readRun(input.bookId, runId, observedAt.value);
  if (prior.ok) createdAt = prior.value.definition.createdAt;
  else if (prior.error.code !== "NOT_FOUND") return failed("BOOK_RUN_REVIEW_UNAVAILABLE", prior.error.message);
  const definition = reviewDefinition({
    bookId: input.bookId,
    runId,
    sourceGitSha: input.sourceGitSha,
    candidate: input.candidate,
    createdAt,
  });
  const created = await dependencies.runStore.createRun(definition);
  if (!created.ok) return failed("BOOK_RUN_REVIEW_UNAVAILABLE", `${created.error.code}:${created.error.message}`);
  if (created.value.status === "CANCEL_REQUESTED" || created.value.status === "CANCELLED") {
    return failed("BOOK_RUN_CANCELLED", "canonical review run is cancelled");
  }
  if (created.value.status === "FAILED") return failed("BOOK_RUN_REVIEW_UNAVAILABLE", "canonical review run is terminal FAILED");

  const stored = await dependencies.reviews.get(input.bookId, reviewId);
  if (created.value.status === "COMPLETED") {
    if (!stored.ok || !sameIdentity(stored.value.candidate, identity(input.candidate))
      || stored.value.reviewId !== reviewId
      || !exactReviewAttempt(created.value, attemptId, stored.value.outcome)) {
      return failed("BOOK_RUN_REVIEW_UNAVAILABLE", "completed review run lacks exact stored review");
    }
    return stored;
  }
  if (uncertainReviewAttempt(created.value)) {
    return failed("BOOK_RUN_REVIEW_ATTEMPT_UNCERTAIN", "canonical review attempt is unsettled; replay refused");
  }
  if (created.value.attempts.length > 0 && !stored.ok) {
    return failed("BOOK_RUN_REVIEW_ATTEMPT_UNCERTAIN", "settled review call lacks durable review; replay refused");
  }
  if (stored.ok && !exactReviewAttempt(created.value, attemptId, stored.value.outcome)) {
    return failed("BOOK_RUN_REVIEW_MISMATCH", "stored canonical review lacks its exact settled model attempt");
  }

  let review: Result<CanonicalReviewResult>;
  if (stored.ok) {
    review = stored;
  } else if (stored.error.code === "REVIEW_NOT_FOUND") {
    if (input.signal.aborted) return failed("BOOK_RUN_CANCELLED", "cancelled before canonical review");
    await mkdir(input.attemptRoot, { recursive: true });
    review = await dependencies.reviews.reviewCanonical({
      reviewId,
      candidate: input.candidate,
      taskContext: {
        bookId: input.bookId,
        runId,
        attemptId,
        stageId: REVIEW_STAGE,
        operationId: REVIEW_STAGE,
        workDir: input.attemptRoot,
        signal: input.signal,
      },
    });
  } else {
    return failed("BOOK_RUN_REVIEW_UNAVAILABLE", stored.error.message);
  }
  if (!review.ok) return review;
  if (!sameIdentity(review.value.candidate, identity(input.candidate)) || review.value.reviewId !== reviewId) {
    return failed("BOOK_RUN_REVIEW_MISMATCH", "canonical review does not bind exact compiled candidate");
  }

  const liveAt = safeNow(dependencies.clock);
  if (!liveAt.ok) return liveAt;
  const live = await dependencies.runStore.readRun(input.bookId, runId, liveAt.value);
  if (!live.ok || uncertainReviewAttempt(live.value)) {
    return failed("BOOK_RUN_REVIEW_ATTEMPT_UNCERTAIN", "canonical review attempt terminal readback failed");
  }
  if (!exactReviewAttempt(live.value, attemptId, review.value.outcome)) {
    return failed("BOOK_RUN_REVIEW_ATTEMPT_UNCERTAIN", "canonical review lacks exact settled attempt readback");
  }
  const checkpointAt = safeNow(dependencies.clock);
  if (!checkpointAt.ok) return checkpointAt;
  const checkpoint = await dependencies.stageCoordinator.checkpoint({
    schemaVersion: "1",
    bookId: input.bookId,
    runId,
    stageId: REVIEW_STAGE,
    status: "COMPLETED",
    attemptIds: live.value.attempts.map((attempt) => attempt.admission.attemptId),
    candidate: identity(input.candidate),
    completedAt: checkpointAt.value,
  });
  if (!checkpoint.ok) return failed("BOOK_RUN_REVIEW_UNAVAILABLE", `${checkpoint.error.code}:${checkpoint.error.message}`);
  const finishedAt = safeNow(dependencies.clock);
  if (!finishedAt.ok) return finishedAt;
  const finished = await dependencies.runStore.finishRun({
    bookId: input.bookId,
    runId,
    status: "COMPLETED",
    finishedAt: finishedAt.value,
  });
  if (!finished.ok) return failed("BOOK_RUN_REVIEW_UNAVAILABLE", `${finished.error.code}:${finished.error.message}`);
  const verifiedAt = safeNow(dependencies.clock);
  if (!verifiedAt.ok) return verifiedAt;
  const verified = await dependencies.runStore.readRun(input.bookId, runId, verifiedAt.value);
  return verified.ok && verified.value.status === "COMPLETED"
    ? review
    : failed("BOOK_RUN_REVIEW_UNAVAILABLE", "canonical review terminal readback failed");
}

export class BookRunApplicationService {
  readonly #dependencies: BookRunApplicationDependencies;

  constructor(dependencies: BookRunApplicationDependencies) {
    this.#dependencies = dependencies;
  }

  async #event(
    runId: string,
    bookId: string,
    phase: BookRunPhase,
    status: BookRunEvent["status"],
    detail?: string,
    candidate?: CandidateIdentity,
  ): Promise<Result<void>> {
    const at = safeNow(this.#dependencies.clock);
    if (!at.ok) return at;
    try {
      await this.#dependencies.events.append({
        schemaVersion: "1",
        runId,
        bookId,
        phase,
        status,
        at: at.value,
        ...(detail === undefined ? {} : { detail }),
        ...(candidate === undefined ? {} : { candidate }),
      });
      return { ok: true, value: undefined };
    } catch (cause) {
      return failed("BOOK_RUN_EVENT_WRITE_FAILED", (cause as Error).message);
    }
  }

  /** Run the deterministic gates + LLM answer-key judge under a dedicated
   *  fresh-qc run, then commit the round. The judge is per-question model work
   *  the gateway admits against run-state, so it needs a live run sized to the
   *  candidate's quiz-question count; the judge's READ_ONLY profile pins its
   *  workDir to the exact pipeline root. */
  async #runFreshQcWithJudge(
    input: BookRunApplicationRequest,
    parentRunId: string,
    candidate: CandidateSnapshot,
    review: CanonicalReviewResult,
    roundId: string,
  ): Promise<Result<QcRoundResult>> {
    const judgeRunId = derivedId("qc-judge-run", parentRunId);
    const createdAt = safeNow(this.#dependencies.clock);
    if (!createdAt.ok) return createdAt;
    const created = await this.#dependencies.runStore.createRun(freshQcRunDefinition({
      bookId: input.bookId,
      runId: judgeRunId,
      sourceGitSha: input.sourceGitSha,
      candidate,
      createdAt: createdAt.value,
      questionCount: countQuizQuestions(candidate),
    }));
    if (!created.ok) return failed("BOOK_RUN_QC_UNAVAILABLE", `${created.error.code}:${created.error.message}`);
    if (created.value.status !== "RUNNING") return failed("BOOK_RUN_QC_UNAVAILABLE", "fresh-qc judge run is not RUNNING");
    const evaluation = await this.#dependencies.candidateQc.run({
      candidate,
      canonicalReview: review,
      roundId,
      taskContext: {
        bookId: input.bookId,
        runId: judgeRunId,
        attemptId: derivedId("qc-attempt", judgeRunId),
        stageId: FRESH_QC_STAGE,
        operationId: FRESH_QC_STAGE,
        workDir: this.#dependencies.pipelineRoot,
        signal: input.signal,
      },
    });
    const finishedAt = safeNow(this.#dependencies.clock);
    if (finishedAt.ok) {
      await this.#dependencies.runStore.finishRun({
        bookId: input.bookId,
        runId: judgeRunId,
        status: evaluation.ok ? "COMPLETED" : "FAILED",
        finishedAt: finishedAt.value,
        ...(evaluation.ok ? {} : { reason: evaluation.error.code }),
      });
    }
    if (!evaluation.ok) return evaluation;
    return this.#dependencies.qc.runFresh({ roundId, candidate, canonicalReview: review, evaluation: evaluation.value });
  }

  async run(input: BookRunApplicationRequest): Promise<Result<BookRunApplicationResult>> {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.bookId) || !input.title.trim() || !input.author.trim() || !input.sourceGitSha.trim()) {
      return failed("BOOK_RUN_INPUT_INVALID", "bookId, title, author, and sourceGitSha are required");
    }
    if (!isAbsolute(input.v25Root) || !isAbsolute(input.attemptRoot)) {
      return failed("BOOK_RUN_INPUT_INVALID", "v25Root and attemptRoot must be absolute");
    }
    if (input.maxRepairRounds !== 1) {
      return failed("BOOK_RUN_INPUT_INVALID", "maxRepairRounds must equal 1");
    }
    if (!(input.signal instanceof AbortSignal)) return failed("BOOK_RUN_INPUT_INVALID", "signal must be AbortSignal");
    if (input.signal.aborted) return failed("BOOK_RUN_CANCELLED", "cancelled before intake");

    const runId = input.resumeRunId ?? this.#dependencies.ids.nextRunId();
    let resumedRevision: Result<number> | undefined;
    let priorEvents: readonly BookRunEvent[] = [];
    let durableSeed: CandidateIdentity | null = null;
    if (input.resumeRunId !== undefined) {
      if (this.#dependencies.events.read === undefined) {
        return failed("BOOK_RUN_RESUME_UNAVAILABLE", "durable phase event readback is required for resume");
      }
      try {
        priorEvents = await this.#dependencies.events.read(input.bookId, runId);
        resumedRevision = expectedRevisionFromEvents(priorEvents);
      } catch (cause) {
        return failed("BOOK_RUN_RESUME_UNAVAILABLE", (cause as Error).message);
      }
      if (!resumedRevision.ok) return resumedRevision;
      const seedEvidence = completedResearchSeed(priorEvents);
      if (!seedEvidence.ok) return seedEvidence;
      durableSeed = seedEvidence.value;
    }
    const intakeStarted = await this.#event(runId, input.bookId, "intake", "STARTED");
    if (!intakeStarted.ok) return intakeStarted;
    const pointer = await this.#dependencies.currentPointer.read(input.bookId);
    if (!pointer.ok) {
      await this.#event(runId, input.bookId, "intake", "FAILED", pointer.error.message);
      return pointer;
    }
    if (pointer.value !== null && !input.regen && input.resumeRunId === undefined) {
      const message = "book already has local V4 promotion; pass regen to create a fresh candidate";
      await this.#event(runId, input.bookId, "intake", "FAILED", message, {
        candidateId: pointer.value.candidateId,
        manifestDigest: pointer.value.manifestDigest,
      });
      return failed("BOOK_RUN_ALREADY_PROMOTED", message);
    }
    const expectedBookRevision = resumedRevision !== undefined && resumedRevision.ok
      ? resumedRevision.value
      : pointer.value?.revision ?? 0;
    const intakeCompleted = await this.#event(runId, input.bookId, "intake", "COMPLETED", `expectedBookRevision=${expectedBookRevision}`);
    if (!intakeCompleted.ok) return intakeCompleted;

    const rehydrateSeed = input.resumeRunId !== undefined && durableSeed !== null;
    if (!rehydrateSeed) {
      const researchStarted = await this.#event(runId, input.bookId, "research", "STARTED");
      if (!researchStarted.ok) return researchStarted;
    }
    let intake;
    try {
      intake = await this.#dependencies.research.run({
        bookId: input.bookId,
        title: input.title,
        author: input.author,
        sourceGitSha: input.sourceGitSha,
        v25Root: input.v25Root,
        attemptRoot: resolve(input.attemptRoot, "research"),
        ...(input.resumeRunId === undefined ? { newRunId: runId } : { resumeRunId: input.resumeRunId }),
        forceRefresh: input.regen,
        signal: input.signal,
      });
    } catch (cause) {
      const message = (cause as Error).message;
      if (!rehydrateSeed) await this.#event(runId, input.bookId, "research", "FAILED", message);
      return failed("BOOK_RUN_RESEARCH_FAILED", message);
    }
    if (
      intake.intakeRunId !== runId
      || intake.bookId !== input.bookId
      || (rehydrateSeed && durableSeed !== null && (!intake.resumed || !sameIdentity(intake.candidate, durableSeed)))
    ) {
      const message = "research intake does not bind exact production run and book";
      if (!rehydrateSeed) await this.#event(runId, input.bookId, "research", "FAILED", message);
      return failed("BOOK_RUN_RESEARCH_MISMATCH", message);
    }
    if (!rehydrateSeed) {
      const researchCompleted = await this.#event(
        runId,
        input.bookId,
        "research",
        "COMPLETED",
        `intakeRunId=${intake.intakeRunId};researchRunId=${intake.researchRunId}`,
      );
      if (!researchCompleted.ok) return researchCompleted;
      const seedStarted = await this.#event(runId, input.bookId, "seed", "STARTED");
      if (!seedStarted.ok) return seedStarted;
      const seedCompleted = await this.#event(runId, input.bookId, "seed", "COMPLETED", undefined, intake.candidate);
      if (!seedCompleted.ok) return seedCompleted;
    }

    const baseCompilerRunId = derivedId("compiler-run", runId);
    let compilerRunId = baseCompilerRunId;
    let compilerAttemptRoot = resolve(input.attemptRoot, "compiler");
    if (input.resumeRunId !== undefined) {
      const observedAt = safeNow(this.#dependencies.clock);
      if (!observedAt.ok) return observedAt;
      const baseCompiler = await this.#dependencies.runStore.readRun(input.bookId, baseCompilerRunId, observedAt.value);
      if (!baseCompiler.ok && baseCompiler.error.code !== "NOT_FOUND") {
        return failed("BOOK_RUN_COMPILER_UNAVAILABLE", baseCompiler.error.message);
      }
      if (
        !baseCompiler.ok
        && priorEvents.some((event) => event.phase === "compile")
      ) {
        return failed("BOOK_RUN_COMPILER_STATE_MISSING", "durable compile event lacks base compiler run state");
      }
      if (
        baseCompiler.ok
        && (baseCompiler.value.status === "CANCEL_REQUESTED" || baseCompiler.value.status === "CANCELLED")
      ) {
        return failed("BOOK_RUN_COMPILER_RETRY_BLOCKED", "cancelled compiler run cannot be restarted");
      }
      if (baseCompiler.ok && baseCompiler.value.status === "FAILED") {
        if (
          !retryableCompilerFailure(baseCompiler.value.terminalReason)
          || !hasRetryableCompilerFailureEvent(priorEvents)
        ) {
          return failed("BOOK_RUN_COMPILER_RETRY_BLOCKED", "compiler failure is not known deterministic retryable state");
        }
        const retryRunId = derivedId("compiler-retry-1-run", runId);
        const retryAt = safeNow(this.#dependencies.clock);
        if (!retryAt.ok) return retryAt;
        const retryCompiler = await this.#dependencies.runStore.readRun(input.bookId, retryRunId, retryAt.value);
        if (retryCompiler.ok && retryCompiler.value.status === "FAILED") {
          return failed("BOOK_RUN_COMPILER_RETRY_EXHAUSTED", "single deterministic compiler retry already failed");
        }
        if (!retryCompiler.ok && retryCompiler.error.code !== "NOT_FOUND") {
          return failed("BOOK_RUN_COMPILER_UNAVAILABLE", retryCompiler.error.message);
        }
        compilerRunId = retryRunId;
        compilerAttemptRoot = resolve(input.attemptRoot, "compiler-retry-1");
      }
    }
    const compileStarted = await this.#event(runId, input.bookId, "compile", "STARTED", undefined, intake.candidate);
    if (!compileStarted.ok) return compileStarted;
    let compiled;
    try {
      compiled = await this.#dependencies.compiler.run({
        bookId: input.bookId,
        candidateId: intake.candidate.candidateId,
        manifestDigest: intake.candidate.manifestDigest,
        sourceGitSha: input.sourceGitSha,
        resumeRunId: compilerRunId,
        attemptRoot: compilerAttemptRoot,
        indexLogicalPath: intake.indexLogicalPath,
        sectionTaskContextLogicalPath: intake.sectionTaskContextLogicalPath,
        sources: intake.sources,
        profileId: "attempt-read-json-v1",
        signal: input.signal,
      });
    } catch (cause) {
      const message = (cause as Error).message;
      await this.#event(runId, input.bookId, "compile", "FAILED", message, intake.candidate);
      return failed("BOOK_RUN_COMPILER_FAILED", message);
    }
    let selected = await this.#dependencies.contentReader.open({
      bookId: input.bookId,
      selector: { kind: "CANDIDATE", candidateId: compiled.candidateId },
    });
    if (
      !selected.ok
      || selected.value.manifest.manifestDigest !== compiled.manifestDigest
      || compiled.runId !== compilerRunId
      || compiled.runStatus !== "COMPLETED"
      || compiled.candidateId !== this.#dependencies.ids.candidateId(compilerRunId)
      || selected.value.manifest.parentCandidateId !== intake.candidate.candidateId
      || selected.value.manifest.createdByRunId !== compilerRunId
    ) {
      const message = selected.ok ? "compiled candidate digest readback mismatch" : selected.error.message;
      await this.#event(runId, input.bookId, "compile", "FAILED", message);
      return failed("BOOK_RUN_CANDIDATE_MISMATCH", message);
    }
    let candidate = selected.value;
    const compileCompleted = await this.#event(runId, input.bookId, "compile", "COMPLETED", `compilerRunId=${compiled.runId}`, identity(candidate));
    if (!compileCompleted.ok) return compileCompleted;

    const reviewStarted = await this.#event(runId, input.bookId, "review", "STARTED", undefined, identity(candidate));
    if (!reviewStarted.ok) return reviewStarted;
    let review = await exactReview(this.#dependencies, {
      bookId: input.bookId,
      sourceGitSha: input.sourceGitSha,
      parentRunId: runId,
      candidate,
      attemptRoot: resolve(input.attemptRoot, "review"),
      signal: input.signal,
    });
    if (!review.ok || review.value.outcome !== "PASS") {
      const message = review.ok ? `canonical review outcome=${review.value.outcome}` : review.error.message;
      await this.#event(runId, input.bookId, "review", "FAILED", message, identity(candidate));
      return failed("BOOK_RUN_REVIEW_FAILED", message);
    }
    const reviewCompleted = await this.#event(runId, input.bookId, "review", "COMPLETED", `reviewId=${review.value.reviewId}`, identity(candidate));
    if (!reviewCompleted.ok) return reviewCompleted;

    const qcStarted = await this.#event(runId, input.bookId, "fresh-qc", "STARTED", undefined, identity(candidate));
    if (!qcStarted.ok) return qcStarted;
    let roundId = derivedId("qc", runId);
    let qc: Result<QcRoundResult>;
    if (priorEvents.some((phaseEvent) => phaseEvent.phase === "fresh-qc" && phaseEvent.status === "COMPLETED")) {
      // Resume: reuse the durable QC round. The answer-key judge is
      // non-deterministic, so re-running it would break QC-round idempotency on
      // replay; the committed round is authoritative (mirrors canonical review).
      const stored = await this.#dependencies.qc.getRound(input.bookId, roundId);
      if (!stored.ok) {
        await this.#event(runId, input.bookId, "fresh-qc", "FAILED", stored.error.message, identity(candidate));
        return failed("BOOK_RUN_QC_FAILED", stored.error.message);
      }
      qc = stored;
    } else {
      // Initial: deterministic gates + the LLM answer-key judge, the latter run
      // as per-question model work under a dedicated fresh-qc run, then committed.
      const judged = await this.#runFreshQcWithJudge(input, runId, candidate, review.value, roundId);
      if (!judged.ok) {
        await this.#event(runId, input.bookId, "fresh-qc", "FAILED", judged.error.message, identity(candidate));
        return judged;
      }
      qc = judged;
    }
    if (qc.value.outcome === "ERROR") {
      await this.#event(runId, input.bookId, "fresh-qc", "FAILED", "fresh QC outcome=ERROR", identity(candidate));
      return failed("BOOK_RUN_QC_FAILED", "fresh QC outcome=ERROR");
    }
    const qcCompleted = await this.#event(runId, input.bookId, "fresh-qc", "COMPLETED", `outcome=${qc.value.outcome};roundId=${qc.value.roundId}`, identity(candidate));
    if (!qcCompleted.ok) return qcCompleted;

    if (qc.value.outcome === "FAIL") {
      if (!this.#dependencies.repair) {
        const message = "fresh QC failed and candidate repair is not composed";
        await this.#event(runId, input.bookId, "repair", "FAILED", message, identity(candidate));
        return failed("BOOK_RUN_REPAIR_UNAVAILABLE", message);
      }
      const repairStarted = await this.#event(runId, input.bookId, "repair", "STARTED", `failedRoundId=${qc.value.roundId}`, identity(candidate));
      if (!repairStarted.ok) return repairStarted;
      const repaired = await this.#dependencies.repair.run({
        bookId: input.bookId,
        failedCandidate: identity(candidate),
        failedRoundId: qc.value.roundId,
        repairId: derivedId("repair", runId),
        successorCandidateId: derivedId("repair-candidate", runId),
        reviewId: derivedId("repair-review", runId),
        freshRoundId: derivedId("repair-qc", runId),
        repairRunId: derivedId("repair-run", runId),
        sourceGitSha: input.sourceGitSha,
        attemptRoot: resolve(input.attemptRoot, "repair"),
        signal: input.signal,
      });
      if (!repaired.ok) {
        await this.#event(runId, input.bookId, "repair", "FAILED", repaired.error.message, identity(candidate));
        return repaired;
      }
      candidate = repaired.value.successor;
      review = { ok: true, value: repaired.value.review };
      qc = { ok: true, value: repaired.value.qc };
      roundId = repaired.value.qc.roundId;
      if (repaired.value.status !== "PASS" || repaired.value.qc.outcome !== "PASS") {
        const message = `qc-diagnose ${input.bookId} --round ${repaired.value.qc.roundId} required before another repair`;
        await this.#event(runId, input.bookId, "repair", "FAILED", message, identity(candidate));
        return failed("REPAIR_DIAGNOSIS_REQUIRED", message);
      }
      const repairCompleted = await this.#event(runId, input.bookId, "repair", "COMPLETED", `roundId=${roundId}`, identity(candidate));
      if (!repairCompleted.ok) return repairCompleted;
    } else {
      const repairSkipped = await this.#event(runId, input.bookId, "repair", "SKIPPED", "fresh QC passed", identity(candidate));
      if (!repairSkipped.ok) return repairSkipped;
    }

    if (!input.promoteLocal) {
      const skipped = await this.#event(runId, input.bookId, "promotion", "SKIPPED", "promoteLocal=false", identity(candidate));
      if (!skipped.ok) return skipped;
      return {
        ok: true,
        value: {
          schemaVersion: "1",
          runId,
          status: "READY",
          candidate: identity(candidate),
          reviewId: review.value.reviewId,
          qcRoundId: roundId,
        },
      };
    }

    const livePointer = await this.#dependencies.currentPointer.read(input.bookId);
    if (!livePointer.ok) {
      await this.#event(runId, input.bookId, "promotion", "FAILED", livePointer.error.message, identity(candidate));
      return failed("BOOK_RUN_PROMOTION_FAILED", livePointer.error.message);
    }
    const liveRevision = livePointer.value?.revision ?? 0;
    if (
      input.resumeRunId !== undefined
      && livePointer.value !== null
      && liveRevision === expectedBookRevision + 1
      && sameIdentity(livePointer.value, identity(candidate))
    ) {
      const current = await this.#dependencies.contentReader.open({
        bookId: input.bookId,
        selector: { kind: "CURRENT" },
      });
      if (
        !current.ok
        || current.value.currentRevision !== liveRevision
        || !sameIdentity(identity(current.value), identity(candidate))
      ) {
        const message = current.ok ? "resumed CURRENT readback does not match promoted candidate" : current.error.message;
        await this.#event(runId, input.bookId, "promotion", "FAILED", message, identity(candidate));
        return failed("BOOK_RUN_PROMOTION_FAILED", message);
      }
      const resumed = await this.#event(
        runId,
        input.bookId,
        "promotion",
        "COMPLETED",
        `bookRevision=${livePointer.value.revision};resumedReadback=VERIFIED`,
        identity(candidate),
      );
      if (!resumed.ok) return resumed;
      return {
        ok: true,
        value: {
          schemaVersion: "1",
          runId,
          status: "PROMOTED",
          candidate: identity(candidate),
          reviewId: review.value.reviewId,
          qcRoundId: roundId,
          bookRevision: livePointer.value.revision,
          readback: "VERIFIED",
        },
      };
    }
    if (liveRevision !== expectedBookRevision) {
      const message = `current pointer revision ${liveRevision} does not match original expected ${expectedBookRevision}`;
      await this.#event(runId, input.bookId, "promotion", "FAILED", message, identity(candidate));
      return failed("BOOK_RUN_POINTER_CONFLICT", message);
    }

    const promotionStarted = await this.#event(runId, input.bookId, "promotion", "STARTED", `expectedBookRevision=${expectedBookRevision}`, identity(candidate));
    if (!promotionStarted.ok) return promotionStarted;
    const promotedAt = safeNow(this.#dependencies.clock);
    if (!promotedAt.ok) return promotedAt;
    const promoted = await this.#dependencies.promotion.promote({
      bookId: input.bookId,
      candidate: identity(candidate),
      reviewId: review.value.reviewId,
      qcRoundId: roundId,
      expectedBookRevision,
      promotedAt: promotedAt.value,
    });
    if (!promoted.ok) {
      await this.#event(runId, input.bookId, "promotion", "FAILED", promoted.error.message, identity(candidate));
      return { ok: false, error: promoted.error };
    }
    if (promoted.value.readback !== "VERIFIED") {
      const message = "promotion readback is not VERIFIED";
      await this.#event(runId, input.bookId, "promotion", "FAILED", message, identity(candidate));
      return failed("BOOK_RUN_PROMOTION_FAILED", message);
    }
    const promotionCompleted = await this.#event(runId, input.bookId, "promotion", "COMPLETED", `bookRevision=${promoted.value.bookRevision}`, identity(candidate));
    if (!promotionCompleted.ok) return promotionCompleted;
    return {
      ok: true,
      value: {
        schemaVersion: "1",
        runId,
        status: "PROMOTED",
        candidate: identity(candidate),
        reviewId: review.value.reviewId,
        qcRoundId: roundId,
        bookRevision: promoted.value.bookRevision,
        readback: "VERIFIED",
      },
    };
  }
}
