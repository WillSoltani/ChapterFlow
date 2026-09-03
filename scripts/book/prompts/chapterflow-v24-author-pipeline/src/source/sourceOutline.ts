/**
 * What the BIBLIOGRAPHY researcher sees of the book (R-046).
 *
 * The bibliography call runs once per book, so paying for a large input there is
 * cheap next to the N chapter calls it makes possible — a book under
 * {@link MAX_BIBLIOGRAPHY_TEXT_CHARS} is therefore passed WHOLE, and the model
 * reads the real table of contents instead of recalling one. (The released
 * Franklin run is the cautionary case: its bibliography returned four entries
 * titled "Part One".."Part Four" from memory, while the edition's own contents
 * page lists nineteen chapters.)
 *
 * A larger book gets an OUTLINE instead: the front matter verbatim — which is
 * where a printed table of contents lives — plus the OFFSET LIST below, plus
 * evenly spaced excerpts of the body so the model can see what the headings
 * actually contain.
 *
 * WHY AN OFFSET LIST (review round 2, finding 4). The first cut of this module
 * asked the outline-mode model for the same thing whole mode asks for: a start
 * and an end ANCHOR per chapter, each 30-240 characters, each occurring exactly
 * once in the WHOLE text. On a 458 KB book that is unsatisfiable by construction.
 * The model cannot see a chapter's last sentence (the excerpts land roughly every
 * 38,000 characters), and every chapter title it CAN see is printed twice — once
 * on the contents page, once at the chapter head — so a title-shaped anchor
 * resolves as ambiguous and is rejected. The map failed closed, which is safe,
 * but it meant no long book could produce a source-text run at all.
 *
 * So in outline mode the model does not INVENT a locator, it PICKS one: this
 * module prints an explicit, text-ordered list of offsets, and
 * `resolveChapterMap` accepts nothing else. An offset is safe here for the same
 * reason an anchor is safe in whole mode — the model is COPYING a number this
 * code computed, never counting characters of its own.
 */

export const MAX_BIBLIOGRAPHY_TEXT_CHARS = 120_000;

/** Front-matter prefix passed verbatim in outline mode — a printed contents page
 *  is essentially always inside the first few thousand characters. */
export const OUTLINE_FRONT_MATTER_CHARS = 12_000;

/** Cap on heading lines listed, so a file of short lines cannot flood the call. */
export const OUTLINE_MAX_HEADINGS = 400;

/** Evenly spaced body excerpts, and the size of each. */
export const OUTLINE_EXCERPT_WINDOWS = 12;
export const OUTLINE_EXCERPT_CHARS = 2_000;

/** The header the offset list is printed under. Exported so the prompt, the
 *  validator's error messages and the tests all name the same block. */
export const OUTLINE_OFFSET_LIST_HEADER =
  "[OFFSETS — the ONLY values a chapterMap startOffset or endOffset may take]";

const ROMAN = /^[IVXLCDM]{1,7}\.?$/;
const NUMBERED_HEADING = /^(?:chapter|part|book|section|letter)\b/i;

/** True for a line that LOOKS like a heading: short, alone between blank lines,
 *  and either a roman numeral, a numbered heading word, a bare number, or
 *  written in capitals. */
function looksLikeHeading(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length === 0 || trimmed.length > 80) return false;
  if (ROMAN.test(trimmed)) return true;
  if (NUMBERED_HEADING.test(trimmed)) return true;
  if (/^\d{1,3}[.)]?$/.test(trimmed)) return true;
  const letters = trimmed.replace(/[^\p{L}]/gu, "");
  return letters.length >= 3 && letters === letters.toUpperCase();
}

/** A heading that is STRUCTURAL — a numeral or a "Chapter/Part/Book/Section"
 *  line. These are the lines a chapter map is actually built from, so they
 *  survive the cap ahead of a merely capitalised line. */
function isStructuralHeading(line: string): boolean {
  const trimmed = line.trim();
  return ROMAN.test(trimmed) || NUMBERED_HEADING.test(trimmed) || /^\d{1,3}[.)]?$/.test(trimmed);
}

export type SourceOutlineHeading = { readonly offset: number; readonly line: string };

