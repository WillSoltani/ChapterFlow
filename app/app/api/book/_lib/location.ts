import "server-only";
import { getServerEnv } from "@/app/app/api/_lib/server-env";

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

/**
 * Reduce coordinate precision to ~1 decimal place (≈11 km) so we only ever
 * store APPROXIMATE, city-level location — never precise coordinates. This is
 * what the privacy policy discloses and what the admin geography view uses.
 */
function coarsenCoord(n: number): number {
  return Math.round(n * 10) / 10;
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
 * Look up a client IP via an external geolocation provider over HTTPS only.
 *
 * The client's real IP and the derived approximate location are PII, so the
 * outbound call must be encrypted (the privacy policy promises HTTPS). We never
 * use ip-api.com's free endpoint here because it is plaintext-HTTP-only:
 *   - If IPAPI_KEY is set, we use ip-api.com's HTTPS pro endpoint.
 *   - Otherwise we fall back to ipwho.is, whose free tier supports HTTPS with no
 *     key.
 * This is only ever reached as a best-effort fallback after CDN edge headers
 * (resolveLocation tries inferLocationFromHeaders first, over the existing TLS).
 *
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
    // The geolocation lookup is PII and MUST go over HTTPS. Prefer ip-api.com's
    // HTTPS pro endpoint when a key is configured; otherwise fall back to
    // ipwho.is, whose free tier serves HTTPS with no key. ip-api.com's free
    // endpoint is HTTP-only and is deliberately never used here.
    const ipapiKey = (await getServerEnv("IPAPI_KEY"))?.trim();
    const url = ipapiKey
      ? `https://pro.ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,countryCode,region,regionName,city,lat,lon,timezone&key=${encodeURIComponent(ipapiKey)}`
      : `https://ipwho.is/${encodeURIComponent(ip)}?fields=success,country,country_code,region,region_code,city,latitude,longitude,timezone`;

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      IP_CACHE.set(ip, { loc: null, expiresAt: Date.now() + IP_CACHE_TTL_MS });
      return null;
    }

    const loc = ipapiKey
      ? parseIpApiResponse(await res.json())
      : parseIpWhoIsResponse(await res.json());

    if (!loc) {
      IP_CACHE.set(ip, { loc: null, expiresAt: Date.now() + IP_CACHE_TTL_MS });
      return null;
    }

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
 * Map an ip-api.com (pro, HTTPS) response into an InferredLocation. Returns null
 * on a failed/empty lookup. Coordinates are coarsened to ~city level.
 */
function parseIpApiResponse(raw: unknown): InferredLocation | null {
  const data = (raw ?? {}) as {
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

  if (data.status !== "success" || !data.countryCode) return null;

  return {
    source: "ipapi",
    precision: data.city ? "city" : data.regionName ? "region" : "country",
    countryCode: data.countryCode,
    countryName: data.country ?? null,
    regionCode: data.region ?? null,
    regionName: data.regionName ?? null,
    city: data.city ?? null,
    // Store APPROXIMATE coordinates only (coarsened to ~city level).
    latitude: data.lat != null ? String(coarsenCoord(data.lat)) : null,
    longitude: data.lon != null ? String(coarsenCoord(data.lon)) : null,
    timezone: data.timezone ?? null,
  };
}

/**
 * Map an ipwho.is (free, HTTPS) response into an InferredLocation. Returns null
 * on a failed/empty lookup. Coordinates are coarsened to ~city level.
 */
function parseIpWhoIsResponse(raw: unknown): InferredLocation | null {
  const data = (raw ?? {}) as {
    success?: boolean;
    country?: string;
    country_code?: string;
    region?: string;
    region_code?: string;
    city?: string;
    latitude?: number;
    longitude?: number;
    // `fields` keeps this a plain string; full responses nest it as { id }.
    timezone?: string | { id?: string };
  };

  if (data.success === false || !data.country_code) return null;

  const timezone =
    typeof data.timezone === "string"
      ? data.timezone
      : (data.timezone?.id ?? null);

  return {
    source: "ipapi",
    precision: data.city ? "city" : data.region ? "region" : "country",
    countryCode: data.country_code,
    countryName: data.country ?? null,
    regionCode: data.region_code ?? null,
    regionName: data.region ?? null,
    city: data.city ?? null,
    // Store APPROXIMATE coordinates only (coarsened to ~city level).
    latitude: data.latitude != null ? String(coarsenCoord(data.latitude)) : null,
    longitude: data.longitude != null ? String(coarsenCoord(data.longitude)) : null,
    timezone,
  };
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

  // CDN edge headers (CloudFront / Vercel) can carry precise coordinates. Read
  // and COARSEN them to ~city level here so the only coordinates we ever store
  // are approximate — never the raw, meter-level values from the header.
  const latRaw =
    source === "cloudfront"
      ? readFirst(headers, ["cloudfront-viewer-latitude"])
      : readFirst(headers, ["x-vercel-ip-latitude"]);
  const lonRaw =
    source === "cloudfront"
      ? readFirst(headers, ["cloudfront-viewer-longitude"])
      : readFirst(headers, ["x-vercel-ip-longitude"]);
  const latNum = latRaw != null ? Number(latRaw) : NaN;
  const lonNum = lonRaw != null ? Number(lonRaw) : NaN;

  return {
    source,
    precision,
    countryCode,
    countryName,
    regionCode,
    regionName,
    city,
    latitude: Number.isFinite(latNum) ? String(coarsenCoord(latNum)) : null,
    longitude: Number.isFinite(lonNum) ? String(coarsenCoord(lonNum)) : null,
  };
}
