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
        <div className="mt-4 rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] px-5 py-8 text-center">
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
          className="absolute left-[15px] top-3 w-0.5 bg-amber-500/20"
          style={{ bottom: expanded ? 12 : needsExpand ? 12 : 12 }}
        />

        <AnimatePresence initial={false}>
          <div className="space-y-5">
            {visible.map((badge, i) => {
              const dotColor = TIER_BORDER_COLORS[badge.tier] ?? TIER_BORDER_COLORS.unique;
              const glowColor = dotColor.replace(")", ",0.3)").replace("rgb", "rgba");

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
                    {/* Timeline dot on the line */}
                    <div
                      className="absolute -left-8 top-1.5 h-2.5 w-2.5 rounded-full"
                      style={{
                        backgroundColor: dotColor,
                        boxShadow: `0 0 6px ${glowColor}`,
                        border: "2px solid #12121A",
                      }}
                    />

                    {/* Badge icon */}
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] text-lg">
                      {badge.icon}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-amber-500 group-hover:underline group-hover:underline-offset-2">
                          {badge.name}
                        </p>
                        <p className="shrink-0 text-[10px] text-(--cf-text-soft)">
                          {badge.earnedDate
                            ? new Date(badge.earnedDate).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                              })
                            : ""}
                        </p>
                      </div>
                      <p className="mt-0.5 text-xs text-(--cf-text-soft)">
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
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="mt-4 text-sm font-medium text-amber-500 transition hover:text-amber-400"
        >
          {expanded ? "Show less \u2191" : "View full journey \u2193"}
        </button>
      )}
    </div>
  );
}
