import { candidateManifestDigest } from "../books/candidateDigest.js";
import type { CandidateEntry, CandidateSnapshot } from "../books/candidateTypes.js";
import type { CurrentBookPointer } from "../books/currentPointer.js";
import type { CandidateIdentity, PortError, Result } from "../contracts/v4Core.js";
import type { QcRoundResult } from "../qc/qcTypes.js";
import type { CanonicalReviewResult } from "../review/reviewTypes.js";
import type {
  PromotionRequest,
  PromotionResult,
  PromotionService,
  PromotionServiceOptions,
} from "./promotionTypes.js";

type ValidPromotionRequest = Readonly<{
  bookId: string;
  candidate: CandidateIdentity;
  reviewId: string;
  qcRoundId: string;
  expectedBookRevision: number;
  promotedAt: string;
}>;

const DIGEST_PATTERN = /^[a-f0-9]{64}$/;
const ARTIFACT_KINDS = new Set(["CHAPTER", "PROVENANCE", "SIDECAR"]);
const MEDIA_TYPES = new Set(["text/plain", "text/markdown", "application/json"]);

function failed<T>(code: string, message: string, retryable = false): Result<T> {
  return { ok: false, error: { code, message, retryable } };
}

function errorMessage(value: unknown, fallback: string): string {
  try {
    return value instanceof Error && typeof value.message === "string" && value.message.length > 0
      ? value.message
      : fallback;
  } catch {
    return fallback;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function guardedPortError(value: unknown): PortError | null {
  try {
    if (!isRecord(value)) return null;
    const keys = Object.keys(value).sort();
    const hasRetryable = keys.length === 3 &&
      keys[0] === "code" && keys[1] === "message" && keys[2] === "retryable";
    const hasRequiredOnly = keys.length === 2 && keys[0] === "code" && keys[1] === "message";
    if (!hasRequiredOnly && !hasRetryable) return null;
    const codeDescriptor = Object.getOwnPropertyDescriptor(value, "code");
    const messageDescriptor = Object.getOwnPropertyDescriptor(value, "message");
    const retryableDescriptor = Object.getOwnPropertyDescriptor(value, "retryable");
    let code: unknown;
    let message: unknown;
    let retryable: unknown;
    let accessorFailed = false;
    try { code = value.code; } catch { accessorFailed = true; }
    try { message = value.message; } catch { accessorFailed = true; }
    try { retryable = value.retryable; } catch { accessorFailed = true; }
    if (
      accessorFailed ||
      codeDescriptor === undefined || !Object.prototype.hasOwnProperty.call(codeDescriptor, "value") ||
      messageDescriptor === undefined || !Object.prototype.hasOwnProperty.call(messageDescriptor, "value") ||
      (hasRetryable && (
        retryableDescriptor === undefined || !Object.prototype.hasOwnProperty.call(retryableDescriptor, "value")
      )) ||
      typeof code !== "string" ||
      code.length === 0 ||
      typeof message !== "string" ||
      message.length === 0 ||
      (hasRetryable && typeof retryable !== "boolean")
    ) {
      return null;
    }
    return {
      code,
      message,
      ...(hasRetryable ? { retryable: retryable as boolean } : {}),
    };
  } catch {
    return null;
  }
}

function guardedResult<T>(value: unknown): Result<T> | null {
  try {
    if (!isRecord(value)) return null;
    const keys = Object.keys(value).sort();
    const okDescriptor = Object.getOwnPropertyDescriptor(value, "ok");
    const ok = value.ok;
    if (
      ok === true &&
      keys.length === 2 && keys[0] === "ok" && keys[1] === "value" &&
      okDescriptor !== undefined && Object.prototype.hasOwnProperty.call(okDescriptor, "value")
    ) {
      const valueDescriptor = Object.getOwnPropertyDescriptor(value, "value");
      const resultValue = value.value;
      if (valueDescriptor === undefined || !Object.prototype.hasOwnProperty.call(valueDescriptor, "value")) return null;
      return { ok: true, value: resultValue as T };
    }
    if (
      ok === false &&
      keys.length === 2 && keys[0] === "error" && keys[1] === "ok" &&
      okDescriptor !== undefined && Object.prototype.hasOwnProperty.call(okDescriptor, "value")
    ) {
      const errorDescriptor = Object.getOwnPropertyDescriptor(value, "error");
      const errorValue = value.error;
      if (errorDescriptor === undefined || !Object.prototype.hasOwnProperty.call(errorDescriptor, "value")) return null;
      const error = guardedPortError(errorValue);
      return error ? { ok: false, error } : null;
    }
    return null;
  } catch {
    return null;
  }
}

function isSafeOpaqueId(value: unknown): value is string {
  return typeof value === "string" &&
    value.length > 0 &&
    value !== "." &&
    value !== ".." &&
    !value.includes("/") &&
    !value.includes("\\") &&
    !value.includes("\0") &&
    ![...value].some((character) => {
      const code = character.charCodeAt(0);
      return code < 0x20 || code === 0x7f;
    });
}

function canonicalUtcMilliseconds(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString() === value
    ? milliseconds
    : null;
}

type FieldSnapshot = Readonly<{ value: unknown; ownDataProperty: boolean }>;

function snapshotField(record: Record<string, unknown>, key: string): FieldSnapshot {
  const descriptor = Object.getOwnPropertyDescriptor(record, key);
  const value = record[key];
  return {
    value,
    ownDataProperty: descriptor !== undefined && Object.prototype.hasOwnProperty.call(descriptor, "value"),
  };
}

function validateRequest(request: PromotionRequest, clock: () => string): Result<ValidPromotionRequest> {
  if (!isRecord(request)) return failed("PROMOTION_INVALID", "promotion request must be an object");

  let bookIdField: FieldSnapshot;
  let candidateField: FieldSnapshot;
  let reviewIdField: FieldSnapshot;
  let qcRoundIdField: FieldSnapshot;
  let expectedRevisionField: FieldSnapshot;
  let promotedAtField: FieldSnapshot;
  try {
    bookIdField = snapshotField(request, "bookId");
    candidateField = snapshotField(request, "candidate");
    reviewIdField = snapshotField(request, "reviewId");
    qcRoundIdField = snapshotField(request, "qcRoundId");
    expectedRevisionField = snapshotField(request, "expectedBookRevision");
    promotedAtField = snapshotField(request, "promotedAt");
  } catch {
    return failed("PROMOTION_INVALID", "promotion request field access failed");
  }
  const outerFields = [
    bookIdField,
    candidateField,
    reviewIdField,
    qcRoundIdField,
    expectedRevisionField,
    promotedAtField,
  ];
  if (!outerFields.every((field) => field.ownDataProperty)) {
    return failed("PROMOTION_INVALID", "promotion request fields must be own data properties");
  }

  const bookId = bookIdField.value;
  const candidateValue = candidateField.value;
  const reviewId = reviewIdField.value;
  const qcRoundId = qcRoundIdField.value;
  const expectedBookRevision = expectedRevisionField.value;
  const promotedAt = promotedAtField.value;
  if (!isRecord(candidateValue)) {
    return failed("PROMOTION_INVALID", "candidate identity must be an object");
  }
  let candidateIdField: FieldSnapshot;
  let manifestDigestField: FieldSnapshot;
  try {
    candidateIdField = snapshotField(candidateValue, "candidateId");
    manifestDigestField = snapshotField(candidateValue, "manifestDigest");
  } catch {
    return failed("PROMOTION_INVALID", "candidate identity field access failed");
  }
  if (!candidateIdField.ownDataProperty || !manifestDigestField.ownDataProperty) {
    return failed("PROMOTION_INVALID", "candidate identity fields must be own data properties");
  }
  const candidateId = candidateIdField.value;
  const manifestDigest = manifestDigestField.value;

  if (!isSafeOpaqueId(bookId)) {
    return failed("PROMOTION_INVALID", "bookId must be one safe opaque path segment");
  }
  if (!exactKeys(candidateValue, ["candidateId", "manifestDigest"])) {
    return failed("PROMOTION_INVALID", "candidate identity must contain only candidateId and manifestDigest");
  }
  if (
    !isSafeOpaqueId(candidateId) ||
    typeof manifestDigest !== "string" ||
    !DIGEST_PATTERN.test(manifestDigest)
  ) {
    return failed("PROMOTION_INVALID", "candidate identity is invalid");
  }
  if (!isSafeOpaqueId(reviewId) || !isSafeOpaqueId(qcRoundId)) {
    return failed("PROMOTION_INVALID", "reviewId and qcRoundId must be safe opaque path segments");
  }
  if (
    typeof expectedBookRevision !== "number" ||
    !Number.isSafeInteger(expectedBookRevision) ||
    expectedBookRevision < 0 ||
    !Number.isSafeInteger(expectedBookRevision + 1)
  ) {
    return failed("PROMOTION_INVALID", "expectedBookRevision and next revision must be non-negative safe integers");
  }
  const promotedAtMilliseconds = canonicalUtcMilliseconds(promotedAt);
  if (typeof promotedAt !== "string" || promotedAtMilliseconds === null) {
    return failed("PROMOTION_INVALID", "promotedAt must be canonical UTC ISO time");
  }

  let clockValue: string;
  try {
    clockValue = clock();
  } catch (cause) {
    return failed("PROMOTION_CLOCK_INVALID", `promotion clock failed: ${errorMessage(cause, "unknown clock error")}`);
  }
  const clockMilliseconds = canonicalUtcMilliseconds(clockValue);
  if (clockMilliseconds === null) {
    return failed("PROMOTION_CLOCK_INVALID", "promotion clock must return canonical UTC ISO time");
  }
  const candidate = Object.freeze({ candidateId, manifestDigest });
  const snapshot: ValidPromotionRequest = Object.freeze({
    bookId,
    candidate,
    reviewId,
    qcRoundId,
    expectedBookRevision,
    promotedAt,
  });
  return {
    ok: true,
    value: snapshot,
  };
}

function validLogicalPath(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0 || value.startsWith("/") || value.endsWith("/")) return false;
  const parts = value.split("/");
  return parts.every((part) => isSafeOpaqueId(part));
}

function validEntry(value: unknown): value is CandidateEntry {
  if (!isRecord(value) || !exactKeys(value, ["byteLength", "kind", "logicalPath", "mediaType"])) return false;
  return typeof value.kind === "string" && ARTIFACT_KINDS.has(value.kind) &&
    typeof value.mediaType === "string" && MEDIA_TYPES.has(value.mediaType) &&
    validLogicalPath(value.logicalPath) &&
    Number.isSafeInteger(value.byteLength) && (value.byteLength as number) >= 0;
}

function validSnapshotContainer(value: unknown, requireCurrentRevision: boolean): value is CandidateSnapshot {
  try {
    if (!isRecord(value) || !isRecord(value.manifest) || !Array.isArray(value.files)) return false;
    if (requireCurrentRevision) {
      return exactKeys(value, ["currentRevision", "files", "manifest"]) &&
        Number.isSafeInteger(value.currentRevision) &&
        (value.currentRevision as number) >= 1;
    }
    return exactKeys(value, ["files", "manifest"]);
  } catch {
    return false;
  }
}

function verifySnapshot(
  value: unknown,
  request: ValidPromotionRequest,
  expectedRevision?: number,
): Result<CandidateSnapshot> {
  if (!isRecord(value) || !isRecord(value.manifest) || !Array.isArray(value.files)) {
    return failed("CANDIDATE_MISMATCH", "candidate snapshot is incomplete or malformed");
  }
  const manifest = value.manifest;
  const expectedManifestKeys = manifest.parentCandidateId === undefined
    ? ["bookId", "candidateId", "createdAt", "createdByRunId", "entries", "manifestDigest", "schemaVersion"]
    : ["bookId", "candidateId", "createdAt", "createdByRunId", "entries", "manifestDigest", "parentCandidateId", "schemaVersion"];
  if (
    !exactKeys(manifest, expectedManifestKeys) ||
    manifest.schemaVersion !== "1" ||
    manifest.bookId !== request.bookId ||
    manifest.candidateId !== request.candidate.candidateId ||
    manifest.manifestDigest !== request.candidate.manifestDigest ||
    !DIGEST_PATTERN.test(String(manifest.manifestDigest)) ||
    typeof manifest.createdByRunId !== "string" ||
    manifest.createdByRunId.length === 0 ||
    canonicalUtcMilliseconds(manifest.createdAt) === null ||
    (manifest.parentCandidateId !== undefined && !isSafeOpaqueId(manifest.parentCandidateId)) ||
    !Array.isArray(manifest.entries) ||
    !manifest.entries.every(validEntry) ||
    manifest.entries.length !== value.files.length
  ) {
    return failed("CANDIDATE_MISMATCH", "candidate manifest does not match requested complete identity");
  }
  if (expectedRevision !== undefined && value.currentRevision !== expectedRevision) {
    return failed("CANDIDATE_MISMATCH", "CURRENT candidate revision does not match committed revision");
  }
  if (expectedRevision === undefined && value.currentRevision !== undefined) {
    return failed("CANDIDATE_MISMATCH", "candidate selector unexpectedly returned a current revision");
  }

  const entries = manifest.entries as CandidateEntry[];
  const seen = new Set<string>();
  const files: Array<CandidateEntry & { bytes: Uint8Array }> = [];
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    const file = value.files[index];
    if (
      seen.has(entry.logicalPath) ||
      !isRecord(file) ||
      !exactKeys(file, ["byteLength", "bytes", "kind", "logicalPath", "mediaType"]) ||
      file.kind !== entry.kind ||
      file.logicalPath !== entry.logicalPath ||
      file.mediaType !== entry.mediaType ||
      file.byteLength !== entry.byteLength ||
      !(file.bytes instanceof Uint8Array) ||
      file.bytes.byteLength !== entry.byteLength
    ) {
      return failed("CANDIDATE_MISMATCH", "candidate files do not exactly match ordered manifest inventory");
    }
    seen.add(entry.logicalPath);
    files.push({ ...entry, bytes: Buffer.from(file.bytes) });
  }

  const candidateManifest = {
    schemaVersion: "1" as const,
    bookId: request.bookId,
    candidateId: request.candidate.candidateId,
    ...(manifest.parentCandidateId === undefined ? {} : { parentCandidateId: manifest.parentCandidateId as string }),
    createdByRunId: manifest.createdByRunId as string,
    entries: entries.map((entry) => ({ ...entry })),
    manifestDigest: request.candidate.manifestDigest,
    createdAt: manifest.createdAt as string,
  };
  let recomputed: string;
  try {
    const { manifestDigest: _stored, ...metadata } = candidateManifest;
    recomputed = candidateManifestDigest(metadata, files);
  } catch (cause) {
    return failed("CANDIDATE_MISMATCH", `candidate checksum cannot be recomputed: ${errorMessage(cause, "invalid candidate")}`);
  }
  if (recomputed !== request.candidate.manifestDigest) {
    return failed("CANDIDATE_MISMATCH", "candidate checksum differs from requested manifestDigest");
  }
  return {
    ok: true,
    value: {
      manifest: candidateManifest,
      files,
      ...(expectedRevision === undefined ? {} : { currentRevision: expectedRevision }),
    },
  };
}

