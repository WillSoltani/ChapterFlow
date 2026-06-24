import "server-only";
import { requireActiveBookUser } from "@/app/app/api/book/_lib/account-guard";
import { requireRecentAuth } from "@/app/app/api/_lib/auth";
import { withBookApiErrors, bookOk } from "@/app/app/api/book/_lib/http";
import { getAppBaseUrl, getBookTableName } from "@/app/app/api/book/_lib/env";
import { getStripeClient } from "@/app/app/api/book/_lib/stripe-service";
import { getUserEntitlement } from "@/app/app/api/book/_lib/repo";
import { BookApiError } from "@/app/app/api/book/_lib/errors";

export const runtime = "nodejs";

/**
 * Step-up window (#5, Tier 3): the Stripe billing portal can cancel the
 * subscription and update the payment method, so require a sign-in within the
 * last 10 minutes before minting a portal session.
 */
const PORTAL_MAX_AUTH_AGE_MINUTES = 10;

export async function POST(req: Request) {
  return withBookApiErrors(req, async () => {
    // requireActiveBookUser runs the auth + account-status guard FIRST; the
    // step-up recency check then runs on the already-validated user.
    const user = await requireActiveBookUser();
    requireRecentAuth(user, PORTAL_MAX_AUTH_AGE_MINUTES);
    const [tableName, stripe, appBaseUrl] = await Promise.all([
      getBookTableName(),
      getStripeClient(),
      getAppBaseUrl(req.url),
    ]);

    const entitlement = await getUserEntitlement(tableName, user.sub);
    if (!entitlement?.stripeCustomerId) {
      const source = entitlement?.proSource;
      if (source === "license") {
        throw new BookApiError(
          400,
          "not_stripe_subscriber",
          "Your Pro access is from a license key — there's no Stripe subscription to manage."
        );
      }
      if (source === "flow_points") {
        throw new BookApiError(
          400,
          "not_stripe_subscriber",
          "Your Pro access is from Insight Points — there's no Stripe subscription to manage."
        );
      }
      if (source === "gift_code") {
        throw new BookApiError(
          400,
          "not_stripe_subscriber",
          "Your Pro access is from a gift — there's no Stripe subscription to manage."
        );
      }
      throw new BookApiError(
        400,
        "customer_not_found",
        "No billing customer is attached to this account."
      );
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: entitlement.stripeCustomerId,
      return_url: `${appBaseUrl}/book/settings`,
    });

    return bookOk({ portalUrl: session.url });
  });
}
