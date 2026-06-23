import { randomBytes } from "crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, unlinkSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";

import { writeFileAtomic } from "../../lib/atomicWrite.js";
import { orchestratorRoundDir } from "./artifacts.js";

export type QcTransactionOperation =
  | "submit"
  | "collect"
  | "status"
  | "verify-repair"
  | "finalize"
  | "attestation"
  | "repair-ledger-quarantine";

export type QcTransactionRecord = {
  schemaVersion: "qc-transaction-lock-v1";
  bookId: string;
  roundId: string;
  operation: QcTransactionOperation;
  ownerId: string;
  pid: number;
  acquiredAt: string;
  expiresAt: string;
};

export type QcTransactionLease = QcTransactionRecord & {
  lockPath: string;
};

export type QcTransactionOptions = {
  now?: Date;
  ttlMs?: number;
};

const DEFAULT_TTL_MS = 15 * 60 * 1000;
const activeTransactions: QcTransactionLease[] = [];

export function qcTransactionLockPath(bookId: string, roundId: string): string {
  return resolve(orchestratorRoundDir(bookId, roundId), ".qc-transaction.lock");
}

function nowDate(options: QcTransactionOptions): Date {
  return options.now ?? new Date();
}

function ttlMs(options: QcTransactionOptions): number {
  return options.ttlMs ?? DEFAULT_TTL_MS;
}

function lockRecord(args: {
  bookId: string;
  roundId: string;
  operation: QcTransactionOperation;
  ownerId: string;
  now: Date;
  ttlMs: number;
}): QcTransactionRecord {
  return {
    schemaVersion: "qc-transaction-lock-v1",
    bookId: args.bookId,
    roundId: args.roundId,
    operation: args.operation,
    ownerId: args.ownerId,
    pid: process.pid,
    acquiredAt: args.now.toISOString(),
    expiresAt: new Date(args.now.getTime() + args.ttlMs).toISOString(),
  };
}

function parseLock(path: string): QcTransactionRecord | null {
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as QcTransactionRecord;
    return raw?.schemaVersion === "qc-transaction-lock-v1" ? raw : null;
  } catch {
    return null;
  }
}

function stale(lock: QcTransactionRecord | null, now: Date): boolean {
  if (!lock) return true;
  const expires = Date.parse(lock.expiresAt);
  return !Number.isFinite(expires) || expires <= now.getTime();
}

function recoverStaleLock(path: string, now: Date, ownerId: string): void {
  if (!existsSync(path)) return;
  const lock = parseLock(path);
  if (!stale(lock, now)) return;
  const stamp = now.toISOString().replace(/[^0-9A-Za-z]/g, "");
  const recovered = `${path}.recovered-${stamp}-${ownerId}`;
  try {
    renameSync(path, recovered);
  } catch {
    // Another process may have won recovery/acquisition. The caller retries the wx write.
  }
}

export function acquireQcTransaction(
  bookId: string,
  roundId: string,
  operation: QcTransactionOperation,
  options: QcTransactionOptions = {},
): QcTransactionLease {
  const existing = activeTransactions.at(-1);
  if (existing?.bookId === bookId && existing.roundId === roundId) return existing;

  const lockPath = qcTransactionLockPath(bookId, roundId);
  mkdirSync(dirname(lockPath), { recursive: true });
  const ownerId = `qctx-${process.pid}-${randomBytes(8).toString("hex")}`;
  const now = nowDate(options);
  const record = lockRecord({ bookId, roundId, operation, ownerId, now, ttlMs: ttlMs(options) });
  try {
    writeFileSync(lockPath, JSON.stringify(record, null, 2), { encoding: "utf8", flag: "wx" });
  } catch (err) {
    recoverStaleLock(lockPath, now, ownerId);
    try {
      writeFileSync(lockPath, JSON.stringify(record, null, 2), { encoding: "utf8", flag: "wx" });
    } catch {
      const current = parseLock(lockPath);
      const holder = current
        ? `${current.operation} owner ${current.ownerId} until ${current.expiresAt}`
        : "an unreadable owner";
      throw new Error(`QC transaction already active for ${bookId} ${roundId}: ${holder}`);
    }
  }
  return { ...record, lockPath };
}

export function commitQcTransaction(lease: QcTransactionLease): void {
  const current = parseLock(lease.lockPath);
  if (!current || current.ownerId !== lease.ownerId) {
    throw new Error(`QC transaction owner mismatch for ${lease.bookId} ${lease.roundId}; ${lease.ownerId} cannot commit/release`);
  }
  unlinkSync(lease.lockPath);
}

export function abandonQcTransactionForTest(lease: QcTransactionLease): void {
  rmSync(lease.lockPath, { force: true });
}

export function withQcTransaction<T>(
  bookId: string,
  roundId: string,
  operation: QcTransactionOperation,
  fn: (lease: QcTransactionLease) => T,
  options: QcTransactionOptions = {},
): T {
  const nested = activeTransactions.at(-1);
  if (nested?.bookId === bookId && nested.roundId === roundId) return fn(nested);

  const lease = acquireQcTransaction(bookId, roundId, operation, options);
  activeTransactions.push(lease);
  try {
    const result = fn(lease);
    commitQcTransaction(lease);
    return result;
  } catch (err) {
    try {
      commitQcTransaction(lease);
    } catch {
      // A mismatched/missing owner is reported by the original operation if any;
      // otherwise the next acquisition will fail closed or recover a stale lock.
    }
    throw err;
  } finally {
    const idx = activeTransactions.findIndex((tx) => tx.ownerId === lease.ownerId);
    if (idx >= 0) activeTransactions.splice(idx, 1);
  }
}

export function writeJsonAtomicInTransaction(path: string, value: unknown): void {
  writeFileAtomic(path, `${JSON.stringify(value, null, 2)}\n`);
}
