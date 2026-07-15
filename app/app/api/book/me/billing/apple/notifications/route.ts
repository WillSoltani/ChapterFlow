import "server-only";
import {
  withBookApiErrors,
  bookOk,
  requireBodyObject,
  requireString,
} from "@/app/app/api/book/_lib/http";
import { BookApiError } from "@/app/app/api/book/_lib/errors";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import { getAppleIapConfig } from "@/app/app/api/book/_lib/apple-env";
import {
  createAppleSignedDataVerifier,
  parseAppleNotificationPayload,
  parseAppleTransactionInfo,
  parseAppleRenewalInfo,
  AppleJwsVerificationError,
  type AppleTransactionInfo,
  type AppleRenewalInfo,
} from "@/app/app/api/book/_lib/apple-jws-verify-core";
import { mapAppleNotificationToEntitlement } from "@/app/app/api/book/_lib/apple-notification-core";
import { appleNotificationStorageLane } from "@/app/app/api/book/_lib/apple-notification-storage-core";
import {
  validateAppleNotificationAccountBinding,
  validateAppleNotificationEnvelopePolicy,
  validateAppleNotificationMutationShape,
  validateApplePurchasePolicy,
} from "@/app/app/api/book/_lib/apple-purchase-policy-core";
import {
  appleAccountBindingError,
  appleJwsBookApiError,
  applePurchasePolicyError,
} from "@/app/app/api/book/_lib/apple-verify-service-core";
import {
  getAppleTransactionClaim,
  updateUserEntitlementFromApple,
} from "@/app/app/api/book/_lib/repo";

export const runtime = "nodejs";

/**
 * POST /book/me/billing/apple/notifications — App Store Server Notifications V2.
 *
 * Apple posts `{ signedPayload }` (a JWS) server-to-server whenever a
 * subscription's state changes. Like the Stripe webhook this carries no browser
 * Origin and no user session; authenticity is established entirely by verifying
 * the JWS with Apple's official verifier, pinned root, and Production OCSP (so
 * the same-origin CSRF
 * guard is skipped — see `skipOriginCheck`).
 *
 * Flow: verify the outer signedPayload → verify+decode the nested
 * `signedTransactionInfo` / `signedRenewalInfo` JWSs → enforce deployment policy
 * and run the state machine → resolve the user from the reverse map → verify the
 * signed account token against that map → apply the entitlement mutation.
 * Out-of-order and redelivered events are rejected by the
 * `lastAppleSignedDate` high-water mark inside the write builder (the mirror of
 * Stripe's `lastStripeEventAt`), so this handler needs no separate dedup store.
 */
