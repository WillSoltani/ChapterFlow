"use client";

import { useState } from "react";
import type { OnboardingBook } from "@/app/onboarding/data/books";
import { getBookCoverPath } from "@/app/onboarding/data/books";

interface StarterShelfBookCoverProps {
  book: OnboardingBook;
  width: number;
  height: number;
  radius?: number;
  showTitle?: boolean;
  titleSize?: number;
}

export function StarterShelfBookCover({
  book,
  width,
  height,
  radius = 14,
  showTitle = true,
  titleSize = 15,
}: StarterShelfBookCoverProps) {
  const coverPath = getBookCoverPath(book.id);
  const [imgFailed, setImgFailed] = useState(false);
  const showImg = coverPath && !imgFailed;

  return (
    <div
      style={{
        width,
        height,
        borderRadius: radius,
        background: book.gradient,
        boxShadow: "var(--cf-shadow-lg)",
        overflow: "hidden",
        position: "relative",
        flexShrink: 0,
      }}
    >
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={coverPath}
          alt={book.title}
          draggable={false}
          onError={() => setImgFailed(true)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
            pointerEvents: "none",
            userSelect: "none",
          }}
        />
      ) : showTitle ? (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 12,
          }}
        >
          <span
            style={{
              color: "white",
              fontSize: titleSize,
              fontWeight: 700,
              textAlign: "center",
              lineHeight: 1.25,
              maxWidth: width - 24,
              textShadow: "0 1px 4px color-mix(in srgb, black 50%, transparent)",
            }}
          >
            {book.title}
          </span>
        </div>
      ) : null}
    </div>
  );
}
