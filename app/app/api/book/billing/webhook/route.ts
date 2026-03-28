import "server-only";
import { withBookApiErrors, bookOk } from "@/app/app/api/book/_lib/http";
import { getBookTableName, getBookAnalyticsTableName } from "@/app/app/api/book/_lib/env";
import {
  getUserIdByStripeCustomer,
  mapStripeCustomerToUser,
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
import { FLOW_POINTS_AMOUNTS } from "@/app/book/_lib/flow-points-economy";

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

async function maybeAwardReferralProConversion(params: {
  tableName: string;
  analyticsTable: string | null;
  userId: string;
}) {
  const claim = await getUserReferralClaim(params.tableName, params.userId);
  if (!claim || claim.proRewardedAt) return;

  const award = await awardFlowPoints(params.tableName, {
    userId: claim.inviterUserId,
    amount: FLOW_POINTS_AMOUNTS.referralProInviter,
    sourceType: "referral_pro_inviter",
    sourceId: claim.claimId,
    metadata: {
      inviteCode: claim.inviteCode,
      referredUserId: params.userId,
    },
  });

  if (!award.awarded) return;

  await markReferralProRewarded(
    params.tableName,
    claim,
    FLOW_POINTS_AMOUNTS.referralProInviter
  ).catch(() => false);

  if (!params.analyticsTable) return;
  await Promise.allSettled([
    analyticsTrackFlowPointsTransaction(params.analyticsTable, {
      userId: claim.inviterUserId,
      deltaPoints: FLOW_POINTS_AMOUNTS.referralProInviter,
      direction: "earn",
      sourceType: "referral_pro_inviter",
      sourceId: claim.claimId,
      metadata: {
        inviteCode: claim.inviteCode,
        referredUserId: params.userId,
      },
    }),
    analyticsTrackReferral(params.analyticsTable, {
      userId: claim.inviterUserId,
      eventType: "referral_pro_rewarded",
      inviteCode: claim.inviteCode,
      referredUserId: params.userId,
      pointsAwarded: FLOW_POINTS_AMOUNTS.referralProInviter,
    }),
  ]);
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

    const [firstProcess, analyticsTable] = await Promise.all([
      recordStripeWebhookEvent(tableName, event.id, event.type),
      getBookAnalyticsTableName(),
    ]);
    if (!firstProcess) {
      return bookOk({ ok: true, duplicate: true });
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as { customer: string | null; subscription?: string | null; metadata?: { userId?: string } };
      const customerId = session.customer;
      const userId = await resolveUserIdForEvent(
        tableName,
        customerId,
        session.metadata?.userId
      );
      if (userId && customerId) {
        await mapStripeCustomerToUser(tableName, customerId, userId);
        await updateUserEntitlementFromStripe(tableName, {
          userId,
          plan: "PRO",
          proStatus: "active",
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
    } else if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const subscription = event.data.object as {
        customer: string;
        id: string;
        status: string;
        current_period_end?: number;
        metadata?: { userId?: string };
      };
      const userId = await resolveUserIdForEvent(
        tableName,
        subscription.customer,
        subscription.metadata?.userId
      );
      if (userId) {
        const mapped = mapSubscriptionStatus(subscription.status);
        await mapStripeCustomerToUser(tableName, subscription.customer, userId);
        await updateUserEntitlementFromStripe(tableName, {
          userId,
          plan: mapped.plan,
          proStatus: mapped.proStatus,
          stripeCustomerId: subscription.customer,
          stripeSubscriptionId: subscription.id,
          currentPeriodEnd: isoFromUnix(subscription.current_period_end),
        });
        if (analyticsTable) {
          analyticsTrackSubscription(analyticsTable, {
            userId,
            plan: mapped.plan,
            proStatus: mapped.proStatus,
            proSource: "stripe",
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
      };
      if (invoice.customer) {
        const userId = await getUserIdByStripeCustomer(tableName, invoice.customer);
        if (userId) {
          await updateUserEntitlementFromStripe(tableName, {
            userId,
            plan: "PRO",
            proStatus: "past_due",
            stripeCustomerId: invoice.customer,
            stripeSubscriptionId: invoice.subscription ?? undefined,
          });
          if (analyticsTable) {
            analyticsTrackSubscription(analyticsTable, {
              userId,
              plan: "PRO",
              proStatus: "past_due",
              stripeCustomerId: invoice.customer,
              stripeSubscriptionId: invoice.subscription ?? undefined,
            }).catch(() => {});
          }
        }
      }
    } else if (event.type === "invoice.paid") {
      const invoice = event.data.object as {
        customer: string | null;
        subscription?: string | null;
      };
      if (invoice.customer) {
        const userId = await getUserIdByStripeCustomer(tableName, invoice.customer);
        if (userId) {
          await updateUserEntitlementFromStripe(tableName, {
            userId,
            plan: "PRO",
            proStatus: "active",
            stripeCustomerId: invoice.customer,
            stripeSubscriptionId: invoice.subscription ?? undefined,
          });
        if (analyticsTable) {
          analyticsTrackSubscription(analyticsTable, {
            userId,
            plan: "PRO",
            proStatus: "active",
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
    }
    }

    return bookOk({ ok: true });
  });
}
