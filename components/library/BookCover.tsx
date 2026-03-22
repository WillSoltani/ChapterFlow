"use client";

import Image from "next/image";

interface BookCoverProps {
  title: string;
  coverGradient: string;
  coverImage?: string;
  className?: string;
  /** Fill the parent container (position absolute inset 0) */
  fill?: boolean;
  /** Fixed dimensions for inline covers (e.g. search dropdown, list item, continue reading) */
  width?: number;
  height?: number;
  /** Border radius override */
  borderRadius?: string | number;
}

/**
 * Renders a book cover image when available, falling back to gradient + title text.
 * Used across all library card components.
 */
export function BookCover({
  title,
  coverGradient,
  coverImage,
  className = "",
  fill = false,
  width,
  height,
  borderRadius,
}: BookCoverProps) {
  if (coverImage) {
    if (fill) {
      return (
        <Image
          src={coverImage}
          alt={title}
          fill
          sizes="(max-width: 768px) 160px, 200px"
          className={`object-cover ${className}`}
          style={{ borderRadius }}
        />
      );
    }
    return (
      <Image
        src={coverImage}
        alt={title}
        width={width ?? 160}
        height={height ?? 240}
        className={`object-cover ${className}`}
        style={{ width, height, borderRadius }}
      />
    );
  }

  // Gradient fallback
  if (fill) {
    return (
      <div
        className={`absolute inset-0 flex items-center justify-center ${className}`}
        style={{ background: coverGradient, borderRadius }}
      >
        <span className="px-3 text-center text-[10px] font-bold uppercase text-white leading-tight">
          {title}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-shrink-0 items-center justify-center ${className}`}
      style={{ width, height, background: coverGradient, borderRadius }}
    >
      <span
        className="px-2 text-center font-bold uppercase text-white leading-tight"
        style={{ fontSize: Math.max(5, Math.min(10, (width ?? 80) / 10)) }}
      >
        {title}
      </span>
    </div>
  );
}
