import type {
  AttemptId,
  BookId,
  CandidateIdentity,
  GitSha,
  PlannedArtifact,
  RunId,
  StageId,
  UtcIso,
} from "../contracts/v4Core.js";

export interface RunDefinition {
  readonly schemaVersion: "1";
  readonly bookId: BookId;
  readonly runId: RunId;
  readonly commandId: string;
  readonly sourceGitSha: GitSha;
  readonly requiredStages: readonly StageId[];
  readonly requiredInventory: readonly PlannedArtifact[];
  readonly inputCandidate?: CandidateIdentity;
  readonly attemptLimits: Readonly<{
    run: number;
    byStage: Readonly<Record<string, number>>;
  }>;
  readonly createdAt: UtcIso;
}

export type RunStatus = "RUNNING" | "CANCEL_REQUESTED" | "CANCELLED" | "FAILED" | "COMPLETED";

export type AttemptOutcome =
  | "SUCCEEDED"
  | "FAILED"
  | "TIMED_OUT"
  | "CANCELLED"
  | "UNKNOWN"
  | "ABANDONED";

export interface AttemptAdmission {
  readonly bookId: BookId;
  readonly runId: RunId;
  readonly attemptId: AttemptId;
  readonly stageId: StageId;
  readonly operationId: string;
  readonly admittedAt: UtcIso;
  readonly staleAt: UtcIso;
}

export interface AttemptSnapshot {
  readonly admission: AttemptAdmission;
  readonly outcome?: AttemptOutcome;
  readonly status: "ACTIVE" | "STALE" | AttemptOutcome;
}

export interface RunSnapshot {
  readonly definition: RunDefinition;
  readonly status: RunStatus;
  readonly attempts: readonly AttemptSnapshot[];
  readonly cancellationReason?: string;
  readonly terminalReason?: string;
}

export interface PersistedRunV1 {
  readonly schemaVersion: "1";
  readonly definition: RunDefinition;
  readonly status: RunStatus;
  readonly cancellation?: Readonly<{
    reason: string;
    requestedAt: UtcIso;
  }>;
  readonly terminal?: Readonly<{
    status: "CANCELLED" | "FAILED" | "COMPLETED";
    finishedAt: UtcIso;
    reason?: string;
  }>;
}

export interface AttemptAdmittedEventV1 {
  readonly schemaVersion: "1";
  readonly type: "ATTEMPT_ADMITTED";
  readonly admission: AttemptAdmission;
}

export interface AttemptFinishedEventV1 {
  readonly schemaVersion: "1";
  readonly type: "ATTEMPT_FINISHED";
  readonly bookId: BookId;
  readonly runId: RunId;
  readonly attemptId: AttemptId;
  readonly outcome: AttemptOutcome;
  readonly finishedAt: UtcIso;
  readonly detail?: string;
}

export type AttemptEventV1 = AttemptAdmittedEventV1 | AttemptFinishedEventV1;

export interface AttemptHistory {
  readonly admission: AttemptAdmission;
  readonly finish?: AttemptFinishedEventV1;
}
