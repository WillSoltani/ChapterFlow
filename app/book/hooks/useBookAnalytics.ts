"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchBookJson } from "@/app/book/_lib/book-api";
import { getBookErrorMessage } from "@/app/book/_lib/error-messages";
import { useDashboardQuery, type DashboardQueryPayload } from "@/app/book/hooks/useDashboardQuery";
import type { LibraryCatalogBook } from "@/app/book/_lib/library-data";
import type { StoredReaderStateSnapshot } from "@/app/book/_lib/reader-storage";
import { getBookChaptersBundle } from "@/app/book/data/bookChapters";
import {
  buildLibraryCatalog,
  type LibraryBookEntry,
} from "@/app/book/data/libraryState";
import {
  computeBadgeProgressStats,
  type BadgeStatsBook,
  type ChapterReaderSignals,
  type ReadingDepth,
} from "@/app/book/_lib/badge-stats";
import type { BadgeProgressStats } from "@/app/book/badges/lib/badge-ui-definitions";
import { canonicalizeCategory } from "@/lib/category-taxonomy";
import {
  toDayKey,
} from "@/app/book/library/hooks/readingActivityStorage";

const DEFAULT_LAST_ACTIVITY = new Date(0).toISOString();

// The aggregate is fetched once by the canonical useDashboardQuery (WS3-025);
// this hook only parses the shared payload. The local alias keeps the internal
// references below reading against the single canonical shape.
type DashboardPayload = DashboardQueryPayload;

type CompletionActivity = {
  bookId: string;
  chapterId: string;
  completedAt: string;
  dayKey: string;
};

export type LoopStep = "summary" | "scenarios" | "quiz" | "unlock";

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
  currentLoopStep: LoopStep | null;
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
  totalMinutesRead: number;
  booksCompleted: number;
  avgQuizScore: number;
  maxQuizScore: number;
  totalCompletedChapters: number;
  longestStreak: number;
  lastActiveLabel: string;
  bookSnapshots: BookProgressSnapshot[];
  engagedBookSnapshots: BookProgressSnapshot[];
  recentlyOpenedSnapshots: BookProgressSnapshot[];
  completedBookSnapshots: BookProgressSnapshot[];
  inProgressBookSnapshots: BookProgressSnapshot[];
  heatmapCells: HeatmapCell[];
  upcomingReviews: UpcomingReviewItem[];
  hasAnyProgress: boolean;
  hasAnyEngagement: boolean;
  earnedBadgeIds: Set<string>;
  isPro: boolean;
  insightPoints: number;
  starterShelf: string[];
  savedBookIds: string[];
  interests: string[];
  motivation: string | null;
  badgeStats: BadgeProgressStats;
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

function deriveLoopStep(
  readerState: Record<string, unknown> | null,
  isChapterCompleted: boolean
): LoopStep | null {
  if (!readerState) return "summary";
  if (isChapterCompleted) return null;

  const quizResult = readerState.quizResult as
    | { score?: unknown; passed?: unknown }
    | null
    | undefined;
  if (
    quizResult &&
    typeof quizResult === "object" &&
    quizResult.passed === true
  ) {
    return "unlock";
  }

  const activeTab = readerState.activeTab;
  if (activeTab === "quiz") return "quiz";
  if (activeTab === "examples") return "scenarios";
  return "summary";
}

function statusFromCounts(
  completed: number,
  total: number
): "completed" | "in_progress" | "not_started" {
  if (total > 0 && completed >= total) return "completed";
  if (completed > 0) return "in_progress";
  return "not_started";
}

/**
 * Map the server-published catalog (LibraryCatalogBook) into the LibraryBookEntry
 * shape the analytics mapper expects. This makes the dashboard's book identity /
 * metadata come from the production catalog (mirroring the already-migrated
 * library page) instead of the local static BOOKS_CATALOG. Chapter-level math
 * still uses the local bundle when available, falling back to chapterCount.
 */
