import "server-only";
import { requireUser, requireRecentAuth } from "@/app/app/api/_lib/auth";
import { bookOk, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { BookApiError } from "@/app/app/api/book/_lib/errors";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import { getUserEntitlement, setAccountStatus } from "@/app/app/api/book/_lib/repo";
import { getStripeClient } from "@/app/app/api/book/_lib/stripe-service";
import {
  captureStripeCancelFailure,
  recordOpsFailure,
} from "@/app/app/api/book/_lib/ops-failure-repo";
import { revokeUserSessions } from "@/app/app/api/book/_lib/cognito-admin";

export const runtime = "nodejs";

/** Step-up window: self-delete requires a sign-in within the last 10 minutes. */
const DELETE_MAX_AUTH_AGE_MINUTES = 10;

/**
 * POST /app/api/book/me/account/delete
 *
 * Soft-deletes the user's account. Data is preserved in the backend but
 * the account becomes permanently non-functional. The user cannot
 * self-reactivate — only an admin can reverse a deletion.
 *
 * Requires body: { confirm: "DELETE" } as a server-side safety guard.
 *
 * If the user has an active Stripe subscription, it's cancelled immediately.
 */
export async function POST(req: Request) {
  return withBookApiErrors(req, async () => {
    const user = await requireUser();

    // Step-up auth (#5): deleting an account is destructive and irreversible by
    // the user. Require a recent sign-in so a walk-up / stolen-cookie attacker
    // on a long-lived session can't nuke the account. On a stale session this
    // throws AuthError("REAUTH_REQUIRED") → 401 reauth_required; the client
    // forces a fresh login and retries.
    requireRecentAuth(user, DELETE_MAX_AUTH_AGE_MINUTES);

    // Server-side confirmation guard
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    if (
      !body ||
      typeof body !== "object" ||
      (body as Record<string, unknown>).confirm !== "DELETE"
    ) {
      throw new BookApiError(
        400,
        "confirmation_required",
        'Request body must include { "confirm": "DELETE" }.'
      );
    }

    const tableName = await getBookTableName();

    // Capture current plan info before deletion
    const entitlement = await getUserEntitlement(tableName, user.sub);

    // Set account status to deleted
    await setAccountStatus(tableName, user.sub, "deleted", {
      statusReason: "user_requested",
      previousPlan: entitlement?.plan,
      previousProSource: entitlement?.proSource,
    });

    // Revoke the Cognito session globally so a stolen/long-lived refresh token
    // can't silently re-mint a session for a soft-deleted account (the soft
    // delete is a DynamoDB status, NOT a Cognito disable). Best-effort: it runs
    // AFTER the authoritative status write and MUST NOT fail the delete — a
    // revoke error is recorded as an ops-failure for operator follow-up only.
    await revokeUserSessions(user.sub, async (error) => {
      await recordOpsFailure(tableName, {
        kind: "cognito_global_signout",
        context: "account_delete",
        userId: user.sub,
        errorCode: (error as { name?: string; code?: string })?.code ?? (error as { name?: string })?.name,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    });

    // Cancel Stripe subscription immediately if active. A failure must NOT block
    // the deletion, but it must NOT be swallowed either — record it for operator
    // follow-up (admin Ops dashboard) and emit a CloudWatch metric.
    if (entitlement?.stripeSubscriptionId && entitlement.proStatus === "active") {
      try {
        const stripe = await getStripeClient();
        await stripe.subscriptions.cancel(entitlement.stripeSubscriptionId);
      } catch (error) {
        await captureStripeCancelFailure(tableName, {
          kind: "stripe_cancel",
          context: "account_delete",
          userId: user.sub,
          subscriptionId: entitlement.stripeSubscriptionId,
          stripeCustomerId: entitlement.stripeCustomerId,
          error,
        });
      }
    }

    return bookOk({ success: true, redirectTo: "/auth/logout" });
  });
}
