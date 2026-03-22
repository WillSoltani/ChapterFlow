"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { BookCover } from "./BookCover";
import type { LibraryBook } from "./libraryData";

interface BrowseBookCardProps {
  book: LibraryBook;
  onClick: () => void;
  onBookmark: (bookId: string) => void;
  index?: number;
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

export function BrowseBookCard({
  book,
  onClick,
  onBookmark,
  index = 0,
}: BrowseBookCardProps) {
  const [hovered, setHovered] = useState(false);

  const handleBookmark = (e: React.MouseEvent) => {
    e.stopPropagation();
    onBookmark(book.id);
  };

  return (
    <motion.div
      className="cursor-pointer"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.04 }}
      whileHover={{ y: -3, scale: 1.02 }}
      style={{
        borderLeft:
          book.status === "in_progress"
            ? "3px solid var(--accent-blue)"
            : "3px solid transparent",
        paddingLeft: book.status === "in_progress" ? 8 : 0,
      }}
    >
      {/* Cover */}
      <div
        className="relative w-full overflow-hidden"
        style={{
          aspectRatio: "2/3",
          borderRadius: "var(--radius-md-val)",
        }}
      >
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

        {/* Completed checkmark */}
        {book.status === "completed" && (
          <span
            className="absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-full text-white"
            style={{ background: "var(--accent-teal)" }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
        )}

        {/* Bookmark */}
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
          style={{
            left: book.status === "completed" ? undefined : 8,
            right: book.status === "completed" ? 8 : undefined,
          }}
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

        {/* Progress bar if started */}
        {book.status === "in_progress" && book.progress > 0 && (
          <div
            className="absolute bottom-0 left-0 right-0 h-[3px]"
            style={{ background: "rgba(0,0,0,0.4)" }}
          >
            <div
              className="h-full"
              style={{
                width: `${book.progress}%`,
                background: "var(--accent-blue)",
              }}
            />
          </div>
        )}

        {/* Hover overlay */}
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
          </div>
        </motion.div>
      </div>

      {/* Title */}
      <p
        className="mt-2 text-[13px] font-semibold leading-snug"
        style={{
          color: "var(--text-heading)",
          fontFamily: "var(--font-body)",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
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

      {/* Meta row */}
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <span
          className="rounded-full px-2 py-[1px] text-[10px]"
          style={{
            color: "var(--text-secondary)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          {book.category}
        </span>
        <span className="flex items-center gap-1 text-[10px]" style={{ color: "var(--text-secondary)" }}>
          <span
            className="inline-block h-[6px] w-[6px] rounded-full"
            style={{ background: DIFFICULTY_COLORS[book.difficulty] }}
          />
          {book.difficulty.charAt(0).toUpperCase() + book.difficulty.slice(1)}
        </span>
        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
          {book.chapters} ch
        </span>
      </div>
    </motion.div>
  );
}
