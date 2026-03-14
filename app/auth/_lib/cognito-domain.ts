import { getServerEnv, mustServerEnv } from "@/app/app/api/_lib/server-env";

function ensureHttpsUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Missing env var: COGNITO_DOMAIN");
  const withScheme = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  const parsed = new URL(withScheme);
  return parsed.toString().replace(/\/+$/, "");
}

export async function resolveCognitoDomain(): Promise<string> {
  const customDomain = await getServerEnv("COGNITO_CUSTOM_DOMAIN");
  if (customDomain) return ensureHttpsUrl(customDomain);

  const domain = await mustServerEnv("COGNITO_DOMAIN");
  return ensureHttpsUrl(domain);
}

