import "server-only";

export type InferredLocation = {
  source: "cloudfront" | "vercel" | "proxy";
  precision: "country" | "region" | "city";
  countryCode: string | null;
  countryName: string | null;
  regionCode: string | null;
  regionName: string | null;
  city: string | null;
};

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
