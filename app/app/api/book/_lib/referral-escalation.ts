import "server-only";

// Implements §6.3 — Referral escalation tier milestones.
// Bonuses at 3/5/10/25 activations. Annual cap of 25 per rolling 12 months.
// Total escalation IP: 4,600 across all milestones.

import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddbDoc } from "@/app/app/api/_lib/aws";
import {
  bookUserPk,
  nowIso,
  referralProfileSk,
} from "@/app/app/api/book/_lib/keys";
import { awardFlowPoints } from "@/app/app/api/book/_lib/flow-points-repo";

// ── Escalation tier definitions (§6.3 amended) ─────────────────────────────

export type EscalationMilestone = {
  activations: number;
  ipBonus: number;
  /** IP for Pro inviters at 10-activation tier (instead of Pro pass) */
  proInviterIPAlternative?: number;
  exclusiveReward: string | null;
  exclusiveRewardType: "frame" | "theme" | "badge" | null;
};

export const ESCALATION_MILESTONES: ReadonlyArray<EscalationMilestone> = [
  {
    activations: 3,
    ipBonus: 300,
    exclusiveReward: "mentor-frame",
    exclusiveRewardType: "frame",
  },
  {
    activations: 5,
    ipBonus: 600,
    exclusiveReward: "meridian-theme",
    exclusiveRewardType: "theme",
  },
  {
    activations: 10,
    ipBonus: 1200,
    proInviterIPAlternative: 1200,
    exclusiveReward: null, // 30-Day Pro Pass for free inviter, or 1,200 IP for Pro inviter
    exclusiveRewardType: null,
  },
  {
    activations: 25,
    ipBonus: 2500,
    exclusiveReward: "advocate-badge",
    exclusiveRewardType: "badge",
  },
];

export const REFERRAL_ANNUAL_CAP = 25;

// ── Check and award escalation milestones ───────────────────────────────────

export type EscalationResult = {
  milestonesAwarded: Array<{
    activations: number;
    ipBonus: number;
    exclusiveReward: string | null;
  }>;
  capReached: boolean;
  rollingYearActivations: number;
};

/**
 * Called after a referral activation is recorded. Checks if the inviter
 * has hit any new escalation milestones and awards IP + exclusive items.
 */
export async function checkReferralEscalation(
  tableName: string,
  inviterUserId: string,
  inviterPlan: "FREE" | "PRO"
): Promise<EscalationResult> {
  const now = nowIso();

  // Read current referral profile
  const res = await ddbDoc.send(
    new GetCommand({
      TableName: tableName,
      Key: { PK: bookUserPk(inviterUserId), SK: referralProfileSk() },
    })
  );

  const profile = res.Item;
  if (!profile) {
    return { milestonesAwarded: [], capReached: false, rollingYearActivations: 0 };
  }

  const activatedInvites = (profile.activatedInvites as number) ?? 0;
  const highestMilestoneReached = (profile.highestMilestoneReached as number) ?? 0;
  const rollingYearActivations = (profile.rollingYearActivations as number) ?? activatedInvites;
  const capWindowStart = (profile.capWindowStart as string) ?? now;

  // Check annual cap (§6.3)
  const windowStart = new Date(capWindowStart);
  const yearLater = new Date(windowStart.getTime() + 365 * 24 * 60 * 60 * 1000);
  const capReached = rollingYearActivations >= REFERRAL_ANNUAL_CAP;

  if (capReached) {
    // If past the window, reset
    if (new Date() > yearLater) {
      await ddbDoc.send(
        new UpdateCommand({
          TableName: tableName,
          Key: { PK: bookUserPk(inviterUserId), SK: referralProfileSk() },
          UpdateExpression: "SET rollingYearActivations = :zero, capWindowStart = :now, updatedAt = :now",
          ExpressionAttributeValues: { ":zero": 0, ":now": now },
        })
      );
      // Proceed with reset counts — will check milestones with activation=1
    } else {
      return { milestonesAwarded: [], capReached: true, rollingYearActivations };
    }
  }

  // Track rolling year activation
  await ddbDoc.send(
    new UpdateCommand({
      TableName: tableName,
      Key: { PK: bookUserPk(inviterUserId), SK: referralProfileSk() },
      UpdateExpression:
        "SET capWindowStart = if_not_exists(capWindowStart, :now), updatedAt = :now ADD rollingYearActivations :one",
      ExpressionAttributeValues: { ":now": now, ":one": 1 },
    })
  );

  // Check escalation milestones
  const result: EscalationResult = {
    milestonesAwarded: [],
    capReached: false,
    rollingYearActivations: rollingYearActivations + 1,
  };

  for (const milestone of ESCALATION_MILESTONES) {
    if (
      activatedInvites >= milestone.activations &&
      highestMilestoneReached < milestone.activations
    ) {
      // Award IP bonus
      const ipAmount = milestone.ipBonus;
      const award = await awardFlowPoints(tableName, {
        userId: inviterUserId,
        amount: ipAmount,
        sourceType: "referral_activation_inviter",
        sourceId: `escalation-${milestone.activations}`,
        metadata: {
          milestoneActivations: milestone.activations,
          exclusiveReward: milestone.exclusiveReward,
          inviterPlan,
        },
      });

      if (award.awarded) {
        result.milestonesAwarded.push({
          activations: milestone.activations,
          ipBonus: ipAmount,
          exclusiveReward: milestone.exclusiveReward,
        });
      }
    }
  }

  // Update highest milestone reached
  if (result.milestonesAwarded.length > 0) {
    const newHighest = Math.max(
      highestMilestoneReached,
      ...result.milestonesAwarded.map((m) => m.activations)
    );
    await ddbDoc.send(
      new UpdateCommand({
        TableName: tableName,
        Key: { PK: bookUserPk(inviterUserId), SK: referralProfileSk() },
        UpdateExpression: "SET highestMilestoneReached = :hm, updatedAt = :now",
        ExpressionAttributeValues: { ":hm": newHighest, ":now": now },
      })
    );
  }

  return result;
}
