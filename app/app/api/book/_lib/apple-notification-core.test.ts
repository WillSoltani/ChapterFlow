import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mapAppleNotificationToEntitlement,
  buildAppleActivation,
} from "./apple-notification-core";
import type { AppleTransactionInfo } from "./apple-jws-verify-core";
import { validateAppleNotificationMutationShape } from "./apple-purchase-policy-core";

const EXPIRES = Date.UTC(2027, 0, 31); // 2027-01-31
const EXPIRES_ISO = new Date(EXPIRES).toISOString();
const SIGNED = Date.UTC(2027, 0, 1);

function tx(overrides: Partial<AppleTransactionInfo> = {}): AppleTransactionInfo {
  return {
    bundleId: "com.chapterflow.app",
    productId: "chapterflow.pro.monthly",
    transactionId: "2000000000000001",
    originalTransactionId: "1000000000000001",
    expiresDateMs: EXPIRES,
    signedDateMs: SIGNED,
    type: "Auto-Renewable Subscription",
    ...overrides,
  };
}

// ─── SUBSCRIBED / DID_RENEW → activate PRO ───────────────────────────────────

for (const notificationType of ["SUBSCRIBED", "DID_RENEW"] as const) {
  test(`${notificationType} → PRO active through expiry (activate guard)`, () => {
    const decision = mapAppleNotificationToEntitlement({
      notificationType,
      transaction: tx(),
      renewalInfo: { autoRenewStatus: 1 },
      signedDateMs: SIGNED,
    });
    assert.equal(decision.apply, true);
    assert.ok(decision.apply);
    assert.deepEqual(decision.params, {
      plan: "PRO",
      proStatus: "active",
      originalTransactionId: "1000000000000001",
      productId: "chapterflow.pro.monthly",
      currentPeriodEnd: EXPIRES_ISO,
      cancelAtPeriodEnd: false,
      appleSignedDateMs: SIGNED,
      guard: "activate",
    });
  });
}

// ─── DID_CHANGE_RENEWAL_STATUS → toggle cancel flag (apple_only) ──────────────

test("DID_CHANGE_RENEWAL_STATUS AUTO_RENEW_DISABLED → cancelAtPeriodEnd true", () => {
  const decision = mapAppleNotificationToEntitlement({
    notificationType: "DID_CHANGE_RENEWAL_STATUS",
    subtype: "AUTO_RENEW_DISABLED",
    transaction: tx(),
    renewalInfo: { autoRenewStatus: 0 },
    signedDateMs: SIGNED,
  });
  assert.ok(decision.apply);
  assert.equal(decision.params.plan, "PRO");
  assert.equal(decision.params.proStatus, "active");
  assert.equal(decision.params.cancelAtPeriodEnd, true);
  assert.equal(decision.params.guard, "apple_only");
});

test("DID_CHANGE_RENEWAL_STATUS AUTO_RENEW_ENABLED → cancelAtPeriodEnd false", () => {
  const decision = mapAppleNotificationToEntitlement({
    notificationType: "DID_CHANGE_RENEWAL_STATUS",
    subtype: "AUTO_RENEW_ENABLED",
    transaction: tx(),
    renewalInfo: { autoRenewStatus: 1 },
    signedDateMs: SIGNED,
  });
  assert.ok(decision.apply);
  assert.equal(decision.params.cancelAtPeriodEnd, false);
  assert.equal(decision.params.guard, "apple_only");
});

test("DID_CHANGE_RENEWAL_STATUS with no subtype falls back to renewalInfo.autoRenewStatus", () => {
  const decision = mapAppleNotificationToEntitlement({
    notificationType: "DID_CHANGE_RENEWAL_STATUS",
    transaction: tx(),
    renewalInfo: { autoRenewStatus: 0 },
    signedDateMs: SIGNED,
  });
  assert.ok(decision.apply);
  assert.equal(decision.params.cancelAtPeriodEnd, true);
});

// ─── Billing retry / grace period ────────────────────────────────────────────

test("DID_FAIL_TO_RENEW without grace stops access and marks past due", () => {
  const decision = mapAppleNotificationToEntitlement({
    notificationType: "DID_FAIL_TO_RENEW",
    transaction: tx(),
    signedDateMs: SIGNED,
    nowMs: SIGNED,
  });
  assert.ok(decision.apply);
  assert.equal(decision.params.plan, "FREE");
  assert.equal(decision.params.proStatus, "past_due");
  assert.equal(decision.params.guard, "apple_only");
});

