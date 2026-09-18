/**
 * The chapter title the SOURCE TEXT itself prints (R-046 follow-on).
 *
 * The bibliography researcher returns a chapter list from what it knows of the
 * book, and that list becomes frozen chapter identity: the repair lane refuses a
 * title change, and the blueprint/packet/source-v2 equality checks bind it. On
 * the released Franklin run the model recalled titles instead of reading them —
 * chapter 15 was listed as "Appointment as Deputy Postmaster General" while the
 * edition heads that chapter "QUARRELS WITH THE PROPRIETARY GOVERNORS", and the
 * structural review then blocked the book over a title no lane could change.
 *
 * The edition's own heading is already inside the frozen text, at the start of
 * the span the chapter map resolves. This module reads it, deterministically:
 *
 *     XV                              <- a bare numeral line, skipped
 *
 *     QUARRELS WITH THE PROPRIETARY   <- the heading, possibly wrapped
 *     GOVERNORS
 *
 *     In my journey to Boston…        <- prose; the scan has already stopped
 *
 * A span whose start carries no heading (Franklin's chapter 1 opens on the
 * letter to his son) yields null, and the caller keeps the bibliography title —
 * inventing one from prose would be the same failure in the other direction.
 *
 * The heading heuristics MIRROR sourceOutline.ts#looksLikeHeading, which is what
 * put these offsets on the map in the first place: a line of at most
 * {@link MAX_HEADING_LINE_CHARS} characters whose letters are all uppercase and
 * number at least three. Two cases sourceOutline does not have to care about are
 * excluded here, because they sit exactly where a heading does: a chapter LABEL
 * and a parenthesised date or range line ("(1749-1753)", printed under chapter
 * 13's heading in this very edition).
 *
 * A LABEL is a bare roman/arabic numeral ("XV", as this edition prints it) or
 * sourceOutline.ts's NUMBERED_HEADING word followed by one, in figures, in roman
 * or spelled out, cardinal or ordinal ("CHAPTER II.", "PART ONE",
 * "CHAPTER THE FIRST", "CHAPTER TWENTY-ONE" — the far more common Gutenberg
 * layouts). It labels the chapter; it does not name it. Reading a label as the name would discard the real title and
 * freeze a content-free identity no lane can repair, and a repeated "PART ONE"
 * would give several chapters one identical title — the failure researcher.ts
 * already names. The label form is the word PLUS a numeral and nothing else, so
 * a genuine heading such as "LETTER TO HIS SON" or "PART OF THE ART OF VIRTUE"
 * is still a heading.
 */

/** Lines examined from the span start before the scan gives up. A heading that
 *  is not inside the first ten lines of its own span is not a heading. */
export const MAX_HEADING_SCAN_LINES = 10;

/** Longest heading line accepted — the bound sourceOutline.ts uses. */
export const MAX_HEADING_LINE_CHARS = 80;

/** A WELL-FORMED roman numeral, I..MMMCMXCIX. Membership in I/V/X/L/C/D/M is NOT
 *  enough: "CIVIL" and "VIVID" are words spelled out of those letters, and
 *  skipping such a line as a numeral would take the first line of a wrapped
 *  heading for a label and name the chapter after its second line only. */
const ROMAN_NUMERAL = /^(?=[MDCLXVI])M{0,3}(?:CM|CD|D?C{0,3})(?:XC|XL|L?X{0,3})(?:IX|IV|V?I{0,3})$/i;

/** A chapter number in figures. */
const ARABIC_NUMERAL = /^\d{1,3}$/;

/** The numerals an edition SPELLS OUT, cardinal and ordinal, with the hyphenated
 *  compounds any book of more than twenty chapters needs ("TWENTY-ONE",
 *  "TWENTY-FIFTH"). A 19th-century edition writes "CHAPTER THE FIRST". */
const SPELLED_NUMERAL_WORD =
  "(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth|thirteenth|fourteenth|fifteenth|sixteenth|seventeenth|eighteenth|nineteenth|twentieth|thirtieth|fortieth|fiftieth|sixtieth|seventieth|eightieth|ninetieth|hundredth)";
const SPELLED_NUMERAL = new RegExp(`^${SPELLED_NUMERAL_WORD}(?:-${SPELLED_NUMERAL_WORD})?$`, "i");

/** The word a numbered heading opens with — sourceOutline.ts:NUMBERED_HEADING's
 *  own vocabulary, matched as a whole word rather than as a prefix. */
const LABEL_WORD = /^(?:chapter|part|book|section|letter)$/i;

/** A chapter number in any form the page may print it. */
function isNumeralToken(token: string): boolean {
  return ROMAN_NUMERAL.test(token) || ARABIC_NUMERAL.test(token) || SPELLED_NUMERAL.test(token);
}

/**
 * True for a line that LABELS the chapter rather than naming it: a bare roman or
 * arabic numeral ("XV", as this edition prints it), or the label word alone or
 * followed by one numeral in any printed form ("CHAPTER II.", "PART ONE",
 * "BOOK I", "SECTION 2", "CHAPTER THE FIRST", "CHAPTER TWENTY-ONE").
 *
 * The label form is the word plus at most an article and ONE numeral and nothing
 * else, so a genuine heading that merely begins with the word — "LETTER TO HIS
 * SON", "PART OF THE ART OF VIRTUE" — is still a heading.
 */
