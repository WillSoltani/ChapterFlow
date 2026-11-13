import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { PRICING } from "@/lib/pricing";

// WS4-015 (route-level contract): after a chargeback (charge.dispute.created),
// the entitlement row is { plan:'FREE', proSource:null, disputeOpen:true }.
// shouldBlockStripeCheckout only reads plan/proSource, so this route currently
// charges a disputed customer and mints a Stripe Checkout session BEFORE the
// webhook's grant write (which is refused by attribute_not_exists(disputeOpen))
// ever runs — paid-without-access. This file drives the actual POST route
// handler with a fully-stubbed dependency graph and asserts the intended
// contract: a disputed entitlement is rejected with 409 billing_disputed
// BEFORE any Stripe customer or checkout-session is created.
//
// The route (and http.ts, which it flows through unstubbed) imports
// `server-only` and other heavy/server-bound modules. Neutralize those via the
// repo's established Module._load patch pattern (see
// app/app/api/book/config/ios/route.test.ts and
// app/app/api/book/_lib/http-wrapper.test.ts) BEFORE the route is dynamically
// imported in `before()`.
const require = createRequire(import.meta.url);
const Module = require("node:module") as {
  _load: (request: string, parent: unknown, isMain: boolean) => unknown;
};
const originalLoad = Module._load;

// ─── Stripe spy: records every call so assertions can prove a disputed/
// already-pro checkout NEVER reaches Stripe, while the happy path calls
// `checkout.sessions.create` exactly once. ───────────────────────────────────
function makeSpy<TArgs extends unknown[], TResult>(
  impl: (...args: TArgs) => TResult,
) {
  const spy = ((...args: TArgs) => {
    spy.calls.push(args);
    return impl(...args);
  }) as ((...args: TArgs) => TResult) & { calls: TArgs[] };
  spy.calls = [];
  return spy;
}

const customersCreate = makeSpy(async () => ({ id: "cus_test" }));
const customersDel = makeSpy(async () => {});
let priorSubscriptions: Array<{ status: string }> = [];
const subscriptionsList = makeSpy(async () => ({ data: priorSubscriptions }));
const sessionsCreate = makeSpy(
  async (options: Record<string, unknown>) => {
    void options;
    return {
      url: "https://stripe.test/session",
      id: "cs_test",
    };
  },
);

let openSessions: Array<Record<string, unknown>> = [];
const sessionsList = makeSpy(async (_options: Record<string, unknown>) => ({
  data: openSessions,
}));
const sessionsExpire = makeSpy(async (_id: string) => ({}));
const portalCreate = makeSpy(async (_options: Record<string, unknown>) => ({
  url: "https://stripe.test/portal",
  id: "bps_test",
}));

const stripeSpy = {
  customers: { create: customersCreate, del: customersDel },
  subscriptions: { list: subscriptionsList },
  checkout: {
    sessions: { create: sessionsCreate, list: sessionsList, expire: sessionsExpire },
  },
  billingPortal: { sessions: { create: portalCreate } },
};

// Step-up auth for the billing-portal branch: stubbed so each test can decide
// whether the sign-in is recent. Everything else on the auth module is real.
let recentAuth = true;
const requireRecentAuth = makeSpy((_user: unknown, _maxAgeMinutes: number) => {
  if (!recentAuth) {
    const auth = originalLoad.call(Module, "@/app/app/api/_lib/auth", null, false) as {
      AuthError: new (message: string) => Error;
    };
    throw new auth.AuthError("REAUTH_REQUIRED");
  }
});

// Mutable per-test entitlement returned by the stubbed repo.
let currentEntitlement: unknown = null;

