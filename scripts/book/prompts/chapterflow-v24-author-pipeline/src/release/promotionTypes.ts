import type { CandidateStore, BookContentReader } from "../books/candidateTypes.js";
import type { CurrentPointerStore } from "../books/currentPointer.js";
import type {
  BookId,
  CandidateId,
  CandidateIdentity,
  QcRoundId,
  Result,
  ReviewId,
  UtcIso,
} from "../contracts/v4Core.js";
import type { QcService } from "../qc/qcTypes.js";
import type { ReviewService } from "../review/reviewTypes.js";

export interface PromotionRequest {
  readonly bookId: BookId;
  readonly candidate: CandidateIdentity;
  readonly reviewId: ReviewId;
  readonly qcRoundId: QcRoundId;
  readonly expectedBookRevision: number;
  readonly promotedAt: UtcIso;
}

export interface PromotionResult {
  readonly bookId: BookId;
  readonly candidate: CandidateIdentity;
  readonly previousCandidateId?: CandidateId;
  readonly bookRevision: number;
  readonly readback: "VERIFIED";
  readonly promotedAt: UtcIso;
}

export interface PromotionService {
  promote(request: PromotionRequest): Promise<Result<PromotionResult>>;
}

export interface PromotionServiceOptions {
  readonly candidateStore: CandidateStore;
  readonly contentReader: BookContentReader;
  readonly reviewService: ReviewService;
  readonly qcService: QcService;
  readonly currentPointerStore: CurrentPointerStore;
  readonly clock: () => UtcIso;
}
