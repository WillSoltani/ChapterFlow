"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence, LayoutGroup, useReducedMotion } from "framer-motion";
import { SectionReveal } from "@/components/ui/SectionReveal";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { CounterAnimation } from "@/components/ui/CounterAnimation";
import { BookCover } from "@/components/ui/BookCover";
import { BOOKS_CATALOG } from "@/app/book/data/booksCatalog";
import { CATALOG_BOOK_COUNT } from "@/lib/catalog-stats";
import { getBookCoverPath } from "@/lib/book-covers";
import { track } from "@/lib/analytics";
import { PRICING } from "@/lib/pricing";

// Source the count from the shared catalog-stats module (single source of truth).
const BOOK_COUNT = CATALOG_BOOK_COUNT;
// Source the free-tier count from the pricing single source of truth so this
// counter can never drift from the pricing cards / legal / onboarding copy.
const FREE_TO_START_COUNT: number = PRICING.freeBookLimit;

// Always link straight to the book. The server (requireDashboardAccess) carries
// intent through the login wall via returnTo for logged-out readers, so we never
// route a logged-in reader through an unnecessary OAuth round-trip during the
// async auth-status window (the client hook resolves loggedIn lazily).
function bookHref(id: string): string {
  return `/book/library/${id}`;
}

// Derive ordered categories from full catalog (by count, descending)
const ALL_CATEGORY_COUNTS = (() => {
  const counts = new Map<string, number>();
  BOOKS_CATALOG.forEach((b) => counts.set(b.category, (counts.get(b.category) || 0) + 1));
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
})();

const CATEGORIES = ["All", ...ALL_CATEGORY_COUNTS.map(([name]) => name)];

const STATS = [
  { label: "Books available", target: BOOK_COUNT, suffix: "", prefix: "" },
  { label: "Minutes per chapter", target: 20, suffix: " min", prefix: "~" },
  {
    label: "Free to start",
    target: FREE_TO_START_COUNT,
    suffix: FREE_TO_START_COUNT === 1 ? " book" : " books",
    prefix: "",
  },
  { label: "Lite · Standard · Deeper", target: 3, suffix: " levels", prefix: "" },
];

