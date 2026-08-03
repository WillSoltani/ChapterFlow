"use client";

// Canonical shared insight-points hook (WS3-001).

// Insight Points hook — formerly useFlowPoints.
// Implements §1 earning display and §5 redemption flow.

import { useCallback, useEffect, useState } from "react";
import { fetchBookJson } from "@/lib/client/book-api";
import {
  fetchBookJsonCached,
  invalidateBookCache,
  subscribeBookCache,
} from "@/lib/client/book-api-cache";
import { isBookCacheRefreshEvent } from "@/lib/client/book-api-cache-core";
import { emitBookStorageChanged } from "@/lib/client/book-storage-events";

const FLOW_POINTS_KEY = "/app/api/book/me/flow-points";

export type InsightPointsPayload = {
  summary: {
    balance: number;
    lifetimeEarned: number;
    lifetimeSpent: number;
    rewardReadyCount: number;
    nextReward: {
      rewardId: string;
      name: string;
      costPoints: number;
      pointsRemaining: number;
      progressPercent: number;
    } | null;
  };
  rewards: Array<{
    rewardId: string;
    name: string;
    description: string;
    costPoints: number;
    status: "available" | "locked" | "claimed" | "unavailable";
    pointsRemaining: number;
    claimedAt: string | null;
    unavailableReason: string | null;
    highlight: string;
  }>;
  recentTransactions: Array<{
    transactionId: string;
    direction: "earn" | "spend" | "adjustment";
    amount: number;
    sourceType: string;
    rewardId: string | null;
    title: string;
    subtitle: string | null;
    createdAt: string;
  }>;
  referral: {
    code: string;
    path: string;
    pendingInvites: number;
    activatedInvites: number;
    proInvites: number;
    activationPointsEarned: number;
    proPointsEarned: number;
  };
  waysToEarn: Array<{
    label: string;
    amount: number;
    displayValue: string;
    detail: string;
    cadence: string;
    note: string;
  }>;
};

export type RedeemFeedback = {
  message: string;
  tone: "success" | "error";
};

type InsightPointsState = {
  loading: boolean;
  payload: InsightPointsPayload | null;
  error: string | null;
  redeemingRewardId: string | null;
  redeemMessage: RedeemFeedback | null;
};

export function useInsightPoints(enabled = true) {
  const [state, setState] = useState<InsightPointsState>({
    loading: enabled,
    payload: null,
    error: null,
    redeemingRewardId: null,
    redeemMessage: null,
  });

  const refresh = useCallback(async () => {
    if (!enabled) {
      setState({
        loading: false,
        payload: null,
        error: null,
        redeemingRewardId: null,
        redeemMessage: null,
      });
      return;
    }

    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const payload = await fetchBookJsonCached<InsightPointsPayload>(FLOW_POINTS_KEY);
      setState((current) => ({
        ...current,
        loading: false,
        payload,
        error: null,
      }));
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Unable to load Insight Points.";
      setState((current) => ({
        ...current,
        loading: false,
        error: message,
      }));
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Focus/storage/book-storage revalidation is owned by the shared cache; a
  // background refresh of the flow-points key pulls the new value into local
  // state. Only subscribe when enabled so a disabled hook triggers no fetches.
  useEffect(() => {
    if (!enabled) return;
    return subscribeBookCache(FLOW_POINTS_KEY, (event) => {
      if (isBookCacheRefreshEvent(event)) {
        void refresh();
        return;
      }
      if (event.type === "clear") {
        setState((current) => ({
          ...current,
          loading: false,
          payload: null,
          error: null,
        }));
        return;
      }
      const message =
        event.error instanceof Error ? event.error.message : "Unable to load Insight Points.";
      setState((current) => ({ ...current, loading: false, error: message }));
    });
  }, [enabled, refresh]);

  const redeemReward = useCallback(
    async (rewardId: string): Promise<RedeemFeedback> => {
      setState((current) => ({
        ...current,
        redeemingRewardId: rewardId,
        redeemMessage: null,
      }));
      try {
        const payload = await fetchBookJson<{ message: string }>("/app/api/book/me/flow-points/redeem", {
          method: "POST",
          body: JSON.stringify({ rewardId }),
        });
        const feedback: RedeemFeedback = { message: payload.message, tone: "success" };
        setState((current) => ({
          ...current,
          redeemingRewardId: null,
          redeemMessage: feedback,
        }));
        // The redeem mutated the balance — drop the cached flow-points read so the
        // refresh below (and any co-mounted reader) pulls the new balance, not a hit.
        invalidateBookCache(FLOW_POINTS_KEY);
        emitBookStorageChanged("insight-points");
        await refresh();
        return feedback;
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "Unable to redeem reward.";
        const feedback: RedeemFeedback = { message, tone: "error" };
        setState((current) => ({
          ...current,
          redeemingRewardId: null,
          redeemMessage: feedback,
        }));
        return feedback;
      }
    },
    [refresh]
  );

  return {
    ...state,
    refresh,
    redeemReward,
  };
}
