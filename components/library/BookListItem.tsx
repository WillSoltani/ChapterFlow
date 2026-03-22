"use client";

import { motion } from "framer-motion";
import { BookCover } from "./BookCover";
import type { LibraryBook } from "./libraryData";

interface BookListItemProps {
  book: LibraryBook;
  onClick: () => void;
  onBookmark: (bookId: string) => void;
  index?: number;
}

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: "var(--accent-teal)",
  medium: "var(--accent-blue)",
  hard: "var(--accent-flame)",
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  in_progress: { label: "In Progress", color: "var(--accent-blue)" },
  completed: { label: "Completed", color: "var(--accent-teal)" },
  not_started: { label: "Not Started", color: "var(--text-muted)" },
};

export function BookListItem({
  book,
  onClick,
  onBookmark,
  index = 0,
}: BookListItemProps) {
  const handleBookmark = (e: React.MouseEvent) => {
    e.stopPropagation();
    onBookmark(book.id);
  };

  return (
    <motion.div
      className="flex cursor-pointer items-center gap-4 px-3 py-3 transition-colors"
      style={{
        borderRadius: "var(--radius-md-val)",
      }}
      onClick={onClick}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.03 }}
      whileHover={{ backgroundColor: "var(--bg-glass-hover)" }}
    >
      {/* Mini cover */}
      <div
        className="flex-shrink-0 overflow-hidden"
        style={{
          width: 48,
          height: 67,
          borderRadius: 6,
          boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
        }}
      >
        <BookCover
          title={book.title}
          coverGradient={book.coverGradient}
          coverImage={book.coverImage}
          width={48}
          height={67}
        />
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p
          className="truncate text-[14px] font-semibold"
          style={{ color: "var(--text-heading)" }}
        >
          {book.title}
        </p>
        <div className="mt-0.5 flex items-center gap-3 text-[12px]">
          <span style={{ color: "var(--text-secondary)" }}>{book.author}</span>
          <span className="flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
            <span
              className="inline-block h-[5px] w-[5px] rounded-full"
              style={{ background: DIFFICULTY_COLORS[book.difficulty] }}
            />
            {book.difficulty}
          </span>
          <span style={{ color: "var(--text-muted)" }}>{book.chapters} chapters</span>
        </div>
        {/* Progress bar if in progress */}
        {book.status === "in_progress" && (
          <div className="mt-1.5 h-[3px] w-32 overflow-hidden rounded-full" style={{ background: "var(--bg-elevated)" }}>
            <div
              className="h-full rounded-full"
              style={{
                width: `${book.progress}%`,
                background: "var(--accent-blue)",
              }}
            />
          </div>
        )}
      </div>

      {/* Right side */}
      <div className="flex flex-shrink-0 items-center gap-3">
        <span
          className="text-[11px] font-medium"
          style={{ color: STATUS_LABELS[book.status].color }}
        >
          {STATUS_LABELS[book.status].label}
        </span>

        <button
          type="button"
          onClick={handleBookmark}
          className="cursor-pointer p-1 transition-opacity"
          style={{ opacity: book.bookmarked ? 1 : 0.4 }}
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
        </button>
      </div>
    </motion.div>
  );
}
