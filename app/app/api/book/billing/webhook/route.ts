import "server-only";
import { withBookApiErrors, bookOk } from "@/app/app/api/book/_lib/http";
import { getBookTableName, getBookAnalyticsTableName } from "@/app/app/api/book/_lib/env";
import {
  getUserIdByStripeCustomer,
  hasStripeWebhookEventBeenProcessed,
  mapStripeCustomerToUser,
  recordBillingEvent,
  recordStripeWebhookEvent,
  updateUserEntitlementFromStripe,
} from "@/app/app/api/book/_lib/repo";
import {
  analyticsTrackFlowPointsTransaction,
  analyticsTrackReferral,
  analyticsTrackSubscription,
} from "@/app/app/api/book/_lib/analytics-repo";
import {
  awardFlowPoints,
  getUserReferralClaim,
  markReferralProRewarded,
} from "@/app/app/api/book/_lib/flow-points-repo";
import {
  getStripeClient,
  getStripeWebhookSecretOrThrow,
} from "@/app/app/api/book/_lib/stripe-service";
import { BookApiError } from "@/app/app/api/book/_lib/errors";
import { INSIGHT_POINTS_AMOUNTS } from "@/app/book/_lib/flow-points-economy";
import { BILLING_CURRENCY } from "@/lib/pricing";

export const runtime = "nodejs";

function isoFromUnix(value: number | null | undefined): string | undefined {
  if (!value || !Number.isFinite(value)) return undefined;
  return new Date(value * 1000).toISOString();
}

function mapSubscriptionStatus(
  status: string
): { plan: "FREE" | "PRO"; proStatus: "inactive" | "active" | "past_due" | "canceled" } {
  if (status === "active" || status === "trialing") {
    return { plan: "PRO", proStatus: "active" };
  }
  if (status === "past_due") {
    return { plan: "PRO", proStatus: "past_due" };
  }
  // "paused" — Stripe collection paused (e.g. via the portal). Treat as
  // canceled for entitlement purposes; if it resumes, the next event will
  // flip it back to active.
  // "canceled", "incomplete", "incomplete_expired", "unpaid" → no Pro.
  return { plan: "FREE", proStatus: "canceled" };
}

async function resolveUserIdForEvent(
  tableName: string,
  customerId: string | null,
  metadataUserId: string | undefined
): Promise<string | null> {
  if (metadataUserId) return metadataUserId;
  if (!customerId) return null;
  return getUserIdByStripeCustomer(tableName, customerId);
}

// §6.1 amended — The referral_pro_inviter 600 IP payout has been REMOVED entirely.
// Rationale: uncapped per-occurrence faucet, sender-benefit framing.
// Motivational value redistributed into escalation tier bonuses (§6.3, P3).
// The function is retained as a no-op to avoid breaking callers during migration.
async function maybeAwardReferralProConversion(_params: {
  tableName: string;
  analyticsTable: string | null;
  userId: string;
}) {
  // No-op — Pro conversion reward removed per spec §6.1 amendment.
  // Referral rewards are now milestone-gated via escalation tiers (§6.3).
  return;
}

