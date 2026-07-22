/**
 * Shared Cache-Control constants for book-detail and concept-graph responses.
 *
 * Deliberately has no `server-only` import so it can be unit-tested directly
 * (route.ts files that consume these constants import server-only and can't
 * be imported from the test runner).
 */

// Book-detail is unauthenticated and changes only on publish. Public cache
// with a 5-minute freshness window that stays under the catalog route's
// 1-hour window so new versions surface promptly.
export const BOOK_DETAIL_CACHE_CONTROL =
  "public, max-age=300, stale-while-revalidate=3600";

// Concept-graph is auth-gated (requireActiveBookUser) so it must never enter
// a shared cache. Private cache with a 5-minute freshness window, mirroring
// chapters/[chapterNumber]/route.ts.
export const CONCEPT_GRAPH_CACHE_CONTROL =
  "private, max-age=300, stale-while-revalidate=600";
