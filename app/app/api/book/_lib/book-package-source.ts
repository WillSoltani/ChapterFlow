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

// Module-level caches survive across invocations on a warm Lambda. Packages are
// immutable within a deploy, so an unbounded cache is safe and bounded by the
// catalog size. Raw is cached by bookId (tone-agnostic); `null` is a negative
// cache so a missing package isn't re-fetched every call. Normalized packages are
// cached per (bookId, tone) since the legacy v13 path is tone-sensitive (v21 is
// tone-invariant, so this collapses to one entry per book in practice).
const rawCache = new Map<string, unknown | null>();
const normalizedCache = new Map<string, BookPackage>();

async function loadRawPackage(bookId: string): Promise<unknown | null> {
  if (rawCache.has(bookId)) return rawCache.get(bookId) ?? null;
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
  rawCache.set(bookId, raw);
  return raw;
}

/**
 * Server-side equivalent of getBookPackageByIdForTone, sourced from S3.
 * Returns undefined when no authored package exists for the book.
 */
export async function getServerBookPackage(
  bookId: string,
  tone: ToneKey = "direct",
): Promise<BookPackage | undefined> {
  const cacheKey = `${bookId}::${tone}`;
  const cached = normalizedCache.get(cacheKey);
  if (cached) return cached;
  const raw = await loadRawPackage(bookId);
  if (raw == null) return undefined;
  const pkg = normalizeAnyPackage(raw, tone);
  normalizedCache.set(cacheKey, pkg);
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
