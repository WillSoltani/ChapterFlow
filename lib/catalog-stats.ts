/**
 * Single source of truth for catalog-size marketing claims. Previously every
 * surface hardcoded "95+ books across 21 categories", which overstated the live
 * catalog (~64-67 books across ~13 categories — see
 * app/book/data/booksCatalog.metadata.json).
 *
 * These are deliberately CONSERVATIVE display floors so the claim stays true as
 * the catalog grows. Bump them only once the live catalog clears the next floor.
 * Client-safe (no server-only imports).
 */

/** Display floor for the number of published books, e.g. "60+". */
export const CATALOG_BOOK_COUNT_DISPLAY = "60+";

/** Display floor for the number of distinct categories, e.g. "10+". */
export const CATALOG_CATEGORY_COUNT_DISPLAY = "10+";
