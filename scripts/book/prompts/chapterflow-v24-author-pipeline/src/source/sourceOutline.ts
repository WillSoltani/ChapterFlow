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
 * where a printed table of contents lives — plus every heading-shaped line in the
 * body with its character offset, plus evenly spaced excerpts of the body so the
 * model can see what the headings actually contain. That is enough to produce a
 * chapter list AND the unique anchors the chapter map needs.
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

export type SourceOutlineHeading = { readonly offset: number; readonly line: string };

/** Every heading-shaped line in `text`, with its character offset. */
export function outlineHeadings(text: string): SourceOutlineHeading[] {
  const headings: SourceOutlineHeading[] = [];
  let offset = 0;
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const before = i === 0 || lines[i - 1].trim().length === 0;
    const after = i === lines.length - 1 || lines[i + 1].trim().length === 0;
    if (before && after && looksLikeHeading(line)) {
      headings.push({ offset, line: line.trim() });
      if (headings.length >= OUTLINE_MAX_HEADINGS) break;
    }
    offset += line.length + 1;
  }
  return headings;
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
  const headings = outlineHeadings(text);
  parts.push("");
  parts.push(`[HEADING LINES — every short line standing alone between blank lines, with its character offset]`);
  for (const heading of headings) parts.push(`@${heading.offset}: ${heading.line}`);
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
