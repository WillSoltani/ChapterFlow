// Pure maths for the Profile page (PROG-12, PROG-13).

import type { AnalyticsState } from "@/hooks/book/useBookAnalytics";

type SnapshotLite = { book: { id: string; category?: string }; completedChapters: number };

export type StatsAnalytics = Pick<
  AnalyticsState,
  | "streakDays"
  | "longestStreak"
  | "booksCompleted"
  | "totalCompletedChapters"
  | "avgQuizScore"
  | "maxQuizScore"
  | "minutesReadToday"
  | "totalMinutesRead"
> & {
  heatmapCells: ReadonlyArray<{ minutes: number }>;
  bookSnapshots: ReadonlyArray<SnapshotLite>;
};

/** Categories with at least one finished chapter, most chapters first. */
export function exploredCategoriesFrom(
  snapshots: ReadonlyArray<SnapshotLite>
): Array<{ name: string; chapters: number }> {
  const byCategory = new Map<string, number>();
  for (const snapshot of snapshots) {
    const category = snapshot.book.category;
    if (category && snapshot.completedChapters > 0) {
      byCategory.set(category, (byCategory.get(category) ?? 0) + snapshot.completedChapters);
    }
  }
  return Array.from(byCategory.entries())
    .map(([name, chapters]) => ({ name, chapters }))
    .sort((a, b) => b.chapters - a.chapters);
}

export function buildStatsSummary(analytics: StatsAnalytics | null | undefined, quizQuestionsAnswered: number) {
  return {
    currentStreak: analytics?.streakDays ?? 0,
    longestStreak: analytics?.longestStreak ?? 0,
    booksCompleted: analytics?.booksCompleted ?? 0,
    totalChaptersCompleted: analytics?.totalCompletedChapters ?? 0,
    quizQuestionsAnswered,
    averageQuizScore: analytics?.avgQuizScore ?? 0,
    maxQuizScore: analytics?.maxQuizScore ?? 0,
    // All-time minutes; the heatmap only covers the last 12 weeks.
    totalReadingMinutes: analytics?.totalMinutesRead ?? 0,
    categoriesCount: exploredCategoriesFrom(analytics?.bookSnapshots ?? []).length,
    minutesReadToday: analytics?.minutesReadToday ?? 0,
  };
}
