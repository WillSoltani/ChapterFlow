// Pure, `server-only`-free helper for getAppBaseUrl (env.ts). Kept in a `-core`
// module so it is directly unit-testable under `tsx --test` (importing env.ts
// pulls `server-only` via server-env.ts). env.ts owns the SSM/env reads and the
// `new URL(reqUrl)` parse, then passes a plain snapshot in here.

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

function isLoopbackHostname(hostname: string): boolean {
  const h = hostname.trim().toLowerCase();
  return (
    h === "localhost" ||
    h === "127.0.0.1" ||
    h === "::1" ||
    h === "[::1]" ||
    h.endsWith(".localhost")
  );
}

/**
 * True when an explicitly-configured base URL is unusable as a canonical
 * production origin: it doesn't parse as an absolute URL, or its host is
 * loopback/internal (`http://localhost:3000` etc). Stripe rejects such URLs and
 * users would be redirected to the wrong place.
 */
export function isUsableProdBaseUrl(value: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
  if (isLoopbackHostname(parsed.hostname)) return false;
  return true;
}

export type AppBaseUrlInput = {
  /** CHAPTERFLOW_APP_BASE_URL || NEXT_PUBLIC_CHAPTERFLOW_APP_URL, or null. */
  explicit: string | null | undefined;
  /** Request URL protocol incl. trailing colon, e.g. "https:". */
  reqProtocol: string;
  /** Request URL host (incl. port), e.g. "localhost:3000". */
  reqHost: string;
  isProduction: boolean;
};

/**
 * Resolve the canonical app base URL.
 *
 * - An explicit base URL wins, BUT in production it must be a usable absolute
 *   http(s) URL with a non-loopback host. A loopback/invalid value is REJECTED
 *   (it would point Stripe success/return URLs at localhost) and we throw rather
 *   than silently shipping a broken redirect — mirroring resolvePublicOrigin's
 *   prod loopback guard.
 * - In non-production an explicit value is returned as-is (loopback is expected
 *   for local dev).
 * - With no explicit value we fall back to the request host in dev; in prod we
 *   throw (a canonical origin is launch-critical for Stripe redirects).
 */
export function resolveAppBaseUrl(input: AppBaseUrlInput): string {
  const explicit = input.explicit?.trim();
  if (explicit) {
    const normalized = normalizeBaseUrl(explicit);
    if (!input.isProduction) return normalized;
    if (isUsableProdBaseUrl(normalized)) return normalized;
    throw new Error(
      `CHAPTERFLOW_APP_BASE_URL resolves to a loopback/invalid host (${normalized}). ` +
        "Refusing to use it in production — Stripe redirects need a canonical origin."
    );
  }

  // In production we MUST have an explicit base URL. Falling back to the
  // request host can produce internal hostnames or http://localhost which
  // Stripe rejects (or which redirect users to the wrong place).
  if (input.isProduction) {
    throw new Error(
      "CHAPTERFLOW_APP_BASE_URL is not set. Refusing to fall back to the request host in production."
    );
  }
  return `${input.reqProtocol}//${input.reqHost}`;
}

// ---------------------------------------------------------------------------
// WS6-012: library cover URL builder.
//
// This lives here (rather than a new `cover-url-core.ts`) on purpose: covers are
// minted in library-catalog.ts, which is reachable from the book pipeline's
// static type program (scripts/book/check-catalog-state.ts dynamically imports
// it), so it is part of the app+book SHARED TypeScript closure. A NEW module
// imported by library-catalog.ts would GROW that shared set — forbidden by the
// closure guard (scripts/ci/verify-shared-ts-closure.mjs). app-base-url-core.ts
// is already in the shared set and is the natural home for app-origin URL
// construction, so the builder is co-located here with resolveAppBaseUrl.
//
// Covers are served from the CloudFront distribution on the canonical app origin
// under the `book-content/library/covers/*` path, which CloudFront routes to the
// content S3 bucket via Origin Access Control. The cover URL is therefore
// `${appBaseUrl}/${encodeS3Key(coverAssetKey)}`, where coverAssetKey is the S3
// object key (e.g. "book-content/library/covers/foo.svg") — the CloudFront path
// pattern equals the key prefix, so no origin-path rewrite is involved.

/**
 * Percent-encode each `/`-delimited segment of an S3 key while preserving the
 * `/` separators, so the key round-trips as a URL path.
 */
export function encodeS3Key(key: string): string {
  return key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

/**
 * Build the public cover URL on the canonical app origin. `appBaseUrl` is the
 * resolved base URL (resolveAppBaseUrl above); any trailing slash is stripped so
 * the result never doubles the `/` between origin and key.
 */
export function buildCoverUrl(appBaseUrl: string, coverAssetKey: string): string {
  return `${normalizeBaseUrl(appBaseUrl)}/${encodeS3Key(coverAssetKey)}`;
}
