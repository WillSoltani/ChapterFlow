// Pure, `server-only`-free helpers for public-origin resolution
// (server-origin.ts). Kept in a `-core` module so they are directly unit-testable
// under `tsx --test` — importing server-origin.ts itself pulls `next/headers`
// (and, transitively in its callers, `server-only`). server-origin.ts owns the
// `headers()` I/O and passes a plain env snapshot into `resolvePublicOriginCore`.

import { logger } from "@/lib/logging/logger";

export function normalizeOrigin(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

export function isLoopbackHost(hostname: string): boolean {
  const h = hostname.trim().toLowerCase();
  return (
    h === "localhost" ||
    h === "127.0.0.1" ||
    h === "::1" ||
    h === "[::1]" ||
    h.endsWith(".localhost")
  );
}

export function isLocalOrigin(value: string): boolean {
  try {
    const parsed = new URL(value);
    return isLoopbackHost(parsed.hostname);
  } catch {
    return false;
  }
}

export function firstForwardedValue(value: string | null): string | null {
  if (!value) return null;
  const first = value.split(",")[0]?.trim();
  return first || null;
}

/**
 * Env vars that pin a TRUSTED ChapterFlow origin (mirrors the allowlist
 * `app/auth/_lib/return-to.ts` builds for returnTo validation). When the request
 * provides a host header but no base URL is explicitly configured, the derived
 * host is only honoured if it matches one of these trusted hosts — otherwise an
 * attacker can spoof `x-forwarded-host`/`Host` on a directly-reachable origin
 * and have it echoed into user-facing URLs (pair invites, auth redirects).
 */
const TRUSTED_ORIGIN_ENV_KEYS = [
  "APP_BASE_URL",
  "CHAPTERFLOW_APP_BASE_URL",
  "NEXT_PUBLIC_CHAPTERFLOW_APP_URL",
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_CHAPTERFLOW_SITE_URL",
  "CHAPTERFLOW_SITE_BASE_URL",
  "NEXT_PUBLIC_CHAPTERFLOW_AUTH_URL",
  "CHAPTERFLOW_AUTH_BASE_URL",
] as const;

/**
 * Lowercased host forms of a URL string: both the port-aware `host`
 * (`app.chapterflow.ca:8443`) and the bare `hostname` (`app.chapterflow.ca`),
 * so a request carrying an explicit default port (`Host: app.chapterflow.ca:443`)
 * still matches a configured `https://app.chapterflow.ca`. Empty if unparseable.
 */
function hostFormsOf(value: string): string[] {
  try {
    const url = new URL(value);
    return [url.host.toLowerCase(), url.hostname.toLowerCase()].filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Build the set of trusted hosts from a plain env snapshot. Loopback hosts are
 * always trusted (local dev); outside production a single bare `host` is also
 * fine because there is no canonical origin to defend.
 */
export function trustedHostsFromEnv(env: Record<string, string | undefined>): Set<string> {
  const hosts = new Set<string>();
  for (const key of TRUSTED_ORIGIN_ENV_KEYS) {
    const value = env[key]?.trim();
    if (!value) continue;
    for (const host of hostFormsOf(value)) hosts.add(host);
  }
  return hosts;
}

export type ResolveOriginEnv = {
  appBaseUrl?: string | undefined;
  chapterFlowAppBaseUrl?: string | undefined;
  allowAppBaseUrlInDev?: string | undefined;
  nodeEnv?: string | undefined;
  /** Full env snapshot used to derive the trusted-host allowlist. */
  trustedHosts: Set<string>;
};

export type ResolveOriginParams = {
  hostHeader?: string | null;
  forwardedHostHeader?: string | null;
  forwardedProtoHeader?: string | null;
  fallbackOrigin?: string;
};

/**
 * Pure origin-resolution decision. Precedence:
 *   1. An explicitly-configured, trusted base URL (APP_BASE_URL /
 *      CHAPTERFLOW_APP_BASE_URL) always wins. In prod a loopback value is
 *      ignored (logged by the caller-facing wrapper) so Stripe/auth URLs never
 *      point at localhost.
 *   2. A request-derived host — but ONLY when it is in the trusted-host
 *      allowlist (or loopback). `x-forwarded-host`/`Host` are attacker-
 *      controllable on a directly-reachable origin, so an unrecognised host is
 *      NOT echoed into user-facing URLs; we fall through to the explicit
 *      fallback / canonical instead.
 *   3. An explicit `fallbackOrigin` passed by the caller (e.g. the framework's
 *      own request origin), normalized.
 *   4. In prod, throw (caller must configure a base URL). In dev, localhost.
 */
export function resolvePublicOriginCore(
  params: ResolveOriginParams,
  env: ResolveOriginEnv
): string {
  const isProd = env.nodeEnv === "production";

  const configuredBaseUrl =
    env.appBaseUrl?.trim() || env.chapterFlowAppBaseUrl?.trim();
  if (configuredBaseUrl) {
    const normalizedConfigured = normalizeOrigin(configuredBaseUrl);
    const allowConfiguredInDev = env.allowAppBaseUrlInDev === "1";

    if (isProd) {
      if (!isLocalOrigin(normalizedConfigured)) return normalizedConfigured;
      logger.warn("origin_apps_base_url_loopback_ignored", {
        normalizedConfigured,
      });
    } else if (allowConfiguredInDev || isLocalOrigin(normalizedConfigured)) {
      return normalizedConfigured;
    }
  }

  const forwardedHost = firstForwardedValue(params.forwardedHostHeader ?? null);
  const host = forwardedHost || params.hostHeader || null;
  const proto =
    firstForwardedValue(params.forwardedProtoHeader ?? null) ||
    (isProd ? "https" : "http");

  if (host && isHostTrusted(host, env.trustedHosts, isProd)) {
    return normalizeOrigin(`${proto}://${host}`);
  }
  if (host) {
    logger.warn("origin_untrusted_request_host_ignored", { host });
  }

  if (params.fallbackOrigin) return normalizeOrigin(params.fallbackOrigin);

  if (isProd) {
    throw new Error("Unable to resolve public origin. Set APP_BASE_URL for production.");
  }
  return "http://localhost:3000";
}

/**
 * A request host is trusted when it is loopback (local dev), in the configured
 * allowlist, OR — outside production only — there is no allowlist to enforce
 * (no canonical origin to defend, so the dev host header is honoured as before).
 */
function isHostTrusted(
  host: string,
  trustedHosts: Set<string>,
  isProd: boolean
): boolean {
  const normalized = host.trim().toLowerCase();
  if (!normalized) return false;
  // Strip the port for loopback / bare-hostname comparison (Host headers carry it).
  const hostnameOnly = normalized.replace(/:\d+$/, "");
  if (isLoopbackHost(hostnameOnly) || isLoopbackHost(normalized)) return true;
  if (trustedHosts.has(normalized) || trustedHosts.has(hostnameOnly)) return true;
  // Outside prod, with nothing configured to compare against, fall back to the
  // pre-existing behaviour (honour the dev host header) rather than 500ing.
  if (!isProd && trustedHosts.size === 0) return true;
  return false;
}
