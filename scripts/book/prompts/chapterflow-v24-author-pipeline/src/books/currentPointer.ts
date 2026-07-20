import { readFile } from "node:fs/promises";

import type { BookId, CandidateId, ManifestDigest, PortError, Result, UtcIso } from "../contracts/v4Core.js";
import { replaceFileAtomic, type AtomicBookFileSeams } from "./atomicBookFiles.js";
import { bookPaths, requireBooksRoot, requirePathId } from "./bookPaths.js";
import type { BookWriteLock } from "./leaseTypes.js";

export interface CurrentBookPointer {
  readonly schemaVersion: "1";
  readonly bookId: BookId;
  readonly candidateId: CandidateId;
  readonly manifestDigest: ManifestDigest;
  readonly revision: number;
  readonly updatedAt: UtcIso;
}

export interface CurrentPointerStore {
  read(bookId: BookId): Promise<Result<CurrentBookPointer | null>>;
  compareAndSet(input: Readonly<{
    bookId: BookId;
    expectedRevision: number;
    next: CurrentBookPointer;
  }>): Promise<Result<CurrentBookPointer>>;
}

export interface CurrentPointerStoreOptions {
  readonly booksRoot: string;
  readonly writeLock: BookWriteLock;
  readonly atomicSeams?: AtomicBookFileSeams;
}

const POINTER_KEYS = ["bookId", "candidateId", "manifestDigest", "revision", "schemaVersion", "updatedAt"];

function failed<T>(code: string, message: string, retryable = false): Result<T> {
  return { ok: false, error: { code, message, retryable } };
}

function isCanonicalUtc(value: string): boolean {
  const millis = Date.parse(value);
  return Number.isFinite(millis) && new Date(millis).toISOString() === value;
}

function parsePointer(value: unknown, expectedBookId: string): Result<CurrentBookPointer> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return failed("POINTER_CORRUPT", "current pointer must be an object");
  }
  const record = value as Record<string, unknown>;
  if (Object.keys(record).sort().join("\0") !== POINTER_KEYS.join("\0")) {
    return failed("POINTER_CORRUPT", "current pointer fields do not match schema 1");
  }
  if (
    record.schemaVersion !== "1" ||
    record.bookId !== expectedBookId ||
    typeof record.candidateId !== "string" ||
    typeof record.manifestDigest !== "string" ||
    !/^[a-f0-9]{64}$/.test(record.manifestDigest) ||
    !Number.isSafeInteger(record.revision) ||
    (record.revision as number) < 1 ||
    typeof record.updatedAt !== "string" ||
    !isCanonicalUtc(record.updatedAt)
  ) {
    return failed("POINTER_CORRUPT", "current pointer values do not match schema 1");
  }
  try {
    requirePathId(record.candidateId, "candidateId");
  } catch (cause) {
    return failed("POINTER_CORRUPT", (cause as Error).message);
  }
  return {
    ok: true,
    value: {
      schemaVersion: "1",
      bookId: expectedBookId,
      candidateId: record.candidateId,
      manifestDigest: record.manifestDigest,
      revision: record.revision as number,
      updatedAt: record.updatedAt,
    },
  };
}

async function readPointer(path: string, bookId: string): Promise<Result<CurrentBookPointer | null>> {
  let bytes: string;
  try {
    bytes = await readFile(path, "utf8");
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === "ENOENT") return { ok: true, value: null };
    return failed("POINTER_READ_FAILED", `current pointer read failed: ${(cause as Error).message}`);
  }
  try {
    return parsePointer(JSON.parse(bytes), bookId);
  } catch (cause) {
    return failed("POINTER_CORRUPT", `current pointer JSON is corrupt: ${(cause as Error).message}`);
  }
}

class FileCurrentPointerStore implements CurrentPointerStore {
  readonly #booksRoot: string;
  readonly #writeLock: BookWriteLock;
  readonly #atomicSeams: AtomicBookFileSeams;

  constructor(options: CurrentPointerStoreOptions) {
    this.#booksRoot = requireBooksRoot(options.booksRoot);
    this.#writeLock = options.writeLock;
    this.#atomicSeams = options.atomicSeams ?? {};
  }

  async read(bookId: string): Promise<Result<CurrentBookPointer | null>> {
    let path: string;
    try {
      path = bookPaths(this.#booksRoot, bookId).currentPointer;
    } catch (cause) {
      return failed("INVALID_BOOK_ID", (cause as Error).message);
    }
    return readPointer(path, bookId);
  }

  async compareAndSet(input: Readonly<{
    bookId: string;
    expectedRevision: number;
    next: CurrentBookPointer;
  }>): Promise<Result<CurrentBookPointer>> {
    const bookId = input.bookId;
    const expectedRevision = input.expectedRevision;
    let pointerPath: string;
    try {
      pointerPath = bookPaths(this.#booksRoot, bookId).currentPointer;
    } catch (cause) {
      return failed("INVALID_BOOK_ID", (cause as Error).message);
    }
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
      return failed("INVALID_POINTER", "expectedRevision must be a non-negative safe integer");
    }
    const next = parsePointer(input.next, bookId);
    if (!next.ok) return failed("INVALID_POINTER", next.error.message);
    const nextPointer = next.value;
    if (nextPointer.revision !== expectedRevision + 1) {
      return failed("INVALID_POINTER", "next revision must equal expectedRevision + 1");
    }

    return this.#writeLock.run(bookId, async () => {
      const current = await readPointer(pointerPath, bookId);
      if (!current.ok) return current;
      const actualRevision = current.value?.revision ?? 0;
      if (actualRevision !== expectedRevision) {
        return failed(
          "REVISION_CONFLICT",
          `current pointer revision ${actualRevision} does not match expected ${expectedRevision}`,
          true,
        );
      }
      try {
        const encoded = Buffer.from(`${JSON.stringify(nextPointer, null, 2)}\n`, "utf8");
        await replaceFileAtomic(pointerPath, encoded, this.#atomicSeams);
        return { ok: true, value: nextPointer };
      } catch (cause) {
        return failed("POINTER_WRITE_FAILED", `current pointer atomic replace failed: ${(cause as Error).message}`);
      }
    });
  }
}

export function createCurrentPointerStore(options: CurrentPointerStoreOptions): CurrentPointerStore {
  return new FileCurrentPointerStore(options);
}

export type { PortError } from "../contracts/v4Core.js";
