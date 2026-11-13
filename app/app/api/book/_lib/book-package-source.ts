import "server-only";

import { normalizeAnyPackage, isStrictReaderSchema } from "@/app/book/data/book-package-core";
import type { BookPackage, ToneKey } from "@/app/book/data/book-package-core";
import { readJsonFromS3 } from "./storage";
import { getBookContentBucket } from "./env";
import { BookApiError } from "./errors";

/**
 * Server-side source for the authored book package (formerly the ~37 MB of
 * v21 JSON statically imported by app/book/data/bookPackages.ts).
 *
 * Quiz/audio/ask read the authored package as their PRIMARY content source
 * ("prefer local over stale S3"). Statically bundling all ~105 packages into the
 * single OpenNext ServerFn pushed its unzipped code past Lambda's hard 250 MiB
 * limit and broke prod deploys. This module fetches the SAME raw package JSON
 * from S3 on demand (uploaded to `book-content/packages/<bookId>.v21.json` by
 * scripts/book/upload-book-packages-to-s3.ts) and normalizes it through the
 * shared (JSON-free) transform core — so the data is byte-identical to the old
 * bundle, just no longer baked into the Lambda. The client keeps its static
 * import (separate bundle, not subject to the Lambda limit).
 */

function packageKey(bookId: string): string {
  return `book-content/packages/${bookId}.v21.json`;
}

// Expiring cache for the packages read from S3 (API-15). A republish overwrites
// a package in place without a deploy, so a warm server must pick the new copy
// up within a few minutes; a missing package is remembered only briefly. The
// clock is injected so the cache can be unit tested.

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

// Module-level caches survive across invocations on a warm Lambda. A runtime
// republish overwrites a package in S3 without a deploy, so a package is reused
// for 5 minutes and a missing one for 60 seconds (API-15). Raw is cached by
// bookId (tone-agnostic). Normalized packages are cached per tone on the raw
// object they came from, so they are dropped together with it (the legacy v13
// path is tone-sensitive; v21 collapses to one entry per book in practice).
const rawCache = createExpiringPackageCache<unknown>();
const normalizedByRaw = new WeakMap<object, Map<ToneKey, BookPackage>>();

async function loadRawPackage(bookId: string): Promise<unknown | null> {
  const cached = rawCache.get(bookId);
  if (cached.hit) return cached.value;
  const bucket = await getBookContentBucket();
  let raw: unknown | null;
  try {
    raw = await readJsonFromS3<unknown>(bucket, packageKey(bookId));
  } catch (error) {
    // A missing package is NOT an error here: it means the book has no authored
    // package in S3, matching the old `getBookPackageById(...) === undefined`.
    // Quiz then falls back to published S3 content; ask/audio 404 (unchanged).
    if (error instanceof BookApiError && error.status === 404) {
      rawCache.set(bookId, null);
      return null;
    }
    // Transient/other S3 errors: do NOT poison the cache — let the next call retry.
    throw error;
  }
  rawCache.set(bookId, raw ?? null);
  return raw ?? null;
}

/**
 * Server-side equivalent of getBookPackageByIdForTone, sourced from S3.
 * Returns undefined when no authored package exists for the book.
 */
export async function getServerBookPackage(
  bookId: string,
  tone: ToneKey = "direct",
): Promise<BookPackage | undefined> {
  const raw = await loadRawPackage(bookId);
  if (raw == null) return undefined;
  if (typeof raw !== "object") return normalizeAnyPackage(raw, tone);
  let byTone = normalizedByRaw.get(raw);
  if (!byTone) {
    byTone = new Map();
    normalizedByRaw.set(raw, byTone);
  }
  const cached = byTone.get(tone);
  if (cached) return cached;
  const pkg = normalizeAnyPackage(raw, tone);
  byTone.set(tone, pkg);
  return pkg;
}

/**
 * True when the book uses a strict-reader schema (v12/v21) — drives the quiz
 * question-count table. Mirrors the old isLocalV12Package(bookId): false when the
 * book has no authored package.
 */
export async function isServerStrictReaderPackage(bookId: string): Promise<boolean> {
  return isStrictReaderSchema(await getServerBookPackage(bookId));
}
