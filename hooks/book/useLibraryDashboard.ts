"use client";

// Canonical shared library-dashboard hook (WS3-001).

import { useMemo } from "react";
import { useDashboardQuery } from "@/hooks/book/useDashboardQuery";
import type { LibraryCatalogBook, LibraryBookEntry } from "@/lib/library-data";
import {
  buildEntries,
  type DashboardCatalogPayload,
} from "@/hooks/book/useLibraryCatalogData";
import type { DashboardEntitlement } from "@/lib/dashboard-contracts";

type DashboardResponse = DashboardCatalogPayload & {
  entitlement: DashboardEntitlement;
  saved?: Array<{ bookId: string }>;
  insightPointsBalance?: number;
  /** Server (#2): some OPTIONAL data couldn't be loaded; critical data is still
   *  authoritative. The library/saved screens render with a non-blocking banner. */
  partial?: boolean;
  warnings?: string[];
};

const EMPTY: DashboardResponse = {
  catalog: [],
  progress: [],
  bookStates: [],
  entitlement: null,
  saved: [],
  insightPointsBalance: 0,
  partial: false,
  warnings: [],
};

/**
 * Hydrates the library list from the production `/api/book/me/dashboard`
 * aggregate (catalog + progress + bookStates + entitlement + saved + insight
 * points in one call). A thin selector over the canonical `useDashboardQuery`
 * (WS3-025) — it does NOT fetch the dashboard itself, so the aggregate is shared
 * (deduped + cached + revalidated once) with every other dashboard consumer.
 *
 * The dashboard route fails LOUD (503) when a CRITICAL read (catalog,
 * entitlement, progress, bookStates, chapterStates) fails (#2), so a thrown error
 * here is a genuine outage — surfaced via `error` so the screen can show a
 * retryable state and NEVER collapse a missing entitlement to FREE. Only OPTIONAL
 * data degrades; the server sets `partial`/`warnings` so the screen can show a
 * non-blocking "couldn't load everything" banner.
 */
export function useLibraryDashboard(enabled = true) {
  const { data, error, loading, refetch } = useDashboardQuery(enabled);

  const payload: DashboardResponse = useMemo(() => {
    if (!data) return EMPTY;
    return {
      catalog: data.catalog ?? [],
      progress: data.progress ?? [],
      bookStates: data.bookStates ?? [],
      entitlement: data.entitlement ?? null,
      saved: (data.saved ?? []).filter(
        (item): item is { bookId: string } => typeof item.bookId === "string",
      ),
      insightPointsBalance: data.insightPointsBalance ?? 0,
      partial: data.partial === true,
      warnings: Array.isArray(data.warnings) ? data.warnings : [],
    };
  }, [data]);

  const catalog: LibraryCatalogBook[] = payload.catalog;
  const entries: LibraryBookEntry[] = useMemo(() => buildEntries(payload), [payload]);
  const savedSet = useMemo(
    () => new Set((payload.saved ?? []).map((item) => item.bookId)),
    [payload.saved],
  );

  const errorMessage = error
    ? error instanceof Error
      ? error.message
      : "Unable to load your library."
    : null;

  return {
    // `hydrated` = the first read has settled (success or error). With the cache a
    // fresh re-mount is hydrated immediately.
    hydrated: !loading,
    loading,
    error: errorMessage,
    catalog,
    entries,
    entitlement: payload.entitlement,
    saved: payload.saved ?? [],
    savedSet,
    insightPointsBalance: payload.insightPointsBalance ?? 0,
    partial: payload.partial ?? false,
    warnings: payload.warnings ?? [],
    refetch,
  };
}
