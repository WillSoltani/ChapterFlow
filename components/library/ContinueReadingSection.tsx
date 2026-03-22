"use client";

import { motion } from "framer-motion";
import { ContinueReadingCard } from "./ContinueReadingCard";
import type { LibraryBook } from "./libraryData";

interface ContinueReadingSectionProps {
  books: LibraryBook[];
  onBookClick: (bookId: string) => void;
}

export function ContinueReadingSection({
  books,
  onBookClick,
}: ContinueReadingSectionProps) {
  if (books.length === 0) return null;

  const visible = books.slice(0, 3);

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="mt-8"
      style={{ maxWidth: 1080, margin: "32px auto 0" }}
    >
      <div className="flex items-center justify-between">
        <h2
          className="font-(family-name:--font-display) text-[20px] font-bold"
          style={{ color: "var(--text-heading)" }}
        >
          Continue Reading
        </h2>
        {books.length > 3 && (
          <button
            type="button"
            className="cursor-pointer text-[13px] transition-colors"
            style={{ color: "var(--accent-blue)" }}
          >
            View all
          </button>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {visible.map((book, i) => (
          <motion.div
            key={book.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: i * 0.1 }}
          >
            <ContinueReadingCard
              book={book}
              onClick={() => onBookClick(book.id)}
            />
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
}
