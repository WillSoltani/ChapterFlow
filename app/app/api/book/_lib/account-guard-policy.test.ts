import { test } from "node:test";
import assert from "node:assert/strict";
import { decideAccountAccess } from "./account-guard-policy";

test("active accounts are allowed", () => {
  assert.deepEqual(decideAccountAccess("active"), { action: "allow" });
});

test("missing status (no record) is treated as active → allow", () => {
  assert.deepEqual(decideAccountAccess(null), { action: "allow" });
  assert.deepEqual(decideAccountAccess(undefined), { action: "allow" });
});

test("deactivated accounts are reactivated, not blocked", () => {
  assert.deepEqual(decideAccountAccess("deactivated"), { action: "reactivate" });
});

test("deleted accounts are blocked", () => {
  assert.deepEqual(decideAccountAccess("deleted"), { action: "block" });
});

test("only 'deleted' ever blocks", () => {
  const statuses = ["active", "deactivated", "deleted"] as const;
  const blocked = statuses.filter((s) => decideAccountAccess(s).action === "block");
  assert.deepEqual(blocked, ["deleted"]);
});
