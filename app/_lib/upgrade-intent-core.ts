import { PRICING_TIER_DISPLAY, UPGRADE_RETURN_PATH, type PricingTierInterval } from "@/lib/pricing";

/**
 * Carries a signed-out visitor's "upgrade" choice on /pricing through sign-up
 * and onboarding, so onboarding can finish on the subscription card with the
 * interval they picked instead of on Home. Session-scoped and short-lived.
 */
export const UPGRADE_INTENT_STORAGE_KEY = "chapterflow:upgrade-intent:v1";
export const UPGRADE_INTENT_MAX_AGE_MS = 60 * 60 * 1000;

type IntentStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function isInterval(value: unknown): value is PricingTierInterval {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(PRICING_TIER_DISPLAY, value);
}

/** The tab's sessionStorage, or null where it is missing or blocked. */
export function sessionStorageOrNull(): IntentStorage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

/** Settings link that opens the subscription card with `interval` selected. */
export function upgradeHrefForInterval(interval: PricingTierInterval): string {
  return `${UPGRADE_RETURN_PATH}&plan=${interval}`;
}

export function saveUpgradeIntent(
  storage: IntentStorage | null | undefined,
  interval: PricingTierInterval,
  now: number,
): void {
  try {
    storage?.setItem(UPGRADE_INTENT_STORAGE_KEY, JSON.stringify({ interval, at: now }));
  } catch {
    // Storage blocked: onboarding simply ends on Home as before.
  }
}

/** Reads and clears the marker; returns the Settings link when it is under an hour old. */
export function takeUpgradeIntentHref(
  storage: IntentStorage | null | undefined,
  now: number,
): string | null {
  if (!storage) return null;
  let raw: string | null = null;
  try {
    raw = storage.getItem(UPGRADE_INTENT_STORAGE_KEY);
    if (raw !== null) storage.removeItem(UPGRADE_INTENT_STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  let marker: unknown;
  try {
    marker = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!marker || typeof marker !== "object") return null;
  const { interval, at } = marker as { interval?: unknown; at?: unknown };
  if (!isInterval(interval)) return null;
  if (typeof at !== "number" || at > now || now - at >= UPGRADE_INTENT_MAX_AGE_MS) return null;
  return upgradeHrefForInterval(interval);
}
