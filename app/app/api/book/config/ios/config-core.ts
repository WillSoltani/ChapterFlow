/**
 * Pure builder for the native-iOS launch config (`GET /app/api/book/config/ios`).
 *
 * The iOS app reads this at every launch to drive, WITHOUT shipping a new
 * binary:
 *  - a force-update / soft-update gate (compare the running app version against
 *    `minSupportedVersion` / `latestVersion`),
 *  - remote kill-switch feature flags,
 *  - the StoreKit product list to offer, and
 *  - a full-app maintenance mode + an optional message-of-the-day banner.
 *
 * A force-update gate CANNOT be retrofitted into binaries already in the field,
 * so this contract must exist before v1.0 ships. Every value is env-overridable
 * (deployed as Lambda env vars) so operations can flip a flag, bump the minimum
 * supported version, rotate the product list, or enter maintenance mode with a
 * config change — no App Store review, no client release.
 *
 * This module is intentionally pure (no `server-only`, no I/O): it takes a plain
 * env-like record and returns the response body, so it is unit-testable in the
 * `tsx --test` runner. The route handler does the process.env read and adds the
 * cache headers.
 */

export interface IosAppConfig {
  /**
   * Lowest app version still allowed to run. A client older than this must show
   * a BLOCKING force-update prompt (the App Store is the only way forward).
   */
  minSupportedVersion: string;
  /**
   * Newest app version available on the App Store. A client between
   * `minSupportedVersion` and this may show a DISMISSIBLE soft-update nudge.
   */
  latestVersion: string;
  /** Remote kill-switch / rollout flags, keyed by flag name. */
  featureFlags: Record<string, boolean>;
  /** StoreKit 2 product identifiers the app should offer, in display order. */
  storeKitProductIds: string[];
  /** When true the app shows a full-screen "we'll be right back" state. */
  maintenanceMode: boolean;
  /** Optional short banner shown on launch. Omitted entirely when unset. */
  messageOfTheDay?: string;
}

/** Semantic default when no override is configured. */
const DEFAULT_VERSION = "1.0.0";

/**
 * Default StoreKit product ids (reverse-DNS, StoreKit 2 convention) covering the
 * three subscription plans the web billing already sells: monthly, annual
 * (monthly-billed), and annual-upfront. Overridable via `IOS_STOREKIT_PRODUCT_IDS`
 * so the list can be rotated (new plan, price experiment) without an app release.
 */
const DEFAULT_STOREKIT_PRODUCT_IDS: readonly string[] = [
  "com.chapterflow.pro.monthly",
  "com.chapterflow.pro.annual",
  "com.chapterflow.pro.annual_upfront",
];

/**
 * Env keys read by the config, all optional. The index signature lets `process.env`
 * (`ProcessEnv`) be passed directly; the named keys document the contract.
 */
export interface IosConfigEnv {
  IOS_MIN_SUPPORTED_VERSION?: string;
  IOS_LATEST_VERSION?: string;
  IOS_FEATURE_FLAGS?: string;
  IOS_STOREKIT_PRODUCT_IDS?: string;
  IOS_MAINTENANCE_MODE?: string;
  IOS_MESSAGE_OF_THE_DAY?: string;
  [key: string]: string | undefined;
}

function cleanVersion(
  raw: string | undefined,
  fallback: string,
): string {
  const v = raw?.trim();
  return v ? v : fallback;
}

function parseBooleanFlag(raw: string | undefined): boolean {
  const v = raw?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

/**
 * Parse `IOS_FEATURE_FLAGS` — a JSON object of `{ flagName: boolean }`. Any
 * malformed JSON, non-object shape, or non-boolean value yields `{}` (fail
 * safe: a bad flag config must never crash the launch endpoint or silently
 * enable a flag). Only boolean-valued entries are kept.
 */
function parseFeatureFlags(raw: string | undefined): Record<string, boolean> {
  const v = raw?.trim();
  if (!v) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(v);
  } catch {
    return {};
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return {};
  }
  const out: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value === "boolean") out[key] = value;
  }
  return out;
}

/**
 * Parse `IOS_STOREKIT_PRODUCT_IDS` — a comma-separated list. Blank/absent falls
 * back to the default plan set; an explicitly-empty override (e.g. `""` with a
 * present key but no ids) also falls back rather than shipping an empty store.
 */
function parseProductIds(raw: string | undefined): string[] {
  const v = raw?.trim();
  if (!v) return [...DEFAULT_STOREKIT_PRODUCT_IDS];
  const ids = v
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return ids.length > 0 ? ids : [...DEFAULT_STOREKIT_PRODUCT_IDS];
}

/**
 * Build the launch-config response body from an env-like record. Total and
 * never-throwing: every field has a safe default so the endpoint always serves
 * a well-formed config even with no env configured.
 */
export function buildIosAppConfig(env: IosConfigEnv): IosAppConfig {
  const config: IosAppConfig = {
    minSupportedVersion: cleanVersion(
      env.IOS_MIN_SUPPORTED_VERSION,
      DEFAULT_VERSION,
    ),
    latestVersion: cleanVersion(env.IOS_LATEST_VERSION, DEFAULT_VERSION),
    featureFlags: parseFeatureFlags(env.IOS_FEATURE_FLAGS),
    storeKitProductIds: parseProductIds(env.IOS_STOREKIT_PRODUCT_IDS),
    maintenanceMode: parseBooleanFlag(env.IOS_MAINTENANCE_MODE),
  };

  const motd = env.IOS_MESSAGE_OF_THE_DAY?.trim();
  if (motd) config.messageOfTheDay = motd;

  return config;
}
