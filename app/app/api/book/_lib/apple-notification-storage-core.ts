import type { AppleStorageLane } from "./keys";
import type { AppleStoreEnvironment } from "./apple-purchase-policy-core";

/**
 * Notifications are deployment-authoritative only. Production accepts signed
 * Production notifications; dev/staging accept signed Sandbox notifications.
 * Neither path is the opt-in Production TestFlight direct-verification lane,
 * so both use the byte-compatible Primary storage namespace.
 */
export function appleNotificationStorageLane(
  deploymentEnvironment: AppleStoreEnvironment,
): AppleStorageLane {
  const lanes: Record<AppleStoreEnvironment, AppleStorageLane> = {
    Production: "Primary",
    Sandbox: "Primary",
  };
  return lanes[deploymentEnvironment];
}
