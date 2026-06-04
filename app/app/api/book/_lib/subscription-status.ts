/**
 * Map a Stripe subscription status to our entitlement plan + proStatus. Pure and
 * dependency-free so it is unit-testable; the webhook imports it. Keep the set
 * of PRO-granting statuses here in sync with reconciliation-core's
 * PRO_WORTHY_STATUSES.
 */
export function mapSubscriptionStatus(status: string): {
  plan: "FREE" | "PRO";
  proStatus: "inactive" | "active" | "past_due" | "canceled";
} {
  if (status === "active" || status === "trialing") {
    return { plan: "PRO", proStatus: "active" };
  }
  if (status === "past_due") {
    return { plan: "PRO", proStatus: "past_due" };
  }
  // "paused" — Stripe collection paused (e.g. via the portal). Treat as canceled
  // for entitlement purposes; if it resumes, the next event flips it back.
  // "canceled" / "incomplete" / "incomplete_expired" / "unpaid" → no Pro.
  return { plan: "FREE", proStatus: "canceled" };
}
