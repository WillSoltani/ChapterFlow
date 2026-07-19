"use client";

import { useCallback, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { DUR } from "@/lib/motion";
import { Check, Lock, Play } from "lucide-react";
import type { LibraryChapterSummary } from "@/app/book/_lib/library-data";
import type { ChapterApplicationState } from "@/app/app/api/book/_lib/types";
import { getChapterApplicationBadge } from "@/app/book/_lib/application-display";
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
  /** Two-axis completion (feedback #4): derived application state for this chapter.
   *  Display-only; defaults to "none" (renders nothing extra). */
  applicationState?: ChapterApplicationState;
  onClick: () => void;
  onLockedClick?: () => void;
  onMouseEnter?: () => void;
  isCurrent?: boolean;
};

export function ChapterCard({
  chapter,
  status,
  score,
  stepsCompleted,
  applicationState = "none",
  onClick,
  onLockedClick,
  onMouseEnter,
  isCurrent = false,
}: ChapterCardProps) {
  const prefersReducedMotion = useReducedMotion();
  const [shaking, setShaking] = useState(false);

  const isLocked = status === "locked" || status === "next-unlockable";
  const isCompleted = status === "completed";
  const isInProgress = status === "in-progress";
  const isNextUnlockable = status === "next-unlockable";
  // Two-axis completion (feedback #4): the compact applied/committed indicator.
  // null for "none" → nothing extra is rendered (locked cards never reach here).
  const appBadge = getChapterApplicationBadge(applicationState);

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
        onMouseEnter={onMouseEnter}
        className={[
          "w-full rounded-2xl bg-(--cf-surface-muted) p-4 text-left",
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
                <span className={`shrink-0 text-cf-caption font-medium uppercase tracking-wide tabular-nums ${codeClass}`}>{chapter.code}</span>
                <span className={`line-clamp-2 text-cf-body sm:truncate ${titleClass}`} title={chapter.title}>{chapter.title}</span>
              </div>
              <StepIndicators stepsCompleted={0} lockedDots />
            </div>
          </div>
          <span className="shrink-0 whitespace-nowrap text-xs text-(--cf-text-soft)">
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
        onMouseEnter={onMouseEnter}
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
                <span className={`shrink-0 text-cf-caption font-medium uppercase tracking-wide tabular-nums ${codeClass}`}>{chapter.code}</span>
                <span className={`line-clamp-2 text-cf-body sm:truncate ${titleClass}`} title={chapter.title}>{chapter.title}</span>
              </div>
              <StepIndicators stepsCompleted={0} lockedDots />
              <span className="mt-1 block text-xs font-medium" style={{ color: "var(--accent-emerald)" }}>
                Up next
              </span>
            </div>
          </div>
          <span className="shrink-0 whitespace-nowrap text-xs text-(--cf-text-soft)">
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
        onMouseEnter={onMouseEnter}
      whileHover={
        !prefersReducedMotion
          ? {
              y: -2,
              transition: { type: "spring" as const, stiffness: 400, damping: 25 },
            }
          : undefined
      }
      whileTap={{ scale: 0.97, transition: { duration: DUR.instant } }}
      className={[
        "group relative w-full rounded-2xl text-left [transform:translateZ(0)]",
        "cf-focus",
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
        (isCompleted && typeof score === "number"
          ? `Chapter ${chapter.number} - ${chapter.title} - Completed with ${Math.round(score)}% score`
          : `Chapter ${chapter.number} - ${chapter.title}`) + (appBadge?.srSuffix ?? "")
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
              <span className={`shrink-0 text-cf-caption font-medium uppercase tracking-wide tabular-nums ${codeClass}`}>{chapter.code}</span>
              <span className={`line-clamp-2 text-cf-body sm:truncate ${titleClass}`} title={chapter.title}>{chapter.title}</span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <StepIndicators
                stepsCompleted={stepsCompleted}
                isInProgress={isInProgress}
              />
            </div>
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
          {appBadge && (
            <span
              aria-hidden="true"
              className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-cf-caption font-medium"
              style={
                appBadge.tone === "applied"
                  ? {
                      background: "color-mix(in srgb, var(--accent-gold) 14%, transparent)",
                      color: "var(--cf-gold-text)",
                    }
                  : {
                      background: "color-mix(in srgb, var(--accent-cyan) 12%, transparent)",
                      color: "var(--cf-text-2)",
                    }
              }
            >
              {appBadge.tone === "applied" ? (
                <Check className="h-3 w-3" aria-hidden="true" style={{ color: "var(--accent-gold)" }} />
              ) : (
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  aria-hidden="true"
                  style={{ background: "var(--accent-cyan)" }}
                />
              )}
              {appBadge.label}
            </span>
          )}
          <span className={`whitespace-nowrap text-xs ${minutesClass}`}>
            {chapter.minutes} min
          </span>
        </div>
      </div>
    </motion.button>
  );
}
