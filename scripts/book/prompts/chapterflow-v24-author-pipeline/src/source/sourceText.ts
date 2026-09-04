/**
 * Source-text ingestion (R-046) — the bytes of the actual book.
 *
 * Until this module existed, "the source" the pipeline grounded on was its own
 * model output: `researcher-chapter` wrote a sidecar from training memory and
 * every later gate that said "grounded in source" meant "consistent with a
 * recalled paraphrase" (src/agents/researcher-chapter.ts header; the released
 * Franklin errors were already in the sidecars). This module reads a real UTF-8
 * text, normalizes it, and hashes it, so that:
 *
 *   - the digest can join the run definition (a different text is a different
 *     run, and a resume with a different text refuses);
 *   - the text can be FROZEN into the research run inputs, so every later stage
 *     reads the frozen copy and never the operator's path;
 *   - a sidecar item can be required to carry a `sourceQuote` that is a verbatim
 *     substring of the frozen bytes.
 *
 * ABSENCE is a first-class state, not an error: a book with no text is researched
 * exactly as before and its provenance is recorded as `model-memory`.
 *
 * Everything here is pure except {@link ingestSourceText}, which reads one file.
 */

import { createHash } from "crypto";
import { existsSync, readFileSync, statSync } from "fs";
import { isAbsolute, resolve } from "path";

/**
 * How a sidecar's claims were obtained.
 *   - `source-text`  : the researcher was given the book's own bytes and every
 *                      admitted item carries a quote from them.
 *   - `model-memory` : no text was supplied; the claims are the model's recall.
 *                      This is NOT a failure state — it is the honest label for
 *                      every book researched before ingestion existed, and it is
 *                      carried to the candidate so the release sidecar can print it.
 */
export const SOURCE_TEXT_PROVENANCES = ["source-text", "model-memory"] as const;
export type SourceTextProvenance = (typeof SOURCE_TEXT_PROVENANCES)[number];

export type IngestedSourceText = {
  /** Absolute path the bytes were read from. Recorded for provenance only — no
   *  later stage reads it; they read the frozen copy inside the research run. */
  readonly path: string;
  /** The normalized text. This is exactly what is frozen and what is hashed. */
  readonly text: string;
  /** sha256 of the normalized text's UTF-8 bytes. */
  readonly sha256: string;
  /** UTF-8 byte length of the normalized text. */
  readonly byteLength: number;
};

/**
 * Shortest quote that counts as evidence, measured after normalization.
 *
 * A three-word quote ("Franklin", "the rolls") matches almost any page of the
 * book and therefore proves nothing about the PROPOSITION the item asserts —
 * and short tokens already have their own channel (`hardSpecifics`). Twenty
 * characters is about four ordinary words: long enough that a match is a
 * sentence fragment carrying a relation, short enough that a date-and-name
 * clause ("in 1736 the Union Fire Company") still qualifies.
 */
export const MIN_SOURCE_QUOTE_CHARS = 20;

/**
 * Longest quote accepted, measured after normalization. The package contract is
 * 240 characters: about three lines of prose. Longer than that and the "quote"
 * stops being evidence for one claim and becomes a copy of the source that the
 * writers would be tempted to reproduce verbatim.
 */
export const MAX_SOURCE_QUOTE_CHARS = 240;

/** Characters that are dropped outright (zero-width and BOM). */
const DROPPED_CODEPOINTS = new Set(["﻿", "​", "‌", "‍", "⁠"]);

/**
 * Per-character folds applied to BOTH the span and the quote before matching.
 * All of them are typographic variants a model routinely re-types differently
 * from the file. CASE IS NOT FOLDED on purpose: a quote whose case differs from
 * the source was retyped rather than copied, which is exactly the failure this
 * check exists to catch.
 */
const CHARACTER_FOLDS: ReadonlyMap<string, string> = new Map<string, string>([
  ["‘", "'"], ["’", "'"], ["‚", "'"], ["‛", "'"], ["ʼ", "'"],
  ["“", '"'], ["”", '"'], ["„", '"'], ["‟", '"'],
  ["‐", "-"], ["‑", "-"], ["‒", "-"], ["–", "-"], ["—", "-"], ["―", "-"], ["−", "-"],
  ["…", "..."],
]);

