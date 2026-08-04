import { createHash } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";

import type { BookContentReader, CandidateSnapshot } from "../books/candidateTypes.js";
import type { CurrentPointerStore } from "../books/currentPointer.js";
import type { CandidateIdentity, Result, UtcIso } from "../contracts/v4Core.js";
import { isSafeResearchRunId } from "../lib/researchRunManifest.js";
import type { QcRoundResult, QcService } from "../qc/qcTypes.js";
import type { PromotionService } from "../release/promotionTypes.js";
import type { CanonicalReviewResult, ReviewService } from "../review/reviewTypes.js";
import type { RunStore } from "../run-state/runStore.js";
import type { RunDefinition, RunSnapshot } from "../run-state/runTypes.js";
import type { StageCoordinator } from "../run-state/stageTypes.js";
import type { CandidateRepairApplicationPort } from "./candidateRepairApplicationPort.js";
import { QUIZ_JUDGE_MAX_ATTEMPTS, type CandidateQcEvaluator } from "./candidateQcEvaluator.js";
import type { CompilerApplicationPort } from "./compilerApplicationPort.js";
import { researchSourcesFromChapterIndex } from "./researchCandidateApplicationPort.js";
import type {
  ResearchCandidateApplicationPort,
  ResearchCandidateApplicationResult,
  ResearchCandidateSourceMapping,
} from "./researchCandidateApplicationPort.js";
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
  /**
   * Opt-in research-run pin for a content repair (friction F5). Names the exact
   * research run a FRESH run adopts, so research costs zero model calls and
   * every non-evicted section pack reuses from cache — only the evicted surfaces
   * re-draft. Mutually exclusive with resumeRunId: a resume rehydrates its
   * durable seed and never calls the research port, so a pin there would
   * silently do nothing, and accepting the combination would make the successor
   * exception reachable with a pin present. Composes with regen, which then
   * keeps ONLY its promotion-pointer meaning. Validated fail-closed by the
   * research port; it does NOT participate in run identity or in the intake bind.
   */
  readonly researchRunId?: string;
  readonly regen: boolean;
  readonly maxRepairRounds: 1;
  readonly promoteLocal: boolean;
  /**
   * Opt-in crash recovery for a resume. Threaded to the research and compiler
   * ports so a hard-killed run (which left an attempt admitted with no terminal
   * record) can be reconciled and resumed instead of fail-closing forever at
   * RESEARCH_ATTEMPT_UNCERTAIN / COMPILER_ATTEMPT_UNCERTAIN. Only meaningful with
   * resumeRunId; default (absent/false) preserves the fail-closed contract.
   */
  readonly reconcileUnsettled?: boolean;
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
  // 11j terminal codes: section exhausted on gateway schema rejections or
  // transient process/timeout failures — same operator-retry class as BLOCKED.
  "COMPILER_SECTION_MODEL_INVALID:",
  "COMPILER_SECTION_PROCESS_FAILED:",
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

/** The durable compiled-candidate identity a resumed run's compile phase already
 *  COMPLETED (task 11ab / finding 37), or null when no compile has completed. The
 *  compile COMPLETED event carries the compiled child candidate's identity; a run
 *  resumed after that event must rehydrate that exact candidate rather than re-derive
 *  compile state from the base compiler run (terminal FAILED, retryable) and enter the
 *  operator-grant scan, which fail-closes on the COMPLETED slot. Mirror of
 *  completedResearchSeed. */
