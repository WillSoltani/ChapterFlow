"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchBookJson } from "@/lib/client/book-api";
import { getChapterReaderStorageKey } from "@/app/book/_lib/reader-storage";
import type { ReadingDepth } from "@/lib/reader-content-types";
import { emitBookStorageChanged } from "@/lib/client/book-storage-events";
import type { ChapterTab, ExampleFilter, FontScale } from "@/lib/reader-state-types";
export type { ChapterTab, ExampleFilter, FontScale } from "@/lib/reader-state-types";

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
  notesUpdatedAt: string | null;
  focusMode: boolean;
  fontScale: FontScale;
  showRecap: boolean;
  explanationOpen: Record<string, boolean>;
  bookmarkedTakeaways: number[];
  // Takeaway text keyed by its bookmarked index. Parallel companion to
  // bookmarkedTakeaways (the indices drive the SummaryCard highlight + the
  // save-to-notes / practice resolution); this captures the text the reader
  // actually saw so the /me/notebook feed can render the bookmark without
  // loading chapter content. Keyed by index (not a positional array) so it
  // stays robust across the union-merge and legacy data.
  //
  // The text is a SNAPSHOT at the reading depth active when bookmarking. Because
  // the index points at different prose per depth (takeawaysByDepth[depth]), the
  // notebook shows the depth-phrasing the reader saw when they bookmarked, which
  // can differ from the live in-reader Practice list at another depth. That is
  // intentional — the notebook reflects what was bookmarked.
  bookmarkedTakeawayTexts: Record<string, string>;
};

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

