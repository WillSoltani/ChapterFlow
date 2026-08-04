import type { CandidateSnapshot } from "../books/candidateTypes.js";
import type {
  CandidateIdentity,
  ModelTaskContext,
  Result,
  ReviewId,
  UtcIso,
} from "../contracts/v4Core.js";

export interface ReviewIssue {
  readonly code: string;
  readonly severity: "INFO" | "WARN" | "BLOCKER";
  readonly message: string;
  readonly location?: string;
}

export interface ScreeningResult {
  readonly candidate: CandidateIdentity;
  readonly outcome: "SHORTLIST" | "REJECT" | "ERROR";
  readonly issues: readonly ReviewIssue[];
}

export interface CanonicalReviewResult {
  readonly schemaVersion: "1";
  readonly reviewId: ReviewId;
  readonly candidate: CandidateIdentity;
  readonly outcome: "PASS" | "FAIL" | "ERROR";
  readonly issues: readonly ReviewIssue[];
  readonly completedAt: UtcIso;
}

export interface CanonicalReviewEvaluation {
  readonly outcome: "PASS" | "FAIL" | "ERROR";
  readonly issues: readonly ReviewIssue[];
}

export interface CanonicalReviewEvaluator {
  evaluate(input: Readonly<{
    candidate: CandidateSnapshot;
    taskContext: ModelTaskContext;
  }>): Promise<Result<CanonicalReviewEvaluation>>;
}

export interface ReviewService {
  screen(candidate: CandidateSnapshot): Promise<Result<ScreeningResult>>;
  reviewCanonical(input: Readonly<{
    reviewId: ReviewId;
    candidate: CandidateSnapshot;
    taskContext: ModelTaskContext;
  }>): Promise<Result<CanonicalReviewResult>>;
  get(bookId: string, reviewId: ReviewId): Promise<Result<CanonicalReviewResult>>;
}

export interface ReviewServiceFactory {
  create(evaluator: CanonicalReviewEvaluator): ReviewService;
}
