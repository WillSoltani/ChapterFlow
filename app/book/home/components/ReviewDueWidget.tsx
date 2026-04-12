"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Brain, ArrowRight } from "lucide-react";
import { fetchBookJson } from "@/app/book/_lib/book-api";

type ReviewStats = {
  totalCards: number;
  dueCards: number;
  avgRetrievability: number;
  bookIds: string[];
};

export function ReviewDueWidget({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    fetchBookJson<ReviewStats>("/app/api/book/me/reviews")
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [enabled]);

  if (loading || !stats || stats.dueCards === 0) return null;

  const estimatedMinutes = Math.max(1, Math.ceil(stats.dueCards * 0.4));

  return (
    <button
      type="button"
      onClick={() => router.push("/book/reviews")}
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
  );
}
