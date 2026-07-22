import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveAuthStateSecret } from "./state-crypto-core";

test("AUTH_STATE_SECRET is resolved through the server runtime resolver", async () => {
  const requested: string[] = [];
  const value = await resolveAuthStateSecret(async (name) => {
    requested.push(name);
    return "x".repeat(32);
  });

  assert.equal(value.length, 32);
  assert.deepEqual(requested, ["AUTH_STATE_SECRET"]);
});

test("missing and malformed AUTH_STATE_SECRET values fail without exposing values", async () => {
  const marker = "short-placeholder";
  for (const value of [undefined, "", marker]) {
    await assert.rejects(
      () => resolveAuthStateSecret(async () => value),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /AUTH_STATE_SECRET/);
        assert.doesNotMatch(error.message, new RegExp(marker));
        return true;
      },
    );
  }
});

test("AUTH_STATE_SECRET resolver errors propagate fail closed", async () => {
  const denied = Object.assign(new Error("access denied"), {
    name: "AccessDeniedException",
  });
  await assert.rejects(
    () =>
      resolveAuthStateSecret(async () => {
        throw denied;
      }),
    denied,
  );
});
