"use client";

import { motion } from "framer-motion";
import { GlassCard } from "@/components/ui/GlassCard";
import { DashboardBookCover } from "@/components/ui/DashboardBookCover";

const ease = [0.22, 1, 0.36, 1] as const;

const books = [
  {
    title: "Deep Work",
    author: "Cal Newport",
    chapter: "Ch 4 of 12",
    progress: 33,
    gradient: "linear-gradient(135deg, #2563EB, #1E40AF)",
    active: true,
  },
  {
    title: "Atomic Habits",
    author: "James Clear",
    chapter: "Ch 1 of 20",
    progress: 0,
    gradient: "linear-gradient(135deg, #D97706, #B45309)",
    active: false,
  },
  {
    title: "Thinking, Fast and Slow",
    author: "Daniel Kahneman",
    chapter: "Ch 1 of 18",
    progress: 0,
    gradient: "linear-gradient(135deg, #0D9488, #0F766E)",
    active: false,
  },
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.12 },
  },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease } },
};

export function BookShelf() {
  return (
    <div className="mt-9">
      {/* Header */}
      <div className="mb-4 flex items-end justify-between">
        <div>
          <span
            className="text-[10px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: "var(--text-muted)" }}
          >
            Your Shelf
          </span>
          <h2
            className="font-(family-name:--font-display) text-[20px] font-bold"
            style={{ color: "var(--text-heading)" }}
          >
            3 books on your shelf
          </h2>
        </div>
        <button
          className="cursor-pointer text-[13px] transition-colors hover:underline"
          style={{ color: "var(--accent-blue)" }}
        >
          Browse Library →
        </button>
      </div>

      {/* Book cards */}
      <motion.div
        className="grid grid-cols-1 gap-3.5 md:grid-cols-3"
        variants={container}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-50px" }}
      >
        {books.map((book) => (
          <motion.div key={book.title} variants={item}>
            <GlassCard
              className="cursor-pointer p-4"
              hover
            >
              <div
                style={
                  book.active
                    ? {
                        borderColor: "var(--border-accent)",
                        boxShadow: "0 0 20px rgba(79,139,255,0.06)",
                      }
                    : undefined
                }
              >
                <div className="flex gap-3.5">
                  <DashboardBookCover
                    title={book.title}
                    gradient={book.gradient}
                    width={56}
                    height={78}
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate text-[14px] font-semibold"
                      style={{ color: "var(--text-heading)" }}
                    >
                      {book.title}
                    </p>
                    <p
                      className="text-[11px]"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {book.author}
                    </p>
                    <p
                      className="mt-1.5 text-[11px]"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {book.chapter}
                    </p>
                    {/* Progress bar */}
                    <div
                      className="mt-1.5 h-[3px] overflow-hidden rounded-sm"
                      style={{ background: "var(--bg-elevated)" }}
                    >
                      <div
                        className="h-full rounded-sm transition-all"
                        style={{
                          width: `${book.progress}%`,
                          background:
                            book.progress > 0
                              ? "var(--accent-blue)"
                              : "transparent",
                        }}
                      />
                    </div>
                    <p
                      className="mt-2 text-[12px] font-semibold"
                      style={{
                        color: book.active
                          ? "var(--accent-blue)"
                          : "var(--text-muted)",
                      }}
                    >
                      {book.active ? "Continue →" : "Not started"}
                    </p>
                  </div>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
