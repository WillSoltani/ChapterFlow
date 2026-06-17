import type Stripe from "stripe";
import { BookApiError } from "./errors";
import {
  getBookStripePriceId,
  getBookStripePriceIdAnnual,
  getBookStripePriceIdAnnualUpfront,
  getBookStripeSecretKey,
  getBookStripeWebhookSecret,
} from "./env";

// Keyed cache: if the secret key changes (e.g. key rotation or dev hot-reload),
// a fresh client is created rather than reusing the stale one.
let cachedClient: { key: string; stripe: Stripe } | null = null;

export async function getStripeClient(): Promise<Stripe> {
  const key = await getBookStripeSecretKey();
  if (!key) {
    throw new BookApiError(
      503,
      "stripe_not_configured",
      "Stripe is not configured on the server."
    );
  }
  if (cachedClient?.key === key) return cachedClient.stripe;
  const stripeMod = await import("stripe");
  // Pin the API version so Stripe payload shapes don't drift unexpectedly
  // when the SDK is upgraded. Bump intentionally and re-test all webhook
  // event handlers when changing this string.
  //
  // Stripe SDK v22 dropped the `Stripe.LatestApiVersion` namespace alias, so
  // the cast is derived from the constructor's own config type instead. This
  // keeps the deliberate (non-"latest") pin compiling without depending on a
  // namespaced type that may move again across SDK majors.
  const stripe = new stripeMod.default(key, {
    apiVersion: "2024-06-20" as NonNullable<
      ConstructorParameters<typeof stripeMod.default>[1]
    >["apiVersion"],
  });
  cachedClient = { key, stripe };
  return stripe;
}

export async function getStripePriceIdOrThrow(): Promise<string> {
  const priceId = await getBookStripePriceId();
  if (!priceId) {
    throw new BookApiError(
      503,
      "stripe_price_not_configured",
      "Stripe price is not configured on the server."
    );
  }
  return priceId;
}

export type BillingInterval = "monthly" | "annual" | "annual_upfront";

export async function getStripePriceIdForInterval(interval: BillingInterval): Promise<string> {
  if (interval === "annual") {
    const id = await getBookStripePriceIdAnnual();
    if (id) return id;
    throw new BookApiError(
      503,
      "stripe_price_not_configured",
      "Annual billing is not configured on the server."
    );
  }
  if (interval === "annual_upfront") {
    const id = await getBookStripePriceIdAnnualUpfront();
    if (id) return id;
    throw new BookApiError(
      503,
      "stripe_price_not_configured",
      "Annual upfront billing is not configured on the server."
    );
  }
  return getStripePriceIdOrThrow();
}

export async function getStripeWebhookSecretOrThrow(): Promise<string> {
  const webhookSecret = await getBookStripeWebhookSecret();
  if (!webhookSecret) {
    throw new BookApiError(
      503,
      "stripe_webhook_not_configured",
      "Stripe webhook secret is not configured on the server."
    );
  }
  return webhookSecret;
}
