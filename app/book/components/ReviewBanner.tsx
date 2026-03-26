"use client";

import { useEffect, useState } from "react";
import { ArrowRight, RotateCcw, X } from "lucide-react";
import {
  getPendingReviewCount,
  estimateReviewTime,
} from "@/app/book/_lib/spaced-repetition";

const DISMISS_KEY = "book-accelerator:review-banner-dismiss";
const DISMISS_DURATION_MS = 4 * 60 * 60 * 1000; // 4 hours

type ReviewBannerProps = {
  onStartReview: () => void;
};

export function ReviewBanner({ onStartReview }: ReviewBannerProps) {
  const [count, setCount] = useState(0);
  const [dismissed, setDismissed] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const pendingCount = getPendingReviewCount();
    setCount(pendingCount);

    // Check if dismissed recently
    const dismissedAt = window.localStorage.getItem(DISMISS_KEY);
    if (dismissedAt) {
      const elapsed = Date.now() - Number(dismissedAt);
      if (elapsed < DISMISS_DURATION_MS) {
        setDismissed(true);
        setHydrated(true);
        return;
      }
    }
    setDismissed(pendingCount === 0);
    setHydrated(true);
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
  };

  if (!hydrated || dismissed || count === 0) return null;

  return (
    <div className="rounded-2xl border border-(--cr-glass-border-teal) bg-(--cr-accent-muted) p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-(--cr-accent)/15 text-(--cr-accent)">
          <RotateCcw className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-(--cr-text-heading)">
            You have {count} concept{count !== 1 ? "s" : ""} to review
          </p>
          <p className="mt-0.5 text-xs text-(--cr-text-secondary)">
            ~{estimateReviewTime(count)} min
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onStartReview}
            className="flex items-center gap-1.5 rounded-xl bg-(--cr-accent) px-3.5 py-2 text-xs font-bold text-(--cr-text-inverse) transition hover:opacity-90"
          >
            Quick Review <ArrowRight className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="rounded-lg p-1.5 text-(--cr-text-disabled) transition hover:text-(--cr-text-secondary)"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
