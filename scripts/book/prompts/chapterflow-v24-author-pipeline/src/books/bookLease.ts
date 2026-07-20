import { randomBytes } from "node:crypto";
import { hostname as osHostname } from "node:os";
import { join } from "node:path";
import { lstat, mkdir, readFile, readdir, readlink, rmdir, symlink, unlink, writeFile } from "node:fs/promises";

import type { PortError, Result } from "../contracts/v4Core.js";
import { bookPaths, ensureDirectoryWithinBooksRoot, requireBooksRoot } from "./bookPaths.js";
import type { BookLockError, BookWriteLock, BookWriteLockOptions, BookWriteLockSeams } from "./leaseTypes.js";

interface LockRecord {
  readonly schemaVersion: "1";
  readonly pid: number;
  readonly host: string;
  readonly owner: string;
  readonly acquiredAt: string;
}

type LockState =
  | { readonly kind: "MISSING" }
  | { readonly kind: "INVALID" }
  | { readonly kind: "HELD"; readonly record: LockRecord };

type ClaimPhase = "CHOOSING" | "TICKET";

interface ClaimRecord extends LockRecord {
  readonly generation: string;
  readonly phase: ClaimPhase;
  readonly ticket: number;
}

type ClaimEntryState =
  | { readonly kind: "MISSING" }
  | { readonly kind: "INVALID"; readonly reason: string }
  | { readonly kind: "HELD"; readonly record: ClaimRecord };

interface ClaimEntry {
  readonly path: string;
  readonly record: ClaimRecord;
}

interface ClaimLease {
  readonly root: string;
  readonly path: string;
  readonly record: ClaimRecord;
}

function error(code: BookLockError["code"], message: string, retryable = false): Result<never, BookLockError> {
  return { ok: false, error: { code, message, retryable } };
}

function defaultProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (cause) {
    return (cause as NodeJS.ErrnoException).code !== "ESRCH";
  }
}

function parseLockRecord(bytes: string): LockRecord | null {
  try {
    const value = JSON.parse(bytes) as Partial<LockRecord>;
    if (
      value.schemaVersion !== "1"
      || !Number.isSafeInteger(value.pid)
      || (value.pid ?? 0) < 1
      || typeof value.host !== "string"
      || value.host.length === 0
      || typeof value.owner !== "string"
      || value.owner.length === 0
      || typeof value.acquiredAt !== "string"
    ) return null;
    return value as LockRecord;
  } catch {
    return null;
  }
}

function parseClaimRecord(target: string): ClaimRecord | null {
  try {
    const bytes = Buffer.from(target, "base64url").toString("utf8");
    const value = JSON.parse(bytes) as Partial<ClaimRecord>;
    if (
      value.schemaVersion !== "1"
      || !Number.isSafeInteger(value.pid)
      || (value.pid ?? 0) < 1
      || typeof value.host !== "string"
      || value.host.length === 0
      || typeof value.owner !== "string"
      || value.owner.length === 0
      || typeof value.acquiredAt !== "string"
      || typeof value.generation !== "string"
      || !/^[a-f0-9]{32}$/.test(value.generation)
      || (value.phase !== "CHOOSING" && value.phase !== "TICKET")
      || !Number.isSafeInteger(value.ticket)
      || (value.phase === "CHOOSING" && value.ticket !== 0)
      || (value.phase === "TICKET" && (value.ticket ?? 0) < 1)
    ) return null;
    return value as ClaimRecord;
  } catch {
    return null;
  }
}

async function readRecord(path: string): Promise<LockState> {
  try {
    const record = parseLockRecord(await readFile(path, "utf8"));
    return record ? { kind: "HELD", record } : { kind: "INVALID" };
  } catch (cause) {
    if (isMissing(cause)) return { kind: "MISSING" };
    throw cause;
  }
}

function sameRecord(left: LockRecord, right: LockRecord): boolean {
  return left.schemaVersion === right.schemaVersion
    && left.pid === right.pid
    && left.host === right.host
    && left.owner === right.owner
    && left.acquiredAt === right.acquiredAt;
}

