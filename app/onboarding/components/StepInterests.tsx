"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Brain,
  Zap,
  Crown,
  Crosshair,
  MessageCircle,
  BookOpen,
  Handshake,
  Rocket,
  Heart,
  Scale,
  Lightbulb,
  DollarSign,
  Users,
  Repeat,
  Megaphone,
  Eye,
  GraduationCap,
  Pen,
  ArrowRight,
} from "lucide-react";
import { useOnboarding } from "@/app/onboarding/hooks/useOnboarding";
import { staggerContainer, staggerItem } from "@/app/onboarding/utils/animations";
import { DUR } from "@/lib/motion";
import { Button } from "@/components/ui/button";

interface StepInterestsProps {
  onNext: () => void;
  onSkip: () => void;
}

/* Topics shown in onboarding. Kept in sync with INTEREST_SIGNALS in
 * data/books.ts — every topic here maps to real books in the catalog, so
 * picking it visibly reshapes the swipe deck. Catalog-misaligned topics
 * (science / history / technology) were removed: the catalog has no real books
 * for them, so they only surfaced incidental tag noise and didn't differentiate. */
const topics: { slug: string; label: string; Icon: typeof Brain }[] = [
  { slug: "psychology", label: "Psychology", Icon: Brain },
  { slug: "productivity", label: "Productivity", Icon: Zap },
  { slug: "leadership", label: "Leadership", Icon: Crown },
  { slug: "strategy", label: "Strategy", Icon: Crosshair },
  { slug: "communication", label: "Communication", Icon: MessageCircle },
  { slug: "philosophy", label: "Philosophy", Icon: BookOpen },
  { slug: "negotiation", label: "Negotiation", Icon: Handshake },
  { slug: "entrepreneurship", label: "Entrepreneurship", Icon: Rocket },
  { slug: "health-wellness", label: "Health & Wellness", Icon: Heart },
  { slug: "decision-making", label: "Decision-Making", Icon: Scale },
  { slug: "creativity", label: "Creativity", Icon: Lightbulb },
  { slug: "finance", label: "Finance", Icon: DollarSign },
  { slug: "relationships", label: "Relationships", Icon: Users },
  { slug: "habits", label: "Habits", Icon: Repeat },
  { slug: "marketing", label: "Marketing", Icon: Megaphone },
  { slug: "self-awareness", label: "Self-Awareness", Icon: Eye },
  { slug: "education", label: "Education", Icon: GraduationCap },
  { slug: "writing", label: "Writing", Icon: Pen },
];

export default function StepInterests({ onNext, onSkip }: StepInterestsProps) {
  const { interests, toggleInterest } = useOnboarding();
  const prefersReducedMotion = useReducedMotion();

  const selectedCount = interests.length;
  const isReady = selectedCount >= 3;

  return (
    <div className="mx-auto flex w-full max-w-160 flex-col items-center px-4 pb-24">
      {/* Heading */}
      <h1
        className="mb-2 text-center font-(family-name:--font-display) text-[clamp(28px,5vw,36px)] font-semibold leading-tight"
        style={{ color: "var(--text-heading)" }}
      >
        What interests you most?
      </h1>

      {/* Subtitle */}
      <p
        className="mb-8 text-center text-base leading-relaxed"
        style={{ color: "var(--text-secondary)" }}
      >
        Pick at least 3 — your shelf is built around these.
      </p>

      {/* Topic grid: 2 columns on mobile, 3 on larger screens */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="mb-6 grid w-full grid-cols-2 gap-2.5 sm:grid-cols-3"
      >
        {topics.map(({ slug, label, Icon }) => {
          const isSelected = interests.includes(slug);

          return (
            <motion.button
              key={slug}
              type="button"
              variants={staggerItem}
              whileHover={prefersReducedMotion ? {} : { scale: 1.03 }}
              whileTap={prefersReducedMotion ? {} : { scale: 0.97 }}
              onClick={() => toggleInterest(slug)}
              aria-pressed={isSelected}
              className="relative flex min-h-12 items-start gap-2 overflow-hidden rounded-(--radius-lg-val) px-4 py-3"
              style={{
                backgroundColor: isSelected
                  ? "color-mix(in srgb, var(--accent-cyan) 10%, transparent)"
                  : "var(--bg-glass)",
                border: isSelected
                  ? "1px solid var(--accent-cyan)"
                  : "1px solid var(--border-subtle)",
                transition:
                  "border-color var(--duration-fast) var(--ease-out), background-color var(--duration-micro) var(--ease-out)",
              }}
            >
              <Icon
                size={20}
                strokeWidth={1.5}
                className="mt-0.5 shrink-0"
                style={{
                  color: isSelected ? "var(--accent-cyan)" : "var(--text-secondary)",
                  transition: "color var(--duration-fast) var(--ease-out)",
                }}
              />
              <span
                className="min-w-0 break-words text-sm leading-tight"
                style={{
                  color: isSelected ? "var(--text-heading)" : "var(--text-primary)",
                  transition: "color var(--duration-fast) var(--ease-out)",
                }}
              >
                {label}
              </span>
            </motion.button>
          );
        })}
      </motion.div>

      {/* Floating counter pill */}
      <AnimatePresence>
        {selectedCount > 0 && (
          <motion.div
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
            transition={{ duration: DUR.fast }}
            className="mb-6 rounded-full px-4 py-1.5"
            style={{
              backgroundColor: "var(--bg-glass)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <motion.span
              key={selectedCount}
              initial={prefersReducedMotion ? {} : { scale: 1.2 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
              className="text-sm font-medium"
              style={{
                color: isReady ? "var(--accent-cyan)" : "var(--text-muted)",
                transition: "color var(--duration-normal) var(--ease-out)",
              }}
            >
              {isReady ? `${selectedCount} selected` : `${selectedCount} of 3 selected`}
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom actions */}
      <div className="flex w-full items-center justify-center gap-6">
        <Button
          size="lg"
          className="min-w-45"
          disabled={!isReady}
          onClick={onNext}
        >
          Continue
          <ArrowRight size={18} strokeWidth={2} />
        </Button>

        <Button variant="ghost" size="lg" onClick={onSkip}>
          Skip
        </Button>
      </div>
    </div>
  );
}
