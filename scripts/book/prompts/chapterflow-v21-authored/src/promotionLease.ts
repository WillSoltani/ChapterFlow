/**
 * Promotion lease — a per-book, ownership-safe file lock for library promotion.
 *
 * THE HAZARD THIS REPLACES
 * ------------------------
 * `promoteBook` used to call `recoverPromotionTransactions(bookId)` at the start
 * of every publish, which `rmSync`-removed EVERY `<bookId>.*` directory under
 * `state/books/_transactions`. It verified nothing — not ownership, not process
 * liveness, not age, not whether another live promotion was mid-stage in that
 * exact directory. Two promotions of the same book racing through that path
 * meant the second one's "recovery" deleted the first one's staging transaction
 * out from under it: a torn publish, or a lost package.
 *
 * THE GUARANTEE
 * -------------
 * Only one promotion for a given book may hold the lease at a time, and a
 * contender displaces an existing lease ONLY when it can prove the prior owner
 * is gone. The lease answers the one question a bare TTL cannot — "is the
 * original owner still alive?" — and refuses to recover unless the answer is a
 * confident "no". This is the same design the QC orchestrator transaction uses
 * (`src/qc/orchestrator/transaction.ts`), applied to the promotion seam.
 *
 * Four owner states, exactly one of which is recoverable:
 *
 *   live            — the lease has not expired. NEVER recoverable; a contender
 *                     fails closed regardless of any liveness claim.
 *   stale + dead    — expired AND the owner is provably gone (same host, the pid
 *                     no longer exists). The ONLY recoverable state.
 *   stale + alive   — expired but the owner pid is still running on this host.
 *                     Fail closed — this is the long-running-promotion case a
 *                     wall-clock TTL alone would have wrongly stolen.
 *   stale + unknown — expired and we cannot prove the owner is dead (a remote
 *                     host, an unreadable/foreign lock). Fail closed.
 *
 * Two mechanisms keep a legitimate long run protected:
 *   1. Heartbeats ({@link heartbeatPromotionLease}) push `expiresAt` forward via
 *      an atomic replace at every durable transition, so a healthy lease rarely
 *      even reaches the stale path.
 *   2. The liveness gate above. Promotion is synchronous (the event loop is
 *      blocked while it runs), so a same-host successor that finds an expired
 *      lock probes the owner pid, sees it alive, and refuses to steal — which is
 *      why the liveness gate, not the heartbeat, is the load-bearing protection
 *      for a long synchronous owner.
 *
 * Release and heartbeat are gated on the on-disk `ownerToken`, so a displaced
 * old owner can never delete or overwrite the lock a successor has since
 * created.
 */

import { randomBytes } from "crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "fs";
import { hostname as osHostname } from "os";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { writeFileAtomic } from "./lib/atomicWrite.js";

export const PROMOTION_LEASE_SCHEMA_VERSION = "promotion-lease-v1" as const;

/** The pipeline state dir these locks live under. Mirrors promoteBook's STATE
 *  (both files are in src/, so `../state` resolves to the same directory). */
const STATE = resolve(dirname(fileURLToPath(import.meta.url)), "../state");

export type PromotionLeaseRecord = {
  schemaVersion: typeof PROMOTION_LEASE_SCHEMA_VERSION;
  bookId: string;
  /** Human-readable holder id for logs: `promote-<pid>-<rand>`. */
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
  /** The promotion transaction this lease owns. Ties the lock to the staging
   *  directory `<bookId>.<transactionId>` so recovery can prove which directory
   *  belonged to which (now dead) owner. */
  transactionId: string;
};

export type PromotionLease = PromotionLeaseRecord & {
  lockPath: string;
  /** Lease duration, kept in memory so heartbeats re-extend by the same window. */
  ttlMs: number;
  /** If acquiring this lease displaced a stale, provably-dead prior owner, the
   *  record that was recovered — diagnostics only; the transaction-directory
   *  cleanup is owner-proven separately. */
  recoveredFrom?: PromotionLeaseRecord | null;
};

export type OwnerLiveness = "alive" | "dead" | "unknown";

/** Minimal shape a liveness probe needs. Both the lock record and a transaction
 *  directory's owner stamp satisfy it, so one probe serves both. */
export type OwnerIdentity = { hostname: string; pid: number };

/**
 * Decides whether a recorded owner is still running. Injectable so tests can be
 * deterministic about a dead/alive/unknown owner without spawning processes.
 */
export type OwnerLivenessProbe = (owner: OwnerIdentity) => OwnerLiveness;

export type PromotionLeaseOptions = {
  now?: Date;
  ttlMs?: number;
  /** Override the recorded host (and the default probe's notion of "this host"). */
  hostname?: string;
  /** Replace the default same-host pid probe (used by tests to force dead/unknown). */
  liveness?: OwnerLivenessProbe;
};

