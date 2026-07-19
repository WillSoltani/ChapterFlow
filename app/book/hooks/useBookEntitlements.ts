"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchBookJson, handleReauthRequired } from "@/app/book/_lib/book-api";
import type { ProSource } from "@/lib/entitlement-types";

export type BillingInterval = "monthly" | "annual" | "annual_upfront";

export type PricingTier = {
  interval: BillingInterval;
  price: string;
  label: string;
  annualTotal?: string;
  period: string;
};

export type EntitlementsResponse = {
  entitlement: {
    plan: "FREE" | "PRO";
    proStatus: "inactive" | "active" | "past_due" | "canceled";
    // Derived from the server source of truth so it cannot drift — includes
    // "admin", which the route forwards for admin-granted PRO users (WS3-014).
    proSource?: ProSource;
    freeBookSlots: number;
    unlockedBookIds: string[];
    unlockedBooksCount: number;
    remainingFreeStarts: number;
    currentPeriodEnd?: string;
    cancelAtPeriodEnd?: boolean;
    licenseKey?: string;
    licenseExpiresAt?: string;
  };
  paywall: {
    price: string;
    pricingTiers?: PricingTier[];
    benefits: string[];
  };
};

export type BillingState = {
  loading: boolean;
  payload: EntitlementsResponse | null;
  error: string | null;
};

export type BillingActionKind = "upgrade" | "portal";

async function openBillingDestination(
  kind: BillingActionKind,
  interval?: BillingInterval
) {
  const route =
    kind === "upgrade"
      ? "/app/api/book/billing/checkout-session"
      : "/app/api/book/billing/portal-session";

  const options: RequestInit = { method: "POST" };
  if (kind === "upgrade" && interval) {
    options.headers = { "Content-Type": "application/json" };
    options.body = JSON.stringify({ interval });
  }

  let payload: { checkoutUrl?: string; portalUrl?: string };
  try {
    payload = await fetchBookJson<{ checkoutUrl?: string; portalUrl?: string }>(
      route,
      options
    );
  } catch (error) {
    // Step-up re-auth (#5): the billing portal can require a recent sign-in. On
    // 401 `reauth_required`, send the user through a forced fresh login and
    // return to settings so they can retry. handleReauthRequired navigates away
    // (and returns true) when it applies; otherwise re-throw for normal handling.
    if (handleReauthRequired(error, "/book/settings")) return;
    throw error;
  }
  const target = kind === "upgrade" ? payload.checkoutUrl : payload.portalUrl;
  if (!target) throw new Error("Billing link unavailable.");
  if (kind === "upgrade" && typeof window !== "undefined") {
    // Mark that we are leaving for Stripe Checkout so that on return the
    // entitlements refetch waits for the webhook to land.
    sessionStorage.setItem(BILLING_UPGRADED_KEY, "1");
  }
  window.location.href = target;
}

/** Key used to signal a fresh checkout so Settings can refetch entitlements. */
export const BILLING_UPGRADED_KEY = "cf:billing-upgraded";

export function useBookEntitlements(enabled: boolean) {
  const [billingState, setBillingState] = useState<BillingState>({
    loading: enabled,
    payload: null,
    error: null,
  });
  const [billingAction, setBillingAction] = useState<BillingActionKind | null>(null);

  const fetchEntitlements = useCallback(() => {
    setBillingState((current) => ({ ...current, loading: true, error: null }));
    fetchBookJson<EntitlementsResponse>("/app/api/book/me/entitlements")
      .then((payload) => {
        setBillingState({ loading: false, payload, error: null });
      })
      .catch((error: unknown) => {
        const message =
          error instanceof Error ? error.message : "Unable to load plan details.";
        setBillingState({ loading: false, payload: null, error: message });
      });
  }, []);

  useEffect(() => {
    if (!enabled) {
      setBillingState({ loading: false, payload: null, error: null });
      return;
    }

    // Check if user just completed a checkout — if so, delay slightly to let
    // the Stripe webhook deliver before fetching entitlements.
    const justUpgraded =
      typeof window !== "undefined" &&
      sessionStorage.getItem(BILLING_UPGRADED_KEY) === "1";

    if (justUpgraded) {
      sessionStorage.removeItem(BILLING_UPGRADED_KEY);
      // Refetch a few times with backoff: webhook delivery is async and may
      // take a couple seconds. Stop early once the user shows as PRO.
      let cancelled = false;
      const delays = [1500, 3000, 5000];
      const timers: ReturnType<typeof setTimeout>[] = [];
      const tryFetch = (attempt: number) => {
        if (cancelled) return;
        fetchBookJson<EntitlementsResponse>("/app/api/book/me/entitlements")
          .then((payload) => {
            if (cancelled) return;
            setBillingState({ loading: false, payload, error: null });
            if (payload.entitlement.plan !== "PRO" && attempt < delays.length) {
              timers.push(setTimeout(() => tryFetch(attempt + 1), delays[attempt]));
            }
          })
          .catch((error: unknown) => {
            if (cancelled) return;
            const message =
              error instanceof Error ? error.message : "Unable to load plan details.";
            setBillingState({ loading: false, payload: null, error: message });
          });
      };
      timers.push(setTimeout(() => tryFetch(0), delays[0]));
      return () => {
        cancelled = true;
        timers.forEach(clearTimeout);
      };
    }

    fetchEntitlements();
  }, [enabled, fetchEntitlements]);

  const launchBillingAction = useCallback(
    async (kind: BillingActionKind, interval?: BillingInterval) => {
      setBillingAction(kind);
      try {
        await openBillingDestination(kind, interval);
        return null;
      } catch (error: unknown) {
        return error instanceof Error ? error.message : "Unable to open billing.";
      } finally {
        setBillingAction(null);
      }
    },
    []
  );

  /** Redeem a license key. Returns null on success or an error message string on failure. */
  const redeemLicenseKey = useCallback(async (code: string): Promise<string | null> => {
    try {
      await fetchBookJson<{ message: string }>("/app/api/book/billing/license", {
        method: "POST",
        body: JSON.stringify({ code }),
      });
      // Refresh entitlement state after successful redemption
      const payload = await fetchBookJson<EntitlementsResponse>("/app/api/book/me/entitlements");
      setBillingState({ loading: false, payload, error: null });
      return null;
    } catch (error: unknown) {
      return error instanceof Error ? error.message : "Unable to redeem license key.";
    }
  }, []);

  return {
    billingState,
    billingAction,
    launchBillingAction,
    redeemLicenseKey,
    refetch: fetchEntitlements,
  };
}
