"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  Flame,
  Swords,
  Sparkles,
  Star,
  PartyPopper,
  type LucideIcon,
} from "lucide-react";
import type { CelebrationEvent } from "../types/settings";

type CelebrationConfig = {
  Icon: LucideIcon;
  text: string;
};

// NS / evolve_track #8: the celebration vocabulary speaks one visual language
// across reader, dashboard, onboarding, and settings \u2014 crafted gold lucide
// marks (the reward-modal vocabulary) instead of per-OS emoji glyphs.
const CELEBRATIONS: Record<CelebrationEvent, CelebrationConfig> = {
  "goal-increased": { Icon: TrendingUp, text: "Challenge accepted!" },
  "streak-enabled": { Icon: Flame, text: "Day 1 starts now!" },
  "rival-selected": { Icon: Swords, text: "Game on!" },
  "profile-selected": { Icon: Sparkles, text: "Great choice!" },
  "score-50": { Icon: Star, text: "Halfway there!" },
  "score-100": { Icon: PartyPopper, text: "Fully personalized!" },
};

type MicroCelebrationProps = {
  event: CelebrationEvent | null;
  reducedMotion?: boolean;
};

export function MicroCelebration({ event, reducedMotion }: MicroCelebrationProps) {
  const [visible, setVisible] = useState(false);
  const [currentEvent, setCurrentEvent] = useState<CelebrationEvent | null>(null);

  useEffect(() => {
    if (event && !reducedMotion) {
      setCurrentEvent(event);
      setVisible(true);
      const duration = event === "score-100" ? 2500 : 1500;
      const timer = setTimeout(() => setVisible(false), duration);
      return () => clearTimeout(timer);
    }
  }, [event, reducedMotion]);

  if (!currentEvent) return null;
  const config = CELEBRATIONS[currentEvent];
  const Icon = config.Icon;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.8 }}
          animate={{ opacity: 1, y: -8, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.9 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="pointer-events-none fixed bottom-20 left-1/2 z-50 -translate-x-1/2"
        >
          <div className="flex items-center gap-2 rounded-full bg-(--cf-surface-strong) border border-(--cf-border) px-4 py-2 shadow-shadow-elevated backdrop-blur-xl">
            {/* Crafted gold mark — same chip/icon treatment as the reward modal
                (ChapterCompleteModal), so settings speaks the same gold
                celebration language as reader/dashboard/onboarding. */}
            <span
              className={
                currentEvent === "score-100"
                  ? "flex h-7 w-7 items-center justify-center rounded-full"
                  : "flex h-6 w-6 items-center justify-center rounded-full"
              }
              style={{
                background: "color-mix(in srgb, var(--accent-gold) 14%, transparent)",
                border: "1px solid color-mix(in srgb, var(--accent-gold) 40%, transparent)",
              }}
            >
              <Icon
                className={currentEvent === "score-100" ? "h-4 w-4" : "h-3.5 w-3.5"}
                strokeWidth={2.25}
                aria-hidden="true"
                style={{ color: "var(--accent-gold)" }}
              />
            </span>
            <span className="text-sm font-semibold text-(--cf-text-1)">
              {config.text}
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
