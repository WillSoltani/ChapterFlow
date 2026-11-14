import "../../tests/_lib/dom";

import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { cleanup, render } from "@testing-library/react";
import { StreakDisplay } from "./StreakDisplay";
import type { StreakData } from "./progressTypes";

afterEach(() => cleanup());

const STREAK: StreakData = {
  currentDays: 12,
  bestDays: 12,
  lastActiveDate: "Today",
  freezesEquipped: 0,
  freezesAvailable: 0,
  consistencyLast30Days: 20,
  daysActiveLast7: 6,
  atRisk: false,
};

test("no shields: no shield line and no link to a freeze the app does not sell", () => {
  const view = render(<StreakDisplay streak={STREAK} />);
  assert.equal(view.queryByText(/Flow Freeze/), null);
  assert.equal(view.queryByText(/Streak Shield/), null);
  assert.equal(view.queryByRole("link"), null);
  // The milestone list is unchanged.
  assert.ok(view.getByText(/14-day milestone in 2 days/));
});

test("shields held: 'N Streak Shields ready'", () => {
  const two = render(<StreakDisplay streak={{ ...STREAK, freezesEquipped: 2, freezesAvailable: 2 }} />);
  assert.ok(two.getByText(/2 Streak Shields ready/));
  cleanup();
  const one = render(<StreakDisplay streak={{ ...STREAK, freezesEquipped: 1, freezesAvailable: 1 }} />);
  assert.ok(one.getByText(/1 Streak Shield ready/));
});
