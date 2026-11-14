import { test } from "node:test";
import assert from "node:assert/strict";
import { buildReviewDataFromCards, moreDueAfterSession } from "./review-data-core";

// Local-time fixtures so the day boundaries match the reader's day.
const NOW = new Date(2026, 10, 13, 9, 0, 0); // Nov 13, 09:00 local
const at = (day: number, hour: number) => new Date(2026, 10, day, hour, 0, 0).toISOString();
const card = (dueAt: string) => ({ dueAt, lastReviewAt: at(10, 9), reps: 1 });

test("PROG-08: a card due later today is not due now; it is counted separately", () => {
  const data = buildReviewDataFromCards([card(at(13, 20))], NOW);
  assert.equal(data.overdueCount, 0);
  assert.equal(data.dueTodayCount, 0);
  assert.equal(data.laterTodayCount, 1);
});

test("PROG-08: due now uses the server rule, dueAt <= now", () => {
  const data = buildReviewDataFromCards(
    [card(at(12, 20)), card(at(13, 8)), card(NOW.toISOString()), card(at(13, 10))],
    NOW,
  );
  assert.equal(data.overdueCount, 1); // before today
  assert.equal(data.dueTodayCount, 2); // today, at or before now
  assert.equal(data.laterTodayCount, 1);
  assert.equal(data.overdueCount + data.dueTodayCount, 3); // what the session will show
});

test("PROG-08: the forecast's today cell counts everything due today, the week counts upcoming days", () => {
  const data = buildReviewDataFromCards(
    [card(at(12, 20)), card(at(13, 10)), card(at(15, 9)), card(at(25, 9))],
    NOW,
  );
  assert.equal(data.forecast.length, 7);
  assert.equal(data.forecast[0]!.count, 2);
  assert.equal(data.forecast[2]!.count, 1);
  assert.equal(data.upcomingThisWeekCount, 1);
  assert.equal(data.totalConceptsLearned, 4);
});

test("PROG-08: after a full page, the session reports how many more are due", () => {
  assert.deepEqual(moreDueAfterSession({ hasMore: true, totalDue: 45, sessionSize: 20 }), { more: true, count: 25 });
});

test("PROG-08: more cards without a known total still offer Keep going", () => {
  assert.deepEqual(moreDueAfterSession({ hasMore: true, totalDue: null, sessionSize: 50 }), { more: true, count: null });
  assert.deepEqual(moreDueAfterSession({ hasMore: true, totalDue: 50, sessionSize: 50 }), { more: true, count: null });
});

test("PROG-08: nothing more due when the server says there is no next page", () => {
  assert.deepEqual(moreDueAfterSession({ hasMore: false, totalDue: 45, sessionSize: 20 }), { more: false, count: null });
});
