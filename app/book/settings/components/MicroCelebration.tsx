"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { CelebrationEvent } from "../types/settings";

type CelebrationConfig = {
  emoji: string;
  text: string;
};

const CELEBRATIONS: Record<CelebrationEvent, CelebrationConfig> = {
  "goal-increased": { emoji: "\uD83D\uDCC8", text: "Challenge accepted!" },
  "streak-enabled": { emoji: "\uD83D\uDD25", text: "Day 1 starts now!" },
  "rival-selected": { emoji: "\u2694\uFE0F", text: "Game on!" },
  "profile-selected": { emoji: "\u2728", text: "Great choice!" },
  "score-50": { emoji: "\uD83C\uDF1F", text: "Halfway there!" },
  "score-100": { emoji: "\uD83C\uDF89", text: "Fully personalized!" },
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
          <div className="flex items-center gap-2 rounded-full bg-(--cf-surface-strong) border border-(--cf-border) px-4 py-2 shadow-lg backdrop-blur-xl">
            <span className={currentEvent === "score-100" ? "text-xl" : "text-lg"}>
              {config.emoji}
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
