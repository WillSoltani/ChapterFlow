"use client";

// Canonical `/me/dashboard` query (WS3-025).
//
// This is the ONE place the client fetches the dashboard aggregate. Every screen
// that needs dashboard data (library, progress, workspace, badges) derives its
// view-model from THIS hook's single parsed payload via a local selector, so the
// aggregate is fetched, cached, and revalidated exactly once per key across all
// co-mounted consumers (built on the WS3-022 cache layer). Do not add another
// fetch of "/app/api/book/me/dashboard" anywhere else — grep must find the URL
// only in this file.

import { useMemo } from "react";
import { useBookQuery } from "@/app/book/_lib/book-api-cache";
import type { LibraryCatalogBook } from "@/app/book/_lib/library-data";
import type { DashboardEntitlement } from "@/components/library/dashboardToLibraryUi";

export const DASHBOARD_KEY = "/app/api/book/me/dashboard";

/**
 * The single parsed shape of the `/me/dashboard` aggregate — a superset covering
 * every field the library and analytics view-models read. Consumers select the
 * fields they need; they never re-fetch or re-declare the wire shape.
 */
export type DashboardQueryPayload = {
  catalog?: LibraryCatalogBook[];
  progress: Array<{
    bookId: string;
    currentChapterNumber: number;
    unlockedThroughChapterNumber: number;
    completedChapters: number[];
    bestScoreByChapter: Record<string, number>;
    lastOpenedAt?: string;
    lastActiveAt?: string;
  }>;
  bookStates: Array<{
    bookId: string;
    currentChapterId: string;
    completedChapterIds: string[];
    unlockedChapterIds: string[];
    chapterScores: Record<string, number>;
    chapterCompletedAt: Record<string, string>;
    lastReadChapterId: string;
    lastOpenedAt: string;
    updatedAt: string;
  }>;
  chapterStates: Array<{
    bookId: string;
    chapterNumber: number;
    chapterId?: string;
    state: Record<string, unknown>;
  }>;
  readingDays: Array<{
    dayKey: string;
    totalActiveMs: number;
  }>;
  badgeAwards: Array<{
    badgeId: string;
    earnedAt?: string;
    tier?: string;
  }>;
  saved?: Array<{ bookId?: string }>;
  entitlement?: DashboardEntitlement;
  insightPointsBalance?: number;
  settings?: {
    onboarding?: {
      starterShelf?: string[];
      dailyGoal?: number;
      onboardingCompleted?: boolean;
      interests?: string[];
      motivation?: string;
    };
    dailyGoal?: number;
  } | null;
  /** Set by the server (#2) when some OPTIONAL dashboard data couldn't be loaded;
   *  the critical data is still authoritative, so the page renders with a banner. */
  partial?: boolean;
  warnings?: string[];
};

export interface DashboardQueryResult {
  /** The parsed aggregate, or null until the first successful read. */
  data: DashboardQueryPayload | null;
  /** The latest read error (unknown thrown value), or undefined. */
  error: unknown;
  /** True while the first read is in flight (background revalidations don't flip it). */
  loading: boolean;
  /** True once the first read has settled (success or error). */
  hydrated: boolean;
  /** Force a fresh read of the aggregate. */
  refetch: () => void;
}

/**
 * Read the dashboard aggregate through the shared cache. Pass `enabled = false`
 * to disable the read on a gated screen (returns an idle, null result).
 */
export function useDashboardQuery(enabled = true): DashboardQueryResult {
  const { data, error, loading, refetch } = useBookQuery<DashboardQueryPayload>(
    enabled ? DASHBOARD_KEY : null
  );

  return useMemo(
    () => ({
      data: data ?? null,
      error,
      loading,
      hydrated: !loading,
      refetch,
    }),
    [data, error, loading, refetch]
  );
}
