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
 *     recent"). It may supersede an expired timed promo, or an active timed
 *     promo when Apple's signed period ends later (so access is never
 *     shortened). It never supersedes an administrative grant.
 *   - `"same_lineage_activate"` (refund reversal): may restore only the same
 *     Apple lineage and never displace a different active source.
 *   - `"apple_only"` (a downgrade or renewal-status change): applies ONLY when
 *     the user is CURRENTLY `apple`-sourced, so an Apple EXPIRED/REFUND can never
 *     clobber a subscription the user has since switched to another source.
 *
 * Stripe activation is symmetric: a completed Stripe Checkout is the newest
 * paid intent and may supersede Apple, while every terminal mutation remains
 * same-lineage/same-source only. The product layer still blocks creating a new
 * checkout for an effective Apple subscriber, but this arbitration closes the
 * race for a checkout session created before a later Apple activation. Unlike Stripe's
 * dispute path, an Apple activation is NOT gated on the `disputeOpen` chargeback
 * marker: an App Store purchase is independently paid to Apple, so a lingering
 * Stripe chargeback does not block it (and the marker still blocks Stripe
 * re-activation until resolved).
 */
import {
  accountStatusSk,
  bookUserPk,
  entitlementSk,
  type AppleStorageLane,
} from "./keys";

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
  productId?: string | undefined;
  /** Subscription expiry (ISO 8601) → `currentPeriodEnd`. */
  currentPeriodEnd?: string | undefined;
  /** Auto-renew turned off → true (still Pro until the period ends). */
  cancelAtPeriodEnd?: boolean | undefined;
  /** Apple `signedDate` (epoch ms) — stamped as the ordering high-water mark. */
  appleSignedDateMs?: number | undefined;
  /** Which existing proSource values this write may apply over (see module header). */
  guard: "activate" | "same_lineage_activate" | "apple_only";
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

export type AppleEntitlementTransactWrite = {
  TransactItems: [
    {
      Update: {
        TableName: string;
        Key: Record<string, unknown>;
        UpdateExpression: string;
        ConditionExpression: string;
        ExpressionAttributeNames: Record<string, string>;
        ExpressionAttributeValues: Record<string, unknown>;
      };
    },
    {
      ConditionCheck: {
        TableName: string;
        Key: Record<string, unknown>;
        ConditionExpression: string;
        ExpressionAttributeNames: Record<string, string>;
        ExpressionAttributeValues: Record<string, unknown>;
      };
    },
  ];
};

