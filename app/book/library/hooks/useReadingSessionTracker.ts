"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

const IDLE_TIMEOUT_MS = 45_000;
const FLUSH_INTERVAL_MS = 5_000;

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
};

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
  const lastActivityAtRef = useRef(0);
  const lastTickAtRef = useRef(0);

  useEffect(() => {
    const stored = parseReadingActivity(window.localStorage.getItem(storageKey));
    setActivity(stored ?? emptyReadingActivity());
    lastActivityAtRef.current = Date.now();
    lastTickAtRef.current = Date.now();
    setHydrated(true);
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated || !enabled) return;

    const persistDelta = (deltaMs: number) => {
      if (deltaMs <= 0) return;

      setActivity((current) => {
        const next = appendReadingActivity(current, new Date(), deltaMs);
        window.localStorage.setItem(storageKey, JSON.stringify(next));
        emitBookStorageChanged(`reading-activity:${bookId}:${chapterId}`);
        return next;
      });

      fetchBookJson("/app/api/book/me/reading-sessions", {
        method: "POST",
        body: JSON.stringify({
          bookId,
          chapterId,
          deltaMs,
          occurredAt: new Date().toISOString(),
        }),
      }).catch(() => {});
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
  const dailyGoalReached = dailyGoalMinutes > 0 && todayTrackedMinutes >= dailyGoalMinutes;

  return {
    hydrated,
    todayTrackedSeconds,
    todayTrackedMinutes,
    totalTrackedMinutes: Math.floor(Number(activity.totalActiveMs ?? 0) / 60000),
    dailyGoalReached,
  };
}
