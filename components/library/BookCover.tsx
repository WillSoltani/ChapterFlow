"use client";

import Image from "next/image";
import { useBookCoverSource } from "@/lib/use-book-cover-source";

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

/**
 * Renders a real book cover raster through next/image via the shared
 * useBookCoverSource resolver (AVIF→WebP local rasters, then the remote S3 URL
 * as a last resort; `unoptimized` keeps every source out of /_next/image, which
 * 400s on these). Only when every source fails do we show the gradient + title
 * fallback. The image is decorative (alt="") because every caller renders the
 * book title as adjacent text. This is the embedded (fill / fixed-size) cover;
 * the standalone hover tile lives at app/book/components/BookCover.
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
  const { src, onError, loader } = useBookCoverSource(bookId, coverImage);
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
      onError={onError}
      loader={loader}
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
