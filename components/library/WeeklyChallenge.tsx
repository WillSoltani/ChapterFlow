"use client";

import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import type { WeeklyChallenge as WeeklyChallengeType } from "./libraryData";

interface WeeklyChallengeProps {
  challenge: WeeklyChallengeType;
  onBrowseCategory: (category: string) => void;
}

export function WeeklyChallenge({
  challenge,
  onBrowseCategory,
}: WeeklyChallengeProps) {
  const [dismissed, setDismissed] = useState(false);
  const prefersReduced = useReducedMotion();

  // Visual progress dots
  const dots = Array.from({ length: challenge.progress.target }, (_, i) => i);

  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.section
          initial={{ opacity: prefersReduced ? 1 : 0, y: prefersReduced ? 0 : 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, height: 0, marginTop: 0, padding: 0 }}
          transition={{ duration: 0.25, delay: 0.9 }}
          className="relative mt-10 overflow-hidden rounded-xl px-6 py-5"
          style={{
            maxWidth: 1080,
            margin: "40px auto 0",
            background: "rgba(232,185,49,0.04)",
            borderLeft: "4px solid var(--accent-gold)",
            border: "1px solid rgba(232,185,49,0.15)",
            borderLeftWidth: 4,
            borderLeftColor: "var(--accent-gold)",
          }}
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {/* Trophy icon — gold */}
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                style={{ background: "rgba(232,185,49,0.12)" }}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--accent-gold)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                  <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                  <path d="M4 22h16" />
                  <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22" />
                  <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22" />
                  <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
                </svg>
              </div>

              <div>
                <p className="text-[14px] font-semibold" style={{ color: "var(--text-heading)" }}>
                  This week&apos;s challenge:{" "}
                  <span style={{ color: "var(--cf-amber-text)" }}>
                    {challenge.description}
                  </span>
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-[12px]" style={{ color: "var(--text-secondary)" }}>
                  {/* Reward */}
                  <span>
                    Reward: {challenge.reward.xp} XP
                    {challenge.reward.badge && <> + &ldquo;{challenge.reward.badge}&rdquo; badge</>}
                  </span>

                  {/* Visual progress dots */}
                  <span className="flex items-center gap-1.5">
                    {dots.map((_, j) => (
                      <span
                        key={j}
                        className="inline-block h-2 w-2 rounded-full"
                        style={{
                          background:
                            j < challenge.progress.current
                              ? "var(--accent-teal)"
                              : "var(--cf-progress-track)",
                          boxShadow:
                            j < challenge.progress.current
                              ? "0 0 4px var(--accent-teal)"
                              : "none",
                        }}
                      />
                    ))}
                    <span className="ml-0.5 font-(family-name:--font-mono)" style={{ color: "var(--cf-amber-text)" }}>
                      {challenge.progress.current}/{challenge.progress.target}
                    </span>
                  </span>

                  {/* Urgency — Scarcity (Cialdini) */}
                  <span style={{ color: "var(--cf-amber-text)" }}>
                    Ends in 4 days
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {challenge.category && (
                <button
                  type="button"
                  onClick={() => onBrowseCategory(challenge.category!)}
                  className="hidden cursor-pointer rounded-lg px-4 py-2 text-[13px] font-semibold transition-colors md:block"
                  style={{
                    background: "rgba(232,185,49,0.1)",
                    border: "1px solid rgba(232,185,49,0.2)",
                    color: "var(--cf-amber-text)",
                  }}
                >
                  Browse {challenge.category} →
                </button>
              )}
              <button
                type="button"
                onClick={() => setDismissed(true)}
                className="cursor-pointer p-1 transition-opacity"
                style={{ color: "var(--text-muted)", opacity: 0.5 }}
                aria-label="Dismiss challenge"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
