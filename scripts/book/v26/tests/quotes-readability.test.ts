import test from "node:test";
import assert from "node:assert/strict";
import { findQuotes, norm, quoteInSource } from "../src/quotes";
import { fkGrade, sentences, syllables, textStats } from "../src/readability";

// ---------------------------------------------------------------- norm

test("norm: parity with the Python normalizer", () => {
  assert.equal(
    norm("He said, “Nothing was useful[3] which was not _honest_”—so there."),
    "he said nothing was useful which was not honest so there",
  );
});

test("norm: dashes, underscores, footnote markers, curly quotes", () => {
  assert.equal(norm("a–b--c—d"), "a b c d");
  assert.equal(norm("_emphasis_ here"), "emphasis here");
  assert.equal(norm("word[12] next"), "word next");
  // The marker is deleted, not replaced by a space, so adjacent letters fuse (same as the Python).
  assert.equal(norm("one[1]two"), "onetwo");
  assert.equal(norm("Franklin’s ‘son’"), "franklin's 'son'");
  assert.equal(norm("  Many \n\t  spaces  "), "many spaces");
  assert.equal(norm(""), "");
});

// ---------------------------------------------------------------- findQuotes

test("findQuotes: straight quotes", () => {
  assert.deepEqual(findQuotes('He wrote "Nothing was useful" and left.'), ["Nothing was useful"]);
});

test("findQuotes: curly quotes", () => {
  assert.deepEqual(findQuotes("He wrote “Nothing was useful” and left."), ["Nothing was useful"]);
});

test("findQuotes: several spans, straight and curly together", () => {
  const t = 'First "an honest man" then “a quiet house” and "a plowman on his legs".';
  // Straight-quoted spans come first, then curly ones (two separate findall passes in the Python).
  assert.deepEqual(findQuotes(t), ["an honest man", "a plowman on his legs", "a quiet house"]);
});

test("findQuotes: a short quote (under 8 characters) is ignored; exactly 8 is kept", () => {
  assert.deepEqual(findQuotes('He said "short" and “tiny”.'), []);
  assert.deepEqual(findQuotes('"1234567" and "12345678"'), ["12345678"]);
  assert.deepEqual(findQuotes("“1234567” “12345678”"), ["12345678"]);
});

test("findQuotes: a quote spanning a newline is ignored", () => {
  assert.deepEqual(findQuotes('"spans two\nlines here"'), []);
  assert.deepEqual(findQuotes("“spans two\nlines here” then “one clean line”"), ["one clean line"]);
});

test("findQuotes: no quotes at all", () => {
  assert.deepEqual(findQuotes("Plain text without any quotation marks."), []);
});

// ---------------------------------------------------------------- quoteInSource

const SOURCE_RAW =
  "Industry and frugality were his rule. Nothing was useful[7] which was not _honest_, he wrote, " +
  "and a plowman on his legs is higher than a gentleman on his knees. " +
  "Franklin’s son received the account at Twyford.";
const SOURCE = norm(SOURCE_RAW);

test("quoteInSource: an exact quote is found", () => {
  assert.equal(quoteInSource("Nothing was useful which was not honest", SOURCE), true);
});

test("quoteInSource: a paraphrase or a misspelling fails", () => {
  assert.equal(quoteInSource("Nothing was helpful which was not honest", SOURCE), false);
  // Misspelling: the quote carries the wrong form, the source the right one.
  assert.equal(quoteInSource("Nothing was usefull which was not honest", SOURCE), false);
});

test("quoteInSource: a modernised spelling fails when the source keeps the archaic form", () => {
  // The real-use direction: the source (e.g. Franklin) is archaic, the chapter quote has modernised it.
  // The modern word sits inside the quote, not at its edge, so the substring check cannot slip past it.
  assert.equal(quoteInSource("I shall show you", norm("I shall shew you the publick good")), false);
  assert.equal(quoteInSource("an honor and a duty", norm("an honour and a duty")), false);
  // Control: the archaic spelling quoted as the source has it still matches.
  assert.equal(quoteInSource("I shall shew you", norm("I shall shew you the publick good")), true);
  // Known gap, left as the spec's substring algorithm behaves: a modern prefix at the very edge of the
  // quote is still a substring of the archaic word, so this is true. Do not assert false here.
  assert.equal(quoteInSource("for the public", norm("for the publick good")), true);
});