const DEFAULT_TTL_MS = 15 * 60 * 1000;

export function promotionLockDir(): string {
  return resolve(STATE, "books", "_locks");
}

export function promotionLockPath(bookId: string): string {
  return resolve(promotionLockDir(), `${bookId}.promotion.lock`);
}

/**
 * Default owner-liveness probe. Liveness is only knowable on the SAME host:
 *   - same host + pid answers signal 0      => alive
 *   - same host + ESRCH (no such process)   => dead
 *   - same host + EPERM (exists, not ours)  => alive
 *   - remote host / missing host or pid     => unknown
 * "unknown" fails closed at the call site, so we never displace a lock we cannot
 * prove is dead.
 */
export function defaultPromotionOwnerLiveness(owner: OwnerIdentity, host: string = osHostname()): OwnerLiveness {
  if (!owner.hostname || owner.hostname !== host) return "unknown";
  if (!Number.isInteger(owner.pid) || owner.pid <= 0) return "unknown";
  try {
    process.kill(owner.pid, 0);
    return "alive";
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === "ESRCH") return "dead";
    if (code === "EPERM") return "alive";
    return "unknown";
  }
}

function nowDate(options: PromotionLeaseOptions): Date {
  return options.now ?? new Date();
}

function ttlMsOf(options: PromotionLeaseOptions): number {
  const ttl = options.ttlMs ?? DEFAULT_TTL_MS;
  return Number.isFinite(ttl) && ttl > 0 ? ttl : DEFAULT_TTL_MS;
}

function selfHostname(options: PromotionLeaseOptions): string {
  return options.hostname ?? osHostname();
}

function serialize(record: PromotionLeaseRecord): string {
  return JSON.stringify(record, null, 2);
}

function parseLock(path: string): PromotionLeaseRecord | null {
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as PromotionLeaseRecord;
    return raw?.schemaVersion === PROMOTION_LEASE_SCHEMA_VERSION ? raw : null;
  } catch {
    return null;
  }
}

function stale(lock: PromotionLeaseRecord | null, now: Date): boolean {
  if (!lock) return true;
  const expires = Date.parse(lock.expiresAt);
  return !Number.isFinite(expires) || expires <= now.getTime();
}

function buildRecord(args: {
  bookId: string;
  transactionId: string;
  ownerId: string;
  ownerToken: string;
  hostname: string;
  now: Date;
  ttlMs: number;
}): PromotionLeaseRecord {
  const acquiredAt = args.now.toISOString();
  return {
    schemaVersion: PROMOTION_LEASE_SCHEMA_VERSION,
    bookId: args.bookId,
    ownerId: args.ownerId,
    ownerToken: args.ownerToken,
    hostname: args.hostname,
    pid: process.pid,
    acquiredAt,
    lastHeartbeatAt: acquiredAt,
    expiresAt: new Date(args.now.getTime() + args.ttlMs).toISOString(),
    transactionId: args.transactionId,
  };
}

function alreadyActiveError(bookId: string, lockPath: string, holder: PromotionLeaseRecord | null): Error {
  const who = holder
    ? `owner ${holder.ownerToken} (pid ${holder.pid}@${holder.hostname}, tx ${holder.transactionId}) until ${holder.expiresAt}`
    : "an unreadable owner";
  return new Error(
    `Promotion already active for ${bookId}: ${who}. Refusing to run a second concurrent promotion [lock: ${lockPath}].`,
  );
}

type LockDecision =
  | { action: "recover"; record: PromotionLeaseRecord }
  | { action: "fail"; error: Error };

/**
 * Inspect the lock already on disk and decide whether the caller may displace
 * it. Recovery is permitted ONLY for a stale lock whose owner is provably dead;
 * every other case fails closed with an actionable error.
 */
