import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BOOK_RATINGS,
  RATINGS_SOURCE_LABEL,
  formatAttributedRatingsCount,
  formatRatingsCount,
  getBookRating,
} from "./bookRatings";
import catalogMetadata from "@/lib/books-catalog.metadata.json";

// The numbers in bookRatings.ts are a curated Goodreads snapshot, not in-app
// reader ratings. The attribution helper is the single chokepoint that keeps
// every render site honest, so pin its copy here.

test("formatRatingsCount renders compact magnitudes", () => {
  assert.equal(formatRatingsCount(1_180_000), "1.2M");
  assert.equal(formatRatingsCount(92_000), "92k");
  assert.equal(formatRatingsCount(500), "500");
  // 999_500 rounds up to "1.0M", not "1000k".
  assert.equal(formatRatingsCount(999_500), "1.0M");
});

test("RATINGS_SOURCE_LABEL names Goodreads as the source", () => {
  assert.equal(RATINGS_SOURCE_LABEL, "Goodreads");
});

test("formatAttributedRatingsCount always names the source", () => {
  assert.equal(formatAttributedRatingsCount(1_180_000), "1.2M ratings on Goodreads");
  assert.equal(formatAttributedRatingsCount(92_000), "92k ratings on Goodreads");
  assert.equal(formatAttributedRatingsCount(4_200), "4k ratings on Goodreads");
});

test("attributed string never implies an in-app/community reader score", () => {
  const s = formatAttributedRatingsCount(205_000).toLowerCase();
  assert.ok(s.includes("goodreads"), "must attribute Goodreads");
  assert.ok(!s.includes("reader rating"), "must not imply in-app reader ratings");
  assert.ok(!s.includes("chapterflow"), "must not imply a ChapterFlow community score");
});

// Regression coverage for the "Getting-Things-Done" key-casing defect (H9b,
// sibling of H9 / #354). getBookRating(bookId) looks up BOOK_RATINGS by the
// canonical catalog id, which is always kebab-case (`snap.book.id`). A
// capitalized `"Getting-Things-Done"` key was therefore unreachable, so Getting
// Things Done rendered with NO rating stars (the entry silently never matched).

const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const CATALOG_BOOK_IDS = new Set(
  (catalogMetadata as ReadonlyArray<{ id?: string }>)
    .map((b) => b.id)
    .filter((id): id is string => typeof id === "string" && id.length > 0)
);

test("every BOOK_RATINGS key is a kebab-case, known catalog bookId", () => {
  // getBookRating is only ever called with the canonical kebab-case bookId
  // (snap.book.id). A non-kebab key — e.g. the capitalized "Getting-Things-Done"
  // — is dead: the book renders without stars. A kebab key that names no catalog
  // book is also unreachable.
  for (const key of Object.keys(BOOK_RATINGS)) {
    assert.ok(
      KEBAB_CASE.test(key),
      `rating key "${key}" is not kebab-case — it will never match a canonical bookId`
    );
    assert.ok(
      CATALOG_BOOK_IDS.has(key),
      `rating key "${key}" matches no catalog bookId — the rating is unreachable`
    );
  }
});

test("getBookRating resolves the curated Getting Things Done snapshot", () => {
  // The lookup uses the canonical lowercase id; before the fix the capitalized
  // key made this return null and the stars never rendered.
  const rating = getBookRating("getting-things-done");
  assert.ok(rating, "getting-things-done must resolve a curated rating");
  assert.equal(rating!.rating, 3.98);
  assert.equal(rating!.ratingsCount, 150_000);
});

test("the unreachable capitalized Getting-Things-Done key is gone", () => {
  assert.equal(
    Object.prototype.hasOwnProperty.call(BOOK_RATINGS, "Getting-Things-Done"),
    false,
    "capitalized key must be removed — it can never match snap.book.id"
  );
});
