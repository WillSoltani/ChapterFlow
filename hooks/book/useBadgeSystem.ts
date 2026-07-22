"use client";

// Canonical shared badge-system hook (WS3-001).

import { useEffect, useMemo, useState } from "react";
import { fetchBookJson } from "@/lib/client/book-api";
import { useBookQuery, invalidateBookCache } from "@/lib/client/book-api-cache";
import {
  getBookProgressStorageKey,
  getChapterReaderStorageKey,
  parseStoredBookProgress,
  parseStoredReaderState,
} from "@/app/book/_lib/reader-storage";
import { BOOKS_CATALOG } from "@/lib/books-catalog";
import { canonicalizeCategory } from "@/lib/category-taxonomy";
import {
  BADGE_DEFINITIONS,
  evaluateBadges,
  type BadgeCategory,
  type BadgeProgressStats,
  type BadgeState,
} from "@/lib/badges/badge-ui-definitions";
import { getBookChaptersBundle } from "@/app/book/data/bookChapters";
import { mergeBadgeProgressStats } from "@/app/book/_lib/badge-stats";
import { useBookAnalytics } from "@/hooks/book/useBookAnalytics";

const BADGES_KEY = "/app/api/book/me/badges";

type PlanState = "FREE" | "PRO";

type NextMilestone = {
  badge: BadgeState;
  progressPercent: number;
  remaining: number;
  nextStepLabel: string;
  nextTier: BadgeState | null;
};

type BadgeTimelineEntry = {
  id: string;
  badgeId: string;
  icon: string;
  name: string;
  category: BadgeCategory;
  description: string;
  earnedAt: string;
  dateLabel: string;
  notificationStyle: BadgeState["notificationStyle"];
};

type BadgeGroup = {
  category: BadgeCategory;
  title: string;
  description: string;
  badges: BadgeState[];
};

type UseBadgeSystemArgs = {
  selectedBookIds: string[];
  dailyGoalMinutes: number;
  plan?: PlanState;
};

type UseBadgeSystemResult = {
  hydrated: boolean;
  analytics: ReturnType<typeof useBookAnalytics>["analytics"];
  error: ReturnType<typeof useBookAnalytics>["error"];
  refetch: ReturnType<typeof useBookAnalytics>["refetch"];
  badgeStats: BadgeProgressStats | null;
  badges: BadgeState[];
  visibleBadges: BadgeState[];
  earnedBadges: BadgeState[];
  lockedBadges: BadgeState[];
  featuredBadges: BadgeState[];
  recentlyEarned: BadgeState[];
  highestPrestigeBadges: BadgeState[];
  nextMilestones: NextMilestone[];
  badgeTimeline: BadgeTimelineEntry[];
  categoryGroups: BadgeGroup[];
  earnedCount: number;
  visibleCount: number;
};

const BADGE_EARNED_KEY = "book-accelerator:badge-earned:v1";

const CATEGORY_DESCRIPTIONS: Record<BadgeCategory, string> = {
  "Getting Started": "Early wins that turn setup into real reading momentum.",
  Consistency: "Meaningful cadence markers that reinforce return behavior without constant interruption.",
  "Reading Depth": "Badges for moving beyond quick skims into stronger engagement and retention.",
  Mastery: "Performance and review milestones that reflect understanding rather than surface completion.",
  Books: "Major completion markers that represent sustained progress through substantial material.",
  Examples: "Application focused milestones tied to personal, school, and work context usage.",
  Notes: "Quiet reflection markers that reward writing, synthesis, and knowledge capture.",
  Exploration: "Broader library and category discovery that expands the range of your reading practice.",
  Elite: "Subtle premium markers that reward advanced usage without punishing free readers.",
};

const CATEGORY_ORDER: BadgeCategory[] = [
  "Getting Started",
  "Consistency",
  "Reading Depth",
  "Mastery",
  "Books",
  "Examples",
  "Notes",
  "Exploration",
  "Elite",
];

