"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchBookJson } from "@/app/book/_lib/book-api";
import type { StoredReaderStateSnapshot } from "@/app/book/_lib/reader-storage";
import { getBookChaptersBundle } from "@/app/book/data/mockChapters";
import {
  buildLibraryCatalog,
  type LibraryBookEntry,
} from "@/app/book/data/mockUserLibraryState";
import { BOOK_STORAGE_EVENT } from "@/app/book/hooks/bookStorageEvents";
import {
  toDayKey,
} from "@/app/book/library/hooks/readingActivityStorage";

type DashboardPayload = {
  catalog: Array<{
    bookId: string;
  }>;
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
  }>;
  chapterStates: Array<{
    bookId: string;
    chapterNumber: number;
    chapterId?: string;
    state: Record<string, unknown>;
  }>;
  readingDays: Array<{
    dayKey: string;
    totalActiveMs: number;
  }>;
};

type CompletionActivity = {
  bookId: string;
  chapterId: string;
  completedAt: string;
  dayKey: string;
};

export type BookProgressSnapshot = {
  book: LibraryBookEntry;
  status: "completed" | "in_progress" | "not_started";
  completedChapters: number;
  totalChapters: number;
  progressPercent: number;
  bestScore: number;
  avgScore: number;
  lastOpenedLabel: string;
  lastActivityAt: string;
  resumeChapterId: string;
};

export type HeatmapCell = {
  key: string;
  dateLabel: string;
  minutes: number;
  chapters: number;
  level: number;
};

export type UpcomingReviewItem = {
  id: string;
  prompt: string;
  dueLabel: string;
  bookId: string;
};

export type AnalyticsState = {
  streakDays: number;
  dailyGoalMinutes: number;
  minutesReadToday: number;
  booksCompleted: number;
  avgQuizScore: number;
  maxQuizScore: number;
  totalCompletedChapters: number;
  longestStreak: number;
  lastActiveLabel: string;
  bookSnapshots: BookProgressSnapshot[];
  engagedBookSnapshots: BookProgressSnapshot[];
  completedBookSnapshots: BookProgressSnapshot[];
  inProgressBookSnapshots: BookProgressSnapshot[];
  heatmapCells: HeatmapCell[];
  upcomingReviews: UpcomingReviewItem[];
  hasAnyProgress: boolean;
  hasAnyEngagement: boolean;
};

const EMPTY_ACTIVITY_LABEL = "No activity yet";

function dayKeyToDate(dayKey: string): Date {
  return new Date(`${dayKey}T12:00:00`);
}

function previousDayKey(dayKey: string): string {
  const date = dayKeyToDate(dayKey);
  date.setDate(date.getDate() - 1);
  return toDayKey(date);
}

