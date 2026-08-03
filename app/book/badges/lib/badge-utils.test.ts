import test from "node:test";
import assert from "node:assert/strict";

import { evaluateBadges, type BadgeProgressStats } from "./badge-ui-definitions";
import { getLevel } from "./badge-utils";
import * as badgeUtils from "./badge-utils";
import { TIER_BORDER_COLORS, TIER_GLOW_STYLES } from "./badge-utils";

// Honesty contract for the Achievements level curve (finding UF-2):
// a brand-new account that has done NOTHING but set up / browse should derive to
// all-zero engagement stats — and an all-zero stats object must earn no badges
// and sit at Level 1. The derivation fix (useBadgeSystem.ts / useBookAnalytics.ts)
// stops a mere browsed-but-unread book from inflating `startedBooks` /
// `examplesViewedChapters`; this test pins the downstream math those derivers
// feed, so a future tweak to thresholds or badge targets can't silently let a
// zero-reading account cross Level 1 again.

function zeroStats(overrides: Partial<BadgeProgressStats> = {}): BadgeProgressStats {
  return {
    totalCompletedChapters: 0,
    completedBooks: 0,
    startedBooks: 0,
    streakDays: 0,
    longestStreak: 0,
    avgQuizScore: 0,
    maxQuizScore: 0,
    quizzesPassed: 0,
    perfectQuizCount: 0,
    distinctQuizBooks: 0,
    quizzesPassedInDeeperMode: 0,
    quizCount: 0,
    totalQuizQuestionsAnswered: 0,
    completedGoalDays: 0,
    activeWeeks: 0,
    totalActiveDays: 0,
    weekendActiveDays: 0,
    weekdayActiveDays: 0,
    recoveredAfterMiss: 0,
    chaptersSimpleCompleted: 0,
    chaptersStandardCompleted: 0,
    chaptersDeeperCompleted: 0,
    usedAllReadingModes: false,
    chaptersCompletedWithFocusMode: 0,
    completedChaptersWithNotes: 0,
    completedBooksInDeeperMode: 0,
    examplesViewedChapters: 0,
    viewedExampleContexts: [],
    personalExamplesChapters: 0,
    schoolExamplesChapters: 0,
    workExamplesChapters: 0,
    notesCount: 0,
    noteBooksCount: 0,
    completedChaptersWithReflection: 0,
    exploredCategories: 0,
    challengingBooksStarted: 0,
    returnedAfterLongGap: 0,
    readingListCount: 0,
    challengingBooksCompleted: 0,
    strategyBooksCompleted: 0,
    psychologyBooksCompleted: 0,
    completedCategoriesCount: 0,
    booksCompletedWithAllQuizzesPassed: 0,
    proActivated: false,
    proMultiTrack: false,
    recapCompletions: 0,
    ...overrides,
  };
}

function earnedFP(stats: BadgeProgressStats): number {
  return evaluateBadges(stats)
    .filter((badge) => badge.earned)
    .reduce((sum, badge) => sum + badge.flowPoints, 0);
}

test("zero-engagement account earns no badges and stays Level 1 (Newcomer)", () => {
  const earnedIds = evaluateBadges(zeroStats())
    .filter((badge) => badge.earned)
    .map((badge) => badge.id);
  assert.deepEqual(earnedIds, [], "a zero-engagement account must earn nothing");

  const level = getLevel(earnedFP(zeroStats()));
  assert.equal(level.level, 1);
  assert.equal(level.name, "Newcomer");
});

test("the setup-tripped badges in particular do not earn at zero engagement", () => {
  const earned = new Set(
    evaluateBadges(zeroStats())
      .filter((badge) => badge.earned)
      .map((badge) => badge.id)
  );
  for (const id of [
    "first-book-started", // "Book in Motion"
    "first-examples-viewed", // "Applied Reading"
    "category-explorer",
    "challenging-trial",
  ]) {
    assert.equal(earned.has(id), false, `${id} must not earn for a zero-read account`);
  }
});

test("a genuine reader still earns the reading-gated starter badges", () => {
  const reader = zeroStats({
    startedBooks: 1,
    totalCompletedChapters: 1,
    quizzesPassed: 1,
    examplesViewedChapters: 1,
    chaptersStandardCompleted: 1,
    completedGoalDays: 1,
    notesCount: 1,
  });
  const earned = new Set(
    evaluateBadges(reader)
      .filter((badge) => badge.earned)
      .map((badge) => badge.id)
  );
  for (const id of [
    "first-book-started",
    "first-chapter",
    "first-quiz-pass",
    "first-note",
    "first-examples-viewed",
    "first-standard-depth",
    "first-goal-hit",
  ]) {
    assert.equal(earned.has(id), true, `expected ${id} earned for a genuine reader`);
  }
});

test("WS5-013: tier color maps reference design tokens, not raw color literals", () => {
  for (const [tier, value] of [
    ...Object.entries(TIER_BORDER_COLORS),
    ...Object.entries(TIER_GLOW_STYLES),
  ]) {
    assert.match(value, /var\(--(?:cf|accent)-[a-z0-9-]+\)/, `${tier}: ${value}`);
    assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(value), `${tier} has raw hex: ${value}`);
    assert.ok(!/\brgba?\(/.test(value), `${tier} has raw rgba: ${value}`);
  }
  assert.ok(
    !("TIER_PILL_STYLES" in badgeUtils),
    "TIER_PILL_STYLES is a dead export and must stay deleted",
  );
});
