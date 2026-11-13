/**
 * Which signed-in account the browser's stored ChapterFlow data belongs to
 * (DATA-01 / ACCT-05).
 *
 * Hooks cache personal data in localStorage under unscoped keys (mostly the
 * `book-accelerator:` prefix), so on a shared browser the next account used to
 * hydrate from, and then save, the previous account's notes, profile, progress
 * and preferences. This module records the owner beside the data and wipes the
 * personal keys whenever the signed-in account differs, and on logout.
 *
 * The owner is the `cf_data_owner` cookie: a JS-readable, opaque one-way
 * digest of the signed-in account, written by the sign-in callback and the
 * silent refresh and removed on sign-out. It is the same for every sign-in of
 * one account, so re-authenticating (billing step-up, an expired refresh token)
 * keeps that account's device-only data (quiz drafts, practice checks, local
 * takeaways); it differs for every other account, which triggers the wipe. A
 * missing owner (signed out, or a session from before this cookie existed)
 * changes nothing, and stored data that has no owner record yet is claimed,
 * not wiped (see reconcileLocalUserDataOwner). It is a storage scope only,
 * never identity.
 *
 * Kept (device-level, not personal): everything not matched below, notably
 * `cf:auth-generation` (the cross-tab cache wake-up signal). The theme is NOT
 * kept: it is stored inside the personal `book-accelerator:preferences:v2`
 * record, and leaving even a partial record makes the preferences hook treat it
 * as this device's saved settings and write it into the new account. The new
 * account's own theme comes back with its server settings.
 */
import {
  LOCAL_DATA_OWNER_COOKIE,
  normalizeLocalDataOwner,
  readCookieValue,
} from "@/lib/auth-cache-generation";

export const LOCAL_USER_DATA_OWNER_KEY = "cf:local-data-owner";

const PERSONAL_PREFIXES = [
  "book-accelerator:",
  "quiz-draft:",
  "cf-impl-checks-",
  "celebrated_",
  "badge_dismissed_",
  "ask-book-chat:",
] as const;

const PERSONAL_KEYS = new Set<string>([
  "chapterflow_onboarding",
  "cf:badge-showcase-v1",
  "cf:badges-last-seen",
  "cf-reader-loop-coachmark-seen:v1",
  "cf:billing-upgraded",
]);

export type StorageLike = {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export function isPersonalStorageKey(key: string): boolean {
  if (PERSONAL_KEYS.has(key)) return true;
  return PERSONAL_PREFIXES.some((prefix) => key.startsWith(prefix));
}

export function clearPersonalStorage(
  storages: readonly StorageLike[],
  options: { forgetOwner?: boolean } = {},
): void {
  for (const storage of storages) {
    const doomed: string[] = [];
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (key !== null && isPersonalStorageKey(key)) doomed.push(key);
    }
    for (const key of doomed) storage.removeItem(key);
    if (options.forgetOwner) storage.removeItem(LOCAL_USER_DATA_OWNER_KEY);
  }
}

export type OwnerReconcileResult = "unknown" | "same" | "claimed" | "cleared";

/**
 * Compare each storage's recorded owner with the current one (localStorage and
 * this tab's sessionStorage are checked separately, since another tab may have
 * already re-owned localStorage). A different recorded owner wipes that
 * storage's personal keys. Data with no owner record predates this check: it is
 * kept and claimed by the first account seen, because wiping it would destroy
 * every existing reader's device-only data (quiz drafts, notes not yet synced)
 * once when this ships. The cost is that, on a shared browser, data left from
 * before this check is seen one more time by the next account. An unknown
 * current account changes nothing.
 */
export function reconcileLocalUserDataOwner(
  storages: readonly StorageLike[],
  currentOwner: string | null,
): OwnerReconcileResult {
  if (!currentOwner) return "unknown";
  let result: OwnerReconcileResult = "same";
  for (const storage of storages) {
    const recorded = storage.getItem(LOCAL_USER_DATA_OWNER_KEY);
    if (recorded === currentOwner) continue;
    if (recorded === null) {
      storage.setItem(LOCAL_USER_DATA_OWNER_KEY, currentOwner);
      if (result === "same") result = "claimed";
      continue;
    }
    clearPersonalStorage([storage]);
    storage.setItem(LOCAL_USER_DATA_OWNER_KEY, currentOwner);
    result = "cleared";
  }
  return result;
}

export function ownerFromCookieHeader(cookieHeader: string): string | null {
  return normalizeLocalDataOwner(readCookieValue(cookieHeader, LOCAL_DATA_OWNER_COOKIE));
}

function browserStorages(): { local: StorageLike; session: StorageLike } | null {
  if (typeof window === "undefined") return null;
  try {
    return { local: window.localStorage, session: window.sessionStorage };
  } catch {
    return null; // storage disabled (privacy mode / blocked site data)
  }
}

/**
 * Browser entry point. Synchronous on purpose: call it before any component
 * hydrates from storage (components/auth/AuthCacheBoundary.tsx renders ahead of
 * the whole app in the root layout and calls it during render).
 */
export function ensureLocalUserDataOwner(): OwnerReconcileResult {
  const storages = browserStorages();
  if (!storages) return "unknown";
  try {
    return reconcileLocalUserDataOwner(
      [storages.local, storages.session],
      ownerFromCookieHeader(document.cookie),
    );
  } catch {
    return "unknown";
  }
}

/** Sign-out: forget every personal key and the owner record. */
export function clearLocalUserData(): void {
  const storages = browserStorages();
  if (!storages) return;
  try {
    clearPersonalStorage([storages.local, storages.session], { forgetOwner: true });
  } catch {
    // Best effort; the next sign-in's owner check clears it anyway.
  }
}
