"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { DUR, EASE } from "@/lib/motion";
import { ArrowRight, RefreshCw, Clock, Sparkles } from "lucide-react";
import { BookCover } from "@/components/ui/BookCover";
import { BookSaveButton } from "@/app/book/components/BookSaveButton";
import { ProgressRing } from "./ProgressRing";
import type { LibraryBookEntry } from "@/app/book/_lib/library-data";

type BookHeroProps = {
  entry: LibraryBookEntry;
  /** Real page count from the book package; omitted when unknown (never estimated). */
  pages?: number;
  progressPercent: number;
  avgScore: number;
  unlockedCount: number;
  totalCount: number;
  completedCount: number;
  /** Two-axis completion (feedback #4): chapters the reader has APPLIED (followed
   *  through). Display-only; hidden until >= 1 to avoid "0 applied" noise. */
  appliedCount: number;
  currentChapterOrder: number;
  firstChapterMinutes: number;
  onContinue: () => void;
  isSaved: boolean;
  onToggleSaved: () => void;
  /** Free-book limit reached for this not-yet-started book — gate the start CTA. */
  accessBlocked: boolean;
};

function difficultyPillStyle(value: LibraryBookEntry["difficulty"]): { background: string; color: string } {
  if (value === "Easy") return { background: "color-mix(in srgb, var(--accent-emerald) 20%, transparent)", color: "var(--accent-emerald)" };
  if (value === "Medium") return { background: "color-mix(in srgb, var(--accent-amber) 20%, transparent)", color: "var(--accent-amber)" };
  return { background: "color-mix(in srgb, var(--accent-rose) 20%, transparent)", color: "var(--accent-rose)" };
}

