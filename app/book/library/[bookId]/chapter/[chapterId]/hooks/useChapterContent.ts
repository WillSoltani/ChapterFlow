"use client";

import { useEffect, useRef, useState } from "react";
import { BookClientError, fetchBookJson } from "@/app/book/_lib/book-api";
import type { BookChapter } from "@/app/book/data/bookChapters";
import {
  adaptApiChapterToBookChapter,
  isReconstructedChapterEmpty,
  type ApiChapterResponse,
} from "@/app/book/library/[bookId]/chapter/[chapterId]/lib/chapterFromApi";

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
 * present-but-blank-prose variant; see `isReconstructedChapterEmpty`) — it falls
 * back to local package content so the reader never gets stuck (offline/dev,
 * transient errors, a gated chapter, or a malformed/partial publish). When the
 * local bundle is also empty/absent it surfaces an explicit error so the reader
 * shows its "Couldn't load this chapter" card instead of a silent blank chapter.
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
      const local = fallbackRef.current?.();
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
          const local = fallbackRef.current?.();
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
        // Fall back to local package content so the reader never gets stuck.
        // Access remains enforced by the reader's server-derived gates
        // (/start → paywall, isLocked → locked).
        const local = fallbackRef.current?.();
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
