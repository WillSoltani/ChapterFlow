import assert from "node:assert/strict";
import { test } from "node:test";

import {
  bookCtaLabel,
  continueHref,
  dailyGoalFromSettings,
  daysAtGoal,
  resumeChapterNumber,
  shouldAutoScrollToChapter,
} from "./book-cta-core";

// D4 / C13: "Continue" opens the chapter it names.

test("resume chapter is the server's current chapter when known", () => {
  assert.equal(
    resumeChapterNumber({ currentChapterNumber: 4, chaptersCompleted: 2, chapterCount: 10 }),
    4,
  );
});

test("without a current chapter it falls back to completed + 1", () => {
  assert.equal(resumeChapterNumber({ chaptersCompleted: 3, chapterCount: 10 }), 4);
  assert.equal(
    resumeChapterNumber({ currentChapterNumber: null, chaptersCompleted: 0, chapterCount: 10 }),
    1,
  );
});

test("resume chapter is capped at the chapter count (and never below 1)", () => {
  assert.equal(resumeChapterNumber({ chaptersCompleted: 10, chapterCount: 10 }), 10);
  assert.equal(
    resumeChapterNumber({ currentChapterNumber: 14, chaptersCompleted: 2, chapterCount: 12 }),
    12,
  );
  assert.equal(resumeChapterNumber({ currentChapterNumber: 0, chaptersCompleted: 0, chapterCount: 0 }), 1);
});

test("the label names the same chapter the link opens", () => {
  const n = resumeChapterNumber({ currentChapterNumber: 7, chaptersCompleted: 6, chapterCount: 20 });
  const href = continueHref("atomic-habits", n);
  const label = bookCtaLabel(n);
  assert.equal(href, "/book/library/atomic-habits/chapter/7");
  assert.equal(label, "Continue chapter 7");
  assert.equal(href.split("/").at(-1), label.match(/\d+$/)?.[0]);
});

test("book ids are encoded in the link", () => {
  assert.equal(continueHref("a b", 2), "/book/library/a%20b/chapter/2");
});

// HOME-10: the book page hero and its phone sticky bar share one label.

test("a finished book says Review book", () => {
  assert.equal(bookCtaLabel(1, { allCompleted: true, started: true }), "Review book");
});

test("a started book says Continue chapter N", () => {
  assert.equal(bookCtaLabel(5, { allCompleted: false, started: true }), "Continue chapter 5");
});

test("a book not started says Start chapter N", () => {
  assert.equal(bookCtaLabel(1, { allCompleted: false, started: false }), "Start chapter 1");
});

// HOME-24 + ACCT-03: "~N days at your daily goal" uses the real goal and the
// minutes still left.

test("a 60-minute book at a 5-minute goal takes 12 days", () => {
  assert.equal(daysAtGoal({ estimatedMinutes: 60, progressPercent: 0, goalMinutes: 5 }), 12);
});

test("a 60-minute book at a 10-minute goal takes 6 days, not 12", () => {
  assert.equal(daysAtGoal({ estimatedMinutes: 60, progressPercent: 0, goalMinutes: 10 }), 6);
});

test("progress shortens the estimate (rounded up)", () => {
  assert.equal(daysAtGoal({ estimatedMinutes: 60, progressPercent: 90, goalMinutes: 5 }), 2);
  assert.equal(daysAtGoal({ estimatedMinutes: 60, progressPercent: 50, goalMinutes: 20 }), 2);
});

test("the estimate is never below 1 day", () => {
  assert.equal(daysAtGoal({ estimatedMinutes: 60, progressPercent: 100, goalMinutes: 5 }), 1);
  assert.equal(daysAtGoal({ estimatedMinutes: 0, progressPercent: 0, goalMinutes: 5 }), 1);
});

test("a goal below 5 minutes counts as 5", () => {
  assert.equal(daysAtGoal({ estimatedMinutes: 60, progressPercent: 0, goalMinutes: 1 }), 12);
});

test("goal: the Settings preset wins, 5 minutes allowed", () => {
  assert.equal(
    dailyGoalFromSettings(
      { extended: { dailyGoalPreset: 5 }, dailyGoal: 20, onboarding: { dailyGoal: 30 } },
      10,
    ),
    5,
  );
});

test("goal: then settings.dailyGoal, then onboarding.dailyGoal, then the caller default", () => {
  assert.equal(dailyGoalFromSettings({ dailyGoal: 20, onboarding: { dailyGoal: 30 } }, 10), 20);
  assert.equal(dailyGoalFromSettings({ onboarding: { dailyGoal: 30 } }, 10), 30);
  assert.equal(dailyGoalFromSettings({}, 15), 15);
  assert.equal(dailyGoalFromSettings(null, 15), 15);
  assert.equal(dailyGoalFromSettings(undefined, 15), 15);
});

test("goal: non-numbers are skipped and the result is never below 5", () => {
  assert.equal(dailyGoalFromSettings({ extended: { dailyGoalPreset: "x" }, dailyGoal: 20 }, 10), 20);
  assert.equal(dailyGoalFromSettings({ dailyGoal: 0 }, 2), 5);
});

// The book page scrolls to the reader's chapter only for a book already started.

test("auto-scroll: a book not started keeps the top of the page in view", () => {
  assert.equal(
    shouldAutoScrollToChapter({ completedCount: 0, progressPercent: 0, rowFullyInView: false }),
    false,
  );
});

test("auto-scroll: a started book scrolls to the current chapter", () => {
  assert.equal(
    shouldAutoScrollToChapter({ completedCount: 3, progressPercent: 30, rowFullyInView: false }),
    true,
  );
  assert.equal(
    shouldAutoScrollToChapter({ completedCount: 0, progressPercent: 5, rowFullyInView: false }),
    true,
  );
});

test("auto-scroll: no scroll when the current chapter row is already fully in view", () => {
  assert.equal(
    shouldAutoScrollToChapter({ completedCount: 3, progressPercent: 30, rowFullyInView: true }),
    false,
  );
});