function sameClaimRecord(left: ClaimRecord, right: ClaimRecord): boolean {
  return sameRecord(left, right)
    && left.generation === right.generation
    && left.phase === right.phase
    && left.ticket === right.ticket;
}

function isExisting(cause: unknown): boolean {
  return (cause as NodeJS.ErrnoException).code === "EEXIST";
}

function isMissing(cause: unknown): boolean {
  return (cause as NodeJS.ErrnoException).code === "ENOENT";
}

function claimRoot(lockPath: string): string {
  return `${lockPath}.claim`;
}

function claimEntryName(record: ClaimRecord): string {
  return `${record.generation}.${record.phase === "CHOOSING" ? "choosing" : "ticket"}`;
}

function encodedClaim(record: ClaimRecord): string {
  return Buffer.from(JSON.stringify(record), "utf8").toString("base64url");
}

async function ensureClaimRoot(root: string): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await mkdir(root, { mode: 0o700 });
      return;
    } catch (cause) {
      if (!isExisting(cause)) throw cause;
    }

    try {
      const stat = await lstat(root);
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`book claim root is not a directory: ${root}`);
      return;
    } catch (cause) {
      if (!isMissing(cause)) throw cause;
    }
  }
  throw new Error(`book claim root changed during creation: ${root}`);
}

async function createClaimEntry(root: string, record: ClaimRecord): Promise<string> {
  const path = join(root, claimEntryName(record));
  for (let attempt = 0; attempt < 3; attempt++) {
    await ensureClaimRoot(root);
    try {
      await symlink(encodedClaim(record), path);
      return path;
    } catch (cause) {
      if (isMissing(cause)) continue;
      if (isExisting(cause)) throw new Error(`book claim generation collision: ${record.generation}`);
      throw cause;
    }
  }
  throw new Error(`book claim root changed during publish: ${root}`);
}

async function readClaimEntry(path: string, expectedName: string): Promise<ClaimEntryState> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const target = await readlink(path);
      const record = parseClaimRecord(target);
      if (!record) return { kind: "INVALID", reason: "target record is malformed" };
      if (claimEntryName(record) !== expectedName) {
        return { kind: "INVALID", reason: `target names ${claimEntryName(record)}` };
      }
      return { kind: "HELD", record };
    } catch (cause) {
      if (isMissing(cause)) return { kind: "MISSING" };
      if ((cause as NodeJS.ErrnoException).code !== "EINVAL") {
        return { kind: "INVALID", reason: (cause as Error).message };
      }
      try {
        const stat = await lstat(path);
        if (!stat.isSymbolicLink()) return { kind: "INVALID", reason: (cause as Error).message };
      } catch (lstatCause) {
        if (isMissing(lstatCause)) return { kind: "MISSING" };
        return { kind: "INVALID", reason: (lstatCause as Error).message };
      }
    }
  }
  return { kind: "INVALID", reason: "symlink changed during repeated reads" };
}

async function listClaimEntries(root: string): Promise<readonly ClaimEntry[]> {
  let names: string[];
  try {
    names = await readdir(root);
  } catch (cause) {
    if (isMissing(cause)) return [];
    throw cause;
  }

  const entries: ClaimEntry[] = [];
  for (const name of names.sort()) {
    if (!/^[a-f0-9]{32}\.(choosing|ticket)$/.test(name)) continue;
    const path = join(root, name);
    const state = await readClaimEntry(path, name);
    if (state.kind === "MISSING") continue;
    if (state.kind === "INVALID") throw new Error(`invalid book claim generation entry: ${name}: ${state.reason}`);
    entries.push({ path, record: state.record });
  }
  return entries;
}

