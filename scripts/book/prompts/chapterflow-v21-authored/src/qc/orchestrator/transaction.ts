import { randomBytes } from "crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, unlinkSync, writeFileSync } from "fs";
import { hostname as osHostname } from "os";
import { dirname, resolve } from "path";

import { writeFileAtomic } from "../../lib/atomicWrite.js";
import { orchestratorRoundDir } from "./artifacts.js";

/**
 * QC transaction lease — an ownership-safe file lock, not a bare TTL.
 *
 * The hazard a plain TTL creates: a long-running but perfectly healthy QC
 * operation (a finalize that spends 20 minutes calling out to the codex
 * reviewers) sails past the 15-minute TTL, a second process then sees the lock
 * as "expired", recovers it, and BOTH processes now believe they own the
 * round — split-brain over the ledger. Time-since-acquire says nothing about
 * whether the owner is alive.
 *
 * This lease answers the only question that matters before displacing a lock —
 * "is the original owner still alive?" — and refuses to recover unless the
 * answer is a confident "no". Four owner states:
 *
 *   live    — the lock is not expired. Never recoverable. A second owner that
 *             tries to acquire fails closed regardless of liveness.
 *   stale + dead    — expired AND the owner is provably gone (same host, the
 *                     pid no longer exists). The ONLY state we recover from.
 *   stale + live    — expired but the owner pid is still running on this host.
 *                     Fail closed: this is exactly the long-running-finalize
 *                     case the TTL alone would have stolen.
 *   stale + unknown — expired and we cannot prove the owner is dead (a remote
 *                     host, an unreadable/foreign lock). Fail closed.
 *
 * Two mechanisms keep a legitimate long run protected:
 *   1. Heartbeats ({@link heartbeatQcTransaction}) push `expiresAt` forward via
 *      an atomic rename so a healthy lease rarely even reaches the stale path.
 *      A background heartbeat is installed for real-clock runs; for purely
 *      synchronous operations (every current consumer) the event loop is
 *      blocked while `fn` runs, so the heartbeat cannot fire mid-operation —
 *      which is exactly why the liveness gate, not the heartbeat, is the
 *      load-bearing protection for a long synchronous owner.
 *   2. The liveness gate above: even with a long-expired lock, a same-host
 *      successor sees the owner pid alive and refuses to steal; a cross-host
 *      successor sees "unknown" and refuses to steal.
 *
 * Release and heartbeat are gated on the on-disk `ownerToken`, so a displaced
 * old owner can never delete or overwrite the lock a successor has since
 * created.
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
  /** Authoritative ownership token — release/heartbeat are gated on this. */
  ownerToken: string;
  /** Host the owner runs on; liveness is only probeable on the same host. */
  hostname: string;
  pid: number;
  acquiredAt: string;
  /** Last time the live owner extended its lease (== acquiredAt at first write). */
  lastHeartbeatAt: string;
  expiresAt: string;
};

export type QcTransactionLease = QcTransactionRecord & {
  lockPath: string;
  /** Lease duration, kept in memory so heartbeats re-extend by the same window. */
  ttlMs: number;
};

export type OwnerLiveness = "alive" | "dead" | "unknown";

/**
 * Decides whether the recorded owner is still running. Injectable so tests can
 * be deterministic about a dead/alive/unknown owner without spawning processes.
 */
export type OwnerLivenessProbe = (record: QcTransactionRecord) => OwnerLiveness;

export type QcTransactionOptions = {
  now?: Date;
  ttlMs?: number;
  /** Override the recorded host (and the default probe's notion of "this host"). */
  hostname?: string;
  /** Replace the default same-host pid probe (used by tests to force dead/unknown). */
  liveness?: OwnerLivenessProbe;
  /** Background heartbeat cadence for real-clock runs; defaults to ttlMs/2. */
  heartbeatIntervalMs?: number;
};

const DEFAULT_TTL_MS = 15 * 60 * 1000;
const MIN_HEARTBEAT_INTERVAL_MS = 1000;
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

function selfHostname(options: QcTransactionOptions): string {
  return options.hostname ?? osHostname();
}

