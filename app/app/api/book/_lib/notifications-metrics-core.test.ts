import { test } from "node:test";
import assert from "node:assert/strict";
import {
  aggregateNotificationMetrics,
  windowCutoff,
  rowDay,
  type NotificationMetricRow,
} from "./notifications-metrics-core";

/**
 * Admin notifications dailyVolume — H14 regression.
 *
 * Pre-fix the route bucketed dailyVolume + read-rate aggregates from a capped Scan
 * in DynamoDB HASH order, so once the table exceeded the cap the counts came from a
 * non-recency-correlated sample (recent days under/random-counted). The fix bounds
 * the scan to the metrics window and lets this pure core do the counting. These
 * tests pin the cutoff math and the in-window bucketing.
 */

const row = (createdAt: string, opts?: Partial<NotificationMetricRow>): NotificationMetricRow => ({
  type: "badge_earned",
  channel: "in_app",
  readAt: null,
  createdAt,
  ...opts,
});

// ── windowCutoff ────────────────────────────────────────────────────────────

test("(a) windowCutoff returns the earliest day key as the lower bound", () => {
  const days = ["2026-06-18", "2026-06-19", "2026-06-20", "2026-06-21", "2026-06-22", "2026-06-23", "2026-06-24"];
  assert.equal(windowCutoff(days), "2026-06-18");
});

test("(b) windowCutoff is order-independent (takes the min, not days[0])", () => {
  assert.equal(windowCutoff(["2026-06-24", "2026-06-18", "2026-06-20"]), "2026-06-18");
});

test("(c) the cutoff lexicographically precedes every in-window ISO timestamp", () => {
  const cut = windowCutoff(["2026-06-18", "2026-06-24"]);
  // Full ISO timestamps on the cutoff day and later must all sort >= the cutoff,
  // so `createdAt >= :cut` captures the whole first day. (ISO UTC: lexicographic
  // order === chronological order.)
  assert.ok("2026-06-18T00:00:00.000Z" >= cut);
  assert.ok("2026-06-18T23:59:59.999Z" >= cut);
  assert.ok("2026-06-24T12:00:00.000Z" >= cut);
  // A timestamp from the day BEFORE the window must sort below the cutoff.
  assert.ok(!("2026-06-17T23:59:59.999Z" >= cut));
});

test("(d) windowCutoff on an empty window is ''", () => {
  assert.equal(windowCutoff([]), "");
});

// ── rowDay ──────────────────────────────────────────────────────────────────

test("(e) rowDay slices the YYYY-MM-DD prefix; missing/invalid createdAt → ''", () => {
  assert.equal(rowDay(row("2026-06-20T08:00:00.000Z")), "2026-06-20");
  assert.equal(rowDay({}), "");
  assert.equal(rowDay({ createdAt: null }), "");
});

// ── aggregateNotificationMetrics: daily volume ──────────────────────────────

const WEEK = ["2026-06-18", "2026-06-19", "2026-06-20", "2026-06-21", "2026-06-22", "2026-06-23", "2026-06-24"];

test("(f) dailyVolume buckets each row to its createdAt day, one entry per requested day in order", () => {
  const rows = [
    row("2026-06-20T01:00:00.000Z"),
    row("2026-06-20T09:00:00.000Z"),
    row("2026-06-20T22:00:00.000Z"),
    row("2026-06-24T12:00:00.000Z"),
  ];
  const { dailyVolume } = aggregateNotificationMetrics(rows, WEEK);

  assert.deepEqual(
    dailyVolume.map((d) => d.date),
    WEEK,
    "series preserves the requested day order with no gaps",
  );
  const byDate = new Map(dailyVolume.map((d) => [d.date, d.value]));
  assert.equal(byDate.get("2026-06-20"), 3);
  assert.equal(byDate.get("2026-06-24"), 1);
  assert.equal(byDate.get("2026-06-19"), 0, "a day with no rows reports 0, not omitted");
});

