// Pure SPECIFICATION of the "may this gift / pro-pass overwrite the existing
// entitlement?" guard.
//
// IMPORTANT: the ENFORCEMENT is the atomic DynamoDB ConditionExpression built by
// grantUpgradeConditionExpression() below and used by BOTH write sites
// (app/app/api/book/me/gifts/[code]/claim/route.ts and flow-points-repo.ts's
// redeemFlowPointsReward) — one definition so the guard cannot drift between them.
// grantUpgradeApplies() is NOT on the write path: it is the tested, human-readable
// spec the ConditionExpression implements. The condition is proven to match this
// spec across a full truth table in pro-grant-guard-condition.test.ts (the
// executable enforcement coverage).
export interface ExistingGrant {
  plan?: string | null; // "PRO" / "FREE" / absent
  proSource?: string | null; // "stripe" | "admin" | "license" | "gift_code" | "flow_points" | null | absent
  licenseExpiresAt?: string | null; // ISO-8601, or null/absent
  currentPeriodEnd?: string | null; // ISO-8601, or null/absent
  // Sticky chargeback marker (L13/C3). Set true by the charge.dispute.created
  // downgrade (stripe-entitlement-write-core), cleared (REMOVEd) only by a
  // dispute.closed(won). While present, NO PRO grant may be (re)applied — not via
  // Stripe and not via license / gift / flow_points — so a charged-back user can't
  // immediately restore PRO through a non-Stripe path.
  disputeOpen?: boolean | null; // true while a chargeback is unresolved, else absent
}

export function grantUpgradeApplies(
  existing: ExistingGrant,
  candidateExpiryIso: string
): boolean {
  // Sticky chargeback hold (C3): an unresolved dispute blocks EVERY PRO (re)grant,
  // regardless of plan/source/expiry. Mirrors the Stripe path's
  // `attribute_not_exists(disputeOpen)` guard so the three non-Stripe grant sites
  // can't readmit a charged-back user. The marker is removed (not set false) when a
  // dispute is won, so "present at all" is the hold.
  if (existing.disputeOpen) return false;
  // No active PRO grant → always apply (the gift/pass starts or refreshes access).
  if (existing.plan !== "PRO") return true;
  // Never overwrite a stripe-billed sub (would orphan billing) or an open-ended
  // admin grant (a fixed-length pass always shortens it).
  if (existing.proSource === "stripe" || existing.proSource === "admin") return false;
  // Otherwise apply only when the candidate strictly outlasts EVERY existing
  // expiry. A null/absent expiry carries no constraint (NULL-aware, since the
  // flow_points write stores licenseExpiresAt as a DynamoDB NULL). ISO-8601 is
  // lexicographically ordered, matching the DynamoDB string comparison.
  const outlasts = (stored?: string | null) =>
    stored === null || stored === undefined || stored < candidateExpiryIso;
  return outlasts(existing.licenseExpiresAt) && outlasts(existing.currentPeriodEnd);
}

// ── ENFORCEMENT: the DynamoDB ConditionExpression implementing grantUpgradeApplies ──
// All three non-Stripe grant sites build the condition from this single function so
// the long expression cannot drift between them (the prior bug: the gift route was
// fixed while the flow_points sibling kept the old stripe-only guard). `expiryRef` is
// the ExpressionAttributeValues key holding the candidate-expiry ISO string — the same
// key the caller's SET clause assigns to currentPeriodEnd (":expires" / ":periodEnd").
//
// The outer `AND attribute_not_exists(disputeOpen)` is the sticky-chargeback hold
// (C3): an unresolved dispute blocks EVERY (re)grant, mirroring the Stripe path's
// guard (stripe-entitlement-write-core: `attribute_not_exists(disputeOpen)`). It is a
// top-level AND so it overrides the "no PRO grant → always apply" branch — otherwise a
// charged-back user (downgraded to FREE, disputeOpen=true) could restore PRO via
// license / gift / flow_points. On the conditional failure each caller re-reads the
// entitlement and returns an "account on hold pending dispute" error.
export function grantUpgradeConditionExpression(expiryRef: string): string {
  return (
    `((attribute_not_exists(#plan) OR #plan <> :proPlan) OR ` +
    `((attribute_not_exists(proSource) OR proSource <> :stripeSource) AND ` +
    `(attribute_not_exists(proSource) OR proSource <> :adminSource) AND ` +
    `(attribute_not_exists(licenseExpiresAt) OR attribute_type(licenseExpiresAt, :nullType) OR licenseExpiresAt < ${expiryRef}) AND ` +
    `(attribute_not_exists(currentPeriodEnd) OR attribute_type(currentPeriodEnd, :nullType) OR currentPeriodEnd < ${expiryRef}))) ` +
    `AND attribute_not_exists(disputeOpen)`
  );
}

// ExpressionAttributeNames the condition references.
export const GRANT_UPGRADE_CONDITION_NAMES = { "#plan": "plan" } as const;

// Fixed ExpressionAttributeValues the condition references. The caller supplies the
// candidate-expiry value separately (under `expiryRef`) since its SET clause already
// sets it; spreading this guarantees every guard placeholder stays covered.
export const GRANT_UPGRADE_CONDITION_VALUES = {
  ":proPlan": "PRO",
  ":stripeSource": "stripe",
  ":adminSource": "admin",
  ":nullType": "NULL",
} as const;
