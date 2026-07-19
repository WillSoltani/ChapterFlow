"use client";

import { motion } from "framer-motion";
import { DUR } from "@/lib/motion";
import { Button } from "@/app/book/components/ui/Button";
import { LearningLoopSteps } from "./LearningLoopSteps";

export function MomentumCard({
  title,
  chapterLabel,
  mode,
  progress,
  bookEta,
  chapterMinutes,
  chapterNumber,
  totalChapters,
  completedSteps,
  dailyGoalMinutes,
  onContinue,
}: {
  title: string;
  chapterLabel: string;
  mode: string;
  progress: number;
  bookEta: string;
  chapterMinutes: number;
  chapterNumber: number;
  totalChapters: number;
  completedSteps: boolean[];
  dailyGoalMinutes: number;
  onContinue: () => void;
}) {
  const chapterEta = chapterMinutes > 0 ? `~${chapterMinutes} min for this chapter` : "";
  const fitsGoal = chapterMinutes > 0 && chapterMinutes <= dailyGoalMinutes + 5;

  return (
    <div className="relative overflow-hidden rounded-4xl border border-(--cf-accent-border) bg-linear-to-br from-(--cf-accent-soft) to-(--cf-surface-strong) p-6 shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-(--cf-accent)/8 blur-3xl" />
      <div className="relative">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex rounded-full border border-(--cf-accent-border) bg-(--cf-surface) px-3 py-1 text-cf-caption uppercase tracking-[0.22em] text-(--cf-info-text)">Currently reading</span>
          <span className="cf-pill px-3 py-1 text-cf-caption uppercase tracking-[0.22em]">{mode}</span>
        </div>
        <h3 className="mt-4 text-2xl font-bold tracking-tight text-(--cf-text-1) sm:text-3xl">{title}</h3>
        <p className="mt-2 text-sm text-(--cf-text-2)">{chapterLabel}</p>

        {/* B1: 4-step learning loop */}
        <div className="mt-5">
          <LearningLoopSteps completedSteps={completedSteps} />
        </div>

        {/* B2: Chapter-level time + book-level secondary */}
        <div className="mt-4 space-y-1">
          {chapterEta ? (
            <p className="text-sm font-bold text-(--cf-text-1)">
              {chapterEta}
              {fitsGoal ? <span className="ml-1 font-medium text-(--accent-cyan)">— fits in your {dailyGoalMinutes} min goal</span> : null}
            </p>
          ) : null}
          <p className="text-xs text-(--cf-text-3)">
            Chapter {chapterNumber} of {totalChapters} &middot; <span className="font-semibold">{bookEta}</span> total remaining
          </p>
        </div>

        {/* Book progress bar */}
        <motion.div className="mt-4 h-2 overflow-hidden rounded-full bg-(--cf-border)">
          <motion.div
            className="h-full rounded-full bg-linear-to-r from-(--cf-accent) to-(--cf-accent-strong)"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: DUR.reveal, ease: "easeOut" }}
          />
        </motion.div>
        <p className="mt-1 text-right text-xs text-(--cf-text-soft)">{Math.round(progress)}% complete</p>

        {/* B3: Pulsing glow CTA */}
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={onContinue}
          className="mt-4 cf-cta-pulse"
        >
          Continue Reading &rarr;
        </Button>
        <style>{`
          @keyframes cf-cta-glow { 0%,100% { box-shadow: 0 0 16px color-mix(in srgb, var(--cf-data-blue) 20%, transparent); } 50% { box-shadow: 0 0 28px color-mix(in srgb, var(--cf-data-blue) 40%, transparent); } }
          .cf-cta-pulse { animation: cf-cta-glow 3s ease-in-out infinite; }
          @media (prefers-reduced-motion: reduce) { .cf-cta-pulse { animation: none; } }
        `}</style>
      </div>
    </div>
  );
}