function catalogToEntries(catalog: LibraryCatalogBook[]): LibraryBookEntry[] {
  return catalog.map((book) => ({
    id: book.id,
    icon: book.icon,
    coverImage: book.coverImage,
    title: book.title,
    author: book.author,
    // Canonicalize so the profile's "categories explored" map/count (which groups
    // bookSnapshots by book.category) dedupes near-duplicate authored strings the
    // same way CATALOG_CATEGORY_COUNT (the "X of N" denominator) now does —
    // otherwise X (raw) and N (canonical) drift apart. See lib/category-taxonomy.ts.
    category: canonicalizeCategory(book.category),
    categories: book.categories,
    difficulty: book.difficulty,
    estimatedMinutes: book.estimatedMinutes,
    status: "not_started",
    progressPercent: 0,
    chaptersTotal: Math.max(1, book.chapterCount),
    chaptersCompleted: 0,
    isNew: true,
    lastActivityAt: DEFAULT_LAST_ACTIVITY,
  }));
}

function readReaderSignals(
  raw: unknown,
  chapterId: string,
  isCompleted: boolean,
  chapterScore: number
): ChapterReaderSignals {
  const state =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : null;
  const depth =
    state?.readingDepth === "simple" ||
    state?.readingDepth === "standard" ||
    state?.readingDepth === "deeper"
      ? (state.readingDepth as ReadingDepth)
      : "deeper";
  const quizResultRaw = state?.quizResult;
  const quizResult =
    quizResultRaw &&
    typeof quizResultRaw === "object" &&
    typeof (quizResultRaw as { score?: unknown }).score === "number"
      ? {
          score: (quizResultRaw as { score: number }).score,
          passed: (quizResultRaw as { passed?: unknown }).passed === true,
        }
      : null;
  const quizAnswers =
    state?.quizAnswers && typeof state.quizAnswers === "object" && !Array.isArray(state.quizAnswers)
      ? (state.quizAnswers as Record<string, unknown>)
      : {};
  return {
    chapterId,
    isCompleted,
    hasReader: state !== null,
    notes: typeof state?.notes === "string" ? state.notes : "",
    quizResult,
    chapterScore,
    readingDepth: depth,
    activeTab: typeof state?.activeTab === "string" ? state.activeTab : null,
    exampleFilter: typeof state?.exampleFilter === "string" ? state.exampleFilter : null,
    focusMode: state?.focusMode === true,
    showRecap: state?.showRecap === true,
    quizAnswersCount: Object.keys(quizAnswers).length,
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
  const [error, setError] = useState<string | null>(null);
  // Set true when the server served the dashboard with some OPTIONAL data missing
  // (#2). The page still renders the (authoritative) critical data; the banner
  // tells the user not everything loaded. `warnings` names the missing sources.
  const [partial, setPartial] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);

  // Consume the canonical dashboard query (WS3-025). This hook no longer fetches
  // the aggregate; the shared query owns fetching, caching, and focus/storage
  // revalidation, and this hook derives the analytics view-model from its payload.
  const {
    data: dashboardPayload,
    error: dashboardError,
    refetch: refetchDashboard,
  } = useDashboardQuery();

  const refetch = useCallback(() => {
    setError(null);
    refetchDashboard();
  }, [refetchDashboard]);

  // A dashboard READ failure (incl. a 503 #2: a CRITICAL read failed) is retryable
  // and must NEVER downgrade the plan to FREE: keep any last-good analytics, clear
  // the (success-with-gaps only) partial banner, and surface the error. The
  // canonical query keeps `dashboardPayload` at its last-good value on a failed
  // background revalidation, so the parse effect below is not re-run and analytics
  // is preserved.
  useEffect(() => {
    if (!dashboardError) return;
    console.error("Dashboard API failed:", dashboardError);
    setPartial(false);
    setWarnings([]);
    setError(getBookErrorMessage(dashboardError));
    setHydrated(true);
  }, [dashboardError]);

  useEffect(() => {
    if (!dashboardPayload) return;
    let mounted = true;
    const payload = dashboardPayload;

    const load = async () => {
      try {
        // Surface the server's partial-load flag (#2). Critical data is present
        // (the route 503s otherwise), so we render normally + a non-blocking
        // banner naming the optional sources that failed.
        setPartial(payload.partial === true);
        setWarnings(Array.isArray(payload.warnings) ? payload.warnings : []);

        const progressRows = Array.isArray(payload.progress) ? payload.progress : [];
        const bookStateRows = Array.isArray(payload.bookStates) ? payload.bookStates : [];
        const chapterStateRows = Array.isArray(payload.chapterStates) ? payload.chapterStates : [];
        const readingDayRows = Array.isArray(payload.readingDays) ? payload.readingDays : [];
        const badgeAwardRows = Array.isArray(payload.badgeAwards) ? payload.badgeAwards : [];
        const earnedBadgeIds = new Set(badgeAwardRows.map((item) => item.badgeId));
        const onboardingSettings = payload.settings?.onboarding ?? {};
        const starterShelf: string[] = Array.isArray(onboardingSettings.starterShelf)
          ? onboardingSettings.starterShelf
          : [];
        const savedBookIds: string[] = Array.isArray(payload.saved)
          ? payload.saved
              .map((s) => s?.bookId)
              .filter((id): id is string => typeof id === "string" && id.length > 0)
          : [];
        const interests: string[] = Array.isArray(onboardingSettings.interests)
          ? onboardingSettings.interests.filter((v): v is string => typeof v === "string")
          : [];
        const motivation: string | null =
          typeof onboardingSettings.motivation === "string" ? onboardingSettings.motivation : null;
        const settingsDailyGoal: number =
          typeof payload.settings?.dailyGoal === "number"
            ? payload.settings.dailyGoal
            : typeof onboardingSettings.dailyGoal === "number"
              ? onboardingSettings.dailyGoal
              : dailyGoalMinutes;
        // Prefer the server-published catalog for book identity/metadata
        // (matches the migrated library page); fall back to the local bundle
        // only when the catalog is empty.
        const entries =
          Array.isArray(payload.catalog) && payload.catalog.length > 0
            ? catalogToEntries(payload.catalog)
            : buildLibraryCatalog();
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
              currentLoopStep: null,
            };
          }

          const chapterCompletedAt = state?.chapterCompletedAt ?? {};
          const activities = buildActivities(entry.id, chapterCompletedAt);
          allActivities.push(...activities);

          const completedChapters = state?.completedChapterIds
            ? new Set(state.completedChapterIds).size
            : chapters.length === 0
              ? // Server book with no local chapter bundle — count numeric
                // progress directly (the id-mapping below can only yield 0).
                (progress?.completedChapters ?? []).length
              : new Set(
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

          const epochIso = new Date(0).toISOString();
          const lastActivityAt =
            (state?.lastOpenedAt && state.lastOpenedAt !== epochIso
              ? state.lastOpenedAt
              : null) ||
            (state?.updatedAt && state.updatedAt !== epochIso ? state.updatedAt : null) ||
            progress?.lastActiveAt ||
            progress?.lastOpenedAt ||
            entry.lastActivityAt;

          const completedChapterIdSet = new Set(state?.completedChapterIds ?? []);
          const resumeChapterStates = chapterStatesByBook.get(entry.id) ?? [];
          const resumeChapterState =
            resumeChapterStates.find((cs) => cs.chapterId === resumeChapterId)
            ?? resumeChapterStates.find((cs) => {
              const ch = chapters.find((c) => c.id === resumeChapterId);
              return ch && cs.chapterNumber === ch.order;
            })
            ?? null;

          return {
            book: entry,
            status,
            completedChapters,
            totalChapters,
            progressPercent,
            bestScore,
            avgScore,
            lastOpenedLabel:
              state?.lastReadChapterId && state.lastOpenedAt !== epochIso
                ? chapterLabelById(entry.id, state.lastReadChapterId)
                : state
                  ? "Browsed"
                  : "Not started",
            lastActivityAt,
            resumeChapterId,
            currentLoopStep:
              status === "completed"
                ? null
                : deriveLoopStep(
                    resumeChapterState?.state as Record<string, unknown> | null ?? null,
                    completedChapterIdSet.has(resumeChapterId)
                  ),
          };
        });

        const engagedBookSnapshots = bookSnapshots.filter((snapshot) => {
          const state = stateByBook.get(snapshot.book.id);
          const chapterStates = chapterStatesByBook.get(snapshot.book.id) ?? [];
          // A persisted server state means the user has opened this book at least once
          const hasServerState = !!state;
          const hasCompletedChapter = snapshot.completedChapters > 0;
          const hasQuizScore = Object.values(state?.chapterScores ?? {}).some(
            (score) => Number(score) > 0
          );
          const hasReaderActivity = chapterStates.some((item) =>
            hasMeaningfulReaderActivity(item.state as StoredReaderStateSnapshot | null)
          );
          return hasServerState || hasCompletedChapter || hasQuizScore || hasReaderActivity;
        });

        // Sort by most recently active first
        engagedBookSnapshots.sort((a, b) => {
          const timeA = new Date(a.lastActivityAt).getTime();
          const timeB = new Date(b.lastActivityAt).getTime();
          return timeB - timeA;
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

        const recentlyOpenedSnapshots = engagedBookSnapshots
          .filter((item) => item.status !== "completed")
          .slice(0, 3);

        const totalMinutesRead = Math.floor(
          readingDayRows.reduce((sum, row) => sum + row.totalActiveMs, 0) / 60000
        );

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

        // Badge stats from server-persisted state (device-independent) — replaces
        // the dashboard's old all-zeros partial stats object.
        const badgeStatsBooks: BadgeStatsBook[] = bookSnapshots.map((snap) => {
          const entry = snap.book;
          const state = stateByBook.get(entry.id);
          const progress = progressByBook.get(entry.id);
          const bundleChapters = getBookChaptersBundle(entry.id).chapters;
          const completedIds = new Set<string>(
            state?.completedChapterIds ??
              (progress?.completedChapters ?? [])
                .map((n) => bundleChapters.find((c) => c.order === n)?.id ?? "")
                .filter(Boolean)
          );
          // chapterScores is keyed by chapterId on bookState, but the
          // progress-table fallback (bestScoreByChapter) is keyed by chapter
          // NUMBER — map it to ids so progress-only quiz scores aren't dropped.
          const chapterScores: Record<string, number> =
            state?.chapterScores ??
            Object.fromEntries(
              Object.entries(progress?.bestScoreByChapter ?? {})
                .map(([num, score]) => {
                  const cid = bundleChapters.find((c) => c.order === Number(num))?.id;
                  return cid ? ([cid, Number(score)] as const) : null;
                })
                .filter((e): e is readonly [string, number] => e !== null)
            );
          const stateByChapterId = new Map<string, unknown>();
          for (const cs of chapterStatesByBook.get(entry.id) ?? []) {
            const cid =
              cs.chapterId ?? bundleChapters.find((c) => c.order === cs.chapterNumber)?.id;
            if (cid) stateByChapterId.set(cid, cs.state);
          }
          const relevant = new Set<string>([
            ...completedIds,
            ...Object.keys(chapterScores),
            ...stateByChapterId.keys(),
          ]);
          const chapters: ChapterReaderSignals[] = [...relevant].map((cid) =>
            readReaderSignals(
              stateByChapterId.get(cid),
              cid,
              completedIds.has(cid),
              Number(chapterScores[cid] ?? 0)
            )
          );
          return {
            id: entry.id,
            category: entry.category,
            difficulty: entry.difficulty,
            // "Started" = real reading engagement: a completed chapter, a quiz
            // score, or persisted per-chapter reader state (the reader was
            // actually opened) — NOT a mere browse. A book-progress entry is
            // auto-PATCHed to the server the moment a detail page is viewed, so
            // `Boolean(state)` alone falsely marks browsed-but-unread books as
            // started, inflating "Book in Motion" and the level for zero-read
            // accounts. Mirrors the localStorage deriver in useBadgeSystem.ts.
            isStarted:
              completedIds.size > 0 ||
              Object.keys(chapterScores).length > 0 ||
              stateByChapterId.size > 0,
            isCompleted: snap.status === "completed",
            chapters,
          };
        });
        const badgeStats = computeBadgeProgressStats({
          activity: {
            heatmapCells,
            totalCompletedChapters,
            booksCompleted,
            streakDays: currentStreak,
            longestStreak,
            avgQuizScore,
            maxQuizScore,
            inProgressCount: inProgressBookSnapshots.length,
          },
          books: badgeStatsBooks,
          dailyGoalMinutes: settingsDailyGoal,
          plan: payload.entitlement?.plan === "PRO" ? "PRO" : "FREE",
          // The "reading list" is the user's saved books, not the whole
          // catalog — using ALL_BOOK_IDS here falsely earned reading-list badges.
          readingListCount: Array.isArray(payload.saved) ? payload.saved.length : 0,
        });

        // Load real FSRS review cards (3s timeout). These are seeded server-side
        // when a chapter quiz is passed; when none are due we show NOTHING rather
        // than fabricating placeholder cards from in-progress books.
        let upcomingReviews: UpcomingReviewItem[] = [];
        try {
          const fsrsController = new AbortController();
          const fsrsTimeout = setTimeout(() => fsrsController.abort(), 3000);
          const fsrsResponse = await fetchBookJson<{ cards: Array<{ cardId: string; front: string; dueAt: string; bookId: string }> }>(
            "/app/api/book/me/reviews?limit=5",
            { signal: fsrsController.signal }
          );
          clearTimeout(fsrsTimeout);
          if (fsrsResponse.cards && fsrsResponse.cards.length > 0) {
            upcomingReviews = fsrsResponse.cards.map((card) => ({
              id: card.cardId,
              prompt: card.front,
              dueLabel: new Date(card.dueAt).toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
              }),
              bookId: card.bookId,
            }));
          }
        } catch {
          // FSRS unavailable or timed out — leave reviews empty.
        }

        setAnalytics({
          streakDays: currentStreak,
          dailyGoalMinutes: settingsDailyGoal,
          minutesReadToday: Math.floor(todayStats.activeMs / 60000),
          totalMinutesRead,
          booksCompleted,
          avgQuizScore,
          maxQuizScore,
          totalCompletedChapters,
          longestStreak,
          lastActiveLabel: formatRelativeDayLabel(activityDays.at(-1) ?? null),
          bookSnapshots,
          engagedBookSnapshots,
          recentlyOpenedSnapshots,
          completedBookSnapshots,
          inProgressBookSnapshots,
          heatmapCells,
          upcomingReviews,
          hasAnyProgress: totalCompletedChapters > 0,
          hasAnyEngagement: engagedBookSnapshots.length > 0,
          earnedBadgeIds,
          isPro: payload.entitlement?.plan === "PRO",
          insightPoints: typeof payload.insightPointsBalance === "number" ? payload.insightPointsBalance : 0,
          starterShelf,
          savedBookIds,
          interests,
          motivation,
          badgeStats,
        });
        setError(null);
        setHydrated(true);
      } catch (err) {
        if (!mounted) return;
        // Parsing the already-fetched aggregate should not normally throw; if it
        // does, surface it rather than showing all-zero analytics. Dashboard READ
        // failures are handled by the dashboardError effect above and never
        // downgrade the plan to FREE.
        console.error("Dashboard parse failed:", err);
        setError(getBookErrorMessage(err));
        setHydrated(true);
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, [dashboardPayload, dailyGoalMinutes]);

  return {
    hydrated,
    analytics,
    error,
    partial,
    warnings,
    refetch,
  };
}
