import { randomBytes } from "node:crypto";
import { link, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { Result } from "../contracts/v4Core.js";
import {
  bookPaths,
  ensureDirectoryWithinBooksRoot,
  readRegularFileWithinBooksRoot,
  requireBooksRoot,
  requirePathId,
} from "../books/bookPaths.js";
import type { CanonicalReviewResult, ReviewIssue } from "./reviewTypes.js";

export interface ReviewStore {
  get(bookId: string, reviewId: string): Promise<Result<CanonicalReviewResult>>;
  create(bookId: string, record: CanonicalReviewResult): Promise<Result<CanonicalReviewResult>>;
}

function failed<T>(code: string, message: string): Result<T> {
  return { ok: false, error: { code, message } };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function isCanonicalUtc(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString() === value;
}

function safeOpaqueId(value: string, label: string): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value === "." ||
    value === ".." ||
    value.includes("/") ||
    value.includes("\\") ||
    value.includes("\0") ||
    [...value].some((character) => character.charCodeAt(0) < 0x20 || character.charCodeAt(0) === 0x7f)
  ) {
    throw new Error(`${label} must be one safe opaque path segment`);
  }
  return value;
}

function parseIssue(value: unknown): ReviewIssue | null {
  if (!isRecord(value)) return null;
  const expected = value.location === undefined
    ? ["code", "message", "severity"]
    : ["code", "location", "message", "severity"];
  if (
    !exactKeys(value, expected) ||
    typeof value.code !== "string" ||
    value.code.length === 0 ||
    (value.severity !== "INFO" && value.severity !== "WARN" && value.severity !== "BLOCKER") ||
    typeof value.message !== "string" ||
    value.message.length === 0 ||
    (value.location !== undefined && (typeof value.location !== "string" || value.location.length === 0))
  ) {
    return null;
  }
  return {
    code: value.code,
    severity: value.severity,
    message: value.message,
    ...(value.location === undefined ? {} : { location: value.location as string }),
  };
}

function parseReview(value: unknown, bookId: string, reviewId: string): CanonicalReviewResult | null {
  if (!isRecord(value) || !exactKeys(value, ["candidate", "completedAt", "issues", "outcome", "reviewId", "schemaVersion"])) {
    return null;
  }
  if (
    value.schemaVersion !== "1" ||
    value.reviewId !== reviewId ||
    (value.outcome !== "PASS" && value.outcome !== "FAIL" && value.outcome !== "ERROR") ||
    !isCanonicalUtc(value.completedAt) ||
    !Array.isArray(value.issues) ||
    !isRecord(value.candidate) ||
    !exactKeys(value.candidate, ["candidateId", "manifestDigest"]) ||
    typeof value.candidate.candidateId !== "string" ||
    typeof value.candidate.manifestDigest !== "string" ||
    value.candidate.manifestDigest.length === 0
  ) {
    return null;
  }
  try {
    requirePathId(bookId, "bookId");
    requirePathId(value.candidate.candidateId, "candidateId");
  } catch {
    return null;
  }
  const issues = value.issues.map(parseIssue);
  if (issues.some((issue) => issue === null)) return null;
  return {
    schemaVersion: "1",
    reviewId,
    candidate: {
      candidateId: value.candidate.candidateId,
      manifestDigest: value.candidate.manifestDigest,
    },
    outcome: value.outcome,
    issues: issues as ReviewIssue[],
    completedAt: value.completedAt,
  };
}

function reviewPaths(booksRoot: string, bookId: string, reviewId: string): { directory: string; file: string } {
  const bookRoot = bookPaths(booksRoot, requirePathId(bookId, "bookId")).bookRoot;
  const safeReviewId = safeOpaqueId(reviewId, "reviewId");
  const directory = resolve(bookRoot, "reviews");
  return { directory, file: resolve(directory, `${safeReviewId}.json`) };
}

async function createFileAtomic(filePath: string, bytes: Uint8Array): Promise<"CREATED" | "EXISTS"> {
  const temporaryPath = `${filePath}.tmp-${process.pid}-${randomBytes(8).toString("hex")}`;
  try {
    await writeFile(temporaryPath, bytes, { flag: "wx", mode: 0o600 });
    try {
      await link(temporaryPath, filePath);
      return "CREATED";
    } catch (cause) {
      if ((cause as NodeJS.ErrnoException).code === "EEXIST") return "EXISTS";
      throw cause;
    }
  } finally {
    await unlink(temporaryPath).catch((cause: NodeJS.ErrnoException) => {
      if (cause.code !== "ENOENT") throw cause;
    });
  }
}

class FileReviewStore implements ReviewStore {
  readonly #booksRoot: string;

  constructor(booksRoot: string) {
    this.#booksRoot = requireBooksRoot(booksRoot);
  }

  async get(bookId: string, reviewId: string): Promise<Result<CanonicalReviewResult>> {
    let paths;
    try {
      paths = reviewPaths(this.#booksRoot, bookId, reviewId);
    } catch (cause) {
      return failed("INVALID_REVIEW_ID", (cause as Error).message);
    }
    let bytes: Buffer;
    try {
      bytes = await readRegularFileWithinBooksRoot(this.#booksRoot, paths.file);
    } catch (cause) {
      if ((cause as NodeJS.ErrnoException).code === "ENOENT") {
        return failed("REVIEW_NOT_FOUND", `canonical review not found: ${bookId}/${reviewId}`);
      }
      return failed("REVIEW_READ_FAILED", `canonical review read failed: ${(cause as Error).message}`);
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(bytes.toString("utf8"));
    } catch (cause) {
      return failed("REVIEW_RECORD_CORRUPT", `canonical review JSON is malformed: ${(cause as Error).message}`);
    }
    const record = parseReview(parsed, bookId, reviewId);
    return record
      ? { ok: true, value: record }
      : failed("REVIEW_RECORD_CORRUPT", `canonical review does not match schema 1: ${bookId}/${reviewId}`);
  }

  async create(bookId: string, record: CanonicalReviewResult): Promise<Result<CanonicalReviewResult>> {
    let paths;
    try {
      paths = reviewPaths(this.#booksRoot, bookId, record.reviewId);
      await ensureDirectoryWithinBooksRoot(this.#booksRoot, paths.directory);
    } catch (cause) {
      return failed("REVIEW_WRITE_FAILED", `canonical review directory failed: ${(cause as Error).message}`);
    }
    try {
      const created = await createFileAtomic(paths.file, Buffer.from(`${JSON.stringify(record, null, 2)}\n`, "utf8"));
      if (created === "CREATED") return { ok: true, value: record };
      return failed("REVIEW_ID_CONFLICT", `canonical review ID already exists: ${bookId}/${record.reviewId}`);
    } catch (cause) {
      return failed("REVIEW_WRITE_FAILED", `canonical review create failed: ${(cause as Error).message}`);
    }
  }
}

export function createReviewStore(booksRoot: string): ReviewStore {
  return new FileReviewStore(booksRoot);
}