function evaluateExistingLock(
  bookId: string,
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
        `Promotion lock at ${lockPath} is held by an unrecognized owner (unreadable or incompatible schema); ` +
          `refusing to displace it. Remove the lock manually only if you are certain no promotion is running.`,
      ),
    };
  }
  if (!stale(current, now)) {
    // A live, unexpired lease — never recoverable, liveness is irrelevant.
    return { action: "fail", error: alreadyActiveError(bookId, lockPath, current) };
  }
  const liveness = probe(current);
  if (liveness === "dead") return { action: "recover", record: current };
  if (liveness === "alive") {
    return {
      action: "fail",
      error: new Error(
        `Promotion for ${bookId} is past its lease (${current.expiresAt}) but owner pid ${current.pid} on ` +
          `${current.hostname} is still alive; refusing to displace a running promotion. A long promotion is ` +
          `expected to outlive the wall-clock TTL — wait for it, do not clear the lock.`,
      ),
    };
  }
  return {
    action: "fail",
    error: new Error(
      `Promotion for ${bookId} is past its lease (${current.expiresAt}) but the liveness of owner pid ${current.pid} ` +
        `on ${current.hostname} is unknown; failing closed. Clear the lock at ${lockPath} only after confirming no ` +
        `promotion is running on that host.`,
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

/**
 * Acquire the per-book promotion lease. Atomic exclusive-create (`wx`) is the
 * primitive: the first writer wins; a contender that hits EEXIST evaluates the
 * existing lock and either fails closed or — only for a stale, provably-dead
 * owner — recovers it and retries the wx create once.
 *
 * @throws if the lock is held live, or held stale by an owner whose death cannot
 *         be proven (alive, or unknown liveness). Callers fail closed on throw.
 */
export function acquirePromotionLease(
  bookId: string,
  transactionId: string,
  options: PromotionLeaseOptions = {},
): PromotionLease {
  const lockPath = promotionLockPath(bookId);
  mkdirSync(dirname(lockPath), { recursive: true });

  const ownerId = `promote-${process.pid}-${randomBytes(8).toString("hex")}`;
  const ownerToken = randomBytes(16).toString("hex");
  const host = selfHostname(options);
  const now = nowDate(options);
  const ttl = ttlMsOf(options);
  const record = buildRecord({ bookId, transactionId, ownerId, ownerToken, hostname: host, now, ttlMs: ttl });
  const probe = options.liveness ?? ((owner) => defaultPromotionOwnerLiveness(owner, host));

  let recoveredFrom: PromotionLeaseRecord | null = null;
  try {
    writeFileSync(lockPath, serialize(record), { encoding: "utf8", flag: "wx" });
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code !== "EEXIST") throw err;
    const decision = evaluateExistingLock(bookId, lockPath, now, probe);
    if (decision.action === "fail") throw decision.error;
    recoveredFrom = decision.record;
    recoverDeadLock(lockPath, now, ownerId, decision.record.ownerToken);
    try {
      writeFileSync(lockPath, serialize(record), { encoding: "utf8", flag: "wx" });
    } catch {
      // A racing contender won the freed slot. Fail closed against whatever now
      // holds the lock rather than clobbering it.
      throw alreadyActiveError(bookId, lockPath, parseLock(lockPath));
    }
  }
  return { ...record, lockPath, ttlMs: ttl, recoveredFrom };
}

/**
 * Extend a live lease: push `expiresAt` forward and stamp `lastHeartbeatAt`.
 * Gated on the on-disk owner token — a lease that has lost the lock (a successor
 * recovered it) THROWS instead of clobbering the new owner. The replacement is
 * an atomic rename, so the lock is never momentarily absent.
 *
 * Called at every durable promotion transition; its ownership check is also what
 * makes the final rename fail closed when ownership has been lost.
 *
 * @throws if this lease no longer owns the on-disk lock.
 */
export function heartbeatPromotionLease(lease: PromotionLease, options: PromotionLeaseOptions = {}): PromotionLease {
  const current = parseLock(lease.lockPath);
  if (!current || current.ownerToken !== lease.ownerToken) {
    throw new Error(
      `Promotion lease ${lease.ownerToken} for ${lease.bookId} no longer holds the lock ` +
        `(now ${current?.ownerToken ?? "absent / unreadable"}); refusing to continue.`,
    );
  }
  const now = nowDate(options);
  const ttl = options.ttlMs ?? lease.ttlMs ?? DEFAULT_TTL_MS;
  const updated: PromotionLeaseRecord = {
    ...current,
    lastHeartbeatAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ttl).toISOString(),
  };
  writeFileAtomic(lease.lockPath, serialize(updated));
  lease.lastHeartbeatAt = updated.lastHeartbeatAt;
  lease.expiresAt = updated.expiresAt;
  return lease;
}

/** True iff this lease still owns the on-disk lock. Cheap pre-rename assertion. */
export function leaseStillOwned(lease: PromotionLease): boolean {
  const current = parseLock(lease.lockPath);
  return !!current && current.ownerToken === lease.ownerToken;
}

/**
 * Release the lease, compare-by-owner-token. Removes the lock ONLY when this
 * lease still owns it; a displaced old owner is a no-op, so it can never delete
 * a successor's lock. Best-effort and never throws, so it is safe in a `finally`
 * and never masks the error that triggered the release.
 *
 * @returns true if this lease's lock was removed, false otherwise.
 */
export function releasePromotionLease(lease: PromotionLease): boolean {
  try {
    const current = parseLock(lease.lockPath);
    if (!current || current.ownerToken !== lease.ownerToken) return false;
    unlinkSync(lease.lockPath);
    return true;
  } catch {
    return false;
  }
}
