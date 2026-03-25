"use client";

import { useCallback, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check, Lock, Play } from "lucide-react";
import type { LibraryChapterSummary } from "@/app/book/_lib/library-data";
import { StepIndicators } from "./StepIndicators";

export type ChapterCardStatus =
  | "completed"
  | "in-progress"
  | "locked"
  | "next-unlockable";

type ChapterCardProps = {
  chapter: LibraryChapterSummary;
  status: ChapterCardStatus;
  score?: number;
  stepsCompleted: number;
  currentStepProgress?: number;
  teaser?: string;
  onClick: () => void;
  onLockedClick?: () => void;
  isCurrent?: boolean;
};

export function ChapterCard({
  chapter,
  status,
  score,
  stepsCompleted,
  currentStepProgress,
  teaser,
  onClick,
  onLockedClick,
  isCurrent = false,
}: ChapterCardProps) {
  const prefersReducedMotion = useReducedMotion();
  const [shaking, setShaking] = useState(false);

  const isLocked = status === "locked" || status === "next-unlockable";
  const isCompleted = status === "completed";
  const isInProgress = status === "in-progress";
  const isNextUnlockable = status === "next-unlockable";

  const handleClick = useCallback(() => {
    if (isLocked) {
      setShaking(true);
      setTimeout(() => setShaking(false), 300);
      onLockedClick?.();
      return;
    }
    onClick();
  }, [isLocked, onClick, onLockedClick]);

  /* ── Explicit text colors per state ── */
  const titleClass = isInProgress
    ? "text-slate-50 font-semibold"
    : isCompleted
      ? "text-slate-200 font-medium"
      : isNextUnlockable
        ? "text-slate-300 font-medium"
        : "text-slate-500 font-medium";

  const codeClass = isInProgress
    ? "text-indigo-400 font-semibold"
    : isCompleted
      ? "text-emerald-400/70 font-medium"
      : "text-slate-600 font-medium";

  const minutesClass = isLocked ? "text-slate-700" : "text-slate-600";

  /* ── Card wrapper (non-motion for locked; motion for interactive) ── */
  if (isLocked && !isNextUnlockable) {
    /* ━━━ LOCKED CARD ━━━ Solid bg, no backdrop-blur, 0.50 opacity, no hover */
    return (
      <div
        role="button"
        tabIndex={-1}
        onClick={handleClick}
        className={[
          "w-full rounded-2xl border border-white/[0.04] bg-[#0F1523] p-4 text-left opacity-50",
          "cursor-default select-none",
          shaking ? "bd-shake" : "",
        ].join(" ")}
        aria-disabled="true"
        aria-label={`Chapter ${chapter.number} - ${chapter.title} - Locked. Complete the previous chapter to unlock.`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.04]">
              <Lock className="h-3.5 w-3.5 text-slate-700" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className={`shrink-0 text-sm ${codeClass}`}>
                  {chapter.code}
                </span>
                <span className={`truncate ${titleClass}`}>
                  {chapter.title}
                </span>
              </div>
              <StepIndicators
                stepsCompleted={0}
                accentColor="green"
                lockedDots
              />
            </div>
          </div>
          <span className={`shrink-0 whitespace-nowrap text-xs ${minutesClass}`}>
            {chapter.minutes} min
          </span>
        </div>
      </div>
    );
  }

  if (isNextUnlockable) {
    /* ━━━ NEXT-UNLOCKABLE CARD ━━━ Dashed border, emerald tint, 0.65 opacity */
    return (
      <div
        role="button"
        tabIndex={-1}
        onClick={handleClick}
        className={[
          "w-full rounded-2xl border border-dashed border-emerald-500/15 bg-[#111827] p-4 text-left opacity-[0.65]",
          "cursor-default",
          shaking ? "bd-shake" : "",
        ].join(" ")}
        aria-disabled="true"
        aria-label={`Chapter ${chapter.number} - ${chapter.title} - Locked. Complete the previous chapter to unlock.`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/[0.08]">
              <Lock className="h-3.5 w-3.5 text-emerald-700" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className={`shrink-0 text-sm ${codeClass}`}>
                  {chapter.code}
                </span>
                <span className={`truncate ${titleClass}`}>
                  {chapter.title}
                </span>
              </div>
              <StepIndicators
                stepsCompleted={0}
                accentColor="green"
                lockedDots
              />
              <span className="mt-1 block text-xs font-medium text-emerald-500/60">
                Up next
              </span>
              {teaser && (
                <p className="mt-0.5 max-w-sm text-xs italic leading-relaxed text-slate-600">
                  &ldquo;{teaser}&rdquo;
                </p>
              )}
            </div>
          </div>
          <span className={`shrink-0 whitespace-nowrap text-xs ${minutesClass}`}>
            {chapter.minutes} min
          </span>
        </div>
      </div>
    );
  }

  /* ━━━ IN-PROGRESS & COMPLETED CARDS ━━━ Interactive, motion-enabled */
  return (
    <motion.button
      type="button"
      onClick={handleClick}
      whileHover={
        !prefersReducedMotion
          ? {
              y: -2,
              transition: {
                type: "spring" as const,
                stiffness: 400,
                damping: 25,
              },
            }
          : undefined
      }
      whileTap={{ scale: 0.985, transition: { duration: 0.1 } }}
      className={[
        "group relative w-full rounded-2xl border text-left",
        "[transform:translateZ(0)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0F1A]",
        isInProgress
          ? [
              "bg-[#131B2E] border-indigo-400/25 p-5 cursor-pointer overflow-hidden",
              isCurrent ? "bd-chapter-shimmer" : "",
            ].join(" ")
          : [
              "bg-[#111827] border-emerald-500/15 p-4 cursor-pointer",
              "hover:border-emerald-500/30",
            ].join(" "),
      ].join(" ")}
      style={
        isInProgress
          ? {
              boxShadow:
                "0 0 30px rgba(99, 102, 241, 0.08), inset 0 1px 0 rgba(255,255,255,0.05)",
            }
          : isCompleted
            ? { boxShadow: "0 0 20px rgba(52, 211, 153, 0.04)" }
            : undefined
      }
      aria-label={
        isCompleted && typeof score === "number"
          ? `Chapter ${chapter.number} - ${chapter.title} - Completed with ${Math.round(score)}% score`
          : `Chapter ${chapter.number} - ${chapter.title}`
      }
    >
      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          {/* Icon */}
          {isInProgress ? (
            <div className="relative mt-0.5 shrink-0">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-500/20">
                <Play className="ml-0.5 h-4 w-4 text-indigo-400" />
              </div>
              {!prefersReducedMotion && (
                <div
                  className="absolute inset-0 rounded-full border-2 border-indigo-400/30"
                  style={{
                    animation: "bd-pulse-ring 2.5s ease-out infinite",
                  }}
                />
              )}
            </div>
          ) : (
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/15">
              <Check className="h-4 w-4 text-emerald-400" />
            </div>
          )}

          {/* Content */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className={`shrink-0 text-sm ${codeClass}`}>
                {chapter.code}
              </span>
              <span className={`truncate ${titleClass}`}>
                {chapter.title}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <StepIndicators
                stepsCompleted={stepsCompleted}
                isInProgress={isInProgress}
                accentColor={isCompleted ? "green" : "indigo"}
              />
              {isInProgress && (
                <span className="text-xs text-slate-600">
                  {stepsCompleted}/4 steps
                </span>
              )}
            </div>
            {/* Progress bar for in-progress chapters */}
            {isInProgress && typeof currentStepProgress === "number" && (
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.08]">
                <div
                  className="h-full rounded-full bg-indigo-400 transition-[width] duration-300"
                  style={{
                    width: `${Math.max(currentStepProgress, 0)}%`,
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Right side */}
        <div className="ml-4 flex shrink-0 flex-col items-end gap-1">
          {isCompleted && typeof score === "number" ? (
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400">
              {Math.round(score)}%
            </span>
          ) : isInProgress ? (
            <span className="whitespace-nowrap text-sm font-semibold text-indigo-400 transition-colors hover:text-indigo-300">
              Continue →
            </span>
          ) : null}
          <span className={`whitespace-nowrap text-xs ${minutesClass}`}>
            {chapter.minutes} min
          </span>
        </div>
      </div>
    </motion.button>
  );
}
