import { headers } from "next/headers";
import {
  resolvePublicOriginCore,
  trustedHostsFromEnv,
  type ResolveOriginParams,
} from "./server-origin-core";

/**
 * Resolve the canonical public origin for building user-facing URLs.
 *
 * Precedence and the security rationale live in `resolvePublicOriginCore`
 * (server-origin-core.ts). In short: an explicitly-configured base URL
 * (`APP_BASE_URL` / `CHAPTERFLOW_APP_BASE_URL`) always wins over any request
 * header — `x-forwarded-host`/`Host` are attacker-controllable on a
 * directly-reachable origin, and the latter is the variable the deploy pipeline
 * injects into the server Lambda (see infra/bin/app.ts). A request-derived host
 * is only honoured when it is in the trusted-host allowlist (or loopback), so a
 * spoofed host can never be echoed into a pair invite / auth redirect.
 */
export function resolvePublicOrigin(params: ResolveOriginParams): string {
  return resolvePublicOriginCore(params, {
    appBaseUrl: process.env.APP_BASE_URL,
    chapterFlowAppBaseUrl: process.env.CHAPTERFLOW_APP_BASE_URL,
    allowAppBaseUrlInDev: process.env.ALLOW_APP_BASE_URL_IN_DEV,
    nodeEnv: process.env.NODE_ENV,
    trustedHosts: trustedHostsFromEnv(process.env),
  });
}

export async function getServerOrigin(): Promise<string> {
  const h = await headers();
  return resolvePublicOrigin({
    hostHeader: h.get("host"),
    forwardedHostHeader: h.get("x-forwarded-host"),
    forwardedProtoHeader: h.get("x-forwarded-proto"),
  });
}
