import test from "node:test";
import assert from "node:assert/strict";
import { BOOKS_CATALOG_METADATA } from "./books-catalog";
import {
  findUnknownDuplicateTitleGroups,
  type CatalogRecordLike,
} from "./catalog-integrity";

function toRecordLike(
  entry: (typeof BOOKS_CATALOG_METADATA)[number]
): CatalogRecordLike {
  return {
    bookId: entry.id,
    title: entry.title,
    author: entry.author,
    categories: entry.categories,
  };
}

test("live catalog contains no unknown duplicate-title forks", () => {
  const groups = findUnknownDuplicateTitleGroups(
    BOOKS_CATALOG_METADATA.map(toRecordLike)
  );
  assert.deepEqual(
    groups,
    [],
    `Unknown duplicate-title fork(s) in lib/books-catalog.metadata.json: ${groups
      .map((g) => `${g.title} -> [${g.records.map((r) => r.bookId).join(", ")}]`)
      .join("; ")}. Either supersede the orphan record or add its slug to lib/book-slug-aliases.ts.`
  );
});

test("an unaliased same-title sibling pair is flagged as an unknown fork", () => {
  // Neither slug is in ORPHAN_BOOK_SLUGS, so the alias map cannot explain it.
  const unknownFork: CatalogRecordLike[] = [
    { bookId: "deep-work", title: "Deep Work", author: "Cal Newport" },
    { bookId: "deep-work-v2", title: "Deep  Work", author: "C. Newport" },
  ];
  const groups = findUnknownDuplicateTitleGroups(unknownFork);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].normalizedTitle, "deep work");
  assert.deepEqual(groups[0].orphanBookIds, ["deep-work-v2"]);

  // A KNOWN fork (both slugs explained by the alias map) is NOT flagged:
  // "cant-hurt-me" is a key of BOOK_SLUG_ALIASES, so the group's orphan side
  // is fully alias-explained and the filter drops it.
  const knownFork: CatalogRecordLike[] = [
    { bookId: "you-cant-hurt-me", title: "Can't Hurt Me", currentPublishedVersion: 2 },
    { bookId: "cant-hurt-me", title: "Can't Hurt Me" },
  ];
  assert.deepEqual(findUnknownDuplicateTitleGroups(knownFork), []);
});
