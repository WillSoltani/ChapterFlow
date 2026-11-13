import assert from "node:assert/strict";
import { test } from "node:test";
import { buildStatsSummary, exploredCategoriesFrom, type StatsAnalytics } from "./profile-stats-core";

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
