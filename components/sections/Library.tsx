"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { SectionReveal } from "@/components/ui/SectionReveal";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { CounterAnimation } from "@/components/ui/CounterAnimation";
import { BookCover } from "@/app/book/components/BookCover";
import { getBookById } from "@/app/book/data/booksCatalog";
import { getBookCoverPath } from "@/lib/book-covers";

const BOOK_IDS = [
  "the-48-laws-of-power",
  "friends-and-influence",
];

const CATEGORIES = [
  "All",
  "Productivity",
  "Psychology",
  "Leadership",
  "Communication",
  "Finance",
  "Health",
  "Philosophy",
  "Business",
  "Self-Help",
];

const STATS = [
  { label: "Books available", target: 95, suffix: "+", prefix: "" },
  { label: "Per chapter", target: 20, suffix: " min", prefix: "~" },
  { label: "Free to start", target: 2, suffix: " books", prefix: "" },
  { label: "Simple · Standard · Deeper", target: 3, suffix: " levels", prefix: "" },
];

export function Library() {
  const [activeCategory, setActiveCategory] = useState("All");

  const allBooks = BOOK_IDS.map((id) => getBookById(id)).filter(
    (b): b is NonNullable<typeof b> => b != null
  );

  const filteredBooks =
    activeCategory === "All"
      ? allBooks
      : allBooks.filter((book) => book.category === activeCategory);

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
                95+ books, each structured the same way.
              </h2>

              <p
                className="mt-3 max-w-[550px] text-(--text-secondary)"
                style={{ fontFamily: "var(--font-body)" }}
              >
                Every title is broken into chapters with summaries, scenarios,
                and quizzes. Browse by topic, pick a book, start reading with
                structure.
              </p>
            </div>

            <div className="flex-shrink-0">
              <Link
                href="/books"
                className="inline-block border border-(--border-subtle) text-(--text-heading) hover:bg-(--bg-glass) rounded-lg px-5 py-2.5 transition-colors"
                style={{ fontFamily: "var(--font-display)" }}
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
                    className={`flex-shrink-0 rounded-full px-4 py-2 text-[13px] transition-colors ${
                      isActive
                        ? "bg-(--accent-teal) text-primary-foreground font-semibold"
                        : "bg-transparent border border-(--border-subtle) text-(--text-secondary) hover:text-(--text-heading)"
                    }`}
                  >
                    {category}
                  </button>
                );
              })}
            </div>
          </div>
        </SectionReveal>

        {/* Book grid */}
        <div className="mt-8">
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
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    className="group cursor-pointer"
                    whileHover={{ scale: 1.03, y: -4, transition: { duration: 0.2 } }}
                  >
                    <div className="overflow-hidden rounded-lg shadow-shadow-elevated group-hover:shadow-[rgba(34,211,238,0.05)] transition-shadow duration-300">
                      <BookCover
                        bookId={book.id}
                        title={book.title}
                        icon={book.icon}
                        coverImage={getBookCoverPath(book.id)}
                        className="w-full aspect-[3/4] rounded-lg border border-(--border-subtle)"
                        sizes="(max-width: 768px) 45vw, (max-width: 1024px) 30vw, 22vw"
                        interactive={false}
                      />

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
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          </LayoutGroup>
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
                  <span className="text-[32px] font-bold text-(--accent-teal)">
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
