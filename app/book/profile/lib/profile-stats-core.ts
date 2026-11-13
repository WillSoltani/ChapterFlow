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

// ── PROG-13: Profile notes, quiz history and activity ──
// Built from the account's rows in the dashboard payload (bookStates /
// chapterStates), so they show on every device. This device's localStorage
// copy only fills in a book or chapter the account has no row for.

export type ReaderStateLite = {
  readingDepth: "simple" | "standard" | "deeper";
  quizAnswers: Record<string, number>;
  quizResult: { score: number; passed: boolean } | null;
  notes: string;
};

export type InsightBook = {
  bookId: string;
  lastReadChapterId: string;
  lastOpenedAt: string;
  chapterCompletedAt: Record<string, string>;
};

export type InsightChapter = { bookId: string; chapterId: string; reader: ReaderStateLite };

export type InsightSource = { books: InsightBook[]; chapters: InsightChapter[] };

export type InsightDashboard = {
  bookStates?: ReadonlyArray<{
    bookId: string;
    lastReadChapterId?: string;
    lastOpenedAt?: string;
    chapterCompletedAt?: Record<string, string>;
  }>;
  chapterStates?: ReadonlyArray<{
    bookId: string;
    chapterNumber: number;
    chapterId?: string;
    state: unknown;
  }>;
};

export type InsightCatalog = {
  books: ReadonlyArray<{ id: string; title: string }>;
  chapter: (bookId: string, chapterId: string) => { code: string; title: string } | null;
  chapterIdFor: (bookId: string, chapterNumber: number) => string | null;
};

export type NoteEntry = { id: string; bookId: string; chapterId: string; title: string; body: string; meta: string; sortAt: string };
export type ActivityEntry = { id: string; title: string; detail: string; meta: string; sortAt: string; dateKey: string };
export type QuizEntry = { id: string; label: string; score: number; sortAt: string };

const EPOCH = new Date(0).toISOString();

function isDepth(value: unknown): value is ReaderStateLite["readingDepth"] {
  return value === "simple" || value === "standard" || value === "deeper";
}

/** The fields Profile reads, from a stored chapter state (server or device). */
export function readerStateLite(raw: unknown): ReaderStateLite {
  const state = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const answers = state.quizAnswers && typeof state.quizAnswers === "object" && !Array.isArray(state.quizAnswers)
    ? Object.fromEntries(
        Object.entries(state.quizAnswers as Record<string, unknown>).filter(([, v]) => Number.isFinite(Number(v)))
      ) as Record<string, number>
    : {};
  const result = state.quizResult && typeof state.quizResult === "object"
    ? (state.quizResult as { score?: unknown; passed?: unknown })
    : null;
  return {
    readingDepth: isDepth(state.readingDepth) ? state.readingDepth : "deeper",
    quizAnswers: answers,
    quizResult: result
      ? { score: Number.isFinite(Number(result.score ?? 0)) ? Number(result.score ?? 0) : 0, passed: Boolean(result.passed) }
      : null,
    notes: typeof state.notes === "string" ? state.notes : "",
  };
}

function fromDashboard(dashboard: InsightDashboard, catalog: InsightCatalog): InsightSource {
  return {
    books: (dashboard.bookStates ?? []).map((row) => ({
      bookId: row.bookId,
      lastReadChapterId: row.lastReadChapterId ?? "",
      lastOpenedAt: row.lastOpenedAt ?? EPOCH,
      chapterCompletedAt: row.chapterCompletedAt ?? {},
    })),
    chapters: (dashboard.chapterStates ?? []).flatMap((row) => {
      const chapterId = row.chapterId || catalog.chapterIdFor(row.bookId, row.chapterNumber);
      return chapterId ? [{ bookId: row.bookId, chapterId, reader: readerStateLite(row.state) }] : [];
    }),
  };
}

function summarizeNote(text: string) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= 180 ? clean : `${clean.slice(0, 177)}...`;
}

