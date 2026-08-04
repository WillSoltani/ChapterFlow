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

function validateReview(review: CanonicalReviewResult, successor: CandidateSnapshot, reviewId: string): Result<CanonicalReviewResult> {
  if (review.reviewId !== reviewId || !sameIdentity(review.candidate, identityOf(successor))) {
    return failed("REPAIR_REVIEW_STALE", "canonical review does not authorize successor candidate");
  }
  if (review.outcome !== "PASS") return failed("REPAIR_REVIEW_FAILED", `canonical review outcome: ${review.outcome}`);
  return { ok: true, value: review };
}

function validateQcResult(
  result: QcRoundResult,
  request: ContentRepairRequest,
  successor: CandidateSnapshot,
): Result<QcRoundResult> {
  if (result.roundId !== request.freshRoundId
    || result.reviewId !== request.reviewId
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
  const beforeCanonical = requireActive(request, "before canonical review evaluation");
  if (!beforeCanonical.ok) return beforeCanonical;
  const reviewed = await dependencies.reviews.reviewCanonical({
    reviewId: request.reviewId,
    candidate: successor.value,
    taskContext: request.taskContext,
  });
  if (!reviewed.ok) return reviewed;
  const review = validateReview(reviewed.value, successor.value, request.reviewId);
  if (!review.ok) return review;
  const beforeQc = requireActive(request, "before fresh QC");
  if (!beforeQc.ok) return beforeQc;

  const qcd = await dependencies.successorQc.run({
    bookId: request.bookId,
    roundId: request.freshRoundId,
    candidate: successor.value,
    canonicalReview: review.value,
  });
  if (!qcd.ok) return qcd;
  const qc = validateQcResult(qcd.value, request, successor.value);
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
    reviewId: review.value.reviewId,
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
      review: review.value,
      qc: qc.value,
    },
  };
}
