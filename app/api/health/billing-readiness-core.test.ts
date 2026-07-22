import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveBillingSecretReadiness } from "./billing-readiness-core";

test("billing readiness resolves both Stripe secrets through the runtime resolver", async () => {
  const requested: string[] = [];
  const ready = await resolveBillingSecretReadiness(async (name) => {
    requested.push(name);
    return "synthetic-present-value";
  });

  assert.equal(ready, true);
  assert.deepEqual(requested.sort(), [
    "BOOK_STRIPE_SECRET_KEY",
    "BOOK_STRIPE_WEBHOOK_SECRET",
  ]);
});

test("billing readiness fails closed on missing, blank, or denied runtime secrets", async () => {
  assert.equal(
    await resolveBillingSecretReadiness(async () => undefined),
    false,
  );
  assert.equal(
    await resolveBillingSecretReadiness(async () => "   "),
    false,
  );
  await assert.rejects(() =>
    resolveBillingSecretReadiness(async () => {
      throw Object.assign(new Error("access denied"), {
        name: "AccessDeniedException",
      });
    }),
  );
});
