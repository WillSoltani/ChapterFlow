import assert from "node:assert/strict";
import test from "node:test";

import {
  getBadgeName,
  getInsightPointsReward,
} from "./flow-points-economy";

test("reward and badge lookups return canonical display data or null", () => {
  assert.deepEqual(getInsightPointsReward("pro_pass_7d"), {
    rewardId: "pro_pass_7d",
    name: "7-Day Pro Pass",
    description: "Unlock unlimited books and premium reading modes for one week.",
    costPoints: 2400,
    type: "pro_pass",
    durationDays: 7,
    oneTimePerUser: true,
    freeOnly: true,
    highlight: "A short premium sprint so you can feel the full product.",
  });
  assert.equal(
    getInsightPointsReward("missing" as "pro_pass_7d"),
    null
  );

  assert.equal(getBadgeName("first-chapter"), "First Chapter");
  assert.equal(getBadgeName("missing"), null);
});
