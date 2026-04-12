"use client";

import { useEffect, useState } from "react";
import { fetchBookJson } from "@/app/book/_lib/book-api";

type StatsResponse = {
  stats: {
    totalCards: number;
    dueCards: number;
    avgRetrievability: number;
    bookIds: string[];
  };
};

type Props = {
  onStartReview?: () => void;
};

export function ReviewQueueWidget({ onStartReview }: Props) {
  const [stats, setStats] = useState<StatsResponse["stats"] | null>(null);

  useEffect(() => {
    let mounted = true;
    fetchBookJson<StatsResponse>("/app/api/book/me/reviews?mode=stats")
      .then(({ stats: s }) => {
        if (mounted) setStats(s);
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, []);

  if (!stats || stats.totalCards === 0) return null;

  const retrievabilityPercent = Math.round(stats.avgRetrievability * 100);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Review Cards
          </p>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {stats.dueCards > 0
              ? `${stats.dueCards} cards due for review`
              : "All caught up!"}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {retrievabilityPercent}%
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">retention</p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <div className="flex-1">
          <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
            <div
              className="h-full rounded-full bg-blue-500 transition-all"
              style={{ width: `${retrievabilityPercent}%` }}
            />
          </div>
        </div>
        <span className="text-xs text-gray-400">
          {stats.totalCards} total
        </span>
      </div>

      {stats.dueCards > 0 && onStartReview && (
        <button
          onClick={onStartReview}
          className="mt-3 w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Start Review ({stats.dueCards})
        </button>
      )}
    </div>
  );
}
