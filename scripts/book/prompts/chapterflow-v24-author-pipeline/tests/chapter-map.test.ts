/**
 * WP source-ingestion (R-046, R-058) — the chapter map.
 *
 * With the book's text in hand, the bibliography researcher must say WHERE each
 * chapter is. These tests pin the deterministic half: anchors resolve to raw
 * offsets, and a map that is out of order, overlapping, gappy, short of coverage,
 * or disagreeing with the bibliography's own chapter list fails CLOSED with a
 * message the model can act on.
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "fs";

import { test, skip } from "./harness.js";
import {
  CHAPTER_MAP_SCHEMA_VERSION,
  MAX_INTERIOR_GAP_CHARS,
  MIN_SPAN_COVERAGE_FRACTION,
  chapterMapContractLines,
  chapterMapMissingProblem,
  chapterSpanText,
  resolveChapterMap,
  spanExcerptForPrompt,
  MAX_SPAN_PROMPT_CHARS,
} from "../src/source/chapterMap.js";
import {
  MAX_BIBLIOGRAPHY_TEXT_CHARS,
  OUTLINE_MAX_HEADINGS,
  OUTLINE_OFFSET_LIST_HEADER,
  buildBibliographyTextView,
  outlineHeadings,
} from "../src/source/sourceOutline.js";
import { findAllQuoteOffsets, normalizeIngestedText, MIN_SOURCE_QUOTE_CHARS, MAX_SOURCE_QUOTE_CHARS } from "../src/source/sourceText.js";
import { FRANKLIN_SLICE_PATH, pickChapterStarts, readPublishedOffsets, syntheticLongSourceBook } from "./helpers.js";

// A synthetic two-chapter book: every offset below is checkable by hand.
const SYNTHETIC = [
  "Front matter that belongs to no chapter at all, printed before the book begins.",
  "",
  "ONE",
  "",
  "In the year seventeen twenty-three I left Boston in a small boat bound for Amboy.",
  "The passage took three days and the wind was contrary the whole way.",
  "",
  "TWO",
  "",
  "The Union Fire Company was formed in seventeen thirty-six with thirty members.",
  "Each member kept two leathern buckets and four bags in good order at home.",
  "",
].join("\n");

const CHAPTERS = [
  { number: 1, title: "Leaving Boston" },
  { number: 2, title: "The Fire Company" },
];

function goodSpans() {
  return [
    {
      chapterNumber: 1,
      startAnchor: "In the year seventeen twenty-three I left Boston",
      endAnchor: "the wind was contrary the whole way.",
    },
    {
      chapterNumber: 2,
      startAnchor: "The Union Fire Company was formed in seventeen thirty-six",
      endAnchor: "four bags in good order at home.",
    },
  ];
}

function resolve2(spans: unknown) {
  return resolveChapterMap({
    bookId: "synthetic-book",
    sourceText: SYNTHETIC,
    sourceTextSha256: "0".repeat(64),
    chapters: CHAPTERS,
    spans,
  });
}

test("R-046: a well-formed map resolves to raw offsets whose slices are the chapters", () => {
  const { map, problems } = resolve2(goodSpans());
  assert.deepEqual(problems, []);
  assert.ok(map);
  assert.equal(map!.schemaVersion, CHAPTER_MAP_SCHEMA_VERSION);
  assert.equal(map!.spans.length, 2);
  assert.match(chapterSpanText(SYNTHETIC, map!.spans[0]), /^In the year seventeen twenty-three/);
  assert.match(chapterSpanText(SYNTHETIC, map!.spans[0]), /contrary the whole way\.$/);
  assert.match(chapterSpanText(SYNTHETIC, map!.spans[1]), /^The Union Fire Company/);
  assert.ok(map!.spans[0].endOffset <= map!.spans[1].startOffset, "spans must not overlap");
});

test("R-046: an anchor that is not in the text fails closed and names the anchor", () => {
  const spans = goodSpans();
  spans[0].startAnchor = "In the year seventeen ninety-nine I left Philadelphia";
  const { map, problems } = resolve2(spans);
  assert.equal(map, null);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /chapter 1 startAnchor/);
  assert.match(problems[0], /not found in the source text/);
});

test("R-046: an ambiguous anchor fails closed and asks for a longer, unique one", () => {
  const text = `${SYNTHETIC}\n${SYNTHETIC}`;
  const { map, problems } = resolveChapterMap({
    bookId: "synthetic-book",
    sourceText: text,
    sourceTextSha256: "0".repeat(64),
    chapters: CHAPTERS,
    spans: goodSpans(),
  });
  assert.equal(map, null);
  assert.ok(problems.some((p) => /occurs 2 times/.test(p)), problems.join(" | "));
  assert.ok(problems.some((p) => /unique/.test(p)), problems.join(" | "));
});

test("R-046: overlapping spans fail closed", () => {
  const spans = goodSpans();
  // Chapter 1 now runs past the start of chapter 2.
  spans[0].endAnchor = "Each member kept two leathern buckets";
  const { map, problems } = resolve2(spans);
  assert.equal(map, null);
  assert.ok(problems.some((p) => /overlap/i.test(p)), problems.join(" | "));
});

test("R-046: spans out of order (a later chapter starting earlier) fail closed", () => {
  const spans = goodSpans();
  const swapped = [
    { ...spans[1], chapterNumber: 1 },
    { ...spans[0], chapterNumber: 2 },
  ];
  const { map, problems } = resolve2(swapped);
  assert.equal(map, null);
  assert.ok(problems.some((p) => /order/i.test(p)), problems.join(" | "));
});

test("R-046: a chapter list / span mismatch fails closed in both directions", () => {
  const missing = resolve2([goodSpans()[0]]);
  assert.equal(missing.map, null);
  assert.ok(missing.problems.some((p) => /no span for chapter 2/.test(p)), missing.problems.join(" | "));

  const extra = resolve2([...goodSpans(), { chapterNumber: 3, startAnchor: "Front matter that belongs to no chapter", endAnchor: "printed before the book begins." }]);
  assert.equal(extra.map, null);
  assert.ok(extra.problems.some((p) => /chapter 3 is not in the bibliography/.test(p)), extra.problems.join(" | "));

  const duplicate = resolve2([goodSpans()[0], goodSpans()[0], goodSpans()[1]]);
  assert.equal(duplicate.map, null);
  assert.ok(duplicate.problems.some((p) => /more than one span/.test(p)), duplicate.problems.join(" | "));
});

test(`R-058: an interior gap larger than ${MAX_INTERIOR_GAP_CHARS} chars fails closed — a chapter's worth of text assigned to nobody`, () => {
  const filler = "Filler sentence about nothing in particular. ".repeat(200); // ~9000 chars
  const text = SYNTHETIC.replace("\nTWO\n", `\n${filler}\nTWO\n`);
  const { map, problems } = resolveChapterMap({
    bookId: "synthetic-book",
    sourceText: text,
    sourceTextSha256: "0".repeat(64),
    chapters: CHAPTERS,
    spans: goodSpans(),
  });
  assert.equal(map, null);
  assert.ok(problems.some((p) => /unassigned/i.test(p) && /chapter 1 and chapter 2/.test(p)), problems.join(" | "));
});

test(`R-046: total coverage below ${MIN_SPAN_COVERAGE_FRACTION} of the text fails closed`, () => {
  const tail = "\nAn appendix nobody mapped. ".repeat(400);
  const text = SYNTHETIC + tail;
  const { map, problems } = resolveChapterMap({
    bookId: "synthetic-book",
    sourceText: text,
    sourceTextSha256: "0".repeat(64),
    chapters: CHAPTERS,
    spans: goodSpans(),
  });
  assert.equal(map, null);
  assert.ok(problems.some((p) => /covers/.test(p) && /of the source text/.test(p)), problems.join(" | "));
});

test("R-046: front matter before the first span and trailing matter after the last are allowed", () => {
  const { map } = resolve2(goodSpans());
  assert.ok(map);
  assert.ok(map!.spans[0].startOffset > 0, "the front matter is deliberately outside every span");
  assert.ok(map!.spans[1].endOffset < SYNTHETIC.length);
});

// ── prompt bounding ───────────────────────────────────────────────────────────

test("R-046: a span within the prompt bound is passed whole", () => {
  const span = "A short chapter.".repeat(10);
  const excerpt = spanExcerptForPrompt(span);
  assert.equal(excerpt.text, span);
  assert.equal(excerpt.excerpted, false);
});

test("R-046: an over-long span is chunked into deterministic, marked excerpts", () => {
  const span = Array.from({ length: 40_000 }, (_, i) => `sentence ${i} of the long chapter.`).join(" ");
  assert.ok(span.length > MAX_SPAN_PROMPT_CHARS);
  const a = spanExcerptForPrompt(span);
  const b = spanExcerptForPrompt(span);
  assert.equal(a.text, b.text, "excerpting must be deterministic — the same span always yields the same prompt");
  assert.equal(a.excerpted, true);
  assert.ok(a.text.length <= MAX_SPAN_PROMPT_CHARS + 2000, `excerpt is ${a.text.length} chars`);
  assert.match(a.text, /\[\.\.\. omitted \d+ characters of this chapter \.\.\.\]/);
  assert.ok(a.text.startsWith("sentence 0 "), "the excerpt must begin at the start of the span");
});

// ── the real Franklin text (hermetic: no model call) ──────────────────────────

test("R-046: four Part-sized spans over the Gutenberg Autobiography slice validate", () => {
  if (!existsSync(FRANKLIN_SLICE_PATH)) {
    skip("R-046: Franklin slice spans", `${FRANKLIN_SLICE_PATH} is not on this machine`);
    return;
  }
  const text = normalizeIngestedText(readFileSync(FRANKLIN_SLICE_PATH, "utf8"));
  // Four spans cut at real sentence boundaries inside the slice, mirroring the
  // released four-Part bibliography this package must be able to map.
  const quarters = [0, 1, 2, 3].map((i) => Math.floor((text.length * i) / 4));
  const anchors: Array<{ chapterNumber: number; startAnchor: string; endAnchor: string }> = [];
  for (let i = 0; i < 4; i += 1) {
    const from = quarters[i];
    const to = i === 3 ? text.length : quarters[i + 1];
    const body = text.slice(from, to);
    anchors.push({
      chapterNumber: i + 1,
      startAnchor: body.slice(0, 90),
      endAnchor: body.slice(-90),
    });
  }
  const { map, problems } = resolveChapterMap({
    bookId: "the-autobiography-of-benjamin-franklin",
    sourceText: text,
    sourceTextSha256: "1".repeat(64),
    chapters: [1, 2, 3, 4].map((n) => ({ number: n, title: `Part ${n}` })),
    spans: anchors,
  });
  assert.deepEqual(problems, [], problems.join(" | "));
  assert.ok(map);
  assert.equal(map!.spans.length, 4, "the four-Part bibliography must produce four spans");
  assert.equal(map!.spans[0].startOffset, 0);
  // Anchor resolution reports the offset just past the last NON-WHITESPACE
  // character of the anchor, so a file that ends in a newline maps to
  // text.trimEnd().length rather than text.length.
  assert.equal(map!.spans[3].endOffset, text.trimEnd().length);
});

// ── OUTLINE MODE: a book too long to pass whole (review round 2, finding 4) ────
//
// Round 1 asked EVERY book for the same thing: a startAnchor and an endAnchor per
// chapter, each 20-240 characters, each occurring exactly once in the WHOLE text
// — and validated both against the whole text even when the model had been shown
// only an OUTLINE of it. On a 300 KB book that is unsatisfiable by construction,
// and the two tests below measure both halves of why: a chapter's END is inside
// none of the twelve excerpts the model sees, and every title it CAN see is
// printed twice (contents page, chapter head) so a title-shaped anchor resolves
// as ambiguous. The map failed closed, which is safe — but it meant a long book
// could never produce a source-text run at all, which is this package's headline
// claim.
//
// The redesign: in outline mode the model does not INVENT a locator, it PICKS
// one. The view prints an explicit list of offsets and resolveChapterMap accepts
// nothing else. An offset is safe here for exactly the reason an anchor is safe
// in whole mode — the model is COPYING a number this code computed, never
// counting characters of its own. The prompt contract and the validator are one
// function (chapterMapContractLines / resolveChapterMap, both keyed off
// chapterMapMode), so they cannot drift apart again.

const LONG = (() => {
  const book = syntheticLongSourceBook();
  return { ...book, text: normalizeIngestedText(book.text) };
})();

/** The offsets a model may pick, read STRAIGHT OUT OF THE RENDERED VIEW: every
 *  map below is built only from what the model was actually shown. */
