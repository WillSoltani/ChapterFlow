"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Leaf, Zap, Flame, ArrowRight, Check, CheckCircle, XCircle } from "lucide-react";
import TappableCard from "./TappableCard";
import { useOnboarding, type Tone } from "@/app/onboarding/hooks/useOnboarding";
import { staggerContainer, staggerItem } from "@/app/onboarding/utils/animations";

interface StepToneProps {
  onNext: () => void;
}

const toneOptions: {
  id: Tone;
  label: string;
  description: string;
  Icon: typeof Leaf;
  accentColor: string;
}[] = [
  {
    id: "gentle",
    label: "Gentle",
    description: "Warm and encouraging. Celebrates effort and frames growth as a journey.",
    Icon: Leaf,
    accentColor: "var(--accent-cyan)",
  },
  {
    id: "direct",
    label: "Direct",
    description: "Clear and efficient. Gets to the point and respects your time.",
    Icon: Zap,
    accentColor: "var(--accent-cyan)",
  },
  {
    id: "competitive",
    label: "Competitive",
    description: "High-energy and challenging. Frames ideas as advantages to seize.",
    Icon: Flame,
    accentColor: "var(--accent-amber)",
  },
];

const tonePreviewContent: Record<
  Tone,
  {
    paragraph: string;
    quizCorrect: string;
    quizWrong: string;
    borderColor: string;
  }
> = {
  gentle: {
    paragraph:
      "When someone feels genuinely heard, something shifts. The first chapter of this book suggests that negotiation isn't about being clever or forceful. It's about listening so deeply that the other person feels understood. You don't need to have all the answers. Sometimes the most powerful move is a quiet one: reflecting back what someone just said, and letting them hear their own words. It's a small thing, but it changes the entire dynamic. And the best part is, you can start practicing it today in any conversation.",
    quizCorrect: "Exactly right. You're getting this.",
    quizWrong:
      "Not quite. Here's another way to think about it. The chapter emphasizes listening over persuasion.",
    borderColor: "var(--accent-cyan)",
  },
  direct: {
    paragraph:
      "Here's the core principle: real negotiation starts with listening, not talking. Voss calls it tactical empathy. Understanding what someone feels and demonstrating that you understand it. Forget persuasion tricks. The first move is always the same: mirror what they said, label the emotion behind it, and let the silence do the work. Most people are too busy constructing their next argument to actually hear what's being said. That's their loss, and your opening.",
    quizCorrect: "Correct.",
    quizWrong:
      "Wrong. The principle says listening comes first, not persuasion.",
    borderColor: "var(--accent-cyan)",
  },
  competitive: {
    paragraph:
      "Most people walk into negotiations planning what they're going to say. That's already a losing move. Voss figured out what hostage negotiators know that business schools don't: the person who listens hardest wins. Tactical empathy isn't soft. It's a weapon. You mirror their words, you label their fears, and suddenly you're the only person in the room they trust. While everyone else is talking past each other, you're extracting information and building leverage with every sentence. That's not kindness. That's strategy.",
    quizCorrect:
      "That's the move. You're ahead of 90% of people.",
    quizWrong:
      "Miss. That's the average answer. The real edge here is listening, not persuading.",
    borderColor: "var(--accent-amber)",
  },
};

