"use client";

import { motion } from "framer-motion";
import type { OnboardingBook } from "@/app/onboarding/data/books";
import { DUR, EASE } from "@/lib/motion";
import { StarterShelfBookCover } from "./StarterShelfBookCover";

interface StarterShelfSelectionSlotProps {
  book?: OnboardingBook | undefined;
  index: number;
  reducedMotion: boolean | null;
}

export function StarterShelfSelectionSlot({
  book,
  index,
  reducedMotion,
}: StarterShelfSelectionSlotProps) {
  return (
    <div style={{ width: 48, height: 68 }}>
      {book ? (
        <motion.div
          initial={reducedMotion ? false : { scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: DUR.normal, ease: EASE.standard }}
        >
          <StarterShelfBookCover
            book={book}
            width={48}
            height={68}
            radius={8}
            titleSize={7}
          />
        </motion.div>
      ) : (
        <div
          style={{
            width: 48,
            height: 68,
            borderRadius: 8,
            border: "1px dashed var(--cf-border-strong)",
            background: "var(--cf-surface-muted)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-body, sans-serif)",
              fontSize: 14,
              color: "var(--cf-border-strong)",
            }}
          >
            {index + 1}
          </span>
        </div>
      )}
    </div>
  );
}
