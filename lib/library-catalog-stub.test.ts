import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MIN_REAL_CHAPTER_COUNT,
  isStubChapterCount,
  isStubCatalogEntry,
  findStubCatalogEntries,
  assertNoStubCatalogEntries,
  type CatalogStubCandidate,
} from "./library-catalog-stub";

// --- isStubChapterCount (the load-bearing index-build signal) --------------

test("isStubChapterCount flags counts below the real-book floor", () => {
  assert.equal(isStubChapterCount(0), true);
  assert.equal(isStubChapterCount(1), true); // the exact "1 chapter" symptom
  assert.equal(isStubChapterCount(MIN_REAL_CHAPTER_COUNT - 1), true);
});

test("isStubChapterCount accepts a real multi-chapter count", () => {
  assert.equal(isStubChapterCount(MIN_REAL_CHAPTER_COUNT), false);
  assert.equal(isStubChapterCount(3), false); // live catalog minimum
  assert.equal(isStubChapterCount(38), false); // live catalog maximum
});

test("isStubChapterCount rejects non-finite / negative counts defensively", () => {
  assert.equal(isStubChapterCount(Number.NaN), true);
  assert.equal(isStubChapterCount(Number.POSITIVE_INFINITY), true);
  assert.equal(isStubChapterCount(-5), true);
});

// --- isStubCatalogEntry ----------------------------------------------------

test("a real multi-chapter book is NOT a stub", () => {
  const meditations: CatalogStubCandidate = { bookId: "meditations", chapterCount: 12 };
  assert.equal(isStubCatalogEntry(meditations), false);
});

test("a degenerate 1-chapter / 0-chapter package IS a stub", () => {
  assert.equal(isStubCatalogEntry({ bookId: "one-chapter", chapterCount: 1 }), true);
  assert.equal(isStubCatalogEntry({ bookId: "zero-chapter", chapterCount: 0 }), true);
});

// --- findStubCatalogEntries / assertNoStubCatalogEntries -------------------

test("assertNoStubCatalogEntries passes for an all-real catalog", () => {
  // Mirrors buildCatalog's output shape: chapterCount = pkg.chapters.length.
  const realCatalog: CatalogStubCandidate[] = [
    { bookId: "meditations", chapterCount: 12 },
    { bookId: "mindset", chapterCount: 8 },
    { bookId: "the-7-habits", chapterCount: 11 },
  ];
  assert.equal(findStubCatalogEntries(realCatalog).length, 0);
  assert.doesNotThrow(() => assertNoStubCatalogEntries(realCatalog));
});

test("assertNoStubCatalogEntries throws and names every offending bookId", () => {
  const mixed: CatalogStubCandidate[] = [
    { bookId: "real-book", chapterCount: 12 },
    { bookId: "stub-one", chapterCount: 1 },
    { bookId: "stub-zero", chapterCount: 0 },
  ];
  assert.equal(findStubCatalogEntries(mixed).length, 2);
  assert.throws(
    () => assertNoStubCatalogEntries(mixed),
    (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      assert.match(message, /stub-one/);
      assert.match(message, /stub-zero/);
      assert.doesNotMatch(message, /real-book/);
      return true;
    }
  );
});

test("assertNoStubCatalogEntries accepts extra fields (structural superset typing)", () => {
  // buildCatalog passes full LibraryCatalogIndexBook rows; only bookId+chapterCount
  // are read, so a real seed row with all its presentation fields must pass.
  const seedRows = [
    { bookId: "drive", chapterCount: 9, synopsis: "Real synopsis.", estimatedMinutes: 84, icon: "📘" },
  ];
  assert.doesNotThrow(() => assertNoStubCatalogEntries(seedRows));
});

// --- List-path floor behavior (documents the DI-4 symptom and its fix) -----
//
// Mirrors the chapter-count resolution in
// app/app/api/book/_lib/library-catalog.ts buildLibraryCatalogBook (~lines
// 74 and 92). The real function is server-only and unexported, so the exact
// floor is reproduced inline to lock in the contract: with a presentation-index
// entry the list renders the TRUE count; without one it collapses to 1 (the bug,
// = "1 chapter · ~24 min"); the detail path is always correct because it passes
// the manifest count.
function resolveListChapterCount(
  extraChapterCount: number | undefined,
  chapterCountParam: number | undefined
): number {
  const resolved =
    extraChapterCount && extraChapterCount > 0 ? extraChapterCount : chapterCountParam ?? 0;
  return Math.max(1, Math.round(resolved || 1));
}

test("list path renders the TRUE count when the presentation index has the book", () => {
  // After PAR-1, every published book has an index entry, so extra.chapterCount
  // is populated and the list shows the real number — DI-4's structural fix.
  assert.equal(resolveListChapterCount(12, undefined), 12);
  assert.equal(resolveListChapterCount(11, undefined), 11);
});

test("list path collapses to 1 ONLY when the index lacks the book (the DI-4 symptom)", () => {
  assert.equal(resolveListChapterCount(undefined, undefined), 1);
  assert.equal(resolveListChapterCount(0, undefined), 1);
});

test("detail path stays correct because it passes the manifest chapter count", () => {
  assert.equal(resolveListChapterCount(undefined, 11), 11);
});
