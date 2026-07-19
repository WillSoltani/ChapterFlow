"use client";

import { useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import type { OnboardingBook } from "@/app/onboarding/data/books";
import { DUR, EASE } from "@/lib/motion";
import { StarterShelfBookCover } from "./StarterShelfBookCover";

interface StarterShelfCompleteProps {
  books: OnboardingBook[];
  onDone: () => void;
}

export function StarterShelfComplete({ books, onDone }: StarterShelfCompleteProps) {
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const timer = setTimeout(onDone, 2000);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: DUR.normal }}
      className="flex flex-col items-center text-center"
      style={{ padding: "40px 20px" }}
    >
      <motion.h2
        initial={reducedMotion ? false : { opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: DUR.page, ease: EASE.standard }}
        style={{
          fontFamily: "var(--font-display, sans-serif)",
          fontSize: 28,
          fontWeight: 600,
          color: "var(--cf-text-1)",
          marginBottom: 32,
        }}
      >
        Your shelf is set!
      </motion.h2>

      <div className="flex items-start justify-center gap-6">
        {books.map((book, index) => (
          <motion.div
            key={book.id}
            initial={reducedMotion ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: 0.5 + index * 0.15,
              duration: DUR.page,
              ease: EASE.standard,
            }}
            className="flex flex-col items-center"
            style={{ maxWidth: 120 }}
          >
            <StarterShelfBookCover
              book={book}
              width={100}
              height={140}
              radius={12}
              titleSize={11}
            />
            <p
              style={{
                fontFamily: "var(--font-body, sans-serif)",
                fontSize: 13,
                fontWeight: 500,
                color: "var(--cf-text-1)",
                marginTop: 8,
                textAlign: "center",
                lineHeight: 1.3,
              }}
            >
              {book.title}
            </p>
            <p
              style={{
                fontFamily: "var(--font-body, sans-serif)",
                fontSize: 11,
                color: "var(--cf-text-soft)",
                textAlign: "center",
              }}
            >
              {book.author}
            </p>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={reducedMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.0, duration: DUR.normal }}
        style={{ marginTop: 24 }}
      >
        <Check size={24} style={{ color: "var(--accent-cyan)" }} />
      </motion.div>
    </motion.div>
  );
}
