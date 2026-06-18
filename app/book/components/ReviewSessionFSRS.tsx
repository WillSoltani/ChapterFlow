"use client";

import { useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DUR, EASE } from "@/lib/motion";
import {
  Brain,
  X,
  Check,
  RotateCcw,
  ChevronRight,
  Zap,
  Sparkles,
} from "lucide-react";
import { useReviewQueue } from "@/app/book/hooks/useReviewQueue";
import { getBookById } from "@/app/book/data/booksCatalog";
import { cn } from "@/app/book/components/ui/cn";
import type { FSRSRating } from "@/app/app/api/book/_lib/types";

type Props = {
  bookId?: string;
  onClose: () => void;
};

const RATING_CONFIG: Record<
  FSRSRating,
  {
    label: string;
    sublabel: string;
    icon: React.ReactNode;
    border: string;
    bg: string;
    bgHover: string;
    text: string;
    hoverGlow: string;
  }
> = {
  1: {
    label: "Again",
    sublabel: "Tomorrow",
    icon: <RotateCcw className="h-4 w-4" />,
    border: "border-(--cf-danger-border)",
    bg: "bg-(--cf-danger-soft)",
    bgHover: "hover:bg-(--cf-danger-bg)",
    text: "text-(--cf-danger-text)",
    hoverGlow: "hover:shadow-[0_0_20px_var(--cf-danger-soft)]",
  },
  2: {
    label: "Hard",
    sublabel: "2-3 days",
    icon: <Brain className="h-4 w-4" />,
    border: "border-(--cf-warning-border)",
    bg: "bg-(--cf-warning-soft)",
    bgHover: "hover:bg-(--cf-warning-bg)",
    text: "text-(--cf-warning-text)",
    hoverGlow: "hover:shadow-[0_0_20px_var(--cf-warning-soft)]",
  },
  3: {
    label: "Good",
    sublabel: "~1 week",
    icon: <Check className="h-4 w-4" />,
    border: "border-(--cf-info-border)",
    bg: "bg-(--cf-info-soft)",
    bgHover: "hover:bg-(--cf-info-bg)",
    text: "text-(--cf-info-text)",
    hoverGlow: "hover:shadow-[0_0_20px_var(--cf-info-soft)]",
  },
  4: {
    label: "Easy",
    sublabel: "~2 weeks",
    icon: <Zap className="h-4 w-4" />,
    border: "border-(--cf-success-border)",
    bg: "bg-(--cf-success-soft)",
    bgHover: "hover:bg-(--cf-success-bg)",
    text: "text-(--cf-success-text)",
    hoverGlow: "hover:shadow-[0_0_20px_var(--cf-success-soft)]",
  },
};

function resolveBookTitle(bookId: string): string {
  return getBookById(bookId)?.title ?? bookId;
}

