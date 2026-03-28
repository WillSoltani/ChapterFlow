"use client";

import { motion, useReducedMotion } from "framer-motion";
import { BookCard } from "./BookCard";
import { formatReadingTime, type LibraryBook } from "./libraryData";

interface CuratedSectionProps {
  narrativeTitle: string;
  narrativeSubtitle: string;
  books: LibraryBook[];
  onBookClick: (bookId: string) => void;
  showProLock?: boolean;
}

export function CuratedSection({
  narrativeTitle,
  narrativeSubtitle,
  books,
  onBookClick,
  showProLock = false,
}: CuratedSectionProps) {
  const prefersReduced = useReducedMotion();

  // Section meta
  const avgTime = Math.round(
    books.reduce((sum, b) => sum + b.estimatedReadingTimeMinutes, 0) /
      books.length
  );
  const difficulties = books.map((b) => b.difficulty);
  const mostCommon =
    difficulties.filter((d) => d === "easy").length >= difficulties.length / 2
      ? "Easy"
      : difficulties.filter((d) => d === "medium").length >=
        difficulties.length / 2
      ? "Medium"
      : "Mixed";

  return (
    <motion.section
      initial={{ opacity: prefersReduced ? 1 : 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.4 }}
      className="mt-16"
      style={{ maxWidth: 1080, margin: "64px auto 0" }}
    >
      {/* Header — scroll-triggered entrance */}
      <motion.div
        initial={{ opacity: prefersReduced ? 1 : 0, y: prefersReduced ? 0 : 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-end justify-between">
          <h2
            className="font-(family-name:--font-display) text-[21px] font-bold"
            style={{ color: "var(--text-heading)" }}
          >
            {narrativeTitle}
          </h2>
          {/* "See all" ghost button — Autonomy (SDT) */}
          <button
            type="button"
            className="cursor-pointer rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors"
            style={{
              color: "var(--accent-cyan)",
              border: "1px solid var(--accent-cyan)",
              background: "transparent",
            }}
            onClick={() => {
              document.getElementById("browse-all")?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            Show all
          </button>
        </div>
        <p className="mt-1 text-[14px]" style={{ color: "var(--text-secondary)" }}>
          {narrativeSubtitle}
        </p>
        <p className="mt-1 text-[12px]" style={{ color: "var(--text-tertiary)" }}>
          {books.length} books · Avg. ~{formatReadingTime(avgTime)} · Mostly {mostCommon}
        </p>
      </motion.div>

      {/* Book row — staggered entrance via variants (Change 6) */}
      <motion.div
        className="scrollbar-hide mt-5 flex gap-5 overflow-x-auto pb-2 md:grid md:grid-cols-5 md:overflow-visible"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-80px" }}
        variants={{
          visible: { transition: { staggerChildren: 0.08 } },
          hidden: {},
        }}
      >
        {books.map((book) => (
          <motion.div
            key={book.id}
            variants={
              prefersReduced
                ? { hidden: { opacity: 0 }, visible: { opacity: 1 } }
                : {
                    hidden: { opacity: 0, y: 20 },
                    visible: {
                      opacity: 1,
                      y: 0,
                      transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] },
                    },
                  }
            }
          >
            <BookCard
              book={book}
              index={0}
              onBookClick={onBookClick}
              showProLock={showProLock}
            />
          </motion.div>
        ))}
      </motion.div>
    </motion.section>
  );
}
