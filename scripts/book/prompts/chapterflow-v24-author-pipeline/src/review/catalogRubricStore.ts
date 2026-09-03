/**
 * catalogRubricStore — the durable home of a catalog-rubric panel result,
 * addressed by the candidate it judged: `books/<bookId>/rubric/<candidateId>.json`.
 *
 * The record is the AUTHORITY, exactly as the QC round is for the answer-key
 * judge: it is written BEFORE the stage's run-state run is finished COMPLETED,
 * so a crash in between leaves a durable panel and a resumable run rather than
 * a COMPLETED run with nothing behind it. A resume that finds a record replays
 * it and spends nothing.
 *
 * WHAT IS STORED, AND WHAT IS NOT. The record carries the three READER BLOCKS
 * and the identity they were produced against — never the aggregate, never the
 * verdict, never the bar. Medians, composite, tier and badge are recomputed
 * from the stored readers on every read (`aggregateCatalogRubric`), so a stored
 * aggregate can never drift from the readers it claims to summarize, and the
 * BAR stays an operator dial: raising it re-decides a stored panel for free and
 * fails closed, instead of quietly blessing a book scored against an older bar.
 *
 * CREATE-ONCE. A record is written with a link-based atomic create and is never
 * replaced. A second write of the same bytes is idempotent; a second write of
 * DIFFERENT bytes for the same candidate is `RUBRIC_RECORD_CONFLICT`, because
 * two disagreeing panels for one immutable candidate is a store integrity
 * problem, not a re-score.
 */

import { randomBytes } from "node:crypto";
import { link, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  bookPaths,
  ensureDirectoryWithinBooksRoot,
  readRegularFileWithinBooksRoot,
  requireBooksRoot,
  requirePathId,
} from "../books/bookPaths.js";
import type { CandidateIdentity, Result, UtcIso } from "../contracts/v4Core.js";
import { REVIEW_FACTORS, type ReviewFactor } from "../artifacts/artifactTypes.js";
import {
  CATALOG_RUBRIC_INSTRUMENT_VERSION,
  type CatalogRubricReaderResultV1,
} from "./catalogRubric.js";

/** The durable panel record. */
export type CatalogRubricRecordV1 = {
  readonly schemaVersion: "1";
  readonly instrumentVersion: typeof CATALOG_RUBRIC_INSTRUMENT_VERSION;
  readonly bookId: string;
  /** The EXACT bytes this panel judged. A record whose digest does not match the
   *  candidate being promoted is refused, never adapted. */
  readonly candidate: CandidateIdentity;
  readonly title: string;
  readonly author: string;
  readonly totalChapters: number;
  /** 1-based chapter numbers the readers were given, ascending. */
  readonly sampledChapterNumbers: readonly number[];
  /** Sha-256 over the exact reader document the panel read — provenance, so a
   *  later reader can tell whether two records saw the same page. */
  readonly documentSha256: string;
  readonly readers: readonly CatalogRubricReaderResultV1[];
  readonly completedAt: UtcIso;
};

export interface CatalogRubricStoragePaths {
  readonly rubricRoot: string;
  readonly record: (candidateId: string) => string;
}

export interface CatalogRubricStore {
  getRecord(bookId: string, candidateId: string): Promise<Result<CatalogRubricRecordV1>>;
  putRecord(bookId: string, record: CatalogRubricRecordV1): Promise<Result<CatalogRubricRecordV1>>;
  paths(bookId: string): Result<CatalogRubricStoragePaths>;
}

export const RUBRIC_RECORD_NOT_FOUND = "RUBRIC_RECORD_NOT_FOUND";
export const RUBRIC_RECORD_CORRUPT = "RUBRIC_RECORD_CORRUPT";
export const RUBRIC_RECORD_CONFLICT = "RUBRIC_RECORD_CONFLICT";
export const RUBRIC_RECORD_WRITE_FAILED = "RUBRIC_RECORD_WRITE_FAILED";
export const INVALID_RUBRIC_ID = "INVALID_RUBRIC_ID";

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

function isCanonicalUtc(value: unknown): value is UtcIso {
  if (typeof value !== "string") return false;
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString() === value;
}

export function catalogRubricStoragePaths(booksRoot: string, bookId: string): CatalogRubricStoragePaths {
  const bookRoot = bookPaths(booksRoot, requirePathId(bookId, "bookId")).bookRoot;
  const rubricRoot = resolve(bookRoot, "rubric");
  return {
    rubricRoot,
    record: (candidateId) => resolve(rubricRoot, `${requirePathId(candidateId, "candidateId")}.json`),
  };
}

const READER_KEYS: readonly string[] = [
  "reader", "gate_verdict", "gate_failures", "book3_churn", "note", ...REVIEW_FACTORS,
];

