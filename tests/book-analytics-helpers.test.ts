// Pure helpers of hooks/book/useBookAnalytics.ts. The test lives here because
// `npm run test` discovers app/, lib/, components/ and tests/, not hooks/.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calculateCurrentStreak,
  readDailyGoal,
  statusFromCounts,
  streakAtRisk,
} from "@/hooks/book/useBookAnalytics";

function daysEndingAt(lastDay: string, count: number): Set<string> {
  const days = new Set<string>();
  const cursor = new Date(`${lastDay}T12:00:00`);
  for (let i = 0; i < count; i += 1) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, "0");
    const d = String(cursor.getDate()).padStart(2, "0");
    days.add(`${y}-${m}-${d}`);
    cursor.setDate(cursor.getDate() - 1);
  }
  return days;
}

const TODAY = "2026-11-12";

test("PROG-01: 10 straight days and nothing yet today keeps the 10-day streak, at risk", () => {
  const days = daysEndingAt("2026-11-11", 10);
  assert.equal(calculateCurrentStreak(days, TODAY), 10);
  assert.equal(streakAtRisk(days, TODAY), true);
});

test("reading today extends the streak and clears the risk", () => {
  const days = daysEndingAt(TODAY, 11);
  assert.equal(calculateCurrentStreak(days, TODAY), 11);
  assert.equal(streakAtRisk(days, TODAY), false);
});

test("a full missed day drops the streak to 0", () => {
  const days = daysEndingAt("2026-11-10", 10);
  assert.equal(calculateCurrentStreak(days, TODAY), 0);
  assert.equal(streakAtRisk(days, TODAY), false);
});

test("no activity at all is a 0 streak, not at risk", () => {
  assert.equal(calculateCurrentStreak(new Set(), TODAY), 0);
  assert.equal(streakAtRisk(new Set(), TODAY), false);
});

test("streak counting crosses month boundaries", () => {
  const days = daysEndingAt("2026-03-01", 3); // Feb 27, Feb 28, Mar 1
  assert.equal(calculateCurrentStreak(days, "2026-03-02"), 3);
});

test("HOME-03: a book with a chapter opened but none completed is in progress", () => {
  assert.equal(statusFromCounts(0, 12, true), "in_progress");
});

test("statusFromCounts: completion counts still decide the other states", () => {
  assert.equal(statusFromCounts(0, 12, false), "not_started");
  assert.equal(statusFromCounts(0, 12), "not_started");
  assert.equal(statusFromCounts(3, 12, false), "in_progress");
  assert.equal(statusFromCounts(12, 12, true), "completed");
});

test("ACCT-03 (C10): the Settings preset wins over the onboarding goal", () => {
  assert.equal(
    readDailyGoal({ extended: { dailyGoalPreset: 5 }, onboarding: { dailyGoal: 20 } }, 10),
    5
  );
  assert.equal(
    readDailyGoal({ extended: { dailyGoalPreset: 5 }, dailyGoal: 20, onboarding: { dailyGoal: 20 } }, 10),
    5
  );
});

test("ACCT-03 (C10): read order falls back to dailyGoal, then onboarding, then the caller default", () => {
  assert.equal(readDailyGoal({ dailyGoal: 15, onboarding: { dailyGoal: 20 } }, 10), 15);
  assert.equal(readDailyGoal({ onboarding: { dailyGoal: 20 } }, 10), 20);
  assert.equal(readDailyGoal({ extended: { dailyGoalPreset: "5" } }, 10), 10);
  assert.equal(readDailyGoal(null, 10), 10);
  assert.equal(readDailyGoal(undefined, 25), 25);
});

test("ACCT-03 (C10): the goal is never below 5 minutes", () => {
  assert.equal(readDailyGoal({ extended: { dailyGoalPreset: 2 } }, 10), 5);
  assert.equal(readDailyGoal(null, 0), 5);
});
