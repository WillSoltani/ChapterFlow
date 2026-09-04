/**
 * R-284 — the research prompt may not TEACH the sentence its own validator rejects.
 *
 * The live Franklin run (2026-09-04) rejected 12 of its persisted first drafts,
 * and 11 of those carried a `hardEdge` opening "A reader finishing this chapter
 * usually concludes …" followed by "What the chapter actually establishes is …".
 * Neither sentence was the model's invention: instruction 5 of
 * `prompts/researcher-chapter.system.md` quoted both, verbatim, as the shape to
 * write in — while `META_REGEXES` in `src/agents/researcher-chapter.ts` rejects
 * `this chapter` and `the chapter` in exactly that field. The prompt and the
 * validator contradicted each other on EVERY chapter of EVERY book, and the cost
 * was one wasted draft per chapter.
 *
 * This file is the standing guard against that class: any sentence the prompt
 * offers as a SHAPE TO COPY must itself survive the guard the copy will be held
 * to. It scans both halves of what the researcher is actually shown — the one
 * shared system prompt, and the per-book user message rendered by the real
 * builder for a source-text memoir — because a template can live in either.
 *
 * WHAT IT DELIBERATELY DOES NOT FLAG:
 *  - field DESCRIPTIONS ("2-3 sentences: where readers are most likely to MISREAD
 *    this chapter"). Those are instructions ABOUT a field, not sentences to copy
 *    into one, and they are not double-quoted.
 *  - PROSCRIBED examples — the ones the prompt shows in order to ban them. The
 *    prompt needs to be able to say what is rejected, and saying it is exactly
 *    how a model learns not to write it. They are recognised structurally, by
 *    the marker the prompt puts on them, never by an allowlist of their text.
 *  - the untrusted source block. That is the book's own bytes, quoted as data;
 *    it is stripped before the scan.
 */

import assert from "node:assert/strict";
import { readFileSync } from "fs";
import { resolve } from "path";

import { test } from "./harness.js";
import { PIPELINE_DIR } from "./helpers.js";
import {
  META_REGEXES,
  authorVerbRegexes,
  buildUserPrompt,
  type ChapterResearchInput,
} from "../src/agents/researcher-chapter.js";

const CHAPTER_PROMPT = readFileSync(resolve(PIPELINE_DIR, "prompts", "researcher-chapter.system.md"), "utf8");

/**
 * The shortest quoted span this treats as a TEMPLATE SENTENCE rather than as a
 * quoted term.
 *
 * The prompt legitimately quotes the banned phrases themselves — `"this
 * chapter"`, `"the author"`, `"in his writing"` — when it lists what the
 * validator rejects, and a rule that flagged those would make the ban
 * unstateable. Four words is the floor because the shortest thing anyone could
 * copy into a field and call a sentence is subject-verb-object-ish; every
 * template the prompt actually offers is far longer (instruction 5's offender
 * was eight words).
 */
const MIN_TEMPLATE_WORDS = 4;

/** A heading that marks everything under it as an ANTI-example ("### Bad `focus`"). */
const PROSCRIBED_HEADING = /^#{1,6}\s*Bad\b/i;

/** A line that marks its own quoted spans as anti-examples ("Rejected: …"). */
const PROSCRIBED_LINE = /^\s*(?:[-*]\s*)?Rejected:/i;

/** The untrusted source block the user message wraps the book's own bytes in. */
const UNTRUSTED_BLOCK = /<chapterflow_untrusted_source_data[\s\S]*?<\/chapterflow_untrusted_source_data>/g;

