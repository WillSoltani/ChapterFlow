import "server-only";
import { requireActiveBookUser } from "@/app/app/api/book/_lib/account-guard";
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
import {
  PRICING,
  ANNUAL_TOTAL_AMOUNT,
  formatAmountWithCurrency,
} from "@/lib/pricing";
import { shouldBlockStripeCheckout } from "@/app/app/api/book/_lib/stripe-checkout-entitlement-core";

export const runtime = "nodejs";

/** Human-readable renewal terms per interval, for the Stripe Checkout disclosure. */
function renewalDescription(interval: BillingInterval): string {
  switch (interval) {
    case "annual":
      return `${formatAmountWithCurrency(ANNUAL_TOTAL_AMOUNT)} per year (${formatAmountWithCurrency(
        PRICING.annualMonthlyAmount,
      )}/month, billed annually)`;
    case "annual_upfront":
      return `${formatAmountWithCurrency(PRICING.annualUpfrontAmount)} per year`;
    case "monthly":
    default:
      return `${formatAmountWithCurrency(PRICING.monthlyAmount)} per month`;
  }
}

export async function POST(req: Request) {
  return withBookApiErrors(req, async () => {
    const user = await requireActiveBookUser();

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

    // Money-path guard (CHECKOUT-DOUBLE): refuse a NEW subscription for anyone
    // who is already Pro by ANY source — Stripe, license, gift_code,
    // flow_points, admin. Also block an attached Apple lineage after its
    // effective period expires: Stripe's webhook cannot overwrite Apple, so
    // charging first would create paid-without-access. The Stripe-subscription
    // lookup below only catches Stripe-Pro users (customerExisted); this catches
    // the rest BEFORE we mint a customer or checkout session.
    if (shouldBlockStripeCheckout(entitlement)) {
      throw new BookApiError(
        409,
        "already_pro",
        "You already have Pro access. Manage your plan from your account settings."
      );
    }

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

    // Inspect the customer's Stripe subscription history once and use it for two
    // purposes: (1) block creating a duplicate subscription for someone who is
    // already paying, and (2) decide trial eligibility. A freshly created
    // customer provably has neither, so skip the lookup entirely.
    let grantTrial = true;
    if (customerExisted && customerId) {
      const priorSubs = await stripe.subscriptions.list({
        customer: customerId,
        status: "all",
        limit: 100,
      });

      // Duplicate-subscription guard: Stripe permits multiple active
      // subscriptions per customer, so an authenticated subscriber hitting this
      // endpoint again (the UI hides the button, but the API is reachable)
      // would create a SECOND subscription and be double-billed. Refuse if any
      // billable subscription already exists.
      const hasActiveSubscription = priorSubs.data.some(
        (sub) =>
          sub.status === "active" ||
          sub.status === "trialing" ||
          sub.status === "past_due"
      );
      if (hasActiveSubscription) {
        throw new BookApiError(
          409,
          "subscription_already_active",
          "You already have an active subscription. Manage it from your account settings."
        );
      }

      // Free trials are for NEW subscribers only (Terms: "14-day free trial for
      // new subscribers"). A pre-existing customer that already has ANY Stripe
      // subscription — active, canceled, or past (status "all") — has used their
      // trial, so suppress it to prevent cancel-and-resubscribe trial farming.
      grantTrial = priorSubs.data.length === 0;
    }

    // Pre-charge disclosure shown on Stripe's hosted Checkout page (card-network
    // + consumer-law requirement for free trials / auto-renewing subscriptions).
    const renewal = renewalDescription(interval);
    const submitMessage = grantTrial
      ? `Your ${PRICING.trialDays}-day free trial starts today. When it ends, your subscription ` +
        `renews automatically at ${renewal} until you cancel. Cancel anytime in your account ` +
        `settings before the trial ends to avoid being charged. Partial periods are not refunded.`
      : `Your subscription renews automatically at ${renewal} until you cancel. Cancel anytime in ` +
        `your account settings; partial periods are not refunded.`;

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
      custom_text: { submit: { message: submitMessage } },
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
