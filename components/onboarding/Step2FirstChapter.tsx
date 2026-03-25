"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ConfettiEffect } from "@/components/ui/ConfettiEffect";
import { chapterContent } from "./chapterData";
import type { ChapterContentItem, PersonalizationChoice } from "./chapterData";

/* ── Types ── */

export type ChapterSubStep = "summary" | "scenario" | "quiz" | "result";
export type ScenarioAnswer = "a" | "b" | null;
export type QuizAnswer = "a" | "b" | "c" | "d" | null;

interface Step2FirstChapterProps {
  personalizationChoice: PersonalizationChoice;
  chapterSubStep: ChapterSubStep;
  scenarioAnswer: ScenarioAnswer;
  quizAnswer: QuizAnswer;
  showConfetti: boolean;
  onChapterSubStepChange: (s: ChapterSubStep) => void;
  onScenarioAnswer: (a: ScenarioAnswer) => void;
  onQuizAnswer: (a: QuizAnswer) => void;
  onShowConfetti: (v: boolean) => void;
  onQuizCompleted: () => void;
}

/* ── Shared sub-step transition ── */

const SUB = {
  initial: { opacity: 0, x: 30 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -30 },
  transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] as const },
};

/* ── Internal continue button ── */

function ContinueButton({ text, onClick, delay = 0.3 }: { text: string; onClick: () => void; delay?: number }) {
  return (
    <motion.button
      onClick={onClick}
      className="mt-5 cursor-pointer inline-flex items-center gap-1"
      style={{
        fontFamily: "var(--font-dm-sans)",
        fontSize: 14,
        fontWeight: 600,
        color: "var(--text-heading)",
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-medium)",
        borderRadius: "var(--radius-md-val)",
        padding: "10px 20px",
        transition: "all 0.2s ease",
      }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      whileHover={{
        backgroundColor: "var(--cf-surface-muted)",
        borderColor: "var(--cf-border-strong)",
      }}
    >
      {text.replace(" →", "")} <span>&rarr;</span>
    </motion.button>
  );
}

/* ── Tab bar ── */

const TAB_KEYS: ChapterSubStep[] = ["summary", "scenario", "quiz"];
const TAB_LABELS = ["Summary", "Scenario", "Quiz"];

