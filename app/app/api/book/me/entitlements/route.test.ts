import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import {
  installRouteHarness,
  makeSpy,
} from "@/tests/_lib/route-harness";

let authError: Error | null = null;
let currentEntitlement: unknown = null;

// http.ts (loaded real) maps `error instanceof AuthError` -> 401 unauthenticated.
class StubAuthError extends Error {}

const requireUser = makeSpy(async () => {
  if (authError) throw authError;
  return { sub: "user-1", email: "user@test" };
});

const envStub = {
  getBookTableName: async () => "book-table-test",
  getBookFreeSlotsDefault: async () => 1,
  getBookPaywallPriceDisplay: async () => "$9.99/mo",
  getBookStripePriceIdAnnual: async () => undefined,
  getBookStripePriceIdAnnualUpfront: async () => undefined,
  getAppBaseUrl: async () => "https://app.chapterflow.ca",
};

const harness = installRouteHarness({
  "@/app/app/api/_lib/auth": { AuthError: StubAuthError, requireUser },
  "@/app/app/api/book/_lib/env": envStub,
  "./env": envStub,
  "@/app/app/api/book/_lib/repo": {
    getUserEntitlement: async () => currentEntitlement,
  },
});

let GET: typeof import("./route").GET;

before(async () => {
  ({ GET } = await import("./route"));
});

beforeEach(() => {
  authError = null;
  currentEntitlement = null;
  requireUser.calls.length = 0;
});

after(() => {
  harness.restore();
});

const FAKE_JWT = "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxIn0.sig";

function entitlementsRequest(): Request {
  return new Request(
    "https://app.chapterflow.ca/app/api/book/me/entitlements",
    { method: "GET", headers: { authorization: `Bearer ${FAKE_JWT}` } },
  );
}

async function errorCode(res: Response): Promise<string | undefined> {
  const body = (await res.json()) as { error?: { code?: string } };
  return body.error?.code;
}

test("happy path: requireUser invoked once; 200", async () => {
  currentEntitlement = { plan: "PRO", proStatus: "active" };
  const res = await GET(entitlementsRequest());
  assert.equal(res.status, 200);
  assert.equal(requireUser.calls.length, 1);
});

test("AuthError maps to 401 unauthenticated (real http.ts instanceof seam)", async () => {
  authError = new StubAuthError("no token");
  const res = await GET(entitlementsRequest());
  assert.equal(res.status, 401);
  assert.equal(await errorCode(res), "unauthenticated");
});

test("null entitlement -> 200 with the FREE-plan default body", async () => {
  currentEntitlement = null;
  const res = await GET(entitlementsRequest());
  assert.equal(res.status, 200);
  const body = (await res.json()) as {
    entitlement?: { plan?: string; proStatus?: string };
  };
  assert.equal(body.entitlement?.plan, "FREE");
  assert.equal(body.entitlement?.proStatus, "inactive");
});

test("PRO entitlement -> 200 body reflects PRO/active", async () => {
  currentEntitlement = { plan: "PRO", proStatus: "active", proSource: "stripe" };
  const res = await GET(entitlementsRequest());
  assert.equal(res.status, 200);
  const body = (await res.json()) as {
    entitlement?: { plan?: string; proStatus?: string; proSource?: string };
  };
  assert.equal(body.entitlement?.plan, "PRO");
  assert.equal(body.entitlement?.proStatus, "active");
  assert.equal(body.entitlement?.proSource, "stripe");
});
