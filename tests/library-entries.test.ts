import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildEntries,
  type DashboardCatalogPayload,
} from "@/hooks/book/useLibraryCatalogData";
import type { LibraryCatalogBook } from "@/lib/library-data";

// D3 / C5: a book is "started" when a chapter was completed, or a progress row
// or a chapter-state row exists. A book-state row alone (written by older
// clients when the book page was only viewed) does not make a book started.

function book(id: string): LibraryCatalogBook {
  return {
    id,
    title: `Title ${id}`,
    author: "Author",
    categories: ["Psychology"],
    category: "Psychology",
    tags: [],
    synopsis: "A synopsis.",
    difficulty: "Medium",
    chapterCount: 10,
    estimatedMinutes: 120,
  } as unknown as LibraryCatalogBook;
}

function bookState(bookId: string, completedChapterIds: string[] = []) {
  return {
    bookId,
    currentChapterId: `${bookId}-ch01`,
    completedChapterIds,
    unlockedChapterIds: [`${bookId}-ch01`],
    chapterScores: {},
    chapterCompletedAt: {},
    lastReadChapterId: `${bookId}-ch01`,
    lastOpenedAt: "2026-11-12T10:00:00.000Z",
    updatedAt: "2026-11-12T10:00:00.000Z",
  };
}

function payload(overrides: Partial<DashboardCatalogPayload>): DashboardCatalogPayload {
  return {
    catalog: [book("a")],
    progress: [],
    bookStates: [],
    chapterStates: [],
    ...overrides,
  };
}

function statusOf(p: DashboardCatalogPayload, id = "a") {
  return buildEntries(p).find((entry) => entry.id === id)?.status;
}

test("a book-state row alone (book page only viewed) stays not started", () => {
  assert.equal(statusOf(payload({ bookStates: [bookState("a")] })), "not_started");
});

test("no rows at all is not started", () => {
  assert.equal(statusOf(payload({})), "not_started");
});

test("a progress row makes the book in progress", () => {
  assert.equal(
    statusOf(
      payload({
        progress: [
          {
            bookId: "a",
            currentChapterNumber: 1,
            unlockedThroughChapterNumber: 1,
            completedChapters: [],
            bestScoreByChapter: {},
          },
        ],
      }),
    ),
    "in_progress",
  );
});

test("a chapter-state row makes the book in progress", () => {
  assert.equal(
    statusOf(
      payload({
        bookStates: [bookState("a")],
        chapterStates: [{ bookId: "a", chapterNumber: 1 }],
      }),
    ),
    "in_progress",
  );
});

test("a completed chapter makes the book in progress", () => {
  assert.equal(
    statusOf(payload({ bookStates: [bookState("a", ["a-ch01"])] })),
    "in_progress",
  );
});

test("another book's chapter-state row does not start this book", () => {
  assert.equal(
    statusOf(
      payload({
        catalog: [book("a"), book("b")],
        chapterStates: [{ bookId: "b", chapterNumber: 1 }],
      }),
    ),
    "not_started",
  );
});

test("Continue opens the server's current chapter and names it (C13)", () => {
  const entry = buildEntries(
    payload({
      progress: [
        {
          bookId: "a",
          currentChapterNumber: 4,
          unlockedThroughChapterNumber: 4,
          completedChapters: [1, 2],
          bestScoreByChapter: {},
        },
      ],
    }),
  )[0];
  assert.equal(entry?.resumeChapterNumber, 4);
  assert.equal(entry?.continueHref, "/book/library/a/chapter/4");
});

test("without a progress row Continue falls back to completed + 1, capped", () => {
  const entry = buildEntries(
    payload({ bookStates: [bookState("a", ["a-ch01", "a-ch02", "a-ch03"])] }),
  )[0];
  assert.equal(entry?.resumeChapterNumber, 4);
  const done = buildEntries(
    payload({
      bookStates: [bookState("a", Array.from({ length: 10 }, (_, i) => `a-ch${i + 1}`))],
    }),
  )[0];
  assert.equal(done?.resumeChapterNumber, 10);
});
