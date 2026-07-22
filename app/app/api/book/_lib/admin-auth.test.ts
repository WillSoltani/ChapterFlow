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

// AuthedUser shape from @/app/app/api/_lib/auth: { sub, email, groups? }.
type AuthedUserShape = { sub: string; email: string; groups?: string[] };

let currentUser: AuthedUserShape = { sub: "u1", email: "u@test", groups: [] };
let guardError: BookApiError | null = null;
let adminGroupNameCalls = 0;

Module._load = function patchedLoad(request, parent, isMain) {
  if (request === "server-only") return {};
  const parentFile = parent?.filename ?? "";
  if (parentFile.endsWith("admin-auth.ts")) {
    if (request === "./account-guard") {
      return {
        requireActiveBookUser: async () => {
          if (guardError) throw guardError;
          return currentUser;
        },
      };
    }
    if (request === "./env") {
      return {
        getBookAdminGroupName: async () => {
          adminGroupNameCalls += 1;
          return "admins-test";
        },
      };
    }
  }
  return originalLoad.call(this, request, parent, isMain);
};

let requireAdminUser: typeof import("./admin-auth").requireAdminUser;

before(async () => {
  ({ requireAdminUser } = await import("./admin-auth"));
});

beforeEach(() => {
  guardError = null;
  adminGroupNameCalls = 0;
});

after(() => {
  Module._load = originalLoad;
});

test("throws 403 forbidden for a non-admin-group user", async () => {
  currentUser = { sub: "u1", email: "u@test", groups: ["users"] };
  await assert.rejects(requireAdminUser(), (err: unknown) => {
    assert.ok(err instanceof BookApiError);
    assert.equal(err.status, 403);
    assert.equal(err.code, "forbidden"); // admin-auth.ts:12
    return true;
  });
});

test("returns the user when in the admin group", async () => {
  currentUser = { sub: "u2", email: "admin@test", groups: ["admins-test"] };
  assert.equal(await requireAdminUser(), currentUser);
});

test("lifecycle gate runs before the group check", async () => {
  guardError = new BookApiError(
    403,
    "account_deleted",
    "This account has been deleted.",
  );
  await assert.rejects(requireAdminUser(), (err: unknown) => {
    assert.ok(err instanceof BookApiError);
    assert.equal(err.code, "account_deleted");
    return true;
  });
  // Order proven by admin-auth.ts:9 (guard) before :10 (group lookup).
  assert.equal(adminGroupNameCalls, 0);
});
