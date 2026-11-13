// Pure maths for the Progress "Knowledge Review" block (PROG-08).
//
// "Due now" follows the server's rule (fsrs `isDue`: dueAt <= now), so the
// count on Progress matches what the review session loads. Cards due later
// today are counted separately and are not reviewable yet.

import type { ReviewData } from "./progressTypes";

const DAY_MS = 86_400_000;

/** Lite shape of an FSRS card row as returned by GET /me/reviews?mode=all. */
export type FSRSCardLite = { dueAt: string; lastReviewAt: string; reps: number };

export function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Whole-day offset of a due date from the start of today (negative = before today). */
function dayOffsetFromToday(dueAt: string, todayMs: number): number {
  const dueDayStart = new Date(dueAt);
  dueDayStart.setHours(0, 0, 0, 0);
  return Math.round((dueDayStart.getTime() - todayMs) / DAY_MS);
}

export function buildReviewDataFromCards(
  cards: FSRSCardLite[],
  now: Date = new Date()
): ReviewData {
  const nowMs = now.getTime();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const todayMs = startOfToday.getTime();

  // forecast[0] = today (also absorbs overdue); forecast[1..6] = the next six days.
  const forecast = Array.from({ length: 7 }, (_, offset) => ({
    date: localDateKey(new Date(todayMs + offset * DAY_MS)),
    count: 0,
  }));

  let overdueCount = 0;
  let dueTodayCount = 0;
  let laterTodayCount = 0;
  let upcomingThisWeekCount = 0;

  // forecast always has 7 buckets (index 0..6); every index below is in-bounds.
  for (const card of cards) {
    const offset = dayOffsetFromToday(card.dueAt, todayMs);
    if (offset < 0) {
      overdueCount += 1;
      forecast[0]!.count += 1;
    } else if (offset === 0) {
      if (new Date(card.dueAt).getTime() <= nowMs) dueTodayCount += 1;
      else laterTodayCount += 1;
      forecast[0]!.count += 1;
    } else if (offset <= 7) {
      upcomingThisWeekCount += 1;
      if (offset <= 6) forecast[offset]!.count += 1;
    }
  }

  return {
    overdueCount,
    dueTodayCount,
    laterTodayCount,
    upcomingThisWeekCount,
    totalConceptsLearned: cards.length,
    forecast,
  };
}

/**
 * Whether more cards are due once a session's page is done. `totalDue` is the
 * server's due count from `?mode=stats` (null when unknown); `count` is null
 * when the exact number cannot be told.
 */
export function moreDueAfterSession(input: {
  hasMore: boolean;
  totalDue: number | null;
  sessionSize: number;
}): { more: boolean; count: number | null } {
  if (!input.hasMore) return { more: false, count: null };
  const left = input.totalDue === null ? 0 : input.totalDue - input.sessionSize;
  return { more: true, count: left > 0 ? left : null };
}
