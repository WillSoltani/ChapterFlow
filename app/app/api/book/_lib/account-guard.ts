import "server-only";

import { requireUser, type AuthedUser } from "@/app/app/api/_lib/auth";
import { isDevAuthBypassEnabled } from "@/app/app/_lib/dev-auth-bypass";
import { logger } from "@/lib/logging/logger";
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
 *
 * Exception — known-deleted accounts fail CLOSED: every successful status read
 * records whether the account is deleted in a short-TTL in-memory map keyed by
 * `userId`. If a later read fails (e.g. a DynamoDB outage) while the cache still
 * holds a fresh `deleted` flag, the request is blocked rather than defaulting to
 * allow. This closes the L18 gap where a soft-deleted account regained access to
 * mutating routes during a transient outage, without sacrificing availability
 * for the (vastly larger) set of active accounts.
 */

/**
 * Per-process cache of the last-known account status for accounts observed to be
 * deleted. Only `deleted` is cached (active accounts are never written) so the
 * map stays bounded by the number of distinct deleted users that have hit this
 * process, and a read failure can still honor a recently-confirmed deletion.
 */
const KNOWN_DELETED_TTL_MS = 5 * 60 * 1000;
const knownDeleted = new Map<string, number>();

function rememberStatus(userId: string, status: AccountStatus | null): void {
  if (status === "deleted") {
    knownDeleted.set(userId, Date.now() + KNOWN_DELETED_TTL_MS);
  } else {
    // A successful read of a non-deleted status clears any stale deleted flag
    // (e.g. an admin restored the account).
    knownDeleted.delete(userId);
  }
}

function isKnownDeleted(userId: string): boolean {
  const expiresAt = knownDeleted.get(userId);
  if (expiresAt === undefined) return false;
  if (expiresAt <= Date.now()) {
    knownDeleted.delete(userId);
    return false;
  }
  return true;
}

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
    rememberStatus(user.sub, status);

    const decision = decideAccountAccess(status);
    if (decision.action === "reactivate") {
      await setAccountStatus(tableName, user.sub, "active", {
        statusReason: "user_reactivated",
      });
    }
  } catch (error) {
    if (error instanceof BookApiError) throw error;
    // Fail CLOSED for accounts we recently observed as deleted: a status-store
    // outage must not let a known soft-deleted account slip back into the
    // mutating routes. Everyone else fails OPEN (see below) so a transient
    // outage cannot lock out the entire user base.
    if (isKnownDeleted(user.sub)) {
      logger.error("account_status_gate_fail_closed", {
        userId: user.sub,
        err: error,
      });
      throw new BookApiError(
        403,
        "account_deleted",
        "This account has been deleted and is no longer accessible."
      );
    }
    // Treat any other infrastructure failure (e.g. DynamoDB unavailable, env
    // missing) as fail-open.
    logger.error("account_status_gate_error", {
      userId: user.sub,
      err: error,
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
