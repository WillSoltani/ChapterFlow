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
    () => getBookCoverCandidates({ id: bookId, coverImage }),
    [bookId, coverImage]
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const src = candidates[activeIndex];

  return (
    <div
      className={[
        "relative overflow-hidden transition duration-300 ease-out",
        interactive ? "motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-lg" : "",
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
            "object-contain bg-white transition-transform duration-500 ease-out",
            interactive ? "motion-safe:hover:scale-[1.045]" : "",
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

      {interactive ? (
        <>
          <span
            className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[linear-gradient(125deg,rgba(255,255,255,0)_15%,rgba(255,255,255,0.24)_50%,rgba(255,255,255,0)_80%)] opacity-0 transition duration-500 ease-out motion-safe:hover:opacity-100"
            aria-hidden="true"
          />
          <span
            className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-white/0 transition duration-300 ease-out motion-safe:hover:ring-white/45"
            aria-hidden="true"
          />
        </>
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