function offsetsInView(view: string): Array<{ offset: number; label: string }> {
  const choices = readPublishedOffsets(view, OUTLINE_OFFSET_LIST_HEADER);
  assert.ok(choices.length > 0, "the outline view must print the offsets a chapterMap may use");
  return choices;
}

/** What a model reading that list takes for each chapter's start. */
function chapterStartOffsets(choices: ReadonlyArray<{ offset: number; label: string }>): number[] {
  const starts = pickChapterStarts(choices, LONG.numerals);
  assert.equal(starts.length, LONG.numerals.length, "every chapter must be identifiable from the printed list alone");
  return starts;
}

test("R-046: the round-1 ANCHOR contract is unsatisfiable on a book shown as an outline", () => {
  // Half one: no chapter END is usable as an anchor. Either the model never sees
  // it (it falls between the excerpts, so it cannot be copied) or it is not
  // unique in the whole text (this book reuses one slice, exactly as a book with
  // a repeated section break or a standard chapter sign-off does), and
  // anchorProblem rejects both. Each chapter is asserted to be in one case or the
  // other, and the assertion names which.
  const view = buildBibliographyTextView(LONG.text);
  assert.equal(view.mode, "outline");
  const starts = chapterStartOffsets(offsetsInView(view.text));
  for (let i = 0; i + 1 < starts.length; i += 1) {
    const tail = LONG.text.slice(starts[i + 1] - 240, starts[i + 1]).trim();
    assert.ok(tail.length >= MIN_SOURCE_QUOTE_CHARS, "precondition: each chapter has a tail long enough to be a legal anchor");
    const unseen = !view.text.includes(tail);
    const hits = findAllQuoteOffsets(LONG.text, tail).length;
    assert.ok(unseen || hits > 1, `chapter ${i + 1}'s end is both visible in the outline and unique in the text, so an endAnchor WOULD have been copyable here`);
  }
  // Half two: every title the model CAN see is printed twice — contents page and
  // chapter head — so a title-shaped anchor is ambiguous and would be rejected.
  const title = LONG.chapters[1].title;
  assert.ok(title.length >= 20, "precondition: the title is long enough to be a legal anchor");
  assert.ok(view.text.includes(title), "precondition: the model can see this title");
  assert.ok(findAllQuoteOffsets(LONG.text, title).length > 1, "a title the model can see must occur more than once, which is what makes it unusable as an anchor");
});

