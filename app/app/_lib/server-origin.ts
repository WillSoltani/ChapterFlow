import { headers } from "next/headers";

function normalizeOrigin(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

function isLoopbackHost(hostname: string): boolean {
  const h = hostname.trim().toLowerCase();
  return h === "localhost" || h === "127.0.0.1" || h === "::1";
}

function isLocalOrigin(value: string): boolean {
  try {
    const parsed = new URL(value);
    return isLoopbackHost(parsed.hostname);
  } catch {
    return false;
  }
}

function firstForwardedValue(value: string | null): string | null {
  if (!value) return null;
  const first = value.split(",")[0]?.trim();
  return first || null;
}

export function resolvePublicOrigin(params: {
  hostHeader?: string | null;
  forwardedHostHeader?: string | null;
  forwardedProtoHeader?: string | null;
  fallbackOrigin?: string;
}): string {
  const configuredBaseUrl = process.env.APP_BASE_URL?.trim();
  if (configuredBaseUrl) {
    const normalizedConfigured = normalizeOrigin(configuredBaseUrl);
    const allowConfiguredInDev = process.env.ALLOW_APP_BASE_URL_IN_DEV === "1";
    const isProd = process.env.NODE_ENV === "production";

    if (isProd) {
      if (!isLocalOrigin(normalizedConfigured)) return normalizedConfigured;
      console.warn(
        "Ignoring APP_BASE_URL loopback value in production:",
        normalizedConfigured
      );
    } else if (allowConfiguredInDev || isLocalOrigin(normalizedConfigured)) {
      return normalizedConfigured;
    }
  }

  const forwardedHost = firstForwardedValue(params.forwardedHostHeader ?? null);
  const host = forwardedHost || params.hostHeader || null;
  const proto =
    firstForwardedValue(params.forwardedProtoHeader ?? null) ||
    (process.env.NODE_ENV === "production" ? "https" : "http");

  if (host) return normalizeOrigin(`${proto}://${host}`);
  if (params.fallbackOrigin) return normalizeOrigin(params.fallbackOrigin);

  if (process.env.NODE_ENV === "production") {
    throw new Error("Unable to resolve public origin. Set APP_BASE_URL for production.");
  }
  return "http://localhost:3000";
}

export async function getServerOrigin(): Promise<string> {
  const h = await headers();
  return resolvePublicOrigin({
    hostHeader: h.get("host"),
    forwardedHostHeader: h.get("x-forwarded-host"),
    forwardedProtoHeader: h.get("x-forwarded-proto"),
  });
}
