"use client";

import { AnimatePresence, motion } from "framer-motion";
import { PublicBookCard } from "./PublicBookCard";
import type { PublicBookCardProps } from "./PublicBookCard";

interface BookGridProps {
  books: PublicBookCardProps[];
  page: number;
  perPage: number;
  onPageChange: (page: number) => void;
}

export function BookGrid({ books, page, perPage, onPageChange }: BookGridProps) {
  const totalPages = Math.ceil(books.length / perPage);
  const start = (page - 1) * perPage;
  const visible = books.slice(start, start + perPage);

  return (
    <div className="max-w-[1080px] mx-auto px-4">
      {/* Grid */}
      <motion.div
        className="grid gap-x-5 gap-y-6 grid-cols-2 md:grid-cols-3 lg:grid-cols-5"
        layout
      >
        <AnimatePresence mode="popLayout">
          {visible.map((book, i) => (
            <motion.div
              key={book.id}
              layout
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.35, delay: Math.min(i * 0.03, 0.6) }}
            >
              <PublicBookCard {...book} />
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-12">
          {/* Previous */}
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="flex items-center justify-center w-9 h-9 rounded-lg text-[13px] font-medium transition-all duration-200 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              background: "var(--bg-raised)",
              border: "1px solid var(--border-subtle)",
              color: "var(--text-secondary)",
            }}
            aria-label="Previous page"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M8.5 3.5L5 7L8.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {/* Page numbers */}
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              className="flex items-center justify-center w-9 h-9 rounded-lg text-[13px] font-semibold transition-all duration-200 cursor-pointer"
              style={{
                background: p === page ? "var(--accent-blue)" : "var(--bg-raised)",
                border: p === page ? "1px solid var(--accent-blue)" : "1px solid var(--border-subtle)",
                color: p === page ? "white" : "var(--text-secondary)",
              }}
            >
              {p}
            </button>
          ))}

          {/* Next */}
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="flex items-center justify-center w-9 h-9 rounded-lg text-[13px] font-medium transition-all duration-200 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              background: "var(--bg-raised)",
              border: "1px solid var(--border-subtle)",
              color: "var(--text-secondary)",
            }}
            aria-label="Next page"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M5.5 3.5L9 7L5.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {/* Page info */}
          <span className="text-[12px] ml-3" style={{ color: "var(--text-muted)" }}>
            Page {page} of {totalPages}
          </span>
        </div>
      )}
    </div>
  );
}
