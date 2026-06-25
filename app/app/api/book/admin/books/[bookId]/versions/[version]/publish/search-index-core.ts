/**
 * Pure decision seam for the global search-index rebuild.
 *
 * `search-index-builder.ts` imports `server-only` (it constructs an S3 client at
 * module scope), so it cannot be imported from a unit test. This module holds
 * the side-effect-free policy that decides whether a rebuild is COMPLETE enough
 * to overwrite the authoritative `book-content/library/search-index.json`, plus
 * the shape of the result surfaced to the publish caller. It is unit-tested via
 * `search-index-core.test.ts`.
 *
 * Why this matters: the rebuild iterates every published book and fetches each
 * chapter from S3. The previous implementation silently `continue`d past any
 * per-book (manifest) or per-chapter read failure and then UNCONDITIONALLY
 * overwrote the live index with whatever (possibly thin/incomplete) document set
 * it managed to assemble. A transient S3/Dynamo blip therefore could replace a
 * good index with a stale/partial one — invisibly, because the publish route
 * only `console.error`d a thrown rebuild error. The fix tracks read failures and
 * REFUSES to write a partial index, surfacing the failure instead of clobbering.
 */

export type SearchIndexRebuildFailure = {
  /** "manifest" = a per-book manifest read failed; "chapter" = a per-chapter read failed. */
  scope: "manifest" | "chapter";
  bookId: string;
  /** Chapter number, present only for chapter-scope failures. */
  chapterNumber?: number;
  message: string;
};

export type SearchIndexRebuildStats = {
  /** Published books considered for indexing. */
  booksConsidered: number;
  /** Documents successfully assembled (would be written on success). */
  documentCount: number;
  /** Per-book / per-chapter read failures encountered during assembly. */
  failures: SearchIndexRebuildFailure[];
};

export type SearchIndexWriteDecision =
  | { write: true }
  | {
      write: false;
      code: string;
      message: string;
      details: {
        booksConsidered: number;
        documentCount: number;
        failureCount: number;
        failures: SearchIndexRebuildFailure[];
      };
    };

/**
 * Decide whether an assembled index is complete enough to overwrite the
 * authoritative S3 object.
 *
 * Policy: ANY read failure aborts the write. A partial index is worse than a
 * stale-but-complete one for a global search surface — we would rather keep the
 * last good index and loudly report the failure than silently degrade search.
 */
export function decideSearchIndexWrite(
  stats: SearchIndexRebuildStats,
): SearchIndexWriteDecision {
  if (stats.failures.length === 0) {
    return { write: true };
  }
  // Cap the inlined failure list so a wholesale outage can't produce a huge
  // response/log payload; the count is always exact.
  const MAX_INLINE_FAILURES = 25;
  return {
    write: false,
    code: "search_index_rebuild_incomplete",
    message:
      `Search index rebuild encountered ${stats.failures.length} read ` +
      `failure(s) across ${stats.booksConsidered} published book(s); ` +
      `refusing to overwrite the live index with a partial result.`,
    details: {
      booksConsidered: stats.booksConsidered,
      documentCount: stats.documentCount,
      failureCount: stats.failures.length,
      failures: stats.failures.slice(0, MAX_INLINE_FAILURES),
    },
  };
}