const defaultState: PersistedChapterState = {
  activeTab: "summary",
  readingDepth: "standard",
  exampleFilter: "all",
  quizAnswers: {},
  quizResult: null,
  quizRetakeCount: 0,
  quizFailureStreak: 0,
  quizCooldownUntil: null,
  notes: "",
  notesUpdatedAt: null,
  focusMode: false,
  fontScale: "md",
  showRecap: false,
  explanationOpen: {},
  bookmarkedTakeaways: [],
  bookmarkedTakeawayTexts: {},
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

function uniqueInts(values: number[]): number[] {
  const seen = new Set<number>();
  const result: number[] = [];
  for (const value of values) {
    if (!seen.has(value)) {
      seen.add(value);
      result.push(value);
    }
  }
  return result;
}

function laterTimestamp(a: string | null, b: string | null): string | null {
  if (a && b) return a > b ? a : b;
  return a ?? b;
}

function chooseQuizResult(
  local: QuizResult | null,
  server: QuizResult | null
): QuizResult | null {
  if (!local) return server;
  if (!server) return local;
  // Never lose a recorded pass: prefer a passing result, then the higher score.
  if (local.passed !== server.passed) return local.passed ? local : server;
  return server.score > local.score ? server : local;
}

// Reconcile the freshly-hydrated local state with the server copy fetched on
// mount. Mirrors useBookProgress's union / last-write-wins merge so a newer
// local edit is never silently clobbered by stale server data. By category:
//  - User-authored content (notes, bookmarked takeaways): preserved — notes via
//    last-write-wins on notesUpdatedAt, takeaways via union.
//  - Economy / abuse counters (retakes, failure streak, cooldown): take the more
//    restrictive value; the server is the source of truth for the quiz economy.
//  - Quiz progress: keep local in-progress answers; keep the better result.
//  - UI preferences: adopt the server value only where local is still at default.
function mergeServerChapterState(
  local: PersistedChapterState,
  server: PersistedChapterState
): PersistedChapterState {
  // Notes: last-write-wins on notesUpdatedAt; never let an empty or stale server
  // copy overwrite notes the user has authored on this device.
  let notes = local.notes;
  let notesUpdatedAt = local.notesUpdatedAt;
  if (local.notesUpdatedAt && server.notesUpdatedAt) {
    if (server.notesUpdatedAt > local.notesUpdatedAt) {
      notes = server.notes;
      notesUpdatedAt = server.notesUpdatedAt;
    }
  } else if (server.notesUpdatedAt && !local.notesUpdatedAt) {
    // Only the server is timestamped: adopt it unless doing so would drop
    // unstamped (legacy) local notes the user wrote on this device.
    if (server.notes.trim() || !local.notes.trim()) {
      notes = server.notes;
      notesUpdatedAt = server.notesUpdatedAt;
    }
  } else if (!local.notesUpdatedAt && !server.notesUpdatedAt) {
    // Neither side is timestamped (legacy data): keep local content, only
    // filling in from the server when local has nothing.
    if (!local.notes.trim() && server.notes.trim()) {
      notes = server.notes;
    }
  }
  // (local timestamped, server not) → keep the newer local notes as-is.

  const mergedBookmarks = uniqueInts([
    ...local.bookmarkedTakeaways,
    ...server.bookmarkedTakeaways,
  ]);

  return {
    // UI preferences: the server fills in only where local is still at default.
    activeTab:
      local.activeTab === defaultState.activeTab ? server.activeTab : local.activeTab,
    readingDepth:
      local.readingDepth === defaultState.readingDepth
        ? server.readingDepth
        : local.readingDepth,
    exampleFilter:
      local.exampleFilter === defaultState.exampleFilter
        ? server.exampleFilter
        : local.exampleFilter,
    fontScale:
      local.fontScale === defaultState.fontScale ? server.fontScale : local.fontScale,
    focusMode: local.focusMode,
    showRecap: local.showRecap || server.showRecap,
    explanationOpen:
      Object.keys(local.explanationOpen).length > 0
        ? local.explanationOpen
        : server.explanationOpen,
    // Quiz progress: keep local in-progress answers; keep the better result.
    quizAnswers:
      Object.keys(local.quizAnswers).length > 0 ? local.quizAnswers : server.quizAnswers,
    quizResult: chooseQuizResult(local.quizResult, server.quizResult),
    // Economy / abuse counters: take the more restrictive value (server-truth).
    quizRetakeCount: Math.max(local.quizRetakeCount, server.quizRetakeCount),
    quizFailureStreak: Math.max(local.quizFailureStreak, server.quizFailureStreak),
    quizCooldownUntil: laterTimestamp(local.quizCooldownUntil, server.quizCooldownUntil),
    // User-authored content.
    notes,
    notesUpdatedAt,
    bookmarkedTakeaways: mergedBookmarks,
    // Keep the text map aligned with the merged index set: union the texts
    // (local wins on a key collision, matching the notes last-write-wins bias)
    // then prune to the MERGED index set so the map never carries a text for an
    // index that isn't bookmarked. NOTE: like all union-merges here, this can't
    // propagate a removal — an index the user un-bookmarked locally is re-added
    // (with its text) from the server copy on the next merge; that pre-existing
    // can't-delete behavior is unchanged by this fix.
    bookmarkedTakeawayTexts: Object.fromEntries(
      mergedBookmarks
        .map((index) => {
          const key = String(index);
          const text =
            local.bookmarkedTakeawayTexts[key] ?? server.bookmarkedTakeawayTexts[key];
          return [key, text] as const;
        })
        .filter(([, text]) => typeof text === "string" && text.trim().length > 0)
    ),
  };
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
    let mounted = true;
    fetchBookJson<{ state: { state?: Partial<PersistedChapterState>; chapterId?: string } | null }>(
      `/app/api/book/me/books/${encodeURIComponent(bookId)}/chapters/${resolvedChapterNumber}/state`
    )
      .then((payload) => {
        if (!mounted) return;
        const serverState = payload.state?.state;
        if (serverState) {
          const parsed = parseStored(JSON.stringify(serverState));
          if (parsed) {
            setHasPersistedState(true);
            // Per-field merge (last-write-wins on notes, union of bookmarks,
            // restrictive economy counters) instead of a blind server-wins
            // spread, so newer local edits are never clobbered.
            setState((prev) => mergeServerChapterState(prev, parsed));
          }
        }
        // Always mark the server reachable so the save effect can persist this
        // chapter's state even on a first read (no server copy yet).
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
      )
        .then(() => setSyncFailed(false))
        .catch(() => setSyncFailed(true));
    }, 200);
    return () => window.clearTimeout(timeout);
  }, [bookId, chapterId, hydrated, resolvedChapterNumber, serverReady, state]);

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
