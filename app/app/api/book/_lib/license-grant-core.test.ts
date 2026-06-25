// Regression coverage for the license leg of the pro-grant guard.
//
// Background: gift-claim and redeemFlowPointsReward already build their write
// condition from the SHARED grantUpgradeConditionExpression, but redeemLicenseKey
// (repo.ts) kept the old stripe-only guard
//   "attribute_not_exists(proSource) OR proSource <> :stripeSource"
// so a license redemption could silently shorten/destroy a LONGER paid window: a
// 12-month license overwritten by a redeemed 1-month promo, an open-ended admin comp
// turned into a time-limited license, or a longer flow_points/gift pass lost. The fix
// routes redeemLicenseKey through buildLicenseEntitlementGrant() (license-grant-core),
// which uses the shared guard and clears the orthogonal currentPeriodEnd.
//
// redeemLicenseKey lives in repo.ts, which imports `server-only` (via aws.ts) and so
// cannot be imported by `tsx --test`; the pure builder is the testable seam. The
// condition↔spec equivalence is proven exhaustively in pro-grant-guard-condition.test
// for any expiry ref, so here we (1) assert the builder actually wires the shared
// guard (would fail on the old stripe-only condition) and clears currentPeriodEnd,
// and (2) spell out the license-direction money-path scenarios against the spec.

import { test } from "node:test";
import assert from "node:assert/strict";
import { buildLicenseEntitlementGrant } from "./license-grant-core";
import {
  grantUpgradeApplies,
  grantUpgradeConditionExpression,
  type ExistingGrant,
} from "./pro-grant-guard-core";

const PARAMS = {
  code: "CF-AAAA-BBBB-CCCC",
  expiresAt: "2027-06-15T00:00:00.000Z",
  now: "2026-06-15T00:00:00.000Z",
  defaultSlots: 2,
};

test("builder wires the SHARED pro-grant guard, not the old stripe-only condition", () => {
  const grant = buildLicenseEntitlementGrant(PARAMS);

  // The decisive regression: the license write must use the shared guard keyed off
  // :expiresAt. On the pre-fix code this was
  // "attribute_not_exists(proSource) OR proSource <> :stripeSource".
  assert.equal(
    grant.ConditionExpression,
    grantUpgradeConditionExpression(":expiresAt")
  );
  assert.notEqual(
    grant.ConditionExpression,
    "attribute_not_exists(proSource) OR proSource <> :stripeSource"
  );

  // Guard placeholders the condition references must all be supplied.
  assert.equal(grant.ExpressionAttributeNames["#plan"], "plan");
  assert.equal(grant.ExpressionAttributeValues[":proPlan"], "PRO");
  assert.equal(grant.ExpressionAttributeValues[":stripeSource"], "stripe");
  assert.equal(grant.ExpressionAttributeValues[":adminSource"], "admin");
  assert.equal(grant.ExpressionAttributeValues[":nullType"], "NULL");
});

test("builder writes a license grant and clears the orthogonal currentPeriodEnd", () => {
  const grant = buildLicenseEntitlementGrant(PARAMS);
  const update = grant.UpdateExpression;

  assert.match(update, /proSource = :licenseSource/);
  assert.match(update, /licenseExpiresAt = :expiresAt/);
  // Clearing currentPeriodEnd is what stops a stale (longer) flow_points/gift period
  // from being ignored-but-resurrectable once proSource flips to "license".
  assert.match(update, /currentPeriodEnd = :nullValue/);
  assert.match(update, /freeBookSlots = if_not_exists\(freeBookSlots, :defaultSlots\)/);

  assert.equal(grant.ExpressionAttributeValues[":licenseSource"], "license");
  assert.equal(grant.ExpressionAttributeValues[":pro"], "PRO");
  assert.equal(grant.ExpressionAttributeValues[":active"], "active");
  assert.equal(grant.ExpressionAttributeValues[":code"], PARAMS.code);
  assert.equal(grant.ExpressionAttributeValues[":expiresAt"], PARAMS.expiresAt);
  assert.equal(grant.ExpressionAttributeValues[":now"], PARAMS.now);
  assert.equal(grant.ExpressionAttributeValues[":defaultSlots"], PARAMS.defaultSlots);
  // A DynamoDB NULL clear, not an absent/removed attribute (matches how
  // redeemFlowPointsReward clears licenseExpiresAt).
  assert.equal(grant.ExpressionAttributeValues[":nullValue"], null);
});

// ── License-direction money-path scenarios (the spec the wired guard enforces) ──
// candidateExpiry = the new license's expiry.
test("a redeemed license never shortens a longer existing grant", () => {
  const NEW_LICENSE = PARAMS.expiresAt; // 2027-06-15
  const LATER = "2030-01-01T00:00:00.000Z";
  const EARLIER = "2026-07-01T00:00:00.000Z";

  const refuse = (existing: ExistingGrant) =>
    assert.equal(grantUpgradeApplies(existing, NEW_LICENSE), false, JSON.stringify(existing));
  const apply = (existing: ExistingGrant) =>
    assert.equal(grantUpgradeApplies(existing, NEW_LICENSE), true, JSON.stringify(existing));

  // Headline bug: a longer existing license must not be overwritten by a shorter one.
  refuse({ plan: "PRO", proSource: "license", licenseExpiresAt: LATER });
  // Open-ended admin comp and active Stripe sub are never overwritten.
  refuse({ plan: "PRO", proSource: "admin" });
  refuse({ plan: "PRO", proSource: "stripe" });
  // A longer flow_points / gift pass must survive.
  refuse({ plan: "PRO", proSource: "flow_points", currentPeriodEnd: LATER, licenseExpiresAt: null });
  refuse({ plan: "PRO", proSource: "gift_code", currentPeriodEnd: LATER });

  // Legitimate cases still apply: no PRO, an expired/shorter license (renew/extend),
  // or a shorter pass the license outlasts.
  apply({ plan: "FREE" });
  apply({});
  apply({ plan: "PRO", proSource: "license", licenseExpiresAt: EARLIER });
  apply({ plan: "PRO", proSource: "flow_points", currentPeriodEnd: EARLIER, licenseExpiresAt: null });

  // C3: a charged-back user (disputeOpen) is blocked even when the license would
  // otherwise renew an expired window — repo.ts re-reads on this failure and returns
  // a dispute_hold error rather than consuming the key.
  refuse({ plan: "FREE", disputeOpen: true });
  refuse({ plan: "PRO", proSource: "license", licenseExpiresAt: EARLIER, disputeOpen: true });
});
