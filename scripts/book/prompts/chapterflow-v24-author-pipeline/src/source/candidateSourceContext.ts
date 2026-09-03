/**
 * What a candidate's chapter is CHECKED AGAINST - resolved from the candidate's
 * own bytes and nothing else.
 *
 * Wave 1 (R-046) put the book inside the candidate: a run given `--source-text`
 * freezes the normalized text into the research run and the intake port copies
 * it, with the resolved chapter map, to `inputs/research/source-text.txt` and
 * `inputs/research/chapter-map.json` (researchCandidateApplicationPort.ts). This
 * module is the reader of that pair: given a candidate's files and a chapter
 * number it returns the exact span the sidecars were quoted from, or the honest
 * `model-memory` state for a book that never had a text.
 *
 * IT FAILS CLOSED, AND THE FAILURES ARE NOT SYMMETRIC.
 *
 *   - No frozen text and no sidecar claiming one -> `model-memory`. This is a
 *     first-class state, not an error: every book researched before ingestion
 *     existed is in it, and the judge simply cannot gate on recall.
 *   - A sidecar that DECLARES `sourceProvenance: "source-text"` while the
 *     candidate carries no frozen text -> ERROR. That candidate asserts its
 *     claims were checked against bytes it does not have, and silently
 *     downgrading it to `model-memory` would convert every blocker the judge
 *     could raise into a warning because a file went missing.
 *   - A frozen text whose chapter map is missing, malformed, bound to different
 *     bytes, or silent about this chapter -> ERROR, for the same reason: the
 *     span is the authority a source quote is verified against, and a run with
 *     no usable span cannot honestly say a claim is unsupported.
 *
 * Pure: no filesystem, no clock, no model.
 */

import { createHash } from "crypto";

import type { Result } from "../contracts/v4Core.js";
import { CHAPTER_MAP_SCHEMA_VERSION, type ChapterMapV1, type ResolvedChapterSpan } from "./chapterMap.js";
import type { ChapterSourceContext } from "../critics/semantic/sourceFidelityJudge.js";

/** Where the research intake copies the frozen text and its chapter map. */
export const CANDIDATE_SOURCE_TEXT_LOGICAL_PATH = "inputs/research/source-text.txt";
export const CANDIDATE_CHAPTER_MAP_LOGICAL_PATH = "inputs/research/chapter-map.json";

export const CANDIDATE_SOURCE_CONTEXT_INVALID = "CANDIDATE_QC_SOURCE_CONTEXT_INVALID";

export type CandidateFileLike = {
  readonly logicalPath: string;
  readonly bytes: Uint8Array;
};

/**
 * Most recalled sidecar claims handed to a model-memory fidelity call.
 *
 * A source-v2 sidecar carries 9-18 testable facts, 3-6 named examples and up to
 * ~18 key claims - about 40 lines. The cap exists so a pathological sidecar
 * cannot grow the prompt without bound; it is above every shape the schema
 * admits, so it changes nothing on a well-formed sidecar.
 */
export const MAX_RECALLED_CLAIMS = 60;

function failed<T>(message: string): Result<T> {
  return { ok: false, error: { code: CANDIDATE_SOURCE_CONTEXT_INVALID, message } };
}

function fileText(files: readonly CandidateFileLike[], logicalPath: string): string | null {
  const matches = files.filter((file) => file.logicalPath === logicalPath);
  if (matches.length !== 1) return null;
  return Buffer.from(matches[0].bytes).toString("utf8");
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function strings(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0) : [];
}

/** True when this sidecar says its claims were quoted from a real text. */
export function sidecarDeclaresSourceText(sidecar: unknown): boolean {
  return record(sidecar) && sidecar.sourceProvenance === "source-text";
}

/**
 * The sidecar's own claims, as the model-memory judge's context.
 *
 * Deliberately the CLAIMS and not the paraphrase notes: the judge is being asked
 * what it recalls of the book, and the sidecar's role here is to name the
 * propositions the chapter was built on, not to be believed. Ordered fact ->
 * example -> key claim so the same sidecar always renders the same bytes.
 */
export function recalledClaimsFromSidecar(sidecar: unknown): readonly string[] {
  if (!record(sidecar)) return [];
  const out: string[] = [];
  const facts = Array.isArray(sidecar.testableFacts) ? sidecar.testableFacts : [];
  for (const fact of facts) {
    if (record(fact) && typeof fact.claim === "string" && fact.claim.trim().length > 0) out.push(fact.claim);
  }
  const examples = Array.isArray(sidecar.namedExamples) ? sidecar.namedExamples : [];
  for (const example of examples) {
    if (!record(example)) continue;
    const label = typeof example.label === "string" ? example.label : "";
    const summary = typeof example.summary === "string" ? example.summary : "";
    if (summary.trim().length > 0) out.push(label.trim().length > 0 ? `${label}: ${summary}` : summary);
  }
  for (const claim of strings(sidecar.keyClaims)) if (!out.includes(claim)) out.push(claim);
  return out.slice(0, MAX_RECALLED_CLAIMS);
}

