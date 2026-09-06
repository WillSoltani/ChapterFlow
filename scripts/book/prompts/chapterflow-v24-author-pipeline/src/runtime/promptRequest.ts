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
 * repo may set it, and only for a card this repo composes.
 *
 * The honest boundary: a card is not always pure repo text. The section card
 * interpolates the voice card, the drafted chapter prose and the rejected prior
 * draft; the editor card carries advisory and retry-blocker lines. Those are
 * bounded, pipeline-relayed fragments, and renderPrompt fails the request closed
 * if any line of them could pass for a block delimiter. Bulk material the repo
 * did NOT author — book source text, a sidecar, a candidate chapter, a reader
 * document — never carries this flag: it stays an escaped record. The chapter
 * editor's `source_span` is the worked example.
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
