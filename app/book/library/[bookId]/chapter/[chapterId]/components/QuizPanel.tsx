"use client";

import { Check, ChevronDown, ChevronUp, Target, Trophy, X } from "lucide-react";
import type { ChapterQuizQuestion } from "@/app/book/data/mockChapters";
import type { QuizResult } from "@/app/book/library/[bookId]/chapter/[chapterId]/hooks/useChapterState";

const OPTION_LABELS = ["A", "B", "C", "D", "E"];

type QuizPanelProps = {
  questions: ChapterQuizQuestion[];
  answers: Record<string, number>;
  result: QuizResult | null;
  explanationOpen: Record<string, boolean>;
  requiredScore: number;
  cooldownSeconds: number;
  failureStreak: number;
  onAnswer: (questionId: string, optionIndex: number) => void;
  onSubmit: () => void;
  onReviewSummary: () => void;
  onRetry: () => void;
  onUnlockNext: () => void;
  onToggleExplanation: (questionId: string) => void;
  nextChapterLabel: string;
};

function questionCardClass(hasFailed: boolean, hasPassed: boolean): string {
  if (hasPassed) return "border-(--cf-success-border) bg-(--cf-success-soft)";
  if (hasFailed) return "border-(--cf-danger-border) bg-(--cf-danger-soft)";
  return "border-(--cf-border) bg-(--cf-surface)";
}