async function pruneDeadClaims(
  root: string,
  ownGeneration: string,
  host: string,
  processAlive: (pid: number) => boolean,
): Promise<readonly ClaimEntry[]> {
  while (true) {
    const entries = await listClaimEntries(root);
    let changed = false;
    for (const entry of entries) {
      const observed = entry.record;
      if (observed.generation === ownGeneration || observed.host !== host || processAlive(observed.pid)) continue;
      const confirmed = await readClaimEntry(entry.path, claimEntryName(observed));
      if (confirmed.kind === "MISSING") {
        changed = true;
        continue;
      }
      if (
        confirmed.kind !== "HELD"
        || !sameClaimRecord(confirmed.record, observed)
        || confirmed.record.host !== host
        || processAlive(confirmed.record.pid)
      ) continue;
      try {
        await unlink(entry.path);
        changed = true;
      } catch (cause) {
        if (!isMissing(cause)) throw cause;
        changed = true;
      }
    }
    if (!changed) return entries;
  }
}

async function retryDelay(pollMs: number, sleep: (milliseconds: number) => Promise<void>): Promise<void> {
  try {
    await sleep(pollMs);
  } catch {
    await new Promise<void>((resolve) => setTimeout(resolve, pollMs));
  }
}

async function releaseClaimEntryCompletely(
  path: string,
  expected: ClaimRecord,
  pollMs: number,
  sleep: (milliseconds: number) => Promise<void>,
): Promise<void> {
  while (true) {
    const state = await readClaimEntry(path, claimEntryName(expected));
    if (state.kind === "MISSING") return;
    if (state.kind === "INVALID") {
      await retryDelay(pollMs, sleep);
      continue;
    }
    if (!sameClaimRecord(state.record, expected)) {
      throw new Error(`book claim generation changed before release: ${expected.generation}`);
    }
    try {
      await unlink(path);
      return;
    } catch (cause) {
      if (isMissing(cause)) return;
      await retryDelay(pollMs, sleep);
    }
  }
}

async function cleanupClaimRoot(root: string): Promise<void> {
  try {
    await rmdir(root);
  } catch {
    // Empty container is non-locking. Concurrent generations may still use it.
  }
}

function claimPrecedes(left: ClaimRecord, right: ClaimRecord): boolean {
  return left.ticket < right.ticket
    || (left.ticket === right.ticket && left.generation < right.generation);
}

async function acquireClaim(
  path: string,
  lockRecord: LockRecord,
  deadline: number,
  nowMs: () => number,
  pollMs: number,
  sleep: (milliseconds: number) => Promise<void>,
  processAlive: (pid: number) => boolean,
): Promise<ClaimLease | null> {
  const root = claimRoot(path);
  const generation = randomBytes(16).toString("hex");
  const choosing: ClaimRecord = {
    ...lockRecord,
    generation,
    phase: "CHOOSING",
    ticket: 0,
  };
  let choosingPath: string | null = null;
  let ticketPath: string | null = null;
  let ticket: ClaimRecord | null = null;
  let acquired = false;

  try {
    choosingPath = await createClaimEntry(root, choosing);
    const initial = await pruneDeadClaims(root, generation, lockRecord.host, processAlive);
    const maxTicket = initial.reduce(
      (maximum, entry) => entry.record.phase === "TICKET" ? Math.max(maximum, entry.record.ticket) : maximum,
      0,
    );
    if (maxTicket >= Number.MAX_SAFE_INTEGER) throw new Error("book claim ticket space exhausted");
    ticket = { ...choosing, phase: "TICKET", ticket: maxTicket + 1 };
    ticketPath = await createClaimEntry(root, ticket);
    await releaseClaimEntryCompletely(choosingPath, choosing, pollMs, sleep);
    choosingPath = null;

    while (true) {
      const entries = await pruneDeadClaims(root, generation, lockRecord.host, processAlive);
      const blocked = entries.some((entry) => {
        if (entry.record.generation === generation) return false;
        return entry.record.phase === "CHOOSING" || claimPrecedes(entry.record, ticket as ClaimRecord);
      });
      if (!blocked) {
        acquired = true;
        return { root, path: ticketPath, record: ticket };
      }

      const remaining = deadline - nowMs();
      if (remaining <= 0) return null;
      await sleep(Math.min(pollMs, remaining));
    }
  } finally {
    if (choosingPath) await releaseClaimEntryCompletely(choosingPath, choosing, pollMs, sleep);
    if (!acquired && ticketPath && ticket) await releaseClaimEntryCompletely(ticketPath, ticket, pollMs, sleep);
    if (!acquired) await cleanupClaimRoot(root);
  }
}

