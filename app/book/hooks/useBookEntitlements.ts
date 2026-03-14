"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchBookJson } from "@/app/book/_lib/book-api";

export type EntitlementsResponse = {
  entitlement: {
    plan: "FREE" | "PRO";
    proStatus: "inactive" | "active" | "past_due" | "canceled";
    freeBookSlots: number;
    unlockedBookIds: string[];
    unlockedBooksCount: number;
    remainingFreeStarts: number;
  };
  paywall: {
    price: string;
    benefits: string[];
  };
};

export type BillingState = {
  loading: boolean;
  payload: EntitlementsResponse | null;
  error: string | null;
};

export type BillingActionKind = "upgrade" | "portal";

async function openBillingDestination(kind: BillingActionKind) {
  const route =
    kind === "upgrade"
      ? "/app/api/book/billing/checkout-session"
      : "/app/api/book/billing/portal-session";
  const payload = await fetchBookJson<{ checkoutUrl?: string; portalUrl?: string }>(
    route,
    { method: "POST" }
  );
  const target = kind === "upgrade" ? payload.checkoutUrl : payload.portalUrl;
  if (!target) throw new Error("Billing link unavailable.");
  window.location.href = target;
}

export function useBookEntitlements(enabled: boolean) {
  const [billingState, setBillingState] = useState<BillingState>({
    loading: enabled,
    payload: null,
    error: null,
  });
  const [billingAction, setBillingAction] = useState<BillingActionKind | null>(null);

  useEffect(() => {
    if (!enabled) {
      setBillingState({ loading: false, payload: null, error: null });
      return;
    }

    let mounted = true;
    setBillingState((current) => ({ ...current, loading: true, error: null }));

    fetchBookJson<EntitlementsResponse>("/app/api/book/me/entitlements")
      .then((payload) => {
        if (!mounted) return;
        setBillingState({ loading: false, payload, error: null });
      })
      .catch((error: unknown) => {
        if (!mounted) return;
        const message =
          error instanceof Error ? error.message : "Unable to load plan details.";
        setBillingState({ loading: false, payload: null, error: message });
      });

    return () => {
      mounted = false;
    };
  }, [enabled]);

  const launchBillingAction = useCallback(async (kind: BillingActionKind) => {
    setBillingAction(kind);
    try {
      await openBillingDestination(kind);
      return null;
    } catch (error: unknown) {
      return error instanceof Error ? error.message : "Unable to open billing.";
    } finally {
      setBillingAction(null);
    }
  }, []);

  return {
    billingState,
    billingAction,
    launchBillingAction,
  };
}
