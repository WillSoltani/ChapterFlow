import type {
  ArtifactKind,
  ArtifactMediaType,
  BookId,
  CandidateId,
  ManifestDigest,
  PlannedArtifact,
  Result,
  RunId,
  UtcIso,
} from "../contracts/v4Core.js";

export interface CandidateEntry extends PlannedArtifact {
  readonly byteLength: number;
}

export interface CandidateManifest {
  readonly schemaVersion: "1";
  readonly bookId: BookId;
  readonly candidateId: CandidateId;
  readonly parentCandidateId?: CandidateId;
  readonly createdByRunId: RunId;
  readonly entries: readonly CandidateEntry[];
  readonly manifestDigest: ManifestDigest;
  readonly createdAt: UtcIso;
}

export interface CandidateInputFile extends PlannedArtifact {
  readonly bytes: Uint8Array;
}

export interface CandidateSnapshot {
  readonly manifest: CandidateManifest;
  readonly files: readonly Readonly<CandidateEntry & { bytes: Uint8Array }>[];
  readonly currentRevision?: number;
}

export type CandidateSelector =
  | { readonly kind: "CANDIDATE"; readonly candidateId: CandidateId }
  | { readonly kind: "CURRENT" };

export interface CandidateStore {
  stage(input: Readonly<{
    bookId: BookId;
    candidateId: CandidateId;
    parentCandidateId?: CandidateId;
    createdByRunId: RunId;
    expectedInventory: readonly PlannedArtifact[];
    files: readonly CandidateInputFile[];
    createdAt: UtcIso;
  }>): Promise<Result<CandidateManifest>>;
  open(input: Readonly<{
    bookId: BookId;
    selector: CandidateSelector;
  }>): Promise<Result<CandidateSnapshot>>;
}

export interface BookContentReader {
  open(input: Readonly<{
    bookId: BookId;
    selector: CandidateSelector;
  }>): Promise<Result<CandidateSnapshot>>;
}

export const ARTIFACT_KINDS = ["CHAPTER", "PROVENANCE", "SIDECAR"] as const satisfies readonly ArtifactKind[];
export const ARTIFACT_MEDIA_TYPES = [
  "text/plain",
  "text/markdown",
  "application/json",
] as const satisfies readonly ArtifactMediaType[];