export default function StepTone({ onNext }: StepToneProps) {
  const { tone, setTone } = useOnboarding();
  const prefersReducedMotion = useReducedMotion();
  const noMotion = !!prefersReducedMotion;
  const preview = tonePreviewContent[tone];

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 900,
        margin: "0 auto",
        padding: "0 20px",
      }}
    >
      {/* Heading */}
      <h1
        style={{
          fontFamily: "var(--font-sora, sans-serif)",
          fontWeight: 600,
          fontSize: "clamp(28px, 5vw, 36px)",
          color: "var(--cf-text-1)",
          textAlign: "center",
          marginBottom: 8,
          lineHeight: 1.2,
        }}
      >
        Choose your tone
      </h1>
      <p
        style={{
          fontFamily: "var(--font-dm-sans, sans-serif)",
          fontSize: 16,
          color: "var(--cf-text-3)",
          textAlign: "center",
          marginBottom: 32,
          lineHeight: 1.5,
        }}
      >
        This sets how every chapter talks to you.
      </p>

      {/* Two-column layout on desktop, stacked on mobile */}
      <div
        style={{
          display: "flex",
          gap: 32,
          alignItems: "flex-start",
        }}
        className="flex-col lg:flex-row"
      >
        {/* Left: Tone option cards */}
        <div style={{ flex: "0 0 55%" }} className="w-full lg:w-auto">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              width: "100%",
            }}
            role="radiogroup"
            aria-label="Select content tone"
          >
            {toneOptions.map(({ id, label, description, Icon, accentColor }) => {
              const isSelected = tone === id;
              return (
                <motion.div key={id} variants={staggerItem}>
                  <TappableCard
                    selected={isSelected}
                    onSelect={() => setTone(id)}
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
                        size={28}
                        strokeWidth={1.5}
                        style={{
                          color: isSelected ? accentColor : "var(--cf-text-3)",
                          transition: "color 200ms ease",
                          marginTop: 2,
                          flexShrink: 0,
                        }}
                      />
                      <div style={{ flex: 1 }}>
                        <p
                          style={{
                            fontFamily: "var(--font-sora, sans-serif)",
                            fontWeight: 600,
                            fontSize: 17,
                            color: "var(--cf-text-1)",
                            marginBottom: 4,
                            lineHeight: 1.3,
                          }}
                        >
                          {label}
                        </p>
                        <p
                          style={{
                            fontFamily: "var(--font-dm-sans, sans-serif)",
                            fontSize: 14,
                            color: "var(--cf-text-3)",
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

          {/* Continue CTA */}
          <motion.button
            onClick={onNext}
            whileHover={noMotion ? {} : { scale: 1.02 }}
            whileTap={noMotion ? {} : { scale: 0.98 }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "14px 40px",
              minHeight: 48,
              borderRadius: 12,
              backgroundColor: "var(--accent-emerald)",
              color: "var(--bg-base)",
              fontFamily: "var(--font-dm-sans, sans-serif)",
              fontSize: 16,
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
              outline: "none",
              marginTop: 24,
              width: "100%",
              boxShadow: "0 0 20px color-mix(in srgb, var(--accent-emerald) 25%, transparent)",
              transition: "filter 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.filter = "brightness(1.1)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.filter = "brightness(1)"; }}
          >
            Continue
            <ArrowRight size={18} strokeWidth={2} />
          </motion.button>
        </div>

        {/* Right: Live preview panel */}
        <div
          style={{ flex: "0 0 45%" }}
          className="w-full lg:w-auto lg:sticky lg:top-[120px]"
        >
          <div
            style={{
              background: "var(--cf-surface-muted)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              border: "1px solid var(--cf-border-strong)",
              borderRadius: 20,
              padding: 24,
              boxShadow: "var(--cf-shadow-lg)",
              minHeight: 320,
            }}
            aria-live="polite"
          >
            {/* Preview header */}
            <p
              style={{
                fontFamily: "var(--font-dm-sans, sans-serif)",
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--cf-text-soft)",
                marginBottom: 4,
              }}
            >
              Preview · Never Split the Difference
            </p>
            <p
              style={{
                fontFamily: "var(--font-dm-sans, sans-serif)",
                fontSize: 13,
                color: "var(--cf-text-soft)",
                marginBottom: 20,
              }}
            >
              Chapter 1
            </p>

            {/* Preview content — cross-fades on tone change */}
            <AnimatePresence mode="wait">
              <motion.div
                key={tone}
                initial={noMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={noMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
                transition={{ duration: noMotion ? 0.05 : 0.3, ease: "easeOut" }}
              >
                {/* Paragraph with accent-colored left border */}
                <div
                  style={{
                    borderLeft: `3px solid ${preview.borderColor}`,
                    paddingLeft: 16,
                    marginBottom: 24,
                    transition: "border-color 300ms ease",
                  }}
                >
                  <p
                    style={{
                      fontFamily: "var(--font-dm-sans, sans-serif)",
                      fontSize: 15,
                      fontStyle: "italic",
                      color: "var(--cf-text-2)",
                      lineHeight: 1.7,
                      margin: 0,
                    }}
                  >
                    &ldquo;{preview.paragraph}&rdquo;
                  </p>
                </div>

                {/* Quiz feedback section */}
                <div>
                  <p
                    style={{
                      fontFamily: "var(--font-dm-sans, sans-serif)",
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: "var(--cf-text-soft)",
                      marginBottom: 12,
                    }}
                  >
                    How quiz feedback sounds
                  </p>

                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                      <CheckCircle
                        size={16}
                        style={{ color: "var(--accent-cyan)", marginTop: 2, flexShrink: 0 }}
                      />
                      <p
                        style={{
                          fontFamily: "var(--font-dm-sans, sans-serif)",
                          fontSize: 14,
                          color: "var(--accent-cyan)",
                          lineHeight: 1.5,
                          margin: 0,
                        }}
                      >
                        {preview.quizCorrect}
                      </p>
                    </div>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                      <XCircle
                        size={16}
                        style={{ color: "var(--accent-rose)", marginTop: 2, flexShrink: 0 }}
                      />
                      <p
                        style={{
                          fontFamily: "var(--font-dm-sans, sans-serif)",
                          fontSize: 14,
                          color: "var(--accent-rose)",
                          lineHeight: 1.5,
                          margin: 0,
                        }}
                      >
                        {preview.quizWrong}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
