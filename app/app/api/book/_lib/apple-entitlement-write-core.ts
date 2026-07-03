/**
 * Pure builder for the DynamoDB UpdateCommand that `updateUserEntitlementFromApple`
 * (repo.ts) issues against a user's entitlement item in response to an Apple
 * StoreKit transaction (the /apple/verify route) or an App Store Server
 * Notification V2 (the /apple/notifications webhook).
 *
 * This is the Apple mirror of stripe-entitlement-write-core.ts — extracted so
 * the expression/condition logic is unit-testable without the AWS SDK, and
 * deterministic (the clock is passed in, not read here).
 *
 * ## Event-ordering guard (mirrors the Stripe `lastStripeEventAt` high-water mark)
 *
 * App Store Server Notifications are not delivery-ordered, and both StoreKit and
 * Apple retry. Every Apple write stamps `lastAppleSignedDate` (Apple's
 * `signedDate`, epoch ms) and is guarded by
 * `(attribute_not_exists(lastAppleSignedDate) OR lastAppleSignedDate <= :appleSignedDate)`.
 * The guard applies UNIFORMLY to activations and downgrades, so the mark is
 * monotonic: a write only applies when its event is at least as new as
 * everything already applied. `<=` (not `<`) keeps a redelivered notification
 * idempotent (same signedDate re-applies the same deterministic state).
 *
 * ## Cross-source arbitration (at most one active source)
 *
 * A user holds at most one active `proSource`. The guard field selects who may
 * win:
 *   - `"activate"` (a PRO purchase / renewal): may take over an absent / null /
 *     `apple` / `stripe` source — a fresh App Store purchase is the most-recent
 *     billing intent and supersedes a Stripe subscription ("prefer the most
 *     recent"). It never overrides a promotional grant (license / flow_points /
 *     gift_code / admin), matching how the Stripe builder protects those.
 *   - `"apple_only"` (a downgrade or renewal-status change): applies ONLY when
 *     the user is CURRENTLY `apple`-sourced, so an Apple EXPIRED/REFUND can never
 *     clobber a subscription the user has since switched to another source.
 *
 * The reverse takeover (Stripe superseding an active Apple subscription) is
 * prevented at the product layer: the web billing UI never offers Stripe
 * checkout while an Apple subscription is active, and the Stripe builder's own
 * proSource guard refuses to write over a non-stripe source. Unlike Stripe's
 * dispute path, an Apple activation is NOT gated on the `disputeOpen` chargeback
 * marker: an App Store purchase is independently paid to Apple, so a lingering
 * Stripe chargeback does not block it (and the marker still blocks Stripe
 * re-activation until resolved).
 */
export type AppleEntitlementWriteParams = {
  plan: "FREE" | "PRO";
  proStatus: "inactive" | "active" | "past_due" | "canceled";
  /**
   * Apple `originalTransactionId` — the stable identity of the subscription
   * across renewals. Persisted so the notifications webhook can resolve this
   * user, and as the idempotency anchor for re-verification.
   */
  originalTransactionId: string;
  /** Apple product id of the subscription (for display / reconciliation). */
  productId?: string;
  /** Subscription expiry (ISO 8601) → `currentPeriodEnd`. */
  currentPeriodEnd?: string;
  /** Auto-renew turned off → true (still Pro until the period ends). */
  cancelAtPeriodEnd?: boolean;
  /** Apple `signedDate` (epoch ms) — stamped as the ordering high-water mark. */
  appleSignedDateMs?: number;
  /** Which existing proSource values this write may apply over (see module header). */
  guard: "activate" | "apple_only";
};

export type AppleEntitlementUpdate = {
  updateExpression: string;
  conditionExpression: string;
  expressionAttributeNames: Record<string, string>;
  expressionAttributeValues: Record<string, unknown>;
  // Structured pieces, exposed for unit tests (assert membership, not substrings).
  setParts: string[];
  conditionParts: string[];
};

export function buildEntitlementUpdateFromApple(
  params: AppleEntitlementWriteParams,
  updatedAtIso: string,
): AppleEntitlementUpdate {
  // Entering Pro persists proSource "apple"; leaving Pro (FREE) clears it so the
  // entitlement reads back as a plain FREE user (mirrors the Stripe builder).
  const proSourceValue = params.plan === "PRO" ? "apple" : null;
  const hasSignedDate = Number.isFinite(params.appleSignedDateMs);

  const setParts: string[] = [
    "#plan = :plan",
    "proStatus = :proStatus",
    "proSource = :proSource",
    "appleOriginalTransactionId = :appleOtx",
    "updatedAt = :updatedAt",
    "freeBookSlots = if_not_exists(freeBookSlots, :defaultSlots)",
  ];
  const eav: Record<string, unknown> = {
    ":plan": params.plan,
    ":proStatus": params.proStatus,
    ":proSource": proSourceValue,
    ":appleSource": "apple",
    ":stripeSource": "stripe",
    ":nullSource": null,
    ":appleOtx": params.originalTransactionId,
    ":updatedAt": updatedAtIso,
    ":defaultSlots": 2,
  };

  if (params.productId !== undefined) {
    setParts.push("appleProductId = :appleProduct");
    eav[":appleProduct"] = params.productId;
  }
  if (params.currentPeriodEnd !== undefined) {
    setParts.push("currentPeriodEnd = :periodEnd");
    eav[":periodEnd"] = params.currentPeriodEnd;
  }
  if (params.cancelAtPeriodEnd !== undefined) {
    setParts.push("cancelAtPeriodEnd = :cancelAtPeriodEnd");
    eav[":cancelAtPeriodEnd"] = params.cancelAtPeriodEnd;
  }
  // Downgrading to FREE clears any pending-cancel state if the caller didn't set
  // it explicitly (the subscription is over, not merely set-to-not-renew).
  if (params.plan === "FREE" && params.cancelAtPeriodEnd === undefined) {
    setParts.push("cancelAtPeriodEnd = :cancelAtPeriodEnd");
    eav[":cancelAtPeriodEnd"] = false;
  }
  // Ordering high-water mark — stamped on every write that carries a signedDate.
  if (hasSignedDate) {
    setParts.push("lastAppleSignedDate = :appleSignedDate");
    eav[":appleSignedDate"] = params.appleSignedDateMs;
  }

  const conditionParts: string[] = [];
  if (params.guard === "activate") {
    // A purchase/renewal may take over absent / null / apple / stripe (most-recent
    // purchase wins) but never a promotional grant.
    conditionParts.push(
      "(attribute_not_exists(proSource) OR proSource = :appleSource OR proSource = :stripeSource OR proSource = :nullSource)",
    );
  } else {
    // A downgrade / renewal-status change only touches a currently-apple source.
    conditionParts.push("proSource = :appleSource");
  }
  // Event-ordering guard: refuse a stale (out-of-order) Apple event.
  if (hasSignedDate) {
    conditionParts.push(
      "(attribute_not_exists(lastAppleSignedDate) OR lastAppleSignedDate <= :appleSignedDate)",
    );
  }

  return {
    updateExpression: "SET " + setParts.join(", "),
    conditionExpression: conditionParts.join(" AND "),
    expressionAttributeNames: { "#plan": "plan" },
    expressionAttributeValues: eav,
    setParts,
    conditionParts,
  };
}
