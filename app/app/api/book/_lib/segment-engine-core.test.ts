import { test } from "node:test";
import assert from "node:assert/strict";
import {
  matchesSegment,
  runSegment,
  type SegmentFilter,
  type SegmentUser,
} from "./segment-engine-core";

const DAY = 86_400_000;

function makeUser(overrides: Partial<SegmentUser> = {}): SegmentUser {
  return {
    userId: "u-1",
    email: "u-1@example.com",
    plan: "FREE",
    proSource: null,
    countryCode: null,
    lastActiveAt: null,
    firstSeenAt: null,
    booksCompleted: 0,
    flowPoints: 0,
    tier: null,
    badgeCount: 0,
    onboardingCompletedAt: null,
    ...overrides,
  };
}

// ─── lastActiveWithinDays — the never-active fan-out leak (H5) ────────────────

test("lastActiveWithinDays gt does NOT match a never-active (absent lastActiveAt) user", () => {
  // `gt N days` means "active within the last N days". A user who has NEVER
  // been active must not be reported as recently-active, or commercial
  // notification fan-out targets people who never used the product.
  const filter: SegmentFilter = {
    field: "lastActiveWithinDays",
    operator: "gt",
    value: 30,
  };
  assert.equal(matchesSegment(makeUser({ lastActiveAt: null }), [filter]), false);
});

test("lastActiveWithinDays gt does NOT match epoch lastActiveAt", () => {
  // An epoch (1970) timestamp is effectively "never active" — far outside any
  // reasonable cutoff — so it must not match the within-N-days filter.
  const filter: SegmentFilter = {
    field: "lastActiveWithinDays",
    operator: "gt",
    value: 30,
  };
  const epochUser = makeUser({ lastActiveAt: new Date(0).toISOString() });
  assert.equal(matchesSegment(epochUser, [filter]), false);
});

test("lastActiveWithinDays gt matches a genuinely recently-active user", () => {
  const filter: SegmentFilter = {
    field: "lastActiveWithinDays",
    operator: "gt",
    value: 30,
  };
  const recent = makeUser({
    lastActiveAt: new Date(Date.now() - 5 * DAY).toISOString(),
  });
  assert.equal(matchesSegment(recent, [filter]), true);
});

test("lastActiveWithinDays gt does NOT match a user active longer ago than the window", () => {
  const filter: SegmentFilter = {
    field: "lastActiveWithinDays",
    operator: "gt",
    value: 30,
  };
  const stale = makeUser({
    lastActiveAt: new Date(Date.now() - 60 * DAY).toISOString(),
  });
  assert.equal(matchesSegment(stale, [filter]), false);
});

test("lastActiveWithinDays lt does NOT match a never-active user", () => {
  // `lt N days` means "inactive for at least N days". Never-active users are
  // selectable via `isEmpty`, not `lt`, so `lt` must not match them either
  // (otherwise `gt` and `lt` would both reject them inconsistently with the
  // old behavior, and fan-out could double-count never-active accounts).
  const filter: SegmentFilter = {
    field: "lastActiveWithinDays",
    operator: "lt",
    value: 30,
  };
  assert.equal(matchesSegment(makeUser({ lastActiveAt: null }), [filter]), false);
});

test("lastActiveWithinDays isEmpty is the way to target never-active users", () => {
  const filter: SegmentFilter = {
    field: "lastActiveWithinDays",
    operator: "isEmpty",
  };
  assert.equal(matchesSegment(makeUser({ lastActiveAt: null }), [filter]), true);
  const active = makeUser({ lastActiveAt: new Date().toISOString() });
  assert.equal(matchesSegment(active, [filter]), false);
});

test("runSegment excludes never-active users from a within-N-days fan-out audience", () => {
  const filter: SegmentFilter = {
    field: "lastActiveWithinDays",
    operator: "gt",
    value: 30,
  };
  const users = [
    makeUser({ userId: "active", lastActiveAt: new Date(Date.now() - DAY).toISOString() }),
    makeUser({ userId: "never", lastActiveAt: null }),
    makeUser({ userId: "epoch", lastActiveAt: new Date(0).toISOString() }),
    makeUser({ userId: "stale", lastActiveAt: new Date(Date.now() - 90 * DAY).toISOString() }),
  ];
  const matched = runSegment(users, [filter]).map((u) => u.userId);
  assert.deepEqual(matched, ["active"]);
});
