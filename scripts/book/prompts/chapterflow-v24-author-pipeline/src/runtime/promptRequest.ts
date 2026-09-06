import type { ArtifactMediaType } from "../contracts/v4Core.js";

/**
 * Trust class of one prompt input.
 *
 * Absent (the default) = CONTENT: genuinely untrusted material — source text,
 * sidecars, a candidate chapter, a reader document — rendered as an escaped
 * CHAPTERFLOW_UNTRUSTED_INPUT_V1 record, byte for byte as it always has been.
 *
 * "instruction" = the PIPELINE'S OWN source-controlled task text, rendered as
 * trusted task instructions ahead of the records. Only a call site inside this
 * repo may set it, and only for bytes this repo authored; nothing derived from
 * a model response or a book source may carry it.
 */
export type PromptInputTrust = "instruction";

export interface PromptRequest {
  readonly templateId: string;
  readonly inputs: readonly Readonly<{
    name: string;
    mediaType: ArtifactMediaType;
    bytes: Uint8Array;
    trust?: PromptInputTrust;
  }>[];
}
