"use client";

import { useEffect, useRef } from "react";
import type { BookChapter, ReadingDepth } from "@/app/book/data/bookChapters";
import { getMotivationMessage } from "@/app/book/_lib/motivation-messages";
import type { BookPreferencesState } from "@/app/book/hooks/useBookPreferences";
import { useBookProgress, type BookProgressFloor } from "@/app/book/library/hooks/useBookProgress";
import { useReadingSessionTracker } from "@/app/book/library/hooks/useReadingSessionTracker";
import { useBreakReminder } from "./useBreakReminder";
import { useChapterState } from "./useChapterState";
import { useScrollResume } from "./useScrollResume";
import type { ChapterTab, ExampleFilter, FontScale } from "@/lib/reader-state-types";

type ProgressChapter = { id: string; order: number; title: string };

export function useReaderProgress({
  bookId,
  chapterId,
  chapterNumber,
  chapter,
  chapters,
  initialProgressFloor,
  preferredReadingDepth,
  preferredActiveTab,
  preferredExampleFilter,
  preferredFocusMode,
  preferredFontScale,
  onboardingHydrated,
  effectiveOnboardingComplete,
  bookAccessStatus,
  hasAttestedSeed,
  bookPrefs,
  bookPrefsHydrated,
  dailyGoalMinutes,
  onToast,
}: {
  bookId: string;
  chapterId: string;
  /** The route's chapter number from the book manifest (useReaderAccess). */
  chapterNumber: number | undefined;
  chapter?: BookChapter | undefined;
  chapters: ProgressChapter[];
  initialProgressFloor?: BookProgressFloor | null | undefined;
  preferredReadingDepth: ReadingDepth;
  preferredActiveTab: ChapterTab;
  preferredExampleFilter: ExampleFilter;
  preferredFocusMode: boolean;
  preferredFontScale: FontScale;
  onboardingHydrated: boolean;
  effectiveOnboardingComplete: boolean;
  bookAccessStatus: "loading" | "ready" | "blocked";
  hasAttestedSeed: boolean;
  bookPrefs: BookPreferencesState;
  bookPrefsHydrated: boolean;
  dailyGoalMinutes: number;
  onToast: (message: string) => void;
}) {
  const bookProgress = useBookProgress(bookId, chapters, initialProgressFloor);
  const chapterProgress = useChapterState(
    bookId,
    chapterId,
    chapterNumber,
    preferredReadingDepth,
    preferredActiveTab,
    preferredExampleFilter,
    preferredFocusMode,
    preferredFontScale,
    onboardingHydrated && bookPrefsHydrated && Boolean(chapter),
  );

  const chapterState = chapter ? bookProgress.getChapterState(chapter.id) : "locked";
  const isLocked = !hasAttestedSeed && chapterState === "locked";
  const readerInteractionsReady =
    onboardingHydrated &&
    bookProgress.hydrated &&
    chapterProgress.hydrated &&
    bookPrefsHydrated &&
    effectiveOnboardingComplete &&
    bookAccessStatus === "ready" &&
    !isLocked;

  const { getChapterState, setLastReadChapter } = bookProgress;
  useEffect(() => {
    if (!chapter || !readerInteractionsReady) return;
    if (getChapterState(chapter.id) !== "locked") {
      setLastReadChapter(chapter.id);
    }
  }, [chapter, getChapterState, readerInteractionsReady, setLastReadChapter]);

  const readingSession = useReadingSessionTracker({
    bookId,
    chapterId,
    enabled: readerInteractionsReady && bookPrefs.privacy.saveReadingHistory,
    dailyGoalMinutes,
  });

  useScrollResume({
    bookId,
    chapterId,
    enabled: bookPrefsHydrated && bookPrefs.reading.resumeWhereLeftOff,
    ready: readerInteractionsReady && Boolean(chapter),
  });

  const dailyGoalCelebrated = useRef(false);
  const { dailyGoalReached, claimDailyGoalCelebration } = readingSession;
  useEffect(() => {
    if (!dailyGoalReached || dailyGoalCelebrated.current) return;
    dailyGoalCelebrated.current = true;
    // Once per day across chapters and visits, not once per chapter open.
    if (!claimDailyGoalCelebration()) return;
    const persona = bookPrefs.extended.motivationPersona || "coach";
    onToast(getMotivationMessage(persona, "daily_goal", { goal: dailyGoalMinutes }));
  }, [
    bookPrefs.extended.motivationPersona,
    claimDailyGoalCelebration,
    dailyGoalMinutes,
    dailyGoalReached,
    onToast,
  ]);

  useBreakReminder({
    enabled: bookPrefs.extended.breakReminders && readerInteractionsReady,
    intervalMinutes: bookPrefs.extended.breakReminderMinutes,
    paused: chapterProgress.state.activeTab === "quiz",
    onBreak: () => onToast("Time for a quick break — rest your eyes for a moment."),
  });

  return {
    bookProgress,
    chapterProgress,
    readingSession,
    chapterState,
    isLocked,
    readerInteractionsReady,
  };
}
