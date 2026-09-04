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
  /**
   * OPTIONAL. The absolute directory this store keeps one run's state in, for a
   * stage that wants to write DIAGNOSTICS beside the run it is executing (the
   * compiler's rejected section packs). Present on the file-backed store; absent
   * on in-memory fakes, and a caller that gets `undefined` simply writes nothing.
   *
   * It is a read of the store's own layout, never a licence to write run state:
   * the store reads a run directory by exact filename (`run.json`,
   * `attempts.jsonl`, `stages/`), so a file written alongside takes no part in run
   * identity, attempt lifecycle or resume.
   */
  runDirectory?(bookId: BookId, runId: RunId): string;
}
