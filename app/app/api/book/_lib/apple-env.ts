import { getServerEnv, mustServerEnv } from "@/app/app/api/_lib/server-env";

/**
 * Apple App Store / StoreKit configuration.
 *
 * `APPLE_BUNDLE_ID` and `APPLE_KEY_ID` / `APPLE_PRIVATE_KEY` are shared with the
 * Sign-in-with-Apple (B8) integration and are documented alongside it in
 * docs/ENVIRONMENT.md — this module only READS them, it does not redefine them.
 * `APPLE_ISSUER_ID` is added by the StoreKit IAP work (B3): the App Store
 * Connect API issuer UUID used to sign App Store Server API requests.
 *
 * The in-app-purchase entitlement path (verify + notifications) authenticates
 * StoreKit transaction JWSs and App Store Server Notifications V2 by verifying
 * their certificate chain against Apple's pinned root CA (see
 * apple-jws-verify-core.ts) and matching the decoded `bundleId` against
 * {@link getAppleBundleId}. It does NOT require the issuer/key/private-key
 * credentials — those authenticate outbound App Store Server API calls (the
 * revoke flow in B8, and reserved for future transaction/status lookups).
 */

/**
 * The app's bundle identifier (e.g. `com.chapterflow.app`). REQUIRED for the
 * StoreKit path: every verified transaction / notification payload must carry a
 * matching `bundleId`, or it is rejected as not-for-this-app. Fail-closed
 * (`mustServerEnv`) so a missing config can never silently accept a foreign
 * receipt.
 */
export async function getAppleBundleId(): Promise<string> {
  return mustServerEnv("APPLE_BUNDLE_ID");
}

/**
 * The App Store Connect API issuer id (a UUID). Reserved for signing outbound
 * App Store Server API requests; optional here because local JWS verification
 * needs only the bundle id + Apple's pinned root.
 */
export async function getAppleIssuerId(): Promise<string | undefined> {
  return getServerEnv("APPLE_ISSUER_ID");
}
