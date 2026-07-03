"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, CheckCircle2, XCircle, Check, Sparkles } from "lucide-react";
import { Button } from "@/app/book/components/ui/Button";
import type {
  BillingInterval,
  EntitlementsResponse,
  PricingTier,
} from "@/app/book/hooks/useBookEntitlements";
import { ANNUAL_SAVINGS_BADGE, TRIAL_CTA_LABEL, PRO_FEATURES } from "@/lib/pricing";
import { CATALOG_BOOK_COUNT_DISPLAY } from "@/lib/catalog-stats";
import {
  APPLE_MANAGE_SUBSCRIPTIONS_URL,
  APPLE_MANAGED_SUBSCRIPTION_LABEL,
} from "@/lib/apple-billing";

type SubscriptionCardProps = {
  plan: "FREE" | "PRO";
  freeBookSlots: number;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
  /** How the user obtained Pro — drives whether we show the Stripe portal or the
   *  App Store management link for a Pro subscriber. */
  proSource?: EntitlementsResponse["entitlement"]["proSource"];
  price: string;
  pricingTiers?: PricingTier[];
  /** Billing interval to pre-select (e.g. carried from the landing "Annual"
   *  toggle via the upgrade deep-link). Only honored when it's an offered tier. */
  initialInterval?: BillingInterval;
  onUpgrade: (interval?: BillingInterval) => Promise<string | null>;
  onManage: () => Promise<string | null>;
  onRedeemKey: (code: string) => Promise<string | null>;
  reducedMotion?: boolean;
};

const TIER_DISPLAY: Record<BillingInterval, { name: string; badge?: string }> = {
  monthly: { name: "Monthly" },
  annual: { name: "Annual", badge: ANNUAL_SAVINGS_BADGE },
  annual_upfront: { name: "Annual upfront", badge: "Best value" },
};

