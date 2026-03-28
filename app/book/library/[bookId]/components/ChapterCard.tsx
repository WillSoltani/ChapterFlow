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

  /* ── Text colors per state using theme-aware tokens ── */
  const titleClass = isInProgress
    ? "text-(--cf-text-1) font-semibold"
    : isCompleted
      ? "text-(--cf-text-1) font-medium"
      : isNextUnlockable
        ? "text-(--cf-text-2) font-medium"
        : "text-(--cf-text-3) font-medium";

  const codeClass = isInProgress
    ? "text-(--cf-accent) font-semibold"
    : isCompleted
      ? "text-(--cf-success-text) font-medium"
      : "text-(--cf-text-soft) font-medium";

  const minutesClass = isLocked ? "text-(--cf-text-soft)" : "text-(--cf-text-3)";

  /* ── LOCKED CARD ── solid bg, no backdrop-blur, dimmed, no hover */
  if (isLocked && !isNextUnlockable) {
    return (
      <div
        role="button"
        tabIndex={-1}
        onClick={handleClick}
        className={[
          "w-full rounded-2xl bg-(--cf-surface-muted) p-4 text-left opacity-50",
          "cursor-default select-none",
          shaking ? "bd-shake" : "",
        ].join(" ")}
        aria-disabled="true"
        aria-label={`Chapter ${chapter.number} - ${chapter.title} - Locked. Complete the previous chapter to unlock.`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-(--cf-surface-strong)">
              <Lock className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className={`shrink-0 text-sm ${codeClass}`}>{chapter.code}</span>
                <span className={`truncate ${titleClass}`}>{chapter.title}</span>
              </div>
              <StepIndicators stepsCompleted={0} accentColor="green" lockedDots />
            </div>
          </div>
          <span className="shrink-0 whitespace-nowrap text-xs" style={{ color: "var(--text-tertiary)" }}>
            {chapter.minutes} min
          </span>
        </div>
      </div>
    );
  }

  /* ── NEXT-UNLOCKABLE CARD ── dashed border, slight accent tint */
  if (isNextUnlockable) {
    return (
      <div
        role="button"
        tabIndex={-1}
        onClick={handleClick}
        className={[
          "w-full rounded-2xl border border-dashed border-(--cf-success-border) bg-(--cf-surface) p-4 text-left",
          "cursor-default",
          shaking ? "bd-shake" : "",
        ].join(" ")}
        aria-disabled="true"
        aria-label={`Chapter ${chapter.number} - ${chapter.title} - Locked. Complete the previous chapter to unlock.`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-(--cf-success-bg)">
              <Lock className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className={`shrink-0 text-sm ${codeClass}`}>{chapter.code}</span>
                <span className={`truncate ${titleClass}`}>{chapter.title}</span>
              </div>
              <StepIndicators stepsCompleted={0} accentColor="green" lockedDots />
              <span className="mt-1 block text-xs font-medium" style={{ color: "var(--accent-emerald)" }}>
                Up next
              </span>
              {teaser && (
                <p className="mt-0.5 max-w-sm text-xs italic leading-relaxed text-(--cf-text-soft)">
                  &ldquo;{teaser}&rdquo;
                </p>
              )}
            </div>
          </div>
          <span className="shrink-0 whitespace-nowrap text-xs" style={{ color: "var(--text-tertiary)" }}>
            {chapter.minutes} min
          </span>
        </div>
      </div>
    );
  }

  /* ── IN-PROGRESS & COMPLETED CARDS ── interactive, motion-enabled */
  return (
    <motion.button
      type="button"
      onClick={handleClick}
      whileHover={
        !prefersReducedMotion
          ? {
              y: -2,
              transition: { type: "spring" as const, stiffness: 400, damping: 25 },
            }
          : undefined
      }
      whileTap={{ scale: 0.985, transition: { duration: 0.1 } }}
      className={[
        "group relative w-full rounded-2xl text-left [transform:translateZ(0)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--cf-accent) focus-visible:ring-offset-2 focus-visible:ring-offset-(--cf-page-bg)",
        isInProgress
          ? [
              "bg-(--cf-surface-muted) p-5 cursor-pointer overflow-hidden",
              isCurrent ? "bd-chapter-shimmer" : "",
            ].join(" ")
          : [
              "cf-panel border border-(--cf-border) p-4 cursor-pointer",
              "hover:border-(--cf-success-text)/30",
            ].join(" "),
      ].join(" ")}
      style={
        isInProgress
          ? { borderLeft: "3px solid var(--accent-cyan)" }
          : isCompleted
            ? { borderLeft: "3px solid var(--accent-emerald)" }
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
              <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: "color-mix(in srgb, var(--accent-cyan) 12%, transparent)" }}>
                <Play className="ml-0.5 h-4 w-4" style={{ color: "var(--accent-cyan)" }} />
              </div>
              {!prefersReducedMotion && (
                <div
                  className="absolute inset-0 rounded-full"
                  style={{ border: "2px solid var(--accent-cyan)", opacity: 0.3, animation: "bd-pulse-ring 2.5s ease-out infinite" }}
                />
              )}
            </div>
          ) : (
            <div
              className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
              style={{ background: "color-mix(in srgb, var(--accent-emerald) 15%, transparent)" }}
            >
              <Check className="h-4 w-4" style={{ color: "var(--accent-emerald)" }} />
            </div>
          )}

          {/* Content */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className={`shrink-0 text-sm ${codeClass}`}>{chapter.code}</span>
              <span className={`truncate ${titleClass}`}>{chapter.title}</span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <StepIndicators
                stepsCompleted={stepsCompleted}
                isInProgress={isInProgress}
                accentColor={isCompleted ? "green" : "indigo"}
              />
              {isInProgress && (
                <span className="text-xs text-(--cf-text-soft)">{stepsCompleted}/4 steps</span>
              )}
            </div>
            {isInProgress && typeof currentStepProgress === "number" && (
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-(--cf-progress-track)">
                <div
                  className="h-full rounded-full bg-(--cf-accent) transition-[width] duration-300"
                  style={{ width: `${Math.max(currentStepProgress, 0)}%` }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Right side */}
        <div className="ml-4 flex shrink-0 flex-col items-end gap-1">
          {isCompleted && typeof score === "number" ? (
            <span className="cf-pill cf-pill-success rounded-full px-2.5 py-1 text-xs font-medium">
              {Math.round(score)}%
            </span>
          ) : isInProgress ? (
            <span className="whitespace-nowrap text-sm font-semibold transition-colors hover:opacity-80" style={{ color: "var(--accent-cyan)" }}>
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