/** Straight and curly double quotes, non-greedy, single line. */
const QUOTED_SPAN = /["“]([^"“”\n]{1,400})["”]/g;

type QuotedSpan = {
  /** The quoted text, without its quote marks. */
  readonly quote: string;
  /** 1-indexed line number in the scanned document. */
  readonly line: number;
  /** True when the prompt marks this span as a shape NOT to write. */
  readonly proscribed: boolean;
};

/**
 * Every quoted span of at least {@link MIN_TEMPLATE_WORDS} words, with whether
 * the prompt marks it as an anti-example.
 *
 * Classification is structural — the nearest preceding heading, or the line's
 * own `Rejected:` marker — so a new anti-example is admitted by writing it the
 * way the prompt already writes them, and a new POSITIVE template can never be
 * admitted by accident.
 */
function quotedSpans(document: string): QuotedSpan[] {
  const spans: QuotedSpan[] = [];
  const lines = document.replace(UNTRUSTED_BLOCK, "").split("\n");
  let headingProscribes = false;
  lines.forEach((line, index) => {
    if (/^#{1,6}\s/.test(line)) headingProscribes = PROSCRIBED_HEADING.test(line);
    const proscribed = headingProscribes || PROSCRIBED_LINE.test(line);
    for (const match of line.matchAll(QUOTED_SPAN)) {
      const quote = match[1];
      if (quote.trim().split(/\s+/).filter((word) => word.length > 0).length < MIN_TEMPLATE_WORDS) continue;
      spans.push({ quote, line: index + 1, proscribed });
    }
  });
  return spans;
}

/** The memoir the guard is evaluated against: the book that paid for this bug. */
const MEMOIR_BIBLIOGRAPHY = { author: "Benjamin Franklin", genre: "memoir" } as const;

/** Which rule a template sentence breaks, or "" when it breaks none. */
function offenceIn(quote: string): string {
  for (const pattern of META_REGEXES) {
    pattern.lastIndex = 0;
    const hit = quote.match(pattern);
    if (hit) return `meta-reference "${hit[0]}"`;
  }
  for (const pattern of authorVerbRegexes(MEMOIR_BIBLIOGRAPHY)) {
    pattern.lastIndex = 0;
    const hit = pattern.exec(quote);
    if (hit) return `author-verb "${hit[0]}"`;
  }
  return "";
}

/** A source-text memoir call — the exact route that produced the live rejections. */
function memoirSourceTextInput(): ChapterResearchInput {
  const span =
    "The Union Fire Company was formed in seventeen thirty-six with thirty members, each keeping " +
    "two leather buckets and four stout linen bags at his own door.\n".repeat(12);
  return {
    bibliography: {
      bookId: "the-autobiography-of-benjamin-franklin",
      title: "The Autobiography of Benjamin Franklin",
      author: "Benjamin Franklin",
      genre: "memoir",
      edition: { chapterCount: 2 },
      flatChapters: [{ number: 1, title: "One" }, { number: 2, title: "Two" }],
      thesis: "Usefulness is built by repeatable habits.",
      teachingArc: "The first unit establishes the trade; the second establishes the civic ventures.",
      authorVoice: { register: "plainspoken", signatureMoves: ["x", "y", "z"], avoidMoves: [] },
      confidence: "high",
    },
    chapter: { number: 2, title: "Two" },
    sourceSpan: { startOffset: 0, endOffset: span.length, text: span },
  };
}

// ── the guard itself ─────────────────────────────────────────────────────────

test("R-284: every template sentence the research system prompt offers survives the researcher's own guard", () => {
  const spans = quotedSpans(CHAPTER_PROMPT);
  assert.ok(spans.length >= 8, `the scanner found only ${spans.length} quoted spans — it has stopped reading the prompt`);
  assert.ok(spans.some((span) => span.proscribed), "the prompt must still be able to SHOW what it rejects");

  const offences = spans
    .filter((span) => !span.proscribed)
    .map((span) => ({ span, offence: offenceIn(span.quote) }))
    .filter((entry) => entry.offence.length > 0)
    .map((entry) => `line ${entry.span.line}: ${entry.offence} in prescribed template "${entry.span.quote}"`);

  assert.deepEqual(
    offences,
    [],
    `the system prompt tells the researcher to write sentences its own validator rejects:\n${offences.join("\n")}`,
  );
});

test("R-284: every template sentence the per-book user message renders survives the same guard", () => {
  const spans = quotedSpans(buildUserPrompt(memoirSourceTextInput()));
  // Non-vacuity, in both directions: the message really does carry templates to
  // copy AND anti-examples, so a scan that found neither is a broken scan rather
  // than a clean prompt.
  assert.ok(spans.some((span) => !span.proscribed), "the rendered user message carries no prescribed templates — the scanner is misreading it");
  assert.ok(spans.some((span) => span.proscribed), "the rendered user message carries no anti-examples — the scanner is misreading it");

  const offences = spans
    .filter((span) => !span.proscribed)
    .map((span) => ({ span, offence: offenceIn(span.quote) }))
    .filter((entry) => entry.offence.length > 0)
    .map((entry) => `line ${entry.span.line}: ${entry.offence} in prescribed template "${entry.span.quote}"`);

  assert.deepEqual(
    offences,
    [],
    `the per-book user message tells the researcher to write sentences its own validator rejects:\n${offences.join("\n")}`,
  );
});

// ── the guard's own efficacy ─────────────────────────────────────────────────

test("R-284: the scanner catches the exact instruction that induced the live Franklin rejections", () => {
  // The shipped instruction 5, byte for byte. If a refactor ever narrows the
  // scanner past this line, this fails rather than going quietly green.
  const shipped =
    '## Hard rules\n\n' +
    '5. **`hardEdge` is where the chapter gets misread.** Write it in two moves: ' +
    'first the tempting wrong reading ("a reader finishing this chapter usually concludes <X>"), ' +
    'then what the chapter actually establishes and why <X> misses it.\n';
  const flagged = quotedSpans(shipped).filter((span) => !span.proscribed && offenceIn(span.quote).length > 0);
  assert.equal(flagged.length, 1, "the scanner must flag the shipped instruction-5 template");
  assert.match(flagged[0]!.quote, /a reader finishing this chapter usually concludes/);

  // …and it must NOT flag the same sentence once the prompt marks it as an
  // anti-example, or the prompt could never state the ban.
  const marked = '## Hard rules\n\nRejected: "a reader finishing this chapter usually concludes <X>".\n';
  assert.deepEqual(quotedSpans(marked).filter((span) => !span.proscribed), []);
});

test("R-284: the rewritten instruction 5 keeps the two-move pedagogy and states the field-level ban", () => {
  // The fix is not "delete the template" — a hardEdge with no shape regresses to
  // a vague field. The mis-takeaway still comes FIRST and the correction second;
  // both are now phrased as claims about the world.
  assert.match(CHAPTER_PROMPT, /It is tempting to conclude that <X>/);
  assert.match(CHAPTER_PROMPT, /The obvious takeaway is <X>/);
  assert.match(CHAPTER_PROMPT, /What actually holds is <Y>, because <Z>/);
  assert.match(CHAPTER_PROMPT, /never names the chapter, the book, the text, or the author-as-author/);
  // The induced sentences survive ONLY as marked anti-examples.
  const inducedLines = CHAPTER_PROMPT.split("\n").filter((line) => /a reader finishing this chapter usually concludes/i.test(line));
  assert.ok(inducedLines.length > 0, "the prompt should still name the sentence it used to induce");
  for (const line of inducedLines) assert.match(line, PROSCRIBED_LINE, `induced sentence is not marked as rejected: ${line}`);
});
