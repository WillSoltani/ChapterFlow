import type { BookContentReader, CandidateSnapshot } from "../books/candidateTypes.js";
import type { CandidateIdentity, ModelTaskContext, Result, UtcIso } from "../contracts/v4Core.js";
import { createReviewStore, type ReviewStore } from "./reviewStore.js";
import type {
  CanonicalReviewEvaluation,
  CanonicalReviewEvaluator,
  CanonicalReviewResult,
  ReviewIssue,
  ReviewService,
  ReviewServiceFactory,
  ScreeningResult,
} from "./reviewTypes.js";

export interface ReviewServiceFactoryOptions {
  readonly booksRoot: string;
  readonly contentReader: BookContentReader;
  readonly now?: () => UtcIso;
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
    if (
      le.kind !== re.kind ||
      le.logicalPath !== re.logicalPath ||
      le.mediaType !== re.mediaType ||
      le.byteLength !== re.byteLength
    ) {
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function validIssue(value: unknown): value is ReviewIssue {
  if (!isRecord(value)) return false;
  const issue = value as Partial<ReviewIssue> & Record<string, unknown>;
  const expected = issue.location === undefined
    ? ["code", "message", "severity"]
    : ["code", "location", "message", "severity"];
  if (!exactKeys(issue, expected)) return false;
  return typeof issue.code === "string" && issue.code.length > 0 &&
    (issue.severity === "INFO" || issue.severity === "WARN" || issue.severity === "BLOCKER") &&
    typeof issue.message === "string" && issue.message.length > 0 &&
    (issue.location === undefined || (typeof issue.location === "string" && issue.location.length > 0));
}

function normalizeEvaluation(value: unknown): CanonicalReviewEvaluation | null {
  if (!isRecord(value)) return null;
  const evaluation = value as Partial<CanonicalReviewEvaluation> & Record<string, unknown>;
  if (!exactKeys(evaluation, ["issues", "outcome"])) return null;
  if (
    evaluation.outcome !== "PASS" &&
    evaluation.outcome !== "FAIL" &&
    evaluation.outcome !== "ERROR"
  ) {
    return null;
  }
  if (!Array.isArray(evaluation.issues) || !evaluation.issues.every(validIssue)) return null;
  if (evaluation.outcome === "PASS" && evaluation.issues.some((issue) => issue.severity === "BLOCKER")) return null;
  return {
    outcome: evaluation.outcome,
    issues: evaluation.issues.map((issue) => ({
      code: issue.code,
      severity: issue.severity,
      message: issue.message,
      ...(issue.location === undefined ? {} : { location: issue.location }),
    })),
  };
}

function normalizeEvaluatorSuccess(value: unknown): CanonicalReviewEvaluation | null {
  if (!isRecord(value) || !exactKeys(value, ["ok", "value"]) || value.ok !== true) return null;
  return normalizeEvaluation(value.value);
}

function normalizeEvaluatorFailure(value: unknown): string | null {
  if (!isRecord(value) || !exactKeys(value, ["error", "ok"]) || value.ok !== false || !isRecord(value.error)) {
    return null;
  }
  const error = value.error;
  const expected = error.retryable === undefined
    ? ["code", "message"]
    : ["code", "message", "retryable"];
  if (
    !exactKeys(error, expected) ||
    typeof error.code !== "string" ||
    error.code.length === 0 ||
    typeof error.message !== "string" ||
    error.message.length === 0 ||
    (error.retryable !== undefined && typeof error.retryable !== "boolean")
  ) {
    return null;
  }
  return error.message;
}

function thrownMessage(value: unknown, fallback: string): string {
  return isRecord(value) && typeof value.message === "string" && value.message.length > 0
    ? value.message
    : fallback;
}

function evaluatorError(code: string, message: string): CanonicalReviewEvaluation {
  return {
    outcome: "ERROR",
    issues: [{ code, severity: "BLOCKER", message }],
  };
}

class CanonicalReviewService implements ReviewService {
  readonly #contentReader: BookContentReader;
  readonly #store: ReviewStore;
  readonly #evaluator: CanonicalReviewEvaluator;
  readonly #now: () => UtcIso;

  constructor(
    contentReader: BookContentReader,
    store: ReviewStore,
    evaluator: CanonicalReviewEvaluator,
    now: () => UtcIso,
  ) {
    this.#contentReader = contentReader;
    this.#store = store;
    this.#evaluator = evaluator;
    this.#now = now;
  }

  async #reopen(candidate: CandidateSnapshot): Promise<Result<CandidateSnapshot>> {
    const supplied = cloneCandidate(candidate);
    if (!supplied) return failed("CANDIDATE_MISMATCH", "candidate snapshot is incomplete or malformed");
    const reopened = await this.#contentReader.open({
      bookId: supplied.manifest.bookId,
      selector: { kind: "CANDIDATE", candidateId: supplied.manifest.candidateId },
    });
    if (!reopened.ok) return reopened;
    if (!sameCandidate(supplied, reopened.value)) {
      return failed("CANDIDATE_MISMATCH", "supplied candidate differs from complete immutable candidate");
    }
    return reopened;
  }

  async screen(candidate: CandidateSnapshot): Promise<Result<ScreeningResult>> {
    const reopened = await this.#reopen(candidate);
    if (!reopened.ok) return reopened;
    return {
      ok: true,
      value: {
        candidate: identityOf(reopened.value),
        outcome: "SHORTLIST",
        issues: [],
      },
    };
  }

  async reviewCanonical(input: Readonly<{
    reviewId: string;
    candidate: CandidateSnapshot;
    taskContext: ModelTaskContext;
  }>): Promise<Result<CanonicalReviewResult>> {
    const supplied = cloneCandidate(input.candidate);
    if (!supplied) return failed("CANDIDATE_MISMATCH", "candidate snapshot is incomplete or malformed");
    const identity = identityOf(supplied);
    const bookId = supplied.manifest.bookId;

    const existing = await this.#store.get(bookId, input.reviewId);
    if (existing.ok) {
      if (!sameIdentity(existing.value.candidate, identity)) {
        return failed("REVIEW_ID_CONFLICT", `review ID is already bound to another candidate: ${input.reviewId}`);
      }
      const reopened = await this.#reopen(supplied);
      return reopened.ok ? existing : reopened;
    }
    if (existing.error.code !== "REVIEW_NOT_FOUND") return existing;

    if (!input.taskContext || input.taskContext.bookId !== bookId) {
      return failed("REVIEW_CONTEXT_MISMATCH", "task context bookId must match candidate bookId");
    }
    const reopened = await this.#reopen(supplied);
    if (!reopened.ok) return reopened;

    let evaluation: CanonicalReviewEvaluation;
    try {
      const evaluated: unknown = await this.#evaluator.evaluate({ candidate: reopened.value, taskContext: input.taskContext });
      const success = normalizeEvaluatorSuccess(evaluated);
      if (success) {
        evaluation = success;
      } else {
        const failureMessage = normalizeEvaluatorFailure(evaluated);
        evaluation = failureMessage === null
          ? evaluatorError(
              "REVIEW_EVALUATOR_INVALID",
              "canonical evaluator returned an invalid result",
            )
          : evaluatorError("REVIEW_EVALUATOR_ERROR", failureMessage);
      }
    } catch (cause) {
      evaluation = evaluatorError("REVIEW_EVALUATOR_EXCEPTION", thrownMessage(cause, "canonical evaluator threw"));
    }

    const completedAt = this.#now();
    if (!isCanonicalUtc(completedAt)) return failed("REVIEW_CLOCK_INVALID", "review clock must return canonical UTC ISO time");
    const record: CanonicalReviewResult = {
      schemaVersion: "1",
      reviewId: input.reviewId,
      candidate: identityOf(reopened.value),
      outcome: evaluation.outcome,
      issues: evaluation.issues.map((issue) => ({ ...issue })),
      completedAt,
    };
    const created = await this.#store.create(bookId, record);
    if (created.ok || created.error.code !== "REVIEW_ID_CONFLICT") return created;
    const winner = await this.#store.get(bookId, input.reviewId);
    return winner.ok && sameIdentity(winner.value.candidate, record.candidate)
      ? winner
      : created;
  }

  get(bookId: string, reviewId: string): Promise<Result<CanonicalReviewResult>> {
    return this.#store.get(bookId, reviewId);
  }
}

export function createReviewServiceFactory(options: ReviewServiceFactoryOptions): ReviewServiceFactory {
  const store = createReviewStore(options.booksRoot);
  const now = options.now ?? (() => new Date().toISOString());
  return {
    create(evaluator: CanonicalReviewEvaluator): ReviewService {
      return new CanonicalReviewService(options.contentReader, store, evaluator, now);
    },
  };
}

export type {
  CanonicalReviewEvaluation,
  CanonicalReviewEvaluator,
  CanonicalReviewResult,
  ReviewIssue,
  ReviewService,
  ReviewServiceFactory,
  ScreeningResult,
} from "./reviewTypes.js";
