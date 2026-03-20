import "server-only";

import { requireUser } from "@/app/app/api/_lib/auth";
import { getBookAnalyticsTableName, getBookTableName } from "@/app/app/api/book/_lib/env";
import { BookApiError } from "@/app/app/api/book/_lib/errors";
import {
  bookOk,
  requireBodyObject,
  requireString,
  withBookApiErrors,
} from "@/app/app/api/book/_lib/http";
import { analyticsTrackFlowPointsTransaction } from "@/app/app/api/book/_lib/analytics-repo";
import { getUserEntitlement } from "@/app/app/api/book/_lib/repo";
import {
  getUserFlowPointsState,
  getUserRewardClaim,
  redeemFlowPointsReward,
} from "@/app/app/api/book/_lib/flow-points-repo";
import {
  getFlowPointsReward,
  type FlowPointsRewardId,
} from "@/app/book/_lib/flow-points-economy";

export const runtime = "nodejs";

function buildRewardMessage(rewardId: FlowPointsRewardId): string {
  switch (rewardId) {
    case "bonus_book_unlock":
      return "Bonus book unlock added. You can start one extra book on the free plan.";
    case "pro_pass_7d":
      return "7-day Pro pass activated.";
    case "pro_pass_30d":
      return "30-day Pro pass activated.";
    default:
      return "Reward redeemed.";
  }
}

export async function POST(req: Request) {
  return withBookApiErrors(req, async () => {
    const user = await requireUser();
    const tableName = await getBookTableName();

    let bodyRaw: unknown;
    try {
      bodyRaw = await req.json();
    } catch {
      bodyRaw = {};
    }
    const body = requireBodyObject(bodyRaw);
    const rewardId = requireString(body.rewardId, "rewardId", {
      minLength: 3,
      maxLength: 64,
    }) as FlowPointsRewardId;
    const reward = getFlowPointsReward(rewardId);
    if (!reward) {
      throw new BookApiError(400, "invalid_reward", "That reward is not available.");
    }

    const [state, entitlement, existingClaim] = await Promise.all([
      getUserFlowPointsState(tableName, user.sub),
      getUserEntitlement(tableName, user.sub),
      getUserRewardClaim(tableName, user.sub, reward.rewardId),
    ]);

    if (existingClaim && reward.oneTimePerUser) {
      throw new BookApiError(409, "reward_already_claimed", "You have already claimed this reward.");
    }

    if (reward.freeOnly && (entitlement?.plan ?? "FREE") === "PRO") {
      throw new BookApiError(
        409,
        "reward_unavailable",
        reward.type === "book_slot"
          ? "Bonus book unlocks are only available on the free plan."
          : "Pro passes are only available while you are on the free plan."
      );
    }

    if (state.points < reward.costPoints) {
      throw new BookApiError(409, "insufficient_points", "You do not have enough Flow Points yet.");
    }

    const passExpiresAt =
      reward.type === "pro_pass" && reward.durationDays
        ? new Date(Date.now() + reward.durationDays * 24 * 60 * 60 * 1000).toISOString()
        : undefined;

    const redemption = await redeemFlowPointsReward(tableName, {
      userId: user.sub,
      rewardId: reward.rewardId,
      costPoints: reward.costPoints,
      metadata: {
        rewardName: reward.name,
      },
      bookSlotDelta: reward.bookSlotDelta,
      passExpiresAt,
    });

    getBookAnalyticsTableName()
      .then((analyticsTable) => {
        if (!analyticsTable) return;
        return analyticsTrackFlowPointsTransaction(analyticsTable, {
          userId: user.sub,
          deltaPoints: -reward.costPoints,
          direction: "spend",
          sourceType: "reward_redemption",
          sourceId: reward.rewardId,
          rewardId: reward.rewardId,
          metadata: {
            rewardName: reward.name,
          },
        });
      })
      .catch(() => {});

    return bookOk({
      ok: true,
      rewardId: reward.rewardId,
      balance: redemption.state.points,
      message: buildRewardMessage(reward.rewardId),
    });
  });
}
