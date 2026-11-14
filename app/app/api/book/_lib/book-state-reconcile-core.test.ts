import { test } from "node:test";
import assert from "node:assert/strict";

import {
  overlayProgressOnBookState,
  projectProgressToChapterIds,
} from "./book-state-reconcile-core";
import type { BookUserBookStateItem } from "./types";

// API-20: GET /me/books/{bookId}/state returned the stored projection as is,
// and only the web reader's PATCH refreshed it, so a chapter passed on another
// device could still read as locked or not completed there.

const chapters = [
  { number: 1, chapterId: "c1" },
  { number: 2, chapterId: "c2" },
  { number: 3, chapterId: "c3" },
  { number: 4, chapterId: "c4" },
];

function storedState(overrides: Partial<BookUserBookStateItem> = {}): BookUserBookStateItem {
  return {
    userId: "user-1",
    bookId: "book-1",
    currentChapterId: "c2",
    completedChapterIds: ["c1"],
    unlockedChapterIds: ["c1", "c2"],
    chapterScores: { c1: 80 },
    chapterCompletedAt: { c1: "2026-01-02T00:00:00.000Z" },
    lastReadChapterId: "c2",
    lastOpenedAt: "2026-01-03T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-03T00:00:00.000Z",
    ...overrides,
  };
}

test("projectProgressToChapterIds maps progress numbers to chapter ids", () => {
  assert.deepEqual(
    projectProgressToChapterIds(
      { completedChapters: [1, 2], unlockedThroughChapterNumber: 3, bestScoreByChapter: { 1: 80, 2: 90 } },
      chapters
    ),
    {
      completedChapterIds: ["c1", "c2"],
      unlockedChapterIds: ["c1", "c2", "c3"],
      chapterScores: { c1: 80, c2: 90 },
    }
  );
});

test("projectProgressToChapterIds drops numbers the manifest does not have", () => {
  const projected = projectProgressToChapterIds(
    { completedChapters: [1, 9], unlockedThroughChapterNumber: 1, bestScoreByChapter: { 9: 70 } },
    chapters
  );
  assert.deepEqual(projected.completedChapterIds, ["c1"]);
  assert.deepEqual(projected.chapterScores, {});
});

test("projectProgressToChapterIds without progress unlocks only the first chapter", () => {
  assert.deepEqual(projectProgressToChapterIds(null, chapters), {
    completedChapterIds: [],
    unlockedChapterIds: ["c1"],
    chapterScores: {},
  });
});

test("overlay shows a chapter passed elsewhere as completed, unlocked and scored", () => {
  const result = overlayProgressOnBookState(
    storedState(),
    { completedChapters: [1, 2], unlockedThroughChapterNumber: 3, bestScoreByChapter: { 1: 80, 2: 95 } },
    chapters
  );
  assert.deepEqual(result.completedChapterIds, ["c1", "c2"]);
  assert.deepEqual(result.unlockedChapterIds, ["c1", "c2", "c3"]);
  assert.deepEqual(result.chapterScores, { c1: 80, c2: 95 });
});

test("overlay keeps the reader's own UI fields", () => {
  const stored = storedState();
  const result = overlayProgressOnBookState(
    stored,
    { completedChapters: [1, 2], unlockedThroughChapterNumber: 3, bestScoreByChapter: {} },
    chapters
  );
  assert.equal(result.currentChapterId, stored.currentChapterId);
  assert.equal(result.lastReadChapterId, stored.lastReadChapterId);
  assert.equal(result.lastOpenedAt, stored.lastOpenedAt);
  assert.deepEqual(result.chapterCompletedAt, stored.chapterCompletedAt);
  assert.equal(result.createdAt, stored.createdAt);
  assert.equal(result.updatedAt, stored.updatedAt);
});

test("overlay leaves the stored state alone without a progress row or chapter list", () => {
  const stored = storedState();
  assert.deepEqual(overlayProgressOnBookState(stored, null, chapters), stored);
  assert.deepEqual(
    overlayProgressOnBookState(
      stored,
      { completedChapters: [1, 2, 3], unlockedThroughChapterNumber: 4, bestScoreByChapter: {} },
      []
    ),
    stored
  );
});
