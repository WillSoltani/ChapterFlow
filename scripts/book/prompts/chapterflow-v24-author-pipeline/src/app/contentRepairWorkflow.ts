import type { CandidateInputFile, CandidateSnapshot, CandidateStore } from "../books/candidateTypes.js";
import type {
  CandidateIdentity,
  ModelTaskContext,
  PlannedArtifact,
  QcRoundId,
  RepairId,
  Result,
  ReviewId,
} from "../contracts/v4Core.js";
import type { RepairService } from "../qc/repairCoordinator.js";
import type { RepairHistoryStore } from "../qc/repairHistoryStore.js";
import type { QcRoundResult } from "../qc/qcTypes.js";
import type { CanonicalReviewResult, ReviewService } from "../review/reviewTypes.js";

export interface ContentRepairRequest {
  readonly bookId: string;
  readonly failedCandidate: CandidateIdentity;
  readonly failedRoundId: QcRoundId;
  readonly diagnosisId?: string;
  readonly repairId: RepairId;
  readonly successorCandidateId: string;
  readonly reviewId: ReviewId;
  readonly freshRoundId: QcRoundId;
  readonly expectedInventory: readonly PlannedArtifact[];
  readonly files: readonly CandidateInputFile[];
  readonly createdAt: string;
  readonly taskContext: ModelTaskContext;
  /** Threaded to the successor QC judge run definition — the answer-key judge
   *  needs its own run-state run, and a run definition requires the source SHA. */
  readonly sourceGitSha: string;
}

export interface ContentRepairDependencies {
  readonly candidates: CandidateStore;
  readonly repairs: RepairService;
  readonly reviews: ReviewService;
  readonly successorQc: SuccessorQcOperation;
  readonly history: RepairHistoryStore;
}

export interface SuccessorQcOperation {
  run(input: Readonly<{
    bookId: string;
    roundId: QcRoundId;
    candidate: CandidateSnapshot;
    canonicalReview: CanonicalReviewResult;
    /** For the judge run definition: a successor round must re-run the LLM
     *  answer-key judge (a repair rewrites quizzes, and round 1 may have FAILED
     *  precisely on a wrong key), and that judge needs its own run. Without
     *  these the composition could only build a deterministic-gates evaluator —
     *  which silently skipped the judge and could promote unverified keys. */
    sourceGitSha: string;
    signal: AbortSignal;
  }>): Promise<Result<QcRoundResult>>;
}

export interface ContentRepairResult {
  readonly status: "PASS" | "REPAIR_UNSUCCESSFUL";
  readonly ordinal: number;
  readonly predecessor: CandidateSnapshot;
  readonly successor: CandidateSnapshot;
  readonly review: CanonicalReviewResult;
  readonly qc: QcRoundResult;
}

function failed<T>(code: string, message: string): Result<T> {
  return { ok: false, error: { code, message } };
}

function identityOf(candidate: CandidateSnapshot): CandidateIdentity {
  return { candidateId: candidate.manifest.candidateId, manifestDigest: candidate.manifest.manifestDigest };
}

function sameIdentity(left: CandidateIdentity, right: CandidateIdentity): boolean {
  return left.candidateId === right.candidateId && left.manifestDigest === right.manifestDigest;
}

function requireActive(request: ContentRepairRequest, where: string): Result<true> {
  return request.taskContext.signal.aborted
    ? failed("REPAIR_CANCELLED", `repair cancelled ${where}`)
    : { ok: true, value: true };
}

async function openExact(
  candidates: CandidateStore,
  bookId: string,
  expected: CandidateIdentity,
): Promise<Result<CandidateSnapshot>> {
  const opened = await candidates.open({ bookId, selector: { kind: "CANDIDATE", candidateId: expected.candidateId } });
  if (!opened.ok) return opened;
  return sameIdentity(identityOf(opened.value), expected)
    ? opened
    : failed("REPAIR_CANDIDATE_STALE", `candidate digest differs: ${expected.candidateId}`);
}

/**
 * Bounded canonical-review attempts for ONE repair transition: the base review
 * plus up to two ERROR successors of the SAME already-staged successor.
 *
 * Three, not more: a review is a full blind-panel read of every chapter — the
 * most expensive judgment in the pipeline — and the reader lane already retries
 * each seat inside its own bounded budget. Three consecutive panel-level ERRORs
 * on one candidate is no longer a blip worth another panel; it is an infra
 * signal the operator should see, which is exactly what REPAIR_REVIEW_ERROR is.
 */
export const MAX_REPAIR_REVIEW_ATTEMPTS = 3;

/**
 * The failure code + terminal-reason marker for "the review never produced a
 * verdict", kept DISTINCT from REPAIR_REVIEW_FAILED (a real FAIL verdict).
 *
 * The reason lives in the MESSAGE, not just the code, because the port records a
 * failed repair run with `reason: workflow.error.message` — the code never
 * reaches run-state. Self-identifying messages are the established convention
 * here (`RETRYABLE_COMPILER_FAILURES` prefix-matches compiler messages the same
 * way).
 */
