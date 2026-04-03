"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchBookJson } from "@/app/book/_lib/book-api";

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
    proSource?: "stripe" | "license" | "flow_points";
    freeBookSlots: number;
    unlockedBookIds: string[];
    unlockedBooksCount: number;
    remainingFreeStarts: number;
    currentPeriodEnd?: string;
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

  const payload = await fetchBookJson<{ checkoutUrl?: string; portalUrl?: string }>(
    route,
    options
  );
  const target = kind === "upgrade" ? payload.checkoutUrl : payload.portalUrl;
  if (!target) throw new Error("Billing link unavailable.");
  window.location.href = target;
}

/** Key used to signal a fresh checkout so Settings can refetch entitlements. */
const BILLING_UPGRADED_KEY = "cf:billing-upgraded";

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
      const timer = setTimeout(fetchEntitlements, 1500);
      return () => clearTimeout(timer);
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
