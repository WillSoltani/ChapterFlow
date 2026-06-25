// Pure builder for the entitlement-upgrade write performed when a license key is
// redeemed (redeemLicenseKey in repo.ts). Extracted so the guard wiring is unit
// testable — repo.ts pulls in `server-only` (via aws.ts) and cannot be imported by
// `tsx --test`, whereas this module is pure (only depends on pro-grant-guard-core).
//
// Like the gift-claim route and redeemFlowPointsReward, the license redemption now
// builds its ConditionExpression from the SHARED grantUpgradeConditionExpression so
// the guard cannot drift between the three non-Stripe grant sites: a redemption is
// applied only when it does not shorten or destroy a longer-lived / open-ended grant
// (stripe sub, admin comp, or a license / flow_points / gift window that outlasts the
// new license). On refusal the surrounding TransactWrite rolls back, so the key is
// NOT consumed and stays available. Expiry lives in licenseExpiresAt for a license
// grant, so we also clear the orthogonal currentPeriodEnd (to a DynamoDB NULL) —
// symmetric with how redeemFlowPointsReward clears licenseExpiresAt — so a stale
// flow_points/gift period can never resurrect or shorten the granted window.
import {
  grantUpgradeConditionExpression,
  GRANT_UPGRADE_CONDITION_NAMES,
  GRANT_UPGRADE_CONDITION_VALUES,
} from "./pro-grant-guard-core";

export interface LicenseEntitlementGrantParams {
  /** Normalized (uppercased/trimmed) license code stored on the entitlement. */
  code: string;
  /** ISO-8601 expiry the license grants (now + validMonths). */
  expiresAt: string;
  /** ISO-8601 write timestamp. */
  now: string;
  /** Default free book slots used by if_not_exists. */
  defaultSlots: number;
}

export interface DynamoUpdateParts {
  UpdateExpression: string;
  ConditionExpression: string;
  ExpressionAttributeNames: Record<string, string>;
  ExpressionAttributeValues: Record<string, unknown>;
}

/**
 * Builds the DynamoDB Update (expression + condition + names + values) that upgrades
 * a user's entitlement to license-backed PRO. The caller supplies the `Key`.
 */
export function buildLicenseEntitlementGrant(
  params: LicenseEntitlementGrantParams
): DynamoUpdateParts {
  return {
    UpdateExpression: [
      "SET #plan = :pro,",
      "proStatus = :active,",
      "proSource = :licenseSource,",
      "licenseKey = :code,",
      "licenseExpiresAt = :expiresAt,",
      // Clear any stale flow_points/gift period so it can't shorten or resurrect
      // the window (license expiry is keyed off licenseExpiresAt). NULL, not a
      // removed attribute, mirroring redeemFlowPointsReward's licenseExpiresAt.
      "currentPeriodEnd = :nullValue,",
      "updatedAt = :now,",
      // unlockedBookIds is created lazily by reserveBookEntitlement's ADD; do not
      // initialize it here (an empty Set can no longer be marshalled). This clause
      // must stay last so the preceding element carries no trailing comma after join.
      "freeBookSlots = if_not_exists(freeBookSlots, :defaultSlots)",
    ].join(" "),
    // Shared guard: apply only when the license does not clobber/shorten a longer
    // or open-ended grant. Spec + truth-table: _lib/pro-grant-guard-core.ts.
    ConditionExpression: grantUpgradeConditionExpression(":expiresAt"),
    ExpressionAttributeNames: { ...GRANT_UPGRADE_CONDITION_NAMES },
    ExpressionAttributeValues: {
      ...GRANT_UPGRADE_CONDITION_VALUES,
      ":pro": "PRO",
      ":active": "active",
      ":licenseSource": "license",
      ":code": params.code,
      ":expiresAt": params.expiresAt,
      ":nullValue": null,
      ":now": params.now,
      ":defaultSlots": params.defaultSlots,
    },
  };
}