function validateReview(value: unknown, request: ValidPromotionRequest): Result<CanonicalReviewResult> {
  if (
    isRecord(value) &&
    exactKeys(value, ["candidate", "issues", "outcome"]) &&
    (value.outcome === "SHORTLIST" || value.outcome === "REJECT" || value.outcome === "ERROR")
  ) {
    return failed("REVIEW_MISMATCH", "screening result cannot authorize promotion");
  }
  if (!isRecord(value) || !exactKeys(value, ["candidate", "completedAt", "issues", "outcome", "reviewId", "schemaVersion"])) {
    return failed("REVIEW_UNAVAILABLE", "review service returned an invalid canonical review");
  }
  if (
    value.schemaVersion !== "1" ||
    typeof value.reviewId !== "string" ||
    !isRecord(value.candidate) ||
    !exactKeys(value.candidate, ["candidateId", "manifestDigest"]) ||
    typeof value.candidate.candidateId !== "string" ||
    typeof value.candidate.manifestDigest !== "string" ||
    !Array.isArray(value.issues) ||
    !value.issues.every(validReviewIssue) ||
    canonicalUtcMilliseconds(value.completedAt) === null ||
    (value.outcome !== "PASS" && value.outcome !== "FAIL" && value.outcome !== "ERROR")
  ) {
    return failed("REVIEW_UNAVAILABLE", "review service returned an invalid canonical review");
  }
  if (
    value.reviewId !== request.reviewId ||
    value.candidate.candidateId !== request.candidate.candidateId ||
    value.candidate.manifestDigest !== request.candidate.manifestDigest
  ) {
    return failed("REVIEW_MISMATCH", "canonical review does not match requested candidate/checksum");
  }
  if (value.outcome !== "PASS") {
    if (value.outcome === "FAIL" || value.outcome === "ERROR") {
      return failed("REVIEW_NOT_PROMOTABLE", `canonical review outcome is ${value.outcome}`);
    }
    return failed("REVIEW_MISMATCH", "canonical review outcome is invalid");
  }
  if (value.issues.some((issue) => (issue as Record<string, unknown>).severity === "BLOCKER")) {
    return failed("REVIEW_NOT_PROMOTABLE", "canonical PASS review contains a blocker");
  }
  return { ok: true, value: value as unknown as CanonicalReviewResult };
}

