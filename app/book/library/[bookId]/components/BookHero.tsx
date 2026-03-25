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

/** Generate deterministic social proof numbers from a string seed */
function seededSocial(bookId: string) {
  let hash = 0;
  for (let i = 0; i < bookId.length; i++) {
    hash = (hash << 5) - hash + bookId.charCodeAt(i);
    hash |= 0;
  }
  const abs = Math.abs(hash);
  return {
    activeReaders: 120 + (abs % 400),
    completedReaders: 30 + (abs % 150),
  };
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

  // Endowed progress: show ~8% for brand-new users
  const displayPercent =
    progressPercent === 0 && completedCount === 0 ? 8 : progressPercent;

  // Dynamic CTA text
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

  // Difficulty pill styling
  const diffPill =
    entry.difficulty === "Easy"
      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20"
      : entry.difficulty === "Medium"
        ? "bg-amber-500/15 text-amber-400 border-amber-500/20"
        : "bg-red-500/15 text-red-400 border-red-500/20";

  return (
    <motion.section
      initial={prefersReducedMotion ? undefined : { opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        prefersReducedMotion
          ? { duration: 0 }
          : {
              duration: 0.5,
              ease: [0.25, 0.46, 0.45, 0.94],
              delay: 0.1,
            }
      }
      className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.04] p-6 backdrop-blur-xl [-webkit-backdrop-filter:blur(20px)] [transform:translateZ(0)] sm:p-8 lg:rounded-3xl"
    >
      {/* Solid fallback behind glass for text legibility */}
      <div
        className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[#111827] opacity-80"
        aria-hidden="true"
      />
      {/* Top-edge glass highlight — mimics light hitting a glass surface */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.12] to-transparent"
        aria-hidden="true"
      />

      <div className="relative z-10">
        {/* Hero layout: cover left, info right on desktop; stacked on mobile */}
        <div className="flex flex-col items-center gap-6 md:flex-row md:items-start md:gap-8">
          {/* Book cover */}
          <motion.div
            initial={prefersReducedMotion ? undefined : { opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={
              prefersReducedMotion
                ? { duration: 0 }
                : { duration: 0.4, delay: 0.2 }
            }
            className="shrink-0"
          >
            <BookCover
              bookId={entry.id}
              title={entry.title}
              icon={entry.icon}
              coverImage={entry.coverImage}
              className="h-52 w-36 rounded-xl border border-white/[0.08] shadow-2xl md:h-72 md:w-48"
              fallbackClassName="text-6xl"
              sizes="220px"
            />
          </motion.div>

          {/* Info column */}
          <div className="flex min-w-0 flex-1 flex-col items-center text-center md:items-start md:text-left">
            {/* Title + author */}
            <motion.h1
              initial={prefersReducedMotion ? undefined : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={
                prefersReducedMotion
                  ? { duration: 0 }
                  : { duration: 0.4, delay: 0.4 }
              }
              className="text-2xl font-bold tracking-tight text-slate-50 sm:text-3xl md:text-4xl"
              style={{ fontFamily: "var(--font-satoshi)" }}
            >
              {entry.title}
            </motion.h1>
            <motion.p
              initial={prefersReducedMotion ? undefined : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={
                prefersReducedMotion
                  ? { duration: 0 }
                  : { duration: 0.4, delay: 0.45 }
              }
              className="mt-1 text-base text-slate-400"
            >
              by {entry.author}
            </motion.p>

            {/* Tag pills */}
            <motion.div
              initial={prefersReducedMotion ? undefined : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={
                prefersReducedMotion
                  ? { duration: 0 }
                  : { duration: 0.4, delay: 0.5 }
              }
              className="mt-3 flex flex-wrap justify-center gap-2 md:justify-start"
            >
              <span className="rounded-full border border-white/[0.10] bg-white/[0.08] px-3 py-1 text-xs text-slate-300">
                {entry.category}
              </span>
              <span
                className={`rounded-full border px-3 py-1 text-xs font-medium ${diffPill}`}
              >
                {entry.difficulty}
              </span>
              <span className="rounded-full border border-white/[0.10] bg-white/[0.08] px-3 py-1 text-xs text-slate-300">
                {pages} pages
              </span>
            </motion.div>

            {/* CTA + Save button */}
            <motion.div
              initial={
                prefersReducedMotion
                  ? undefined
                  : { opacity: 0, scale: 0.95 }
              }
              animate={{ opacity: 1, scale: 1 }}
              transition={
                prefersReducedMotion
                  ? { duration: 0 }
                  : {
                      duration: 0.3,
                      type: "spring" as const,
                      stiffness: 300,
                      damping: 25,
                      delay: 0.45,
                    }
              }
              className="mt-5 flex items-center gap-3"
            >
              <button
                type="button"
                onClick={onContinue}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-8 py-3.5 text-base font-semibold text-[#0B0F1A] shadow-[0_0_20px_rgba(52,211,153,0.25)] transition-all duration-200 hover:bg-emerald-400 hover:shadow-[0_0_30px_rgba(52,211,153,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0F1A]"
              >
                <span>{ctaText}</span>
                {ctaIcon}
              </button>
              <BookSaveButton
                saved={isSaved}
                onToggle={onToggleSaved}
                className="h-11 w-11 rounded-xl"
              />
            </motion.div>

            {/* Progress ring + stat chips */}
            <div className="mt-5 flex flex-wrap items-center justify-center gap-4 md:justify-start">
              <ProgressRing
                percent={displayPercent}
                size={56}
                strokeWidth={4}
              />
              <div className="flex items-center gap-3">
                <span className="rounded-lg bg-white/[0.06] px-2.5 py-1.5 text-xs font-medium text-slate-400">
                  Avg Score: {avgScore}%
                </span>
                <span className="rounded-lg bg-white/[0.06] px-2.5 py-1.5 text-xs font-medium text-slate-400">
                  {unlockedCount}/{totalCount} Unlocked
                </span>
              </div>
            </div>

            {/* Streak + social proof + time invested row */}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-slate-500 md:justify-start">
              {/* Streak placeholder */}
              <span className="inline-flex items-center gap-1.5">
                <Flame className="h-3.5 w-3.5 text-orange-400" />
                Start your streak today!
              </span>

              {/* Time invested (only show if >= 30 min) */}
              {timeInvestedMinutes >= 30 && (
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  {formatTime(timeInvestedMinutes)} invested
                </span>
              )}

              {/* Social proof */}
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                {social.activeReaders} readers
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Trophy className="h-3.5 w-3.5" />
                {social.completedReaders} completed
              </span>
            </div>

            {/* Endowed progress message for new users */}
            {progressPercent === 0 && completedCount === 0 && (
              <p className="mt-3 text-sm font-medium text-emerald-400">
                You&apos;ve started your journey — keep going!
              </p>
            )}
          </div>
        </div>
      </div>
    </motion.section>
  );
}