export const REPAIR_REVIEW_ERROR_CODE = "REPAIR_REVIEW_ERROR";
export const REPAIR_REVIEW_ERROR_REASON_PREFIX = "REPAIR_REVIEW_ERROR:";

/** True when a repair run's terminal reason says its review ERRORED rather than
 *  returned a verdict — an INFRA outcome, so the ordinal it burned was never a
 *  judgment about the book. */
export function isRepairReviewErrorTerminalReason(reason: string | undefined): boolean {
  return reason !== undefined && reason.startsWith(REPAIR_REVIEW_ERROR_REASON_PREFIX);
}

/**
 * Every review id ONE repair transition may execute under, in attempt order.
 *
 * A retry MUST use a fresh id: `CanonicalReviewService.reviewCanonical` is keyed
 * by review id and returns the stored record when one exists, so re-reviewing
 * under the base id would replay the stored ERROR with zero model calls forever.
 * The series is DERIVED, not random, so a resume re-derives the same ids and the
 * port can recognize which review authorized a completed successor.
 */
export function repairReviewIdSeries(reviewId: string): readonly string[] {
  const ids: string[] = [reviewId];
  for (let attempt = 2; attempt <= MAX_REPAIR_REVIEW_ATTEMPTS; attempt += 1) ids.push(`${reviewId}-e${attempt}`);
  return Object.freeze(ids);
}

/** The review must be THIS review of THIS successor before its outcome means
 *  anything. Separated from the outcome check so an ERROR (uncertainty, retried)
 *  and a stale record (never retried) stay different answers. */
function validateReviewIdentity(review: CanonicalReviewResult, successor: CandidateSnapshot, reviewId: string): Result<true> {
  return review.reviewId === reviewId && sameIdentity(review.candidate, identityOf(successor))
    ? { ok: true, value: true }
    : failed("REPAIR_REVIEW_STALE", "canonical review does not authorize successor candidate");
}

function validateQcResult(
  result: QcRoundResult,
  request: ContentRepairRequest,
  successor: CandidateSnapshot,
  reviewId: string,
): Result<QcRoundResult> {
  if (result.roundId !== request.freshRoundId
    || result.reviewId !== reviewId
    || !sameIdentity(result.candidate, identityOf(successor))) {
    return failed("REPAIR_QC_STALE", "QC result does not authorize fresh successor candidate");
  }
  return { ok: true, value: result };
}

