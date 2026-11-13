"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchBookJson } from "@/lib/client/book-api";
import { LOCAL_DATA_OWNER_COOKIE, readCookieValue } from "@/lib/auth-cache-generation";
import { getChapterReaderStorageKey } from "@/app/book/_lib/reader-storage";
import type { ReadingDepth } from "@/lib/reader-content-types";
import { emitBookStorageChanged } from "@/lib/client/book-storage-events";
import type { ChapterTab, ExampleFilter, FontScale } from "@/lib/reader-state-types";
import {
  canSendWithKeepalive,
  createChapterStateSync,
  defaultChapterState,
  type ChapterStateSync,
  type PersistedChapterState,
  type QuizResult,
  type ServerChapterCopy,
} from "../lib/chapter-state-sync-core";
export type { ChapterTab, ExampleFilter, FontScale } from "@/lib/reader-state-types";
export type { QuizResult } from "../lib/chapter-state-sync-core";

type ServerChapterStateItem = {
  state?: Partial<PersistedChapterState>;
  updatedAt?: string;
};

const defaultState = defaultChapterState;

const PREFS_KEY = "book-accelerator:reader-prefs:v1";

// Mirror the server cap (state/route.ts MAX_BOOKMARK_TEXT_LENGTH) so the client
// never stores a takeaway text the PATCH validator would reject — a rejection
// 400s the WHOLE state save (notes, quiz progress, everything), silently. The
// longest authored takeaway is ~300 chars, so this is generous headroom.
const MAX_BOOKMARK_TEXT_LENGTH = 2000;

