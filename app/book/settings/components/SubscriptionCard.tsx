"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/app/book/components/ui/Button";
import type { BillingInterval, PricingTier } from "@/app/book/hooks/useBookEntitlements";

type SubscriptionCardProps = {
  plan: "FREE" | "PRO";
  currentPeriodEnd?: string;
  price: string;
  pricingTiers?: PricingTier[];
  onUpgrade: (interval?: BillingInterval) => Promise<string | null>;
  onManage: () => Promise<string | null>;
  onRedeemKey: (code: string) => Promise<string | null>;
  reducedMotion?: boolean;
};

const TIER_DISPLAY: Record<BillingInterval, { name: string; badge?: string }> = {
  monthly: { name: "Monthly" },
  annual: { name: "Annual", badge: "Save 25%" },
  annual_upfront: { name: "Annual upfront", badge: "Best value" },
};

export function SubscriptionCard({
  plan,
  currentPeriodEnd,
  price,
  pricingTiers,
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
  const [selectedInterval, setSelectedInterval] = useState<BillingInterval>(
    pricingTiers && pricingTiers.length > 1 ? "annual" : "monthly"
  );

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
    setActionLoading(true);
    await onUpgrade(selectedInterval);
    setActionLoading(false);
  }

  async function handleManage() {
    setActionLoading(true);
    await onManage();
    setActionLoading(false);
  }

  if (plan === "PRO") {
    return (
      <div className="rounded-2xl border border-(--cf-accent-border) bg-linear-to-br from-(--cf-accent-muted) to-transparent p-5">
        <div className="flex items-center gap-2">
          <span className="text-sm">&#10024;</span>
          <span className="text-base font-bold text-(--cf-text-1)">Pro Plan</span>
        </div>
        <p className="mt-0.5 text-xs text-(--cf-text-soft)">
          All 95+ books &middot; Full feature access
        </p>
        <p className="text-sm text-(--cf-text-soft) mt-1">
          {formattedDate ? `Next renewal: ${formattedDate}` : "Monthly billing"}
        </p>
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
      </div>
    );
  }

  const hasTiers = pricingTiers && pricingTiers.length > 1;

  return (
    <div className="rounded-2xl border border-(--cf-border) bg-(--cf-surface) p-5">
      <div className="flex items-center gap-2">
        <span className="text-base font-bold text-(--cf-text-1)">Free Plan</span>
      </div>
      <p className="mt-1 text-sm text-(--cf-text-3)">You have access to 2 books.</p>

      <div className="mt-4 rounded-xl border border-(--cf-accent-border) bg-(--cf-accent-muted) p-4">
        <p className="text-sm font-semibold text-(--cf-text-1)">
          &#10024; Upgrade to Pro
        </p>
        <p className="mt-1 text-xs leading-relaxed text-(--cf-text-3)">
          Unlock all 95+ books, text-to-speech, spaced repetition, reading analytics, and
          export tools.
        </p>

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
                  className={`flex items-center justify-between rounded-lg border px-3 py-2.5 text-left transition-colors ${
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
            {price}/month
          </p>
        )}

        <Button
          variant="primary"
          size="sm"
          className="mt-3 w-full"
          disabled={actionLoading}
          onClick={handleUpgrade}
        >
          {actionLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Start 14-day free trial"
          )}
        </Button>
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
