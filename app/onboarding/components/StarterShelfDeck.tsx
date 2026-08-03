"use client";

import type { MutableRefObject } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Heart, X } from "lucide-react";
import type { OnboardingBook } from "@/app/onboarding/data/books";
import type { StarterShelfSwipeDirection } from "@/app/onboarding/hooks/starter-shelf-selection-core";
import { DUR, EASE } from "@/lib/motion";
import { Button } from "@/components/ui/button";
import { StarterShelfBackCard } from "./StarterShelfBackCard";
import { StarterShelfBookCover } from "./StarterShelfBookCover";
import { StarterShelfSwipeCard } from "./StarterShelfSwipeCard";

interface StarterShelfDeckProps {
  backBooks: OnboardingBook[];
  buttonSwipeRef: MutableRefObject<
    ((direction: StarterShelfSwipeDirection) => void) | null
  >;
  deckEmpty: boolean;
  fillerPicks: OnboardingBook[];
  frontBook: OnboardingBook | null;
  onContinueWithPicks: () => void;
  onSwipe: (direction: StarterShelfSwipeDirection) => void;
  reducedMotion: boolean | null;
  selectedCount: number;
}

export function StarterShelfDeck({
  backBooks,
  buttonSwipeRef,
  deckEmpty,
  fillerPicks,
  frontBook,
  onContinueWithPicks,
  onSwipe,
  reducedMotion,
  selectedCount,
}: StarterShelfDeckProps) {
  return (
    <>
      <div
        className="relative mx-auto"
        style={{
          width: "min(320px, calc(100vw - 80px))",
          height: 440,
          marginBottom: 8,
        }}
      >
        {backBooks.map((book, index) => (
          <motion.div
            key={book.id}
            className="absolute inset-0"
            initial={false}
            animate={{
              scale: 1 - (index + 1) * 0.05,
              y: (index + 1) * 12,
            }}
            transition={
              reducedMotion
                ? { duration: DUR.instant }
                : { duration: DUR.normal, ease: "easeOut" }
            }
            style={{ opacity: 1 - (index + 1) * 0.2, zIndex: 2 - index }}
          >
            <StarterShelfBackCard book={book} />
          </motion.div>
        ))}

        <AnimatePresence mode="popLayout">
          {frontBook && (
            <motion.div
              key={frontBook.id}
              className="absolute inset-0"
              initial={reducedMotion ? false : { scale: 0.95, y: 12, opacity: 0.85 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={
                reducedMotion
                  ? { duration: DUR.instant }
                  : { duration: DUR.normal, ease: EASE.standard }
              }
              style={{ zIndex: 10 }}
            >
              <StarterShelfSwipeCard
                book={frontBook}
                onSwipe={onSwipe}
                buttonSwipeRef={buttonSwipeRef}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {deckEmpty && (
          <div
            className="flex flex-col items-center justify-center text-center"
            style={{
              width: "100%",
              height: "100%",
              borderRadius: 24,
              border: "1px dashed var(--cf-border-strong)",
              background: "var(--cf-surface-muted)",
              padding: 24,
              gap: 16,
            }}
          >
            <p
              style={{
                fontFamily: "var(--font-display, sans-serif)",
                fontSize: 18,
                fontWeight: 600,
                color: "var(--cf-text-1)",
                margin: 0,
              }}
            >
              {selectedCount === 0
                ? "We picked a starter set for you"
                : "We rounded out your shelf"}
            </p>
            <p
              style={{
                fontFamily: "var(--font-body, sans-serif)",
                fontSize: 14,
                color: "var(--cf-text-3)",
                margin: 0,
                lineHeight: 1.5,
                maxWidth: 260,
              }}
            >
              {selectedCount === 0
                ? "These match your interests — you can swap any of them anytime."
                : `Added ${fillerPicks.length} top ${fillerPicks.length === 1 ? "pick" : "picks"} to fill your remaining ${fillerPicks.length === 1 ? "slot" : "slots"}.`}
            </p>
            {fillerPicks.length > 0 && (
              <div className="flex items-end justify-center gap-3">
                {fillerPicks.map((book) => (
                  <StarterShelfBookCover
                    key={book.id}
                    book={book}
                    width={56}
                    height={80}
                    radius={8}
                    titleSize={8}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {frontBook && (
        <div className="flex items-center justify-center gap-8" style={{ marginTop: 8 }}>
          <button
            type="button"
            onClick={() => buttonSwipeRef.current?.("left")}
            aria-label="Skip this book"
            className="cf-pressable flex h-14 w-14 cursor-pointer items-center justify-center rounded-full border border-(--cf-border) bg-(--cf-surface-muted) transition-[border-color,background-color,transform] duration-200 hover:border-[color-mix(in_srgb,var(--accent-rose)_50%,transparent)] hover:bg-[color-mix(in_srgb,var(--accent-rose)_10%,transparent)] focus-visible:border-[color-mix(in_srgb,var(--accent-rose)_50%,transparent)] focus-visible:bg-[color-mix(in_srgb,var(--accent-rose)_10%,transparent)] hover:scale-110 motion-reduce:transition-none motion-reduce:hover:scale-100"
          >
            <X size={24} style={{ color: "var(--accent-rose)" }} />
          </button>

          <button
            type="button"
            onClick={() => buttonSwipeRef.current?.("right")}
            aria-label="Add to shelf"
            className="cf-pressable flex h-14 w-14 cursor-pointer items-center justify-center rounded-full border border-(--cf-border) bg-(--cf-surface-muted) transition-[border-color,background-color,transform] duration-200 hover:border-[color-mix(in_srgb,var(--accent-cyan)_50%,transparent)] hover:bg-[color-mix(in_srgb,var(--accent-cyan)_10%,transparent)] focus-visible:border-[color-mix(in_srgb,var(--accent-cyan)_50%,transparent)] focus-visible:bg-[color-mix(in_srgb,var(--accent-cyan)_10%,transparent)] hover:scale-110 motion-reduce:transition-none motion-reduce:hover:scale-100"
          >
            <Heart size={24} style={{ color: "var(--accent-cyan)" }} />
          </button>
        </div>
      )}

      {deckEmpty && (
        <div className="flex justify-center" style={{ marginTop: 8 }}>
          <Button size="lg" className="w-full max-w-80" onClick={onContinueWithPicks}>
            Continue with these picks
            <ArrowRight size={18} strokeWidth={2} />
          </Button>
        </div>
      )}
    </>
  );
}