export async function runContentRepairWorkflow(
  request: ContentRepairRequest,
  dependencies: ContentRepairDependencies,
): Promise<Result<ContentRepairResult>> {
  if (request.freshRoundId === request.failedRoundId) {
    return failed("REPAIR_QC_ROUND_REUSED", "content repair requires a fresh QC round");
  }
  if (request.taskContext.bookId !== request.bookId) {
    return failed("REPAIR_CONTEXT_MISMATCH", "model task context belongs to different book");
  }
  const active = requireActive(request, "before successor creation");
  if (!active.ok) return active;

  const repair = await dependencies.repairs.createSuccessor({
    repairId: request.repairId,
    bookId: request.bookId,
    failedCandidate: request.failedCandidate,
    failedRoundId: request.failedRoundId,
    ...(request.diagnosisId === undefined ? {} : { diagnosisId: request.diagnosisId }),
    successorCandidateId: request.successorCandidateId,
    createdByRunId: request.taskContext.runId,
    expectedInventory: request.expectedInventory,
    files: request.files,
    createdAt: request.createdAt,
  });
  if (!repair.ok) return repair;
  if (repair.value.repairId !== request.repairId
    || repair.value.failedRoundId !== request.failedRoundId
    || repair.value.requiredNextStep !== "CANONICAL_REVIEW"
    || !sameIdentity(repair.value.predecessor, request.failedCandidate)
    || repair.value.successor.candidateId !== request.successorCandidateId) {
    return failed("REPAIR_RESULT_INVALID", "repair service returned mismatched successor transition");
  }
  const beforeOpen = requireActive(request, "after successor finalization; successor retained");
  if (!beforeOpen.ok) return beforeOpen;
  const predecessor = await openExact(dependencies.candidates, request.bookId, repair.value.predecessor);
  if (!predecessor.ok) return predecessor;
  const successor = await openExact(dependencies.candidates, request.bookId, repair.value.successor);
  if (!successor.ok) return successor;
  const beforeReview = requireActive(request, "before canonical review");
  if (!beforeReview.ok) return beforeReview;

  const screening = await dependencies.reviews.screen(successor.value);
  if (!screening.ok) return screening;
  if (!sameIdentity(screening.value.candidate, identityOf(successor.value)) || screening.value.outcome !== "SHORTLIST") {
    return failed("REPAIR_SCREENING_FAILED", "successor did not pass exact-candidate screening");
  }
  // ── BOUNDED ERROR-SUCCESSOR REVIEWS OF THE SAME STAGED SUCCESSOR ───────────
  //
  // A review `outcome: ERROR` after a SUCCESSFUL chapter repair is an INFRA
  // failure — the panel never produced a reading — not a verdict on the
  // successor. Observed live (Franklin repair-r3): the successor was repaired
  // and staged, its re-review flaked ERROR, and the transition died as though
  // the book had been judged, spending the last qc-repair ordinal.
  //
  // So an ERROR re-reviews THE SAME candidate under a fresh review id (the
  // review store replays a stored record for a reused id, so the id must move),
  // bounded by MAX_REPAIR_REVIEW_ATTEMPTS. Nothing else changes:
  //   - a FAIL verdict returns REPAIR_REVIEW_FAILED on the FIRST attempt, byte
  //     for byte as before — the repair machinery owns real verdicts;
  //   - a STALE record is refused immediately and never retried;
  //   - exhaustion fails closed under a DISTINCT code, and no verdict is ever
  //     invented for the successor.
  const reviewIds = repairReviewIdSeries(request.reviewId);
  let review: CanonicalReviewResult | undefined;
  for (let attempt = 1; attempt <= reviewIds.length; attempt += 1) {
    const beforeCanonical = requireActive(request, "before canonical review evaluation");
    if (!beforeCanonical.ok) return beforeCanonical;
    const reviewId = reviewIds[attempt - 1];
    const reviewed = await dependencies.reviews.reviewCanonical({
      reviewId,
      candidate: successor.value,
      // A successor review needs its own attempt identity too: the panel derives
      // every seat's run-state attempt id from this one, and re-admitting spent
      // ids would collide instead of retrying.
      taskContext: attempt === 1
        ? request.taskContext
        : { ...request.taskContext, attemptId: `${request.taskContext.attemptId}-e${attempt}` },
    });
    if (!reviewed.ok) return reviewed;
    const authorized = validateReviewIdentity(reviewed.value, successor.value, reviewId);
    if (!authorized.ok) return authorized;
    if (reviewed.value.outcome === "PASS") {
      review = reviewed.value;
      break;
    }
    if (reviewed.value.outcome !== "ERROR") {
      return failed("REPAIR_REVIEW_FAILED", `canonical review outcome: ${reviewed.value.outcome}`);
    }
    if (attempt === reviewIds.length) {
      return failed(
        REPAIR_REVIEW_ERROR_CODE,
        `${REPAIR_REVIEW_ERROR_REASON_PREFIX}canonical review errored on all ${reviewIds.length} bounded attempts`
        + ` of the same staged successor ${request.successorCandidateId}; no verdict was produced`,
      );
    }
  }
  if (review === undefined) {
    // Unreachable: the loop either binds a PASS or returns above.
    return failed(REPAIR_REVIEW_ERROR_CODE, `${REPAIR_REVIEW_ERROR_REASON_PREFIX}canonical review loop terminated without a result`);
  }
  const beforeQc = requireActive(request, "before fresh QC");
  if (!beforeQc.ok) return beforeQc;

  const qcd = await dependencies.successorQc.run({
    bookId: request.bookId,
    roundId: request.freshRoundId,
    candidate: successor.value,
    canonicalReview: review,
    sourceGitSha: request.sourceGitSha,
    signal: request.taskContext.signal,
  });
  if (!qcd.ok) return qcd;
  const qc = validateQcResult(qcd.value, request, successor.value, review.reviewId);
  if (!qc.ok) return qc;
  if (qc.value.outcome === "ERROR") {
    return failed("REPAIR_QC_ERROR", "fresh QC errored; content repair history not advanced");
  }
  const beforeHistory = requireActive(request, "before repair history append");
  if (!beforeHistory.ok) return beforeHistory;
  const history = await dependencies.history.append({
    schemaVersion: "1",
    repairId: request.repairId,
    bookId: request.bookId,
    ordinal: repair.value.attemptNumber,
    predecessor: repair.value.predecessor,
    failedRoundId: repair.value.failedRoundId,
    successor: repair.value.successor,
    reviewId: review.reviewId,
    freshRoundId: qc.value.roundId,
    qcOutcome: qc.value.outcome,
    ...(request.diagnosisId === undefined ? {} : { diagnosisId: request.diagnosisId }),
    completedAt: qc.value.completedAt,
  });
  if (!history.ok) return history;
  return {
    ok: true,
    value: {
      status: qc.value.outcome === "PASS" ? "PASS" : "REPAIR_UNSUCCESSFUL",
      ordinal: repair.value.attemptNumber,
      predecessor: predecessor.value,
      successor: successor.value,
      review,
      qc: qc.value,
    },
  };
}
