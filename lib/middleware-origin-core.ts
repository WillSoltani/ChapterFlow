export type MiddlewareOriginEnv = {
  appBaseUrl?: string;
  chapterFlowAppBaseUrl?: string;
  allowAppBaseUrlInDev?: string;
  nodeEnv?: string;
};

export type MiddlewareOriginRequest = {
  hostHeader?: string | null;
  forwardedHostHeader?: string | null;
  forwardedProtoHeader?: string | null;
  fallbackOrigin: string;
};

const CANONICAL_PRODUCTION_HOSTS = new Set([
  "chapterflow.ca",
  "app.chapterflow.ca",
]);

function firstForwardedValue(value: string | null | undefined): string | null {
  if (!value) return null;
  const first = value.split(",")[0]?.trim();
  return first || null;
}

function isLoopbackHost(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized === "[::1]" ||
    normalized.endsWith(".localhost")
  );
}

function parseHttpOrigin(value: string): URL | null {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    if (parsed.username || parsed.password) return null;
    if (parsed.pathname !== "/" || parsed.search || parsed.hash) return null;
    return parsed;
  } catch {
    return null;
  }
}

function configuredOrigin(
  configuredBaseUrl: string,
  isProduction: boolean,
  allowConfiguredInDev: boolean,
): string | null {
  const parsed = parseHttpOrigin(configuredBaseUrl);
  if (!parsed) return null;

  if (isProduction) {
    return isLoopbackHost(parsed.hostname) ? null : parsed.origin;
  }
  if (allowConfiguredInDev || isLoopbackHost(parsed.hostname)) {
    return parsed.origin;
  }
  return null;
}

function requestDerivedOrigin(
  rawHost: string,
  rawProtocol: string,
  isProduction: boolean,
): string | null {
  const host = rawHost.trim();
  const protocol = rawProtocol.trim().toLowerCase();
  if (!host || (protocol !== "http" && protocol !== "https")) return null;

  // A Host authority cannot contain path/query/user-info separators. URL would
  // otherwise parse some of these into a syntactically valid but unintended
  // authority, obscuring the security decision.
  if (/[\\/@?#\s]/.test(host)) return null;

  const parsed = parseHttpOrigin(`${protocol}://${host}`);
  if (!parsed) return null;

  if (!isProduction) return parsed.origin;

  // Public production redirects are HTTPS-only and use the two canonical
  // ChapterFlow authorities. URL normalizes an explicit :443 away; any
  // remaining port is non-default and is not a canonical production origin.
  if (parsed.protocol !== "https:") return null;
  if (!CANONICAL_PRODUCTION_HOSTS.has(parsed.hostname.toLowerCase())) {
    return null;
  }
  if (parsed.port) return null;
  return parsed.origin;
}

/**
 * Resolve the authority used by middleware redirects without trusting raw
 * request headers. An explicit deploy-provided base keeps precedence. When no
 * configured base is usable, production accepts only the canonical HTTPS
 * ChapterFlow hosts; malformed or attacker-controlled authorities fall back to
 * the framework-computed `nextUrl.origin`.
 */
export function resolveMiddlewareOrigin(
  request: MiddlewareOriginRequest,
  env: MiddlewareOriginEnv,
): string {
  const isProduction = env.nodeEnv === "production";
  const configuredBaseUrl =
    env.appBaseUrl?.trim() || env.chapterFlowAppBaseUrl?.trim();
  if (configuredBaseUrl) {
    const resolvedConfigured = configuredOrigin(
      configuredBaseUrl,
      isProduction,
      env.allowAppBaseUrlInDev === "1",
    );
    if (resolvedConfigured) return resolvedConfigured;
  }

  const forwardedHost = firstForwardedValue(request.forwardedHostHeader);
  const host = forwardedHost || request.hostHeader?.trim() || null;
  const protocol =
    firstForwardedValue(request.forwardedProtoHeader) ||
    (isProduction ? "https" : "http");

  if (host) {
    const resolvedRequestOrigin = requestDerivedOrigin(
      host,
      protocol,
      isProduction,
    );
    if (resolvedRequestOrigin) return resolvedRequestOrigin;
  }

  return request.fallbackOrigin.replace(/\/+$/, "");
}