test("(g) THE H14 GUARD: real per-day counts on a large recent population (no hash-order sampling)", () => {
  // Simulate a busy week: 1000 notifications/day for 7 days = 7000 in-window rows.
  // The OLD route examined an arbitrary 5000-of-all-time SAMPLE in hash order, so a
  // given day could come back anywhere from 0..1000. The window-bounded scan + this
  // core count EVERY in-window row, so each day is EXACTLY its true volume.
  const rows: NotificationMetricRow[] = [];
  for (const day of WEEK) {
    for (let i = 0; i < 1000; i++) {
      rows.push(row(`${day}T${String(i % 24).padStart(2, "0")}:00:00.000Z`));
    }
  }
  const { dailyVolume } = aggregateNotificationMetrics(rows, WEEK);
  for (const d of dailyVolume) {
    assert.equal(d.value, 1000, `day ${d.date} must be its true volume, not a sampled fraction`);
  }
});

test("(h) rows OUTSIDE the requested window contribute to nothing (defensive boundary)", () => {
  const rows = [
    row("2026-06-17T23:59:59.000Z"), // day before window
    row("2026-06-25T00:00:00.000Z"), // day after window
    row("2026-06-21T10:00:00.000Z"), // in window
  ];
  const { dailyVolume, aggregates } = aggregateNotificationMetrics(rows, WEEK);
  const total = dailyVolume.reduce((s, d) => s + d.value, 0);
  assert.equal(total, 1, "only the single in-window row is counted in the series");
  assert.equal(aggregates.reduce((s, a) => s + a.sent, 0), 1, "and in the aggregates");
});

// ── aggregateNotificationMetrics: read-rate aggregates ──────────────────────

test("(i) aggregates count sent/read per type+channel and compute readRate (rounded %)", () => {
  const rows = [
    row("2026-06-20T01:00:00.000Z", { type: "streak", readAt: "2026-06-20T02:00:00.000Z" }),
    row("2026-06-20T03:00:00.000Z", { type: "streak", readAt: null }),
    row("2026-06-20T04:00:00.000Z", { type: "streak", readAt: "2026-06-20T05:00:00.000Z" }),
    row("2026-06-21T01:00:00.000Z", { type: "digest", channel: "email", readAt: null }),
  ];
  const { aggregates } = aggregateNotificationMetrics(rows, WEEK);

  const streak = aggregates.find((a) => a.type === "streak" && a.channel === "in_app");
  assert.ok(streak);
  assert.equal(streak.sent, 3);
  assert.equal(streak.read, 2);
  assert.equal(streak.readRate, 67, "2/3 rounds to 67%");

  const digest = aggregates.find((a) => a.type === "digest" && a.channel === "email");
  assert.ok(digest);
  assert.equal(digest.sent, 1);
  assert.equal(digest.read, 0);
  assert.equal(digest.readRate, 0);
});

test("(j) aggregates are sorted most-sent first", () => {
  const rows = [
    row("2026-06-20T01:00:00.000Z", { type: "a" }),
    row("2026-06-20T02:00:00.000Z", { type: "b" }),
    row("2026-06-20T03:00:00.000Z", { type: "b" }),
    row("2026-06-20T04:00:00.000Z", { type: "b" }),
    row("2026-06-20T05:00:00.000Z", { type: "c" }),
    row("2026-06-20T06:00:00.000Z", { type: "c" }),
  ];
  const { aggregates } = aggregateNotificationMetrics(rows, WEEK);
  assert.deepEqual(
    aggregates.map((a) => a.type),
    ["b", "c", "a"],
  );
});

test("(k) missing type/channel default to 'unknown'/'in_app'", () => {
  const { aggregates } = aggregateNotificationMetrics(
    [{ createdAt: "2026-06-20T01:00:00.000Z" }],
    WEEK,
  );
  assert.equal(aggregates.length, 1);
  assert.equal(aggregates[0]!.type, "unknown");
  assert.equal(aggregates[0]!.channel, "in_app");
});