export async function POST(req: Request) {
  return withBookApiErrors(req, async () => {
    const tableName = await getBookTableName();
    const stripe = await getStripeClient();
    const webhookSecret = await getStripeWebhookSecretOrThrow();

    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      throw new BookApiError(400, "missing_signature", "Missing Stripe signature.");
    }

    const payload = await req.text();
    let event;
    try {
      event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (err) {
      // Only return 400 for signature verification failures.
      // Let genuine server errors bubble as 500 so Stripe retries.
      if (err instanceof Error && err.message.includes("signature")) {
        throw new BookApiError(400, "invalid_signature", "Invalid Stripe webhook signature.");
      }
      throw err;
    }

    const [alreadyProcessed, analyticsTable] = await Promise.all([
      hasStripeWebhookEventBeenProcessed(tableName, event.id),
      getBookAnalyticsTableName(),
    ]);
    if (alreadyProcessed) {
      return bookOk({ ok: true, duplicate: true });
    }

    // checkout.session.completed fires for synchronous payment methods (cards).
    // checkout.session.async_payment_succeeded fires for delayed methods like
    // SEPA Debit, Bacs, OXXO once funds clear (sometimes days later). The
    // session payload shape is identical, so we share the handler.
    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      const session = event.data.object as { customer: string | null; subscription?: string | null; metadata?: { userId?: string } };
      const customerId = session.customer;
      const userId = await resolveUserIdForEvent(
        tableName,
        customerId,
        session.metadata?.userId
      );
      if (!userId || !customerId) {
        // Throw 500 so Stripe retries — silent success would permanently lose
        // the upgrade if e.g. the customer→user mapping hasn't propagated yet.
        throw new BookApiError(
          500,
          "user_resolution_failed",
          `checkout.session.completed: could not resolve user (customer=${customerId ?? "null"})`
        );
      }
      {
        await mapStripeCustomerToUser(tableName, customerId, userId);
        await updateUserEntitlementFromStripe(tableName, {
          userId,
          plan: "PRO",
          proStatus: "active",
          proSource: "stripe",
          stripeCustomerId: customerId,
          stripeSubscriptionId: session.subscription ?? undefined,
        });
        if (analyticsTable) {
          analyticsTrackSubscription(analyticsTable, {
            userId,
            plan: "PRO",
            proStatus: "active",
            proSource: "stripe",
            stripeCustomerId: customerId,
            stripeSubscriptionId: session.subscription ?? undefined,
          }).catch(() => {});
        }
        maybeAwardReferralProConversion({
          tableName,
          analyticsTable: analyticsTable ?? null,
          userId,
        }).catch(() => {});
      }
    } else if (event.type === "checkout.session.async_payment_failed") {
      // Delayed payment method failed before funds cleared. The user never
      // became Pro, so there's no entitlement to revert — just audit log.
      const session = event.data.object as { customer: string | null };
      if (session.customer && analyticsTable) {
        const userId = await getUserIdByStripeCustomer(tableName, session.customer);
        if (userId) {
          analyticsTrackSubscription(analyticsTable, {
            userId,
            plan: "FREE",
            proStatus: "inactive",
            stripeCustomerId: session.customer,
          }).catch(() => {});
        }
      }
    } else if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted" ||
      event.type === "customer.subscription.paused" ||
      event.type === "customer.subscription.resumed"
    ) {
      const subscription = event.data.object as {
        customer: string;
        id: string;
        status: string;
        current_period_end?: number;
        cancel_at_period_end?: boolean;
        currency?: string;
        items?: {
          data?: Array<{
            price?: {
              id?: string;
              unit_amount?: number;
              currency?: string;
              recurring?: { interval?: string };
            };
          }>;
        };
        discount?: { coupon?: { id?: string } };
        metadata?: { userId?: string };
      };
      const userId = await resolveUserIdForEvent(
        tableName,
        subscription.customer,
        subscription.metadata?.userId
      );
      if (!userId) {
        throw new BookApiError(
          500,
          "user_resolution_failed",
          `${event.type}: could not resolve user for customer ${subscription.customer}`
        );
      }
      {
        const mapped = mapSubscriptionStatus(subscription.status);
        const firstItem = subscription.items?.data?.[0]?.price;
        const subCurrency =
          subscription.currency?.toUpperCase() ?? firstItem?.currency?.toUpperCase();
        if (subCurrency && subCurrency !== BILLING_CURRENCY) {
          // We sell in a single currency (BILLING_CURRENCY). A different currency
          // means a misconfigured Stripe Price or an unplanned market — admin MRR
          // assumes one currency, so flag it. Do NOT reject: dropping the event
          // would desync the entitlement from Stripe.
          console.warn(
            `[stripe-webhook] subscription ${subscription.id} billed in ${subCurrency}, expected ${BILLING_CURRENCY}`,
          );
        }
        const subAmountCents = firstItem?.unit_amount;
        const subPriceId = firstItem?.id;
        const subInterval = firstItem?.recurring?.interval;

        await mapStripeCustomerToUser(tableName, subscription.customer, userId);
        await updateUserEntitlementFromStripe(tableName, {
          userId,
          plan: mapped.plan,
          proStatus: mapped.proStatus,
          proSource: mapped.plan === "PRO" ? "stripe" : undefined,
          stripeCustomerId: subscription.customer,
          stripeSubscriptionId: subscription.id,
          currentPeriodEnd: isoFromUnix(subscription.current_period_end),
          cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
          billingCurrency: subCurrency,
          subscriptionAmountCents: subAmountCents,
          stripePriceId: subPriceId,
          subscriptionInterval: subInterval,
        });
        if (analyticsTable) {
          analyticsTrackSubscription(analyticsTable, {
            userId,
            plan: mapped.plan,
            proStatus: mapped.proStatus,
            proSource: mapped.plan === "PRO" ? "stripe" : undefined,
            stripeCustomerId: subscription.customer,
            stripeSubscriptionId: subscription.id,
            currentPeriodEnd: isoFromUnix(subscription.current_period_end),
          }).catch(() => {});
        }
        if (mapped.plan === "PRO" && mapped.proStatus === "active") {
          maybeAwardReferralProConversion({
            tableName,
            analyticsTable: analyticsTable ?? null,
            userId,
          }).catch(() => {});
        }
      }
    } else if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object as {
        customer: string | null;
        subscription?: string | null;
        last_finalization_error?: { code?: string; message?: string };
      };
      if (invoice.customer) {
        const userId = await getUserIdByStripeCustomer(tableName, invoice.customer);
        if (!userId) {
          throw new BookApiError(
            500,
            "user_resolution_failed",
            `invoice.payment_failed: no user for customer ${invoice.customer}`
          );
        }
        await updateUserEntitlementFromStripe(tableName, {
          userId,
          plan: "PRO",
          proStatus: "past_due",
          proSource: "stripe",
          stripeCustomerId: invoice.customer,
          stripeSubscriptionId: invoice.subscription ?? undefined,
          failedPaymentLastReason:
            invoice.last_finalization_error?.code ?? "payment_failed",
        });
        if (analyticsTable) {
          analyticsTrackSubscription(analyticsTable, {
            userId,
            plan: "PRO",
            proStatus: "past_due",
            proSource: "stripe",
            stripeCustomerId: invoice.customer,
            stripeSubscriptionId: invoice.subscription ?? undefined,
          }).catch(() => {});
        }
      }
    } else if (event.type === "invoice.paid") {
      const invoice = event.data.object as {
        customer: string | null;
        subscription?: string | null;
        amount_paid?: number;
        currency?: string;
        status_transitions?: { paid_at?: number };
      };
      if (invoice.customer) {
        const userId = await getUserIdByStripeCustomer(tableName, invoice.customer);
        if (!userId) {
          throw new BookApiError(
            500,
            "user_resolution_failed",
            `invoice.paid: no user for customer ${invoice.customer}`
          );
        }
        await updateUserEntitlementFromStripe(tableName, {
          userId,
          plan: "PRO",
          proStatus: "active",
          proSource: "stripe",
          stripeCustomerId: invoice.customer,
          stripeSubscriptionId: invoice.subscription ?? undefined,
          lastInvoiceAmountCents: invoice.amount_paid,
          lastInvoiceCurrency: invoice.currency?.toUpperCase(),
          lastInvoicePaidAt: isoFromUnix(invoice.status_transitions?.paid_at),
        });
        if (analyticsTable) {
          analyticsTrackSubscription(analyticsTable, {
            userId,
            plan: "PRO",
            proStatus: "active",
            proSource: "stripe",
            stripeCustomerId: invoice.customer,
            stripeSubscriptionId: invoice.subscription ?? undefined,
          }).catch(() => {});
        }
        maybeAwardReferralProConversion({
          tableName,
          analyticsTable: analyticsTable ?? null,
          userId,
        }).catch(() => {});
      }
    } else if (event.type === "invoice.payment_action_required") {
      // 3D Secure / SCA challenge needed. Mark as past_due so the UI can
      // prompt the user to update their payment method via the portal.
      const invoice = event.data.object as {
        customer: string | null;
        subscription?: string | null;
      };
      if (invoice.customer) {
        const userId = await getUserIdByStripeCustomer(tableName, invoice.customer);
        if (!userId) {
          throw new BookApiError(
            500,
            "user_resolution_failed",
            `invoice.payment_action_required: no user for customer ${invoice.customer}`
          );
        }
        await updateUserEntitlementFromStripe(tableName, {
          userId,
          plan: "PRO",
          proStatus: "past_due",
          proSource: "stripe",
          stripeCustomerId: invoice.customer,
          stripeSubscriptionId: invoice.subscription ?? undefined,
        });
      }
    } else if (event.type === "customer.subscription.trial_will_end") {
      // Trial ending in ~3 days. Nothing to mutate; analytics-only so the
      // ops side can drive a "your trial ends soon" email if desired.
      const subscription = event.data.object as { customer: string };
      if (subscription.customer && analyticsTable) {
        const userId = await getUserIdByStripeCustomer(tableName, subscription.customer);
        if (userId) {
          analyticsTrackSubscription(analyticsTable, {
            userId,
            plan: "PRO",
            proStatus: "active",
            proSource: "stripe",
            stripeCustomerId: subscription.customer,
          }).catch(() => {});
        }
      }
    } else if (event.type === "charge.refunded") {
      // Persist a durable refund record for the admin finance report. We do NOT
      // downgrade here: refunds may be partial, and a refund that cancels the
      // subscription fires a separate customer.subscription.deleted that handles
      // the entitlement. (Previously this wrongly stamped the analytics snapshot
      // "canceled", corrupting analytics for partial refunds.)
      const charge = event.data.object as {
        id: string;
        customer: string | null;
        amount_refunded?: number;
        currency?: string;
        created?: number;
        refunds?: {
          data?: Array<{
            id: string;
            amount?: number;
            currency?: string;
            reason?: string | null;
            status?: string | null;
            created?: number;
          }>;
        };
      };
      const userId = charge.customer
        ? await getUserIdByStripeCustomer(tableName, charge.customer)
        : null;
      const refunds = charge.refunds?.data ?? [];
      if (refunds.length > 0) {
        // One durable record per individual refund: charge.amount_refunded is
        // CUMULATIVE, so we must use each refund's own amount, and each refund id
        // is a unique, stable idempotency key (redelivery overwrites in place).
        for (const r of refunds) {
          await recordBillingEvent(tableName, {
            kind: "refund",
            eventId: r.id,
            userId,
            stripeCustomerId: charge.customer ?? null,
            chargeId: charge.id,
            amountCents: r.amount ?? 0,
            currency: (r.currency ?? charge.currency ?? BILLING_CURRENCY).toUpperCase(),
            reason: r.reason ?? null,
            status: r.status ?? "succeeded",
            createdAt: isoFromUnix(r.created ?? charge.created) ?? new Date().toISOString(),
          });
        }
      } else {
        // The Charge's refunds list isn't guaranteed on the event payload. Fall
        // back to one cumulative record keyed by the UNIQUE event id, so repeated
        // partial refunds produce distinct rows instead of colliding on charge.id.
        await recordBillingEvent(tableName, {
          kind: "refund",
          eventId: event.id,
          userId,
          stripeCustomerId: charge.customer ?? null,
          chargeId: charge.id,
          amountCents: charge.amount_refunded ?? 0,
          currency: (charge.currency ?? BILLING_CURRENCY).toUpperCase(),
          reason: null,
          status: "refunded",
          createdAt: isoFromUnix(charge.created) ?? new Date().toISOString(),
        });
      }
    } else if (event.type === "charge.dispute.created") {
      // A chargeback. Policy: record it AND revoke access immediately — the
      // customer reversed payment, so Pro ends now. The proSource guard inside
      // updateUserEntitlementFromStripe protects license/gift/flow_points users;
      // only a stripe-source entitlement is downgraded. The Dispute object
      // carries the charge id but not the customer, so retrieve the charge to
      // resolve customer → user.
      const dispute = event.data.object as {
        id: string;
        charge?: string | null;
        amount?: number;
        currency?: string;
        reason?: string | null;
        status?: string | null;
        created?: number;
      };
      // Resolve the customer via the charge. We intentionally do NOT swallow a
      // retrieve failure: letting it throw makes the handler 500 so Stripe
      // retries (recordStripeWebhookEvent hasn't run yet) — a transient Stripe
      // blip must not silently skip revoking access. A charge that genuinely has
      // no customer just yields null → record-only, no downgrade.
      let customerId: string | null = null;
      if (typeof dispute.charge === "string") {
        const charge = await stripe.charges.retrieve(dispute.charge);
        customerId = typeof charge.customer === "string" ? charge.customer : null;
      }
      const userId = customerId
        ? await getUserIdByStripeCustomer(tableName, customerId)
        : null;
      await recordBillingEvent(tableName, {
        kind: "dispute",
        eventId: dispute.id,
        userId,
        stripeCustomerId: customerId,
        chargeId: dispute.charge ?? null,
        amountCents: dispute.amount ?? 0,
        currency: (dispute.currency ?? BILLING_CURRENCY).toUpperCase(),
        reason: dispute.reason ?? null,
        status: dispute.status ?? "needs_response",
        createdAt: isoFromUnix(dispute.created) ?? new Date().toISOString(),
      });
      if (userId) {
        await updateUserEntitlementFromStripe(tableName, {
          userId,
          plan: "FREE",
          proStatus: "canceled",
          stripeCustomerId: customerId ?? undefined,
        });
      }
    } else if (event.type === "customer.deleted") {
      // Customer wiped from Stripe. Downgrade the user (subject to the
      // proSource guard inside updateUserEntitlementFromStripe — license
      // users won't be touched).
      const customer = event.data.object as { id: string };
      const userId = await getUserIdByStripeCustomer(tableName, customer.id);
      if (userId) {
        await updateUserEntitlementFromStripe(tableName, {
          userId,
          plan: "FREE",
          proStatus: "canceled",
        });
      }
    } else {
      // Unhandled event type. We still record it as processed below (so Stripe
      // stops retrying an event we will never act on), but log it so a newly
      // relevant event type isn't silently swallowed during future work.
      console.warn(`[stripe-webhook] unhandled event type: ${event.type}`);
    }

    // Only record the event as processed AFTER all side effects succeed.
    // If recordStripeWebhookEvent itself was the only idempotency gate and
    // an update threw, we'd permanently lose the upgrade because retries
    // would short-circuit on "duplicate". By recording last, any failure
    // above causes Stripe to retry the entire handler.
    //
    // Concurrent-delivery race: if Stripe redelivers in parallel, both
    // invocations will pass the hasStripeWebhookEventBeenProcessed check.
    // The PutCommand here uses a ConditionExpression so exactly one wins;
    // the loser sees ConditionalCheckFailed and we treat it as duplicate.
    const recorded = await recordStripeWebhookEvent(tableName, event.id, event.type);
    if (!recorded) {
      return bookOk({ ok: true, duplicate: true });
    }

    return bookOk({ ok: true });
  });
}
