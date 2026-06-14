import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ESCALATION_MILESTONES,
  REFERRAL_ANNUAL_CAP,
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
