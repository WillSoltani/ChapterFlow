"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  LoaderCircle,
  RotateCcw,
  Target,
  Trophy,
  X,
} from "lucide-react";
import type {
  QuizQuestionView,
  QuizSessionView,
} from "@/app/book/library/[bookId]/chapter/[chapterId]/hooks/useQuizSession";
import {
  CHAPTER_FP,
  QUIZ_RETRIES_PER_QUESTION,
  QUIZ_AUTO_ADVANCE_DELAY,
  QUIZ_PASS_THRESHOLDS,
} from "@/app/book/_lib/flow-points-economy";

const OPTION_LABELS = ["A", "B", "C", "D", "E"];

type LearningMode = "guided" | "standard" | "challenge";

type QuestionPresentationStyle = "all-at-once" | "one-by-one";

type QuizPanelProps = {
  session: QuizSessionView | null;
  answers: Record<string, string>;
  explanationOpen: Record<string, boolean>;
  loading: boolean;
  submitting: boolean;
  error: string | null;
  cooldownSeconds: number;
  onAnswer: (questionId: string, choiceId: string) => void;
  onSubmit: () => void;
  onReviewSummary: () => void;
  onRetry: () => void;
  onContinueToPractice: () => void;
  onToggleExplanation: (questionId: string) => void;
  learningMode?: LearningMode;
  questionFlow?: QuestionPresentationStyle;
  shuffleQuestions?: boolean;
  retryIncorrectOnly?: boolean;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const safe = Math.max(0, seconds);
  const m = Math.floor(safe / 60).toString().padStart(2, "0");
  const s = Math.floor(safe % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

const GENERIC_PLACEHOLDERS = [
  "this choice best matches the chapter's main point.",
  "this choice best matches the chapter's main point",
  "this is the correct answer.",
  "correct answer.",
];

function isGenericExplanation(text: string | undefined | null): boolean {
  if (!text) return true;
  return GENERIC_PLACEHOLDERS.some(
    (p) => text.trim().toLowerCase() === p
  );
}

// ─── Progress Ring ───────────────────────────────────────────────────────────

function ProgressRing({
  percent,
  size = 160,
  strokeWidth = 10,
  passed,
}: {
  percent: number;
  size?: number;
  strokeWidth?: number;
  passed: boolean;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  // For 0%, show a tiny arc so the ring isn't completely empty
  const offset = percent === 0
    ? circumference * 0.97
    : circumference - (percent / 100) * circumference;

  return (
    <div className="relative mx-auto inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke="var(--cr-fill-subtle)" strokeWidth={strokeWidth} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={passed ? "var(--cr-success)" : "var(--cr-error)"}
          strokeWidth={strokeWidth} strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-bold text-(--cr-text-heading)">{percent}%</span>
        <span className="text-sm text-(--cr-text-secondary)">
          {Math.round((percent / 100) * 10)}/10
        </span>
      </div>
    </div>
  );
}

// ─── Confetti ────────────────────────────────────────────────────────────────

function ConfettiBurst() {
  const particles = useMemo(() =>
    Array.from({ length: 25 }, (_, i) => ({
      id: i,
      x: `${(Math.random() - 0.5) * 300}px`,
      y: `${-100 - Math.random() * 200}px`,
      r: `${Math.random() * 720}deg`,
      color: i % 3 === 0 ? "var(--cr-accent)" : i % 3 === 1 ? "var(--cr-warning)" : "var(--cr-success)",
      delay: `${Math.random() * 0.3}s`,
      size: 4 + Math.random() * 4,
    })), []);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {particles.map((p) => (
        <div key={p.id} className="absolute left-1/2 top-1/2 rounded-sm"
          style={{ width: p.size, height: p.size, background: p.color,
            "--cr-confetti-x": p.x, "--cr-confetti-y": p.y, "--cr-confetti-r": p.r,
            animation: `cr-confetti 1.5s ease-out ${p.delay} forwards`,
          } as React.CSSProperties} />
      ))}
    </div>
  );
}

// ─── Progress Dots ───────────────────────────────────────────────────────────

function ProgressDots({
  questions, answers, currentIndex, questionFeedback,
}: {
  questions: QuizQuestionView[];
  answers: Record<string, string>;
  currentIndex: number;
  questionFeedback: Record<string, string | undefined>;
}) {
  return (
    <div className="flex items-center justify-center gap-2">
      {questions.map((q, i) => {
        const answered = Boolean(answers[q.questionId]);
        const isCurrent = i === currentIndex;
        const fb = questionFeedback[q.questionId];
        return (
          <div key={q.questionId}
            className={[
              "h-2.5 w-2.5 rounded-full transition-all duration-200",
              fb === "correct" ? "bg-(--cr-accent)"
                : fb === "incorrect-final" ? "bg-(--cr-error)"
                : answered ? "bg-(--cr-accent)"
                : isCurrent ? "bg-(--cr-accent) shadow-[0_0_0_4px_var(--cr-accent-glow)]"
                : "bg-(--cr-fill-muted)",
            ].join(" ")}
            style={fb ? { animation: "cr-dot-fill 200ms ease-out" } : undefined} />
        );
      })}
    </div>
  );
}

// ─── Immediate Feedback Question Card ────────────────────────────────────────

function ImmediateQuestionCard({
  index, question, answerChoiceId, learningMode, onAnswer,
  onToggleExplanation, explanationOpen, feedbackState, disabledChoices,
  retriesLeft, isLast, onSeeResults,
}: {
  index: number;
  question: QuizQuestionView;
  answerChoiceId: string | undefined;
  learningMode: LearningMode;
  onAnswer: (choiceId: string) => void;
  onToggleExplanation: () => void;
  explanationOpen: boolean;
  feedbackState: "pending" | "correct" | "incorrect-retry" | "incorrect-final" | null;
  disabledChoices: Set<string>;
  retriesLeft: number;
  isLast: boolean;
  onSeeResults: () => void;
}) {
  const cardRef = useRef<HTMLElement>(null);
  const resolved = feedbackState === "correct" || feedbackState === "incorrect-final";

  useEffect(() => {
    if (!resolved) return;
    const delay = feedbackState === "correct"
      ? QUIZ_AUTO_ADVANCE_DELAY[learningMode]
      : QUIZ_AUTO_ADVANCE_DELAY[learningMode] + 500;
    const timer = setTimeout(() => {
      if (!isLast && cardRef.current?.nextElementSibling) {
        cardRef.current.nextElementSibling.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, delay);
    return () => clearTimeout(timer);
  }, [resolved, feedbackState, learningMode, isLast]);

  // Find correct choice letter for the simple fallback message
  const correctChoiceIndex = question.choices.findIndex((c) => c.choiceId === question.correctChoiceId);
  const correctLetter = OPTION_LABELS[correctChoiceIndex] ?? "?";

  return (
    <article ref={cardRef} className="cr-glass-reading p-6 scroll-mt-24"
      style={{ animation: `cr-card-enter 300ms ease-out ${index * 50}ms both` }}>

      {/* Question header — FIX 5: result badge NEXT TO number, not top-right */}
      <div className="mb-5 flex items-start gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-(--cr-accent) text-sm font-bold text-(--cr-text-inverse)">
            {index + 1}
          </div>
          {resolved && (
            <span className={[
              "flex h-5.5 w-5.5 items-center justify-center rounded-full text-xs",
              feedbackState === "correct" ? "bg-(--cr-success-bg) text-(--cr-success)" : "bg-(--cr-error-bg) text-(--cr-error)",
            ].join(" ")}>
              {feedbackState === "correct" ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
            </span>
          )}
        </div>
        <p className="flex-1 text-lg font-semibold leading-snug text-(--cr-text-heading)">
          {question.prompt}
        </p>
      </div>

      {/* Answer options — FIX 4: pulse on auto-revealed correct */}
      <div className="space-y-2">
        {question.choices.map((choice, optionIndex) => {
          const selected = answerChoiceId === choice.choiceId;
          const isDisabledChoice = disabledChoices.has(choice.choiceId);
          const isCorrectChoice = question.correctChoiceId === choice.choiceId;
          const showAsCorrect = resolved && isCorrectChoice;
          const showAsWrong = isDisabledChoice && !isCorrectChoice;
          const autoRevealed = showAsCorrect && feedbackState === "incorrect-final";
          const optionLabel = OPTION_LABELS[optionIndex] ?? String(optionIndex + 1);

          const stateClass = (() => {
            if (showAsCorrect) return "cr-answer-correct";
            if (showAsWrong) return "cr-answer-incorrect opacity-70";
            if (selected && !resolved) return "cr-answer-selected";
            if (resolved && !showAsCorrect) return "opacity-40 pointer-events-none";
            if (isDisabledChoice) return "opacity-40 pointer-events-none";
            return "";
          })();

          return (
            <button key={choice.choiceId} type="button"
              disabled={resolved || isDisabledChoice}
              onClick={() => onAnswer(choice.choiceId)}
              className={[
                "cr-answer-option w-full text-left",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--cr-accent-glow)",
                stateClass,
              ].join(" ")}
              style={autoRevealed ? { animation: "cr-pulse-glow 600ms ease-in-out 2" } : undefined}>
              <span className={[
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                showAsCorrect ? "bg-(--cr-success) text-(--cr-text-inverse)"
                  : showAsWrong ? "bg-(--cr-error) text-(--cr-text-inverse)"
                  : selected && !resolved ? "bg-(--cr-accent) text-(--cr-text-inverse)"
                  : "bg-(--cr-fill-muted) text-(--cr-text-secondary)",
              ].join(" ")}>
                {showAsCorrect ? <Check className="h-3.5 w-3.5" />
                  : showAsWrong ? <X className="h-3.5 w-3.5" />
                  : optionLabel}
              </span>
              <span className="flex-1 text-(--cr-text-primary) leading-relaxed"
                style={{ fontSize: "1.125rem", fontWeight: 450 }}>
                {choice.text}
              </span>
            </button>
          );
        })}
      </div>

      {/* Feedback banners */}
      {feedbackState === "correct" && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border-l-3 border-(--cr-success) bg-(--cr-success-bg) px-4 py-2.5 text-sm font-semibold text-(--cr-success)"
          style={{ animation: "cr-card-enter 200ms ease-out" }}>
          <Check className="h-4 w-4" /> Correct!
        </div>
      )}
      {feedbackState === "incorrect-retry" && (
        <div className="mt-3 rounded-lg border-l-3 border-(--cr-error) bg-(--cr-error-bg) px-4 py-2.5 text-sm font-semibold text-(--cr-error)"
          style={{ animation: "cr-card-enter 200ms ease-out" }}>
          {learningMode === "guided" && retriesLeft > 0
            ? `Not quite. Try again \u2014 ${retriesLeft} ${retriesLeft === 1 ? "retry" : "retries"} left`
            : "Not quite. Try once more?"}
        </div>
      )}

      {/* FIX 4+10: incorrect-final — neutral banner + smart explanation */}
      {feedbackState === "incorrect-final" && (
        <div className="mt-3 space-y-3" style={{ animation: "cr-card-enter 200ms ease-out" }}>
          <div className="rounded-lg border-l-3 border-(--cr-text-secondary) bg-(--cr-fill-subtle) px-4 py-2.5 text-sm text-(--cr-text-secondary)">
            The correct answer is {correctLetter}.
          </div>
          {!isGenericExplanation(question.explanation) && (
            <div className="rounded-xl border border-(--cr-glass-border) bg-(--cr-bg-surface-3) px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-(--cr-text-secondary)">
                Why this answer is right
              </p>
              <p className="mt-2 text-sm leading-relaxed text-(--cr-text-primary)" style={{ fontWeight: 450 }}>
                {question.explanation}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Explanation toggle for correct answers */}
      {feedbackState === "correct" && !isGenericExplanation(question.explanation) && (
        <div className="mt-4 border-t border-(--cr-glass-border) pt-4">
          <button type="button" onClick={onToggleExplanation}
            className="inline-flex items-center gap-1.5 rounded-full border border-(--cr-glass-border) bg-(--cr-bg-surface-3) px-3 py-1.5 text-xs font-semibold text-(--cr-text-secondary) transition hover:text-(--cr-text-primary)"
            aria-expanded={explanationOpen}>
            {explanationOpen
              ? <><ChevronUp className="h-3.5 w-3.5" /> Hide explanation</>
              : <><ChevronDown className="h-3.5 w-3.5" /> Show explanation</>}
          </button>
          <div className="overflow-hidden transition-all duration-300 ease-out"
            style={{ maxHeight: explanationOpen ? "300px" : "0px", opacity: explanationOpen ? 1 : 0 }}>
            <div className="mt-3 rounded-xl border border-(--cr-glass-border) bg-(--cr-bg-surface-3) px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-(--cr-text-secondary)">
                Why this answer is right
              </p>
              <p className="mt-2 text-sm leading-relaxed text-(--cr-text-primary)" style={{ fontWeight: 450 }}>
                {question.explanation}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* See Results on last question */}
      {isLast && resolved && (
        <div className="mt-5 flex flex-col items-center gap-2">
          <button type="button" onClick={onSeeResults}
            className="flex items-center gap-2 rounded-2xl bg-(--cr-accent) px-6 py-3 text-base font-bold text-(--cr-text-inverse) transition hover:opacity-90">
            See Your Results <ArrowRight className="h-5 w-5" />
          </button>
          <p className="text-xs text-(--cr-text-disabled)">All {question ? 10 : 0} questions answered</p>
        </div>
      )}
    </article>
  );
}

// ─── Review Mistakes View ────────────────────────────────────────────────────

function ReviewMistakesView({
  session, onClose, onRetake,
}: {
  session: QuizSessionView;
  onClose: () => void;
  onRetake: () => void;
}) {
  const incorrect = session.questions.filter((q) => q.isCorrect === false);

  return (
    <div className="space-y-5">
      <div>
        <button type="button" onClick={onClose}
          className="inline-flex items-center gap-1 text-sm font-medium text-(--cr-accent) transition hover:underline">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Results
        </button>
        <h2 className="mt-3 text-xl font-bold text-(--cr-text-heading)">
          Review Mistakes ({incorrect.length} question{incorrect.length !== 1 ? "s" : ""})
        </h2>
      </div>

      {incorrect.map((q) => {
        const userChoice = q.choices.find((c) => c.choiceId === q.selectedChoiceId);
        const correctChoice = q.choices.find((c) => c.choiceId === q.correctChoiceId);
        const userIdx = q.choices.findIndex((c) => c.choiceId === q.selectedChoiceId);
        const correctIdx = q.choices.findIndex((c) => c.choiceId === q.correctChoiceId);

        return (
          <div key={q.questionId} className="cr-glass-reading p-5">
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-(--cr-accent) text-sm font-bold text-(--cr-text-inverse)">
                {session.questions.indexOf(q) + 1}
              </div>
              <p className="text-base font-semibold text-(--cr-text-heading)">{q.prompt}</p>
            </div>

            {/* Wrong answer */}
            {userChoice && (
              <div className="mb-2 flex items-start gap-2.5 rounded-lg border border-(--cr-error)/20 bg-(--cr-error-bg) px-3 py-2.5">
                <span className="mt-0.5 text-sm font-bold text-(--cr-error)">{"\u2717"}</span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.05em] text-(--cr-text-disabled)">Your answer</p>
                  <p className="mt-0.5 text-sm text-(--cr-text-primary) line-through opacity-70">
                    {OPTION_LABELS[userIdx]}. {userChoice.text}
                  </p>
                </div>
              </div>
            )}

            {/* Correct answer */}
            {correctChoice && (
              <div className="mb-2 flex items-start gap-2.5 rounded-lg border border-(--cr-success)/20 bg-(--cr-success-bg) px-3 py-2.5">
                <span className="mt-0.5 text-sm font-bold text-(--cr-success)">{"\u2713"}</span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.05em] text-(--cr-text-disabled)">Correct answer</p>
                  <p className="mt-0.5 text-sm text-(--cr-text-primary)">
                    {OPTION_LABELS[correctIdx]}. {correctChoice.text}
                  </p>
                </div>
              </div>
            )}

            {/* Explanation — only if real */}
            {!isGenericExplanation(q.explanation) && (
              <div className="mt-2 rounded-xl border border-(--cr-glass-border) bg-(--cr-bg-surface-3) px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-(--cr-text-disabled)">
                  Why this answer is right
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-(--cr-text-primary)">{q.explanation}</p>
              </div>
            )}
          </div>
        );
      })}

      <div className="flex justify-center pt-2">
        <button type="button" onClick={onRetake}
          className="flex items-center gap-2 rounded-2xl bg-(--cr-accent) px-6 py-3 text-base font-bold text-(--cr-text-inverse) transition hover:opacity-90">
          <RotateCcw className="h-4 w-4" /> Retake Quiz
        </button>
      </div>
    </div>
  );
}

// ─── Results Screen ──────────────────────────────────────────────────────────

function ResultsScreen({
  session, learningMode, onReviewSummary, onRetry, onContinueToPractice, onReviewMistakes,
}: {
  session: QuizSessionView;
  learningMode: LearningMode;
  onReviewSummary: () => void;
  onRetry: () => void;
  onContinueToPractice: () => void;
  onReviewMistakes: () => void;
}) {
  const result = session.result;
  if (!result) return null;

  const incorrectCount = session.questions.filter((q) => q.isCorrect === false).length;
  const isFirstAttempt = session.attemptNumber === 1;
  const fpAmount = result.passed
    ? (isFirstAttempt ? CHAPTER_FP.quizPassFirstAttempt[learningMode] : CHAPTER_FP.quizPassRetry[learningMode])
    : 0;
  const fpPotential = isFirstAttempt
    ? CHAPTER_FP.quizPassFirstAttempt[learningMode]
    : CHAPTER_FP.quizPassRetry[learningMode];

  return (
    <div className="cr-glass-reading relative overflow-hidden p-8 text-center">
      {result.passed && <ConfettiBurst />}

      {/* FIX 11: Score ring with zero-state arc */}
      <div className="mb-6">
        <ProgressRing percent={result.scorePercent} passed={result.passed} />
      </div>

      <h2 className={["text-2xl font-bold", result.passed ? "text-(--cr-success)" : "text-(--cr-warning)"].join(" ")}>
        {result.passed ? "Chapter Passed!" : "Almost there!"}
      </h2>
      <p className="mt-2 text-sm text-(--cr-text-secondary)">
        {result.passed
          ? `You scored ${result.scorePercent}% (need ${QUIZ_PASS_THRESHOLDS[learningMode]}%)`
          : `You scored ${result.scorePercent}%. Need ${QUIZ_PASS_THRESHOLDS[learningMode]}% to pass.`}
      </p>

      {/* FIX 12: Flow Points */}
      {result.passed ? (
        <p className="mt-2 text-lg font-semibold text-(--cr-accent)" style={{ animation: "cr-card-enter 300ms ease-out 1.5s both" }}>
          +{fpAmount} FP {"\u2726"}
        </p>
      ) : (
        <p className="mt-2 text-xs text-(--cr-text-disabled)">
          Earn {fpPotential} FP when you pass
        </p>
      )}

      {/* Question breakdown — FIX 9: no duplicate badge */}
      <div className="mx-auto mt-6 flex max-w-xs flex-wrap justify-center gap-2">
        {session.questions.map((q) => (
          <div key={q.questionId}
            className={[
              "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold",
              q.isCorrect ? "bg-(--cr-success-bg) text-(--cr-success)" : "bg-(--cr-error-bg) text-(--cr-error)",
            ].join(" ")}>
            {q.isCorrect ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
          </div>
        ))}
      </div>

      {/* FIX 1: Buttons — no cooldown, correct order */}
      <div className="mx-auto mt-8 flex max-w-sm flex-col gap-3">
        {result.passed && (
          <button type="button" onClick={onContinueToPractice}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-(--cr-accent) px-6 py-4 text-lg font-bold text-(--cr-text-inverse) transition hover:opacity-90 hover:shadow-[0_4px_20px_rgba(77,182,172,0.3)]">
            <Target className="h-5 w-5" /> Continue to Practice <ArrowRight className="h-5 w-5" />
          </button>
        )}

        {/* Review Summary — primary CTA when failed */}
        {!result.passed && (
          <button type="button" onClick={onReviewSummary}
            className="w-full rounded-2xl bg-(--cr-accent) px-4 py-3.5 text-sm font-bold text-(--cr-text-inverse) transition hover:opacity-90">
            Review Summary
          </button>
        )}

        {/* Review Mistakes — ghost, only if there are mistakes */}
        {incorrectCount > 0 && (
          <button type="button" onClick={onReviewMistakes}
            className="w-full rounded-2xl border border-(--cr-glass-border) bg-transparent px-4 py-3 text-sm font-semibold text-(--cr-text-primary) transition hover:border-(--cr-accent)/40 hover:text-(--cr-accent)">
            Review Mistakes
          </button>
        )}

        {/* Retake Quiz — ghost, NO COOLDOWN */}
        <button type="button" onClick={onRetry}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-(--cr-glass-border) bg-transparent px-4 py-3 text-sm font-semibold text-(--cr-text-primary) transition hover:border-(--cr-accent)/40 hover:text-(--cr-accent)">
          <RotateCcw className="h-4 w-4" /> Retake Quiz
        </button>
      </div>
    </div>
  );
}

// ─── Main QuizPanel ──────────────────────────────────────────────────────────

export function QuizPanel({
  session, answers, explanationOpen, loading, submitting, error, cooldownSeconds,
  onAnswer, onSubmit, onReviewSummary, onRetry, onContinueToPractice, onToggleExplanation,
  learningMode = "standard",
  questionFlow = "all-at-once",
  shuffleQuestions = false,
  retryIncorrectOnly = false,
}: QuizPanelProps) {
  const [questionFeedback, setQuestionFeedback] = useState<
    Record<string, "correct" | "incorrect-retry" | "incorrect-final">
  >({});
  const [disabledChoices, setDisabledChoices] = useState<Record<string, Set<string>>>({});
  const [retriesUsed, setRetriesUsed] = useState<Record<string, number>>({});
  const [resultView, setResultView] = useState<"results" | "review-mistakes">("results");
  const [previousIncorrectIds, setPreviousIncorrectIds] = useState<Set<string>>(new Set());

  const maxRetries = QUIZ_RETRIES_PER_QUESTION[learningMode];
  const [oneByOneIndex, setOneByOneIndex] = useState(0);

  // Shuffle questions with a stable seed derived from session attempt
  const displayQuestions = useMemo(() => {
    if (!session) return [];
    let questions = [...session.questions];

    // Filter to incorrect-only on retake using previous attempt results
    if (retryIncorrectOnly && session.attemptNumber > 1 && !session.result && previousIncorrectIds.size > 0) {
      const filtered = questions.filter((q) => previousIncorrectIds.has(q.questionId));
      if (filtered.length > 0) questions = filtered;
    }

    if (shuffleQuestions) {
      // Seeded shuffle using session attempt number for stability
      const seed = session.attemptNumber;
      for (let i = questions.length - 1; i > 0; i--) {
        const j = ((seed * 2654435761 + i * 40503) >>> 0) % (i + 1);
        [questions[i], questions[j]] = [questions[j], questions[i]];
      }
    }
    return questions;
  }, [session, shuffleQuestions, retryIncorrectOnly, session?.attemptNumber, previousIncorrectIds]);

  // Reset local quiz state when session refreshes (e.g. retry)
  const prevSessionRef = useRef(session);
  useEffect(() => {
    const prev = prevSessionRef.current;
    prevSessionRef.current = session;
    if (!session || session === prev) return;
    // Fresh session (no result) after a submitted session means retry
    if (!session.result && prev?.result) {
      // Capture incorrect question IDs from previous attempt for retry-incorrect-only mode
      const incorrectIds = new Set(
        prev.questions.filter((q) => q.isCorrect === false).map((q) => q.questionId)
      );
      setPreviousIncorrectIds(incorrectIds);
      setQuestionFeedback({});
      setDisabledChoices({});
      setRetriesUsed({});
      setResultView("results");
      setOneByOneIndex(0);
    }
  }, [session]);

  const handleAnswer = useCallback(
    (questionId: string, choiceId: string) => {
      if (!session) return;
      const question = session.questions.find((q) => q.questionId === questionId);
      if (!question || questionFeedback[questionId] === "correct" || questionFeedback[questionId] === "incorrect-final") return;

      const isCorrect = question.correctChoiceId === choiceId;

      if (isCorrect) {
        onAnswer(questionId, choiceId);
        setQuestionFeedback((prev) => ({ ...prev, [questionId]: "correct" }));
      } else {
        const used = (retriesUsed[questionId] ?? 0) + 1;
        setRetriesUsed((prev) => ({ ...prev, [questionId]: used }));
        setDisabledChoices((prev) => {
          const next = new Set(prev[questionId] ?? new Set());
          next.add(choiceId);
          return { ...prev, [questionId]: next };
        });

        if (used >= maxRetries + 1) {
          onAnswer(questionId, choiceId);
          setQuestionFeedback((prev) => ({ ...prev, [questionId]: "incorrect-final" }));
        } else {
          setQuestionFeedback((prev) => ({ ...prev, [questionId]: "incorrect-retry" }));
        }
      }
    },
    [session, questionFeedback, retriesUsed, maxRetries, onAnswer]
  );

  const handleSeeResults = useCallback(() => {
    setResultView("results");
    onSubmit();
  }, [onSubmit]);

  if (loading && !session) {
    return (
      <section className="cr-glass-reading p-6">
        <div className="flex items-center gap-2 text-sm text-(--cr-text-secondary)">
          <LoaderCircle className="h-4 w-4 animate-spin" /> Loading quiz...
        </div>
      </section>
    );
  }

  if (!session) {
    return (
      <section className="cr-glass-reading border-(--cr-error)/30 p-6">
        <p className="text-sm text-(--cr-error)">{error || "We couldn't load this quiz right now."}</p>
      </section>
    );
  }

  const answeredCount = displayQuestions.filter((q) => Boolean(answers[q.questionId])).length;
  const submitted = Boolean(session.result);
  const allResolved = displayQuestions.every(
    (q) => questionFeedback[q.questionId] === "correct" || questionFeedback[q.questionId] === "incorrect-final"
  );
  const currentQuestionIndex = displayQuestions.findIndex(
    (q) => !questionFeedback[q.questionId] || questionFeedback[q.questionId] === "incorrect-retry"
  );

  // Review Mistakes view
  if (submitted && resultView === "review-mistakes") {
    return (
      <section className="space-y-5">
        <ReviewMistakesView session={session} onClose={() => setResultView("results")} onRetake={onRetry} />
      </section>
    );
  }

  return (
    <section className="cr-reading-content space-y-5">
      {/* Quiz Header — FIX 9: simplified when results shown */}
      {!submitted && (
        <div className="cr-glass-reading p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-(--cr-accent)">
                <Target className="h-4 w-4" />
                Pass <span className="font-bold">{QUIZ_PASS_THRESHOLDS[learningMode]}%</span> to unlock the next chapter
              </p>
              <p className="mt-1 text-sm text-(--cr-text-secondary)">
                Attempt {session.attemptNumber}
              </p>
            </div>
          </div>
          <ProgressDots questions={displayQuestions} answers={answers}
            currentIndex={currentQuestionIndex === -1 ? displayQuestions.length - 1 : currentQuestionIndex}
            questionFeedback={questionFeedback} />
        </div>
      )}

      {/* Results */}
      {submitted && (
        <ResultsScreen session={session} learningMode={learningMode}
          onReviewSummary={onReviewSummary} onRetry={onRetry} onContinueToPractice={onContinueToPractice}
          onReviewMistakes={() => setResultView("review-mistakes")} />
      )}

      {/* Questions */}
      {!submitted && (
        <div className="space-y-4">
          {questionFlow === "one-by-one" ? (
            <>
              {displayQuestions[oneByOneIndex] && (
                <ImmediateQuestionCard key={displayQuestions[oneByOneIndex].questionId}
                  index={oneByOneIndex} question={displayQuestions[oneByOneIndex]}
                  answerChoiceId={answers[displayQuestions[oneByOneIndex].questionId]}
                  learningMode={learningMode}
                  onAnswer={(choiceId) => handleAnswer(displayQuestions[oneByOneIndex].questionId, choiceId)}
                  onToggleExplanation={() => onToggleExplanation(displayQuestions[oneByOneIndex].questionId)}
                  explanationOpen={Boolean(explanationOpen[displayQuestions[oneByOneIndex].questionId])}
                  feedbackState={questionFeedback[displayQuestions[oneByOneIndex].questionId] ?? null}
                  disabledChoices={disabledChoices[displayQuestions[oneByOneIndex].questionId] ?? new Set()}
                  retriesLeft={maxRetries - (retriesUsed[displayQuestions[oneByOneIndex].questionId] ?? 0)}
                  isLast={oneByOneIndex === displayQuestions.length - 1} onSeeResults={handleSeeResults} />
              )}
              <div className="flex items-center justify-between">
                <button type="button" disabled={oneByOneIndex === 0}
                  onClick={() => setOneByOneIndex((i) => Math.max(0, i - 1))}
                  className="flex items-center gap-1 rounded-xl px-4 py-2 text-sm font-medium text-(--cr-text-secondary) hover:bg-(--cr-bg-surface-2) disabled:opacity-30 transition">
                  <ArrowLeft className="h-3.5 w-3.5" /> Previous
                </button>
                <span className="text-xs text-(--cr-text-disabled)">{oneByOneIndex + 1} / {displayQuestions.length}</span>
                <button type="button" disabled={oneByOneIndex >= displayQuestions.length - 1}
                  onClick={() => setOneByOneIndex((i) => Math.min(displayQuestions.length - 1, i + 1))}
                  className="flex items-center gap-1 rounded-xl px-4 py-2 text-sm font-medium text-(--cr-text-secondary) hover:bg-(--cr-bg-surface-2) disabled:opacity-30 transition">
                  Next <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </>
          ) : (
            displayQuestions.map((question, index) => (
              <ImmediateQuestionCard key={question.questionId}
                index={index} question={question} answerChoiceId={answers[question.questionId]}
                learningMode={learningMode} onAnswer={(choiceId) => handleAnswer(question.questionId, choiceId)}
                onToggleExplanation={() => onToggleExplanation(question.questionId)}
                explanationOpen={Boolean(explanationOpen[question.questionId])}
                feedbackState={questionFeedback[question.questionId] ?? null}
                disabledChoices={disabledChoices[question.questionId] ?? new Set()}
                retriesLeft={maxRetries - (retriesUsed[question.questionId] ?? 0)}
                isLast={index === displayQuestions.length - 1} onSeeResults={handleSeeResults} />
            ))
          )}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-(--cr-error)/30 bg-(--cr-error-bg) px-4 py-3 text-sm text-(--cr-error)">
          {error}
        </div>
      )}

      {/* Challenge mode submit */}
      {!submitted && learningMode === "challenge" && (
        <button type="button" disabled={!allResolved || submitting} onClick={handleSeeResults}
          className={[
            "w-full rounded-2xl px-6 py-4 text-lg font-bold transition",
            allResolved && !submitting
              ? "bg-(--cr-accent) text-(--cr-text-inverse) hover:opacity-90"
              : "cursor-not-allowed bg-(--cr-bg-surface-3) text-(--cr-text-disabled)",
          ].join(" ")}>
          {submitting
            ? <span className="flex items-center justify-center gap-2"><LoaderCircle className="h-4 w-4 animate-spin" /> Submitting...</span>
            : `Submit Answers \u00b7 ${answeredCount}/${displayQuestions.length} answered`}
        </button>
      )}
    </section>
  );
}
