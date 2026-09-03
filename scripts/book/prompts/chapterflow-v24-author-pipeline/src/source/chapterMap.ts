/**
 * Chapter map (R-046, R-058) — WHERE each chapter is inside the frozen text.
 *
 * The bibliography researcher already returns a chapter list. With the book's
 * bytes present it must also return, per chapter, a SPAN of that text. The span
 * is what the chapter researcher reads and what every `sourceQuote` is checked
 * against, so a wrong map is as bad as no text at all — and this module is where
 * a wrong map is caught.
 *
 * TWO CONTRACTS, ONE PER VIEW OF THE BOOK. Which one applies is derived from the
 * text itself — {@link chapterMapMode} asks the same question buildBibliographyTextView
 * asks — so the contract the model was given and the contract this module enforces
 * cannot drift apart.
 *
 * "anchors" (a book passed WHOLE). The model returns a unique start string and a
 * unique end string and this module resolves them to raw offsets. A language model
 * cannot count characters, so asking IT for an offset would produce confident
 * nonsense no validator could distinguish from a real answer, whereas an anchor is
 * checkable by construction: it either occurs exactly once in the text or it does
 * not.
 *
 * "headingOffsets" (a book too long to pass whole). The same demand is
 * unsatisfiable here — the model never sees a chapter's last sentence, and every
 * title it does see is printed twice (contents page and chapter head), so a
 * title-shaped anchor is ambiguous by construction. Instead the outline view PRINTS
 * a list of offsets and the model PICKS from it; this module accepts nothing that
 * is not on that list. That is not the model counting characters, it is the model
 * copying a number this code computed — the same safety property anchors have, got
 * a different way. Everything after the offsets are in hand (order, overlap, gap,
 * coverage) is shared by both modes.
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
 * licence again; on the Gutenberg Autobiography that is 5.2% at the front and
 * 12.3% at the back. Requiring the map to cover byte 0 would force the model to
 * assign the licence to chapter 1.
 */

import { bibliographyOffsetChoices, MAX_BIBLIOGRAPHY_TEXT_CHARS, OUTLINE_OFFSET_LIST_HEADER } from "./sourceOutline.js";
import { findAllQuoteOffsets, quoteShapeProblem, MIN_SOURCE_QUOTE_CHARS, MAX_SOURCE_QUOTE_CHARS } from "./sourceText.js";

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
 * chapter I begins at offset 23,913 (5.2% front matter), the appendix at 402,184
 * and the licence footer at 440,283. So a map that runs from chapter I to the
 * licence covers 90.8% (416,370 characters) and a map of the nineteen chapters
 * alone covers 82.5% (378,271). Half the file is therefore a generous floor that
 * still catches the real failure — a map that describes the front matter, or one
 * chapter, instead of the book.
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

/** The outline-mode entry: two offsets copied from the view's printed list. */
export type ChapterSpanOffsets = {
  readonly chapterNumber: number;
  readonly startOffset: number;
  readonly endOffset: number;
};

export type ChapterMapMode = "anchors" | "headingOffsets";

/**
 * Which chapter-map contract this text is under.
 *
 * Derived from the SAME bound buildBibliographyTextView uses to decide whether to
 * pass the book whole, and from the same text, so the prompt's contract and this
 * validator's contract are always the same one.
 */
export function chapterMapMode(text: string): ChapterMapMode {
  return text.length <= MAX_BIBLIOGRAPHY_TEXT_CHARS ? "anchors" : "headingOffsets";
}

/**
 * The chapter-map contract, STATED WHERE IT IS ENFORCED.
 *
 * The bibliography prompt renders exactly these lines
 * (src/agents/researcher-bibliography.ts#buildUserPrompt) and this module then
 * validates exactly what they ask for, both keyed off {@link chapterMapMode} and
 * the same text. Round 1 kept the two apart, and they drifted: the prompt asked
 * every book for unique 30-240-character anchors while the outline view showed a
 * long book neither its chapter ends nor a unique title, so the demand was
 * unsatisfiable and the map failed closed forever. One function now says it once.
 */
export function chapterMapContractLines(text: string): string[] {
  if (chapterMapMode(text) === "headingOffsets") {
    return [
      "Add a `chapterMap` array with one entry per chapter of your chapter list:",
      "```ts",
      "chapterMap: Array<{ chapterNumber: number; startOffset: number; endOffset: number }>",
      "```",
      `- \`startOffset\` and \`endOffset\` are COPIED from the \`@<number>:\` list printed under ${OUTLINE_OFFSET_LIST_HEADER} above. Any other value is rejected — never compute, estimate or adjust an offset.`,
      "- A chapter's `startOffset` is the listed offset where that chapter begins. Its `endOffset` is the listed offset where it stops, which is normally the next chapter's start, and `[END OF TEXT]` for the last chapter.",
      "- The spans must run in chapter order, must not overlap, and must leave no large run of the body unassigned. Front matter, a contents page, an editor's introduction and appendices may be left outside every span.",
      "- You were shown an OUTLINE of this book, not all of it. Pick the offsets from the list; do not quote anchors — this book's chapterMap takes offsets only.",
    ];
  }
  return [
    "Add a `chapterMap` array with one entry per chapter of your chapter list:",
    "```ts",
    "chapterMap: Array<{ chapterNumber: number; startAnchor: string; endAnchor: string }>",
    "```",
    `- \`startAnchor\` is ${MIN_SOURCE_QUOTE_CHARS}-${MAX_SOURCE_QUOTE_CHARS} characters copied EXACTLY from where that chapter begins; \`endAnchor\` is ${MIN_SOURCE_QUOTE_CHARS}-${MAX_SOURCE_QUOTE_CHARS} characters copied exactly from where it ends.`,
    '- Each anchor must occur EXACTLY ONCE in the whole text. A chapter heading like "II" or "Chapter 3" is not unique — use the chapter\'s own first and last sentences instead.',
    "- The spans must run in chapter order, must not overlap, and must leave no large run of the body unassigned. Front matter, a contents page, an introduction by an editor, and appendices may be left outside every span.",
    "- Anchors are checked character by character against the text. A remembered or reconstructed anchor will be rejected.",
  ];
}

