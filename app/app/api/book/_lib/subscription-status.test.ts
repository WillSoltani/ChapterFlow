import { test } from "node:test";
import assert from "node:assert/strict";
import { mapSubscriptionStatus } from "./subscription-status";
import { PRO_WORTHY_STATUSES } from "./reconciliation-core";

test("active and trialing grant active PRO", () => {
  assert.deepEqual(mapSubscriptionStatus("active"), { plan: "PRO", proStatus: "active" });
  assert.deepEqual(mapSubscriptionStatus("trialing"), { plan: "PRO", proStatus: "active" });
});

test("past_due keeps PRO but marks past_due", () => {
  assert.deepEqual(mapSubscriptionStatus("past_due"), { plan: "PRO", proStatus: "past_due" });
});

test("non-entitling statuses map to FREE/canceled", () => {
  for (const s of ["canceled", "incomplete", "incomplete_expired", "unpaid", "paused", "anything_else"]) {
    assert.deepEqual(
      mapSubscriptionStatus(s),
      { plan: "FREE", proStatus: "canceled" },
      `status "${s}" should be FREE/canceled`,
    );
  }
});

test("reconciliation's PRO-worthy statuses are exactly the ones that map to plan PRO", () => {
  // If these two ever drift, reconciliation would mis-flag real subscriptions.
  for (const s of PRO_WORTHY_STATUSES) {
    assert.equal(mapSubscriptionStatus(s).plan, "PRO", `${s} should map to PRO`);
  }
  // And the reverse: a status that maps to PRO must be considered PRO-worthy.
  for (const s of ["active", "trialing", "past_due", "canceled", "incomplete", "unpaid", "paused"]) {
    if (mapSubscriptionStatus(s).plan === "PRO") {
      assert.ok(PRO_WORTHY_STATUSES.has(s), `${s} maps to PRO but is not PRO-worthy in reconciliation`);
    }
  }
});
