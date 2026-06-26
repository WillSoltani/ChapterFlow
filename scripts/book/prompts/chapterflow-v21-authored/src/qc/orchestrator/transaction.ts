import { randomBytes } from "crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, unlinkSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";

import { writeFileAtomic } from "../../lib/atomicWrite.js";
import { orchestratorRoundDir } from "./artifacts.js";

/**
 * QC transaction lease — an advisory per-(book, round) file lock with TTL-based
 * recovery of an abandoned lease.
 *
 * Every QC transaction body (finalize / submit / collect / status / ledger) is a
 * SYNCHRONOUS, sub-second disk operation — no codex session runs inside the lock
 * (reviewers run as separate sessions outside it, and the transaction only reads
 * their already-written artifacts). So a healthy owner releases the lock long
 * before the TTL; a stale lock means the owner crashed, and we recover it (move
 * it aside) and take over. There is no long-running owner to protect, so the
 * cross-host liveness/heartbeat machinery was unnecessary and was removed.
 *
 * Release is gated on the on-disk `ownerToken`, so a displaced old owner can
 * never delete or overwrite the lock a successor has since created.
 */

export type QcTransactionOperation =
  | "submit"
  | "collect"
  | "status"
  | "verify-repair"
  | "finalize"
  | "attestation"
  | "repair-ledger-quarantine";

export type QcTransactionRecord = {
  schemaVersion: "qc-transaction-lock-v2";
  bookId: string;
  roundId: string;
  operation: QcTransactionOperation;
  /** Human-readable holder id for logs: `qctx-<pid>-<rand>`. */
  ownerId: string;
  /** Authoritative ownership token — release is gated on this. */
  ownerToken: string;
  pid: number;
  acquiredAt: string;
  expiresAt: string;
};

export type QcTransactionLease = QcTransactionRecord & {
  lockPath: string;
  /** Lease duration, kept in memory for diagnostics. */
  ttlMs: number;
};

export type QcTransactionOptions = {
  now?: Date;
  ttlMs?: number;
  /**
   * When a LIVE (unexpired) lease blocks acquisition, wait-and-retry up to this
   * budget (ms) before failing, instead of throwing on the first collision. The
   * transaction body is a sub-second disk op, so a brief wait lets concurrent
   * acquirers serialize cleanly. Default 0 = fail-fast (the orchestrator's serial
   * finalize/collect/status callers keep their current behavior); only the
   * concurrent "submit" op opts in. A genuinely stuck holder still fails after the
   * budget (and its lease later goes stale → recovered), so this never masks a
   * real stall — it only rides out transient contention.
   */
  contendWaitMs?: number;
  /** Injectable synchronous sleep (tests pass a no-real-delay stub). */
  sleep?: (ms: number) => void;
};

const DEFAULT_TTL_MS = 15 * 60 * 1000;
/** Backoff step between contention retries (ms). The lock body is sub-second, so a
 *  freed lock is almost always caught within the first step or two. */
const CONTEND_STEP_MS = 100;
/** Contention-wait budget for the "submit" operation — the ONE concurrent op (many
 *  bar reviewers run `qc-submit` in parallel for the same round). Comfortably covers
 *  worst-case 12-way serialization at sub-second holds. submit runs in a one-shot
 *  CLI process, so this synchronous wait never blocks the orchestrator event loop. */
export const QC_SUBMIT_CONTEND_WAIT_MS = 8000;
const activeTransactions: QcTransactionLease[] = [];

/** Synchronous, non-busy wait (Atomics.wait on a throwaway shared buffer). Only
 *  reached on the submit path, which is always a one-shot `qc-submit` CLI process. */
function realSleep(ms: number): void {
  if (ms > 0) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

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
  ownerToken: string;
  now: Date;
  ttlMs: number;
}): QcTransactionRecord {
  return {
    schemaVersion: "qc-transaction-lock-v2",
    bookId: args.bookId,
    roundId: args.roundId,
    operation: args.operation,
    ownerId: args.ownerId,
    ownerToken: args.ownerToken,
    pid: process.pid,
    acquiredAt: args.now.toISOString(),
    expiresAt: new Date(args.now.getTime() + args.ttlMs).toISOString(),
  };
}

function serializeRecord(record: QcTransactionRecord): string {
  return JSON.stringify(record, null, 2);
}

function parseLock(path: string): QcTransactionRecord | null {
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as QcTransactionRecord;
    return raw?.schemaVersion === "qc-transaction-lock-v2" ? raw : null;
  } catch {
    return null;
  }
}

/** A lock is stale (recoverable) when it is absent/unreadable, or its TTL has passed. */
function stale(lock: QcTransactionRecord | null, now: Date): boolean {
  if (!lock) return true;
  const expires = Date.parse(lock.expiresAt);
  return !Number.isFinite(expires) || expires <= now.getTime();
}

function alreadyActiveError(bookId: string, roundId: string, lockPath: string, holder: QcTransactionRecord | null): Error {
  const who = holder
    ? `${holder.operation} owner ${holder.ownerToken} (pid ${holder.pid}) until ${holder.expiresAt}`
    : "an unreadable owner";
  return new Error(`QC transaction already active for ${bookId} ${roundId}: ${who} [lock: ${lockPath}]`);
}

/**
 * Move a stale (or unreadable) lock aside — forensic evidence of the abandoned
 * owner — so the canonical path is free for a fresh `wx` create. A live,
 * unexpired lock is never moved. A rename race (another process recovered first)
 * is benign: the caller's `wx` retry then fails closed.
 */
