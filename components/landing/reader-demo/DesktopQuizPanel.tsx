"use client";

import { useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Trophy,
  X,
} from "lucide-react";
import type { ChapterQuizQuestion } from "@/lib/reader-content-types";

const OPTION_LABELS = ["A", "B", "C", "D"];

type FeedbackState = "pending" | "correct" | "incorrect-final" | null;

interface DesktopQuizPanelProps {
  questions: ChapterQuizQuestion[];
  passingScorePercent?: number;
  onContinue: () => void;
}

/* ────────────────────────────────────────────────────────────────── */
/*  Progress ring (mirrors in-app QuizPanel.ProgressRing)             */
/* ────────────────────────────────────────────────────────────────── */

function ProgressRing({
  percent,
  correctAnswers,
  totalQuestions,
  size = 128,
  strokeWidth = 8,
  passed,
}: {
  percent: number;
  correctAnswers: number;
  totalQuestions: number;
  size?: number;
  strokeWidth?: number;
  passed: boolean;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset =
    percent === 0
      ? circumference * 0.97
      : circumference - (percent / 100) * circumference;

  return (
    <div className="relative mx-auto inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--cr-fill-subtle)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={passed ? "var(--cr-success)" : "var(--cr-accent)"}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition: "stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)",
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-(--cr-text-heading)">
          {percent}%
        </span>
        <span className="text-xs text-(--cr-text-secondary)">
          {correctAnswers}/{totalQuestions}
        </span>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────── */
/*  Confetti burst (mirrors in-app QuizPanel.ConfettiBurst)           */
/* ────────────────────────────────────────────────────────────────── */

function ConfettiBurst() {
  const [particles] = useState(() =>
    Array.from({ length: 25 }, (_, i) => ({
      id: i,
      x: `${(Math.random() - 0.5) * 300}px`,
      y: `${-100 - Math.random() * 200}px`,
      r: `${Math.random() * 720}deg`,
      color:
        i % 3 === 0
          ? "var(--cr-accent)"
          : i % 3 === 1
            ? "var(--cr-warning)"
            : "var(--cr-success)",
      delay: `${Math.random() * 0.3}s`,
      size: 4 + Math.random() * 4,
    }))
  );

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute left-1/2 top-1/2 rounded-sm"
          style={
            {
              width: p.size,
              height: p.size,
              background: p.color,
              "--cr-confetti-x": p.x,
              "--cr-confetti-y": p.y,
              "--cr-confetti-r": p.r,
              animation: `cr-confetti 1.5s ease-out ${p.delay} forwards`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────── */
/*  Progress dots                                                      */
/* ────────────────────────────────────────────────────────────────── */

function ProgressDots({
  questions,
  feedback,
  currentIndex,
}: {
  questions: ChapterQuizQuestion[];
  feedback: Record<string, FeedbackState>;
  currentIndex: number;
}) {
  return (
    <div className="flex items-center justify-center gap-2">
      {questions.map((q, i) => {
        const fb = feedback[q.id];
        const isCurrent = i === currentIndex;
        return (
          <div
            key={q.id}
            className={[
              "h-2.5 w-2.5 rounded-full transition-all duration-200",
              fb === "correct"
                ? "bg-(--cr-accent)"
                : fb === "incorrect-final"
                  ? "bg-(--cr-error)"
                  : isCurrent
                    ? "bg-(--cr-accent) shadow-[0_0_0_4px_var(--cr-accent-glow)]"
                    : "bg-(--cr-fill-muted)",
            ].join(" ")}
            style={fb ? { animation: "cr-dot-fill 200ms ease-out" } : undefined}
          />
        );
      })}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────── */
/*  DesktopQuizPanel                                                   */
/* ────────────────────────────────────────────────────────────────── */

export function DesktopQuizPanel({
  questions,
  passingScorePercent = 60,
  onContinue,
}: DesktopQuizPanelProps) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [feedback, setFeedback] = useState<Record<string, FeedbackState>>({});
  const [explanationOpen, setExplanationOpen] = useState<Record<string, boolean>>(
    {}
  );
  const [retries, setRetries] = useState<Record<string, number>>({});
  const [showResults, setShowResults] = useState(false);

  const allAnswered = questions.every((q) => feedback[q.id] != null);
  const correctCount = questions.filter((q) => feedback[q.id] === "correct").length;
  const scorePercent = Math.round((correctCount / questions.length) * 100);
  const passed = scorePercent >= passingScorePercent;
  const currentIndex = questions.findIndex((q) => feedback[q.id] == null);

  const handleAnswer = (questionId: string, choiceIndex: number) => {
    const question = questions.find((q) => q.id === questionId);
    if (!question) return;
    if (feedback[questionId] === "correct") return;

    setAnswers((prev) => ({ ...prev, [questionId]: choiceIndex }));

    if (choiceIndex === question.correctIndex) {
      setFeedback((prev) => ({ ...prev, [questionId]: "correct" }));
    } else {
      const used = retries[questionId] ?? 0;
      if (used < 1) {
        setRetries((prev) => ({ ...prev, [questionId]: used + 1 }));
        // Brief shake/wrong-state then reset to allow another try
        setFeedback((prev) => ({ ...prev, [questionId]: "incorrect-final" }));
        // Allow re-answer after a beat
        setTimeout(() => {
          setFeedback((prev) => {
            const next = { ...prev };
            delete next[questionId];
            return next;
          });
          setAnswers((prev) => {
            const next = { ...prev };
            delete next[questionId];
            return next;
          });
        }, 1200);
      } else {
        setFeedback((prev) => ({ ...prev, [questionId]: "incorrect-final" }));
      }
    }
  };

  const handleRetake = () => {
    setAnswers({});
    setFeedback({});
    setExplanationOpen({});
    setRetries({});
    setShowResults(false);
  };

  if (showResults) {
    return (
      <div className="cr-glass-reading relative overflow-hidden p-8 text-center">
        {passed && <ConfettiBurst />}

        <h2
          className="text-2xl font-bold text-(--cr-text-heading)"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {passed ? "🎉 Quiz Passed!" : "Not quite, keep going"}
        </h2>

        <div className="my-5">
          <ProgressRing
            percent={scorePercent}
            correctAnswers={correctCount}
            totalQuestions={questions.length}
            size={128}
            passed={passed}
          />
        </div>

        <p className="text-cf-body text-(--cr-text-secondary)">
          {correctCount} of {questions.length} correct · {scorePercent}%
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {!passed && (
            <button
              type="button"
              onClick={handleRetake}
              className="flex items-center gap-2 rounded-2xl border border-(--cr-glass-border) bg-(--cr-bg-surface-3) px-5 py-2.5 text-sm font-semibold text-(--cr-text-primary) transition hover:bg-(--cr-bg-surface-2)"
            >
              <RotateCcw className="h-4 w-4" /> Retake Quiz
            </button>
          )}
          <button
            type="button"
            onClick={onContinue}
            className="flex items-center gap-2 rounded-2xl bg-(--cr-accent) px-6 py-3 text-base font-bold text-(--cr-text-inverse) transition hover:opacity-90"
            style={{ animation: "cr-pulse-glow 2s ease-in-out infinite" }}
          >
            <Trophy className="h-5 w-5" /> Continue to Practice{" "}
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header with progress dots */}
      <div className="cr-glass-reading p-5">
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-(--cr-text-secondary)">
            Quiz · {questions.length} questions
          </p>
          <ProgressDots
            questions={questions}
            feedback={feedback}
            currentIndex={currentIndex < 0 ? questions.length - 1 : currentIndex}
          />
        </div>
      </div>

      {/* Question cards */}
      {questions.map((question, index) => {
        const fb = feedback[question.id];
        const userChoice = answers[question.id];
        const resolved = fb === "correct" || fb === "incorrect-final";
        const isExplanationOpen = !!explanationOpen[question.id];

        return (
          <article
            key={question.id}
            className="cr-glass-reading p-6"
            style={{
              animation: `cr-card-enter 300ms ease-out ${index * 50}ms both`,
            }}
          >
            {/* Question header */}
            <div className="mb-5 flex items-start gap-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-(--cr-accent) text-sm font-bold text-(--cr-text-inverse)">
                  {index + 1}
                </div>
                {resolved && (
                  <span
                    className={[
                      "flex h-5 w-5 items-center justify-center rounded-full text-xs",
                      fb === "correct"
                        ? "bg-(--cr-success-bg) text-(--cr-success)"
                        : "bg-(--cr-error-bg) text-(--cr-error)",
                    ].join(" ")}
                  >
                    {fb === "correct" ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <X className="h-3 w-3" />
                    )}
                  </span>
                )}
              </div>
              <p className="flex-1 text-lg font-semibold leading-snug text-(--cr-text-heading)">
                {question.prompt}
              </p>
            </div>

            {/* Answer options */}
            <div className="space-y-2">
              {question.options.map((option, optionIndex) => {
                const selected = userChoice === optionIndex;
                const isCorrectChoice = optionIndex === question.correctIndex;
                const showAsCorrect = resolved && isCorrectChoice;
                const showAsWrong =
                  resolved && selected && !isCorrectChoice;

                const stateClass = (() => {
                  if (showAsCorrect) return "cr-answer-correct";
                  if (showAsWrong) return "cr-answer-incorrect opacity-70";
                  if (selected && !resolved) return "cr-answer-selected";
                  if (resolved && !showAsCorrect)
                    return "opacity-40 pointer-events-none";
                  return "";
                })();

                return (
                  <button
                    key={optionIndex}
                    type="button"
                    disabled={resolved}
                    onClick={() => handleAnswer(question.id, optionIndex)}
                    className={[
                      "cr-answer-option w-full text-left",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--cr-accent-glow)",
                      stateClass,
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                        showAsCorrect
                          ? "bg-(--cr-success) text-(--cr-text-inverse)"
                          : showAsWrong
                            ? "bg-(--cr-error) text-(--cr-text-inverse)"
                            : selected && !resolved
                              ? "bg-(--cr-accent) text-(--cr-text-inverse)"
                              : "bg-(--cr-fill-muted) text-(--cr-text-secondary)",
                      ].join(" ")}
                    >
                      {showAsCorrect ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : showAsWrong ? (
                        <X className="h-3.5 w-3.5" />
                      ) : (
                        OPTION_LABELS[optionIndex]
                      )}
                    </span>
                    <span
                      className="flex-1 text-(--cr-text-primary) leading-relaxed"
                      style={{ fontSize: "1.05rem", fontWeight: 450 }}
                    >
                      {option}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Feedback banners */}
            {fb === "correct" && (
              <div
                className="mt-3 flex items-center gap-2 rounded-lg border-l-3 border-(--cr-success) bg-(--cr-success-bg) px-4 py-2.5 text-sm font-semibold text-(--cr-success)"
                style={{ animation: "cr-card-enter 200ms ease-out" }}
              >
                <Check className="h-4 w-4" /> Correct!
              </div>
            )}

            {fb === "incorrect-final" && (
              <div
                className="mt-3 rounded-lg border-l-3 border-(--cr-error) bg-(--cr-error-bg) px-4 py-2.5 text-sm font-semibold text-(--cr-error)"
                style={{ animation: "cr-card-enter 200ms ease-out" }}
              >
                Not quite. Try once more?
              </div>
            )}

            {/* Explanation toggle (only for correct) */}
            {fb === "correct" && (
              <div className="mt-4 border-t border-(--cr-glass-border) pt-4">
                <button
                  type="button"
                  onClick={() =>
                    setExplanationOpen((prev) => ({
                      ...prev,
                      [question.id]: !prev[question.id],
                    }))
                  }
                  className="inline-flex items-center gap-1.5 rounded-full border border-(--cr-glass-border) bg-(--cr-bg-surface-3) px-3 py-1.5 text-xs font-semibold text-(--cr-text-secondary) transition hover:text-(--cr-text-primary)"
                  aria-expanded={isExplanationOpen}
                >
                  {isExplanationOpen ? (
                    <>
                      <ChevronUp className="h-3.5 w-3.5" /> Hide explanation
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-3.5 w-3.5" /> Show explanation
                    </>
                  )}
                </button>
                <div
                  className="overflow-hidden transition-all duration-300 ease-out"
                  style={{
                    maxHeight: isExplanationOpen ? "300px" : "0px",
                    opacity: isExplanationOpen ? 1 : 0,
                  }}
                >
                  <div className="mt-3 rounded-xl border border-(--cr-glass-border) bg-(--cr-bg-surface-3) px-4 py-3">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-(--cr-text-secondary)">
                      Why this answer is right
                    </p>
                    <p
                      className="mt-2 text-sm leading-relaxed text-(--cr-text-primary)"
                      style={{ fontWeight: 450 }}
                    >
                      {question.explanation}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </article>
        );
      })}

      {/* See results CTA */}
      {allAnswered && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={() => setShowResults(true)}
            className="flex items-center gap-2 rounded-2xl bg-(--cr-accent) px-6 py-3 text-base font-bold text-(--cr-text-inverse) transition hover:opacity-90"
            style={{ animation: "cr-pulse-glow 2s ease-in-out infinite" }}
          >
            See Your Results <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
}
