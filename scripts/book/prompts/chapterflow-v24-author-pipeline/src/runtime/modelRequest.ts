import type { AttemptId, BookId, RunId, StageId } from "../contracts/v4Core.js";
import type { PromptRequest } from "./promptRequest.js";

export interface ModelTask {
  readonly bookId: BookId;
  readonly runId: RunId;
  readonly attemptId: AttemptId;
  readonly stageId: StageId;
  readonly operationId: string;
  readonly profileId: string;
  readonly workDir: string;
  readonly prompt: PromptRequest;
  readonly signal: AbortSignal;
}
