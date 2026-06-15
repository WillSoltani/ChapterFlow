import { getServerEnv, mustServerEnv } from "@/app/app/api/_lib/server-env";

function ensureHttpsUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Missing env var: COGNITO_DOMAIN");
  // Strip any leading scheme and force https. (Reassigning parsed.protocol does
  // NOT work for a non-special input scheme like `foo://` — the WHATWG URL setter
  // silently ignores special<->non-special transitions — so rebuild from https.)
  const withoutScheme = trimmed.replace(/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//, "");
  const parsed = new URL(`https://${withoutScheme}`);
  return parsed.toString().replace(/\/+$/, "");
}

export async function resolveCognitoDomain(): Promise<string> {
  const customDomain = await getServerEnv("COGNITO_CUSTOM_DOMAIN");
  if (customDomain) return ensureHttpsUrl(customDomain);

  const domain = await mustServerEnv("COGNITO_DOMAIN");
  return ensureHttpsUrl(domain);
}

