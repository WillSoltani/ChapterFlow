"use client";

import { useState } from "react";
import { useDepthRecommendation } from "@/app/book/hooks/useDepthRecommendation";
import type { VariantKey } from "@/app/app/api/book/_lib/types";

type Props = {
  bookId: string;
  currentDepth: VariantKey;
  onSwitchDepth?: (depth: VariantKey) => void;
};

const DEPTH_LABELS: Record<string, string> = {
  easy: "Easy",
  medium: "Standard",
  hard: "Deeper",
  precise: "Precise",
  balanced: "Balanced",
  challenging: "Challenging",
};

export function DepthNudge({ bookId, currentDepth, onSwitchDepth }: Props) {
  const { recommendation, loading } = useDepthRecommendation(bookId);
  const [dismissed, setDismissed] = useState(false);

  if (loading || dismissed || !recommendation || !recommendation.hasData) {
    return null;
  }

  if (
    recommendation.recommendedDepth === currentDepth ||
    recommendation.confidence < 0.5
  ) {
    return null;
  }

  const recommendedLabel = DEPTH_LABELS[recommendation.recommendedDepth] ?? recommendation.recommendedDepth;
  const currentLabel = DEPTH_LABELS[currentDepth] ?? currentDepth;

  const isUpgrade =
    (currentDepth === "easy" && recommendation.recommendedDepth !== "easy") ||
    (currentDepth === "medium" && recommendation.recommendedDepth === "hard");

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950/30">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-blue-900 dark:text-blue-200">
            {isUpgrade
              ? `Ready for ${recommendedLabel}?`
              : `Try ${recommendedLabel} depth`}
          </p>
          <p className="mt-0.5 text-xs text-blue-600 dark:text-blue-400">
            {recommendation.reason}
          </p>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 text-xs text-blue-400 hover:text-blue-600 dark:hover:text-blue-200"
        >
          &#10005;
        </button>
      </div>

      {onSwitchDepth && (
        <div className="mt-2 flex gap-2">
          <button
            onClick={() => {
              onSwitchDepth(recommendation.recommendedDepth);
              setDismissed(true);
            }}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
          >
            Switch to {recommendedLabel}
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="rounded-md px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-100 dark:text-blue-400 dark:hover:bg-blue-900"
          >
            Keep {currentLabel}
          </button>
        </div>
      )}
    </div>
  );
}
