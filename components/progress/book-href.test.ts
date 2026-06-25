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

// ─── G3: empty resumeChapterId must not build a malformed /chapter/ href ──────

test("getBookHref: deep-links to the resume chapter when resumeChapterId is present and the user has progressed", () => {
  const href = getBookHref(
    makeBook({ completedChapters: 2, resumeChapterId: "atomic-habits-ch03" })
  );
  assert.equal(href, "/book/library/atomic-habits/chapter/atomic-habits-ch03");
});

test("getBookHref: deep-links when past the summary step even with zero completed chapters", () => {
  const href = getBookHref(
    makeBook({ currentStep: "quiz", resumeChapterId: "atomic-habits-ch01" })
  );
  assert.equal(href, "/book/library/atomic-habits/chapter/atomic-habits-ch01");
});

test("getBookHref: falls back to the book detail page when resumeChapterId is empty even though the user has progressed", () => {
  const href = getBookHref(
    makeBook({ completedChapters: 3, currentStep: "quiz", resumeChapterId: "" })
  );
  // Before the fix this returned "/book/library/atomic-habits/chapter/" — a
  // malformed URL with an empty chapter segment.
  assert.equal(href, "/book/library/atomic-habits");
});

test("getBookHref: book detail page for a fresh book still on the summary step", () => {
  const href = getBookHref(makeBook());
  assert.equal(href, "/book/library/atomic-habits");
});
