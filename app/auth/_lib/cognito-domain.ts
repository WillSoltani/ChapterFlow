import { getServerEnv, mustServerEnv } from "@/app/app/api/_lib/server-env";
import { ensureHttpsUrl } from "./cognito-domain-core";

export async function resolveCognitoDomain(): Promise<string> {
  const customDomain = await getServerEnv("COGNITO_CUSTOM_DOMAIN");
  if (customDomain) return ensureHttpsUrl(customDomain);

  const domain = await mustServerEnv("COGNITO_DOMAIN");
  return ensureHttpsUrl(domain);
}

