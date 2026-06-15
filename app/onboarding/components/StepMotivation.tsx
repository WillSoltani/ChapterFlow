"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Target, BookOpen, Sprout, Brain } from "lucide-react";
import { useRef, useCallback } from "react";
import TappableCard from "./TappableCard";
import { useOnboarding, type Motivation } from "@/app/onboarding/hooks/useOnboarding";
import {
  staggerContainer,
  staggerItem,
} from "@/app/onboarding/utils/animations";

interface StepMotivationProps {
  onNext: () => void;
}

const options: {
  value: Motivation;
  label: string;
  description: string;
  Icon: typeof Target;
}[] = [
  {
    value: "career",
    label: "Career growth",
    description: "Build sharper professional judgment",
    Icon: Target,
  },
  {
    value: "academic",
    label: "Exam prep",
    description: "Retain more from what you study",
    Icon: BookOpen,
  },
  {
    value: "personal",
    label: "Personal growth",
    description: "Develop better habits and mindset",
    Icon: Sprout,
  },
  {
    value: "curiosity",
    label: "Curiosity",
    description: "Explore ideas across many fields",
    Icon: Brain,
  },
];

export default function StepMotivation({ onNext }: StepMotivationProps) {
  const { motivation, setMotivation } = useOnboarding();
  const prefersReducedMotion = useReducedMotion();
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSelect = useCallback(
    (value: Motivation) => {
      setMotivation(value);

      // Clear any pending auto-advance
      if (advanceTimer.current) {
        clearTimeout(advanceTimer.current);
      }

      // Auto-advance after 400ms
      advanceTimer.current = setTimeout(() => {
        onNext();
      }, 400);
    },
    [setMotivation, onNext]
  );

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
          fontFamily: "var(--font-display)",
          fontWeight: 600,
          fontSize: "clamp(28px, 5vw, 36px)",
          color: "var(--text-heading)",
          textAlign: "center",
          marginBottom: 8,
          lineHeight: 1.2,
        }}
      >
        What brings you here?
      </h1>

      {/* Subtitle */}
      <p
        style={{
          fontFamily: "var(--font-body)",
          fontSize: 16,
          color: "var(--text-secondary)",
          textAlign: "center",
          marginBottom: 40,
          lineHeight: 1.5,
        }}
      >
        This shapes which books and examples show up first.
      </p>

      {/* 1 column on mobile, 2 on larger screens (replaces a [style*=] hack).
          role=radiogroup gives the role="radio" TappableCards a valid parent so
          assistive tech announces them as a single-select group. */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2"
        role="radiogroup"
        aria-label="What brings you here?"
      >
        {options.map(({ value, label, description, Icon }) => {
          const isSelected = motivation === value;

          return (
            <motion.div key={value} variants={staggerItem}>
              <TappableCard
                selected={isSelected}
                onSelect={() => handleSelect(value)}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    gap: 12,
                    minHeight: 48,
                  }}
                >
                  <motion.div
                    animate={
                      isSelected && !prefersReducedMotion
                        ? {
                            scale: [1, 1.15, 1],
                          }
                        : {}
                    }
                    transition={{ duration: 0.3 }}
                  >
                    <Icon
                      size={32}
                      style={{
                        color: isSelected
                          ? "var(--accent-cyan)"
                          : "var(--text-secondary)",
                        transition: "color 200ms ease",
                      }}
                      strokeWidth={1.5}
                    />
                  </motion.div>

                  <div>
                    <p
                      style={{
                        fontFamily: "var(--font-display)",
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
                        fontFamily: "var(--font-body)",
                        fontSize: 13,
                        color: "var(--text-secondary)",
                        lineHeight: 1.4,
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
  );
}
