import type { AttemptId, BookId, PortError, Result, RunId, UtcIso } from "../contracts/v4Core.js";
import type {
  AttemptAdmission,
  AttemptOutcome,
  AttemptSnapshot,
  RunDefinition,
  RunSnapshot,
} from "./runTypes.js";

export type RunStoreErrorCode =
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "CONFLICT"
  | "LIMIT_REACHED"
  | "CANCELLED"
  | "TERMINAL"
  | "UNSETTLED_ATTEMPTS"
  | "STATE_CORRUPT"
  | "LOCK_TIMEOUT"
  | "IO_ERROR";

export interface RunStoreError extends PortError {
  readonly code: RunStoreErrorCode;
}

export class RunStateFault extends Error implements RunStoreError {
  readonly code: RunStoreErrorCode;
  readonly retryable?: boolean;

  constructor(code: RunStoreErrorCode, message: string, retryable = false) {
    super(message);
    this.name = "RunStateFault";
    this.code = code;
    if (retryable) this.retryable = true;
  }
}

export function runStoreFailure<T>(error: unknown): Result<T, RunStoreError> {
  if (error instanceof RunStateFault) {
    return {
      ok: false,
      error: {
        code: error.code,
        message: error.message,
        ...(error.retryable === true ? { retryable: true } : {}),
      },
    };
  }
  const message = error instanceof Error ? error.message : String(error);
  return { ok: false, error: { code: "IO_ERROR", message, retryable: true } };
}

export interface RunStore {
  createRun(definition: RunDefinition): Promise<Result<RunSnapshot>>;
  readRun(bookId: BookId, runId: RunId, observedAt: UtcIso): Promise<Result<RunSnapshot>>;
  admitAttempt(admission: AttemptAdmission): Promise<Result<AttemptSnapshot>>;
  finishAttempt(input: Readonly<{
    bookId: BookId;
    runId: RunId;
    attemptId: AttemptId;
    outcome: AttemptOutcome;
    finishedAt: UtcIso;
    detail?: string;
  }>): Promise<Result<AttemptSnapshot>>;
  requestCancel(input: Readonly<{
    bookId: BookId;
    runId: RunId;
    reason: string;
    requestedAt: UtcIso;
  }>): Promise<Result<void>>;
  finishRun(input: Readonly<{
    bookId: BookId;
    runId: RunId;
    status: "CANCELLED" | "FAILED" | "COMPLETED";
    finishedAt: UtcIso;
    reason?: string;
  }>): Promise<Result<void>>;
}