Module._load = function patchedLoad(
  request: string,
  parent: unknown,
  isMain: boolean,
) {
  if (request === "server-only") return {};

  if (request === "@/app/app/api/_lib/auth") {
    const real = originalLoad.call(this, request, parent, isMain) as Record<string, unknown>;
    return { ...real, requireRecentAuth };
  }

  if (request === "@/app/app/api/book/_lib/account-guard") {
    return {
      requireActiveBookUser: async () => ({ sub: "user-1", email: "user@test" }),
    };
  }

  // Both specifiers resolve to the SAME physical file
  // (app/app/api/book/_lib/env.ts): the route imports it via the "@/..."
  // alias, while http.ts (loaded for real, to exercise the actual CSRF guard)
  // imports it via the relative "./env" specifier. Stub both to the same
  // shape so neither path can hit SSM/AWS. getAppBaseUrl is not expected to be
  // invoked in these tests (the Bearer-native request shape short-circuits
  // requireSameOrigin before it is ever called) but is provided defensively
  // since http.ts's requireSameOrigin references it too.
  if (
    request === "@/app/app/api/book/_lib/env" ||
    request === "./env"
  ) {
    return {
      getBookTableName: async () => "book-table-test",
      getAppBaseUrl: async () => "https://app.chapterflow.ca",
    };
  }

  if (request === "@/app/app/api/book/_lib/stripe-service") {
    return {
      getStripeClient: async () => stripeSpy,
      getStripePriceIdForInterval: async () => "price_test_1",
    };
  }

  if (request === "@/app/app/api/book/_lib/repo") {
    return {
      getUserEntitlement: async () => currentEntitlement,
      attachStripeCustomerIfAbsent: async () => true,
      mapStripeCustomerToUser: async () => {},
    };
  }

  return originalLoad.call(this, request, parent, isMain);
};

let POST: typeof import("./route").POST;

before(async () => {
  ({ POST } = await import("./route"));
});

beforeEach(() => {
  currentEntitlement = null;
  priorSubscriptions = [];
  openSessions = [];
  recentAuth = true;
  resetStripeSpy();
});

after(() => {
  Module._load = originalLoad;
});

const FAKE_JWT = "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxIn0.sig";

function checkoutRequest(): Request {
  // Bearer-native shape (mirrors http-wrapper.test.ts's bearerMutation): NO
  // Origin, NO Sec-Fetch-Site, NO cookie. isHeaderAuthenticatedRequest treats
  // this as immune to CSRF (no ambient cookie credential to forge), so
  // requireSameOrigin returns before ever consulting getAppBaseUrl.
  return new Request(
    "https://app.chapterflow.ca/app/api/book/billing/checkout-session",
    {
      method: "POST",
      headers: { authorization: `Bearer ${FAKE_JWT}` },
    },
  );
}

function resetStripeSpy(): void {
  customersCreate.calls.length = 0;
  customersDel.calls.length = 0;
  subscriptionsList.calls.length = 0;
  sessionsCreate.calls.length = 0;
  sessionsList.calls.length = 0;
  sessionsExpire.calls.length = 0;
  portalCreate.calls.length = 0;
  requireRecentAuth.calls.length = 0;
}

async function assertCheckoutSuccess(res: Response): Promise<void> {
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), {
    checkoutUrl: "https://stripe.test/session",
    sessionId: "cs_test",
  });
}

test("WS4-015: a disputed entitlement is rejected with 409 billing_disputed before any Stripe call", async () => {
  currentEntitlement = {
    userId: "user-1",
    plan: "FREE",
    freeBookSlots: 2,
    unlockedBookIds: [],
    disputeOpen: true,
  };

  const res = await POST(checkoutRequest());
  assert.equal(res.status, 409);
  const body = (await res.json()) as { error?: { code?: string } };
  assert.equal(body.error?.code, "billing_disputed");
  assert.equal(customersCreate.calls.length, 0, "must not create a Stripe customer");
  assert.equal(
    sessionsCreate.calls.length,
    0,
    "must not create a Stripe checkout session",
  );
});

test("already_pro regression: an already-Pro (gift_code) entitlement stays blocked with 409 already_pro", async () => {
  currentEntitlement = {
    userId: "user-1",
    plan: "PRO",
    proSource: "gift_code",
    freeBookSlots: 2,
    unlockedBookIds: [],
  };

  const res = await POST(checkoutRequest());
  assert.equal(res.status, 409);
  const body = (await res.json()) as { error?: { code?: string } };
  assert.equal(body.error?.code, "already_pro");
  assert.equal(customersCreate.calls.length, 0, "must not create a Stripe customer");
  assert.equal(
    sessionsCreate.calls.length,
    0,
    "must not create a Stripe checkout session",
  );
});

test("happy path: an ordinary (no entitlement row) user still reaches Stripe Checkout", async () => {
  const res = await POST(checkoutRequest());
  await assertCheckoutSuccess(res);
  assert.equal(
    sessionsCreate.calls.length,
    1,
    "checkout session must be created exactly once",
  );
});

function existingCustomerEntitlement(): Record<string, unknown> {
  return {
    userId: "user-1",
    plan: "FREE",
    freeBookSlots: 2,
    unlockedBookIds: [],
    stripeCustomerId: "cus_existing",
  };
}

