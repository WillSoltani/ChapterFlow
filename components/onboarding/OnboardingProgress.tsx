"use client";

import { motion } from "framer-motion";

interface OnboardingProgressProps {
  currentStep: 1 | 2 | 3;
}

export function OnboardingProgress({ currentStep }: OnboardingProgressProps) {
  const widthPercent = currentStep === 1 ? 33 : currentStep === 2 ? 66 : 100;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50"
      style={{ height: 3, background: "var(--border-subtle)" }}
    >
      <motion.div
        className="h-full"
        style={{ background: "var(--accent-blue)" }}
        initial={false}
        animate={{ width: `${widthPercent}%` }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  );
}
