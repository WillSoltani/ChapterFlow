"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ALL_CATEGORIES } from "./libraryData";
import type { LibraryBook } from "./libraryData";

interface CategoryModalProps {
  open: boolean;
  onClose: () => void;
  selectedCategories: string[];
  onApply: (categories: string[]) => void;
  books: LibraryBook[];
}

export function CategoryModal({
  open,
  onClose,
  selectedCategories,
  onApply,
  books,
}: CategoryModalProps) {
  const [local, setLocal] = useState<string[]>(selectedCategories);

  // Reset local state when opening
  const handleOpen = () => setLocal(selectedCategories);

  const categoryCounts = ALL_CATEGORIES.reduce<Record<string, number>>(
    (acc, cat) => {
      acc[cat] = books.filter((b) => b.category === cat).length;
      return acc;
    },
    {}
  );

  const toggleCategory = (cat: string) => {
    setLocal((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  return (
    <AnimatePresence onExitComplete={handleOpen}>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-50"
            style={{ background: "rgba(0,0,0,0.5)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-full overflow-hidden"
              style={{
                maxWidth: 520,
                maxHeight: "70vh",
                background: "var(--bg-raised)",
                border: "1px solid var(--border-medium)",
                borderRadius: "var(--radius-xl-val)",
              }}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.25, type: "spring", damping: 25 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div
                className="flex items-center justify-between px-7 pt-7 pb-4"
              >
                <h3
                  className="font-(family-name:--font-display) text-[18px] font-semibold"
                  style={{ color: "var(--text-heading)" }}
                >
                  All Categories
                </h3>
                <button
                  type="button"
                  onClick={onClose}
                  className="cursor-pointer rounded-md p-1 transition-colors"
                  style={{ color: "var(--text-muted)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-heading)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              {/* Grid */}
              <div
                className="grid grid-cols-2 gap-2 overflow-y-auto px-7 pb-4 md:grid-cols-3"
                style={{ maxHeight: "calc(70vh - 140px)" }}
              >
                {ALL_CATEGORIES.map((cat) => {
                  const isSelected = local.includes(cat);
                  const count = categoryCounts[cat] ?? 0;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => toggleCategory(cat)}
                      className="cursor-pointer rounded-lg px-3.5 py-2.5 text-left text-[13px] transition-all"
                      style={{
                        background: isSelected
                          ? "rgba(45,212,191,0.08)"
                          : "var(--bg-glass)",
                        border: `1px solid ${
                          isSelected
                            ? "var(--accent-blue)"
                            : "var(--border-subtle)"
                        }`,
                        color: isSelected
                          ? "var(--accent-blue)"
                          : "var(--text-secondary)",
                      }}
                    >
                      {cat}{" "}
                      <span style={{ opacity: 0.5 }}>({count})</span>
                    </button>
                  );
                })}
              </div>

              {/* Footer */}
              <div
                className="flex items-center justify-between border-t px-7 py-4"
                style={{ borderColor: "var(--border-subtle)" }}
              >
                <span className="text-[13px]" style={{ color: "var(--text-muted)" }}>
                  {local.length} {local.length === 1 ? "category" : "categories"} selected
                </span>
                <button
                  type="button"
                  onClick={() => {
                    onApply(local);
                    onClose();
                  }}
                  className="cursor-pointer rounded-lg px-5 py-2 text-[13px] font-semibold text-white transition-colors"
                  style={{
                    background: "var(--accent-green)",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-green-hover)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "var(--accent-green)")}
                >
                  Apply
                </button>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