function recoverStaleLock(lockPath: string, now: Date): void {
  if (!existsSync(lockPath)) return;
  const current = parseLock(lockPath);
  if (current && !stale(current, now)) return;
  const stamp = now.toISOString().replace(/[^0-9A-Za-z]/g, "");
  try {
    renameSync(lockPath, `${lockPath}.recovered-${stamp}-${randomBytes(4).toString("hex")}`);
  } catch {
    // Another process won the race; the caller's wx create will fail closed.
  }
}

type AcquireAttempt =
  | { lease: QcTransactionLease }
  | { contended: QcTransactionRecord | null };

/** One acquisition attempt: create the lock exclusively, or — when it already
 *  exists — recover a stale lease and retry once. Returns the lease on success, or
 *  `{ contended }` when a LIVE lease still blocks it (so the caller waits + retries
 *  or fails). Holds no waiting itself; the backoff lives in acquireQcTransaction. */
function tryAcquireOnce(
  bookId: string,
  roundId: string,
  operation: QcTransactionOperation,
  ownerId: string,
  ownerToken: string,
  lockPath: string,
  options: QcTransactionOptions,
): AcquireAttempt {
  const now = nowDate(options);
  const lease = ttlMs(options);
  const record = lockRecord({ bookId, roundId, operation, ownerId, ownerToken, now, ttlMs: lease });
  try {
    writeFileSync(lockPath, serializeRecord(record), { encoding: "utf8", flag: "wx" });
    return { lease: { ...record, lockPath, ttlMs: lease } };
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code !== "EEXIST") throw err;
    const current = parseLock(lockPath);
    // A live, unexpired lease is never recoverable.
    if (current && !stale(current, now)) return { contended: current };
    recoverStaleLock(lockPath, now);
    try {
      writeFileSync(lockPath, serializeRecord(record), { encoding: "utf8", flag: "wx" });
      return { lease: { ...record, lockPath, ttlMs: lease } };
    } catch {
      // Another acquirer won the post-recovery create race → live contention again.
      return { contended: parseLock(lockPath) };
    }
  }
}

export function acquireQcTransaction(
  bookId: string,
  roundId: string,
  operation: QcTransactionOperation,
  options: QcTransactionOptions = {},
): QcTransactionLease {
  const reused = activeTransactions.find((tx) => tx.bookId === bookId && tx.roundId === roundId);
  if (reused) return reused;

  const lockPath = qcTransactionLockPath(bookId, roundId);
  mkdirSync(dirname(lockPath), { recursive: true });
  const ownerId = `qctx-${process.pid}-${randomBytes(8).toString("hex")}`;
  const ownerToken = randomBytes(16).toString("hex");

  // Bounded backoff: a LIVE lease blocks acquisition only briefly (sub-second body),
  // so wait-and-retry up to `contendWaitMs` (default 0 = fail-fast, unchanged for the
  // orchestrator's serial callers) before giving up. Stale recovery + the no-contention
  // path are handled inside tryAcquireOnce and never sleep.
  const sleep = options.sleep ?? realSleep;
  let remaining = Math.max(0, options.contendWaitMs ?? 0);
  for (;;) {
    const attempt = tryAcquireOnce(bookId, roundId, operation, ownerId, ownerToken, lockPath, options);
    if ("lease" in attempt) return attempt.lease;
    if (remaining <= 0) throw alreadyActiveError(bookId, roundId, lockPath, attempt.contended);
    const step = Math.min(CONTEND_STEP_MS, remaining);
    sleep(step);
    remaining -= step;
  }
}

export function commitQcTransaction(lease: QcTransactionLease): void {
  const current = parseLock(lease.lockPath);
  if (!current || current.ownerToken !== lease.ownerToken) {
    throw new Error(
      `QC transaction owner mismatch for ${lease.bookId} ${lease.roundId}; ${lease.ownerToken} cannot commit/release ` +
        `(lock now held by ${current?.ownerToken ?? "no one / unreadable"}).`,
    );
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
  // Reuse a lease only for the EXACT same book + round already held by this
  // process (a nested status/ledger write under a finalize). Searching the full
  // stack — not just the top — keeps a different-round operation nested inside
  // this one from being mistaken for a reuse of this lease, and vice versa.
  const reused = activeTransactions.find((tx) => tx.bookId === bookId && tx.roundId === roundId);
  if (reused) return fn(reused);

  const lease = acquireQcTransaction(bookId, roundId, operation, options);
  activeTransactions.push(lease);
  try {
    const result = fn(lease);
    try {
      commitQcTransaction(lease);
    } catch {
      // The operation SUCCEEDED; only the lock RELEASE failed because a successor reclaimed our lease
      // (we exceeded DEFAULT_TTL_MS during a long finalize and a concurrent acquirer
      // recoverStaleLock-renamed it). Releasing is moot — the successor owns the lock and runs its own
      // commit — so do NOT mask a successful finalize with a lock-cleanup owner-mismatch throw. (Same
      // tolerance the error-path below already applies; previously only the error path was guarded, so
      // a TTL breach on the SUCCESS path surfaced as an infra failure of an otherwise-good round.)
    }
    return result;
  } catch (err) {
    try {
      commitQcTransaction(lease);
    } catch {
      // Release only when ownership is retained; commit throws (and we swallow)
      // if a successor already owns the lock, leaving the successor's lock intact.
    }
    throw err;
  } finally {
    const idx = activeTransactions.findIndex((tx) => tx.ownerToken === lease.ownerToken);
    if (idx >= 0) activeTransactions.splice(idx, 1);
  }
}

export function writeJsonAtomicInTransaction(path: string, value: unknown): void {
  writeFileAtomic(path, `${JSON.stringify(value, null, 2)}\n`);
}
