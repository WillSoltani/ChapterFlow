import { NextResponse } from "next/server";
import { buildIosAppConfig } from "./config-core";

export const runtime = "nodejs";

/**
 * Public, cacheable native-iOS launch config.
 *
 * The app fetches this on every launch to drive its force-update gate,
 * kill-switch feature flags, StoreKit product list, and maintenance mode —
 * see `config-core.ts` for the full contract. It is intentionally unauthenticated
 * (the app hits it before the user has a session, and force-update must work even
 * when auth is down) — middleware.ts passes everything under `/app/api/` through
 * without a cookie check, so no session is required.
 *
 * Values come straight from the server Lambda's env vars (like the billing
 * secrets in /api/health), so this handler is network-free and can never
 * false-fail. `max-age=300` lets the CDN and app cache the config for 5 minutes:
 * long enough to shield the origin, short enough that flipping a kill-switch or
 * entering maintenance mode propagates within minutes.
 */
export function GET(): NextResponse {
  const config = buildIosAppConfig(process.env);
  return NextResponse.json(config, {
    status: 200,
    headers: {
      "Cache-Control": "public, max-age=300",
    },
  });
}