test("DID_FAIL_TO_RENEW with active grace preserves access only through grace", () => {
  const graceExpiry = EXPIRES + 3 * 24 * 60 * 60 * 1000;
  const decision = mapAppleNotificationToEntitlement({
    notificationType: "DID_FAIL_TO_RENEW",
    subtype: "GRACE_PERIOD",
    transaction: tx({ expiresDateMs: SIGNED - 1 }),
    renewalInfo: { gracePeriodExpiresDateMs: graceExpiry },
    signedDateMs: SIGNED,
    nowMs: SIGNED,
  });
  assert.ok(decision.apply);
  assert.equal(decision.params.plan, "PRO");
  assert.equal(decision.params.proStatus, "past_due");
  assert.equal(decision.params.currentPeriodEnd, new Date(graceExpiry).toISOString());
  assert.equal(decision.params.guard, "apple_only");
});

test("DID_FAIL_TO_RENEW with missing or elapsed grace fails closed", () => {
  for (const gracePeriodExpiresDateMs of [undefined, SIGNED - 1]) {
    const decision = mapAppleNotificationToEntitlement({
      notificationType: "DID_FAIL_TO_RENEW",
      subtype: "GRACE_PERIOD",
      transaction: tx({ expiresDateMs: SIGNED - 1 }),
      renewalInfo: { gracePeriodExpiresDateMs },
      signedDateMs: SIGNED,
      nowMs: SIGNED,
    });
    assert.ok(decision.apply);
    assert.equal(decision.params.plan, "FREE");
    assert.equal(decision.params.proStatus, "past_due");
  }
});

test("GRACE_PERIOD_EXPIRED stops access while billing retry continues", () => {
  const decision = mapAppleNotificationToEntitlement({
    notificationType: "GRACE_PERIOD_EXPIRED",
    transaction: tx({ expiresDateMs: SIGNED - 1 }),
    renewalInfo: { gracePeriodExpiresDateMs: SIGNED - 1 },
    signedDateMs: SIGNED,
    nowMs: SIGNED,
  });
  assert.ok(decision.apply);
  assert.equal(decision.params.plan, "FREE");
  assert.equal(decision.params.proStatus, "past_due");
  assert.equal(decision.params.guard, "apple_only");
});

test("DID_RENEW billing recovery restores active access", () => {
  const decision = mapAppleNotificationToEntitlement({
    notificationType: "DID_RENEW",
    subtype: "BILLING_RECOVERY",
    transaction: tx(),
    signedDateMs: SIGNED,
    nowMs: SIGNED,
  });
  assert.ok(decision.apply);
  assert.equal(decision.params.plan, "PRO");
  assert.equal(decision.params.proStatus, "active");
  assert.equal(decision.params.guard, "activate");
});

test("RENEWAL_EXTENDED advances the same Apple lineage", () => {
  const extendedExpiry = EXPIRES + 7 * 24 * 60 * 60 * 1000;
  const decision = mapAppleNotificationToEntitlement({
    notificationType: "RENEWAL_EXTENDED",
    transaction: tx({ expiresDateMs: extendedExpiry }),
    renewalInfo: { autoRenewStatus: 0 },
    signedDateMs: SIGNED,
    nowMs: SIGNED,
  });
  assert.ok(decision.apply);
  assert.equal(decision.params.plan, "PRO");
  assert.equal(
    decision.params.currentPeriodEnd,
    new Date(extendedExpiry).toISOString(),
  );
  assert.equal(decision.params.guard, "apple_only");
  assert.equal(decision.params.cancelAtPeriodEnd, true);
});

test("active grace decision passes the notification mutation boundary", () => {
  const graceExpiry = EXPIRES + 3 * 24 * 60 * 60 * 1000;
  const transaction = tx({ expiresDateMs: SIGNED - 1 });
  const decision = mapAppleNotificationToEntitlement({
    notificationType: "DID_FAIL_TO_RENEW",
    subtype: "GRACE_PERIOD",
    transaction,
    renewalInfo: { gracePeriodExpiresDateMs: graceExpiry },
    signedDateMs: SIGNED,
    nowMs: SIGNED,
  });
  assert.ok(decision.apply);
  assert.equal(
    validateAppleNotificationMutationShape({
      transaction,
      notificationSignedDateMs: SIGNED,
      grantsPro: decision.params.plan === "PRO",
      serviceExpiresDateMs: Date.parse(decision.params.currentPeriodEnd ?? ""),
      nowMs: SIGNED,
    }),
    null,
  );
});