function parseChapterMap(raw: string, sourceText: string): Result<ChapterMapV1> {
  let value: unknown;
  try {
    value = JSON.parse(raw) as unknown;
  } catch {
    return failed(`${CANDIDATE_CHAPTER_MAP_LOGICAL_PATH} is malformed JSON`);
  }
  if (!record(value) || value.schemaVersion !== CHAPTER_MAP_SCHEMA_VERSION || !Array.isArray(value.spans)) {
    return failed(`${CANDIDATE_CHAPTER_MAP_LOGICAL_PATH} is not a ${CHAPTER_MAP_SCHEMA_VERSION} document`);
  }
  const digest = createHash("sha256").update(sourceText, "utf8").digest("hex");
  if (value.sourceTextSha256 !== digest) {
    return failed(
      `${CANDIDATE_CHAPTER_MAP_LOGICAL_PATH} is bound to source text ${String(value.sourceTextSha256)} but the candidate carries ${digest}`,
    );
  }
  return { ok: true, value: value as unknown as ChapterMapV1 };
}

function spanFor(map: ChapterMapV1, chapterNumber: number, textLength: number): Result<ResolvedChapterSpan> {
  const matches = map.spans.filter((span) => record(span) && span.chapterNumber === chapterNumber);
  if (matches.length !== 1) {
    return failed(`${CANDIDATE_CHAPTER_MAP_LOGICAL_PATH} has ${matches.length} spans for chapter ${chapterNumber}, expected exactly one`);
  }
  const span = matches[0];
  if (
    !Number.isInteger(span.startOffset) || !Number.isInteger(span.endOffset)
    || span.startOffset < 0 || span.endOffset > textLength || span.endOffset <= span.startOffset
  ) {
    return failed(
      `${CANDIDATE_CHAPTER_MAP_LOGICAL_PATH} chapter ${chapterNumber} span [${String(span.startOffset)}, ${String(span.endOffset)}) does not lie inside the ${textLength}-character source text`,
    );
  }
  return { ok: true, value: span };
}

export type ResolvedCandidateSource = {
  readonly context: ChapterSourceContext;
  /** Present only on the `source-text` branch - provenance for the round. */
  readonly span: ResolvedChapterSpan | null;
  readonly sourceTextSha256: string | null;
};

/**
 * Resolve one chapter's source context from a candidate's files.
 *
 * `sidecar` is the chapter's parsed source-v2 sidecar; it decides the
 * model-memory context and is the thing that can DECLARE a grounding the
 * candidate must then be able to honour.
 */
export function resolveCandidateChapterSource(args: Readonly<{
  files: readonly CandidateFileLike[];
  chapterNumber: number;
  sidecar: unknown;
}>): Result<ResolvedCandidateSource> {
  const sourceText = fileText(args.files, CANDIDATE_SOURCE_TEXT_LOGICAL_PATH);
  if (sourceText === null) {
    if (sidecarDeclaresSourceText(args.sidecar)) {
      return failed(
        `ch${String(args.chapterNumber).padStart(2, "0")} sidecar declares sourceProvenance "source-text" but the candidate carries no ${CANDIDATE_SOURCE_TEXT_LOGICAL_PATH}`,
      );
    }
    return {
      ok: true,
      value: {
        context: { provenance: "model-memory", recalledClaims: recalledClaimsFromSidecar(args.sidecar) },
        span: null,
        sourceTextSha256: null,
      },
    };
  }
  const mapRaw = fileText(args.files, CANDIDATE_CHAPTER_MAP_LOGICAL_PATH);
  if (mapRaw === null) {
    return failed(`the candidate carries ${CANDIDATE_SOURCE_TEXT_LOGICAL_PATH} but no ${CANDIDATE_CHAPTER_MAP_LOGICAL_PATH}`);
  }
  const map = parseChapterMap(mapRaw, sourceText);
  if (!map.ok) return map;
  const span = spanFor(map.value, args.chapterNumber, sourceText.length);
  if (!span.ok) return span;
  return {
    ok: true,
    value: {
      context: { provenance: "source-text", spanText: sourceText.slice(span.value.startOffset, span.value.endOffset) },
      span: span.value,
      sourceTextSha256: map.value.sourceTextSha256,
    },
  };
}
