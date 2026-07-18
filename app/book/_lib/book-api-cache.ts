"use client";

// Shared client request-cache SINGLETON (WS3-022).
//
// Wires the pure cache core (book-api-cache-core.ts) to the real network fetcher
// (`fetchBookJson`) and the browser revalidation events, then exposes a small
// typed surface the read hooks use instead of hand-rolling their own fetch +
// mounted-flag + focus/storage listener boilerplate:
//
//   - fetchBookJsonCached<T>  imperative dedup + TTL + SWR GET
//   - useBookQuery<T>         React hook: cached-first data with background revalidation
//   - subscribeBookCache      subscribe a callback to a key's updates
//   - invalidateBookCache     drop cached keys after a mutation
//   - peekBookCache<T>        synchronous cached read
//
// Only GETs are ever cached here. POST/PATCH/PUT/DELETE stay on `fetchBookJson`
// and callers invalidate the affected keys afterwards.
//
// SSR-safety: this module reads NO `window` at import time. Global event
// listeners are attached lazily on the first subscription/hook mount (which only
// runs in the browser), so importing it server-side is inert.

import { useCallback, useEffect, useState } from "react";
import { BookClientError, fetchBookJson } from "@/app/book/_lib/book-api";
import { BOOK_STORAGE_EVENT } from "@/app/book/hooks/bookStorageEvents";
import {
  beginBookCacheMountLoad,
  createBookCache,
  type BookCacheEvent,
  type BookCacheListener,
} from "@/app/book/_lib/book-api-cache-core";

/** Fresh window: within 30s a read is served from memory with no network call. */
const CACHE_TTL_MS = 30_000;

const cache = createBookCache({
  ttlMs: CACHE_TTL_MS,
  now: () => Date.now(),
  defaultFetcher: (key) => fetchBookJson(key),
  // A 401/403 is an authentication boundary, not a transient data-plane
  // failure. Never retain one user's private payload after the session is gone.
  shouldClearOnError: (error) =>
    error instanceof BookClientError && (error.status === 401 || error.status === 403),
});

let listenersAttached = false;

/**
 * Attach the ONE set of global revalidation listeners the whole app shares. The
 * old hooks each added their own window "focus" / "storage" / BOOK_STORAGE_EVENT
 * listeners that bumped a private revision counter; now the cache owns them and
 * force-revalidates every subscribed key. Idempotent and browser-only.
 */
function ensureGlobalListeners(): void {
  if (listenersAttached || typeof window === "undefined") return;
  listenersAttached = true;
  const onRevalidate = () => cache.revalidateSubscribed();
  window.addEventListener("focus", onRevalidate);
  window.addEventListener("storage", onRevalidate);
  window.addEventListener(BOOK_STORAGE_EVENT, onRevalidate as EventListener);
}

/**
 * Deduped, short-TTL, stale-while-revalidate GET. Concurrent identical calls
 * coalesce to one request; a call within the TTL resolves from memory. Pass a
 * custom `init` only for GETs that carry headers/params beyond the URL.
 */
export function fetchBookJsonCached<T>(
  key: string,
  init?: RequestInit,
  opts?: { forceRevalidate?: boolean }
): Promise<T> {
  const fetcher = init ? () => fetchBookJson<T>(key, init) : undefined;
  return cache.load(key, { force: opts?.forceRevalidate, fetcher }) as Promise<T>;
}

/** Subscribe `listener` to updates (revalidations + invalidations) for `key`. */
export function subscribeBookCache(key: string, listener: BookCacheListener): () => void {
  ensureGlobalListeners();
  return cache.subscribe(key, listener);
}

/** Drop every cached key under `prefix` and notify its subscribers to refetch. */
export function invalidateBookCache(prefix: string): void {
  cache.invalidate(prefix);
}

/** Synchronous cached read (fresh or stale), or undefined if nothing is cached. */
export function peekBookCache<T>(key: string): T | undefined {
  return cache.peek(key)?.value as T | undefined;
}

export interface BookQueryResult<T> {
  data: T | undefined;
  error: unknown;
  loading: boolean;
  refetch: () => void;
}

/**
 * React hook over the shared cache. Serves any cached value instantly (SWR), then
 * revalidates in the background; re-renders whenever the key's cached value
 * changes (background revalidation, focus/storage refresh, or invalidation).
 * Pass `key = null` to disable (e.g. a gated screen) — it clears to idle.
 */
export function useBookQuery<T>(key: string | null): BookQueryResult<T> {
  const [state, setState] = useState<{ data: T | undefined; error: unknown; loading: boolean }>(
    () => {
      const peeked = key ? cache.peek(key) : undefined;
      return {
        data: peeked?.value as T | undefined,
        error: undefined,
        loading: key ? peeked === undefined : false,
      };
    }
  );

  useEffect(() => {
    if (!key) {
      setState({ data: undefined, error: undefined, loading: false });
      return;
    }
    ensureGlobalListeners();

    // Data is delivered from ONE place — the cache, via peek — so a background
    // revalidation triggered by any co-mounted consumer updates this hook too.
    const sync = (event: BookCacheEvent) => {
      if (event.type === "clear") {
        setState({ data: undefined, error: undefined, loading: false });
        return;
      }
      if (event.type === "error") {
        setState((prev) => ({ ...prev, error: event.error, loading: false }));
        return;
      }
      const peeked = cache.peek(key);
      if (peeked !== undefined) {
        setState({ data: peeked.value as T, error: undefined, loading: false });
      }
    };
    const unsubscribe = subscribeBookCache(key, sync);

    const { initial, request } = beginBookCacheMountLoad(cache, key);
    setState({
      data: initial?.value as T | undefined,
      error: undefined,
      loading: initial === undefined,
    });
    // Success and failure are delivered through the cache subscription so every
    // co-mounted consumer observes the same result. Swallow only the duplicate
    // promise channel to avoid an unhandled rejection.
    void request.catch(() => {});

    return unsubscribe;
  }, [key]);

  const refetch = useCallback(() => {
    if (!key) return;
    setState((prev) => ({ ...prev, error: undefined }));
    void cache.load(key, { force: true }).catch(() => {});
  }, [key]);

  return { data: state.data, error: state.error, loading: state.loading, refetch };
}
