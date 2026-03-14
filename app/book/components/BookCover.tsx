"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { getBookCoverCandidates } from "@/app/book/data/booksCatalog";

type BookCoverProps = {
  bookId: string;
  title: string;
  icon: string;
  coverImage?: string;
  className?: string;
  imageClassName?: string;
  fallbackClassName?: string;
  sizes?: string;
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
}: BookCoverProps) {
  const candidates = useMemo(
    () => getBookCoverCandidates({ id: bookId, coverImage }),
    [bookId, coverImage]
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const src = candidates[activeIndex];

  return (
    <div
      className={[
        "relative overflow-hidden",
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
          className={[
            "object-contain bg-white",
            imageClassName,
          ]
            .filter(Boolean)
            .join(" ")}
          onError={() => {
            setActiveIndex((prev) => {
              if (prev + 1 >= candidates.length) {
                return candidates.length;
              }
              return prev + 1;
            });
          }}
          unoptimized
        />
      ) : null}

      {(!src || activeIndex >= candidates.length) ? (
        <span
          className={[
            "absolute inset-0 flex items-center justify-center",
            fallbackClassName,
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {icon}
        </span>
      ) : null}
    </div>
  );
}