export async function POST(req: Request) {
  return withBookApiErrors(
    req,
    async () => {
      const body = requireBodyObject(await req.json().catch(() => null));
      const signedPayload = requireString(body.signedPayload, "signedPayload", {
        maxLength: 100000,
      });

      const [tableName, policy] = await Promise.all([
        getBookTableName(),
        getAppleIapConfig(),
      ]);
      // Reuse one official verifier instance for outer + nested payloads so its
      // verified-key/OCSP cache applies across this notification delivery.
      const signedDataVerifier = createAppleSignedDataVerifier(policy);

      // 1) Verify the outer notification envelope.
      let outer: Record<string, unknown>;
      try {
        outer = await signedDataVerifier.notification(signedPayload);
      } catch (err) {
        if (err instanceof AppleJwsVerificationError) {
          throw appleJwsBookApiError({
            error: err,
            invalidCode: "invalid_signature",
            invalidMessage: "The App Store notification signature is invalid.",
            identityCode: "app_apple_id_mismatch",
            identityMessage:
              "This notification is not for this App Store application.",
            environmentCode: "transaction_environment_mismatch",
            environmentMessage:
              "This notification is not from the expected App Store environment.",
          });
        }
        throw err;
      }

      const notification = parseAppleNotificationPayload(outer);

      // 2) Verify + decode the nested transaction / renewal JWSs. Each is signed
      //    by the same Apple chain and must be re-verified (defense in depth).
      let transaction: AppleTransactionInfo | undefined;
      let renewalInfo: AppleRenewalInfo | undefined;
      try {
        if (notification.data?.signedTransactionInfo) {
          transaction = parseAppleTransactionInfo(
            await signedDataVerifier.transaction(
              notification.data.signedTransactionInfo,
            ),
          );
        }
        if (notification.data?.signedRenewalInfo) {
          renewalInfo = parseAppleRenewalInfo(
            await signedDataVerifier.renewal(
              notification.data.signedRenewalInfo,
            ),
          );
        }
      } catch (err) {
        if (err instanceof AppleJwsVerificationError) {
          throw appleJwsBookApiError({
            error: err,
            invalidCode: "invalid_signature",
            invalidMessage: "A nested App Store payload signature is invalid.",
            identityCode: "bundle_mismatch",
            identityMessage: "This transaction is not for this application.",
            environmentCode: "transaction_environment_mismatch",
            environmentMessage:
              "This transaction is not from the expected App Store environment.",
          });
        }
        throw err;
      }

      // 3) Reject notifications for another deployment environment or app.
      const envelopeViolation = validateAppleNotificationEnvelopePolicy({
        bundleId: notification.data?.bundleId,
        appAppleId: notification.data?.appAppleId,
        environment: notification.data?.environment,
        policy,
      });
      if (envelopeViolation) throw applePurchasePolicyError(envelopeViolation);
      const storageLane = appleNotificationStorageLane(policy.environment);

      // 4) Decide the entitlement mutation (pure state machine).
      const decision = mapAppleNotificationToEntitlement({
        notificationType: notification.notificationType,
        subtype: notification.subtype,
        transaction,
        renewalInfo,
        signedDateMs: notification.signedDateMs,
        nowMs: Date.now(),
      });
      if (!decision.apply) {
        // Acknowledge unhandled/no-op events so Apple stops retrying.
        return bookOk({ ok: true, applied: false, reason: decision.reason });
      }

      // Every entitlement mutation requires the same exact signed transaction
      // policy as direct verification. The outer notification's valid signature
      // does not make a Sandbox, foreign-product, or foreign-group transaction
      // acceptable to the production entitlement store.
      if (!transaction) {
        throw new BookApiError(
          400,
          "unsupported_transaction",
          "The notification is missing required subscription fields.",
        );
      }
      const policyViolation = validateApplePurchasePolicy(transaction, policy);
      if (policyViolation) throw applePurchasePolicyError(policyViolation);
      const shapeViolation = validateAppleNotificationMutationShape({
        transaction,
        notificationSignedDateMs: notification.signedDateMs,
        grantsPro: decision.params.plan === "PRO",
        serviceExpiresDateMs: (() => {
          const value = Date.parse(decision.params.currentPeriodEnd ?? "");
          return Number.isFinite(value) ? value : undefined;
        })(),
        nowMs: Date.now(),
      });
      if (shapeViolation === "unsupported_transaction") {
        throw new BookApiError(
          400,
          "unsupported_transaction",
          "The notification is missing required subscription fields.",
        );
      }
      if (shapeViolation === "transaction_expired") {
        throw new BookApiError(
          400,
          "transaction_expired",
          "This subscription is not currently active.",
        );
      }

      // 5) Resolve the user from the originalTransactionId reverse map. If the
      //    user never verified this transaction through /apple/verify there is
      //    no entitlement to mutate (the verify path is the authoritative grant),
      //    so acknowledge and move on rather than forcing Apple to retry forever.
      const claim = await getAppleTransactionClaim(
        tableName,
        decision.params.originalTransactionId,
        storageLane,
      );
      if (!claim) {
        console.warn("apple_notification_unmapped_transaction", {
          notificationType: notification.notificationType,
        });
        return bookOk({ ok: true, applied: false, reason: "unmapped_transaction" });
      }

      const bindingViolation = validateAppleNotificationAccountBinding({
        mappedUserId: claim.userId,
        appAccountToken: transaction.appAccountToken,
        bindingVersion: claim.accountBindingVersion,
      });
      if (bindingViolation) throw appleAccountBindingError(bindingViolation);

      const applied = await updateUserEntitlementFromApple(
        tableName,
        {
          ...decision.params,
          userId: claim.userId,
        },
        storageLane,
      );
      return bookOk({ ok: true, applied, reason: decision.reason });
    },
    { skipOriginCheck: true },
  );
}
