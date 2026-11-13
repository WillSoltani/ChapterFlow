/**
 * Which Stripe subscriptions an account deletion cancels (pure, unit-tested).
 *
 * The local entitlement mirror is not enough: it stores `past_due` separately
 * but folds `unpaid`, `paused` and `incomplete` into "canceled", and all of those
 * are still live at Stripe and can bill again. So the delete route reads the
 * subscription's real status from Stripe and cancels anything that is not
 * already finished.
 */

/** Stripe statuses after which a subscription can never bill again. */
const FINISHED_STRIPE_STATUSES = new Set(["canceled", "incomplete_expired"]);

export function isCancellableStripeStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  return !FINISHED_STRIPE_STATUSES.has(status);
}

export type StripeCancelOnDeleteOutcome =
  | { kind: "cancelled"; previousStatus: string }
  | { kind: "already_finished"; status: string };

/** Minimal slice of the Stripe client the delete route needs (fakeable in tests). */
export type StripeSubscriptionsPort = {
  retrieve: (subscriptionId: string) => Promise<{ status: string }>;
  cancel: (subscriptionId: string) => Promise<unknown>;
};

export async function cancelStripeSubscriptionOnDelete(
  subscriptions: StripeSubscriptionsPort,
  subscriptionId: string
): Promise<StripeCancelOnDeleteOutcome> {
  const subscription = await subscriptions.retrieve(subscriptionId);
  if (!isCancellableStripeStatus(subscription.status)) {
    return { kind: "already_finished", status: subscription.status };
  }
  await subscriptions.cancel(subscriptionId);
  return { kind: "cancelled", previousStatus: subscription.status };
}
