import "server-only";

import { ListUsersCommand } from "@aws-sdk/client-cognito-identity-provider";
import { getServerEnv } from "@/app/app/api/_lib/server-env";
import { getCognitoClient } from "./cognito-admin";
import { getAppleRefreshToken } from "./apple-token-store";
import {
  hasLinkedAppleIdentity,
  isAppleAuthConfigComplete,
  runAppleRevoke,
  type AppleAuthConfig,
  type AppleRevokeOutcome,
} from "./apple-auth-core";

/**
 * Resolve the four Apple key values from env/SSM (shared with B3's Apple IAP
 * config). Returns null if any is unset — the caller then skips the revoke as
 * "not_configured" rather than throwing.
 */
async function resolveAppleAuthConfig(): Promise<AppleAuthConfig | null> {
  const [teamId, clientId, keyId, privateKey] = await Promise.all([
    getServerEnv("APPLE_ISSUER_ID"),
    getServerEnv("APPLE_BUNDLE_ID"),
    getServerEnv("APPLE_KEY_ID"),
    getServerEnv("APPLE_PRIVATE_KEY"),
  ]);
  const config = { teamId, clientId, keyId, privateKey };
  return isAppleAuthConfigComplete(config) ? config : null;
}

/**
 * Does the Cognito user (by `sub`) have a linked Sign-in-with-Apple identity?
 * Resolves the user via a `sub` filter (a federated user's Username is
 * `SignInWithApple_<id>`, not the sub) and inspects both the `identities`
 * attribute and the Username shape.
 *
 * Best-effort: on any Cognito error (or unset pool id) it returns
 * `{ hasApple: false }` so a lookup failure can never block the account delete —
 * it only means the (optional) revoke is skipped.
 */
async function lookupAppleIdentity(
  userSub: string
): Promise<{ hasApple: boolean }> {
  const userPoolId = await getServerEnv("COGNITO_USER_POOL_ID");
  if (!userPoolId) return { hasApple: false };
  try {
    // The sub is interpolated into a SCIM filter — strip anything outside the sub
    // charset to prevent filter injection (same sanitization as cognito-admin.ts).
    const safeSub = userSub.replace(/[^\w:.@-]/g, "");
    const listed = await getCognitoClient().send(
      new ListUsersCommand({
        UserPoolId: userPoolId,
        Filter: `sub = "${safeSub}"`,
        Limit: 1,
      })
    );
    const user = listed.Users?.[0];
    if (!user) return { hasApple: false };
    const identitiesAttr = user.Attributes?.find((a) => a.Name === "identities")?.Value;
    return {
      hasApple: hasLinkedAppleIdentity({ identitiesAttr, username: user.Username }),
    };
  } catch {
    return { hasApple: false };
  }
}

/**
 * Revoke the user's Apple token as part of account deletion (App Review
 * requirement for apps offering Sign in with Apple).
 *
 * BEST-EFFORT and never throws: the authoritative soft-delete has already
 * committed before this runs. The outcome is returned for the caller to record
 * (log marker / ops-failure) but the deletion succeeds regardless. Skips cleanly
 * when the user has no Apple identity, when no revocable token is stored, or when
 * the APPLE_* config is absent.
 *
 * `log` is an injection seam for tests; it defaults to a structured console line.
 */
export async function revokeAppleIdentityOnDelete(
  tableName: string,
  userSub: string,
  log: (event: string, fields: Record<string, unknown>) => void = defaultLog
): Promise<AppleRevokeOutcome> {
  try {
    const { hasApple } = await lookupAppleIdentity(userSub);
    const config = await resolveAppleAuthConfig();
    return await runAppleRevoke({
      hasAppleIdentity: hasApple,
      config,
      getRefreshToken: () => getAppleRefreshToken(tableName, userSub),
      fetchImpl: (url, init) => fetch(url, init),
      now: () => Date.now(),
      log,
    });
  } catch (error) {
    // Defensive: runAppleRevoke never throws, but the Cognito/config lookups or
    // fetch binding could. A revoke failure must never fail the delete.
    log("apple_revoke_error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      status: "failed",
      attempts: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function defaultLog(event: string, fields: Record<string, unknown>): void {
  // Observable per the DoD: a clear, greppable marker in CloudWatch.
  console.log(JSON.stringify({ marker: event, ...fields }));
}
