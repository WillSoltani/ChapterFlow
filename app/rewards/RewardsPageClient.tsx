"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Check,
  Gift,
  Lock,
  Sparkles,
  TrendingUp,
  Users,
  Zap,
  Copy,
} from "lucide-react";
import { useFlowPoints, type FlowPointsPayload } from "@/app/book/hooks/useFlowPoints";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function BalanceHeader({ summary }: { summary: FlowPointsPayload["summary"] }) {
  return (
    <div
      className="rounded-2xl p-6 text-center"
      style={{
        background:
          "linear-gradient(135deg, rgba(139,92,246,0.10), rgba(34,211,238,0.08))",
        border: "1px solid var(--border-subtle)",
      }}
    >
      <p
        className="text-[13px] font-medium uppercase tracking-widest mb-1"
        style={{ color: "var(--text-muted)" }}
      >
        Flow Points
      </p>
      <p
        className="text-[48px] font-bold tracking-tight leading-none"
        style={{ fontFamily: "var(--font-display)", color: "var(--text-heading)" }}
      >
        {summary.balance.toLocaleString()}
      </p>
      <div className="mt-4 flex justify-center gap-6 text-[13px]" style={{ color: "var(--text-secondary)" }}>
        <span>
          <TrendingUp size={14} className="inline mr-1 opacity-60" />
          {summary.lifetimeEarned.toLocaleString()} earned
        </span>
        <span>
          <Gift size={14} className="inline mr-1 opacity-60" />
          {summary.lifetimeSpent.toLocaleString()} spent
        </span>
      </div>

      {summary.nextReward && (
        <div className="mt-5">
          <div className="flex items-center justify-between text-[12px] mb-1.5" style={{ color: "var(--text-muted)" }}>
            <span>Next: {summary.nextReward.name}</span>
            <span>{summary.nextReward.progressPercent}%</span>
          </div>
          <div
            className="h-2 rounded-full overflow-hidden"
            style={{ background: "var(--bg-surface-1)" }}
          >
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(summary.nextReward.progressPercent, 100)}%`,
                background: "var(--accent-teal)",
              }}
            />
          </div>
          <p className="mt-1 text-[12px]" style={{ color: "var(--text-muted)" }}>
            {summary.nextReward.pointsRemaining.toLocaleString()} pts to go
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
  reward: FlowPointsPayload["rewards"][number];
  redeeming: boolean;
  onRedeem: () => void;
}) {
  const isAvailable = reward.status === "available";
  const isClaimed = reward.status === "claimed";
  const isLocked = reward.status === "locked";

  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-3"
      style={{
        border: "1px solid var(--border-subtle)",
        background: "var(--bg-surface-1)",
        opacity: reward.status === "unavailable" ? 0.5 : 1,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-[15px] font-semibold" style={{ color: "var(--text-heading)" }}>
            {reward.name}
          </h3>
          <p className="text-[13px] mt-0.5" style={{ color: "var(--text-secondary)" }}>
            {reward.description}
          </p>
        </div>
        <span
          className="shrink-0 rounded-lg px-2.5 py-1 text-[12px] font-semibold"
          style={{
            background: isAvailable
              ? "rgba(34,211,238,0.12)"
              : isClaimed
                ? "rgba(34,197,94,0.12)"
                : "var(--bg-surface-1)",
            color: isAvailable
              ? "var(--accent-teal)"
              : isClaimed
                ? "#22c55e"
                : "var(--text-muted)",
          }}
        >
          {reward.costPoints.toLocaleString()} pts
        </span>
      </div>

      {reward.highlight && (
        <p className="text-[12px] font-medium" style={{ color: "var(--accent-teal)" }}>
          {reward.highlight}
        </p>
      )}

      {isAvailable && (
        <button
          onClick={onRedeem}
          disabled={redeeming}
          className="mt-auto w-full rounded-xl py-2.5 text-[14px] font-semibold text-white transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 cursor-pointer"
          style={{ backgroundColor: "var(--accent-teal)" }}
        >
          {redeeming ? "Redeeming..." : "Redeem"}
        </button>
      )}

      {isClaimed && (
        <div className="mt-auto flex items-center gap-2 text-[13px]" style={{ color: "#22c55e" }}>
          <Check size={14} />
          Claimed {reward.claimedAt ? formatDate(reward.claimedAt) : ""}
        </div>
      )}

      {isLocked && (
        <div className="mt-auto flex items-center gap-2 text-[13px]" style={{ color: "var(--text-muted)" }}>
          <Lock size={14} />
          {reward.pointsRemaining.toLocaleString()} more pts needed
        </div>
      )}

      {reward.status === "unavailable" && reward.unavailableReason && (
        <p className="mt-auto text-[12px]" style={{ color: "var(--text-muted)" }}>
          {reward.unavailableReason}
        </p>
      )}
    </div>
  );
}

function ReferralSection({ referral }: { referral: FlowPointsPayload["referral"] }) {
  const [copied, setCopied] = useState(false);
  const fullUrl = typeof window !== "undefined"
    ? `${window.location.origin}${referral.path}`
    : referral.path;

  const handleCopy = () => {
    void navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="rounded-xl p-5"
      style={{ border: "1px solid var(--border-subtle)", background: "var(--bg-surface-1)" }}
    >
      <div className="flex items-center gap-2 mb-3">
        <Users size={16} style={{ color: "var(--accent-teal)" }} />
        <h3 className="text-[15px] font-semibold" style={{ color: "var(--text-heading)" }}>
          Invite Friends
        </h3>
      </div>
      <p className="text-[13px] mb-4" style={{ color: "var(--text-secondary)" }}>
        Share your link and earn Flow Points when friends join and subscribe.
      </p>

      <div className="flex items-center gap-2">
        <div
          className="flex-1 rounded-lg px-3 py-2 text-[13px] font-mono truncate"
          style={{ background: "var(--bg-base)", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)" }}
        >
          {fullUrl}
        </div>
        <button
          onClick={handleCopy}
          className="shrink-0 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors cursor-pointer"
          style={{
            background: copied ? "rgba(34,197,94,0.12)" : "var(--bg-surface-1)",
            color: copied ? "#22c55e" : "var(--text-heading)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 text-center text-[12px]">
        <div>
          <p className="text-[18px] font-bold" style={{ color: "var(--text-heading)" }}>
            {referral.pendingInvites}
          </p>
          <p style={{ color: "var(--text-muted)" }}>Pending</p>
        </div>
        <div>
          <p className="text-[18px] font-bold" style={{ color: "var(--text-heading)" }}>
            {referral.activatedInvites}
          </p>
          <p style={{ color: "var(--text-muted)" }}>Activated</p>
        </div>
        <div>
          <p className="text-[18px] font-bold" style={{ color: "var(--text-heading)" }}>
            {referral.proInvites}
          </p>
          <p style={{ color: "var(--text-muted)" }}>Pro converts</p>
        </div>
      </div>
    </div>
  );
}

export function RewardsPageClient() {
  const { loading, payload, error, redeemingRewardId, redeemMessage, redeemReward } =
    useFlowPoints();

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-base)" }}>
      {/* Header */}
      <header
        className="sticky top-0 z-30 backdrop-blur-md border-b"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-[14px] font-medium transition-colors hover:text-[--text-heading]"
            style={{ color: "var(--text-secondary)" }}
          >
            <ArrowLeft size={16} />
            Back
          </Link>
          <div className="flex-1" />
          <div className="flex items-center gap-1.5">
            <Sparkles size={16} style={{ color: "var(--accent-teal)" }} />
            <span className="text-[14px] font-semibold" style={{ color: "var(--text-heading)" }}>
              Rewards
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        {/* Loading */}
        {loading && (
          <div className="text-center py-20 text-[14px]" style={{ color: "var(--text-muted)" }}>
            Loading your rewards...
          </div>
        )}

        {/* Error */}
        {error && (
          <div
            className="rounded-xl p-4 text-center text-[14px]"
            style={{
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.2)",
              color: "#ef4444",
            }}
          >
            {error}
          </div>
        )}

        {/* Redeem success/error toast */}
        <AnimatePresence>
          {redeemMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-xl p-3 text-center text-[14px] font-medium"
              style={{
                background: "rgba(34,211,238,0.08)",
                border: "1px solid rgba(34,211,238,0.2)",
                color: "var(--accent-teal)",
              }}
            >
              {redeemMessage}
            </motion.div>
          )}
        </AnimatePresence>

        {payload && (
          <>
            {/* Balance */}
            <BalanceHeader summary={payload.summary} />

            {/* Reward Catalog */}
            <section>
              <h2
                className="text-[13px] font-semibold uppercase tracking-widest mb-4"
                style={{ color: "var(--text-muted)" }}
              >
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
              <h2
                className="text-[13px] font-semibold uppercase tracking-widest mb-4"
                style={{ color: "var(--text-muted)" }}
              >
                <Zap size={14} className="inline mr-1.5" />
                Ways to Earn
              </h2>
              <div
                className="rounded-xl divide-y"
                style={{
                  border: "1px solid var(--border-subtle)",
                  background: "var(--bg-surface-1)",
                }}
              >
                {payload.waysToEarn.map((way, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-[14px] font-medium" style={{ color: "var(--text-heading)" }}>
                        {way.label}
                      </p>
                      {way.note && (
                        <p className="text-[12px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                          {way.note}
                        </p>
                      )}
                    </div>
                    <span
                      className="text-[13px] font-semibold shrink-0"
                      style={{ color: "var(--accent-teal)" }}
                    >
                      +{way.amount}
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
                <h2
                  className="text-[13px] font-semibold uppercase tracking-widest mb-4"
                  style={{ color: "var(--text-muted)" }}
                >
                  Recent Activity
                </h2>
                <div
                  className="rounded-xl divide-y"
                  style={{
                    border: "1px solid var(--border-subtle)",
                    background: "var(--bg-surface-1)",
                    }}
                >
                  {payload.recentTransactions.map((tx) => (
                    <div key={tx.transactionId} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <p className="text-[14px] font-medium" style={{ color: "var(--text-heading)" }}>
                          {tx.title}
                        </p>
                        {tx.subtitle && (
                          <p className="text-[12px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                            {tx.subtitle}
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p
                          className="text-[14px] font-semibold"
                          style={{
                            color:
                              tx.direction === "earn"
                                ? "#22c55e"
                                : tx.direction === "spend"
                                  ? "#ef4444"
                                  : "var(--text-secondary)",
                          }}
                        >
                          {tx.direction === "earn" ? "+" : tx.direction === "spend" ? "-" : ""}
                          {tx.amount}
                        </p>
                        <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                          {formatDate(tx.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
