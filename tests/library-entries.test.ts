import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildEntries,
  type DashboardCatalogPayload,
} from "@/hooks/book/useLibraryCatalogData";
import type { LibraryCatalogBook } from "@/lib/library-data";
import {
  buildLibraryBookFromCatalog,
  chaptersLeft,
  isInProgress,
  similarRecommendations,
} from "@/components/library/libraryData";

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

// HOME-26: the finished-shelf date is when the last chapter was completed,
// not when the book was last opened.

test("completedAt is the latest chapter completion time", () => {
  const state = {
    ...bookState("a", ["a-ch01", "a-ch02"]),
    chapterCompletedAt: {
      "a-ch01": "2026-11-10T09:00:00.000Z",
      "a-ch02": "2026-11-12T09:00:00.000Z",
    },
    lastOpenedAt: "2026-12-03T09:00:00.000Z",
  };
  const entry = buildEntries(payload({ bookStates: [state] }))[0];
  assert.equal(entry?.completedAt, "2026-11-12T09:00:00.000Z");
});

test("without completion stamps completedAt is left unset", () => {
  const entry = buildEntries(payload({ bookStates: [bookState("a", ["a-ch01"])] }))[0];
  assert.equal(entry?.completedAt, undefined);
});

function finishedEntry(lastOpenedAt: string, completedAt?: string) {
  const ids = Array.from({ length: 10 }, (_, i) => `a-ch${i + 1}`);
  const state = {
    ...bookState("a", ids),
    chapterCompletedAt: completedAt ? { "a-ch10": completedAt } : {},
    lastOpenedAt,
  };
  return buildEntries(payload({ bookStates: [state] }))[0]!;
}

test("the Library card shows the completion date, not the last visit", () => {
  const entry = finishedEntry("2026-12-03T09:00:00.000Z", "2026-11-12T09:00:00.000Z");
  const ui = buildLibraryBookFromCatalog(book("a"), entry);
  assert.equal(ui.userProgress?.completedAt?.toISOString(), "2026-11-12T09:00:00.000Z");
});

test("a finished book without stamps keeps the last-activity date", () => {
  const entry = finishedEntry("2026-12-03T09:00:00.000Z");
  const ui = buildLibraryBookFromCatalog(book("a"), entry);
  assert.equal(ui.userProgress?.completedAt?.toISOString(), "2026-12-03T09:00:00.000Z");
});

// HOME-28: chapters left = total − completed (9 of 10 done → 1 left, not 0).

test("on the last chapter one chapter is left", () => {
  const ids = Array.from({ length: 9 }, (_, i) => `a-ch${i + 1}`);
  const entry = buildEntries(payload({ bookStates: [bookState("a", ids)] }))[0]!;
  const ui = buildLibraryBookFromCatalog(book("a"), entry);
  assert.equal(ui.userProgress?.currentChapter, 10);
  assert.equal(chaptersLeft(ui), 1);
});

test("a book not started has every chapter left", () => {
  const ui = buildLibraryBookFromCatalog(book("a"));
  assert.equal(chaptersLeft(ui), 10);
});

// HOME-28 (Library filter): a started book counts as in progress even at 0%.

test("a started book at 0% is in progress", () => {
  const entry = buildEntries(
    payload({ chapterStates: [{ bookId: "a", chapterNumber: 1 }] }),
  )[0]!;
  const ui = buildLibraryBookFromCatalog(book("a"), entry);
  assert.equal(ui.userProgress?.percentComplete, 0);
  assert.equal(isInProgress(ui), true);
  assert.equal(isInProgress(buildLibraryBookFromCatalog(book("a"))), false);
  assert.equal(isInProgress(buildLibraryBookFromCatalog(book("a"), finishedEntry("2026-11-12T09:00:00.000Z"))), false);
});

// HOME-26: "Because you loved X" never suggests a book already being read.

test("similar picks skip books already started or finished", () => {
  const finished = buildLibraryBookFromCatalog(book("a"), finishedEntry("2026-11-12T09:00:00.000Z"));
  const reading = buildLibraryBookFromCatalog(
    book("b"),
    buildEntries(payload({ catalog: [book("b")], chapterStates: [{ bookId: "b", chapterNumber: 1 }] }))[0],
  );
  const fresh = buildLibraryBookFromCatalog(book("c"));
  const booksById = new Map([
    ["b", reading],
    ["c", fresh],
  ]);
  assert.deepEqual(
    similarRecommendations([{ ...finished, similarBookId: "b" }], booksById),
    [],
  );
  assert.deepEqual(
    similarRecommendations([{ ...finished, similarBookId: "c" }], booksById).map((r) => r.book.id),
    ["c"],
  );
});