function validReviewIssue(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const expected = value.location === undefined
    ? ["code", "message", "severity"]
    : ["code", "location", "message", "severity"];
  return exactKeys(value, expected) &&
    typeof value.code === "string" && value.code.length > 0 &&
    (value.severity === "INFO" || value.severity === "WARN" || value.severity === "BLOCKER") &&
    typeof value.message === "string" && value.message.length > 0 &&
    (value.location === undefined || (typeof value.location === "string" && value.location.length > 0));
}

function validQcIssue(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const expected = value.location === undefined
    ? ["code", "message", "severity"]
    : ["code", "location", "message", "severity"];
  return exactKeys(value, expected) &&
    typeof value.code === "string" && value.code.length > 0 &&
    (value.severity === "WARN" || value.severity === "BLOCKER") &&
    typeof value.message === "string" && value.message.length > 0 &&
    (value.location === undefined || (typeof value.location === "string" && value.location.length > 0));
}

function validateQc(
  value: unknown,
  request: ValidPromotionRequest,
  review: CanonicalReviewResult,
): Result<QcRoundResult> {
  if (!isRecord(value) || !exactKeys(value, ["candidate", "completedAt", "issues", "outcome", "reviewId", "roundId", "schemaVersion"])) {
    return failed("QC_UNAVAILABLE", "QC service returned an invalid round");
  }
  if (
    value.schemaVersion !== "1" ||
    typeof value.roundId !== "string" ||
    typeof value.reviewId !== "string" ||
    !isRecord(value.candidate) ||
    !exactKeys(value.candidate, ["candidateId", "manifestDigest"]) ||
    typeof value.candidate.candidateId !== "string" ||
    typeof value.candidate.manifestDigest !== "string" ||
    !Array.isArray(value.issues) ||
    !value.issues.every(validQcIssue) ||
    canonicalUtcMilliseconds(value.completedAt) === null ||
    (value.outcome !== "PASS" && value.outcome !== "FAIL" && value.outcome !== "ERROR")
  ) {
    return failed("QC_UNAVAILABLE", "QC service returned an invalid round");
  }
  if (
    value.roundId !== request.qcRoundId ||
    value.reviewId !== request.reviewId ||
    value.candidate.candidateId !== request.candidate.candidateId ||
    value.candidate.manifestDigest !== request.candidate.manifestDigest
  ) {
    return failed("QC_MISMATCH", "QC round does not match requested candidate/checksum/review");
  }
  const reviewCompletedAt = canonicalUtcMilliseconds(review.completedAt);
  const completedAt = canonicalUtcMilliseconds(value.completedAt);
  if (
    reviewCompletedAt === null ||
    completedAt === null ||
    completedAt <= reviewCompletedAt
  ) {
    return failed("QC_STALE", "QC round must complete after canonical review");
  }
  if (value.outcome !== "PASS") {
    if (value.outcome === "FAIL" || value.outcome === "ERROR") {
      return failed("QC_NOT_PROMOTABLE", `QC round outcome is ${value.outcome}`);
    }
    return failed("QC_MISMATCH", "QC round outcome is invalid");
  }
  if (value.issues.some((issue) => (issue as Record<string, unknown>).severity === "BLOCKER")) {
    return failed("QC_NOT_PROMOTABLE", "QC PASS round contains a blocker");
  }
  return { ok: true, value: value as unknown as QcRoundResult };
}

