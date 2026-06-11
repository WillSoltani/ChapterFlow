"use client";

import Image from "next/image";
import { useMemo, useRef, useState } from "react";
import { getBookCoverCandidates } from "@/lib/book-covers";

interface BookCoverProps {
  /** Canonical bookId — drives the local raster candidate chain. */
  bookId: string;
  title: string;
  coverGradient: string;
  /** Optional remote (S3) cover URL, tried as a last resort after local rasters. */
  coverImage?: string;
  className?: string;
  /** Fill the parent container (position absolute inset 0). Parent must be positioned. */
  fill?: boolean;
  /** Fixed dimensions for inline covers (search dropdown, list item, continue reading). */
  width?: number;
  height?: number;
  /** Border radius override (fixed-size mode). */
  borderRadius?: string | number;
  /** Responsive `sizes` hint for next/image. */
  sizes?: string;
}

function isExternalSrc(src: string): boolean {
  return /^https?:\/\//i.test(src);
}

/** next/image custom loader that returns the src untouched (no optimizer). */
function externalImageLoader({ src }: { src: string }): string {
  return src;
}

/**
 * Renders a real book cover raster through next/image, walking an AVIF-first /
 * WebP-fallback candidate chain (lib/book-covers) on error, plus the remote S3
 * URL as a final source. `unoptimized` keeps every source out of /_next/image
 * (which 400s on these). Only when every source fails do we show the
 * gradient + title fallback. The image is decorative (alt="") because every
 * caller renders the book title as adjacent text.
 */
export function BookCover({
  bookId,
  title,
  coverGradient,
  coverImage,
  className = "",
  fill = false,
  width,
  height,
  borderRadius,
  sizes,
}: BookCoverProps) {
  const candidates = useMemo(() => {
    const local = getBookCoverCandidates(bookId);
    return coverImage && !local.includes(coverImage) ? [...local, coverImage] : local;
  }, [bookId, coverImage]);

  const [index, setIndex] = useState(0);
  // Reset the fallback cursor when the source set changes (e.g. an un-keyed
  // BookCover instance swaps to a different book on a dashboard refetch) so a
  // previously-exhausted cover doesn't show the wrong candidate / gradient.
  const prevCandidates = useRef(candidates);
  if (prevCandidates.current !== candidates) {
    prevCandidates.current = candidates;
    if (index !== 0) setIndex(0);
  }
  const src = candidates[index];
  const resolvedSizes = sizes ?? (fill ? "(max-width: 768px) 40vw, 200px" : `${width ?? 160}px`);

  const imageEl = src ? (
    <Image
      key={src}
      src={src}
      alt=""
      fill
      sizes={resolvedSizes}
      loading="lazy"
      className={`object-cover ${className}`}
      onError={() => setIndex((i) => i + 1)}
      loader={isExternalSrc(src) ? externalImageLoader : undefined}
      unoptimized
    />
  ) : null;

  const fallbackEl = !src ? (
    <span
      className="absolute inset-0 flex items-center justify-center px-3 text-center"
      style={{ background: coverGradient, borderRadius }}
      aria-hidden="true"
    >
      <span className="line-clamp-3 text-[12px] font-semibold leading-tight text-white">
        {title}
      </span>
    </span>
  ) : null;

  // Fill mode: positioned to the caller's relative box (BookCard / CompletedShelf).
  if (fill) {
    return (
      <>
        {imageEl}
        {fallbackEl}
      </>
    );
  }

  // Fixed-size mode: own a positioned, sized box for inline covers.
  return (
    <div
      className="relative overflow-hidden"
      style={{ width: width ?? 160, height: height ?? 240, borderRadius }}
    >
      {imageEl}
      {fallbackEl}
    </div>
  );
}
