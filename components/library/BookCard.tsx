"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { BookCover } from "./BookCover";
import { formatReadingTime, getBookById, type LibraryBook } from "./libraryData";

interface BookCardProps {
  book: LibraryBook;
  index?: number;
  onBookClick: (bookId: string) => void;
  /** Whether to show Pro lock overlay for free users */
  showProLock?: boolean;
}

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: "var(--accent-emerald)",
  medium: "var(--accent-amber)",
  hard: "var(--accent-rose)",
};

const BADGE_CONFIG: Record<string, { label: string; color: string; glow?: boolean }> = {
  trending: { label: "Trending", color: "var(--accent-cyan)", glow: true },
  "staff-pick": { label: "Staff Pick \u2605", color: "var(--accent-gold)" },
  new: { label: "New", color: "var(--accent-red)" },
  "most-completed": { label: "Most completed", color: "var(--accent-emerald)" },
};

export function BookCard({
  book,
  index = 0,
  onBookClick,
  showProLock = false,
}: BookCardProps) {
  const [expanded, setExpanded] = useState(false);
  const prefersReduced = useReducedMotion();
  const badge = book.badges[0]; // Max 1 badge per card
  const isProLocked = showProLock && book.isPro;
  const similarBook = book.similarBookId ? getBookById(book.similarBookId) : undefined;

  return (
    <motion.article
      className="group w-[200px] shrink-0 cursor-pointer md:w-auto"
      style={{ scrollSnapAlign: "start" }}
      initial={{ opacity: prefersReduced ? 1 : 0, y: prefersReduced ? 0 : 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      onClick={() => {
        if (expanded) {
          onBookClick(book.id);
        } else {
          setExpanded(true);
        }
      }}
      onMouseLeave={() => setExpanded(false)}
      role="article"
    >
      {/* Cover — hover: scale 1.02, translateY -4px, shadow increase */}
      <motion.div
        className="relative w-full overflow-hidden"
        style={{
          aspectRatio: "2/3",
          borderRadius: "var(--radius-md-val)",
          boxShadow: "0 8px 24px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.3)",
        }}
        whileHover={
          prefersReduced
            ? {}
            : {
                scale: 1.02,
                y: -4,
                boxShadow: "0 12px 32px rgba(0,0,0,0.4)",
              }
        }
        whileTap={prefersReduced ? {} : { scale: 0.98 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        <BookCover
          title={book.title}
          coverGradient={book.coverGradient}
          coverImage={book.coverImage}
          fill
        />

        {/* Badge */}
        {badge && BADGE_CONFIG[badge] && (
          <span
            className={`absolute right-2 top-2 z-10 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white ${
              BADGE_CONFIG[badge].glow ? "badge-glow" : ""
            }`}
            style={{
              background: BADGE_CONFIG[badge].color,
              boxShadow: BADGE_CONFIG[badge].glow
                ? `0 0 12px ${BADGE_CONFIG[badge].color}`
                : undefined,
            }}
          >
            {BADGE_CONFIG[badge].label}
          </span>
        )}

        {/* Pro lock overlay */}
        {isProLocked && (
          <div
            className="absolute inset-x-0 bottom-0 z-10 flex items-end justify-center pb-3"
            style={{
              height: "30%",
              background:
                "linear-gradient(to top, rgba(10,15,26,0.85) 0%, transparent 100%)",
              backdropFilter: "blur(4px)",
            }}
          >
            <span
              className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold"
              style={{
                background: "rgba(232,185,49,0.15)",
                border: "1px solid rgba(232,185,49,0.3)",
                color: "var(--cf-amber-text)",
              }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="var(--accent-gold)" stroke="none">
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" fill="none" stroke="var(--accent-gold)" strokeWidth="2" />
              </svg>
              Pro
            </span>
          </div>
        )}
      </motion.div>

      {/* Title */}
      <h3
        className="mt-2.5 text-[15px] font-semibold leading-snug"
        style={{
          color: "var(--text-heading)",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {book.title}
      </h3>

      {/* Author */}
      <p className="mt-0.5 truncate text-[13px]" style={{ color: "var(--text-secondary)" }}>
        {book.author}
      </p>

      {/* Hook */}
      <p
        className="mt-1 text-[13px] leading-snug"
        style={{
          color: "var(--text-primary)",
          opacity: 0.7,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {book.hook}
      </p>

      {/* Metadata row */}
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px]" style={{ color: "var(--text-muted)" }}>
        <span
          className="rounded-full px-2 py-px"
          style={{ border: "1px solid var(--border-subtle)", color: "var(--text-secondary)" }}
        >
          {book.category}
        </span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ background: DIFFICULTY_COLORS[book.difficulty] }}
          />
          {book.difficulty.charAt(0).toUpperCase() + book.difficulty.slice(1)}
        </span>
        <span>~{formatReadingTime(book.estimatedReadingTimeMinutes)}</span>
      </div>

      {/* Social proof */}
      <p className="mt-1.5 flex items-center gap-1 text-[12px]" style={{ color: "var(--text-muted)" }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
        <span className="font-(family-name:--font-mono)">{book.readerCount.toLocaleString()}</span> readers · {book.completionRate}% finish
      </p>

      {/* Hover-expand panel — smooth 200ms ease-out */}
      <motion.div
        initial={false}
        animate={{
          height: expanded ? "auto" : 0,
          opacity: expanded ? 1 : 0,
        }}
        transition={{ duration: prefersReduced ? 0 : 0.2, ease: "easeOut" }}
        className="overflow-hidden"
      >
        <div className="pt-3">
          <p className="text-[12px] font-semibold" style={{ color: "var(--text-secondary)" }}>
            What you&apos;ll learn:
          </p>
          <div className="mt-1 flex flex-col gap-1">
            {book.whatYoullLearn.map((item, j) => (
              <p key={j} className="text-[12px] leading-snug" style={{ color: "var(--text-secondary)" }}>
                {item}
              </p>
            ))}
          </div>

          {book.bestFor.length > 0 && (
            <p className="mt-2 text-[11px]" style={{ color: "var(--text-muted)" }}>
              Best for:{" "}
              <span style={{ color: "var(--text-secondary)" }}>
                {book.bestFor.join(" · ")}
              </span>
            </p>
          )}

          <div className="mt-3 flex gap-2">
            {/* Pro books for free users → "Unlock with Pro" */}
            {isProLocked ? (
              <a
                href="/pricing"
                className="cursor-pointer rounded-lg px-4 py-2 text-[13px] font-semibold transition-colors"
                style={{
                  background: "rgba(232,185,49,0.12)",
                  border: "1px solid rgba(232,185,49,0.3)",
                  color: "var(--cf-amber-text)",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                Unlock with Pro
              </a>
            ) : (
              <button
                type="button"
                className="cursor-pointer rounded-lg px-4 py-2 text-[13px] font-semibold transition-colors"
                style={{
                  background: "var(--accent-cyan)",
                  color: "var(--bg-base)",
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onBookClick(book.id);
                }}
              >
                Start Reading
              </button>
            )}
            <button
              type="button"
              className="cursor-pointer rounded-lg px-4 py-2 text-[13px] font-medium transition-colors"
              style={{
                border: "1px solid var(--border-subtle)",
                color: "var(--text-secondary)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              Add to List
            </button>
          </div>

          {/* Similar book suggestion */}
          {similarBook && (
            <p className="mt-2 text-[11px]" style={{ color: "var(--text-muted)" }}>
              Similar to:{" "}
              <span
                className="cursor-pointer transition-colors"
                style={{ color: "var(--accent-cyan)" }}
                onClick={(e) => {
                  e.stopPropagation();
                  onBookClick(similarBook.id);
                }}
              >
                {similarBook.title}
              </span>
            </p>
          )}
        </div>
      </motion.div>
    </motion.article>
  );
}