/**
 * Project Gutenberg's italic markup: a run of emphasised text wrapped in a pair
 * of underscores, which may span a line break inside a paragraph.
 *
 * WHY THIS IS A SOURCE-TEXT DEFECT AND NOT TYPOGRAPHY TO PRESERVE. The markers
 * sit ADJACENT to the words they wrap, so they fuse to the first and last token
 * of the run. The Autobiography's lines 736-737 read:
 *
 *   House (a very odd one), that "_James Franklin should no longer print
 *   the paper called the New England Courant_."
 *
 * A researcher that copies that sentence correctly writes "James Franklin
 * should no longer print\nthe paper called the New England Courant." and is
 * told its quotation is not verbatim (live Franklin run 2026-09-04T19:51:59Z,
 * rejected/ch02.attempt2.json). The only quotation that WOULD match is one that
 * reproduces a typesetting artifact as if it were the author's own punctuation.
 * The same run lost a named example on _Spectator_.
 *
 * SHAPE OF THE RULE, and what it deliberately will not touch:
 *   - the opening marker must not follow a letter, digit or underscore, and the
 *     closing marker must not precede one — so snake_case, handle_click and
 *     set_state keep their underscores;
 *   - neither marker may sit against whitespace on the inside of the run, which
 *     is how a lone underscore in ordinary prose fails to open one;
 *   - the run may not contain another underscore and may not cross a blank line,
 *     so an unpaired marker cannot swallow a paragraph.
 */
const GUTENBERG_EMPHASIS_RUN = /(?<![\p{L}\p{N}_])_(?![\s_])((?:[^_\n]|\n(?!\s*\n))*?)(?<=[^\s])_(?![\p{L}\p{N}_])/gu;

/** Drop Gutenberg emphasis markers, keeping the words they wrap. */
export function stripGutenbergEmphasis(text: string): string {
  return text.replace(GUTENBERG_EMPHASIS_RUN, "$1");
}

/**
 * Normalize an ingested text for FREEZING: strip a leading BOM, convert CRLF and
 * lone CR to LF, and fold away Gutenberg's underscore emphasis markers
 * ({@link stripGutenbergEmphasis}). Nothing else — character offsets into this
 * string are the coordinates the chapter map and every recorded quote use, so
 * trimming or re-wrapping here would silently move every offset.
 *
 * WHY THE MARKERS ARE DROPPED HERE and not in the quote matcher. Every offset in
 * the system indexes the FROZEN text: chapter-map spans, the
 * `source-text:<sha>#<start>-<end>` citations in the verify record, the span
 * slice the source-fidelity judge and the key judge read, the excerpt windows
 * handed to the writers. Folding the markers inside
 * {@link normalizeForQuoteMatch} instead would leave every one of those readers
 * looking at `_Spectator_`, and would let a quote resolve to offsets whose slice
 * is not the quote. One text, one digest, one coordinate system.
 *
 * CONSEQUENCE, stated rather than hidden: for any text that carries emphasis
 * markers the sha256 CHANGES. A book whose research run was frozen against the
 * old digest cannot be resumed against the new one — by design, a different text
 * is a different run — so such a book is researched again from scratch.
 */
