/**
 * Pure referral-escalation tier logic (§6.3) — no I/O, so it is unit-testable.
 *
 * referral-escalation.ts (which is `server-only`, and therefore cannot be
 * imported from a test under `tsx --test`) gathers the inviter's state from
 * DynamoDB and calls selectNewMilestones to decide which milestones to award.
 *
 * Bonuses at 3/5/10/25 activations. Annual cap of 25 per rolling 12 months.
 * Total escalation IP: 4,600 across all milestones.
 */

// ── Escalation tier definitions (§6.3 amended) ─────────────────────────────

export type EscalationMilestone = {
  activations: number;
  ipBonus: number;
  /**
   * 30-Day Pro Pass for FREE inviters at the 10-activation tier. When set, a FREE
   * inviter receives a Pro pass of this many days INSTEAD OF ipBonus IP, while a
   * PRO inviter (who can't use a pass) receives proInviterIPAlternative IP. Tiers
   * without this field always pay out ipBonus regardless of plan.
   */
  proPassDaysForFreeInviter?: number;
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
    // ipBonus is the FREE-inviter IP fallback only — a FREE inviter is paid in a
    // 30-Day Pro Pass (proPassDaysForFreeInviter), NOT IP. resolveMilestoneReward
    // is the single source of truth for which of these actually pays out.
    ipBonus: 1200,
    proPassDaysForFreeInviter: 30, // 30-Day Pro Pass for a free inviter
    proInviterIPAlternative: 1200, // …or 1,200 IP for a pro inviter (can't use a pass)
    exclusiveReward: null,
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

/**
 * Given the inviter's current activation count and the highest milestone already
 * rewarded, return the milestones that are newly reached (and therefore due to be
 * awarded now). Pure and idempotent: a milestone already at/below
 * highestMilestoneReached is never returned again.
 */
export function selectNewMilestones(
  activatedInvites: number,
  highestMilestoneReached: number
): EscalationMilestone[] {
  return ESCALATION_MILESTONES.filter(
    (milestone) =>
      activatedInvites >= milestone.activations &&
      highestMilestoneReached < milestone.activations
  );
}

/**
 * The highest escalation tier already reached at a given lifetime activation count
 * — the largest milestone.activations <= activatedInvites, or 0 if none. Used to
 * seed highestMilestoneReached for inviters whose profile predates the escalation
 * feature (the field is absent), so only tiers crossed AFTER go-live pay out and
 * the installed base never receives a retroactive lump grant.
 */
export function highestPassedTier(activatedInvites: number): number {
  let highest = 0;
  for (const milestone of ESCALATION_MILESTONES) {
    if (activatedInvites >= milestone.activations) {
      highest = milestone.activations;
    }
  }
  return highest;
}

/**
 * What a milestone actually pays out, given the inviter's plan. Pure so the
 * branch — the part the previous bug got wrong — is unit-tested without DynamoDB.
 *
 * Most tiers pay `ipBonus` IP regardless of plan. The 10-activation tier is the
 * exception (§6.3): a FREE inviter is rewarded with a 30-day Pro pass (and NO IP,
 * since a pass is the headline reward); a PRO inviter — who already has Pro and
 * can't use a pass — gets `proInviterIPAlternative` IP instead. Exactly one of
 * `ipAmount > 0` / `proPassDays != null` is the chosen reward; cosmetics are
 * orthogonal and handled separately by the caller.
 */
export type MilestoneReward = {
  /** IP to award (0 when the reward is a Pro pass instead). */
  ipAmount: number;
  /** Pro-pass duration in days, or null when the reward is IP. */
  proPassDays: number | null;
};

export function resolveMilestoneReward(
  milestone: EscalationMilestone,
  inviterPlan: "FREE" | "PRO"
): MilestoneReward {
  // Pro-pass tier: split FREE (pass) vs PRO (IP alternative).
  if (milestone.proPassDaysForFreeInviter && milestone.proPassDaysForFreeInviter > 0) {
    if (inviterPlan === "FREE") {
      return { ipAmount: 0, proPassDays: milestone.proPassDaysForFreeInviter };
    }
    // PRO inviter: award the explicit alternative if set, else fall back to ipBonus.
    return {
      ipAmount: milestone.proInviterIPAlternative ?? milestone.ipBonus,
      proPassDays: null,
    };
  }
  // Ordinary tier: flat IP for everyone.
  return { ipAmount: milestone.ipBonus, proPassDays: null };
}
