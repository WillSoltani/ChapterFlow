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
import { awardFlowPoints, grantProPass } from "@/app/app/api/book/_lib/flow-points-repo";
import { putBadgeAward } from "@/app/app/api/book/_lib/repo";
import {
  ESCALATION_MILESTONES,
  REFERRAL_ANNUAL_CAP,
  highestPassedTier,
  resolveMilestoneReward,
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
    /** IP actually awarded (0 when the reward was a Pro pass). */
    ipBonus: number;
    exclusiveReward: string | null;
    /** Pro-pass duration granted (FREE inviter at the 10-tier), else null. */
    proPassDays: number | null;
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
  // §6.3 — Seed highestMilestoneReached for an inviter whose profile predates the
  // escalation feature (the field is absent). markReferralActivationRewarded just
  // ADD-incremented activatedInvites by exactly 1, so (activatedInvites - 1) is the
  // count BEFORE this activation and highestPassedTier of it is the tier reached
  // pre-go-live. selectNewMilestones then awards ONLY a tier this activation newly
  // crosses — never the whole 3/5/10/25 ladder as a retroactive lump grant to the
  // existing inviter base. A new inviter still earns each tier as they cross it
  // (e.g. 2->3 seeds highestPassedTier(2)=0, so the 3-tier IS awarded); once a tier
  // is awarded the field is persisted and used directly thereafter. Defaulting to 0
  // here would lump-grant every already-passed tier — the bug this fixes.
  const highestMilestoneReached =
    (profile.highestMilestoneReached as number) ??
    highestPassedTier(activatedInvites - 1);
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
    // §6.3 — the 10-activation tier pays a FREE inviter a 30-day Pro pass (NOT IP)
    // and a PRO inviter the IP alternative; every other tier pays flat IP. The
    // branch is the pure, unit-tested resolveMilestoneReward — the part the prior
    // bug got wrong (it unconditionally awarded ipBonus and never granted a pass).
    const reward = resolveMilestoneReward(milestone, inviterPlan);

    // ── Primary reward: IP and/or a Pro pass (exactly one is non-trivial). ──
    let rewardSettled = true;
    let ipActuallyAwarded = 0;
    let proPassGranted: number | null = null;
    let didAwardSomething = false;

    if (reward.ipAmount > 0) {
      // Idempotent via the awardFlowPoints grant key
      // referral_activation_inviter / escalation-<n>.
      const award = await awardFlowPoints(tableName, {
        userId: inviterUserId,
        amount: reward.ipAmount,
        sourceType: "referral_activation_inviter",
        sourceId: `escalation-${milestone.activations}`,
        metadata: {
          milestoneActivations: milestone.activations,
          exclusiveReward: milestone.exclusiveReward,
          inviterPlan,
        },
      });
      // awarded OR duplicate both mean the IP is durably present; only a thrown
      // transient error (awarded=false, reason!=="duplicate") leaves it unsettled.
      rewardSettled = rewardSettled && (award.awarded || award.reason === "duplicate");
      if (award.awarded) {
        ipActuallyAwarded = reward.ipAmount;
        didAwardSomething = true;
      }
    }

    if (reward.proPassDays && reward.proPassDays > 0) {
      // Grant a free Pro pass (no IP spent). Distinct idempotency key from the IP
      // award so a FREE→PRO plan flip between retries can't double-grant.
      const pass = await grantProPass(tableName, {
        userId: inviterUserId,
        durationDays: reward.proPassDays,
        sourceType: "referral_activation_inviter",
        sourceId: `escalation-${milestone.activations}-pro-pass`,
        metadata: {
          milestoneActivations: milestone.activations,
          reward: "30_day_pro_pass",
        },
      });
      // granted is true for applied, duplicate, AND skipped_existing_grant (a
      // stronger grant already protects the user) — all settled. Only a transient
      // error returns granted=false, keeping the tier selectable for retry.
      rewardSettled = rewardSettled && pass.granted;
      // Report the pass in the result ONLY when it was freshly applied (reason
      // null) — a duplicate or a skip (already PRO-or-better) granted nothing new.
      if (pass.granted && pass.reason === null) {
        proPassGranted = reward.proPassDays;
        didAwardSomething = true;
      }
    }

    // Persist the exclusive cosmetic (frame/theme → inventory, badge → badge
    // award). Idempotent; false only on a transient write failure.
    const cosmeticPersisted = await grantEscalationCosmetic(
      tableName,
      inviterUserId,
      milestone,
      now
    );

    // Only advance past this tier once its chosen reward AND cosmetic are durably
    // settled — a transient failure leaves the tier selectable for the next run.
    if (rewardSettled && cosmeticPersisted) {
      highestSettled = Math.max(highestSettled, milestone.activations);
    }

    if (didAwardSomething) {
      result.milestonesAwarded.push({
        activations: milestone.activations,
        ipBonus: ipActuallyAwarded,
        exclusiveReward: milestone.exclusiveReward,
        proPassDays: proPassGranted,
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
