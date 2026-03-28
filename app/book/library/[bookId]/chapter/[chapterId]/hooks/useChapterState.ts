"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchBookJson } from "@/app/book/_lib/book-api";
import { getChapterReaderStorageKey } from "@/app/book/_lib/reader-storage";
import type { ReadingDepth } from "@/app/book/data/mockChapters";
import { emitBookStorageChanged } from "@/app/book/hooks/bookStorageEvents";

export type ChapterTab = "summary" | "examples" | "quiz" | "practice";
export type ExampleFilter = "all" | "work" | "school" | "personal";
export type FontScale = "sm" | "md" | "lg";

export type QuizResult = {
  score: number;
  passed: boolean;
};

type PersistedChapterState = {
  activeTab: ChapterTab;
  readingDepth: ReadingDepth;
  exampleFilter: ExampleFilter;
  quizAnswers: Record<string, number>;
  quizResult: QuizResult | null;
  quizRetakeCount: number;
  quizFailureStreak: number;
  quizCooldownUntil: string | null;
  notes: string;
  focusMode: boolean;
  fontScale: FontScale;
  showRecap: boolean;
  explanationOpen: Record<string, boolean>;
};

const PREFS_KEY = "book-accelerator:reader-prefs:v1";

type ReaderPrefs = {
  focusMode: boolean;
  fontScale: FontScale;
};

const defaultState: PersistedChapterState = {
  activeTab: "summary",
  readingDepth: "deeper",
  exampleFilter: "all",
  quizAnswers: {},
  quizResult: null,
  quizRetakeCount: 0,
  quizFailureStreak: 0,
  quizCooldownUntil: null,
  notes: "",
  focusMode: false,
  fontScale: "md",
  showRecap: false,
  explanationOpen: {},
};

function isTab(value: unknown): value is ChapterTab {
  return value === "summary" || value === "examples" || value === "quiz" || value === "practice";
}

function isReadingDepth(value: unknown): value is ReadingDepth {
  return value === "simple" || value === "standard" || value === "deeper";
}

function isExampleFilter(value: unknown): value is ExampleFilter {
  return value === "all" || value === "work" || value === "school" || value === "personal";
}

function isFontScale(value: unknown): value is FontScale {
  return value === "sm" || value === "md" || value === "lg";
}

function isValidTimestamp(value: string): boolean {
  return Number.isFinite(new Date(value).getTime());
}

function parseStored(value: string | null): PersistedChapterState | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as Partial<PersistedChapterState>;
    const quizAnswers =
      parsed.quizAnswers && typeof parsed.quizAnswers === "object"
        ? Object.fromEntries(
            Object.entries(parsed.quizAnswers).filter(
              ([key, answer]) =>
                typeof key === "string" &&
                Number.isFinite(Number(answer)) &&
                Number(answer) >= 0 &&
                Number(answer) <= 10
            )
          )
        : {};

    const quizResult =
      parsed.quizResult && typeof parsed.quizResult === "object"
        ? {
            score: Number(parsed.quizResult.score ?? 0),
            passed: Boolean(parsed.quizResult.passed),
          }
        : null;

    return {
      activeTab: isTab(parsed.activeTab) ? parsed.activeTab : defaultState.activeTab,
      readingDepth: isReadingDepth(parsed.readingDepth)
        ? parsed.readingDepth
        : defaultState.readingDepth,
      exampleFilter: isExampleFilter(parsed.exampleFilter)
        ? parsed.exampleFilter
        : defaultState.exampleFilter,
      quizAnswers,
      quizResult,
      quizRetakeCount:
        typeof parsed.quizRetakeCount === "number" &&
        Number.isFinite(parsed.quizRetakeCount) &&
        parsed.quizRetakeCount >= 0
          ? Math.floor(parsed.quizRetakeCount)
          : defaultState.quizRetakeCount,
      quizFailureStreak:
        typeof parsed.quizFailureStreak === "number" &&
        Number.isFinite(parsed.quizFailureStreak) &&
        parsed.quizFailureStreak >= 0
          ? Math.floor(parsed.quizFailureStreak)
          : defaultState.quizFailureStreak,
      quizCooldownUntil:
        typeof parsed.quizCooldownUntil === "string" &&
        parsed.quizCooldownUntil.trim() &&
        isValidTimestamp(parsed.quizCooldownUntil)
          ? parsed.quizCooldownUntil
          : defaultState.quizCooldownUntil,
      notes: typeof parsed.notes === "string" ? parsed.notes : defaultState.notes,
      focusMode:
        typeof parsed.focusMode === "boolean" ? parsed.focusMode : defaultState.focusMode,
      fontScale: isFontScale(parsed.fontScale) ? parsed.fontScale : defaultState.fontScale,
      showRecap:
        typeof parsed.showRecap === "boolean" ? parsed.showRecap : defaultState.showRecap,
      explanationOpen:
        parsed.explanationOpen && typeof parsed.explanationOpen === "object"
          ? Object.fromEntries(
              Object.entries(parsed.explanationOpen).filter(
                ([key, open]) => typeof key === "string" && typeof open === "boolean"
              )
            )
          : {},
    };
  } catch {
    return null;
  }
}

