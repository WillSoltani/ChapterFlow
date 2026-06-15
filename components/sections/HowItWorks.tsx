"use client";

import { Fragment, useRef } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { SectionReveal } from "@/components/ui/SectionReveal";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { LEARNING_LOOP_STEPS } from "@/lib/learning-loop";

const steps = [
  {
    number: "01",
    label: "UNDERSTAND",
    title: "Read the key ideas at your depth",
    description:
      "Choose Lite, Standard, or Deeper. Get the chapter\u2019s main idea, key insight, and takeaways \u2014 structured for clarity, not length.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="3" y="4" width="14" height="2" rx="1" fill="currentColor" />
        <rect x="3" y="9" width="14" height="2" rx="1" fill="currentColor" />
        <rect x="3" y="14" width="10" height="2" rx="1" fill="currentColor" />
      </svg>
    ),
  },
  {
    number: "02",
    label: "APPLY",
    title: "See it in a real situation",
    description:
      "Scenario examples translate abstract concepts into practical decisions at work, school, or in everyday life.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="10" cy="10" r="1" fill="currentColor" />
      </svg>
    ),
  },
  {
    number: "03",
    label: "PROVE",
    title: "Take the quiz, earn the unlock",
    description:
      "Five scenario-based questions test whether you can actually apply what you learned. Not trivia \u2014 applied thinking.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="3" y="3" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
        <rect x="11" y="3" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
        <rect x="3" y="11" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
        <rect x="11" y="11" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    number: "04",
    label: "PROGRESS",
    title: "Unlock the next chapter",
    description:
      "Pass the quiz, unlock the next chapter. Progress is earned, not scrolled through. Every unlock means real understanding.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path
          d="M4 10h12M12 6l4 4-4 4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
];

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.7,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  },
};

export function HowItWorks() {
  const gridRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(gridRef, { once: true, amount: 0.15 });
  const prefersReducedMotion = useReducedMotion();

  const renderCard = (step: (typeof steps)[number], index: number) => (
    <div
      key={step.number}
      className={`group relative overflow-hidden rounded-xl border bg-(--bg-glass) backdrop-blur-[16px] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-(--border-medium) ${
        step.number === "01"
          ? "border-(--accent-teal)/30"
          : "border-(--border-subtle)"
      }`}
      style={
        step.number === "01"
          ? { boxShadow: "0 0 24px color-mix(in srgb, var(--accent-cyan) 8%, transparent)" }
          : undefined
      }
    >
      {/* Watermark number */}
      <span
        className="pointer-events-none absolute top-4 right-4 select-none text-[6rem] font-bold leading-none opacity-[0.10] text-(--accent-teal)"
        style={{ fontFamily: "var(--font-display)" }}
        aria-hidden="true"
      >
        {step.number}
      </span>

      {/* Icon */}
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-(--accent-teal)/10 text-(--accent-teal)">
        {step.icon}
      </div>

      {/* Label — gloss paired with the canonical in-app step name */}
      <p
        className="mt-4 text-[12px] font-semibold uppercase tracking-[0.15em] text-(--accent-teal)"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {step.label}
        <span className="ml-2 font-medium normal-case tracking-normal text-(--text-secondary)">
          {LEARNING_LOOP_STEPS[index]}
        </span>
      </p>

      {/* Title */}
      <h3
        className="mt-2 text-[18px] font-semibold leading-snug text-(--text-heading) lg:text-[20px]"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {step.title}
      </h3>

      {/* Description */}
      <p
        className="mt-2 text-[14px] leading-[1.6] text-(--text-secondary)"
        style={{ fontFamily: "var(--font-body)" }}
      >
        {step.description}
      </p>
    </div>
  );

  return (
    <section id="how-it-works" className="py-14 lg:py-20">
      <div className="max-w-7xl mx-auto px-4">
        {/* Intro */}
        <SectionReveal>
          <SectionLabel>HOW IT WORKS</SectionLabel>

          <h2
            className="mt-4 text-[28px] md:text-[36px] lg:text-[44px] font-bold leading-[1.1] tracking-[-0.02em] text-(--text-heading)"
            style={{ fontFamily: "var(--font-display)" }}
          >
            One chapter. Four steps. Real understanding.
          </h2>

          <p
            className="mt-4 max-w-[600px] text-(--text-secondary)"
            style={{ fontFamily: "var(--font-body)" }}
          >
            Every chapter follows the same structured loop — designed around how
            your brain actually retains information.
          </p>
        </SectionReveal>

        {/* Step cards grid */}
        {prefersReducedMotion ? (
          <div
            ref={gridRef}
            className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr]"
          >
            {steps.map((step, i) => (
              <Fragment key={step.number}>
                {renderCard(step, i)}
                {i < steps.length - 1 && (
                  <div className="hidden lg:flex items-center justify-center self-center -mx-3 z-10 flex-shrink-0">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path
                        d="M3 8h10M9 4l4 4-4 4"
                        stroke="var(--accent-teal)"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity="0.5"
                      />
                    </svg>
                  </div>
                )}
              </Fragment>
            ))}
          </div>
        ) : (
          <motion.div
            ref={gridRef}
            className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr]"
            variants={containerVariants}
            initial="hidden"
            animate={isInView ? "visible" : "hidden"}
          >
            {steps.map((step, i) => (
              <Fragment key={step.number}>
                <motion.div variants={cardVariants}>
                  {renderCard(step, i)}
                </motion.div>
                {i < steps.length - 1 && (
                  <div className="hidden lg:flex items-center justify-center self-center -mx-3 z-10 flex-shrink-0">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path
                        d="M3 8h10M9 4l4 4-4 4"
                        stroke="var(--accent-teal)"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity="0.5"
                      />
                    </svg>
                  </div>
                )}
              </Fragment>
            ))}
          </motion.div>
        )}
      </div>
    </section>
  );
}
