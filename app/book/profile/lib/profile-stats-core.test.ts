import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildProfileInsights,
  buildStatsSummary,
  exploredCategoriesFrom,
  type StatsAnalytics,
} from "./profile-stats-core";

function snap(id: string, category: string, completedChapters: number) {
  return { book: { id, category }, completedChapters };
}

const ANALYTICS: StatsAnalytics = {
  streakDays: 12,
  longestStreak: 14,
  booksCompleted: 1,
  totalCompletedChapters: 13,
  avgQuizScore: 87,
  maxQuizScore: 100,
  minutesReadToday: 8,
  totalMinutesRead: 900,
  heatmapCells: [{ minutes: 30 }, { minutes: 20 }],
  bookSnapshots: [
    snap("atomic-habits", "Habits", 3),
    snap("the-power-of-habit", "Habits", 9),
    snap("deep-work", "Productivity", 1),
    snap("thinking-fast-and-slow", "Psychology", 0),
    snap("sapiens", "History", 0),
  ],
};

test("PROG-12: categories count only categories the reader has finished chapters in", () => {
  const summary = buildStatsSummary(ANALYTICS, 0);
  assert.equal(summary.categoriesCount, 2);
  assert.deepEqual(
    exploredCategoriesFrom(ANALYTICS.bookSnapshots),
    [{ name: "Habits", chapters: 12 }, { name: "Productivity", chapters: 1 }]
  );
});

test("PROG-12: total reading time is the all-time total, not the last 12 weeks", () => {
  assert.equal(buildStatsSummary(ANALYTICS, 0).totalReadingMinutes, 900);
});

test("buildStatsSummary passes the other figures through", () => {
  const summary = buildStatsSummary(ANALYTICS, 42);
  assert.equal(summary.currentStreak, 12);
  assert.equal(summary.longestStreak, 14);
  assert.equal(summary.quizQuestionsAnswered, 42);
  assert.equal(summary.minutesReadToday, 8);
});

test("no analytics yet is all zeros", () => {
  const summary = buildStatsSummary(null, 0);
  assert.equal(summary.categoriesCount, 0);
  assert.equal(summary.totalReadingMinutes, 0);
  assert.equal(summary.currentStreak, 0);
});

// ── PROG-13: notes and quiz history from the account, this device as fallback ──

const CATALOG = {
  books: [
    { id: "atomic-habits", title: "Atomic Habits" },
    { id: "deep-work", title: "Deep Work" },
  ],
  chapter: (bookId: string, chapterId: string) => {
    const n = Number(chapterId.slice(-2));
    if (!chapterId.startsWith(bookId) || !Number.isFinite(n)) return null;
    return { code: `CH.${String(n).padStart(2, "0")}`, title: `Chapter ${n} title` };
  },
  chapterIdFor: (bookId: string, chapterNumber: number) => `${bookId}-ch${String(chapterNumber).padStart(2, "0")}`,
};

const DASHBOARD = {
  bookStates: [
    {
      bookId: "atomic-habits",
      lastReadChapterId: "atomic-habits-ch04",
      lastOpenedAt: "2026-11-12T09:00:00.000Z",
      chapterCompletedAt: { "atomic-habits-ch01": "2026-11-01T09:00:00.000Z" },
    },
  ],
  chapterStates: [
    {
      bookId: "atomic-habits",
      chapterNumber: 1,
      chapterId: "atomic-habits-ch01",
      state: { readingDepth: "standard", quizAnswers: { q1: 0, q2: 1 }, quizResult: { score: 90, passed: true }, notes: "Server note" },
    },
    {
      bookId: "atomic-habits",
      chapterNumber: 2,
      state: { readingDepth: "simple", notes: "Second chapter note" },
    },
  ],
};

const EMPTY_LOCAL = { books: [], chapters: [] };

test("PROG-13: notes and quiz history come from the account when this device has none", () => {
  const insights = buildProfileInsights(DASHBOARD, EMPTY_LOCAL, CATALOG);
  assert.deepEqual(insights.notes.map((n) => n.body).sort(), ["Second chapter note", "Server note"]);
  assert.equal(insights.recentQuizEntries.length, 1);
  assert.equal(insights.recentQuizEntries[0]!.score, 90);
  assert.equal(insights.quizQuestionsAnswered, 2);
  assert.deepEqual(insights.depthCounts, { simple: 1, standard: 1, deeper: 0 });
  assert.equal(insights.activityLog.length, 1);
  assert.equal(insights.recentOpenedChapters.length, 1);
});

test("PROG-13: a chapter row from the account wins over this device's copy", () => {
  const local = {
    books: [],
    chapters: [
      { bookId: "atomic-habits", chapterId: "atomic-habits-ch01", reader: { readingDepth: "deeper" as const, quizAnswers: {}, quizResult: null, notes: "Stale device note" } },
    ],
  };
  const insights = buildProfileInsights(DASHBOARD, local, CATALOG);
  const bodies = insights.notes.map((n) => n.body);
  assert.ok(bodies.includes("Server note"));
  assert.ok(!bodies.includes("Stale device note"));
});

test("PROG-13: this device fills in only what the account does not have", () => {
  const local = {
    books: [{ bookId: "deep-work", lastReadChapterId: "deep-work-ch02", lastOpenedAt: "2026-11-11T09:00:00.000Z", chapterCompletedAt: {} }],
    chapters: [
      { bookId: "deep-work", chapterId: "deep-work-ch02", reader: { readingDepth: "deeper" as const, quizAnswers: {}, quizResult: null, notes: "Unsynced note" } },
    ],
  };
  const insights = buildProfileInsights(DASHBOARD, local, CATALOG);
  assert.ok(insights.notes.some((n) => n.body === "Unsynced note" && n.bookId === "deep-work"));
  assert.equal(insights.recentOpenedChapters.length, 2);
});

test("PROG-13: without a dashboard, this device's copy is used", () => {
  const local = {
    books: [],
    chapters: [
      { bookId: "deep-work", chapterId: "deep-work-ch01", reader: { readingDepth: "deeper" as const, quizAnswers: {}, quizResult: null, notes: "Only here" } },
    ],
  };
  const insights = buildProfileInsights(null, local, CATALOG);
  assert.deepEqual(insights.notes.map((n) => n.body), ["Only here"]);
});

test("PROG-13: a book page view (no open time) is not recent reading", () => {
  const insights = buildProfileInsights(
    { bookStates: [{ bookId: "deep-work", lastReadChapterId: "deep-work-ch01", lastOpenedAt: "1970-01-01T00:00:00.000Z", chapterCompletedAt: {} }], chapterStates: [] },
    EMPTY_LOCAL,
    CATALOG
  );
  assert.equal(insights.recentOpenedChapters.length, 0);
});