export function normalizeIngestedText(raw: string): string {
  return stripGutenbergEmphasis(raw.replace(/^﻿/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n"));
}

export type IndexedNormalization = {
  /** The match-normalized text. */
  readonly text: string;
  /** `map[i]` is the index in the ORIGINAL string of the character that produced
   *  normalized character `i`. Several normalized characters can share one
   *  original index (an ellipsis expands to three dots). */
  readonly map: readonly number[];
};

/**
 * Whitespace- and typography-normalize a string while keeping a per-character
 * index back into the original, so a match in normalized space can be reported
 * as RAW offsets into the frozen text.
 */
export function normalizeForQuoteMatch(raw: string): IndexedNormalization {
  const out: string[] = [];
  const map: number[] = [];
  let lastWasSpace = false;
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    if (DROPPED_CODEPOINTS.has(ch)) continue;
    if (/\s/.test(ch)) {
      if (lastWasSpace || out.length === 0) continue;
      out.push(" ");
      map.push(i);
      lastWasSpace = true;
      continue;
    }
    lastWasSpace = false;
    const folded = CHARACTER_FOLDS.get(ch) ?? ch;
    for (const emitted of folded) {
      out.push(emitted);
      map.push(i);
    }
  }
  // A trailing collapsed space is not part of the content.
  while (out.length > 0 && out[out.length - 1] === " ") {
    out.pop();
    map.pop();
  }
  return { text: out.join(""), map };
}

/** The match-normalized form of a quote (no index map needed). */
export function normalizedQuote(quote: string): string {
  return normalizeForQuoteMatch(quote).text;
}

/** Why a candidate quote cannot be accepted, or null when its SHAPE is fine. */
export function quoteShapeProblem(quote: string): string | null {
  if (typeof quote !== "string") return "sourceQuote must be a string";
  const normalized = normalizedQuote(quote);
  if (normalized.length < MIN_SOURCE_QUOTE_CHARS) {
    return `sourceQuote is ${normalized.length} characters; quote at least ${MIN_SOURCE_QUOTE_CHARS} characters of the source so the quote carries the claim, not just a token`;
  }
  if (normalized.length > MAX_SOURCE_QUOTE_CHARS) {
    return `sourceQuote is ${normalized.length} characters; quote at most ${MAX_SOURCE_QUOTE_CHARS} characters — one sentence or two, not a passage`;
  }
  return null;
}

export type QuoteOffsets = { readonly start: number; readonly end: number };

/** Every raw-offset occurrence of `quote` inside `span`, in order. Returns [] when
 *  the quote's shape is invalid (too short / too long) — an unusable quote is not
 *  "found" even if its characters happen to be present. */
export function findAllQuoteOffsets(span: string, quote: string): QuoteOffsets[] {
  if (quoteShapeProblem(quote) !== null) return [];
  const haystack = normalizeForQuoteMatch(span);
  const needle = normalizedQuote(quote);
  const hits: QuoteOffsets[] = [];
  let from = 0;
  for (;;) {
    const at = haystack.text.indexOf(needle, from);
    if (at < 0) break;
    hits.push({ start: haystack.map[at], end: haystack.map[at + needle.length - 1] + 1 });
    from = at + 1;
  }
  return hits;
}

/** The FIRST raw-offset occurrence of `quote` inside `span`, or null. */
export function findQuoteOffsets(span: string, quote: string): QuoteOffsets | null {
  return findAllQuoteOffsets(span, quote)[0] ?? null;
}

/** True when `quote` is a verbatim (whitespace/typography-normalized) substring
 *  of `span` and has an acceptable length. */
export function quoteIsGrounded(span: string, quote: string): boolean {
  return findQuoteOffsets(span, quote) !== null;
}

/** Read, normalize, and hash a source text. Fails closed and loudly: a book run
 *  that was told to use a text must never quietly fall back to model memory. */
export function ingestSourceText(path: string): IngestedSourceText {
  if (typeof path !== "string" || path.trim().length === 0 || !isAbsolute(path)) {
    throw new Error(`SOURCE_TEXT_INVALID:source text path must be absolute, got ${JSON.stringify(path)}`);
  }
  const resolved = resolve(path);
  if (!existsSync(resolved) || !statSync(resolved).isFile()) {
    throw new Error(`SOURCE_TEXT_NOT_FOUND:${resolved}`);
  }
  const text = normalizeIngestedText(readFileSync(resolved, "utf8"));
  if (text.trim().length === 0) throw new Error(`SOURCE_TEXT_EMPTY:${resolved} contains no text`);
  return Object.freeze({
    path: resolved,
    text,
    sha256: createHash("sha256").update(text, "utf8").digest("hex"),
    byteLength: Buffer.byteLength(text, "utf8"),
  });
}

const BOOK_ID_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Discovery fallback for `book-run` when `--source-text` is absent:
 * `<pipelineDir>/sources/<bookId>.txt`. The bookId must be a plain slug, so the
 * lookup can never address a file outside `sources/`.
 */
export function discoverSourceTextPath(pipelineDir: string, bookId: string): string | null {
  if (typeof bookId !== "string" || !BOOK_ID_SLUG.test(bookId)) return null;
  const candidate = resolve(pipelineDir, "sources", `${bookId}.txt`);
  return existsSync(candidate) && statSync(candidate).isFile() ? candidate : null;
}
