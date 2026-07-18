"use client";

import { useMemo } from "react";
import { useBookQuery } from "@/app/book/_lib/book-api-cache";
import type { LibraryCatalogBook, LibraryBookEntry } from "@/app/book/_lib/library-data";
import {
  buildEntries,
  type DashboardCatalogPayload,
} from "@/app/book/library/hooks/useLibraryCatalogData";
import type { DashboardEntitlement } from "@/components/library/dashboardToLibraryUi";

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

const DASHBOARD_KEY = "/app/api/book/me/dashboard";

/**
 * Hydrates the library list from the production `/api/book/me/dashboard`
 * aggregate (catalog + progress + bookStates + entitlement + saved + insight
 * points in one call). Mirrors `useLibraryCatalogData` but exposes the full set
 * the redesigned library UI needs.
 *
 * Reads through the shared book-api cache (WS3-022): the dashboard GET dedups
 * with the other dashboard consumers, re-mounts serve the cached aggregate
 * instantly, and focus/storage/book-storage revalidation is handled once by the
 * cache layer instead of per-hook listeners.
 *
 * The dashboard route fails LOUD (503) when a CRITICAL read (catalog,
 * entitlement, progress, bookStates, chapterStates) fails (#2), so a thrown error
 * here is a genuine outage — surfaced via `error` so the screen can show a
 * retryable state and NEVER collapse a missing entitlement to FREE. Only OPTIONAL
 * data degrades; the server sets `partial`/`warnings` so the screen can show a
 * non-blocking "couldn't load everything" banner.
 */
export function useLibraryDashboard(enabled = true) {
  const { data, error, loading, refetch } = useBookQuery<DashboardResponse>(
    enabled ? DASHBOARD_KEY : null
  );

  const payload: DashboardResponse = useMemo(() => {
    if (!data) return EMPTY;
    return {
      catalog: data.catalog ?? [],
      progress: data.progress ?? [],
      bookStates: data.bookStates ?? [],
      entitlement: data.entitlement ?? null,
      saved: data.saved ?? [],
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
