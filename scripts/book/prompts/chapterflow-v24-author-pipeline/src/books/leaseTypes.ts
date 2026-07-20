import type { BookId, PortError, Result } from "../contracts/v4Core.js";

export interface BookWriteLock {
  run<T>(bookId: BookId, operation: () => Promise<Result<T>>): Promise<Result<T>>;
}

export type BookLockErrorCode = "INVALID_BOOK_ID" | "LOCK_BUSY" | "LOCK_IO";

export interface BookLockError extends PortError {
  readonly code: BookLockErrorCode;
}

export interface BookWriteLockSeams {
  readonly nowMs?: () => number;
  readonly sleep?: (milliseconds: number) => Promise<void>;
  readonly hostname?: () => string;
  readonly pid?: () => number;
  readonly ownerToken?: () => string;
  readonly processAlive?: (pid: number) => boolean;
  readonly point?: (name:
    | "claim.before-create"
    | "claim.before-reclaim"
    | "claim.before-release"
    | "lock.acquired"
    | "lock.before-release"
    | "lock.released"
  ) => void;
}

export interface BookWriteLockOptions {
  readonly booksRoot: string;
  readonly timeoutMs?: number;
  readonly pollMs?: number;
  readonly seams?: BookWriteLockSeams;
}
