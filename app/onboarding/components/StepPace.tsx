"use client";

import { motion } from "framer-motion";
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
import { DAILY_GOAL_TIERS, type DailyGoalTier } from "@/app/book/settings/constants/defaults";
import {
  staggerContainer,
  staggerItem,
} from "@/app/onboarding/utils/animations";
import { Button } from "@/components/ui/button";

interface StepPaceProps {
  onNext: () => void;
}

// Lucide icon per goal tier. The shared DAILY_GOAL_TIERS constant carries no
// icon (Settings renders an emoji), so the icon is the only piece kept local —
// it's pure presentation, NOT divergent data. The minute buckets, sub-labels
// and the single "Most popular" default all come from the shared constant so
// onboarding and Settings can never drift into "two products" again (P1[G]).
const TIER_ICONS: Record<DailyGoal, typeof Coffee> = {
  10: Coffee,
  20: BookOpen,
  30: Flame,
};

// Onboarding's DailyGoal union — and the completion route's VALID_DAILY_GOALS —
// accept 10/20/30 only, so the shared constant's 5-min "Light" tier is NOT
// offered here: a 5 would be coerced to 20 by the route, silently re-mapping the
// user's pick (the exact failure this finding fixes). Adding the 4th tier needs
// widening DailyGoal + the route's VALID_DAILY_GOALS — handed off, out of scope.
// We map the shared tiers onto the existing card shape so the render loop below
// is unchanged; the "Most popular" badge follows the constant's `recommended`.
const dailyGoalOptions: {
  value: DailyGoal;
  label: string;
  sublabel: string;
  badge?: string | undefined;
  Icon: typeof Coffee;
}[] = DAILY_GOAL_TIERS.filter(
  (tier): tier is DailyGoalTier & { value: DailyGoal } =>
    tier.value === 10 || tier.value === 20 || tier.value === 30,
).map((tier) => ({
  value: tier.value,
  label: tier.minutesLabel,
  sublabel: tier.name,
  badge: tier.recommended ? "Most popular" : undefined,
  Icon: TIER_ICONS[tier.value],
}));

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
  const hasDailyGoal = dailyGoalOptions.some(({ value }) => dailyGoal === value);
  const hasChapterOrder = chapterOrderOptions.some(
    ({ value }) => chapterOrder === value,
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
        Choose your pace
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
        You can always change this later.
      </p>

      {/* Section 1: Daily Reading Goal */}
      <div style={{ width: "100%", marginBottom: 32 }}>
        <p
          style={{
            fontFamily: "var(--font-body)",
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
          className="grid w-full grid-cols-3"
          style={{ gap: 10 }}
          role="radiogroup"
          aria-label="Daily reading goal"
        >
          {dailyGoalOptions.map(({ value, label, sublabel, badge, Icon }, index) => {
            const isSelected = dailyGoal === value;

            return (
              <motion.div key={value} variants={staggerItem}>
                <TappableCard
                  selected={isSelected}
                  onSelect={() => setDailyGoal(value)}
                  tabStop={isSelected || (!hasDailyGoal && index === 0)}
                  positionInSet={index + 1}
                  setSize={dailyGoalOptions.length}
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
                    <Icon
                      size={28}
                      strokeWidth={1.5}
                      style={{
                        color: isSelected
                          ? "var(--accent-cyan)"
                          : "var(--text-secondary)",
                        transition: "color 200ms ease",
                      }}
                    />

                    <div>
                      <p
                        style={{
                          fontFamily: "var(--font-display)",
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
                          fontFamily: "var(--font-body)",
                          fontSize: 13,
                          color: "var(--text-secondary)",
                          lineHeight: 1.3,
                          marginTop: 2,
                        }}
                      >
                        {sublabel}
                      </p>

                      {/* Most Popular badge — inline below label */}
                      {badge && (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            marginTop: 8,
                            fontFamily: "var(--font-body)",
                            fontSize: 11,
                            fontWeight: 600,
                            color: "var(--accent-amber)",
                            backgroundColor: "color-mix(in srgb, var(--accent-amber) 12%, transparent)",
                            border: "1px solid color-mix(in srgb, var(--accent-amber) 25%, transparent)",
                            padding: "3px 10px",
                            borderRadius: 999,
                            whiteSpace: "nowrap",
                          }}
                        >
                          ★ {badge}
                        </span>
                      )}
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
            fontFamily: "var(--font-body)",
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
          role="radiogroup"
          aria-label="How should chapters open?"
        >
          {chapterOrderOptions.map(({ value, label, description, Icon }, index) => {
            const isSelected = chapterOrder === value;

            return (
              <motion.div key={value} variants={staggerItem}>
                <TappableCard
                  selected={isSelected}
                  onSelect={() => setChapterOrder(value)}
                  tabStop={isSelected || (!hasChapterOrder && index === 0)}
                  positionInSet={index + 1}
                  setSize={chapterOrderOptions.length}
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
                          ? "var(--accent-cyan)"
                          : "var(--text-secondary)",
                        transition: "color 200ms ease",
                        marginTop: 2,
                        flexShrink: 0,
                      }}
                    />

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

      {/* Continue CTA — shared brand primary (focus ring + states built in) */}
      <Button size="lg" className="min-w-45" onClick={onNext}>
        Continue
        <ArrowRight size={18} strokeWidth={2} />
      </Button>
    </div>
  );
}
