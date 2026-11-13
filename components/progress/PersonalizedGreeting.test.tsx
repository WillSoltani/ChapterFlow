import "../../tests/_lib/dom";

import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { cleanup, render } from "@testing-library/react";
import { PersonalizedGreeting } from "./PersonalizedGreeting";
import type { Milestone, StreakData, TierPill } from "./progressTypes";

afterEach(() => cleanup());

const STREAK: StreakData = {
  currentDays: 12,
  bestDays: 12,
  lastActiveDate: "Yesterday",
  freezesEquipped: 0,
  freezesAvailable: 0,
  consistencyLast30Days: 20,
  daysActiveLast7: 6,
  atRisk: false,
};

function renderGreeting(
  streak: StreakData,
  completedMinutesToday = 0,
  tier: TierPill | null = { label: "Reader", percent: 28, nextLabel: "Analyst" },
  nextMilestones: Milestone[] = [],
) {
  return render(
    <PersonalizedGreeting
      name="Maya"
      tier={tier}
      streak={streak}
      goalCompletedToday={false}
      nextMilestones={nextMilestones}
      completedMinutesToday={completedMinutesToday}
    />,
  );
}

const NO_STREAK: StreakData = { ...STREAK, currentDays: 0, bestDays: 0, daysActiveLast7: 0 };

function milestone(name: string, current: number, target: number): Milestone {
  return { id: name, name, icon: "Mountain", description: "", current, target };
}

test("a badge not started yet is never called one chapter away", () => {
  // "Hard Finish" needs a whole book: a brand-new reader is not one chapter from it.
  const view = renderGreeting(NO_STREAK, 0, null, [milestone("Hard Finish", 0, 1)]);
  assert.equal(view.queryByText(/Hard Finish/), null);
  assert.ok(view.getByText("Ready to learn something new?"));
});

test("a badge one step from done is named without claiming what the step is", () => {
  const view = renderGreeting(NO_STREAK, 0, null, [milestone("Three Books", 2, 3)]);
  assert.ok(view.getByText("One more to go for the Three Books badge."));
  assert.equal(view.queryByText(/One more chapter/), null);
});

test("a streak at risk asks the reader to read today, with the unchanged streak number", () => {
  const view = renderGreeting({ ...STREAK, atRisk: true });
  assert.ok(view.getByText("Read today to keep your 12-day streak."));
});

test("no at-risk line once the reader has read today", () => {
  const view = renderGreeting({ ...STREAK, atRisk: false }, 5);
  assert.equal(view.queryByText(/Read today to keep your/), null);
  assert.ok(view.getByText("Day 12 of your streak. You're on a roll."));
});

test("the at-risk line follows the analytics flag, not today's minutes", () => {
  // Minutes from another device can be zero locally while the reading day is
  // already recorded: the flag (not the minutes) decides.
  const view = renderGreeting({ ...STREAK, atRisk: false }, 0);
  assert.equal(view.queryByText(/Read today to keep your/), null);
  assert.equal(view.queryByText(/needs you/), null);
});

test("the level pill shows the server tier and its progress toward the next tier", () => {
  const view = renderGreeting(STREAK, 5);
  assert.ok(view.getByText("Reader"));
  const bar = view.getByRole("progressbar");
  assert.equal(bar.getAttribute("aria-valuenow"), "28");
  assert.equal(bar.getAttribute("aria-label"), "Progress to Analyst");
  assert.equal(view.queryByText(/Curious Reader|Active Learner/), null);
});

test("no level pill while the tier read is pending or failed", () => {
  const view = renderGreeting(STREAK, 5, null);
  assert.equal(view.queryByRole("progressbar"), null);
  assert.equal(view.queryByText("Reader"), null);
});