function dayKeyLocal(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function isRealTime(iso: string) {
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && t > 0;
}

export function buildProfileInsights(
  dashboard: InsightDashboard | null | undefined,
  local: InsightSource,
  catalog: InsightCatalog
) {
  const server = dashboard ? fromDashboard(dashboard, catalog) : { books: [], chapters: [] };
  const books = new Map(server.books.map((row) => [row.bookId, row]));
  for (const row of local.books) if (!books.has(row.bookId)) books.set(row.bookId, row);
  const chapterKey = (row: InsightChapter) => `${row.bookId}:${row.chapterId}`;
  const chapters = new Map(server.chapters.map((row) => [chapterKey(row), row]));
  for (const row of local.chapters) if (!chapters.has(chapterKey(row))) chapters.set(chapterKey(row), row);

  const titles = new Map(catalog.books.map((book) => [book.id, book.title]));
  const notes: NoteEntry[] = [];
  const recentQuizEntries: QuizEntry[] = [];
  const activityLog: ActivityEntry[] = [];
  const recentOpenedChapters: ActivityEntry[] = [];
  const depthCounts = { simple: 0, standard: 0, deeper: 0 };
  let quizQuestionsAnswered = 0;

  for (const book of books.values()) {
    const title = titles.get(book.bookId);
    if (!title) continue;
    if (book.lastReadChapterId && isRealTime(book.lastOpenedAt)) {
      const chapter = catalog.chapter(book.bookId, book.lastReadChapterId);
      recentOpenedChapters.push({
        id: `${book.bookId}:${book.lastReadChapterId}:opened`,
        title: chapter ? `${title} • ${chapter.code}` : `${title} • Recent chapter`,
        detail: chapter ? chapter.title : "Recent chapter activity",
        meta: shortDate(book.lastOpenedAt),
        sortAt: book.lastOpenedAt,
        dateKey: dayKeyLocal(new Date(book.lastOpenedAt)),
      });
    }
    for (const [chapterId, completedAt] of Object.entries(book.chapterCompletedAt)) {
      const chapter = catalog.chapter(book.bookId, chapterId);
      if (!chapter || !isRealTime(completedAt)) continue;
      activityLog.push({
        id: `${book.bookId}:${chapterId}:completed`,
        title: `${title} • ${chapter.code}`,
        detail: `Completed ${chapter.title}`,
        meta: shortDate(completedAt),
        sortAt: completedAt,
        dateKey: dayKeyLocal(new Date(completedAt)),
      });
    }
  }

  for (const row of chapters.values()) {
    const title = titles.get(row.bookId);
    const chapter = catalog.chapter(row.bookId, row.chapterId);
    if (!title || !chapter) continue;
    const book = books.get(row.bookId);
    const { reader } = row;
    depthCounts[reader.readingDepth] += 1;
    quizQuestionsAnswered += Object.keys(reader.quizAnswers).length;
    if (reader.quizResult) {
      recentQuizEntries.push({
        id: `${row.bookId}:${row.chapterId}:quiz`,
        label: `${title} • ${chapter.code}`,
        score: reader.quizResult.score,
        sortAt: book?.chapterCompletedAt[row.chapterId] ?? book?.lastOpenedAt ?? EPOCH,
      });
    }
    if (reader.notes.trim()) {
      notes.push({
        id: `${row.bookId}:${row.chapterId}:note`,
        bookId: row.bookId,
        chapterId: row.chapterId,
        title: `${title} • ${chapter.code}`,
        body: summarizeNote(reader.notes),
        meta: chapter.title,
        sortAt: book?.lastOpenedAt ?? EPOCH,
      });
    }
  }

  notes.sort((a, b) => b.sortAt.localeCompare(a.sortAt));
  recentQuizEntries.sort((a, b) => b.sortAt.localeCompare(a.sortAt));
  activityLog.sort((a, b) => b.sortAt.localeCompare(a.sortAt));
  recentOpenedChapters.sort((a, b) => b.sortAt.localeCompare(a.sortAt));

  return { quizQuestionsAnswered, notes, recentQuizEntries, activityLog, depthCounts, recentOpenedChapters };
}
