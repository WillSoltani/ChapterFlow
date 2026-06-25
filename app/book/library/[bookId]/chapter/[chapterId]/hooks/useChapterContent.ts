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

export type ChapterContentProgress = {
  currentChapterNumber: number;
  unlockedThroughChapterNumber: number;
  completedChapters: number[];
};

type BookMeta = {
  bookId: string;
  title?: string;
  author?: string;
  categories?: string[];
  tags?: string[];
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
};

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
  enabled?: boolean;
  localFallback?: () => BookChapter | undefined;
  /** Bump to force a refetch (e.g. a "Try again" button after a failure). */
  refetchKey?: number;
}): ChapterContentState {
  const { bookId, chapterNumber, enabled = true, refetchKey = 0 } = params;

  // Keep the latest book meta + fallback in refs so changing their identity
  // doesn't retrigger the fetch (only bookId/chapterNumber/enabled do). Refs
  // are updated in an effect (not during render) per react-hooks rules.
  const bookRef = useRef(params.book);
  const fallbackRef = useRef(params.localFallback);
  useEffect(() => {
    bookRef.current = params.book;
    fallbackRef.current = params.localFallback;
  });

  const [state, setState] = useState<ChapterContentState>({
    chapter: undefined,
    progress: null,
    loading: enabled,
    hydrated: false,
    error: null,
    status: null,
    source: null,
  });

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
      });
      return;
    }

    let mounted = true;
    setState((prev) => ({ ...prev, loading: true }));

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
        setState({
          chapter: local,
          progress: null,
          loading: false,
          hydrated: true,
          error,
          status,
          source: local ? "local" : null,
        });
      });

    return () => {
      mounted = false;
    };
  }, [enabled, bookId, chapterNumber, refetchKey]);

  return state;
}
