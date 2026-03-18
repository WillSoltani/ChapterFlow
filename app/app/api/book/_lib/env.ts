import { mustServerEnv, getServerEnv } from "@/app/app/api/_lib/server-env";

const DEFAULT_ADMIN_GROUP = "admin";

export async function getBookTableName(): Promise<string> {
  const explicit = await getServerEnv("BOOK_TABLE_NAME");
  if (explicit) return explicit;
  return mustServerEnv("SECURE_DOC_TABLE");
}

export async function getBookIngestBucket(): Promise<string> {
  const explicit = await getServerEnv("BOOK_INGEST_BUCKET");
  if (explicit) return explicit;
  return mustServerEnv("RAW_BUCKET");
}

export async function getBookContentBucket(): Promise<string> {
  const explicit = await getServerEnv("BOOK_CONTENT_BUCKET");
  if (explicit) return explicit;
  return mustServerEnv("OUTPUT_BUCKET");
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

export async function getBookStripeSecretKey(): Promise<string | undefined> {
  return getServerEnv("BOOK_STRIPE_SECRET_KEY");
}

export async function getBookStripeWebhookSecret(): Promise<string | undefined> {
  return getServerEnv("BOOK_STRIPE_WEBHOOK_SECRET");
}

export async function getBookPaywallPriceDisplay(): Promise<string> {
  return (await getServerEnv("BOOK_PAYWALL_PRICE")) || "$7.99/month";
}

export async function getBookAnalyticsTableName(): Promise<string | undefined> {
  return getServerEnv("BOOK_ANALYTICS_TABLE_NAME");
}

export async function getAppBaseUrl(reqUrl: string): Promise<string> {
  const url = new URL(reqUrl);
  const chapterFlowExplicit =
    (await getServerEnv("CHAPTERFLOW_APP_BASE_URL")) ||
    (await getServerEnv("NEXT_PUBLIC_CHAPTERFLOW_APP_URL"));
  if (chapterFlowExplicit) return chapterFlowExplicit.replace(/\/+$/, "");
  return `${url.protocol}//${url.host}`;
}
