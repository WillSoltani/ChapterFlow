"use client";

import { useCallback, useEffect, useState } from "react";
import { Brain, ArrowRight } from "lucide-react";
import { fetchBookJson } from "@/app/book/_lib/book-api";
import { ReviewSessionFSRS } from "@/app/book/components/ReviewSessionFSRS";

type ReviewStats = {
  totalCards: number;
  dueCards: number;
  avgRetrievability: number;
  bookIds: string[];
};

export function ReviewDueWidget({ enabled }: { enabled: boolean }) {
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState(false);

  const fetchStats = useCallback(() => {
    fetchBookJson<{ stats: ReviewStats }>("/app/api/book/me/reviews?mode=stats")
      .then((res) => setStats(res.stats))
      .catch((err) => {
        console.error("ReviewDueWidget: failed to fetch stats", err);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    fetchStats();
  }, [enabled, fetchStats]);

  if (loading || !stats || stats.dueCards === 0) return null;

  const estimatedMinutes = Math.max(1, Math.ceil(stats.dueCards * 0.4));

  return (
    <>
      <button
        type="button"
        onClick={() => setReviewing(true)}
        className="cf-panel group flex w-full items-center gap-4 rounded-[22px] border border-(--cf-accent-border) bg-(--cf-surface) p-4 text-left transition hover:bg-(--cf-accent-soft)"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-(--cf-accent-soft)">
          <Brain className="h-5 w-5 text-(--cf-accent)" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-(--cf-text-1)">
            {stats.dueCards} card{stats.dueCards !== 1 ? "s" : ""} due today
          </p>
          <p className="mt-0.5 text-xs text-(--cf-text-3)">
            ~{estimatedMinutes} min · {Math.round(stats.avgRetrievability * 100)}% avg retention
          </p>
        </div>
        <ArrowRight className="h-4 w-4 text-(--cf-text-3) transition group-hover:text-(--cf-accent)" />
      </button>
      {reviewing && (
        <ReviewSessionFSRS
          onClose={() => {
            setReviewing(false);
            fetchStats();
          }}
        />
      )}
    </>
  );
}
