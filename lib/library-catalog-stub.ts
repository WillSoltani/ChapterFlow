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

// ---------------------------------------------------------------------------
// Boilerplate-synopsis guard (DETAIL-BOILERPLATE-SYNOPSIS).
//
// The OTHER load-bearing "un-backfilled record" signal DI-4's count guard above
// deliberately scoped out. The list endpoint (`buildLibraryCatalogBook` in
// app/app/api/book/_lib/library-catalog.ts) renders a single canned synopsis —
// "<Title> taught through chapter summaries, real-world scenarios, and quizzes
// you can apply right away." — whenever a published book's presentation-index
// entry has no authored short description. Side by side with books that carry a
// real description, that boilerplate makes paid catalog entries look templated.
//
// The runtime `fallbackSynopsis` in library-catalog.ts DELEGATES to
// `boilerplateSynopsis` below so the live fallback and this detector share one
// template and can never drift. The fallback itself is intentionally KEPT — an
// empty synopsis would be worse than the canned line; the real fix is authoring
// per-book synopses (content/prod-data work owned by 7A / the prod re-seed).
//
// The sibling list-path chapter-count floor (this module's isStubChapterCount
// guards the invariant it protects) is `resolveListChapterCount` in
// library-catalog-index-core.ts — exported from there (not inlined in the
// server-only library-catalog.ts) specifically so library-catalog-stub.test.ts
// can import and exercise the real function instead of reproducing it (WS3-005).
// ---------------------------------------------------------------------------

/** Minutes the list endpoint floors a presentation-index-less book to. */
export const STUB_ESTIMATED_MINUTES = 24;

/**
 * The list endpoint's last-resort synopsis when a published book has no authored
 * short description. Single source of truth: `fallbackSynopsis` in
 * app/app/api/book/_lib/library-catalog.ts calls this, and the QA detectors
 * below recognise it, so the template lives in exactly one place.
 */
export function boilerplateSynopsis(title: string): string {
  return `${title} taught through chapter summaries, real-world scenarios, and quizzes you can apply right away.`;
}

/**
 * Title-agnostic tail of the canned line, so the boilerplate is still detected
 * when a title was edited after the synopsis was generated (the stored synopsis
 * no longer exactly equals `boilerplateSynopsis(currentTitle)`).
 */
export const BOILERPLATE_SYNOPSIS_PATTERN =
  /taught through chapter summaries, real-world scenarios, and quizzes you can apply right away\.?$/i;

/**
 * True when a synopsis is the canned fallback rather than an authored
 * description. An empty/whitespace synopsis is a DIFFERENT defect (no fallback
 * applied at all) and is intentionally NOT flagged here.
 */
export function isBoilerplateSynopsis(
  synopsis: string | null | undefined,
  title?: string
): boolean {
  const value = (synopsis ?? "").trim();
  if (!value) return false;
  if (title && value === boilerplateSynopsis(title)) return true;
  return BOILERPLATE_SYNOPSIS_PATTERN.test(value);
}

export type UnbackfilledCatalogCandidate = {
  title: string;
  synopsis?: string | null;
  chapterCount?: number;
  estimatedMinutes?: number;
};

/**
 * DETAIL-BOILERPLATE-SYNOPSIS / DI-1's three-signal detector: a record that
 * carries the boilerplate synopsis AND floored to one chapter AND the ~24-minute
 * default is almost certainly a published-but-never-curated book with no
 * presentation-index entry. The synopsis match is the load-bearing signal; the
 * count/minutes floors (reusing DI-4's `isStubChapterCount`) raise confidence.
 *
 * Deliberately UNWIRED from the publish-time index build: that build only sees
 * the curated set, whose synopses are always authored (DI-4's header notes the
 * same), so this would never fire there. It is the detector for the LIVE
 * published set — used to audit which prod-only books still render the canned
 * line (the 7A + prod-reseed reconciliation that owns that data). Retained as a
 * tested building block for that reconciliation, not as dead code.
 */
export function isUnbackfilledCatalogEntry(entry: UnbackfilledCatalogCandidate): boolean {
  return (
    isBoilerplateSynopsis(entry.synopsis, entry.title) &&
    isStubChapterCount(entry.chapterCount ?? 0) &&
    entry.estimatedMinutes === STUB_ESTIMATED_MINUTES
  );
}

/** Catalog rows (any shape with a title + synopsis) whose synopsis is the canned line. */
export function findBoilerplateSynopsisEntries<
  T extends { title: string; synopsis?: string | null }
>(entries: readonly T[]): T[] {
  return entries.filter((entry) => isBoilerplateSynopsis(entry.synopsis, entry.title));
}
