import { test } from "node:test";
import assert from "node:assert/strict";

import { daysBetween, decideStreakOnActiveDay } from "./streak-policy";

// Convenience: a fully-specified input with sensible defaults.
function input(over: Partial<Parameters<typeof decideStreakOnActiveDay>[0]> = {}) {
  return {
    lastActiveDate: "2026-06-10",
    today: "2026-06-11",
    currentStreak: 5,
    shieldsHeld: 0,
    mode: "standard" as const,
    skipDays: 0,
    ...over,
  };
}

test("daysBetween counts whole calendar days", () => {
  assert.equal(daysBetween("2026-06-10", "2026-06-11"), 1);
  assert.equal(daysBetween("2026-06-10", "2026-06-13"), 3);
  assert.equal(daysBetween("2026-06-10", "2026-06-10"), 0);
  // Spans a month boundary correctly.
  assert.equal(daysBetween("2026-05-31", "2026-06-02"), 2);
});

test("first ever active day → streak 1, no gap", () => {
  const d = decideStreakOnActiveDay(input({ lastActiveDate: null, currentStreak: 0 }));
  assert.equal(d.newCurrentStreak, 1);
  assert.equal(d.gapDays, 0);
  assert.equal(d.streakReset, false);
  assert.equal(d.flexibleSkipApplied, false);
  assert.equal(d.alreadyCountedToday, false);
});

test("already counted today → no-op flag, streak unchanged", () => {
  const d = decideStreakOnActiveDay(input({ lastActiveDate: "2026-06-11", today: "2026-06-11" }));
  assert.equal(d.alreadyCountedToday, true);
  assert.equal(d.newCurrentStreak, 5);
  assert.equal(d.gapDays, 0);
});

test("consecutive day → +1", () => {
  const d = decideStreakOnActiveDay(input({ lastActiveDate: "2026-06-10", today: "2026-06-11" }));
  assert.equal(d.newCurrentStreak, 6);
  assert.equal(d.gapDays, 1);
  assert.equal(d.streakReset, false);
});

// ── Standard / off (legacy behavior must be byte-identical) ────────────────

test("standard: gap of 2 with no shields → reset to 1", () => {
  const d = decideStreakOnActiveDay(input({ lastActiveDate: "2026-06-09", today: "2026-06-11", shieldsHeld: 0 }));
  assert.equal(d.gapDays, 2);
  assert.equal(d.streakReset, true);
  assert.equal(d.newCurrentStreak, 1);
  assert.equal(d.shieldsConsumed, 0);
  assert.equal(d.newShieldsHeld, 0);
});

test("standard: shields bridge the gap and ARE credited (currentStreak += gapDays)", () => {
  // gap 3 = 2 missed days; 2 shields cover them.
  const d = decideStreakOnActiveDay(input({
    lastActiveDate: "2026-06-08", today: "2026-06-11", currentStreak: 5, shieldsHeld: 2,
  }));
  assert.equal(d.gapDays, 3);
  assert.equal(d.streakReset, false);
  assert.equal(d.newCurrentStreak, 8); // 5 + gapDays(3)
  assert.equal(d.shieldsConsumed, 2);
  assert.equal(d.newShieldsHeld, 0);
  assert.deepEqual(d.appendedShieldDates, ["2026-06-09", "2026-06-10"]);
  assert.equal(d.flexibleSkipApplied, false);
});

test("standard: shields insufficient → reset, all shields consumed", () => {
  const d = decideStreakOnActiveDay(input({
    lastActiveDate: "2026-06-07", today: "2026-06-11", currentStreak: 9, shieldsHeld: 1,
  }));
  assert.equal(d.gapDays, 4); // 3 missed days, only 1 shield
  assert.equal(d.streakReset, true);
  assert.equal(d.newCurrentStreak, 1);
  assert.equal(d.shieldsConsumed, 1);
  assert.equal(d.newShieldsHeld, 0);
});

test("flexible mode does NOT change standard-equivalent paths when skipDays=0", () => {
  const d = decideStreakOnActiveDay(input({
    lastActiveDate: "2026-06-09", today: "2026-06-11", mode: "flexible", skipDays: 0, shieldsHeld: 0,
  }));
  assert.equal(d.streakReset, true);
  assert.equal(d.flexibleSkipApplied, false);
});

