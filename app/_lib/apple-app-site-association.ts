/**
 * Apple App Site Association (AASA) — the JSON document Apple fetches from
 * `https://<domain>/.well-known/apple-app-site-association` to enable:
 *   • Universal Links  — deep-link the covered paths straight into the iOS app
 *     (with a normal web fallback when the app isn't installed), and
 *   • Shared Web Credentials — let iOS offer to autofill / save the ChapterFlow
 *     password for the app (the `webcredentials` section below).
 *
 * This module is intentionally free of `server-only` and any AWS/runtime deps so
 * it can be unit-tested in-process. The route handler
 * (`app/.well-known/apple-app-site-association/route.ts`) is a thin wrapper that
 * serializes `buildAppleAppSiteAssociation(resolveAppleAppId())` as
 * `application/json` with no redirect.
 *
 * The Apple Team ID + bundle id are read from env (see docs/ENVIRONMENT.md) and
 * are NOT hardcoded — until `IOS_APP_TEAM_ID` is injected the file still serves a
 * structurally-valid document carrying an obvious placeholder Team ID.
 */

/**
 * The URL paths iOS should treat as Universal Links. Each MUST also render a
 * sensible web fallback for users without the app (existing pages where they
 * exist; a branded interstitial otherwise) — see B7.
 */
export const IOS_UNIVERSAL_LINK_PATHS = [
  "/book/*",
  "/pair/accept/*",
  "/gift/*",
  "/ref/*",
  "/review",
] as const;

/** Default iOS bundle id (fixed for the ChapterFlow app). Overridable via env. */
export const DEFAULT_IOS_BUNDLE_ID = "com.chapterflow.ios";

/**
 * Documented placeholder for the Apple Developer Team ID (a.k.a. the App ID
 * Prefix — a 10-char alphanumeric string). Real value must be supplied via
 * `IOS_APP_TEAM_ID` (see docs/ENVIRONMENT.md §3.F). Serving the placeholder keeps
 * the document shape valid before the id is wired up; iOS simply won't match a
 * real signed app against it, so there is no security risk in shipping it.
 */
export const IOS_TEAM_ID_PLACEHOLDER = "TEAMID";

type EnvLike = Record<string, string | undefined>;

/**
 * Resolve the fully-qualified Apple app identifier `"<TeamID>.<bundleId>"` from
 * env, falling back to the documented placeholder Team ID + default bundle id.
 */
export function resolveAppleAppId(env: EnvLike = process.env): string {
  const teamId = env.IOS_APP_TEAM_ID?.trim() || IOS_TEAM_ID_PLACEHOLDER;
  const bundleId = env.IOS_APP_BUNDLE_ID?.trim() || DEFAULT_IOS_BUNDLE_ID;
  return `${teamId}.${bundleId}`;
}

export type AppleAppSiteAssociation = {
  applinks: {
    /** Empty per Apple's spec — required key, no legacy app entries. */
    apps: string[];
    details: Array<{
      appID: string;
      /** Modern alias for `appID`; harmless to include for forward-compat. */
      appIDs: string[];
      paths: string[];
    }>;
  };
  webcredentials: {
    apps: string[];
  };
};

/** Build the AASA document for a single app identifier. */
export function buildAppleAppSiteAssociation(
  appID: string,
): AppleAppSiteAssociation {
  const paths = [...IOS_UNIVERSAL_LINK_PATHS];
  return {
    applinks: {
      apps: [],
      details: [
        {
          appID,
          appIDs: [appID],
          paths,
        },
      ],
    },
    webcredentials: {
      apps: [appID],
    },
  };
}
