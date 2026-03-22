"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Clock } from "lucide-react";
import { useOnboarding } from "@/app/onboarding/hooks/useOnboarding";
import type { OnboardingBook } from "@/app/onboarding/data/books";
import {
  getRecommendedBooks,
  getSwapAlternatives,
} from "@/app/onboarding/data/recommendations";
import {
  staggerContainer,
  staggerItem,
} from "@/app/onboarding/utils/animations";
import BookSwapSheet from "./BookSwapSheet";

interface StepStarterShelfProps {
  onNext: () => void;
}

function getDifficultyStyle(difficulty: string) {
  switch (difficulty) {
    case "Hard":
      return { background: "rgba(232,185,49,0.12)", color: "#E8B931", border: "1px solid rgba(232,185,49,0.2)" };
    case "Easy":
      return { background: "rgba(45,212,191,0.12)", color: "#2DD4BF", border: "1px solid rgba(45,212,191,0.2)" };
    default:
      return { background: "rgba(79,139,255,0.12)", color: "#4F8BFF", border: "1px solid rgba(79,139,255,0.2)" };
  }
}

export default function StepStarterShelf({ onNext }: StepStarterShelfProps) {
  const { motivation, interests, starterShelf, setStarterShelf } = useOnboarding();
  const prefersReducedMotion = useReducedMotion();

  const [swapIndex, setSwapIndex] = useState<number | null>(null);
  const [swapSheetOpen, setSwapSheetOpen] = useState(false);
  const [alternatives, setAlternatives] = useState<OnboardingBook[]>([]);

  // Initialize shelf on mount
  useEffect(() => {
    if (!starterShelf || starterShelf.length === 0) {
      const recommended = getRecommendedBooks(interests, motivation);
      setStarterShelf(recommended);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const books: OnboardingBook[] = starterShelf ?? [];

  function handleSwapClick(index: number) {
    const currentIds = books.map((b) => b.id);
    const alts = getSwapAlternatives(currentIds, interests, motivation);
    setAlternatives(alts);
    setSwapIndex(index);
    setSwapSheetOpen(true);
  }

  function handleSwapSelect(book: OnboardingBook) {
    if (swapIndex !== null) {
      const updated = [...books];
      updated[swapIndex] = book;
      setStarterShelf(updated);
    }
    setSwapSheetOpen(false);
    setSwapIndex(null);
  }

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 720,
        margin: "0 auto",
        padding: "0 20px",
      }}
    >
      {/* Heading */}
      <h2
        style={{
          fontFamily: "var(--font-sora, sans-serif)",
          fontSize: "clamp(24px, 4vw, 32px)",
          fontWeight: 600,
          color: "var(--text-heading, #FAFAFA)",
          marginBottom: 8,
        }}
      >
        Your starter shelf
      </h2>
      <p
        style={{
          fontFamily: "var(--font-dm-sans, sans-serif)",
          fontSize: 15,
          color: "var(--text-secondary, #8B8B9E)",
          marginBottom: 28,
          lineHeight: 1.5,
        }}
      >
        We picked 3 books based on your interests. Swap any that don&apos;t fit.
      </p>

      {/* Book cards */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        {books.map((book, i) => (
          <motion.div
            key={book.id}
            variants={staggerItem}
            layout
            style={{
              background: "var(--bg-glass, rgba(255,255,255,0.03))",
              border: "1px solid var(--border-subtle, rgba(255,255,255,0.06))",
              borderRadius: "var(--radius-lg-val, 16px)",
              padding: 16,
              display: "flex",
              flexDirection: "column" as const,
              gap: 12,
            }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={book.id}
                initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.3 }}
                style={{
                  display: "flex",
                  flexDirection: "column" as const,
                  gap: 12,
                }}
              >
                {/* Book cover */}
                <div
                  style={{
                    width: 80,
                    height: 120,
                    borderRadius: "var(--radius-md-val, 12px)",
                    background: book.gradient,
                    boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 8,
                  }}
                >
                  <span
                    style={{
                      color: "white",
                      fontSize: 9,
                      fontWeight: 700,
                      textTransform: "uppercase" as const,
                      textAlign: "center" as const,
                      lineHeight: 1.2,
                    }}
                  >
                    {book.title}
                  </span>
                </div>

                {/* Title */}
                <p
                  style={{
                    fontFamily: "var(--font-dm-sans, sans-serif)",
                    fontSize: 14,
                    fontWeight: 600,
                    color: "var(--text-heading, #FAFAFA)",
                    margin: 0,
                    lineHeight: 1.3,
                  }}
                >
                  {book.title}
                </p>

                {/* Author */}
                <p
                  style={{
                    fontFamily: "var(--font-dm-sans, sans-serif)",
                    fontSize: 12,
                    color: "var(--text-muted, #5A5A6E)",
                    margin: 0,
                  }}
                >
                  {book.author}
                </p>

                {/* Badges */}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const }}>
                  <span
                    style={{
                      fontFamily: "var(--font-dm-sans, sans-serif)",
                      fontSize: 11,
                      padding: "2px 8px",
                      borderRadius: 100,
                      background: "var(--bg-glass, rgba(255,255,255,0.03))",
                      border: "1px solid var(--border-subtle, rgba(255,255,255,0.06))",
                      color: "var(--text-secondary, #8B8B9E)",
                    }}
                  >
                    {book.category}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-dm-sans, sans-serif)",
                      fontSize: 11,
                      padding: "2px 8px",
                      borderRadius: 100,
                      ...getDifficultyStyle(book.difficulty),
                    }}
                  >
                    {book.difficulty}
                  </span>
                </div>

                {/* Time estimate */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <Clock size={13} style={{ color: "var(--text-muted, #5A5A6E)" }} />
                  <span
                    style={{
                      fontFamily: "var(--font-dm-sans, sans-serif)",
                      fontSize: 12,
                      color: "var(--text-muted, #5A5A6E)",
                    }}
                  >
                    ~{book.estimatedHours} hrs
                  </span>
                </div>

                {/* Swap button */}
                <button
                  onClick={() => handleSwapClick(i)}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    fontFamily: "var(--font-dm-sans, sans-serif)",
                    fontSize: 13,
                    color: "var(--text-secondary, #8B8B9E)",
                    cursor: "pointer",
                    textAlign: "left" as const,
                    minHeight: 48,
                    display: "flex",
                    alignItems: "center",
                    textDecoration: "none",
                    transition: "text-decoration 0.15s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.textDecoration = "underline"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.textDecoration = "none"; }}
                >
                  Swap this book
                </button>
              </motion.div>
            </AnimatePresence>
          </motion.div>
        ))}
      </motion.div>

      {/* Bottom text */}
      <p
        style={{
          fontFamily: "var(--font-dm-sans, sans-serif)",
          fontSize: 13,
          color: "var(--text-muted, #5A5A6E)",
          textAlign: "center" as const,
          marginBottom: 24,
          lineHeight: 1.5,
        }}
      >
        Your 2 free books are included. Add more anytime with Pro.
      </p>

      {/* CTA */}
      <button
        onClick={onNext}
        className="starter-shelf-cta"
        style={{
          width: "100%",
          minHeight: 56,
          padding: "16px 32px",
          fontFamily: "var(--font-dm-sans, sans-serif)",
          fontSize: 17,
          fontWeight: 600,
          color: "#0A0E1A",
          background: "var(--accent-green, #34D399)",
          border: "none",
          borderRadius: "var(--radius-md-val, 12px)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          boxShadow: "0 0 24px rgba(52,211,153,0.2)",
          transition: "box-shadow 0.3s, transform 0.15s",
        }}
      >
        Start reading
        <span style={{ fontSize: 18 }}>&rarr;</span>

        <style>{`
          @keyframes breatheGlow {
            0%, 100% { box-shadow: 0 0 24px rgba(52,211,153,0.2); }
            50% { box-shadow: 0 0 40px rgba(52,211,153,0.4); }
          }
          .starter-shelf-cta {
            animation: breatheGlow 2.5s ease-in-out infinite;
          }
          .starter-shelf-cta:hover {
            transform: translateY(-1px);
          }
          .starter-shelf-cta:active {
            transform: translateY(0);
          }
        `}</style>
      </button>

      {/* Swap sheet */}
      <BookSwapSheet
        open={swapSheetOpen}
        alternatives={alternatives}
        onSelect={handleSwapSelect}
        onClose={() => {
          setSwapSheetOpen(false);
          setSwapIndex(null);
        }}
      />
    </div>
  );
}
