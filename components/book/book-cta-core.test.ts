import assert from "node:assert/strict";
import { test } from "node:test";

import { bookCtaLabel, continueHref, resumeChapterNumber } from "./book-cta-core";

// D4 / C13: "Continue" opens the chapter it names.

test("resume chapter is the server's current chapter when known", () => {
  assert.equal(
    resumeChapterNumber({ currentChapterNumber: 4, chaptersCompleted: 2, chapterCount: 10 }),
    4,
  );
});

test("without a current chapter it falls back to completed + 1", () => {
  assert.equal(resumeChapterNumber({ chaptersCompleted: 3, chapterCount: 10 }), 4);
  assert.equal(
    resumeChapterNumber({ currentChapterNumber: null, chaptersCompleted: 0, chapterCount: 10 }),
    1,
  );
});

test("resume chapter is capped at the chapter count (and never below 1)", () => {
  assert.equal(resumeChapterNumber({ chaptersCompleted: 10, chapterCount: 10 }), 10);
  assert.equal(
    resumeChapterNumber({ currentChapterNumber: 14, chaptersCompleted: 2, chapterCount: 12 }),
    12,
  );
  assert.equal(resumeChapterNumber({ currentChapterNumber: 0, chaptersCompleted: 0, chapterCount: 0 }), 1);
});

test("the label names the same chapter the link opens", () => {
  const n = resumeChapterNumber({ currentChapterNumber: 7, chaptersCompleted: 6, chapterCount: 20 });
  const href = continueHref("atomic-habits", n);
  const label = bookCtaLabel(n);
  assert.equal(href, "/book/library/atomic-habits/chapter/7");
  assert.equal(label, "Continue chapter 7");
  assert.equal(href.split("/").at(-1), label.match(/\d+$/)?.[0]);
});

test("book ids are encoded in the link", () => {
  assert.equal(continueHref("a b", 2), "/book/library/a%20b/chapter/2");
});

// HOME-10: the book page hero and its phone sticky bar share one label.

test("a finished book says Review book", () => {
  assert.equal(bookCtaLabel(1, { allCompleted: true, started: true }), "Review book");
});

test("a started book says Continue chapter N", () => {
  assert.equal(bookCtaLabel(5, { allCompleted: false, started: true }), "Continue chapter 5");
});

test("a book not started says Start chapter N", () => {
  assert.equal(bookCtaLabel(1, { allCompleted: false, started: false }), "Start chapter 1");
});
