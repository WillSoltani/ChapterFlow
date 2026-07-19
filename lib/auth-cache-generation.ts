/**
 * Non-secret browser cache epoch used only to separate private client-cache
 * generations. Authentication and authorization continue to rely on the
 * httpOnly id token; this opaque value must never be treated as identity.
 */
export const AUTH_CACHE_GENERATION_COOKIE = "cf_auth_generation";
export const AUTH_CACHE_GENERATION_STORAGE_KEY = "cf:auth-generation";
export const AUTH_CACHE_GENERATION_CHANGED_EVENT =
  "chapterflow:auth-generation-changed";
export const AUTH_CACHE_GENERATION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeAuthCacheGeneration(
  value: string | null | undefined,
): string | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  return UUID_PATTERN.test(normalized) ? normalized : null;
}

export function readCookieValue(cookieHeader: string, name: string): string | null {
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    const candidateName = part.slice(0, separator).trim();
    if (candidateName !== name) continue;
    const rawValue = part.slice(separator + 1).trim();
    try {
      return decodeURIComponent(rawValue);
    } catch {
      return rawValue;
    }
  }
  return null;
}
