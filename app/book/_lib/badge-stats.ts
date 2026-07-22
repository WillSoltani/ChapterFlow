import type { BadgeProgressStats } from "@/app/book/badges/lib/badge-ui-definitions";
import { canonicalizeCategory } from "@/lib/category-taxonomy";

/**
 * Source-agnostic badge-stats computation.
 *
 * The badges page derives stats from device-local localStorage
 * (useBadgeSystem.deriveBadgeStats). The dashboard, by contrast, has the full
 * per-chapter reader state from the server `/me/dashboard` payload. This module
 * lets the dashboard compute the SAME BadgeProgressStats shape from that server
 * data — device-independent, no zeroed-out fields.
 *
 * Only chapters the reader has actually touched / completed / scored contribute
 * engagement signals (notes, examples, focus mode, depth). This fixes an
 * inflation bug in the original localStorage deriver, where untouched chapters
 * (null reader, `exampleFilter !== "all"`) were counted as "examples viewed".
 */

export type ReadingDepth = "simple" | "standard" | "deeper";

export type ChapterReaderSignals = {
  chapterId: string;
  isCompleted: boolean;
  /** Whether a persisted reader state exists for this chapter (vs only a score/completion). */
  hasReader: boolean;
  notes: string;
  quizResult: { score: number; passed: boolean } | null;
  chapterScore: number;
  readingDepth: ReadingDepth;
  activeTab: string | null;
  exampleFilter: string | null;
  focusMode: boolean;
  showRecap: boolean;
  quizAnswersCount: number;
};

export type BadgeStatsBook = {
  id: string;
  category: string;
  difficulty: "Easy" | "Medium" | "Hard";
  isStarted: boolean;
  isCompleted: boolean;
  /** Only chapters with reader state, a score, or completion — not every chapter in the book. */
  chapters: ChapterReaderSignals[];
};

export type BadgeStatsActivity = {
  heatmapCells: Array<{ key: string; minutes: number }>;
  totalCompletedChapters: number;
  booksCompleted: number;
  streakDays: number;
  longestStreak: number;
  avgQuizScore: number;
  maxQuizScore: number;
  inProgressCount: number;
};

function dayKeyToDate(dayKey: string): Date {
  return new Date(`${dayKey}T12:00:00`);
}