function TabBar({ subStep }: { subStep: ChapterSubStep }) {
  const activeIdx = subStep === "result" ? 2 : TAB_KEYS.indexOf(subStep);

  return (
    <div
      className="flex items-center justify-center gap-4 md:gap-8"
      style={{
        height: 48,
        background: "var(--bg-raised)",
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      {TAB_LABELS.map((label, i) => {
        const completed = activeIdx > i;
        const active = activeIdx === i;

        return (
          <div key={label} className="flex items-center">
            {/* Connecting line before tabs 2 & 3 */}
            {i > 0 && (
              <div
                className="mr-2.5"
                style={{
                  width: 20,
                  height: 1,
                  background: completed ? "var(--accent-green)" : "var(--border-subtle)",
                  transition: "background 0.3s ease",
                }}
              />
            )}

            {/* Dot */}
            <div
              className="flex items-center justify-center mr-1.5"
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                border: !completed && !active ? "1.5px solid var(--text-muted)" : "none",
                background: completed
                  ? "var(--accent-green)"
                  : active
                    ? "var(--accent-blue)"
                    : "transparent",
                boxShadow: active ? "0 0 6px var(--glow-blue)" : "none",
                transition: "all 0.3s ease",
              }}
            >
              {completed && (
                <svg width="5" height="5" viewBox="0 0 10 10" fill="none">
                  <path d="M2 5L4.5 7.5L8 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>

            {/* Label */}
            <span
              style={{
                fontFamily: "var(--font-dm-sans)",
                fontSize: 13,
                fontWeight: active ? 600 : 400,
                color: completed
                  ? "var(--accent-green)"
                  : active
                    ? "var(--text-heading)"
                    : "var(--text-muted)",
                transition: "all 0.3s ease",
              }}
            >
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Sub-step A: Summary ── */

function SummaryView({
  content,
  onContinue,
}: {
  content: ChapterContentItem;
  onContinue: () => void;
}) {
  return (
    <div>
      {/* Book info row */}
      <div className="flex items-center gap-3 mb-5">
        <div
          className="flex items-center justify-center rounded-md text-white shrink-0"
          style={{
            width: 40,
            height: 56,
            background: content.coverGradient,
            fontSize: 8,
            fontWeight: 600,
            textAlign: "center",
            lineHeight: 1.2,
            padding: 4,
          }}
        >
          {content.bookTitle}
        </div>
        <div>
          <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 14, fontWeight: 600, color: "var(--text-heading)" }}>
            {content.bookTitle} — {content.chapter}
          </p>
          <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 12, color: "var(--text-muted)" }}>
            {content.author}
          </p>
        </div>
      </div>

      {/* Main idea */}
      <SectionLabel>Main Idea</SectionLabel>
      <p className="mt-1.5" style={{ fontFamily: "var(--font-dm-sans)", fontSize: 15, color: "var(--text-primary)", lineHeight: 1.7 }}>
        {content.summary.mainIdea}
      </p>

      {/* Divider */}
      <div className="my-4" style={{ height: 1, background: "var(--border-subtle)" }} />

      {/* Key takeaway */}
      <SectionLabel>Key Takeaway</SectionLabel>
      <p className="mt-1.5" style={{ fontFamily: "var(--font-dm-sans)", fontSize: 15, color: "var(--text-primary)", lineHeight: 1.7 }}>
        {content.summary.keyTakeaway}
      </p>

      <ContinueButton text="See the scenario →" onClick={onContinue} />
    </div>
  );
}

/* ── Sub-step B: Scenario ── */

function ScenarioView({
  content,
  scenarioAnswer,
  onAnswer,
  onContinue,
}: {
  content: ChapterContentItem;
  scenarioAnswer: ScenarioAnswer;
  onAnswer: (a: ScenarioAnswer) => void;
  onContinue: () => void;
}) {
  const { scenario } = content;
  const aCorrect = scenario.optionA.isCorrect;
  const bCorrect = scenario.optionB.isCorrect;
  const gotCorrect =
    (scenarioAnswer === "a" && aCorrect) ||
    (scenarioAnswer === "b" && bCorrect);

  const renderOpt = (key: "a" | "b", opt: { text: string; isCorrect: boolean }) => {
    const picked = scenarioAnswer === key;
    const correct = opt.isCorrect;
    const showGreen = picked && correct;
    const showAmber = picked && !correct;
    const locked = gotCorrect;
    const dimmed = locked && !correct;

    return (
      <button
        key={key}
        onClick={() => !locked && onAnswer(key)}
        disabled={locked}
        className="w-full text-left flex items-center gap-3 cursor-pointer"
        style={{
          padding: 14,
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderRadius: "var(--radius-lg-val)",
          border: "1px solid var(--border-subtle)",
          borderLeft: showGreen
            ? "3px solid var(--accent-green)"
            : showAmber
              ? "3px solid #F59E0B"
              : "3px solid transparent",
          background: "var(--bg-glass)",
          opacity: dimmed ? 0.5 : 1,
          pointerEvents: locked ? "none" : "auto",
          transition: "all 0.25s ease",
        }}
      >
        {/* Radio dot */}
        <div
          className="flex items-center justify-center shrink-0"
          style={{
            width: 18,
            height: 18,
            borderRadius: "50%",
            border: showGreen || showAmber ? "none" : "2px solid var(--border-medium)",
            background: showGreen ? "var(--accent-green)" : showAmber ? "#F59E0B" : "transparent",
            transition: "all 0.2s ease-out",
          }}
        >
          {showGreen && (
            <motion.svg width="8" height="8" viewBox="0 0 10 10" fill="none"
              initial={{ scale: 0 }} animate={{ scale: [0, 1.3, 1] }}
              transition={{ type: "spring", stiffness: 400, damping: 15 }}>
              <path d="M2 5L4.5 7.5L8 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </motion.svg>
          )}
        </div>
        <span style={{ fontFamily: "var(--font-dm-sans)", fontSize: 14, color: "var(--text-primary)" }}>
          {opt.text}
        </span>
      </button>
    );
  };

  return (
    <div>
      <SectionLabel color="var(--accent-teal)">Scenario</SectionLabel>

      {/* Prompt card */}
      <div
        className="mt-3"
        style={{
          padding: 20,
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderRadius: "var(--radius-lg-val)",
          border: "1px solid var(--border-subtle)",
          background: "var(--bg-glass)",
        }}
      >
        <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 15, color: "var(--text-primary)", lineHeight: 1.7 }}>
          {scenario.prompt}
        </p>
      </div>

      {/* Options */}
      <div className="flex flex-col gap-2.5 mt-4">
        {renderOpt("a", scenario.optionA)}
        {renderOpt("b", scenario.optionB)}
      </div>

      {/* Feedback */}
      {scenarioAnswer !== null && (
        <motion.p
          className="mt-2 italic"
          style={{
            fontFamily: "var(--font-dm-sans)",
            fontSize: 13,
            color: gotCorrect ? "var(--accent-green)" : "#F59E0B",
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          {gotCorrect ? scenario.correctFeedback : scenario.wrongFeedback}
        </motion.p>
      )}

      {/* Next button after correct */}
      {gotCorrect && (
        <ContinueButton text="Next: quick quiz →" onClick={onContinue} delay={0.6} />
      )}
    </div>
  );
}

/* ── Sub-step C: Quiz ── */

function QuizView({
  content,
  quizAnswer,
  onAnswer,
}: {
  content: ChapterContentItem;
  quizAnswer: QuizAnswer;
  onAnswer: (a: QuizAnswer) => void;
}) {
  const { quiz } = content;
  const answered = quizAnswer !== null;

  return (
    <div>
      <SectionLabel color="var(--accent-blue)">Retention Check</SectionLabel>

      <p className="mt-3" style={{ fontFamily: "var(--font-dm-sans)", fontSize: 15, fontWeight: 500, color: "var(--text-heading)", lineHeight: 1.6 }}>
        {quiz.question}
      </p>

      <div className="flex flex-col gap-2 mt-4">
        {quiz.options.map((opt) => {
          const key = opt.letter.toLowerCase() as QuizAnswer;
          const picked = quizAnswer === key;
          const correct = opt.isCorrect;
          const showGreen = answered && correct;
          const showAmber = picked && !correct;
          const dimmed = answered && !picked && !correct;

          return (
            <button
              key={opt.letter}
              onClick={() => !answered && onAnswer(key)}
              disabled={answered}
              className="w-full text-left flex items-center gap-3 cursor-pointer"
              style={{
                padding: "12px 16px",
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
                borderRadius: "var(--radius-lg-val)",
                border: showGreen ? "1px solid rgba(52,211,153,0.3)" : "1px solid var(--border-subtle)",
                background: "var(--bg-glass)",
                opacity: dimmed ? 0.4 : 1,
                pointerEvents: answered ? "none" : "auto",
                transition: "all 0.25s ease",
              }}
            >
              {/* Letter badge */}
              <div
                className="flex items-center justify-center shrink-0"
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  fontSize: 12,
                  fontWeight: 600,
                  background: showGreen
                    ? "var(--accent-green)"
                    : showAmber
                      ? "#F59E0B"
                      : "var(--bg-elevated)",
                  color: showGreen || showAmber ? "#fff" : "var(--text-secondary)",
                  transition: "all 0.2s ease",
                }}
              >
                {opt.letter}
              </div>
              <span style={{ fontFamily: "var(--font-dm-sans)", fontSize: 14, color: "var(--text-primary)" }}>
                {opt.text}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Sub-step D: Result ── */

function ResultView({
  quizCorrect,
  showConfetti,
}: {
  quizCorrect: boolean;
  showConfetti: boolean;
}) {
  return (
    <motion.div
      className="relative flex flex-col items-center text-center py-8 px-8"
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      {/* Confetti overlay */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <ConfettiEffect trigger={showConfetti} />
      </div>

      {/* Checkmark circle */}
      <motion.div
        className="flex items-center justify-center"
        style={{
          width: 48,
          height: 48,
          borderRadius: "50%",
          background: "var(--accent-green)",
          boxShadow: "0 0 24px var(--glow-green)",
        }}
        initial={{ scale: 0 }}
        animate={{ scale: [0, 1.25, 1] }}
        transition={{ type: "spring", stiffness: 300, damping: 12 }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M5 12L10 17L19 8" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </motion.div>

      {/* Title */}
      <motion.h3
        className="mt-4"
        style={{ fontFamily: "var(--font-sora)", fontSize: 22, fontWeight: 700, color: "var(--accent-green)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        {quizCorrect ? "Chapter Unlocked!" : "Chapter Complete!"}
      </motion.h3>

      {/* Subtitle */}
      <motion.p
        className="mt-1.5"
        style={{ fontFamily: "var(--font-dm-sans)", fontSize: 14, color: "var(--text-secondary)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.45 }}
      >
        You just finished your first ChapterFlow chapter.
      </motion.p>
    </motion.div>
  );
}

/* ── Tiny helper ── */

function SectionLabel({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <span
      style={{
        fontFamily: "var(--font-dm-sans)",
        fontSize: 11,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.15em",
        color: color ?? "var(--text-muted)",
      }}
    >
      {children}
    </span>
  );
}

/* ── Main export ── */

export function Step2FirstChapter({
  personalizationChoice,
  chapterSubStep,
  scenarioAnswer,
  quizAnswer,
  showConfetti,
  onChapterSubStepChange,
  onScenarioAnswer,
  onQuizAnswer,
  onShowConfetti,
  onQuizCompleted,
}: Step2FirstChapterProps) {
  const content = chapterContent[personalizationChoice];

  const handleQuizAnswer = (answer: QuizAnswer) => {
    onQuizAnswer(answer);
    // After 0.5 s, fire confetti + show result
    setTimeout(() => {
      onShowConfetti(true);
      onChapterSubStepChange("result");
      onQuizCompleted();
    }, 500);
  };

  const quizCorrect =
    quizAnswer !== null &&
    content.quiz.options.some(
      (o) => o.letter.toLowerCase() === quizAnswer && o.isCorrect,
    );

  return (
    <div className="flex flex-col items-center w-full" style={{ maxWidth: 600 }}>
      {/* Intro text */}
      <motion.h2
        style={{ fontFamily: "var(--font-sora)", fontSize: 24, fontWeight: 600, color: "var(--text-heading)" }}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        Your first chapter
      </motion.h2>

      <motion.p
        className="mt-1"
        style={{ fontFamily: "var(--font-dm-sans)", fontSize: 14, color: "var(--text-secondary)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        See how a session feels. Takes about a minute.
      </motion.p>

      {/* Chapter widget */}
      <motion.div
        className="mt-6 w-full overflow-hidden"
        style={{
          background: "linear-gradient(180deg, var(--cf-surface-muted), var(--cf-surface))",
          border: "1px solid var(--border-medium)",
          borderRadius: "var(--radius-xl-val)",
          boxShadow: "0 0 40px rgba(79,139,255,0.04), var(--shadow-card)",
        }}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
      >
        {/* Tab bar */}
        <TabBar subStep={chapterSubStep} />

        {/* Content area */}
        <div style={{ padding: "20px" }} className="md:p-6">
          <AnimatePresence mode="wait">
            {chapterSubStep === "summary" && (
              <motion.div key="summary" {...SUB}>
                <SummaryView content={content} onContinue={() => onChapterSubStepChange("scenario")} />
              </motion.div>
            )}
            {chapterSubStep === "scenario" && (
              <motion.div key="scenario" {...SUB}>
                <ScenarioView
                  content={content}
                  scenarioAnswer={scenarioAnswer}
                  onAnswer={onScenarioAnswer}
                  onContinue={() => onChapterSubStepChange("quiz")}
                />
              </motion.div>
            )}
            {chapterSubStep === "quiz" && (
              <motion.div key="quiz" {...SUB}>
                <QuizView content={content} quizAnswer={quizAnswer} onAnswer={handleQuizAnswer} />
              </motion.div>
            )}
            {chapterSubStep === "result" && (
              <motion.div key="result" {...SUB}>
                <ResultView quizCorrect={quizCorrect} showConfetti={showConfetti} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
