import "server-only";
import {
  withBookApiErrors,
  bookOk,
  requireBodyObject,
  requireString,
} from "@/app/app/api/book/_lib/http";
import { BookApiError } from "@/app/app/api/book/_lib/errors";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import { getAppleBundleId } from "@/app/app/api/book/_lib/apple-env";
import {
  verifyAppleJws,
  parseAppleNotificationPayload,
  parseAppleTransactionInfo,
  parseAppleRenewalInfo,
  AppleJwsVerificationError,
  type AppleTransactionInfo,
  type AppleRenewalInfo,
} from "@/app/app/api/book/_lib/apple-jws-verify-core";
import { mapAppleNotificationToEntitlement } from "@/app/app/api/book/_lib/apple-notification-core";
import {
  getUserIdByAppleOriginalTransaction,
  updateUserEntitlementFromApple,
} from "@/app/app/api/book/_lib/repo";

export const runtime = "nodejs";

/**
 * POST /book/me/billing/apple/notifications — App Store Server Notifications V2.
 *
 * Apple posts `{ signedPayload }` (a JWS) server-to-server whenever a
 * subscription's state changes. Like the Stripe webhook this carries no browser
 * Origin and no user session; authenticity is established entirely by verifying
 * the JWS certificate chain against Apple's pinned root (so the same-origin CSRF
 * guard is skipped — see `skipOriginCheck`).
 *
 * Flow: verify the outer signedPayload → verify+decode the nested
 * `signedTransactionInfo` / `signedRenewalInfo` JWSs → run the pure state
 * machine (apple-notification-core) → resolve the user from the
 * originalTransactionId reverse map (written by /apple/verify) → apply the
 * entitlement mutation. Out-of-order and redelivered events are rejected by the
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

      const [tableName, expectedBundleId] = await Promise.all([
        getBookTableName(),
        getAppleBundleId(),
      ]);

      // 1) Verify the outer notification envelope.
      let outer: Record<string, unknown>;
      try {
        outer = await verifyAppleJws(signedPayload);
      } catch (err) {
        if (err instanceof AppleJwsVerificationError) {
          // Bad signature = a CLIENT error (Apple must not retry, no ops alarm).
          throw new BookApiError(
            400,
            "invalid_signature",
            "The App Store notification signature is invalid.",
            { reason: err.code },
          );
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
            await verifyAppleJws(notification.data.signedTransactionInfo),
          );
        }
        if (notification.data?.signedRenewalInfo) {
          renewalInfo = parseAppleRenewalInfo(
            await verifyAppleJws(notification.data.signedRenewalInfo),
          );
        }
      } catch (err) {
        if (err instanceof AppleJwsVerificationError) {
          throw new BookApiError(
            400,
            "invalid_signature",
            "A nested App Store payload signature is invalid.",
            { reason: err.code },
          );
        }
        throw err;
      }

      // 3) Reject notifications for a different app.
      const payloadBundleId =
        transaction?.bundleId ?? notification.data?.bundleId;
      if (payloadBundleId && payloadBundleId !== expectedBundleId) {
        throw new BookApiError(
          400,
          "bundle_mismatch",
          "This notification is not for this application.",
        );
      }

      // 4) Decide the entitlement mutation (pure state machine).
      const decision = mapAppleNotificationToEntitlement({
        notificationType: notification.notificationType,
        subtype: notification.subtype,
        transaction,
        renewalInfo,
        signedDateMs: notification.signedDateMs,
      });
      if (!decision.apply) {
        // Acknowledge unhandled/no-op events so Apple stops retrying.
        return bookOk({ ok: true, applied: false, reason: decision.reason });
      }

      // 5) Resolve the user from the originalTransactionId reverse map. If the
      //    user never verified this transaction through /apple/verify there is
      //    no entitlement to mutate (the verify path is the authoritative grant),
      //    so acknowledge and move on rather than forcing Apple to retry forever.
      const userId = await getUserIdByAppleOriginalTransaction(
        tableName,
        decision.params.originalTransactionId,
      );
      if (!userId) {
        console.warn("apple_notification_unmapped_transaction", {
          notificationType: notification.notificationType,
          originalTransactionId: decision.params.originalTransactionId,
        });
        return bookOk({ ok: true, applied: false, reason: "unmapped_transaction" });
      }

      const applied = await updateUserEntitlementFromApple(tableName, {
        ...decision.params,
        userId,
      });
      return bookOk({ ok: true, applied, reason: decision.reason });
    },
    { skipOriginCheck: true },
  );
}
