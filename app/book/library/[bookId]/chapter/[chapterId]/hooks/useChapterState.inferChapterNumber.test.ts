import { test } from "node:test";
import assert from "node:assert/strict";
import { inferChapterNumber } from "./useChapterState";

// G6: inferChapterNumber must derive the chapter from the `-ch<NN>` suffix, not
// the first digit run anywhere in the id. Books whose bookId contains a number
// (e.g. "the-5-am-club", "12-rules-for-life") previously inferred the digit
// from the bookId instead of the chapter number.

test("standard id without digits in the bookId resolves the chapter suffix", () => {
  assert.equal(inferChapterNumber("atomic-habits-ch02"), 2);
  assert.equal(inferChapterNumber("atomic-habits-ch01"), 1);
  assert.equal(inferChapterNumber("atomic-habits-ch10"), 10);
});

test("bookId containing a leading digit does not poison the chapter number", () => {
  // Before the fix the first digit run (5) was returned for every chapter.
  assert.equal(inferChapterNumber("the-5-am-club-ch01"), 1);
  assert.equal(inferChapterNumber("the-5-am-club-ch03"), 3);
});

test("bookId starting with a number resolves the real chapter suffix", () => {
  assert.equal(inferChapterNumber("12-rules-for-life-ch04"), 4);
  assert.equal(inferChapterNumber("48-laws-of-power-ch12"), 12);
});

test("zero-padded suffix is parsed numerically", () => {
  assert.equal(inferChapterNumber("the-7-habits-ch007"), 7);
});

test("uppercase CH suffix is matched case-insensitively", () => {
  assert.equal(inferChapterNumber("some-book-CH05"), 5);
});

test("falls back to 1 when no usable digits are present", () => {
  assert.equal(inferChapterNumber("intro"), 1);
});
