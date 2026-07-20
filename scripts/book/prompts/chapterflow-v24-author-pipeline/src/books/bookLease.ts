import { randomBytes } from "node:crypto";
import { hostname as osHostname } from "node:os";
import { readFileSync, unlinkSync } from "node:fs";
import { readFile, rename, rm, unlink, writeFile } from "node:fs/promises";

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

const heldLocks = new Map<string, string>();
let exitHookInstalled = false;

function installExitHook(): void {
  if (exitHookInstalled) return;
  exitHookInstalled = true;
  process.once("exit", () => {
    for (const [path, owner] of heldLocks) {
      try {
        const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<LockRecord>;
        if (parsed.owner === owner) unlinkSync(path);
      } catch {
        // Exit cleanup is best-effort. Dead same-host owners are reclaimable.
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

async function readRecord(path: string): Promise<LockRecord | null> {
  try {
    return parseLockRecord(await readFile(path, "utf8"));
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw cause;
  }
}

function isExisting(cause: unknown): boolean {
  return (cause as NodeJS.ErrnoException).code === "EEXIST";
}

function isMissing(cause: unknown): boolean {
  return (cause as NodeJS.ErrnoException).code === "ENOENT";
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
        try {
          await writeFile(path, `${JSON.stringify(record)}\n`, { flag: "wx", mode: 0o600 });
          acquired = true;
          break;
        } catch (cause) {
          if (!isExisting(cause)) return error("LOCK_IO", `book lock create failed: ${(cause as Error).message}`);
        }

        let held: LockRecord | null;
        try {
          held = await readRecord(path);
        } catch (cause) {
          return error("LOCK_IO", `book lock read failed: ${(cause as Error).message}`);
        }
        if (held && held.host === host && !processAlive(held.pid)) {
          const aside = `${path}.stale-${owner}`;
          try {
            await rename(path, aside);
            const moved = await readRecord(aside);
            if (moved?.owner !== held.owner) {
              await rename(aside, path).catch(() => undefined);
            } else {
              await rm(aside, { force: true });
            }
            continue;
          } catch (cause) {
            if (isMissing(cause) || isExisting(cause)) continue;
            return error("LOCK_IO", `stale book lock reclaim failed: ${(cause as Error).message}`);
          }
        }

        const remaining = deadline - nowMs();
        if (remaining <= 0) {
          return error("LOCK_BUSY", `book write lock busy for ${bookId}`, true);
        }
        await sleep(Math.min(this.#pollMs, remaining));
      }
    } catch (cause) {
      return error("LOCK_IO", `book lock acquisition failed: ${(cause as Error).message}`);
    }

    heldLocks.set(path, owner);
    installExitHook();
    try {
      this.#seams.point?.("lock.acquired");
      return await operation();
    } finally {
      try {
        this.#seams.point?.("lock.before-release");
      } finally {
        try {
          if ((await readRecord(path))?.owner === owner) await unlink(path);
        } catch {
          // A failed token-checked release leaves recoverable lock evidence.
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
