"use client";

// D7: how many free books a reader can still start, read from the shared
// entitlements cache (one request per navigation, deduped with every other
// ENTITLEMENTS_KEY reader). null while loading or when the read failed: callers
// then show neither a Pro lock nor a "free" label (`/start` still enforces).

import { useMemo } from "react";
import { useBookQuery } from "@/lib/client/book-api-cache";
import { ENTITLEMENTS_KEY } from "@/lib/client/book-read-keys";

export type FreeBookAllowance = {
  plan: "FREE" | "PRO";
  remainingFreeStarts: number;
  unlockedBookIds: string[];
};

type EntitlementsResponse = {
  entitlement?: {
    plan?: string;
    remainingFreeStarts?: number;
    unlockedBookIds?: string[];
  };
};

export function toFreeBookAllowance(
  payload: EntitlementsResponse | undefined,
): FreeBookAllowance | null {
  const entitlement = payload?.entitlement;
  if (!entitlement) return null;
  if (entitlement.plan !== "FREE" && entitlement.plan !== "PRO") return null;
  if (
    typeof entitlement.remainingFreeStarts !== "number" ||
    !Number.isFinite(entitlement.remainingFreeStarts)
  ) {
    return null;
  }
  return {
    plan: entitlement.plan,
    remainingFreeStarts: Math.max(0, entitlement.remainingFreeStarts),
    unlockedBookIds: Array.isArray(entitlement.unlockedBookIds)
      ? entitlement.unlockedBookIds.filter((id): id is string => typeof id === "string")
      : [],
  };
}

export function useFreeBookAllowance(): FreeBookAllowance | null {
  // A failed first read leaves `data` undefined, so the allowance stays null.
  const { data } = useBookQuery<EntitlementsResponse>(ENTITLEMENTS_KEY);
  return useMemo(() => toFreeBookAllowance(data), [data]);
}
