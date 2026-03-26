"use client";

import { useEffect, useState } from "react";
import { loadStreak, type StreakState } from "@/app/book/_lib/reading-streaks";

export function StreakBadge() {
  const [streak, setStreak] = useState<StreakState | null>(null);

  useEffect(() => {
    setStreak(loadStreak());
  }, []);

  if (!streak || streak.currentStreak === 0) return null;

  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-(--cr-glass-border) bg-(--cr-glass-nav) px-2.5 py-1 text-xs">
      <span className="text-(--cr-warning)">{"\uD83D\uDD25"}</span>
      <span className="font-semibold text-(--cr-text-primary)">
        {streak.currentStreak}d
      </span>
      {streak.freezesRemaining > 0 && (
        <>
          <span className="text-(--cr-text-disabled)">{"\u00b7"}</span>
          <span className="text-(--cr-info)">{"\u2744\uFE0F"}</span>
          <span className="text-(--cr-text-secondary)">{streak.freezesRemaining}</span>
        </>
      )}
    </div>
  );
}
