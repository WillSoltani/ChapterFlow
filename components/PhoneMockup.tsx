"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { GreenCTA } from "@/components/ui/GreenCTA";
import { ConfettiEffect } from "@/components/ui/ConfettiEffect";

type Step = "summary" | "scenario" | "quiz";

const STEPS: Step[] = ["summary", "scenario", "quiz"];
const STEP_LABELS: Record<Step, string> = {
  summary: "Summary",
  scenario: "Scenario",
  quiz: "Quiz",
};

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 120 : -120,
    opacity: 0,
    scale: 0.98,
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -120 : 120,
    opacity: 0,
    scale: 0.98,
  }),
};

/* ------------------------------------------------------------------ */
/*  Typing indicator (3 pulsing dots)                                  */
/* ------------------------------------------------------------------ */

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 py-1 ml-[22px]">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="rounded-full"
          style={{
            width: 4,
            height: 4,
            backgroundColor: "var(--text-secondary)",
          }}
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            delay: i * 0.15,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Glass card wrapper with inner shadow + hover border                */
/* ------------------------------------------------------------------ */

function GlassCard({
  children,
  className = "",
  style = {},
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`rounded-lg transition-all duration-200 ${className}`}
      style={{
        backgroundColor: "var(--bg-glass)",
        border: "1px solid var(--border-subtle)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
        ...style,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--border-medium)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--border-subtle)";
      }}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Bottom scroll fade gradient                                        */
/* ------------------------------------------------------------------ */

