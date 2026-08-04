export type UtcIso = string;
export type GitSha = string;

export type BookId = string;
export type RunId = string;
export type AttemptId = string;
export type StageId = string;
export type CandidateId = string;
export type ReviewId = string;
export type QcRoundId = string;
export type RepairId = string;
export type ManifestDigest = string;

export interface PortError {
  readonly code: string;
  readonly message: string;
  readonly retryable?: boolean;
}

export type Result<T, E extends PortError = PortError> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export type ArtifactKind = "CHAPTER" | "PROVENANCE" | "SIDECAR";
export type ArtifactMediaType = "text/plain" | "text/markdown" | "application/json";

export interface PlannedArtifact {
  readonly kind: ArtifactKind;
  readonly logicalPath: string;
  readonly mediaType: ArtifactMediaType;
}

export interface CandidateIdentity {
  readonly candidateId: CandidateId;
  readonly manifestDigest: ManifestDigest;
}

export interface ModelTaskContext {
  readonly bookId: BookId;
  readonly runId: RunId;
  readonly attemptId: AttemptId;
  readonly stageId: StageId;
  readonly operationId: string;
  readonly workDir: string;
  readonly signal: AbortSignal;
}