function validCurrentPointer(value: unknown, bookId: string): value is CurrentBookPointer {
  return isRecord(value) &&
    exactKeys(value, ["bookId", "candidateId", "manifestDigest", "revision", "schemaVersion", "updatedAt"]) &&
    value.schemaVersion === "1" &&
    value.bookId === bookId &&
    isSafeOpaqueId(value.candidateId) &&
    typeof value.manifestDigest === "string" && DIGEST_PATTERN.test(value.manifestDigest) &&
    Number.isSafeInteger(value.revision) && (value.revision as number) >= 1 &&
    canonicalUtcMilliseconds(value.updatedAt) !== null;
}

function mapReadFailure<T>(domain: "candidate" | "review" | "QC", error: PortError): Result<T> {
  if (domain === "candidate" && (error.code === "CANDIDATE_NOT_FOUND" || error.code === "CANDIDATE_MISMATCH")) {
    return failed(error.code, error.message, error.retryable);
  }
  if (domain === "review" && error.code === "REVIEW_NOT_FOUND") {
    return failed("REVIEW_NOT_FOUND", error.message, error.retryable);
  }
  if (domain === "QC" && error.code === "QC_ROUND_NOT_FOUND") {
    return failed("QC_ROUND_NOT_FOUND", error.message, error.retryable);
  }
  return failed(`${domain.toUpperCase()}_UNAVAILABLE`, error.message, error.retryable);
}

