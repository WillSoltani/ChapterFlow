"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SectionReveal } from "@/components/ui/SectionReveal";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { GreenCTA } from "@/components/ui/GreenCTA";
import { ConfettiEffect } from "@/components/ui/ConfettiEffect";

type Step = "summary" | "scenario" | "quiz";
type ScenarioOption = null | "a" | "b";
type QuizAnswer = null | "a" | "b" | "c" | "d";

const STEPS: { key: Step; label: string }[] = [
  { key: "summary", label: "Summary" },
  { key: "scenario", label: "Scenario" },
  { key: "quiz", label: "Quiz" },
];

const STEP_ORDER: Step[] = ["summary", "scenario", "quiz"];

const slideOut = { x: -40, opacity: 0 };
const slideIn = { x: 40, opacity: 0 };
const center = { x: 0, opacity: 1 };

const contentTransition = {
  exit: { duration: 0.25, ease: "easeIn" as const },
  enter: { duration: 0.3, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
};

function stepIndex(step: Step): number {
  return STEP_ORDER.indexOf(step);
}

export function InteractivePreview() {
  const [step, setStep] = useState<Step>("summary");
  const [selectedOption, setSelectedOption] = useState<ScenarioOption>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<QuizAnswer>(null);
  const [showQuizButton, setShowQuizButton] = useState(false);
  const [showQuizCTA, setShowQuizCTA] = useState(false);

  const currentIdx = stepIndex(step);

  const handleCorrectScenario = useCallback(() => {
    setSelectedOption("b");
    setTimeout(() => setShowQuizButton(true), 800);
  }, []);

  const handleQuizSelect = useCallback((answer: QuizAnswer) => {
    setSelectedAnswer(answer);
    if (answer !== "b") {
      setTimeout(() => setShowQuizCTA(true), 1000);
    }
  }, []);

  return (
    <section id="try-it" className="py-20 lg:py-28 max-w-180 mx-auto px-4">
      <SectionReveal>
        <SectionLabel>TRY IT NOW</SectionLabel>

        <h2
          className="text-[28px] md:text-[36px] font-bold mt-4"
          style={{
            fontFamily: "var(--font-display)",
            color: "var(--text-heading)",
          }}
        >
          Experience one chapter in 60 seconds.
        </h2>

        <p className="text-[16px] mt-3" style={{ color: "var(--text-secondary)" }}>
          No signup needed. See exactly how ChapterFlow works.
        </p>

        <div className="h-10" />

        {/* Outer container */}
        <div
          className="overflow-hidden"
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid var(--border-medium)",
            boxShadow: "0 0 40px rgba(79,139,255,0.06)",
            borderRadius: "var(--radius-xl-val)",
          }}
        >
          {/* Progress bar */}
          <div
            className="flex items-center justify-center h-12 px-4"
            style={{
              background: "var(--bg-raised)",
              borderBottom: "1px solid var(--border-subtle)",
            }}
          >
            {STEPS.map((s, i) => {
              const isActive = s.key === step;
              const isCompleted = stepIndex(s.key) < currentIdx;

              return (
                <div key={s.key} className="flex items-center">
                  {i > 0 && (
                    <div
                      className="w-10 h-px mx-2"
                      style={{
                        background:
                          stepIndex(STEPS[i - 1].key) < currentIdx
                            ? "var(--accent-green)"
                            : "var(--border-subtle)",
                      }}
                    />
                  )}
                  <div className="flex items-center gap-2">
                    {/* Circle */}
                    <div
                      className="flex items-center justify-center shrink-0"
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: "50%",
                        ...(isCompleted
                          ? { background: "var(--accent-green)" }
                          : isActive
                            ? { background: "var(--accent-blue)" }
                            : {
                                background: "transparent",
                                border: "1.5px solid var(--border-subtle)",
                              }),
                      }}
                    >
                      {isCompleted && (
                        <span className="text-white text-[10px] leading-none font-bold">
                          ✓
                        </span>
                      )}
                    </div>
                    {/* Label */}
                    <span
                      className="text-[13px] hidden sm:inline"
                      style={{
                        color: isActive
                          ? "var(--text-heading)"
                          : isCompleted
                            ? "var(--text-secondary)"
                            : "var(--text-muted)",
                        fontWeight: isActive ? 600 : 400,
                      }}
                    >
                      {s.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Content area */}
          <div className="p-5 md:p-7">
            <AnimatePresence mode="wait">
              {step === "summary" && (
                <SummaryStep key="summary" onNext={() => setStep("scenario")} />
              )}
              {step === "scenario" && (
                <ScenarioStep
                  key="scenario"
                  selectedOption={selectedOption}
                  onSelectA={() => setSelectedOption("a")}
                  onSelectB={handleCorrectScenario}
                  showQuizButton={showQuizButton}
                  onNext={() => setStep("quiz")}
                />
              )}
              {step === "quiz" && (
                <QuizStep
                  key="quiz"
                  selectedAnswer={selectedAnswer}
                  onSelect={handleQuizSelect}
                  showCTA={showQuizCTA}
                />
              )}
            </AnimatePresence>
          </div>
        </div>
      </SectionReveal>
    </section>
  );
}

/* ─── Glass card helper ─── */
function GlassCard({
  children,
  className = "",
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`rounded-(--radius-lg-val) ${className}`}
      style={{
        background: "var(--bg-glass)",
        border: "1px solid var(--border-subtle)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* ─── Step Header ─── */
function StepHeader({ icon, title }: { icon: string; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[18px]" role="img">
        {icon}
      </span>
      <span
        className="text-[16px] font-semibold"
        style={{ color: "var(--text-heading)" }}
      >
        {title}
      </span>
    </div>
  );
}

/* ─── Next button ─── */
function NextButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-center gap-2 p-3 px-6 text-[15px] font-medium cursor-pointer transition-all duration-200 focus:outline-2 focus:outline-offset-2"
      style={{
        background: "var(--bg-elevated)",
        color: "var(--text-heading)",
        border: "1px solid var(--border-medium)",
        borderRadius: "var(--radius-md-val)",
        outlineColor: "var(--accent-blue)",
        minHeight: 44,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--accent-blue)";
        e.currentTarget.style.background = "var(--bg-glass-hover)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--border-medium)";
        e.currentTarget.style.background = "var(--bg-elevated)";
      }}
    >
      <span>{children}</span>
      <span className="inline-block transition-transform duration-200 group-hover:translate-x-1">
        &rarr;
      </span>
    </button>
  );
}

/* ━━━ STEP 1 — SUMMARY ━━━ */
function SummaryStep({ onNext }: { onNext: () => void }) {
  return (
    <motion.div
      className="flex flex-col gap-5"
      initial={slideIn}
      animate={center}
      exit={slideOut}
      transition={contentTransition.enter}
    >
      <div>
        <StepHeader icon="📖" title="Chapter Summary" />
        <p className="text-[13px] mt-1" style={{ color: "var(--text-secondary)" }}>
          Atomic Habits, Chapter 1
        </p>
      </div>

      <GlassCard className="p-6">
        <span
          className="text-[12px] font-semibold uppercase tracking-widest"
          style={{ color: "var(--accent-blue)" }}
        >
          MAIN IDEA
        </span>
        <p
          className="text-[16px] mt-2"
          style={{ color: "var(--text-primary)", lineHeight: 1.7 }}
        >
          Your outcomes are a lagging measure of your habits. You do not rise to
          the level of your goals. You fall to the level of your systems.
        </p>

        <div
          className="my-4"
          style={{ height: 1, background: "var(--border-subtle)" }}
        />

        <span
          className="text-[12px] font-semibold uppercase tracking-widest"
          style={{ color: "var(--accent-blue)" }}
        >
          KEY TAKEAWAY
        </span>
        <p
          className="text-[16px] mt-2"
          style={{ color: "var(--text-primary)", lineHeight: 1.7 }}
        >
          Focus on building better systems rather than setting better goals.
          Small habits compound into remarkable results.
        </p>
      </GlassCard>

      <NextButton onClick={onNext}>Got it, show me the scenario</NextButton>
    </motion.div>
  );
}

/* ━━━ STEP 2 — SCENARIO ━━━ */
function ScenarioStep({
  selectedOption,
  onSelectA,
  onSelectB,
  showQuizButton,
  onNext,
}: {
  selectedOption: ScenarioOption;
  onSelectA: () => void;
  onSelectB: () => void;
  showQuizButton: boolean;
  onNext: () => void;
}) {
  const isResolved = selectedOption === "b";

  return (
    <motion.div
      className="flex flex-col gap-5"
      initial={slideIn}
      animate={center}
      exit={slideOut}
      transition={contentTransition.enter}
    >
      <StepHeader icon="🎯" title="Real World Scenario" />

      <GlassCard className="p-6">
        <p
          className="text-[16px]"
          style={{ color: "var(--text-primary)", lineHeight: 1.7 }}
        >
          Sarah wants to get healthier. She sets a goal to lose 20 pounds.
          Based on this chapter&apos;s key idea, what should Sarah focus on
          instead?
        </p>
      </GlassCard>

      <div className="flex flex-col gap-3">
        {/* Option A */}
        <ScenarioOptionCard
          selected={selectedOption === "a"}
          isCorrect={false}
          disabled={isResolved}
          onClick={onSelectA}
          label="Set a more specific weight target with weekly milestones"
          feedback={
            selectedOption === "a"
              ? "Close, but the chapter's insight is that goals matter less than the daily system you follow. Try option B."
              : undefined
          }
        />

        {/* Option B */}
        <ScenarioOptionCard
          selected={selectedOption === "b"}
          isCorrect={true}
          disabled={isResolved}
          onClick={onSelectB}
          label="Build a system: prep meals on Sunday, walk 15 min daily, sleep by 10pm"
          feedback={
            selectedOption === "b"
              ? "Exactly. Systems over goals. The weight follows the system."
              : undefined
          }
        />
      </div>

      <AnimatePresence>
        {showQuizButton && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
          >
            <NextButton onClick={onNext}>Ready for the quiz</NextButton>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ScenarioOptionCard({
  selected,
  isCorrect,
  disabled,
  onClick,
  label,
  feedback,
}: {
  selected: boolean;
  isCorrect: boolean;
  disabled: boolean;
  onClick: () => void;
  label: string;
  feedback?: string;
}) {
  const accentColor = isCorrect ? "var(--accent-green)" : "#F59E0B";
  const borderLeft = selected
    ? `3px solid ${accentColor}`
    : "3px solid transparent";
  const hoverBorder = `3px solid var(--accent-blue)`;

  return (
    <div>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        onClick={() => !disabled && onClick()}
        onKeyDown={(e) => {
          if (!disabled && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            onClick();
          }
        }}
        className="flex items-center gap-3 p-4 transition-all duration-200 focus:outline-2 focus:outline-offset-2"
        style={{
          background: "var(--bg-glass)",
          border: "1px solid var(--border-subtle)",
          borderLeft: selected ? borderLeft : borderLeft,
          borderRadius: "var(--radius-lg-val)",
          cursor: disabled ? "default" : "pointer",
          outlineColor: "var(--accent-blue)",
          minHeight: 44,
        }}
        onMouseEnter={(e) => {
          if (!disabled && !selected) {
            e.currentTarget.style.borderLeft = hoverBorder;
          }
        }}
        onMouseLeave={(e) => {
          if (!disabled && !selected) {
            e.currentTarget.style.borderLeft = "3px solid transparent";
          }
        }}
      >
        {/* Radio circle */}
        <div
          className="shrink-0 flex items-center justify-center"
          style={{
            width: 18,
            height: 18,
            borderRadius: "50%",
            border: selected ? "none" : "2px solid var(--border-medium)",
            background: selected ? accentColor : "transparent",
          }}
        >
          {selected && isCorrect && (
            <span className="text-white text-[10px] font-bold leading-none">
              ✓
            </span>
          )}
        </div>

        <span
          className="text-[15px]"
          style={{ color: "var(--text-primary)", lineHeight: 1.5 }}
        >
          {label}
        </span>
      </div>

      {/* Feedback */}
      <AnimatePresence>
        {feedback && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="text-[14px] italic mt-2 ml-8.5"
            style={{ color: accentColor }}
          >
            {feedback}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ━━━ STEP 3 — QUIZ ━━━ */
const QUIZ_OPTIONS: { key: QuizAnswer; letter: string; text: string }[] = [
  { key: "a", letter: "A", text: "They lack motivation and willpower" },
  {
    key: "b",
    letter: "B",
    text: "They focus on goals instead of systems",
  },
  {
    key: "c",
    letter: "C",
    text: "They try to change too many things at once",
  },
  {
    key: "d",
    letter: "D",
    text: "They don't track their progress enough",
  },
];

function QuizStep({
  selectedAnswer,
  onSelect,
  showCTA,
}: {
  selectedAnswer: QuizAnswer;
  onSelect: (answer: QuizAnswer) => void;
  showCTA: boolean;
}) {
  const isAnswered = selectedAnswer !== null;
  const isCorrect = selectedAnswer === "b";

  return (
    <motion.div
      className="flex flex-col gap-5"
      initial={slideIn}
      animate={center}
      exit={slideOut}
      transition={contentTransition.enter}
    >
      <StepHeader icon="🧠" title="Retention Check" />

      <GlassCard className="p-6">
        <p
          className="text-[16px] font-medium"
          style={{ color: "var(--text-primary)", lineHeight: 1.7 }}
        >
          According to Chapter 1 of Atomic Habits, why do most people fail to
          build lasting habits?
        </p>
      </GlassCard>

      <div className="flex flex-col gap-2.5">
        {QUIZ_OPTIONS.map((opt) => {
          const isThis = selectedAnswer === opt.key;
          const isCorrectAnswer = opt.key === "b";
          // Highlight logic: if answered, correct answer always gets green;
          // wrong selected answer gets amber
          let badgeBg = "var(--bg-elevated)";
          let badgeColor = "var(--text-secondary)";
          let leftBorder = "3px solid transparent";

          if (isAnswered) {
            if (isCorrectAnswer) {
              badgeBg = "var(--accent-green)";
              badgeColor = "white";
              leftBorder = "3px solid var(--accent-green)";
            } else if (isThis) {
              badgeBg = "#F59E0B";
              badgeColor = "white";
              leftBorder = "3px solid #F59E0B";
            }
          }

          return (
            <div
              key={opt.key}
              role="button"
              tabIndex={isAnswered ? -1 : 0}
              aria-disabled={isAnswered}
              onClick={() => !isAnswered && onSelect(opt.key)}
              onKeyDown={(e) => {
                if (!isAnswered && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  onSelect(opt.key);
                }
              }}
              className="flex items-center gap-3 p-3.5 px-4 transition-all duration-200 focus:outline-2 focus:outline-offset-2"
              style={{
                background: "var(--bg-glass)",
                border: "1px solid var(--border-subtle)",
                borderLeft: leftBorder,
                borderRadius: "var(--radius-lg-val)",
                cursor: isAnswered ? "default" : "pointer",
                outlineColor: "var(--accent-blue)",
                minHeight: 44,
              }}
              onMouseEnter={(e) => {
                if (!isAnswered) {
                  e.currentTarget.style.background = "var(--bg-glass-hover)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isAnswered) {
                  e.currentTarget.style.background = "var(--bg-glass)";
                }
              }}
            >
              {/* Letter badge */}
              <div
                className="shrink-0 flex items-center justify-center text-xs font-semibold"
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  background: badgeBg,
                  color: badgeColor,
                  transition: "all 0.2s",
                }}
              >
                {opt.letter}
              </div>

              <span
                className="text-[15px]"
                style={{ color: "var(--text-primary)", lineHeight: 1.5 }}
              >
                {opt.text}
              </span>
            </div>
          );
        })}
      </div>

      {/* Result */}
      <AnimatePresence>
        {isAnswered && isCorrect && (
          <motion.div
            key="correct-result"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="flex flex-col items-center"
          >
            <ConfettiEffect trigger={true} />

            <div
              className="w-full p-8 text-center"
              style={{
                background: "rgba(52,211,153,0.08)",
                border: "1px solid rgba(52,211,153,0.2)",
                borderRadius: "var(--radius-lg-val)",
              }}
            >
              {/* Animated checkmark */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{
                  type: "spring",
                  stiffness: 260,
                  damping: 12,
                }}
                className="mx-auto mb-3 flex items-center justify-center"
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: "50%",
                  background: "var(--accent-green)",
                }}
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </motion.div>

              <h3
                className="text-[24px] font-bold"
                style={{
                  fontFamily: "var(--font-display)",
                  color: "var(--accent-green)",
                }}
              >
                Chapter Unlocked!
              </h3>
              <p
                className="text-[14px] mt-1"
                style={{ color: "var(--text-secondary)" }}
              >
                This is how every chapter works in ChapterFlow.
              </p>
            </div>

            <div className="mt-5 w-full sm:w-auto">
              <GreenCTA href="/auth/login?returnTo=%2Fbook" className="w-full sm:w-auto justify-center">
                Start reading free
              </GreenCTA>
            </div>
            <p
              className="text-[13px] mt-2 text-center"
              style={{ color: "var(--text-muted)" }}
            >
              Join 10,000+ readers
            </p>
          </motion.div>
        )}

        {isAnswered && !isCorrect && (
          <motion.div
            key="wrong-result"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="flex flex-col items-center"
          >
            <div
              className="w-full p-6 text-center"
              style={{
                background: "rgba(245,158,11,0.08)",
                border: "1px solid rgba(245,158,11,0.2)",
                borderRadius: "var(--radius-lg-val)",
              }}
            >
              <p
                className="text-[15px] font-medium"
                style={{ color: "var(--text-primary)" }}
              >
                Not quite, but that&apos;s exactly why the quiz exists.
              </p>
              <p
                className="text-[14px] mt-2"
                style={{ color: "var(--text-secondary)" }}
              >
                The answer is B: people focus on goals rather than building
                systems.
              </p>
            </div>

            <AnimatePresence>
              {showCTA && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.4 }}
                  className="mt-5 w-full sm:w-auto flex flex-col items-center"
                >
                  <GreenCTA href="/auth/login?returnTo=%2Fbook" className="w-full sm:w-auto justify-center">
                    Start reading free
                  </GreenCTA>
                  <p
                    className="text-[13px] mt-2 text-center"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Join 10,000+ readers
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