function formatDayLabel(dayKey: string): string {
  return dayKeyToDate(dayKey).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatRelativeDayLabel(dayKey: string | null): string {
  if (!dayKey) return EMPTY_ACTIVITY_LABEL;
  const today = toDayKey(new Date());
  if (dayKey === today) return "Today";
  if (dayKey === previousDayKey(today)) return "Yesterday";
  return formatDayLabel(dayKey);
}

function hasMeaningfulReaderActivity(
  reader: StoredReaderStateSnapshot | Record<string, unknown> | null
): boolean {
  if (!reader || typeof reader !== "object") return false;

  const notes = typeof reader.notes === "string" ? reader.notes : "";
  if (notes.trim().length > 0) return true;

  const quizAnswers =
    reader.quizAnswers && typeof reader.quizAnswers === "object" && !Array.isArray(reader.quizAnswers)
      ? (reader.quizAnswers as Record<string, unknown>)
      : {};
  if (Object.keys(quizAnswers).length > 0) return true;

  const quizResult = reader.quizResult;
  if (
    quizResult &&
    typeof quizResult === "object" &&
    typeof (quizResult as { score?: unknown }).score === "number"
  ) {
    return true;
  }

  if (reader.showRecap === true) return true;
  return false;
}

function chapterLabelById(bookId: string, chapterId: string): string {
  if (!chapterId) return "Not started";
  const chapter = getBookChaptersBundle(bookId).chapters.find(
    (item) => item.id === chapterId
  );
  if (!chapter) return "Not started";
  return `${chapter.code} ${chapter.title}`;
}

function statusFromCounts(
  completed: number,
  total: number
): "completed" | "in_progress" | "not_started" {
  if (total > 0 && completed >= total) return "completed";
  if (completed > 0) return "in_progress";
  return "not_started";
}

function buildFallbackAnalytics(
  localEntries: LibraryBookEntry[],
  dailyGoalMinutes: number
): AnalyticsState {
  const bookSnapshots = localEntries.map((entry): BookProgressSnapshot => {
    const chapters = getBookChaptersBundle(entry.id).chapters;
    const totalChapters = chapters.length || entry.chaptersTotal;

    return {
      book: entry,
      status: "not_started",
      completedChapters: 0,
      totalChapters,
      progressPercent: 0,
      bestScore: 0,
      avgScore: 0,
      lastOpenedLabel: "Not started",
      lastActivityAt: entry.lastActivityAt,
      resumeChapterId: chapters[0]?.id ?? "",
    };
  });

  return {
    streakDays: 0,
    dailyGoalMinutes,
    minutesReadToday: 0,
    booksCompleted: 0,
    avgQuizScore: 0,
    maxQuizScore: 0,
    totalCompletedChapters: 0,
    longestStreak: 0,
    lastActiveLabel: EMPTY_ACTIVITY_LABEL,
    bookSnapshots,
    engagedBookSnapshots: [],
    completedBookSnapshots: [],
    inProgressBookSnapshots: [],
    heatmapCells: buildHeatmap(new Map()),
    upcomingReviews: [],
    hasAnyProgress: false,
    hasAnyEngagement: false,
  };
}

function buildActivities(
  bookId: string,
  chapterCompletedAt: Record<string, string>
): CompletionActivity[] {
  const chapters = getBookChaptersBundle(bookId).chapters;
  const chapterMap = new Map(chapters.map((chapter) => [chapter.id, chapter]));

  return Object.entries(chapterCompletedAt)
    .map(([chapterId, completedAt]) => {
      const chapter = chapterMap.get(chapterId);
      if (!chapter) return null;
      const dayKey = toDayKey(completedAt);
      if (!dayKey) return null;
      return {
        bookId,
        chapterId,
        completedAt,
        dayKey,
      };
    })
    .filter((activity): activity is CompletionActivity => Boolean(activity));
}

function buildHeatmap(
  activityByDay: Map<string, { activeMs: number; chapters: number }>
): HeatmapCell[] {
  const cells: HeatmapCell[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let offset = 83; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - offset);
    const dayKey = toDayKey(date);
    const stats = activityByDay.get(dayKey) ?? { activeMs: 0, chapters: 0 };
    const minutes = Math.floor(stats.activeMs / 60000);

    const level =
      minutes <= 0
        ? 0
        : minutes < 15
          ? 1
          : minutes < 30
            ? 2
            : minutes < 50
              ? 3
              : 4;

    cells.push({
      key: dayKey,
      dateLabel: date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
      minutes,
      chapters: stats.chapters,
      level,
    });
  }

  return cells;
}

function calculateCurrentStreak(activityDays: Set<string>): number {
  if (activityDays.size === 0) return 0;

  let cursor = toDayKey(new Date());
  let streak = 0;

  while (activityDays.has(cursor)) {
    streak += 1;
    cursor = previousDayKey(cursor);
  }

  return streak;
}

function calculateLongestStreak(dayKeys: string[]): number {
  if (!dayKeys.length) return 0;

  let longest = 1;
  let current = 1;

  for (let index = 1; index < dayKeys.length; index += 1) {
    const previous = dayKeys[index - 1];
    const currentDay = dayKeys[index];
    if (previousDayKey(currentDay) === previous) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 1;
    }
  }

  return longest;
}

