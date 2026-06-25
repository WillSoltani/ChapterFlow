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

// ── C4: a lapse must never INCREASE stability (post-lapse clamp) ───────────────
//
// The raw FSRS-5 forget-stability formula can return S_forget > S_prior for a
// low-difficulty, low-stability card reviewed well overdue (low retrievability).
// Without the `min(S_forget, S_prior)` clamp, pressing "Again" (rating 1) would
// schedule the just-failed card FURTHER out than it was before the failure —
// the opposite of what a lapse should do.

/**
 * A card crafted to trigger the unclamped-formula bug: minimum difficulty
 * (d=1 ⇒ d^-w12 is largest), small prior stability, and reviewed a year
 * overdue (low retrievability). With the default weights the raw forget
 * formula overshoots to ~5.08 here — far above the prior stability of 2 —
 * which (unclamped) would schedule the just-FAILED card ~5 days out vs the
 * ~2 days the clamped value gives.
 */
function staleLapseCard(): FSRSCardState {
  return {
    ...createNewCard("book:ch01-c2", "user-1", "book", 1, "front", "back"),
    state: "review",
    stability: 2, // prior stability the lapse must not exceed
    difficulty: 1, // minimum difficulty ⇒ formula yields its largest output
    reps: 4,
    lapses: 0,
    // Last reviewed 365 days before NOW ⇒ retrievability ≈ 0.15.
    lastReviewAt: new Date(NOW.getTime() - 365 * 86400000).toISOString(),
  };
}

test("scheduleCard: a lapse never increases stability (clamped to prior) — C4", () => {
  const card = staleLapseCard();
  const lapsed = scheduleCard(card, 1, NOW);

  // The headline invariant: post-lapse stability must not exceed the prior.
  // Pre-fix the raw forget formula returns ~5.08 here, violating this.
  assert.ok(
    lapsed.stability <= card.stability,
    `post-lapse stability (${lapsed.stability}) must be ≤ prior stability (${card.stability})`
  );
  // It transitions to relearning and counts the lapse.
  assert.equal(lapsed.state, "relearning");
  assert.equal(lapsed.lapses, card.lapses + 1);
});

test("scheduleCard: failing a card schedules it no FURTHER out than the unclamped formula would — C4", () => {
  const card = staleLapseCard();
  const lapsed = scheduleCard(card, 1, NOW);

  // With the clamp, stability stays at the prior 2 ⇒ a short relearning
  // interval. Pre-fix the ~5.08 stability scheduled it ~5 days out — the
  // opposite of what a failure should do. Assert the concrete clamped interval
  // so a regression that drops the clamp is caught at the schedule level too.
  assert.equal(lapsed.stability, card.stability); // clamped exactly to prior (2)
  assert.equal(lapsed.scheduledDays, 2);
});

test("scheduleCard: lapse stability is floored at 0.1 — C4", () => {
  // A genuinely tiny prior stability still yields the 0.1 floor (matching
  // initStability), never 0 or negative, so retrievability/interval stay sane.
  const card: FSRSCardState = {
    ...staleLapseCard(),
    stability: 0.05,
    lastReviewAt: new Date(NOW.getTime() - 1 * 86400000).toISOString(),
  };
  const lapsed = scheduleCard(card, 1, NOW);
  assert.ok(
    lapsed.stability >= 0.1,
    `lapse stability (${lapsed.stability}) must be floored at 0.1`
  );
});