const NEXT_TIER_MAP: Record<string, string> = {
  "streak-3": "streak-7",
  "streak-7": "streak-14",
  "streak-14": "streak-30",
  "goal-5": "goal-10",
  "perfect-one": "perfect-three",
  "quiz-pass-10": "quiz-pass-25",
  "first-chapter": "ten-chapters",
  "ten-chapters": "first-book",
  "first-book": "three-books",
  "three-books": "five-books",
  "focus-finish": "deep-focus-five",
};

function splitNotes(notes: string): string[] {
  return notes
    .split(/\n\s*\n|\n/g)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function dayKeyToDate(dayKey: string): Date {
  return new Date(`${dayKey}T12:00:00`);
}

function getWeekKey(dayKey: string): string {
  const date = dayKeyToDate(dayKey);
  const day = date.getDay() || 7;
  date.setDate(date.getDate() + 4 - day);
  const yearStart = new Date(date.getFullYear(), 0, 1);
  const week = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${date.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

function formatEarnedDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function deriveBadgeStats(
  analytics: NonNullable<UseBadgeSystemResult["analytics"]>,
  dailyGoalMinutes: number,
  plan: PlanState,
  selectedBookIds: string[]
): BadgeProgressStats {
  const bookProgressEntries = BOOKS_CATALOG.map((book) => ({
    book,
    stored: parseStoredBookProgress(
      window.localStorage.getItem(getBookProgressStorageKey(book.id))
    ),
  }));

  const activityDayKeys = analytics.heatmapCells.filter((cell) => cell.minutes > 0).map((cell) => cell.key);
  const uniqueWeeks = new Set(activityDayKeys.map(getWeekKey));
  const sortedActivityDays = [...activityDayKeys].sort();

  let recoveredAfterMiss = 0;
  let returnedAfterLongGap = 0;
  for (let index = 1; index < sortedActivityDays.length; index += 1) {
    // index ∈ [1, len): both index-1 and index are in-bounds.
    const previous = dayKeyToDate(sortedActivityDays[index - 1]!);
    const current = dayKeyToDate(sortedActivityDays[index]!);
    const gapDays = Math.round((current.getTime() - previous.getTime()) / 86400000);
    if (gapDays >= 2 && gapDays <= 3) recoveredAfterMiss += 1;
    if (gapDays >= 10) returnedAfterLongGap += 1;
  }

  let quizzesPassed = 0;
  let perfectQuizCount = 0;
  let distinctQuizBooks = 0;
  let quizzesPassedInDeeperMode = 0;
  let quizCount = 0;
  let totalQuizQuestionsAnswered = 0;
  let chaptersSimpleCompleted = 0;
  let chaptersStandardCompleted = 0;
  let chaptersDeeperCompleted = 0;
  let chaptersCompletedWithFocusMode = 0;
  let completedChaptersWithNotes = 0;
  let completedBooksInDeeperMode = 0;
  let examplesViewedChapters = 0;
  const viewedExampleContexts = new Set<"personal" | "school" | "work">();
  let personalExamplesChapters = 0;
  let schoolExamplesChapters = 0;
  let workExamplesChapters = 0;
  let notesCount = 0;
  const noteBooks = new Set<string>();
  let completedChaptersWithReflection = 0;
  let strategyBooksCompleted = 0;
  let psychologyBooksCompleted = 0;
  let challengingBooksStarted = 0;
  let challengingBooksCompleted = 0;
  let booksCompletedWithAllQuizzesPassed = 0;
  let recapCompletions = 0;

  const startedCategories = new Set<string>();
  const completedCategories = new Set<string>();
  const usedReadingModes = new Set<"simple" | "standard" | "deeper">();

  for (const { book, stored } of bookProgressEntries) {
    if (!stored) continue;

    const completedChapterIds = new Set(stored.completedChapterIds);
    const chapterIds = getBookChaptersBundle(book.id).chapters.map((chapter) => chapter.id);
    // "Started" = real reading engagement, not a mere browse. A book-progress
    // entry is created (with currentChapterId pre-set to the first chapter and an
    // epoch lastOpenedAt) the moment a book DETAIL page hydrates — so
    // currentChapterId can't distinguish "opened the reader" from "looked at the
    // detail page". lastOpenedAt only becomes a real timestamp once the reader is
    // actually opened, so it (plus completions/scores) is the honest signal.
    const isStarted =
      completedChapterIds.size > 0 ||
      Object.keys(stored.chapterScores).length > 0 ||
      stored.lastOpenedAt !== new Date(0).toISOString();
    const isCompleted = chapterIds.length > 0 && completedChapterIds.size >= chapterIds.length;

    // DI-3: canonicalize so this client (localStorage) deriver counts distinct
    // categories on the SAME controlled vocabulary as the server badge-stats
    // deriver. The two are combined via mergeBadgeProgressStats (Math.max), so
    // they must agree — otherwise an un-canonicalized count here could re-inflate
    // the explored/completed-category metric the server path just normalized.
    const canonicalCategory = canonicalizeCategory(book.category);
    if (isStarted) {
      startedCategories.add(canonicalCategory);
      if (book.difficulty === "Hard") challengingBooksStarted += 1;
    }
    if (isCompleted) {
      completedCategories.add(canonicalCategory);
      if (book.difficulty === "Hard") challengingBooksCompleted += 1;
      const categoryLower = canonicalCategory.toLowerCase();
      if (categoryLower.includes("strategy")) strategyBooksCompleted += 1;
      if (categoryLower.includes("psychology")) psychologyBooksCompleted += 1;
    }

    const passedQuizChapters = new Set<string>();
    let allCompletedInDeeperMode = isCompleted;
    let allChapterQuizzesPassed = isCompleted;
    let bookHasPassedQuiz = false;

    for (const chapterId of chapterIds) {
      const reader = parseStoredReaderState(
        window.localStorage.getItem(getChapterReaderStorageKey(book.id, chapterId))
      );
      const hasNotes = Boolean(reader?.notes.trim());
      const noteEntries = splitNotes(reader?.notes ?? "");
      const isChapterCompleted = completedChapterIds.has(chapterId);
      const chapterScore = Number(stored.chapterScores[chapterId] ?? 0);
      const quizScore = reader?.quizResult?.score ?? chapterScore;
      const quizPassed = reader?.quizResult?.passed ?? chapterScore >= 80;
      const readingDepth = reader?.readingDepth ?? "deeper";

      usedReadingModes.add(readingDepth);
      totalQuizQuestionsAnswered += Object.keys(reader?.quizAnswers ?? {}).length;

      if (reader?.quizResult || chapterScore > 0) {
        quizCount += 1;
      }
      if (quizPassed) {
        quizzesPassed += 1;
        passedQuizChapters.add(chapterId);
        bookHasPassedQuiz = true;
        if (readingDepth === "deeper") quizzesPassedInDeeperMode += 1;
      }
      if (quizScore >= 100) perfectQuizCount += 1;
      if (reader?.showRecap && quizPassed) recapCompletions += 1;

      // Only count a chapter as "examples viewed" when persisted reader state
      // actually exists. Without the `reader` guard, an untouched chapter (null
      // reader → `reader?.exampleFilter !== "all"` is `undefined !== "all"` =
      // true) is falsely counted, inflating Applied Reading for zero-read
      // accounts. Mirrors the server deriver in badge-stats.ts.
      if (reader && (reader.activeTab === "examples" || reader.exampleFilter !== "all")) {
        examplesViewedChapters += 1;
      }
      if (reader?.exampleFilter === "personal") {
        personalExamplesChapters += 1;
        viewedExampleContexts.add("personal");
      }
      if (reader?.exampleFilter === "school") {
        schoolExamplesChapters += 1;
        viewedExampleContexts.add("school");
      }
      if (reader?.exampleFilter === "work") {
        workExamplesChapters += 1;
        viewedExampleContexts.add("work");
      }

      if (hasNotes) {
        notesCount += Math.max(noteEntries.length, 1);
        noteBooks.add(book.id);
      }

      if (isChapterCompleted) {
        if (readingDepth === "simple") chaptersSimpleCompleted += 1;
        if (readingDepth === "standard") chaptersStandardCompleted += 1;
        if (readingDepth === "deeper") chaptersDeeperCompleted += 1;
        if (reader?.focusMode) chaptersCompletedWithFocusMode += 1;
        if (hasNotes) {
          completedChaptersWithNotes += 1;
          completedChaptersWithReflection += 1;
        }
        if (readingDepth !== "deeper") allCompletedInDeeperMode = false;
        if (!quizPassed) allChapterQuizzesPassed = false;
      }
    }

    if (bookHasPassedQuiz) distinctQuizBooks += 1;
    if (isCompleted && allCompletedInDeeperMode) completedBooksInDeeperMode += 1;
    if (isCompleted && allChapterQuizzesPassed) booksCompletedWithAllQuizzesPassed += 1;
  }

  const completedGoalDays = analytics.heatmapCells.filter(
    (cell) => cell.minutes >= Math.max(dailyGoalMinutes, 1)
  ).length;
  const weekendActiveDays = activityDayKeys.filter((key) => {
    const day = dayKeyToDate(key).getDay();
    return day === 0 || day === 6;
  }).length;
  const weekdayActiveDays = activityDayKeys.filter((key) => {
    const day = dayKeyToDate(key).getDay();
    return day >= 1 && day <= 5;
  }).length;

  return {
    totalCompletedChapters: analytics.totalCompletedChapters,
    completedBooks: analytics.booksCompleted,
    // Mirror the `isStarted` predicate above: a book counts as started only on
    // real reading engagement, not a browsed detail page (which pre-sets
    // currentChapterId but leaves lastOpenedAt at the epoch). This is what feeds
    // the "Book in Motion" badge.
    startedBooks: bookProgressEntries.filter(({ stored }) => {
      if (!stored) return false;
      return (
        stored.completedChapterIds.length > 0 ||
        Object.keys(stored.chapterScores).length > 0 ||
        stored.lastOpenedAt !== new Date(0).toISOString()
      );
    }).length,
    streakDays: analytics.streakDays,
    longestStreak: analytics.longestStreak,
    avgQuizScore: analytics.avgQuizScore,
    maxQuizScore: analytics.maxQuizScore,
    quizzesPassed,
    perfectQuizCount,
    distinctQuizBooks,
    quizzesPassedInDeeperMode,
    quizCount,
    totalQuizQuestionsAnswered,
    completedGoalDays,
    activeWeeks: uniqueWeeks.size,
    totalActiveDays: activityDayKeys.length,
    weekendActiveDays,
    weekdayActiveDays,
    recoveredAfterMiss,
    chaptersSimpleCompleted,
    chaptersStandardCompleted,
    chaptersDeeperCompleted,
    usedAllReadingModes: usedReadingModes.size >= 3,
    chaptersCompletedWithFocusMode,
    completedChaptersWithNotes,
    completedBooksInDeeperMode,
    examplesViewedChapters,
    viewedExampleContexts: [...viewedExampleContexts],
    personalExamplesChapters,
    schoolExamplesChapters,
    workExamplesChapters,
    notesCount,
    noteBooksCount: noteBooks.size,
    completedChaptersWithReflection,
    exploredCategories: startedCategories.size,
    challengingBooksStarted,
    returnedAfterLongGap,
    readingListCount: selectedBookIds.length,
    challengingBooksCompleted,
    strategyBooksCompleted,
    psychologyBooksCompleted,
    completedCategoriesCount: completedCategories.size,
    booksCompletedWithAllQuizzesPassed,
    proActivated: plan === "PRO",
    proMultiTrack:
      plan === "PRO" &&
      analytics.bookSnapshots.filter((snapshot) => snapshot.status === "in_progress").length >= 3,
    recapCompletions,
  };
}

function sortBadges(badges: BadgeState[]): BadgeState[] {
  return [...badges].sort((left, right) => {
    if (left.earned !== right.earned) return left.earned ? -1 : 1;
    if (left.prestige !== right.prestige) return right.prestige - left.prestige;
    if (left.progressValue !== right.progressValue) return right.progressValue - left.progressValue;
    return left.name.localeCompare(right.name);
  });
}

function uniqueBadges(badges: BadgeState[]): BadgeState[] {
  const seen = new Set<string>();
  return badges.filter((badge) => {
    if (seen.has(badge.id)) return false;
    seen.add(badge.id);
    return true;
  });
}

function buildNextMilestones(badges: BadgeState[]): NextMilestone[] {
  return badges
    .filter((badge) => !badge.earned && badge.isVisible)
    .map((badge) => {
      const progressPercent =
        badge.targetValue > 0
          ? Math.max(0, Math.min(100, Math.round((badge.progressValue / badge.targetValue) * 100)))
          : 0;
      const nextTier = badges.find((entry) => entry.id === NEXT_TIER_MAP[badge.id]) ?? null;
      return {
        badge,
        progressPercent,
        remaining: Math.max(badge.targetValue - badge.progressValue, 0),
        nextStepLabel: `${Math.max(badge.targetValue - badge.progressValue, 0)} to go`,
        nextTier,
      };
    })
    .sort((left, right) => {
      if (left.progressPercent !== right.progressPercent) return right.progressPercent - left.progressPercent;
      if (left.remaining !== right.remaining) return left.remaining - right.remaining;
      return right.badge.prestige - left.badge.prestige;
    })
    .slice(0, 4);
}

export function useBadgeSystem({
  selectedBookIds,
  dailyGoalMinutes,
  plan = "FREE",
}: UseBadgeSystemArgs): UseBadgeSystemResult {
  const { analytics, hydrated, error, refetch } = useBookAnalytics(selectedBookIds, dailyGoalMinutes);
  const [earnedHistory, setEarnedHistory] = useState<Record<string, string>>({});

  // No hand-rolled focus/storage listener here: `badgeStats` is derived from
  // `analytics`, which the shared cache revalidates on focus/storage/book-storage
  // (via useBookAnalytics -> useDashboardQuery), so a refresh recomputes badges
  // automatically. See WS3-022/WS3-023.

  const badgesQuery = useBookQuery<{ awards: Array<{ badgeId: string; earnedAt: string }> }>(
    BADGES_KEY
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const localFallback = (() => {
      try {
        const raw = window.localStorage.getItem(BADGE_EARNED_KEY);
        return raw ? (JSON.parse(raw) as Record<string, string>) : {};
      } catch {
        return {};
      }
    })();

    setEarnedHistory(localFallback);
  }, []);

  useEffect(() => {
    if (!badgesQuery.data) return;
    const next = Object.fromEntries(
      badgesQuery.data.awards.map((award) => [award.badgeId, award.earnedAt])
    );
    window.localStorage.setItem(BADGE_EARNED_KEY, JSON.stringify(next));
    setEarnedHistory(next);
  }, [badgesQuery.data]);

  const badgeStats = useMemo(() => {
    if (!hydrated || !analytics) return null;
    // Merge server-truth stats (device-independent, from /me/dashboard) with the
    // localStorage-derived stats, taking the more-progressed value per field.
    // This keeps badges device-independent without regressing users whose
    // local progress hasn't fully synced to the server (or vice-versa) during
    // the reader migration.
    const local = deriveBadgeStats(analytics, dailyGoalMinutes, plan, selectedBookIds);
    return analytics.badgeStats
      ? mergeBadgeProgressStats(analytics.badgeStats, local)
      : local;
  }, [analytics, dailyGoalMinutes, hydrated, plan, selectedBookIds]);

  const badges = useMemo(() => {
    if (!badgeStats) return [] as BadgeState[];
    return sortBadges(
      evaluateBadges(badgeStats, earnedHistory).map((badge) => ({
        ...badge,
        nextTierId: NEXT_TIER_MAP[badge.id],
      }))
    );
  }, [badgeStats, earnedHistory]);

  useEffect(() => {
    if (!badges.length || typeof window === "undefined") return;
    const now = Date.now();
    const newEntries = badges.filter((badge) => badge.earned && !earnedHistory[badge.id]);
    if (!newEntries.length) return;

    const next = { ...earnedHistory };
    newEntries.forEach((badge, index) => {
      next[badge.id] = new Date(now + index * 1000).toISOString();
    });
    setEarnedHistory(next);
    window.localStorage.setItem(BADGE_EARNED_KEY, JSON.stringify(next));
    newEntries.forEach((badge) => {
      fetchBookJson(BADGES_KEY, {
        method: "PUT",
        body: JSON.stringify({
          badgeId: badge.id,
          earnedAt: next[badge.id],
          tier: badge.tier,
        }),
      }).catch(() => {});
    });
    // New awards were written — drop the cached /me/badges read so a later mount
    // reflects them.
    invalidateBookCache(BADGES_KEY);
  }, [badges, earnedHistory]);

  const visibleBadges = useMemo(() => badges.filter((badge) => badge.isVisible), [badges]);
  const earnedBadges = useMemo(
    () =>
      visibleBadges
        .filter((badge) => badge.earned)
        .sort((left, right) => {
          const leftTime = left.earnedAt ? new Date(left.earnedAt).getTime() : 0;
          const rightTime = right.earnedAt ? new Date(right.earnedAt).getTime() : 0;
          if (leftTime !== rightTime) return rightTime - leftTime;
          return right.prestige - left.prestige;
        }),
    [visibleBadges]
  );
  const lockedBadges = useMemo(() => visibleBadges.filter((badge) => !badge.earned), [visibleBadges]);

  const recentlyEarned = useMemo(() => earnedBadges.slice(0, 6), [earnedBadges]);
  const highestPrestigeBadges = useMemo(
    () =>
      [...earnedBadges]
        .sort((left, right) => {
          if (left.prestige !== right.prestige) return right.prestige - left.prestige;
          return left.name.localeCompare(right.name);
        })
        .slice(0, 6),
    [earnedBadges]
  );

  const featuredBadges = useMemo(
    () => uniqueBadges([...recentlyEarned.slice(0, 3), ...highestPrestigeBadges.slice(0, 3)]).slice(0, 6),
    [highestPrestigeBadges, recentlyEarned]
  );

  const nextMilestones = useMemo(() => buildNextMilestones(visibleBadges), [visibleBadges]);

  const badgeTimeline = useMemo<BadgeTimelineEntry[]>(
    () =>
      earnedBadges
        .filter((badge): badge is BadgeState & { earnedAt: string } => Boolean(badge.earnedAt))
        .slice(0, 10)
        .map((badge) => ({
          id: `timeline-${badge.id}`,
          badgeId: badge.id,
          icon: badge.icon,
          name: badge.name,
          category: badge.category,
          description: badge.description,
          earnedAt: badge.earnedAt,
          dateLabel: formatEarnedDate(badge.earnedAt),
          notificationStyle: badge.notificationStyle,
        })),
    [earnedBadges]
  );

  const categoryGroups = useMemo<BadgeGroup[]>(
    () =>
      CATEGORY_ORDER.map((category) => ({
        category,
        title: category,
        description: CATEGORY_DESCRIPTIONS[category],
        badges: visibleBadges.filter((badge) => badge.category === category),
      })).filter((group) => group.badges.length > 0),
    [visibleBadges]
  );

  return {
    hydrated,
    analytics,
    error,
    refetch,
    badgeStats,
    badges,
    visibleBadges,
    earnedBadges,
    lockedBadges,
    featuredBadges,
    recentlyEarned,
    highestPrestigeBadges,
    nextMilestones,
    badgeTimeline,
    categoryGroups,
    earnedCount: earnedBadges.length,
    visibleCount: visibleBadges.length,
  };
}

export const BADGE_CATEGORY_COPY = CATEGORY_DESCRIPTIONS;
export const BADGE_CATEGORY_ORDER = CATEGORY_ORDER;
export const BADGE_TIER_SUCCESSION = NEXT_TIER_MAP;
export const BADGE_ALL_IDS = BADGE_DEFINITIONS.map((badge) => badge.id);
