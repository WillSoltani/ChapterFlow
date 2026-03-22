"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Clock } from "lucide-react";
import { FIRST_LOOP_CONTENT } from "@/app/onboarding/data/chapters";
import { getBookById } from "@/app/onboarding/data/books";
import {
  staggerContainer,
  staggerItem,
} from "@/app/onboarding/utils/animations";

interface MiniSummaryProps {
  onContinue: () => void;
}

export default function MiniSummary({ onContinue }: MiniSummaryProps) {
  const prefersReducedMotion = useReducedMotion();
  const { summary } = FIRST_LOOP_CONTENT;
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
            boxShadow: "0 2px 10px rgba(0,0,0,0.3)",
            flexShrink: 0,
          }}
        />
        <div>
          <p
            style={{
              fontFamily: "var(--font-sora, sans-serif)",
              fontSize: 16,
              fontWeight: 600,
              color: "var(--text-heading, #FAFAFA)",
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
              color: "var(--text-muted, #5A5A6E)",
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
        <Clock size={14} style={{ color: "var(--text-muted, #5A5A6E)" }} />
        <span
          style={{
            fontFamily: "var(--font-dm-sans, sans-serif)",
            fontSize: 13,
            color: "var(--text-muted, #5A5A6E)",
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
            color: "var(--text-primary, #E2E2E6)",
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
            borderLeft: "3px solid var(--accent-teal, #2DD4BF)",
            background: "var(--bg-glass, rgba(255,255,255,0.03))",
            borderRadius: "0 var(--radius-md-val, 12px) var(--radius-md-val, 12px) 0",
            fontFamily: "var(--font-dm-sans, sans-serif)",
            fontSize: 16,
            fontStyle: "italic",
            lineHeight: 1.7,
            color: "var(--text-primary, #E2E2E6)",
          }}
        >
          {summary.keyInsight}
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
            color: "var(--text-heading, #FAFAFA)",
            background: "var(--bg-glass-hover, rgba(255,255,255,0.06))",
            border: "1px solid var(--border-medium, rgba(255,255,255,0.10))",
            borderRadius: "var(--radius-md-val, 12px)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            transition: "background 0.15s, border-color 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.09)";
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background =
              "var(--bg-glass-hover, rgba(255,255,255,0.06))";
            e.currentTarget.style.borderColor =
              "var(--border-medium, rgba(255,255,255,0.10))";
          }}
        >
          Continue to scenarios
          <span>&rarr;</span>
        </button>
      </motion.div>
    </motion.div>
  );
}
