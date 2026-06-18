"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchBookJson } from "@/app/book/_lib/book-api";
import {
  CHAPTER_READER_STORAGE_PREFIX,
  getBookProgressStorageKey,
} from "@/app/book/_lib/reader-storage";
import { emitBookStorageChanged } from "@/app/book/hooks/bookStorageEvents";
import {
  normalizeApplicationStates,
  countAppliedChapters,
} from "@/app/book/_lib/application-display";
import type { ChapterApplicationState } from "@/app/app/api/book/_lib/types";

// Mirror of usePhaseCompletion.ts STORAGE_KEY_PREFIX. Duplicated here (rather than
// imported) because that constant lives in the chapter-reader tree; keep in sync.
const PHASE_COMPLETION_STORAGE_PREFIX = "book-accelerator:phase-completion:v1";

// Remove every per-chapter reader artefact for a book so a stale reader tab — or
// the next page load — can't resurrect chapter completion through the GET union
// merge below. The server's canonical gating state is reset separately via the
// reset endpoint; this only clears the local mirrors that could re-push it.
function clearBookReaderStorage(bookId: string): void {
  if (typeof window === "undefined") return;
  const prefixes = [
    `${CHAPTER_READER_STORAGE_PREFIX}:${bookId}:`,
    `${PHASE_COMPLETION_STORAGE_PREFIX}:${bookId}:`,
  ];
  const toRemove: string[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (key && prefixes.some((prefix) => key.startsWith(prefix))) {
      toRemove.push(key);
    }
  }
  for (const key of toRemove) {
    window.localStorage.removeItem(key);
  }
}

type ChapterState = "completed" | "current" | "locked";
type ProgressChapter = { id: string };

type PersistedBookProgress = {
  currentChapterId: string;
  completedChapterIds: string[];
  unlockedChapterIds: string[];
  chapterScores: Record<string, number>;
  chapterCompletedAt: Record<string, string>;
  lastReadChapterId: string;
  lastOpenedAt: string;
};

