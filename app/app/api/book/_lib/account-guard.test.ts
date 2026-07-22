import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { BookApiError } from "@/app/app/api/book/_lib/errors";

const require = createRequire(import.meta.url);
const Module = require("node:module") as {
  _load: (
    request: string,
    parent: { filename?: string } | undefined,
    isMain: boolean,
  ) => unknown;
};
const originalLoad = Module._load;

type AuthedUserShape = { sub: string; email: string; groups?: string[] };

let currentUser: AuthedUserShape = { sub: "u-default", email: "u@test" };
let getAccountStatusImpl: (
  tableName: string,
  userId: string,
) => Promise<{ status: string } | null> = async () => ({ status: "active" });
const setAccountStatusCalls: unknown[][] = [];

Module._load = function patchedLoad(request, parent, isMain) {
  if (request === "server-only") return {};
  if (request === "@/app/app/api/_lib/auth") {
    return { requireUser: async () => currentUser };
  }
  if (request === "@/app/app/_lib/dev-auth-bypass") {
    // MUST be false, else account-guard.ts:78 `if (isDevAuthBypassEnabled())
    // return user;` skips the whole gate.
    return { isDevAuthBypassEnabled: () => false };
  }
  // Relative stubs ONLY for imports made by account-guard.ts itself.
  // endsWith, not includes: account-guard-policy.ts also contains the
  // substring "account-guard" and must load its real deps.
  const parentFile = parent?.filename ?? "";
  if (parentFile.endsWith("account-guard.ts")) {
    if (request === "./env") {
      return { getBookTableName: async () => "test-table" };
    }
    if (request === "./repo") {
      return {
        getAccountStatus: (tableName: string, userId: string) =>
          getAccountStatusImpl(tableName, userId),
        setAccountStatus: async (...args: unknown[]) => {
          setAccountStatusCalls.push(args);
        },
      };
    }
  }
  return originalLoad.call(this, request, parent, isMain);
};

// Static imports hoist — the module under test may ONLY be imported
// dynamically, after the patch above (see auth.test.ts:15-16).
let requireActiveBookUser: typeof import("./account-guard").requireActiveBookUser;

before(async () => {
  ({ requireActiveBookUser } = await import("./account-guard"));
});

beforeEach(() => {
  setAccountStatusCalls.length = 0;
  getAccountStatusImpl = async () => ({ status: "active" });
});

after(() => {
  Module._load = originalLoad;
});

test("active status returns the user without a reactivation write", async () => {
  currentUser = { sub: "u-active", email: "u@test" };
  getAccountStatusImpl = async () => ({ status: "active" });
  const user = await requireActiveBookUser();
  assert.equal(user, currentUser);
  assert.equal(setAccountStatusCalls.length, 0);
});

test("deleted status throws BookApiError 403 account_deleted", async () => {
  currentUser = { sub: "u-deleted", email: "u@test" };
  getAccountStatusImpl = async () => ({ status: "deleted" });
  await assert.rejects(requireActiveBookUser(), (err: unknown) => {
    assert.ok(err instanceof BookApiError);
    assert.equal(err.status, 403);
    assert.equal(err.code, "account_deleted");
    return true;
  });
  assert.equal(setAccountStatusCalls.length, 0);
});

test("deactivated status auto-reactivates and returns the user", async () => {
  currentUser = { sub: "u-deactivated", email: "u@test" };
  getAccountStatusImpl = async () => ({ status: "deactivated" });
  const user = await requireActiveBookUser();
  assert.equal(user, currentUser);
  // account-guard.ts:89-91
  assert.deepEqual(setAccountStatusCalls, [
    ["test-table", "u-deactivated", "active", { statusReason: "user_reactivated" }],
  ]);
});

test("status read error fails OPEN for a user never seen as deleted", async () => {
  currentUser = { sub: "u-outage", email: "u@test" };
  getAccountStatusImpl = async () => {
    throw new Error("dynamodb unavailable");
  };
  // account-guard.ts:110-116
  assert.equal(await requireActiveBookUser(), currentUser);
});

test("status read error fails CLOSED for a recently-deleted user", async () => {
  currentUser = { sub: "u-known-deleted", email: "u@test" };
  getAccountStatusImpl = async () => ({ status: "deleted" });
  await assert.rejects(requireActiveBookUser()); // primes knownDeleted (:52-59/:85)
  getAccountStatusImpl = async () => {
    throw new Error("dynamodb unavailable");
  };
  await assert.rejects(requireActiveBookUser(), (err: unknown) => {
    assert.ok(err instanceof BookApiError);
    assert.equal(err.status, 403);
    assert.equal(err.code, "account_deleted"); // fail-closed branch :99-109
    return true;
  });
});

test("a non-deleted read clears the deleted cache so a later error fails open", async () => {
  currentUser = { sub: "u-restored", email: "u@test" };
  getAccountStatusImpl = async () => ({ status: "deleted" });
  await assert.rejects(requireActiveBookUser()); // primes cache
  getAccountStatusImpl = async () => ({ status: "active" });
  assert.equal(await requireActiveBookUser(), currentUser); // clears cache (:56-58)
  getAccountStatusImpl = async () => {
    throw new Error("dynamodb unavailable");
  };
  assert.equal(await requireActiveBookUser(), currentUser); // fails OPEN again
});