export function BookHero({
  entry,
  pages,
  progressPercent,
  avgScore,
  unlockedCount,
  totalCount,
  completedCount,
  appliedCount,
  currentChapterOrder,
  firstChapterMinutes,
  onContinue,
  isSaved,
  onToggleSaved,
  accessBlocked,
}: BookHeroProps) {
  const prefersReducedMotion = useReducedMotion();
  const [synopsisExpanded, setSynopsisExpanded] = useState(false);

  const hasProgress = progressPercent > 0 || completedCount > 0;
  const allCompleted = completedCount >= totalCount && totalCount > 0;

  const ctaText = allCompleted
    ? "Review book"
    : hasProgress
      ? `Continue Chapter ${currentChapterOrder}`
      : `Start Chapter ${currentChapterOrder}`;

  const ctaIcon = allCompleted ? (
    <RefreshCw className="h-4.5 w-4.5" />
  ) : (
    <ArrowRight className="h-4.5 w-4.5" />
  );

  const synopsis = entry.synopsis?.trim() ?? "";
  // Only offer a "More" toggle when the synopsis is long enough that a 2-line
  // clamp actually hides something — otherwise the control would be a no-op.
  const synopsisIsLong = synopsis.length > 150;

  return (
    <motion.section
      initial={prefersReducedMotion ? undefined : { opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        prefersReducedMotion
          ? { duration: 0 }
          : { duration: DUR.slow, ease: EASE.standard, delay: 0.1 }
      }
      className="cf-panel relative overflow-hidden rounded-2xl p-6 sm:p-8 lg:rounded-3xl"
    >
      {/* Top-edge glass highlight */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-(--cf-border-strong) to-transparent"
        aria-hidden="true"
      />

      <div className="relative z-10">
        <div className="flex flex-col items-center gap-6 md:flex-row md:items-start md:gap-8">
          {/* Book cover */}
          <motion.div
            initial={prefersReducedMotion ? undefined : { opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: DUR.page, delay: 0.2 }}
            className="shrink-0"
          >
            <div style={{ boxShadow: "var(--shadow-book)", borderRadius: "0.75rem" }}>
              <BookCover
                bookId={entry.id}
                title={entry.title}
                icon={entry.icon}
                coverImage={entry.coverImage}
                className="h-52 w-36 rounded-xl border border-(--cf-border) md:h-72 md:w-48"
                fallbackClassName="text-6xl"
                sizes="220px"
                priority
              />
            </div>
          </motion.div>

          {/* Info column */}
          <div className="flex min-w-0 flex-1 flex-col items-center text-center md:items-start md:text-left">
            <motion.h1
              initial={prefersReducedMotion ? undefined : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={prefersReducedMotion ? { duration: 0 } : { duration: DUR.page, delay: 0.4 }}
              className="text-2xl font-bold tracking-tight text-(--cf-text-1) sm:text-3xl md:text-4xl"
              style={{ fontFamily: "var(--font-satoshi)" }}
            >
              {entry.title}
            </motion.h1>
            <motion.p
              initial={prefersReducedMotion ? undefined : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={prefersReducedMotion ? { duration: 0 } : { duration: DUR.page, delay: 0.45 }}
              className="mt-1 text-base text-(--cf-text-3)"
            >
              by {entry.author}
            </motion.p>

            {/* Tag pills */}
            <motion.div
              initial={prefersReducedMotion ? undefined : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={prefersReducedMotion ? { duration: 0 } : { duration: DUR.page, delay: 0.5 }}
              className="mt-3 flex flex-wrap justify-center gap-2 md:justify-start"
            >
              <span className="cf-pill rounded-lg px-2.5 py-1 text-xs">{entry.category}</span>
              <span
                className="cf-pill rounded-lg px-2.5 py-1 text-xs font-medium"
                style={difficultyPillStyle(entry.difficulty)}
              >
                {entry.difficulty}
              </span>
              {typeof pages === "number" && pages > 0 && (
                <span className="cf-pill rounded-lg px-2.5 py-1 text-xs">{pages} pages</span>
              )}
            </motion.div>

            {/* Synopsis — clamped above the fold; "More" reveals the full text.
                The long-form About (tags, pace, difficulty) lives in the accordion below. */}
            {synopsis && (
              <motion.div
                initial={prefersReducedMotion ? undefined : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={prefersReducedMotion ? { duration: 0 } : { duration: DUR.page, delay: 0.52 }}
                className="mt-3 max-w-prose"
              >
                <p
                  className={`text-sm leading-relaxed text-(--cf-text-2) ${synopsisExpanded ? "" : "line-clamp-2"}`}
                >
                  {synopsis}
                </p>
                {synopsisIsLong && (
                  <button
                    type="button"
                    onClick={() => setSynopsisExpanded((prev) => !prev)}
                    aria-expanded={synopsisExpanded}
                    className="-mx-1 mt-0.5 inline-flex min-h-11 items-center rounded px-1 text-sm font-medium text-(--cf-accent) transition-colors hover:text-(--cf-accent-strong) cf-focus"
                  >
                    {synopsisExpanded ? "Less" : "More"}
                  </button>
                )}
              </motion.div>
            )}

            {/* CTA + Save */}
            <motion.div
              initial={prefersReducedMotion ? undefined : { opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={
                prefersReducedMotion
                  ? { duration: 0 }
                  : { duration: DUR.normal, type: "spring" as const, stiffness: 300, damping: 25, delay: 0.45 }
              }
              className="mt-5 flex items-center gap-3"
            >
              {accessBlocked ? (
                <Link
                  href="/pricing"
                  className="cf-btn cf-btn-primary rounded-xl px-7 py-3 text-base font-semibold cf-focus"
                >
                  <Sparkles className="h-4.5 w-4.5" />
                  <span>Upgrade to start</span>
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={onContinue}
                  className="cf-btn cf-btn-primary rounded-xl px-7 py-3 text-base font-semibold cf-focus"
                >
                  <span>{ctaText}</span>
                  {ctaIcon}
                </button>
              )}
              <BookSaveButton saved={isSaved} onToggle={onToggleSaved} className="h-11 w-11 rounded-xl" />
            </motion.div>

            {/* Progress (real data only) vs. forward-looking zero-state */}
            {hasProgress ? (
              <div className="mt-5 flex flex-wrap items-center justify-center gap-4 md:justify-start">
                <ProgressRing percent={progressPercent} size={56} strokeWidth={4} />
                <div className="flex flex-wrap items-center gap-3">
                  {avgScore > 0 && (
                    <span className="cf-panel-muted rounded-lg px-2.5 py-1.5 text-xs font-medium text-(--cf-text-2)">
                      Avg score: {avgScore}%
                    </span>
                  )}
                  <span className="cf-panel-muted rounded-lg px-2.5 py-1.5 text-xs font-medium text-(--cf-text-2)">
                    {completedCount}/{totalCount} chapters complete
                  </span>
                  {appliedCount >= 1 && (
                    <span
                      className="cf-panel-muted rounded-lg px-2.5 py-1.5 text-xs font-medium"
                      style={{ color: "var(--cf-gold-text)" }}
                    >
                      {appliedCount} applied
                    </span>
                  )}
                  <span className="cf-panel-muted rounded-lg px-2.5 py-1.5 text-xs font-medium text-(--cf-text-2)">
                    {unlockedCount}/{totalCount} unlocked
                  </span>
                </div>
              </div>
            ) : totalCount > 0 ? (
              <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-(--cf-text-3) md:justify-start">
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-(--cf-text-soft)" />
                  Chapter 1 takes about {firstChapterMinutes} min
                </span>
                <span aria-hidden="true" className="text-(--cf-text-soft)">·</span>
                <span>
                  {totalCount} {totalCount === 1 ? "chapter" : "chapters"} to
                  unlock as you go
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </motion.section>
  );
}
