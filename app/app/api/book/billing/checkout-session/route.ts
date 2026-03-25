import "server-only";
import { requireUser } from "@/app/app/api/_lib/auth";
import { withBookApiErrors, bookOk } from "@/app/app/api/book/_lib/http";
import { getAppBaseUrl, getBookTableName } from "@/app/app/api/book/_lib/env";
import { getStripeClient, getStripePriceIdOrThrow } from "@/app/app/api/book/_lib/stripe-service";
import {
  attachStripeCustomerToEntitlement,
  getUserEntitlement,
  mapStripeCustomerToUser,
} from "@/app/app/api/book/_lib/repo";

export const runtime = "nodejs";

export async function POST(req: Request) {
  return withBookApiErrors(req, async () => {
    const user = await requireUser();
    const [tableName, stripe, priceId, appBaseUrl] = await Promise.all([
      getBookTableName(),
      getStripeClient(),
      getStripePriceIdOrThrow(),
      getAppBaseUrl(req.url),
    ]);

    const entitlement = await getUserEntitlement(tableName, user.sub);
    let customerId = entitlement?.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId: user.sub },
      });
      customerId = customer.id;
      await Promise.all([
        attachStripeCustomerToEntitlement(tableName, user.sub, customerId),
        mapStripeCustomerToUser(tableName, customerId, user.sub),
      ]);
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${appBaseUrl}/dashboard?billing=success`,
      cancel_url: `${appBaseUrl}/dashboard?billing=cancelled`,
      metadata: {
        userId: user.sub,
      },
      allow_promotion_codes: true,
    });

    return bookOk({
      checkoutUrl: session.url,
      sessionId: session.id,
    });
  });
}
