/**
 * SET-7 — pure streak decision policy.
 *
 * The calendar-math + state-transition decision for `updateStreakOnLoopComplete`
 * lives here as a pure function so it can be unit-tested without `server-only`
 * or AWS (mirrors learning-mode.ts / account-guard-policy.ts). streak-repo.ts
 * owns the DynamoDB read/write and the IP awards; this module owns only "given
 * the prior streak state + today, what is the new streak?".
 *
 * Modes (resolved server-side via streak-mode.ts):
 *   • `off` / `standard` — UNCHANGED legacy behavior: a consecutive day extends
 *     the streak; a gap is bridged only by purchased shields, else it resets.
 *   • `flexible` — adds a *consecutive-skip tolerance*: a gap of up to `skipDays`
 *     missed days in a row is forgiven WITHOUT consuming a paid shield, and the
 *     streak is *preserved* (today increments it by one) rather than *bridged*
 *     (the skipped days are NOT credited to the count). This keeps the IP
 *     economy honest — the streak number only advances on days the reader was
 *     actually active, so streak milestones cannot be inflated by skipping. See
 *     docs/audit-fixes/SET-7.md (owner decision D3: "skip in a row, don't credit
 *     skips"). The dead client helper app/book/_lib/reading-streaks.ts was the
 *     reference for the rule; this is the authoritative server implementation.
 *
 * Shields are still tried for gaps the skip tolerance does not cover, so a
 * flexible reader who also holds shields keeps both protections.
 */

import type { StreakMode } from "@/app/app/api/book/_lib/streak-mode";

export type StreakDecisionInput = {
  /** Prior last-active day (YYYY-MM-DD in the user's timezone), or null if none. */
  lastActiveDate: string | null;
  /** Today (YYYY-MM-DD in the user's timezone). */
  today: string;
  /** Prior current-streak length. */
  currentStreak: number;
  /** Purchased shields held before this update. */
  shieldsHeld: number;
  mode: StreakMode;
  /** Flexible-mode skip-day allowance (consecutive missed days forgiven). */
  skipDays: number;
};

export type StreakDecision = {
  /** True when today was already counted (caller should no-op). */
  alreadyCountedToday: boolean;
  newCurrentStreak: number;
  /** Shields remaining after this update. */
  newShieldsHeld: number;
  /** Shields consumed by this update (for the result/notification payload). */
  shieldsConsumed: number;
  /** Shield-covered dates to append to shieldUsedDates. */
  appendedShieldDates: string[];
  /** True when the streak reset to 1 (gap not covered by skip or shields). */
  streakReset: boolean;
  /** True when the flexible skip tolerance forgave this gap (no shield burned). */
  flexibleSkipApplied: boolean;
  /** Calendar days since lastActiveDate (0 = same day, 1 = consecutive). */
  gapDays: number;
};

/** Count calendar days between two YYYY-MM-DD date strings. */
export function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA + "T00:00:00Z");
  const b = new Date(dateB + "T00:00:00Z");
  return Math.round(Math.abs(b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));
}

/** Add `offset` whole days to a YYYY-MM-DD date string, returning YYYY-MM-DD. */
function addDays(date: string, offset: number): string {
  const ms = new Date(date + "T00:00:00Z").getTime() + offset * 24 * 60 * 60 * 1000;
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Decide the new streak state on a learning-loop completion. Pure: no IO, no
 * clock — `today` is supplied by the caller (resolved in the user's timezone).
 */
export function decideStreakOnActiveDay(input: StreakDecisionInput): StreakDecision {
  const { lastActiveDate, today, currentStreak, shieldsHeld, mode, skipDays } = input;

  const base: StreakDecision = {
    alreadyCountedToday: false,
    newCurrentStreak: currentStreak,
    newShieldsHeld: shieldsHeld,
    shieldsConsumed: 0,
    appendedShieldDates: [],
    streakReset: false,
    flexibleSkipApplied: false,
    gapDays: 0,
  };

  // Already counted today — caller no-ops, no streak change.
  if (lastActiveDate === today) {
    return { ...base, alreadyCountedToday: true };
  }

  // First ever active day.
  if (!lastActiveDate) {
    return { ...base, newCurrentStreak: 1 };
  }

  const gapDays = daysBetween(lastActiveDate, today);

  // Consecutive day — streak continues.
  if (gapDays === 1) {
    return { ...base, gapDays, newCurrentStreak: currentStreak + 1 };
  }

  // gapDays > 1 — at least one day was missed.
  const missedDays = gapDays - 1;

  // Flexible consecutive-skip tolerance: forgive the gap WITHOUT burning a paid
  // shield and PRESERVE the streak (only today increments it; skipped days are
  // not credited). Tried before shields so a flexible reader keeps their paid
  // shields for gaps beyond the free tolerance.
  if (mode === "flexible" && missedDays <= skipDays) {
    return {
      ...base,
      gapDays,
      newCurrentStreak: currentStreak + 1,
      flexibleSkipApplied: true,
    };
  }

  // Paid shields bridge the gap — streak continues through shielded days + today
  // (skipped days ARE credited here; unchanged legacy behavior).
  if (missedDays <= shieldsHeld) {
    const appendedShieldDates: string[] = [];
    for (let i = 1; i <= missedDays; i++) {
      appendedShieldDates.push(addDays(lastActiveDate, i));
    }
    return {
      ...base,
      gapDays,
      newCurrentStreak: currentStreak + gapDays,
      newShieldsHeld: shieldsHeld - missedDays,
      shieldsConsumed: missedDays,
      appendedShieldDates,
    };
  }

  // Gap covered by neither skip tolerance nor shields — streak resets.
  return {
    ...base,
    gapDays,
    newCurrentStreak: 1,
    newShieldsHeld: 0,
    shieldsConsumed: shieldsHeld,
    streakReset: true,
  };
}