export function ReviewSessionFSRS({ bookId, onClose }: Props) {
  const {
    currentCard,
    isComplete,
    loading,
    cards,
    currentIndex,
    submitRating,
  } = useReviewQueue(bookId);

  const [flipped, setFlipped] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleRate = useCallback(
    async (rating: FSRSRating) => {
      if (submitting) return;
      setSubmitting(true);
      await submitRating(rating);
      setFlipped(false);
      setSubmitting(false);
    },
    [submitting, submitRating],
  );

  const total = cards.length;
  const progressPercent = total > 0 ? (currentIndex / total) * 100 : 0;

  // ── Loading ──
  if (loading) {
    return (
      <div className="cf-overlay fixed inset-0 z-50 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: DUR.normal, ease: EASE.standard }}
          className="flex flex-col items-center gap-4"
        >
          <div className="relative flex h-14 w-14 items-center justify-center">
            <span className="absolute inset-0 animate-spin rounded-full border-2 border-(--cf-border) border-t-(--cf-accent)" />
            <Brain className="h-6 w-6 text-(--cf-accent)" />
          </div>
          <p className="text-sm font-medium text-(--cf-text-2)">
            Loading review cards...
          </p>
        </motion.div>
      </div>
    );
  }

  // ── Empty state ──
  if (cards.length === 0) {
    return (
      <div className="cf-overlay fixed inset-0 z-50 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: DUR.page, ease: EASE.standard }}
          className="cf-panel mx-4 max-w-sm rounded-4xl p-8 text-center"
        >
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-(--cf-accent-soft)">
            <Check className="h-7 w-7 text-(--cf-accent)" />
          </div>
          <h2 className="text-xl font-semibold text-(--cf-text-1)">
            All caught up!
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-(--cf-text-3)">
            No cards due right now. Check back later as your memory schedule
            evolves.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="cf-btn cf-btn-primary mt-6 w-full rounded-2xl text-sm"
          >
            Back to Dashboard
          </button>
        </motion.div>
      </div>
    );
  }

  // ── Completion screen ──
  if (isComplete) {
    return (
      <div className="cf-overlay fixed inset-0 z-50 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: DUR.slow, ease: EASE.standard }}
          className="cf-panel relative mx-4 max-w-sm overflow-hidden rounded-4xl p-8 text-center"
        >
          {/* Ambient glow */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-(--cf-success-soft) blur-3xl"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-12 -left-12 h-40 w-40 rounded-full bg-(--cf-accent-soft) blur-3xl"
          />

          <div className="relative">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{
                type: "spring",
                stiffness: 300,
                damping: 20,
                delay: 0.15,
              }}
              className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-(--cf-success-soft) shadow-[0_0_40px_var(--cf-success-soft)]"
            >
              <Sparkles className="h-9 w-9 text-(--cf-success-text)" />
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: DUR.page, ease: EASE.standard }}
              className="text-2xl font-bold text-(--cf-text-1)"
            >
              Session Complete!
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: DUR.page, ease: EASE.standard }}
              className="mt-2 text-sm leading-relaxed text-(--cf-text-3)"
            >
              You reviewed{" "}
              <span className="font-semibold text-(--cf-text-1)">
                {total} card{total !== 1 ? "s" : ""}
              </span>
              . Your memory is getting stronger with each session.
            </motion.p>

            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45, duration: DUR.page, ease: EASE.standard }}
              type="button"
              onClick={onClose}
              className="cf-btn cf-btn-primary mt-7 w-full rounded-2xl text-sm"
            >
              Done
              <ChevronRight className="h-4 w-4" />
            </motion.button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!currentCard) return null;

  const bookTitle = resolveBookTitle(currentCard.bookId);

  // ── Main review session ──
  return (
    <div className="cf-overlay fixed inset-0 z-50 flex flex-col">
      {/* ── Header ── */}
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: DUR.normal, ease: EASE.standard }}
        className="flex items-center justify-between border-b border-(--cf-border) px-4 py-3 sm:px-6"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-(--cf-accent-soft)">
            <Brain className="h-4 w-4 text-(--cf-accent)" />
          </div>
          <div>
            <p className="text-sm font-semibold text-(--cf-text-1)">
              Spaced Review
            </p>
            <p className="text-xs text-(--cf-text-3)">
              {bookTitle} &middot; Ch {currentCard.chapterNumber}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-xs font-medium text-(--cf-text-3)">
            {currentIndex + 1}{" "}
            <span className="text-(--cf-text-soft)">of</span> {total}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-(--cf-border) bg-(--cf-surface-muted) text-(--cf-text-3) transition hover:border-(--cf-border-strong) hover:text-(--cf-text-2)"
            aria-label="Close review session"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </motion.header>

      {/* ── Progress bar ── */}
      <div className="h-1 w-full bg-(--cf-surface-muted)">
        <motion.div
          className="h-full bg-linear-to-r from-(--cf-accent) to-(--cf-accent-strong) shadow-[0_0_8px_var(--cf-accent-shadow)]"
          initial={{ width: 0 }}
          animate={{ width: `${progressPercent}%` }}
          transition={{ duration: DUR.slow, ease: EASE.standard }}
        />
      </div>

      {/* ── Card area ── */}
      <div className="flex flex-1 items-center justify-center overflow-hidden px-4 py-6">
        <div className="w-full max-w-lg">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentCard.cardId + (flipped ? "-back" : "-front")}
              initial={{ opacity: 0, x: flipped ? 0 : 60, scale: 0.97 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -60, scale: 0.97 }}
              transition={{ duration: DUR.normal, ease: EASE.standard }}
              className={cn(
                "cf-panel relative min-h-55 cursor-pointer overflow-hidden rounded-2xl p-6 sm:p-8",
                !flipped && "cf-panel-hover",
              )}
              onClick={() => !flipped && setFlipped(true)}
            >
              {/* Subtle gradient accent */}
              <span
                aria-hidden="true"
                className={cn(
                  "pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full blur-3xl transition-opacity duration-700",
                  flipped
                    ? "bg-(--cf-accent-soft) opacity-100"
                    : "bg-(--cf-accent-muted) opacity-60",
                )}
              />

              <div className="relative">
                <span
                  className={cn(
                    "mb-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.16em]",
                    flipped
                      ? "border-(--cf-accent-border) bg-(--cf-accent-soft) text-(--cf-accent)"
                      : "border-(--cf-border) bg-(--cf-surface-muted) text-(--cf-text-3)",
                  )}
                >
                  {flipped ? "Answer" : "Question"}
                </span>

                <p className="text-lg font-medium leading-relaxed text-(--cf-text-1) sm:text-xl">
                  {flipped ? currentCard.back : currentCard.front}
                </p>

                {!flipped && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="mt-8 text-center text-xs text-(--cf-text-soft)"
                  >
                    Tap to reveal answer
                  </motion.p>
                )}
              </div>
            </motion.div>
          </AnimatePresence>

          {/* ── Rating buttons ── */}
          <AnimatePresence>
            {flipped && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 16 }}
                transition={{ duration: DUR.normal, ease: EASE.standard }}
                className="mt-4 grid grid-cols-4 gap-2"
              >
                {([1, 2, 3, 4] as FSRSRating[]).map((rating, i) => {
                  const c = RATING_CONFIG[rating];
                  return (
                    <motion.button
                      key={rating}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        delay: 0.05 * i,
                        duration: DUR.normal,
                        ease: EASE.standard,
                      }}
                      type="button"
                      onClick={() => handleRate(rating)}
                      disabled={submitting}
                      className={cn(
                        "cf-pressable flex flex-col items-center gap-1 rounded-2xl border px-2 py-3 text-sm font-semibold transition-all duration-200 disabled:opacity-40",
                        "motion-safe:hover:scale-[1.04] motion-safe:hover:-translate-y-0.5",
                        c.border,
                        c.bg,
                        c.bgHover,
                        c.text,
                        c.hoverGlow,
                      )}
                    >
                      {c.icon}
                      <span>{c.label}</span>
                      <span className="text-[0.6rem] font-normal opacity-60">
                        {c.sublabel}
                      </span>
                    </motion.button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
