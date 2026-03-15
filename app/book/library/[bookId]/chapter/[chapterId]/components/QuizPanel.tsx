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
  if (hasPassed) return "border-emerald-300/25 bg-emerald-500/6";
  if (hasFailed) return "border-rose-300/30 bg-rose-500/6";
  return "border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))]";
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
      <div className="flex items-center justify-between rounded-2xl border border-sky-300/20 bg-sky-500/7 px-4 py-3">
        <p className="flex items-center gap-2 text-sm text-sky-200">
          <Target className="h-4 w-4 shrink-0" />
          Pass {requiredScore}% to unlock the next chapter
        </p>
        <span className="text-xs font-semibold tabular-nums text-sky-300">
          {answeredCount}/{questions.length}
        </span>
      </div>

      {/* Answer progress */}
      {!result && (
        <div className="h-1 w-full overflow-hidden rounded-full bg-slate-800/60">
          <div
            className="h-full rounded-full bg-sky-500 transition-[width] duration-300"
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
              ? "border-emerald-300/30 bg-emerald-500/10"
              : "border-rose-300/30 bg-rose-500/10",
          ].join(" ")}
        >
          <div className="flex items-center gap-3">
            {result.passed
              ? <Trophy className="h-5 w-5 text-emerald-300" />
              : <X className="h-5 w-5 text-rose-300" />}
            <div>
              <p className={["text-lg font-bold", result.passed ? "text-emerald-100" : "text-rose-100"].join(" ")}>
                {result.score}% — {result.passed ? "Passed!" : "Not quite"}
              </p>
              <p className="text-sm opacity-80 text-slate-200">
                {result.passed
                  ? "Well done. You can now unlock the next chapter."
                  : cooldownSeconds > 0
                    ? `Need ${requiredScore}%. Retry unlocks in ${cooldownMinutes} minute${cooldownMinutes === 1 ? "" : "s"}.`
                    : `Need ${requiredScore}%. Review the explanations below and try again.`}
              </p>
            </div>
          </div>
          {result && (
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-black/20">
              <div
                className={["h-full rounded-full transition-[width] duration-500", result.passed ? "bg-emerald-400" : "bg-rose-400"].join(" ")}
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
                "rounded-[22px] border p-5 shadow-[0_12px_32px_rgba(2,6,23,0.35)]",
                questionCardClass(hasFailed, hasPassed),
              ].join(" ")}
            >
              {/* Question header */}
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/6 text-xs font-bold text-slate-400">
                    {index + 1}
                  </span>
                  <p className="text-base font-semibold leading-snug text-slate-100">
                    {question.prompt}
                  </p>
                </div>
                {submitted && (
                  <span className={["shrink-0 rounded-full p-1", answeredCorrectly ? "bg-emerald-500/20" : "bg-rose-500/20"].join(" ")}>
                    {answeredCorrectly
                      ? <Check className="h-3.5 w-3.5 text-emerald-300" />
                      : <X className="h-3.5 w-3.5 text-rose-300" />}
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
                        ? "border-sky-300/45 bg-sky-500/16 text-sky-100"
                        : "border-white/10 bg-white/2 text-slate-300 hover:border-white/22 hover:bg-white/5";
                    }
                    if (isCorrect) return "border-emerald-300/40 bg-emerald-500/12 text-emerald-100";
                    if (selected) return "border-rose-300/40 bg-rose-500/12 text-rose-200";
                    return "border-white/8 bg-white/2 text-slate-500";
                  })();

                  return (
                    <button
                      key={`${question.id}-${optionIndex}`}
                      type="button"
                      disabled={submitted}
                      onClick={() => onAnswer(question.id, optionIndex)}
                      className={[
                        "flex w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition duration-150",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/45",
                        optionClass,
                      ].join(" ")}
                    >
                      <span className={[
                        "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold",
                        selected && !submitted ? "border-sky-300/50 bg-sky-500/20 text-sky-200"
                          : submitted && isCorrect ? "border-emerald-300/50 bg-emerald-500/20 text-emerald-200"
                          : submitted && selected ? "border-rose-300/50 bg-rose-500/20 text-rose-200"
                          : "border-white/15 bg-white/5 text-slate-500",
                      ].join(" ")}>
                        {label}
                      </span>
                      <span className="text-sm">{option}</span>
                      {submitted && isCorrect && (
                        <Check className="ml-auto h-3.5 w-3.5 shrink-0 text-emerald-400" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Explanation */}
              {submitted ? (
                <div className="mt-3 border-t border-white/8 pt-3">
                  {!answeredCorrectly && (
                    <p className="mb-2 text-xs text-rose-300">
                      Correct: <span className="font-semibold">{question.options[question.correctIndex]}</span>
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => onToggleExplanation(question.id)}
                    className="inline-flex items-center gap-1 text-xs text-sky-300 transition hover:text-sky-200"
                  >
                    {explanationOpen[question.id]
                      ? <><ChevronUp className="h-3.5 w-3.5" /> Hide explanation</>
                      : <><ChevronDown className="h-3.5 w-3.5" /> Why this answer?</>}
                  </button>
                  {explanationOpen[question.id] ? (
                    <p className="mt-2 rounded-xl border border-white/8 bg-white/3 px-3 py-2.5 text-sm text-slate-300">
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
            className="w-full rounded-2xl border border-emerald-300/30 bg-emerald-500/16 px-4 py-3.5 text-base font-semibold text-emerald-50 shadow-[0_10px_28px_rgba(16,185,129,0.22)] transition hover:bg-emerald-500/24 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/50"
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
              className="rounded-2xl border border-white/15 bg-white/4 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/8"
            >
              Review Summary
            </button>
            <button
              type="button"
              onClick={onRetry}
              className={[
                "rounded-2xl border px-4 py-3 text-sm font-semibold transition",
                cooldownSeconds > 0
                  ? "cursor-not-allowed border-white/10 bg-white/4 text-slate-500"
                  : "border-sky-300/30 bg-sky-500/14 text-sky-100 hover:bg-sky-500/22",
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
              ? "bg-linear-to-r from-sky-500 to-cyan-400 text-white shadow-[0_14px_32px_rgba(14,165,233,0.34)] hover:brightness-105 active:scale-[0.99]"
              : "cursor-not-allowed border border-white/10 bg-white/3 text-slate-600",
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
