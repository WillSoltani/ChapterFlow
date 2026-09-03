/**
 * Chapter map (R-046, R-058) — WHERE each chapter is inside the frozen text.
 *
 * The bibliography researcher already returns a chapter list. With the book's
 * bytes present it must also return, per chapter, a SPAN of that text. The span
 * is what the chapter researcher reads and what every `sourceQuote` is checked
 * against, so a wrong map is as bad as no text at all — and this module is where
 * a wrong map is caught.
 *
 * ANCHORS, NOT OFFSETS. The model returns a unique start string and a unique end
 * string; this module resolves them to raw character offsets. A language model
 * cannot count characters in a 458 KB file, so asking for offsets would produce
 * confident nonsense that no validator could distinguish from a real answer,
 * whereas an anchor is checkable by construction: it either occurs exactly once
 * in the text or it does not.
 *
 * WHAT FAILS CLOSED (each with a message the retry loop hands back verbatim):
 *   - an anchor that is absent, ambiguous, or badly shaped;
 *   - a span whose end is not after its start;
 *   - a chapter list / span-set mismatch in either direction, or a duplicate;
 *   - spans out of chapter order, or overlapping;
 *   - an interior gap wider than {@link MAX_INTERIOR_GAP_CHARS};
 *   - total coverage below {@link MIN_SPAN_COVERAGE_FRACTION} of the text.
 *
 * WHAT IS DELIBERATELY ALLOWED: text before the first span and after the last.
 * A public-domain file opens with a licence header, a title page, an editor's
 * introduction and a table of contents, and closes with appendices and the
 * licence again; on the Gutenberg Autobiography that is ~5% at the front and
 * ~13% at the back. Requiring the map to cover byte 0 would force the model to
 * assign the licence to chapter 1.
 */

import { findAllQuoteOffsets, quoteShapeProblem } from "./sourceText.js";

export const CHAPTER_MAP_SCHEMA_VERSION = "chapterflow.chapterMap.v1" as const;

/**
 * Largest run of text allowed BETWEEN two consecutive chapter spans.
 *
 * 4,000 characters is roughly 650 words, or two printed pages — comfortably more
 * than any chapter heading, epigraph, illustration caption or editor's note that
 * legitimately falls between two chapters, and far less than a teachable episode.
 * The failure this bounds is the one R-058 measured: a quarter of a memoir mapped
 * to a span that quietly omits the Junto, the library and the fire company.
 */
export const MAX_INTERIOR_GAP_CHARS = 4000;

/**
 * Least fraction of the whole text the spans together must cover.
 *
 * Measured on the Gutenberg Autobiography (458,749 normalized characters):
 * chapter I begins at offset 23,913 (5.2% front matter) and the licence footer
 * begins at 440,283, so a map of the body covers ~91%; a map that stops at the
 * end of the last chapter and leaves the appendix out covers ~77%. Half the file
 * is therefore a generous floor that still catches the real failure — a map that
 * describes the front matter, or one chapter, instead of the book.
 */
export const MIN_SPAN_COVERAGE_FRACTION = 0.5;

/**
 * Most source characters handed to ONE chapter-research call.
 *
 * 60,000 characters is about 15,000 tokens: it leaves room for the system
 * prompt, the schema, the retry echo and the model's own output inside every
 * caller profile, and it is larger than a normal trade-nonfiction chapter, so
 * ordinary books are passed whole and nothing is lost. Only an oversized unit —
 * a "Part" standing in for a quarter of a book — is excerpted.
 */
export const MAX_SPAN_PROMPT_CHARS = 60_000;

/**
 * Windows an over-long span is cut into. Eight windows of ~7,500 characters each
 * keeps every window long enough to contain whole episodes rather than
 * fragments, while spreading the sample across the entire span instead of
 * truncating at the head (which would make the second half of a Part invisible).
 */
export const SPAN_EXCERPT_WINDOWS = 8;

export type ChapterSpanAnchors = {
  readonly chapterNumber: number;
  readonly startAnchor: string;
  readonly endAnchor: string;
};

export type ResolvedChapterSpan = {
  readonly chapterNumber: number;
  readonly chapterTitle: string;
  /** Inclusive character offset into the FROZEN, normalized source text. */
  readonly startOffset: number;
  /** Exclusive character offset into the frozen, normalized source text. */
  readonly endOffset: number;
  readonly startAnchor: string;
  readonly endAnchor: string;
};

export type ChapterMapV1 = {
  readonly schemaVersion: typeof CHAPTER_MAP_SCHEMA_VERSION;
  readonly bookId: string;
  readonly sourceTextSha256: string;
  readonly sourceTextLength: number;
  /** Fraction of the text assigned to some chapter, rounded to 4 places. */
  readonly coverageFraction: number;
  readonly spans: readonly ResolvedChapterSpan[];
};

