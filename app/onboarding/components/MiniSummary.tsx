"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Clock } from "lucide-react";
import { getFirstLoopContent } from "@/app/onboarding/data/chapters";
import { getBookById, getBookCoverPath } from "@/app/onboarding/data/books";
import { useOnboarding } from "@/app/onboarding/hooks/useOnboarding";
import {
  staggerContainer,
  staggerItem,
} from "@/app/onboarding/utils/animations";

interface MiniSummaryProps {
  onContinue: () => void;
}

export default function MiniSummary({ onContinue }: MiniSummaryProps) {
  const prefersReducedMotion = useReducedMotion();
  const { tone } = useOnboarding();
  const { summary } = getFirstLoopContent(tone);
  const book = getBookById(summary.bookId);
  const coverGradient = book?.gradient ?? "linear-gradient(135deg, #D4A574, #C4956A)";

  return (
    <motion.div
      variants={staggerContainer}
      initial={prefersReducedMotion ? false : "hidden"}
      animate="show"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 24,
      }}
    >
      {/* Header: Book cover + chapter info */}
      <motion.div
        variants={staggerItem}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
        }}
      >
        {/* Small book cover */}
        <div
          style={{
            width: 44,
            height: 64,
            borderRadius: 8,
            background: coverGradient,
            boxShadow: "var(--cf-shadow-sm)",
            flexShrink: 0,
            overflow: "hidden",
          }}
        >
          {getBookCoverPath(summary.bookId) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={getBookCoverPath(summary.bookId)!}
              alt={summary.bookTitle}
              draggable={false}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
                pointerEvents: "none",
                userSelect: "none",
              }}
            />
          )}
        </div>
        <div>
          <p
            style={{
              fontFamily: "var(--font-sora, sans-serif)",
              fontSize: 16,
              fontWeight: 600,
              color: "var(--cf-text-1)",
              margin: 0,
              lineHeight: 1.3,
            }}
          >
            Chapter 1: {summary.chapterTitle}
          </p>
          <p
            style={{
              fontFamily: "var(--font-dm-sans, sans-serif)",
              fontSize: 13,
              color: "var(--cf-text-soft)",
              margin: "4px 0 0",
            }}
          >
            {summary.bookTitle} by {summary.author}
          </p>
        </div>
      </motion.div>

      {/* Reading time */}
      <motion.div
        variants={staggerItem}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <Clock size={14} style={{ color: "var(--cf-text-soft)" }} />
        <span
          style={{
            fontFamily: "var(--font-dm-sans, sans-serif)",
            fontSize: 13,
            color: "var(--cf-text-soft)",
          }}
        >
          ~2 min read
        </span>
      </motion.div>

      {/* Summary paragraphs */}
      {summary.paragraphs.map((paragraph: string, i: number) => (
        <motion.p
          key={i}
          variants={staggerItem}
          style={{
            fontFamily: "var(--font-dm-sans, sans-serif)",
            fontSize: 17,
            lineHeight: 1.75,
            color: "var(--cf-text-1)",
            margin: 0,
          }}
        >
          {paragraph}
        </motion.p>
      ))}

      {/* Key insight pull-quote */}
      {summary.keyInsight && (
        <motion.blockquote
          variants={staggerItem}
          style={{
            margin: 0,
            padding: "16px 20px",
            borderLeft: "3px solid var(--accent-teal)",
            background: "var(--cf-surface)",
            borderRadius: "0 var(--radius-md-val, 12px) var(--radius-md-val, 12px) 0",
          }}
        >
          <p
            style={{
              fontFamily: "var(--font-dm-sans, sans-serif)",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--cf-text-soft)",
              margin: "0 0 8px",
            }}
          >
            Key Insight
          </p>
          <p
            style={{
              fontFamily: "var(--font-dm-sans, sans-serif)",
              fontSize: 16,
              fontStyle: "italic",
              lineHeight: 1.7,
              color: "var(--cf-text-1)",
              margin: 0,
            }}
          >
            {summary.keyInsight}
          </p>
        </motion.blockquote>
      )}

      {/* CTA */}
      <motion.div variants={staggerItem}>
        <button
          onClick={onContinue}
          style={{
            width: "100%",
            minHeight: 48,
            padding: "14px 24px",
            fontFamily: "var(--font-dm-sans, sans-serif)",
            fontSize: 16,
            fontWeight: 600,
            color: "#0A0E1A",
            background: "#3BD4A0",
            border: "none",
            borderRadius: "var(--radius-md-val, 12px)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            boxShadow: "0 0 20px rgba(59,212,160,0.25)",
            transition: "filter 0.15s, transform 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.filter = "brightness(1.1)";
            e.currentTarget.style.transform = "scale(1.02)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.filter = "brightness(1)";
            e.currentTarget.style.transform = "scale(1)";
          }}
        >
          Continue to scenarios
          <span>&rarr;</span>
        </button>
      </motion.div>
    </motion.div>
  );
}
