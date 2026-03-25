"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/app/book/components/ui/Button";
import { cn } from "@/app/book/components/ui/cn";

type SubscriptionCardProps = {
  plan: "FREE" | "PRO";
  currentPeriodEnd?: string;
  price: string;
  onUpgrade: () => Promise<string | null>;
  onManage: () => Promise<string | null>;
  onRedeemKey: (code: string) => Promise<string | null>;
  reducedMotion?: boolean;
};

export function SubscriptionCard({
  plan,
  currentPeriodEnd,
  price,
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

  async function handleAction(action: () => Promise<string | null>) {
    setActionLoading(true);
    await action();
    setActionLoading(false);
  }

  if (plan === "PRO") {
    return (
      <div className="rounded-2xl border border-(--cf-accent-border) bg-gradient-to-br from-(--cf-accent-muted) to-transparent p-5">
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
          onClick={() => handleAction(onManage)}
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

  return (
    <div className="rounded-2xl border border-(--cf-border) bg-(--cf-surface) p-5">
      <div className="flex items-center gap-2">
        <span className="text-sm">\uD83D\uDCDA</span>
        <span className="text-base font-bold text-(--cf-text-1)">Free Plan</span>
      </div>
      <p className="mt-1 text-sm text-(--cf-text-3)">You have access to 2 books.</p>

      <div className="mt-4 rounded-xl border border-(--cf-accent-border) bg-(--cf-accent-muted) p-4">
        <p className="text-sm font-semibold text-(--cf-text-1)">
          &#10024; Upgrade to Pro &mdash; {price}/month
        </p>
        <p className="mt-1 text-xs leading-relaxed text-(--cf-text-3)">
          Unlock all 95+ books, text-to-speech, spaced repetition, reading analytics, and
          export tools.
        </p>
        <Button
          variant="primary"
          size="sm"
          className="mt-3"
          disabled={actionLoading}
          onClick={() => handleAction(onUpgrade)}
        >
          {actionLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Start 7-day free trial"
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
