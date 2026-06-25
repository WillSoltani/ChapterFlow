import { test } from "node:test";
import assert from "node:assert/strict";
import {
  classifyDisputeResolution,
  type DisputeResolution,
} from "./dispute-event-core";

// ─── classifyDisputeResolution — the charge.dispute.created outcome decision ──
//
// Regression for the "dispute-unresolved" leak: a chargeback whose customer→user
// map has NOT propagated must NOT be marked processed (which would permanently
// drop the access-revocation). It must surface a RETRYABLE outcome so Stripe
// redelivers until the mapping lands. The terminal "no customer" case stays a
// completable record-only.

test("user resolved → revoke (downgrade + sticky disputeOpen marker)", () => {
  assert.equal(classifyDisputeResolution("cus_123", "user-abc"), "revoke");
});

test("REGRESSION: customer present but user UNresolved → retry (must NOT complete)", () => {
  // This is the bug. Pre-fix the handler recorded the event DONE here and the
  // chargeback never revoked access on any later redelivery. The decision must be
  // "retry" so the route throws user_resolution_failed (500) and Stripe retries.
  assert.equal(classifyDisputeResolution("cus_123", null), "retry");
});

test("no customer at all → record_only (terminal; retrying is futile)", () => {
  // A charge that genuinely has no customer can never resolve a user. Record the
  // finance row and complete — a retry would loop forever.
  assert.equal(classifyDisputeResolution(null, null), "record_only");
});

test("retry is distinct from record_only (the load-bearing distinction)", () => {
  const unresolvedButHasCustomer = classifyDisputeResolution("cus_x", null);
  const noCustomer = classifyDisputeResolution(null, null);
  assert.notEqual(
    unresolvedButHasCustomer,
    noCustomer,
    "a present-customer/null-user MUST retry, a no-customer dispute MUST complete",
  );
});

test("only 'revoke' performs the downgrade; both non-revoke outcomes skip it", () => {
  // Encodes the invariant the route relies on: updateUserEntitlementFromStripe /
  // setEntitlementDisputeMarker run ONLY for "revoke".
  const performsDowngrade = (o: DisputeResolution) => o === "revoke";
  assert.equal(performsDowngrade(classifyDisputeResolution("cus_1", "u1")), true);
  assert.equal(performsDowngrade(classifyDisputeResolution("cus_1", null)), false);
  assert.equal(performsDowngrade(classifyDisputeResolution(null, null)), false);
});

test("only 'record_only' and 'revoke' are completable; 'retry' is not", () => {
  // The route completes the webhook event (status=DONE) for every outcome EXCEPT
  // "retry" (which throws). Pin that contract so a future edit can't re-introduce
  // the leak by completing the retry case.
  const completable = (o: DisputeResolution) => o !== "retry";
  assert.equal(completable(classifyDisputeResolution("cus_1", "u1")), true);
  assert.equal(completable(classifyDisputeResolution(null, null)), true);
  assert.equal(completable(classifyDisputeResolution("cus_1", null)), false);
});

test("a resolved user wins even with a customer present (full truth table)", () => {
  const table: Array<[string | null, string | null, DisputeResolution]> = [
    ["cus_1", "u1", "revoke"],
    ["cus_1", null, "retry"],
    [null, null, "record_only"],
    // Defensive: a null customer with a (non-null) user should never occur in the
    // route — userId is derived from customerId — but if it did, a resolved user
    // still means revoke, never a futile retry.
    [null, "u1", "revoke"],
  ];
  for (const [customerId, userId, expected] of table) {
    assert.equal(
      classifyDisputeResolution(customerId, userId),
      expected,
      `customer=${String(customerId)} user=${String(userId)}`,
    );
  }
});
