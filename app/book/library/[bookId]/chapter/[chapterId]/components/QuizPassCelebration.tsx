"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import type { LoopPipelineResult } from "@/app/book/_lib/flow-points-economy";

interface Props {
  scorePercent: number;
  isPerfect: boolean;
  quizPassIP: number;
  perfectBonusIP: number;
  loopPipeline: LoopPipelineResult | null;
  onDismiss: () => void;
}

type IPLine = {
  key: string;
  label: string;
  amount: number;
  emoji?: string;
  highlight?: boolean;
};

export function QuizPassCelebration({
  scorePercent,
  isPerfect,
  quizPassIP,
  perfectBonusIP,
  loopPipeline,
  onDismiss,
}: Props) {
  const prefersReducedMotion = useReducedMotion();
  const [visible, setVisible] = useState(true);

  const lines = useMemo<IPLine[]>(() => {
    const out: IPLine[] = [];
    if (quizPassIP > 0) {
      out.push({ key: "quiz", label: "Quiz pass", amount: quizPassIP, emoji: "\u2705" });
    }
    if (perfectBonusIP > 0) {
      out.push({
        key: "perfect",
        label: "Perfect score bonus",
        amount: perfectBonusIP,
        emoji: "\uD83D\uDCAF",
        highlight: true,
      });
    }
    if (loopPipeline) {
      if (loopPipeline.loopCompleteIP > 0) {
        out.push({
          key: "loop",
          label: "Loop complete",
          amount: loopPipeline.loopCompleteIP,
          emoji: "\uD83D\uDD04",
        });
      }
      if (loopPipeline.bookCompleteIP > 0) {
        out.push({
          key: "book-complete",
          label: "Book complete",
          amount: loopPipeline.bookCompleteIP,
          emoji: "\uD83D\uDCD6",
          highlight: true,
        });
      }
      if (loopPipeline.streak.streakDayIP > 0) {
        out.push({
          key: "streak-day",
          label: `Day ${loopPipeline.streak.currentStreak} streak`,
          amount: loopPipeline.streak.streakDayIP,
          emoji: "\uD83D\uDD25",
        });
      }
      loopPipeline.streak.milestones.forEach((m) => {
        out.push({
          key: `milestone-${m.days}`,
          label: `${m.days}-day streak milestone`,
          amount: m.ip,
          emoji: "\uD83C\uDFC5",
          highlight: true,
        });
      });
      if (loopPipeline.streak.welcomeBackIP > 0) {
        out.push({
          key: "welcome-back",
          label: "Welcome back",
          amount: loopPipeline.streak.welcomeBackIP,
          emoji: "\uD83D\uDC4B",
        });
      }
      if (loopPipeline.tier.advanced && loopPipeline.tier.advancementIP > 0) {
        out.push({
          key: "tier",
          label: `New tier: ${loopPipeline.tier.displayName ?? loopPipeline.tier.newTier ?? ""}`,
          amount: loopPipeline.tier.advancementIP,
          emoji: "\u2B50",
          highlight: true,
        });
      }
      loopPipeline.achievements.forEach((a) => {
        out.push({
          key: `ach-${a.id}`,
          label: a.name,
          amount: a.ip,
          emoji: "\uD83C\uDFC6",
          highlight: true,
        });
      });
      if (loopPipeline.insightSpark.triggered) {
        out.push({
          key: "spark",
          label: "Insight Spark",
          amount: loopPipeline.insightSpark.amount,
          emoji: "\u2728",
          highlight: true,
        });
      }
    }
    return out;
  }, [quizPassIP, perfectBonusIP, loopPipeline]);

  const totalIP = useMemo(() => lines.reduce((sum, l) => sum + l.amount, 0), [lines]);

  useEffect(() => {
    const baseDuration = 3000;
    const perLine = 400;
    const dismissAfter = baseDuration + lines.length * perLine;
    const t = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 300);
    }, dismissAfter);
    return () => clearTimeout(t);
  }, [lines.length, onDismiss]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: "rgba(0,0,0,0.78)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" }}
          initial={prefersReducedMotion ? {} : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={prefersReducedMotion ? {} : { opacity: 0 }}
          onClick={() => {
            setVisible(false);
            setTimeout(onDismiss, 300);
          }}
          role="dialog"
          aria-label="Quiz passed"
        >
          <motion.div
            className="rounded-2xl p-7 w-full max-w-md text-center bg-(--cr-bg-surface-2)"
            style={{
              border:
                "1px solid color-mix(in srgb, var(--cr-accent) 35%, transparent)",
              boxShadow:
                "0 0 60px color-mix(in srgb, var(--cr-accent) 20%, transparent)",
            }}
            initial={prefersReducedMotion ? {} : { scale: 0.9, y: 30 }}
            animate={{ scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 22 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-[52px] mb-1">{isPerfect ? "\uD83D\uDCAF" : "\uD83C\uDF89"}</div>
            <h2
              className="text-[22px] font-bold text-(--cr-text-heading)"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {isPerfect ? "Perfect Score!" : "Quiz Passed!"}
            </h2>
            <p className="text-[15px] mt-1 text-(--cr-text-secondary)">
              You scored {scorePercent}%
            </p>

            {lines.length > 0 && (
              <div
                className="mt-5 rounded-xl p-4 text-left"
                style={{
                  background:
                    "color-mix(in srgb, var(--cr-accent) 8%, transparent)",
                  border:
                    "1px solid color-mix(in srgb, var(--cr-accent) 20%, transparent)",
                }}
              >
                <div className="space-y-2">
                  {lines.map((line, i) => (
                    <motion.div
                      key={line.key}
                      className="flex items-center justify-between text-[13px]"
                      initial={prefersReducedMotion ? {} : { opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + i * 0.12 }}
                    >
                      <span className="flex items-center gap-2 text-(--cr-text-secondary)">
                        <span>{line.emoji}</span>
                        <span className={line.highlight ? "font-semibold" : ""}>{line.label}</span>
                      </span>
                      <span
                        className={[
                          "font-bold tabular-nums",
                          line.highlight ? "text-(--cr-accent)" : "text-(--cr-text-heading)",
                        ].join(" ")}
                      >
                        +{line.amount}
                      </span>
                    </motion.div>
                  ))}
                </div>
                <div
                  className="mt-3 pt-3 flex items-center justify-between"
                  style={{
                    borderTop:
                      "1px solid color-mix(in srgb, var(--cr-accent) 22%, transparent)",
                  }}
                >
                  <span className="text-[13px] font-semibold text-(--cr-text-heading)">
                    Total earned
                  </span>
                  <motion.span
                    className="text-[20px] font-bold tabular-nums text-(--cr-accent)"
                    initial={prefersReducedMotion ? {} : { scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.3 + lines.length * 0.12, type: "spring", stiffness: 300 }}
                  >
                    +{totalIP} IP
                  </motion.span>
                </div>
              </div>
            )}

            <p className="text-[11px] mt-4 text-(--cr-text-disabled)">
              Tap anywhere to continue
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
