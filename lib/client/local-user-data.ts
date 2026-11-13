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
 * The owner is the auth cache generation (`cf_auth_generation`, a JS-readable
 * opaque UUID). It rotates on every sign-in, sign-out and account deletion and
 * is preserved across silent refreshes, so it changes exactly when the account
 * in this browser may have changed. It is never treated as identity, only as a
 * cache scope. Cost: signing in again (even as the same account) starts from an
 * empty local cache; every cleared key is a cache of server state that the
 * hooks re-read.
 *
 * Kept (device-level, not personal): everything not matched below, notably
 * `cf:auth-generation` (the cross-tab cache wake-up signal). The theme is NOT
 * kept: it is stored inside the personal `book-accelerator:preferences:v2`
 * record, and leaving even a partial record makes the preferences hook treat it
 * as this device's saved settings and write it into the new account. The new
 * account's own theme comes back with its server settings.
 */
import {
  AUTH_CACHE_GENERATION_COOKIE,
  normalizeAuthCacheGeneration,
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
 * already re-owned localStorage). A different or missing owner wipes that
 * storage's personal keys; data without an owner record predates this check and
 * cannot be attributed. An unknown current account changes nothing.
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
    let hadPersonal = false;
    for (let i = 0; i < storage.length && !hadPersonal; i += 1) {
      const key = storage.key(i);
      if (key !== null && isPersonalStorageKey(key)) hadPersonal = true;
    }
    clearPersonalStorage([storage]);
    storage.setItem(LOCAL_USER_DATA_OWNER_KEY, currentOwner);
    if (recorded !== null || hadPersonal) result = "cleared";
    else if (result === "same") result = "claimed";
  }
  return result;
}

export function ownerFromCookieHeader(cookieHeader: string): string | null {
  return normalizeAuthCacheGeneration(
    readCookieValue(cookieHeader, AUTH_CACHE_GENERATION_COOKIE),
  );
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