test("R-046: a 300 KB book is shown an OUTLINE that publishes the offsets its chapterMap may use", () => {
  assert.ok(LONG.text.length > MAX_BIBLIOGRAPHY_TEXT_CHARS, `precondition: ${LONG.text.length} chars must exceed the ${MAX_BIBLIOGRAPHY_TEXT_CHARS}-char whole-text bound`);
  assert.ok(LONG.text.length > 300_000, `this fixture is meant to be a ~300 KB book, measured ${LONG.text.length}`);
  const view = buildBibliographyTextView(LONG.text);
  assert.equal(view.mode, "outline");
  const choices = offsetsInView(view.text);
  assert.ok(choices.length >= LONG.chapters.length + 1, `a ${LONG.chapters.length}-chapter book needs at least ${LONG.chapters.length + 1} offsets to pick from, saw ${choices.length}`);
  assert.equal(choices[choices.length - 1].offset, LONG.text.length, "the END OF TEXT offset must be pickable, or the last chapter has no end to name");
  assert.deepEqual([...choices].sort((a, b) => a.offset - b.offset).map((c) => c.offset), choices.map((c) => c.offset), "offsets are listed in text order");
  // Every chapter head must be pickable, or the contract stays unsatisfiable.
  assert.equal(chapterStartOffsets(choices).length, LONG.chapters.length);
});

