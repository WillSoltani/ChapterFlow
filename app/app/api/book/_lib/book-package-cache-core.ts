/**
 * Expiring cache for the authored book packages read from S3 (API-15).
 * A republish overwrites the package in place without a deploy, so a warm
 * server must pick the new copy up within a few minutes; a missing package is
 * remembered only briefly. Pure (clock injected) so it can be unit tested.
 */

/** A package found in S3 is reused for 5 minutes. */
export const BOOK_PACKAGE_TTL_MS = 5 * 60 * 1000;
/** A package missing from S3 is remembered for 60 seconds. */
export const BOOK_PACKAGE_MISSING_TTL_MS = 60 * 1000;

export type CacheLookup<T> = { hit: true; value: T | null } | { hit: false };

export interface ExpiringPackageCache<T> {
  get(key: string): CacheLookup<T>;
  set(key: string, value: T | null): void;
}

export function createExpiringPackageCache<T>(opts: {
  ttlMs?: number;
  missingTtlMs?: number;
  now?: () => number;
} = {}): ExpiringPackageCache<T> {
  const ttlMs = opts.ttlMs ?? BOOK_PACKAGE_TTL_MS;
  const missingTtlMs = opts.missingTtlMs ?? BOOK_PACKAGE_MISSING_TTL_MS;
  const now = opts.now ?? (() => Date.now());
  const entries = new Map<string, { value: T | null; expiresAt: number }>();

  return {
    get(key) {
      const entry = entries.get(key);
      if (!entry) return { hit: false };
      if (now() >= entry.expiresAt) {
        entries.delete(key);
        return { hit: false };
      }
      return { hit: true, value: entry.value };
    },
    set(key, value) {
      entries.set(key, {
        value,
        expiresAt: now() + (value === null ? missingTtlMs : ttlMs),
      });
    },
  };
}
