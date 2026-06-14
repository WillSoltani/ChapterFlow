import "server-only";

// Implements §6.3 — Referral escalation tier milestones.
// Bonuses at 3/5/10/25 activations. Annual cap of 25 per rolling 12 months.
// Total escalation IP: 4,600 across all milestones.

import { GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddbDoc } from "@/app/app/api/_lib/aws";
import {
  bookUserPk,
  inventorySk,
  nowIso,
  referralProfileSk,
} from "@/app/app/api/book/_lib/keys";
import { awardFlowPoints } from "@/app/app/api/book/_lib/flow-points-repo";
import { putBadgeAward } from "@/app/app/api/book/_lib/repo";
import {
  ESCALATION_MILESTONES,
  REFERRAL_ANNUAL_CAP,
  selectNewMilestones,
  type EscalationMilestone,
} from "@/app/app/api/book/_lib/referral-escalation-core";

// Re-export the milestone table, annual cap, and type so any importer of this
// module keeps working now that the definitions live in the (testable) core.
export { ESCALATION_MILESTONES, REFERRAL_ANNUAL_CAP };
export type { EscalationMilestone };

// ── Conditional-write helper (idempotency) ─────────────────────────────────

function isConditionalCheckFailed(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const rec = error as Record<string, unknown>;
  return (
    rec.name === "ConditionalCheckFailedException" ||
    rec.__type === "ConditionalCheckFailedException" ||
    rec.name === "TransactionCanceledException"
  );
}

// ── Persist a milestone's exclusive cosmetic ───────────────────────────────
//
// Frames/themes land in the inventory store (BOOK_USER_INVENTORY, the same shape
// the shop writes — there is no shared grant helper). Badges go through the
// existing putBadgeAward writer. Both writes are idempotent.
//
// Returns true when the cosmetic is durably persisted (freshly written, already
// owned, or none for this tier) and false only on a transient write failure, so
// the caller can avoid recording the tier as reached until the cosmetic lands.
async function grantEscalationCosmetic(
  tableName: string,
  userId: string,
  milestone: EscalationMilestone,
  now: string
): Promise<boolean> {
  const { exclusiveReward, exclusiveRewardType } = milestone;
  if (!exclusiveReward || !exclusiveRewardType) return true; // no cosmetic for this tier

  if (exclusiveRewardType === "badge") {
    try {
      // putBadgeAward returns false when already owned (conditional write); that
      // still means the badge is persisted, so only a thrown error is a failure.
      await putBadgeAward(tableName, {
        userId,
        badgeId: exclusiveReward,
        earnedAt: now,
      });
      return true;
    } catch (error: unknown) {
      console.warn(
        `[referral-escalation] failed to grant badge ${exclusiveReward} to ${userId}:`,
        error
      );
      return false;
    }
  }

  // frame | theme → inventory record (ipCost 0: earned, not purchased).
  try {
    await ddbDoc.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          PK: bookUserPk(userId),
          SK: inventorySk(exclusiveRewardType, exclusiveReward),
          entity: "BOOK_USER_INVENTORY",
          userId,
          itemId: exclusiveReward,
          itemType: exclusiveRewardType,
          acquiredAt: now,
          equipped: false,
          ipCost: 0,
          createdAt: now,
        },
        ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)",
      })
    );
    return true;
  } catch (error: unknown) {
    if (isConditionalCheckFailed(error)) return true; // already owned — idempotent
    console.warn(
      `[referral-escalation] failed to grant ${exclusiveRewardType} ${exclusiveReward} to ${userId}:`,
      error
    );
    return false;
  }
}

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

  // Read current referral profile. ConsistentRead because the caller has just
  // ADD-incremented activatedInvites (markReferralActivationRewarded) and we must
  // observe that write, not a stale eventually-consistent copy — otherwise a
  // milestone reached on this very activation would be missed until the next one.
  const res = await ddbDoc.send(
    new GetCommand({
      TableName: tableName,
      Key: { PK: bookUserPk(inviterUserId), SK: referralProfileSk() },
      ConsistentRead: true,
    })
  );

  const profile = res.Item;
  if (!profile) {
    return { milestonesAwarded: [], capReached: false, rollingYearActivations: 0 };
  }

  const activatedInvites = (profile.activatedInvites as number) ?? 0;
  const highestMilestoneReached = (profile.highestMilestoneReached as number) ?? 0;
  // Default the rolling-window counter to 0 (NOT the lifetime activatedInvites):
  // this feature was unwired until now, so every existing inviter lacks this
  // field, and seeding it from the lifetime total would mark high-volume inviters
  // as already capped on their first run — early-returning before the field is
  // ever initialized, permanently denying them all escalation rewards. Starting
  // at 0 makes the rolling 12-month window begin when the feature went live.
  const rollingYearActivations = (profile.rollingYearActivations as number) ?? 0;
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
      // Window expired — reset the rolling counter and proceed. Milestone
      // selection below is driven by the lifetime activatedInvites /
      // highestMilestoneReached, not this counter, so the reset frees future
      // base-activation tracking without re-triggering the 3/5/10/25 tiers.
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

  // Highest tier fully settled this run: its IP is durably granted (a fresh
  // award OR an idempotent duplicate from a prior run) AND its cosmetic is
  // persisted (or it has none). We only advance highestMilestoneReached to a
  // settled tier, so a milestone whose cosmetic write transiently failed stays
  // selectable and is retried on the next activation (every grant is idempotent).
  let highestSettled = highestMilestoneReached;

  for (const milestone of selectNewMilestones(activatedInvites, highestMilestoneReached)) {
    // Award IP bonus (idempotent via the awardFlowPoints grant key
    // referral_activation_inviter / escalation-<n>).
    const award = await awardFlowPoints(tableName, {
      userId: inviterUserId,
      amount: milestone.ipBonus,
      sourceType: "referral_activation_inviter",
      sourceId: `escalation-${milestone.activations}`,
      metadata: {
        milestoneActivations: milestone.activations,
        exclusiveReward: milestone.exclusiveReward,
        inviterPlan,
      },
    });

    // Persist the exclusive cosmetic (frame/theme → inventory, badge → badge
    // award). Idempotent; false only on a transient write failure.
    const cosmeticPersisted = await grantEscalationCosmetic(
      tableName,
      inviterUserId,
      milestone,
      now
    );

    const ipSettled = award.awarded || award.reason === "duplicate";
    if (ipSettled && cosmeticPersisted) {
      highestSettled = Math.max(highestSettled, milestone.activations);
    }

    if (award.awarded) {
      result.milestonesAwarded.push({
        activations: milestone.activations,
        ipBonus: milestone.ipBonus,
        exclusiveReward: milestone.exclusiveReward,
      });
    }
  }

  // Advance highestMilestoneReached monotonically and atomically. The
  // ConditionExpression makes the write a no-op when a concurrent activation has
  // already recorded an equal/higher tier, so two invitees activating the same
  // inviter at once cannot clobber each other's progress with a stale read.
  if (highestSettled > highestMilestoneReached) {
    await ddbDoc
      .send(
        new UpdateCommand({
          TableName: tableName,
          Key: { PK: bookUserPk(inviterUserId), SK: referralProfileSk() },
          UpdateExpression: "SET highestMilestoneReached = :hm, updatedAt = :now",
          ConditionExpression:
            "attribute_not_exists(highestMilestoneReached) OR highestMilestoneReached < :hm",
          ExpressionAttributeValues: { ":hm": highestSettled, ":now": now },
        })
      )
      .catch((error: unknown) => {
        if (!isConditionalCheckFailed(error)) throw error; // benign: a concurrent higher write won
      });
  }

  return result;
}
