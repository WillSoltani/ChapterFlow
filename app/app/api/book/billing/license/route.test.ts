import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { BookApiError } from "@/app/app/api/book/_lib/errors";
import {
  guardStub,
  installRouteHarness,
  makeSpy,
} from "@/tests/_lib/route-harness";

const guard = guardStub();
let currentLicenseKey: unknown = null;
let currentEntitlement: unknown = null;
const redeemSpy = makeSpy(
  async (
    _table: string,
    _params: { code: string; userId: string; validMonths: number },
  ) => {},
);

// http.ts (loaded real) does `error instanceof AuthError` — provide a class.
class StubAuthError extends Error {}

const envStub = {
  getBookTableName: async () => "book-table-test",
  getBookAnalyticsTableName: async () => "analytics-table-test",
  getBookFreeSlotsDefault: async () => 1,
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
    getLicenseKey: async () => currentLicenseKey,
    getUserEntitlement: async () => currentEntitlement,
    redeemLicenseKey: redeemSpy,
  },
  "@/app/app/api/book/_lib/analytics-repo": {
    analyticsTrackLicenseAttempt: async () => {},
  },
});

let POST: typeof import("./route").POST;

before(async () => {
  ({ POST } = await import("./route"));
});

beforeEach(() => {
  guard.reset();
  currentLicenseKey = null;
  currentEntitlement = null;
  redeemSpy.calls.length = 0;
});

after(() => {
  harness.restore();
});

const FAKE_JWT = "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxIn0.sig";

function licenseRequest(body?: string): Request {
  return new Request(
    "https://app.chapterflow.ca/app/api/book/billing/license",
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${FAKE_JWT}`,
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(body === undefined ? {} : { body }),
    },
  );
}

async function errorCode(res: Response): Promise<string | undefined> {
  const body = (await res.json()) as { error?: { code?: string } };
  return body.error?.code;
}

const VALID_KEY = "CF-ABCD-1234-WXYZ";

test("happy redeem: guard invoked once, key reaches redeemLicenseKey", async () => {
  currentLicenseKey = { status: "available", validMonths: 12 };
  const res = await POST(licenseRequest(JSON.stringify({ code: VALID_KEY })));
  assert.equal(res.status, 200);
  assert.equal(guard.requireActiveBookUser.calls.length, 1);
  assert.equal(redeemSpy.calls.length, 1);
  // field-reaches-core seam: the parsed, normalized key is redeemed.
  assert.equal(redeemSpy.calls[0][1].code, VALID_KEY);
  assert.equal(redeemSpy.calls[0][1].userId, "user-1");
});

test("guard error maps to 403 account_deleted; key never redeemed", async () => {
  guard.setError(new BookApiError(403, "account_deleted", "deleted"));
  const res = await POST(licenseRequest(JSON.stringify({ code: VALID_KEY })));
  assert.equal(res.status, 403);
  assert.equal(await errorCode(res), "account_deleted");
  assert.equal(redeemSpy.calls.length, 0);
});

test("malformed code -> 400 invalid_code_format; never redeems", async () => {
  const res = await POST(licenseRequest(JSON.stringify({ code: "not-a-key" })));
  assert.equal(res.status, 400);
  assert.equal(await errorCode(res), "invalid_code_format");
  assert.equal(redeemSpy.calls.length, 0);
});

test("unknown key -> 404 invalid_code; never redeems", async () => {
  currentLicenseKey = null;
  const res = await POST(licenseRequest(JSON.stringify({ code: VALID_KEY })));
  assert.equal(res.status, 404);
  assert.equal(await errorCode(res), "invalid_code");
  assert.equal(redeemSpy.calls.length, 0);
});

test("already-redeemed key -> 409 code_already_redeemed; never redeems again", async () => {
  currentLicenseKey = { status: "redeemed", validMonths: 12 };
  const res = await POST(licenseRequest(JSON.stringify({ code: VALID_KEY })));
  assert.equal(res.status, 409);
  assert.equal(await errorCode(res), "code_already_redeemed");
  assert.equal(redeemSpy.calls.length, 0);
});
