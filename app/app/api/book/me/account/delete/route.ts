import "server-only";
import { requireUser } from "@/app/app/api/_lib/auth";
import { bookOk, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { BookApiError } from "@/app/app/api/book/_lib/errors";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import { getUserEntitlement, setAccountStatus } from "@/app/app/api/book/_lib/repo";
import { getStripeClient } from "@/app/app/api/book/_lib/stripe-service";
import { captureStripeCancelFailure } from "@/app/app/api/book/_lib/ops-failure-repo";

export const runtime = "nodejs";

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
