import { test } from "node:test";
import assert from "node:assert/strict";
import { isUserInAdminGroup } from "./admin-group-core";

test("user whose groups include the admin group is an admin", () => {
  assert.equal(isUserInAdminGroup(["admin"], "admin"), true);
  assert.equal(isUserInAdminGroup(["readers", "admin", "beta"], "admin"), true);
});

test("user without the admin group is NOT an admin", () => {
  assert.equal(isUserInAdminGroup(["readers"], "admin"), false);
  assert.equal(isUserInAdminGroup([], "admin"), false);
});

test("missing groups array (synthetic dev-bypass user / no cognito:groups claim) is NOT an admin", () => {
  assert.equal(isUserInAdminGroup(undefined, "admin"), false);
});

test("a custom (non-default) admin group name is honored", () => {
  assert.equal(isUserInAdminGroup(["staff"], "staff"), true);
  assert.equal(isUserInAdminGroup(["admin"], "staff"), false);
});

test("an empty/whitespace admin group name never matches (misconfig must NOT grant admin to everyone)", () => {
  assert.equal(isUserInAdminGroup(["admin"], ""), false);
  assert.equal(isUserInAdminGroup(["admin"], "   "), false);
  assert.equal(isUserInAdminGroup([""], ""), false);
});

test("group match is exact, not substring", () => {
  assert.equal(isUserInAdminGroup(["administrators"], "admin"), false);
  assert.equal(isUserInAdminGroup(["superadmin"], "admin"), false);
});

// Regression guard for the cluster: the OLD settings-page logic derived admin
// status from `process.env.ADMIN_SUBS` / `ADMIN_EMAILS`. Those vars are never
// injected into the prod Lambda, so the only correct signal is group membership
// carried on the verified token. A user who IS in the Cognito admin group but
// whose sub/email would NOT appear in any env allowlist must still be admin —
// this is exactly the prod case the old code got wrong.
test("admin-by-Cognito-group does not depend on any env allowlist", () => {
  const cognitoAdmin = {
    sub: "not-in-any-env-allowlist",
    email: "owner@example.com",
    groups: ["admin"],
  };
  assert.equal(isUserInAdminGroup(cognitoAdmin.groups, "admin"), true);
});