function completedCompileCandidate(events: readonly BookRunEvent[]): Result<CandidateIdentity | null> {
  const candidates = events
    .filter((event) => event.phase === "compile" && event.status === "COMPLETED")
    .map((event) => event.candidate)
    .filter((candidate): candidate is CandidateIdentity => candidate !== undefined);
  if (candidates.length === 0) return { ok: true, value: null };
  if (candidates.some((candidate) => !sameIdentity(candidate, candidates[0]))) {
    return failed("BOOK_RUN_RESUME_UNAVAILABLE", "resume compile completion evidence conflicts");
  }
  return { ok: true, value: candidates[0] };
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
  // One admission per judge ATTEMPT, not per question: each question gets up to
  // QUIZ_JUDGE_MAX_ATTEMPTS distinct attempt ids (a transient timeout or invalid
  // JSON shape from one single-shot call was previously committed as a durable
  // CANDIDATE_QC_QUIZ_JUDGE_ERROR blocker that repair rejects as compiler-owned
  // and resume replays forever — a permanent dead end from one flaky call).
  const capacity = Math.max(1, input.questionCount * QUIZ_JUDGE_MAX_ATTEMPTS);
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

  /** True iff a research intake bound to a run OTHER than the resumed run is a
   *  legitimate successor-recovery of that exact run. Fail-closed source-integrity
   *  boundary (task 11e): the successor is accepted only when BOTH hold —
   *   1. the port attests it recovered from the exact resumed run
   *      (`recoveredFromRunId === predecessorRunId`), on a resume marked resumed, and
   *   2. that successor run is a genuine COMPLETED run in THIS book's durable
   *      run-state (same bookId).
   *  Both facts are read from the pipeline's own durable journal — run-state and
   *  the port's structured attestation — never from the intake artifacts, so a
   *  foreign research run (different book/root) or a fabricated provenance claim
   *  can never be intaken. */
  async #successorChainBindsRun(
    bookId: string,
    predecessorRunId: string,
    intake: ResearchCandidateApplicationResult,
  ): Promise<boolean> {
    if (intake.resumed !== true) return false;
    if (intake.recoveredFromRunId !== predecessorRunId) return false;
    const observedAt = safeNow(this.#dependencies.clock);
    if (!observedAt.ok) return false;
    const successor = await this.#dependencies.runStore.readRun(bookId, intake.intakeRunId, observedAt.value);
    if (!successor.ok) return false;
    return successor.value.status === "COMPLETED" && successor.value.definition.bookId === bookId;
  }

  /** Post-recovery resume rehydrate (task 11g / finding 10). Once durable
   *  research+seed COMPLETED events exist for the resumed run, the research phase
   *  is DONE and MUST NOT be re-run: re-invoking the port would re-read the
   *  terminal-FAILED predecessor and mint a SECOND successor whose candidate id
   *  diverges from the durable seed, fail-closing at BOOK_RUN_RESEARCH_MISMATCH.
   *  Instead, rehydrate the exact durable seed candidate from the candidate store
   *  and reconstruct the compiler inputs from its own chapter index. Fail closed —
   *  never silently re-research — when the recorded seed candidate is unavailable
   *  or its manifest digest does not match the durable seed identity. */
  async #rehydrateDurableSeed(
    bookId: string,
    durableSeed: CandidateIdentity,
  ): Promise<Result<Readonly<{
    candidate: CandidateIdentity;
    indexLogicalPath: "inputs/chapter-index.json";
    sectionTaskContextLogicalPath: "inputs/compiler-section-task-context.json";
    sources: readonly ResearchCandidateSourceMapping[];
  }>>> {
    const opened = await this.#dependencies.contentReader.open({
      bookId,
      selector: { kind: "CANDIDATE", candidateId: durableSeed.candidateId },
    });
    if (!opened.ok) {
      return failed("BOOK_RUN_SEED_REHYDRATE_FAILED", `durable seed candidate ${durableSeed.candidateId} is unavailable: ${opened.error.message}`);
    }
    if (opened.value.manifest.manifestDigest !== durableSeed.manifestDigest) {
      return failed("BOOK_RUN_SEED_REHYDRATE_FAILED", "durable seed candidate digest does not match recorded seed identity");
    }
    const indexFile = opened.value.files.find((file) => file.logicalPath === "inputs/chapter-index.json");
    if (!indexFile) {
      return failed("BOOK_RUN_SEED_REHYDRATE_FAILED", "durable seed candidate lacks chapter index");
    }
    let sources: readonly ResearchCandidateSourceMapping[];
    try {
      sources = researchSourcesFromChapterIndex(indexFile.bytes);
    } catch (cause) {
      return failed("BOOK_RUN_SEED_REHYDRATE_FAILED", (cause as Error).message);
    }
    return {
      ok: true,
      value: Object.freeze({
        candidate: {
          candidateId: opened.value.manifest.candidateId,
          manifestDigest: opened.value.manifest.manifestDigest,
        },
        indexLogicalPath: "inputs/chapter-index.json",
        sectionTaskContextLogicalPath: "inputs/compiler-section-task-context.json",
        sources,
      }),
    };
  }

  /** Post-recovery resume rehydrate for a durably-COMPLETED compile (task 11ab /
   *  finding 37). Once a durable compile COMPLETED event exists for the resumed run,
   *  compile is DONE and MUST NOT be re-derived from the base compiler run: that run
   *  is terminal FAILED (retryable) but compile actually SUCCEEDED via an operator
   *  slot, so re-entering the exhausted/grant scan fail-closes on the COMPLETED slot
   *  ("...is COMPLETED, not re-grantable" / RETRY_EXHAUSTED). Instead, rehydrate the
   *  exact staged compiled candidate the event recorded, digest-validated against the
   *  candidate store. Fail closed — never silently re-compile — when that candidate is
   *  unavailable or its manifest digest does not match the durable compile identity.
   *  Mirror of #rehydrateDurableSeed. */
  async #rehydrateDurableCompile(
    bookId: string,
    durableCompiled: CandidateIdentity,
  ): Promise<Result<CandidateSnapshot>> {
    const opened = await this.#dependencies.contentReader.open({
      bookId,
      selector: { kind: "CANDIDATE", candidateId: durableCompiled.candidateId },
    });
    if (!opened.ok) {
      return failed("BOOK_RUN_COMPILE_REHYDRATE_FAILED", `durable compiled candidate ${durableCompiled.candidateId} is unavailable: ${opened.error.message}`);
    }
    if (opened.value.manifest.manifestDigest !== durableCompiled.manifestDigest) {
      return failed("BOOK_RUN_COMPILE_REHYDRATE_FAILED", "durable compiled candidate digest does not match recorded compile identity");
    }
    return { ok: true, value: opened.value };
  }

  /** Allocate the next operator-authorized compile control run past an exhausted
   *  deterministic retry budget (task 11i / finding 12). Enumerates the
   *  `compiler-operator-retry-{n}-run` ids for the resumed run and grants the first
   *  slot that is not already a terminal FAILED run: every lower-numbered operator
   *  attempt has already FAILED, so exactly one fresh attempt is minted per flagged
   *  resume. `priorExhaustedAttempts` counts the durable failures the operator is
   *  authorizing past — the base compile plus the single deterministic retry
   *  (2) plus each prior operator attempt (`operatorAttempt - 1`).
   *
   *  A RUNNING operator-retry run is the FINDING-25 wedge: an earlier grant was
   *  admitted (run RUNNING) but crashed INSIDE the grant (e.g. ENOSPC at the
   *  `.writer.lock` mkdir) before its section attempt could settle, leaving a
   *  durably RUNNING run with an admitted-unsettled attempt. Failing closed on it
   *  wedges the book-run forever. Under operator consent (`reconcileUnsettled`) such
   *  a slot is instead returned as a `RECONCILE_WEDGED` directive: the caller resumes
   *  THAT run through the compiler resume+reconcile machinery (task 11c), which
   *  settles the unsettled attempt ABANDONED with the RECONCILED marker and drives the
   *  crashed run to terminal FAILED. Per-invocation consent (task 11i) is spent
   *  un-wedging; the NEXT slot is granted only on a further explicit flagged resume —
   *  mirroring how a RUNNING base compiler run reconciles-then-requires-resume, never a
   *  silent same-invocation loop. Any OTHER non-FAILED state (a lost race, a
   *  cancellation, or a partially-written run), and a RUNNING slot WITHOUT consent,
   *  still fail closed: such a run must never be silently re-granted. */
  async #grantOperatorCompileRetry(
    bookId: string,
    runId: string,
    observedAt: UtcIso,
    reconcileUnsettled: boolean,
  ): Promise<Result<Readonly<
    | {
        kind: "GRANT";
        compilerRunId: string;
        attemptSubdir: string;
        operatorAttempt: number;
        priorExhaustedAttempts: number;
      }
    | {
        kind: "RECONCILE_WEDGED";
        compilerRunId: string;
        attemptSubdir: string;
        operatorAttempt: number;
      }
  >>> {
    for (let operatorAttempt = 1; ; operatorAttempt += 1) {
      const operatorRunId = derivedId(`compiler-operator-retry-${operatorAttempt}-run`, runId);
      const existing = await this.#dependencies.runStore.readRun(bookId, operatorRunId, observedAt);
      if (existing.ok) {
        if (existing.value.status === "FAILED") continue;
        if (existing.value.status === "RUNNING" && reconcileUnsettled) {
          return {
            ok: true,
            value: Object.freeze({
              kind: "RECONCILE_WEDGED" as const,
              compilerRunId: operatorRunId,
              attemptSubdir: `compiler-operator-retry-${operatorAttempt}`,
              operatorAttempt,
            }),
          };
        }
        return failed(
          "BOOK_RUN_COMPILER_RETRY_BLOCKED",
          `operator compile retry run ${operatorRunId} is ${existing.value.status}, not re-grantable`,
        );
      }
      if (existing.error.code !== "NOT_FOUND") {
        return failed("BOOK_RUN_COMPILER_UNAVAILABLE", existing.error.message);
      }
      return {
        ok: true,
        value: Object.freeze({
          kind: "GRANT" as const,
          compilerRunId: operatorRunId,
          attemptSubdir: `compiler-operator-retry-${operatorAttempt}`,
          operatorAttempt,
          // base compile + single deterministic retry (2) + prior operator failures.
          priorExhaustedAttempts: operatorAttempt + 1,
        }),
      };
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
    const observedAt = safeNow(this.#dependencies.clock);
    if (!observedAt.ok) return observedAt;
    // Resume-safety: the judge run's identity is deep-equality including createdAt,
    // so a fresh createdAt on resume would CONFLICT with a judge run already written
    // to disk before a crash. Mirror the reader-lane/repair-review runners: read the
    // prior run and reuse its createdAt. A prior run that already reached COMPLETED
    // committed the durable QC round; re-running the non-deterministic judge would
    // break round idempotency, so resume from the committed round instead.
    let createdAt = observedAt.value;
    const prior = await this.#dependencies.runStore.readRun(input.bookId, judgeRunId, observedAt.value);
    if (prior.ok) {
      createdAt = prior.value.definition.createdAt;
      // The COMMITTED ROUND is the durable authority, not the judge run's
      // status. The round is committed BEFORE the run is finished COMPLETED
      // (see below), so on resume: a round present means the judge's work is
      // durable regardless of run status — return it (and best-effort settle a
      // run the crash left RUNNING). A COMPLETED run without a round was
      // previously a permanent wedge (getRound -> QC_ROUND_NOT_FOUND on every
      // resume, with the non-deterministic judge barred from re-running); the
      // new ordering makes that state unreachable for runs created by this
      // code, and for legacy runs the error below is at least honest.
      const committed = await this.#dependencies.qc.getRound(input.bookId, roundId);
      if (committed.ok) {
        if (prior.value.status === "RUNNING") {
          const settleAt = safeNow(this.#dependencies.clock);
          if (settleAt.ok) {
            await this.#dependencies.runStore.finishRun({
              bookId: input.bookId,
              runId: judgeRunId,
              status: "COMPLETED",
              finishedAt: settleAt.value,
            });
          }
        }
        return committed;
      }
      if (prior.value.status === "COMPLETED") {
        return failed(
          "BOOK_RUN_QC_UNAVAILABLE",
          `fresh-qc judge run is COMPLETED but its round is missing (${committed.error.code}) — legacy ordering wedge; the judge cannot legally re-run`,
        );
      }
    } else if (prior.error.code !== "NOT_FOUND") {
      return failed("BOOK_RUN_QC_UNAVAILABLE", `${prior.error.code}:${prior.error.message}`);
    }
    const created = await this.#dependencies.runStore.createRun(freshQcRunDefinition({
      bookId: input.bookId,
      runId: judgeRunId,
      sourceGitSha: input.sourceGitSha,
      candidate,
      createdAt,
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
    if (!evaluation.ok) {
      const failedAt = safeNow(this.#dependencies.clock);
      if (failedAt.ok) {
        await this.#dependencies.runStore.finishRun({
          bookId: input.bookId,
          runId: judgeRunId,
          status: "FAILED",
          finishedAt: failedAt.value,
          reason: evaluation.error.code,
        });
      }
      return evaluation;
    }
    // Crash-safe ordering: commit the durable QC round FIRST, finish the judge
    // run COMPLETED second — the same order every other store uses (the review
    // service stores the review before exactReview finishes its run; the repair
    // port commits its round before its run terminal). The previous order
    // finished the run COMPLETED and THEN committed the round, so a crash or a
    // transient commit failure in between left a COMPLETED run with no round —
    // and because the judge is non-deterministic, resume could never legally
    // re-run it: the run was wedged one step before promotion with all its
    // model spend stranded. If the commit fails now, the run stays RUNNING and
    // a resume re-enters cleanly; if the process dies after the commit, resume
    // finds the round and settles the run.
    const round = await this.#dependencies.qc.runFresh({ roundId, candidate, canonicalReview: review, evaluation: evaluation.value });
    if (!round.ok) return round;
    const finishedAt = safeNow(this.#dependencies.clock);
    if (finishedAt.ok) {
      await this.#dependencies.runStore.finishRun({
        bookId: input.bookId,
        runId: judgeRunId,
        status: "COMPLETED",
        finishedAt: finishedAt.value,
      });
    }
    return round;
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
    if (input.researchRunId !== undefined && input.resumeRunId !== undefined) {
      return failed("BOOK_RUN_INPUT_INVALID", "researchRunId and resumeRunId are mutually exclusive");
    }
    // Shape-validate at the INPUT boundary, not just in the research port. The
    // port's check (isSafeResearchRunId, applied at path-resolution time) is the
    // path-traversal guard; this one exists because the value reaches an operator
    // audit line on stderr BEFORE the port ever runs. Without it, a newline-bearing
    // id forges additional "[book-run] …" records in the operator's own log.
    if (input.researchRunId !== undefined && !isSafeResearchRunId(input.researchRunId)) {
      return failed("BOOK_RUN_INPUT_INVALID", "researchRunId must be one opaque path segment: [A-Za-z0-9][A-Za-z0-9._-]{0,127}");
    }
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
    let intake: Readonly<{
      candidate: CandidateIdentity;
      indexLogicalPath: "inputs/chapter-index.json";
      sectionTaskContextLogicalPath: "inputs/compiler-section-task-context.json";
      sources: readonly ResearchCandidateSourceMapping[];
    }>;
    if (rehydrateSeed && durableSeed !== null) {
      // Research already COMPLETED durably for this run (task 11g / finding 10):
      // do NOT re-invoke the research port — that would mint a divergent second
      // successor and fail-close at RESEARCH_MISMATCH. Rehydrate the exact durable
      // seed candidate from the candidate store instead; the research/seed phase
      // events already exist and are not re-emitted.
      const rehydrated = await this.#rehydrateDurableSeed(input.bookId, durableSeed);
      if (!rehydrated.ok) return rehydrated;
      intake = rehydrated.value;
    } else {
      const researchStarted = await this.#event(runId, input.bookId, "research", "STARTED");
      if (!researchStarted.ok) return researchStarted;
      let researched: ResearchCandidateApplicationResult;
      if (input.researchRunId !== undefined && input.regen) {
        // --regen is overloaded. Split the axes rather than rejecting the pair:
        // regen keeps its BOOK_RUN_ALREADY_PROMOTED bypass (without it the pin
        // would be unusable on any previously-promoted book — precisely the
        // second-repair case F5 exists for), while the research axis belongs to
        // the pin. Never silent.
        console.error(
          `[book-run] research-pin book=${input.bookId} pinned-research-run=${input.researchRunId} regen=true action=REGEN_SUPERSEDES_POINTER_ONLY`,
        );
      }
      try {
        researched = await this.#dependencies.research.run({
          bookId: input.bookId,
          title: input.title,
          author: input.author,
          sourceGitSha: input.sourceGitSha,
          v25Root: input.v25Root,
          attemptRoot: resolve(input.attemptRoot, "research"),
          ...(input.resumeRunId === undefined ? { newRunId: runId } : { resumeRunId: input.resumeRunId }),
          ...(input.researchRunId === undefined ? {} : { researchRunId: input.researchRunId }),
          // The --regen split: a pin owns the research axis, so regen retains
          // only its promotion-pointer meaning (the ALREADY_PROMOTED bypass
          // above). Unpinned behaviour is byte-unchanged.
          forceRefresh: input.researchRunId === undefined && input.regen,
          reconcileUnsettled: input.reconcileUnsettled === true,
          signal: input.signal,
        });
      } catch (cause) {
        const message = (cause as Error).message;
        await this.#event(runId, input.bookId, "research", "FAILED", message);
        return failed("BOOK_RUN_RESEARCH_FAILED", message);
      }
      const boundToCurrentRun = researched.intakeRunId === runId;
      // A successor-recovery intake (finding 8 / task 11d) legitimately returns
      // artifacts bound to a fresh successor control run rather than the resumed
      // run. Accept it ONLY when its durable provenance chains to the exact run we
      // asked to resume: the port attests the predecessor link (recoveredFromRunId)
      // AND that successor run is a genuine COMPLETED run in THIS book's durable
      // run-state. The corroboration is read from run-state — the pipeline's own
      // journal — never from the intake artifacts, so a foreign or forged research
      // run (wrong book/root, or a fabricated provenance claim) can never masquerade
      // as this book-run's research. A single attested hop suffices: every book-run
      // resume presents the original resumed run id, and each recovery mints exactly
      // one successor off it.
      // A --research-run-id pin selects which research BUNDLE the researcher reads
      // and never the control-run bind: it is mutually exclusive with resumeRunId,
      // so a pinned run always presents intakeRunId === runId and can never reach
      // the successor exception below.
      const successorAccepted = !boundToCurrentRun
        && input.resumeRunId !== undefined
        && await this.#successorChainBindsRun(input.bookId, runId, researched);
      if ((!boundToCurrentRun && !successorAccepted) || researched.bookId !== input.bookId) {
        const message = "research intake does not bind exact production run and book";
        await this.#event(runId, input.bookId, "research", "FAILED", message);
        return failed("BOOK_RUN_RESEARCH_MISMATCH", message);
      }
      if (successorAccepted) {
        console.error(
          `[book-run] research-intake-successor book=${input.bookId} resumed-run=${runId} successor-run=${researched.intakeRunId} action=ACCEPT_SUCCESSOR_CHAIN`,
        );
      }
      const researchCompleted = await this.#event(
        runId,
        input.bookId,
        "research",
        "COMPLETED",
        `intakeRunId=${researched.intakeRunId};researchRunId=${researched.researchRunId}${input.researchRunId === undefined ? "" : `;pinnedResearchRunId=${input.researchRunId}`}`,
      );
      if (!researchCompleted.ok) return researchCompleted;
      const seedStarted = await this.#event(runId, input.bookId, "seed", "STARTED");
      if (!seedStarted.ok) return seedStarted;
      const seedCompleted = await this.#event(runId, input.bookId, "seed", "COMPLETED", undefined, researched.candidate);
      if (!seedCompleted.ok) return seedCompleted;
      intake = {
        candidate: researched.candidate,
        indexLogicalPath: researched.indexLogicalPath,
        sectionTaskContextLogicalPath: researched.sectionTaskContextLogicalPath,
        sources: researched.sources,
      };
    }

    const durableCompiled = completedCompileCandidate(priorEvents);
    if (!durableCompiled.ok) return durableCompiled;
    let candidate: CandidateSnapshot;
    if (input.resumeRunId !== undefined && durableCompiled.value !== null) {
      // Compile already COMPLETED durably for this run (task 11ab / finding 37) — via
      // an operator-retry slot whose control run is COMPLETED while the base compiler
      // run is terminal FAILED (retryable). Re-deriving compile state from that base
      // run would enter the exhausted/grant scan, which fail-closes on the COMPLETED
      // operator slot ("...is COMPLETED, not re-grantable" / RETRY_EXHAUSTED). Instead
      // rehydrate the exact staged compiled candidate the durable event recorded,
      // digest-validated against the candidate store; the compile phase events already
      // exist and are NOT re-emitted. Touch neither the compiler nor the grant scan —
      // proceed to the next incomplete stage (review). Mirror of the durable-seed
      // short-circuit (11g).
      const rehydrated = await this.#rehydrateDurableCompile(input.bookId, durableCompiled.value);
      if (!rehydrated.ok) return rehydrated;
      candidate = rehydrated.value;
      console.error(
        `[book-run] compile-rehydrate book=${input.bookId} run=${runId} candidate=${durableCompiled.value.candidateId} action=REHYDRATE_DURABLE_COMPILE`,
      );
    } else {
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
          // CANCELLED joins FAILED as a consumed slot. A SIGINT during the
          // deterministic retry — the CLI's own documented cancellation path —
          // leaves the retry run terminal-CANCELLED; resuming it verbatim just
          // makes the compiler port throw MODEL_RUN_CANCELLED on every resume,
          // wedging the book forever (observed live on the Franklin canary).
          // Cancellation stays terminal for THAT run; stepping past it costs the
          // same explicit per-invocation consent as an exhausted retry.
          const retryConsumed = retryCompiler.ok
            && (retryCompiler.value.status === "FAILED"
              || retryCompiler.value.status === "CANCELLED"
              || retryCompiler.value.status === "CANCEL_REQUESTED");
          if (retryConsumed) {
            // The single deterministic compiler retry (service-level, one shot) has
            // already failed. Default (no flag): fail closed, preserving the exhausted
            // contract verbatim. The service-level retry budget cannot tell "failed
            // under a since-fixed defect" from "content genuinely cannot pass", so a
            // resume that survived earlier recovery fixes could otherwise be blocked
            // one stage later forever. An operator resolves that ambiguity explicitly:
            // resuming with --reconcile-unsettled is per-invocation consent for exactly
            // ONE additional compile attempt past the exhausted budget. Each grant
            // mints a distinct operator-retry control run and is durably logged; a
            // further grant requires another explicit flagged resume (no silent loop),
            // and the in-run deterministic retry / MAX_SECTION_ATTEMPTS logic is
            // untouched — this is a resume-boundary decision only.
            if (input.reconcileUnsettled !== true) {
              return failed(
                "BOOK_RUN_COMPILER_RETRY_EXHAUSTED",
                retryCompiler.ok && retryCompiler.value.status === "FAILED"
                  ? "single deterministic compiler retry already failed"
                  : "single deterministic compiler retry was cancelled; resume with --reconcile-unsettled to grant the next compile slot",
              );
            }
            const granted = await this.#grantOperatorCompileRetry(input.bookId, runId, retryAt.value, input.reconcileUnsettled === true);
            if (!granted.ok) return granted;
            compilerRunId = granted.value.compilerRunId;
            compilerAttemptRoot = resolve(input.attemptRoot, granted.value.attemptSubdir);
            if (granted.value.kind === "RECONCILE_WEDGED") {
              // FINDING 25: a prior operator grant crashed INSIDE the grant (e.g. ENOSPC),
              // leaving its control run durably RUNNING with an admitted-unsettled attempt.
              // Resume THAT run through the same compiler resume+reconcile machinery (11c)
              // that un-wedges a crashed base compile: the compile call below settles the
              // unsettled attempt ABANDONED (RECONCILED marker) and drives the crashed run
              // to terminal FAILED, then fails closed. This flagged invocation's consent is
              // spent un-wedging; the operator grants the NEXT slot with a further flagged
              // resume (which then finds this run FAILED and steps past it).
              const authorized = await this.#event(
                runId,
                input.bookId,
                "compile",
                "STARTED",
                `action=OPERATOR_COMPILE_RECONCILE_WEDGED;operatorAttempt=${granted.value.operatorAttempt}`,
              );
              if (!authorized.ok) return authorized;
              console.error(
                `[book-run] operator-compile-reconcile-wedged book=${input.bookId} run=${runId} operatorAttempt=${granted.value.operatorAttempt} wedgedRun=${granted.value.compilerRunId} action=OPERATOR_COMPILE_RECONCILE_WEDGED`,
              );
            } else {
              const authorized = await this.#event(
                runId,
                input.bookId,
                "compile",
                "STARTED",
                `action=OPERATOR_COMPILE_RETRY;priorExhaustedAttempts=${granted.value.priorExhaustedAttempts};operatorAttempt=${granted.value.operatorAttempt}`,
              );
              if (!authorized.ok) return authorized;
              console.error(
                `[book-run] operator-compile-retry book=${input.bookId} run=${runId} operatorAttempt=${granted.value.operatorAttempt} priorExhaustedAttempts=${granted.value.priorExhaustedAttempts} action=OPERATOR_COMPILE_RETRY`,
              );
            }
          } else if (!retryCompiler.ok && retryCompiler.error.code !== "NOT_FOUND") {
            return failed("BOOK_RUN_COMPILER_UNAVAILABLE", retryCompiler.error.message);
          } else {
            compilerRunId = retryRunId;
            compilerAttemptRoot = resolve(input.attemptRoot, "compiler-retry-1");
          }
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
          reconcileUnsettled: input.reconcileUnsettled === true,
          signal: input.signal,
        });
      } catch (cause) {
        const message = (cause as Error).message;
        await this.#event(runId, input.bookId, "compile", "FAILED", message, intake.candidate);
        return failed("BOOK_RUN_COMPILER_FAILED", message);
      }
      const selected = await this.#dependencies.contentReader.open({
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
      candidate = selected.value;
      const compileCompleted = await this.#event(runId, input.bookId, "compile", "COMPLETED", `compilerRunId=${compiled.runId}`, identity(candidate));
      if (!compileCompleted.ok) return compileCompleted;
    }

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
    // Task 11ac / finding 38 LAYER B — ERROR-review successor on flagged resume.
    // A stored canonical review whose outcome is ERROR is UNCERTAINTY (a transient
    // reader-lane failure fail-closed the panel), NOT a verdict — yet the exact-single-
    // attempt review run persists it as canonical, so every resume replays the ERROR
    // with ZERO model calls. Under per-invocation operator consent (--reconcile-unsettled)
    // it is superseded EXACTLY ONCE by a fresh full-panel review keyed off a distinct
    // seed (fresh reviewId / run / attempt), mirroring the research (11d) and compile
    // (operator-slot) successor paths. A stored FAIL is deliberately NOT eligible: FAIL is
    // a real verdict repair machinery owns, so `outcome === "ERROR"` gates this exactly.
    // Fresh-QC binds to the review id it is handed, so reassigning `review` to the
    // successor keeps downstream identity coherent. Idempotent on repeated flagged
    // resumes: the successor's own exact-review run replays its stored result model-free.
    if (review.ok && review.value.outcome === "ERROR" && input.reconcileUnsettled === true) {
      const predecessorReviewId = review.value.reviewId;
      const successorStarted = await this.#event(
        runId,
        input.bookId,
        "review",
        "STARTED",
        `action=REVIEW_SUCCESSOR;predecessorReviewId=${predecessorReviewId}`,
        identity(candidate),
      );
      if (!successorStarted.ok) return successorStarted;
      console.error(
        `[book-run] review-successor book=${input.bookId} run=${runId} predecessorReviewId=${predecessorReviewId} action=REVIEW_SUCCESSOR`,
      );
      review = await exactReview(this.#dependencies, {
        bookId: input.bookId,
        sourceGitSha: input.sourceGitSha,
        parentRunId: derivedId("review-successor-1", runId),
        candidate,
        attemptRoot: resolve(input.attemptRoot, "review-successor-1"),
        signal: input.signal,
      });
    }
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
