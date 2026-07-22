"use client";

// Canonical shared saved-books hook (WS3-001).

import { useCallback, useEffect, useMemo, useState } from "react";
import { useBookQuery, invalidateBookCache } from "@/lib/client/book-api-cache";
import { fetchBookJson } from "@/lib/client/book-api";
import { emitBookStorageChanged } from "@/lib/client/book-storage-events";

export type SavedBookItem = {
  bookId: string;
  savedAt: string;
  updatedAt: string;
  source?: string | undefined;
  priority?: number | undefined;
  pinned?: boolean | undefined;
};

type SavedResponse = {
  saved: SavedBookItem[];
};

const SAVED_BOOKS_KEY = "/app/api/book/me/saved";

function sortSaved(items: SavedBookItem[]) {
  return [...items].sort((left, right) => {
    if (left.pinned !== right.pinned) return left.pinned ? -1 : 1;
    const leftPriority = left.priority ?? Number.MAX_SAFE_INTEGER;
    const rightPriority = right.priority ?? Number.MAX_SAFE_INTEGER;
    if (leftPriority !== rightPriority) return leftPriority - rightPriority;
    return right.savedAt.localeCompare(left.savedAt);
  });
}

export function useSavedBooks(enabled = true) {
  const query = useBookQuery<SavedResponse>(enabled ? SAVED_BOOKS_KEY : null);
  // Non-null only between a toggle and its server settle.
  const [optimistic, setOptimistic] = useState<SavedBookItem[] | null>(null);
  const [toggleErrorMessage, setToggleErrorMessage] = useState<string | null>(null);

  const serverSaved = useMemo(
    () => sortSaved(query.data?.saved ?? []),
    [query.data]
  );
  // Fresh server data settled — drop the overlay; the cache is source of truth.
  useEffect(() => {
    setOptimistic(null);
  }, [query.data]);

  const saved = optimistic ?? serverSaved;
  const hydrated =
    !enabled || query.data !== undefined || query.error !== undefined;
  const loading = enabled && query.loading;
  const error =
    toggleErrorMessage ??
    (query.error
      ? query.error instanceof Error
        ? query.error.message
        : "Unable to load saved books."
      : null);
  const refresh = query.refetch;

  const savedSet = useMemo(() => new Set(saved.map((item) => item.bookId)), [saved]);

  const toggleSaved = useCallback(
    async (bookId: string, options?: { source?: string; priority?: number; pinned?: boolean }) => {
      const alreadySaved = savedSet.has(bookId);
      const now = new Date().toISOString();
      const optimisticList = alreadySaved
        ? saved.filter((item) => item.bookId !== bookId)
        : sortSaved([
            ...saved,
            {
              bookId,
              savedAt: now,
              updatedAt: now,
              source: options?.source,
              priority: options?.priority,
              pinned: options?.pinned,
            },
          ]);

      setOptimistic(optimisticList);
      setToggleErrorMessage(null);
      emitBookStorageChanged("saved-books");

      try {
        if (alreadySaved) {
          await fetchBookJson(`/app/api/book/me/saved?bookId=${encodeURIComponent(bookId)}`, {
            method: "DELETE",
          });
        } else {
          await fetchBookJson<{ saved: SavedBookItem }>("/app/api/book/me/saved", {
            method: "PUT",
            body: JSON.stringify({
              bookId,
              source: options?.source,
              priority: options?.priority,
              pinned: options?.pinned,
            }),
          });
        }
        // Refetch every subscriber; the query.data effect clears the overlay when
        // the revalidated list arrives, so the UI never flashes back to stale.
        invalidateBookCache(SAVED_BOOKS_KEY);
        emitBookStorageChanged("saved-books");
        return { saved: !alreadySaved, error: null };
      } catch (toggleError: unknown) {
        setOptimistic(null);
        emitBookStorageChanged("saved-books");
        const message =
          toggleError instanceof Error ? toggleError.message : "Unable to update saved books.";
        setToggleErrorMessage(message);
        return { saved: alreadySaved, error: message };
      }
    },
    [saved, savedSet]
  );

  return {
    hydrated,
    loading,
    error,
    saved,
    savedSet,
    refresh,
    toggleSaved,
  };
}
