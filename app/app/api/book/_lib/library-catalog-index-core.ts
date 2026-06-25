import type { BookDifficulty } from "@/app/book/_lib/library-data";

/**
 * Pure (server-only-free) seam for the library presentation index.
 *
 * The presentation index lives at `book-content/library/catalog.json`, a
 * SEPARATELY built/promoted S3 artifact (publish-library-assets.ts) written
 * with NO atomicity guarantee. A truncated/partial upload or a malformed build
 * yields invalid JSON, an empty body, or a missing key. The index is purely
 * presentational decoration (icon / cover / synopsis / difficulty / page count)
 * layered on top of the authoritative DynamoDB catalog — so when it can't be
 * read, the library MUST degrade to DynamoDB-only data, never fail the whole
 * listing. This module owns that "build the map / what to do on error" decision
 * so it can be unit-tested without importing the `server-only`-guarded
 * library-catalog.ts.
 */

export type LibraryCatalogIndexBook = {
  bookId: string;
  icon?: string;
  difficulty?: BookDifficulty;
  synopsis?: string;
  pages?: number;
  estimatedMinutes?: number;
  chapterCount?: number;
  coverAssetKey?: string;
};

export type LibraryCatalogIndex = {
  schemaVersion: string;
  generatedAt: string;
  books: LibraryCatalogIndexBook[];
};

/**
 * Build the bookId → presentation-entry map from a raw parsed index.
 *
 * Defensive on shape: a malformed-but-parseable index (e.g. `books` is not an
 * array, or entries without a `bookId`) yields an empty/partial map rather than
 * throwing — the index is best-effort decoration.
 */
export function buildLibraryCatalogIndexMap(
  index: unknown
): Map<string, LibraryCatalogIndexBook> {
  const books =
    index && typeof index === "object" && Array.isArray((index as LibraryCatalogIndex).books)
      ? (index as LibraryCatalogIndex).books
      : [];
  return new Map(
    books
      .filter((book): book is LibraryCatalogIndexBook => Boolean(book?.bookId))
      .map((book) => [book.bookId, book])
  );
}

/**
 * Decide whether a read error against the presentation index should DEGRADE
 * (return an empty map and let the library fall back to DynamoDB-only data) or
 * propagate.
 *
 * The presentation index is non-authoritative decoration, so EVERY read failure
 * degrades: a missing/empty object (`content_not_found` / `empty_content`), a
 * malformed/truncated upload (`invalid_json`, 422 — the original B6 defect that
 * made a single bad catalog.json 422 the entire library), or any transient
 * S3/transport error. Returning `true` for everything is deliberate; the catalog
 * row in DynamoDB remains the source of truth for what ships.
 *
 * @returns always `true` — kept as a function taking the error (not a constant)
 *   so callers route through a single documented decision point and a future
 *   "must-propagate" carve-out has one place to live.
 */
export function shouldDegradeLibraryCatalogIndex(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept as the single documented decision point for a future "must-propagate" carve-out
  error: unknown
): boolean {
  return true;
}
