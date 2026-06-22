import { test } from "node:test";
import assert from "node:assert/strict";
// The pure helper lives next to its only consumer
// (components/landing/recall/book-filter.ts), but `npm test` only globs app/ +
// lib/, so the test lives here and imports that runtime-dependency-free module
// (same pattern as lib/retention-loop-phase.test.ts).
import {
  filterBooks,
  deriveCategories,
} from "@/components/landing/recall/book-filter";

const BOOKS = [
  { title: "Atomic Habits", author: "James Clear", category: "Productivity" },
  { title: "Deep Work", author: "Cal Newport", category: "Productivity" },
  { title: "Mindset", author: "Carol Dweck", category: "Self-Help" },
  { title: "Grit", author: "Angela Duckworth", category: "Self Improvement" },
];

test("deriveCategories returns distinct CANONICAL categories, sorted", () => {
  // "Self-Help" and "Self Improvement" canonicalize to the same bucket → one chip.
  assert.deepEqual(deriveCategories(BOOKS), ["Productivity", "Self Improvement"]);
});

test("filterBooks: empty query + null category returns everything", () => {
  assert.equal(filterBooks(BOOKS, "", null).length, BOOKS.length);
  assert.equal(filterBooks(BOOKS, "   ", null).length, BOOKS.length);
});

test("filterBooks: query matches title (case-insensitive, trimmed)", () => {
  const r = filterBooks(BOOKS, "  ATOMIC  ", null);
  assert.deepEqual(
    r.map((b) => b.title),
    ["Atomic Habits"],
  );
});

test("filterBooks: query matches author", () => {
  const r = filterBooks(BOOKS, "newport", null);
  assert.deepEqual(
    r.map((b) => b.title),
    ["Deep Work"],
  );
});

test("filterBooks: category filter uses canonical form (folds Self-Help)", () => {
  const r = filterBooks(BOOKS, "", "Self Improvement");
  assert.deepEqual(
    r.map((b) => b.title).sort(),
    ["Grit", "Mindset"],
  );
});

test("filterBooks: category + query compose", () => {
  assert.deepEqual(
    filterBooks(BOOKS, "deep", "Productivity").map((b) => b.title),
    ["Deep Work"],
  );
  // query matches a book outside the chosen category → no results
  assert.equal(filterBooks(BOOKS, "grit", "Productivity").length, 0);
});

test("filterBooks: no match returns [] (drives the request empty-state)", () => {
  assert.deepEqual(filterBooks(BOOKS, "nonexistent-zzz", null), []);
});

test("filterBooks: preserves input order", () => {
  assert.deepEqual(
    filterBooks(BOOKS, "", "Productivity").map((b) => b.title),
    ["Atomic Habits", "Deep Work"],
  );
});