function uniqueIds(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function initialProgress(chapters: ProgressChapter[]): PersistedBookProgress {
  const firstChapterId = chapters[0]?.id ?? "";

  return {
    currentChapterId: firstChapterId,
    completedChapterIds: [],
    unlockedChapterIds: firstChapterId ? [firstChapterId] : [],
    chapterScores: {},
    chapterCompletedAt: {},
    lastReadChapterId: firstChapterId,
    lastOpenedAt: new Date(0).toISOString(),
  };
}

function isValidTimestamp(value: string): boolean {
  return Number.isFinite(new Date(value).getTime());
}

function getNextChapterId(chapters: ProgressChapter[], currentChapterId: string): string {
  const index = chapters.findIndex((chapter) => chapter.id === currentChapterId);
  if (index < 0) return chapters[0]?.id ?? "";
  return chapters[index + 1]?.id ?? "";
}

function getFirstIncompleteUnlocked(
  chapters: ProgressChapter[],
  completedSet: Set<string>,
  unlockedSet: Set<string>
): string {
  return (
    chapters.find(
      (chapter) => unlockedSet.has(chapter.id) && !completedSet.has(chapter.id)
    )?.id ?? ""
  );
}

function normalizeProgress(
  raw: Partial<PersistedBookProgress>,
  fallback: PersistedBookProgress,
  chapters: ProgressChapter[]
): PersistedBookProgress {
  const chapterIds = new Set(chapters.map((chapter) => chapter.id));

  const chapterCompletedAt =
    raw.chapterCompletedAt && typeof raw.chapterCompletedAt === "object"
      ? Object.fromEntries(
          Object.entries(raw.chapterCompletedAt).filter(
            ([chapterId, completedAt]) =>
              chapterIds.has(chapterId) &&
              typeof completedAt === "string" &&
              completedAt.trim() &&
              isValidTimestamp(completedAt)
          )
        )
      : fallback.chapterCompletedAt;

  const completedChapterIds = uniqueIds(
    [
      ...(Array.isArray(raw.completedChapterIds)
        ? raw.completedChapterIds.filter(
            (id): id is string => typeof id === "string" && chapterIds.has(id)
          )
        : fallback.completedChapterIds),
      ...Object.keys(chapterCompletedAt),
    ]
  );

  const baseUnlocked = Array.isArray(raw.unlockedChapterIds)
    ? raw.unlockedChapterIds.filter((id): id is string => typeof id === "string" && chapterIds.has(id))
    : fallback.unlockedChapterIds;

  const unlockedChapterIds = uniqueIds([...baseUnlocked, ...completedChapterIds]);

  const chapterScores =
    raw.chapterScores && typeof raw.chapterScores === "object"
      ? Object.fromEntries(
          Object.entries(raw.chapterScores).filter(
            ([chapterId, score]) =>
              chapterIds.has(chapterId) &&
              Number.isFinite(Number(score)) &&
              Number(score) >= 0 &&
              Number(score) <= 100
          )
        )
      : fallback.chapterScores;

  const lastOpenedAt =
    typeof raw.lastOpenedAt === "string" && raw.lastOpenedAt.trim()
      ? raw.lastOpenedAt
      : fallback.lastOpenedAt;

  const completedSet = new Set(completedChapterIds);
  const unlockedSet = new Set(unlockedChapterIds);

  const requestedCurrent =
    typeof raw.currentChapterId === "string" && chapterIds.has(raw.currentChapterId)
      ? raw.currentChapterId
      : fallback.currentChapterId;

  let currentChapterId = requestedCurrent;
  if (completedSet.has(currentChapterId) || !unlockedSet.has(currentChapterId)) {
    currentChapterId =
      getFirstIncompleteUnlocked(chapters, completedSet, unlockedSet) ||
      fallback.currentChapterId;
  }

  const lastReadChapterId =
    typeof raw.lastReadChapterId === "string" && chapterIds.has(raw.lastReadChapterId)
      ? raw.lastReadChapterId
      : currentChapterId;

  return {
    currentChapterId,
    completedChapterIds,
    unlockedChapterIds: uniqueIds([...unlockedChapterIds, currentChapterId]),
    chapterScores,
    chapterCompletedAt,
    lastReadChapterId,
    lastOpenedAt,
  };
}

function parseStored(
  raw: string | null,
  chapters: ProgressChapter[]
): PersistedBookProgress | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedBookProgress>;
    return normalizeProgress(parsed, initialProgress(chapters), chapters);
  } catch {
    return null;
  }
}

