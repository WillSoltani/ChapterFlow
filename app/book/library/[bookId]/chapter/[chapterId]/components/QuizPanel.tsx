"use client";

import {
  Check,
  ChevronDown,
  ChevronUp,
  Clock3,
  LoaderCircle,
  Sparkles,
  Target,
  Trophy,
  X,
} from "lucide-react";
import type {
  QuizQuestionView,
  QuizSessionView,
} from "@/app/book/library/[bookId]/chapter/[chapterId]/hooks/useQuizSession";

const OPTION_LABELS = ["A", "B", "C", "D", "E"];

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
  onUnlockNext: () => void;
  onToggleExplanation: (questionId: string) => void;
  nextChapterLabel: string;
};

function formatDuration(seconds: number): string {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60)
    .toString()
    .padStart(2, "0");
  const remainder = Math.floor(safe % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${remainder}`;
}

function resultCardClass(question: QuizQuestionView): string {
  if (question.isCorrect === true) {
    return "border-(--cf-success-border) bg-(--cf-success-soft)";
  }
  if (question.isCorrect === false) {
    return "border-(--cf-danger-border) bg-(--cf-danger-soft)";
  }
  return "border-(--cf-border) bg-(--cf-surface)";
}

function QuestionCard(props: {
  index: number;
  question: QuizQuestionView;
  answerChoiceId: string | undefined;
  submitted: boolean;
  explanationOpen: boolean;
  onAnswer: (choiceId: string) => void;
  onToggleExplanation: () => void;
}) {
  const { index, question, answerChoiceId, submitted, explanationOpen, onAnswer, onToggleExplanation } =
    props;

  return (
    <article className={["rounded-[24px] border p-5 shadow-sm", resultCardClass(question)].join(" ")}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-(--cf-border) bg-(--cf-surface-muted) text-xs font-bold text-(--cf-text-3)">
            {index + 1}
          </span>
          <div>
            <p className="text-base font-semibold leading-snug text-(--cf-text-1)">
              {question.prompt}
            </p>
            {submitted ? (
              <p className="mt-1 text-xs text-(--cf-text-3)">
                {question.isCorrect
                  ? "Correct. You matched the main point."
                  : "Not quite. The correct answer is highlighted below."}
              </p>
            ) : null}
          </div>
        </div>
        {submitted ? (
          <span
            className={[
              "shrink-0 rounded-full p-1.5",
              question.isCorrect
                ? "bg-(--cf-success-soft)"
                : "bg-(--cf-danger-soft)",
            ].join(" ")}
          >
            {question.isCorrect ? (
              <Check className="h-4 w-4 text-(--cf-success-text)" />
            ) : (
              <X className="h-4 w-4 text-(--cf-danger-text)" />
            )}
          </span>
        ) : null}
      </div>

      <div className="grid gap-2">
        {question.choices.map((choice, optionIndex) => {
          const selected = answerChoiceId === choice.choiceId;
          const correct = submitted && question.correctChoiceId === choice.choiceId;
          const incorrectSelected =
            submitted && selected && question.correctChoiceId !== choice.choiceId;
          const optionLabel = OPTION_LABELS[optionIndex] ?? String(optionIndex + 1);
          const optionClass = (() => {
            if (!submitted) {
              return selected
                ? "border-(--cf-accent-border) bg-(--cf-accent-soft) text-(--cf-text-1)"
                : "border-(--cf-border) bg-(--cf-surface) text-(--cf-text-2) hover:border-(--cf-border-strong) hover:bg-(--cf-surface-muted)";
            }
            if (correct) {
              return "border-(--cf-success-border) bg-(--cf-success-soft) text-(--cf-success-text)";
            }
            if (incorrectSelected) {
              return "border-(--cf-danger-border) bg-(--cf-danger-soft) text-(--cf-danger-text)";
            }
            return "border-(--cf-border) bg-(--cf-surface-muted) text-(--cf-text-soft)";
          })();

          return (
            <button
              key={choice.choiceId}
              type="button"
              disabled={submitted}
              onClick={() => onAnswer(choice.choiceId)}
              className={[
                "flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left transition duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--cf-accent-border)",
                optionClass,
              ].join(" ")}
            >
              <span
                className={[
                  "mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold",
                  correct
                    ? "border-(--cf-success-border) bg-(--cf-success-soft) text-(--cf-success-text)"
                    : incorrectSelected
                      ? "border-(--cf-danger-border) bg-(--cf-danger-soft) text-(--cf-danger-text)"
                      : selected
                        ? "border-(--cf-accent-border) bg-(--cf-accent-soft) text-(--cf-accent)"
                        : "border-(--cf-border) bg-(--cf-surface-muted) text-(--cf-text-3)",
                ].join(" ")}
              >
                {optionLabel}
              </span>
              <span className="flex-1 text-sm leading-relaxed">{choice.text}</span>
              {correct ? (
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-(--cf-success-text)" />
              ) : null}
            </button>
          );
        })}
      </div>

      {submitted ? (
        <div className="mt-4 border-t border-(--cf-divider) pt-4">
          <button
            type="button"
            onClick={onToggleExplanation}
            className="inline-flex items-center gap-1.5 rounded-full border border-(--cf-border) bg-(--cf-surface-muted) px-3 py-1.5 text-xs font-semibold text-(--cf-text-2) transition hover:border-(--cf-border-strong) hover:text-(--cf-text-1)"
            aria-expanded={explanationOpen}
          >
            {explanationOpen ? (
              <>
                <ChevronUp className="h-3.5 w-3.5" />
                Hide details
              </>
            ) : (
              <>
                <ChevronDown className="h-3.5 w-3.5" />
                More details
              </>
            )}
          </button>
          {explanationOpen ? (
            <div className="mt-3 rounded-2xl border border-(--cf-border) bg-(--cf-surface-muted) px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-(--cf-text-3)">
                Why this answer is right
              </p>
              <p className="mt-2 text-sm leading-relaxed text-(--cf-text-2)">
                {question.explanation ||
                  "This choice best matches the chapter's main point and how it should be applied."}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export function QuizPanel({
  session,
  answers,
  explanationOpen,
  loading,
  submitting,
  error,
  cooldownSeconds,
  onAnswer,
  onSubmit,
  onReviewSummary,
  onRetry,
  onUnlockNext,
  onToggleExplanation,
  nextChapterLabel,
}: QuizPanelProps) {
  if (loading && !session) {
    return (
      <section className="rounded-[28px] border border-(--cf-border) bg-(--cf-surface) p-6 shadow-sm">
        <div className="flex items-center gap-2 text-sm text-(--cf-text-2)">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          Loading quiz...
        </div>
      </section>
    );
  }

  if (!session) {
    return (
      <section className="rounded-[28px] border border-(--cf-danger-border) bg-(--cf-danger-soft) p-6 shadow-sm">
        <p className="text-sm text-(--cf-danger-text)">
          {error || "We couldn't load this quiz right now."}
        </p>
      </section>
    );
  }

  const answeredCount = session.questions.filter((question) =>
    Boolean(answers[question.questionId])
  ).length;
  const submitted = Boolean(session.result);
  const canSubmit =
    !submitted &&
    !submitting &&
    cooldownSeconds <= 0 &&
    answeredCount === session.questions.length;

  return (
    <section className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <div className="rounded-[28px] border border-(--cf-accent-border) bg-(--cf-accent-soft) px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 text-sm font-semibold text-(--cf-info-text)">
                  <Target className="h-4 w-4" />
                  Pass {session.passingScorePercent}% to unlock the next chapter
                </p>
                <p className="mt-1 text-sm text-(--cf-text-2)">
                  Attempt {session.attemptNumber}
                  {session.nextAttemptNumber && submitted
                    ? ` completed. Your next try will be attempt ${session.nextAttemptNumber}.`
                    : submitted
                      ? " completed."
                      : " is ready when you are."}
                </p>
              </div>
              <div className="rounded-full border border-(--cf-accent-border) bg-(--cf-surface) px-3 py-1 text-xs font-semibold tabular-nums text-(--cf-accent)">
                {answeredCount}/{session.questions.length} answered
              </div>
            </div>
            {!submitted ? (
              <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-(--cf-border)">
                <div
                  className="h-full rounded-full bg-(--cf-accent) transition-[width] duration-300"
                  style={{
                    width: session.questions.length
                      ? `${(answeredCount / session.questions.length) * 100}%`
                      : "0%",
                  }}
                />
              </div>
            ) : null}
          </div>

          {session.result ? (
            <div
              className={[
                "rounded-[28px] border px-5 py-4",
                session.result.passed
                  ? "border-(--cf-success-border) bg-(--cf-success-soft)"
                  : "border-(--cf-danger-border) bg-(--cf-danger-soft)",
              ].join(" ")}
            >
              <div className="flex items-start gap-3">
                {session.result.passed ? (
                  <Trophy className="mt-0.5 h-5 w-5 text-(--cf-success-text)" />
                ) : (
                  <X className="mt-0.5 h-5 w-5 text-(--cf-danger-text)" />
                )}
                <div className="flex-1">
                  <p
                    className={[
                      "text-lg font-bold",
                      session.result.passed
                        ? "text-(--cf-success-text)"
                        : "text-(--cf-danger-text)",
                    ].join(" ")}
                  >
                    {session.result.scorePercent}% ·{" "}
                    {session.result.passed ? "Chapter unlocked" : "Not quite yet"}
                  </p>
                  <p className="mt-1 text-sm text-(--cf-text-2)">
                    {session.result.passed
                      ? "You passed the quiz and the next chapter is now available."
                      : cooldownSeconds > 0
                        ? `You need ${session.passingScorePercent}% to pass. Review the explanations below and retake it when the timer ends.`
                        : `You need ${session.passingScorePercent}% to pass. Review the explanations below and try again.`}
                  </p>
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-(--cf-border)">
                    <div
                      className={[
                        "h-full rounded-full transition-[width] duration-500",
                        session.result.passed
                          ? "bg-(--cf-success-text)"
                          : "bg-(--cf-danger-text)",
                      ].join(" ")}
                      style={{ width: `${session.result.scorePercent}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <div className="space-y-4">
            {session.questions.map((question, index) => (
              <QuestionCard
                key={question.questionId}
                index={index}
                question={question}
                answerChoiceId={answers[question.questionId]}
                submitted={submitted}
                explanationOpen={Boolean(explanationOpen[question.questionId])}
                onAnswer={(choiceId) => onAnswer(question.questionId, choiceId)}
                onToggleExplanation={() => onToggleExplanation(question.questionId)}
              />
            ))}
          </div>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <div className="rounded-[28px] border border-(--cf-border) bg-(--cf-surface) p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-(--cf-text-3)">
              Quiz progress
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
              <div className="rounded-2xl border border-(--cf-border) bg-(--cf-surface-muted) px-4 py-3">
                <p className="text-xs text-(--cf-text-3)">Attempts used</p>
                <p className="mt-1 text-xl font-semibold text-(--cf-text-1)">
                  {session.attemptsCount}
                </p>
              </div>
              <div className="rounded-2xl border border-(--cf-border) bg-(--cf-surface-muted) px-4 py-3">
                <p className="text-xs text-(--cf-text-3)">Best score</p>
                <p className="mt-1 text-xl font-semibold text-(--cf-text-1)">
                  {session.highestScorePercent}%
                </p>
              </div>
              <div className="rounded-2xl border border-(--cf-border) bg-(--cf-surface-muted) px-4 py-3">
                <p className="text-xs text-(--cf-text-3)">Pass target</p>
                <p className="mt-1 text-xl font-semibold text-(--cf-text-1)">
                  {session.passingScorePercent}%
                </p>
              </div>
            </div>

            {cooldownSeconds > 0 ? (
              <div
                className="mt-4 rounded-2xl border border-(--cf-danger-border) bg-(--cf-danger-soft) px-4 py-3"
                aria-live="polite"
              >
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-(--cf-danger-text)">
                  <Clock3 className="h-4 w-4" />
                  Retake cooldown
                </p>
                <p className="mt-2 text-3xl font-semibold tabular-nums text-(--cf-danger-text)">
                  {formatDuration(cooldownSeconds)}
                </p>
                <p className="mt-1 text-sm text-(--cf-text-2)">
                  Your next attempt unlocks automatically when the timer ends.
                </p>
              </div>
            ) : null}

            {session.history.length > 0 ? (
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-(--cf-text-3)">
                  Attempt history
                </p>
                <div className="mt-3 space-y-2">
                  {session.history.map((attempt) => (
                    <div
                      key={`${attempt.attemptNumber}-${attempt.submittedAt}`}
                      className="rounded-2xl border border-(--cf-border) bg-(--cf-surface-muted) px-4 py-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-(--cf-text-1)">
                          Attempt {attempt.attemptNumber}
                        </p>
                        <span
                          className={[
                            "rounded-full px-2.5 py-1 text-xs font-semibold",
                            attempt.passed
                              ? "bg-(--cf-success-soft) text-(--cf-success-text)"
                              : "bg-(--cf-danger-soft) text-(--cf-danger-text)",
                          ].join(" ")}
                        >
                          {attempt.scorePercent}%
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-(--cf-text-3)">
                        {attempt.correctAnswers}/{attempt.totalQuestions} correct
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-[28px] border border-(--cf-border) bg-(--cf-surface) p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-(--cf-text-3)">
              Next step
            </p>
            <p className="mt-2 text-sm leading-relaxed text-(--cf-text-2)">
              {session.result?.passed
                ? "You’re ready to move straight into the next chapter."
                : "Use the summary and examples as a quick reset before your next attempt."}
            </p>
            {session.result?.passed ? (
              <button
                type="button"
                onClick={onUnlockNext}
                className="cf-btn cf-btn-success mt-4 w-full rounded-2xl px-4 py-3.5 text-base font-semibold"
              >
                <span className="flex items-center justify-center gap-2">
                  <Trophy className="h-4 w-4" />
                  {nextChapterLabel}
                </span>
              </button>
            ) : (
              <div className="mt-4 grid gap-3">
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
                  disabled={cooldownSeconds > 0 || loading}
                  className={[
                    "rounded-2xl border px-4 py-3 text-sm font-semibold transition",
                    cooldownSeconds > 0 || loading
                      ? "cursor-not-allowed border-(--cf-border) bg-(--cf-surface-muted) text-(--cf-text-soft)"
                      : "border-(--cf-accent-border) bg-(--cf-accent-soft) text-(--cf-info-text) hover:bg-(--cf-accent-muted)",
                  ].join(" ")}
                >
                  {cooldownSeconds > 0
                    ? `Retry in ${formatDuration(cooldownSeconds)}`
                    : session.nextAttemptNumber
                      ? `Start attempt ${session.nextAttemptNumber}`
                      : "Try again"}
                </button>
              </div>
            )}
          </div>
        </aside>
      </div>

      {error ? (
        <div className="rounded-2xl border border-(--cf-danger-border) bg-(--cf-danger-soft) px-4 py-3 text-sm text-(--cf-danger-text)">
          {error}
        </div>
      ) : null}

      {!submitted ? (
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
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Submitting answers...
            </span>
          ) : cooldownSeconds > 0 ? (
            `Retake locked · ${formatDuration(cooldownSeconds)} remaining`
          ) : (
            `Submit Answers · ${answeredCount}/${session.questions.length} answered`
          )}
        </button>
      ) : null}

      {!submitted ? (
        <div className="rounded-2xl border border-(--cf-border) bg-(--cf-surface-muted) px-4 py-3 text-sm text-(--cf-text-2)">
          <span className="inline-flex items-center gap-2 font-medium text-(--cf-text-1)">
            <Sparkles className="h-4 w-4 text-(--cf-accent)" />
            Scenario-based questions
          </span>
          <p className="mt-1 leading-relaxed">
            Each question checks whether you can recognize the chapter’s main point in a real decision, not just remember a phrase.
          </p>
        </div>
      ) : null}
    </section>
  );
}
