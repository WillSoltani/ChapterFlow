function normalizeUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

// The single canonical production origin. Mirrors the infra apex
// (PROD_APEX_DOMAIN in infra/lib/env-config.ts) and the Route53 root records.
// Used only when no explicit origin env is configured, so canonical/OG/sitemap/
// robots URLs can never silently fall back to an off-brand host. Operators
// SHOULD still set NEXT_PUBLIC_SITE_URL or APP_BASE_URL to pin the origin
// explicitly (e.g. for a non-prod alias); this is the safe last resort.
const CANONICAL_PROD_SITE_URL = "https://chapterflow.ca";

export function getSiteUrl(): string {
  const configured =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() || process.env.APP_BASE_URL?.trim();

  if (configured) return normalizeUrl(configured);

  if (process.env.NODE_ENV === "production") {
    return CANONICAL_PROD_SITE_URL;
  }

  return "http://localhost:3000";
}

