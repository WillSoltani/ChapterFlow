"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Flame, Star, BarChart3 } from "lucide-react";
import { ConfettiEffect } from "@/components/ui/ConfettiEffect";
import {
  staggerContainer,
  staggerItem,
} from "@/app/onboarding/utils/animations";

interface UnlockCelebrationProps {
  quizScore: number;
  onFinish: () => void;
}

export default function UnlockCelebration({
  quizScore,
  onFinish,
}: UnlockCelebrationProps) {
  const prefersReducedMotion = useReducedMotion();
  const [showCTA, setShowCTA] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowCTA(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  const stats = [
    {
      icon: Flame,
      value: "1",
      label: "Day streak",
      iconColor: "var(--accent-flame, #FF8C42)",
      glowColor: "rgba(255,140,66,0.12)",
    },
    {
      icon: Star,
      value: "25",
      label: "Flow Points",
      iconColor: "var(--accent-gold, #E8B931)",
      glowColor: "rgba(232,185,49,0.12)",
    },
    {
      icon: BarChart3,
      value: `${quizScore}/2`,
      label: "Quiz score",
      iconColor: "var(--accent-teal, #2DD4BF)",
      glowColor: "rgba(45,212,191,0.12)",
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
        minHeight: 480,
      }}
    >
      {/* Confetti */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <ConfettiEffect
          trigger={true}
          colors={["#2DD4BF", "#4F8BFF", "#E8B931", "#FF8C42"]}
        />
      </div>

      {/* Animated checkmark */}
      <motion.div
        initial={prefersReducedMotion ? false : { scale: 0 }}
        animate={{ scale: 1 }}
        transition={{
          type: "spring",
          stiffness: 300,
          damping: 20,
          delay: 0.2,
        }}
        style={{
          width: 64,
          height: 64,
          borderRadius: "50%",
          background: "var(--accent-teal, #2DD4BF)",
          boxShadow: "0 0 32px rgba(45,212,191,0.3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 24,
        }}
      >
        <svg
          width="32"
          height="32"
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <motion.path
            d="M8 16L14 22L24 10"
            stroke="#0B0B0F"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={prefersReducedMotion ? {} : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.6, delay: 0.4, ease: "easeOut" }}
          />
        </svg>
      </motion.div>

      {/* Heading */}
      <motion.h2
        initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.5 }}
        style={{
          fontFamily: "var(--font-sora, sans-serif)",
          fontSize: 32,
          fontWeight: 700,
          color: "var(--text-primary, #E2E2E6)",
          margin: "0 0 8px",
        }}
      >
        Chapter 1 Complete
      </motion.h2>

      {/* Subtitle */}
      <motion.p
        initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.65 }}
        style={{
          fontFamily: "var(--font-dm-sans, sans-serif)",
          fontSize: 16,
          color: "var(--text-secondary, #8B8B9E)",
          margin: "0 0 36px",
          lineHeight: 1.5,
        }}
      >
        You just finished your first ChapterFlow session.
      </motion.p>

      {/* Stats row */}
      <motion.div
        variants={staggerContainer}
        initial={prefersReducedMotion ? false : "hidden"}
        animate="show"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 12,
          width: "100%",
          maxWidth: 420,
          marginBottom: 36,
        }}
      >
        {stats.map((stat, i) => {
          const IconComponent = stat.icon;
          return (
            <motion.div
              key={stat.label}
              variants={staggerItem}
              transition={{
                delay: prefersReducedMotion ? 0 : 0.8 + i * 0.15,
              }}
              style={{
                background: "var(--bg-glass, rgba(255,255,255,0.03))",
                border:
                  "1px solid var(--border-subtle, rgba(255,255,255,0.06))",
                borderRadius: "var(--radius-lg-val, 16px)",
                padding: "18px 12px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: stat.glowColor,
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
                  color: "var(--text-heading, #FAFAFA)",
                  lineHeight: 1,
                }}
              >
                {stat.value}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-dm-sans, sans-serif)",
                  fontSize: 12,
                  color: "var(--text-muted, #5A5A6E)",
                }}
              >
                {stat.label}
              </span>
            </motion.div>
          );
        })}
      </motion.div>

      {/* CTA section — fades in after 1.5s */}
      <motion.div
        initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 12 }}
        animate={
          showCTA
            ? { opacity: 1, y: 0 }
            : prefersReducedMotion
              ? { opacity: 1 }
              : { opacity: 0, y: 12 }
        }
        transition={{ duration: 0.5 }}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
          width: "100%",
          maxWidth: 360,
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-dm-sans, sans-serif)",
            fontSize: 14,
            color: "var(--text-secondary, #8B8B9E)",
            margin: 0,
          }}
        >
          Chapter 2 is ready.
        </p>

        <button
          onClick={onFinish}
          className="celebration-cta"
          style={{
            width: "100%",
            minHeight: 56,
            padding: "16px 32px",
            fontFamily: "var(--font-dm-sans, sans-serif)",
            fontSize: 17,
            fontWeight: 600,
            color: "#FAFAFA",
            background: "var(--accent-green, #34D399)",
            border: "none",
            borderRadius: "var(--radius-md-val, 12px)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            boxShadow:
              "0 0 24px var(--glow-green, rgba(52,211,153,0.15))",
            transition: "transform 0.15s",
          }}
        >
          Go to my dashboard
          <span style={{ fontSize: 18 }}>&rarr;</span>

          <style>{`
            @keyframes celebrationBreathe {
              0%, 100% { box-shadow: 0 0 24px rgba(52,211,153,0.15); }
              50% { box-shadow: 0 0 44px rgba(52,211,153,0.35); }
            }
            .celebration-cta {
              animation: celebrationBreathe 2.5s ease-in-out infinite;
            }
            .celebration-cta:hover {
              transform: translateY(-1px);
            }
            .celebration-cta:active {
              transform: translateY(0);
            }
          `}</style>
        </button>
      </motion.div>
    </div>
  );
}
