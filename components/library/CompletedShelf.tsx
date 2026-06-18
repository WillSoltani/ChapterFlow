"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { DUR } from "@/lib/motion";
import { BookCover } from "@/components/ui/BookCover";
import { useLibraryContext } from "./LibraryContext";
import { type LibraryBook } from "./libraryData";

interface CompletedShelfProps {
  books: LibraryBook[];
}

export function CompletedShelf({ books }: CompletedShelfProps) {
  const prefersReduced = useReducedMotion();
  const { booksById } = useLibraryContext();

  if (books.length === 0) return null;

  // Recommendations resolved against the LIVE catalog (not static MOCK_BOOKS)
  const recommendations: { book: LibraryBook; because: LibraryBook }[] = [];
  for (const completed of books) {
    if (completed.similarBookId) {
      const rec = booksById.get(completed.similarBookId);
      if (
        rec &&
        !rec.userProgress?.isCompleted &&
        !recommendations.some((r) => r.book.id === rec.id)
      ) {
        recommendations.push({ book: rec, because: completed });
      }
    }
    if (recommendations.length >= 3) break;
  }

  return (
    <motion.section
      initial={{ opacity: prefersReduced ? 1 : 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: DUR.page }}
      className="mt-16"
      style={{ maxWidth: 1080, margin: "64px auto 0" }}
    >
      {/* Header with gold star */}
      <div className="flex items-center gap-2">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="var(--accent-gold)" stroke="none">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
        <h2
          className="font-(family-name:--font-display) text-[21px] font-bold"
          style={{ color: "var(--text-heading)" }}
        >
          Books you&apos;ve mastered
        </h2>
      </div>

      {/* Completed books row */}
      <div className="scrollbar-hide mt-5 flex gap-5 overflow-x-auto pb-2">
        {books.map((book, i) => {
          const prog = book.userProgress!;
          const completedDate = prog.completedAt
            ? prog.completedAt.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })
            : "";

          return (
            <motion.div
              key={book.id}
              className="w-[150px] shrink-0 sm:w-[180px]"
              initial={{ opacity: prefersReduced ? 1 : 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
            >
              <Link
                href={`/book/library/${encodeURIComponent(book.id)}`}
                className="block rounded-[var(--radius-md-val)] cf-focus"
                aria-label={`${book.title} — completed${completedDate ? ` ${completedDate}` : ""}`}
              >
                {/* Cover with gold border + checkmark */}
                <div
                  className="relative w-full overflow-hidden transition-shadow duration-200"
                  style={{
                    aspectRatio: "2/3",
                    borderRadius: "var(--radius-md-val)",
                    border: "2px solid var(--cf-gold-border)",
                    boxShadow: "var(--shadow-book)",
                  }}
                >
                  <BookCover
                    bookId={book.id}
                    title={book.title}
                    coverGradient={book.coverGradient}
                    coverImage={book.coverImage}
                    fill
                  />
                  <div
                    className="absolute bottom-2 right-2 flex items-center justify-center rounded-full"
                    style={{ width: 24, height: 24, background: "var(--accent-amber)" }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                </div>

                <h3
                  className="mt-2.5 truncate text-[14px] font-semibold"
                  style={{ color: "var(--text-heading)" }}
                >
                  {book.title}
                </h3>
                <p className="mt-0.5 text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                  Completed {completedDate}
                </p>
                {/* Only show IP when a real, non-zero figure exists — never "+0 IP". */}
                {typeof prog.xpEarned === "number" && prog.xpEarned > 0 && (
                  <p
                    className="mt-0.5 text-[12px] font-(family-name:--font-mono)"
                    style={{ color: "var(--accent-violet)" }}
                  >
                    +{prog.xpEarned} IP earned
                  </p>
                )}
              </Link>
            </motion.div>
          );
        })}
      </div>

      {/* Recommendations with "Because you loved [Book]" explanations */}
      {recommendations.length > 0 && (
        <div className="mt-8">
          <p className="text-[14px] font-medium" style={{ color: "var(--text-heading)" }}>
            Based on what you&apos;ve read, you might love:
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:gap-4">
            {recommendations.map(({ book, because }) => (
              <Link
                key={book.id}
                href={`/book/library/${encodeURIComponent(book.id)}`}
                className="flex cursor-pointer items-center gap-3 rounded-xl px-4 py-3 text-left transition-all cf-focus"
                style={{
                  background: "var(--bg-glass)",
                  border: "1px solid var(--border-subtle)",
                  flex: "1 1 0%",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-medium)";
                  e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-subtle)";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                <div className="relative shrink-0 overflow-hidden" style={{ width: 50, height: 70, borderRadius: 6 }}>
                  <BookCover
                    bookId={book.id}
                    title={book.title}
                    coverGradient={book.coverGradient}
                    coverImage={book.coverImage}
                    width={50}
                    height={70}
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold" style={{ color: "var(--text-heading)" }}>
                    {book.title}
                  </p>
                  <p className="mt-0.5 text-[12px]" style={{ color: "var(--text-muted)" }}>
                    {book.author}
                  </p>
                  <p className="mt-1 text-[12px] leading-snug" style={{ color: "var(--text-primary)", opacity: 0.7 }}>
                    {book.hook}
                  </p>
                  <p className="mt-1 text-[11px] italic" style={{ color: "var(--cf-amber-text)" }}>
                    Because you loved {because.title}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </motion.section>
  );
}