export function useBookProgress<TChapter extends ProgressChapter>(
  bookId: string,
  chapters: TChapter[]
) {
  const storageKey = getBookProgressStorageKey(bookId);
  const [hydrated, setHydrated] = useState(false);
  const [progress, setProgress] = useState<PersistedBookProgress>(() =>
    initialProgress(chapters)
  );
  const [serverReady, setServerReady] = useState(false);
  // Two-axis completion (feedback #4): the application axis is SERVER-ONLY and
  // read-only. It lives in its OWN state — never merged into `progress`, never
  // reconstructed from local data — so the progress union-merge below cannot clobber
  // it, and it cannot clobber completion/scores. Keyed by chapterId.
  const [applicationStates, setApplicationStates] = useState<
    Record<string, ChapterApplicationState>
  >({});

  useEffect(() => {
    const parsed = parseStored(window.localStorage.getItem(storageKey), chapters);
    setProgress(parsed ?? initialProgress(chapters));
    setHydrated(true);
  }, [chapters, storageKey]);

  useEffect(() => {
    let mounted = true;
    fetchBookJson<{
      state: PersistedBookProgress | null;
      applicationStates?: Record<string, ChapterApplicationState>;
    }>(`/app/api/book/me/books/${encodeURIComponent(bookId)}/state`)
      .then((payload) => {
        if (!mounted) return;
        // Server-only, read-only: set straight from the (sanitized) payload, never
        // merged with local progress. Independent of the `state` early-return below.
        setApplicationStates(normalizeApplicationStates(payload.applicationStates));
        if (!payload.state) return;
        const serverState = normalizeProgress(payload.state, initialProgress(chapters), chapters);
        // Merge server state with local state: take the union of completed/unlocked
        // IDs so a locally-recorded unlock is never overwritten by stale server data.
        setProgress((local) => {
          const mergedCompleted = uniqueIds([
            ...local.completedChapterIds,
            ...serverState.completedChapterIds,
          ]);
          const mergedUnlocked = uniqueIds([
            ...local.unlockedChapterIds,
            ...serverState.unlockedChapterIds,
            ...mergedCompleted,
          ]);
          const mergedScores = { ...serverState.chapterScores };
          for (const [id, score] of Object.entries(local.chapterScores)) {
            mergedScores[id] = Math.max(mergedScores[id] ?? 0, Number(score));
          }
          const mergedCompletedAt = { ...serverState.chapterCompletedAt, ...local.chapterCompletedAt };

          const completedSet = new Set(mergedCompleted);
          const unlockedSet = new Set(mergedUnlocked);

          // Pick the most advanced currentChapterId
          const localCurrent = local.currentChapterId;
          const serverCurrent = serverState.currentChapterId;
          const currentChapterId =
            (localCurrent && unlockedSet.has(localCurrent) && !completedSet.has(localCurrent))
              ? localCurrent
              : (serverCurrent && unlockedSet.has(serverCurrent) && !completedSet.has(serverCurrent))
                ? serverCurrent
                : getFirstIncompleteUnlocked(chapters, completedSet, unlockedSet) || local.currentChapterId;

          return {
            currentChapterId,
            completedChapterIds: mergedCompleted,
            unlockedChapterIds: uniqueIds([...mergedUnlocked, currentChapterId]),
            chapterScores: mergedScores,
            chapterCompletedAt: mergedCompletedAt,
            lastReadChapterId: local.lastReadChapterId || serverState.lastReadChapterId,
            lastOpenedAt:
              local.lastOpenedAt > serverState.lastOpenedAt
                ? local.lastOpenedAt
                : serverState.lastOpenedAt,
          };
        });
        setServerReady(true);
      })
      .catch(() => {
        if (!mounted) return;
        setServerReady(true);
      });
    return () => {
      mounted = false;
    };
  }, [bookId, chapters]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(storageKey, JSON.stringify(progress));
    emitBookStorageChanged(`progress:${bookId}`);
  }, [bookId, hydrated, progress, storageKey]);

  useEffect(() => {
    if (!hydrated || !serverReady) return;
    const timeout = window.setTimeout(() => {
      fetchBookJson(`/app/api/book/me/books/${encodeURIComponent(bookId)}/state`, {
        method: "PATCH",
        body: JSON.stringify({ state: progress }),
      }).catch(() => {});
    }, 200);
    return () => window.clearTimeout(timeout);
  }, [bookId, hydrated, progress, serverReady]);

  const completedSet = useMemo(
    () => new Set(progress.completedChapterIds),
    [progress.completedChapterIds]
  );
  const unlockedSet = useMemo(
    () => new Set(progress.unlockedChapterIds),
    [progress.unlockedChapterIds]
  );

  const currentChapter = useMemo(
    () => chapters.find((chapter) => chapter.id === progress.currentChapterId) ?? chapters[0],
    [chapters, progress.currentChapterId]
  );

  const lastReadChapter = useMemo(
    () => chapters.find((chapter) => chapter.id === progress.lastReadChapterId) ?? currentChapter,
    [chapters, currentChapter, progress.lastReadChapterId]
  );

  const completedCount = progress.completedChapterIds.length;
  const totalCount = chapters.length;
  const unlockedCount = progress.unlockedChapterIds.length;
  const progressPercent = totalCount
    ? Math.round((completedCount / totalCount) * 100)
    : 0;

  const avgScore = (() => {
    const values = Object.values(progress.chapterScores);
    if (!values.length) return 0;
    const total = values.reduce((sum, value) => sum + Number(value), 0);
    return Math.round(total / values.length);
  })();

  // Two-axis completion (feedback #4): chapters the reader has APPLIED (followed
  // through). Derived purely from the server-only applicationStates — never gates
  // anything; it's a display stat for the rollup.
  const appliedCount = useMemo(
    () => countAppliedChapters(applicationStates),
    [applicationStates]
  );

  const getChapterState = useCallback(
    (chapterId: string): ChapterState => {
      if (completedSet.has(chapterId)) return "completed";
      if (chapterId === progress.currentChapterId || unlockedSet.has(chapterId)) return "current";
      return "locked";
    },
    [completedSet, unlockedSet, progress.currentChapterId]
  );

  const isChapterUnlocked = useCallback(
    (chapterId: string): boolean => completedSet.has(chapterId) || unlockedSet.has(chapterId),
    [completedSet, unlockedSet]
  );

  const setLastReadChapter = useCallback((chapterId: string) => {
    setProgress((prev) => {
      if (!chapters.some((chapter) => chapter.id === chapterId)) return prev;
      return {
        ...prev,
        lastReadChapterId: chapterId,
        lastOpenedAt: new Date().toISOString(),
      };
    });
  }, [chapters]);

  const setCurrentChapter = useCallback(
    (chapterId: string) => {
      setProgress((prev) => {
        const allowed = prev.completedChapterIds.includes(chapterId) || prev.unlockedChapterIds.includes(chapterId);
        if (!allowed) return prev;
        return {
          ...prev,
          currentChapterId: chapterId,
          lastReadChapterId: chapterId,
          lastOpenedAt: new Date().toISOString(),
        };
      });
    },
    []
  );

  const markChapterComplete = useCallback(
    (chapterId: string, score: number) => {
      const clampedScore = Math.max(0, Math.min(100, Math.round(score)));

      setProgress((prev) => {
        if (!chapters.some((chapter) => chapter.id === chapterId)) return prev;

        const alreadyCompleted = prev.completedChapterIds.includes(chapterId);
        const completedChapterIds = alreadyCompleted
          ? prev.completedChapterIds
          : [...prev.completedChapterIds, chapterId];

        const nextChapterId = getNextChapterId(chapters, chapterId);
        const unlockedChapterIds = uniqueIds([
          ...prev.unlockedChapterIds,
          chapterId,
          ...completedChapterIds,
          nextChapterId,
        ]);

        const completedSetLocal = new Set(completedChapterIds);
        const unlockedSetLocal = new Set(unlockedChapterIds);

        const nextCurrent =
          (nextChapterId && !completedSetLocal.has(nextChapterId) && unlockedSetLocal.has(nextChapterId)
            ? nextChapterId
            : getFirstIncompleteUnlocked(chapters, completedSetLocal, unlockedSetLocal)) ||
          chapterId;

        const chapterCompletedAt = prev.chapterCompletedAt[chapterId]
          ? prev.chapterCompletedAt
          : {
              ...prev.chapterCompletedAt,
              [chapterId]: new Date().toISOString(),
            };

        return {
          ...prev,
          completedChapterIds,
          unlockedChapterIds,
          chapterCompletedAt,
          chapterScores: {
            ...prev.chapterScores,
            [chapterId]: Math.max(prev.chapterScores[chapterId] ?? 0, clampedScore),
          },
          currentChapterId: nextCurrent,
          lastReadChapterId: chapterId,
          lastOpenedAt: new Date().toISOString(),
        };
      });
    },
    [chapters]
  );

  const markCurrentChapterComplete = useCallback(
    (score: number) => {
      const chapterId = progress.currentChapterId;
      if (!chapterId) return;
      markChapterComplete(chapterId, score);
    },
    [markChapterComplete, progress.currentChapterId]
  );

  const resetProgress = useCallback(async () => {
    // Hard-reset the server's canonical gating entitlement FIRST; only mutate
    // local state once it succeeds, so a failed network call leaves progress
    // untouched and the caller can surface the error. We can't rely on the
    // debounced merge-PATCH (it re-derives gating from server truth and never
    // clears it), and the GET union-merge would otherwise resurrect any
    // completion still on the server / in a stale tab.
    await fetchBookJson<{ state: PersistedBookProgress | null }>(
      `/app/api/book/me/books/${encodeURIComponent(bookId)}/state/reset`,
      { method: "POST" }
    );
    clearBookReaderStorage(bookId);
    setProgress(initialProgress(chapters));
  }, [bookId, chapters]);

  return {
    hydrated,
    progress,
    applicationStates,
    appliedCount,
    currentChapter,
    lastReadChapter,
    completedCount,
    totalCount,
    unlockedCount,
    progressPercent,
    avgScore,
    getChapterState,
    isChapterUnlocked,
    setCurrentChapter,
    setLastReadChapter,
    markChapterComplete,
    markCurrentChapterComplete,
    resetProgress,
  };
}
