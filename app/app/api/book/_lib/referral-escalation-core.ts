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