test("R-046: an outline-mode chapter map built ONLY from the view's own offsets validates", () => {
  const choices = offsetsInView(buildBibliographyTextView(LONG.text).text);
  const starts = chapterStartOffsets(choices);
  const appendix = choices.find((c) => c.label === "APPENDIX");
  assert.ok(appendix, "the appendix heading must be pickable as the last chapter's end");
  const spans = starts.map((startOffset, i) => ({
    chapterNumber: i + 1,
    startOffset,
    endOffset: i + 1 < starts.length ? starts[i + 1] : appendix!.offset,
  }));
  const { map, problems } = resolveChapterMap({
    bookId: "a-long-book",
    sourceText: LONG.text,
    sourceTextSha256: "2".repeat(64),
    chapters: LONG.chapters,
    spans,
  });
  assert.deepEqual(problems, [], problems.join(" | "));
  assert.ok(map);
  assert.equal(map!.spans.length, LONG.chapters.length);
  assert.ok(map!.coverageFraction > MIN_SPAN_COVERAGE_FRACTION, `coverage ${map!.coverageFraction} must clear the floor`);
  // The resolved span really is that chapter's text, not an offset that happens
  // to validate: chapter 3 starts at its numeral and carries its own opening line.
  assert.match(chapterSpanText(LONG.text, map!.spans[2]), /^III\n/);
  assert.match(chapterSpanText(LONG.text, map!.spans[2]), /Chapter 3 opens with its own sentence, number 3\./);
  assert.ok(!chapterSpanText(LONG.text, map!.spans[2]).includes("Chapter 4 opens with its own sentence"), "a span must stop before the next chapter");
});

