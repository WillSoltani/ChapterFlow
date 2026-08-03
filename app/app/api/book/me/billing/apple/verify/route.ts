import "server-only";
import { requireActiveBookUser } from "@/app/app/api/book/_lib/account-guard";
import {
  withBookApiErrors,
  bookOk,
  requireBodyObject,
  requireString,
} from "@/app/app/api/book/_lib/http";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import {
  getAppleIapConfig,
  verifyAppleTransactionJwsForUser,
} from "@/app/app/api/book/_lib/apple-env";
import { verifyAppleTransactionForUser } from "@/app/app/api/book/_lib/apple-verify-service-core";
import {
  claimAppleTransactionForUser,
  updateUserEntitlementFromApple,
  getUserEntitlement,
  getAppleTransactionClaim,
} from "@/app/app/api/book/_lib/repo";

export const runtime = "nodejs";

/**
 * POST /book/me/billing/apple/verify — grant the shared Pro entitlement from a
 * StoreKit 2 signed transaction.
 *
 * The native iOS app posts `{ transactionJWS }` (the JWS StoreKit hands back
 * after a successful purchase). We verify the JWS's certificate chain against
 * Apple's official verifier and pinned root (including Production OCSP), then
 * enforce exact deployment
 * environment, bundle, product, subscription group, ownership type, and signed
 * `appAccountToken == authenticated Cognito sub` before claiming or writing.
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

    const tableName = await getBookTableName();
    const response = await verifyAppleTransactionForUser({
      userId: user.sub,
      transactionJws: transactionJWS,
      dependencies: {
        nowMs: Date.now,
        verifyTransactionJws: verifyAppleTransactionJwsForUser,
        getPolicy: getAppleIapConfig,
        getExistingClaim: (originalTransactionId, storageLane) =>
          getAppleTransactionClaim(
            tableName,
            originalTransactionId,
            storageLane,
          ),
        claimTransaction: (
          originalTransactionId,
          userId,
          bindingVersion,
          storageLane,
          storeEnvironment,
        ) =>
          claimAppleTransactionForUser(
            tableName,
            originalTransactionId,
            userId,
            bindingVersion,
            storageLane,
            storeEnvironment,
          ),
        updateEntitlement: (params, storageLane) =>
          updateUserEntitlementFromApple(tableName, params, storageLane),
        getEntitlement: (userId, storageLane) =>
          getUserEntitlement(tableName, userId, {
            consistentRead: true,
            appleStorageLane: storageLane,
          }),
      },
    });
    return bookOk(response);
  });
}
