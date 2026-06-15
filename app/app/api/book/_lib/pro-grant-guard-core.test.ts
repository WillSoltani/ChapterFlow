import { test } from "node:test";
import assert from "node:assert/strict";
import { grantUpgradeApplies } from "./pro-grant-guard-core";

const SOON = "2026-06-22T00:00:00.000Z"; // candidate (e.g. +7 days)
const LATER = "2027-06-15T00:00:00.000Z"; // a longer existing grant
const PAST = "2026-01-01T00:00:00.000Z"; // an expired existing grant

test("applies for a free / no-plan user", () => {
  assert.equal(grantUpgradeApplies({}, SOON), true);
  assert.equal(grantUpgradeApplies({ plan: "FREE" }, SOON), true);
});

test("refuses to overwrite an active stripe subscription or an admin grant", () => {
  assert.equal(grantUpgradeApplies({ plan: "PRO", proSource: "stripe" }, SOON), false);
  assert.equal(grantUpgradeApplies({ plan: "PRO", proSource: "admin" }, SOON), false);
});

test("refuses when an existing license/pass lasts longer than the candidate", () => {
  assert.equal(
    grantUpgradeApplies({ plan: "PRO", proSource: "license", licenseExpiresAt: LATER }, SOON),
    false
  );
  assert.equal(
    grantUpgradeApplies({ plan: "PRO", proSource: "flow_points", currentPeriodEnd: LATER }, SOON),
    false
  );
});

test("applies when the candidate extends a shorter or expired grant", () => {
  assert.equal(
    grantUpgradeApplies({ plan: "PRO", proSource: "license", licenseExpiresAt: PAST }, SOON),
    true
  );
  assert.equal(
    grantUpgradeApplies({ plan: "PRO", proSource: "gift_code", currentPeriodEnd: PAST }, SOON),
    true
  );
});

test("NULL-aware: a stored-null expiry carries no constraint (flow_points writes licenseExpiresAt=null)", () => {
  // The regression that broke #66's first fix: a NULL licenseExpiresAt must not
  // block a legitimately-extending gift for a flow_points user.
  assert.equal(
    grantUpgradeApplies(
      { plan: "PRO", proSource: "flow_points", licenseExpiresAt: null, currentPeriodEnd: PAST },
      SOON
    ),
    true
  );
});

test("requires the candidate to outlast BOTH expiry fields", () => {
  // currentPeriodEnd is short but licenseExpiresAt is long → still refuse.
  assert.equal(
    grantUpgradeApplies(
      { plan: "PRO", proSource: "license", licenseExpiresAt: LATER, currentPeriodEnd: PAST },
      SOON
    ),
    false
  );
});
