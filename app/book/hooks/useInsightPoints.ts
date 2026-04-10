"use client";

// Insight Points hook — formerly useFlowPoints.
// Implements §1 earning display and §5 redemption flow.

import { useCallback, useEffect, useState } from "react";
import { fetchBookJson } from "@/app/book/_lib/book-api";
import { BOOK_STORAGE_EVENT, emitBookStorageChanged } from "@/app/book/hooks/bookStorageEvents";

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

type InsightPointsState = {
  loading: boolean;
  payload: InsightPointsPayload | null;
  error: string | null;
  redeemingRewardId: string | null;
  redeemMessage: string | null;
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
      const payload = await fetchBookJson<InsightPointsPayload>("/app/api/book/me/flow-points");
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

  useEffect(() => {
    function onStorageChange() {
      void refresh();
    }

    window.addEventListener(BOOK_STORAGE_EVENT, onStorageChange as EventListener);
    window.addEventListener("focus", onStorageChange);
    return () => {
      window.removeEventListener(BOOK_STORAGE_EVENT, onStorageChange as EventListener);
      window.removeEventListener("focus", onStorageChange);
    };
  }, [refresh]);

  const redeemReward = useCallback(
    async (rewardId: string): Promise<string | null> => {
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
        setState((current) => ({
          ...current,
          redeemingRewardId: null,
          redeemMessage: payload.message,
        }));
        emitBookStorageChanged("insight-points");
        await refresh();
        return null;
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "Unable to redeem reward.";
        setState((current) => ({
          ...current,
          redeemingRewardId: null,
          redeemMessage: message,
        }));
        return message;
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
