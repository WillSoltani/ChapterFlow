import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { BookApiError } from "@/app/app/api/book/_lib/errors";
import {
  guardStub,
  installRouteHarness,
  makeSpy,
} from "@/tests/_lib/route-harness";

const guard = guardStub();
let recentAuthError: BookApiError | null = null;
const requireRecentAuth = makeSpy((_user: unknown, _maxAgeMinutes: number) => {
  if (recentAuthError) throw recentAuthError;
});
const sessionsCreate = makeSpy(
  async (_options: { customer: string; return_url: string }) => ({
    url: "https://stripe.test/portal",
    id: "bps_test",
  }),
);
let currentEntitlement: unknown = null;

// http.ts (loaded real) does `error instanceof AuthError` — provide a class.
class StubAuthError extends Error {}

const envStub = {
  getBookTableName: async () => "book-table-test",
  getAppBaseUrl: async () => "https://app.chapterflow.ca",
};

const harness = installRouteHarness({
  "@/app/app/api/book/_lib/account-guard": {
    requireActiveBookUser: guard.requireActiveBookUser,
  },
  "@/app/app/api/_lib/auth": {
    AuthError: StubAuthError,
    requireRecentAuth,
  },
  "@/app/app/api/book/_lib/env": envStub,
  "./env": envStub,
  "@/app/app/api/book/_lib/stripe-service": {
    getStripeClient: async () => ({
      billingPortal: { sessions: { create: sessionsCreate } },
    }),
  },
  "@/app/app/api/book/_lib/repo": {
    getUserEntitlement: async () => currentEntitlement,
  },
});

let POST: typeof import("./route").POST;

before(async () => {
  ({ POST } = await import("./route"));
});

beforeEach(() => {
  guard.reset();
  recentAuthError = null;
  currentEntitlement = null;
  requireRecentAuth.calls.length = 0;
  sessionsCreate.calls.length = 0;
});

after(() => {
  harness.restore();
});

const FAKE_JWT = "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxIn0.sig";

function portalRequest(): Request {
  // Bearer-native shape short-circuits requireSameOrigin in the REAL http.ts.
  return new Request(
    "https://app.chapterflow.ca/app/api/book/billing/portal-session",
    { method: "POST", headers: { authorization: `Bearer ${FAKE_JWT}` } },
  );
}

async function errorCode(res: Response): Promise<string | undefined> {
  const body = (await res.json()) as { error?: { code?: string } };
  return body.error?.code;
}

test("happy path mints a portal session; guard + step-up invoked", async () => {
  currentEntitlement = { stripeCustomerId: "cus_1" };
  const res = await POST(portalRequest());
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { portalUrl: "https://stripe.test/portal" });
  assert.equal(guard.requireActiveBookUser.calls.length, 1);
  assert.equal(requireRecentAuth.calls[0][1], 10); // PORTAL_MAX_AUTH_AGE_MINUTES
  assert.deepEqual(sessionsCreate.calls[0][0], {
    customer: "cus_1",
    return_url: "https://app.chapterflow.ca/book/settings",
  });
});

test("guard error maps to 403 account_deleted; Stripe never called", async () => {
  guard.setError(new BookApiError(403, "account_deleted", "deleted"));
  const res = await POST(portalRequest());
  assert.equal(res.status, 403);
  assert.equal(await errorCode(res), "account_deleted");
  assert.equal(sessionsCreate.calls.length, 0);
});

test("step-up recency error propagates through withBookApiErrors", async () => {
  recentAuthError = new BookApiError(401, "reauth_required", "Sign in again.");
  currentEntitlement = { stripeCustomerId: "cus_1" };
  const res = await POST(portalRequest());
  assert.equal(res.status, 401);
  assert.equal(await errorCode(res), "reauth_required");
  assert.equal(sessionsCreate.calls.length, 0);
});

test("apple-source entitlement without a Stripe customer -> 400 not_stripe_subscriber", async () => {
  currentEntitlement = { proSource: "apple" };
  const res = await POST(portalRequest());
  assert.equal(res.status, 400);
  assert.equal(await errorCode(res), "not_stripe_subscriber");
  assert.equal(sessionsCreate.calls.length, 0);
});

test("no entitlement -> 400 customer_not_found", async () => {
  currentEntitlement = null;
  const res = await POST(portalRequest());
  assert.equal(res.status, 400);
  assert.equal(await errorCode(res), "customer_not_found");
  assert.equal(sessionsCreate.calls.length, 0);
});
