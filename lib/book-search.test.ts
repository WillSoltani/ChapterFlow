import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeQuery, matchesBookQuery, type SearchableBook } from "./book-search";

const book: SearchableBook = {
  title: "Atomic Habits",
  author: "James Clear",
  category: "Productivity",
  categories: ["Self-Help", "Psychology"],
};

test("normalizeQuery trims and lowercases", () => {
  assert.equal(normalizeQuery("  Atomic  "), "atomic");
  assert.equal(normalizeQuery("JAMES"), "james");
});

test("an empty query matches everything", () => {
  assert.equal(matchesBookQuery(book, ""), true);
});

test("matches across title, author, category and categories (case-insensitive)", () => {
  assert.equal(matchesBookQuery(book, normalizeQuery("atomic")), true);
  assert.equal(matchesBookQuery(book, normalizeQuery("Clear")), true);
  assert.equal(matchesBookQuery(book, normalizeQuery("productivity")), true);
  assert.equal(matchesBookQuery(book, normalizeQuery("psychology")), true);
});

test("a query present in no field returns false", () => {
  assert.equal(matchesBookQuery(book, normalizeQuery("finance")), false);
});

test("extra haystack fields participate in the match", () => {
  assert.equal(
    matchesBookQuery(book, normalizeQuery("tiny gains"), "build tiny gains"),
    true,
  );
});

test("null/undefined fields are tolerated without throwing", () => {
  const sparse: SearchableBook = {
    title: null,
    author: undefined,
    category: null,
    categories: null,
  };
  assert.equal(matchesBookQuery(sparse, normalizeQuery("anything")), false);
});
