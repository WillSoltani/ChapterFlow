"use client";

import Image from "next/image";
import { useBookCoverSource } from "@/lib/use-book-cover-source";

interface BookCoverProps {
  // --- shared / required ---
  /** Canonical bookId — drives the local raster candidate chain. */
  bookId: string;
  /** Rendered in BOTH fallbacks as adjacent decorative text. */
  title: string;
  /** Optional remote (S3) cover URL, tried as a last resort after local rasters. */
  coverImage?: string;
  /** SEE per-mode routing below — target differs by mode. */
  className?: string;
  /** Responsive `sizes` hint for next/image. */
  sizes?: string;

  // --- fallback mode selectors (mutually-exclusive data sources) ---
  /** library variant: gradient bg + white title fallback. */
  coverGradient?: string;
  /** app/book variant: emoji glyph + title fallback. */
  icon?: string;

  // --- library (embedded fill / fixed-size) variant ---
  /** Render bare <Image>+fallback fragment, NO own wrapper (parent positioned). */
  fill?: boolean;
  /** Fixed-size mode: own a positioned sized box (default 160). */
  width?: number;
  /** Fixed-size mode (default 240). */
  height?: number;
  /** Fixed-size box + gradient fallback radius. */
  borderRadius?: string | number;

  // --- app/book (standalone tile) variant ---
  /** Extra classes merged onto the <Image>. */
  imageClassName?: string;
  /** Extra classes merged onto the fallback <span>. */
  fallbackClassName?: string;
  /** Default true: aspect-2/3 wrapper + hover lift/sheen/ring. */
  interactive?: boolean;
}

/**
 * Canonical book cover. Renders a real cover raster through next/image via the
 * shared useBookCoverSource resolver (AVIF→WebP local rasters, then the remote
 * S3 URL as a last resort; `unoptimized` keeps every source out of /_next/image,
 * which 400s on these). Only when every candidate fails do we show the fallback.
 * The image is decorative (alt="") because every caller renders the book title
 * as adjacent text.
 *
 * Three modes, dispatched from which props are present so every existing call
 * site keeps working untouched:
 *   - `fill` -> bare <Image>+fallback fragment (no wrapper); the parent owns a
 *     positioned box. (library embedded fill cover)
 *   - `width`/`height`/`borderRadius` present -> own a positioned, sized box.
 *     (library inline fixed-size cover)
 *   - otherwise -> standalone aspect-2/3 tile with optional interactive hover.
 *     (app/book hover tile)
 *
 * Fallback content is gradient+white-title when `coverGradient` is set (library
 * data), else the icon-emoji + title (app/book data). The two consumer data
 * sources are disjoint, so this never has to render both.
 *
 * `className` routing differs by mode and must NOT be flattened: in fill/fixed
 * modes it merges onto the <Image> (library semantics); in tile mode it sits on
 * the wrapper, with `imageClassName` on the image and `fallbackClassName` on the
 * fallback span (app/book semantics).
 */
export function BookCover({
  bookId,
  title,
  coverImage,
  className,
  sizes,
  coverGradient,
  icon,
  fill = false,
  width,
  height,
  borderRadius,
  imageClassName,
  fallbackClassName,
  interactive = true,
}: BookCoverProps) {
  const { src, exhausted, onError, loader } = useBookCoverSource(bookId, coverImage);
  const showFallback = !src || exhausted;
  const isEmbedded = fill || width !== undefined || height !== undefined || borderRadius !== undefined;

  // Fallback content: gradient (library) when coverGradient is set, else icon (app/book).
  const gradientFallback = (className: string) => (
    <span
      className={className}
      style={{ background: coverGradient, borderRadius }}
      aria-hidden="true"
    >
      <span className="line-clamp-3 hyphens-auto break-words text-[12px] font-semibold leading-tight text-white">
        {title}
      </span>
    </span>
  );

  // --- Embedded (library) modes: fill fragment + fixed-size self-box. ---
  if (isEmbedded) {
    const resolvedSizes = sizes ?? (fill ? "(max-width: 768px) 40vw, 200px" : `${width ?? 160}px`);

    const imageEl = src ? (
      <Image
        key={src}
        src={src}
        alt=""
        fill
        sizes={resolvedSizes}
        loading="lazy"
        className={`object-cover ${className ?? ""}`}
        onError={onError}
        loader={loader}
        unoptimized
      />
    ) : null;

    const fallbackEl = showFallback
      ? gradientFallback("absolute inset-0 flex items-center justify-center px-2 text-center")
      : null;

    // Fill mode: positioned to the caller's relative box (BookCard / CompletedShelf / ActiveReads).
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

  // --- Standalone tile (app/book) mode. ---
  const tileSizes = sizes ?? "120px";
  const imageClasses = [
    "object-cover bg-(--cf-surface) transition-transform duration-500 ease-out",
    interactive ? "motion-safe:hover:scale-[1.045]" : "",
    imageClassName,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={[
        "relative aspect-2/3 overflow-hidden rounded-sm shadow-shadow-book transition duration-300 ease-out",
        interactive ? "motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-shadow-elevated" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-hidden="true"
    >
      {src ? (
        <Image
          key={src}
          src={src}
          alt=""
          fill
          sizes={tileSizes}
          loading="lazy"
          className={imageClasses}
          onError={onError}
          loader={loader}
          unoptimized
        />
      ) : null}

      {interactive ? (
        <>
          <span
            className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[linear-gradient(125deg,transparent_15%,var(--cf-surface-strong)_50%,transparent_80%)] opacity-0 transition duration-500 ease-out motion-safe:hover:opacity-100"
            aria-hidden="true"
          />
          <span
            className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-transparent transition duration-300 ease-out motion-safe:hover:ring-(--cf-border-strong)"
            aria-hidden="true"
          />
        </>
      ) : null}

      {showFallback ? (
        coverGradient !== undefined ? (
          gradientFallback(
            [
              "absolute inset-0 flex items-center justify-center px-2 text-center",
              fallbackClassName,
            ]
              .filter(Boolean)
              .join(" "),
          )
        ) : (
          <span
            className={[
              "absolute inset-0 flex flex-col items-center justify-center gap-2 bg-linear-to-br from-(--cf-surface-strong) to-(--cf-surface-muted) px-2 text-center",
              fallbackClassName,
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <span className="text-3xl leading-none">{icon}</span>
            <span className="line-clamp-3 hyphens-auto break-words text-xs font-semibold leading-tight text-(--cf-text-2)">
              {title}
            </span>
          </span>
        )
      ) : null}
    </div>
  );
}
