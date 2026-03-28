"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Flame,
  RefreshCw,
  Users,
  Trophy,
  Clock,
} from "lucide-react";
import { BookCover } from "@/app/book/components/BookCover";
import { BookSaveButton } from "@/app/book/components/BookSaveButton";
import { ProgressRing } from "./ProgressRing";
import type { LibraryBookEntry } from "@/app/book/_lib/library-data";

type BookHeroProps = {
  entry: LibraryBookEntry;
  pages: number;
  progressPercent: number;
  avgScore: number;
  unlockedCount: number;
  totalCount: number;
  completedCount: number;
  currentChapterOrder: number;
  onContinue: () => void;
  isSaved: boolean;
  onToggleSaved: () => void;
  timeInvestedMinutes: number;
};

function formatTime(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function seededSocial(bookId: string) {
  let hash = 0;
  for (let i = 0; i < bookId.length; i++) {
    hash = (hash << 5) - hash + bookId.charCodeAt(i);
    hash |= 0;
  }
  const abs = Math.abs(hash);
  return { activeReaders: 120 + (abs % 400), completedReaders: 30 + (abs % 150) };
}

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
  currentChapterOrder,
  onContinue,
  isSaved,
  onToggleSaved,
  timeInvestedMinutes,
}: BookHeroProps) {
  const prefersReducedMotion = useReducedMotion();
  const social = seededSocial(entry.id);

  const displayPercent =
    progressPercent === 0 && completedCount === 0 ? 8 : progressPercent;

  const allCompleted = completedCount >= totalCount && totalCount > 0;
  const ctaText = allCompleted
    ? "Review Book ↻"
    : completedCount > 0
      ? `Continue Chapter ${currentChapterOrder} →`
      : `Start Chapter ${currentChapterOrder} →`;

  const ctaIcon = allCompleted ? (
    <RefreshCw className="h-4.5 w-4.5" />
  ) : (
    <ArrowRight className="h-4.5 w-4.5" />
  );

  return (
    <motion.section
      initial={prefersReducedMotion ? undefined : { opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        prefersReducedMotion
          ? { duration: 0 }
          : { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.1 }
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
            transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.4, delay: 0.2 }}
            className="shrink-0"
          >
            <div style={{ boxShadow: "0 12px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3)", borderRadius: "0.75rem" }}>
              <BookCover
                bookId={entry.id}
                title={entry.title}
                icon={entry.icon}
                coverImage={entry.coverImage}
                className="h-52 w-36 rounded-xl border border-(--cf-border) md:h-72 md:w-48"
                fallbackClassName="text-6xl"
                sizes="220px"
              />
            </div>
          </motion.div>

          {/* Info column */}
          <div className="flex min-w-0 flex-1 flex-col items-center text-center md:items-start md:text-left">
            <motion.h1
              initial={prefersReducedMotion ? undefined : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.4, delay: 0.4 }}
              className="text-2xl font-bold tracking-tight text-(--cf-text-1) sm:text-3xl md:text-4xl"
              style={{ fontFamily: "var(--font-satoshi)" }}
            >
              {entry.title}
            </motion.h1>
            <motion.p
              initial={prefersReducedMotion ? undefined : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.4, delay: 0.45 }}
              className="mt-1 text-base text-(--cf-text-3)"
            >
              by {entry.author}
            </motion.p>

            {/* Tag pills */}
            <motion.div
              initial={prefersReducedMotion ? undefined : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.4, delay: 0.5 }}
              className="mt-3 flex flex-wrap justify-center gap-2 md:justify-start"
            >
              <span className="cf-pill rounded-lg px-2.5 py-1 text-xs">{entry.category}</span>
              <span
                className="rounded-lg px-2.5 py-1 text-xs font-medium"
                style={difficultyPillStyle(entry.difficulty)}
              >
                {entry.difficulty}
              </span>
              <span className="cf-pill rounded-lg px-2.5 py-1 text-xs">{pages} pages</span>
            </motion.div>

            {/* CTA + Save */}
            <motion.div
              initial={prefersReducedMotion ? undefined : { opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={
                prefersReducedMotion
                  ? { duration: 0 }
                  : { duration: 0.3, type: "spring" as const, stiffness: 300, damping: 25, delay: 0.45 }
              }
              className="mt-5 flex items-center gap-3"
            >
              <button
                type="button"
                onClick={onContinue}
                className="cf-btn cf-btn-primary rounded-xl px-7 py-3 text-base font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--cf-accent) focus-visible:ring-offset-2 focus-visible:ring-offset-(--cf-page-bg)"
              >
                <span>{ctaText}</span>
                {ctaIcon}
              </button>
              <BookSaveButton saved={isSaved} onToggle={onToggleSaved} className="h-11 w-11 rounded-xl" />
            </motion.div>

            {/* Progress ring + stat chips */}
            <div className="mt-5 flex flex-wrap items-center justify-center gap-4 md:justify-start">
              <ProgressRing percent={displayPercent} size={56} strokeWidth={4} />
              <div className="flex items-center gap-3">
                <span className="cf-panel-muted rounded-lg px-2.5 py-1.5 text-xs font-medium text-(--cf-text-2)">
                  Avg Score: {avgScore}%
                </span>
                <span className="cf-panel-muted rounded-lg px-2.5 py-1.5 text-xs font-medium text-(--cf-text-2)">
                  {unlockedCount}/{totalCount} Unlocked
                </span>
              </div>
            </div>

            {/* Streak + social proof + time invested */}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-(--cf-text-3) md:justify-start">
              <span className="inline-flex items-center gap-1.5">
                <Flame className="h-3.5 w-3.5 text-(--cf-warning-text)" />
                Start your streak today!
              </span>
              {timeInvestedMinutes >= 30 && (
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  {formatTime(timeInvestedMinutes)} invested
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" style={{ color: "var(--text-secondary)" }} />
                {social.activeReaders} readers
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Trophy className="h-3.5 w-3.5" style={{ color: "var(--text-secondary)" }} />
                {social.completedReaders} completed
              </span>
            </div>

            {progressPercent === 0 && completedCount === 0 && (
              <p className="mt-3 text-sm font-medium text-(--cf-success-text)">
                You&apos;ve started your journey — keep going!
              </p>
            )}
          </div>
        </div>
      </div>
    </motion.section>
  );
}
