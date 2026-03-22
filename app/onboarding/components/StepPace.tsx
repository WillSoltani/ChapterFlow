"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  Coffee,
  BookOpen,
  Flame,
  ListOrdered,
  Target,
  ArrowRight,
} from "lucide-react";
import TappableCard from "./TappableCard";
import { useOnboarding, type DailyGoal, type ChapterOrder } from "@/app/onboarding/hooks/useOnboarding";
import {
  staggerContainer,
  staggerItem,
} from "@/app/onboarding/utils/animations";

interface StepPaceProps {
  onNext: () => void;
}

const dailyGoalOptions: {
  value: DailyGoal;
  label: string;
  sublabel: string;
  badge?: string;
  Icon: typeof Coffee;
}[] = [
  { value: 10, label: "10 min", sublabel: "Light", Icon: Coffee },
  {
    value: 20,
    label: "20 min",
    sublabel: "Steady",
    badge: "Most popular",
    Icon: BookOpen,
  },
  { value: 30, label: "30 min", sublabel: "Focused", Icon: Flame },
];

const chapterOrderOptions: {
  value: ChapterOrder;
  label: string;
  description: string;
  Icon: typeof ListOrdered;
}[] = [
  {
    value: "summary_first",
    label: "Start with the key idea",
    description:
      "Read the summary first, then branch into scenarios and quiz.",
    Icon: ListOrdered,
  },
  {
    value: "scenarios_first",
    label: "Start with real situations",
    description:
      "Jump into scenarios first, then read the summary once the idea feels grounded.",
    Icon: Target,
  },
];

export default function StepPace({ onNext }: StepPaceProps) {
  const { dailyGoal, setDailyGoal, chapterOrder, setChapterOrder } =
    useOnboarding();
  const prefersReducedMotion = useReducedMotion();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width: "100%",
        maxWidth: 560,
        margin: "0 auto",
        padding: "0 16px",
      }}
    >
      {/* Heading */}
      <h1
        style={{
          fontFamily: "var(--font-sora)",
          fontWeight: 600,
          fontSize: "clamp(28px, 5vw, 36px)",
          color: "var(--text-heading)",
          textAlign: "center",
          marginBottom: 8,
          lineHeight: 1.2,
        }}
      >
        Choose your pace
      </h1>

      {/* Subtitle */}
      <p
        style={{
          fontFamily: "var(--font-dm-sans)",
          fontSize: 16,
          color: "var(--text-secondary)",
          textAlign: "center",
          marginBottom: 40,
          lineHeight: 1.5,
        }}
      >
        You can always change this later.
      </p>

      {/* Section 1: Daily Reading Goal */}
      <div style={{ width: "100%", marginBottom: 32 }}>
        <p
          style={{
            fontFamily: "var(--font-dm-sans)",
            fontSize: 11,
            fontWeight: 600,
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            marginBottom: 12,
          }}
        >
          Daily Reading Goal
        </p>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 10,
            width: "100%",
          }}
        >
          {dailyGoalOptions.map(({ value, label, sublabel, badge, Icon }) => {
            const isSelected = dailyGoal === value;

            return (
              <motion.div key={value} variants={staggerItem}>
                <TappableCard
                  selected={isSelected}
                  onSelect={() => setDailyGoal(value)}
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 8,
                      textAlign: "center",
                      minHeight: 48,
                      position: "relative",
                    }}
                  >
                    {/* Badge */}
                    {badge && (
                      <span
                        style={{
                          position: "absolute",
                          top: -4,
                          right: -4,
                          fontFamily: "var(--font-dm-sans)",
                          fontSize: 11,
                          fontWeight: 600,
                          color: "var(--accent-gold)",
                          backgroundColor: "rgba(232,185,49,0.12)",
                          padding: "2px 8px",
                          borderRadius: 999,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {badge}
                      </span>
                    )}

                    <Icon
                      size={28}
                      strokeWidth={1.5}
                      style={{
                        color: isSelected
                          ? "var(--accent-blue)"
                          : "var(--text-secondary)",
                        transition: "color 200ms ease",
                      }}
                    />

                    <div>
                      <p
                        style={{
                          fontFamily: "var(--font-sora)",
                          fontWeight: 600,
                          fontSize: 16,
                          color: "var(--text-heading)",
                          lineHeight: 1.3,
                        }}
                      >
                        {label}
                      </p>
                      <p
                        style={{
                          fontFamily: "var(--font-dm-sans)",
                          fontSize: 13,
                          color: "var(--text-secondary)",
                          lineHeight: 1.3,
                          marginTop: 2,
                        }}
                      >
                        {sublabel}
                      </p>
                    </div>
                  </div>
                </TappableCard>
              </motion.div>
            );
          })}
        </motion.div>
      </div>

      {/* Section 2: Chapter Order */}
      <div style={{ width: "100%", marginBottom: 40 }}>
        <p
          style={{
            fontFamily: "var(--font-dm-sans)",
            fontSize: 11,
            fontWeight: 600,
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            marginBottom: 12,
          }}
        >
          How Should Chapters Open?
        </p>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            width: "100%",
          }}
        >
          {chapterOrderOptions.map(({ value, label, description, Icon }) => {
            const isSelected = chapterOrder === value;

            return (
              <motion.div key={value} variants={staggerItem}>
                <TappableCard
                  selected={isSelected}
                  onSelect={() => setChapterOrder(value)}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 14,
                      minHeight: 48,
                    }}
                  >
                    <Icon
                      size={24}
                      strokeWidth={1.5}
                      style={{
                        color: isSelected
                          ? "var(--accent-blue)"
                          : "var(--text-secondary)",
                        transition: "color 200ms ease",
                        marginTop: 2,
                        flexShrink: 0,
                      }}
                    />

                    <div>
                      <p
                        style={{
                          fontFamily: "var(--font-sora)",
                          fontWeight: 600,
                          fontSize: 15,
                          color: "var(--text-heading)",
                          marginBottom: 4,
                          lineHeight: 1.3,
                        }}
                      >
                        {label}
                      </p>
                      <p
                        style={{
                          fontFamily: "var(--font-dm-sans)",
                          fontSize: 13,
                          color: "var(--text-secondary)",
                          lineHeight: 1.5,
                        }}
                      >
                        {description}
                      </p>
                    </div>
                  </div>
                </TappableCard>
              </motion.div>
            );
          })}
        </motion.div>
      </div>

      {/* Continue CTA */}
      <motion.button
        onClick={onNext}
        whileHover={prefersReducedMotion ? {} : { scale: 1.02 }}
        whileTap={prefersReducedMotion ? {} : { scale: 0.98 }}
        animate={
          !prefersReducedMotion
            ? {
                boxShadow: [
                  "0 0 16px var(--glow-green)",
                  "0 0 24px var(--glow-green)",
                  "0 0 16px var(--glow-green)",
                ],
              }
            : {}
        }
        transition={{
          boxShadow: { repeat: Infinity, duration: 2, ease: "easeInOut" },
        }}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          padding: "14px 40px",
          minHeight: 48,
          borderRadius: "var(--radius-md-val)",
          backgroundColor: "var(--accent-green)",
          color: "#0B0B0F",
          fontFamily: "var(--font-dm-sans)",
          fontSize: 16,
          fontWeight: 600,
          border: "none",
          cursor: "pointer",
          outline: "none",
        }}
      >
        Continue
        <ArrowRight size={18} strokeWidth={2} />
      </motion.button>
    </div>
  );
}
