"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Flame, Star, BarChart3 } from "lucide-react";
import CanvasConfetti from "./CanvasConfetti";
import AnimatedCheckmark from "./AnimatedCheckmark";

interface UnlockCelebrationProps {
  quizScore: number;
  onFinish: () => void;
}

export default function UnlockCelebration({
  quizScore,
  onFinish,
}: UnlockCelebrationProps) {
  const prefersReducedMotion = useReducedMotion();
  const noMotion = !!prefersReducedMotion;

  const stats = [
    {
      icon: Flame,
      value: "1",
      label: "Day streak",
      iconColor: "#FF8C42",
      valueColor: "#FF8C42",
      glowBg: "rgba(255,140,66,0.12)",
      delay: 1.0,
    },
    {
      icon: Star,
      value: "25",
      label: "Flow Points",
      iconColor: "#E8B931",
      valueColor: "#E8B931",
      glowBg: "rgba(232,185,49,0.12)",
      delay: 1.15,
    },
    {
      icon: BarChart3,
      value: `${quizScore}/2`,
      label: "Quiz score",
      iconColor: "#3ECFB2",
      valueColor: "#3ECFB2",
      glowBg: "rgba(45,212,191,0.12)",
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
      {/* Canvas confetti — fires on mount, longer duration so particles persist */}
      <CanvasConfetti particleCount={100} duration={4500} />

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
          background: "radial-gradient(circle, rgba(62,207,178,0.15) 0%, transparent 70%)",
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
          color: "rgba(255,255,255,0.93)",
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
          color: "rgba(255,255,255,0.50)",
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
                background: "rgba(255,255,255,0.06)",
                backdropFilter: "blur(24px)",
                WebkitBackdropFilter: "blur(24px)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 16,
                padding: "16px 12px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
                boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
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
                  color: "rgba(255,255,255,0.50)",
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
            color: "rgba(255,255,255,0.40)",
            margin: 0,
          }}
        >
          Chapter 2 is ready when you are.
        </p>

        <button
          onClick={onFinish}
          className="celebration-cta"
          style={{
            width: "100%",
            minHeight: 56,
            padding: "16px 40px",
            fontFamily: "var(--font-dm-sans, sans-serif)",
            fontSize: 17,
            fontWeight: 600,
            color: "#0A0E1A",
            background: "#3BD4A0",
            border: "none",
            borderRadius: 12,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            transition: "transform 0.15s",
          }}
        >
          Go to my dashboard
          <span style={{ fontSize: 18 }}>&rarr;</span>

          <style>{`
            @keyframes celebrationBreathe {
              0%, 100% { box-shadow: 0 0 15px rgba(59,212,160,0.2); }
              50% { box-shadow: 0 0 28px rgba(59,212,160,0.4); }
            }
            .celebration-cta {
              animation: celebrationBreathe 2.5s ease-in-out infinite;
            }
            .celebration-cta:hover {
              transform: translateY(-1px);
              filter: brightness(1.1);
            }
            .celebration-cta:active {
              transform: translateY(0) scale(0.98);
            }
          `}</style>
        </button>
      </motion.div>
    </div>
  );
}
