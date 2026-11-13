import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { runAuthorizedChapterHydration } from "@/app/app/api/book/_lib/initial-chapter-content-core";

// Ask-the-book reuses the reader's entitlement rule for "can open this book":
// Pro, or the book is one of the reader's unlocked (free-slot) books.
const allowed = (entitlement: Parameters<typeof runAuthorizedChapterHydration>[0]["entitlement"]) =>
  runAuthorizedChapterHydration({ entitlement, bookId: "book-a", load: async () => true }).then(
    (r) => r === true
  );

test("a Pro reader can ask about any book", async () => {
  assert.equal(await allowed({ plan: "PRO", unlockedBookIds: [] }), true);
});

test("a Free reader can ask about a book they unlocked", async () => {
  assert.equal(await allowed({ plan: "FREE", unlockedBookIds: ["book-a"] }), true);
});

test("a Free reader cannot ask about a book outside their unlocked books", async () => {
  assert.equal(await allowed({ plan: "FREE", unlockedBookIds: ["book-b"] }), false);
  assert.equal(await allowed(null), false);
});

// The route cannot be imported in a unit test (server-only + AWS clients), so pin
// its wiring at the source level: the access check runs before any book content
// is loaded or any question is counted.
const routeSrc = readFileSync(
  join(process.cwd(), "app/app/api/book/books/[bookId]/ask/route.ts"),
  "utf8"
);

test("ask route refuses books the reader cannot open, before loading content", () => {
  const accessAt = routeSrc.indexOf("runAuthorizedChapterHydration(");
  assert.ok(accessAt > 0, "ask route must use the shared book-access rule");
  assert.match(routeSrc, /"book_not_accessible"/);
  const loadAt = routeSrc.indexOf("getServerBookPackage(bookId");
  const countAt = routeSrc.indexOf("getAiQuestionCount(");
  assert.ok(loadAt > accessAt && countAt > accessAt, "access check must come first");
});
