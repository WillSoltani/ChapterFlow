import "server-only";

export type InferredLocation = {
  source: "cloudfront" | "vercel" | "proxy" | "ipapi";
  precision: "country" | "region" | "city";
  countryCode: string | null;
  countryName: string | null;
  regionCode: string | null;
  regionName: string | null;
  city: string | null;
  latitude?: string | null;
  longitude?: string | null;
  timezone?: string | null;
};

// ─── In-memory IP→location cache ────────────────────────────────────────────
// Shared across requests within a warm Lambda container. 24h TTL.
// On cold start the map is empty (safe — we re-resolve).

type CacheEntry = { loc: InferredLocation | null; expiresAt: number };
const IP_CACHE = new Map<string, CacheEntry>();
const IP_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const IP_CACHE_MAX = 5000;
const IPAPI_TIMEOUT_MS = 1500;

function extractClientIp(headers: Headers): string | null {
  // x-forwarded-for can be a comma-separated chain; the leftmost is the
  // original client.
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first && !isPrivateIp(first)) return first;
  }
  const real = headers.get("x-real-ip");
  if (real && !isPrivateIp(real)) return real.trim();
  const cfViewer = headers.get("cloudfront-viewer-address");
  if (cfViewer) {
    // Format: "1.2.3.4:12345"
    const ip = cfViewer.split(":")[0]?.trim();
    if (ip && !isPrivateIp(ip)) return ip;
  }
  return null;
}

function isPrivateIp(ip: string): boolean {
  // Skip private/reserved ranges — they'd always resolve to "unknown"
  // and waste API calls
  if (/^127\./.test(ip)) return true;
  if (/^10\./.test(ip)) return true;
  if (/^192\.168\./.test(ip)) return true;
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip)) return true;
  if (ip === "::1" || ip.startsWith("fc00:") || ip.startsWith("fe80:")) return true;
  return false;
}

/**
 * Look up a client IP using ip-api.com's free endpoint (no key, ~45 req/min).
 * Cached in-memory for 24h. Returns null on any failure.
 */
export async function fetchLocationByIp(ip: string): Promise<InferredLocation | null> {
  if (!ip || isPrivateIp(ip)) return null;

  // Check cache
  const cached = IP_CACHE.get(ip);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.loc;
  }

  // Trim cache if bloated
  if (IP_CACHE.size >= IP_CACHE_MAX) {
    const firstKey = IP_CACHE.keys().next().value;
    if (firstKey) IP_CACHE.delete(firstKey);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IPAPI_TIMEOUT_MS);

  try {
    // ip-api.com free tier: no auth, ~45 req/min per IP, HTTP-only.
    // Using `fields` to minimize payload.
    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,countryCode,region,regionName,city,lat,lon,timezone`,
      { signal: controller.signal },
    );
    clearTimeout(timeout);

    if (!res.ok) {
      IP_CACHE.set(ip, { loc: null, expiresAt: Date.now() + IP_CACHE_TTL_MS });
      return null;
    }

    const data = (await res.json()) as {
      status?: string;
      country?: string;
      countryCode?: string;
      region?: string;
      regionName?: string;
      city?: string;
      lat?: number;
      lon?: number;
      timezone?: string;
    };

    if (data.status !== "success" || !data.countryCode) {
      IP_CACHE.set(ip, { loc: null, expiresAt: Date.now() + IP_CACHE_TTL_MS });
      return null;
    }

    const loc: InferredLocation = {
      source: "ipapi",
      precision: data.city ? "city" : data.regionName ? "region" : "country",
      countryCode: data.countryCode,
      countryName: data.country ?? null,
      regionCode: data.region ?? null,
      regionName: data.regionName ?? null,
      city: data.city ?? null,
      latitude: data.lat != null ? String(data.lat) : null,
      longitude: data.lon != null ? String(data.lon) : null,
      timezone: data.timezone ?? null,
    };

    IP_CACHE.set(ip, { loc, expiresAt: Date.now() + IP_CACHE_TTL_MS });
    return loc;
  } catch {
    clearTimeout(timeout);
    // Cache negative results briefly so we don't hammer the API
    IP_CACHE.set(ip, { loc: null, expiresAt: Date.now() + 5 * 60 * 1000 });
    return null;
  }
}

/**
 * Top-level resolver: try request headers first (free, instant), then
 * fall back to an IP lookup (external API call, cached). Returns null
 * if nothing resolves.
 */
export async function resolveLocation(
  headers: Headers,
): Promise<InferredLocation | null> {
  const fromHeaders = inferLocationFromHeaders(headers);
  if (fromHeaders) return fromHeaders;

  const ip = extractClientIp(headers);
  if (!ip) return null;

  return fetchLocationByIp(ip);
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function readFirst(headers: Headers, names: string[]): string | null {
  for (const name of names) {
    const value = clean(headers.get(name));
    if (value) return value;
  }
  return null;
}

export function inferLocationFromHeaders(headers: Headers): InferredLocation | null {
  const cloudfrontCountry = readFirst(headers, ["cloudfront-viewer-country"]);
  const vercelCountry = readFirst(headers, ["x-vercel-ip-country"]);
  const proxyCountry = readFirst(headers, ["x-country-code"]);

  const source = cloudfrontCountry
    ? "cloudfront"
    : vercelCountry
      ? "vercel"
      : proxyCountry
        ? "proxy"
        : null;

  if (!source) return null;

  const countryCode =
    source === "cloudfront"
      ? cloudfrontCountry
      : source === "vercel"
        ? vercelCountry
        : proxyCountry;

  const countryName =
    source === "cloudfront"
      ? readFirst(headers, ["cloudfront-viewer-country-name"])
      : readFirst(headers, ["x-country-name"]);
  const regionCode =
    source === "cloudfront"
      ? readFirst(headers, ["cloudfront-viewer-region"])
      : readFirst(headers, ["x-vercel-ip-country-region", "x-region-code"]);
  const regionName =
    source === "cloudfront"
      ? readFirst(headers, ["cloudfront-viewer-region-name"])
      : readFirst(headers, ["x-region-name"]);
  const city =
    source === "cloudfront"
      ? readFirst(headers, ["cloudfront-viewer-city"])
      : readFirst(headers, ["x-vercel-ip-city", "x-city"]);

  const precision = city ? "city" : regionCode || regionName ? "region" : "country";

  return {
    source,
    precision,
    countryCode,
    countryName,
    regionCode,
    regionName,
    city,
  };
}
