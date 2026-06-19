/**
 * Catalog stub guard (DI-4).
 *
 * The library *list* endpoint (`listPublishedLibraryCatalog` in
 * app/app/api/book/_lib/library-catalog.ts) floors a missing chapter count to 1
 * and a missing reading time to ~24 minutes whenever a published book has no
 * presentation-index entry, so the card reads "1 chapter · ~24 min" for a book
 * that actually has many chapters. The detail endpoint reads the real count from
 * the manifest, which is why detail is correct and only the list is wrong.
 *
 * The durable *coverage* fix is structural and lives upstream (PAR-1): the
 * `publish-bundled-packages` set now equals the curated `BOOK_PACKAGES` set that
 * `publish-library-assets` builds the presentation index from, so every
 * published book gets an index entry with a real count.
 *
 * This module is the cheap publish-time tripwire that guards the index *as it is
 * built*: it fails the seed (loudly, by bookId) if any curated package would
 * land in the index with a degenerate chapter count and therefore render as that
 * 1-chapter placeholder. At index-build time the chapter count is the only
 * load-bearing stub signal — the synopsis is always a real authored string from
 * `getBookPackagePresentation`, never the list endpoint's boilerplate fallback —
 * so the guard is intentionally count-based, which is also exactly the "every
 * published bookId keeps a real chapterCount, never a hardcoded 1" invariant.
 *
 * SCOPE: this validates the curated index it builds, NOT the live DynamoDB
 * published set. Books that are published-but-not-yet-curated (the 7A ship-list)
 * still render as 1-chapter on the live list until they are wired into
 * BOOK_PACKAGES and re-seeded — that reconciliation is owned by 7A + a re-seed.
 */

/**
 * Curated books are full, multi-chapter works (the live catalog ranges 3–38
 * chapters). A published index entry with fewer than this many chapters is a
 * degenerate or metadata-less package that the list endpoint renders as the
 * "1 chapter · ~24 min" placeholder.
 */
export const MIN_REAL_CHAPTER_COUNT = 2;

export type CatalogStubCandidate = {
  bookId: string;
  chapterCount: number;
};

/** A non-finite or sub-floor chapter count is the placeholder-stub signal. */
export function isStubChapterCount(chapterCount: number): boolean {
  return !Number.isFinite(chapterCount) || chapterCount < MIN_REAL_CHAPTER_COUNT;
}

export function isStubCatalogEntry(entry: CatalogStubCandidate): boolean {
  return isStubChapterCount(entry.chapterCount);
}

export function findStubCatalogEntries<T extends CatalogStubCandidate>(
  entries: readonly T[]
): T[] {
  return entries.filter(isStubCatalogEntry);
}

/**
 * Publish-time invariant: throw (fail the seed) if any catalog index row would
 * ship with a degenerate chapter count and render as a 1-chapter / ~24-minute
 * placeholder, listing the offending bookIds so the operator knows exactly which
 * packages to fix.
 */
export function assertNoStubCatalogEntries(entries: readonly CatalogStubCandidate[]): void {
  const stubs = findStubCatalogEntries(entries);
  if (stubs.length === 0) return;
  const detail = stubs.map((entry) => `${entry.bookId} (chapterCount=${entry.chapterCount})`).join(", ");
  throw new Error(
    `Catalog invariant violated (DI-4): ${stubs.length} published book(s) would render as a ` +
      `1-chapter, ~24-minute placeholder because their presentation-index chapter count is below ` +
      `${MIN_REAL_CHAPTER_COUNT}: ${detail}. Each needs real, parsed chapter content in its package ` +
      `before it can be published.`
  );
}
