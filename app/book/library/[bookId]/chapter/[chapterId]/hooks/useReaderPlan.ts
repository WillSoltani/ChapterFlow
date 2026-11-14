"use client";

import { useEffect, useState } from "react";
import { fetchBookJsonCached } from "@/lib/client/book-api-cache";
import { ENTITLEMENTS_KEY } from "@/lib/client/book-read-keys";

export type ReaderPlan = "FREE" | "PRO";

type EntitlementPlanResponse = { entitlement?: { plan?: string } };

/** The reader's plan from the shared entitlements read. null while unknown and
 *  after a failed read: callers then behave as before (never blocks reading). */
export function useReaderPlan(): ReaderPlan | null {
  const [plan, setPlan] = useState<ReaderPlan | null>(null);
  useEffect(() => {
    let active = true;
    fetchBookJsonCached<EntitlementPlanResponse>(ENTITLEMENTS_KEY)
      .then((body) => {
        const value = body?.entitlement?.plan;
        if (active && (value === "FREE" || value === "PRO")) setPlan(value);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  return plan;
}
