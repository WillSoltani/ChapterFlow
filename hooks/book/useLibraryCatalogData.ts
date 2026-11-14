"use client";

// Canonical shared library-catalog selector hook (WS3-001).

import { useMemo } from "react";
import { useDashboardQuery } from "@/hooks/book/useDashboardQuery";
import {
  buildLibraryCategoryOptions,
  buildLibraryDifficultyOptions,
  type LibraryBookEntry,
  type LibraryCatalogBook,
} from "@/lib/library-data";
import { canonicalizeCategory } from "@/lib/category-taxonomy";
import { continueHref, resumeChapterNumber } from "@/components/book/book-cta-core";

type DashboardCatalogPayload = {
  catalog: LibraryCatalogBook[];
  progress: Array<{
    bookId: string;
    currentChapterNumber: number;
    unlockedThroughChapterNumber: number;
    completedChapters: number[];
    bestScoreByChapter: Record<string, number>;
    lastOpenedAt?: string;
    lastActiveAt?: string;
  }>;
  bookStates: Array<{
    bookId: string;
    currentChapterId: string;
    completedChapterIds: string[];
    unlockedChapterIds: string[];
    chapterScores: Record<string, number>;
    chapterCompletedAt: Record<string, string>;
    lastReadChapterId: string;
    lastOpenedAt: string;
    updatedAt: string;
  }>;
  chapterStates: Array<{
    bookId: string;
    chapterNumber: number;
  }>;
};

const EPOCH_ISO = new Date(0).toISOString();

/** A library entry plus where its "Continue" goes (D4 / C13). */
export type LibraryUiEntry = LibraryBookEntry & {
  resumeChapterNumber: number;
  continueHref: string;
  /** Latest chapter completion time (HOME-26); unset without stamps. */
  completedAt?: string;
};

function latestIso(stamps: Record<string, string> | undefined): string | undefined {
  let latest: string | undefined;
  let latestMs = -Infinity;
  for (const value of Object.values(stamps ?? {})) {
    const ms = Date.parse(value);
    if (Number.isFinite(ms) && ms > latestMs) {
      latestMs = ms;
      latest = value;
    }
  }
  return latest;
}

export type { DashboardCatalogPayload };

export function buildEntries(payload: DashboardCatalogPayload): LibraryUiEntry[] {
  const progressByBook = new Map(payload.progress.map((item) => [item.bookId, item]));
  const stateByBook = new Map(payload.bookStates.map((item) => [item.bookId, item]));
  const booksWithChapterState = new Set(payload.chapterStates.map((item) => item.bookId));

  return payload.catalog.map((book) => {
    const progress = progressByBook.get(book.id);
    const state = stateByBook.get(book.id);
    const chaptersCompleted = Math.max(
      state?.completedChapterIds.length ?? 0,
      progress?.completedChapters.length ?? 0
    );
    const chaptersTotal = Math.max(1, book.chapterCount);
    const progressPercent = Math.min(
      100,
      Math.round((chaptersCompleted / chaptersTotal) * 100)
    );
    // D3: started = a chapter completed, or a progress row, or a chapter-state
    // row. A book-state row alone does not count: older clients wrote one when
    // the book page was only viewed.
    const started =
      chaptersCompleted > 0 || Boolean(progress) || booksWithChapterState.has(book.id);
    const status =
      chaptersCompleted >= chaptersTotal
        ? "completed"
        : started
          ? "in_progress"
          : "not_started";

    const lastActivityAt =
      (state?.lastOpenedAt && state.lastOpenedAt !== EPOCH_ISO ? state.lastOpenedAt : null) ||
      (state?.updatedAt && state.updatedAt !== EPOCH_ISO ? state.updatedAt : null) ||
      progress?.lastActiveAt ||
      progress?.lastOpenedAt ||
      EPOCH_ISO;

    const resumeChapter = resumeChapterNumber({
      currentChapterNumber: progress?.currentChapterNumber,
      chaptersCompleted,
      chapterCount: book.chapterCount,
    });

    const completedAt = latestIso(state?.chapterCompletedAt);

    return {
      ...book,
      // Canonicalize the runtime catalog's category at this entry-construction
      // boundary so the options (buildLibraryCategoryOptions), the filter match
      // (useLibraryFilters: entry.category === filters.category) and the per-card
      // tag of THIS library-data surface stay internally consistent. Live:
      // useLibraryDashboard feeds these entries to LibraryPage and the Saved
      // page. See lib/category-taxonomy.ts.
      category: canonicalizeCategory(book.category),
      status,
      progressPercent,
      chaptersTotal,
      chaptersCompleted,
      isNew: status === "not_started",
      lastActivityAt,
      resumeChapterNumber: resumeChapter,
      continueHref: continueHref(book.id, resumeChapter),
      ...(completedAt ? { completedAt } : {}),
    };
  });
}

export function useLibraryCatalogData(enabled = true) {
  // Selector over the canonical dashboard query (WS3-025) — no direct fetch, so
  // this shares the deduped/cached aggregate with every other consumer.
  const { data, error, loading } = useDashboardQuery(enabled);

  const entries: LibraryBookEntry[] = useMemo(() => {
    if (!data) return [];
    return buildEntries({
      catalog: data.catalog ?? [],
      progress: data.progress ?? [],
      bookStates: data.bookStates ?? [],
      chapterStates: data.chapterStates ?? [],
    });
  }, [data]);

  const categoryOptions = useMemo(() => buildLibraryCategoryOptions(entries), [entries]);
  const difficultyOptions = useMemo(() => buildLibraryDifficultyOptions(entries), [entries]);

  const errorMessage = error
    ? error instanceof Error
      ? error.message
      : "Unable to load your library."
    : null;

  return {
    hydrated: !loading,
    loading,
    error: errorMessage,
    entries,
    categoryOptions,
    difficultyOptions,
  };
}
