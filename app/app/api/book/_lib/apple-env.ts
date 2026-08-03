import { getServerEnv } from "@/app/app/api/_lib/server-env";
import { BookApiError } from "./errors";
import {
  buildAppleIapPolicyFromEnv,
  type ApplePurchasePolicy,
} from "./apple-purchase-policy-core";
import {
  verifyAppleTransactionJws,
} from "./apple-jws-verify-core";
import { verifyAppleTransactionWithTestFlightFallback } from "./apple-testflight-verification-core";

/**
 * Apple App Store / StoreKit configuration.
 *
 * StoreKit uses a distinct `APPLE_IAP_BUNDLE_ID`; `APPLE_BUNDLE_ID` remains the
 * Sign-in-with-Apple OAuth client/Services ID and must not be reused implicitly.
 * `APPLE_ISSUER_ID` is added by the StoreKit IAP work (B3): the App Store
 * Connect API issuer UUID used to sign App Store Server API requests.
 *
 * The in-app-purchase entitlement path (verify + notifications) authenticates
 * StoreKit transaction JWSs and App Store Server Notifications V2 by verifying
 * them through Apple's official verifier (pinned root plus Production OCSP; see
 * apple-jws-verify-core.ts) and then enforcing the deployment-bound policy from
 * {@link getAppleIapConfig}. It does NOT require issuer/key/private-key
 * credentials — those authenticate outbound App Store Server API calls (the
 * revoke flow in B8, and reserved for future transaction/status lookups).
 */

export type AppleIapConfig = ApplePurchasePolicy;

/**
 * Load the exact production StoreKit verification policy. No product, group,
 * or bundle fallback is permitted: an incomplete deployment returns a stable
 * service-unavailable error instead of weakening receipt checks.
 */
export async function getAppleIapConfig(): Promise<AppleIapConfig> {
  const [
    bundleIdRaw,
    appAppleIdRaw,
    productIdsRaw,
    subscriptionGroupRaw,
    deploymentEnvironment,
    testFlightSandboxEnabled,
    testFlightQaUserHashes,
  ] = await Promise.all([
    getServerEnv("APPLE_IAP_BUNDLE_ID"),
    getServerEnv("APPLE_IAP_APP_APPLE_ID"),
    getServerEnv("IOS_STOREKIT_PRODUCT_IDS"),
    getServerEnv("APPLE_IAP_SUBSCRIPTION_GROUP_ID"),
    getServerEnv("CHAPTERFLOW_ENV"),
    getServerEnv("APPLE_IAP_TESTFLIGHT_SANDBOX_ENABLED"),
    getServerEnv("APPLE_IAP_TESTFLIGHT_QA_USER_HASHES"),
  ]);

  const result = buildAppleIapPolicyFromEnv({
    APPLE_IAP_BUNDLE_ID: bundleIdRaw,
    APPLE_IAP_APP_APPLE_ID: appAppleIdRaw,
    APPLE_IAP_SUBSCRIPTION_GROUP_ID: subscriptionGroupRaw,
    IOS_STOREKIT_PRODUCT_IDS: productIdsRaw,
    CHAPTERFLOW_ENV: deploymentEnvironment,
    APPLE_IAP_TESTFLIGHT_SANDBOX_ENABLED: testFlightSandboxEnabled,
    APPLE_IAP_TESTFLIGHT_QA_USER_HASHES: testFlightQaUserHashes,
  });
  if (!result.valid) {
    throw new BookApiError(
      503,
      "apple_iap_configuration_unavailable",
      "App Store purchase verification is temporarily unavailable.",
      { issues: result.issues },
    );
  }

  return result.policy;
}

/**
 * Select the official verifier environment for an authenticated direct claim.
 * Sandbox fallback occurs only after Apple's Production verifier authenticates
 * the JWS and reports INVALID_ENVIRONMENT; signature/profile/OCSP failures are
 * never retried through a weaker lane.
 */
export async function verifyAppleTransactionJwsForUser(
  jws: string,
  policy: AppleIapConfig,
  authenticatedUserId: string,
): Promise<Record<string, unknown>> {
  return verifyAppleTransactionWithTestFlightFallback({
    jws,
    policy,
    authenticatedUserId,
    verify: verifyAppleTransactionJws,
  });
}

/**
 * The App Store Connect API issuer id (a UUID). Reserved for signing outbound
 * App Store Server API requests; optional here because local JWS verification
 * needs only deployment identity + Apple's pinned root.
 */
export async function getAppleIssuerId(): Promise<string | undefined> {
  return getServerEnv("APPLE_ISSUER_ID");
}
