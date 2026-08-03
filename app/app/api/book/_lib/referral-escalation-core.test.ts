import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ESCALATION_MILESTONES,
  REFERRAL_ANNUAL_CAP,
  highestPassedTier,
  resolveMilestoneReward,
  selectNewMilestones,
  type EscalationMilestone,
} from "./referral-escalation-core";

function milestoneAt(activations: number): EscalationMilestone {
  const m = ESCALATION_MILESTONES.find((x) => x.activations === activations);
  assert.ok(m, `milestone ${activations} exists`);
  return m;
}

// H8 — checkReferralEscalation lives in a `server-only` module that cannot be
// imported under `tsx --test`, so the award decision is exercised through the
// pure core helper it delegates to. checkReferralEscalation awards exactly the
// milestones selectNewMilestones returns, so these assertions cover the wiring.

test("a 3rd activation grants the 300 IP mentor-frame milestone", () => {
  const newly = selectNewMilestones(3, 0);
  assert.equal(newly.length, 1, "exactly the 3-activation milestone is newly reached");
  const milestone = newly[0]!;
  assert.equal(milestone.activations, 3);
  assert.equal(milestone.ipBonus, 300);
  assert.equal(milestone.exclusiveReward, "mentor-frame");
  assert.equal(milestone.exclusiveRewardType, "frame");
});

test("fewer than 3 activations grants nothing", () => {
  assert.deepEqual(selectNewMilestones(0, 0), []);
  assert.deepEqual(selectNewMilestones(2, 0), []);
});

test("a milestone is not re-awarded once highestMilestoneReached has passed it", () => {
  // 3rd milestone already recorded → no re-grant on subsequent activations.
  assert.deepEqual(selectNewMilestones(3, 3), []);
  assert.deepEqual(selectNewMilestones(4, 3), []);
});

test("jumping past several tiers grants every newly-reached milestone in order", () => {
  assert.deepEqual(
    selectNewMilestones(5, 0).map((m) => m.activations),
    [3, 5]
  );
  // With the 3-tier already recorded, only the 5-tier is newly reached.
  assert.deepEqual(
    selectNewMilestones(5, 3).map((m) => m.activations),
    [5]
  );
  // Top tier from scratch grants all four.
  assert.deepEqual(
    selectNewMilestones(25, 0).map((m) => m.activations),
    [3, 5, 10, 25]
  );
});

test("the escalation tiers total 4,600 IP and cap at 25 activations", () => {
  const totalIp = ESCALATION_MILESTONES.reduce((sum, m) => sum + m.ipBonus, 0);
  assert.equal(totalIp, 4600);
  assert.equal(REFERRAL_ANNUAL_CAP, 25);
  assert.deepEqual(
    ESCALATION_MILESTONES.map((m) => m.activations),
    [3, 5, 10, 25]
  );
});

test("highestPassedTier returns the largest tier already reached, else 0", () => {
  assert.equal(highestPassedTier(0), 0);
  assert.equal(highestPassedTier(2), 0);
  assert.equal(highestPassedTier(3), 3);
  assert.equal(highestPassedTier(4), 3);
  assert.equal(highestPassedTier(5), 5);
  assert.equal(highestPassedTier(9), 5);
  assert.equal(highestPassedTier(10), 10);
  assert.equal(highestPassedTier(24), 10);
  assert.equal(highestPassedTier(25), 25);
  assert.equal(highestPassedTier(100), 25);
  assert.equal(highestPassedTier(-1), 0);
});

// ── H3 regression: the 10-activation tier must grant a Pro pass to FREE inviters
// (and IP to PRO inviters), not unconditionally award IP. ────────────────────

test("H3: the 10-activation tier is defined with a 30-day Pro pass for free inviters", () => {
  const ten = milestoneAt(10);
  assert.equal(
    ten.proPassDaysForFreeInviter,
    30,
    "the 10-tier must carry an explicit 30-day Pro pass duration, not just a code comment"
  );
  assert.equal(ten.proInviterIPAlternative, 1200);
});

test("H3: a FREE inviter at the 10-tier is paid a 30-day Pro pass and ZERO IP", () => {
  const reward = resolveMilestoneReward(milestoneAt(10), "FREE");
  assert.equal(
    reward.proPassDays,
    30,
    "free inviter must receive the promised 30-day Pro pass (the bug: never granted)"
  );
  assert.equal(
    reward.ipAmount,
    0,
    "free inviter must NOT also receive the 1,200 IP fallback — the pass replaces it"
  );
});

test("H3: a PRO inviter at the 10-tier is paid the IP alternative, no Pro pass", () => {
  const reward = resolveMilestoneReward(milestoneAt(10), "PRO");
  assert.equal(reward.ipAmount, 1200, "pro inviter receives proInviterIPAlternative IP");
  assert.equal(reward.proPassDays, null, "a PRO inviter cannot use a pass");
});

test("H3: ordinary tiers (3/5/25) pay flat ipBonus to both plans, never a Pro pass", () => {
  for (const activations of [3, 5, 25]) {
    const m = milestoneAt(activations);
    for (const plan of ["FREE", "PRO"] as const) {
      const reward = resolveMilestoneReward(m, plan);
      assert.equal(
        reward.ipAmount,
        m.ipBonus,
        `tier ${activations} (${plan}) pays ipBonus`
      );
      assert.equal(reward.proPassDays, null, `tier ${activations} grants no Pro pass`);
    }
  }
});

test("seeding from highestPassedTier(prev) blocks the lump grant yet pays a freshly-crossed tier (B1)", () => {
  // Existing inviter, 25 lifetime activations, field absent: first post-go-live
  // activation makes activatedInvites=26, prev=25 -> seed 25 -> nothing (no lump).
  assert.deepEqual(selectNewMilestones(26, highestPassedTier(25)), []);
  // Existing inviter at 24 crossing to 25 post-go-live: prev=24 -> seed 10 -> only
  // the 25-tier is newly due (NOT 3/5/10, passed pre-go-live).
  assert.deepEqual(
    selectNewMilestones(25, highestPassedTier(24)).map((m) => m.activations),
    [25]
  );
  // Brand-new inviter crossing the first tier: prev=2 -> seed 0 -> 3-tier awarded.
  assert.deepEqual(
    selectNewMilestones(3, highestPassedTier(2)).map((m) => m.activations),
    [3]
  );
});