/**
 * Every heading-shaped line in `text`, with its character offset, capped at
 * {@link OUTLINE_MAX_HEADINGS}.
 *
 * THE CAP NEVER TRUNCATES THE TAIL (review round 2). It used to `break` out of
 * the scan on the 400th hit, so a book with more heading-shaped lines than the
 * cap published offsets for its opening pages only and every chapter past that
 * point was unmappable. The scan now runs to the end and the cap is applied by
 * DROPPING, in a fixed order: merely capitalised lines first (they are titles and
 * running heads, not chapter starts), then an even sample of what remains, with
 * the first and last always kept. Deterministic: the same text always yields the
 * same list.
 */
export function outlineHeadings(text: string): SourceOutlineHeading[] {
  const all: SourceOutlineHeading[] = [];
  let offset = 0;
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const before = i === 0 || lines[i - 1].trim().length === 0;
    const after = i === lines.length - 1 || lines[i + 1].trim().length === 0;
    if (before && after && looksLikeHeading(line)) all.push({ offset, line: line.trim() });
    offset += line.length + 1;
  }
  if (all.length <= OUTLINE_MAX_HEADINGS) return all;
  const structural = all.filter((heading) => isStructuralHeading(heading.line));
  const kept = structural.length > 0 ? structural : all;
  if (kept.length <= OUTLINE_MAX_HEADINGS) return kept;
  return evenSample(kept, OUTLINE_MAX_HEADINGS);
}

/** `count` entries spread evenly across `items`, first and last always kept. */
function evenSample<T>(items: readonly T[], count: number): T[] {
  if (items.length <= count) return [...items];
  const out: T[] = [];
  for (let i = 0; i < count; i += 1) {
    out.push(items[Math.round((i * (items.length - 1)) / (count - 1))]);
  }
  return out;
}

export type SourceOffsetChoice = { readonly offset: number; readonly label: string };

/**
 * The offsets an outline-mode chapter map may use, in text order.
 *
 * Three sources, deduplicated by offset with the heading label winning:
 *   - every heading-shaped line (the chapter starts a map is normally built of);
 *   - the start of every body excerpt printed below, so a book whose typography
 *     defeats the heading detector entirely can still be cut into coarse spans
 *     rather than producing no map at all;
 *   - the end of the text, so the last chapter always has an end to name.
 *
 * This is the ONE authority: the view prints exactly this list, and
 * resolveChapterMap accepts exactly these values, both derived from the same
 * frozen text — so what the model was shown and what the validator will take can
 * never drift apart.
 */
export function bibliographyOffsetChoices(text: string): SourceOffsetChoice[] {
  const byOffset = new Map<number, string>();
  const stride = Math.floor(text.length / OUTLINE_EXCERPT_WINDOWS);
  if (stride > 0) {
    for (let i = 0; i < OUTLINE_EXCERPT_WINDOWS; i += 1) {
      const from = i * stride;
      if (from >= text.length) break;
      byOffset.set(from, `[start of body excerpt ${i + 1}]`);
    }
  }
  for (const heading of outlineHeadings(text)) byOffset.set(heading.offset, heading.line);
  byOffset.set(text.length, "[END OF TEXT]");
  return [...byOffset.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([offset, label]) => ({ offset, label }));
}

export type BibliographyTextView = {
  readonly mode: "whole" | "outline";
  readonly text: string;
  readonly sourceTextLength: number;
};

/** The view of the book handed to the bibliography researcher. Deterministic. */
export function buildBibliographyTextView(text: string): BibliographyTextView {
  if (text.length <= MAX_BIBLIOGRAPHY_TEXT_CHARS) {
    return { mode: "whole", text, sourceTextLength: text.length };
  }
  const parts: string[] = [];
  parts.push(`[FRONT MATTER — characters 0 to ${OUTLINE_FRONT_MATTER_CHARS} of ${text.length}]`);
  parts.push(text.slice(0, OUTLINE_FRONT_MATTER_CHARS));
  parts.push("");
  parts.push(OUTLINE_OFFSET_LIST_HEADER);
  for (const choice of bibliographyOffsetChoices(text)) parts.push(`@${choice.offset}: ${choice.label}`);
  parts.push("");
  const stride = Math.floor(text.length / OUTLINE_EXCERPT_WINDOWS);
  for (let i = 0; i < OUTLINE_EXCERPT_WINDOWS; i += 1) {
    const from = i * stride;
    parts.push(`[BODY EXCERPT — characters ${from} to ${Math.min(from + OUTLINE_EXCERPT_CHARS, text.length)}]`);
    parts.push(text.slice(from, from + OUTLINE_EXCERPT_CHARS));
    parts.push("");
  }
  return { mode: "outline", text: parts.join("\n"), sourceTextLength: text.length };
}
