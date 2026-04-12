"use client";

import { useEffect, useState } from "react";
import { fetchBookJson } from "@/app/book/_lib/book-api";
import type { VariantKey } from "@/app/app/api/book/_lib/types";

type DepthRecommendationResponse = {
  recommendedDepth: VariantKey;
  confidence: number;
  reason: string;
  hasData: boolean;
  featureVector?: {
    avgQuizScore: number;
    avgReadingTimeRatio: number;
    recentScoreTrend: number;
    reviewCardRecall: number;
  };
  lastUpdatedChapter?: number;
};

export function useDepthRecommendation(bookId: string) {
  const [recommendation, setRecommendation] =
    useState<DepthRecommendationResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    fetchBookJson<DepthRecommendationResponse>(
      `/app/api/book/me/books/${bookId}/depth-recommendation`
    )
      .then((data) => {
        if (mounted) setRecommendation(data);
      })
      .catch(() => {
        if (mounted) setRecommendation(null);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => { mounted = false; };
  }, [bookId]);

  return { recommendation, loading };
}
