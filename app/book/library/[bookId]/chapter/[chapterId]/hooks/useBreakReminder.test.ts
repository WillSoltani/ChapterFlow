import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BREAK_IDLE_TIMEOUT_MS,
  advanceBreakAccumulator,
  isEngagedForBreak,
  type BreakAccumulator,
} from "./useBreakReminder";

// ─── isEngagedForBreak ───────────────────────────────────────────────────────

test("engaged: recently active + visible + focused", () => {
  assert.equal(
    isEngagedForBreak({ now: 1_000, lastActivityAt: 1_000, visible: true, focused: true }),
    true
  );
});

test("not engaged: activity older than the idle timeout", () => {
  assert.equal(
    isEngagedForBreak({
      now: BREAK_IDLE_TIMEOUT_MS + 2,
      lastActivityAt: 1,
      visible: true,
      focused: true,
    }),
    false
  );
});

test("engaged: exactly at the idle boundary still counts", () => {
  assert.equal(
    isEngagedForBreak({
      now: BREAK_IDLE_TIMEOUT_MS,
      lastActivityAt: 0,
      visible: true,
      focused: true,
    }),
    true
  );
});

test("not engaged: tab hidden", () => {
  assert.equal(
    isEngagedForBreak({ now: 1_000, lastActivityAt: 1_000, visible: false, focused: true }),
    false
  );
});

test("not engaged: window blurred", () => {
  assert.equal(
    isEngagedForBreak({ now: 1_000, lastActivityAt: 1_000, visible: true, focused: false }),
    false
  );
});

// ─── advanceBreakAccumulator ─────────────────────────────────────────────────

const MIN = 60_000;

test("accrues engaged time but does not fire below the interval", () => {
  const r = advanceBreakAccumulator({
    state: { engagedMs: 0, lastTickAt: 0 },
    now: 5_000,
    engaged: true,
    paused: false,
    intervalMs: 30 * MIN,
  });
  assert.equal(r.fire, false);
  assert.equal(r.state.engagedMs, 5_000);
  assert.equal(r.state.lastTickAt, 5_000);
});

test("fires and resets when engaged time crosses the interval", () => {
  const r = advanceBreakAccumulator({
    state: { engagedMs: 29 * MIN, lastTickAt: 0 },
    now: 2 * MIN, // delta 2 min → 31 min ≥ 30 min
    engaged: true,
    paused: false,
    intervalMs: 30 * MIN,
  });
  assert.equal(r.fire, true);
  assert.equal(r.state.engagedMs, 0, "accumulator resets after firing");
  assert.equal(r.state.lastTickAt, 2 * MIN);
});

test("fires exactly at the interval boundary", () => {
  const r = advanceBreakAccumulator({
    state: { engagedMs: 30 * MIN - 5_000, lastTickAt: 0 },
    now: 5_000,
    engaged: true,
    paused: false,
    intervalMs: 30 * MIN,
  });
  assert.equal(r.fire, true);
  assert.equal(r.state.engagedMs, 0);
});

test("idle time is dropped: no accrual, no fire, clock advances", () => {
  const r = advanceBreakAccumulator({
    state: { engagedMs: 12 * MIN, lastTickAt: 1_000 },
    now: 1_000 + 10 * MIN, // a big gap, but not engaged
    engaged: false,
    paused: false,
    intervalMs: 30 * MIN,
  });
  assert.equal(r.fire, false);
  assert.equal(r.state.engagedMs, 12 * MIN, "idle gap is not credited");
  assert.equal(r.state.lastTickAt, 1_000 + 10 * MIN, "clock still advances so the gap is never back-credited");
});

test("paused (mid-quiz) time is dropped just like idle time", () => {
  const r = advanceBreakAccumulator({
    state: { engagedMs: 20 * MIN, lastTickAt: 0 },
    now: 5 * MIN,
    engaged: true,
    paused: true, // e.g. quiz tab active
    intervalMs: 30 * MIN,
  });
  assert.equal(r.fire, false);
  assert.equal(r.state.engagedMs, 20 * MIN, "quiz time does not count toward a break");
  assert.equal(r.state.lastTickAt, 5 * MIN);
});

test("repeats: reminders fire every interval of engaged reading", () => {
  let state: BreakAccumulator = { engagedMs: 0, lastTickAt: 0 };
  const intervalMs = 15 * MIN;
  let fires = 0;
  // Simulate 46 minutes of continuous engaged reading in 1-minute ticks.
  for (let minute = 1; minute <= 46; minute += 1) {
    const r = advanceBreakAccumulator({
      state,
      now: minute * MIN,
      engaged: true,
      paused: false,
      intervalMs,
    });
    state = r.state;
    if (r.fire) fires += 1;
  }
  // 15, 30, 45 → three nudges across 46 minutes.
  assert.equal(fires, 3);
});

test("never fires when the interval is non-positive (defensive)", () => {
  const r = advanceBreakAccumulator({
    state: { engagedMs: 0, lastTickAt: 0 },
    now: 10 * MIN,
    engaged: true,
    paused: false,
    intervalMs: 0,
  });
  assert.equal(r.fire, false);
  assert.equal(r.state.engagedMs, 10 * MIN);
});
