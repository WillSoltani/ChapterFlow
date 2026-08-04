import { appendFile, mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { bookPaths } from "../books/bookPaths.js";
import type { BookWriteLock } from "../books/leaseTypes.js";
import type { CandidateIdentity, QcRoundId, RepairId, Result, ReviewId, UtcIso } from "../contracts/v4Core.js";

export interface RepairHistoryRecord {
  readonly schemaVersion: "1";
  readonly repairId: RepairId;
  readonly bookId: string;
  readonly ordinal: number;
  readonly predecessor: CandidateIdentity;
  readonly failedRoundId: QcRoundId;
  readonly successor: CandidateIdentity;
  readonly reviewId: ReviewId;
  readonly freshRoundId: QcRoundId;
  readonly qcOutcome: "PASS" | "FAIL" | "ERROR";
  readonly diagnosisId?: string;
  readonly completedAt: UtcIso;
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
  const record = value as Partial<RepairHistoryRecord>;
  return record.schemaVersion === "1"
    && record.bookId === bookId
    && typeof record.repairId === "string"
    && Number.isSafeInteger(record.ordinal)
    && (record.ordinal ?? 0) > 0
    && typeof record.predecessor?.candidateId === "string"
    && typeof record.predecessor?.manifestDigest === "string"
    && typeof record.failedRoundId === "string"
    && typeof record.successor?.candidateId === "string"
    && typeof record.successor?.manifestDigest === "string"
    && typeof record.reviewId === "string"
    && typeof record.freshRoundId === "string"
    && ["PASS", "FAIL", "ERROR"].includes(record.qcOutcome ?? "")
    && typeof record.completedAt === "string";
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
      if (existing.value.some((item) => item.ordinal === record.ordinal)) {
        return failed("REPAIR_HISTORY_CONFLICT", `repair ordinal already exists: ${record.ordinal}`);
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
