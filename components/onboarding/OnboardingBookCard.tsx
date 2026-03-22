"use client";

import { motion } from "framer-motion";
import type { ShelfBook } from "./chapterData";

interface OnboardingBookCardProps {
  book: ShelfBook;
  index: number;
  onSwap: () => void;
}

export function OnboardingBookCard({ book, index, onSwap }: OnboardingBookCardProps) {
  return (
    <motion.div
      className="flex flex-col items-center w-full md:w-[180px]"
      style={{
        padding: 20,
        maxWidth: 300,
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderRadius: "var(--radius-lg-val)",
        border: "1px solid var(--border-subtle)",
        background: "var(--bg-glass)",
      }}
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 20, delay: index * 0.12 }}
    >
      {/* Cover */}
      <div
        className="flex items-center justify-center rounded-lg text-white relative overflow-hidden"
        style={{
          width: 120,
          height: 168,
          background: book.gradient,
          fontSize: 11,
          fontWeight: 700,
          textTransform: "uppercase" as const,
          textAlign: "center",
          padding: 12,
          lineHeight: 1.3,
          boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
        }}
      >
        <span className="relative z-10">{book.title}</span>
        <div className="absolute inset-0" style={{ boxShadow: "inset 0 -40px 30px rgba(0,0,0,0.3)" }} />
      </div>

      {/* Meta */}
      <p className="mt-3.5 text-center" style={{ fontFamily: "var(--font-dm-sans)", fontSize: 14, fontWeight: 600, color: "var(--text-heading)" }}>
        {book.title}
      </p>
      <p className="mt-0.5 text-center" style={{ fontFamily: "var(--font-dm-sans)", fontSize: 12, color: "var(--text-muted)" }}>
        {book.author}
      </p>

      {/* Category pill */}
      <span
        className="inline-block mt-2"
        style={{
          fontFamily: "var(--font-dm-sans)",
          fontSize: 11,
          color: "var(--text-secondary)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-full-val)",
          padding: "2px 10px",
        }}
      >
        {book.category}
      </span>

      {/* Swap link */}
      <button
        onClick={onSwap}
        className="mt-2.5 cursor-pointer hover:underline"
        style={{
          fontFamily: "var(--font-dm-sans)",
          fontSize: 12,
          color: "var(--accent-blue)",
          background: "none",
          border: "none",
        }}
      >
        Swap
      </button>
    </motion.div>
  );
}