export function SubscriptionCard({
  plan,
  freeBookSlots,
  currentPeriodEnd,
  cancelAtPeriodEnd,
  proSource,
  price,
  pricingTiers,
  initialInterval,
  onUpgrade,
  onManage,
  onRedeemKey,
  reducedMotion,
}: SubscriptionCardProps) {
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [keyCode, setKeyCode] = useState("");
  const [keyStatus, setKeyStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [keyMessage, setKeyMessage] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedInterval, setSelectedInterval] = useState<BillingInterval>(() => {
    // Honor a deep-link interval hint, but ONLY if it's actually offered (its
    // Stripe Price ID is configured) — otherwise fall back to the default so we
    // never pre-select an unpurchasable tier.
    const offered = (pricingTiers ?? []).some((t) => t.interval === initialInterval);
    if (initialInterval && offered) return initialInterval;
    return pricingTiers && pricingTiers.length > 1 ? "annual" : "monthly";
  });

  const formattedDate = currentPeriodEnd
    ? new Date(currentPeriodEnd).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  async function handleRedeemKey(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = keyCode.trim().toUpperCase();
    if (!trimmed) return;
    setKeyStatus("loading");
    const error = await onRedeemKey(trimmed);
    if (error) {
      setKeyStatus("error");
      setKeyMessage(error);
    } else {
      setKeyStatus("success");
      setKeyMessage("Pro access activated!");
      setKeyCode("");
    }
  }

  async function handleUpgrade() {
    if (actionLoading) return; // double-click guard
    setActionError(null);
    setActionLoading(true);
    const error = await onUpgrade(selectedInterval);
    if (error) {
      setActionError(error);
      setActionLoading(false);
      return;
    }
    // On success the page navigates to Stripe Checkout, so we leave the
    // spinner running until the unload happens. If for some reason it
    // doesn't unload within 8s, restore the button so the user isn't stuck.
    window.setTimeout(() => setActionLoading(false), 8000);
  }

  async function handleManage() {
    if (actionLoading) return;
    setActionError(null);
    setActionLoading(true);
    const error = await onManage();
    if (error) {
      setActionError(error);
      setActionLoading(false);
      return;
    }
    window.setTimeout(() => setActionLoading(false), 8000);
  }

  if (plan === "PRO") {
    return (
      <div className="rounded-2xl border border-(--cf-accent-border) bg-linear-to-br from-(--cf-accent-muted) to-transparent p-5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-(--cf-gold-text)" aria-hidden="true" />
          <span className="text-base font-bold text-(--cf-text-1)">Pro Plan</span>
        </div>
        <p className="mt-0.5 text-xs text-(--cf-text-soft)">
          All {CATALOG_BOOK_COUNT_DISPLAY} books &middot; Full feature access
        </p>
        <p className="text-sm text-(--cf-text-soft) mt-1">
          {cancelAtPeriodEnd && formattedDate
            ? `Cancels on ${formattedDate}`
            : formattedDate
              ? `Next renewal: ${formattedDate}`
              : "Monthly billing"}
        </p>
        {cancelAtPeriodEnd && (
          <p className="mt-1 text-xs text-(--cf-warning-text, #b45309)">
            Your Pro access will end on the date above and won&apos;t auto-renew.
          </p>
        )}
        {proSource === "apple" ? (
          // App Store subscriptions can only be managed by Apple — there is no
          // Stripe portal to open. Point the user at Apple's management page
          // instead of the (server-minted) Stripe portal CTA.
          <>
            <p className="mt-2 text-xs text-(--cf-text-soft)">
              {APPLE_MANAGED_SUBSCRIPTION_LABEL}.
            </p>
            <a
              href={APPLE_MANAGE_SUBSCRIPTIONS_URL}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex h-(--cf-control-height-sm) items-center justify-center rounded-xl border border-(--cf-border) bg-(--cf-surface) px-3 text-sm font-semibold text-(--cf-text-1) transition-colors hover:border-(--cf-text-soft)"
            >
              Manage in the App Store
            </a>
          </>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            className="mt-4"
            disabled={actionLoading}
            onClick={handleManage}
          >
            {actionLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Manage subscription"
            )}
          </Button>
        )}
        {actionError && (
          <div className="mt-2 flex items-center gap-2 text-xs text-(--cf-danger-text)">
            <XCircle className="h-3.5 w-3.5" />
            <span>{actionError}</span>
          </div>
        )}
      </div>
    );
  }

  const hasTiers = pricingTiers && pricingTiers.length > 1;

  // The paywall price string from the entitlements API already includes the
  // interval (e.g. "$7.99/month"), while the client fallback does not
  // (e.g. "$7.99 CAD"). Strip any trailing interval so we append it exactly
  // once and never render "/month/month". (VB-024)
  const priceWithInterval = /\/(month|mo)\s*$/i.test(price)
    ? price.replace(/\s*\/(month|mo)\s*$/i, "/month")
    : `${price}/month`;

  return (
    <div className="rounded-2xl border border-(--cf-border) bg-(--cf-surface) p-5">
      <div className="flex items-center gap-2">
        <span className="text-base font-bold text-(--cf-text-1)">Free Plan</span>
      </div>
      <p className="mt-1 text-sm text-(--cf-text-3)">
        You have access to {freeBookSlots} book{freeBookSlots === 1 ? "" : "s"}.
      </p>

      {/* Finding D: the upgrade upsell is the premium channel, NOT the cyan
          product accent. The single canonical Pro-CTA signal (--cf-upgrade-accent,
          amber→gold) is a gradient and can't be color-mixed, so the panel wears
          the warm gold wash (--cf-gold-soft / --cf-gold-border) and the gradient
          rides the CTA below — matching DiscoveryRow / Pricing / ProInsightsPreview. */}
      <div
        className="mt-4 rounded-xl border p-4"
        style={{ background: "var(--cf-gold-soft)", borderColor: "var(--cf-gold-border)" }}
      >
        <p className="flex items-center gap-1.5 text-sm font-semibold text-(--cf-text-1)">
          <Sparkles className="h-4 w-4 text-(--cf-gold-text)" aria-hidden="true" />
          Upgrade to Pro
        </p>
        {/* Finding E: value prop driven by the shared PRO_FEATURES constant
            (lib/pricing.ts) so the in-app upsell sells the SAME Pro as the
            landing card — no more value-prop drift between funnel stages. */}
        <ul className="mt-2 space-y-1.5">
          {PRO_FEATURES.map((feature) => (
            <li
              key={feature}
              className="flex items-start gap-2 text-xs leading-relaxed text-(--cf-text-3)"
            >
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-(--cf-gold-text)" aria-hidden="true" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>

        {hasTiers ? (
          <div className="mt-3 flex flex-col gap-2" role="radiogroup" aria-label="Billing interval">
            {pricingTiers.map((tier) => {
              const display = TIER_DISPLAY[tier.interval];
              const isSelected = tier.interval === selectedInterval;
              return (
                <button
                  key={tier.interval}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => setSelectedInterval(tier.interval)}
                  className={`cf-pressable flex items-center justify-between rounded-lg border px-3 py-2.5 text-left transition-colors ${
                    isSelected
                      ? "border-(--cf-accent) bg-(--cf-accent-muted)"
                      : "border-(--cf-border) bg-(--cf-surface) hover:border-(--cf-text-soft)"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                        isSelected
                          ? "border-(--cf-accent) bg-(--cf-accent)"
                          : "border-(--cf-text-soft)"
                      }`}
                    >
                      {isSelected && (
                        <div className="h-1.5 w-1.5 rounded-full bg-white" />
                      )}
                    </div>
                    <span className="text-sm font-medium text-(--cf-text-1)">
                      {display.name}
                    </span>
                    {display.badge && (
                      <span className="rounded-full bg-(--cf-accent)/15 px-2 py-0.5 text-[10px] font-bold text-(--cf-accent)">
                        {display.badge}
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-(--cf-text-1)">
                      {tier.price}
                    </span>
                    <span className="text-xs text-(--cf-text-3)">
                      /{tier.period === "year" && tier.interval === "annual" ? "mo" : tier.period}
                    </span>
                    {tier.annualTotal && (
                      <p className="text-[10px] text-(--cf-text-soft)">
                        {tier.annualTotal}/year
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="mt-2 text-sm font-semibold text-(--cf-text-1)">
            {priceWithInterval}
          </p>
        )}

        {/* Finding D: the single canonical Pro-CTA — amber→gold gradient with a
            black label (text-black clears AA on gold; --cf-upgrade-accent's light
            ramp is darkened at the start for exactly this) and an amber focus
            ring, so this reads identically to every other "Upgrade"/"Go Pro" CTA. */}
        <button
          type="button"
          disabled={actionLoading}
          onClick={handleUpgrade}
          className={`mt-3 inline-flex h-(--cf-control-height-sm) w-full items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold text-black transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent-amber) focus-visible:ring-offset-2 focus-visible:ring-offset-(--cf-page-bg) disabled:cursor-not-allowed disabled:opacity-70${
            reducedMotion ? "" : " hover:scale-[1.02]"
          }`}
          style={{ background: "var(--cf-upgrade-accent)", boxShadow: "var(--cf-upgrade-accent-shadow)" }}
        >
          {actionLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            TRIAL_CTA_LABEL
          )}
        </button>
        {actionError && (
          <div className="mt-2 flex items-center gap-2 text-xs text-(--cf-danger-text)">
            <XCircle className="h-3.5 w-3.5" />
            <span>{actionError}</span>
          </div>
        )}
      </div>

      <div className="mt-3">
        {!showKeyInput ? (
          <button
            type="button"
            onClick={() => setShowKeyInput(true)}
            className="text-xs font-medium text-(--cf-text-3) hover:text-(--cf-text-2)"
          >
            Have a code? Redeem license key
          </button>
        ) : (
          <AnimatePresence>
            <motion.form
              initial={reducedMotion ? false : { height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              onSubmit={handleRedeemKey}
              className="mt-2 flex gap-2"
            >
              <input
                type="text"
                value={keyCode}
                onChange={(e) => {
                  setKeyCode(e.target.value.toUpperCase());
                  if (keyStatus !== "idle") {
                    setKeyStatus("idle");
                    setKeyMessage("");
                  }
                }}
                placeholder="CF-XXXX-XXXX-XXXX"
                maxLength={17}
                spellCheck={false}
                autoComplete="off"
                className="cf-input min-w-0 flex-1 rounded-xl px-3 py-2 font-mono text-sm uppercase tracking-widest"
              />
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={keyStatus === "loading" || keyCode.trim().length === 0}
              >
                {keyStatus === "loading" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Redeem"
                )}
              </Button>
            </motion.form>
          </AnimatePresence>
        )}
        {keyStatus === "success" && (
          <div className="mt-2 flex items-center gap-2 text-xs text-(--cf-success-text)">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>{keyMessage}</span>
          </div>
        )}
        {keyStatus === "error" && (
          <div className="mt-2 flex items-center gap-2 text-xs text-(--cf-danger-text)">
            <XCircle className="h-3.5 w-3.5" />
            <span>{keyMessage}</span>
          </div>
        )}
      </div>
    </div>
  );
}