test("quoteInSource: ellipsis-split quote, every part in the source", () => {
  assert.equal(quoteInSource("Nothing was useful ... not honest", SOURCE), true);
  assert.equal(quoteInSource("Nothing was useful…not honest", SOURCE), true);
  assert.equal(quoteInSource("Nothing was useful . . . not honest", SOURCE), true);
  assert.equal(quoteInSource("a plowman on his legs ... a gentleman on his knees", SOURCE), true);
});

test("quoteInSource: ellipsis-split quote with one part missing", () => {
  assert.equal(quoteInSource("Nothing was useful ... not truthful", SOURCE), false);
  assert.equal(quoteInSource("Nothing was helpful ... not honest", SOURCE), false);
});

test("quoteInSource: leading or trailing ellipsis leaves empty parts that are dropped", () => {
  assert.equal(quoteInSource("... which was not honest", SOURCE), true);
  assert.equal(quoteInSource("Nothing was useful ...", SOURCE), true);
  assert.equal(quoteInSource("...", SOURCE), true);
});

test("quoteInSource: curly and straight apostrophes match each other", () => {
  assert.equal(quoteInSource("Franklin's son received the account", SOURCE), true);
  assert.equal(quoteInSource("Franklin’s son received the account", SOURCE), true);
  const straightSource = norm("Franklin's son received the account");
  assert.equal(quoteInSource("Franklin’s son received the account", straightSource), true);
});

test("quoteInSource: a [7] footnote marker in the source does not break the match", () => {
  assert.equal(quoteInSource("Nothing was useful which was not honest", norm("Nothing was useful[7] which was not honest")), true);
  assert.equal(quoteInSource("useful which", norm("Nothing was useful [7] which was not honest")), true);
});

// ---------------------------------------------------------------- syllables

test("syllables: parity with the Python counter", () => {
  const expected: Record<string, number> = {
    the: 1,
    table: 2,
    honest: 2,
    useful: 3,
    extraordinary: 5,
    beautiful: 4,
    queue: 2,
    rhythm: 1,
    make: 1,
    created: 1,
    Twyford: 2,
  };
  for (const [word, n] of Object.entries(expected)) {
    assert.equal(syllables(word), n, `${word} should be ${n}`);
  }
});

test("syllables: non-letters are stripped, empty is zero", () => {
  assert.equal(syllables(""), 0);
  assert.equal(syllables("1771"), 0);
  assert.equal(syllables("don’t"), 1);
  assert.equal(syllables("Honest,"), 2);
});

// ---------------------------------------------------------------- sentences / fkGrade

const CAT = "The cat sat on the mat. It was happy.";
const FRANKLIN =
  "Franklin wrote this account for his son in 1771, at a quiet house called Twyford in England. He starts with family, not himself.";
const HARD = "Nothing was useful which was not honest. Industrious, conscientious, extraordinary people!";

test("sentences: each parity string splits into two", () => {
  assert.equal(sentences(CAT).length, 2);
  assert.equal(sentences(FRANKLIN).length, 2);
  assert.equal(sentences(HARD).length, 2);
});

test("sentences: closing quotes/brackets after the stop are part of the break (dropped, as in the Python); digits and quotes may open the next", () => {
  assert.deepEqual(sentences('He said "stop." Then he left. 3 men stayed.'), ['He said "stop.', "Then he left.", "3 men stayed."]);
  assert.deepEqual(sentences("It ended (barely.) “Next,” she said."), ["It ended (barely.", "“Next,” she said."]);
});

test("sentences: whitespace is collapsed and fragments with no letters are dropped", () => {
  assert.deepEqual(sentences("One   fine\nday. Two."), ["One fine day.", "Two."]);
  assert.deepEqual(sentences(""), []);
  assert.deepEqual(sentences("1. 2. 3."), []);
});

test("fkGrade: parity with the Python grade", () => {
  assert.equal(fkGrade(CAT), -0.7);
  assert.equal(fkGrade(FRANKLIN), 4.8);
  assert.equal(fkGrade(HARD), 14.4);
});

test("fkGrade: null when there is nothing to grade", () => {
  assert.equal(fkGrade(""), null);
  assert.equal(fkGrade("1771 1772."), null);
});

// ---------------------------------------------------------------- textStats

test("textStats: counts and grade", () => {
  const s = textStats(CAT);
  assert.equal(s.fk, -0.7);
  assert.equal(s.words, 9);
  assert.equal(s.sentences, 2);
  assert.equal(s.avgSentence, 4.5);
});

test("textStats: empty text", () => {
  assert.deepEqual(textStats(""), { fk: null, words: 0, sentences: 0, avgSentence: 0 });
});
