import { mustServerEnv, getServerEnv } from "@/app/app/api/_lib/server-env";
import { MONTHLY_PRICE_PER_MONTH } from "@/lib/pricing";
import { resolveAppBaseUrl } from "./app-base-url-core";

const DEFAULT_ADMIN_GROUP = "admin";

export async function getBookTableName(): Promise<string> {
  return mustServerEnv("BOOK_TABLE_NAME");
}

export async function getBookIngestBucket(): Promise<string> {
  return mustServerEnv("BOOK_INGEST_BUCKET");
}

export async function getBookContentBucket(): Promise<string> {
  return mustServerEnv("BOOK_CONTENT_BUCKET");
}

export async function getBookAdminGroupName(): Promise<string> {
  return (await getServerEnv("BOOK_ADMIN_GROUP")) || DEFAULT_ADMIN_GROUP;
}

export async function getBookFreeSlotsDefault(): Promise<number> {
  const raw = await getServerEnv("BOOK_FREE_SLOTS_DEFAULT");
  const parsed = raw ? Number(raw) : NaN;
  if (!Number.isFinite(parsed) || parsed < 0) return 2;
  return Math.floor(parsed);
}

export async function getBookStripePriceId(): Promise<string | undefined> {
  return getServerEnv("BOOK_STRIPE_PRICE_ID");
}

export async function getBookStripePriceIdAnnual(): Promise<string | undefined> {
  return getServerEnv("BOOK_STRIPE_PRICE_ID_ANNUAL");
}

export async function getBookStripePriceIdAnnualUpfront(): Promise<string | undefined> {
  return getServerEnv("BOOK_STRIPE_PRICE_ID_ANNUAL_UPFRONT");
}

export async function getBookStripeSecretKey(): Promise<string | undefined> {
  return getServerEnv("BOOK_STRIPE_SECRET_KEY");
}

export async function getBookStripeWebhookSecret(): Promise<string | undefined> {
  return getServerEnv("BOOK_STRIPE_WEBHOOK_SECRET");
}

export async function getBookPaywallPriceDisplay(): Promise<string> {
  return (await getServerEnv("BOOK_PAYWALL_PRICE")) || MONTHLY_PRICE_PER_MONTH;
}

export async function getBookAnalyticsTableName(): Promise<string | undefined> {
  return getServerEnv("BOOK_ANALYTICS_TABLE_NAME");
}

export async function getAppBaseUrl(reqUrl: string): Promise<string> {
  const url = new URL(reqUrl);
  const chapterFlowExplicit =
    (await getServerEnv("CHAPTERFLOW_APP_BASE_URL")) ||
    (await getServerEnv("NEXT_PUBLIC_CHAPTERFLOW_APP_URL"));
  // resolveAppBaseUrl (app-base-url-core.ts) owns the decision: an explicit base
  // URL wins, but in production a loopback/invalid value is REJECTED (it would
  // point Stripe success/return URLs at localhost) and we throw rather than ship
  // a broken redirect — mirroring resolvePublicOrigin's prod loopback guard.
  return resolveAppBaseUrl({
    explicit: chapterFlowExplicit,
    reqProtocol: url.protocol,
    reqHost: url.host,
    isProduction: process.env.NODE_ENV === "production",
  });
}
