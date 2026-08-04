import type {
  AttemptId,
  BookId,
  CandidateIdentity,
  Result,
  RunId,
  StageId,
  UtcIso,
} from "../contracts/v4Core.js";
import type { RunDefinition } from "./runTypes.js";

export interface StageCheckpoint {
  readonly schemaVersion: "1";
  readonly bookId: BookId;
  readonly runId: RunId;
  readonly stageId: StageId;
  readonly status: "COMPLETED" | "FAILED" | "CANCELLED";
  readonly attemptIds: readonly AttemptId[];
  readonly candidate?: CandidateIdentity;
  readonly completedAt: UtcIso;
}

export interface ResumePlan {
  readonly runId: RunId;
  readonly completedStages: readonly StageId[];
  readonly pendingStages: readonly StageId[];
  readonly cancelled: boolean;
}

export interface StageCoordinator {
  checkpoint(checkpoint: StageCheckpoint): Promise<Result<void>>;
  planResume(definition: RunDefinition): Promise<Result<ResumePlan>>;
}
