import assert from "node:assert/strict";
import { test } from "node:test";
import { subscriptionStatus } from "./subscription-status-core";

const fmt = (iso: string) => iso.slice(0, 10);
const END = "2026-12-04T00:00:00.000Z";

test("a Stripe subscription renews or cancels on its period end and can be managed", () => {
  assert.deepEqual(subscriptionStatus({ proSource: "stripe", currentPeriodEnd: END }, fmt), {
    dateLine: "Next renewal: 2026-12-04",
    cancelNote: false,
    manage: "stripe",
  });
  assert.deepEqual(
    subscriptionStatus({ proSource: "stripe", currentPeriodEnd: END, cancelAtPeriodEnd: true }, fmt),
    { dateLine: "Cancels on 2026-12-04", cancelNote: true, manage: "stripe" },
  );
});

test("an unknown source is treated as Stripe", () => {
  assert.equal(subscriptionStatus({ currentPeriodEnd: END }, fmt).manage, "stripe");
});

test("no period end never invents a billing cadence", () => {
  assert.deepEqual(subscriptionStatus({ proSource: "stripe" }, fmt), {
    dateLine: null,
    cancelNote: false,
    manage: "stripe",
  });
});

test("gift and points Pro end on their date and have nothing to manage", () => {
  for (const proSource of ["gift_code", "flow_points"] as const) {
    assert.deepEqual(subscriptionStatus({ proSource, currentPeriodEnd: END }, fmt), {
      dateLine: "Pro until 2026-12-04",
      cancelNote: false,
      manage: null,
    });
  }
});

test("license Pro ends on the license expiry, else the period end", () => {
  assert.deepEqual(
    subscriptionStatus(
      { proSource: "license", licenseExpiresAt: "2027-03-01T00:00:00.000Z", currentPeriodEnd: END },
      fmt,
    ),
    { dateLine: "Pro until 2027-03-01", cancelNote: false, manage: null },
  );
  assert.equal(subscriptionStatus({ proSource: "license", currentPeriodEnd: END }, fmt).dateLine, "Pro until 2026-12-04");
});

test("admin Pro shows no date and nothing to manage", () => {
  assert.deepEqual(subscriptionStatus({ proSource: "admin", currentPeriodEnd: END }, fmt), {
    dateLine: null,
    cancelNote: false,
    manage: null,
  });
});

test("Apple keeps its renewal line and App Store management", () => {
  assert.deepEqual(subscriptionStatus({ proSource: "apple", currentPeriodEnd: END }, fmt), {
    dateLine: "Next renewal: 2026-12-04",
    cancelNote: false,
    manage: "apple",
  });
});

test("an unreadable date is dropped", () => {
  assert.equal(subscriptionStatus({ proSource: "gift_code", currentPeriodEnd: "not a date" }).dateLine, null);
});
