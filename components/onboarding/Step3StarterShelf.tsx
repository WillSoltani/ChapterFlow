"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { OnboardingBookCard } from "./OnboardingBookCard";
import { BookSwapModal } from "./BookSwapModal";
import { shelfBooks, swapAlternatives, scenarioFocusLabels } from "./chapterData";
import type { PersonalizationChoice, ShelfBook } from "./chapterData";

interface Step3StarterShelfProps {
  personalizationChoice: PersonalizationChoice;
}

export function Step3StarterShelf({ personalizationChoice }: Step3StarterShelfProps) {
  const [shelf, setShelf] = useState<ShelfBook[]>(shelfBooks[personalizationChoice]);
  const [swapIndex, setSwapIndex] = useState<number | null>(null);

  const handleSwap = (book: ShelfBook) => {
    if (swapIndex === null) return;
    setShelf((prev) => {
      const next = [...prev];
      next[swapIndex] = book;
      return next;
    });
    setSwapIndex(null);
  };

  const settings = [
    { label: "Chapter Flow", value: "Balanced" },
    { label: "Scenario Focus", value: scenarioFocusLabels[personalizationChoice] },
    { label: "Daily Rhythm", value: "20 minutes" },
  ];

  return (
    <div className="flex flex-col items-center w-full" style={{ maxWidth: 600 }}>
      {/* Heading */}
      <motion.h1
        className="text-center"
        style={{ fontFamily: "var(--font-sora)", fontSize: "clamp(28px, 5vw, 36px)", fontWeight: 700, color: "var(--text-heading)" }}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        Your shelf is ready.
      </motion.h1>

      <motion.p
        className="text-center mt-2"
        style={{ fontFamily: "var(--font-dm-sans)", fontSize: 15, color: "var(--text-secondary)", maxWidth: 460 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        We picked three books based on what matters to you. Keep them or swap any title.
      </motion.p>

      {/* Book cards */}
      <div className="flex flex-col items-center gap-4 mt-9 w-full md:flex-row md:justify-center md:gap-5">
        {shelf.map((book, i) => (
          <OnboardingBookCard key={book.title} book={book} index={i} onSwap={() => setSwapIndex(i)} />
        ))}
      </div>

      {/* Settings summary */}
      <motion.div
        className="flex flex-wrap justify-center gap-5 mt-9 md:gap-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        {settings.map((s) => (
          <div key={s.label} className="text-center">
            <span style={{ fontFamily: "var(--font-dm-sans)", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--text-muted)", display: "block" }}>
              {s.label}
            </span>
            <span style={{ fontFamily: "var(--font-dm-sans)", fontSize: 14, fontWeight: 600, color: "var(--text-primary)", display: "block", marginTop: 2 }}>
              {s.value}
            </span>
          </div>
        ))}
      </motion.div>

      <motion.p
        className="mt-2.5 italic"
        style={{ fontFamily: "var(--font-dm-sans)", fontSize: 12, color: "var(--text-muted)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        You can change these anytime in settings.
      </motion.p>

      {/* Swap modal */}
      <BookSwapModal
        open={swapIndex !== null}
        alternatives={swapAlternatives[personalizationChoice]}
        currentShelf={shelf}
        onSelect={handleSwap}
        onClose={() => setSwapIndex(null)}
      />
    </div>
  );
}
