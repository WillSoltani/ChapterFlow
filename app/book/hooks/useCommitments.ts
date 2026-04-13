"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchBookJson } from "@/app/book/_lib/book-api";
import type { BookUserCommitmentItem } from "@/app/app/api/book/_lib/types";

type CommitmentsPayload = { commitments: BookUserCommitmentItem[] };
type CreateResult = { commitment: BookUserCommitmentItem; created: boolean };
type PatchResult = { commitment: BookUserCommitmentItem; ipAwarded: number; balance?: number };

export function useCommitments(enabled: boolean) {
  const [commitments, setCommitments] = useState<BookUserCommitmentItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchBookJson<CommitmentsPayload>("/app/api/book/me/commitments");
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
      await refresh();
      return result;
    },
    [refresh],
  );

  const activeCommitments = commitments.filter((c) => c.status === "active");
  const dueCommitments = activeCommitments.filter(
    (c) => new Date(c.followUpDate) <= new Date(),
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
