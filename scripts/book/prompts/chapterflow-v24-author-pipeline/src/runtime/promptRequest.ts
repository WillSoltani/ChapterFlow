import type { ArtifactMediaType } from "../contracts/v4Core.js";

export interface PromptRequest {
  readonly templateId: string;
  readonly inputs: readonly Readonly<{
    name: string;
    mediaType: ArtifactMediaType;
    bytes: Uint8Array;
  }>[];
}