/** What a MISSING chapterMap is told, in the words of the mode it is under. */
export function chapterMapMissingProblem(text: string): string {
  return chapterMapMode(text) === "headingOffsets"
    ? `chapterMap is missing — this run has the book's text, so every chapter needs a startOffset and an endOffset copied from the ${OUTLINE_OFFSET_LIST_HEADER} list`
    : "chapterMap is missing — this run has the book's text, so every chapter needs a startAnchor and an endAnchor copied verbatim from it";
}

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
 * Resolve ONE outline-mode entry's offsets, which must be values the outline view
 * actually printed. Returns the problem naming the nearest legal values, so the
 * retry hands the model something it can act on rather than "invalid".
 */
function offsetProblem(
  chapterNumber: number,
  which: "startOffset" | "endOffset",
  value: unknown,
  allowed: ReadonlySet<number>,
): { problem: string } | { offset: number } {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return { problem: `chapter ${chapterNumber} ${which} is missing or is not an integer — copy one of the @<number> values from the ${OUTLINE_OFFSET_LIST_HEADER} list exactly as it is printed` };
  }
  if (!allowed.has(value)) {
    const sorted = [...allowed].sort((a, b) => a - b);
    const below = [...sorted].reverse().find((candidate) => candidate < value);
    const above = sorted.find((candidate) => candidate > value);
    const near = [below, above].filter((candidate): candidate is number => candidate !== undefined).join(" or ");
    return { problem: `chapter ${chapterNumber} ${which} ${value} is not one of the listed offsets — use a value printed under ${OUTLINE_OFFSET_LIST_HEADER}${near ? ` (the nearest listed are ${near})` : ""}; offsets are copied, never computed` };
  }
  return { offset: value };
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
    return {
      map: null,
      problems: [
        chapterMapMode(text) === "headingOffsets"
          ? "chapterMap must be an array of one span per chapter, each with chapterNumber, startOffset and endOffset"
          : "chapterMap must be an array of one span per chapter, each with chapterNumber, startAnchor and endAnchor",
      ],
    };
  }

  const mode = chapterMapMode(text);
  const allowedOffsets = mode === "headingOffsets"
    ? new Set(bibliographyOffsetChoices(text).map((choice) => choice.offset))
    : new Set<number>();
  const expected = new Map(args.chapters.map((chapter) => [chapter.number, chapter.title]));
  const seen = new Set<number>();
  const resolved: ResolvedChapterSpan[] = [];

  for (const raw of args.spans as unknown[]) {
    const entry = raw as Partial<ChapterSpanAnchors & ChapterSpanOffsets>;
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

    let startOffset: number;
    let endOffset: number;
    if (mode === "headingOffsets") {
      const start = offsetProblem(chapterNumber, "startOffset", entry.startOffset, allowedOffsets);
      const end = offsetProblem(chapterNumber, "endOffset", entry.endOffset, allowedOffsets);
      if ("problem" in start) problems.push(start.problem);
      if ("problem" in end) problems.push(end.problem);
      if ("problem" in start || "problem" in end) continue;
      startOffset = start.offset;
      endOffset = end.offset;
      if (endOffset <= startOffset) {
        problems.push(`chapter ${chapterNumber} endOffset ${endOffset} is at or before its startOffset ${startOffset} — a chapter's end must be later in the text than its start`);
        continue;
      }
    } else {
      const start = anchorProblem(chapterNumber, "startAnchor", entry.startAnchor, text);
      const end = anchorProblem(chapterNumber, "endAnchor", entry.endAnchor, text);
      if ("problem" in start) problems.push(start.problem);
      if ("problem" in end) problems.push(end.problem);
      if ("problem" in start || "problem" in end) continue;
      startOffset = start.offsets.start;
      endOffset = end.offsets.end;
      if (endOffset <= startOffset) {
        problems.push(`chapter ${chapterNumber} endAnchor resolves at ${endOffset}, at or before its startAnchor at ${startOffset} — the end anchor must come AFTER the start anchor in the text`);
        continue;
      }
    }
    resolved.push({
      chapterNumber,
      chapterTitle: expected.get(chapterNumber)!,
      startOffset,
      endOffset,
      // An outline-mode span has no anchors: it names two offsets the outline view
      // printed. The resolved map records the text AT those offsets so a later
      // reader can see what was picked without re-deriving the list.
      startAnchor: mode === "headingOffsets" ? offsetLabel(text, startOffset) : (entry.startAnchor as string),
      endAnchor: mode === "headingOffsets" ? offsetLabel(text, endOffset) : (entry.endAnchor as string),
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

/** The first line of text at `offset`, trimmed and capped — what an outline-mode
 *  span records in place of an anchor, so the stored map stays human-readable. */
function offsetLabel(text: string, offset: number): string {
  const line = text.slice(offset, offset + 120).split("\n")[0].trim();
  return line.length > 0 ? line : `@${offset}`;
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
