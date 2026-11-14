"use client";

// The server tier ladder (GET /me/tier): the one level ladder shown on
// Progress and Profile, the same one the chapter-complete window announces.

import { useBookQuery } from "@/lib/client/book-api-cache";

export const SERVER_TIER_KEY = "/app/api/book/me/tier";

export type ServerTierName = "reader" | "analyst" | "synthesizer" | "polymath" | "luminary";

export type ServerTier = {
  currentTier: ServerTierName;
  currentTierDisplay: string;
  loopsCompleted: number;
  avgQuizScore: number;
  categoriesExplored: number;
  nextTier: {
    name: ServerTierName;
    displayName: string;
    loopsRequired: number;
    loopsRemaining: number;
    loopsPercent: number;
    avgScoreRequired: number;
    avgScoreMet: boolean;
    categoriesRequired: number;
    categoriesRemaining: number;
    categoriesPercent: number;
  } | null;
  tiers: Array<{
    name: ServerTierName;
    displayName: string;
    loopsRequired: number;
    avgScoreRequired: number;
    categoriesRequired: number;
    identityStatement: string;
    reached: boolean;
  }>;
};

/** `data` stays undefined while the read is pending or after it failed. */
export function useServerTier() {
  return useBookQuery<ServerTier>(SERVER_TIER_KEY);
}
