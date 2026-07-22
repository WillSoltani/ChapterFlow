"use client";

import { useEffect, useRef, useState } from "react";
import { BookClientError, fetchBookJson } from "@/app/book/_lib/book-api";
import type { BookChapter } from "@/app/book/data/bookChapters";
import {
  adaptApiChapterToBookChapter,
  isReconstructedChapterEmpty,
  type ApiChapterResponse,
} from "@/app/book/library/[bookId]/chapter/[chapterId]/lib/chapterFromApi";
import { IS_DEV } from "@/app/book/_lib/client-env";
import { shouldUseLocalFallback } from "@/app/book/library/[bookId]/chapter/[chapterId]/lib/fallbackPolicy";
import {
  buildChapterRouteKey,
  buildChapterSeedKey,
  decideChapterContentFetch,
  shouldRetainApiChapterAfterFailure,
} from "@/app/book/library/[bookId]/chapter/[chapterId]/lib/chapterContentHydration";

export type ChapterContentProgress = {
  currentChapterNumber: number;
  unlockedThroughChapterNumber: number;
  completedChapters: number[];
};

type BookMeta = {
  bookId: string;
  title?: string | undefined;
  author?: string | undefined;
  categories?: string[] | undefined;
  tags?: string[] | undefined;
};

type ChapterContentState = {
  chapter: BookChapter | undefined;
  progress: ChapterContentProgress | null;
  loading: boolean;
  hydrated: boolean;
  error: Error | null;
  /** HTTP status when the error was a BookClientError (e.g. 402, 403, 404). */
  status: number | null;
  source: "api" | "local" | null;
  /** Route whose content produced `chapter`; never inferred from mutable props. */
  loadedRouteKey: string | null;
};

/**
 * Turn a server-hydrated chapter payload (WS3-024) into ready-to-use hook state,
 * but ONLY when it matches the currently-requested chapter and reconstructs to
 * non-empty content. Returns null when there is no usable seed (absent, a
 * different chapter, or an empty/blank-prose reconstruction) so the caller falls
 * through to a normal network fetch. Mirrors the success branch of the fetch
 * effect below so a hydrated chapter is byte-identical to a fetched one.
 */
function buildChapterSeed(
  initial: ApiChapterResponse | null | undefined,
  expectedChapterNumber: number | undefined,
  book: BookMeta,
  loadedRouteKey: string | null,
): ChapterContentState | null {
  if (!initial || !expectedChapterNumber || !loadedRouteKey) return null;
  if (initial.chapter?.number !== expectedChapterNumber) return null;
  const chapter = adaptApiChapterToBookChapter(initial.chapter, book);
  if (isReconstructedChapterEmpty(chapter)) return null;
  return {
    chapter,
    progress: initial.progress ?? null,
    loading: false,
    hydrated: true,
    error: null,
    status: null,
    source: "api",
    loadedRouteKey,
  };
}

/**
 * Fetches a chapter's content from the production API
 * (`GET /api/book/books/[bookId]/chapters/[chapterNumber]`), maps it into the
 * reader's `BookChapter` shape via the boundary adapter, and exposes the
 * server progress block.
 *
 * On ANY fetch error — OR a 200 that reconstructs to an empty body (a
 * present-but-blank-prose variant; see `isReconstructedChapterEmpty`) — it MAY
 * fall back to local package content so the reader never gets stuck. The
 * fallback is **gated to dev/CI** by `shouldUseLocalFallback(IS_DEV, status)`
 * (#1): dev (no AWS) always uses the bundle; PROD never does, for any status —
 * it leaves `chapter` undefined and surfaces `error` + `status` so the reader's
 * existing retryable error card explains the outage instead of masking it with
 * stale local content (whose quiz also grades on a divergent choiceId scheme).
 * When local fallback applies but the bundle is also empty/absent it surfaces an
 * explicit error so the reader shows its "Couldn't load this chapter" card
 * instead of a silent blank chapter.
 * Access is still enforced server-side and surfaced through the reader's
 * existing, server-derived gates: the `/start` call (402 → paywall/blocked) and
 * `isLocked` (from `useBookProgress`, which reads `/me/books/[id]/state`). The
 * raw `error` + `status` are surfaced for callers that want to react further.
 *
 * Quiz content is owned by `useQuizSession`; the returned chapter carries none.
 */
