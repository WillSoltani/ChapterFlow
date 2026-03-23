"use client";

import { motion, useReducedMotion } from "framer-motion";
import { BookCover } from "./BookCover";
import { ProgressRing } from "./ProgressRing";
import {
  formatReadingTime,
  getProgressMicrocopy,
  getProgressColor,
  getPerChapterMinutes,
  getLastReadUrgencyColor,
  getLastReadCopy,
  type LibraryBook,
} from "./libraryData";

interface ActiveReadsProps {
  books: LibraryBook[];
  onBookClick: (bookId: string) => void;
}

export function ActiveReads({ books, onBookClick }: ActiveReadsProps) {
  const prefersReduced = useReducedMotion();

  if (books.length < 2) return null;

  // Sort by most recent first to add "reading now" indicator
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
          const urgencyColor = getLastReadUrgencyColor(prog.lastReadAt);
          const lastReadText = getLastReadCopy(prog.lastReadAt);
          const isMostRecent = i === 0;

          return (
            <motion.article
              key={book.id}
              initial={{
                opacity: prefersReduced ? 1 : 0,
                x: prefersReduced ? 0 : -20,
              }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.7 + i * 0.15 }}
              className="group flex cursor-pointer gap-4 overflow-hidden rounded-2xl p-4 transition-all duration-200"
              style={{
                background: "var(--bg-glass)",
                backdropFilter: "blur(12px)",
                border: "1px solid var(--border-subtle)",
              }}
              onClick={() => onBookClick(book.id)}
              role="article"
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--border-medium)";
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.3)";
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
                  className="overflow-hidden"
                  style={{
                    width: 80,
                    height: 112,
                    borderRadius: "var(--radius-md-val)",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
                  }}
                >
                  <BookCover
                    title={book.title}
                    coverGradient={book.coverGradient}
                    coverImage={book.coverImage}
                    width={80}
                    height={112}
                  />
                </div>
                {/* Progress ring with color gradient and staggered animation */}
                <div
                  className="absolute -bottom-2 -right-2 rounded-full"
                  style={{ background: "var(--bg-base)", padding: 2 }}
                >
                  <ProgressRing
                    percent={prog.percentComplete}
                    size={44}
                    strokeWidth={4}
                    showLabel
                    delay={900 + i * 150}
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
                    Chapter {prog.currentChapter} of {book.totalChapters} · ~{formatReadingTime(timeLeft)} left
                  </p>
                  {/* Per-chapter time — reduces commitment barrier */}
                  <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                    ~{perChapter}m for next chapter
                  </p>
                </div>

                <div className="mt-2">
                  {/* Microcopy — color matches ring (Change 2) */}
                  <p className="text-[12px]" style={{ color: getProgressColor(prog.percentComplete) }}>
                    {getProgressMicrocopy(prog.percentComplete, chaptersLeft)}
                  </p>

                  {/* Last read with urgency color + Resume + "reading now" */}
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-[11px]" style={{ color: urgencyColor }}>
                        {lastReadText}
                      </span>
                      {/* Social proof: reading now indicator on most recent */}
                      {isMostRecent && (
                        <span className="mt-0.5 flex items-center gap-1 text-[10px]" style={{ color: "var(--text-muted)" }}>
                          <span
                            className="inline-block h-1.5 w-1.5 rounded-full"
                            style={{
                              background: "var(--accent-teal)",
                              boxShadow: "0 0 4px var(--accent-teal)",
                            }}
                          />
                          12 people reading now
                        </span>
                      )}
                    </div>
                    <span
                      className="text-[13px] font-semibold transition-colors"
                      style={{ color: "var(--accent-teal)" }}
                    >
                      Resume
                      <span className="ml-0.5 inline-block transition-transform duration-200 group-hover:translate-x-0.5">
                        →
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            </motion.article>
          );
        })}
      </div>
    </section>
  );
}