function parsePrefs(value: string | null): ReaderPrefs | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<ReaderPrefs>;
    return {
      focusMode:
        typeof parsed.focusMode === "boolean" ? parsed.focusMode : defaultState.focusMode,
      fontScale: isFontScale(parsed.fontScale) ? parsed.fontScale : defaultState.fontScale,
    };
  } catch {
    return null;
  }
}

function inferChapterNumber(chapterId: string) {
  const match = chapterId.match(/(\d+)/);
  const value = match ? Number(match[1]) : NaN;
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 1;
}

export function useChapterState(
  bookId: string,
  chapterId: string,
  chapterNumber?: number,
  preferredReadingDepth: ReadingDepth = "standard",
  preferredActiveTab: ChapterTab = "summary",
  preferredExampleFilter: ExampleFilter = "all",
  preferredFocusMode: boolean = false,
  preferredFontScale: FontScale = "md"
) {
  const storageKey = useMemo(
    () => getChapterReaderStorageKey(bookId, chapterId),
    [bookId, chapterId]
  );
  const resolvedChapterNumber = chapterNumber ?? inferChapterNumber(chapterId);
  const [hydrated, setHydrated] = useState(false);
  const [state, setState] = useState<PersistedChapterState>(defaultState);
  const [serverReady, setServerReady] = useState(false);
  const [hasPersistedState, setHasPersistedState] = useState(false);
  const skipNextServerSave = useRef(false);

  useEffect(() => {
    const parsed = parseStored(window.localStorage.getItem(storageKey));
    const prefs = parsePrefs(window.localStorage.getItem(PREFS_KEY));
    setState({
      ...(
        parsed ?? {
          ...defaultState,
          activeTab: preferredActiveTab,
          readingDepth: preferredReadingDepth,
          exampleFilter: preferredExampleFilter,
        }
      ),
      focusMode: prefs?.focusMode ?? parsed?.focusMode ?? preferredFocusMode,
      fontScale: prefs?.fontScale ?? parsed?.fontScale ?? preferredFontScale,
    });
    setHasPersistedState(Boolean(parsed));
    setHydrated(true);
  }, [
    preferredActiveTab,
    preferredExampleFilter,
    preferredReadingDepth,
    storageKey,
  ]);

  useEffect(() => {
    if (!hydrated || hasPersistedState) return;
    setState((prev) =>
      prev.readingDepth === preferredReadingDepth &&
      prev.activeTab === preferredActiveTab &&
      prev.exampleFilter === preferredExampleFilter
        ? prev
        : {
            ...prev,
            activeTab: preferredActiveTab,
            readingDepth: preferredReadingDepth,
            exampleFilter: preferredExampleFilter,
            quizAnswers: {},
            quizResult: null,
            quizRetakeCount: 0,
            quizFailureStreak: 0,
            quizCooldownUntil: null,
            explanationOpen: {},
          }
    );
  }, [
    hasPersistedState,
    hydrated,
    preferredActiveTab,
    preferredExampleFilter,
    preferredReadingDepth,
  ]);

  useEffect(() => {
    let mounted = true;
    fetchBookJson<{ state: { state?: Partial<PersistedChapterState>; chapterId?: string } | null }>(
      `/app/api/book/me/books/${encodeURIComponent(bookId)}/chapters/${resolvedChapterNumber}/state`
    )
      .then((payload) => {
        if (!mounted || !payload.state?.state) return;
        skipNextServerSave.current = true;
        setHasPersistedState(true);
        setState((prev) => ({
          ...prev,
          ...(parseStored(JSON.stringify(payload.state?.state)) ?? prev),
        }));
        setServerReady(true);
      })
      .catch(() => {
        if (!mounted) return;
        setServerReady(true);
      });
    return () => {
      mounted = false;
    };
  }, [bookId, resolvedChapterNumber]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(storageKey, JSON.stringify(state));
    emitBookStorageChanged(`chapter-reader:${bookId}:${chapterId}`);
  }, [bookId, chapterId, hydrated, state, storageKey]);

  useEffect(() => {
    if (!hydrated || !serverReady) return;
    if (skipNextServerSave.current) {
      skipNextServerSave.current = false;
      return;
    }
    const timeout = window.setTimeout(() => {
      fetchBookJson(
        `/app/api/book/me/books/${encodeURIComponent(bookId)}/chapters/${resolvedChapterNumber}/state`,
        {
          method: "PATCH",
          body: JSON.stringify({
            chapterId,
            state,
          }),
        }
      ).catch(() => {});
    }, 200);
    return () => window.clearTimeout(timeout);
  }, [bookId, chapterId, hydrated, resolvedChapterNumber, serverReady, state]);

  useEffect(() => {
    if (!hydrated) return;
    const prefs: ReaderPrefs = {
      focusMode: state.focusMode,
      fontScale: state.fontScale,
    };
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  }, [hydrated, state.focusMode, state.fontScale]);

  const setActiveTab = useCallback((activeTab: ChapterTab) => {
    setState((prev) => ({ ...prev, activeTab }));
  }, []);

  const setReadingDepth = useCallback((readingDepth: ReadingDepth) => {
    setState((prev) => ({
      ...prev,
      readingDepth,
      quizAnswers: {},
      quizResult: null,
      quizRetakeCount: 0,
      quizFailureStreak: 0,
      quizCooldownUntil: null,
      explanationOpen: {},
    }));
  }, []);

  const setExampleFilter = useCallback((exampleFilter: ExampleFilter) => {
    setState((prev) => ({ ...prev, exampleFilter }));
  }, []);

  const setQuizAnswer = useCallback((questionId: string, answerIndex: number) => {
    setState((prev) => ({
      ...prev,
      quizAnswers: {
        ...prev.quizAnswers,
        [questionId]: answerIndex,
      },
    }));
  }, []);

  const clearQuizState = useCallback(() => {
    setState((prev) => ({
      ...prev,
      quizAnswers: {},
      quizResult: null,
      explanationOpen: {},
    }));
  }, []);

  const startQuizRetake = useCallback(() => {
    setState((prev) => ({
      ...prev,
      quizRetakeCount: prev.quizRetakeCount + 1,
      quizAnswers: {},
      quizResult: null,
      explanationOpen: {},
    }));
  }, []);

  const setQuizResult = useCallback((quizResult: QuizResult | null) => {
    setState((prev) => ({ ...prev, quizResult }));
  }, []);

  const setQuizFailureState = useCallback((failureStreak: number, cooldownUntil: string | null) => {
    setState((prev) => ({
      ...prev,
      quizFailureStreak: Math.max(0, Math.floor(failureStreak)),
      quizCooldownUntil:
        typeof cooldownUntil === "string" && cooldownUntil.trim() && isValidTimestamp(cooldownUntil)
          ? cooldownUntil
          : null,
    }));
  }, []);

  const setNotes = useCallback((notes: string) => {
    setState((prev) => ({ ...prev, notes }));
  }, []);

  const appendNote = useCallback((snippet: string) => {
    setState((prev) => {
      const nextNotes = prev.notes.trim()
        ? `${prev.notes.trim()}\n\n${snippet}`
        : snippet;
      return {
        ...prev,
        notes: nextNotes,
      };
    });
  }, []);

  const toggleFocusMode = useCallback(() => {
    setState((prev) => ({ ...prev, focusMode: !prev.focusMode }));
  }, []);

  const setFontScale = useCallback((fontScale: FontScale) => {
    setState((prev) => ({ ...prev, fontScale }));
  }, []);

  const toggleRecap = useCallback(() => {
    setState((prev) => ({ ...prev, showRecap: !prev.showRecap }));
  }, []);

  const toggleExplanation = useCallback((questionId: string) => {
    setState((prev) => ({
      ...prev,
      explanationOpen: {
        ...prev.explanationOpen,
        [questionId]: !prev.explanationOpen[questionId],
      },
    }));
  }, []);

  return {
    hydrated,
    state,
    setActiveTab,
    setReadingDepth,
    setExampleFilter,
    setQuizAnswer,
    clearQuizState,
    startQuizRetake,
    setQuizResult,
    setQuizFailureState,
    setNotes,
    appendNote,
    toggleFocusMode,
    setFontScale,
    toggleRecap,
    toggleExplanation,
  };
}
