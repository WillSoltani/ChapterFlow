import { randomUUID } from "node:crypto";

import type { BookContentReader, CandidateSnapshot } from "../books/candidateTypes.js";
import type { BookWriteLock } from "../books/leaseTypes.js";
import type { CandidateIdentity, Result, UtcIso } from "../contracts/v4Core.js";
import type { CanonicalReviewResult, ReviewService } from "../review/reviewTypes.js";
import { repairQcLedgerUnlocked, type QcLedgerRepairSeams } from "./qcLedgerRepair.js";
import {
  createQcStore,
  equivalentRound,
  safeQcId,
  type QcLedgerRoundEvent,
  type QcStore,
} from "./qcStore.js";
import type {
  LedgerRepairRequest,
  LedgerRepairResult,
  QcDiagnosis,
  QcEvaluation,
  QcIssue,
  QcRoundResult,
  QcService,
  QcStatus,
} from "./qcTypes.js";

export interface QcServiceOptions {
  readonly booksRoot: string;
  readonly contentReader: BookContentReader;
  readonly reviewService: ReviewService;
  readonly writeLock: BookWriteLock;
  readonly now?: () => UtcIso;
  readonly diagnosisId?: () => string;
  readonly repairSeams?: QcLedgerRepairSeams;
}

function failed<T>(code: string, message: string): Result<T> {
  return { ok: false, error: { code, message } };
}

function isCanonicalUtc(value: string): boolean {
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString() === value;
}

function cloneCandidate(candidate: CandidateSnapshot): CandidateSnapshot | null {
  try {
    if (!candidate || typeof candidate !== "object" || !candidate.manifest || !Array.isArray(candidate.files)) return null;
    const manifest = candidate.manifest;
    if (!Array.isArray(manifest.entries)) return null;
    return {
      manifest: {
        schemaVersion: manifest.schemaVersion,
        bookId: manifest.bookId,
        candidateId: manifest.candidateId,
        ...(manifest.parentCandidateId === undefined ? {} : { parentCandidateId: manifest.parentCandidateId }),
        createdByRunId: manifest.createdByRunId,
        entries: manifest.entries.map((entry) => ({ ...entry })),
        manifestDigest: manifest.manifestDigest,
        createdAt: manifest.createdAt,
      },
      files: candidate.files.map((file) => ({ ...file, bytes: Buffer.from(file.bytes) })),
      ...(candidate.currentRevision === undefined ? {} : { currentRevision: candidate.currentRevision }),
    };
  } catch {
    return null;
  }
}

function sameCandidate(left: CandidateSnapshot, right: CandidateSnapshot): boolean {
  const lm = left.manifest;
  const rm = right.manifest;
  if (
    lm.schemaVersion !== rm.schemaVersion ||
    lm.bookId !== rm.bookId ||
    lm.candidateId !== rm.candidateId ||
    lm.parentCandidateId !== rm.parentCandidateId ||
    lm.createdByRunId !== rm.createdByRunId ||
    lm.manifestDigest !== rm.manifestDigest ||
    lm.createdAt !== rm.createdAt ||
    left.currentRevision !== right.currentRevision ||
    lm.entries.length !== rm.entries.length ||
    left.files.length !== right.files.length
  ) {
    return false;
  }
  for (let index = 0; index < lm.entries.length; index += 1) {
    const le = lm.entries[index];
    const re = rm.entries[index];
    if (le.kind !== re.kind || le.logicalPath !== re.logicalPath || le.mediaType !== re.mediaType || le.byteLength !== re.byteLength) {
      return false;
    }
  }
  for (let index = 0; index < left.files.length; index += 1) {
    const lf = left.files[index];
    const rf = right.files[index];
    if (
      lf.kind !== rf.kind ||
      lf.logicalPath !== rf.logicalPath ||
      lf.mediaType !== rf.mediaType ||
      lf.byteLength !== rf.byteLength ||
      !Buffer.from(lf.bytes).equals(Buffer.from(rf.bytes))
    ) {
      return false;
    }
  }
  return true;
}

function identityOf(candidate: CandidateSnapshot): CandidateIdentity {
  return {
    candidateId: candidate.manifest.candidateId,
    manifestDigest: candidate.manifest.manifestDigest,
  };
}

