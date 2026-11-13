import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { installRouteHarness, makeSpy } from "@/tests/_lib/route-harness";

// SHELL-18 (Rule 10): plain page titles; app/book/layout.tsx adds "| ChapterFlow".

const getPublishedLibraryBookDetail = makeSpy(async ({ bookId }: { bookId: string }) =>
  bookId === "atomic-habits" ? { id: bookId, title: "Atomic Habits" } : null,
);

const harness = installRouteHarness({
  "@/app/_lib/require-dashboard-access": { requireDashboardAccess: async () => ({}) },
  "@/app/app/api/book/_lib/env": {
    getBookTableName: async () => "table",
    getBookContentBucket: async () => "bucket",
  },
  "@/app/app/api/book/_lib/library-catalog": { getPublishedLibraryBookDetail },
  "@/components/library/LibraryPage": { LibraryPage: () => null },
  "@/app/book/saved/SavedBooksClient": { SavedBooksClient: () => null },
  "@/app/book/library/[bookId]/BookDetailClient": { BookDetailClient: () => null },
});

type Meta = { title?: unknown };
let library: { metadata?: Meta };
let saved: { metadata?: Meta };
let detail: {
  generateMetadata?: (props: { params: Promise<{ bookId: string }> }) => Promise<Meta>;
};

before(async () => {
  library = await import("@/app/book/library/page");
  saved = await import("@/app/book/saved/page");
  detail = await import("@/app/book/library/[bookId]/page");
});

after(() => harness.restore());

test("the Library tab is titled Library", () => {
  assert.equal(library.metadata?.title, "Library");
});

test("the Read Next tab is titled Read Next", () => {
  assert.equal(saved.metadata?.title, "Read Next");
});

test("the book page tab is titled with the book's title", async () => {
  const meta = await detail.generateMetadata?.({
    params: Promise.resolve({ bookId: "atomic-habits" }),
  });
  assert.equal(meta?.title, "Atomic Habits");
});

test("an unknown book gets no custom title (the page shows not found)", async () => {
  const meta = await detail.generateMetadata?.({
    params: Promise.resolve({ bookId: "missing" }),
  });
  assert.equal(meta?.title, undefined);
});
