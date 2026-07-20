import { randomBytes } from "node:crypto";
import { hostname as osHostname } from "node:os";
import { mkdirSync, readFileSync, rmdirSync, unlinkSync } from "node:fs";
import { mkdir, readFile, rmdir, unlink, writeFile } from "node:fs/promises";

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

const heldLocks = new Map<string, LockRecord>();
let exitHookInstalled = false;

function claimPath(lockPath: string): string {
  return `${lockPath}.claim`;
}

function installExitHook(): void {
  if (exitHookInstalled) return;
  exitHookInstalled = true;
  process.once("exit", () => {
    for (const [path, record] of heldLocks) {
      let claimed = false;
      try {
        mkdirSync(claimPath(path), { mode: 0o700 });
        claimed = true;
        const parsed = parseLockRecord(readFileSync(path, "utf8"));
        if (parsed && sameRecord(parsed, record)) unlinkSync(path);
      } catch {
        // Exit cleanup is best-effort. Dead same-host owners are reclaimable.
      } finally {
        if (claimed) {
          try {
            rmdirSync(claimPath(path));
          } catch {
            // A stranded claim fails closed instead of risking concurrent mutation.
          }
        }
      }
    }
  });
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
      value.schemaVersion !== "1" ||
      !Number.isSafeInteger(value.pid) ||
      (value.pid ?? 0) < 1 ||
      typeof value.host !== "string" ||
      value.host.length === 0 ||
      typeof value.owner !== "string" ||
      value.owner.length === 0 ||
      typeof value.acquiredAt !== "string"
    ) return null;
    return value as LockRecord;
  } catch {
    return null;
  }
}

async function readRecord(path: string): Promise<LockState> {
  try {
    const record = parseLockRecord(await readFile(path, "utf8"));
    return record ? { kind: "HELD", record } : { kind: "INVALID" };
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === "ENOENT") return { kind: "MISSING" };
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

function isExisting(cause: unknown): boolean {
  return (cause as NodeJS.ErrnoException).code === "EEXIST";
}

function isMissing(cause: unknown): boolean {
  return (cause as NodeJS.ErrnoException).code === "ENOENT";
}

async function tryClaim(path: string): Promise<boolean> {
  try {
    await mkdir(claimPath(path), { mode: 0o700 });
    return true;
  } catch (cause) {
    // Never steal an existing claim: compare-then-remove would recreate the
    // stale-observation race this directory serializes.
    if (isExisting(cause)) return false;
    throw cause;
  }
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
): Promise<boolean> {
  const observed = await readRecord(path);
  if (observed.kind === "MISSING") return tryCreateRecord(path, record);
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

  try {
    await unlink(path);
  } catch (cause) {
    if (isMissing(cause)) return false;
    throw cause;
  }
  return tryCreateRecord(path, record);
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
        let claimed = false;
        let claimReleaseFailure: unknown;
        try {
          claimed = await tryClaim(path);
          if (claimed) acquired = await tryAcquireUnderClaim(path, record, processAlive);
        } catch (cause) {
          return error("LOCK_IO", `book lock claim failed: ${(cause as Error).message}`);
        } finally {
          if (claimed) {
            try {
              await rmdir(claimPath(path));
            } catch (cause) {
              claimReleaseFailure = cause;
            }
          }
        }
        if (claimReleaseFailure !== undefined) {
          if (acquired) {
            heldLocks.set(path, record);
            installExitHook();
          }
          return error("LOCK_IO", `book lock claim release failed: ${(claimReleaseFailure as Error).message}`);
        }
        if (acquired) break;

        const remaining = deadline - nowMs();
        if (remaining <= 0) {
          return error("LOCK_BUSY", `book write lock busy for ${bookId}`, true);
        }
        await sleep(Math.min(this.#pollMs, remaining));
      }
    } catch (cause) {
      return error("LOCK_IO", `book lock acquisition failed: ${(cause as Error).message}`);
    }

    heldLocks.set(path, record);
    installExitHook();
    try {
      this.#seams.point?.("lock.acquired");
      return await operation();
    } finally {
      try {
        this.#seams.point?.("lock.before-release");
      } finally {
        const releaseDeadline = nowMs() + this.#timeoutMs;
        while (true) {
          let claimed = false;
          try {
            claimed = await tryClaim(path);
            if (claimed) {
              const held = await readRecord(path);
              if (held.kind === "HELD" && sameRecord(held.record, record)) await unlink(path);
              break;
            }
          } catch (cause) {
            if (!isMissing(cause)) {
              // Failed token-checked release leaves recoverable lock evidence.
            }
            break;
          } finally {
            if (claimed) {
              try {
                await rmdir(claimPath(path));
              } catch {
                // A stranded claim fails closed instead of risking concurrent mutation.
              }
            }
          }
          const remaining = releaseDeadline - nowMs();
          if (remaining <= 0) break;
          await sleep(Math.min(this.#pollMs, remaining));
        }
        heldLocks.delete(path);
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