function sameIdentity(left: CandidateIdentity, right: CandidateIdentity): boolean {
  return left.candidateId === right.candidateId && left.manifestDigest === right.manifestDigest;
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function validIssue(value: unknown): value is QcIssue {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const issue = value as Partial<QcIssue> & Record<string, unknown>;
  const expected = issue.location === undefined
    ? ["code", "message", "severity"]
    : ["code", "location", "message", "severity"];
  if (!exactKeys(issue, expected)) return false;
  return typeof issue.code === "string" && issue.code.length > 0 &&
    (issue.severity === "WARN" || issue.severity === "BLOCKER") &&
    typeof issue.message === "string" && issue.message.length > 0 &&
    (issue.location === undefined || (typeof issue.location === "string" && issue.location.length > 0));
}

function normalizeEvaluation(value: unknown): QcEvaluation | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const evaluation = value as Partial<QcEvaluation> & Record<string, unknown>;
  if (!exactKeys(evaluation, ["candidate", "issues", "outcome", "reviewId", "roundId"])) return null;
  if (
    typeof evaluation.roundId !== "string" ||
    typeof evaluation.reviewId !== "string" ||
    !evaluation.candidate ||
    typeof evaluation.candidate.candidateId !== "string" ||
    typeof evaluation.candidate.manifestDigest !== "string" ||
    (evaluation.outcome !== "PASS" && evaluation.outcome !== "FAIL" && evaluation.outcome !== "ERROR") ||
    !Array.isArray(evaluation.issues) ||
    !evaluation.issues.every(validIssue)
  ) {
    return null;
  }
  const candidate = evaluation.candidate as CandidateIdentity & Record<string, unknown>;
  if (!exactKeys(candidate, ["candidateId", "manifestDigest"])) return null;
  try {
    safeQcId(evaluation.roundId, "roundId");
    safeQcId(evaluation.reviewId, "reviewId");
    safeQcId(evaluation.candidate.candidateId, "candidateId");
  } catch {
    return null;
  }
  if (evaluation.outcome === "PASS" && evaluation.issues.some((issue) => issue.severity === "BLOCKER")) return null;
  return {
    roundId: evaluation.roundId,
    candidate: { ...evaluation.candidate },
    reviewId: evaluation.reviewId,
    outcome: evaluation.outcome,
    issues: evaluation.issues.map((issue) => ({
      code: issue.code,
      severity: issue.severity,
      message: issue.message,
      ...(issue.location === undefined ? {} : { location: issue.location }),
    })),
  };
}

function validCanonicalReview(value: unknown): value is CanonicalReviewResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const review = value as Partial<CanonicalReviewResult> & Record<string, unknown>;
  if (!exactKeys(review, ["candidate", "completedAt", "issues", "outcome", "reviewId", "schemaVersion"])) return false;
  if (!review.candidate || typeof review.candidate !== "object" || Array.isArray(review.candidate)) return false;
  if (!exactKeys(review.candidate as CandidateIdentity & Record<string, unknown>, ["candidateId", "manifestDigest"])) return false;
  return review.schemaVersion === "1" &&
    typeof review.reviewId === "string" &&
    !!review.candidate &&
    typeof review.candidate.candidateId === "string" &&
    typeof review.candidate.manifestDigest === "string" &&
    (review.outcome === "PASS" || review.outcome === "FAIL" || review.outcome === "ERROR") &&
    Array.isArray(review.issues) && review.issues.every((issue) => {
      if (!issue || typeof issue !== "object" || Array.isArray(issue)) return false;
      const record = issue as Record<string, unknown>;
      const expected = record.location === undefined
        ? ["code", "message", "severity"]
        : ["code", "location", "message", "severity"];
      return exactKeys(record, expected) &&
        typeof record.code === "string" && record.code.length > 0 &&
        (record.severity === "INFO" || record.severity === "WARN" || record.severity === "BLOCKER") &&
        typeof record.message === "string" && record.message.length > 0 &&
        (record.location === undefined || (typeof record.location === "string" && record.location.length > 0));
    }) &&
    typeof review.completedAt === "string" &&
    isCanonicalUtc(review.completedAt);
}

function sameReview(left: CanonicalReviewResult, right: CanonicalReviewResult): boolean {
  return left.schemaVersion === right.schemaVersion &&
    left.reviewId === right.reviewId &&
    sameIdentity(left.candidate, right.candidate) &&
    left.outcome === right.outcome &&
    left.completedAt === right.completedAt &&
    JSON.stringify(left.issues) === JSON.stringify(right.issues);
}

