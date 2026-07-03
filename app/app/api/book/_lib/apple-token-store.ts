import "server-only";

import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { ddbDoc } from "@/app/app/api/_lib/aws";
import { bookUserPk, nowIso } from "./keys";

/**
 * Where a user's Apple refresh token lives so account deletion can revoke it.
 *
 * Apple's App Review REQUIRES that deleting an account revokes the user's Apple
 * token (see docs/ios/APPLE-AUTH.md). To revoke it we must HOLD it — but Cognito
 * hosted-UI federation performs the Apple code↔token exchange internally and
 * never hands us Apple's refresh token. Only the NATIVE Sign-in-with-Apple flow
 * (the iOS app sends the authorization code; the backend exchanges it) yields a
 * refresh token we can persist here via `putAppleRefreshToken`.
 *
 * The item is single-purpose (PK = the user, SK = APPLE#IDENTITY) so account
 * erasure's per-partition delete already sweeps it away with the rest of the
 * user's data.
 */
export const APPLE_IDENTITY_SK = "APPLE#IDENTITY";

interface AppleIdentityItem {
  PK: string;
  SK: string;
  appleRefreshToken?: string;
  /** Apple's stable user id (the `sub` from the id_token) — useful for support. */
  appleSub?: string;
  updatedAt?: string;
}

/**
 * Read the stored Apple refresh token for a user (Cognito `sub`). Returns null
 * when none is stored (hosted-UI-only users, or the native exchange never ran).
 */
export async function getAppleRefreshToken(
  tableName: string,
  userSub: string
): Promise<string | null> {
  const res = await ddbDoc.send(
    new GetCommand({
      TableName: tableName,
      Key: { PK: bookUserPk(userSub), SK: APPLE_IDENTITY_SK },
    })
  );
  const item = res.Item as AppleIdentityItem | undefined;
  return item?.appleRefreshToken ?? null;
}

/**
 * Persist the Apple refresh token captured by the native SIWA code-exchange flow,
 * so a later account deletion can revoke it. Idempotent (last write wins).
 */
export async function putAppleRefreshToken(
  tableName: string,
  userSub: string,
  appleRefreshToken: string,
  appleSub?: string
): Promise<void> {
  const item: AppleIdentityItem = {
    PK: bookUserPk(userSub),
    SK: APPLE_IDENTITY_SK,
    appleRefreshToken,
    ...(appleSub ? { appleSub } : {}),
    updatedAt: nowIso(),
  };
  await ddbDoc.send(new PutCommand({ TableName: tableName, Item: item }));
}
