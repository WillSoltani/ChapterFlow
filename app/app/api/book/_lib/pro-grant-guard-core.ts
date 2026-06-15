// Pure SPECIFICATION of the "may this gift / pro-pass overwrite the existing
// entitlement?" guard.
//
// IMPORTANT: the ENFORCEMENT is the atomic DynamoDB ConditionExpression in
// app/app/api/book/me/gifts/[code]/claim/route.ts and in flow-points-repo.ts
// (redeemFlowPointsReward). This function is NOT on that write path — it is the
// tested, human-readable spec the ConditionExpression implements. Keep the two
// in sync; the unit test documents the intended truth table.
export interface ExistingGrant {
  plan?: string | null; // "PRO" / "FREE" / absent
  proSource?: string | null; // "stripe" | "admin" | "license" | "gift_code" | "flow_points" | null | absent
  licenseExpiresAt?: string | null; // ISO-8601, or null/absent
  currentPeriodEnd?: string | null; // ISO-8601, or null/absent
}

export function grantUpgradeApplies(
  existing: ExistingGrant,
  candidateExpiryIso: string
): boolean {
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
