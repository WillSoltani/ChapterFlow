import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildDailyQuests,
  goalRingCenter,
  stepsCompletedToday,
  type QuestAnalytics,
} from "./daily-quests-core";

const TODAY = "2026-11-13";

function lead(overrides: Partial<QuestAnalytics["recentlyOpenedSnapshots"][number]> = {}) {
  return {
    book: { id: "atomic-habits" },
    resumeChapterNumber: 4,
    currentLoopStep: "quiz" as const,
    lastActivityAt: "2026-11-13T09:00:00",
    ...overrides,
  };
}

function analytics(overrides: Partial<QuestAnalytics> = {}): QuestAnalytics {
  return {
    dailyGoalMinutes: 20,
    minutesReadToday: 3,
    readingHistoryOff: false,
    heatmapCells: [{ key: TODAY, chapters: 0 }],
    recentlyOpenedSnapshots: [lead()],
    ...overrides,
  };
}

test("PROG-16: the reading quest uses the reader's daily goal", () => {
  const [q1] = buildDailyQuests(analytics({ dailyGoalMinutes: 20, minutesReadToday: 12 }), 0, TODAY);
  assert.equal(q1!.id, "q1");
  assert.equal(q1!.title, "Read for 20 minutes");
  assert.equal(q1!.target, 20);
  assert.equal(q1!.current, 12);
  assert.equal(q1!.completed, false);
});

test("PROG-16: quest 2 is 'Finish a chapter' and counts chapters finished today", () => {
  const quests = buildDailyQuests(analytics({ heatmapCells: [{ key: TODAY, chapters: 1 }] }), 0, TODAY);
  const q2 = quests.find((q) => q.id === "q2")!;
  assert.equal(q2.title, "Finish a chapter");
  assert.equal(q2.completed, true);
});

test("PROG-16 / C13: quests 1 and 2 open the lead book's resume chapter", () => {
  const quests = buildDailyQuests(analytics(), 0, TODAY);
  assert.equal(quests[0]!.href, "/book/library/atomic-habits/chapter/4");
  assert.equal(quests[1]!.href, "/book/library/atomic-habits/chapter/4");
});

test("PROG-16: without a book in progress, quests 1 and 2 open the Library", () => {
  const quests = buildDailyQuests(analytics({ recentlyOpenedSnapshots: [] }), 0, TODAY);
  assert.equal(quests[0]!.href, "/book/library");
  assert.equal(quests[1]!.href, "/book/library");
});

test("PROG-16: the review quest targets at most 5 and never more than are due", () => {
  const three = buildDailyQuests(analytics(), 3, TODAY).find((q) => q.id === "q3")!;
  assert.equal(three.title, "Review 3 concepts");
  assert.equal(three.target, 3);
  const many = buildDailyQuests(analytics(), 40, TODAY).find((q) => q.id === "q3")!;
  assert.equal(many.title, "Review 5 concepts");
  assert.equal(many.target, 5);
});

test("PROG-16: the review quest is hidden when nothing is due", () => {
  const quests = buildDailyQuests(analytics(), 0, TODAY);
  assert.equal(quests.some((q) => q.id === "q3"), false);
});

test("PROG-16: cards reviewed today keep the review quest, done, after the deck empties", () => {
  const q3 = buildDailyQuests(analytics(), 0, TODAY, 4).find((q) => q.id === "q3")!;
  assert.equal(q3.target, 4);
  assert.equal(q3.current, 4);
  assert.equal(q3.completed, true);
});

test("PROG-26: the reading quest is flagged while reading history is off", () => {
  const [q1] = buildDailyQuests(analytics({ readingHistoryOff: true }), 0, TODAY);
  assert.equal(q1!.historyOff, true);
});

test("PROG-14: the ring centre shows minutes done, not minutes left", () => {
  assert.deepEqual(goalRingCenter(3, 10), { value: "3m", caption: "of 10 min" });
  assert.deepEqual(goalRingCenter(0, 10), { value: "0m", caption: "of 10 min" });
  assert.deepEqual(goalRingCenter(12, 10), { value: "Done!", caption: "10 min goal reached" });
});

test("PROG-14: partial steps count only when the lead book was active today", () => {
  const today = analytics({ heatmapCells: [{ key: TODAY, chapters: 1 }] });
  // one chapter (4 steps) + the quiz step reached today (2 steps before it)
  assert.equal(stepsCompletedToday(today, TODAY), 6);
  const yesterday = analytics({
    heatmapCells: [{ key: TODAY, chapters: 0 }],
    recentlyOpenedSnapshots: [lead({ lastActivityAt: "2026-11-12T21:00:00" })],
  });
  assert.equal(stepsCompletedToday(yesterday, TODAY), 0);
});
