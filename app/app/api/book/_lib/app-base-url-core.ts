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