function getWeekKey(dayKey: string): string {
  const date = dayKeyToDate(dayKey);
  const day = date.getDay() || 7;
  date.setDate(date.getDate() + 4 - day);
  const yearStart = new Date(date.getFullYear(), 0, 1);
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

function splitNotes(notes: string): string[] {
  return notes
    .split(/\n\s*\n|\n/g)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/**
 * Field-wise merge of two stat objects, taking the more-progressed value for
 * each field (max for counters, OR for booleans, union for arrays).
 *
 * Used to combine server-truth badge stats (device-independent) with the
 * localStorage-derived stats so that NEITHER a pre-migration localStorage-only
 * user NOR a server-only user loses badge progress during the reader migration.
 */
export function mergeBadgeProgressStats(
  a: BadgeProgressStats,
  b: BadgeProgressStats
): BadgeProgressStats {
  const out: Record<string, unknown> = { ...a };
  const av = a as Record<string, unknown>;
  const bv = b as Record<string, unknown>;
  for (const key of Object.keys(av)) {
    const x = av[key];
    const y = bv[key];
    if (typeof x === "number" && typeof y === "number") {
      out[key] = Math.max(x, y);
    } else if (typeof x === "boolean" && typeof y === "boolean") {
      out[key] = x || y;
    } else if (Array.isArray(x) && Array.isArray(y)) {
      out[key] = Array.from(new Set([...x, ...y]));
    }
  }
  return out as BadgeProgressStats;
}

export function computeBadgeProgressStats(args: {
  activity: BadgeStatsActivity;
  books: BadgeStatsBook[];
  dailyGoalMinutes: number;
  plan: "FREE" | "PRO";
  readingListCount: number;
}): BadgeProgressStats {
  const { activity, books, dailyGoalMinutes, plan, readingListCount } = args;

  const activityDayKeys = activity.heatmapCells
    .filter((cell) => cell.minutes > 0)
    .map((cell) => cell.key);
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
  let startedBooks = 0;
  let booksCompletedWithAllQuizzesPassed = 0;
  let recapCompletions = 0;

  const startedCategories = new Set<string>();
  const completedCategories = new Set<string>();
  const usedReadingModes = new Set<ReadingDepth>();

  for (const book of books) {
    // DI-3: count distinct categories on the controlled vocabulary so an
    // un-normalized catalog string (e.g. "Self-Help" vs "Self Improvement")
    // reaching the dashboard before the prod backfill still merges into one
    // explored/completed category instead of inflating the count.
    const canonicalCategory = canonicalizeCategory(book.category);
    if (book.isStarted) {
      startedBooks += 1;
      startedCategories.add(canonicalCategory);
      if (book.difficulty === "Hard") challengingBooksStarted += 1;
    }
    if (book.isCompleted) {
      completedCategories.add(canonicalCategory);
      if (book.difficulty === "Hard") challengingBooksCompleted += 1;
      const categoryLower = canonicalCategory.toLowerCase();
      if (categoryLower.includes("strategy")) strategyBooksCompleted += 1;
      if (categoryLower.includes("psychology")) psychologyBooksCompleted += 1;
    }

    let allCompletedInDeeperMode = book.isCompleted;
    let allChapterQuizzesPassed = book.isCompleted;
    let bookHasPassedQuiz = false;

    for (const chapter of book.chapters) {
      const quizScore = chapter.quizResult?.score ?? chapter.chapterScore;
      const quizPassed = chapter.quizResult?.passed ?? chapter.chapterScore >= 80;
      const hasNotes = Boolean(chapter.notes.trim());
      const noteEntries = splitNotes(chapter.notes);

      if (chapter.hasReader) {
        usedReadingModes.add(chapter.readingDepth);
        totalQuizQuestionsAnswered += chapter.quizAnswersCount;
      }

      if (chapter.quizResult || chapter.chapterScore > 0) quizCount += 1;
      if (quizPassed && (chapter.quizResult || chapter.chapterScore > 0)) {
        quizzesPassed += 1;
        bookHasPassedQuiz = true;
        if (chapter.readingDepth === "deeper") quizzesPassedInDeeperMode += 1;
      }
      if (quizScore >= 100) perfectQuizCount += 1;
      if (chapter.showRecap && quizPassed) recapCompletions += 1;

      if (
        chapter.hasReader &&
        (chapter.activeTab === "examples" ||
          (chapter.exampleFilter !== null && chapter.exampleFilter !== "all"))
      ) {
        examplesViewedChapters += 1;
      }
      if (chapter.exampleFilter === "personal") {
        personalExamplesChapters += 1;
        viewedExampleContexts.add("personal");
      }
      if (chapter.exampleFilter === "school") {
        schoolExamplesChapters += 1;
        viewedExampleContexts.add("school");
      }
      if (chapter.exampleFilter === "work") {
        workExamplesChapters += 1;
        viewedExampleContexts.add("work");
      }

      if (hasNotes) {
        notesCount += Math.max(noteEntries.length, 1);
        noteBooks.add(book.id);
      }

      if (chapter.isCompleted) {
        if (chapter.readingDepth === "simple") chaptersSimpleCompleted += 1;
        if (chapter.readingDepth === "standard") chaptersStandardCompleted += 1;
        if (chapter.readingDepth === "deeper") chaptersDeeperCompleted += 1;
        if (chapter.focusMode) chaptersCompletedWithFocusMode += 1;
        if (hasNotes) {
          completedChaptersWithNotes += 1;
          completedChaptersWithReflection += 1;
        }
        if (chapter.readingDepth !== "deeper") allCompletedInDeeperMode = false;
        if (!quizPassed) allChapterQuizzesPassed = false;
      }
    }

    if (bookHasPassedQuiz) distinctQuizBooks += 1;
    if (book.isCompleted && allCompletedInDeeperMode) completedBooksInDeeperMode += 1;
    if (book.isCompleted && allChapterQuizzesPassed) booksCompletedWithAllQuizzesPassed += 1;
  }

  const completedGoalDays = activity.heatmapCells.filter(
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
    totalCompletedChapters: activity.totalCompletedChapters,
    completedBooks: activity.booksCompleted,
    startedBooks,
    streakDays: activity.streakDays,
    longestStreak: activity.longestStreak,
    avgQuizScore: activity.avgQuizScore,
    maxQuizScore: activity.maxQuizScore,
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
    readingListCount,
    challengingBooksCompleted,
    strategyBooksCompleted,
    psychologyBooksCompleted,
    completedCategoriesCount: completedCategories.size,
    booksCompletedWithAllQuizzesPassed,
    proActivated: plan === "PRO",
    proMultiTrack: plan === "PRO" && activity.inProgressCount >= 3,
    recapCompletions,
  };
}
