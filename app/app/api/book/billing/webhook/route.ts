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
import { analyticsTrackSubscription } from "@/app/app/api/book/_lib/analytics-repo";
import {
  getStripeClient,
  getStripeWebhookSecretOrThrow,
} from "@/app/app/api/book/_lib/stripe-service";
import { BookApiError } from "@/app/app/api/book/_lib/errors";
import { mapSubscriptionStatus } from "@/app/app/api/book/_lib/subscription-status";
import { buildRefundRecords, type RefundCharge } from "@/app/app/api/book/_lib/refund-events";
import { extractBillingDetails } from "@/app/app/api/book/_lib/billing-details";
import { BILLING_CURRENCY } from "@/lib/pricing";
import { putOpsMetric } from "@/app/app/api/book/_lib/cloudwatch-metrics";
import { sendTrialEndingEmail } from "@/app/app/api/book/_lib/trial-ending-email";

export const runtime = "nodejs";

function isoFromUnix(value: number | null | undefined): string | undefined {
  if (!value || !Number.isFinite(value)) return undefined;
  return new Date(value * 1000).toISOString();
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

// §6.1 amended — The referral_pro_inviter 600 IP payout has been REMOVED
// entirely (uncapped per-occurrence faucet, sender-benefit framing). Referral
// rewards are now milestone-gated via escalation tiers (§6.3, P3), so the
// webhook no longer fires any referral payout on Pro conversion.

export async function POST(req: Request) {
  // skipOriginCheck (#6): Stripe's server-to-server webhook carries no browser
  // Origin/Sec-Fetch headers, so the same-origin CSRF guard would otherwise
  // strict-reject it (no Origin on an unsafe method). Authenticity here is
  // enforced by the Stripe signature verification below, not by origin.
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

    // Wrap all post-verification processing so any failure (which makes Stripe
    // retry the delivery) is surfaced as a custom CloudWatch metric the frontend
    // stack alarms on. Signature/format failures above are client errors, not
    // processing failures, so they're deliberately outside this block.
    try {
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
      }
    } else if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object as {
        customer: string | null;
        subscription?: string | null;
        // last_finalization_error only carries invoice-FINALIZATION failures, a
        // rare category. The real card-decline reason (card_declined,
        // insufficient_funds, expired_card) lives on the associated
        // PaymentIntent's last_payment_error.code, resolved below.
        last_finalization_error?: { code?: string; message?: string };
        payment_intent?: string | { id?: string; last_payment_error?: { code?: string } } | null;
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
        // Resolve the decline reason from the PaymentIntent's last_payment_error
        // so admin dunning can distinguish a declined card from insufficient
        // funds. Best-effort: a retrieve failure must NOT block the past_due
        // entitlement write (mirrors invoice.paid's charge retrieve above).
        let declineCode: string | undefined;
        try {
          const pi = invoice.payment_intent;
          if (pi && typeof pi === "object" && pi.last_payment_error?.code) {
            // Already expanded on the event payload.
            declineCode = pi.last_payment_error.code;
          } else {
            const piId = typeof pi === "string" ? pi : pi?.id;
            if (piId) {
              const paymentIntent = await stripe.paymentIntents.retrieve(piId);
              declineCode = paymentIntent.last_payment_error?.code;
            }
          }
        } catch {
          declineCode = undefined;
        }
        await updateUserEntitlementFromStripe(tableName, {
          userId,
          plan: "PRO",
          proStatus: "past_due",
          proSource: "stripe",
          stripeCustomerId: invoice.customer,
          stripeSubscriptionId: invoice.subscription ?? undefined,
          failedPaymentLastReason:
            declineCode ?? invoice.last_finalization_error?.code ?? "payment_failed",
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
        charge?: string | null;
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
        // Capture card brand/country + billing country for the admin billing
        // panels. Best-effort: a retrieve failure must NOT fail an already-
        // succeeded payment (the entitlement update below is the critical part).
        let billingDetails = {} as ReturnType<typeof extractBillingDetails>;
        if (invoice.charge) {
          try {
            const charge = await stripe.charges.retrieve(invoice.charge);
            billingDetails = extractBillingDetails(charge);
          } catch {
            billingDetails = {};
          }
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
          billingCountry: billingDetails.billingCountry,
          cardBrand: billingDetails.cardBrand,
          cardCountry: billingDetails.cardCountry,
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
      // Trial ending in ~3 days. Send the transactional pre-charge reminder
      // (card-network requirement for free-trial → paid), and record analytics.
      const subscription = event.data.object as {
        customer: string;
        trial_end?: number | null;
        items?: {
          data?: Array<{
            price?: {
              unit_amount?: number | null;
              currency?: string | null;
              recurring?: { interval?: string | null } | null;
            } | null;
          }>;
        };
      };
      if (subscription.customer) {
        if (analyticsTable) {
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
        await sendTrialEndingEmail(stripe, tableName, subscription).catch((e) => {
          console.error("[webhook] trial-ending email failed:", e);
        });
      }
    } else if (event.type === "charge.refunded") {
      // Persist a durable refund record for the admin finance report. We do NOT
      // downgrade here: refunds may be partial, and a refund that cancels the
      // subscription fires a separate customer.subscription.deleted that handles
      // the entitlement. (Previously this wrongly stamped the analytics snapshot
      // "canceled", corrupting analytics for partial refunds.)
      const charge = event.data.object as RefundCharge;
      const userId = charge.customer
        ? await getUserIdByStripeCustomer(tableName, charge.customer)
        : null;
      // buildRefundRecords (pure, unit-tested) handles the per-refund vs
      // cumulative-fallback and idempotency-key logic; we add userId + ISO here.
      for (const rec of buildRefundRecords(charge, event.id, BILLING_CURRENCY)) {
        await recordBillingEvent(tableName, {
          kind: "refund",
          eventId: rec.eventId,
          userId,
          stripeCustomerId: rec.stripeCustomerId,
          chargeId: rec.chargeId,
          amountCents: rec.amountCents,
          currency: rec.currency,
          reason: rec.reason,
          status: rec.status,
          createdAt: isoFromUnix(rec.createdUnix) ?? new Date().toISOString(),
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
      let chargeCreatedUnix: number | undefined;
      if (typeof dispute.charge === "string") {
        const charge = await stripe.charges.retrieve(dispute.charge);
        customerId = typeof charge.customer === "string" ? charge.customer : null;
        chargeCreatedUnix = charge.created;
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
        // Deterministic timestamp so a redelivery yields the same SK and cannot
        // create a duplicate finance row (L14). dispute.created is normally
        // present; fall back to the disputed charge's created (stable across
        // retries) before resorting to wall-clock now.
        createdAt:
          isoFromUnix(dispute.created) ??
          isoFromUnix(chargeCreatedUnix) ??
          new Date().toISOString(),
      });
      if (userId) {
        await updateUserEntitlementFromStripe(tableName, {
          userId,
          plan: "FREE",
          proStatus: "canceled",
          stripeCustomerId: customerId ?? undefined,
          // Sticky chargeback marker — refuses any later PRO re-activation
          // (stale invoice.paid / subscription.* reordered after the dispute)
          // until the dispute is won (L13).
          setDisputeOpen: true,
        });
      }
    } else if (event.type === "charge.dispute.closed") {
      // A dispute resolved. If we WON, the chargeback was reversed in our favor,
      // so lift the sticky marker that blocks PRO re-activation (L13). A LOST
      // dispute leaves the marker in place — access stays revoked. We do not
      // auto-restore Pro here; the user must re-subscribe (a fresh invoice.paid
      // /customer.subscription.* will then be allowed through the cleared guard).
      const dispute = event.data.object as {
        charge?: string | null;
        status?: string | null;
      };
      if (dispute.status === "won" && typeof dispute.charge === "string") {
        const charge = await stripe.charges.retrieve(dispute.charge);
        const customerId =
          typeof charge.customer === "string" ? charge.customer : null;
        const userId = customerId
          ? await getUserIdByStripeCustomer(tableName, customerId)
          : null;
        if (userId) {
          await updateUserEntitlementFromStripe(tableName, {
            userId,
            // Leave the plan as-is (FREE/canceled from the downgrade); only
            // clear the marker so a future legitimate re-subscribe can activate.
            plan: "FREE",
            proStatus: "canceled",
            stripeCustomerId: customerId ?? undefined,
            clearDisputeOpen: true,
          });
        }
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
    } catch (err) {
      // Fire-and-forget so a metrics outage never masks the underlying error.
      await putOpsMetric("StripeWebhookFailure", 1, {
        type: event.type ?? "unknown",
      }).catch(() => {});
      throw err;
    }
  }, { skipOriginCheck: true });
}
