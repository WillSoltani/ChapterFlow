import assert from "node:assert/strict";
import { test } from "node:test";
import { CATALOG_BOOK_COUNT } from "@/lib/catalog-stats";
import {
  ALL_BOOKS,
  filterAndSortBooks,
  getBookBadge,
  resultCountLabel,
  sortBooks,
  type LibraryBook,
} from "./browse-library-core";

const books: LibraryBook[] = [
  { id: "z", title: "Zulu", author: "Ada", category: "Focus", chapters: 5, difficulty: "easy", estimatedHours: 5, description: "Z" },
  { id: "a", title: "Alpha", author: "Bob", category: "Focus", chapters: 5, difficulty: "medium", estimatedHours: 2, description: "A", popular: true },
  { id: "b", title: "Beta", author: "Cara", category: "Leadership", chapters: 5, difficulty: "hard", estimatedHours: 3, description: "B", popular: true, isNew: true },
  { id: "g", title: "Gamma", author: "Dan", category: "Focus", chapters: 5, difficulty: "easy", estimatedHours: 3, description: "G", isNew: true },
];

test("query and category filters compose case-insensitively", () => {
  assert.deepEqual(
    filterAndSortBooks(books, { category: "Focus", query: "ADA", sort: "alphabetical" }).map((book) => book.id),
    ["z"],
  );
});

test("every sort mode preserves its ordering contract", () => {
  assert.deepEqual(sortBooks(books, "popular").map((book) => book.id), ["a", "b", "g", "z"]);
  assert.deepEqual(sortBooks(books, "newest").map((book) => book.id), ["b", "g", "a", "z"]);
  assert.deepEqual(sortBooks(books, "shortest").map((book) => book.id), ["a", "b", "g", "z"]);
  assert.deepEqual(sortBooks(books, "alphabetical").map((book) => book.id), ["a", "b", "g", "z"]);
});

test("curated ties use the existing forward-alphabetical fallback", () => {
  const curated = books.filter((book) => book.popular);
  assert.deepEqual(sortBooks(curated, "popular").map((book) => book.id), ["a", "b"]);
});

test("filtering and sorting never mutate their input", () => {
  const before = books.map((book) => book.id);
  sortBooks(books, "shortest");
  filterAndSortBooks(books, { category: "Focus", query: "", sort: "popular" });
  assert.deepEqual(books.map((book) => book.id), before);
});

test("public catalog badges share the single Recall accent", () => {
  for (const book of [
    { ...books[0]!, isFree: true },
    { ...books[0]!, isNew: true },
    { ...books[0]!, popular: true },
    { ...books[0]!, staffPick: true },
  ]) {
    assert.equal(getBookBadge(book)?.color, "var(--accent-cyan)");
  }
});

test("the result count is exact for a filtered view and never prints the catalog size", () => {
  assert.equal(ALL_BOOKS.length, CATALOG_BOOK_COUNT);
  assert.equal(resultCountLabel(ALL_BOOKS.length), "Showing all titles");
  assert.equal(resultCountLabel(1), "Showing 1 title");
  assert.equal(resultCountLabel(12), "Showing 12 titles");
  for (const n of [0, 1, 12, ALL_BOOKS.length - 1, ALL_BOOKS.length]) {
    assert.doesNotMatch(resultCountLabel(n), new RegExp(`\\b${CATALOG_BOOK_COUNT}\\b`));
  }
});
