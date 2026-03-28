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
  Atom,
  Heart,
  Scale,
  Lightbulb,
  DollarSign,
  Landmark,
  Cpu,
  Users,
  Repeat,
  Megaphone,
  Eye,
  GraduationCap,
  Pen,
  ArrowRight,
} from "lucide-react";
import { useOnboarding } from "@/app/onboarding/hooks/useOnboarding";
import {
  staggerContainer,
  staggerItem,
} from "@/app/onboarding/utils/animations";

interface StepInterestsProps {
  onNext: () => void;
  onSkip: () => void;
}

const accentGradients = [
  "linear-gradient(180deg, var(--accent-blue), transparent)",
  "linear-gradient(180deg, var(--accent-teal), transparent)",
  "linear-gradient(180deg, var(--accent-violet), transparent)", // purple
  "linear-gradient(180deg, var(--accent-gold), transparent)",
];

const topics: { slug: string; label: string; Icon: typeof Brain }[] = [
  { slug: "psychology", label: "Psychology", Icon: Brain },
  { slug: "productivity", label: "Productivity", Icon: Zap },
  { slug: "leadership", label: "Leadership", Icon: Crown },
  { slug: "strategy", label: "Strategy", Icon: Crosshair },
  { slug: "communication", label: "Communication", Icon: MessageCircle },
  { slug: "philosophy", label: "Philosophy", Icon: BookOpen },
  { slug: "negotiation", label: "Negotiation", Icon: Handshake },
  { slug: "entrepreneurship", label: "Entrepreneurship", Icon: Rocket },
  { slug: "science", label: "Science", Icon: Atom },
  { slug: "health-wellness", label: "Health & Wellness", Icon: Heart },
  { slug: "decision-making", label: "Decision-Making", Icon: Scale },
  { slug: "creativity", label: "Creativity", Icon: Lightbulb },
  { slug: "finance", label: "Finance", Icon: DollarSign },
  { slug: "history", label: "History", Icon: Landmark },
  { slug: "technology", label: "Technology", Icon: Cpu },
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
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width: "100%",
        maxWidth: 640,
        margin: "0 auto",
        padding: "0 16px",
        paddingBottom: 100,
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
        What interests you most?
      </h1>

      {/* Subtitle */}
      <p
        style={{
          fontFamily: "var(--font-dm-sans)",
          fontSize: 16,
          color: "var(--text-secondary)",
          textAlign: "center",
          marginBottom: 32,
          lineHeight: 1.5,
        }}
      >
        Pick at least 3. We&apos;ll build your shelf around these.
      </p>

      {/* Topic grid */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 10,
          width: "100%",
          marginBottom: 24,
        }}
      >
        {topics.map(({ slug, label, Icon }) => {
          const isSelected = interests.includes(slug);
          const selectedIndex = interests.indexOf(slug);
          const accentGradient =
            isSelected
              ? accentGradients[selectedIndex % accentGradients.length]
              : "none";

          return (
            <motion.button
              key={slug}
              variants={staggerItem}
              whileHover={prefersReducedMotion ? {} : { scale: 1.03 }}
              whileTap={prefersReducedMotion ? {} : { scale: 0.97 }}
              onClick={() => toggleInterest(slug)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "12px 16px",
                minHeight: 48,
                borderRadius: "var(--radius-lg-val)",
                backgroundColor: isSelected
                  ? "color-mix(in srgb, var(--accent-cyan) 10%, transparent)"
                  : "var(--bg-glass)",
                border: isSelected
                  ? "1px solid var(--accent-blue)"
                  : "1px solid var(--border-subtle)",
                cursor: "pointer",
                outline: "none",
                position: "relative",
                overflow: "hidden",
                transition:
                  "border-color 200ms ease, background-color 150ms ease",
              }}
              aria-pressed={isSelected}
            >
              {/* Left accent gradient bar */}
              {isSelected && (
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: 3,
                    background: accentGradient,
                    borderRadius: "3px 0 0 3px",
                  }}
                />
              )}

              <Icon
                size={20}
                strokeWidth={1.5}
                style={{
                  color: isSelected
                    ? "var(--accent-blue)"
                    : "var(--text-secondary)",
                  transition: "color 200ms ease",
                  flexShrink: 0,
                }}
              />

              <span
                style={{
                  fontFamily: "var(--font-dm-sans)",
                  fontSize: 14,
                  color: isSelected
                    ? "var(--text-heading)"
                    : "var(--text-primary)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  transition: "color 200ms ease",
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
            transition={{ duration: 0.2 }}
            style={{
              padding: "6px 16px",
              borderRadius: 999,
              backgroundColor: "var(--bg-glass)",
              border: "1px solid var(--border-subtle)",
              marginBottom: 24,
            }}
          >
            <motion.span
              key={selectedCount}
              initial={prefersReducedMotion ? {} : { scale: 1.2 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
              style={{
                fontFamily: "var(--font-dm-sans)",
                fontSize: 14,
                fontWeight: 500,
                color: isReady ? "var(--accent-teal)" : "var(--text-muted)",
                transition: "color 300ms ease",
              }}
            >
              {selectedCount} selected
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom actions */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 24,
          width: "100%",
        }}
      >
        {/* Continue CTA */}
        <motion.button
          onClick={isReady ? onNext : undefined}
          disabled={!isReady}
          whileHover={
            isReady && !prefersReducedMotion ? { scale: 1.02 } : {}
          }
          whileTap={
            isReady && !prefersReducedMotion ? { scale: 0.98 } : {}
          }
          animate={
            isReady && !prefersReducedMotion
              ? {
                  boxShadow: [
                    "0 0 16px var(--glow-green)",
                    "0 0 24px var(--glow-green)",
                    "0 0 16px var(--glow-green)",
                  ],
                }
              : {}
          }
          transition={
            isReady
              ? { boxShadow: { repeat: Infinity, duration: 2, ease: "easeInOut" } }
              : {}
          }
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "14px 32px",
            minHeight: 48,
            borderRadius: "var(--radius-md-val)",
            backgroundColor: "var(--accent-green)",
            color: "var(--cf-page-bg)",
            fontFamily: "var(--font-dm-sans)",
            fontSize: 16,
            fontWeight: 600,
            border: "none",
            cursor: isReady ? "pointer" : "default",
            opacity: isReady ? 1 : 0.4,
            outline: "none",
            transition: "opacity 200ms ease",
          }}
        >
          Continue
          <ArrowRight size={18} strokeWidth={2} />
        </motion.button>

        {/* Skip link */}
        <button
          onClick={onSkip}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontFamily: "var(--font-dm-sans)",
            fontSize: 14,
            color: "var(--text-muted)",
            padding: "8px 4px",
            outline: "none",
          }}
        >
          Skip
        </button>
      </div>

      {/* Responsive: 2 cols on mobile */}
      <style>{`
        @media (max-width: 560px) {
          div[style*="grid-template-columns: repeat(3"] {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
      `}</style>
    </div>
  );
}
