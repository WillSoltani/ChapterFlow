"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Flame, Star, BarChart3, ArrowRight, Loader2 } from "lucide-react";
import { Confetti } from "@/components/ui/Confetti";
import { Button } from "@/components/ui/button";
import AnimatedCheckmark from "./AnimatedCheckmark";
import { INSIGHT_POINTS_AMOUNTS } from "@/app/book/_lib/flow-points-economy";

interface UnlockCelebrationProps {
  quizScore: number;
  /** Persists onboarding + navigates. May be async; rejects if the save fails
   *  so this screen can show an inline retry instead of stranding the user. */
  onFinish: () => void | Promise<void>;
}

export default function UnlockCelebration({
  quizScore,
  onFinish,
}: UnlockCelebrationProps) {
  const prefersReducedMotion = useReducedMotion();
  const noMotion = !!prefersReducedMotion;

  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);

  const handleFinish = async () => {
    if (submitting) return;
    setSubmitting(true);
    setFailed(false);
    try {
      await onFinish();
      // On success the app navigates away and this component unmounts; keep the
      // button in its loading state until then (don't flash back to idle).
    } catch {
      setFailed(true);
      setSubmitting(false);
    }
  };

  const stats = [
    {
      icon: Flame,
      value: "1",
      label: "Day streak",
      iconColor: "var(--accent-amber)",
      valueColor: "var(--accent-amber)",
      glowBg: "color-mix(in srgb, var(--accent-amber) 12%, transparent)",
      delay: 1.0,
    },
    {
      icon: Star,
      value: String(INSIGHT_POINTS_AMOUNTS.onboardingComplete),
      label: "Insight Points",
      iconColor: "var(--accent-amber)",
      valueColor: "var(--accent-amber)",
      glowBg: "color-mix(in srgb, var(--accent-amber) 12%, transparent)",
      delay: 1.15,
    },
    {
      icon: BarChart3,
      value: `${quizScore}/2`,
      label: "Quiz score",
      iconColor: "var(--accent-cyan)",
      valueColor: "var(--accent-cyan)",
      glowBg: "color-mix(in srgb, var(--accent-cyan) 12%, transparent)",
      delay: 1.3,
    },
  ];

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "40px 20px",
        minHeight: 520,
      }}
    >
      {/* Shared confetti — fires on mount; theme-aware palette stays visible on
          the default light theme (the old CanvasConfetti's screen-blended white
          particles vanished there). */}
      <Confetti particleCount={120} duration={4500} origin="center" />

      {/* Ambient glow — instant visual anchor before checkmark draws */}
      <motion.div
        className="absolute pointer-events-none"
        style={{
          top: "25%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 200,
          height: 200,
          borderRadius: "50%",
          background: "radial-gradient(circle, color-mix(in srgb, var(--accent-cyan) 15%, transparent) 0%, transparent 70%)",
        }}
        initial={{ opacity: 1, scale: 0.8 }}
        animate={{ opacity: 0, scale: 1.5 }}
        transition={noMotion ? { duration: 0 } : { delay: 0.5, duration: 1, ease: "easeOut" }}
      />

      {/* Animated SVG checkmark — draws at 0.1s */}
      <div style={{ marginBottom: 24 }}>
        <AnimatedCheckmark />
      </div>

      {/* Heading — 0.7s */}
      <motion.h2
        initial={noMotion ? false : { opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: noMotion ? 0 : 0.7, duration: 0.4, ease: "easeOut" }}
        style={{
          fontFamily: "var(--font-sora, sans-serif)",
          fontSize: 32,
          fontWeight: 700,
          color: "var(--cf-text-1)",
          margin: "0 0 8px",
        }}
      >
        Chapter 1 Complete
      </motion.h2>

      {/* Subtitle — 0.85s */}
      <motion.p
        initial={noMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: noMotion ? 0 : 0.85, duration: 0.3 }}
        style={{
          fontFamily: "var(--font-dm-sans, sans-serif)",
          fontSize: 16,
          color: "var(--cf-text-3)",
          margin: "0 0 32px",
          lineHeight: 1.5,
        }}
      >
        You just finished your first ChapterFlow session.
      </motion.p>

      {/* Stats row — staggered at 1.0s, 1.15s, 1.3s */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 12,
          width: "100%",
          maxWidth: 420,
          marginBottom: 0,
        }}
      >
        {stats.map((stat) => {
          const IconComponent = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={noMotion ? false : { opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={
                noMotion
                  ? { duration: 0 }
                  : {
                      delay: stat.delay,
                      type: "spring",
                      stiffness: 400,
                      damping: 25,
                    }
              }
              style={{
                background: "var(--cf-surface-muted)",
                backdropFilter: "blur(24px)",
                WebkitBackdropFilter: "blur(24px)",
                border: "1px solid var(--cf-border-strong)",
                borderRadius: 16,
                padding: "16px 12px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
                boxShadow: "var(--cf-shadow-lg)",
                minWidth: 100,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: stat.glowBg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <IconComponent size={18} style={{ color: stat.iconColor }} />
              </div>
              <span
                style={{
                  fontFamily:
                    "var(--font-jetbrains, 'JetBrains Mono', monospace)",
                  fontSize: 28,
                  fontWeight: 700,
                  color: stat.valueColor,
                  lineHeight: 1,
                }}
              >
                {stat.value}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-dm-sans, sans-serif)",
                  fontSize: 12,
                  color: "var(--cf-text-3)",
                }}
              >
                {stat.label}
              </span>
            </motion.div>
          );
        })}
      </div>

      {/* CTA section — appears at 1.7s */}
      <motion.div
        initial={noMotion ? { opacity: 1 } : { opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: noMotion ? 0 : 1.7, duration: 0.5, ease: "easeOut" }}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
          width: "100%",
          maxWidth: 360,
          marginTop: 40,
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-dm-sans, sans-serif)",
            fontSize: 14,
            color: "var(--cf-text-soft)",
            margin: 0,
          }}
        >
          Chapter 2 is ready when you are.
        </p>

        <Button
          size="lg"
          className="w-full"
          onClick={handleFinish}
          disabled={submitting}
          aria-busy={submitting}
        >
          {submitting ? (
            <>
              <Loader2 size={18} strokeWidth={2} className="animate-spin" />
              Saving your setup…
            </>
          ) : failed ? (
            <>
              Try again
              <ArrowRight size={18} strokeWidth={2} />
            </>
          ) : (
            <>
              Go to my dashboard
              <ArrowRight size={18} strokeWidth={2} />
            </>
          )}
        </Button>

        {failed && (
          <p
            role="alert"
            style={{
              fontFamily: "var(--font-dm-sans, sans-serif)",
              fontSize: 13,
              color: "var(--accent-rose)",
              margin: 0,
              textAlign: "center",
            }}
          >
            We couldn&apos;t save your setup. Check your connection and try again.
          </p>
        )}
      </motion.div>
    </div>
  );
}