function anchorProblem(
  chapterNumber: number,
  which: "startAnchor" | "endAnchor",
  anchor: unknown,
  text: string,
): { problem: string } | { offsets: { start: number; end: number } } {
  if (typeof anchor !== "string" || anchor.trim().length === 0) {
    return { problem: `chapter ${chapterNumber} ${which} is missing — give a verbatim run of text copied from the source that occurs exactly once` };
  }
  const shape = quoteShapeProblem(anchor);
  if (shape !== null) {
    return { problem: `chapter ${chapterNumber} ${which} is unusable: ${shape}` };
  }
  const hits = findAllQuoteOffsets(text, anchor);
  if (hits.length === 0) {
    return { problem: `chapter ${chapterNumber} ${which} ${JSON.stringify(anchor.slice(0, 80))} was not found in the source text — copy the anchor verbatim from the text you were given` };
  }
  if (hits.length > 1) {
    return { problem: `chapter ${chapterNumber} ${which} ${JSON.stringify(anchor.slice(0, 80))} occurs ${hits.length} times — extend it until it is unique in the source text` };
  }
  return { offsets: hits[0] };
}

/**
 * Resolve and validate a model-supplied chapter map against the frozen text and
 * the bibliography's own chapter list.
 *
 * Returns `{ map: null, problems: [...] }` on ANY problem — the map is all-or-
 * nothing, because a partially valid map would hand some chapter researcher a
 * span belonging to another chapter, which is worse than no text at all.
 */
export function resolveChapterMap(args: {
  bookId: string;
  sourceText: string;
  sourceTextSha256: string;
  chapters: ReadonlyArray<{ number: number; title: string }>;
  spans: unknown;
}): { map: ChapterMapV1 | null; problems: string[] } {
  const problems: string[] = [];
  const text = args.sourceText;
  if (!Array.isArray(args.spans)) {
    return { map: null, problems: ["chapterMap must be an array of one span per chapter, each with chapterNumber, startAnchor and endAnchor"] };
  }

  const expected = new Map(args.chapters.map((chapter) => [chapter.number, chapter.title]));
  const seen = new Set<number>();
  const resolved: ResolvedChapterSpan[] = [];

  for (const raw of args.spans as unknown[]) {
    const entry = raw as Partial<ChapterSpanAnchors>;
    const chapterNumber = entry?.chapterNumber;
    if (typeof chapterNumber !== "number" || !Number.isInteger(chapterNumber)) {
      problems.push(`chapterMap entry has no integer chapterNumber: ${JSON.stringify(raw).slice(0, 120)}`);
      continue;
    }
    if (!expected.has(chapterNumber)) {
      problems.push(`chapterMap chapter ${chapterNumber} is not in the bibliography's chapter list — map exactly the chapters you listed`);
      continue;
    }
    if (seen.has(chapterNumber)) {
      problems.push(`chapterMap has more than one span for chapter ${chapterNumber} — give exactly one span per chapter`);
      continue;
    }
    seen.add(chapterNumber);

    const start = anchorProblem(chapterNumber, "startAnchor", entry.startAnchor, text);
    const end = anchorProblem(chapterNumber, "endAnchor", entry.endAnchor, text);
    if ("problem" in start) problems.push(start.problem);
    if ("problem" in end) problems.push(end.problem);
    if ("problem" in start || "problem" in end) continue;

    const startOffset = start.offsets.start;
    const endOffset = end.offsets.end;
    if (endOffset <= startOffset) {
      problems.push(`chapter ${chapterNumber} endAnchor resolves at ${endOffset}, at or before its startAnchor at ${startOffset} — the end anchor must come AFTER the start anchor in the text`);
      continue;
    }
    resolved.push({
      chapterNumber,
      chapterTitle: expected.get(chapterNumber)!,
      startOffset,
      endOffset,
      startAnchor: entry.startAnchor as string,
      endAnchor: entry.endAnchor as string,
    });
  }

  for (const chapter of args.chapters) {
    if (!seen.has(chapter.number)) {
      problems.push(`chapterMap has no span for chapter ${chapter.number} (${chapter.title}) — every chapter in the bibliography needs one`);
    }
  }

  if (problems.length > 0) return { map: null, problems };

  resolved.sort((a, b) => a.chapterNumber - b.chapterNumber);
  for (let i = 1; i < resolved.length; i += 1) {
    const prev = resolved[i - 1];
    const next = resolved[i];
    if (next.startOffset < prev.startOffset) {
      problems.push(`chapter ${next.chapterNumber} starts at ${next.startOffset}, before chapter ${prev.chapterNumber} at ${prev.startOffset} — spans must run in chapter order through the text`);
      continue;
    }
    if (next.startOffset < prev.endOffset) {
      problems.push(`chapter ${prev.chapterNumber} (ends at ${prev.endOffset}) and chapter ${next.chapterNumber} (starts at ${next.startOffset}) overlap — each character of the book belongs to at most one chapter`);
      continue;
    }
    const gap = next.startOffset - prev.endOffset;
    if (gap > MAX_INTERIOR_GAP_CHARS) {
      problems.push(`${gap} characters between chapter ${prev.chapterNumber} and chapter ${next.chapterNumber} are unassigned (limit ${MAX_INTERIOR_GAP_CHARS}) — extend one of the two spans so no teachable material is left out of the book`);
    }
  }

  const covered = resolved.reduce((sum, span) => sum + (span.endOffset - span.startOffset), 0);
  const coverageFraction = text.length === 0 ? 0 : covered / text.length;
  if (coverageFraction < MIN_SPAN_COVERAGE_FRACTION) {
    problems.push(`the chapter map covers ${(coverageFraction * 100).toFixed(1)}% of the source text (${covered} of ${text.length} characters); at least ${(MIN_SPAN_COVERAGE_FRACTION * 100).toFixed(0)}% must be assigned to a chapter. Front matter and appendices may be left out; the body of the book may not.`);
  }

  if (problems.length > 0) return { map: null, problems };

  return {
    map: {
      schemaVersion: CHAPTER_MAP_SCHEMA_VERSION,
      bookId: args.bookId,
      sourceTextSha256: args.sourceTextSha256,
      sourceTextLength: text.length,
      coverageFraction: Number(coverageFraction.toFixed(4)),
      spans: resolved,
    },
    problems: [],
  };
}