export function QuizPanel({
  questions,
  answers,
  result,
  explanationOpen,
  requiredScore,
  cooldownSeconds,
  failureStreak,
  onAnswer,
  onSubmit,
  onReviewSummary,
  onRetry,
  onUnlockNext,
  onToggleExplanation,
  nextChapterLabel,
}: QuizPanelProps) {
  const answeredCount = questions.filter((q) => typeof answers[q.id] === "number").length;
  const canSubmit = answeredCount === questions.length && !result && cooldownSeconds <= 0;
  const cooldownMinutes = Math.ceil(cooldownSeconds / 60);

  return (
    <section className="space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between rounded-2xl border border-(--cf-accent-border) bg-(--cf-accent-soft) px-4 py-3">
        <p className="flex items-center gap-2 text-sm text-(--cf-info-text)">
          <Target className="h-4 w-4 shrink-0" />
          Pass {requiredScore}% to unlock the next chapter
        </p>
        <span className="text-xs font-semibold tabular-nums text-(--cf-accent)">
          {answeredCount}/{questions.length}
        </span>
      </div>

      {/* Answer progress */}
      {!result && (
        <div className="h-1 w-full overflow-hidden rounded-full bg-(--cf-border)">
          <div
            className="h-full rounded-full bg-(--cf-accent) transition-[width] duration-300"
            style={{ width: questions.length ? `${(answeredCount / questions.length) * 100}%` : "0%" }}
          />
        </div>
      )}

      {/* Result banner */}
      {result ? (
        <div
          className={[
            "rounded-2xl border px-5 py-4",
            result.passed
              ? "border-(--cf-success-border) bg-(--cf-success-soft)"
              : "border-(--cf-danger-border) bg-(--cf-danger-soft)",
          ].join(" ")}
        >
          <div className="flex items-center gap-3">
            {result.passed
              ? <Trophy className="h-5 w-5 text-(--cf-success-text)" />
              : <X className="h-5 w-5 text-(--cf-danger-text)" />}
            <div>
              <p className={["text-lg font-bold", result.passed ? "text-(--cf-success-text)" : "text-(--cf-danger-text)"].join(" ")}>
                {result.score}% — {result.passed ? "Passed!" : "Not quite"}
              </p>
              <p className="text-sm text-(--cf-text-2)">
                {result.passed
                  ? "Well done. You can now unlock the next chapter."
                  : cooldownSeconds > 0
                    ? `Need ${requiredScore}%. Retry unlocks in ${cooldownMinutes} minute${cooldownMinutes === 1 ? "" : "s"}.`
                    : `Need ${requiredScore}%. Review the explanations below and try again.`}
              </p>
            </div>
          </div>
          {result && (
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-(--cf-border)">
              <div
                className={["h-full rounded-full transition-[width] duration-500", result.passed ? "bg-(--cf-success-text)" : "bg-(--cf-danger-text)"].join(" ")}
                style={{ width: `${result.score}%` }}
              />
            </div>
          )}
        </div>
      ) : null}

      {/* Questions */}
      <div className="space-y-4">
        {questions.map((question, index) => {
          const selectedIndex = answers[question.id];
          const submitted = Boolean(result);
          const answeredCorrectly = submitted ? selectedIndex === question.correctIndex : false;
          const hasFailed = submitted && !answeredCorrectly;
          const hasPassed = submitted && answeredCorrectly;

          return (
            <article
              key={question.id}
              className={[
                "rounded-[22px] border p-5 shadow-sm",
                questionCardClass(hasFailed, hasPassed),
              ].join(" ")}
            >
              {/* Question header */}
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-(--cf-border) bg-(--cf-surface-muted) text-xs font-bold text-(--cf-text-3)">
                    {index + 1}
                  </span>
                  <p className="text-base font-semibold leading-snug text-(--cf-text-1)">
                    {question.prompt}
                  </p>
                </div>
                {submitted && (
                  <span className={["shrink-0 rounded-full p-1", answeredCorrectly ? "bg-(--cf-success-soft)" : "bg-(--cf-danger-soft)"].join(" ")}>
                    {answeredCorrectly
                      ? <Check className="h-3.5 w-3.5 text-(--cf-success-text)" />
                      : <X className="h-3.5 w-3.5 text-(--cf-danger-text)" />}
                  </span>
                )}
              </div>

              {/* Options */}
              <div className="space-y-2">
                {question.options.map((option, optionIndex) => {
                  const selected = selectedIndex === optionIndex;
                  const isCorrect = optionIndex === question.correctIndex;
                  const label = OPTION_LABELS[optionIndex] ?? String(optionIndex + 1);

                  const optionClass = (() => {
                    if (!submitted) {
                      return selected
                        ? "border-(--cf-accent-border) bg-(--cf-accent-soft) text-(--cf-text-1)"
                        : "border-(--cf-border) bg-(--cf-surface) text-(--cf-text-2) hover:border-(--cf-border-strong) hover:bg-(--cf-surface-muted)";
                    }
                    if (isCorrect) return "border-(--cf-success-border) bg-(--cf-success-soft) text-(--cf-success-text)";
                    if (selected) return "border-(--cf-danger-border) bg-(--cf-danger-soft) text-(--cf-danger-text)";
                    return "border-(--cf-border) bg-(--cf-surface-muted) text-(--cf-text-soft)";
                  })();

                  return (
                    <button
                      key={`${question.id}-${optionIndex}`}
                      type="button"
                      disabled={submitted}
                      onClick={() => onAnswer(question.id, optionIndex)}
                      className={[
                        "flex w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition duration-150",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--cf-accent-border)",
                        optionClass,
                      ].join(" ")}
                    >
                      <span className={[
                        "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold",
                        selected && !submitted ? "border-(--cf-accent-border) bg-(--cf-accent-soft) text-(--cf-accent)"
                          : submitted && isCorrect ? "border-(--cf-success-border) bg-(--cf-success-soft) text-(--cf-success-text)"
                          : submitted && selected ? "border-(--cf-danger-border) bg-(--cf-danger-soft) text-(--cf-danger-text)"
                          : "border-(--cf-border) bg-(--cf-surface-muted) text-(--cf-text-3)",
                      ].join(" ")}>
                        {label}
                      </span>
                      <span className="text-sm">{option}</span>
                      {submitted && isCorrect && (
                        <Check className="ml-auto h-3.5 w-3.5 shrink-0 text-(--cf-success-text)" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Explanation */}
              {submitted ? (
                <div className="mt-3 border-t border-(--cf-divider) pt-3">
                  {!answeredCorrectly && (
                    <p className="mb-2 text-xs text-(--cf-danger-text)">
                      Correct: <span className="font-semibold">{question.options[question.correctIndex]}</span>
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => onToggleExplanation(question.id)}
                    className="inline-flex items-center gap-1 text-xs text-(--cf-accent) transition hover:text-(--cf-accent-strong)"
                  >
                    {explanationOpen[question.id]
                      ? <><ChevronUp className="h-3.5 w-3.5" /> Hide explanation</>
                      : <><ChevronDown className="h-3.5 w-3.5" /> Why this answer?</>}
                  </button>
                  {explanationOpen[question.id] ? (
                    <p className="mt-2 rounded-xl border border-(--cf-border) bg-(--cf-surface-muted) px-3 py-2.5 text-sm text-(--cf-text-2)">
                      {question.explanation}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      {/* Actions */}
      {result ? (
        result.passed ? (
          <button
            type="button"
            onClick={onUnlockNext}
            className="cf-btn cf-btn-success w-full rounded-2xl px-4 py-3.5 text-base font-semibold"
          >
            <span className="flex items-center justify-center gap-2">
              <Trophy className="h-4 w-4" />
              {nextChapterLabel}
            </span>
          </button>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={onReviewSummary}
              className="cf-btn cf-btn-secondary rounded-2xl px-4 py-3 text-sm font-semibold"
            >
              Review Summary
            </button>
            <button
              type="button"
              onClick={onRetry}
              className={[
                "rounded-2xl border px-4 py-3 text-sm font-semibold transition",
                cooldownSeconds > 0
                  ? "cursor-not-allowed border-(--cf-border) bg-(--cf-surface-muted) text-(--cf-text-soft)"
                  : "border-(--cf-accent-border) bg-(--cf-accent-soft) text-(--cf-info-text) hover:bg-(--cf-accent-muted)",
              ].join(" ")}
              disabled={cooldownSeconds > 0}
            >
              {cooldownSeconds > 0
                ? `Retry in ${cooldownMinutes} min`
                : `Try Again${failureStreak > 0 ? ` (Attempt ${failureStreak + 1})` : ""}`}
            </button>
          </div>
        )
      ) : (
        <button
          type="button"
          disabled={!canSubmit}
          onClick={onSubmit}
          className={[
            "w-full rounded-2xl px-4 py-3.5 text-base font-semibold transition",
            canSubmit
              ? "cf-btn cf-btn-primary"
              : "cursor-not-allowed border border-(--cf-border) bg-(--cf-surface-muted) text-(--cf-text-soft)",
          ].join(" ")}
        >
          {cooldownSeconds > 0
            ? `Retake locked · ${cooldownMinutes} min remaining`
            : `Submit Answers · ${answeredCount}/${questions.length} answered`}
        </button>
      )}
    </section>
  );
}
