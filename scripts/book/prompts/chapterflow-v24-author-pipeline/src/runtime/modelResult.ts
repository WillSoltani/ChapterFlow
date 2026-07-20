import type { AttemptId, PortError } from "../contracts/v4Core.js";

export interface ModelResult {
  readonly attemptId: AttemptId;
  readonly outcome: "SUCCEEDED" | "FAILED" | "TIMED_OUT" | "CANCELLED" | "UNKNOWN";
  readonly output?: unknown;
  readonly error?: PortError;
}
