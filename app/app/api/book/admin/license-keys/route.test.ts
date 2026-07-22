import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { BookApiError } from "@/app/app/api/book/_lib/errors";
import {
  guardStub,
  installRouteHarness,
  makeSpy,
} from "@/tests/_lib/route-harness";

const guard = guardStub();

// http.ts (loaded real) does `error instanceof AuthError` — provide a class.
class StubAuthError extends Error {}

const listLicenseKeys = makeSpy(async () => [
  { key: "LK-1", status: "available" },
]);

const envStub = {
  getBookTableName: async () => "book-table-test",
  getAppBaseUrl: async () => "https://app.chapterflow.ca",
};

const harness = installRouteHarness({
  "@/app/app/api/book/_lib/admin-auth": {
    requireAdminUser: guard.requireAdminUser,
  },
  "@/app/app/api/_lib/auth": { AuthError: StubAuthError },
  "@/app/app/api/book/_lib/env": envStub,
  "./env": envStub,
  "@/app/app/api/book/_lib/repo": {
    listLicenseKeys,
  },
});

let GET: typeof import("./route").GET;

before(async () => {
  ({ GET } = await import("./route"));
});

beforeEach(() => {
  guard.reset();
  listLicenseKeys.calls.length = 0;
});

after(() => {
  harness.restore();
});

const FAKE_JWT = "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxIn0.sig";

function adminRequest(): Request {
  return new Request(
    "https://app.chapterflow.ca/app/api/book/admin/license-keys",
    { method: "GET", headers: { authorization: `Bearer ${FAKE_JWT}` } },
  );
}

async function errorCode(res: Response): Promise<string | undefined> {
  const body = (await res.json()) as { error?: { code?: string } };
  return body.error?.code;
}

test("happy path: admin guard invoked once; 200 with the key inventory", async () => {
  const res = await GET(adminRequest());
  assert.equal(res.status, 200);
  assert.equal(guard.requireAdminUser.calls.length, 1);
  const body = (await res.json()) as {
    keys?: Array<{ key?: string }>;
    summary?: { total?: number };
  };
  assert.equal(body.keys?.[0]?.key, "LK-1");
  assert.equal(body.summary?.total, 1);
});

test("non-admin -> 403 forbidden; keys never listed", async () => {
  guard.setError(
    new BookApiError(403, "forbidden", "Admin access is required."),
  );
  const res = await GET(adminRequest());
  assert.equal(res.status, 403);
  assert.equal(await errorCode(res), "forbidden");
  assert.equal(listLicenseKeys.calls.length, 0);
});

test("deleted account -> 403 account_deleted (lifecycle precedes group)", async () => {
  guard.setError(new BookApiError(403, "account_deleted", "deleted"));
  const res = await GET(adminRequest());
  assert.equal(res.status, 403);
  assert.equal(await errorCode(res), "account_deleted");
  assert.equal(listLicenseKeys.calls.length, 0);
});
