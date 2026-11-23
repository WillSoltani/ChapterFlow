// Pure helpers of hooks/book/useBadgeSystem.ts (PROG-18, PROG-21). The test
// lives here because `npm run test` does not discover hooks/.

import assert from "node:assert/strict";
import { test } from "node:test";
import { computeBadgeProgressStats } from "@/app/book/_lib/badge-stats";
import {
  evaluateBadgeStates,
  isJustEarned,
  selectNextMilestones,
} from "@/hooks/book/useBadgeSystem";

function stats(overrides: { totalCompletedChapters?: number; streakDays?: number; longestStreak?: number } = {}) {
  return computeBadgeProgressStats({
    activity: {
      heatmapCells: [],
      totalCompletedChapters: overrides.totalCompletedChapters ?? 0,
      booksCompleted: 0,
      streakDays: overrides.streakDays ?? 0,
      longestStreak: overrides.longestStreak ?? 0,
      avgQuizScore: 0,
      maxQuizScore: 0,
      inProgressCount: 0,
    },
    books: [],
    dailyGoalMinutes: 10,
    plan: "FREE",
    readingListCount: 0,
  });
}

test("PROG-21: a badge the account already earned stays earned with its server date when stats are lower", () => {
  const badges = evaluateBadgeStates(stats({ totalCompletedChapters: 0 }), {
    "first-chapter": "2026-10-01T09:00:00.000Z",
  });
  const first = badges.find((b) => b.id === "first-chapter")!;
  assert.equal(first.earned, true);
  assert.equal(first.earnedAt, "2026-10-01T09:00:00.000Z");
});

test("PROG-21: progress comes from the stats given (the account's), not this device", () => {
  const badges = evaluateBadgeStates(stats({ totalCompletedChapters: 1 }), {});
  assert.equal(badges.find((b) => b.id === "first-chapter")!.earned, true);
  const none = evaluateBadgeStates(stats({ totalCompletedChapters: 0 }), {});
  assert.equal(none.find((b) => b.id === "first-chapter")!.earned, false);
});

test("PROG-21: selectNextMilestones picks unearned visible badges, closest first, at most four", () => {
  const badges = evaluateBadgeStates(stats({ totalCompletedChapters: 5, streakDays: 2, longestStreak: 2 }), {});
  const next = selectNextMilestones(badges);
  assert.ok(next.length > 0 && next.length <= 4);
  assert.ok(next.every((m) => !m.badge.earned && m.badge.isVisible));
  for (let i = 1; i < next.length; i += 1) {
    assert.ok(next[i - 1]!.progressPercent >= next[i]!.progressPercent);
  }
});

test("PROG-21: selectNextMilestones gives the same answer for the same badges", () => {
  const badges = evaluateBadgeStates(stats({ totalCompletedChapters: 5 }), {});
  assert.deepEqual(
    selectNextMilestones(badges).map((m) => m.badge.id),
    selectNextMilestones([...badges].reverse()).map((m) => m.badge.id)
  );
});

test("PROG-18: 'Just earned' only within 48 hours of earning", () => {
  const now = Date.parse("2026-11-13T12:00:00.000Z");
  assert.equal(isJustEarned("2026-11-12T13:00:00.000Z", now), true);
  assert.equal(isJustEarned("2026-11-11T11:00:00.000Z", now), false);
  assert.equal(isJustEarned(null, now), false);
  assert.equal(isJustEarned("not a date", now), false);
});
