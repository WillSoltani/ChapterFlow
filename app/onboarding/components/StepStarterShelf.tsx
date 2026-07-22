"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useStarterShelfSelection } from "@/app/onboarding/hooks/useStarterShelfSelection";
import { MAX_STARTER_SHELF_PICKS } from "@/app/onboarding/hooks/starter-shelf-selection-core";
import { MicroCelebration } from "@/app/book/settings/components/MicroCelebration";
import { DUR } from "@/lib/motion";
import { PRICING } from "@/lib/pricing";
import { StarterShelfComplete } from "./StarterShelfComplete";
import { StarterShelfDeck } from "./StarterShelfDeck";
import { StarterShelfSelectionSlots } from "./StarterShelfSelectionSlots";

interface StepStarterShelfProps {
  onNext: () => void;
}

export default function StepStarterShelf({ onNext }: StepStarterShelfProps) {
  const router = useRouter();
  const {
    backBooks,
    buttonSwipeRef,
    celebEvent,
    currentIndex,
    deck,
    deckEmpty,
    fillerPicks,
    frontBook,
    handleComplete,
    handleContinueWithPicks,
    handleSwipe,
    isComplete,
    likeCount,
    reducedMotion,
    selectedBooks,
    selectedCount,
  } = useStarterShelfSelection({ onNext });

  if (isComplete) {
    return <StarterShelfComplete books={selectedBooks} onDone={handleComplete} />;
  }

  return (
    <div
      style={{ width: "100%", maxWidth: 480, margin: "0 auto", padding: "0 20px" }}
      role="region"
      aria-label="Book selection - swipe or use buttons to choose books"
    >
      <MicroCelebration
        key={likeCount}
        event={celebEvent}
        reducedMotion={!!reducedMotion}
      />

      <h2
        style={{
          fontFamily: "var(--font-display, sans-serif)",
          fontSize: "clamp(24px, 5vw, 32px)",
          fontWeight: 600,
          color: "var(--cf-text-1)",
          textAlign: "center",
          marginBottom: 8,
        }}
      >
        Your starter shelf
      </h2>
      <p
        style={{
          fontFamily: "var(--font-body, sans-serif)",
          fontSize: 16,
          color: "var(--cf-text-3)",
          textAlign: "center",
          marginBottom: 16,
          lineHeight: 1.5,
        }}
      >
        Swipe right on books you want. Pick 3.
      </p>

      <p
        style={{
          fontFamily: "var(--font-body, sans-serif)",
          fontSize: 14,
          color:
            selectedCount === 0
              ? "var(--cf-text-soft)"
              : selectedCount >= MAX_STARTER_SHELF_PICKS
                ? "var(--accent-cyan)"
                : "var(--accent-cyan)",
          textAlign: "center",
          marginBottom: 8,
          transition: "color 200ms ease",
        }}
      >
        {selectedCount} of {MAX_STARTER_SHELF_PICKS} selected
      </p>

      <div className="flex items-center justify-center gap-3" style={{ marginBottom: 24 }}>
        {Array.from({ length: MAX_STARTER_SHELF_PICKS }, (_, index) => {
          const filled = index < selectedCount;
          return (
            <motion.div
              key={index}
              initial={false}
              animate={{
                scale: filled ? 1.2 : 1,
                backgroundColor: filled ? "var(--accent-cyan)" : "transparent",
              }}
              transition={
                reducedMotion
                  ? { duration: 0 }
                  : { duration: DUR.normal, ease: "easeOut" }
              }
              style={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                border: filled ? "none" : "2px solid var(--cf-border-strong)",
              }}
            />
          );
        })}
      </div>

      <StarterShelfDeck
        backBooks={backBooks}
        buttonSwipeRef={buttonSwipeRef}
        deckEmpty={deckEmpty}
        fillerPicks={fillerPicks}
        frontBook={frontBook ?? null}
        onContinueWithPicks={handleContinueWithPicks}
        onSwipe={handleSwipe}
        reducedMotion={reducedMotion}
        selectedCount={selectedCount}
      />

      <StarterShelfSelectionSlots
        books={selectedBooks}
        reducedMotion={reducedMotion}
      />

      <p
        style={{
          fontFamily: "var(--font-body, sans-serif)",
          fontSize: 13,
          color: "var(--cf-text-soft)",
          textAlign: "center",
          marginTop: 20,
          lineHeight: 1.5,
        }}
      >
        Your {PRICING.freeBookLimit} free books are included.{" "}
        <button
          type="button"
          onClick={() => router.push("/pricing")}
          className="cursor-pointer bg-transparent underline underline-offset-2 transition-colors hover:text-(--cf-text-3)"
          style={{ color: "inherit", font: "inherit", border: "none", padding: 0 }}
        >
          Add more with Pro.
        </button>
      </p>

      <div className="sr-only" aria-live="polite" role="status">
        {frontBook &&
          `Book ${currentIndex + 1} of ${deck.length}: ${frontBook.title} by ${frontBook.author}. ${frontBook.category}, ${frontBook.difficulty} difficulty, approximately ${frontBook.estimatedHours} hours.`}
      </div>
    </div>
  );
}
