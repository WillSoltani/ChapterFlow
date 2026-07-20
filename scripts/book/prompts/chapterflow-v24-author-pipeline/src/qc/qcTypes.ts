import type { CandidateSnapshot } from "../books/candidateTypes.js";
import type {
  BookId,
  CandidateIdentity,
  QcRoundId,
  RepairId,
  Result,
  ReviewId,
  UtcIso,
} from "../contracts/v4Core.js";
import type { CanonicalReviewResult } from "../review/reviewTypes.js";

export interface QcIssue {
  readonly code: string;
  readonly severity: "WARN" | "BLOCKER";
  readonly message: string;
  readonly location?: string;
}

export interface QcRoundResult {
  readonly schemaVersion: "1";
  readonly roundId: QcRoundId;
  readonly candidate: CandidateIdentity;
  readonly reviewId: ReviewId;
  readonly outcome: "PASS" | "FAIL" | "ERROR";
  readonly issues: readonly QcIssue[];
  readonly completedAt: UtcIso;
}

export interface QcEvaluation {
  readonly roundId: QcRoundId;
  readonly candidate: CandidateIdentity;
  readonly reviewId: ReviewId;
  readonly outcome: "PASS" | "FAIL" | "ERROR";
  readonly issues: readonly QcIssue[];
}

export interface QcDiagnosis {
  readonly diagnosisId: string;
  readonly roundId: QcRoundId;
  readonly candidate: CandidateIdentity;
  readonly issues: readonly QcIssue[];
  readonly createdAt: UtcIso;
}

export interface QcStatus {
  readonly bookId: BookId;
  readonly ledgerRevision: number;
  readonly issues: readonly QcIssue[];
}

export interface LedgerRepairRequest {
  readonly bookId: BookId;
  readonly repairId: RepairId;
  readonly expectedRevision: number;
  readonly confirmation: "REPAIR_QC_LEDGER";
}

export interface LedgerRepairResult {
  readonly beforeRevision: number;
  readonly afterRevision: number;
  readonly preservedSourcePath: string;
}

export interface QcService {
  readStatus(bookId: BookId): Promise<Result<QcStatus>>;
  runFresh(input: Readonly<{
    roundId: QcRoundId;
    candidate: CandidateSnapshot;
    canonicalReview: CanonicalReviewResult;
    evaluation: QcEvaluation;
  }>): Promise<Result<QcRoundResult>>;
  getRound(bookId: BookId, roundId: QcRoundId): Promise<Result<QcRoundResult>>;
  diagnose(bookId: BookId, roundId: QcRoundId): Promise<Result<QcDiagnosis>>;
  repairLedger(request: LedgerRepairRequest): Promise<Result<Readonly<LedgerRepairResult>>>;
}
