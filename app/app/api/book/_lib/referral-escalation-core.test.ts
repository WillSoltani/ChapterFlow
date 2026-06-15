import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ESCALATION_MILESTONES,
  REFERRAL_ANNUAL_CAP,
  highestPassedTier,
  selectNewMilestones,
} from "./referral-escalation-core";

// H8 — checkReferralEscalation lives in a `server-only` module that cannot be
// imported under `tsx --test`, so the award decision is exercised through the
// pure core helper it delegates to. checkReferralEscalation awards exactly the
// milestones selectNewMilestones returns, so these assertions cover the wiring.

test("a 3rd activation grants the 300 IP mentor-frame milestone", () => {
  const newly = selectNewMilestones(3, 0);
  assert.equal(newly.length, 1, "exactly the 3-activation milestone is newly reached");
  const milestone = newly[0];
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
