"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

function getBookCoverCandidates(bookId: string, coverImage?: string): string[] {
  const localCandidates = [
    `/book-covers/${bookId}.svg`,
    `/book-covers/${bookId}.jpg`,
    `/book-covers/${bookId}.jpeg`,
    `/book-covers/${bookId}.png`,
    `/book-covers/${bookId}.webp`,
    `/book-covers/${bookId}.avif`,
  ];

  if (!coverImage) return localCandidates;
  if (localCandidates.includes(coverImage)) {
    return [coverImage, ...localCandidates.filter((c) => c !== coverImage)];
  }
  return [coverImage, ...localCandidates];
}

function isExternalSrc(src: string): boolean {
  return /^https?:\/\//i.test(src);
}

function externalImageLoader({ src }: { src: string }): string {
  return src;
}

type BookCoverProps = {
  bookId: string;
  title: string;
  icon: string;
  coverImage?: string;
  className?: string;
  imageClassName?: string;
  fallbackClassName?: string;
  sizes?: string;
  interactive?: boolean;
};

export function BookCover({
  bookId,
  title,
  icon,
  coverImage,
  className,
  imageClassName,
  fallbackClassName,
  sizes = "120px",
  interactive = true,
}: BookCoverProps) {
  const candidates = useMemo(
    () => getBookCoverCandidates(bookId, coverImage),
    [bookId, coverImage]
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const src = candidates[activeIndex];
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
          alt={`${title} cover`}
          fill
          sizes={sizes}
          loading="lazy"
          className={imageClasses}
          onError={() => {
            setActiveIndex((prev) => {
              if (prev + 1 >= candidates.length) {
                return candidates.length;
              }
              return prev + 1;
            });
          }}
          loader={isExternalSrc(src) ? externalImageLoader : undefined}
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

      {(!src || activeIndex >= candidates.length) ? (
        <span
          className={[
            "absolute inset-0 flex flex-col items-center justify-center gap-2 bg-linear-to-br from-(--cf-surface-strong) to-(--cf-surface-muted) px-2 text-center",
            fallbackClassName,
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <span className="text-3xl leading-none">{icon}</span>
          <span className="line-clamp-3 text-xs font-semibold leading-tight text-(--cf-text-2)">
            {title}
          </span>
        </span>
      ) : null}
    </div>
  );
}
