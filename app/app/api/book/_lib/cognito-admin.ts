import "server-only";

import {
  CognitoIdentityProviderClient,
  AdminUserGlobalSignOutCommand,
  ListUsersCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { REGION } from "@/app/app/api/_lib/aws";
import { getServerEnv } from "@/app/app/api/_lib/server-env";

// Single shared Cognito Identity Provider client for ALL admin operations
// (erasure's ListUsers/AdminDeleteUser AND step-up's AdminUserGlobalSignOut).
// account-erasure.ts imports `getCognitoClient` from here so there is exactly
// ONE client singleton in the process. The region comes from the same factory
// (`aws.ts`) the rest of the AWS clients use.
let cognitoClient: CognitoIdentityProviderClient | null = null;

/** Lazily-constructed, process-wide Cognito Identity Provider client. */
export function getCognitoClient(): CognitoIdentityProviderClient {
  if (!cognitoClient) cognitoClient = new CognitoIdentityProviderClient({ region: REGION });
  return cognitoClient;
}

/**
 * Best-effort server-side session revocation for a user (#5, Tier 2).
 *
 * `AdminUserGlobalSignOut` invalidates ALL of the user's outstanding refresh
 * tokens (and the access tokens they would mint) pool-side, so a STOLEN refresh
 * token — which otherwise lives up to ~30 days and could silently re-mint a new
 * session via /auth/refresh — dies immediately when the legitimate user
 * self-deletes or deactivates. (Cognito access/ID tokens already issued stay
 * valid until their short ~1h expiry; refresh-driven renewal is what this kills.)
 *
 * `userId` is the Cognito `sub`. The `sub` is NOT a valid `Username` for a
 * federated user (Cognito stores those as `Google_<id>` / `SignInWithApple_<id>`),
 * so we resolve the real `Username` via a `sub` filter (mirroring
 * account-erasure.ts) before the sign-out — otherwise the call throws
 * `UserNotFoundException` for every federated account and the revoke silently
 * no-ops, defeating the whole point of Tier 2.
 *
 * This is BEST-EFFORT and MUST NOT fail the calling flow: the account-status
 * write (the authoritative soft-delete/deactivate) has already committed before
 * this is called. A revoke failure is swallowed and reported via `onError` (the
 * caller wires the ops-failure path) so it can be retried operationally, but the
 * delete/deactivate still returns success. Returns true on success, false if the
 * pool id is unset or the call failed.
 */
export async function revokeUserSessions(
  userId: string,
  onError?: (error: unknown) => void | Promise<void>
): Promise<boolean> {
  const userPoolId = await getServerEnv("COGNITO_USER_POOL_ID");
  if (!userPoolId) {
    await onError?.(new Error("COGNITO_USER_POOL_ID not configured — sessions NOT revoked."));
    return false;
  }

  try {
    const cognito = getCognitoClient();
    // Resolve the real Username from the sub. The sub is interpolated into a
    // SCIM filter, so strip anything outside the sub charset to prevent filter
    // injection (same sanitization as account-erasure.ts).
    const safeSub = userId.replace(/[^\w:.@-]/g, "");
    const listed = await cognito.send(
      new ListUsersCommand({ UserPoolId: userPoolId, Filter: `sub = "${safeSub}"`, Limit: 1 })
    );
    const username = listed.Users?.[0]?.Username;
    if (!username) {
      // No matching user (already deleted, or a brand-new race). Nothing to
      // revoke; report for operator follow-up but don't fail the flow.
      await onError?.(new Error("No matching Cognito user for this sub — sessions NOT revoked."));
      return false;
    }
    await cognito.send(
      new AdminUserGlobalSignOutCommand({ UserPoolId: userPoolId, Username: username })
    );
    return true;
  } catch (error) {
    // Never let a revoke failure surface to the caller — the lifecycle write has
    // already committed. Record it for operator follow-up and move on.
    await onError?.(error);
    return false;
  }
}
