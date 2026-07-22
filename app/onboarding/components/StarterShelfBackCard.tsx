import type { OnboardingBook } from "@/app/onboarding/data/books";
import { getBookCoverPath } from "@/app/onboarding/data/books";

interface StarterShelfBackCardProps {
  book: OnboardingBook;
}

export function StarterShelfBackCard({ book }: StarterShelfBackCardProps) {
  const coverPath = getBookCoverPath(book.id);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        borderRadius: 24,
        background: "var(--cf-surface)",
        border: "1px solid var(--cf-border)",
        boxShadow: "var(--cf-shadow-md)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {coverPath ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={coverPath}
          alt=""
          draggable={false}
          style={{
            width: 60,
            height: 85,
            objectFit: "cover",
            borderRadius: 8,
            opacity: 0.35,
            pointerEvents: "none",
            userSelect: "none",
          }}
        />
      ) : (
        <div
          style={{
            width: 60,
            height: 85,
            borderRadius: 8,
            background: book.gradient,
            opacity: 0.25,
          }}
        />
      )}
    </div>
  );
}