async function releaseClaim(
  lease: ClaimLease,
  pollMs: number,
  sleep: (milliseconds: number) => Promise<void>,
): Promise<void> {
  await releaseClaimEntryCompletely(lease.path, lease.record, pollMs, sleep);
  await cleanupClaimRoot(lease.root);
}

async function tryCreateRecord(path: string, record: LockRecord): Promise<boolean> {
  try {
    await writeFile(path, `${JSON.stringify(record)}\n`, { flag: "wx", mode: 0o600 });
    return true;
  } catch (cause) {
    if (isExisting(cause)) return false;
    throw cause;
  }
}

async function tryAcquireUnderClaim(
  path: string,
  record: LockRecord,
  processAlive: (pid: number) => boolean,
  point: BookWriteLockSeams["point"],
): Promise<boolean> {
  const observed = await readRecord(path);
  if (observed.kind === "MISSING") {
    point?.("claim.before-create");
    return tryCreateRecord(path, record);
  }
  if (
    observed.kind !== "HELD"
    || observed.record.host !== record.host
    || processAlive(observed.record.pid)
  ) return false;

  const confirmed = await readRecord(path);
  if (
    confirmed.kind !== "HELD"
    || !sameRecord(confirmed.record, observed.record)
    || confirmed.record.host !== record.host
    || processAlive(confirmed.record.pid)
  ) return false;

  point?.("claim.before-reclaim");
  try {
    await unlink(path);
  } catch (cause) {
    if (isMissing(cause)) return false;
    throw cause;
  }
  return tryCreateRecord(path, record);
}

async function releaseMainRecordCompletely(
  path: string,
  expected: LockRecord,
  pollMs: number,
  sleep: (milliseconds: number) => Promise<void>,
): Promise<void> {
  while (true) {
    let state: LockState;
    try {
      state = await readRecord(path);
    } catch {
      await retryDelay(pollMs, sleep);
      continue;
    }
    if (state.kind === "MISSING") return;
    if (state.kind === "HELD" && !sameRecord(state.record, expected)) return;
    if (state.kind === "INVALID") {
      await retryDelay(pollMs, sleep);
      continue;
    }
    try {
      await unlink(path);
      return;
    } catch (cause) {
      if (isMissing(cause)) return;
      await retryDelay(pollMs, sleep);
    }
  }
}

class FileBookWriteLock implements BookWriteLock {
  readonly #booksRoot: string;
  readonly #timeoutMs: number;
  readonly #pollMs: number;
  readonly #seams: BookWriteLockSeams;

