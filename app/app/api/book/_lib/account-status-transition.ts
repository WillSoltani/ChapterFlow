import type { OpsFailureKind } from "./types";

/**
 * Orchestration for an admin/self-service account-lifecycle transition plus the
 * Stripe-subscription cancellation that deactivate/delete imply.
 *
 * Extracted from the route handlers (which are `server-only` + AWS, so they
 * can't be unit-tested directly) as a dependency-injected, runtime-import-free
 * helper — same "extract pure logic for testability" convention as
 * `account-guard-policy.ts` / `reconciliation-core.ts`.
 *
 * The contract intentionally mirrors the self-service routes
 * (`me/account/delete`, `me/account/deactivate`):
 *   - the entitlement is read BEFORE the status mutation, with NO error
 *     swallowing, so a transient DynamoDB read failure fails the whole
 *     transition (the caller retries) instead of silently skipping the cancel
 *     and leaving a paying subscription billing forever, and
 *   - the cancel itself is best-effort — a Stripe API failure is captured for
 *     operator retry, never propagated.
 */

export type AccountTransitionAction = "reactivate" | "deactivate" | "delete";

/** The subset of the entitlement this orchestration reads. */
type EntitlementView = {
  proStatus?: string;
  stripeSubscriptionId?: string;
  stripeCustomerId?: string;
};

export type AccountTransitionDeps = {
  /** Read the user's entitlement. May reject — the rejection MUST propagate. */
  getEntitlement: () => Promise<EntitlementView | null>;
  /** Persist the new account status. */
  setStatus: () => Promise<void>;
  /** Cancel the subscription immediately (delete). */
  cancelImmediately: (subscriptionId: string) => Promise<void>;
  /** Schedule the subscription to cancel at period end (deactivate). */
  cancelAtPeriodEnd: (subscriptionId: string) => Promise<void>;
  /** Record a failed Stripe cancellation for operator follow-up (best-effort). */
  captureCancelFailure: (input: {
    kind: OpsFailureKind;
    subscriptionId?: string;
    stripeCustomerId?: string;
    error: unknown;
  }) => Promise<void>;
};

/**
 * Apply an account-status transition and, for deactivate/delete, cancel the
 * user's active Stripe subscription.
 *
 * Resolves on success and on a best-effort-captured cancel failure. Rejects
 * (without mutating status) if the entitlement read rejects — a clean `null`
 * entitlement (no row) is the only legitimate skip; reactivate never reads.
 */
export async function applyAccountStatusTransition(
  action: AccountTransitionAction,
  deps: AccountTransitionDeps,
): Promise<void> {
  const cancels = action === "deactivate" || action === "delete";

  // Read BEFORE mutating status, with NO error swallowing: a transient DynamoDB
  // read failure must fail the whole transition so the caller retries — never
  // silently skip the cancel. `null` (no entitlement row) is the legitimate
  // skip. reactivate touches no billing, so it never reads.
  const entitlement = cancels ? await deps.getEntitlement() : null;

  await deps.setStatus();

  if (!cancels) return;
  if (!entitlement?.stripeSubscriptionId || entitlement.proStatus !== "active") return;

  const subscriptionId = entitlement.stripeSubscriptionId;
  try {
    if (action === "delete") {
      await deps.cancelImmediately(subscriptionId);
    } else {
      await deps.cancelAtPeriodEnd(subscriptionId);
    }
  } catch (error) {
    // Best-effort: capture for operator retry, don't propagate — the status
    // change must stand even if Stripe is unreachable.
    await deps.captureCancelFailure({
      kind: action === "delete" ? "stripe_cancel" : "stripe_cancel_at_period_end",
      subscriptionId,
      stripeCustomerId: entitlement.stripeCustomerId,
      error,
    });
  }
}
