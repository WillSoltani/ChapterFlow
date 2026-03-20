"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Coins, Copy, Gift, Sparkles, Users } from "lucide-react";
import { Button } from "@/app/book/components/ui/Button";
import { Card } from "@/app/book/components/ui/Card";
import type { FlowPointsPayload } from "@/app/book/hooks/useFlowPoints";

type FlowPointsSectionProps = {
  loading: boolean;
  payload: FlowPointsPayload | null;
  error: string | null;
  redeemingRewardId: string | null;
  message: string | null;
  onRedeem: (rewardId: string) => Promise<string | null>;
};

function formatPoints(value: number): string {
  return new Intl.NumberFormat().format(Math.max(0, Math.floor(value)));
}

function formatRelativeTime(value: string): string {
  const deltaMs = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.floor(deltaMs / 60000));
  if (minutes < 60) return minutes <= 1 ? "Just now" : `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "1 day ago" : `${days} days ago`;
}

export function FlowPointsSection({
  loading,
  payload,
  error,
  redeemingRewardId,
  message,
  onRedeem,
}: FlowPointsSectionProps) {
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  const featuredReward = useMemo(() => {
    if (!payload) return null;
    return (
      payload.rewards.find((reward) => reward.status === "available") ??
      payload.rewards.find((reward) => reward.status === "locked") ??
      payload.rewards[0] ??
      null
    );
  }, [payload]);

  const shareLink = useMemo(() => {
    if (!payload) return "";
    if (typeof window === "undefined") return payload.referral.path;
    return `${window.location.origin}${payload.referral.path}`;
  }, [payload]);

  async function handleCopyInvite() {
    if (!shareLink) return;
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopyMessage("Invite link copied");
      window.setTimeout(() => setCopyMessage(null), 1800);
    } catch {
      setCopyMessage("Copy failed");
      window.setTimeout(() => setCopyMessage(null), 1800);
    }
  }

  if (loading && !payload) {
    return (
      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="cf-panel rounded-3xl p-5">
          <div className="h-4 w-28 rounded-full bg-(--cf-surface-muted)" />
          <div className="mt-4 h-10 w-36 rounded-2xl bg-(--cf-surface-muted)" />
          <div className="mt-4 h-2 w-full rounded-full bg-(--cf-surface-muted)" />
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="h-28 rounded-2xl bg-(--cf-surface-muted)" />
            <div className="h-28 rounded-2xl bg-(--cf-surface-muted)" />
            <div className="h-28 rounded-2xl bg-(--cf-surface-muted)" />
          </div>
        </div>
        <div className="cf-panel rounded-3xl p-5">
          <div className="h-4 w-32 rounded-full bg-(--cf-surface-muted)" />
          <div className="mt-4 h-24 rounded-2xl bg-(--cf-surface-muted)" />
          <div className="mt-4 h-36 rounded-2xl bg-(--cf-surface-muted)" />
        </div>
      </div>
    );
  }

  if (!payload) {
    return (
      <Card>
        <div className="flex items-start gap-3">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-(--cf-danger-border) bg-(--cf-danger-soft) text-(--cf-danger-text)">
            <Coins className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-(--cf-text-1)">Flow Points unavailable</p>
            <p className="mt-1 text-sm leading-relaxed text-(--cf-text-3)">
              {error ?? "The rewards system could not be loaded right now."}
            </p>
          </div>
        </div>
      </Card>
    );
  }

  const progressPercent = payload.summary.nextReward?.progressPercent ?? 0;

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-2xl font-semibold text-(--cf-text-1)">Flow Points</h2>
          <p className="mt-1 text-sm text-(--cf-text-3)">
            Meaningful progress, visible rewards, and a cleaner path into premium value.
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <Card className="overflow-hidden border-(--cf-accent-border) bg-[linear-gradient(135deg,var(--cf-accent-soft),var(--cf-surface))]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-(--cf-text-soft)">Balance</p>
              <div className="mt-3 flex items-end gap-2">
                <span className="text-4xl font-semibold tracking-tight text-(--cf-text-1)">
                  {formatPoints(payload.summary.balance)}
                </span>
                <span className="pb-1 text-sm font-medium text-(--cf-text-3)">Flow Points</span>
              </div>
              <p className="mt-2 max-w-xl text-sm leading-6 text-(--cf-text-2)">
                Flow Points reward learning milestones that are hard to fake and useful to the business: setup, quiz mastery, completed books, approved scenarios, and real referrals.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1 rounded-full border border-(--cf-border) bg-(--cf-surface) px-3 py-1 text-xs font-semibold text-(--cf-text-2)">
                <Sparkles className="h-3 w-3 text-(--cf-accent)" />
                {formatPoints(payload.summary.lifetimeEarned)} earned
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-(--cf-border) bg-(--cf-surface) px-3 py-1 text-xs font-semibold text-(--cf-text-2)">
                <Gift className="h-3 w-3 text-(--cf-warning-text)" />
                {formatPoints(payload.summary.lifetimeSpent)} redeemed
              </span>
            </div>
          </div>

          {payload.summary.nextReward ? (
            <div className="mt-5 rounded-[24px] border border-(--cf-border) bg-(--cf-surface) p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-(--cf-text-1)">
                    Next reward: {payload.summary.nextReward.name}
                  </p>
                  <p className="mt-1 text-sm text-(--cf-text-3)">
                    {payload.summary.nextReward.pointsRemaining > 0
                      ? `${formatPoints(payload.summary.nextReward.pointsRemaining)} points to go`
                      : "Ready to redeem"}
                  </p>
                </div>
                <span className="rounded-full border border-(--cf-accent-border) bg-(--cf-accent-soft) px-3 py-1 text-xs font-semibold text-(--cf-info-text)">
                  {formatPoints(payload.summary.nextReward.costPoints)} pts
                </span>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-(--cf-border)">
                <div
                  className="h-full rounded-full bg-linear-to-r from-(--cf-accent) to-(--cf-accent-strong)"
                  style={{ width: `${Math.max(4, progressPercent)}%` }}
                />
              </div>
            </div>
          ) : null}

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {payload.waysToEarn.slice(0, 3).map((item) => (
              <div
                key={item.label}
                className="rounded-[22px] border border-(--cf-border) bg-(--cf-surface) p-4"
              >
                <p className="text-sm font-semibold text-(--cf-text-1)">{item.label}</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-(--cf-text-1)">
                  {item.amount > 0 ? `+${formatPoints(item.amount)}` : "Varies"}
                </p>
                <p className="mt-2 text-sm leading-6 text-(--cf-text-3)">{item.note}</p>
              </div>
            ))}
          </div>

          {message ? (
            <div className="mt-4 rounded-2xl border border-(--cf-success-border) bg-(--cf-success-soft) px-4 py-3 text-sm text-(--cf-success-text)">
              {message}
            </div>
          ) : null}
        </Card>

        <div className="space-y-4">
          <Card>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-(--cf-text-soft)">Featured reward</p>
                <h3 className="mt-2 text-xl font-semibold tracking-tight text-(--cf-text-1)">
                  {featuredReward?.name ?? "Rewards"}
                </h3>
                <p className="mt-2 text-sm leading-6 text-(--cf-text-2)">
                  {featuredReward?.description ??
                    "Redeem Flow Points for extra access without flattening the value of Pro."}
                </p>
              </div>
              {featuredReward ? (
                <span className="rounded-full border border-(--cf-warning-border) bg-(--cf-warning-soft) px-3 py-1 text-xs font-semibold text-(--cf-warning-text)">
                  {formatPoints(featuredReward.costPoints)} pts
                </span>
              ) : null}
            </div>

            {featuredReward ? (
              <>
                <p className="mt-4 text-sm leading-6 text-(--cf-text-3)">{featuredReward.highlight}</p>
                <div className="mt-4 space-y-2">
                  {payload.rewards.map((reward) => (
                    <div
                      key={reward.rewardId}
                      className="flex items-center justify-between rounded-2xl border border-(--cf-border) bg-(--cf-surface-muted) px-3.5 py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-(--cf-text-1)">{reward.name}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.14em] text-(--cf-text-soft)">
                          {reward.status === "claimed"
                            ? "Claimed"
                            : reward.status === "available"
                              ? "Ready now"
                              : reward.unavailableReason
                                ? "Unavailable"
                                : `${formatPoints(reward.pointsRemaining)} left`}
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-(--cf-accent)">
                        {formatPoints(reward.costPoints)} pts
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-4">
                  <Button
                    variant={featuredReward.status === "available" ? "primary" : "secondary"}
                    onClick={() => void onRedeem(featuredReward.rewardId)}
                    disabled={featuredReward.status !== "available" || redeemingRewardId === featuredReward.rewardId}
                    fullWidth
                  >
                    {redeemingRewardId === featuredReward.rewardId
                      ? "Redeeming..."
                      : featuredReward.status === "available"
                        ? "Redeem reward"
                        : featuredReward.status === "claimed"
                          ? "Already claimed"
                          : featuredReward.unavailableReason
                            ? "Unavailable right now"
                            : `Need ${formatPoints(featuredReward.pointsRemaining)} more`}
                  </Button>
                </div>
              </>
            ) : null}
          </Card>

          <Card>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-(--cf-text-soft)">Invite and earn</p>
                <h3 className="mt-2 text-xl font-semibold tracking-tight text-(--cf-text-1)">Quality referrals only</h3>
                <p className="mt-2 text-sm leading-6 text-(--cf-text-2)">
                  Invites pay in stages: activation first, then the bigger reward only if the referred user becomes Pro.
                </p>
              </div>
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-(--cf-border) bg-(--cf-surface-muted) text-(--cf-text-2)">
                <Users className="h-4 w-4" />
              </span>
            </div>

            <div className="mt-4 rounded-[22px] border border-(--cf-border) bg-(--cf-surface-muted) p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-(--cf-text-soft)">Invite code</p>
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="text-lg font-semibold tracking-[0.16em] text-(--cf-text-1)">
                  {payload.referral.code}
                </span>
                <Button variant="secondary" size="sm" onClick={handleCopyInvite}>
                  <Copy className="h-3.5 w-3.5" />
                  Copy link
                </Button>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <div className="rounded-2xl border border-(--cf-border) bg-(--cf-surface) px-3 py-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-(--cf-text-soft)">Pending</p>
                  <p className="mt-1 text-lg font-semibold text-(--cf-text-1)">{payload.referral.pendingInvites}</p>
                </div>
                <div className="rounded-2xl border border-(--cf-border) bg-(--cf-surface) px-3 py-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-(--cf-text-soft)">Active</p>
                  <p className="mt-1 text-lg font-semibold text-(--cf-text-1)">{payload.referral.activatedInvites}</p>
                </div>
                <div className="rounded-2xl border border-(--cf-border) bg-(--cf-surface) px-3 py-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-(--cf-text-soft)">Pro</p>
                  <p className="mt-1 text-lg font-semibold text-(--cf-text-1)">{payload.referral.proInvites}</p>
                </div>
              </div>
              {copyMessage ? (
                <p className="mt-3 text-xs font-medium text-(--cf-accent)">{copyMessage}</p>
              ) : null}
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-(--cf-text-soft)">Recent points</p>
                <h3 className="mt-2 text-xl font-semibold tracking-tight text-(--cf-text-1)">Latest movement</h3>
              </div>
              <ArrowRight className="h-4 w-4 text-(--cf-text-soft)" />
            </div>
            <div className="mt-4 space-y-3">
              {payload.recentTransactions.length > 0 ? (
                payload.recentTransactions.map((entry) => (
                  <div
                    key={entry.transactionId}
                    className="flex items-start justify-between gap-3 rounded-2xl border border-(--cf-border) bg-(--cf-surface-muted) px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-(--cf-text-1)">{entry.title}</p>
                      {entry.subtitle ? (
                        <p className="mt-1 text-sm text-(--cf-text-3)">{entry.subtitle}</p>
                      ) : null}
                      <p className="mt-1 text-xs uppercase tracking-[0.14em] text-(--cf-text-soft)">
                        {formatRelativeTime(entry.createdAt)}
                      </p>
                    </div>
                    <span
                      className={[
                        "shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold",
                        entry.direction === "spend"
                          ? "border border-(--cf-danger-border) bg-(--cf-danger-soft) text-(--cf-danger-text)"
                          : "border border-(--cf-success-border) bg-(--cf-success-soft) text-(--cf-success-text)",
                      ].join(" ")}
                    >
                      {entry.direction === "spend" ? "-" : "+"}
                      {formatPoints(entry.amount)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm leading-6 text-(--cf-text-3)">
                  Your Flow Points history will appear here as you complete milestones.
                </p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}
