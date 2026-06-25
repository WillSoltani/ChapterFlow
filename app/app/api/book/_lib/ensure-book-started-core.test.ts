// Regression coverage for A10: the first-book-start progress-init path must NOT throw
// a 500 progress_init_failed when the post-create re-read of a just-written BOOK_PROGRESS
// row comes back null (DynamoDB read-after-write under an eventually-consistent read, or
// a concurrent create that swallowed ConditionalCheckFailed).
//
// ensure-book-started.ts imports `server-only` + the AWS client at module load and can't
// be imported under `tsx --test`, so we exercise the pure resolveSeededProgress seam the
// route delegates to. BEFORE the fix the caller did `progress = readBack` then
// `if (!progress) throw BookApiError(500, "progress_init_failed")`; AFTER it does
// `progress = resolveSeededProgress(readBack, seed)`, which is total (never null).

import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveSeededProgress } from "./ensure-book-started-core";
import type { BookUserProgress } from "./types";

function makeSeed(overrides: Partial<BookUserProgress> = {}): BookUserProgress {
  return {
    userId: "user-1",
    bookId: "atomic-habits",
    pinnedBookVersion: 3,
    contentPrefix: "book-content/books/atomic-habits/v000003/",
    manifestKey: "book-content/books/atomic-habits/v000003/manifest.json",
    currentChapterNumber: 1,
    unlockedThroughChapterNumber: 1,
    completedChapters: [],
    bestScoreByChapter: {},
    lastOpenedAt: "2026-06-24T00:00:00.000Z",
    lastActiveAt: "2026-06-24T00:00:00.000Z",
    streakDays: 0,
    updatedAt: "2026-06-24T00:00:00.000Z",
    createdAt: "2026-06-24T00:00:00.000Z",
    ...overrides,
  };
}

test("A10: a null post-create re-read falls back to the seed (no progress_init_failed 500)", () => {
  const seed = makeSeed();
  // Simulates the eventually-consistent GetCommand missing the row we just wrote.
  const resolved = resolveSeededProgress(null, seed);
  assert.ok(resolved, "must return a non-null progress row instead of throwing 500");
  assert.equal(resolved, seed);
  assert.equal(resolved.bookId, "atomic-habits");
  assert.equal(resolved.currentChapterNumber, 1);
});

test("A10: the authoritative read-back row is preferred over the seed when present", () => {
  const seed = makeSeed();
  // A concurrent writer created the row and it already carries real progress; the
  // strongly-consistent read surfaces it. We must use the stored row, not the bare seed.
  const readBack = makeSeed({
    currentChapterNumber: 4,
    unlockedThroughChapterNumber: 4,
    completedChapters: [1, 2, 3],
    progressRev: 3,
  });
  const resolved = resolveSeededProgress(readBack, seed);
  assert.equal(resolved, readBack);
  assert.equal(resolved.currentChapterNumber, 4);
  assert.deepEqual(resolved.completedChapters, [1, 2, 3]);
});

test("A10: resolveSeededProgress is total — never returns null/undefined for any read result", () => {
  const seed = makeSeed();
  for (const readBack of [null, makeSeed({ currentChapterNumber: 2 })] as const) {
    const resolved = resolveSeededProgress(readBack, seed);
    assert.notEqual(resolved, null);
    assert.notEqual(resolved, undefined);
  }
});
