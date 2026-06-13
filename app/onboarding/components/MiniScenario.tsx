"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useOnboarding } from "@/app/onboarding/hooks/useOnboarding";
import {
  FIRST_LOOP_CONTENT,
  getScenarioForMotivation,
} from "@/app/onboarding/data/chapters";
import {
  staggerContainer,
  staggerItem,
} from "@/app/onboarding/utils/animations";
import { Button } from "@/components/ui/button";

interface MiniScenarioProps {
  onContinue: () => void;
}

export default function MiniScenario({ onContinue }: MiniScenarioProps) {
  const prefersReducedMotion = useReducedMotion();
  const { motivation } = useOnboarding();
  const scenarioType = getScenarioForMotivation(motivation);
  const scenario = FIRST_LOOP_CONTENT.scenarios[scenarioType];

  const sections = [
    { label: "THE SITUATION", text: scenario.situation, color: "var(--accent-cyan)" },
    { label: "WHAT TO DO", text: scenario.whatToDo, color: "var(--accent-cyan)" },
    { label: "WHY IT MATTERS", text: scenario.whyItMatters, color: "var(--accent-amber)" },
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

      {/* CTA — shared brand primary */}
      <motion.div variants={staggerItem} className="mt-2">
        <Button size="lg" className="w-full" onClick={onContinue}>
          Continue to quiz
          <ArrowRight size={18} strokeWidth={2} />
        </Button>
      </motion.div>
    </motion.div>
  );
}