function lockRecord(args: {
  bookId: string;
  roundId: string;
  operation: QcTransactionOperation;
  ownerId: string;
  ownerToken: string;
  hostname: string;
  now: Date;
  ttlMs: number;
}): QcTransactionRecord {
  const acquiredAt = args.now.toISOString();
  return {
    schemaVersion: "qc-transaction-lock-v2",
    bookId: args.bookId,
    roundId: args.roundId,
    operation: args.operation,
    ownerId: args.ownerId,
    ownerToken: args.ownerToken,
    hostname: args.hostname,
    pid: process.pid,
    acquiredAt,
    lastHeartbeatAt: acquiredAt,
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

function stale(lock: QcTransactionRecord | null, now: Date): boolean {
  if (!lock) return true;
  const expires = Date.parse(lock.expiresAt);
  return !Number.isFinite(expires) || expires <= now.getTime();
}

/**
 * Default owner-liveness probe. Liveness is only knowable on the SAME host:
 *   - same host + pid answers signal 0      => alive
 *   - same host + ESRCH (no such process)   => dead
 *   - same host + EPERM (exists, not ours)  => alive
 *   - remote host / missing host or pid     => unknown
 * "unknown" fails closed at the call site, so we never displace a lock we can't
 * prove is dead.
 */
export function defaultOwnerLiveness(record: QcTransactionRecord, host: string = osHostname()): OwnerLiveness {
  if (!record.hostname || record.hostname !== host) return "unknown";
  if (!Number.isInteger(record.pid) || record.pid <= 0) return "unknown";
  try {
    process.kill(record.pid, 0);
    return "alive";
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === "ESRCH") return "dead";
    if (code === "EPERM") return "alive";
    return "unknown";
  }
}

function alreadyActiveError(bookId: string, roundId: string, lockPath: string, holder: QcTransactionRecord | null): Error {
  const who = holder
    ? `${holder.operation} owner ${holder.ownerToken} (pid ${holder.pid}@${holder.hostname}) until ${holder.expiresAt}`
    : "an unreadable owner";
  return new Error(`QC transaction already active for ${bookId} ${roundId}: ${who} [lock: ${lockPath}]`);
}

type LockDecision =
  | { action: "recover"; record: QcTransactionRecord }
  | { action: "fail"; error: Error };

/**
 * Inspect the lock already on disk and decide whether the caller may displace
 * it. Recovery is permitted ONLY for a stale lock whose owner is provably dead;
 * every other case fails closed.
 */
function evaluateExistingLock(
  bookId: string,
  roundId: string,
  lockPath: string,
  now: Date,
  probe: OwnerLivenessProbe,
): LockDecision {
  const current = parseLock(lockPath);
  if (!current) {
    // The file exists but is unreadable or carries a foreign schema. We cannot
    // read its owner or expiry, so we cannot prove it is safe to displace.
    return {
      action: "fail",
      error: new Error(
        `QC transaction lock at ${lockPath} is held by an unrecognized owner (unreadable or incompatible schema); ` +
          `refusing to displace it. Remove the lock manually only if you are certain no QC process is running.`,
      ),
    };
  }
  if (!stale(current, now)) {
    // A live, unexpired lease — never recoverable, liveness is irrelevant.
    return { action: "fail", error: alreadyActiveError(bookId, roundId, lockPath, current) };
  }
  const liveness = probe(current);
  if (liveness === "dead") return { action: "recover", record: current };
  if (liveness === "alive") {
    return {
      action: "fail",
      error: new Error(
        `QC transaction for ${bookId} ${roundId} is past its lease (${current.expiresAt}) but owner pid ${current.pid} ` +
          `on ${current.hostname} is still alive; refusing to displace a running ${current.operation}.`,
      ),
    };
  }
  return {
    action: "fail",
    error: new Error(
      `QC transaction for ${bookId} ${roundId} is past its lease (${current.expiresAt}) but the liveness of owner ` +
        `pid ${current.pid} on ${current.hostname} is unknown; failing closed. Clear the lock at ${lockPath} only if ` +
        `no QC process is running.`,
    ),
  };
}

/**
 * Move a stale, dead owner's lock aside (forensic evidence of the displaced
 * owner) so the canonical path is free for a fresh wx create. Re-confirms the
 * lock is STILL the exact stale record we evaluated; if a fresh owner raced in,
 * recovery is abandoned and the caller's wx create fails closed instead.
 */
function recoverDeadLock(lockPath: string, now: Date, ownerId: string, expectedToken: string): void {
  if (!existsSync(lockPath)) return;
  const current = parseLock(lockPath);
  if (!current || current.ownerToken !== expectedToken || !stale(current, now)) return;
  const stamp = now.toISOString().replace(/[^0-9A-Za-z]/g, "");
  const recovered = `${lockPath}.recovered-${stamp}-${ownerId}`;
  try {
    renameSync(lockPath, recovered);
  } catch {
    // Another process won the race. The caller's wx create will fail closed.
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
  const host = selfHostname(options);
  const now = nowDate(options);
  const lease = ttlMs(options);
  const record = lockRecord({ bookId, roundId, operation, ownerId, ownerToken, hostname: host, now, ttlMs: lease });
  const probe = options.liveness ?? ((rec) => defaultOwnerLiveness(rec, host));

  try {
    writeFileSync(lockPath, serializeRecord(record), { encoding: "utf8", flag: "wx" });
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code !== "EEXIST") throw err;
    const decision = evaluateExistingLock(bookId, roundId, lockPath, now, probe);
    if (decision.action === "fail") throw decision.error;
    recoverDeadLock(lockPath, now, ownerId, decision.record.ownerToken);
    try {
      writeFileSync(lockPath, serializeRecord(record), { encoding: "utf8", flag: "wx" });
    } catch {
      throw alreadyActiveError(bookId, roundId, lockPath, parseLock(lockPath));
    }
  }
  return { ...record, lockPath, ttlMs: lease };
}

/**
 * Extend a live lease: push `expiresAt` forward and stamp `lastHeartbeatAt`.
 * Gated on the on-disk owner token — a lease that has lost the lock (a
 * successor recovered it) throws instead of clobbering the new owner. The
 * replacement is an atomic rename, so the lock is never momentarily absent.
 */
export function heartbeatQcTransaction(lease: QcTransactionLease, options: QcTransactionOptions = {}): QcTransactionLease {
  const current = parseLock(lease.lockPath);
  if (!current || current.ownerToken !== lease.ownerToken) {
    throw new Error(
      `QC transaction heartbeat owner mismatch for ${lease.bookId} ${lease.roundId}; lease ${lease.ownerToken} no longer holds the lock.`,
    );
  }
  const now = nowDate(options);
  const lease_ttl = options.ttlMs ?? lease.ttlMs ?? DEFAULT_TTL_MS;
  const updated: QcTransactionRecord = {
    ...current,
    lastHeartbeatAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + lease_ttl).toISOString(),
  };
  // Atomic replace (tmp + rename over the target) — never unlinks the live lock.
  writeFileAtomic(lease.lockPath, serializeRecord(updated));
  lease.lastHeartbeatAt = updated.lastHeartbeatAt;
  lease.expiresAt = updated.expiresAt;
  return lease;
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

/**
 * Install a background heartbeat for a real-clock run. Skipped entirely when a
 * deterministic `now` is injected (tests must not spin real timers), and
 * unref'd so a pending heartbeat never keeps the process alive.
 */
function startHeartbeatTimer(lease: QcTransactionLease, options: QcTransactionOptions): NodeJS.Timeout | null {
  if (options.now) return null;
  const intervalMs = options.heartbeatIntervalMs ?? Math.max(MIN_HEARTBEAT_INTERVAL_MS, Math.floor(lease.ttlMs / 2));
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) return null;
  const timer = setInterval(() => {
    try {
      heartbeatQcTransaction(lease);
    } catch {
      // Lost the lease (or it is gone). Stop heartbeating; commit will surface it.
      clearInterval(timer);
    }
  }, intervalMs);
  timer.unref?.();
  return timer;
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
  const heartbeatTimer = startHeartbeatTimer(lease, options);
  try {
    const result = fn(lease);
    commitQcTransaction(lease);
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
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    const idx = activeTransactions.findIndex((tx) => tx.ownerToken === lease.ownerToken);
    if (idx >= 0) activeTransactions.splice(idx, 1);
  }
}

export function writeJsonAtomicInTransaction(path: string, value: unknown): void {
  writeFileAtomic(path, `${JSON.stringify(value, null, 2)}\n`);
}
