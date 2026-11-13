import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { installRouteHarness } from "@/tests/_lib/route-harness";

// SHELL-18: the chapter tab names the chapter and the book.
const book = {
  bookId: "atomic-habits",
  title: "Atomic Habits",
  chapters: [
    { id: "ch-1", chapterId: "ch-1", number: 1, title: "The Surprising Power" },
    { id: "ch-2", chapterId: "ch-2", number: 2, title: "How Habits Shape Identity" },
  ],
};
let bookResult: unknown = book;

const harness = installRouteHarness({
  "@/app/_lib/require-dashboard-access": { requireDashboardAccess: async () => ({}) },
  "@/app/app/api/_lib/auth": {
    requireUser: async () => {
      throw new Error("no session");
    },
  },
  "@/app/app/api/book/_lib/env": {
    getBookTableName: async () => "table",
    getBookContentBucket: async () => "bucket",
  },
  "@/app/app/api/book/_lib/errors": { BookApiError: class BookApiError extends Error {} },
  "@/app/app/api/book/_lib/library-catalog": {
    getPublishedLibraryBookDetail: async () => bookResult,
  },
  "@/app/app/api/book/_lib/initial-chapter-content": { loadInitialChapterContent: async () => null },
  "@/app/app/api/book/_lib/user-settings-repo": { getUserSettingsItem: async () => null },
  "@/app/book/library/[bookId]/chapter/[chapterId]/ChapterReaderClient": {
    ChapterReaderClient: () => null,
  },
});

let generateMetadata: typeof import("./page").generateMetadata;

before(async () => {
  ({ generateMetadata } = await import("./page"));
});

after(() => harness.restore());

const params = (chapterId: string) => ({
  params: Promise.resolve({ bookId: "atomic-habits", chapterId }),
});

test("the tab title is the chapter title and the book title", async () => {
  bookResult = book;
  assert.deepEqual(await generateMetadata(params("ch-2")), {
    title: "How Habits Shape Identity · Atomic Habits",
  });
  assert.deepEqual(await generateMetadata(params("1")), {
    title: "The Surprising Power · Atomic Habits",
  });
});

test("an unknown book or chapter keeps the default title", async () => {
  bookResult = book;
  assert.deepEqual(await generateMetadata(params("ch-9")), {});
  bookResult = null;
  assert.deepEqual(await generateMetadata(params("ch-2")), {});
});
