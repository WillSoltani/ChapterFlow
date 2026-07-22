import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { BookApiError } from "@/app/app/api/book/_lib/errors";
import {
  guardStub,
  installRouteHarness,
  makeSpy,
} from "@/tests/_lib/route-harness";

const guard = guardStub();
let verifyResult: unknown = { plan: "PRO", proStatus: "active" };
let verifyError: BookApiError | null = null;
const verifySpy = makeSpy(async (_args: { userId: string; transactionJws: string }) => {
  if (verifyError) throw verifyError;
  return verifyResult;
});

// http.ts (loaded real) does `error instanceof AuthError` — provide a class.
class StubAuthError extends Error {}

const envStub = {
  getBookTableName: async () => "book-table-test",
  getAppBaseUrl: async () => "https://app.chapterflow.ca",
};

const appleEnvStub = {
  getAppleIapConfig: async () => ({}),
  verifyAppleTransactionJwsForUser: async () => ({}),
  getAppleIssuerId: async () => "issuer-test",
};

const harness = installRouteHarness({
  "@/app/app/api/book/_lib/account-guard": {
    requireActiveBookUser: guard.requireActiveBookUser,
  },
  "@/app/app/api/_lib/auth": { AuthError: StubAuthError },
  "@/app/app/api/book/_lib/env": envStub,
  "./env": envStub,
  "@/app/app/api/book/_lib/apple-env": appleEnvStub,
  "@/app/app/api/book/_lib/apple-verify-service-core": {
    verifyAppleTransactionForUser: verifySpy,
  },
  "@/app/app/api/book/_lib/repo": {
    claimAppleTransactionForUser: async () => {},
    updateUserEntitlementFromApple: async () => {},
    getUserEntitlement: async () => null,
    getAppleTransactionClaim: async () => null,
  },
});

let POST: typeof import("./route").POST;

before(async () => {
  ({ POST } = await import("./route"));
});

beforeEach(() => {
  guard.reset();
  verifyResult = { plan: "PRO", proStatus: "active" };
  verifyError = null;
  verifySpy.calls.length = 0;
});

after(() => {
  harness.restore();
});

const FAKE_JWT = "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxIn0.sig";

function verifyRequest(body?: string): Request {
  return new Request(
    "https://app.chapterflow.ca/app/api/book/me/billing/apple/verify",
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

test("happy path: guard invoked, JWS reaches the verify service", async () => {
  const res = await POST(
    verifyRequest(JSON.stringify({ transactionJWS: "jws-abc" })),
  );
  assert.equal(res.status, 200);
  assert.equal(guard.requireActiveBookUser.calls.length, 1);
  assert.equal(verifySpy.calls.length, 1);
  // field-reaches-core seam: the parsed transactionJWS is handed to the service.
  assert.equal(verifySpy.calls[0][0].transactionJws, "jws-abc");
  assert.equal(verifySpy.calls[0][0].userId, "user-1");
});

test("guard error maps to 403 account_deleted; verify never called", async () => {
  guard.setError(new BookApiError(403, "account_deleted", "deleted"));
  const res = await POST(
    verifyRequest(JSON.stringify({ transactionJWS: "jws-abc" })),
  );
  assert.equal(res.status, 403);
  assert.equal(await errorCode(res), "account_deleted");
  assert.equal(verifySpy.calls.length, 0);
});

test("missing body -> 400 invalid_json; verify never called", async () => {
  const res = await POST(verifyRequest());
  assert.equal(res.status, 400);
  assert.equal(await errorCode(res), "invalid_json");
  assert.equal(verifySpy.calls.length, 0);
});

test("missing transactionJWS field -> 400 invalid_input; verify never called", async () => {
  const res = await POST(verifyRequest(JSON.stringify({ notJws: "x" })));
  assert.equal(res.status, 400);
  assert.equal(await errorCode(res), "invalid_input");
  assert.equal(verifySpy.calls.length, 0);
});

test("verify-service BookApiError propagates through the envelope", async () => {
  verifyError = new BookApiError(
    409,
    "transaction_owned_by_other",
    "This purchase belongs to a different account.",
  );
  const res = await POST(
    verifyRequest(JSON.stringify({ transactionJWS: "jws-abc" })),
  );
  assert.equal(res.status, 409);
  assert.equal(await errorCode(res), "transaction_owned_by_other");
});