function isLabelLine(trimmed: string): boolean {
  const tokens = trimmed.replace(/[.:]+$/, "").trim().split(/\s+/).filter((token) => token.length > 0);
  if (tokens.length === 0) return false;
  if (!LABEL_WORD.test(tokens[0])) {
    return tokens.length === 1 && (ROMAN_NUMERAL.test(tokens[0]) || ARABIC_NUMERAL.test(tokens[0]));
  }
  const rest = tokens[1]?.toLowerCase() === "the" ? tokens.slice(2) : tokens.slice(1);
  return rest.length === 0 || (rest.length === 1 && isNumeralToken(rest[0]));
}

/** A parenthesised line, e.g. the "(1749-1753)" printed under a chapter head. */
const PARENTHESISED_LINE = /^\(.*\)$/;

/** Words that stay lowercase inside a title (never first or last). */
const SMALL_WORDS = new Set([
  "a", "an", "and", "as", "at", "but", "by", "for", "in", "of", "on", "or", "the", "to", "with", "nor",
]);

/** True for a line that is part of a printed chapter heading. */
function isHeadingLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_HEADING_LINE_CHARS) return false;
  if (isLabelLine(trimmed)) return false;
  if (PARENTHESISED_LINE.test(trimmed)) return false;
  const letters = trimmed.replace(/[^\p{L}]/gu, "");
  return letters.length >= 3 && letters === letters.toUpperCase();
}

/**
 * The heading printed at the start of `spanText`, in the source's own capitals,
 * with a wrapped heading joined by single spaces — or null when the span opens
 * on something that is not a heading.
 */
export function sourceHeadingAtSpanStart(spanText: string): string | null {
  const lines = spanText.split("\n", MAX_HEADING_SCAN_LINES);
  let i = 0;
  while (i < lines.length && lines[i].trim().length === 0) i += 1;
  // At most one label line — the chapter's number, printed above its name.
  if (i < lines.length && isLabelLine(lines[i].trim())) {
    i += 1;
    while (i < lines.length && lines[i].trim().length === 0) i += 1;
  }
  const parts: string[] = [];
  for (; i < lines.length; i += 1) {
    if (!isHeadingLine(lines[i])) break;
    parts.push(lines[i].trim());
  }
  return parts.length === 0 ? null : parts.join(" ");
}

/**
 * An ALL-CAPS printed heading as a book title: first and last word capitalised,
 * small words lowercase in between, apostrophes preserved.
 * "POOR RICHARD'S ALMANAC AND OTHER ACTIVITIES" -> "Poor Richard's Almanac and Other Activities".
 */
export function titleCaseSourceHeading(heading: string): string {
  const words = heading.trim().split(/\s+/).filter((word) => word.length > 0);
  return words
    .map((word, index) => {
      const lower = word.toLowerCase();
      const isEdge = index === 0 || index === words.length - 1;
      if (!isEdge && SMALL_WORDS.has(lower.replace(/[^\p{L}]/gu, ""))) return lower;
      return lower.replace(/\p{L}/u, (letter) => letter.toUpperCase());
    })
    .join(" ");
}

/** The title this span's own heading gives the chapter, or null when it has none. */
export function sourceChapterTitleAtSpanStart(spanText: string): string | null {
  const heading = sourceHeadingAtSpanStart(spanText);
  return heading === null ? null : titleCaseSourceHeading(heading);
}

export type ChapterTitleChange = {
  readonly chapterNumber: number;
  readonly bibliographyTitle: string;
  readonly sourceTitle: string;
};

export type ChapterTitleReconciliation = {
  /** The chapter list every downstream consumer must now see. */
  readonly chapters: ReadonlyArray<{ number: number; title: string }>;
  /** Only the chapters whose title the source text actually changed. */
  readonly changes: readonly ChapterTitleChange[];
};

/**
 * Reconcile a bibliography chapter list against the headings the frozen text
 * prints at each mapped span. Pure and deterministic: the same text and spans
 * always yield the same list, so a resumed run re-derives it byte-identically.
 */
export function reconcileChapterTitlesFromSource(args: {
  sourceText: string;
  spans: ReadonlyArray<{ chapterNumber: number; startOffset: number; endOffset: number }>;
  chapters: ReadonlyArray<{ number: number; title: string }>;
}): ChapterTitleReconciliation {
  const spanByChapter = new Map(args.spans.map((span) => [span.chapterNumber, span]));
  const changes: ChapterTitleChange[] = [];
  const chapters = args.chapters.map((chapter) => {
    const span = spanByChapter.get(chapter.number);
    if (span === undefined) return { number: chapter.number, title: chapter.title };
    const sourceTitle = sourceChapterTitleAtSpanStart(args.sourceText.slice(span.startOffset, span.endOffset));
    if (sourceTitle === null || sourceTitle === chapter.title) {
      return { number: chapter.number, title: chapter.title };
    }
    changes.push({ chapterNumber: chapter.number, bibliographyTitle: chapter.title, sourceTitle });
    return { number: chapter.number, title: sourceTitle };
  });
  return { chapters, changes };
}
