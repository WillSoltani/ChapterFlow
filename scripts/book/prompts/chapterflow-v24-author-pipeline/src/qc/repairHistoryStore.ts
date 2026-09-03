import { appendFile, mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { bookPaths } from "../books/bookPaths.js";
import type { BookWriteLock } from "../books/leaseTypes.js";
import type { CandidateIdentity, QcRoundId, RepairId, Result, ReviewId, UtcIso } from "../contracts/v4Core.js";

/** What every repair transition records, whichever lane produced it. */
interface RepairHistoryCommon {
  readonly schemaVersion: "1";
  readonly repairId: RepairId;
  readonly bookId: string;
  /** The lane ordinal this transition executed under; unique WITHIN its lane. */
  readonly ordinal: number;
  readonly predecessor: CandidateIdentity;
  readonly successor: CandidateIdentity;
  readonly completedAt: UtcIso;
}

/** A fresh-QC-FAIL repair: anchored on the round that failed, and carrying the
 *  successor's own review and fresh round. `lane` is absent on every record
 *  written before the discriminator existed, which is exactly what those records
 *  were — QC-lane transitions. */
export interface QcLaneRepairHistoryRecord extends RepairHistoryCommon {
  readonly lane?: "QC";
  readonly failedRoundId: QcRoundId;
  readonly reviewId: ReviewId;
  readonly freshRoundId: QcRoundId;
  readonly qcOutcome: "PASS" | "FAIL" | "ERROR";
  readonly diagnosisId?: string;
}

/**
 * R-170 — a canonical-review-FAIL repair.
 *
 * The review lane owns no QC round and no successor review (the BOOK RUN
 * re-reviews the successor, and that verdict lives in the review store), so it
 * records what it actually knows: the FAIL verdict that authorized it and the
 * predecessor/successor pair it produced. Before this the lane wrote NOTHING —
 * live: a 4-line repair-history against 11 review-repair ordinals and 33
 * review-repair model admissions, so most of a book's repair transitions had no
 * durable record at all.
 *
 * It deliberately carries no `freshRoundId`/`qcOutcome`, which is what keeps the
 * QC lane's `priorUnsuccessful` diagnosis gate exactly as it was: that gate reads
 * QC-lane records only (see `isQcLaneRecord`), and a review-lane record can
 * neither satisfy nor trip it.
 */
export interface ReviewLaneRepairHistoryRecord extends RepairHistoryCommon {
  readonly lane: "REVIEW";
  /** The stored canonical review whose FAIL verdict authorized this repair. */
  readonly failedReviewId: ReviewId;
}

export type RepairHistoryRecord = QcLaneRepairHistoryRecord | ReviewLaneRepairHistoryRecord;

/** True for a fresh-QC-FAIL transition, including every legacy record written
 *  before the lane discriminator existed. The QC lane's gates read history
 *  THROUGH this, so adding a lane can never widen or narrow them. */
export function isQcLaneRecord(record: RepairHistoryRecord): record is QcLaneRepairHistoryRecord {
  return (record.lane ?? "QC") === "QC";
}

export interface RepairHistoryStore {
  list(bookId: string): Promise<Result<readonly RepairHistoryRecord[]>>;
  append(record: RepairHistoryRecord): Promise<Result<RepairHistoryRecord>>;
}

function failed<T>(code: string, message: string): Result<T> {
  return { ok: false, error: { code, message } };
}

function sameRecord(left: RepairHistoryRecord, right: RepairHistoryRecord): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function validRecord(value: unknown, bookId: string): value is RepairHistoryRecord {
  if (value === null || typeof value !== "object") return false;
  const record = value as Partial<Omit<QcLaneRepairHistoryRecord, "lane"> & Omit<ReviewLaneRepairHistoryRecord, "lane">>
    & { lane?: unknown };
  const common = record.schemaVersion === "1"
    && record.bookId === bookId
    && typeof record.repairId === "string"
    && Number.isSafeInteger(record.ordinal)
    && (record.ordinal ?? 0) > 0
    && typeof record.predecessor?.candidateId === "string"
    && typeof record.predecessor?.manifestDigest === "string"
    && typeof record.successor?.candidateId === "string"
    && typeof record.successor?.manifestDigest === "string"
    && typeof record.completedAt === "string";
  if (!common) return false;
  const lane = record.lane ?? "QC";
  // Each lane must carry its OWN shape and nothing else: a QC record that grew a
  // failedReviewId, or a review record carrying a fabricated fresh round, is
  // corruption rather than a legacy shape, and is rejected as such.
  if (lane === "QC") {
    return typeof record.failedRoundId === "string"
      && typeof record.reviewId === "string"
      && typeof record.freshRoundId === "string"
      && ["PASS", "FAIL", "ERROR"].includes(record.qcOutcome ?? "")
      && record.failedReviewId === undefined;
  }
  if (lane === "REVIEW") {
    return typeof record.failedReviewId === "string"
      && record.failedRoundId === undefined
      && record.reviewId === undefined
      && record.freshRoundId === undefined
      && record.qcOutcome === undefined
      && record.diagnosisId === undefined;
  }
  return false;
}

export class FileRepairHistoryStore implements RepairHistoryStore {
  readonly #booksRoot: string;
  readonly #writeLock: BookWriteLock;

  constructor(options: Readonly<{ booksRoot: string; writeLock: BookWriteLock }>) {
    this.#booksRoot = options.booksRoot;
    this.#writeLock = options.writeLock;
  }

  #path(bookId: string): string {
    return resolve(bookPaths(this.#booksRoot, bookId).bookRoot, "repair-history.jsonl");
  }

  async list(bookId: string): Promise<Result<readonly RepairHistoryRecord[]>> {
    let path: string;
    try {
      path = this.#path(bookId);
    } catch (cause) {
      return failed("REPAIR_HISTORY_INVALID", (cause as Error).message);
    }
    let bytes: string;
    try {
      bytes = await readFile(path, "utf8");
    } catch (cause) {
      if ((cause as NodeJS.ErrnoException).code === "ENOENT") return { ok: true, value: [] };
      return failed("REPAIR_HISTORY_READ_FAILED", (cause as Error).message);
    }
    const records: RepairHistoryRecord[] = [];
    for (const [index, line] of bytes.split("\n").entries()) {
      if (!line.trim()) continue;
      try {
        const record: unknown = JSON.parse(line);
        if (!validRecord(record, bookId)) return failed("REPAIR_HISTORY_CORRUPT", `invalid record at line ${index + 1}`);
        records.push(record);
      } catch (cause) {
        return failed("REPAIR_HISTORY_CORRUPT", `invalid JSON at line ${index + 1}: ${(cause as Error).message}`);
      }
    }
    return { ok: true, value: records };
  }

  async append(record: RepairHistoryRecord): Promise<Result<RepairHistoryRecord>> {
    if (!validRecord(record, record.bookId)) return failed("REPAIR_HISTORY_INVALID", "record does not match schema 1");
    return this.#writeLock.run(record.bookId, async () => {
      const existing = await this.list(record.bookId);
      if (!existing.ok) return existing;
      const duplicate = existing.value.find((item) => item.repairId === record.repairId);
      if (duplicate) {
        return sameRecord(duplicate, record)
          ? { ok: true, value: duplicate }
          : failed("REPAIR_HISTORY_CONFLICT", `repairId already records different transition: ${record.repairId}`);
      }
      // Ordinals are LANE-SCOPED: each lane walks its own ordinal space
      // (qc-repair 1..n and review-repair 1..n are different transitions), so a
      // global uniqueness check would have made the first review-lane record
      // collide with the first QC-lane one.
      const lane = record.lane ?? "QC";
      if (existing.value.some((item) => (item.lane ?? "QC") === lane && item.ordinal === record.ordinal)) {
        return failed("REPAIR_HISTORY_CONFLICT", `${lane} repair ordinal already exists: ${record.ordinal}`);
      }
      try {
        const path = this.#path(record.bookId);
        await mkdir(resolve(path, ".."), { recursive: true });
        await appendFile(path, `${JSON.stringify(record)}\n`, { encoding: "utf8", mode: 0o600 });
        return { ok: true, value: record };
      } catch (cause) {
        return failed("REPAIR_HISTORY_WRITE_FAILED", (cause as Error).message);
      }
    });
  }
}