type ReaderPrefs = {
  focusMode: boolean;
  fontScale: FontScale;
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
                Number(answer) >= 0
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
      notesUpdatedAt:
        typeof parsed.notesUpdatedAt === "string" &&
        parsed.notesUpdatedAt.trim() &&
        isValidTimestamp(parsed.notesUpdatedAt)
          ? parsed.notesUpdatedAt
          : defaultState.notesUpdatedAt,
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
      bookmarkedTakeaways: Array.isArray(parsed.bookmarkedTakeaways)
        ? parsed.bookmarkedTakeaways.filter(
            (v): v is number =>
              typeof v === "number" && Number.isFinite(v) && v >= 0 && Number.isInteger(v)
          )
        : [],
      bookmarkedTakeawayTexts:
        parsed.bookmarkedTakeawayTexts &&
        typeof parsed.bookmarkedTakeawayTexts === "object" &&
        !Array.isArray(parsed.bookmarkedTakeawayTexts)
          ? Object.fromEntries(
              Object.entries(parsed.bookmarkedTakeawayTexts as Record<string, unknown>)
                .filter(
                  ([, text]) => typeof text === "string" && text.trim().length > 0
                )
                .map(([index, text]) => [index, (text as string).trim()])
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

// G6: chapterIds are `<book-id>-ch<NN>` (e.g. "atomic-habits-ch02",
// "the-5-am-club-ch01"). The old regex grabbed the FIRST digit run anywhere in
// the id, so any book whose bookId contains a digit ("the-5-am-club") inferred
// the WRONG chapter (5 instead of 1). Anchor on the `-ch<NN>` suffix instead;
// only fall back to a loose digit scan if the suffix is absent.
export function inferChapterNumber(chapterId: string) {
  const suffixMatch = chapterId.match(/-ch0*(\d+)$/i) ?? chapterId.match(/ch0*(\d+)$/i);
  const match = suffixMatch ?? chapterId.match(/(\d+)/);
  const value = match ? Number(match[1]) : NaN;
  const result = Number.isFinite(value) && value > 0 ? Math.floor(value) : 1;
  if (!match || result === 1) {
    console.warn(`inferChapterNumber: falling back to ${result} for chapterId "${chapterId}"`);
  }
  return result;
}

// `chapterNumber` is the route's real chapter number (from the book manifest).
// The account copy is read and written only once it is known: guessing it
// from the chapterId could write to another chapter's slot.
export function useChapterState(
  bookId: string,
  chapterId: string,
  chapterNumber: number | undefined,
  preferredReadingDepth: ReadingDepth = "standard",
  preferredActiveTab: ChapterTab = "summary",
  preferredExampleFilter: ExampleFilter = "all",
  preferredFocusMode: boolean = false,
  preferredFontScale: FontScale = "md",
  // Hold writes until the reader's preferred depth/tab have settled, so a
  // first open writes the state the reader actually gets, once.
  writesReady: boolean = true
) {
  const storageKey = useMemo(
    () => getChapterReaderStorageKey(bookId, chapterId),
    [bookId, chapterId]
  );
  const [hydrated, setHydrated] = useState(false);
  const [state, setState] = useState<PersistedChapterState>(defaultState);
  const syncRef = useRef<ChapterStateSync | null>(null);
  const [hasPersistedState, setHasPersistedState] = useState(false);
  const [syncFailed, setSyncFailed] = useState(false);

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
      focusMode: preferredFocusMode,
      fontScale: prefs?.fontScale ?? parsed?.fontScale ?? preferredFontScale,
    });
    setHasPersistedState(Boolean(parsed));
    setHydrated(true);
    // preferredFocusMode/preferredFontScale intentionally excluded: this
    // effect must hydrate exactly once per storageKey (mount / chapter
    // change), not re-run and clobber persisted user state whenever a
    // parent re-render passes a fresh default-param value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Sync focus mode from settings preference — runs after bookPrefs hydrates
  useEffect(() => {
    if (!hydrated) return;
    setState((prev) => {
      if (prev.focusMode === preferredFocusMode) return prev;
      return { ...prev, focusMode: preferredFocusMode };
    });
  }, [hydrated, preferredFocusMode]);

  useEffect(() => {
    if (!chapterNumber) return;
    const url = `/app/api/book/me/books/${encodeURIComponent(bookId)}/chapters/${chapterNumber}/state`;
    const toCopy = (item: ServerChapterStateItem | null | undefined): ServerChapterCopy => ({
      state: item?.state ? parseStored(JSON.stringify(item.state)) : null,
      updatedAt: typeof item?.updatedAt === "string" ? item.updatedAt : null,
    });
    const sync = createChapterStateSync({
      get: () =>
        fetchBookJson<{ state: ServerChapterStateItem | null }>(url).then((payload) =>
          toCopy(payload.state)
        ),
      patch: (next, { keepalive }) => {
        const body = JSON.stringify({ chapterId, state: next });
        return fetchBookJson<{ state: ServerChapterStateItem }>(url, {
          method: "PATCH",
          body,
          keepalive: keepalive && canSendWithKeepalive(body),
        }).then((payload) => {
          const copy = toCopy(payload.state);
          return copy.state ? copy : { state: next, updatedAt: copy.updatedAt };
        });
      },
      applyServer: (_server, merge) => {
        setHasPersistedState(true);
        setState((prev) => merge(prev));
      },
      onSyncFailedChange: setSyncFailed,
      // The account the reader's notes belong to: once another one signs in
      // (here or in another tab), this sync stops reading and writing.
      account: () => {
        try {
          return readCookieValue(document.cookie, LOCAL_DATA_OWNER_COOKIE);
        } catch {
          return null;
        }
      },
      setTimer: (callback, ms) => window.setTimeout(callback, ms),
      clearTimer: (handle) => window.clearTimeout(handle as number),
      now: () => Date.now(),
    });
    syncRef.current = sync;
    sync.start();
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") sync.flush();
      else sync.refresh();
    };
    const onFocus = () => sync.refresh();
    const onPageHide = () => sync.flush();
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onFocus);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pagehide", onPageHide);
      sync.flush();
      sync.dispose();
      syncRef.current = null;
      setSyncFailed(false);
    };
  }, [bookId, chapterId, chapterNumber]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(storageKey, JSON.stringify(state));
    emitBookStorageChanged(`chapter-reader:${bookId}:${chapterId}`);
  }, [bookId, chapterId, hydrated, state, storageKey]);

  // The sync effect above is declared first, so on a chapter change the new
  // sync exists before it is handed the state.
  useEffect(() => {
    if (!hydrated || !writesReady) return;
    syncRef.current?.setLocal(state);
  }, [chapterNumber, hydrated, state, writesReady]);

  useEffect(() => {
    if (!hydrated) return;
    // Only persist fontScale locally; focusMode is controlled by settings preference
    const prefs: ReaderPrefs = {
      focusMode: false,
      fontScale: state.fontScale,
    };
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  }, [hydrated, state.fontScale]);

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
    setState((prev) => ({ ...prev, notes, notesUpdatedAt: new Date().toISOString() }));
  }, []);

  const appendNote = useCallback((snippet: string) => {
    setState((prev) => {
      const nextNotes = prev.notes.trim()
        ? `${prev.notes.trim()}\n\n${snippet}`
        : snippet;
      return {
        ...prev,
        notes: nextNotes,
        notesUpdatedAt: new Date().toISOString(),
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

  const markRecapSeen = useCallback(() => {
    setState((prev) => (prev.showRecap ? prev : { ...prev, showRecap: true }));
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

  // `text` is the takeaway copy the reader is looking at (resolved by the call
  // site from the active-depth takeaways). Persisted alongside the index so the
  // notebook can render the bookmark without loading chapter content.
  const toggleBookmarkedTakeaway = useCallback((index: number, text: string = "") => {
    setState((prev) => {
      const exists = prev.bookmarkedTakeaways.includes(index);
      if (exists) {
        const nextTexts = { ...prev.bookmarkedTakeawayTexts };
        delete nextTexts[index];
        return {
          ...prev,
          bookmarkedTakeaways: prev.bookmarkedTakeaways.filter((i) => i !== index),
          bookmarkedTakeawayTexts: nextTexts,
        };
      }
      const trimmed = text.trim().slice(0, MAX_BOOKMARK_TEXT_LENGTH);
      return {
        ...prev,
        bookmarkedTakeaways: [...prev.bookmarkedTakeaways, index],
        bookmarkedTakeawayTexts: trimmed
          ? { ...prev.bookmarkedTakeawayTexts, [index]: trimmed }
          : prev.bookmarkedTakeawayTexts,
      };
    });
  }, []);

  return {
    hydrated,
    state,
    syncFailed,
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
    markRecapSeen,
    toggleExplanation,
    toggleBookmarkedTakeaway,
  };
}
