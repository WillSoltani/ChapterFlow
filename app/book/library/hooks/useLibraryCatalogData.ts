"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchBookJson } from "@/app/book/_lib/book-api";
import {
  buildLibraryCategoryOptions,
  buildLibraryDifficultyOptions,
  type LibraryBookEntry,
  type LibraryCatalogBook,
} from "@/app/book/_lib/library-data";
import { BOOK_STORAGE_EVENT } from "@/app/book/hooks/bookStorageEvents";

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
};

const EPOCH_ISO = new Date(0).toISOString();

function buildEntries(payload: DashboardCatalogPayload): LibraryBookEntry[] {
  const progressByBook = new Map(payload.progress.map((item) => [item.bookId, item]));
  const stateByBook = new Map(payload.bookStates.map((item) => [item.bookId, item]));

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
    const status =
      chaptersCompleted >= chaptersTotal
        ? "completed"
        : chaptersCompleted > 0 || Boolean(state || progress)
          ? "in_progress"
          : "not_started";

    const lastActivityAt =
      (state?.lastOpenedAt && state.lastOpenedAt !== EPOCH_ISO ? state.lastOpenedAt : null) ||
      (state?.updatedAt && state.updatedAt !== EPOCH_ISO ? state.updatedAt : null) ||
      progress?.lastActiveAt ||
      progress?.lastOpenedAt ||
      EPOCH_ISO;

    return {
      ...book,
      status,
      progressPercent,
      chaptersTotal,
      chaptersCompleted,
      isNew: status === "not_started",
      lastActivityAt,
    };
  });
}

export function useLibraryCatalogData(enabled = true) {
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<LibraryBookEntry[]>([]);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!enabled) return;

    function handleRefresh() {
      setRevision((value) => value + 1);
    }

    window.addEventListener(BOOK_STORAGE_EVENT, handleRefresh as EventListener);
    window.addEventListener("storage", handleRefresh);
    window.addEventListener("focus", handleRefresh);
    return () => {
      window.removeEventListener(BOOK_STORAGE_EVENT, handleRefresh as EventListener);
      window.removeEventListener("storage", handleRefresh);
      window.removeEventListener("focus", handleRefresh);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setEntries([]);
      setHydrated(true);
      setLoading(false);
      return;
    }

    let mounted = true;
    setLoading(true);

    fetchBookJson<DashboardCatalogPayload>("/app/api/book/me/dashboard")
      .then((payload) => {
        if (!mounted) return;
        setEntries(buildEntries(payload));
        setError(null);
      })
      .catch((fetchError: unknown) => {
        if (!mounted) return;
        const message =
          fetchError instanceof Error ? fetchError.message : "Unable to load your library.";
        setEntries([]);
        setError(message);
      })
      .finally(() => {
        if (!mounted) return;
        setHydrated(true);
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [enabled, revision]);

  const categoryOptions = useMemo(() => buildLibraryCategoryOptions(entries), [entries]);
  const difficultyOptions = useMemo(() => buildLibraryDifficultyOptions(entries), [entries]);

  return {
    hydrated,
    loading,
    error,
    entries,
    categoryOptions,
    difficultyOptions,
  };
}
