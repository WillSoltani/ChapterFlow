import "server-only";

import { requireUser } from "@/app/app/api/_lib/auth";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import { bookOk, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { getUserEntitlement } from "@/app/app/api/book/_lib/repo";
import {
  getOrCreateUserReferralProfile,
  getUserFlowPointsState,
  getUserRewardClaim,
  listRecentFlowPointsLedger,
} from "@/app/app/api/book/_lib/flow-points-repo";
import {
  FLOW_POINTS_EARNING_RULES,
  FLOW_POINTS_REWARDS,
  getFlowPointsSourceSubtitle,
  getFlowPointsSourceTitle,
} from "@/app/book/_lib/flow-points-economy";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return withBookApiErrors(request, async () => {
    const user = await requireUser();
    const tableName = await getBookTableName();

    const [state, entitlement, referralProfile, recentTransactions] = await Promise.all([
      getUserFlowPointsState(tableName, user.sub),
      getUserEntitlement(tableName, user.sub),
      getOrCreateUserReferralProfile(tableName, user.sub),
      listRecentFlowPointsLedger(tableName, user.sub, 8),
    ]);

    const rewardClaims = await Promise.all(
      FLOW_POINTS_REWARDS.map((reward) => getUserRewardClaim(tableName, user.sub, reward.rewardId))
    );
    const rewardClaimMap = new Map(
      rewardClaims
        .filter((claim): claim is NonNullable<typeof claim> => Boolean(claim))
        .map((claim) => [claim.rewardId, claim])
    );

    const rewards = FLOW_POINTS_REWARDS.map((reward) => {
      const claim = rewardClaimMap.get(reward.rewardId) ?? null;
      const isPro = (entitlement?.plan ?? "FREE") === "PRO";
      const unavailableReason =
        claim
          ? null
          : reward.type === "book_slot" && isPro
            ? "Pro already includes unlimited books."
            : reward.freeOnly && isPro
              ? "Available once your account is back on the free plan."
              : null;
      const pointsRemaining = Math.max(0, reward.costPoints - state.points);
      const status = claim
        ? "claimed"
        : unavailableReason
          ? "unavailable"
          : pointsRemaining === 0
            ? "available"
            : "locked";

      return {
        ...reward,
        status,
        pointsRemaining,
        claimedAt: claim?.claimedAt ?? null,
        unavailableReason,
      };
    });

    const nextReward =
      rewards.find((reward) => reward.status !== "claimed") ?? null;

    return bookOk({
      summary: {
        balance: state.points,
        lifetimeEarned: state.lifetimeEarned ?? 0,
        lifetimeSpent: state.lifetimeSpent ?? 0,
        rewardReadyCount: rewards.filter((reward) => reward.status === "available").length,
        nextReward: nextReward
          ? {
              rewardId: nextReward.rewardId,
              name: nextReward.name,
              costPoints: nextReward.costPoints,
              pointsRemaining: nextReward.pointsRemaining,
              progressPercent:
                nextReward.costPoints > 0
                  ? Math.max(
                      0,
                      Math.min(100, Math.round((state.points / nextReward.costPoints) * 100))
                    )
                  : 0,
            }
          : null,
      },
      rewards,
      recentTransactions: recentTransactions.map((entry) => ({
        transactionId: entry.transactionId,
        direction: entry.direction,
        amount: entry.amount,
        sourceType: entry.sourceType,
        rewardId: entry.rewardId ?? null,
        title: getFlowPointsSourceTitle(entry.sourceType),
        subtitle: getFlowPointsSourceSubtitle(entry.sourceType, entry.metadata ?? null),
        createdAt: entry.createdAt,
      })),
      referral: {
        code: referralProfile.inviteCode,
        path: `/ref/${encodeURIComponent(referralProfile.inviteCode)}`,
        pendingInvites: referralProfile.pendingInvites,
        activatedInvites: referralProfile.activatedInvites,
        proInvites: referralProfile.proInvites,
        activationPointsEarned: referralProfile.activationPointsEarned,
        proPointsEarned: referralProfile.proPointsEarned,
      },
      waysToEarn: FLOW_POINTS_EARNING_RULES.map((rule) => ({
        label: rule.label,
        amount: rule.amount,
        note: rule.note,
      })),
    });
  });
}