function createdSessionOptions(): {
  customer?: string;
  subscription_data?: { trial_period_days?: number };
} {
  assert.equal(sessionsCreate.calls.length, 1);
  return sessionsCreate.calls[0]?.[0] ?? {};
}

test("existing customer with empty history receives the canonical trial", async () => {
  currentEntitlement = existingCustomerEntitlement();

  const res = await POST(checkoutRequest());
  await assertCheckoutSuccess(res);
  assert.equal(subscriptionsList.calls.length, 1);
  assert.equal(customersCreate.calls.length, 0);
  const options = createdSessionOptions();
  assert.equal(options.customer, "cus_existing");
  assert.equal(
    options.subscription_data?.trial_period_days,
    PRICING.trialDays,
  );
});

async function assertSentToPortal(res: Response): Promise<void> {
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), {
    checkoutUrl: "https://stripe.test/portal",
    sessionId: "bps_test",
  });
  assert.equal(portalCreate.calls.length, 1);
  assert.equal(portalCreate.calls[0]?.[0]?.customer, "cus_existing");
  assert.equal(requireRecentAuth.calls.length, 1, "portal needs a recent sign-in");
  assert.equal(sessionsCreate.calls.length, 0, "must not create a second Checkout");
}

for (const status of ["active", "trialing", "past_due"] as const) {
  test(`existing customer with ${status} subscription is sent to the billing portal`, async () => {
    currentEntitlement = existingCustomerEntitlement();
    priorSubscriptions = [{ status }];

    const res = await POST(checkoutRequest());
    await assertSentToPortal(res);
    assert.equal(subscriptionsList.calls.length, 1);
    assert.equal(customersCreate.calls.length, 0);
  });
}

test("a Stripe-sourced Pro entitlement is sent to the billing portal", async () => {
  currentEntitlement = { ...existingCustomerEntitlement(), plan: "PRO", proSource: "stripe" };

  const res = await POST(checkoutRequest());
  await assertSentToPortal(res);
  assert.equal(customersCreate.calls.length, 0);
});

test("the portal branch asks for a fresh sign-in when the session is old", async () => {
  currentEntitlement = existingCustomerEntitlement();
  priorSubscriptions = [{ status: "active" }];
  recentAuth = false;

  const res = await POST(checkoutRequest());
  assert.equal(res.status, 401);
  const body = (await res.json()) as { error?: { code?: string } };
  assert.equal(body.error?.code, "reauth_required");
  assert.equal(portalCreate.calls.length, 0);
  assert.equal(sessionsCreate.calls.length, 0);
});

test("an open Checkout for the same interval is reused, not duplicated", async () => {
  currentEntitlement = existingCustomerEntitlement();
  openSessions = [
    {
      id: "cs_open",
      url: "https://stripe.test/open",
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      metadata: { userId: "user-1", interval: "monthly" },
    },
  ];

  const res = await POST(checkoutRequest());
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), {
    checkoutUrl: "https://stripe.test/open",
    sessionId: "cs_open",
  });
  assert.equal(sessionsCreate.calls.length, 0);
  assert.equal(sessionsExpire.calls.length, 0);
});

test("other open Checkouts are expired before a new one is created", async () => {
  currentEntitlement = existingCustomerEntitlement();
  openSessions = [
    {
      id: "cs_annual",
      url: "https://stripe.test/annual",
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      metadata: { userId: "user-1", interval: "annual" },
    },
  ];

  const res = await POST(checkoutRequest());
  await assertCheckoutSuccess(res);
  assert.deepEqual(
    sessionsExpire.calls.map((c) => c[0]),
    ["cs_annual"],
  );
  const options = createdSessionOptions() as { metadata?: Record<string, string> };
  assert.deepEqual(options.metadata, { userId: "user-1", interval: "monthly" });
});

for (const status of ["canceled", "incomplete_expired"] as const) {
  test(`existing customer with prior ${status} subscription gets no repeat trial`, async () => {
    currentEntitlement = existingCustomerEntitlement();
    priorSubscriptions = [{ status }];

    const res = await POST(checkoutRequest());
    await assertCheckoutSuccess(res);
    assert.equal(subscriptionsList.calls.length, 1);
    assert.equal(customersCreate.calls.length, 0);
    const options = createdSessionOptions();
    assert.equal(options.customer, "cus_existing");
    assert.equal("subscription_data" in options, false);
  });
}
