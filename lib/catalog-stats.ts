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
import { BOOKS_CATALOG } from "@/app/book/data/booksCatalog";

/** Round DOWN to the nearest `step` and suffix "+", e.g. 67 → "60+". */
function displayFloor(count: number, step = 10): string {
  return `${Math.floor(count / step) * step}+`;
}

/** Exact number of published books in the live catalog (67 today). */
export const CATALOG_BOOK_COUNT = BOOKS_CATALOG.length;

/** Exact number of distinct primary categories (deduped by the `category` field). */
export const CATALOG_CATEGORY_COUNT = new Set(
  BOOKS_CATALOG.map((book) => book.category),
).size;

/**
 * Conservative display floor for the book count, e.g. "60+".
 * Derived (floor-to-10) so it tracks the catalog and never overstates.
 */
export const CATALOG_BOOK_COUNT_DISPLAY = displayFloor(CATALOG_BOOK_COUNT);

/** Conservative display floor for the category count, e.g. "10+". */
export const CATALOG_CATEGORY_COUNT_DISPLAY = displayFloor(CATALOG_CATEGORY_COUNT);
