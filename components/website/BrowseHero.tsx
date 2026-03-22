"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { CounterAnimation } from "@/components/ui/CounterAnimation";

interface BrowseHeroProps {
  totalBooks: number;
  totalTopics: number;
  totalChapters: number;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as const },
  }),
};

export function BrowseHero({
  totalBooks,
  totalTopics,
  totalChapters,
  searchQuery,
  onSearchChange,
}: BrowseHeroProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <section className="pt-[120px] pb-10 px-4">
      <div className="max-w-[1080px] mx-auto text-center">
        {/* Section label */}
        <motion.p
          custom={0}
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          className="font-semibold uppercase"
          style={{
            fontSize: 11,
            letterSpacing: "0.15em",
            color: "var(--accent-blue)",
          }}
        >
          THE LIBRARY
        </motion.p>

        {/* Heading */}
        <motion.h1
          custom={1}
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          className="mx-auto max-w-[700px] mt-4"
          style={{
            fontFamily: "var(--font-sora)",
            fontSize: "clamp(28px, 4vw, 40px)",
            fontWeight: 700,
            lineHeight: 1.2,
            color: "var(--text-heading)",
          }}
        >
          Every book, structured for real understanding.
        </motion.h1>

        {/* Subheading */}
        <motion.p
          custom={2}
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          className="mx-auto max-w-[560px] mt-3"
          style={{
            fontSize: 16,
            lineHeight: 1.6,
            color: "var(--text-secondary)",
            fontFamily: "var(--font-dm-sans)",
          }}
        >
          95+ titles across psychology, productivity, leadership, strategy, and
          more. Each one broken into chapter summaries, real world scenarios, and
          retention quizzes.
        </motion.p>

        {/* Stats row */}
        <motion.div
          custom={3}
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          className="flex justify-center gap-10 mt-7"
        >
          {[
            { target: totalBooks, suffix: "+", label: "books available" },
            { target: totalTopics, suffix: "+", label: "topic clusters" },
            {
              target: totalChapters,
              suffix: "+",
              label: "chapters to explore",
              formatted: true,
            },
          ].map((stat) => (
            <div key={stat.label} className="flex flex-col items-center">
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 28,
                  fontWeight: 700,
                  color: "var(--text-heading)",
                }}
              >
                <CounterAnimation
                  target={stat.target}
                  suffix={stat.suffix}
                  duration={1.8}
                />
              </span>
              <span
                className="mt-1"
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                  fontFamily: "var(--font-dm-sans)",
                }}
              >
                {stat.label}
              </span>
            </div>
          ))}
        </motion.div>

        {/* Search bar */}
        <motion.div
          custom={4}
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          className="mx-auto max-w-[560px] mt-8"
        >
          <div
            className="h-[52px] flex items-center px-5 gap-3 rounded-2xl"
            style={{
              background: "var(--bg-raised)",
              border: isFocused
                ? "1px solid var(--accent-blue)"
                : "1px solid var(--border-subtle)",
              boxShadow: isFocused
                ? "0 0 0 3px rgba(79,139,255,0.1)"
                : "none",
              transition: "border-color 0.2s, box-shadow 0.2s",
            }}
          >
            {/* Search icon */}
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--text-muted)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="flex-shrink-0"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>

            {/* Input */}
            <input
              type="text"
              placeholder="Search by title, author, or topic..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              className="flex-1 outline-none bg-transparent"
              style={{
                fontSize: 15,
                color: "var(--text-primary)",
                fontFamily: "var(--font-dm-sans)",
              }}
            />

            {/* Clear button */}
            {searchQuery.length > 0 && (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="flex-shrink-0 cursor-pointer"
                style={{
                  fontSize: 16,
                  color: "var(--text-muted)",
                  lineHeight: 1,
                  transition: "color 0.15s",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.color = "var(--text-secondary)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.color = "var(--text-muted)")
                }
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
