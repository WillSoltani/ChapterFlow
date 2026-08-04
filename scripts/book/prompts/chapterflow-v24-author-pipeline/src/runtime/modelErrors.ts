import type { PortError } from "../contracts/v4Core.js";

export type ModelErrorCode =
  | "MODEL_TASK_INVALID"
  | "MODEL_PROFILE_INVALID"
  | "MODEL_RUN_UNAVAILABLE"
  | "MODEL_RUN_CANCELLED"
  | "MODEL_CAPACITY_EXHAUSTED"
  | "MODEL_ATTEMPT_EXISTS"
  | "MODEL_ADMISSION_DENIED"
  | "MODEL_PROCESS_FAILED"
  | "MODEL_OUTPUT_INVALID"
  | "MODEL_EXECUTION_UNCERTAIN"
  | "MODEL_TERMINAL_RECORD_FAILED"
  | "MODEL_CLI_UNQUALIFIED";

export interface ModelError extends PortError {
  readonly code: ModelErrorCode;
}

/**
 * Task 11af: DURABLE provider quota exhaustion vs a SHORT rate limit.
 *
 * Both surface as HTTP 429, but they need opposite handling: a short
 * rate_limit_error clears in seconds (bounded retry is right), while a weekly /
 * monthly / usage cap persists until the provider's quota window resets — hours
 * to days — so every in-loop retry burns an attempt and buries the real cause.
 * Live 2026-07-24: "You've hit your weekly limit - resets Jul 28 at 8pm" spent
 * 3 attempts x 5 operator rounds while reporting only "a transient model process
 * failure occurred before any output was produced".
 *
 * The discriminator is the provider's own wording — a named cap window or an
 * explicit reset horizon — not the status code, which cannot separate the two.
 * Matched against the message the 11x envelope classifier now surfaces verbatim.
 */
export function isQuotaExhaustedMessage(message: string): boolean {
  return /\b(weekly|monthly|daily|usage)\s+limit\b/i.test(message)
    || /\blimit\b[^\n]{0,40}\bresets\b/i.test(message);
}

export function modelError(code: ModelErrorCode, message: string, retryable = false): ModelError {
  return { code, message, ...(retryable ? { retryable: true } : {}) };
}
