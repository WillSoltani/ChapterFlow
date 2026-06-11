import type { AccountStatus } from "./types";

export type AccountAccessDecision = { action: "allow" | "reactivate" | "block" };

/**
 * Pure access decision for an account-lifecycle status. Kept free of
 * `server-only`/AWS imports so the gating policy can be unit-tested directly.
 *
 * - `active` / no record → allow
 * - `deactivated`        → reactivate, then allow (a valid token means the user
 *                          has signed back in; mirrors the page guard in
 *                          `app/_lib/require-dashboard-access.ts`)
 * - `deleted`            → block (deletion is reversible only by an admin)
 */
export function decideAccountAccess(
  status: AccountStatus | null | undefined
): AccountAccessDecision {
  if (!status || status === "active") return { action: "allow" };
  if (status === "deactivated") return { action: "reactivate" };
  return { action: "block" };
}
