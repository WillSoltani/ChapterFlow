"use client";

import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Gift, Lock, TrendingUp, Users, Zap, Copy } from "lucide-react";
import { TopNav } from "@/app/book/home/components/TopNav";
import { ErrorBanner } from "@/app/book/components/ui/ErrorBanner";
import { useBookViewer } from "@/app/book/hooks/useBookViewer";
import { useInsightPoints, type InsightPointsPayload } from "@/app/book/hooks/useInsightPoints";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function BalanceHeader({ summary }: { summary: InsightPointsPayload["summary"] }) {
  return (
    <div
      className="rounded-2xl border border-(--cf-border) p-6 text-center"
      style={{
        background: "linear-gradient(135deg, var(--cf-accent-soft), var(--cf-surface))",
      }}
    >
      <p className="mb-1 text-[13px] font-medium uppercase tracking-widest text-(--cf-text-soft)">
        Insight Points
      </p>
      <p className="text-[48px] font-bold leading-none tracking-tight text-(--cf-text-1)">
        {summary.balance.toLocaleString()}
      </p>
      <div className="mt-4 flex justify-center gap-6 text-[13px] text-(--cf-text-2)">
        <span>
          <TrendingUp size={14} className="mr-1 inline opacity-60" />
          {summary.lifetimeEarned.toLocaleString()} earned
        </span>
        <span>
          <Gift size={14} className="mr-1 inline opacity-60" />
          {summary.lifetimeSpent.toLocaleString()} spent
        </span>
      </div>

      {summary.nextReward && (
        <div className="mt-5">
          <div className="mb-1.5 flex items-center justify-between text-[12px] text-(--cf-text-soft)">
            <span>Next: {summary.nextReward.name}</span>
            <span>{summary.nextReward.progressPercent}%</span>
          </div>
          <div
            className="h-2 overflow-hidden rounded-full bg-(--cf-surface-strong)"
            role="progressbar"
            aria-valuenow={Math.min(summary.nextReward.progressPercent, 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Progress to ${summary.nextReward.name}`}
          >
            <div
              className="h-full rounded-full bg-(--cf-accent) transition-all duration-500"
              style={{ width: `${Math.min(summary.nextReward.progressPercent, 100)}%` }}
            />
          </div>
          <p className="mt-1 text-[12px] text-(--cf-text-soft)">
            {summary.nextReward.pointsRemaining.toLocaleString()} IP to go
          </p>
        </div>
      )}
    </div>
  );
}

function RewardCard({
  reward,
  redeeming,
  onRedeem,
}: {
  reward: InsightPointsPayload["rewards"][number];
  redeeming: boolean;
  onRedeem: () => void;
}) {
  const isAvailable = reward.status === "available";
  const isClaimed = reward.status === "claimed";
  const isLocked = reward.status === "locked";

  return (
    <div
      className="flex flex-col gap-3 rounded-xl border border-(--cf-border) bg-(--cf-surface-muted) p-5"
      style={{ opacity: reward.status === "unavailable" ? 0.5 : 1 }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-[15px] font-semibold text-(--cf-text-1)">{reward.name}</h3>
          <p className="mt-0.5 text-[13px] text-(--cf-text-2)">{reward.description}</p>
        </div>
        <span
          className={
            "shrink-0 rounded-lg px-2.5 py-1 text-[12px] font-semibold " +
            (isAvailable
              ? "bg-(--cf-accent-soft) text-(--cf-accent)"
              : isClaimed
                ? "bg-(--cf-success-soft) text-(--cf-success-text)"
                : "bg-(--cf-surface-strong) text-(--cf-text-soft)")
          }
        >
          {reward.costPoints.toLocaleString()} IP
        </span>
      </div>

      {reward.highlight && (
        <p className="text-[12px] font-medium text-(--cf-accent)">{reward.highlight}</p>
      )}

      {isAvailable && (
        <button
          onClick={onRedeem}
          disabled={redeeming}
          className="cf-btn cf-btn-primary mt-auto w-full rounded-xl text-[14px]"
        >
          {redeeming ? "Redeeming…" : "Redeem"}
        </button>
      )}

      {isClaimed && (
        <div className="mt-auto flex items-center gap-2 text-[13px] text-(--cf-success-text)">
          <Check size={14} />
          Claimed {reward.claimedAt ? formatDate(reward.claimedAt) : ""}
        </div>
      )}

      {isLocked && (
        <div className="mt-auto flex items-center gap-2 text-[13px] text-(--cf-text-soft)">
          <Lock size={14} />
          {reward.pointsRemaining.toLocaleString()} more IP needed
        </div>
      )}

      {reward.status === "unavailable" && reward.unavailableReason && (
        <p className="mt-auto text-[12px] text-(--cf-text-soft)">{reward.unavailableReason}</p>
      )}
    </div>
  );
}

function ReferralSection({ referral }: { referral: InsightPointsPayload["referral"] }) {
  const [copied, setCopied] = useState(false);
  const fullUrl =
    typeof window !== "undefined" ? `${window.location.origin}${referral.path}` : referral.path;

  const handleCopy = () => {
    void navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border border-(--cf-border) bg-(--cf-surface-muted) p-5">
      <div className="mb-3 flex items-center gap-2">
        <Users size={16} className="text-(--cf-accent)" />
        <h3 className="text-[15px] font-semibold text-(--cf-text-1)">
          Give a Friend a Free Week of Pro
        </h3>
      </div>
      <p className="mb-4 text-[13px] text-(--cf-text-2)">
        Share your link to give a friend a free week of Pro access — you&apos;ll both be rewarded when they complete their first learning loop.
      </p>

      <div className="flex items-center gap-2">
        <div className="flex-1 truncate rounded-lg border border-(--cf-border) bg-(--cf-page-bg) px-3 py-2 font-mono text-[13px] text-(--cf-text-2)">
          {fullUrl}
        </div>
        <button
          onClick={handleCopy}
          className={
            "shrink-0 cursor-pointer rounded-lg border border-(--cf-border) px-3 py-2 text-[13px] font-medium transition-colors " +
            (copied
              ? "bg-(--cf-success-soft) text-(--cf-success-text)"
              : "bg-(--cf-surface) text-(--cf-text-1)")
          }
          aria-label="Copy referral link"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 text-center text-[12px]">
        <div>
          <p className="text-[18px] font-bold text-(--cf-text-1)">{referral.pendingInvites}</p>
          <p className="text-(--cf-text-soft)">Pending</p>
        </div>
        <div>
          <p className="text-[18px] font-bold text-(--cf-text-1)">{referral.activatedInvites}</p>
          <p className="text-(--cf-text-soft)">Activated</p>
        </div>
        <div>
          <p className="text-[18px] font-bold text-(--cf-text-1)">{referral.proInvites}</p>
          <p className="text-(--cf-text-soft)">Pro converts</p>
        </div>
      </div>
    </div>
  );
}

export function RewardsPageClient() {
  const { loading, payload, error, redeemingRewardId, redeemMessage, redeemReward, refresh } =
    useInsightPoints();
  const { identity } = useBookViewer();
  const searchRef = useRef<HTMLInputElement | null>(null);

  return (
    <main className="cf-app-shell">
      <TopNav
        name={identity.displayName || "Reader"}
        avatarUrl={identity.avatarDataUrl}
        searchQuery=""
        onSearchChange={() => {}}
        searchInputRef={searchRef}
        showSearch={false}
        logoVariant="dashboard"
      />

      <section className="mx-auto w-full max-w-2xl space-y-8 px-4 pb-28 pt-7 sm:px-6 sm:pt-8 md:pb-24">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-(--cf-text-1)">Rewards</h1>
          <p className="mt-1 text-sm text-(--cf-text-soft)">
            Redeem Insight Points (IP) for bonus books and Pro passes.
          </p>
        </div>

        {/* Loading */}
        {loading && (
          <div className="space-y-4">
            <div className="h-40 animate-pulse rounded-2xl bg-(--cf-surface-strong)" />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="h-36 animate-pulse rounded-xl bg-(--cf-surface-strong)" />
              <div className="h-36 animate-pulse rounded-xl bg-(--cf-surface-strong)" />
            </div>
          </div>
        )}

        {/* Error — never surface the raw server message; route through the
            shared ErrorBanner with safe copy and a soft retry. */}
        {error && (
          <div className="grid min-h-[40vh] place-content-center">
            <ErrorBanner
              className="mx-auto max-w-md"
              title="We couldn't load Rewards"
              message="Something went wrong loading your Insight Points. Please try again."
              onRetry={() => void refresh()}
            />
          </div>
        )}

        {/* Redeem success/error toast */}
        <div aria-live="polite" aria-atomic="true">
          <AnimatePresence>
            {redeemMessage && (
              <motion.div
                role={redeemMessage.tone === "error" ? "alert" : undefined}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={
                  "rounded-xl border p-3 text-center text-[14px] font-medium " +
                  (redeemMessage.tone === "error"
                    ? "border-(--cf-danger-border) bg-(--cf-danger-soft) text-(--cf-danger-text)"
                    : "border-(--cf-accent-border) bg-(--cf-accent-soft) text-(--cf-accent)")
                }
              >
                {redeemMessage.message}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {payload && (
          <>
            {/* Balance */}
            <BalanceHeader summary={payload.summary} />

            {/* Reward Catalog */}
            <section>
              <h2 className="mb-4 text-[13px] font-semibold uppercase tracking-widest text-(--cf-text-soft)">
                Reward Catalog
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {payload.rewards.map((reward) => (
                  <RewardCard
                    key={reward.rewardId}
                    reward={reward}
                    redeeming={redeemingRewardId === reward.rewardId}
                    onRedeem={() => void redeemReward(reward.rewardId)}
                  />
                ))}
              </div>
            </section>

            {/* Ways to Earn */}
            <section>
              <h2 className="mb-4 text-[13px] font-semibold uppercase tracking-widest text-(--cf-text-soft)">
                <Zap size={14} className="mr-1.5 inline" />
                Ways to Earn
              </h2>
              <div className="divide-y divide-(--cf-border) rounded-xl border border-(--cf-border) bg-(--cf-surface-muted)">
                {payload.waysToEarn.map((way) => (
                  <div key={way.label} className="flex items-start justify-between gap-4 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-[14px] font-medium text-(--cf-text-1)">{way.label}</p>
                      <p className="mt-0.5 text-[12px] text-(--cf-text-2)">{way.detail}</p>
                      {way.note && (
                        <p className="mt-0.5 text-[11px] text-(--cf-text-soft)">{way.note}</p>
                      )}
                    </div>
                    <span className="shrink-0 text-[13px] font-semibold tabular-nums text-(--cf-accent)">
                      {way.displayValue}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            {/* Referral */}
            <ReferralSection referral={payload.referral} />

            {/* Recent Activity */}
            {payload.recentTransactions.length > 0 && (
              <section>
                <h2 className="mb-4 text-[13px] font-semibold uppercase tracking-widest text-(--cf-text-soft)">
                  Recent Activity
                </h2>
                <div className="divide-y divide-(--cf-border) rounded-xl border border-(--cf-border) bg-(--cf-surface-muted)">
                  {payload.recentTransactions.map((tx) => (
                    <div key={tx.transactionId} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <p className="text-[14px] font-medium text-(--cf-text-1)">{tx.title}</p>
                        {tx.subtitle && (
                          <p className="mt-0.5 text-[12px] text-(--cf-text-soft)">{tx.subtitle}</p>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <p
                          className={
                            "text-[14px] font-semibold " +
                            (tx.direction === "earn"
                              ? "text-(--cf-success-text)"
                              : tx.direction === "spend"
                                ? "text-(--cf-danger-text)"
                                : "text-(--cf-text-2)")
                          }
                        >
                          {tx.direction === "earn" ? "+" : tx.direction === "spend" ? "-" : ""}
                          {tx.amount}
                        </p>
                        <p className="text-[11px] text-(--cf-text-soft)">{formatDate(tx.createdAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </section>
    </main>
  );
}
