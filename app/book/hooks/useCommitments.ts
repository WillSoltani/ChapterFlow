"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchBookJson } from "@/app/book/_lib/book-api";
import { fetchBookJsonCached, invalidateBookCache } from "@/lib/client/book-api-cache";
import { COMMITMENTS_KEY } from "./book-read-keys";
import type { BookUserCommitmentItem } from "@/app/app/api/book/_lib/types";

type CommitmentsPayload = { commitments: BookUserCommitmentItem[] };
type CreateResult = { commitment: BookUserCommitmentItem; created: boolean };
type PatchResult = { commitment: BookUserCommitmentItem; ipAwarded: number; balance?: number };

export function useCommitments(enabled: boolean) {
  const [commitments, setCommitments] = useState<BookUserCommitmentItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchBookJsonCached<CommitmentsPayload>(COMMITMENTS_KEY);
      setCommitments(data.commitments);
    } catch (e) {
      console.error("Failed to fetch commitments:", e);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    refresh().finally(() => setLoading(false));
  }, [enabled, refresh]);

  const create = useCallback(
    async (params: {
      bookId: string;
      chapterNumber: number;
      ifThenPlan: string;
      followUpDays: 3 | 7;
    }) => {
      const result = await fetchBookJson<CreateResult>("/app/api/book/me/commitments", {
        method: "POST",
        body: JSON.stringify(params),
      });
      invalidateBookCache(COMMITMENTS_KEY);
      await refresh();
      return result;
    },
    [refresh],
  );

  const complete = useCallback(
    async (commitmentId: string, followThroughReflection: string) => {
      const result = await fetchBookJson<PatchResult>(
        `/app/api/book/me/commitments/${commitmentId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ action: "complete", followThroughReflection }),
        },
      );
      invalidateBookCache(COMMITMENTS_KEY);
      await refresh();
      return result;
    },
    [refresh],
  );

  const skip = useCallback(
    async (commitmentId: string) => {
      const result = await fetchBookJson<PatchResult>(
        `/app/api/book/me/commitments/${commitmentId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ action: "skip" }),
        },
      );
      invalidateBookCache(COMMITMENTS_KEY);
      await refresh();
      return result;
    },
    [refresh],
  );

  // Memoized so the derived arrays keep a stable reference between renders and
  // only change when `commitments` actually changes (i.e. after a successful
  // refresh). Without this, an unrelated re-render of a consumer (e.g. the large
  // chapter reader) would hand effects keyed on these arrays a fresh reference
  // every render, firing them against stale data — which caused a post-commit
  // "Committed → form → Committed" flicker.
  const activeCommitments = useMemo(
    () => commitments.filter((c) => c.status === "active"),
    [commitments],
  );
  const dueCommitments = useMemo(
    () => activeCommitments.filter((c) => new Date(c.followUpDate) <= new Date()),
    [activeCommitments],
  );

  return {
    commitments,
    activeCommitments,
    dueCommitments,
    loading,
    create,
    complete,
    skip,
    refresh,
  };
}
