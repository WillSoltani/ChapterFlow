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
    { label: "THE SITUATION", text: scenario.situation },
    { label: "WHAT TO DO", text: scenario.whatToDo },
    { label: "WHY IT MATTERS", text: scenario.whyItMatters },
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
            background: "var(--bg-glass, rgba(255,255,255,0.03))",
            border: "1px solid var(--border-subtle, rgba(255,255,255,0.06))",
            borderRadius: "var(--radius-lg-val, 16px)",
            padding: "18px 20px",
          }}
        >
          <p
            style={{
              fontFamily: "var(--font-dm-sans, sans-serif)",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase" as const,
              color: "var(--text-muted, #5A5A6E)",
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
              color: "var(--text-primary, #E2E2E6)",
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
            color: "var(--text-heading, #FAFAFA)",
            background: "var(--bg-glass-hover, rgba(255,255,255,0.06))",
            border: "1px solid var(--border-medium, rgba(255,255,255,0.10))",
            borderRadius: "var(--radius-md-val, 12px)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            transition: "background 0.15s, border-color 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.09)";
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background =
              "var(--bg-glass-hover, rgba(255,255,255,0.06))";
            e.currentTarget.style.borderColor =
              "var(--border-medium, rgba(255,255,255,0.10))";
          }}
        >
          Continue to quiz
          <span>&rarr;</span>
        </button>
      </motion.div>
    </motion.div>
  );
}