test("R-046: outline mode refuses an offset the view never published, and says which values are allowed", () => {
  const choices = offsetsInView(buildBibliographyTextView(LONG.text).text);
  const starts = chapterStartOffsets(choices);
  const appendix = choices.find((c) => c.label === "APPENDIX")!;
  const spans = starts.map((startOffset, i) => ({
    chapterNumber: i + 1,
    // Chapter 1's start is nudged seven characters — the shape of a model that
    // ADJUSTED a printed offset instead of copying it.
    startOffset: i === 0 ? startOffset + 7 : startOffset,
    endOffset: i + 1 < starts.length ? starts[i + 1] : appendix.offset,
  }));
  const { map, problems } = resolveChapterMap({
    bookId: "a-long-book",
    sourceText: LONG.text,
    sourceTextSha256: "2".repeat(64),
    chapters: LONG.chapters,
    spans,
  });
  assert.equal(map, null, "an adjusted offset must fail closed");
  assert.ok(problems.some((p) => /startOffset/.test(p) && /listed/.test(p) && /nearest listed are/.test(p)), problems.join(" | "));
});

test("R-046: each mode refuses the OTHER mode's contract, so a map cannot be built under one the model was never given", () => {
  const outline = resolveChapterMap({
    bookId: "a-long-book",
    sourceText: LONG.text,
    sourceTextSha256: "2".repeat(64),
    chapters: LONG.chapters,
    spans: LONG.chapters.map((c) => ({ chapterNumber: c.number, startAnchor: "x".repeat(40), endAnchor: "y".repeat(40) })),
  });
  assert.equal(outline.map, null);
  assert.ok(outline.problems.some((p) => /startOffset/.test(p)), outline.problems.join(" | "));

  const whole = resolveChapterMap({
    bookId: "synthetic-book",
    sourceText: SYNTHETIC,
    sourceTextSha256: "0".repeat(64),
    chapters: CHAPTERS,
    spans: CHAPTERS.map((c) => ({ chapterNumber: c.number, startOffset: 0, endOffset: 10 })),
  });
  assert.equal(whole.map, null);
  assert.ok(whole.problems.some((p) => /startAnchor/.test(p)), whole.problems.join(" | "));
});

test("R-046: the prompt contract and the validator are the SAME contract, in both modes", () => {
  const outline = chapterMapContractLines(LONG.text).join("\n");
  assert.match(outline, /startOffset/);
  assert.match(outline, /endOffset/);
  assert.ok(outline.includes(OUTLINE_OFFSET_LIST_HEADER), "the outline contract must name the list the validator accepts values from");
  assert.ok(!/startAnchor/.test(outline), "an outline-mode prompt must not ask for anchors the validator will reject");
  assert.match(chapterMapMissingProblem(LONG.text), /startOffset/);

  const whole = chapterMapContractLines(SYNTHETIC).join("\n");
  assert.match(whole, /startAnchor/);
  assert.ok(!/startOffset/.test(whole), "a whole-text prompt must not ask for offsets the validator will reject");
  assert.match(chapterMapMissingProblem(SYNTHETIC), /startAnchor/);
  // The anchor bounds the prompt quotes are the ones quoteShapeProblem enforces:
  // round 1's prompt said 30-240 while the validator took 20.
  assert.ok(whole.includes(`${MIN_SOURCE_QUOTE_CHARS}-${MAX_SOURCE_QUOTE_CHARS} characters`), whole);
});

test("R-046: the heading list stays reachable to the END of a heading-dense book", () => {
  // The cap used to `break` out of the scan at OUTLINE_MAX_HEADINGS, so a book
  // with more heading-shaped lines than the cap published offsets for its FIRST
  // pages only — and every chapter past that point was unmappable.
  const lines: string[] = [];
  for (let i = 0; i < OUTLINE_MAX_HEADINGS * 3; i += 1) {
    lines.push(`CHAPTER ${i + 1}`, "", `Body line ${i + 1} of a book made almost entirely of headings.`, "");
  }
  const dense = lines.join("\n");
  const headings = outlineHeadings(dense);
  assert.ok(headings.length <= OUTLINE_MAX_HEADINGS, `the cap must hold, saw ${headings.length}`);
  assert.ok(
    headings[headings.length - 1].offset > dense.length * 0.9,
    `the last published heading is at ${headings[headings.length - 1].offset} of ${dense.length}; the tail of the book must stay mappable`,
  );
});