export function useChapterContent(params: {
  bookId: string;
  chapterNumber: number | undefined;
  book: BookMeta;
  enabled?: boolean | undefined;
  localFallback?: () => BookChapter | undefined;
  /** Bump to force a refetch (e.g. a "Try again" button after a failure). */
  refetchKey?: number | undefined;
  /**
   * Server-hydrated chapter payload for the ENTRY chapter (WS3-024). When it
   * matches `chapterNumber` and reconstructs to non-empty content, the hook
   * seeds from it and skips the initial network fetch. The fetch path is kept
   * intact for refetchKey/retry flows and for navigation to un-hydrated
   * chapters.
   */
  initialChapter?: ApiChapterResponse | null | undefined;
}): ChapterContentState {
  const { bookId, chapterNumber, enabled = true, refetchKey = 0, initialChapter } = params;
  const requestedRouteKey =
    chapterNumber && chapterNumber > 0
      ? buildChapterRouteKey(bookId, chapterNumber)
      : null;

  // Keep the latest book meta + fallback + server seed in refs so changing their
  // identity doesn't retrigger the fetch (only bookId/chapterNumber/enabled/
  // refetchKey do). Refs are updated in an effect (not during render) per
  // react-hooks rules.
  const bookRef = useRef(params.book);
  const fallbackRef = useRef(params.localFallback);
  const initialChapterRef = useRef(initialChapter);
  useEffect(() => {
    bookRef.current = params.book;
    fallbackRef.current = params.localFallback;
    initialChapterRef.current = initialChapter;
  });

  // Seed initial state from the server-hydrated payload via a lazy initializer
  // (runs once, on the server render AND the client mount), so the entry chapter
  // paints real content with NO loading flash and no client fetch. Falls back to
  // the empty/loading shape when there is no usable seed.
  const [state, setState] = useState<ChapterContentState>(
    () =>
      buildChapterSeed(
        initialChapter,
        chapterNumber,
        params.book,
        requestedRouteKey,
      ) ?? {
        chapter: undefined,
        progress: null,
        loading: enabled,
        hydrated: false,
        error: null,
        status: null,
        source: null,
        loadedRouteKey: null,
      },
  );
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // The (chapter, refetch) key the server seed has already satisfied, so the
  // fetch effect skips exactly one network call per hydrated chapter and still
  // fetches on any refetchKey bump or navigation to an un-hydrated chapter. It
  // starts null (never reads a ref during render); the mount seed is re-applied
  // and recorded on the effect's first run — a redundant same-content setState,
  // never a skeleton flash.
  const servedSeedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !chapterNumber || chapterNumber < 1) {
      // Dev/CI may render the bundled local chapter (no AWS data plane). In prod
      // we never substitute local content — a disabled/invalid chapter resolves
      // to "no chapter" and the reader's existing error/skeleton handling owns it.
      const local = shouldUseLocalFallback(IS_DEV, null) ? fallbackRef.current?.() : undefined;
      setState({
        chapter: local,
        progress: null,
        loading: false,
        hydrated: true,
        error: null,
        status: null,
        source: local ? "local" : null,
        loadedRouteKey: local ? requestedRouteKey : null,
      });
      return;
    }
    const activeRouteKey = buildChapterRouteKey(bookId, chapterNumber);

    // WS3-024 — prefer the server-hydrated payload over a network fetch. On the
    // mount run this re-applies the seed already in state (useState lazy init)
    // and records its key ("serve-seed", a redundant same-content setState — no
    // fetch, no flash); a later idempotent re-run is a no-op ("skip-served").
    // Navigation to another hydrated chapter re-seeds; a retry (refetchKey > 0)
    // or an un-hydrated chapter falls through to the fetch below. Reads the seed
    // from a ref so seed identity never retriggers the effect (deps stay
    // chapter/refetch only).
    const seedKey = buildChapterSeedKey(bookId, chapterNumber, refetchKey);
    const seed =
      refetchKey === 0
        ? buildChapterSeed(
            initialChapterRef.current,
            chapterNumber,
            bookRef.current,
            activeRouteKey,
          )
        : null;
    const decision = decideChapterContentFetch({
      hasUsableSeed: Boolean(seed),
      hasMatchingSeedState:
        Boolean(stateRef.current.chapter) &&
        stateRef.current.source === "api" &&
        stateRef.current.loadedRouteKey === activeRouteKey,
      refetchKey,
      seedKey,
      servedSeedKey: servedSeedKeyRef.current,
    });
    if (decision === "skip-served") {
      return;
    }
    if (decision === "serve-seed" && seed) {
      servedSeedKeyRef.current = seedKey;
      setState(seed);
      return;
    }

    let mounted = true;
    setState((previous) =>
      previous.loadedRouteKey === activeRouteKey
        ? { ...previous, loading: true }
        : {
            chapter: undefined,
            progress: null,
            loading: true,
            hydrated: false,
            error: null,
            status: null,
            source: null,
            loadedRouteKey: null,
          },
    );

    fetchBookJson<ApiChapterResponse>(
      `/app/api/book/books/${encodeURIComponent(bookId)}/chapters/${chapterNumber}`,
    )
      .then((res) => {
        if (!mounted) return;
        const chapter = adaptApiChapterToBookChapter(res.chapter, bookRef.current);
        // Content-sanity: a 200 can still reconstruct to an empty body — a
        // PRESENT variant key whose prose is blank (the route's `variant_missing`
        // guard only rejects the zero-KEYS case). Rendering it shows chrome over
        // a silent blank Summary, with no error and no fallback. Treat it like a
        // failed load: prefer a non-empty local bundle, else surface the explicit
        // "Couldn't load this chapter" state. (PAR-3)
        if (isReconstructedChapterEmpty(chapter)) {
          // A 200 that reconstructs empty is a content failure. In dev/CI prefer
          // a non-empty local bundle; in prod never substitute local content —
          // surface the explicit "Couldn't load this chapter" error instead so a
          // real malformed/partial publish is honest. (#1)
          const local = shouldUseLocalFallback(IS_DEV, null) ? fallbackRef.current?.() : undefined;
          const usableLocal = local && !isReconstructedChapterEmpty(local) ? local : undefined;
          setState({
            chapter: usableLocal,
            progress: res.progress ?? null,
            loading: false,
            hydrated: true,
            error: usableLocal ? null : new Error("Chapter content was empty."),
            status: null,
            source: usableLocal ? "local" : null,
            loadedRouteKey: usableLocal ? activeRouteKey : null,
          });
          return;
        }
        setState({
          chapter,
          progress: res.progress ?? null,
          loading: false,
          hydrated: true,
          error: null,
          status: null,
          source: "api",
          loadedRouteKey: activeRouteKey,
        });
      })
      .catch((err: unknown) => {
        if (!mounted) return;
        const error = err instanceof Error ? err : new Error("Failed to load chapter content.");
        const status = err instanceof BookClientError ? err.status : null;
        // Dev/CI: fall back to local package content so the reader never gets
        // stuck with no AWS data plane. Prod: NEVER substitute local content —
        // leave `chapter` undefined and surface `error` + `status` so the reader
        // shows its existing retryable error card (the card branches on `status`:
        // 402/403 = blocked, 404 = not-found, 5xx/network = "Try again"). This is
        // what stops a real content outage from being silently masked. (#1)
        const local = shouldUseLocalFallback(IS_DEV, status) ? fallbackRef.current?.() : undefined;
        setState((previous) => {
          // A route-bound server seed is already authorization-attested content.
          // A later retry that loses connectivity or receives a 5xx must not
          // blank that prose. Definitive 4xx responses still fall through and
          // remove it so reauth/paywall/lock handling owns the screen.
          if (
            shouldRetainApiChapterAfterFailure({
              hasApiChapter:
                Boolean(previous.chapter) && previous.source === "api",
              loadedRouteKey: previous.loadedRouteKey,
              requestedRouteKey: activeRouteKey,
              status,
            })
          ) {
            return {
              ...previous,
              loading: false,
              hydrated: true,
              error,
              status,
            };
          }
          return {
            chapter: local,
            progress: null,
            loading: false,
            hydrated: true,
            error,
            status,
            source: local ? "local" : null,
            loadedRouteKey: local ? activeRouteKey : null,
          };
        });
      });

    return () => {
      mounted = false;
    };
  }, [enabled, bookId, chapterNumber, refetchKey, requestedRouteKey]);

  // Effects run after render. Mask a prior route's state synchronously during
  // same-component navigation so old prose cannot flash under the new URL even
  // before the new request starts (or if it later fails transiently).
  if (state.chapter && state.loadedRouteKey !== requestedRouteKey) {
    return {
      chapter: undefined,
      progress: null,
      loading: Boolean(enabled && requestedRouteKey),
      hydrated: false,
      error: null,
      status: null,
      source: null,
      loadedRouteKey: null,
    };
  }

  return state;
}