export function useBookAnalytics(selectedBookIds: string[], dailyGoalMinutes: number) {
  const [hydrated, setHydrated] = useState(false);
  const [analytics, setAnalytics] = useState<AnalyticsState | null>(null);
  const [revision, setRevision] = useState(0);

  const seedKey = useMemo(
    () => `${selectedBookIds.join("|")}::${dailyGoalMinutes}`,
    [dailyGoalMinutes, selectedBookIds]
  );

  useEffect(() => {
    function onStorageChange() {
      setRevision((value) => value + 1);
    }

    window.addEventListener(BOOK_STORAGE_EVENT, onStorageChange as EventListener);
    window.addEventListener("storage", onStorageChange);
    window.addEventListener("focus", onStorageChange);
    return () => {
      window.removeEventListener(BOOK_STORAGE_EVENT, onStorageChange as EventListener);
      window.removeEventListener("storage", onStorageChange);
      window.removeEventListener("focus", onStorageChange);
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const payload = await fetchBookJson<DashboardPayload>("/app/api/book/me/dashboard");
        if (!mounted) return;

        const progressRows = Array.isArray(payload.progress) ? payload.progress : [];
        const bookStateRows = Array.isArray(payload.bookStates) ? payload.bookStates : [];
        const chapterStateRows = Array.isArray(payload.chapterStates) ? payload.chapterStates : [];
        const readingDayRows = Array.isArray(payload.readingDays) ? payload.readingDays : [];
        const localEntries = buildLibraryCatalog();
        const entries = localEntries;
        const progressByBook = new Map(progressRows.map((item) => [item.bookId, item]));
        const stateByBook = new Map(bookStateRows.map((item) => [item.bookId, item]));
        const chapterStatesByBook = new Map<string, Array<DashboardPayload["chapterStates"][number]>>();
        chapterStateRows.forEach((item) => {
          const current = chapterStatesByBook.get(item.bookId) ?? [];
          current.push(item);
          chapterStatesByBook.set(item.bookId, current);
        });

        const allActivities: CompletionActivity[] = [];
        const readingByDay = new Map<string, { activeMs: number; chapters: number }>();
        readingDayRows.forEach((item) => {
          readingByDay.set(item.dayKey, {
            activeMs: item.totalActiveMs,
            chapters: readingByDay.get(item.dayKey)?.chapters ?? 0,
          });
        });

        const bookSnapshots = entries.map((entry): BookProgressSnapshot => {
          const chaptersBundle = getBookChaptersBundle(entry.id);
          const chapters = chaptersBundle.chapters;
          const totalChapters = chapters.length || entry.chaptersTotal;
          const state = stateByBook.get(entry.id);
          const progress = progressByBook.get(entry.id);

          if (!state && !progress) {
            return {
              book: entry,
              status: "not_started",
              completedChapters: 0,
              totalChapters,
              progressPercent: 0,
              bestScore: 0,
              avgScore: 0,
              lastOpenedLabel: "Not started",
              lastActivityAt: entry.lastActivityAt,
              resumeChapterId: chapters[0]?.id ?? "",
            };
          }

          const chapterCompletedAt = state?.chapterCompletedAt ?? {};
          const activities = buildActivities(entry.id, chapterCompletedAt);
          allActivities.push(...activities);

          const completedChapters = new Set(
            state?.completedChapterIds ??
              (progress?.completedChapters ?? [])
                .map((chapterNumber) => chapters.find((chapter) => chapter.order === chapterNumber)?.id ?? "")
                .filter(Boolean)
          ).size;
          const status = statusFromCounts(completedChapters, totalChapters);
          const progressPercent = totalChapters
            ? Math.min(100, Math.round((completedChapters / totalChapters) * 100))
            : 0;

          const scoreValues = Object.values(
            state?.chapterScores ??
              Object.fromEntries(
                Object.entries(progress?.bestScoreByChapter ?? {}).map(([chapterNumber, score]) => {
                  const chapterId = chapters.find(
                    (chapter) => chapter.order === Number(chapterNumber)
                  )?.id;
                  return chapterId ? [chapterId, score] : null;
                }).filter((item): item is [string, number] => Boolean(item))
              )
          ).map((value) => Number(value));

          const bestScore = scoreValues.length ? Math.max(...scoreValues) : 0;
          const avgScore = scoreValues.length
            ? Math.round(scoreValues.reduce((sum, value) => sum + value, 0) / scoreValues.length)
            : 0;

          const resumeChapterId =
            state?.currentChapterId ||
            chapters.find(
              (chapter) => chapter.order === (progress?.currentChapterNumber ?? 1)
            )?.id ||
            chapters[0]?.id ||
            "";

          const lastActivityAt =
            state?.lastOpenedAt ||
            progress?.lastActiveAt ||
            progress?.lastOpenedAt ||
            entry.lastActivityAt;

          return {
            book: entry,
            status,
            completedChapters,
            totalChapters,
            progressPercent,
            bestScore,
            avgScore,
            lastOpenedLabel:
              state?.lastReadChapterId && state.lastOpenedAt !== new Date(0).toISOString()
                ? chapterLabelById(entry.id, state.lastReadChapterId)
                : "Not started",
            lastActivityAt,
            resumeChapterId,
          };
        });

        const engagedBookSnapshots = bookSnapshots.filter((snapshot) => {
          const state = stateByBook.get(snapshot.book.id);
          const chapterStates = chapterStatesByBook.get(snapshot.book.id) ?? [];
          const hasCompletedChapter = snapshot.completedChapters > 0;
          const hasQuizScore = Object.values(state?.chapterScores ?? {}).some(
            (score) => Number(score) > 0
          );
          const hasReaderActivity = chapterStates.some((item) =>
            hasMeaningfulReaderActivity(item.state as StoredReaderStateSnapshot | null)
          );
          return hasCompletedChapter || hasQuizScore || hasReaderActivity;
        });

        for (const activity of allActivities) {
          const current = readingByDay.get(activity.dayKey) ?? { activeMs: 0, chapters: 0 };
          readingByDay.set(activity.dayKey, {
            activeMs: current.activeMs,
            chapters: current.chapters + 1,
          });
        }

        const activityDays = Array.from(readingByDay.entries())
          .filter(([, stats]) => stats.activeMs > 0)
          .map(([dayKey]) => dayKey)
          .sort();
        const todayKey = toDayKey(new Date());
        const todayStats = readingByDay.get(todayKey) ?? { activeMs: 0, chapters: 0 };

        const scoreValues = bookSnapshots
          .map((item) => item.avgScore)
          .filter((score) => score > 0);
        const avgQuizScore = scoreValues.length
          ? Math.round(scoreValues.reduce((sum, score) => sum + score, 0) / scoreValues.length)
          : 0;
        const maxQuizScore = Math.max(0, ...bookSnapshots.map((item) => item.bestScore));
        const booksCompleted = bookSnapshots.filter((item) => item.status === "completed").length;
        const totalCompletedChapters = bookSnapshots.reduce(
          (sum, item) => sum + item.completedChapters,
          0
        );
        const currentStreak = calculateCurrentStreak(new Set(activityDays));
        const longestStreak = calculateLongestStreak(activityDays);
        const heatmapCells = buildHeatmap(readingByDay);
        const completedBookSnapshots = engagedBookSnapshots.filter((item) => item.status === "completed");
        const inProgressBookSnapshots = engagedBookSnapshots.filter((item) => item.status === "in_progress");
        const upcomingReviews: UpcomingReviewItem[] = inProgressBookSnapshots.slice(0, 3).map((item, index) => {
          const dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + index + 1);
          return {
            id: `${item.book.id}-review-${index}`,
            prompt: `Review ${item.book.title}: chapter ${Math.max(item.completedChapters, 1)} takeaways`,
            dueLabel: dueDate.toLocaleDateString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
            }),
            bookId: item.book.id,
          };
        });

        setAnalytics({
          streakDays: currentStreak,
          dailyGoalMinutes,
          minutesReadToday: Math.floor(todayStats.activeMs / 60000),
          booksCompleted,
          avgQuizScore,
          maxQuizScore,
          totalCompletedChapters,
          longestStreak,
          lastActiveLabel: formatRelativeDayLabel(activityDays.at(-1) ?? null),
          bookSnapshots,
          engagedBookSnapshots,
          completedBookSnapshots,
          inProgressBookSnapshots,
          heatmapCells,
          upcomingReviews,
          hasAnyProgress: totalCompletedChapters > 0,
          hasAnyEngagement: engagedBookSnapshots.length > 0,
        });
        setHydrated(true);
      } catch {
        if (!mounted) return;
        const localEntries = buildLibraryCatalog();
        setAnalytics(buildFallbackAnalytics(localEntries, dailyGoalMinutes));
        setHydrated(true);
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, [seedKey, dailyGoalMinutes, revision]);

  return {
    hydrated,
    analytics,
  };
}