export function buildEntitlementUpdateFromApple(
  params: AppleEntitlementWriteParams,
  updatedAtIso: string,
): AppleEntitlementUpdate {
  // Entering Pro persists proSource "apple"; leaving Pro (FREE) clears it so the
  // entitlement reads back as a plain FREE user (mirrors the Stripe builder).
  const proSourceValue = params.plan === "PRO" ? "apple" : null;
  const hasSignedDate = Number.isFinite(params.appleSignedDateMs);
  const hasPaidIntentTimestamp =
    params.plan === "PRO" && params.guard === "activate" && hasSignedDate;

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
  if (hasPaidIntentTimestamp) {
    setParts.push("activePaidIntentAtMs = :paidIntentAtMs");
    eav[":paidIntentAtMs"] = params.appleSignedDateMs;
    eav[":paidIntentAtSeconds"] = Math.floor(
      (params.appleSignedDateMs as number) / 1000,
    );
  }

  const conditionParts: string[] = [];
  if (params.guard === "activate") {
    eav[":appleSource"] = "apple";
    eav[":nullSource"] = null;
    eav[":licenseSource"] = "license";
    eav[":flowPointsSource"] = "flow_points";
    eav[":giftCodeSource"] = "gift_code";
    if (hasPaidIntentTimestamp) eav[":stripeSource"] = "stripe";
    // A purchase/renewal may take over absent / null / apple / stripe. It may
    // also take over a timed promo after expiry or when Apple's signed period
    // extends beyond it; this prevents a paid-without-access gap without ever
    // shortening the user's access. Admin grants remain protected.
    const licenseExpiryGuard =
      params.currentPeriodEnd === undefined
        ? "licenseExpiresAt < :updatedAt"
        : "(licenseExpiresAt < :updatedAt OR licenseExpiresAt < :periodEnd)";
    const timedPassExpiryGuard =
      params.currentPeriodEnd === undefined
        ? "currentPeriodEnd < :updatedAt"
        : "(currentPeriodEnd < :updatedAt OR currentPeriodEnd < :periodEnd)";
    const stripeTakeoverGuard = hasPaidIntentTimestamp
      ? " OR (proSource = :stripeSource AND ((attribute_exists(activePaidIntentAtMs) AND activePaidIntentAtMs <= :paidIntentAtMs) OR (attribute_not_exists(activePaidIntentAtMs) AND (attribute_not_exists(lastStripeEventAt) OR lastStripeEventAt <= :paidIntentAtSeconds))))"
      : "";
    conditionParts.push(
      `(attribute_not_exists(proSource) OR proSource = :appleSource OR proSource = :nullSource${stripeTakeoverGuard} OR (proSource = :licenseSource AND attribute_exists(licenseExpiresAt) AND ${licenseExpiryGuard}) OR ((proSource = :flowPointsSource OR proSource = :giftCodeSource) AND attribute_exists(currentPeriodEnd) AND ${timedPassExpiryGuard}))`,
    );
  } else if (params.guard === "same_lineage_activate") {
    eav[":appleSource"] = "apple";
    eav[":nullSource"] = null;
    conditionParts.push("appleOriginalTransactionId = :appleOtx");
    conditionParts.push(
      "(attribute_not_exists(proSource) OR proSource = :appleSource OR proSource = :nullSource)",
    );
  } else {
    eav[":appleSource"] = "apple";
    // A downgrade / renewal-status change only touches the SAME currently-Apple
    // subscription lineage. A late terminal event from lineage A must never
    // revoke a newer active lineage B owned by the same ChapterFlow account.
    conditionParts.push("proSource = :appleSource");
    conditionParts.push("appleOriginalTransactionId = :appleOtx");
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

/**
 * Couple an entitlement mutation to the account lifecycle atomically. A
 * notification that resolved its claim immediately before hard erasure cannot
 * recreate personal data after the partition sweep.
 */
export function buildAppleEntitlementTransactWrite(input: {
  tableName: string;
  userId: string;
  params: AppleEntitlementWriteParams;
  updatedAtIso: string;
  storageLane?: AppleStorageLane;
}): AppleEntitlementTransactWrite {
  const storageLane = input.storageLane ?? "Primary";
  const built = buildEntitlementUpdateFromApple(
    input.params,
    input.updatedAtIso,
  );
  const updateExpression = `${built.updateExpression}, entity = :entity, userId = :userId`;
  const expressionAttributeValues = {
    ...built.expressionAttributeValues,
    ":entity":
      storageLane === "Primary"
        ? "BOOK_USER_ENTITLEMENT"
        : "BOOK_USER_ENTITLEMENT_APPLE_SANDBOX",
    ":userId": input.userId,
  };
  return {
    TransactItems: [
      {
        Update: {
          TableName: input.tableName,
          Key: {
            PK: bookUserPk(input.userId),
            SK: entitlementSk(storageLane),
          },
          ConditionExpression: built.conditionExpression,
          UpdateExpression: updateExpression,
          ExpressionAttributeNames: built.expressionAttributeNames,
          ExpressionAttributeValues: expressionAttributeValues,
        },
      },
      {
        ConditionCheck: {
          TableName: input.tableName,
          Key: {
            PK: bookUserPk(input.userId),
            SK: accountStatusSk(),
          },
          ConditionExpression:
            "attribute_not_exists(#accountStatus) OR #accountStatus <> :deletedAccountStatus",
          ExpressionAttributeNames: { "#accountStatus": "status" },
          ExpressionAttributeValues: {
            ":deletedAccountStatus": "deleted",
          },
        },
      },
    ],
  };
}
