import type Stripe from "stripe";
import { BookApiError } from "./errors";
import {
  getBookStripePriceId,
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
  const stripe = new stripeMod.default(key);
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
