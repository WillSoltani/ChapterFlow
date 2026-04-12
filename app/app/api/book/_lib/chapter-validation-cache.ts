import "server-only";

import { getPublishedBookManifest, getUserAccessibleChapter } from "./content-service";

// In-process LRU cache for chapter-validation lookups (example IDs + book title).
// Chapters are version-pinned and immutable per published version, so a 10-minute
// TTL with bounded size is safe. Each lambda warm-loads its own cache; no
// cross-invocation coordination is required.
//
// Hits eliminate 3 round-trips per request (catalog read, version read,
// chapter S3 read) for endpoints that only need to validate exampleId or
// surface the book title — e.g. the reflection endpoint.

type CacheEntry = {
  exampleIds: ReadonlySet<string>;
  bookTitle: string;
  expiresAt: number;
};

const TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ENTRIES = 200;

const cache = new Map<string, CacheEntry>();

function cacheKey(bookId: string, chapterNumber: number): string {
  return `${bookId}:${chapterNumber}`;
}

function evictExpired(now: number) {
  for (const [key, entry] of cache) {
    if (entry.expiresAt <= now) cache.delete(key);
  }
}

function evictIfNeeded() {
  if (cache.size <= MAX_ENTRIES) return;
  // Map iteration is insertion-order, so the first key is the oldest entry.
  // Drop the oldest 10% to amortize eviction cost.
  const dropCount = Math.max(1, Math.floor(MAX_ENTRIES * 0.1));
  let dropped = 0;
  for (const key of cache.keys()) {
    cache.delete(key);
    if (++dropped >= dropCount) break;
  }
}

/**
 * Resolve the set of valid example IDs and the book title for a chapter.
 * Performs an in-memory cache lookup first; falls back to S3/DDB on miss.
 * Always re-validates user access via the caller's progress record — this
 * helper does NOT enforce authorization, callers must.
 */
export async function getCachedChapterValidation(params: {
  tableName: string;
  contentBucket: string;
  userId: string;
  bookId: string;
  chapterNumber: number;
}): Promise<{ exampleIds: ReadonlySet<string>; bookTitle: string }> {
  const key = cacheKey(params.bookId, params.chapterNumber);
  const now = Date.now();
  evictExpired(now);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) {
    // Re-insert to keep the entry "hot" in insertion order (LRU-ish).
    cache.delete(key);
    cache.set(key, cached);
    return { exampleIds: cached.exampleIds, bookTitle: cached.bookTitle };
  }

  const [{ chapter }, { manifest }] = await Promise.all([
    getUserAccessibleChapter({
      tableName: params.tableName,
      contentBucket: params.contentBucket,
      userId: params.userId,
      bookId: params.bookId,
      chapterNumber: params.chapterNumber,
    }),
    getPublishedBookManifest({
      tableName: params.tableName,
      contentBucket: params.contentBucket,
      bookId: params.bookId,
    }),
  ]);

  const exampleIds: ReadonlySet<string> = new Set(
    chapter.examples.map((example) => example.exampleId)
  );
  const entry: CacheEntry = {
    exampleIds,
    bookTitle: manifest.title,
    expiresAt: now + TTL_MS,
  };
  cache.set(key, entry);
  evictIfNeeded();
  return { exampleIds, bookTitle: manifest.title };
}

/** Test/maintenance hook — clear the entire cache. */
export function _clearChapterValidationCache(): void {
  cache.clear();
}
