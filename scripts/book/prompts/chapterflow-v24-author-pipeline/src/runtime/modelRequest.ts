import type { AttemptId, BookId, RunId, StageId } from "../contracts/v4Core.js";
import type { PipelineRole } from "./codexRoute.js";
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
  /** R-021: the pipeline role this task belongs to. The gateway resolves the
   *  route (model + effort tier) from it, so review/QC actually run at the
   *  tiers config/model-routing.json names instead of every role sharing the
   *  defaultRoute. Absent = defaultRoute; an unrecognised value is rejected,
   *  never downgraded. Any field added here MUST also be added to
   *  modelGateway's snapshotTask whitelist (R-223) or it is silently erased. */
  readonly role?: PipelineRole;
}
