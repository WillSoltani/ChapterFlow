import { createHash } from "node:crypto";

import type { ArtifactMediaType, Result } from "../contracts/v4Core.js";
import type { PromptInputTrust } from "./promptRequest.js";

export interface PromptInputData {
  readonly name: string;
  readonly mediaType: ArtifactMediaType;
  readonly bytes: Uint8Array;
  /** Absent for every input this function renders: a record IS the untrusted
   *  envelope. Declared here only so the renderer can pass one input shape
   *  around; an "instruction" input never reaches renderUntrustedData. */
  readonly trust?: PromptInputTrust;
}

function error(code: string, message: string): Result<string> {
  return { ok: false, error: { code, message } };
}

/** One JSON record per input. JSON string escaping keeps embedded newlines,
 * delimiters, quotes, and instruction-like bytes inside the data field. */
export function renderUntrustedData(input: PromptInputData): Result<string> {
  let value: string;
  try {
    value = new TextDecoder("utf-8", { fatal: true }).decode(input.bytes);
  } catch {
    return error("PROMPT_INPUT_INVALID", `input ${input.name} is not valid UTF-8`);
  }
  const record = {
    kind: "CHAPTERFLOW_UNTRUSTED_INPUT_V1",
    name: input.name,
    mediaType: input.mediaType,
    byteLength: input.bytes.byteLength,
    sha256: createHash("sha256").update(input.bytes).digest("hex"),
    text: value,
  };
  return { ok: true, value: JSON.stringify(record) };
}
