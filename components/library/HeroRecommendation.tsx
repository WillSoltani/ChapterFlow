"use client";

import { motion, useReducedMotion } from "framer-motion";
import { BookCover } from "./BookCover";
import { ProgressRing } from "./ProgressRing";
import {
  formatReadingTime,
  getProgressMicrocopy,
  getProgressColor,
  getPerChapterMinutes,
  type LibraryBook,
} from "./libraryData";

interface HeroRecommendationProps {
  heroBook: LibraryBook;
  alternatives: LibraryBook[];
  userName: string;
  onBookClick: (bookId: string) => void;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function HeroRecommendation({
  heroBook,
  alternatives,
  userName,
  onBookClick,
}: HeroRecommendationProps) {
  const prefersReduced = useReducedMotion();
  const prog = heroBook.userProgress;
  const isInProgress = prog && !prog.isCompleted && prog.percentComplete > 0;
  const chaptersLeft = isInProgress
    ? heroBook.totalChapters - prog.currentChapter
    : 0;
  const timeRemaining = isInProgress
    ? Math.round(
        heroBook.estimatedReadingTimeMinutes * (1 - prog.percentComplete / 100)
      )
    : heroBook.estimatedReadingTimeMinutes;
  const perChapterMin = getPerChapterMinutes(heroBook);

  return (
    <motion.section
      initial={{ opacity: prefersReduced ? 1 : 0, y: prefersReduced ? 0 : 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut", delay: 0.1 }}
      className="px-5 py-6 md:px-7"
    >
      {/* Glassmorphic hero card — figure-ground separation (Gestalt) */}
      <div
        className="relative mx-auto overflow-hidden rounded-2xl"
        style={{
          maxWidth: 1080,
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
      >
        {/* Radial teal glow behind cover — subtle spotlight */}
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl"
        >
          <div
            className="absolute -left-20 top-1/2 h-[400px] w-[400px] -translate-y-1/2 rounded-full"
            style={{
              background: "rgba(45,212,191,0.04)",
              filter: "blur(100px)",
            }}
          />
        </div>

        <div
          className="relative flex flex-col gap-8 p-8 md:flex-row md:items-center md:gap-12"
          style={{ minHeight: 340 }}
        >
        {/* Left — Book cover */}
        <div className="relative shrink-0 self-center md:self-auto">
          <div
            className="overflow-hidden"
            style={{
              width: 200,
              height: 300,
              borderRadius: "var(--radius-lg-val)",
              boxShadow:
                "0 20px 60px rgba(0,0,0,0.5), 0 0 1px rgba(255,255,255,0.1) inset",
            }}
          >
            <BookCover
              title={heroBook.title}
              coverGradient={heroBook.coverGradient}
              coverImage={heroBook.coverImage}
              width={200}
              height={300}
            />
          </div>

          {/* Progress ring overlay — animated fill */}
          {isInProgress && (
            <div
              className="absolute -bottom-3 -right-3 rounded-full"
              style={{ background: "var(--bg-base)", padding: 3 }}
            >
              <ProgressRing
                percent={prog.percentComplete}
                size={80}
                strokeWidth={6}
                delay={400}
              />
            </div>
          )}
        </div>

        {/* Right — Details */}
        <div className="flex flex-1 flex-col justify-center">
          <p className="text-[14px]" style={{ color: "var(--text-muted)" }}>
            {getGreeting()}, {userName}
          </p>

          <p className="mt-1 text-[13px] font-medium" style={{ color: "var(--accent-teal)" }}>
            {isInProgress ? "Continue your journey" : "Recommended for you"}
          </p>

          <h2
            className="mt-3 font-(family-name:--font-display) text-[28px] font-bold leading-tight"
            style={{ color: "var(--text-heading)" }}
          >
            {heroBook.title}
          </h2>

          <p className="mt-1 text-[15px]" style={{ color: "var(--text-secondary)" }}>
            {heroBook.author}
          </p>

          <p
            className="mt-2 text-[16px] italic"
            style={{ color: "var(--text-primary)", opacity: 0.85 }}
          >
            &ldquo;{heroBook.hook}&rdquo;
          </p>

          {/* Metadata row */}
          <div
            className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]"
            style={{ color: "var(--text-secondary)" }}
          >
            <span>
              ~{formatReadingTime(isInProgress ? timeRemaining : heroBook.estimatedReadingTimeMinutes)}
              {isInProgress ? " remaining" : ""}
            </span>
            {/* Per-chapter time — reduces commitment barrier */}
            <span style={{ color: "var(--text-muted)" }}>
              ~{perChapterMin}m per chapter
            </span>
            <span className="flex items-center gap-1">
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{
                  background:
                    heroBook.difficulty === "easy"
                      ? "var(--accent-teal)"
                      : heroBook.difficulty === "medium"
                      ? "var(--accent-blue)"
                      : "var(--accent-flame)",
                }}
              />
              {heroBook.difficulty.charAt(0).toUpperCase() + heroBook.difficulty.slice(1)}
            </span>
            <span className="font-(family-name:--font-mono)">
              {heroBook.readerCount.toLocaleString()} readers
            </span>
            <span>{heroBook.completionRate}% completion rate</span>
          </div>

          {/* Progress line (in-progress) */}
          {isInProgress && (
            <div className="mt-3">
              <p className="text-[14px] font-medium" style={{ color: "var(--text-heading)" }}>
                Chapter {prog.currentChapter} of {heroBook.totalChapters} · {prog.percentComplete}% complete
              </p>
              <p className="mt-0.5 text-[13px]" style={{ color: getProgressColor(prog.percentComplete) }}>
                {getProgressMicrocopy(prog.percentComplete, chaptersLeft)}
              </p>
            </div>
          )}

          {/* CTAs — larger primary button (Fitts' Law) with glow */}
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => onBookClick(heroBook.id)}
              className="w-full cursor-pointer rounded-xl px-8 text-[16px] font-semibold transition-all sm:w-auto"
              style={{
                height: 52,
                background: "var(--accent-teal)",
                color: "var(--bg-base)",
                boxShadow: "0 4px 20px rgba(45,212,191,0.3), 0 0 40px rgba(45,212,191,0.1)",
              }}
            >
              {isInProgress ? "Continue Reading →" : "Start Reading →"}
            </button>
            <button
              type="button"
              onClick={() => onBookClick(heroBook.id)}
              className="cursor-pointer rounded-xl px-5 text-[14px] font-medium transition-colors"
              style={{
                height: 48,
                color: "var(--text-secondary)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              View Details
            </button>
          </div>
        </div>
      </div>

      {/* Alternative thumbnails — inside the hero card */}
      {alternatives.length > 0 && (
        <div
          className="relative flex flex-col gap-3 border-t px-8 py-5 sm:flex-row sm:items-center sm:gap-5"
          style={{ borderColor: "rgba(255,255,255,0.06)" }}
        >
          <span className="shrink-0 text-[13px]" style={{ color: "var(--text-muted)" }}>
            Not feeling this? Try one of these →
          </span>
          <div className="flex gap-4">
            {alternatives.slice(0, 3).map((book, i) => (
              <motion.button
                key={book.id}
                type="button"
                onClick={() => onBookClick(book.id)}
                className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition-colors"
                initial={{
                  opacity: prefersReduced ? 1 : 0,
                  x: prefersReduced ? 0 : -10,
                }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + i * 0.1 }}
                style={{ border: "1px solid transparent" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-medium)";
                  e.currentTarget.style.background = "var(--bg-glass)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "transparent";
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <div
                  className="shrink-0 overflow-hidden"
                  style={{ width: 50, height: 75, borderRadius: 4 }}
                >
                  <BookCover
                    title={book.title}
                    coverGradient={book.coverGradient}
                    coverImage={book.coverImage}
                    width={50}
                    height={75}
                  />
                </div>
                <div className="hidden text-left md:block" style={{ maxWidth: 140 }}>
                  <p className="text-[13px] font-medium" style={{ color: "var(--text-heading)" }}>
                    {book.title}
                  </p>
                  <p
                    className="mt-0.5 text-[11px] leading-snug"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {book.hook}
                  </p>
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      )}
      </div>{/* end glassmorphic hero card */}
    </motion.section>
  );
}
