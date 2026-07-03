/**
 * The Apple entitlement STATE MACHINE — pure, deterministic, dependency-free.
 *
 * Given a decoded App Store Server Notification V2 (its type/subtype plus the
 * decoded transaction and renewal info), decide the entitlement mutation to
 * apply. Also derives the activation mutation for a directly-verified StoreKit
 * transaction (the /apple/verify route). All expiry/date math is on epoch
 * MILLISECONDS (Apple's schema); the caller supplies already-verified data.
 *
 * Kept free of crypto, `server-only`, and the AWS SDK so the transition table is
 * unit-testable in isolation (see apple-notification-core.test.ts).
 */
import type { AppleEntitlementWriteParams } from "./apple-entitlement-write-core";
import type {
  AppleTransactionInfo,
  AppleRenewalInfo,
} from "./apple-jws-verify-core";

/** The notification types we act on. Everything else is acknowledged but ignored. */
export const HANDLED_NOTIFICATION_TYPES = [
  "SUBSCRIBED",
  "DID_RENEW",
  "EXPIRED",
  "DID_CHANGE_RENEWAL_STATUS",
  "REFUND",
] as const;

export type HandledAppleNotificationType =
  (typeof HANDLED_NOTIFICATION_TYPES)[number];

export type AppleEntitlementDecision =
  | { apply: false; reason: string }
  | { apply: true; reason: string; params: AppleEntitlementWriteParams };

function isoFromMs(ms: number | undefined): string | undefined {
  if (ms === undefined || !Number.isFinite(ms)) return undefined;
  return new Date(ms).toISOString();
}

/**
 * Build the PRO-activation write for a verified StoreKit transaction (the
 * /apple/verify route and the SUBSCRIBED/DID_RENEW notifications share this
 * shape). `guard: "activate"` lets an App Store purchase supersede a Stripe
 * subscription (most-recent purchase wins). Returns null when the transaction
 * lacks the identity/expiry fields needed to grant Pro.
 */
export function buildAppleActivation(
  tx: AppleTransactionInfo,
  signedDateMs: number | undefined,
): AppleEntitlementWriteParams | null {
  if (!tx.originalTransactionId) return null;
  return {
    plan: "PRO",
    proStatus: "active",
    originalTransactionId: tx.originalTransactionId,
    productId: tx.productId,
    currentPeriodEnd: isoFromMs(tx.expiresDateMs),
    // A fresh purchase/renewal is, by definition, auto-renewing.
    cancelAtPeriodEnd: false,
    appleSignedDateMs: signedDateMs ?? tx.signedDateMs,
    guard: "activate",
  };
}

/**
 * The core transition: map a notification (type + subtype + decoded transaction
 * & renewal info) to an entitlement decision.
 */
export function mapAppleNotificationToEntitlement(input: {
  notificationType: string | undefined;
  subtype?: string;
  transaction?: AppleTransactionInfo;
  renewalInfo?: AppleRenewalInfo;
  /** The notification's signedDate (epoch ms) — the ordering high-water mark. */
  signedDateMs?: number;
}): AppleEntitlementDecision {
  const { notificationType, subtype, transaction, renewalInfo, signedDateMs } =
    input;

  if (
    !notificationType ||
    !HANDLED_NOTIFICATION_TYPES.includes(
      notificationType as HandledAppleNotificationType,
    )
  ) {
    return {
      apply: false,
      reason: `unhandled notification type: ${notificationType ?? "(none)"}`,
    };
  }

  // Every handled type carries the subscription's transaction (its identity).
  const originalTransactionId = transaction?.originalTransactionId;
  if (!originalTransactionId) {
    return {
      apply: false,
      reason: `${notificationType}: missing originalTransactionId`,
    };
  }
  const productId = transaction?.productId;
  const currentPeriodEnd = isoFromMs(transaction?.expiresDateMs);

  switch (notificationType as HandledAppleNotificationType) {
    case "SUBSCRIBED":
    case "DID_RENEW": {
      // Purchase, resubscribe, or renewal → active Pro through the new expiry.
      return {
        apply: true,
        reason: notificationType,
        params: {
          plan: "PRO",
          proStatus: "active",
          originalTransactionId,
          productId,
          currentPeriodEnd,
          cancelAtPeriodEnd: false,
          appleSignedDateMs: signedDateMs,
          guard: "activate",
        },
      };
    }

    case "DID_CHANGE_RENEWAL_STATUS": {
      // Auto-renew toggled. Access is unchanged until expiry; only the pending-
      // cancel flag moves. Prefer the explicit subtype, fall back to renewalInfo.
      const autoRenewOff =
        subtype === "AUTO_RENEW_DISABLED" ||
        (subtype !== "AUTO_RENEW_ENABLED" && renewalInfo?.autoRenewStatus === 0);
      return {
        apply: true,
        reason: `DID_CHANGE_RENEWAL_STATUS (${subtype ?? "unspecified"})`,
        params: {
          plan: "PRO",
          proStatus: "active",
          originalTransactionId,
          productId,
          currentPeriodEnd,
          cancelAtPeriodEnd: autoRenewOff,
          appleSignedDateMs: signedDateMs,
          // Only mutate a currently-apple entitlement — never resurrect a lapsed
          // one or touch a source the user switched to.
          guard: "apple_only",
        },
      };
    }

    case "EXPIRED": {
      // Subscription lapsed (voluntary, billing failure, price-increase decline).
      // Access ends now.
      return {
        apply: true,
        reason: `EXPIRED (${subtype ?? "unspecified"})`,
        params: {
          plan: "FREE",
          proStatus: "inactive",
          originalTransactionId,
          productId,
          currentPeriodEnd,
          cancelAtPeriodEnd: true,
          appleSignedDateMs: signedDateMs,
          guard: "apple_only",
        },
      };
    }

    case "REFUND": {
      // App Store refunded the purchase → revoke access immediately.
      return {
        apply: true,
        reason: `REFUND (${subtype ?? "unspecified"})`,
        params: {
          plan: "FREE",
          proStatus: "canceled",
          originalTransactionId,
          productId,
          currentPeriodEnd,
          cancelAtPeriodEnd: true,
          appleSignedDateMs: signedDateMs,
          guard: "apple_only",
        },
      };
    }
  }
}
