import type Stripe from "stripe";
import { BookApiError } from "./errors";
import {
  getBookStripePriceId,
  getBookStripeSecretKey,
  getBookStripeWebhookSecret,
} from "./env";

let stripeClientPromise: Promise<Stripe> | null = null;

export async function getStripeClient(): Promise<Stripe> {
  if (stripeClientPromise) return stripeClientPromise;
  stripeClientPromise = (async () => {
    const key = await getBookStripeSecretKey();
    if (!key) {
      throw new BookApiError(
        503,
        "stripe_not_configured",
        "Stripe is not configured on the server."
      );
    }
    const stripeMod = await import("stripe");
    return new stripeMod.default(key);
  })();
  return stripeClientPromise;
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
