"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useOnboarding } from "@/app/onboarding/hooks/useOnboarding";
import {
  FIRST_LOOP_CONTENT,
  getScenarioForMotivation,
} from "@/app/onboarding/data/chapters";
import {
  staggerContainer,
  staggerItem,
} from "@/app/onboarding/utils/animations";

interface MiniScenarioProps {
  onContinue: () => void;
}

export default function MiniScenario({ onContinue }: MiniScenarioProps) {
  const prefersReducedMotion = useReducedMotion();
  const { motivation } = useOnboarding();
  const scenarioType = getScenarioForMotivation(motivation);
  const scenario = FIRST_LOOP_CONTENT.scenarios[scenarioType];

  const sections = [
    { label: "THE SITUATION", text: scenario.situation, color: "#5B8DEF" },
    { label: "WHAT TO DO", text: scenario.whatToDo, color: "#3ECFB2" },
    { label: "WHY IT MATTERS", text: scenario.whyItMatters, color: "#FF8C42" },
  ];

  return (
    <motion.div
      variants={staggerContainer}
      initial={prefersReducedMotion ? false : "hidden"}
      animate="show"
      style={{
        display: "flex",
        flexDirection: "column" as const,
        gap: 16,
      }}
    >
      {sections.map((section, i) => (
        <motion.div
          key={section.label}
          variants={staggerItem}
          style={{
            background: "var(--cf-surface)",
            border: "1px solid var(--cf-border)",
            boxShadow: "var(--cf-shadow-sm)",
            borderRadius: "var(--radius-lg-val, 16px)",
            padding: "18px 20px",
          }}
        >
          <p
            style={{
              fontFamily: "var(--font-dm-sans, sans-serif)",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase" as const,
              color: section.color,
              margin: "0 0 10px",
            }}
          >
            {section.label}
          </p>
          <p
            style={{
              fontFamily: "var(--font-dm-sans, sans-serif)",
              fontSize: 15,
              lineHeight: 1.7,
              color: "var(--cf-text-1)",
              margin: 0,
            }}
          >
            {section.text}
          </p>
        </motion.div>
      ))}

      {/* CTA */}
      <motion.div variants={staggerItem}>
        <button
          onClick={onContinue}
          style={{
            width: "100%",
            minHeight: 48,
            padding: "14px 24px",
            marginTop: 8,
            fontFamily: "var(--font-dm-sans, sans-serif)",
            fontSize: 16,
            fontWeight: 600,
            color: "#0A0E1A",
            background: "#3BD4A0",
            border: "none",
            borderRadius: "var(--radius-md-val, 12px)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            boxShadow: "0 0 20px rgba(59,212,160,0.25)",
            transition: "filter 0.15s, transform 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.filter = "brightness(1.1)";
            e.currentTarget.style.transform = "scale(1.02)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.filter = "brightness(1)";
            e.currentTarget.style.transform = "scale(1)";
          }}
        >
          Continue to quiz
          <span>&rarr;</span>
        </button>
      </motion.div>
    </motion.div>
  );
}
