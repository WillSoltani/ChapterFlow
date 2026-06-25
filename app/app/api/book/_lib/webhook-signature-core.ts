/**
 * Pure decision for whether a thrown `stripe.webhooks.constructEvent` error is a
 * Stripe SIGNATURE-VERIFICATION failure (a client error → HTTP 400) versus a
 * genuine server error (→ HTTP 500 so Stripe retries).
 *
 * ## Why this module exists (the bug it fixes)
 *
 * The webhook route used to classify a verification failure as a 400 ONLY when
 * `err.message.includes("signature")`. But the Stripe SDK's `constructEvent`
 * throws `StripeSignatureVerificationError` with FIVE distinct messages, two of
 * which contain NO "signature" substring (Stripe Node SDK Webhooks.js):
 *
 *   - "No webhook payload was provided."            (empty body)       ← no match
 *   - "Unable to extract timestamp and signatures from header"          ← matches
 *   - "No signatures found with expected scheme"                        ← matches
 *   - "No signatures found matching the expected signature for payload" ← matches
 *   - "Timestamp outside the tolerance zone"        (clock skew/replay) ← no match
 *
 * The two non-matching cases bubbled out as HTTP 500. Concretely, a
 * clock-skewed or replayed delivery (or a malformed empty body) returned 500,
 * which Stripe treats as "delivery failed" → it RETRIES for up to 3 days AND the
 * frontend `StripeWebhookFailure` ops alarm fires on a non-actionable client
 * error. The fix detects the failure by the error's TYPE, not its message text.
 *
 * `StripeSignatureVerificationError` extends `StripeError`, which sets a stable
 * `type` discriminator string (`error.type === 'StripeSignatureVerificationError'`)
 * on every instance — this is the canonical, message-independent, SDK-version-
 * stable signal for all five variants.
 *
 * Pure and dependency-free (operates on the error's shape, not the Stripe
 * constructor) so it is unit-testable without the Stripe SDK — the route is
 * `server-only` and cannot be imported by the node:test runner (the repo's
 * documented `*-core` seam pattern).
 */

/** The discriminator the Stripe SDK stamps on a signature-verification error. */
const SIGNATURE_VERIFICATION_ERROR_TYPE = "StripeSignatureVerificationError";

/**
 * True iff `err` is a Stripe signature-verification failure thrown by
 * `constructEvent` — i.e. a client error that must map to HTTP 400 (do NOT let
 * Stripe retry, do NOT fire the processing-failure ops alarm).
 *
 * Detection is by the error TYPE discriminator first (covers ALL five message
 * variants, including the substring-less "Timestamp outside the tolerance zone"
 * and "No webhook payload was provided."), with a defensive message-substring
 * fallback so an exotic future verification message that still mentions
 * "signature" is classified correctly even if the `type` field ever changes.
 */
export function isStripeSignatureVerificationError(err: unknown): boolean {
  if (err === null || typeof err !== "object") return false;

  // Primary signal: the SDK's stable `type` discriminator. Present on every
  // StripeSignatureVerificationError regardless of message text.
  const type = (err as { type?: unknown }).type;
  if (type === SIGNATURE_VERIFICATION_ERROR_TYPE) return true;

  // Defensive fallback: the historical message-substring heuristic. Kept so the
  // three message variants that DO contain "signature(s)" are still caught even
  // if a future SDK reshapes `type`. Never the sole signal (it missed the
  // tolerance-zone and empty-payload cases — the bug this module fixes).
  const message = (err as { message?: unknown }).message;
  return typeof message === "string" && message.includes("signature");
}
