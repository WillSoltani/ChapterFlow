import { NextResponse } from "next/server";
import {
  buildAppleAppSiteAssociation,
  resolveAppleAppId,
} from "@/app/_lib/apple-app-site-association";

export const runtime = "nodejs";
// Read the Team ID from Lambda env at request time (see docs/ENVIRONMENT.md);
// keep it out of the build so rotating IOS_APP_TEAM_ID needs no rebuild.
// Resolution goes through getServerEnv (dynamically imported below), so the value
// can live in SSM (`${SSM_PARAMETER_PREFIX}/IOS_APP_TEAM_ID`) and rotate with no
// redeploy — not just as a baked Lambda env var.
export const dynamic = "force-dynamic";

/**
 * Resolve the Apple identifiers from the environment.
 *
 * In the server runtime this goes through `getServerEnv`, which reads `process.env`
 * first and falls back to SSM (`${SSM_PARAMETER_PREFIX}/<KEY>`) at request time.
 * `getServerEnv` lives in a `server-only` module, which throws when imported from a
 * non-server runtime (e.g. the `tsx --test` unit runner). It is therefore imported
 * dynamically and, if unavailable, we fall back to reading `process.env` directly —
 * identical behaviour to `resolveAppleAppId()`'s default, and what the route tests
 * exercise.
 */
async function resolveAppleIdentifiers(): Promise<{
  teamId?: string;
  bundleId?: string;
}> {
  try {
    const { getServerEnv } = await import("@/app/app/api/_lib/server-env");
    const [teamId, bundleId] = await Promise.all([
      getServerEnv("IOS_APP_TEAM_ID"),
      getServerEnv("IOS_APP_BUNDLE_ID"),
    ]);
    return { teamId, bundleId };
  } catch {
    return {
      teamId: process.env.IOS_APP_TEAM_ID,
      bundleId: process.env.IOS_APP_BUNDLE_ID,
    };
  }
}

/**
 * `GET /.well-known/apple-app-site-association`
 *
 * The Apple App Site Association file. Apple's CDN fetches it over HTTPS from the
 * production apex to enable Universal Links + shared web credentials for the iOS
 * app. Requirements this handler satisfies:
 *   • Pure JSON body, `Content-Type: application/json` — Apple REJECTS any other
 *     type and (historically) any `.json` extension or redirect.
 *   • NO redirect — served directly as 200 from this exact path.
 *   • Cacheable — Apple caches aggressively; a public max-age lets CloudFront and
 *     Apple's CDN cache it without preventing a same-day rotation from landing.
 *
 * The document itself is built by the pure, unit-tested core module. This route
 * only resolves the app id from env and serializes.
 */
export async function GET(): Promise<NextResponse> {
  const { teamId, bundleId } = await resolveAppleIdentifiers();
  // resolveAppleAppId keeps its documented placeholder/default fallbacks when
  // either value is unset.
  const appId = resolveAppleAppId({
    IOS_APP_TEAM_ID: teamId,
    IOS_APP_BUNDLE_ID: bundleId,
  });
  const body = buildAppleAppSiteAssociation(appId);

  return NextResponse.json(body, {
    status: 200,
    headers: {
      // NextResponse.json already sets application/json; set it explicitly so
      // the exact-type contract Apple requires can never drift.
      "content-type": "application/json",
      "cache-control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
