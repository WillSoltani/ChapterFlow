export type StoredProSource =
  | "stripe"
  | "apple"
  | "license"
  | "flow_points"
  | "gift_code"
  | "admin"
  | undefined;

function parsedDateMs(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Compute the effective read-time expiry for time-bounded Pro sources. Apple is
 * deliberately fail-closed: every accepted subscription transaction writes a
 * currentPeriodEnd, so a missing/malformed value cannot grant Pro forever if a
 * terminal notification is delayed or lost. An active billing grace event
 * first advances currentPeriodEnd to Apple's signed grace expiry.
 */
export function isStoredProGrantExpired(input: {
  storedPlan: "FREE" | "PRO";
  proSource: StoredProSource;
  licenseExpiresAt?: string | undefined;
  currentPeriodEnd?: string | undefined;
  nowMs: number;
}): boolean {
  if (input.storedPlan !== "PRO") return false;
  if (input.proSource === "license") {
    const expiry = parsedDateMs(input.licenseExpiresAt);
    return expiry !== null && expiry <= input.nowMs;
  }
  if (
    input.proSource === "flow_points" ||
    input.proSource === "gift_code"
  ) {
    const expiry = parsedDateMs(input.currentPeriodEnd);
    return expiry !== null && expiry <= input.nowMs;
  }
  if (input.proSource === "apple") {
    const expiry = parsedDateMs(input.currentPeriodEnd);
    return expiry === null || expiry <= input.nowMs;
  }
  return false;
}
