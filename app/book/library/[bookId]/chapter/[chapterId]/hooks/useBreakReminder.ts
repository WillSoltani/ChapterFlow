"use client";

import { useEffect, useRef } from "react";

/**
 * SET-4 — in-session "break reminder" timer.
 *
 * The settings screen lets a reader turn on "Break reminders" and pick an
 * interval (`extended.breakReminders` / `extended.breakReminderMinutes`),
 * promising "a gentle reminder to rest your eyes during long reading sessions".
 * That is inherently a client/in-session concept — it does NOT belong in the
 * email-nudge cron, which fires when you are AWAY from the app, not mid-session.
 * This hook is the consumer those stored fields were missing.
 *
 * It accumulates *engaged* reading time — recently active AND the tab visible
 * and focused, mirroring `useReadingSessionTracker`'s engagement model — and
 * fires `onBreak` once per `intervalMinutes` of engaged reading. Time spent
 * idle, backgrounded, or paused (e.g. mid-quiz) does not count toward the next
 * break, so a user who walks away is never nudged. Nothing is persisted: the
 * accumulator is purely in-memory and resets when the reader unmounts or the
 * interval changes.
 */

/** Idle/visibility threshold mirrors useReadingSessionTracker so "engaged"
 *  means the same thing in both places. */
export const BREAK_IDLE_TIMEOUT_MS = 45_000;
const TICK_INTERVAL_MS = 5_000;

/** Pure: is the reader engaged right now? (testable without a DOM). */
export function isEngagedForBreak(args: {
  now: number;
  lastActivityAt: number;
  visible: boolean;
  focused: boolean;
}): boolean {
  const recentlyActive = args.now - args.lastActivityAt <= BREAK_IDLE_TIMEOUT_MS;
  return recentlyActive && args.visible && args.focused;
}

export type BreakAccumulator = { engagedMs: number; lastTickAt: number };

/**
 * Pure: advance the engaged-time accumulator by one tick and decide whether a
 * break is due. Idle / backgrounded / paused time is dropped (the tick clock
 * still moves forward so the gap is never back-credited later). When a break
 * fires the accumulator resets to 0, so reminders repeat every `intervalMs` of
 * engaged reading.
 */
export function advanceBreakAccumulator(args: {
  state: BreakAccumulator;
  now: number;
  engaged: boolean;
  paused: boolean;
  intervalMs: number;
}): { state: BreakAccumulator; fire: boolean } {
  const delta = Math.max(0, args.now - args.state.lastTickAt);
  const lastTickAt = args.now;

  if (!args.engaged || args.paused) {
    return { state: { engagedMs: args.state.engagedMs, lastTickAt }, fire: false };
  }

  const engagedMs = args.state.engagedMs + delta;
  if (args.intervalMs > 0 && engagedMs >= args.intervalMs) {
    return { state: { engagedMs: 0, lastTickAt }, fire: true };
  }
  return { state: { engagedMs, lastTickAt }, fire: false };
}

type UseBreakReminderArgs = {
  /** Master gate: break reminders on AND the reader is in an active reading context. */
  enabled: boolean;
  /** Minutes of engaged reading between nudges (user-chosen; defensively clamped). */
  intervalMinutes: number;
  /** True while a break must be suppressed (e.g. the quiz tab is active). */
  paused?: boolean;
  /** Fired once per interval of engaged reading. Identity may change freely. */
  onBreak: () => void;
};

export function useBreakReminder({
  enabled,
  intervalMinutes,
  paused = false,
  onBreak,
}: UseBreakReminderArgs): void {
  // Read the latest callback / paused flag inside the interval without
  // re-subscribing the listeners (which would reset the accumulator).
  const onBreakRef = useRef(onBreak);
  useEffect(() => {
    onBreakRef.current = onBreak;
  }, [onBreak]);

  const pausedRef = useRef(paused);
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined" || typeof document === "undefined") return;

    const intervalMs = Math.max(1, intervalMinutes) * 60_000;
    const accumulator: BreakAccumulator = { engagedMs: 0, lastTickAt: Date.now() };
    let lastActivityAt = Date.now();

    const markActivity = () => {
      lastActivityAt = Date.now();
    };

    const tick = () => {
      const now = Date.now();
      const visible = document.visibilityState === "visible";
      const focused = typeof document.hasFocus !== "function" || document.hasFocus();
      const engaged = isEngagedForBreak({ now, lastActivityAt, visible, focused });
      const result = advanceBreakAccumulator({
        state: accumulator,
        now,
        engaged,
        paused: pausedRef.current,
        intervalMs,
      });
      accumulator.engagedMs = result.state.engagedMs;
      accumulator.lastTickAt = result.state.lastTickAt;
      if (result.fire) onBreakRef.current();
    };

    // On a visibility/focus transition, re-baseline the tick clock so the
    // backgrounded gap is never back-credited as reading time.
    const rebaseline = () => {
      accumulator.lastTickAt = Date.now();
      lastActivityAt = Date.now();
    };

    const interval = window.setInterval(tick, TICK_INTERVAL_MS);
    const passiveEvents: Array<keyof WindowEventMap> = [
      "scroll",
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "pointerdown",
    ];
    passiveEvents.forEach((eventName) => {
      window.addEventListener(eventName, markActivity, { passive: true });
    });
    document.addEventListener("visibilitychange", rebaseline);
    window.addEventListener("focus", rebaseline);

    return () => {
      window.clearInterval(interval);
      passiveEvents.forEach((eventName) => {
        window.removeEventListener(eventName, markActivity);
      });
      document.removeEventListener("visibilitychange", rebaseline);
      window.removeEventListener("focus", rebaseline);
    };
  }, [enabled, intervalMinutes]);
}
