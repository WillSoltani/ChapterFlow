import { test } from "node:test";
import assert from "node:assert/strict";
import { getBookHref } from "./book-href";
import type { ActiveBook } from "./progressTypes";

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeBook(overrides: Partial<ActiveBook> = {}): ActiveBook {
  return {
    id: "atomic-habits",
    title: "Atomic Habits",
    author: "James Clear",
    coverUrl: "",
    totalChapters: 10,
    completedChapters: 0,
    currentChapterNumber: 1,
    currentChapterTitle: "Chapter 1",
    currentStep: "summary",
    currentStepNumber: 1,
    lastActivity: "",
    lastActivityDate: "",
    readersCount: 0,
    resumeChapterId: "atomic-habits-ch01",
    ...overrides,
  };
}

// ─── C13: Continue opens the resume chapter by number ─────────────────────────

test("getBookHref: opens the resume chapter by its number", () => {
  const href = getBookHref(makeBook({ completedChapters: 2, currentChapterNumber: 3 }));
  assert.equal(href, "/book/library/atomic-habits/chapter/3");
});

test("getBookHref: a started book still on the summary step opens chapter 1, not the book page", () => {
  const href = getBookHref(makeBook());
  assert.equal(href, "/book/library/atomic-habits/chapter/1");
});

test("getBookHref: does not depend on resumeChapterId being known locally", () => {
  const href = getBookHref(
    makeBook({ completedChapters: 3, currentChapterNumber: 4, currentStep: "quiz", resumeChapterId: "" })
  );
  assert.equal(href, "/book/library/atomic-habits/chapter/4");
});

// ─── G3: never build a malformed /chapter/ href ──────────────────────────────

test("getBookHref: falls back to the book page when there is no valid chapter number", () => {
  assert.equal(getBookHref(makeBook({ currentChapterNumber: 0 })), "/book/library/atomic-habits");
  assert.equal(getBookHref(makeBook({ currentChapterNumber: Number.NaN })), "/book/library/atomic-habits");
});
