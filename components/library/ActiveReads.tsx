"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { BookCover } from "./BookCover";
import { ProgressRing } from "./ProgressRing";
import {
  formatReadingTime,
  getProgressMicrocopy,
  getPerChapterMinutes,
  getLastReadCopy,
  type LibraryBook,
} from "./libraryData";

interface ActiveReadsProps {
  books: LibraryBook[];
}

export function ActiveReads({ books }: ActiveReadsProps) {
  const prefersReduced = useReducedMotion();

  if (books.length < 2) return null;

  // Most recently read first
  const sorted = [...books].sort(
    (a, b) =>
      (b.userProgress?.lastReadAt.getTime() ?? 0) -
      (a.userProgress?.lastReadAt.getTime() ?? 0)
  );

  return (
    <section className="mt-12" style={{ maxWidth: 1080, margin: "48px auto 0" }}>
      <h2
        className="font-(family-name:--font-display) text-[20px] font-bold"
        style={{ color: "var(--text-heading)" }}
      >
        Pick up where you left off
      </h2>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sorted.slice(0, 3).map((book, i) => {
          const prog = book.userProgress!;
          const chaptersLeft = book.totalChapters - prog.currentChapter;
          const timeLeft = Math.round(
            book.estimatedReadingTimeMinutes * (1 - prog.percentComplete / 100)
          );
          const perChapter = getPerChapterMinutes(book);
          const lastReadText = getLastReadCopy(prog.lastReadAt);

          return (
            <motion.div
              key={book.id}
              initial={{
                opacity: prefersReduced ? 1 : 0,
                x: prefersReduced ? 0 : -20,
              }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.5 + i * 0.12 }}
            >
              <Link
                href={`/book/library/${encodeURIComponent(book.id)}`}
                className="group flex gap-4 overflow-hidden rounded-2xl p-4 outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-(--accent-cyan)"
                style={{
                  background: "var(--bg-glass)",
                  backdropFilter: "blur(12px)",
                  border: "1px solid var(--border-subtle)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-medium)";
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "var(--shadow-card)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-subtle)";
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                {/* Cover + ring */}
                <div className="relative shrink-0">
                  <div
                    className="relative overflow-hidden"
                    style={{
                      width: 80,
                      height: 112,
                      borderRadius: "var(--radius-md-val)",
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
                  </div>
                  <div
                    className="absolute -bottom-2 -right-2 rounded-full"
                    style={{ background: "var(--bg-base)", padding: 2 }}
                  >
                    <ProgressRing
                      percent={prog.percentComplete}
                      size={48}
                      strokeWidth={4}
                      showLabel
                      delay={700 + i * 150}
                    />
                  </div>
                </div>

                {/* Details */}
                <div className="flex min-w-0 flex-1 flex-col justify-between">
                  <div>
                    <h3
                      className="truncate text-[15px] font-semibold"
                      style={{ color: "var(--text-heading)" }}
                    >
                      {book.title}
                    </h3>
                    <p className="mt-0.5 truncate text-[13px]" style={{ color: "var(--text-secondary)" }}>
                      {book.author}
                    </p>
                    <p className="mt-1.5 text-[12px]" style={{ color: "var(--text-secondary)" }}>
                      Chapter {prog.currentChapter} of {book.totalChapters} · ~
                      {formatReadingTime(timeLeft)} left
                    </p>
                    <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                      ~{perChapter}m for next chapter
                    </p>
                  </div>

                  <div className="mt-2">
                    <p
                      className="text-[12px]"
                      style={{
                        color:
                          prog.percentComplete >= 50
                            ? "var(--accent-emerald)"
                            : "var(--accent-cyan)",
                      }}
                    >
                      {getProgressMicrocopy(prog.percentComplete, chaptersLeft)}
                    </p>

                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                        {lastReadText}
                      </span>
                      <span
                        className="text-[13px] font-semibold transition-colors"
                        style={{ color: "var(--accent-cyan)" }}
                      >
                        Resume
                        <span className="ml-0.5 inline-block transition-transform duration-200 group-hover:translate-x-0.5">
                          →
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
