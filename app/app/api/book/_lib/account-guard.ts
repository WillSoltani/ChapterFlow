import "server-only";

import { requireUser, type AuthedUser } from "@/app/app/api/_lib/auth";
import { isDevAuthBypassEnabled } from "@/app/app/_lib/dev-auth-bypass";
import { BookApiError } from "./errors";
import { getBookTableName } from "./env";
import { getAccountStatus, setAccountStatus } from "./repo";
import type { AccountStatus } from "./types";
import { decideAccountAccess } from "./account-guard-policy";

export { decideAccountAccess } from "./account-guard-policy";

/**
 * Authenticate the request AND enforce the account lifecycle status.
 *
 * This is the gate that every user-facing Book API route should use instead of
 * the bare `requireUser()` — `requireUser()` only proves the Cognito token is
 * valid, it does NOT know whether the account has been deactivated or deleted.
 *
 * A handful of routes intentionally stay on `requireUser()` because they must
 * remain reachable by a deactivated/deleted user: `me/account/delete`,
 * `me/account/deactivate`, `me/export`, and `me/entitlements`.
 *
 * Behaviour:
 *  - deleted     → throws `BookApiError(403, "account_deleted")`
 *  - deactivated → auto-reactivates (idempotent) and proceeds
 *  - active      → proceeds
 *
 * Fail-open: a DynamoDB read error does NOT lock the user out (a status-store
 * outage must not take down every authenticated request). This matches the
 * fail-open posture already used by `requireDashboardAccess`.
 */
export async function requireActiveBookUser(): Promise<AuthedUser> {
  const user = await requireUser();

  // Local development bypass: `requireUser()` already returns a synthetic user
  // without touching Cognito, and BOOK_TABLE_NAME may be unset locally. Skip
  // the status read entirely, mirroring `requireDashboardAccess`.
  if (isDevAuthBypassEnabled()) return user;

  let status: AccountStatus | null = null;
  try {
    const tableName = await getBookTableName();
    const record = await getAccountStatus(tableName, user.sub);
    status = record?.status ?? null;

    const decision = decideAccountAccess(status);
    if (decision.action === "reactivate") {
      await setAccountStatus(tableName, user.sub, "active", {
        statusReason: "user_reactivated",
      });
    }
  } catch (error) {
    if (error instanceof BookApiError) throw error;
    // Treat any infrastructure failure (e.g. DynamoDB unavailable, env missing)
    // as fail-open so a transient outage cannot lock out the entire user base.
    console.error("account_status_gate_error", {
      userId: user.sub,
      message: error instanceof Error ? error.message : String(error),
    });
    return user;
  }

  if (decideAccountAccess(status).action === "block") {
    throw new BookApiError(
      403,
      "account_deleted",
      "This account has been deleted and is no longer accessible."
    );
  }

  return user;
}
