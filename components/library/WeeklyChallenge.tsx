"use client";

import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { DUR } from "@/lib/motion";
import type { WeeklyChallenge as WeeklyChallengeType } from "./libraryData";

interface WeeklyChallengeProps {
  challenge: WeeklyChallengeType;
  onBrowseCategory: (category: string) => void;
}

/**
 * Honest editorial nudge. The old "challenge" fabricated a 1/2 progress bar, an
 * "Ends in 4 days" countdown that never moved, and a "Reward: 100 IP + badge"
 * the backend never granted. There is no challenge-tracking backend, so this is
 * now a plain reading suggestion: a category to explore + a browse CTA. No
 * progress, no timer, no reward claim.
 */
export function WeeklyChallenge({ challenge, onBrowseCategory }: WeeklyChallengeProps) {
  const [dismissed, setDismissed] = useState(false);
  const prefersReduced = useReducedMotion();

  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.section
          initial={{ opacity: prefersReduced ? 1 : 0, y: prefersReduced ? 0 : 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, height: 0, marginTop: 0, padding: 0 }}
          transition={{ duration: DUR.fast, delay: 0.6 }}
          className="relative mt-10 overflow-hidden rounded-xl px-6 py-5"
          style={{
            maxWidth: 1080,
            margin: "40px auto 0",
            background: "rgba(245,158,11,0.04)",
            border: "1px solid var(--border-subtle)",
            borderLeft: "4px solid var(--accent-amber)",
          }}
        >
          {/* Dismiss — top-right, large enough to tap */}
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="absolute right-3 top-3 flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg transition-opacity"
            style={{ color: "var(--text-muted)", opacity: 0.6 }}
            aria-label="Dismiss this week's focus"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          <div className="flex items-start gap-4 pr-8">
            {/* Compass — "a direction to explore", not a trophy/prize */}
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
              style={{ background: "rgba(245,158,11,0.12)" }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--accent-amber)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
              </svg>
            </div>

            <div className="min-w-0">
              <p className="text-[14px] font-semibold" style={{ color: "var(--text-heading)" }}>
                This week&apos;s focus:{" "}
                <span style={{ color: "var(--cf-amber-text)" }}>{challenge.description}</span>
              </p>
              <p className="mt-1 text-[12px]" style={{ color: "var(--text-secondary)" }}>
                A gentle nudge to explore something new — no streak, no timer.
              </p>

              {challenge.category && (
                <button
                  type="button"
                  onClick={() => onBrowseCategory(challenge.category!)}
                  className="mt-3 inline-flex cursor-pointer items-center rounded-lg px-4 py-2 text-[13px] font-semibold transition-colors"
                  style={{
                    background: "rgba(245,158,11,0.1)",
                    border: "1px solid rgba(245,158,11,0.2)",
                    color: "var(--cf-amber-text)",
                  }}
                >
                  Browse {challenge.category} →
                </button>
              )}
            </div>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
