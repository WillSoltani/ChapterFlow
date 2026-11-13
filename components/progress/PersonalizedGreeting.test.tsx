import "../../tests/_lib/dom";

import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { cleanup, render } from "@testing-library/react";
import { PersonalizedGreeting } from "./PersonalizedGreeting";
import type { StreakData } from "./progressTypes";

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

function renderGreeting(streak: StreakData, completedMinutesToday = 0) {
  return render(
    <PersonalizedGreeting
      name="Maya"
      readerLevel="Active Learner"
      readerLevelProgress={40}
      streak={streak}
      goalCompletedToday={false}
      nextMilestones={[]}
      completedMinutesToday={completedMinutesToday}
      targetMinutes={20}
    />,
  );
}

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