export function Library() {
  const [activeCategory, setActiveCategory] = useState("All");
  const prefersReducedMotion = useReducedMotion();

  // Show up to 8 books — from the full catalog filtered by category
  const filteredBooks =
    activeCategory === "All"
      ? BOOKS_CATALOG.slice(0, 8)
      : BOOKS_CATALOG.filter((b) => b.category === activeCategory).slice(0, 8);

  return (
    <section id="library" className="py-14 lg:py-20">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header row */}
        <SectionReveal>
          <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-6">
            <div>
              <SectionLabel>THE LIBRARY</SectionLabel>

              <h2
                className="mt-4 text-[28px] md:text-[36px] lg:text-[44px] font-bold leading-[1.1] tracking-[-0.02em] text-(--text-heading)"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {BOOK_COUNT} books, each structured the same way.
              </h2>

              <p
                className="mt-3 max-w-[550px] text-(--text-secondary)"
                style={{ fontFamily: "var(--font-body)" }}
              >
                Every title is broken into chapters with summaries, scenarios,
                and quizzes. Browse by topic, pick a book, start reading with
                structure.{" "}
                <span style={{ color: "var(--accent-cyan)" }}>
                  {activeCategory === "All"
                    ? `Showing ${filteredBooks.length} of ${BOOK_COUNT}.`
                    : `Showing ${filteredBooks.length} of ${BOOKS_CATALOG.filter((b) => b.category === activeCategory).length} in ${activeCategory}.`}
                </span>
              </p>
            </div>

            <div className="flex-shrink-0">
              <Link
                href="/books"
                onClick={() => track("browse_library_click", { source: "landing_library" })}
                className="inline-flex items-center gap-1.5 border rounded-lg px-5 py-2.5 text-[14px] font-semibold transition-all duration-200 hover:bg-(--bg-glass) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent-cyan)/60 focus-visible:ring-offset-2"
                style={{
                  borderColor: "color-mix(in srgb, var(--accent-cyan) 35%, transparent)",
                  color: "var(--text-heading)",
                  fontFamily: "var(--font-display)",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.boxShadow = "var(--shadow-glow-cyan)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.boxShadow = "none";
                }}
              >
                Browse the library &rarr;
              </Link>
            </div>
          </div>
        </SectionReveal>

        {/* Category filter pills */}
        <SectionReveal delay={0.1}>
          <div className="mt-8 overflow-x-auto hide-scrollbar">
            <div className="flex flex-row gap-2">
              {CATEGORIES.map((category) => {
                const isActive = activeCategory === category;
                return (
                  <button
                    key={category}
                    onClick={() => setActiveCategory(category)}
                    className={`flex-shrink-0 rounded-full px-4 py-2 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent-cyan)/60 focus-visible:ring-offset-2 ${
                      isActive
                        ? "bg-(--accent-cyan) text-primary-foreground font-semibold"
                        : "bg-transparent border border-(--border-subtle) text-(--text-secondary) hover:text-(--text-heading)"
                    }`}
                  >
                    {category}
                    {isActive && category !== "All" && (
                      <span className="ml-1 text-[10px] opacity-75">
                        ({BOOKS_CATALOG.filter((b) => b.category === category).length})
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </SectionReveal>

        {/* Book grid */}
        <div className="mt-8">
          {filteredBooks.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-[15px]" style={{ color: "var(--text-muted)" }}>
                No {activeCategory} books in the preview.
              </p>
              <Link
                href={`/books?category=${encodeURIComponent(activeCategory)}`}
                onClick={() =>
                  track("browse_category_click", {
                    source: "landing_library_empty",
                    category: activeCategory,
                  })
                }
                className="mt-3 inline-block text-[13px] font-semibold hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent-cyan)/60 focus-visible:ring-offset-2"
                style={{ color: "var(--accent-cyan)" }}
              >
                Browse all {activeCategory} books &rarr;
              </Link>
            </div>
          ) : (
            <LayoutGroup>
              <motion.div
                layout
                className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5"
              >
                <AnimatePresence mode="popLayout">
                  {filteredBooks.map((book) => (
                    <motion.div
                      key={book.id}
                      layout
                      initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={prefersReducedMotion ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
                      transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                      className="group cursor-pointer"
                      whileHover={{ scale: 1.03, y: -4, transition: { duration: 0.2 } }}
                    >
                      <Link
                        href={bookHref(book.id)}
                        aria-label={`Open ${book.title} by ${book.author}`}
                        onClick={() => track("book_card_click", { source: "landing_library", bookId: book.id })}
                        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent-cyan)/60 focus-visible:ring-offset-2 rounded-lg"
                      >
                        <div className="overflow-hidden rounded-lg shadow-shadow-elevated group-hover:shadow-[var(--shadow-glow-cyan)] transition-shadow duration-300">
                          <BookCover
                            bookId={book.id}
                            title={book.title}
                            icon={book.icon}
                            coverImage={getBookCoverPath(book.id)}
                            className="w-full aspect-[3/4] rounded-lg border border-(--border-subtle)"
                            sizes="(max-width: 768px) 45vw, (max-width: 1024px) 30vw, 22vw"
                            interactive={false}
                          />
                        </div>

                        <div className="mt-3 space-y-1">
                          <p
                            className="text-[14px] font-semibold text-(--text-heading) truncate"
                            style={{ fontFamily: "var(--font-display)" }}
                          >
                            {book.title}
                          </p>
                          <p
                            className="text-[12px] text-(--text-muted) truncate"
                            style={{ fontFamily: "var(--font-body)" }}
                          >
                            {book.author}
                          </p>
                          <span className="inline-block text-[11px] text-(--text-secondary) border border-(--border-subtle) px-2.5 py-0.5 rounded-full">
                            {book.category}
                          </span>
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>
            </LayoutGroup>
          )}
        </div>

        {/* Stats bar */}
        <SectionReveal delay={0.2}>
          <div
            className="mt-8 rounded-xl border border-(--border-subtle) bg-(--bg-glass) p-7"
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {STATS.map((stat) => (
                <div key={stat.label} className="flex flex-col">
                  <span className="text-[11px] uppercase tracking-[0.1em] text-(--text-muted)">
                    {stat.label}
                  </span>
                  <span className="text-[32px] font-bold text-(--accent-cyan)">
                    {stat.prefix}
                    <CounterAnimation
                      target={stat.target}
                      suffix={stat.suffix}
                    />
                  </span>
                </div>
              ))}
            </div>
          </div>
        </SectionReveal>
      </div>
    </section>
  );
}
