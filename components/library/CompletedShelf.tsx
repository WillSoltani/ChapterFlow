"use client";

import { motion, useReducedMotion } from "framer-motion";
import { BookCover } from "./BookCover";
import { getBookById, type LibraryBook } from "./libraryData";

interface CompletedShelfProps {
  books: LibraryBook[];
  onBookClick: (bookId: string) => void;
}

export function CompletedShelf({ books, onBookClick }: CompletedShelfProps) {
  const prefersReduced = useReducedMotion();

  if (books.length === 0) return null;

  // Recommendations with explanatory "Because you loved" text
  const recommendations: { book: LibraryBook; because: LibraryBook }[] = [];
  for (const completed of books) {
    if (completed.similarBookId) {
      const rec = getBookById(completed.similarBookId);
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
      transition={{ duration: 0.4 }}
      className="mt-16"
      style={{ maxWidth: 1080, margin: "64px auto 0" }}
    >
      {/* Header with gold star */}
      <div className="flex items-center gap-2">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="var(--accent-gold)"
          stroke="none"
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
        <h2
          className="font-(family-name:--font-display) text-[21px] font-bold"
          style={{ color: "var(--text-heading)" }}
        >
          Books you&apos;ve mastered
        </h2>
      </div>

      {/* Completed books row — gold borders + gold checkmarks */}
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
              className="w-[180px] shrink-0 cursor-pointer"
              onClick={() => onBookClick(book.id)}
              initial={{ opacity: prefersReduced ? 1 : 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
            >
              {/* Cover with gold border + gold checkmark + gold glow (Von Restorff) */}
              <div
                className="relative w-full overflow-hidden"
                style={{
                  aspectRatio: "2/3",
                  borderRadius: "var(--radius-md-val)",
                  border: "2px solid rgba(255,215,0,0.3)",
                  boxShadow: "0 4px 20px rgba(255,215,0,0.08)",
                }}
              >
                <BookCover
                  title={book.title}
                  coverGradient={book.coverGradient}
                  coverImage={book.coverImage}
                  fill
                />
                {/* Gold checkmark */}
                <div
                  className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-full"
                  style={{
                    background: "var(--accent-gold)",
                    boxShadow: "0 2px 8px rgba(255,215,0,0.4)",
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--bg-base)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
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
              <p className="mt-0.5 text-[12px]" style={{ color: "var(--text-muted)" }}>
                Completed {completedDate}
              </p>
              <p className="mt-0.5 text-[12px] font-(family-name:--font-mono)" style={{ color: "var(--cf-amber-text)" }}>
                +{prog.xpEarned} XP earned
              </p>
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
              <button
                key={book.id}
                type="button"
                onClick={() => onBookClick(book.id)}
                className="flex cursor-pointer items-center gap-3 rounded-xl px-4 py-3 text-left transition-all"
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
                <div className="shrink-0 overflow-hidden" style={{ width: 50, height: 70, borderRadius: 6 }}>
                  <BookCover
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
                  <p
                    className="mt-1 text-[12px] leading-snug"
                    style={{ color: "var(--text-primary)", opacity: 0.7 }}
                  >
                    {book.hook}
                  </p>
                  {/* "Because you loved" — explanatory recommendation */}
                  <p className="mt-1 text-[11px] italic" style={{ color: "var(--cf-amber-text)" }}>
                    Because you loved {because.title}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </motion.section>
  );
}
