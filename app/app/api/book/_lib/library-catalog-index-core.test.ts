import { test } from "node:test";
import assert from "node:assert/strict";

import { BookApiError } from "./errors";
import {
  buildLibraryCatalogIndexMap,
  resolveListChapterCount,
  shouldDegradeLibraryCatalogIndex,
} from "./library-catalog-index-core";

test("buildLibraryCatalogIndexMap keys entries by bookId", () => {
  const map = buildLibraryCatalogIndexMap({
    schemaVersion: "v1",
    generatedAt: "2026-06-24T00:00:00Z",
    books: [
      { bookId: "atomic-habits", icon: "📘", synopsis: "Tiny changes." },
      { bookId: "deep-work", difficulty: "Hard" },
    ],
  });
  assert.equal(map.size, 2);
  assert.equal(map.get("atomic-habits")?.icon, "📘");
  assert.equal(map.get("deep-work")?.difficulty, "Hard");
});

test("buildLibraryCatalogIndexMap drops entries with no bookId", () => {
  const map = buildLibraryCatalogIndexMap({
    schemaVersion: "v1",
    generatedAt: "x",
    // Exercising malformed-but-parseable entries: missing bookId and empty bookId.
    books: [{ icon: "📘" }, { bookId: "" }, { bookId: "keep" }],
  });
  assert.deepEqual([...map.keys()], ["keep"]);
});

test("buildLibraryCatalogIndexMap returns empty map when books is not an array", () => {
  // A malformed-but-valid-JSON index (e.g. `books` got serialized as an object).
  assert.equal(buildLibraryCatalogIndexMap({ books: { wat: 1 } }).size, 0);
  assert.equal(buildLibraryCatalogIndexMap({}).size, 0);
  assert.equal(buildLibraryCatalogIndexMap(null).size, 0);
  assert.equal(buildLibraryCatalogIndexMap("not-an-object").size, 0);
});

test("shouldDegradeLibraryCatalogIndex degrades on invalid_json (the B6 defect)", () => {
  // readJsonFromS3 raises invalid_json (422) when JSON.parse fails on a
  // truncated/partial catalog.json upload. Before the fix this rethrew and
  // 422'd the ENTIRE library listing; now it must degrade.
  const invalidJson = new BookApiError(422, "invalid_json", "Uploaded file is not valid JSON.");
  assert.equal(shouldDegradeLibraryCatalogIndex(invalidJson), true);
});

test("shouldDegradeLibraryCatalogIndex degrades on the already-handled codes", () => {
  assert.equal(
    shouldDegradeLibraryCatalogIndex(
      new BookApiError(404, "content_not_found", "Requested book content is not available.")
    ),
    true
  );
  assert.equal(
    shouldDegradeLibraryCatalogIndex(
      new BookApiError(422, "empty_content", "Uploaded JSON file is empty.")
    ),
    true
  );
});

test("shouldDegradeLibraryCatalogIndex degrades on a transient/non-BookApiError read error", () => {
  // A bare S3 transport blip should also fall back to DynamoDB-only data rather
  // than 500 the whole library.
  assert.equal(shouldDegradeLibraryCatalogIndex(new Error("ECONNRESET")), true);
  assert.equal(shouldDegradeLibraryCatalogIndex({ name: "TimeoutError" }), true);
});

// --- resolveListChapterCount (documents the DI-4 symptom and its fix) ------
//
// buildLibraryCatalogBook in library-catalog.ts (the LIST endpoint) calls
// this to resolve a book's card chapterCount. Extracted and exported (WS3-005)
// so the real function is tested directly instead of hand-reproduced in a
// test, since library-catalog.ts itself is `server-only` and unexported.

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
  // buildLibraryCatalogBook's caller overwrites this with the real manifest
  // chapterCount afterward, but the raw resolution must still be sane.
  assert.equal(resolveListChapterCount(undefined, 11), 11);
});