/** Reader blocks are serialized in the SKILL's own JSON shape — the same keys a
 *  reader returns — so a stored record is readable beside a book-score run's
 *  `readers.json` without translation. */
function serializeReader(reader: CatalogRubricReaderResultV1): Record<string, unknown> {
  return {
    reader: reader.reader,
    gate_verdict: reader.gateVerdict,
    gate_failures: reader.gateFailures,
    ...Object.fromEntries(REVIEW_FACTORS.map((factor) => [factor, reader.scores[factor]])),
    book3_churn: reader.churn,
    note: reader.note,
  };
}

function parseReader(value: unknown): CatalogRubricReaderResultV1 | null {
  if (!isRecord(value) || !exactKeys(value, READER_KEYS)) return null;
  if (typeof value.reader !== "number" || !Number.isInteger(value.reader) || value.reader < 1) return null;
  if (value.gate_verdict !== "PASS" && value.gate_verdict !== "FAIL") return null;
  if (typeof value.gate_failures !== "string" || value.gate_failures.length === 0) return null;
  if (value.book3_churn !== "LOW" && value.book3_churn !== "MED" && value.book3_churn !== "HIGH") return null;
  if (typeof value.note !== "string" || value.note.length === 0) return null;
  const scores: Record<string, number> = {};
  for (const factor of REVIEW_FACTORS) {
    const score = value[factor];
    if (typeof score !== "number" || !Number.isFinite(score) || score < 0 || score > 100) return null;
    scores[factor] = score;
  }
  return {
    reader: value.reader,
    gateVerdict: value.gate_verdict,
    gateFailures: value.gate_failures,
    scores: scores as Record<ReviewFactor, number>,
    churn: value.book3_churn,
    note: value.note,
  };
}

const RECORD_KEYS: readonly string[] = [
  "schemaVersion", "instrumentVersion", "bookId", "candidate", "title", "author",
  "totalChapters", "sampledChapterNumbers", "documentSha256", "readers", "completedAt",
];

export function serializeCatalogRubricRecord(record: CatalogRubricRecordV1): Record<string, unknown> {
  return {
    schemaVersion: record.schemaVersion,
    instrumentVersion: record.instrumentVersion,
    bookId: record.bookId,
    candidate: { candidateId: record.candidate.candidateId, manifestDigest: record.candidate.manifestDigest },
    title: record.title,
    author: record.author,
    totalChapters: record.totalChapters,
    sampledChapterNumbers: [...record.sampledChapterNumbers],
    documentSha256: record.documentSha256,
    readers: record.readers.map(serializeReader),
    completedAt: record.completedAt,
  };
}

/**
 * Strict parse. Every field is checked; nothing is defaulted. An
 * `instrumentVersion` that is not the current one is REFUSED rather than
 * replayed: a record produced under a different prompt or a different sampling
 * rule is a different measurement, and silently promoting on it would be the
 * instrument-drift fail-open the version stamp exists to prevent.
 */
export function parseCatalogRubricRecord(value: unknown, candidateId?: string): CatalogRubricRecordV1 | null {
  if (!isRecord(value) || !exactKeys(value, RECORD_KEYS)) return null;
  if (value.schemaVersion !== "1") return null;
  if (value.instrumentVersion !== CATALOG_RUBRIC_INSTRUMENT_VERSION) return null;
  if (typeof value.bookId !== "string" || value.bookId.length === 0) return null;
  if (typeof value.title !== "string" || value.title.length === 0) return null;
  if (typeof value.author !== "string" || value.author.length === 0) return null;
  if (typeof value.documentSha256 !== "string" || !/^[0-9a-f]{64}$/.test(value.documentSha256)) return null;
  if (!Number.isInteger(value.totalChapters) || (value.totalChapters as number) < 1) return null;
  if (!isCanonicalUtc(value.completedAt)) return null;
  const candidate = value.candidate;
  if (
    !isRecord(candidate) ||
    !exactKeys(candidate, ["candidateId", "manifestDigest"]) ||
    typeof candidate.candidateId !== "string" ||
    typeof candidate.manifestDigest !== "string" ||
    candidate.manifestDigest.length === 0 ||
    (candidateId !== undefined && candidate.candidateId !== candidateId)
  ) {
    return null;
  }
  try {
    requirePathId(candidate.candidateId, "candidateId");
  } catch {
    return null;
  }
  const numbers = value.sampledChapterNumbers;
  if (
    !Array.isArray(numbers) ||
    numbers.length === 0 ||
    !numbers.every((number) => Number.isInteger(number) && (number as number) >= 1) ||
    numbers.some((number, index) => index > 0 && (number as number) <= (numbers[index - 1] as number))
  ) {
    return null;
  }
  const rawReaders = value.readers;
  if (!Array.isArray(rawReaders) || rawReaders.length === 0) return null;
  const readers = rawReaders.map(parseReader);
  if (readers.some((reader) => reader === null)) return null;
  return {
    schemaVersion: "1",
    instrumentVersion: CATALOG_RUBRIC_INSTRUMENT_VERSION,
    bookId: value.bookId,
    candidate: { candidateId: candidate.candidateId, manifestDigest: candidate.manifestDigest },
    title: value.title,
    author: value.author,
    totalChapters: value.totalChapters as number,
    sampledChapterNumbers: numbers as number[],
    documentSha256: value.documentSha256,
    readers: readers as CatalogRubricReaderResultV1[],
    completedAt: value.completedAt,
  };
}