  constructor(options: BookWriteLockOptions) {
    this.#booksRoot = requireBooksRoot(options.booksRoot);
    this.#timeoutMs = options.timeoutMs ?? 250;
    this.#pollMs = options.pollMs ?? 10;
    if (!Number.isSafeInteger(this.#timeoutMs) || this.#timeoutMs < 0) {
      throw new Error("lock timeoutMs must be a non-negative safe integer");
    }
    if (!Number.isSafeInteger(this.#pollMs) || this.#pollMs < 1) {
      throw new Error("lock pollMs must be a positive safe integer");
    }
    this.#seams = options.seams ?? {};
  }

  async run<T>(bookId: string, operation: () => Promise<Result<T>>): Promise<Result<T>> {
    let path: string;
    try {
      path = bookPaths(this.#booksRoot, bookId).writeLock;
    } catch (cause) {
      return error("INVALID_BOOK_ID", (cause as Error).message);
    }

    const nowMs = this.#seams.nowMs ?? Date.now;
    const sleep = this.#seams.sleep ?? ((milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
    const host = this.#seams.hostname?.() ?? osHostname();
    const pid = this.#seams.pid?.() ?? process.pid;
    const owner = this.#seams.ownerToken?.() ?? `${pid}-${host}-${randomBytes(12).toString("hex")}`;
    const processAlive = this.#seams.processAlive ?? defaultProcessAlive;
    const record: LockRecord = {
      schemaVersion: "1",
      pid,
      host,
      owner,
      acquiredAt: new Date(nowMs()).toISOString(),
    };
    const deadline = nowMs() + this.#timeoutMs;
    let acquired = false;

    try {
      await ensureDirectoryWithinBooksRoot(this.#booksRoot, bookPaths(this.#booksRoot, bookId).locksRoot);
      while (!acquired) {
        const lease = await acquireClaim(path, record, deadline, nowMs, this.#pollMs, sleep, processAlive);
        if (!lease) return error("LOCK_BUSY", `book write lock busy for ${bookId}`, true);

        let attemptFailure: unknown;
        let releaseFailure: unknown;
        try {
          this.#seams.point?.("claim.acquired");
          acquired = await tryAcquireUnderClaim(path, record, processAlive, this.#seams.point);
        } catch (cause) {
          attemptFailure = cause;
        } finally {
          try {
            this.#seams.point?.("claim.before-generation-release");
          } catch (cause) {
            releaseFailure = cause;
          }
          try {
            await releaseClaim(lease, this.#pollMs, sleep);
          } catch (cause) {
            releaseFailure ??= cause;
          }
        }
        if (attemptFailure !== undefined) {
          return error("LOCK_IO", `book lock claim failed: ${(attemptFailure as Error).message}`);
        }
        if (releaseFailure !== undefined) {
          if (acquired) await releaseMainRecordCompletely(path, record, this.#pollMs, sleep);
          return error("LOCK_IO", `book lock claim release failed: ${(releaseFailure as Error).message}`);
        }
        if (acquired) break;

        const remaining = deadline - nowMs();
        if (remaining <= 0) return error("LOCK_BUSY", `book write lock busy for ${bookId}`, true);
        await sleep(Math.min(this.#pollMs, remaining));
      }
    } catch (cause) {
      return error("LOCK_IO", `book lock acquisition failed: ${(cause as Error).message}`);
    }

    try {
      this.#seams.point?.("lock.acquired");
      return await operation();
    } finally {
      try {
        this.#seams.point?.("lock.before-release");
      } finally {
        const releaseDeadline = nowMs() + this.#timeoutMs;
        try {
          const lease = await acquireClaim(path, record, releaseDeadline, nowMs, this.#pollMs, sleep, processAlive);
          if (lease) {
            try {
              this.#seams.point?.("claim.acquired");
              this.#seams.point?.("claim.before-release");
              this.#seams.point?.("lock.before-exact-release");
              await releaseMainRecordCompletely(path, record, this.#pollMs, sleep);
            } finally {
              try {
                this.#seams.point?.("claim.before-generation-release");
              } finally {
                await releaseClaim(lease, this.#pollMs, sleep);
              }
            }
          } else {
            this.#seams.point?.("lock.before-exact-release");
            await releaseMainRecordCompletely(path, record, this.#pollMs, sleep);
          }
        } catch (cause) {
          await releaseMainRecordCompletely(path, record, this.#pollMs, sleep);
          throw cause;
        }
        this.#seams.point?.("lock.released");
      }
    }
  }
}

export function createBookWriteLock(options: BookWriteLockOptions): BookWriteLock {
  return new FileBookWriteLock(options);
}

export type { BookWriteLock, BookWriteLockOptions, BookWriteLockSeams } from "./leaseTypes.js";
export type { PortError } from "../contracts/v4Core.js";
