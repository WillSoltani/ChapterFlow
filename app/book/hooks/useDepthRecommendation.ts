"use client";

import { useBookQuery } from "@/lib/client/book-api-cache";
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
  const query = useBookQuery<DepthRecommendationResponse>(
    `/app/api/book/me/books/${bookId}/depth-recommendation`
  );
  return { recommendation: query.data ?? null, loading: query.loading };
}