function sameBytes(left: CatalogRubricRecordV1, right: CatalogRubricRecordV1): boolean {
  return JSON.stringify(serializeCatalogRubricRecord(left)) === JSON.stringify(serializeCatalogRubricRecord(right));
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

class FileCatalogRubricStore implements CatalogRubricStore {
  readonly #booksRoot: string;

  constructor(booksRoot: string) {
    this.#booksRoot = requireBooksRoot(booksRoot);
  }

  paths(bookId: string): Result<CatalogRubricStoragePaths> {
    try {
      return { ok: true, value: catalogRubricStoragePaths(this.#booksRoot, bookId) };
    } catch (cause) {
      return failed(INVALID_RUBRIC_ID, (cause as Error).message);
    }
  }

  async getRecord(bookId: string, candidateId: string): Promise<Result<CatalogRubricRecordV1>> {
    const paths = this.paths(bookId);
    if (!paths.ok) return paths;
    let filePath: string;
    try {
      filePath = paths.value.record(candidateId);
    } catch (cause) {
      return failed(INVALID_RUBRIC_ID, (cause as Error).message);
    }
    const label = `catalog-rubric record ${bookId}/${candidateId}`;
    let bytes: Buffer;
    try {
      bytes = await readRegularFileWithinBooksRoot(this.#booksRoot, filePath);
    } catch (cause) {
      if ((cause as NodeJS.ErrnoException).code === "ENOENT") return failed(RUBRIC_RECORD_NOT_FOUND, `${label} not found`);
      return failed(RUBRIC_RECORD_CORRUPT, `${label} read failed: ${(cause as Error).message}`);
    }
    let value: unknown;
    try {
      value = JSON.parse(bytes.toString("utf8"));
    } catch (cause) {
      return failed(RUBRIC_RECORD_CORRUPT, `${label} JSON is malformed: ${(cause as Error).message}`);
    }
    const parsed = parseCatalogRubricRecord(value, candidateId);
    if (!parsed) return failed(RUBRIC_RECORD_CORRUPT, `${label} does not match the catalog-rubric record schema`);
    if (parsed.bookId !== bookId) {
      return failed(RUBRIC_RECORD_CORRUPT, `${label} names a different book (${parsed.bookId})`);
    }
    return { ok: true, value: parsed };
  }

  async putRecord(bookId: string, record: CatalogRubricRecordV1): Promise<Result<CatalogRubricRecordV1>> {
    if (record.bookId !== bookId) {
      return failed(RUBRIC_RECORD_CONFLICT, `catalog-rubric record names ${record.bookId}, stored under ${bookId}`);
    }
    const paths = this.paths(bookId);
    if (!paths.ok) return paths;
    let filePath: string;
    try {
      filePath = paths.value.record(record.candidate.candidateId);
      await ensureDirectoryWithinBooksRoot(this.#booksRoot, paths.value.rubricRoot);
    } catch (cause) {
      return failed(RUBRIC_RECORD_WRITE_FAILED, `catalog-rubric record directory failed: ${(cause as Error).message}`);
    }
    const bytes = Buffer.from(`${JSON.stringify(serializeCatalogRubricRecord(record), null, 2)}\n`, "utf8");
    let created: "CREATED" | "EXISTS";
    try {
      created = await createFileAtomic(filePath, bytes);
    } catch (cause) {
      return failed(RUBRIC_RECORD_WRITE_FAILED, `catalog-rubric record write failed: ${(cause as Error).message}`);
    }
    if (created === "CREATED") return { ok: true, value: record };
    const stored = await this.getRecord(bookId, record.candidate.candidateId);
    if (!stored.ok) return stored;
    if (!sameBytes(stored.value, record)) {
      return failed(
        RUBRIC_RECORD_CONFLICT,
        `catalog-rubric record for ${bookId}/${record.candidate.candidateId} already exists with different content`,
      );
    }
    return stored;
  }
}

export function createCatalogRubricStore(options: Readonly<{ booksRoot: string }>): CatalogRubricStore {
  return new FileCatalogRubricStore(options.booksRoot);
}