function evaluationMatchesRound(evaluation: QcEvaluation, round: QcRoundResult): boolean {
  return evaluation.roundId === round.roundId &&
    sameIdentity(evaluation.candidate, round.candidate) &&
    evaluation.reviewId === round.reviewId &&
    evaluation.outcome === round.outcome &&
    JSON.stringify(evaluation.issues) === JSON.stringify(round.issues);
}

class FreshQcService implements QcService {
  readonly #booksRoot: string;
  readonly #contentReader: BookContentReader;
  readonly #reviewService: ReviewService;
  readonly #writeLock: BookWriteLock;
  readonly #store: QcStore;
  readonly #now: () => UtcIso;
  readonly #diagnosisId: () => string;
  readonly #repairSeams: QcLedgerRepairSeams;

  constructor(options: QcServiceOptions) {
    this.#booksRoot = options.booksRoot;
    this.#contentReader = options.contentReader;
    this.#reviewService = options.reviewService;
    this.#writeLock = options.writeLock;
    this.#store = createQcStore({ booksRoot: options.booksRoot });
    this.#now = options.now ?? (() => new Date().toISOString());
    this.#diagnosisId = options.diagnosisId ?? (() => `diagnosis-${randomUUID()}`);
    this.#repairSeams = options.repairSeams ?? {};
  }

  async readStatus(bookId: string): Promise<Result<QcStatus>> {
    const ledger = await this.#store.readLedger(bookId);
    if (!ledger.ok) return ledger;
    const latestRound = [...ledger.value].reverse().find((event): event is QcLedgerRoundEvent => event.kind === "ROUND");
    let issues: QcIssue[];
    if (!latestRound) {
      issues = [{ code: "QC_NO_VALID_ROUND", severity: "BLOCKER", message: "QC ledger has no valid round" }];
    } else {
      issues = latestRound.round.issues.map((issue) => ({ ...issue }));
      if (latestRound.round.outcome !== "PASS" && !issues.some((issue) => issue.severity === "BLOCKER")) {
        issues.push({
          code: latestRound.round.outcome === "FAIL" ? "QC_ROUND_FAILED" : "QC_ROUND_ERROR",
          severity: "BLOCKER",
          message: latestRound.round.outcome === "FAIL" ? "latest QC round failed" : "latest QC round ended in error",
        });
      }
    }
    return {
      ok: true,
      value: { bookId, ledgerRevision: ledger.value.length, issues },
    };
  }

