import "server-only";
import { requireActiveBookUser } from "@/app/app/api/book/_lib/account-guard";
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
  parseAppleTransactionInfo,
  AppleJwsVerificationError,
} from "@/app/app/api/book/_lib/apple-jws-verify-core";
import { buildAppleActivation } from "@/app/app/api/book/_lib/apple-notification-core";
import {
  claimAppleTransactionForUser,
  updateUserEntitlementFromApple,
  getUserEntitlement,
} from "@/app/app/api/book/_lib/repo";

export const runtime = "nodejs";

/**
 * POST /book/me/billing/apple/verify — grant the shared Pro entitlement from a
 * StoreKit 2 signed transaction.
 *
 * The native iOS app posts `{ transactionJWS }` (the JWS StoreKit hands back
 * after a successful purchase). We verify the JWS's certificate chain against
 * Apple's pinned root (NO network call to Apple), confirm the decoded `bundleId`
 * is ours, then write the same `BookUserEntitlement` a Stripe subscription would
 * — plan PRO, proStatus active, proSource "apple", currentPeriodEnd = Apple's
 * expiry.
 *
 * Idempotent on `originalTransactionId`: re-posting the same transaction
 * re-claims the (user-scoped) reverse map and re-applies the identical
 * entitlement (the ordering guard makes the same signedDate a safe re-apply). A
 * transaction already owned by a DIFFERENT account is refused, so a replayed
 * JWS cannot hijack another user's purchase.
 */
export async function POST(req: Request) {
  return withBookApiErrors(req, async () => {
    const user = await requireActiveBookUser();

    const body = requireBodyObject(await req.json().catch(() => null));
    const transactionJWS = requireString(body.transactionJWS, "transactionJWS", {
      maxLength: 20000,
    });

    const [tableName, expectedBundleId] = await Promise.all([
      getBookTableName(),
      getAppleBundleId(),
    ]);

    let payload: Record<string, unknown>;
    try {
      payload = await verifyAppleJws(transactionJWS);
    } catch (err) {
      if (err instanceof AppleJwsVerificationError) {
        throw new BookApiError(
          400,
          "invalid_transaction",
          "The App Store transaction could not be verified.",
          { reason: err.code },
        );
      }
      throw err;
    }

    const tx = parseAppleTransactionInfo(payload);

    // The transaction must be for THIS app.
    if (!tx.bundleId || tx.bundleId !== expectedBundleId) {
      throw new BookApiError(
        400,
        "bundle_mismatch",
        "This transaction is not for this application.",
      );
    }
    if (!tx.originalTransactionId || !tx.productId) {
      throw new BookApiError(
        400,
        "unsupported_transaction",
        "The transaction is missing required subscription fields.",
      );
    }
    // A refunded/revoked transaction never grants access.
    if (tx.revocationDateMs !== undefined) {
      throw new BookApiError(
        400,
        "transaction_revoked",
        "This purchase has been refunded and no longer grants Pro.",
      );
    }
    // Auto-renewable subscriptions carry an expiry; a lapsed one grants nothing.
    if (tx.expiresDateMs === undefined || tx.expiresDateMs <= Date.now()) {
      throw new BookApiError(
        400,
        "transaction_expired",
        "This subscription is not currently active.",
      );
    }

    // Bind the transaction to this user BEFORE granting, so the notifications
    // webhook can resolve the account — and so a replayed JWS from another
    // account is rejected here rather than silently granting Pro.
    const claimed = await claimAppleTransactionForUser(
      tableName,
      tx.originalTransactionId,
      user.sub,
    );
    if (!claimed) {
      throw new BookApiError(
        409,
        "transaction_already_claimed",
        "This App Store purchase is already linked to a different account.",
      );
    }

    const activation = buildAppleActivation(tx, tx.signedDateMs);
    if (!activation) {
      throw new BookApiError(
        400,
        "unsupported_transaction",
        "The transaction is missing required subscription fields.",
      );
    }
    await updateUserEntitlementFromApple(tableName, {
      ...activation,
      userId: user.sub,
    });

    const entitlement = await getUserEntitlement(tableName, user.sub);
    return bookOk({
      ok: true,
      entitlement: {
        plan: entitlement?.plan ?? "PRO",
        proStatus: entitlement?.proStatus ?? "active",
        proSource: entitlement?.proSource ?? "apple",
        currentPeriodEnd: entitlement?.currentPeriodEnd,
        cancelAtPeriodEnd: entitlement?.cancelAtPeriodEnd ?? false,
      },
    });
  });
}
