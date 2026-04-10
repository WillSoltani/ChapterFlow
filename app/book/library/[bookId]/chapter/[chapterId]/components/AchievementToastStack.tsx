"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import type { LoopPipelineResult } from "@/app/book/_lib/flow-points-economy";

type Achievement = LoopPipelineResult["achievements"][number];

interface Props {
  achievements: Achievement[];
  onDismissAll: () => void;
}

export function AchievementToastStack({ achievements, onDismissAll }: Props) {
  const prefersReducedMotion = useReducedMotion();
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (achievements.length === 0) return;
    const t = setTimeout(() => {
      setDismissedIds(new Set(achievements.map((a) => a.id)));
      setTimeout(onDismissAll, 400);
    }, 5000 + achievements.length * 1000);
    return () => clearTimeout(t);
  }, [achievements, onDismissAll]);

  const visible = achievements.filter((a) => !dismissedIds.has(a.id));

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col gap-3 max-w-xs">
      <AnimatePresence>
        {visible.map((a, i) => (
          <motion.div
            key={a.id}
            initial={prefersReducedMotion ? {} : { opacity: 0, x: 40, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: 40, scale: 0.9 }}
            transition={{ delay: i * 0.15, type: "spring", stiffness: 280, damping: 24 }}
            className="rounded-xl p-4 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
            style={{
              background: "var(--bg-glass)",
              border: "1px solid rgba(34,211,238,0.35)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.4), 0 0 20px rgba(34,211,238,0.12)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
            }}
            onClick={() => setDismissedIds((s) => new Set(s).add(a.id))}
            role="status"
            aria-live="polite"
          >
            <div className="flex items-start gap-3">
              <div className="text-[28px] flex-shrink-0">{"\uD83C\uDFC6"}</div>
              <div className="flex-1 min-w-0">
                <p
                  className="text-[11px] uppercase tracking-wider font-semibold"
                  style={{ color: "var(--accent-teal)" }}
                >
                  Achievement Unlocked
                </p>
                <p
                  className="text-[14px] font-bold mt-0.5 truncate"
                  style={{
                    color: "var(--text-heading)",
                    fontFamily: "var(--font-display)",
                  }}
                >
                  {a.name}
                </p>
                {a.celebrationCopy && (
                  <p
                    className="text-[12px] mt-1 line-clamp-2"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {a.celebrationCopy}
                  </p>
                )}
                {a.ip > 0 && (
                  <p
                    className="text-[12px] font-bold mt-1.5"
                    style={{ color: "var(--accent-teal)" }}
                  >
                    +{a.ip} IP
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