  async runFresh(input: Readonly<{
    roundId: string;
    candidate: CandidateSnapshot;
    canonicalReview: CanonicalReviewResult;
    evaluation: QcEvaluation;
  }>): Promise<Result<QcRoundResult>> {
    const supplied = cloneCandidate(input.candidate);
    const evaluation = normalizeEvaluation(input.evaluation);
    if (!supplied) return failed("QC_CANDIDATE_MISMATCH", "candidate snapshot is incomplete or malformed");
    if (!validCanonicalReview(input.canonicalReview)) {
      return failed("QC_CANONICAL_REVIEW_REQUIRED", "fresh QC requires a canonical review record");
    }
    if (!evaluation) return failed("QC_EVALUATION_INVALID", "QC evaluation does not match its typed contract");

    const bookId = supplied.manifest.bookId;
    const candidate = identityOf(supplied);
    if (
      input.roundId !== evaluation.roundId ||
      input.canonicalReview.outcome !== "PASS" ||
      !sameIdentity(input.canonicalReview.candidate, candidate) ||
      !sameIdentity(evaluation.candidate, candidate) ||
      evaluation.reviewId !== input.canonicalReview.reviewId
    ) {
      return failed("QC_JOIN_MISMATCH", "round, candidate checksum, canonical PASS, and review ID must match exactly");
    }

    const storedReview = await this.#reviewService.get(bookId, input.canonicalReview.reviewId);
    if (!storedReview.ok || storedReview.value.outcome !== "PASS" || !sameReview(storedReview.value, input.canonicalReview)) {
      return failed("QC_CANONICAL_REVIEW_REQUIRED", "fresh QC requires the exact stored canonical PASS record");
    }

    const reopened = await this.#contentReader.open({
      bookId,
      selector: { kind: "CANDIDATE", candidateId: supplied.manifest.candidateId },
    });
    if (!reopened.ok) return reopened;
    if (!sameCandidate(supplied, reopened.value)) {
      return failed("QC_CANDIDATE_MISMATCH", "supplied candidate differs from complete immutable candidate");
    }

    const existing = await this.#store.getRound(bookId, input.roundId);
    if (existing.ok) {
      if (!evaluationMatchesRound(evaluation, existing.value)) {
        return failed("QC_ROUND_ID_CONFLICT", `QC round ID already has conflicting identity: ${input.roundId}`);
      }
      return this.#writeLock.run(bookId, () => this.#store.commitRound(bookId, existing.value));
    }
    if (existing.error.code !== "QC_ROUND_NOT_FOUND") return existing;

    const completedAt = this.#now();
    if (!isCanonicalUtc(completedAt)) return failed("QC_CLOCK_INVALID", "QC clock must return canonical UTC ISO time");
    const round: QcRoundResult = {
      schemaVersion: "1",
      roundId: evaluation.roundId,
      candidate: { ...evaluation.candidate },
      reviewId: evaluation.reviewId,
      outcome: evaluation.outcome,
      issues: evaluation.issues.map((issue) => ({ ...issue })),
      completedAt,
    };
    return this.#writeLock.run(bookId, () => this.#store.commitRound(bookId, round));
  }

  getRound(bookId: string, roundId: string): Promise<Result<QcRoundResult>> {
    return this.#store.getRound(bookId, roundId);
  }

  async diagnose(bookId: string, roundId: string): Promise<Result<QcDiagnosis>> {
    const round = await this.#store.getRound(bookId, roundId);
    if (!round.ok) return round;
    if (round.value.outcome !== "FAIL") {
      return failed("QC_DIAGNOSIS_NOT_ALLOWED", "diagnosis requires an exact stored FAIL round");
    }
    const ledger = await this.#store.readLedger(bookId);
    if (!ledger.ok) return ledger;
    const ledgerRound = ledger.value.find(
      (event): event is QcLedgerRoundEvent => event.kind === "ROUND" && event.round.roundId === roundId,
    );
    if (!ledgerRound || !equivalentRound(ledgerRound.round, round.value)) {
      return failed("QC_DIAGNOSIS_STALE", "stored FAIL round does not match current ledger identity");
    }
    const reopened = await this.#contentReader.open({
      bookId,
      selector: { kind: "CANDIDATE", candidateId: round.value.candidate.candidateId },
    });
    if (!reopened.ok) {
      return failed("QC_DIAGNOSIS_STALE", "failed round candidate is missing or checksum-stale");
    }
    if (!sameIdentity(identityOf(reopened.value), round.value.candidate)) {
      return failed("QC_DIAGNOSIS_STALE", "failed round candidate is missing or checksum-stale");
    }
    const diagnosisId = this.#diagnosisId();
    try {
      safeQcId(diagnosisId, "diagnosisId");
    } catch (cause) {
      return failed("INVALID_QC_ID", (cause as Error).message);
    }
    const createdAt = this.#now();
    if (!isCanonicalUtc(createdAt)) return failed("QC_CLOCK_INVALID", "QC clock must return canonical UTC ISO time");
    return this.#store.createDiagnosis(bookId, {
      diagnosisId,
      roundId: round.value.roundId,
      candidate: { ...round.value.candidate },
      issues: round.value.issues.map((issue) => ({ ...issue })),
      createdAt,
    });
  }

  async repairLedger(request: LedgerRepairRequest): Promise<Result<Readonly<LedgerRepairResult>>> {
    if (request.confirmation !== "REPAIR_QC_LEDGER") {
      return failed("QC_LEDGER_REPAIR_CONFIRMATION_REQUIRED", "ledger repair requires exact REPAIR_QC_LEDGER confirmation");
    }
    return this.#writeLock.run(request.bookId, () => repairQcLedgerUnlocked({
      booksRoot: this.#booksRoot,
      store: this.#store,
      now: this.#now,
      seams: this.#repairSeams,
    }, request));
  }
}

export function createQcService(options: QcServiceOptions): QcService {
  return new FreshQcService(options);
}

export type {
  LedgerRepairRequest,
  LedgerRepairResult,
  QcDiagnosis,
  QcEvaluation,
  QcIssue,
  QcRoundResult,
  QcService,
  QcStatus,
} from "./qcTypes.js";
