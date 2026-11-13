import "../../tests/_lib/dom";

import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { cleanup, render, screen } from "@testing-library/react";
import { StreakBadge } from "./StreakBadge";

// C2: Home shows the existing "at risk" state (streak alive through yesterday,
// nothing read yet today). The number itself is unchanged.

afterEach(cleanup);

test("at risk: says to read today to keep the streak", () => {
  render(<StreakBadge count={5} atRisk />);
  assert.ok(screen.getByText("Read today to keep your 5-day streak."));
});

test("not at risk: shows the count only", () => {
  render(<StreakBadge count={5} />);
  assert.equal(screen.queryByText(/Read today/), null);
  assert.ok(screen.getByText("5"));
});

test("no streak: unchanged prompt, even if flagged", () => {
  render(<StreakBadge count={0} atRisk />);
  assert.ok(screen.getByText("Start your streak today"));
  assert.equal(screen.queryByText(/Read today/), null);
});
