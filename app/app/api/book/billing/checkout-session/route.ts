import "server-only";
import { requireUser } from "@/app/app/api/_lib/auth";
import { withBookApiErrors, bookOk } from "@/app/app/api/book/_lib/http";
import { BookApiError } from "@/app/app/api/book/_lib/errors";
import { getAppBaseUrl, getBookTableName } from "@/app/app/api/book/_lib/env";
import {
  getStripeClient,
  getStripePriceIdForInterval,
  type BillingInterval,
} from "@/app/app/api/book/_lib/stripe-service";
import {
  attachStripeCustomerIfAbsent,
  getUserEntitlement,
  mapStripeCustomerToUser,
} from "@/app/app/api/book/_lib/repo";
import { PRICING } from "@/lib/pricing";

export const runtime = "nodejs";

export async function POST(req: Request) {
  return withBookApiErrors(req, async () => {
    const user = await requireUser();

    let interval: BillingInterval = "monthly";
    try {
      const body = await req.json();
      if (body?.interval === "annual" || body?.interval === "annual_upfront") {
        interval = body.interval;
      }
    } catch {
      // No body or invalid JSON — default to monthly
    }

    const [tableName, stripe, priceId, appBaseUrl] = await Promise.all([
      getBookTableName(),
      getStripeClient(),
      getStripePriceIdForInterval(interval),
      getAppBaseUrl(req.url),
    ]);

    const entitlement = await getUserEntitlement(tableName, user.sub);
    let customerId = entitlement?.stripeCustomerId;
    const customerExisted = Boolean(customerId);

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId: user.sub },
      });
      const newCustomerId = customer.id;
      // Conditional attach: only the first concurrent request wins. The
      // loser re-reads the entitlement to discover the winning customerId
      // and deletes its own orphan Stripe customer to avoid bloating the
      // Stripe account with duplicates.
      const won = await attachStripeCustomerIfAbsent(tableName, user.sub, newCustomerId);
      if (won) {
        // Reverse mapping must exist before any webhook can resolve user.
        await mapStripeCustomerToUser(tableName, newCustomerId, user.sub);
        customerId = newCustomerId;
      } else {
        // Race: another request already attached a customer. Re-read and
        // clean up our orphan.
        const fresh = await getUserEntitlement(tableName, user.sub);
        customerId = fresh?.stripeCustomerId;
        // Best-effort orphan cleanup; never fail the checkout for this.
        stripe.customers.del(newCustomerId).catch(() => {});
        if (!customerId) {
          throw new BookApiError(
            500,
            "customer_attach_race",
            "Could not attach Stripe customer to account."
          );
        }
      }
    }

    // Free trials are for NEW subscribers only (Terms: "14-day free trial for
    // new subscribers"). A pre-existing customer that already has ANY Stripe
    // subscription — active, canceled, or past (status "all") — has used their
    // trial, so suppress it to prevent cancel-and-resubscribe trial farming. A
    // freshly created customer provably has none, so they keep the trial.
    let grantTrial = true;
    if (customerExisted && customerId) {
      const priorSubs = await stripe.subscriptions.list({
        customer: customerId,
        status: "all",
        limit: 1,
      });
      grantTrial = priorSubs.data.length === 0;
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
      // Stripe still collects a card up front and auto-charges when the trial
      // ends, so the "you won't be charged during the trial" copy holds. The
      // trial length is the single source PRICING.trialDays and is shared across
      // all intervals (monthly / annual / annual_upfront).
      ...(grantTrial
        ? { subscription_data: { trial_period_days: PRICING.trialDays } }
        : {}),
    });

    return bookOk({
      checkoutUrl: session.url,
      sessionId: session.id,
    });
  });
}
