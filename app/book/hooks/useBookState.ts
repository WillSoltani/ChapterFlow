"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  type ChapterStartMode,
  type PreferredExampleContext,
} from "@/app/book/_lib/onboarding-personalization";
import { BOOKS_CATALOG } from "@/app/book/data/booksCatalog";
import {
  type RecentBookProgress,
  type SessionTask,
  buildRecentBooks,
  buildTodaySessionTasks,
} from "@/app/book/data/mockProgress";
import { emitBookStorageChanged } from "@/app/book/hooks/bookStorageEvents";

export type BookDashboardState = {
  currentBookId: string;
  searchQuery: string;
  dismissMobileCta: boolean;
  recentBooks: RecentBookProgress[];
  todaySession: SessionTask[];
};

type DashboardSeed = {
  selectedBookIds: string[];
  dailyGoalMinutes: number;
  chapterStartMode: ChapterStartMode;
  preferredExampleContext: PreferredExampleContext;
};

const STORAGE_KEY = "book-accelerator:dashboard:v4";
const AVAILABLE_BOOK_IDS = new Set(BOOKS_CATALOG.map((book) => book.id));

function createDefaultState(seed: DashboardSeed): BookDashboardState {
  const recentBooks = buildRecentBooks(seed.selectedBookIds);
  const primary = recentBooks[0];
  const currentChapter = Math.max(1, primary?.chapter ?? 1);

  return {
    currentBookId: primary?.bookId || seed.selectedBookIds[0] || "",
    searchQuery: "",
    dismissMobileCta: false,
    recentBooks,
    todaySession: buildTodaySessionTasks(currentChapter, {
      chapterStartMode: seed.chapterStartMode,
      preferredExampleContext: seed.preferredExampleContext,
    }),
  };
}

function mergeTodaySession(
  recentBooks: RecentBookProgress[],
  currentBookId: string,
  storedTasks: unknown,
  seed: DashboardSeed
): SessionTask[] {
  const currentBook =
    recentBooks.find((book) => book.bookId === currentBookId) ?? recentBooks[0] ?? null;
  const defaults = buildTodaySessionTasks(Math.max(1, currentBook?.chapter ?? 1), {
    chapterStartMode: seed.chapterStartMode,
    preferredExampleContext: seed.preferredExampleContext,
  });

  if (!Array.isArray(storedTasks) || storedTasks.length === 0) {
    return defaults;
  }

  const completionById = new Map(
    storedTasks
      .filter(
        (task): task is { id: string; complete?: boolean } =>
          Boolean(task) && typeof task === "object" && typeof task.id === "string"
      )
      .map((task) => [task.id, Boolean(task.complete)])
  );

  return defaults.map((task) => ({
    ...task,
    complete: completionById.get(task.id) ?? false,
  }));
}

function parseStored(value: string | null, seed: DashboardSeed): BookDashboardState | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<BookDashboardState>;
    const defaults = createDefaultState(seed);
    const recentBooks =
      Array.isArray(parsed.recentBooks) && parsed.recentBooks.length
        ? parsed.recentBooks.filter(
            (book): book is RecentBookProgress =>
              typeof book?.bookId === "string" && AVAILABLE_BOOK_IDS.has(book.bookId)
          )
        : defaults.recentBooks;
    const normalizedRecentBooks = recentBooks.length ? recentBooks : defaults.recentBooks;

    const fallbackCurrent = normalizedRecentBooks[0]?.bookId || defaults.currentBookId;
    const currentBookId =
      typeof parsed.currentBookId === "string" &&
      parsed.currentBookId.trim() &&
      AVAILABLE_BOOK_IDS.has(parsed.currentBookId)
        ? parsed.currentBookId
        : fallbackCurrent;
    const todaySession = mergeTodaySession(
      normalizedRecentBooks,
      currentBookId,
      parsed.todaySession,
      seed
    );

    return {
      ...defaults,
      ...parsed,
      currentBookId,
      recentBooks: normalizedRecentBooks,
      todaySession,
      searchQuery:
        typeof parsed.searchQuery === "string" ? parsed.searchQuery : defaults.searchQuery,
      dismissMobileCta: Boolean(parsed.dismissMobileCta),
    };
  } catch {
    return null;
  }
}

export function useBookState(seed: DashboardSeed) {
  const stableSeed = useMemo(
    () => ({
      selectedBookIds: [...seed.selectedBookIds],
      dailyGoalMinutes: seed.dailyGoalMinutes,
      chapterStartMode: seed.chapterStartMode,
      preferredExampleContext: seed.preferredExampleContext,
    }),
    [
      seed.chapterStartMode,
      seed.dailyGoalMinutes,
      seed.preferredExampleContext,
      seed.selectedBookIds,
    ]
  );

  const [hydrated, setHydrated] = useState(false);
  const [state, setState] = useState<BookDashboardState>(() =>
    createDefaultState(stableSeed)
  );

  useEffect(() => {
    const stored = parseStored(window.localStorage.getItem(STORAGE_KEY), stableSeed);
    if (stored) {
      setState(stored);
    } else {
      setState(createDefaultState(stableSeed));
    }
    setHydrated(true);
  }, [stableSeed]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    emitBookStorageChanged("dashboard");
  }, [hydrated, state]);

  useEffect(() => {
    if (!hydrated) return;
    if (!state.recentBooks.some((book) => book.bookId === state.currentBookId)) {
      const fallback = state.recentBooks[0]?.bookId || "";
      setState((prev) => ({ ...prev, currentBookId: fallback }));
    }
  }, [hydrated, state.currentBookId, state.recentBooks]);

  const setSearchQuery = useCallback((searchQuery: string) => {
    setState((prev) => ({ ...prev, searchQuery }));
  }, []);

  const setCurrentBookId = useCallback((currentBookId: string) => {
    setState((prev) => ({ ...prev, currentBookId }));
  }, []);

  const toggleSessionTask = useCallback((taskId: string) => {
    setState((prev) => ({
      ...prev,
      todaySession: prev.todaySession.map((task) =>
        task.id === taskId ? { ...task, complete: !task.complete } : task
      ),
    }));
  }, []);

  const dismissMobileCta = useCallback(() => {
    setState((prev) => ({ ...prev, dismissMobileCta: true }));
  }, []);

  return {
    state,
    hydrated,
    setSearchQuery,
    setCurrentBookId,
    toggleSessionTask,
    dismissMobileCta,
  };
}
