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

/**
 * Read-only, repeatable lookup over a book's DURABLE qc-diagnose output.
 *
 * `QcStore.getDiagnosis` is keyed by diagnosis id, which the book-run does not
 * have: it knows the ROUND that failed and the CANDIDATE that failed it, and
 * has to answer "did the operator already diagnose exactly this?". That is the
 * one question the chained qc-repair ladder turns on, so it gets its own narrow
 * port rather than widening `QcService` (whose implementations are legion).
 *
 * Deliberately a LISTING and not a `getDiagnosisForRound`: matching is the
 * caller's decision because ambiguity is the caller's decision. Two diagnoses
 * can legitimately name the same round+candidate (an operator re-ran
 * qc-diagnose), and silently picking one inside the store would hide that.
 */
export interface QcDiagnosisIndex {
  /** EVERY durable diagnosis for the book, in unspecified order. A book with no
   *  diagnoses is `ok` with an empty list; a diagnosis that cannot be read or
   *  parsed FAILS the call — an unreadable diagnosis is never reported absent. */
  listDiagnoses(bookId: BookId): Promise<Result<readonly QcDiagnosis[]>>;
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
