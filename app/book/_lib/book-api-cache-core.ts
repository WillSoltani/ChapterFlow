// Shared client request-cache CORE (WS3-022).
//
// Pure, dependency-free logic for the book-api request cache. It has NO import of
// `fetch`, `window`, or any client module so it can be unit-tested by injecting a
// fake fetcher and clock (see book-api-cache-core.test.ts). The client-facing
// singleton that wires this to `fetchBookJson` + the browser event listeners
// lives in `book-api-cache.ts`.
//
// ── Cache policy ────────────────────────────────────────────────────────────
// - Keyed by an opaque string (the singleton uses the request URL as the key).
// - TTL (default 30_000ms): within the TTL an entry is FRESH — a read is served
//   from memory with NO network request. After the TTL it is STALE.
// - Stale-while-revalidate: a consumer serves the stale value immediately (peek)
//   then triggers a forced background revalidation; when it resolves, every
//   subscriber for that key is notified so they pick up the fresh value.
// - In-flight dedup: concurrent `load`s for the same key coalesce to a single
//   network request (they share the same in-flight promise).
// - Invalidation drops matching entries (by key prefix) and notifies their
//   subscribers so the next read refetches. Mutations are NEVER cached here;
//   callers invalidate the affected keys after a successful write.
// - `revalidateSubscribed` force-refetches every key that currently has a
//   subscriber — the singleton calls it on window focus / storage / book-storage
//   events so live screens refresh exactly as the old hand-rolled listeners did.

export type BookCacheFetcher = (key: string) => Promise<unknown>;

export interface BookCacheOptions {
  /** Freshness window in ms. Within it, reads skip the network. */
  ttlMs: number;
  /** Injectable clock (defaults to Date.now) so tests control freshness. */
  now?: () => number;
  /** Network fetcher used when a caller does not pass a per-call override. */
  defaultFetcher: BookCacheFetcher;
}

export interface BookCacheLoadOptions {
  /** Bypass freshness and always hit the network (still dedups concurrently). */
  force?: boolean;
  /** Per-call fetcher override (e.g. a GET carrying custom RequestInit). */
  fetcher?: BookCacheFetcher;
}

export interface BookCachePeek {
  value: unknown;
  /** True while the cached value is still within the TTL window. */
  fresh: boolean;
}

export interface BookCache {
  /** Synchronous read of the cached value, or undefined if none is cached. */
  peek(key: string): BookCachePeek | undefined;
  /**
   * Resolve the value for `key`: an in-flight request if one exists (dedup), the
   * fresh cached value without a network call, or a new network request whose
   * result is cached and broadcast to subscribers.
   */
  load(key: string, options?: BookCacheLoadOptions): Promise<unknown>;
  /** Subscribe to updates (successful revalidations + invalidations) for `key`. */
  subscribe(key: string, listener: () => void): () => void;
  /** Drop every entry whose key starts with `prefix`, notifying its subscribers. */
  invalidate(prefix: string): void;
  /** Force a background revalidation of every key that has a live subscriber. */
  revalidateSubscribed(): void;
}

interface CacheEntry {
  value: unknown;
  hasValue: boolean;
  storedAt: number;
  inflight: Promise<unknown> | null;
}

export function createBookCache(options: BookCacheOptions): BookCache {
  const ttlMs = options.ttlMs;
  const now = options.now ?? (() => Date.now());
  const defaultFetcher = options.defaultFetcher;

  const entries = new Map<string, CacheEntry>();
  const listeners = new Map<string, Set<() => void>>();

  function ensureEntry(key: string): CacheEntry {
    let entry = entries.get(key);
    if (!entry) {
      entry = { value: undefined, hasValue: false, storedAt: 0, inflight: null };
      entries.set(key, entry);
    }
    return entry;
  }

  function notify(key: string): void {
    const set = listeners.get(key);
    if (!set) return;
    // Copy so a listener that (un)subscribes during dispatch can't corrupt iteration.
    for (const listener of [...set]) listener();
  }

  function peek(key: string): BookCachePeek | undefined {
    const entry = entries.get(key);
    if (!entry || !entry.hasValue) return undefined;
    return { value: entry.value, fresh: now() - entry.storedAt < ttlMs };
  }

  function load(key: string, opts?: BookCacheLoadOptions): Promise<unknown> {
    const entry = ensureEntry(key);

    // Dedup: a concurrent request for the same key shares one promise.
    if (entry.inflight) return entry.inflight;

    // Fresh cache hit: serve from memory, no network.
    if (!opts?.force && entry.hasValue && now() - entry.storedAt < ttlMs) {
      return Promise.resolve(entry.value);
    }

    const fetcher = opts?.fetcher ?? defaultFetcher;
    const request = fetcher(key).then(
      (value) => {
        entry.value = value;
        entry.hasValue = true;
        entry.storedAt = now();
        entry.inflight = null;
        // Broadcast the fresh value to every subscriber (SWR delivery).
        notify(key);
        return value;
      },
      (error) => {
        // Keep the last-good value; a failed revalidation must not wipe the cache.
        entry.inflight = null;
        throw error;
      }
    );
    entry.inflight = request;
    return request;
  }

  function subscribe(key: string, listener: () => void): () => void {
    let set = listeners.get(key);
    if (!set) {
      set = new Set();
      listeners.set(key, set);
    }
    set.add(listener);
    return () => {
      const current = listeners.get(key);
      if (!current) return;
      current.delete(listener);
      if (current.size === 0) listeners.delete(key);
    };
  }

  function invalidate(prefix: string): void {
    const touched: string[] = [];
    for (const key of entries.keys()) {
      if (key.startsWith(prefix)) touched.push(key);
    }
    for (const key of touched) {
      // Drop the entry so the next read refetches. An in-flight request is left to
      // settle (its writeback simply repopulates a now-absent entry) but its value
      // is no longer served as fresh.
      entries.delete(key);
    }
    // Notify subscribers of any key under the prefix (even keys with no cached
    // entry yet) so mounted consumers refetch.
    for (const key of listeners.keys()) {
      if (key.startsWith(prefix)) notify(key);
    }
  }

  function revalidateSubscribed(): void {
    for (const key of listeners.keys()) {
      // Force so a focus/storage refresh reloads even a still-fresh entry, matching
      // the previous per-hook focus listeners. Swallow rejections — a background
      // refresh failure must not surface as an unhandled rejection.
      void load(key, { force: true }).catch(() => {});
    }
  }

  return { peek, load, subscribe, invalidate, revalidateSubscribed };
}
