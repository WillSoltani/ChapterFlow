"use client";

import { motion } from "framer-motion";
import { BookCover } from "./BookCover";
import type { LibraryBook } from "./libraryData";

interface ContinueReadingCardProps {
  book: LibraryBook;
  onClick: () => void;
}

export function ContinueReadingCard({ book, onClick }: ContinueReadingCardProps) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      className="group flex w-full cursor-pointer overflow-hidden text-left transition-all duration-[250ms]"
      style={{
        background: "var(--bg-glass)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: "1px solid var(--border-medium)",
        borderRadius: "var(--radius-xl-val)",
      }}
      whileHover={{
        y: -3,
        boxShadow: "0 8px 24px rgba(0,0,0,0.3), 0 0 20px rgba(45,212,191,0.06)",
      }}
    >
      {/* Cover */}
      <motion.div
        className="flex-shrink-0 overflow-hidden"
        style={{
          width: 100,
          height: 140,
          borderRadius: "var(--radius-xl-val) 0 0 var(--radius-xl-val)",
          boxShadow: "4px 0 16px rgba(0,0,0,0.3)",
        }}
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.4 }}
      >
        <BookCover
          title={book.title}
          coverGradient={book.coverGradient}
          coverImage={book.coverImage}
          width={100}
          height={140}
        />
      </motion.div>

      {/* Content */}
      <div className="flex flex-1 flex-col justify-between p-5">
        <div>
          {/* Status pill */}
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-[10px] font-medium"
            style={{
              color: "var(--accent-teal)",
              background: "rgba(45,212,191,0.06)",
              border: "1px solid rgba(45,212,191,0.15)",
            }}
          >
            <span
              className="inline-block h-[5px] w-[5px] rounded-full"
              style={{
                background: "var(--accent-teal)",
                boxShadow: "0 0 4px var(--accent-teal)",
              }}
            />
            Chapter {book.currentChapter}
          </span>

          {/* Title */}
          <p
            className="mt-1.5 text-[16px] font-semibold leading-snug"
            style={{
              color: "var(--text-heading)",
              fontFamily: "var(--font-body)",
            }}
          >
            {book.title}
          </p>

          {/* Author */}
          <p className="mt-0.5 text-[12px]" style={{ color: "var(--text-secondary)" }}>
            {book.author}
          </p>
        </div>

        <div>
          {/* Progress bar */}
          <div
            className="mt-3 h-1 overflow-hidden rounded-full"
            style={{ background: "var(--bg-elevated)" }}
          >
            <motion.div
              className="h-full rounded-full"
              style={{
                background: "linear-gradient(90deg, var(--accent-blue), var(--accent-teal))",
              }}
              initial={{ width: 0 }}
              animate={{ width: `${book.progress}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </div>

          {/* Progress text */}
          <p className="mt-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
            {book.currentChapter} of {book.chapters} chapters
          </p>

          {/* Resume link */}
          <p
            className="mt-2 text-[13px] font-semibold transition-colors"
            style={{ color: "var(--accent-blue)" }}
          >
            Resume reading{" "}
            <span className="inline-block transition-transform duration-200 group-hover:translate-x-[3px]">
              →
            </span>
          </p>
        </div>
      </div>
    </motion.button>
  );
}
