import { test, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import {
  buildEntitlementUpdateFromStripe,
  type StripeEntitlementWriteParams,
} from "@/app/app/api/book/_lib/stripe-entitlement-write-core";

// WS4-014 (route-level proof): the webhook feeds plan:"PRO"/proStatus:"past_due"
// into updateUserEntitlementFromStripe on FAILED payments
// (invoice.payment_failed, invoice.payment_action_required, and
// customer.subscription.updated via mapSubscriptionStatus). The pure-builder
// tests in stripe-entitlement-write-core.test.ts already pin the fixed
// contract (isPaidActivation = plan==="PRO" && proStatus==="active"). This file
// drives the ACTUAL POST route handler through a fully-stubbed dependency graph
// so a failed payment can be proven, end to end, unable to take over an
// Apple-source entitlement — not just at the pure-builder level.
//
// The route imports `server-only` and other heavy/server-bound modules. Neutralize
// those via the repo's established Module._load patch pattern (see
// app/app/api/book/billing/checkout-session/route.test.ts and
// app/app/api/book/config/ios/route.test.ts) BEFORE the route is dynamically
// imported in `before()`.
const require = createRequire(import.meta.url);
const Module = require("node:module") as {
  _load: (request: string, parent: unknown, isMain: boolean) => unknown;
};
const originalLoad = Module._load;

// ─── Faithful, minimal evaluator of the exact ConditionExpression clauses the
// builder emits — copied from stripe-entitlement-write-core.test.ts (same
// drift-guard throw) so a change to the builder's clause strings can never
// silently pass this harness. ───────────────────────────────────────────────
const PROSOURCE_GUARD =
  "(attribute_not_exists(proSource) OR proSource = :stripeSource OR proSource = :nullSource)";
const ACTIVATION_PROSOURCE_GUARD =
  "(attribute_not_exists(proSource) OR proSource = :stripeSource OR proSource = :nullSource OR (proSource = :appleSource AND ((attribute_exists(activePaidIntentAtMs) AND activePaidIntentAtMs <= :paidIntentAtMs) OR (attribute_not_exists(activePaidIntentAtMs) AND (attribute_not_exists(lastAppleSignedDate) OR lastAppleSignedDate <= :paidIntentAtMs)))))";
const ORDERING_GUARD =
  "(attribute_not_exists(lastStripeEventAt) OR lastStripeEventAt <= :eventCreated)";
const DISPUTE_GUARD = "attribute_not_exists(disputeOpen)";
const EXISTS_PK = "attribute_exists(PK)";

type StoredItem = {
  pkExists?: boolean;
  proSource?: "stripe" | "apple" | "license" | "flow_points" | "gift_code" | "admin" | null;
  lastStripeEventAt?: number;
  disputeOpen?: boolean;
  activePaidIntentAtMs?: number;
  lastAppleSignedDate?: number;
  // Extended beyond the pure-builder StoredItem so the harness can assert on
  // the full stored entitlement shape (the route also writes plan/proStatus).
  plan?: "FREE" | "PRO";
  proStatus?: "inactive" | "active" | "past_due" | "canceled";
};

function conditionApplies(
  conditionParts: string[],
  eav: Record<string, unknown>,
  stored: StoredItem,
): boolean {
  return conditionParts.every((clause) => {
    if (clause === PROSOURCE_GUARD || clause === ACTIVATION_PROSOURCE_GUARD) {
      return (
        stored.proSource === undefined ||
        stored.proSource === eav[":stripeSource"] ||
        (clause === ACTIVATION_PROSOURCE_GUARD &&
          stored.proSource === eav[":appleSource"] &&
          (stored.activePaidIntentAtMs !== undefined
            ? stored.activePaidIntentAtMs <=
              (eav[":paidIntentAtMs"] as number)
            : stored.lastAppleSignedDate === undefined ||
              stored.lastAppleSignedDate <=
                (eav[":paidIntentAtMs"] as number))) ||
        stored.proSource === eav[":nullSource"]
      );
    }
    if (clause === ORDERING_GUARD) {
      return (
        stored.lastStripeEventAt === undefined ||
        stored.lastStripeEventAt <= (eav[":eventCreated"] as number)
      );
    }
    if (clause === DISPUTE_GUARD) {
      return stored.disputeOpen === undefined;
    }
    if (clause === EXISTS_PK) {
      return stored.pkExists !== false;
    }
    throw new Error(`unrecognized condition clause: ${clause}`);
  });
}

// ─── In-memory fake DynamoDB entitlement store + captured calls ─────────────
let entitlements: Map<string, StoredItem>;
let customerToUser: Map<string, string>;
let capturedParams: Array<
  StripeEntitlementWriteParams & { userId: string }
>;

function resetHarness(): void {
  customerToUser = new Map([["cus_apple", "user-apple"]]);
  entitlements = new Map([
    [
      "user-apple",
      {
        proSource: "apple",
        plan: "PRO",
        proStatus: "active",
        lastAppleSignedDate: 1_000,
      },
    ],
  ]);
  capturedParams = [];
}
resetHarness();

/**
 * Mirrors updateUserEntitlementFromStripe's real behavior (repo.ts): build the
 * UpdateCommand pieces with the REAL (pure, statically-imported)
 * buildEntitlementUpdateFromStripe, evaluate the ConditionExpression against
 * the simulated stored item, and either apply the modeled SET parts or swallow
 * the write silently (mirroring the real repo's ConditionalCheckFailed catch).
 */
function applyStripeWrite(
  params: StripeEntitlementWriteParams & { userId: string },
): void {
  const built = buildEntitlementUpdateFromStripe(
    params,
    "2026-01-01T00:00:00.000Z",
  );
  const stored: StoredItem = entitlements.get(params.userId) ?? {};
  if (!conditionApplies(built.conditionParts, built.expressionAttributeValues, stored)) {
    return; // refused — swallowed, exactly like the real repo's catch block
  }
  const next: StoredItem = { ...stored };
  if (built.setParts.includes("#plan = :plan")) {
    next.plan = built.expressionAttributeValues[":plan"] as StoredItem["plan"];
  }
  if (built.setParts.includes("proStatus = :proStatus")) {
    next.proStatus = built.expressionAttributeValues[":proStatus"] as StoredItem["proStatus"];
  }
  if (built.setParts.includes("proSource = :proSource")) {
    next.proSource = built.expressionAttributeValues[":proSource"] as StoredItem["proSource"];
  }
  if (built.setParts.includes("activePaidIntentAtMs = :paidIntentAtMs")) {
    next.activePaidIntentAtMs = built.expressionAttributeValues[":paidIntentAtMs"] as number;
  }
  if (built.setParts.includes("lastStripeEventAt = :eventCreated")) {
    next.lastStripeEventAt = built.expressionAttributeValues[":eventCreated"] as number;
  }
  entitlements.set(params.userId, next);
}

// ─── Stripe stub. charges.retrieve throws so an unexpected call (a code path
// this file does not intend to exercise) fails loudly instead of silently
// returning plausible-looking data. ───────────────────────────────────────────
const stripeStub = {
  webhooks: {
    constructEvent: (payload: string) => JSON.parse(payload),
  },
  paymentIntents: {
    retrieve: async () => ({ last_payment_error: { code: "card_declined" } }),
  },
  charges: {
    retrieve: async () => {
      throw new Error("unexpected charges.retrieve");
    },
  },
};

Module._load = function patchedLoad(
  request: string,
  parent: unknown,
  isMain: boolean,
) {
  if (request === "server-only") return {};

  if (request === "@/app/app/api/book/_lib/env") {
    return {
      getBookTableName: async () => "TestTable",
      getBookAnalyticsTableName: async () => null,
    };
  }

  if (request === "@/app/app/api/book/_lib/stripe-service") {
    return {
      getStripeClient: async () => stripeStub,
      getStripeWebhookSecretOrThrow: async () => "whsec_test",
    };
  }

  if (request === "@/app/app/api/book/_lib/analytics-repo") {
    return { analyticsTrackSubscription: async () => {} };
  }

  if (request === "@/app/app/api/book/_lib/cloudwatch-metrics") {
    return { putOpsMetric: async () => {} };
  }

  if (request === "@/app/app/api/book/_lib/trial-ending-email") {
    return { sendTrialEndingEmail: async () => ({ sent: true }) };
  }

  if (request === "@/app/app/api/book/_lib/repo") {
    return {
      getUserIdByStripeCustomer: async (_t: string, customerId: string) =>
        customerToUser.get(customerId) ?? null,
      claimStripeWebhookEvent: async () => "claimed",
      completeStripeWebhookEvent: async () => {},
      releaseStripeWebhookClaim: async () => {},
      mapStripeCustomerToUser: async () => {},
      setEntitlementDisputeMarker: async () => {},
      // Not part of the spec's stub list, but route.ts imports it (used by the
      // charge.dispute.created branch, which this file's tests never trigger).
      // Provided as a no-op so the destructured import isn't `undefined`.
      recordBillingEvent: async () => {},
      updateUserEntitlementFromStripe: async (
        _t: string,
        params: StripeEntitlementWriteParams & { userId: string },
      ) => {
        capturedParams.push(params);
        applyStripeWrite(params);
      },
    };
  }

  return originalLoad.call(this, request, parent, isMain);
};

let POST: typeof import("./route").POST;

before(async () => {
  ({ POST } = await import("./route"));
});

beforeEach(() => {
  resetHarness();
});

function webhookRequest(event: unknown): Request {
  return new Request(
    "https://app.chapterflow.ca/app/api/book/billing/webhook",
    {
      method: "POST",
      headers: { "stripe-signature": "t=1,v1=test" },
      body: JSON.stringify(event),
    },
  );
}

// WS4-014 (RED): a FAILED payment must never be able to overwrite an
// Apple-source entitlement. Pre-fix, invoice.payment_failed sends
// plan:"PRO"/proStatus:"past_due", which the current (buggy)
// isProActivation = plan === "PRO" treats as a paid activation — it stamps
// activePaidIntentAtMs and carries the Apple-takeover clause, which applies
// here because the stored Apple mark (1_000) is older than the bogus
// paid-intent timestamp (2_000_000 = event.created(2000) * 1000). The
// entitlement flips to proSource:"stripe" off of a bounced card.
test("WS4-014 RED: invoice.payment_failed cannot overwrite an Apple entitlement", async () => {
  const event = {
    id: "evt_pf_1",
    type: "invoice.payment_failed",
    created: 2_000,
    data: {
      object: {
        customer: "cus_apple",
        subscription: "sub_1",
        payment_intent: {
          id: "pi_1",
          last_payment_error: { code: "card_declined" },
        },
      },
    },
  };

  const res = await POST(webhookRequest(event));
  assert.equal(res.status, 200);

  assert.equal(capturedParams.length, 1);
  assert.equal(capturedParams[0].plan, "PRO");
  assert.equal(capturedParams[0].proStatus, "past_due");

  const stored = entitlements.get("user-apple");
  assert.equal(
    stored?.proSource,
    "apple",
    "a failed payment must not take over the Apple entitlement's proSource",
  );
  assert.equal(stored?.plan, "PRO");
  assert.equal(stored?.proStatus, "active");
  assert.equal(
    stored?.activePaidIntentAtMs,
    undefined,
    "a failed payment must never stamp a paid-intent high-water mark",
  );
});

// WS4-014 (PIN): a genuinely completed Checkout session is a real paid
// activation (proStatus:"active") and must still be able to take over an
// Apple entitlement — this is the intended, money-must-never-be-accepted-
// without-access behavior the fix must NOT regress. Passes both before and
// after the fix (proStatus is already "active" here).
test("WS4-014 PIN: checkout.session.completed still takes over Apple", async () => {
  const event = {
    id: "evt_cs_1",
    type: "checkout.session.completed",
    created: 2_000,
    data: {
      object: {
        customer: "cus_apple",
        subscription: "sub_1",
        metadata: { userId: "user-apple" },
      },
    },
  };

  const res = await POST(webhookRequest(event));
  assert.equal(res.status, 200);

  assert.equal(capturedParams.length, 1);
  assert.equal(capturedParams[0].plan, "PRO");
  assert.equal(capturedParams[0].proStatus, "active");

  const stored = entitlements.get("user-apple");
  assert.equal(stored?.proSource, "stripe");
  assert.equal(stored?.plan, "PRO");
  assert.equal(stored?.proStatus, "active");
  assert.equal(stored?.activePaidIntentAtMs, 2_000_000);
});

// WS4-014 (PIN, harness sanity): an event type the route does not handle is
// acknowledged (200 { received: true }) without touching any entitlement —
// proves the harness itself is inert on a no-op path, not just quiet on the
// tested paths.
test("WS4-014 PIN: unhandled event type is acknowledged and touches nothing", async () => {
  const event = {
    id: "evt_unhandled_1",
    type: "product.created",
    created: 2_000,
    data: { object: {} },
  };

  const res = await POST(webhookRequest(event));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { received: true });

  assert.equal(capturedParams.length, 0);
  assert.deepEqual(entitlements.get("user-apple"), {
    proSource: "apple",
    plan: "PRO",
    proStatus: "active",
    lastAppleSignedDate: 1_000,
  });
});
