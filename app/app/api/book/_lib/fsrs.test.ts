import { test } from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_DESIRED_RETENTION,
  MIN_DESIRED_RETENTION,
  MAX_DESIRED_RETENTION,
  retentionFromTargetPercent,
  createNewCard,
  scheduleCard,
} from "./fsrs";
import type { FSRSCardState, FSRSRating } from "./types";

// ── retentionFromTargetPercent (the SET-3 percentage→fraction resolver) ───────

test("retentionFromTargetPercent maps in-band slider values to fractions", () => {
  assert.equal(retentionFromTargetPercent(95), 0.95);
  assert.equal(retentionFromTargetPercent(90), 0.9);
  // 0.85 is the settings slider's UI default — it must round-trip exactly so a
  // Pro user who leaves the slider untouched is scheduled at the value shown.
  assert.equal(retentionFromTargetPercent(85), 0.85);
  assert.equal(retentionFromTargetPercent(70), 0.7);
});

test("retentionFromTargetPercent falls back to the proven default when absent/invalid", () => {
  assert.equal(retentionFromTargetPercent(undefined), DEFAULT_DESIRED_RETENTION);
  assert.equal(retentionFromTargetPercent(null), DEFAULT_DESIRED_RETENTION);
  assert.equal(retentionFromTargetPercent("85"), DEFAULT_DESIRED_RETENTION);
  assert.equal(retentionFromTargetPercent(NaN), DEFAULT_DESIRED_RETENTION);
  assert.equal(retentionFromTargetPercent(Infinity), DEFAULT_DESIRED_RETENTION);
  assert.equal(retentionFromTargetPercent({}), DEFAULT_DESIRED_RETENTION);
});

test("retentionFromTargetPercent clamps out-of-range values to the [70,95] band", () => {
  // A corrupt / legacy value can never push the scheduler past the slider band.
  assert.equal(retentionFromTargetPercent(200), MAX_DESIRED_RETENTION);
  assert.equal(retentionFromTargetPercent(96), MAX_DESIRED_RETENTION);
  assert.equal(retentionFromTargetPercent(50), MIN_DESIRED_RETENTION);
  assert.equal(retentionFromTargetPercent(0), MIN_DESIRED_RETENTION);
  assert.equal(retentionFromTargetPercent(-10), MIN_DESIRED_RETENTION);
});

// ── scheduleCard honors the per-user retention target ─────────────────────────

const NOW = new Date("2026-06-19T00:00:00.000Z");

function reviewCard(): FSRSCardState {
  // A settled "review"-state card with positive stability so the interval is
  // well above the 1-day floor and differs meaningfully across retention targets.
  return {
    ...createNewCard("book:ch01-c1", "user-1", "book", 1, "front", "back"),
    state: "review",
    stability: 20,
    difficulty: 5,
    reps: 3,
    lastReviewAt: NOW.toISOString(),
  };
}

test("scheduleCard: a HIGHER retention target produces a SHORTER interval (95% < 70%)", () => {
  const rating: FSRSRating = 3; // Good
  const at95 = scheduleCard(reviewCard(), rating, NOW, 0.95);
  const at70 = scheduleCard(reviewCard(), rating, NOW, 0.7);

  // This is the SET-3 promise: "Higher = more frequent reviews."
  assert.ok(
    at95.scheduledDays < at70.scheduledDays,
    `expected 95% interval (${at95.scheduledDays}d) < 70% interval (${at70.scheduledDays}d)`
  );
  // dueAt must move in lockstep with the scheduled interval.
  assert.ok(new Date(at95.dueAt).getTime() < new Date(at70.dueAt).getTime());
});

test("scheduleCard: interval is monotonically non-increasing as the target rises", () => {
  const rating: FSRSRating = 3;
  const targets = [0.7, 0.75, 0.8, 0.85, 0.9, 0.95];
  const intervals = targets.map(
    (t) => scheduleCard(reviewCard(), rating, NOW, t).scheduledDays
  );
  for (let i = 1; i < intervals.length; i += 1) {
    assert.ok(
      intervals[i] <= intervals[i - 1],
      `interval at ${targets[i]} (${intervals[i]}d) should be ≤ interval at ${targets[i - 1]} (${intervals[i - 1]}d)`
    );
  }
  // And the band endpoints are strictly ordered (not all collapsed to the floor).
  assert.ok(intervals[intervals.length - 1] < intervals[0]);
});

test("scheduleCard: omitting the target keeps the proven 0.9 default (backward-compatible)", () => {
  const rating: FSRSRating = 3;
  const implicit = scheduleCard(reviewCard(), rating, NOW);
  const explicit = scheduleCard(reviewCard(), rating, NOW, DEFAULT_DESIRED_RETENTION);
  assert.equal(implicit.scheduledDays, explicit.scheduledDays);
  assert.equal(implicit.dueAt, explicit.dueAt);
});
