/**
 * Pure decision for how the `charge.dispute.created` webhook branch must treat a
 * chargeback once it has tried to resolve the disputing user.
 *
 * ## Why this module exists (the bug it fixes)
 *
 * The dispute branch records a durable finance row, then revokes access + plants
 * the sticky `disputeOpen` marker — but only when it can resolve a `userId`. The
 * user is resolved from the charge's customer via the customer→user map
 * (`getUserIdByStripeCustomer`, a plain Get on `BOOK_STRIPE_CUSTOMER_MAP`).
 *
 * That map is written by the SAME webhook surface on the FIRST PRO event
 * (`checkout.session.completed` / `customer.subscription.*` →
 * `mapStripeCustomerToUser`). Stripe does NOT guarantee delivery order and
 * retries can reorder, so a `charge.dispute.created` can land BEFORE the mapping
 * row has been written/propagated. When that happens `getUserIdByStripeCustomer`
 * returns null, the revocation is silently skipped — and the OLD code then
 * unconditionally completed the webhook event (status=DONE, TTL removed,
 * permanent). On every later redelivery the claim-lease short-circuits at "done",
 * so the chargeback NEVER revokes access. A user who reversed payment keeps Pro
 * forever.
 *
 * Every other handler that resolves a user from a present customer already throws
 * `user_resolution_failed` (HTTP 500) on a null user so Stripe retries until the
 * map propagates. The dispute branch was the lone exception. This function makes
 * the same distinction, explicitly:
 *
 *  - `record_only`   — the charge genuinely carries NO customer, so no user can
 *                      EVER be resolved. Record the finance row, do not downgrade,
 *                      and complete the event (retrying is futile).
 *  - `retry`         — the charge HAS a customer but the customer→user map has not
 *                      yet propagated (userId is null). Record the (idempotent)
 *                      finance row, then surface a retryable failure so the event
 *                      is NOT completed and a Stripe redelivery reprocesses it once
 *                      the mapping lands. THIS is the leak that was being dropped.
 *  - `revoke`        — user resolved. Record, downgrade to FREE/canceled, and set
 *                      the sticky `disputeOpen` marker.
 *
 * Pure and dependency-free so it is unit-testable without the AWS SDK (the route
 * is `server-only` and cannot be imported by the node:test runner — the repo's
 * documented `*-core` seam pattern).
 */
export type DisputeResolution = "record_only" | "retry" | "revoke";

/**
 * Classify the dispute outcome from the resolved customer + user.
 *
 * @param customerId the customer id resolved from the disputed charge, or null
 *                   when the charge has no customer (or no charge id at all).
 * @param userId     the user id resolved from the customer→user map, or null when
 *                   there is no customer or the mapping has not propagated yet.
 */
export function classifyDisputeResolution(
  customerId: string | null,
  userId: string | null,
): DisputeResolution {
  if (userId) return "revoke";
  // No user resolved. Distinguish "no customer to resolve from" (terminal) from
  // "customer present but mapping not yet propagated" (transient, must retry).
  if (customerId) return "retry";
  return "record_only";
}
