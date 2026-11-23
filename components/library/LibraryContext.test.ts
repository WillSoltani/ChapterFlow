import assert from "node:assert/strict";
import { test } from "node:test";

import {
  computeProLocked,
  freeCaptionFor,
  freeStartsLeft,
  freeWithPlanLabel,
  isFreeLimitLocked,
} from "./LibraryContext";
import type { LibraryBook } from "./libraryData";
import type { FreeBookAllowance } from "@/hooks/book/useFreeBookAllowance";

// D7: a free reader with free books left sees "Free with your plan (N left)"
// instead of a Pro lock; the lock appears only once no free starts remain.

function book(overrides: Partial<LibraryBook> = {}): LibraryBook {
  return {
    id: "book-a",
    title: "Book A",
    author: "Author",
    isPro: true,
    ...overrides,
  } as LibraryBook;
}

const free = (remainingFreeStarts: number, unlockedBookIds: string[] = []): FreeBookAllowance => ({
  plan: "FREE",
  remainingFreeStarts,
  unlockedBookIds,
});

test("free reader with slots left: no lock, caption with the count", () => {
  assert.equal(computeProLocked(book(), free(2)), false);
  assert.equal(freeStartsLeft("book-a", free(2)), 2);
  assert.equal(freeWithPlanLabel(2), "Free with your plan (2 left)");
});

test("free reader with no slots left: locked, no caption", () => {
  assert.equal(computeProLocked(book(), free(0)), true);
  assert.equal(freeStartsLeft("book-a", free(0)), null);
});

test("an unlocked book is never locked and needs no caption", () => {
  assert.equal(computeProLocked(book(), free(0, ["book-a"])), false);
  assert.equal(freeStartsLeft("book-a", free(2, ["book-a"])), null);
});

test("a book being read is never locked", () => {
  const started = book({
    userProgress: {
      currentChapter: 2,
      percentComplete: 10,
      lastReadAt: new Date(0),
      isCompleted: false,
    },
  } as Partial<LibraryBook>);
  assert.equal(computeProLocked(started, free(0)), false);
});

test("Pro readers: no lock, no caption", () => {
  const pro: FreeBookAllowance = { plan: "PRO", remainingFreeStarts: 0, unlockedBookIds: [] };
  assert.equal(computeProLocked(book(), pro), false);
  assert.equal(freeStartsLeft("book-a", pro), null);
});

test("unknown allowance (loading or failed): neither lock nor label", () => {
  assert.equal(computeProLocked(book(), null), false);
  assert.equal(freeStartsLeft("book-a", null), null);
});

test("Home cards: badge only when no free books are left, caption while some are", () => {
  assert.equal(isFreeLimitLocked("book-a", free(2)), false);
  assert.equal(freeCaptionFor("book-a", free(2)), "Free with your plan (2 left)");
  assert.equal(isFreeLimitLocked("book-a", free(0)), true);
  assert.equal(freeCaptionFor("book-a", free(0)), null);
  assert.equal(isFreeLimitLocked("book-a", null), false);
  assert.equal(freeCaptionFor("book-a", null), null);
});
