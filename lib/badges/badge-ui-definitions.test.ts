import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateBadges,
  filterBadges,
  type BadgeProgressStats,
  type BadgeState,
} from "./badge-ui-definitions";

function progressStats(
  overrides: Partial<BadgeProgressStats> = {}
): BadgeProgressStats {
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

function categories(badges: BadgeState[]): Set<string> {
  return new Set(badges.map((badge) => badge.category));
}

test("badge filters preserve All and partition earned from locked badges", () => {
  const badges = evaluateBadges(
    progressStats({
      totalCompletedChapters: 1,
      notesCount: 1,
    })
  );

  assert.equal(filterBadges(badges, "All"), badges);

  const earned = filterBadges(badges, "Earned");
  const locked = filterBadges(badges, "Locked");

  assert.ok(earned.length > 0);
  assert.ok(locked.length > 0);
  assert.ok(earned.every((badge) => badge.earned));
  assert.ok(locked.every((badge) => !badge.earned));
  assert.equal(earned.length + locked.length, badges.length);
  assert.ok(earned.some((badge) => badge.id === "first-chapter"));
  assert.ok(earned.some((badge) => badge.id === "first-note"));
});

test("category filters expose only their documented badge groups", () => {
  const badges = evaluateBadges(progressStats());

  const expectations = [
    ["Streak", new Set(["Consistency"])],
    ["Mastery", new Set(["Mastery", "Reading Depth"])],
    ["Books", new Set(["Books"])],
    ["Notes", new Set(["Notes"])],
    ["Exploration", new Set(["Exploration", "Examples"])],
    ["Elite", new Set(["Elite"])],
  ] as const;

  for (const [filter, expectedCategories] of expectations) {
    const filtered = filterBadges(badges, filter);
    assert.ok(filtered.length > 0, `${filter} should not be empty`);
    assert.deepEqual(categories(filtered), expectedCategories);
  }
});

test("conditional milestone progress reports completed state and clamped labels", () => {
  const badges = evaluateBadges(
    progressStats({
      avgQuizScore: 86,
      quizCount: 10,
      chaptersSimpleCompleted: 1,
      chaptersStandardCompleted: 1,
      chaptersDeeperCompleted: 1,
      usedAllReadingModes: true,
      proActivated: true,
      proMultiTrack: true,
    })
  );
  const byId = new Map(badges.map((badge) => [badge.id, badge]));

  assert.deepEqual(
    {
      earned: byId.get("mode-explorer")?.earned,
      progress: byId.get("mode-explorer")?.progressValue,
      label: byId.get("mode-explorer")?.progressLabel,
    },
    { earned: true, progress: 3, label: "3 of 3 modes" }
  );
  assert.deepEqual(
    {
      earned: byId.get("score-80-ten")?.earned,
      progress: byId.get("score-80-ten")?.progressValue,
      label: byId.get("score-80-ten")?.progressLabel,
    },
    { earned: true, progress: 80, label: "80 of 80 average score" }
  );
  assert.equal(byId.get("pro-activated")?.progressValue, 1);
  assert.equal(byId.get("pro-multi-track")?.progressLabel, "3 of 3 active books");
});
