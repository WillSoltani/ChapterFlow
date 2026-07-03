import { NextResponse } from "next/server";
import {
  buildAppleAppSiteAssociation,
  resolveAppleAppId,
} from "@/app/_lib/apple-app-site-association";

export const runtime = "nodejs";
// Read the Team ID from Lambda env at request time (see docs/ENVIRONMENT.md);
// keep it out of the build so rotating IOS_APP_TEAM_ID needs no rebuild.
export const dynamic = "force-dynamic";

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
  const body = buildAppleAppSiteAssociation(resolveAppleAppId());

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
