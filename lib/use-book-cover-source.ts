"use client";

import { useMemo, useState } from "react";
import { getBookCoverCandidates } from "@/lib/book-covers";

function isExternalSrc(src: string): boolean {
  return /^https?:\/\//i.test(src);
}

/** next/image custom loader that returns an external source untouched. */
function externalImageLoader({ src }: { src: string }): string {
  return src;
}

// These catalog entries intentionally have no git-tracked raster. Skipping the
// otherwise-useful extension fallback chain prevents several known 404 requests
// (and a blank cover box while they resolve) before the authored title fallback
// appears. Keep this list narrow and remove an id when its AVIF/WebP pair lands.
const FALLBACK_ONLY_BOOK_COVERS = new Set([
  "behave",
  "decisive",
  "multipliers",
  "the-first-90-days",
  "the-now-habit",
]);

/**
 * Keep local cover rasters on Next's default optimizer while preserving the
 * existing passthrough behavior for remote S3 fallbacks. Omitting both props
 * for local sources is intentional: `unoptimized={false}` would work at
 * runtime, but omission makes the optimizer contract explicit at each render.
 */
export function getBookCoverImageProps(src?: string) {
  return src && isExternalSrc(src)
    ? { loader: externalImageLoader, unoptimized: true as const }
    : {};
}

/** Ordered local candidates followed by the optional remote fallback once. */
export function getBookCoverSourceCandidates(bookId: string, coverImage?: string): string[] {
  if (FALLBACK_ONLY_BOOK_COVERS.has(bookId)) return [];
  const local = getBookCoverCandidates(bookId);
  return coverImage && !local.includes(coverImage) ? [...local, coverImage] : local;
}

/**
 * Single source of truth for resolving a book's cover image across the AVIF →
 * WebP local-raster candidate chain (lib/book-covers), with the optional remote
 * (S3) cover URL tried as a LAST resort after local rasters. Walks to the next
 * candidate on each load error; once every candidate fails, `exhausted` is true
 * and the caller renders its own gradient/icon fallback.
 *
 * Shared by both BookCover presentations (app/book/components/BookCover — the
 * standalone hover tile — and components/library/BookCover — the embedded
 * fill/fixed cover) so the resolution logic can never drift again. Previously
 * the two implementations diverged: different candidate ordering and only the
 * library one reset the fallback cursor when an un-keyed instance swapped books.
 */
export function useBookCoverSource(bookId: string, coverImage?: string) {
  const candidates = useMemo(
    () => getBookCoverSourceCandidates(bookId, coverImage),
    [bookId, coverImage],
  );

  const [index, setIndex] = useState(0);
  // Reset the fallback cursor when the candidate set changes (e.g. an un-keyed
  // BookCover swaps to a different book on a dashboard refetch) so a previously
  // exhausted cover doesn't show the wrong candidate / fallback. React's
  // "adjust state during render" pattern (track the key in state) — no ref.
  const key = `${bookId}\u0000${coverImage ?? ""}`;
  const [seenKey, setSeenKey] = useState(key);
  if (seenKey !== key) {
    setSeenKey(key);
    setIndex(0);
  }

  const src = candidates[index] as string | undefined;
  const imageProps = getBookCoverImageProps(src);
  return {
    /** Current candidate URL, or undefined once all candidates are exhausted. */
    src,
    /** True when every candidate has failed — render the fallback. */
    exhausted: index >= candidates.length,
    /** Advance to the next candidate on <Image onError>. */
    onError: () => setIndex((i) => i + 1),
    /** Backward-compatible loader for direct hook consumers. */
    loader: imageProps.loader,
    /** Props that bypass optimization only for an external fallback. */
    imageProps,
  };
}
