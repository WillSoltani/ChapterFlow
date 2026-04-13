"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Share2, Check } from "lucide-react";

interface Props {
  chapterTitle: string;
  chapterNumber: number;
  quizScore: number;
  streak: number;
  insightPointsEarned: number;
  hasNextChapter: boolean;
  onNext: () => void;
  onLibrary: () => void;
  onShare?: () => Promise<"shared" | "copied" | "unsupported"> | void;
  children?: React.ReactNode;
}

export function ChapterCompleteModal({
  chapterTitle,
  chapterNumber,
  quizScore,
  streak,
  insightPointsEarned,
  hasNextChapter,
  onNext,
  onLibrary,
  onShare,
  children,
}: Props) {
  const prefersReducedMotion = useReducedMotion();
  const [shareFeedback, setShareFeedback] = useState(false);

  const phases: Array<{ label: string; done: boolean; score?: number }> = [
    { label: "Summary", done: true },
    { label: "Examples", done: true },
    { label: "Quiz", done: true, score: quizScore },
  ];

  return (
    <motion.div
      className="fixed inset-0 z-50 overflow-y-auto px-4 py-8"
      style={{
        background: "rgba(0,0,0,0.85)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
      initial={prefersReducedMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      role="dialog"
      aria-modal="true"
      aria-label="Chapter complete"
    >
      <motion.div
        className="mx-auto rounded-2xl p-6 sm:p-8 w-full max-w-2xl bg-(--cr-bg-surface-2) my-8"
        style={{
          border:
            "1px solid color-mix(in srgb, var(--cr-accent) 25%, transparent)",
        }}
        initial={prefersReducedMotion ? false : { scale: 0.96, y: 24 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 22, delay: 0.1 }}
      >
        <div className="text-center mb-6">
          <div className="text-[40px] mb-2">{"\u2705"}</div>
          <h2
            className="text-[22px] font-bold mb-1 text-(--cr-text-heading)"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Chapter {chapterNumber} Complete
          </h2>
          <p className="text-[14px] text-(--cr-text-disabled)">
            {chapterTitle}
          </p>
        </div>

        <div className="flex gap-2 justify-center flex-wrap mb-5">
          {phases.map((p) => (
            <span
              key={p.label}
              className="inline-flex items-center gap-1 text-[12px] font-medium px-3 py-1 rounded-full text-(--cr-accent)"
              style={{
                background:
                  "color-mix(in srgb, var(--cr-accent) 12%, transparent)",
                border:
                  "1px solid color-mix(in srgb, var(--cr-accent) 26%, transparent)",
              }}
            >
              {"\u2713"} {p.label}
              {p.score !== undefined ? ` ${p.score}%` : ""}
            </span>
          ))}
        </div>

        <div className="flex justify-center gap-6 mb-6 text-center">
          {streak > 1 && (
            <div>
              <p className="text-[22px] font-bold text-(--cr-accent)">
                {"\uD83D\uDD25"} {streak}
              </p>
              <p className="text-[11px] text-(--cr-text-disabled)">
                chapter streak
              </p>
            </div>
          )}
          {insightPointsEarned > 0 && (
            <div>
              <p className="text-[22px] font-bold text-(--cr-accent)">
                +{insightPointsEarned}
              </p>
              <p className="text-[11px] text-(--cr-text-disabled)">
                insight points
              </p>
            </div>
          )}
        </div>

        {children && (
          <div className="mt-2 mb-6 border-t border-(--cr-glass-border) pt-6">
            {children}
          </div>
        )}

        <div className="flex flex-col gap-3">
          {hasNextChapter && (
            <button
              type="button"
              onClick={onNext}
              className="w-full py-3.5 rounded-full font-semibold text-[15px] bg-(--cr-accent) text-(--cr-text-inverse) transition-transform hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--cr-accent)_60%,transparent)] focus-visible:ring-offset-2"
            >
              Open Next Chapter &rarr;
            </button>
          )}
          {onShare && (
            <button
              type="button"
              onClick={async () => {
                const result = await onShare();
                if (result === "shared" || result === "copied") {
                  setShareFeedback(true);
                  setTimeout(() => setShareFeedback(false), 2000);
                }
              }}
              className="inline-flex w-full items-center justify-center gap-2 py-3 rounded-full font-medium text-[14px] border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--cr-accent)_55%,transparent)] focus-visible:ring-offset-2"
              style={{
                borderColor: "color-mix(in srgb, var(--cr-accent) 25%, transparent)",
                background: "var(--cr-accent-muted)",
                color: "var(--cr-accent)",
              }}
            >
              {shareFeedback ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
              {shareFeedback ? "Copied!" : `Share ${hasNextChapter ? "Chapter" : "Book"} Completion`}
            </button>
          )}
          <button
            type="button"
            onClick={onLibrary}
            className="w-full py-3 rounded-full font-medium text-[14px] border border-(--cr-glass-border) text-(--cr-text-secondary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--cr-accent)_55%,transparent)] focus-visible:ring-offset-2"
          >
            Back to Library
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
