import { test, before } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

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
const subscriptionsList = makeSpy(async () => ({ data: [] as unknown[] }));
const sessionsCreate = makeSpy(async () => ({
  url: "https://stripe.test/session",
  id: "cs_test",
}));

const stripeSpy = {
  customers: { create: customersCreate, del: customersDel },
  subscriptions: { list: subscriptionsList },
  checkout: { sessions: { create: sessionsCreate } },
};

// Mutable per-test entitlement returned by the stubbed repo.
let currentEntitlement: unknown = null;

Module._load = function patchedLoad(
  request: string,
  parent: unknown,
  isMain: boolean,
) {
  if (request === "server-only") return {};

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
}

test("WS4-015: a disputed entitlement is rejected with 409 billing_disputed before any Stripe call", async () => {
  resetStripeSpy();
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
  resetStripeSpy();
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
  resetStripeSpy();
  currentEntitlement = null;

  const res = await POST(checkoutRequest());
  assert.equal(res.status, 200);
  const body = (await res.json()) as { checkoutUrl?: string };
  assert.equal(body.checkoutUrl, "https://stripe.test/session");
  assert.equal(
    sessionsCreate.calls.length,
    1,
    "checkout session must be created exactly once",
  );
});