// ── Flexible: consecutive-skip tolerance, PRESERVE (don't credit skips) ─────

test("flexible: a gap within skipDays is forgiven, streak preserved (+1 only)", () => {
  // skip=2, gap 2 = 1 missed day → forgiven; streak goes 5 → 6 (NOT 5 + gapDays).
  const d = decideStreakOnActiveDay(input({
    lastActiveDate: "2026-06-09", today: "2026-06-11", currentStreak: 5, mode: "flexible", skipDays: 2,
  }));
  assert.equal(d.gapDays, 2);
  assert.equal(d.flexibleSkipApplied, true);
  assert.equal(d.streakReset, false);
  assert.equal(d.newCurrentStreak, 6); // preserve: skipped day NOT credited
});

test("flexible: gap exactly at the skip limit (3 missed days, skip=3) is forgiven", () => {
  const d = decideStreakOnActiveDay(input({
    lastActiveDate: "2026-06-07", today: "2026-06-11", currentStreak: 10, mode: "flexible", skipDays: 3,
  }));
  assert.equal(d.gapDays, 4); // 3 missed days
  assert.equal(d.flexibleSkipApplied, true);
  assert.equal(d.streakReset, false);
  assert.equal(d.newCurrentStreak, 11);
});

test("flexible: a gap beyond skipDays (and beyond shields) resets", () => {
  // skip=2 forgives ≤2 missed days; here 3 missed days, no shields → reset.
  const d = decideStreakOnActiveDay(input({
    lastActiveDate: "2026-06-07", today: "2026-06-11", currentStreak: 10, mode: "flexible", skipDays: 2, shieldsHeld: 0,
  }));
  assert.equal(d.gapDays, 4); // 3 missed days
  assert.equal(d.flexibleSkipApplied, false);
  assert.equal(d.streakReset, true);
  assert.equal(d.newCurrentStreak, 1);
});

test("flexible: skip tolerance is tried BEFORE shields (paid shields preserved)", () => {
  // gap 2 = 1 missed day, within skip=2; user also holds 3 shields. The free
  // skip covers it, so no shield is burned.
  const d = decideStreakOnActiveDay(input({
    lastActiveDate: "2026-06-09", today: "2026-06-11", currentStreak: 5, mode: "flexible", skipDays: 2, shieldsHeld: 3,
  }));
  assert.equal(d.flexibleSkipApplied, true);
  assert.equal(d.shieldsConsumed, 0);
  assert.equal(d.newShieldsHeld, 3); // shields untouched
  assert.equal(d.newCurrentStreak, 6);
});

test("flexible: gap beyond skip but within shields falls through to a shield bridge", () => {
  // skip=1 forgives ≤1 missed day; here 3 missed days but 3 shields → bridge.
  const d = decideStreakOnActiveDay(input({
    lastActiveDate: "2026-06-07", today: "2026-06-11", currentStreak: 4, mode: "flexible", skipDays: 1, shieldsHeld: 3,
  }));
  assert.equal(d.gapDays, 4);
  assert.equal(d.flexibleSkipApplied, false);
  assert.equal(d.streakReset, false);
  assert.equal(d.shieldsConsumed, 3);
  assert.equal(d.newShieldsHeld, 0);
  assert.equal(d.newCurrentStreak, 8); // 4 + gapDays(4) — bridge credits skipped days
});

test("flexible: repeated single-day skips never inflate beyond active days (preserve)", () => {
  // Simulate read-skip-read-skip-read with skip=1: each forgiven gap only +1.
  let currentStreak = 3;
  // gap 2 (1 missed), forgiven, +1
  let d = decideStreakOnActiveDay(input({
    lastActiveDate: "2026-06-09", today: "2026-06-11", currentStreak, mode: "flexible", skipDays: 1,
  }));
  assert.equal(d.flexibleSkipApplied, true);
  currentStreak = d.newCurrentStreak;
  assert.equal(currentStreak, 4);
  // another gap 2, forgiven, +1
  d = decideStreakOnActiveDay(input({
    lastActiveDate: "2026-06-13", today: "2026-06-15", currentStreak, mode: "flexible", skipDays: 1,
  }));
  assert.equal(d.flexibleSkipApplied, true);
  assert.equal(d.newCurrentStreak, 5); // not inflated by the 2 skipped calendar days
});
