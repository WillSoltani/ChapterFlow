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

export function modelError(code: ModelErrorCode, message: string, retryable = false): ModelError {
  return { code, message, ...(retryable ? { retryable: true } : {}) };
}
