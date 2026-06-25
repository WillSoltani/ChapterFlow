import { test } from "node:test";
import assert from "node:assert/strict";
import { isStripeSignatureVerificationError } from "./webhook-signature-core";

// ─── isStripeSignatureVerificationError — the 400-vs-500 webhook decision ──────
//
// Regression for the "webhook-sig-error-status" leak: a signature-verification
// failure must map to HTTP 400 (Stripe does NOT retry, the StripeWebhookFailure
// ops alarm does NOT fire). The OLD heuristic — `err.message.includes("signature")`
// — missed two of the five StripeSignatureVerificationError variants, so a
// clock-skewed/replayed delivery ("Timestamp outside the tolerance zone") or an
// empty body ("No webhook payload was provided.") leaked out as a 500, triggering
// up to 3 days of Stripe retries + a false ops alarm. Detection is now by the
// SDK's stable `type` discriminator, which is present on ALL five variants.

/**
 * Mirror of `StripeSignatureVerificationError`'s observable shape: it extends
 * `StripeError`, which stamps `type = 'StripeSignatureVerificationError'` on
 * every instance. We don't import the Stripe SDK here (the core is pure and the
 * route is server-only); we reproduce exactly the shape the route observes.
 */
function makeSignatureError(message: string): Error & { type: string } {
  const err = new Error(message) as Error & { type: string };
  err.type = "StripeSignatureVerificationError";
  return err;
}

// The five exact messages `constructEvent` throws (Stripe Node SDK Webhooks.js).
// The two marked NO-SUBSTRING are the regression cases the old heuristic missed.
const SIGNATURE_ERROR_MESSAGES: Array<{ message: string; hasSubstring: boolean }> = [
  { message: "No webhook payload was provided.", hasSubstring: false }, // NO-SUBSTRING
  { message: "Unable to extract timestamp and signatures from header", hasSubstring: true },
  { message: "No signatures found with expected scheme", hasSubstring: true },
  {
    message:
      "No signatures found matching the expected signature for payload." +
      " Are you passing the raw request body you received from Stripe?",
    hasSubstring: true,
  },
  { message: "Timestamp outside the tolerance zone", hasSubstring: false }, // NO-SUBSTRING
];

test("ALL five StripeSignatureVerificationError variants → classified as signature failure (400)", () => {
  for (const { message } of SIGNATURE_ERROR_MESSAGES) {
    assert.equal(
      isStripeSignatureVerificationError(makeSignatureError(message)),
      true,
      `should classify by type, not message text: "${message}"`,
    );
  }
});

test("REGRESSION: substring-less variants are caught (the bug) — these used to leak as 500", () => {
  // The two cases the old `message.includes("signature")` heuristic missed.
  // Pre-fix these returned 500 → Stripe retried for days + false ops alarm.
  const tolerance = makeSignatureError("Timestamp outside the tolerance zone");
  const noPayload = makeSignatureError("No webhook payload was provided.");
  assert.equal(tolerance.message.includes("signature"), false, "guards the premise of the bug");
  assert.equal(noPayload.message.includes("signature"), false, "guards the premise of the bug");
  assert.equal(isStripeSignatureVerificationError(tolerance), true);
  assert.equal(isStripeSignatureVerificationError(noPayload), true);
});

test("type discriminator wins even when the message has no signature substring", () => {
  // Belt-and-suspenders: an empty/odd message but the canonical type is still a
  // signature failure.
  const err = makeSignatureError("");
  assert.equal(isStripeSignatureVerificationError(err), true);
});

test("genuine server error (no signature type, no substring) → NOT a signature failure (500)", () => {
  // A DynamoDB/SDK/transport blip must still bubble as 500 so Stripe retries.
  const dynamoErr = new Error("ProvisionedThroughputExceededException");
  (dynamoErr as Error & { name: string }).name = "ProvisionedThroughputExceededException";
  assert.equal(isStripeSignatureVerificationError(dynamoErr), false);

  const genericErr = new Error("Something exploded on the server");
  assert.equal(isStripeSignatureVerificationError(genericErr), false);
});

test("defensive substring fallback still catches a 'signature' message lacking the type", () => {
  // If a future SDK reshapes `type` but keeps a signature-mentioning message,
  // the historical heuristic still classifies it correctly.
  const err = new Error("No signatures found with expected scheme");
  assert.equal(isStripeSignatureVerificationError(err), true);
});

test("non-error inputs are safe (null / undefined / string / number)", () => {
  assert.equal(isStripeSignatureVerificationError(null), false);
  assert.equal(isStripeSignatureVerificationError(undefined), false);
  assert.equal(isStripeSignatureVerificationError("Timestamp outside the tolerance zone"), false);
  assert.equal(isStripeSignatureVerificationError(42), false);
  assert.equal(isStripeSignatureVerificationError({}), false);
});
