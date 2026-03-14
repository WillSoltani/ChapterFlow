"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchBookJson } from "@/app/book/_lib/book-api";
import { emitBookStorageChanged, BOOK_STORAGE_EVENT } from "@/app/book/hooks/bookStorageEvents";

export type SavedBookItem = {
  bookId: string;
  savedAt: string;
  updatedAt: string;
  source?: string;
  priority?: number;
  pinned?: boolean;
};

type SavedResponse = {
  saved: SavedBookItem[];
};

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
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedBookItem[]>([]);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setSaved([]);
      setHydrated(true);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const payload = await fetchBookJson<SavedResponse>("/app/api/book/me/saved");
      setSaved(sortSaved(payload.saved ?? []));
      setError(null);
    } catch (fetchError: unknown) {
      const message =
        fetchError instanceof Error ? fetchError.message : "Unable to load saved books.";
      setError(message);
    } finally {
      setHydrated(true);
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    function onStorageChange(event: Event) {
      const detail =
        "detail" in event && event.detail && typeof event.detail === "string"
          ? event.detail
          : "";
      if (!detail || detail.startsWith("saved-books")) {
        void refresh();
      }
    }

    window.addEventListener(BOOK_STORAGE_EVENT, onStorageChange as EventListener);
    window.addEventListener("focus", onStorageChange);
    return () => {
      window.removeEventListener(BOOK_STORAGE_EVENT, onStorageChange as EventListener);
      window.removeEventListener("focus", onStorageChange);
    };
  }, [refresh]);

  const savedSet = useMemo(() => new Set(saved.map((item) => item.bookId)), [saved]);

  const toggleSaved = useCallback(
    async (bookId: string, options?: { source?: string; priority?: number; pinned?: boolean }) => {
      const alreadySaved = savedSet.has(bookId);
      const previous = saved;
      const now = new Date().toISOString();
      const optimistic = alreadySaved
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

      setSaved(optimistic);
      emitBookStorageChanged("saved-books");

      try {
        if (alreadySaved) {
          await fetchBookJson(`/app/api/book/me/saved?bookId=${encodeURIComponent(bookId)}`, {
            method: "DELETE",
          });
        } else {
          const payload = await fetchBookJson<{ saved: SavedBookItem }>("/app/api/book/me/saved", {
            method: "PUT",
            body: JSON.stringify({
              bookId,
              source: options?.source,
              priority: options?.priority,
              pinned: options?.pinned,
            }),
          });
          setSaved((current) =>
            sortSaved([
              ...current.filter((item) => item.bookId !== bookId),
              payload.saved,
            ])
          );
        }
        setError(null);
        emitBookStorageChanged("saved-books");
        return { saved: !alreadySaved, error: null };
      } catch (toggleError: unknown) {
        setSaved(previous);
        emitBookStorageChanged("saved-books");
        const message =
          toggleError instanceof Error ? toggleError.message : "Unable to update saved books.";
        setError(message);
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
