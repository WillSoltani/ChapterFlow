"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "@/app/book/components/ui/cn";
import type { BadgeWithProgress } from "../lib/badge-types";
import { TIER_BORDER_COLORS } from "../lib/badge-utils";

type BadgeTimelineProps = {
  earnedBadges: BadgeWithProgress[];
  onBadgeClick: (badge: BadgeWithProgress) => void;
};

export function BadgeTimeline({ earnedBadges, onBadgeClick }: BadgeTimelineProps) {
  const [expanded, setExpanded] = useState(false);
  const reduced = useReducedMotion();

  const sorted = [...earnedBadges]
    .filter((b) => b.earnedDate)
    .sort((a, b) => new Date(b.earnedDate!).getTime() - new Date(a.earnedDate!).getTime());

  const defaultCount = 5;
  const needsExpand = sorted.length > defaultCount;
  const visible = expanded ? sorted : sorted.slice(0, defaultCount);

  if (sorted.length === 0) {
    return (
      <div>
        <h2 className="text-base font-semibold tracking-tight text-(--cf-text-1)">
          Your Reading Journey
        </h2>
        <div className="mt-4 rounded-2xl border border-(--cf-border) bg-(--cf-surface-muted) px-5 py-8 text-center">
          <p className="text-sm text-(--cf-text-3)">
            Your story is just beginning. Earn your first badge to see your journey unfold here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-base font-semibold tracking-tight text-(--cf-text-1)">
        Your Reading Journey
      </h2>

      <div className="relative mt-4 pl-8">
        {/* Continuous vertical line */}
        <div
          className="absolute left-[15px] top-3"
          style={{ bottom: 12, width: 2, background: "var(--cf-border)" }}
        />

        <AnimatePresence initial={false}>
          <div className="space-y-5">
            {visible.map((badge, i) => {
              const isRecent = badge.earnedDate
                ? (Date.now() - new Date(badge.earnedDate).getTime()) < 7 * 24 * 60 * 60 * 1000
                : false;

              return (
                <motion.div
                  key={badge.id}
                  initial={reduced ? false : { opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.25, delay: i * 0.04 }}
                >
                  <button
                    type="button"
                    onClick={() => onBadgeClick(badge)}
                    className="group relative flex items-start gap-3 text-left transition hover:opacity-90"
                  >
                    {/* Timeline dot on the line -- 8px amber */}
                    <div
                      className="absolute -left-8 top-1.5 rounded-full"
                      style={{
                        width: 8,
                        height: 8,
                        backgroundColor: "var(--accent-amber)",
                        border: "2px solid var(--cf-surface)",
                      }}
                    />

                    {/* Badge icon */}
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-(--cf-border) bg-(--cf-surface-muted) text-lg">
                      {badge.icon}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium group-hover:underline group-hover:underline-offset-2" style={{ color: "var(--accent-cyan)" }}>
                            {badge.name}
                          </p>
                          {isRecent && (
                            <span
                              className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white"
                              style={{ background: "var(--accent-emerald)" }}
                            >
                              NEW
                            </span>
                          )}
                        </div>
                        <p className="shrink-0 text-[10px]" style={{ color: "var(--text-tertiary, var(--cf-text-soft))" }}>
                          {badge.earnedDate
                            ? new Date(badge.earnedDate).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                              })
                            : ""}
                        </p>
                      </div>
                      <p className="mt-0.5 text-xs" style={{ color: "var(--text-secondary, var(--cf-text-3))" }}>
                        {badge.description}
                      </p>
                    </div>
                  </button>
                </motion.div>
              );
            })}
          </div>
        </AnimatePresence>
      </div>

      {needsExpand && (
        <motion.button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="mt-4 text-sm font-medium transition"
          style={{ color: "var(--accent-cyan)" }}
          whileHover={{ x: 2 }}
        >
          {expanded ? "Show less \u2191" : "View full journey \u2193"}
        </motion.button>
      )}
    </div>
  );
}
