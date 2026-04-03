import "server-only";
import { requireUser } from "@/app/app/api/_lib/auth";
import { bookOk, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import { getUserEntitlement, setAccountStatus } from "@/app/app/api/book/_lib/repo";
import { getStripeClient } from "@/app/app/api/book/_lib/stripe-service";

export const runtime = "nodejs";

/**
 * POST /app/api/book/me/account/deactivate
 *
 * Soft-deactivates the user's account. Data is preserved but the account
 * becomes non-functional. The user can reactivate by signing back in.
 *
 * If the user has an active Stripe subscription, it's set to cancel at
 * period end so they aren't charged again.
 */
export async function POST(req: Request) {
  return withBookApiErrors(req, async () => {
    const user = await requireUser();
    const tableName = await getBookTableName();

    // Capture current plan info before deactivation
    const entitlement = await getUserEntitlement(tableName, user.sub);

    // Set account status to deactivated
    await setAccountStatus(tableName, user.sub, "deactivated", {
      statusReason: "user_requested",
      previousPlan: entitlement?.plan,
      previousProSource: entitlement?.proSource,
    });

    // Cancel Stripe subscription at period end if active
    if (entitlement?.stripeSubscriptionId && entitlement.proStatus === "active") {
      try {
        const stripe = await getStripeClient();
        await stripe.subscriptions.update(entitlement.stripeSubscriptionId, {
          cancel_at_period_end: true,
        });
      } catch {
        // Don't block deactivation if Stripe call fails — subscription
        // will eventually expire or can be handled manually
      }
    }

    return bookOk({ success: true, redirectTo: "/auth/logout" });
  });
}