class AtomicPromotionService implements PromotionService {
  readonly #options: PromotionServiceOptions;
  readonly #clock: () => string;

  constructor(options: PromotionServiceOptions) {
    this.#options = options;
    this.#clock = options.clock;
  }

  promote(request: PromotionRequest): Promise<Result<PromotionResult>> {
    let valid: Result<ValidPromotionRequest>;
    try {
      valid = validateRequest(request, this.#clock);
    } catch {
      valid = failed("PROMOTION_INVALID", "promotion request is malformed");
    }
    return valid.ok ? this.#promote(valid.value) : Promise.resolve(valid);
  }

  async #promote(request: ValidPromotionRequest): Promise<Result<PromotionResult>> {
    let openedRaw: unknown;
    try {
      openedRaw = await this.#options.candidateStore.open({
        bookId: request.bookId,
        selector: { kind: "CANDIDATE", candidateId: request.candidate.candidateId },
      });
    } catch (cause) {
      return failed("CANDIDATE_UNAVAILABLE", `candidate read threw: ${errorMessage(cause, "unknown candidate error")}`);
    }
    const opened = guardedResult<CandidateSnapshot>(openedRaw);
    if (!opened) return failed("CANDIDATE_UNAVAILABLE", "candidate store returned an invalid Result");
    if (!opened.ok) return mapReadFailure("candidate", opened.error);
    if (!validSnapshotContainer(opened.value, false)) {
      return failed("CANDIDATE_UNAVAILABLE", "candidate store returned an invalid candidate snapshot");
    }
    let candidate: Result<CandidateSnapshot>;
    try {
      candidate = verifySnapshot(opened.value, request);
    } catch {
      return failed("CANDIDATE_UNAVAILABLE", "candidate store returned an invalid candidate snapshot");
    }
    if (!candidate.ok) return candidate;

    let reviewReadRaw: unknown;
    try {
      reviewReadRaw = await this.#options.reviewService.get(request.bookId, request.reviewId);
    } catch (cause) {
      return failed("REVIEW_UNAVAILABLE", `canonical review read threw: ${errorMessage(cause, "unknown review error")}`);
    }
    const reviewRead = guardedResult<CanonicalReviewResult>(reviewReadRaw);
    if (!reviewRead) return failed("REVIEW_UNAVAILABLE", "review service returned an invalid Result");
    if (!reviewRead.ok) return mapReadFailure("review", reviewRead.error);
    if (!isRecord(reviewRead.value)) {
      return failed("REVIEW_UNAVAILABLE", "review service returned an invalid canonical review");
    }
    let review: Result<CanonicalReviewResult>;
    try {
      review = validateReview(reviewRead.value, request);
    } catch {
      return failed("REVIEW_UNAVAILABLE", "review service returned an invalid canonical review");
    }
    if (!review.ok) return review;

    let qcReadRaw: unknown;
    try {
      qcReadRaw = await this.#options.qcService.getRound(request.bookId, request.qcRoundId);
    } catch (cause) {
      return failed("QC_UNAVAILABLE", `QC round read threw: ${errorMessage(cause, "unknown QC error")}`);
    }
    const qcRead = guardedResult<QcRoundResult>(qcReadRaw);
    if (!qcRead) return failed("QC_UNAVAILABLE", "QC service returned an invalid Result");
    if (!qcRead.ok) return mapReadFailure("QC", qcRead.error);
    if (!isRecord(qcRead.value)) {
      return failed("QC_UNAVAILABLE", "QC service returned an invalid round");
    }
    let qc: Result<QcRoundResult>;
    try {
      qc = validateQc(qcRead.value, request, review.value);
    } catch {
      return failed("QC_UNAVAILABLE", "QC service returned an invalid round");
    }
    if (!qc.ok) return qc;

    let currentReadRaw: unknown;
    try {
      currentReadRaw = await this.#options.currentPointerStore.read(request.bookId);
    } catch (cause) {
      return failed("REVISION_UNAVAILABLE", `current revision read threw: ${errorMessage(cause, "unknown pointer error")}`);
    }
    const currentRead = guardedResult<CurrentBookPointer | null>(currentReadRaw);
    if (!currentRead) return failed("REVISION_UNAVAILABLE", "current pointer store returned an invalid Result");
    if (!currentRead.ok) return failed("REVISION_UNAVAILABLE", currentRead.error.message, currentRead.error.retryable);
    let currentValid: boolean;
    try {
      currentValid = currentRead.value === null || validCurrentPointer(currentRead.value, request.bookId);
    } catch {
      currentValid = false;
    }
    if (!currentValid) {
      return failed("REVISION_UNAVAILABLE", "current pointer record is malformed");
    }
    const currentRevision = currentRead.value?.revision ?? 0;
    if (currentRevision !== request.expectedBookRevision) {
      return failed(
        "REVISION_CONFLICT",
        `current pointer revision ${currentRevision} does not match expected ${request.expectedBookRevision}`,
        true,
      );
    }
    const previousCandidateId = currentRead.value?.candidateId;
    const next: CurrentBookPointer = {
      schemaVersion: "1",
      bookId: request.bookId,
      candidateId: request.candidate.candidateId,
      manifestDigest: request.candidate.manifestDigest,
      revision: request.expectedBookRevision + 1,
      updatedAt: request.promotedAt,
    };

    let committedRaw: unknown;
    try {
      committedRaw = await this.#options.currentPointerStore.compareAndSet({
        bookId: request.bookId,
        expectedRevision: request.expectedBookRevision,
        next,
      });
    } catch (cause) {
      return failed(
        "RECONCILIATION_REQUIRED",
        `current pointer commit acknowledgement is uncertain: ${errorMessage(cause, "unknown commit error")}`,
      );
    }
    const committed = guardedResult<CurrentBookPointer>(committedRaw);
    if (!committed) {
      return failed("RECONCILIATION_REQUIRED", "current pointer commit returned an invalid Result");
    }
    if (!committed.ok) {
      return committed.error.code === "REVISION_CONFLICT"
        ? failed("REVISION_CONFLICT", committed.error.message, true)
        : failed("RECONCILIATION_REQUIRED", `current pointer commit outcome is uncertain: ${committed.error.message}`);
    }
    let committedMatches = false;
    try {
      committedMatches = validCurrentPointer(committed.value, request.bookId) &&
        committed.value.schemaVersion === next.schemaVersion &&
        committed.value.bookId === next.bookId &&
        committed.value.candidateId === next.candidateId &&
        committed.value.manifestDigest === next.manifestDigest &&
        committed.value.revision === next.revision &&
        committed.value.updatedAt === next.updatedAt;
    } catch {
      committedMatches = false;
    }
    if (!committedMatches) {
      return failed("RECONCILIATION_REQUIRED", "current pointer commit returned unexpected identity");
    }

    let readbackRaw: unknown;
    try {
      readbackRaw = await this.#options.contentReader.open({ bookId: request.bookId, selector: { kind: "CURRENT" } });
    } catch (cause) {
      return failed(
        "RECONCILIATION_REQUIRED",
        `post-commit CURRENT readback threw: ${errorMessage(cause, "unknown readback error")}`,
      );
    }
    const readback = guardedResult<CandidateSnapshot>(readbackRaw);
    if (!readback) {
      return failed("RECONCILIATION_REQUIRED", "post-commit CURRENT readback returned an invalid Result");
    }
    if (!readback.ok) {
      return failed("RECONCILIATION_REQUIRED", `post-commit CURRENT readback failed: ${readback.error.message}`);
    }
    if (!validSnapshotContainer(readback.value, true)) {
      return failed("RECONCILIATION_REQUIRED", "post-commit CURRENT readback returned an invalid snapshot");
    }
    let verified: Result<CandidateSnapshot>;
    try {
      verified = verifySnapshot(readback.value, request, next.revision);
    } catch {
      return failed("RECONCILIATION_REQUIRED", "post-commit CURRENT readback returned an invalid snapshot");
    }
    if (!verified.ok) {
      return failed("RECONCILIATION_REQUIRED", `post-commit CURRENT readback mismatch: ${verified.error.message}`);
    }

    return {
      ok: true,
      value: {
        bookId: request.bookId,
        candidate: { ...request.candidate },
        ...(previousCandidateId === undefined ? {} : { previousCandidateId }),
        bookRevision: next.revision,
        readback: "VERIFIED",
        promotedAt: request.promotedAt,
      },
    };
  }
}

export function createPromotionService(options: PromotionServiceOptions): PromotionService {
  return new AtomicPromotionService(options);
}

export type {
  PromotionRequest,
  PromotionResult,
  PromotionService,
  PromotionServiceOptions,
} from "./promotionTypes.js";
