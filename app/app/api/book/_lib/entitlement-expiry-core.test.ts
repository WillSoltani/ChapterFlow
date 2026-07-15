import { test } from "node:test";
import assert from "node:assert/strict";
import { isStoredProGrantExpired } from "./entitlement-expiry-core";

const NOW = Date.parse("2027-01-01T00:00:00.000Z");

test("Apple Pro fails closed after its signed service period", () => {
  assert.equal(
    isStoredProGrantExpired({
      storedPlan: "PRO",
      proSource: "apple",
      currentPeriodEnd: "2026-12-31T23:59:59.999Z",
      nowMs: NOW,
    }),
    true,
  );
  assert.equal(
    isStoredProGrantExpired({
      storedPlan: "PRO",
      proSource: "apple",
      currentPeriodEnd: "2027-01-04T00:00:00.000Z",
      nowMs: NOW,
    }),
    false,
    "a signed future grace expiry keeps access active",
  );
});

test("Apple Pro with a missing or malformed period fails closed", () => {
  for (const currentPeriodEnd of [undefined, "not-a-date"]) {
    assert.equal(
      isStoredProGrantExpired({
        storedPlan: "PRO",
        proSource: "apple",
        currentPeriodEnd,
        nowMs: NOW,
      }),
      true,
    );
  }
});

test("renewal recovery with a future period restores effective Apple Pro", () => {
  assert.equal(
    isStoredProGrantExpired({
      storedPlan: "PRO",
      proSource: "apple",
      currentPeriodEnd: "2027-02-01T00:00:00.000Z",
      nowMs: NOW,
    }),
    false,
  );
});

test("license, flow-points, and gift expiries retain their timed semantics", () => {
  assert.equal(
    isStoredProGrantExpired({
      storedPlan: "PRO",
      proSource: "license",
      licenseExpiresAt: "2026-12-31T00:00:00.000Z",
      nowMs: NOW,
    }),
    true,
  );
  for (const proSource of ["flow_points", "gift_code"] as const) {
    assert.equal(
      isStoredProGrantExpired({
        storedPlan: "PRO",
        proSource,
        currentPeriodEnd: "2026-12-31T00:00:00.000Z",
        nowMs: NOW,
      }),
      true,
    );
  }
  assert.equal(
    isStoredProGrantExpired({
      storedPlan: "PRO",
      proSource: "admin",
      nowMs: NOW,
    }),
    false,
  );
});
