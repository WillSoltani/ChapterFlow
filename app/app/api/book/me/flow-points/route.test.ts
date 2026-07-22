import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { BookApiError } from "@/app/app/api/book/_lib/errors";
import {
  guardStub,
  installRouteHarness,
  makeSpy,
} from "@/tests/_lib/route-harness";

const guard = guardStub();
let currentEntitlement: unknown = null;

// http.ts (loaded real) does `error instanceof AuthError` — provide a class.
class StubAuthError extends Error {}

const getUserFlowPointsState = makeSpy(async () => ({
  points: 125,
  lifetimeEarned: 300,
  lifetimeSpent: 175,
}));
const getOrCreateUserReferralProfile = makeSpy(async () => ({
  inviteCode: "INVITE1",
  pendingInvites: 0,
  activatedInvites: 0,
  proInvites: 0,
  activationPointsEarned: 0,
  proPointsEarned: 0,
}));
const getUserRewardClaim = makeSpy(async () => null);
const listRecentFlowPointsLedger = makeSpy(async () => []);

const envStub = {
  getBookTableName: async () => "book-table-test",
  getAppBaseUrl: async () => "https://app.chapterflow.ca",
};

const harness = installRouteHarness({
  "@/app/app/api/book/_lib/account-guard": {
    requireActiveBookUser: guard.requireActiveBookUser,
  },
  "@/app/app/api/_lib/auth": { AuthError: StubAuthError },
  "@/app/app/api/book/_lib/env": envStub,
  "./env": envStub,
  "@/app/app/api/book/_lib/repo": {
    getUserEntitlement: async () => currentEntitlement,
  },
  "@/app/app/api/book/_lib/flow-points-repo": {
    getUserFlowPointsState,
    getOrCreateUserReferralProfile,
    getUserRewardClaim,
    listRecentFlowPointsLedger,
  },
});

let GET: typeof import("./route").GET;

before(async () => {
  ({ GET } = await import("./route"));
});

beforeEach(() => {
  guard.reset();
  currentEntitlement = null;
  getUserFlowPointsState.calls.length = 0;
  getOrCreateUserReferralProfile.calls.length = 0;
  getUserRewardClaim.calls.length = 0;
  listRecentFlowPointsLedger.calls.length = 0;
});

after(() => {
  harness.restore();
});

const FAKE_JWT = "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxIn0.sig";

function flowPointsRequest(): Request {
  return new Request(
    "https://app.chapterflow.ca/app/api/book/me/flow-points",
    { method: "GET", headers: { authorization: `Bearer ${FAKE_JWT}` } },
  );
}

async function errorCode(res: Response): Promise<string | undefined> {
  const body = (await res.json()) as { error?: { code?: string } };
  return body.error?.code;
}

test("happy GET: guard invoked once; balance fixture reaches the summary", async () => {
  const res = await GET(flowPointsRequest());
  assert.equal(res.status, 200);
  assert.equal(guard.requireActiveBookUser.calls.length, 1);
  const body = (await res.json()) as { summary?: { balance?: number } };
  assert.equal(body.summary?.balance, 125);
});

test("guard error maps to 403 account_deleted; no flow-points read", async () => {
  guard.setError(new BookApiError(403, "account_deleted", "deleted"));
  const res = await GET(flowPointsRequest());
  assert.equal(res.status, 403);
  assert.equal(await errorCode(res), "account_deleted");
  assert.equal(getUserFlowPointsState.calls.length, 0);
});

test("lifetime totals surface into the summary", async () => {
  const res = await GET(flowPointsRequest());
  assert.equal(res.status, 200);
  const body = (await res.json()) as {
    summary?: { lifetimeEarned?: number; lifetimeSpent?: number };
  };
  assert.equal(body.summary?.lifetimeEarned, 300);
  assert.equal(body.summary?.lifetimeSpent, 175);
});
