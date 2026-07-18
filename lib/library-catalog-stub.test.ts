import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MIN_REAL_CHAPTER_COUNT,
  isStubChapterCount,
  isStubCatalogEntry,
  findStubCatalogEntries,
  assertNoStubCatalogEntries,
  boilerplateSynopsis,
  BOILERPLATE_SYNOPSIS_PATTERN,
  isBoilerplateSynopsis,
  isUnbackfilledCatalogEntry,
  findBoilerplateSynopsisEntries,
  STUB_ESTIMATED_MINUTES,
  type CatalogStubCandidate,
} from "./library-catalog-stub";
import catalogMetadata from "./books-catalog.metadata.json";

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

// List-path chapter-count floor behavior (the DI-4 symptom and its fix) is
// tested in app/app/api/book/_lib/library-catalog-index-core.test.ts against
// the real `resolveListChapterCount` (WS3-005) — it exercises
// library-catalog.ts's own list-building logic, not this module's exports, so
// it moved next to the function it tests instead of a hand-reproduced copy
// living here just because that function used to be server-only and unexported.

// ===========================================================================
// Boilerplate-synopsis guard (DETAIL-BOILERPLATE-SYNOPSIS)
// ===========================================================================

// --- isBoilerplateSynopsis -------------------------------------------------

test("isBoilerplateSynopsis flags the exact canned line for a title", () => {
  const title = "Meditations";
  assert.equal(isBoilerplateSynopsis(boilerplateSynopsis(title), title), true);
});

test("isBoilerplateSynopsis flags the canned line even when the title was edited", () => {
  // Stored synopsis was generated for the OLD title; the tail still matches.
  const stored = boilerplateSynopsis("The Art of War");
  assert.equal(isBoilerplateSynopsis(stored, "The Art of War (Annotated)"), true);
  // ...and with no title at all, the title-agnostic pattern still catches it.
  assert.equal(isBoilerplateSynopsis(stored), true);
});

test("isBoilerplateSynopsis does NOT flag an authored synopsis", () => {
  const authored =
    "A modern reading of Hamilton Helmer's nine chapters on the seven powers and durable strategic advantage.";
  assert.equal(isBoilerplateSynopsis(authored, "7 Powers"), false);
});

test("isBoilerplateSynopsis treats empty/whitespace as a DIFFERENT defect (not boilerplate)", () => {
  assert.equal(isBoilerplateSynopsis("", "Anything"), false);
  assert.equal(isBoilerplateSynopsis("   ", "Anything"), false);
  assert.equal(isBoilerplateSynopsis(null, "Anything"), false);
  assert.equal(isBoilerplateSynopsis(undefined, "Anything"), false);
});

test("BOILERPLATE_SYNOPSIS_PATTERN matches across different titles", () => {
  for (const title of ["Atomic Habits", "Deep Work", "The 4-Hour Workweek"]) {
    assert.match(boilerplateSynopsis(title), BOILERPLATE_SYNOPSIS_PATTERN);
  }
});

// --- isUnbackfilledCatalogEntry (DI-1's three-signal detector) -------------

test("isUnbackfilledCatalogEntry needs ALL three signals together", () => {
  const title = "Ghost Book";
  // All three: boilerplate synopsis + 1 chapter + ~24 min => un-backfilled.
  assert.equal(
    isUnbackfilledCatalogEntry({
      title,
      synopsis: boilerplateSynopsis(title),
      chapterCount: 1,
      estimatedMinutes: STUB_ESTIMATED_MINUTES,
    }),
    true
  );
  // Real chapter count breaks it (a published book that merely lacks a synopsis).
  assert.equal(
    isUnbackfilledCatalogEntry({
      title,
      synopsis: boilerplateSynopsis(title),
      chapterCount: 12,
      estimatedMinutes: STUB_ESTIMATED_MINUTES,
    }),
    false
  );
  // Authored synopsis breaks it (the load-bearing signal).
  assert.equal(
    isUnbackfilledCatalogEntry({
      title,
      synopsis: "A real, authored description.",
      chapterCount: 1,
      estimatedMinutes: STUB_ESTIMATED_MINUTES,
    }),
    false
  );
  // Non-default minutes breaks it.
  assert.equal(
    isUnbackfilledCatalogEntry({
      title,
      synopsis: boilerplateSynopsis(title),
      chapterCount: 1,
      estimatedMinutes: 84,
    }),
    false
  );
});

// --- findBoilerplateSynopsisEntries ----------------------------------------

test("findBoilerplateSynopsisEntries returns only the canned rows", () => {
  const rows = [
    { title: "Real One", synopsis: "Authored description." },
    { title: "Canned A", synopsis: boilerplateSynopsis("Canned A") },
    { title: "Canned B", synopsis: boilerplateSynopsis("Canned B") },
  ];
  const flagged = findBoilerplateSynopsisEntries(rows);
  assert.deepEqual(
    flagged.map((r) => r.title),
    ["Canned A", "Canned B"]
  );
});

// --- Catalog invariant: the curated metadata must never ship the canned line -
//
// booksCatalog.metadata.json is the offline static gate for what ships (the
// curated list). Every curated book must carry an authored synopsis, never the
// list endpoint's boilerplate fallback. This locks DETAIL-BOILERPLATE-SYNOPSIS:
// if a future row regresses to the canned line (or omits a synopsis), this fails
// loudly and names the books. The remaining un-backfilled records are the
// hidden/prod-only books NOT in this curated metadata — that is 7A / prod-data
// scope, not enforceable offline here.

type CatalogMetadataRow = {
  id: string;
  title: string;
  synopsis?: string;
};

const curatedRows = catalogMetadata as readonly CatalogMetadataRow[];

test("every curated book in booksCatalog.metadata.json has an authored synopsis", () => {
  const missing = curatedRows.filter((row) => !row.synopsis || !row.synopsis.trim());
  assert.equal(
    missing.length,
    0,
    `Curated books missing a synopsis (would render the canned fallback): ${missing
      .map((r) => r.id)
      .join(", ")}`
  );
});

test("no curated book in booksCatalog.metadata.json uses the boilerplate synopsis", () => {
  const flagged = findBoilerplateSynopsisEntries(curatedRows);
  assert.equal(
    flagged.length,
    0,
    `Curated books shipping the canned boilerplate synopsis: ${flagged
      .map((r) => r.id)
      .join(", ")}. Author a real one-line synopsis in booksCatalog.metadata.json.`
  );
});
