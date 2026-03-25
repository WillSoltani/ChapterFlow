"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { ShelfBook } from "./chapterData";

interface BookSwapModalProps {
  open: boolean;
  alternatives: ShelfBook[];
  currentShelf: ShelfBook[];
  onSelect: (book: ShelfBook) => void;
  onClose: () => void;
}

export function BookSwapModal({ open, alternatives, currentShelf, onSelect, onClose }: BookSwapModalProps) {
  // Filter out books already on the shelf
  const shelfTitles = new Set(currentShelf.map((b) => b.title));
  const available = alternatives.filter((b) => !shelfTitles.has(b.title));

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center px-5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0" style={{ background: "var(--cf-overlay)" }} onClick={onClose} />

          {/* Modal card */}
          <motion.div
            className="relative w-full"
            style={{
              maxWidth: 400,
              padding: 24,
              background: "var(--bg-raised)",
              border: "1px solid var(--border-medium)",
              borderRadius: "var(--radius-xl-val)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
            }}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
          >
            <h3 style={{ fontFamily: "var(--font-sora)", fontSize: 18, fontWeight: 600, color: "var(--text-heading)" }}>
              Choose a replacement
            </h3>

            <div className="flex flex-col gap-1 mt-4">
              {available.map((book) => (
                <button
                  key={book.title}
                  onClick={() => onSelect(book)}
                  className="flex items-center gap-3 p-3 rounded-lg text-left cursor-pointer transition-colors"
                  style={{ background: "transparent", border: "none" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-glass-hover)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <div className="rounded-sm shrink-0" style={{ width: 32, height: 45, background: book.gradient }} />
                  <div>
                    <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 14, fontWeight: 500, color: "var(--text-heading)" }}>
                      {book.title}
                    </p>
                    <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 12, color: "var(--text-muted)" }}>
                      {book.author}
                    </p>
                  </div>
                </button>
              ))}
            </div>

            <button
              onClick={onClose}
              className="mt-4 w-full text-center cursor-pointer"
              style={{ fontFamily: "var(--font-dm-sans)", fontSize: 13, color: "var(--text-muted)", background: "none", border: "none" }}
            >
              Cancel
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
