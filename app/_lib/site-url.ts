function normalizeUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

export function getSiteUrl(): string {
  const configured =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() || process.env.APP_BASE_URL?.trim();

  if (configured) return normalizeUrl(configured);

  if (process.env.NODE_ENV === "production") {
    return "https://soltani.org";
  }

  return "http://localhost:3000";
}