/** The exact characters of one chapter's span. This is the VALIDATION AUTHORITY
 *  for every `sourceQuote`, whether or not the whole span reached the prompt. */
export function chapterSpanText(sourceText: string, span: Pick<ResolvedChapterSpan, "startOffset" | "endOffset">): string {
  return sourceText.slice(span.startOffset, span.endOffset);
}

export type SpanExcerpt = {
  /** What the prompt carries. */
  readonly text: string;
  /** True when the span exceeded the prompt bound and was sampled. */
  readonly excerpted: boolean;
  /** Characters omitted from the prompt (0 when the span was passed whole). */
  readonly omittedChars: number;
};

/**
 * Bound a span for a prompt. A span at or under {@link MAX_SPAN_PROMPT_CHARS} is
 * passed WHOLE and byte-identically. A longer span is cut into
 * {@link SPAN_EXCERPT_WINDOWS} evenly spaced windows, each snapped forward to a
 * paragraph break so a window starts mid-thought as rarely as possible, joined by
 * an explicit elision marker.
 *
 * Deterministic: the same span always produces the same prompt, so a resumed run
 * re-issues the identical call. The excerpt bounds only what the model SEES; the
 * full span remains the authority a quote is validated against, so a quote from
 * an elided passage still verifies (and is still true).
 */
export function spanExcerptForPrompt(span: string): SpanExcerpt {
  if (span.length <= MAX_SPAN_PROMPT_CHARS) {
    return { text: span, excerpted: false, omittedChars: 0 };
  }
  const windowChars = Math.floor(MAX_SPAN_PROMPT_CHARS / SPAN_EXCERPT_WINDOWS);
  const stride = Math.floor(span.length / SPAN_EXCERPT_WINDOWS);
  const parts: string[] = [];
  let taken = 0;
  let previousEnd = 0;
  for (let i = 0; i < SPAN_EXCERPT_WINDOWS; i += 1) {
    let from = i * stride;
    if (i > 0) {
      const paragraph = span.indexOf("\n\n", from);
      if (paragraph >= 0 && paragraph - from < windowChars / 2) from = paragraph + 2;
      const omitted = from - previousEnd;
      if (omitted > 0) parts.push(`\n\n[... omitted ${omitted} characters of this chapter ...]\n\n`);
    }
    const to = Math.min(from + windowChars, span.length);
    parts.push(span.slice(from, to));
    taken += to - from;
    previousEnd = to;
  }
  if (previousEnd < span.length) {
    parts.push(`\n\n[... omitted ${span.length - previousEnd} characters of this chapter ...]\n\n`);
  }
  return { text: parts.join(""), excerpted: true, omittedChars: span.length - taken };
}
