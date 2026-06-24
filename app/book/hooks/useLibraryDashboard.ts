"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchBookJson } from "@/app/book/_lib/book-api";
import type { LibraryCatalogBook, LibraryBookEntry } from "@/app/book/_lib/library-data";
import {
  buildEntries,
  type DashboardCatalogPayload,
} from "@/app/book/library/hooks/useLibraryCatalogData";
import { BOOK_STORAGE_EVENT } from "@/app/book/hooks/bookStorageEvents";
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

/**
 * Hydrates the library list from the production `/api/book/me/dashboard`
 * aggregate (catalog + progress + bookStates + entitlement + saved + insight
 * points in one call). Mirrors `useLibraryCatalogData` but exposes the full set
 * the redesigned library UI needs.
 *
 * The dashboard route now fails LOUD (503) when a CRITICAL read (catalog,
 * entitlement, progress, bookStates, chapterStates) fails (#2), so a thrown error
 * here is a genuine outage — surfaced via `error` so the screen can show a
 * retryable state and NEVER collapse a missing entitlement to FREE. Only OPTIONAL
 * data degrades; the server sets `partial`/`warnings` so the screen can show a
 * non-blocking "couldn't load everything" banner.
 */
export function useLibraryDashboard(enabled = true) {
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<DashboardResponse>(EMPTY);
  const [revision, setRevision] = useState(0);

  const refetch = useCallback(() => {
    setError(null);
    setRevision((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    function handleRefresh() {
      setRevision((value) => value + 1);
    }
    window.addEventListener(BOOK_STORAGE_EVENT, handleRefresh as EventListener);
    window.addEventListener("storage", handleRefresh);
    window.addEventListener("focus", handleRefresh);
    return () => {
      window.removeEventListener(BOOK_STORAGE_EVENT, handleRefresh as EventListener);
      window.removeEventListener("storage", handleRefresh);
      window.removeEventListener("focus", handleRefresh);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setPayload(EMPTY);
      setHydrated(true);
      setLoading(false);
      return;
    }

    let mounted = true;
    setLoading(true);

    fetchBookJson<DashboardResponse>("/app/api/book/me/dashboard")
      .then((data) => {
        if (!mounted) return;
        setPayload({
          catalog: data.catalog ?? [],
          progress: data.progress ?? [],
          bookStates: data.bookStates ?? [],
          entitlement: data.entitlement ?? null,
          saved: data.saved ?? [],
          insightPointsBalance: data.insightPointsBalance ?? 0,
          partial: data.partial === true,
          warnings: Array.isArray(data.warnings) ? data.warnings : [],
        });
        setError(null);
      })
      .catch((fetchError: unknown) => {
        if (!mounted) return;
        const message =
          fetchError instanceof Error ? fetchError.message : "Unable to load your library.";
        setPayload(EMPTY);
        setError(message);
      })
      .finally(() => {
        if (!mounted) return;
        setHydrated(true);
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [enabled, revision]);

  const catalog: LibraryCatalogBook[] = payload.catalog;
  const entries: LibraryBookEntry[] = useMemo(() => buildEntries(payload), [payload]);
  const savedSet = useMemo(
    () => new Set((payload.saved ?? []).map((item) => item.bookId)),
    [payload.saved],
  );

  return {
    hydrated,
    loading,
    error,
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