function ScrollFade() {
  return (
    <div
      className="pointer-events-none absolute bottom-0 left-0 right-0 z-10"
      style={{
        height: 28,
        background:
          "linear-gradient(to bottom, transparent, var(--bg-base))",
      }}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  KEY POINTS bullets data                                            */
/* ------------------------------------------------------------------ */

const KEY_POINTS = [
  "Results lag behind the habit. Early repetitions feel trivial because the payoff is delayed.",
  "The score follows the system. Goals point at direction, but daily systems decide what happens.",
  "Tiny gains count because they repeat. A small improvement matters when it happens again tomorrow.",
  "Plateaus are normal, not personal. Slow visible progress does not mean you are failing.",
  "Bad habits compound too. Small neglect also builds a future, just more quietly.",
  "Identity grows from repetition. Each action is a vote for the type of person you are becoming.",
  "Consistency beats intensity. A habit you can keep is worth more than a perfect plan you cannot sustain.",
];

/* ================================================================== */
/*  PhoneMockup                                                        */
/* ================================================================== */

export function PhoneMockup() {
  const prefersReducedMotion = useReducedMotion();
  const [step, setStep] = useState<Step>("summary");
  const [direction, setDirection] = useState(1);

  // Scenario state
  const [scenarioSelected, setScenarioSelected] = useState<"a" | "b" | null>(
    null
  );
  const [scenarioLocked, setScenarioLocked] = useState(false);
  const [showScenarioNext, setShowScenarioNext] = useState(false);
  const [showScenarioFeedback, setShowScenarioFeedback] = useState(false);

  // Quiz state
  const [quizSelected, setQuizSelected] = useState<
    "a" | "b" | "c" | "d" | null
  >(null);
  const [quizLocked, setQuizLocked] = useState(false);
  const [showQuizCTA, setShowQuizCTA] = useState(false);
  const [confettiTrigger, setConfettiTrigger] = useState(false);
  const [quizPulse, setQuizPulse] = useState(false);
  const [showQuizExplanation, setShowQuizExplanation] = useState(false);

  const stepIndex = STEPS.indexOf(step);

  const goToStep = useCallback(
    (next: Step) => {
      const nextIndex = STEPS.indexOf(next);
      const currentIndex = STEPS.indexOf(step);
      setDirection(nextIndex > currentIndex ? 1 : -1);
      setStep(next);
    },
    [step]
  );

  // Show feedback text after brief typing delay
  useEffect(() => {
    if (scenarioSelected !== null) {
      const timer = setTimeout(() => setShowScenarioFeedback(true), 350);
      return () => clearTimeout(timer);
    } else {
      setShowScenarioFeedback(false);
    }
  }, [scenarioSelected]);

  // Show next button after correct scenario answer
  useEffect(() => {
    if (scenarioSelected === "b" && scenarioLocked) {
      const timer = setTimeout(() => setShowScenarioNext(true), 800);
      return () => clearTimeout(timer);
    }
  }, [scenarioSelected, scenarioLocked]);

  // Show CTA after quiz answer
  useEffect(() => {
    if (quizLocked && quizSelected !== "a") {
      const timer = setTimeout(() => setShowQuizCTA(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [quizLocked, quizSelected]);

  // Trigger confetti + pulse on correct quiz
  useEffect(() => {
    if (quizLocked && quizSelected === "a") {
      setConfettiTrigger(true);
      setQuizPulse(true);
      const pulseTimer = setTimeout(() => setQuizPulse(false), 1500);
      return () => clearTimeout(pulseTimer);
    }
  }, [quizLocked, quizSelected]);

  // Show explanation after quiz lock
  useEffect(() => {
    if (quizLocked) {
      const timer = setTimeout(() => setShowQuizExplanation(true), 500);
      return () => clearTimeout(timer);
    }
  }, [quizLocked]);

  const handleScenarioSelect = (option: "a" | "b") => {
    if (scenarioLocked) return;
    setShowScenarioFeedback(false);
    setScenarioSelected(option);
    if (option === "b") {
      setScenarioLocked(true);
    }
  };

  const handleQuizSelect = (option: "a" | "b" | "c" | "d") => {
    if (quizLocked) return;
    setQuizSelected(option);
    setQuizLocked(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent, callback: () => void) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      callback();
    }
  };

  // Progress bar width based on current step
  const progressWidth =
    step === "summary" ? "33%" : step === "scenario" ? "66%" : "100%";

  return (
    <div className="relative flex flex-col items-center">
      {/* Live Demo badge */}
      <div className="flex items-center gap-1.5 mb-3">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-(--accent-green) opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-(--accent-green)" />
        </span>
        <span
          className="text-[10px] uppercase tracking-[0.12em] font-semibold"
          style={{ color: "var(--accent-teal)" }}
        >
          Live Demo
        </span>
      </div>

      {/* Glow behind phone */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] blur-[60px] pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(79,139,255,0.1) 0%, transparent 70%)",
        }}
      />

      {/* Floating phone frame */}
      <motion.div
        className="relative"
        animate={prefersReducedMotion ? {} : { y: [0, -6, 0, 6, 0] }}
        transition={{
          duration: 5,
          ease: "easeInOut",
          repeat: Infinity,
        }}
      >
        {/* Phone outer shell */}
        <div
          className="relative w-[260px] md:w-[300px] bg-[#1C1C1E] rounded-[40px] border-2 border-white/10 p-3"
          style={{
            aspectRatio: "9 / 19.5",
            boxShadow: quizPulse
              ? "0 0 40px rgba(52,211,153,0.4), 0 0 80px rgba(52,211,153,0.15)"
              : "0 4px 40px rgba(0,0,0,0.3)",
            transition: "box-shadow 0.6s ease-in-out",
          }}
        >
          {/* Notch */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[90px] h-[24px] bg-[#1C1C1E] rounded-b-[14px] z-[2]" />

          {/* Screen */}
          <div className="relative w-full h-full overflow-hidden rounded-[28px] bg-(--bg-base)">
            {/* Progress bar at top of screen */}
            <div
              className="absolute top-0 left-0 z-20"
              style={{
                height: 2,
                width: progressWidth,
                backgroundColor: "var(--accent-blue)",
                borderRadius: "0 1px 1px 0",
                transition: "width 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            />

            {/* Confetti overlay */}
            <div className="absolute inset-0 z-30 pointer-events-none">
              <ConfettiEffect trigger={confettiTrigger} />
            </div>

            <div className="relative flex flex-col h-full p-3 pt-7">
              {/* Progress indicator dots */}
              <div className="flex flex-col items-center mb-3">
                <div className="flex items-center gap-0">
                  {STEPS.map((s, i) => {
                    const isActive = i === stepIndex;
                    const isCompleted = i < stepIndex;
                    return (
                      <div key={s} className="flex items-center">
                        <motion.div
                          className="rounded-full"
                          style={{
                            width: 8,
                            height: 8,
                            backgroundColor: isCompleted
                              ? "var(--accent-green)"
                              : isActive
                              ? "var(--accent-blue)"
                              : "transparent",
                            border:
                              isCompleted || isActive
                                ? "none"
                                : "1.5px solid var(--border-subtle)",
                          }}
                          animate={{
                            scale: isActive ? [1, 1.15, 1] : 1,
                          }}
                          transition={{
                            duration: 0.4,
                            ease: "easeInOut",
                          }}
                        />
                        {i < STEPS.length - 1 && (
                          <div
                            style={{
                              width: 16,
                              height: 1,
                              backgroundColor:
                                i < stepIndex
                                  ? "var(--accent-green)"
                                  : "var(--border-subtle)",
                              transition: "background-color 0.3s ease",
                            }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
                <span
                  className="text-[9px] mt-1"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {STEP_LABELS[step]}
                </span>
              </div>

              {/* Step content with AnimatePresence */}
              <div className="relative flex-1 overflow-hidden min-h-0">
                <div className="h-full overflow-y-auto overflow-x-hidden hide-scrollbar">
                  <AnimatePresence mode="wait" custom={direction}>
                    {step === "summary" && (
                      <SummaryStep
                        key="summary"
                        direction={direction}
                        onNext={() => goToStep("scenario")}
                        onKeyDown={handleKeyDown}
                      />
                    )}
                    {step === "scenario" && (
                      <ScenarioStep
                        key="scenario"
                        direction={direction}
                        selected={scenarioSelected}
                        locked={scenarioLocked}
                        showNext={showScenarioNext}
                        showFeedback={showScenarioFeedback}
                        onSelect={handleScenarioSelect}
                        onNext={() => goToStep("quiz")}
                        onKeyDown={handleKeyDown}
                      />
                    )}
                    {step === "quiz" && (
                      <QuizStep
                        key="quiz"
                        direction={direction}
                        selected={quizSelected}
                        locked={quizLocked}
                        showCTA={showQuizCTA}
                        showExplanation={showQuizExplanation}
                        onSelect={handleQuizSelect}
                        onKeyDown={handleKeyDown}
                      />
                    )}
                  </AnimatePresence>
                </div>
                {/* Bottom scroll fade */}
                <ScrollFade />
              </div>
            </div>
          </div>

          {/* Home indicator */}
          <div
            className="absolute bottom-[6px] left-1/2 -translate-x-1/2 rounded-full"
            style={{
              width: 80,
              height: 4,
              backgroundColor: "rgba(255,255,255,0.3)",
            }}
          />
        </div>
      </motion.div>
    </div>
  );
}

/* ================================================================== */
/*  Step 1: Summary                                                    */
/* ================================================================== */

function SummaryStep({
  direction,
  onNext,
  onKeyDown,
}: {
  direction: number;
  onNext: () => void;
  onKeyDown: (e: React.KeyboardEvent, cb: () => void) => void;
}) {
  return (
    <motion.div
      custom={direction}
      variants={slideVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="flex flex-col gap-2 pb-8"
    >
      {/* Header with book cover */}
      <div className="flex items-start gap-2">
        <img
          src="/book-covers/atomic-habits.jpg"
          alt=""
          className="w-5 h-7 rounded-sm object-cover shrink-0"
          style={{
            boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
          }}
        />
        <div>
          <span
            className="text-[11px] font-semibold"
            style={{ color: "var(--text-heading)" }}
          >
            Ch. 1 Summary
          </span>
          <p
            className="text-[9px]"
            style={{ color: "var(--text-secondary)" }}
          >
            Atomic Habits
          </p>
        </div>
      </div>

      {/* Content card */}
      <GlassCard className="p-3">
        <span
          className="text-[9px] uppercase tracking-wide font-semibold"
          style={{ color: "var(--accent-blue)" }}
        >
          CORE IDEA
        </span>
        <p
          className="text-[12px] leading-relaxed mt-1"
          style={{ color: "var(--text-primary)" }}
        >
          Small habits compound because repeated actions shape outcomes long
          before the payoff is obvious. Lasting change comes from tiny behaviors
          you can repeat, not from one dramatic burst of effort.
        </p>

        {/* KEY POINTS section */}
        <div
          className="my-2.5"
          style={{
            height: 1,
            backgroundColor: "var(--border-subtle)",
          }}
        />

        <span
          className="text-[9px] uppercase tracking-wide font-semibold"
          style={{ color: "var(--accent-blue)" }}
        >
          KEY POINTS
        </span>

        <div className="flex flex-col gap-2 mt-2">
          {KEY_POINTS.map((point, i) => (
            <div key={i} className="flex items-start gap-2">
              <div
                className="shrink-0 rounded-full mt-[5px]"
                style={{
                  width: 4,
                  height: 4,
                  backgroundColor: "var(--accent-teal)",
                }}
              />
              <p
                className="text-[10px] leading-relaxed"
                style={{ color: "var(--text-primary)" }}
              >
                {point}
              </p>
            </div>
          ))}
        </div>

        <div
          className="my-2.5"
          style={{
            height: 1,
            backgroundColor: "var(--border-subtle)",
          }}
        />

        <span
          className="text-[9px] uppercase tracking-wide font-semibold"
          style={{ color: "var(--accent-blue)" }}
        >
          TAKEAWAY
        </span>
        <p
          className="text-[12px] leading-relaxed mt-1"
          style={{ color: "var(--text-primary)" }}
        >
          Focus on building better systems rather than setting better goals.
          Small habits compound into remarkable results.
        </p>
      </GlassCard>

      {/* Next button */}
      <button
        type="button"
        className="text-[11px] py-2 px-3 rounded-lg cursor-pointer transition-colors duration-200 min-h-[40px]"
        style={{
          backgroundColor: "var(--bg-elevated)",
          border: "1px solid var(--border-medium)",
          color: "var(--text-primary)",
        }}
        tabIndex={0}
        onClick={onNext}
        onKeyDown={(e) => onKeyDown(e, onNext)}
      >
        See the scenario
      </button>
    </motion.div>
  );
}

/* ================================================================== */
/*  Step 2: Scenario                                                   */
/* ================================================================== */

function ScenarioStep({
  direction,
  selected,
  locked,
  showNext,
  showFeedback,
  onSelect,
  onNext,
  onKeyDown,
}: {
  direction: number;
  selected: "a" | "b" | null;
  locked: boolean;
  showNext: boolean;
  showFeedback: boolean;
  onSelect: (option: "a" | "b") => void;
  onNext: () => void;
  onKeyDown: (e: React.KeyboardEvent, cb: () => void) => void;
}) {
  return (
    <motion.div
      custom={direction}
      variants={slideVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="flex flex-col gap-2 pb-8"
    >
      {/* Header */}
      <span
        className="text-[11px] font-semibold"
        style={{ color: "var(--text-heading)" }}
      >
        Scenario
      </span>

      {/* Prompt card */}
      <GlassCard className="p-3">
        <p
          className="text-[12px] leading-relaxed"
          style={{ color: "var(--text-primary)" }}
        >
          Marcus buys new workout gear and plans a demanding exercise schedule.
          After a tough week he misses several sessions, feels behind, and stops
          entirely. What should Marcus do?
        </p>
      </GlassCard>

      {/* Options */}
      <div className="flex flex-col gap-2">
        {/* Option A (WRONG) */}
        <div
          className="rounded-lg p-2.5 cursor-pointer transition-all duration-200 min-h-[40px]"
          style={{
            backgroundColor: "var(--bg-glass)",
            borderLeft:
              selected === "a"
                ? "2px solid #F59E0B"
                : "2px solid transparent",
            borderTop: "1px solid var(--border-subtle)",
            borderRight: "1px solid var(--border-subtle)",
            borderBottom: "1px solid var(--border-subtle)",
            opacity: locked && selected !== "a" ? 0.5 : 1,
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
          }}
          tabIndex={0}
          role="button"
          aria-label="Option A: Restart the original plan and push through with more willpower"
          onClick={() => onSelect("a")}
          onKeyDown={(e) => onKeyDown(e, () => onSelect("a"))}
        >
          <div className="flex items-start gap-2">
            <div
              className="shrink-0 rounded-full mt-0.5"
              style={{
                width: 14,
                height: 14,
                backgroundColor:
                  selected === "a" ? "#F59E0B" : "transparent",
                border:
                  selected === "a"
                    ? "2px solid #F59E0B"
                    : "2px solid var(--border-medium)",
              }}
            />
            <span
              className="text-[11px]"
              style={{ color: "var(--text-primary)" }}
            >
              Restart the original plan and push through with more willpower
            </span>
          </div>
          <AnimatePresence>
            {selected === "a" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
              >
                {!showFeedback ? (
                  <TypingIndicator />
                ) : (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2 }}
                    className="text-[10px] italic mt-1.5 ml-[22px]"
                    style={{ color: "#F59E0B" }}
                  >
                    More willpower is the goal mindset. The chapter says systems,
                    not effort, drive results.
                  </motion.p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Option B (CORRECT) */}
        <div
          className="rounded-lg p-2.5 cursor-pointer transition-all duration-200 min-h-[40px]"
          style={{
            backgroundColor: "var(--bg-glass)",
            borderLeft:
              selected === "b"
                ? "2px solid #34D399"
                : "2px solid transparent",
            borderTop: "1px solid var(--border-subtle)",
            borderRight: "1px solid var(--border-subtle)",
            borderBottom: "1px solid var(--border-subtle)",
            opacity: locked && selected !== "b" ? 0.5 : 1,
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
          }}
          tabIndex={0}
          role="button"
          aria-label="Option B: Start with a ten minute walk after lunch and build from there"
          onClick={() => onSelect("b")}
          onKeyDown={(e) => onKeyDown(e, () => onSelect("b"))}
        >
          <div className="flex items-start gap-2">
            <div
              className="shrink-0 rounded-full mt-0.5 flex items-center justify-center"
              style={{
                width: 14,
                height: 14,
                backgroundColor:
                  selected === "b" ? "#34D399" : "transparent",
                border:
                  selected === "b"
                    ? "2px solid #34D399"
                    : "2px solid var(--border-medium)",
              }}
            >
              {selected === "b" && (
                <svg width="8" height="8" viewBox="0 0 12 12" fill="none">
                  <path
                    d="M2.5 6L5 8.5L9.5 3.5"
                    stroke="white"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </div>
            <span
              className="text-[11px]"
              style={{ color: "var(--text-primary)" }}
            >
              Start with a ten minute walk after lunch and build from there
            </span>
          </div>
          <AnimatePresence>
            {selected === "b" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
              >
                {!showFeedback ? (
                  <TypingIndicator />
                ) : (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2 }}
                    className="text-[10px] italic mt-1.5 ml-[22px]"
                    style={{ color: "#34D399" }}
                  >
                    Exactly. A habit that survives normal life will compound into
                    real change.
                  </motion.p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* WHY IT MATTERS (after correct answer) */}
      <AnimatePresence>
        {locked && selected === "b" && showFeedback && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <GlassCard className="p-2.5">
              <span
                className="text-[8px] uppercase tracking-wide font-semibold"
                style={{ color: "var(--accent-teal)" }}
              >
                WHY IT MATTERS
              </span>
              <p
                className="text-[10px] leading-relaxed mt-1 italic"
                style={{ color: "var(--text-secondary)" }}
              >
                Oversized plans often fail before compounding begins. A habit
                must survive normal life before it can transform it.
              </p>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Next button */}
      <AnimatePresence>
        {showNext && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
          >
            <button
              type="button"
              className="w-full text-[11px] py-2 px-3 rounded-lg cursor-pointer transition-colors duration-200 min-h-[40px]"
              style={{
                backgroundColor: "var(--bg-elevated)",
                border: "1px solid var(--border-medium)",
                color: "var(--text-primary)",
              }}
              tabIndex={0}
              onClick={onNext}
              onKeyDown={(e) => onKeyDown(e, onNext)}
            >
              Take the quiz
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ================================================================== */
/*  Step 3: Quiz                                                       */
/* ================================================================== */

const QUIZ_OPTIONS = [
  {
    key: "a" as const,
    letter: "A",
    text: "Because repeated small actions compound into bigger outcomes over time",
    correct: true,
  },
  {
    key: "b" as const,
    letter: "B",
    text: "Because small habits feel more exciting than big ones",
    correct: false,
  },
  {
    key: "c" as const,
    letter: "C",
    text: "Because dramatic change usually happens in one clean breakthrough",
    correct: false,
  },
  {
    key: "d" as const,
    letter: "D",
    text: "Because habits only matter when they produce instant visible results",
    correct: false,
  },
];

function QuizStep({
  direction,
  selected,
  locked,
  showCTA,
  showExplanation,
  onSelect,
  onKeyDown,
}: {
  direction: number;
  selected: "a" | "b" | "c" | "d" | null;
  locked: boolean;
  showCTA: boolean;
  showExplanation: boolean;
  onSelect: (option: "a" | "b" | "c" | "d") => void;
  onKeyDown: (e: React.KeyboardEvent, cb: () => void) => void;
}) {
  const isCorrect = selected === "a";

  return (
    <motion.div
      custom={direction}
      variants={slideVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="flex flex-col gap-2 pb-8"
    >
      {/* Header */}
      <span
        className="text-[11px] font-semibold"
        style={{ color: "var(--text-heading)" }}
      >
        Quiz
      </span>

      {/* Question card */}
      <GlassCard className="p-3">
        <p
          className="text-[12px] font-medium leading-relaxed"
          style={{ color: "var(--text-primary)" }}
        >
          Why does Clear place so much weight on tiny habits?
        </p>
      </GlassCard>

      {/* Answer options */}
      <div className="flex flex-col gap-1.5">
        {QUIZ_OPTIONS.map((opt) => {
          const isSelected = selected === opt.key;
          const showAsCorrect = locked && opt.key === "a";
          const showAsWrong = locked && isSelected && !opt.correct;

          let badgeBg = "var(--bg-elevated)";
          let borderColor = "var(--border-subtle)";
          if (showAsCorrect) {
            badgeBg = "#34D399";
            borderColor = "#34D399";
          } else if (showAsWrong) {
            badgeBg = "#F59E0B";
            borderColor = "#F59E0B";
          }

          return (
            <div
              key={opt.key}
              className="rounded-lg p-2 cursor-pointer transition-all duration-200 min-h-[40px] flex items-center gap-2"
              style={{
                backgroundColor: "var(--bg-glass)",
                border: `1px solid ${borderColor}`,
                opacity: locked && !showAsCorrect && !showAsWrong ? 0.5 : 1,
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
              }}
              tabIndex={0}
              role="button"
              aria-label={`Option ${opt.letter}: ${opt.text}`}
              onClick={() => onSelect(opt.key)}
              onKeyDown={(e) => onKeyDown(e, () => onSelect(opt.key))}
            >
              <div
                className="shrink-0 rounded-full flex items-center justify-center"
                style={{
                  width: 16,
                  height: 16,
                  backgroundColor: badgeBg,
                  color:
                    showAsCorrect || showAsWrong
                      ? "white"
                      : "var(--text-primary)",
                  fontSize: 9,
                  fontWeight: 600,
                }}
              >
                {showAsCorrect ? (
                  <svg width="8" height="8" viewBox="0 0 12 12" fill="none">
                    <path
                      d="M2.5 6L5 8.5L9.5 3.5"
                      stroke="white"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : showAsWrong ? (
                  <svg width="8" height="8" viewBox="0 0 12 12" fill="none">
                    <path
                      d="M3 3L9 9M9 3L3 9"
                      stroke="white"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                ) : (
                  opt.letter
                )}
              </div>
              <span
                className="text-[11px]"
                style={{ color: "var(--text-primary)" }}
              >
                {opt.text}
              </span>
            </div>
          );
        })}
      </div>

      {/* Explanation text (after answering) */}
      <AnimatePresence>
        {locked && showExplanation && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="text-[10px] leading-relaxed italic"
            style={{ color: "var(--text-secondary)" }}
          >
            The chapter argues that repetition changes the long term trajectory
            even when each individual action looks minor.
          </motion.p>
        )}
      </AnimatePresence>

      {/* Result */}
      <AnimatePresence>
        {locked && isCorrect && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="rounded-lg p-4 text-center"
            style={{ backgroundColor: "rgba(52,211,153,0.08)" }}
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{
                type: "spring",
                stiffness: 300,
                damping: 12,
              }}
              className="flex justify-center mb-2"
            >
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <circle cx="14" cy="14" r="14" fill="#34D399" />
                <path
                  d="M8 14L12 18L20 10"
                  stroke="white"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </motion.div>
            <p
              className="text-[14px] font-bold"
              style={{
                fontFamily: "var(--font-display)",
                color: "var(--accent-green)",
              }}
            >
              Chapter Unlocked!
            </p>
            <p
              className="text-[10px] mt-1 mb-3"
              style={{ color: "var(--text-secondary)" }}
            >
              This is how every chapter works.
            </p>
            <GreenCTA
              href="/auth/login?returnTo=%2Fbook"
              className="!text-[12px] !px-4 !py-2"
            >
              Start free
            </GreenCTA>
          </motion.div>
        )}

        {locked && !isCorrect && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="rounded-lg p-3"
            style={{ backgroundColor: "rgba(245,158,11,0.08)" }}
          >
            <p
              className="text-[11px]"
              style={{ color: "var(--text-primary)" }}
            >
              Not quite, but that is exactly why the quiz exists.
            </p>
            <p
              className="text-[10px] mt-1"
              style={{ color: "var(--text-secondary)" }}
            >
              The answer is A: small actions compound over time.
            </p>
            <AnimatePresence>
              {showCTA && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.4 }}
                  className="mt-3"
                >
                  <GreenCTA
                    href="/auth/login?returnTo=%2Fbook"
                    className="!text-[12px] !px-4 !py-2"
                  >
                    Start free
                  </GreenCTA>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
