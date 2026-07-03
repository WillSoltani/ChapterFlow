/**
 * Apple App Store subscription-management link, shared by the web billing
 * surfaces. Opening this on an iPhone/iPad deep-links into Settings →
 * Subscriptions (or the App Store account subscriptions sheet); on the web it
 * opens the Apple ID account subscriptions page. Apple does not expose a
 * server-managed billing portal like Stripe, so a StoreKit ("apple") subscriber
 * manages, upgrades, or cancels their plan here rather than via our backend.
 */
export const APPLE_MANAGE_SUBSCRIPTIONS_URL =
  "https://apps.apple.com/account/subscriptions";

/** User-facing copy explaining that Pro is billed through the App Store. */
export const APPLE_MANAGED_SUBSCRIPTION_LABEL =
  "Managed via the App Store on your iPhone";