// ─── EXPIRED / REFUND → downgrade (apple_only) ───────────────────────────────

test("EXPIRED → FREE inactive, apple_only guard", () => {
  const decision = mapAppleNotificationToEntitlement({
    notificationType: "EXPIRED",
    subtype: "VOLUNTARY",
    transaction: tx(),
    signedDateMs: SIGNED,
  });
  assert.ok(decision.apply);
  assert.equal(decision.params.plan, "FREE");
  assert.equal(decision.params.proStatus, "inactive");
  assert.equal(decision.params.cancelAtPeriodEnd, true);
  assert.equal(decision.params.guard, "apple_only");
});

test("REFUND → FREE canceled, apple_only guard", () => {
  const decision = mapAppleNotificationToEntitlement({
    notificationType: "REFUND",
    transaction: tx(),
    signedDateMs: SIGNED,
  });
  assert.ok(decision.apply);
  assert.equal(decision.params.plan, "FREE");
  assert.equal(decision.params.proStatus, "canceled");
  assert.equal(decision.params.guard, "apple_only");
});

test("REFUND_REVERSED restores only an unrevoked, unexpired lineage", () => {
  const decision = mapAppleNotificationToEntitlement({
    notificationType: "REFUND_REVERSED",
    transaction: tx(),
    renewalInfo: { autoRenewStatus: 0 },
    signedDateMs: SIGNED + 1,
    nowMs: SIGNED,
  });
  assert.ok(decision.apply);
  assert.equal(decision.params.plan, "PRO");
  assert.equal(decision.params.proStatus, "active");
  assert.equal(decision.params.guard, "same_lineage_activate");
  assert.equal(decision.params.cancelAtPeriodEnd, true);

  for (const invalidTransaction of [
    tx({ revocationDateMs: SIGNED }),
    tx({ expiresDateMs: SIGNED }),
  ]) {
    const rejected = mapAppleNotificationToEntitlement({
      notificationType: "REFUND_REVERSED",
      transaction: invalidTransaction,
      signedDateMs: SIGNED + 1,
      nowMs: SIGNED,
    });
    assert.equal(rejected.apply, false);
  }
});

// ─── IGNORED / INVALID ───────────────────────────────────────────────────────

test("an unhandled notification type is a no-op", () => {
  const decision = mapAppleNotificationToEntitlement({
    notificationType: "TEST",
    transaction: tx(),
    signedDateMs: SIGNED,
  });
  assert.equal(decision.apply, false);
});

test("a handled type without originalTransactionId is a no-op", () => {
  const decision = mapAppleNotificationToEntitlement({
    notificationType: "DID_RENEW",
    transaction: tx({ originalTransactionId: undefined }),
    signedDateMs: SIGNED,
  });
  assert.equal(decision.apply, false);
});

test("a missing transaction is a no-op", () => {
  const decision = mapAppleNotificationToEntitlement({
    notificationType: "DID_RENEW",
    signedDateMs: SIGNED,
  });
  assert.equal(decision.apply, false);
});

test("signedDate propagates as the ordering high-water mark", () => {
  const decision = mapAppleNotificationToEntitlement({
    notificationType: "SUBSCRIBED",
    transaction: tx(),
    signedDateMs: 1234567890,
  });
  assert.ok(decision.apply);
  assert.equal(decision.params.appleSignedDateMs, 1234567890);
});

// ─── buildAppleActivation (the /apple/verify path) ───────────────────────────

test("buildAppleActivation produces a PRO activate write", () => {
  const params = buildAppleActivation(tx(), SIGNED);
  assert.ok(params);
  assert.equal(params.plan, "PRO");
  assert.equal(params.proStatus, "active");
  assert.equal(params.currentPeriodEnd, EXPIRES_ISO);
  assert.equal(
    params.cancelAtPeriodEnd,
    undefined,
    "a direct transaction JWS does not carry renewal status",
  );
  assert.equal(params.guard, "activate");
  assert.equal(params.appleSignedDateMs, SIGNED);
});

test("buildAppleActivation falls back to the transaction signedDate", () => {
  const params = buildAppleActivation(tx({ signedDateMs: 999 }), undefined);
  assert.ok(params);
  assert.equal(params.appleSignedDateMs, 999);
});

test("buildAppleActivation returns null without an originalTransactionId", () => {
  assert.equal(buildAppleActivation(tx({ originalTransactionId: undefined }), SIGNED), null);
});
