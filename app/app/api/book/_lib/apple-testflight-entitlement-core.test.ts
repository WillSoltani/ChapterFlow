import { test } from "node:test";
import assert from "node:assert/strict";
import type { BookUserEntitlement } from "./types";
import { selectAppleTestFlightEntitlement } from "./apple-testflight-entitlement-core";
import { shouldBlockStripeCheckout } from "./stripe-checkout-entitlement-core";

const QA_USER = "8f14e45f-ea4f-4a1b-8c32-07bbf1cdb22f";

function entitlement(
  overrides: Partial<BookUserEntitlement>,
): BookUserEntitlement {
  return {
    userId: QA_USER,
    plan: "FREE",
    proStatus: "inactive",
    freeBookSlots: 2,
    unlockedBookIds: [],
    updatedAt: "2027-01-01T00:00:00.000Z",
    ...overrides,
  };
}

test("allowlisted default reads expose active Sandbox Pro to gated APIs", () => {
  const production = entitlement({
    unlockedBookIds: ["production-book"],
    stripeCustomerId: "cus_production",
  });
  const sandbox = entitlement({
    plan: "PRO",
    proStatus: "active",
    proSource: "apple",
    currentPeriodEnd: "2027-02-01T00:00:00.000Z",
    appleOriginalTransactionId: "sandbox-original",
  });

  const effective = selectAppleTestFlightEntitlement({
    production,
    sandbox,
    sandboxAllowed: true,
  });

  assert.equal(effective?.plan, "PRO");
  assert.equal(effective?.proSource, "apple");
  assert.deepEqual(effective?.unlockedBookIds, ["production-book"]);
  assert.equal(effective?.stripeCustomerId, "cus_production");
  assert.equal(
    shouldBlockStripeCheckout(effective),
    true,
    "the same effective row used by gated routes must block a second checkout",
  );
});

test("Production Pro always wins over an allowlisted Sandbox row", () => {
  const production = entitlement({
    plan: "PRO",
    proStatus: "active",
    proSource: "admin",
  });
  const sandbox = entitlement({
    plan: "PRO",
    proStatus: "active",
    proSource: "apple",
  });

  assert.equal(
    selectAppleTestFlightEntitlement({
      production,
      sandbox,
      sandboxAllowed: true,
    })?.proSource,
    "admin",
  );
});

test("disabling or removing the allowlist hides Sandbox access immediately", () => {
  const production = entitlement({});
  const sandbox = entitlement({
    plan: "PRO",
    proStatus: "active",
    proSource: "apple",
  });

  const effective = selectAppleTestFlightEntitlement({
    production,
    sandbox,
    sandboxAllowed: false,
  });
  assert.equal(effective?.plan, "FREE");
  assert.equal(effective?.proSource, undefined);
  assert.equal(shouldBlockStripeCheckout(effective), false);
});

test("an expired Sandbox row cannot supersede an existing Production row", () => {
  const production = entitlement({ unlockedBookIds: ["book-a"] });
  const sandbox = entitlement({
    plan: "FREE",
    proStatus: "inactive",
    proSource: "apple",
  });

  assert.equal(
    selectAppleTestFlightEntitlement({
      production,
      sandbox,
      sandboxAllowed: true,
    }),
    production,
  );
});
