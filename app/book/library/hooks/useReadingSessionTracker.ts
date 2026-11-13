"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchBookJson } from "@/app/book/_lib/book-api";
import { emitBookStorageChanged } from "@/app/book/hooks/bookStorageEvents";
import {
  appendReadingActivity,
  emptyReadingActivity,
  getReadingActivityStorageKey,
  parseReadingActivity,
  toDayKey,
  type PersistedReadingActivity,
} from "@/app/book/library/hooks/readingActivityStorage";
import { safeGetItem, safeSetItem } from "@/app/book/library/[bookId]/chapter/[chapterId]/lib/safe-storage";

const IDLE_TIMEOUT_MS = 45_000;
const FLUSH_INTERVAL_MS = 5_000;
/** The local day ("YYYY-MM-DD") the daily-goal message was last shown, on any chapter. */
const DAILY_GOAL_CELEBRATED_KEY = "book-accelerator:daily-goal-celebrated:v1";

type UseReadingSessionTrackerArgs = {
  bookId: string;
  chapterId: string;
  enabled?: boolean;
  dailyGoalMinutes?: number;
};

type UseReadingSessionTrackerResult = {
  hydrated: boolean;
  todayTrackedMinutes: number;
  todayTrackedSeconds: number;
  totalTrackedMinutes: number;
  dailyGoalReached: boolean;
  /** True the first time it is called on a local day (then records the day). */
  claimDailyGoalCelebration: () => boolean;
};

type ReadingSessionResponse = { readingDay?: unknown; trackedMinutesToday?: unknown };

function isEngagedNow(lastActivityAt: number, allowBackgroundTransition = false) {
  const now = Date.now();
  const recentlyActive = now - lastActivityAt <= IDLE_TIMEOUT_MS;
  if (!recentlyActive) return false;

  const visibleAndFocused =
    document.visibilityState === "visible" && (typeof document.hasFocus !== "function" || document.hasFocus());

  return visibleAndFocused || allowBackgroundTransition;
}

export function useReadingSessionTracker({
  bookId,
  chapterId,
  enabled = true,
  dailyGoalMinutes = 0,
}: UseReadingSessionTrackerArgs): UseReadingSessionTrackerResult {
  const storageKey = useMemo(
    () => getReadingActivityStorageKey(bookId, chapterId),
    [bookId, chapterId]
  );

  const [hydrated, setHydrated] = useState(false);
  const [activity, setActivity] = useState<PersistedReadingActivity>(emptyReadingActivity);
  const activityRef = useRef<PersistedReadingActivity>(activity);
  useEffect(() => {
    activityRef.current = activity;
  }, [activity]);
  // Today's minutes across every chapter and device, from the last POST.
  const [serverToday, setServerToday] = useState<{ day: string; minutes: number } | null>(null);
  const lastActivityAtRef = useRef(0);
  const lastTickAtRef = useRef(0);

  useEffect(() => {
    const stored = parseReadingActivity(safeGetItem(storageKey));
    setActivity(stored ?? emptyReadingActivity());
    lastActivityAtRef.current = Date.now();
    lastTickAtRef.current = Date.now();
    setHydrated(true);
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated || !enabled) return;

    const persistDelta = (deltaMs: number) => {
      if (deltaMs <= 0) return;

      const now = new Date();
      const next = appendReadingActivity(activityRef.current, now, deltaMs);
      activityRef.current = next;
      safeSetItem(storageKey, JSON.stringify(next));
      setActivity(next);
      emitBookStorageChanged(`reading-activity:${bookId}:${chapterId}`);

      fetchBookJson<ReadingSessionResponse>("/app/api/book/me/reading-sessions", {
        method: "POST",
        body: JSON.stringify({
          bookId,
          chapterId,
          deltaMs,
          occurredAt: now.toISOString(),
          // The reader's own calendar day, so evening reading isn't filed under
          // tomorrow's UTC date.
          localDay: toDayKey(now),
        }),
      })
        .then((response) => {
          const minutes = response?.trackedMinutesToday;
          const day = response?.readingDay;
          if (typeof minutes === "number" && Number.isFinite(minutes) && typeof day === "string") {
            setServerToday({ day, minutes });
          }
        })
        .catch(() => {});
    };

    const flushElapsed = (allowBackgroundTransition = false) => {
      const now = Date.now();
      const deltaMs = now - lastTickAtRef.current;
      lastTickAtRef.current = now;

      if (!isEngagedNow(lastActivityAtRef.current, allowBackgroundTransition)) return;
      persistDelta(deltaMs);
    };

    const markActivity = () => {
      lastActivityAtRef.current = Date.now();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushElapsed(true);
        return;
      }
      lastActivityAtRef.current = Date.now();
      lastTickAtRef.current = Date.now();
    };

    const onBlur = () => {
      flushElapsed(true);
    };

    const onFocus = () => {
      lastActivityAtRef.current = Date.now();
      lastTickAtRef.current = Date.now();
    };

    const onPageHide = () => {
      flushElapsed(true);
    };

    const interval = window.setInterval(() => {
      flushElapsed(false);
    }, FLUSH_INTERVAL_MS);

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
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      window.clearInterval(interval);
      flushElapsed(true);
      passiveEvents.forEach((eventName) => {
        window.removeEventListener(eventName, markActivity);
      });
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [bookId, chapterId, enabled, hydrated, storageKey]);

  const todayTrackedSeconds = Math.floor(
    Number(activity.dailyActiveMs[toDayKey(new Date())] ?? 0) / 1000
  );
  const todayTrackedMinutes = Math.floor(todayTrackedSeconds / 60);
  const todayKey = toDayKey(new Date());
  const serverMinutesToday = serverToday?.day === todayKey ? serverToday.minutes : 0;
  const dailyGoalReached =
    dailyGoalMinutes > 0 && Math.max(serverMinutesToday, todayTrackedMinutes) >= dailyGoalMinutes;

  const claimDailyGoalCelebration = useCallback(() => {
    const today = toDayKey(new Date());
    if (safeGetItem(DAILY_GOAL_CELEBRATED_KEY) === today) return false;
    safeSetItem(DAILY_GOAL_CELEBRATED_KEY, today);
    return true;
  }, []);

  return {
    hydrated,
    todayTrackedSeconds,
    todayTrackedMinutes,
    totalTrackedMinutes: Math.floor(Number(activity.totalActiveMs ?? 0) / 60000),
    dailyGoalReached,
    claimDailyGoalCelebration,
  };
}
