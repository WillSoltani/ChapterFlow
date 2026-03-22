"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { BookCover } from "./BookCover";
import type { LibraryBook } from "./libraryData";

interface DiscoverBookCardProps {
  book: LibraryBook;
  onClick: () => void;
  onBookmark: (bookId: string) => void;
}

const BADGE_STYLES: Record<string, { bg: string; label: string }> = {
  popular: { bg: "rgba(45,212,191,0.9)", label: "Popular" },
  staff_pick: { bg: "var(--accent-gold)", label: "\u2605 Staff Pick" },
  new: { bg: "rgba(45,212,191,0.9)", label: "New" },
};

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: "var(--accent-teal)",
  medium: "var(--accent-blue)",
  hard: "var(--accent-flame)",
};

export function DiscoverBookCard({ book, onClick, onBookmark }: DiscoverBookCardProps) {
  const [hovered, setHovered] = useState(false);

  const handleBookmark = (e: React.MouseEvent) => {
    e.stopPropagation();
    onBookmark(book.id);
  };

  return (
    <motion.div
      className="w-[160px] flex-shrink-0 cursor-pointer md:w-[160px]"
      style={{ scrollSnapAlign: "start" }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      whileHover={{ y: -4, scale: 1.02 }}
      transition={{ duration: 0.25 }}
    >
      {/* Cover container */}
      <div
        className="relative w-full overflow-hidden"
        style={{
          aspectRatio: "2/3",
          borderRadius: "var(--radius-md-val)",
        }}
      >
        {/* Cover */}
        <BookCover
          title={book.title}
          coverGradient={book.coverGradient}
          coverImage={book.coverImage}
          fill
        />

        {/* Badge */}
        {book.badge && (
          <span
            className="absolute right-2 top-2 rounded-full px-2 py-[2px] text-[9px] font-semibold text-white"
            style={{ background: BADGE_STYLES[book.badge].bg }}
          >
            {BADGE_STYLES[book.badge].label}
          </span>
        )}

        {/* Bookmark icon */}
        <motion.button
          type="button"
          onClick={handleBookmark}
          className="absolute left-2 top-2 z-10 cursor-pointer"
          initial={false}
          animate={{
            opacity: book.bookmarked ? 1 : hovered ? 0.6 : 0,
            scale: 1,
          }}
          transition={{ duration: 0.2 }}
          aria-label={book.bookmarked ? "Remove bookmark" : "Bookmark"}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill={book.bookmarked ? "var(--text-primary)" : "none"}
            stroke="var(--text-primary)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
        </motion.button>

        {/* Progress overlay (if started) */}
        {book.status === "in_progress" && book.progress > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1" style={{ background: "rgba(0,0,0,0.4)" }}>
            <div
              className="h-full"
              style={{
                width: `${book.progress}%`,
                background: "var(--accent-teal)",
              }}
            />
          </div>
        )}

        {/* Hover overlay — desktop only */}
        <motion.div
          className="pointer-events-none absolute inset-0 hidden md:flex"
          initial={{ opacity: 0 }}
          animate={{ opacity: hovered ? 1 : 0 }}
          transition={{ duration: 0.2 }}
          style={{
            background:
              "linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 60%)",
          }}
        >
          <div className="mt-auto flex w-full items-center gap-2 p-3">
            <span
              className="rounded-full px-2 py-[1px] text-[9px] font-medium"
              style={{
                border: "1px solid rgba(255,255,255,0.2)",
                color: "var(--text-primary)",
              }}
            >
              {book.category}
            </span>
            <span className="flex items-center gap-1 text-[9px]" style={{ color: "var(--text-secondary)" }}>
              <span
                className="inline-block h-[5px] w-[5px] rounded-full"
                style={{ background: DIFFICULTY_COLORS[book.difficulty] }}
              />
              {book.difficulty}
            </span>
            <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>
              {book.chapters} ch
            </span>
          </div>
        </motion.div>
      </div>

      {/* Title */}
      <p
        className="mt-2 truncate text-[13px] font-semibold"
        style={{
          color: "var(--text-heading)",
          fontFamily: "var(--font-body)",
        }}
      >
        {book.title}
      </p>

      {/* Author */}
      <p
        className="mt-0.5 truncate text-[11px]"
        style={{ color: "var(--text-muted)" }}
      >
        {book.author}
      </p>
    </motion.div>
  );
}
