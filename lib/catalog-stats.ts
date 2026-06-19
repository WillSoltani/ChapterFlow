/**
 * Single source of truth for catalog-size marketing claims. Previously every
 * surface hardcoded "95+ books across 21 categories" / "93 more books", which
 * overstated the live catalog. Every count here is DERIVED from the live
 * catalog (app/book/data/booksCatalog) — never hardcoded.
 *
 * The *_DISPLAY strings are deliberately CONSERVATIVE display floors (rounded
 * DOWN to the nearest 10) so a public claim can never overstate the catalog and
 * stays stable as it grows. The exact numeric counts are exposed for code that
 * needs the real number (and for the CI guard that asserts the floors never
 * exceed the live counts).
 *
 * Client-safe: booksCatalog only imports the metadata JSON + lib/book-covers.
 */
import {
  BOOKS_CATALOG,
  BOOKS_CATALOG_METADATA,
} from "@/app/book/data/booksCatalog";
import { canonicalizeCategory } from "@/lib/category-taxonomy";

/** Round DOWN to the nearest `step` and suffix "+", e.g. 67 → "60+". */
function displayFloor(count: number, step = 10): string {
  return `${Math.floor(count / step) * step}+`;
}

/** Median of a numeric list, rounded to an integer (even length → the two middles averaged, rounded). */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/** Exact number of published books in the live catalog (67 today). */
export const CATALOG_BOOK_COUNT = BOOKS_CATALOG.length;

/**
 * Exact number of distinct primary categories, deduped by the CANONICAL form of
 * the `category` field — so near-duplicate authored strings (e.g. "Self-Help" vs
 * "Self Improvement") count as one topic instead of inflating the figure that
 * reaches the profile "X of N categories" surface. See lib/category-taxonomy.ts.
 */
export const CATALOG_CATEGORY_COUNT = new Set(
  BOOKS_CATALOG.map((book) => canonicalizeCategory(book.category)),
).size;

/**
 * Median minutes to read one chapter, DERIVED from the live catalog
 * (round(estimatedMinutes / chapterCount) per book). This is the same honest
 * per-chapter figure the in-app library already shows via getPerChapterMinutes
 * — exposed here so marketing copy tracks the real number instead of an
 * inflated literal. ~12 today; recomputes as the catalog changes.
 */
export const CATALOG_MEDIAN_CHAPTER_MINUTES = median(
  BOOKS_CATALOG_METADATA.filter((book) => book.chapterCount > 0).map((book) =>
    Math.round(book.estimatedMinutes / book.chapterCount),
  ),
);

/**
 * Conservative display floor for the book count, e.g. "60+".
 * Derived (floor-to-10) so it tracks the catalog and never overstates.
 */
export const CATALOG_BOOK_COUNT_DISPLAY = displayFloor(CATALOG_BOOK_COUNT);

/** Conservative display floor for the category count, e.g. "10+". */
export const CATALOG_CATEGORY_COUNT_DISPLAY = displayFloor(CATALOG_CATEGORY_COUNT);
