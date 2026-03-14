import "server-only";
import { requireUser } from "@/app/app/api/_lib/auth";
import { withBookApiErrors, bookOk } from "@/app/app/api/book/_lib/http";
import { getAppBaseUrl, getBookTableName } from "@/app/app/api/book/_lib/env";
import { getStripeClient } from "@/app/app/api/book/_lib/stripe-service";
import { getUserEntitlement } from "@/app/app/api/book/_lib/repo";
import { BookApiError } from "@/app/app/api/book/_lib/errors";

export const runtime = "nodejs";

export async function POST(req: Request) {
  return withBookApiErrors(req, async () => {
    const user = await requireUser();
    const [tableName, stripe, appBaseUrl] = await Promise.all([
      getBookTableName(),
      getStripeClient(),
      getAppBaseUrl(req.url),
    ]);

    const entitlement = await getUserEntitlement(tableName, user.sub);
    if (!entitlement?.stripeCustomerId) {
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
