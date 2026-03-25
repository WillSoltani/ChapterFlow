"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import type { Milestone } from "./progressTypes";

interface NextAchievementsProps {
  milestones: Milestone[];
  recentlyEarnedBadge?: string | null;
  recentlyEarnedBadgeId?: string | null;
}

export function NextAchievements({
  milestones,
  recentlyEarnedBadge = null,
  recentlyEarnedBadgeId = null,
}: NextAchievementsProps) {
  const prefersReduced = useReducedMotion();
  const [dismissed, setDismissed] = useState(false);

  // Check localStorage for previously dismissed badge banners
  useEffect(() => {
    if (recentlyEarnedBadgeId) {
      const key = `badge_dismissed_${recentlyEarnedBadgeId}`;
      if (localStorage.getItem(key) === "true") {
        setDismissed(true);
      }
    }
  }, [recentlyEarnedBadgeId]);

  function handleDismiss() {
    setDismissed(true);
    if (recentlyEarnedBadgeId) {
      localStorage.setItem(`badge_dismissed_${recentlyEarnedBadgeId}`, "true");
    }
  }

  // TODO: Connect to achievements API — endpoint: GET /api/book/me/badges

  if (milestones.length === 0) return null;

  const visibleMilestones = milestones.slice(0, 3);

  return (
    <motion.section
      className="rounded-2xl p-5"
      style={{
        background: "var(--cf-surface-muted)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: "1px solid var(--cf-border)",
        boxShadow: "var(--cf-shadow-sm)",
      }}
      initial={{ opacity: prefersReduced ? 1 : 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.3 }}
    >
      <h2
        className="text-base font-semibold"
        style={{ color: "var(--text-heading)" }}
      >
        Next Achievements
      </h2>

      {/* Recently earned banner */}
      <AnimatePresence>
        {recentlyEarnedBadge && !dismissed && (
          <motion.div
            className="mt-3 flex items-center justify-between rounded-xl px-3 py-2"
            style={{
              background: "rgba(52,211,153,0.1)",
              border: "1px solid rgba(52,211,153,0.2)",
            }}
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: "auto", marginTop: 12 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            transition={{ duration: 0.3 }}
          >
            <span
              className="text-xs font-medium"
              style={{ color: "var(--cf-success-text)" }}
            >
              {"\u{1F389}"} Just earned: {recentlyEarnedBadge}!
            </span>
            <button
              type="button"
              onClick={handleDismiss}
              className="cursor-pointer p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 rounded"
              aria-label="Dismiss achievement notification"
            >
              <X
                className="h-3.5 w-3.5"
                style={{ color: "var(--text-muted)" }}
              />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Milestone cards */}
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        {visibleMilestones.map((milestone) => {
          const progressPct =
            milestone.target > 0
              ? Math.round((milestone.current / milestone.target) * 100)
              : 0;

          return (
            <Link
              key={milestone.id}
              href="/book/badges"
              className="flex flex-1 items-start gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-white/[0.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50"
              style={{
                background: "var(--cf-surface-muted)",
                border: "1px solid var(--cf-border)",
              }}
            >
              {/* Badge icon */}
              <span
                className="shrink-0 text-3xl"
                style={{
                  filter: progressPct === 0 ? "grayscale(0.7)" : "none",
                  opacity: progressPct === 0 ? 0.5 : 0.8,
                }}
              >
                {milestone.icon}
              </span>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <p
                  className="text-sm font-medium"
                  style={{ color: "var(--text-heading)" }}
                >
                  {milestone.name}
                </p>
                <p
                  className="mt-0.5 text-xs"
                  style={{ color: "var(--text-muted)" }}
                >
                  {milestone.description}
                </p>

                {/* Progress bar */}
                <div className="mt-2 flex items-center gap-2">
                  <div
                    className="flex-1 overflow-hidden rounded-full"
                    style={{
                      height: 4,
                      background: "var(--cf-surface-strong)",
                    }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${progressPct}%`,
                        background: "var(--cf-accent)",
                        transition: "width 0.5s ease-out",
                      }}
                    />
                  </div>
                  <span
                    className="shrink-0 text-[10px] tabular-nums"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {milestone.current}/{milestone.target}
                  </span>
                </div>
              </div>
          </Link>
          );
        })}
      </div>
    </motion.section>
  );
}
