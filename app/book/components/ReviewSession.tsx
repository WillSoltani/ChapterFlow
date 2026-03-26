"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, RotateCcw, X } from "lucide-react";
import {
  type ReviewItem,
  getPendingReviews,
  processReviewAnswer,
  estimateReviewTime,
} from "@/app/book/_lib/spaced-repetition";

const OPTION_LABELS = ["A", "B", "C", "D"];

type ReviewSessionProps = {
  onClose: () => void;
};

export function ReviewSession({ onClose }: ReviewSessionProps) {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<"correct" | "incorrect" | null>(null);
  const [results, setResults] = useState<boolean[]>([]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setItems(getPendingReviews());
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const currentItem = items[currentIndex] ?? null;

  const handleAnswer = useCallback(
    (choiceId: string) => {
      if (!currentItem || feedback) return;
      setSelectedChoice(choiceId);

      const isCorrect = choiceId === currentItem.correctChoiceId;
      setFeedback(isCorrect ? "correct" : "incorrect");
      processReviewAnswer(currentItem.id, isCorrect);
      setResults((prev) => [...prev, isCorrect]);

      // Auto-advance after delay
      setTimeout(() => {
        if (currentIndex < items.length - 1) {
          setCurrentIndex((prev) => prev + 1);
          setSelectedChoice(null);
          setFeedback(null);
        } else {
          setDone(true);
        }
      }, isCorrect ? 1500 : 2500);
    },
    [currentItem, currentIndex, items.length, feedback]
  );

  const correctCount = results.filter(Boolean).length;
  const incorrectCount = results.length - correctCount;

  if (items.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-(--cr-bg-root)/90 backdrop-blur-sm">
        <div className="cr-glass-reading max-w-md p-8 text-center">
          <p className="text-lg font-semibold text-(--cr-text-heading)">No reviews pending</p>
          <p className="mt-2 text-sm text-(--cr-text-secondary)">Check back tomorrow!</p>
          <button
            type="button"
            onClick={onClose}
            className="mt-4 rounded-xl bg-(--cr-accent) px-4 py-2 text-sm font-bold text-(--cr-text-inverse)"
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  // ─── Done Screen ─────────────────────────────────────────────────
  if (done) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-(--cr-bg-root)/90 backdrop-blur-sm">
        <div className="cr-glass-reading max-w-md p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-(--cr-success-bg)">
            <Check className="h-7 w-7 text-(--cr-success)" />
          </div>
          <h2 className="text-2xl font-bold text-(--cr-text-heading)">Review Complete!</h2>
          <p className="mt-2 text-lg font-semibold text-(--cr-text-primary)">
            {correctCount}/{results.length} correct
          </p>

          {incorrectCount > 0 && (
            <p className="mt-2 text-sm text-(--cr-text-secondary)">
              We'll revisit {incorrectCount} concept{incorrectCount !== 1 ? "s" : ""} tomorrow.
            </p>
          )}

          <div className="mt-5 space-y-2">
            {items.map((item, i) => (
              <div
                key={item.id}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs"
              >
                {results[i] ? (
                  <Check className="h-3.5 w-3.5 shrink-0 text-(--cr-success)" />
                ) : (
                  <X className="h-3.5 w-3.5 shrink-0 text-(--cr-error)" />
                )}
                <span className="flex-1 text-(--cr-text-secondary) truncate">
                  {item.questionText.slice(0, 60)}...
                </span>
                <span className="text-(--cr-text-disabled)">
                  {results[i] ? `in ${item.intervalDays}d` : "tomorrow"}
                </span>
              </div>
            ))}
          </div>

          <p className="mt-3 text-sm font-semibold text-(--cr-accent)">+15 FP</p>

          <button
            type="button"
            onClick={onClose}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-(--cr-accent) px-4 py-3 text-sm font-bold text-(--cr-text-inverse)"
          >
            Continue <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  // ─── Question Screen ─────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-(--cr-bg-root)/95 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-(--cr-glass-border) px-4 py-3">
        <div className="flex items-center gap-2">
          <RotateCcw className="h-4 w-4 text-(--cr-accent)" />
          <span className="text-sm font-semibold text-(--cr-text-heading)">Quick Review</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-(--cr-text-secondary)">
            {currentIndex + 1} of {items.length}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-(--cr-text-disabled) hover:text-(--cr-text-secondary)"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Progress dots */}
      <div className="flex items-center justify-center gap-2 py-3">
        {items.map((_, i) => (
          <div
            key={i}
            className={[
              "h-2 w-2 rounded-full transition-all",
              i < results.length
                ? results[i]
                  ? "bg-(--cr-accent)"
                  : "bg-(--cr-error)"
                : i === currentIndex
                  ? "bg-(--cr-accent) shadow-[0_0_0_3px_var(--cr-accent-glow)]"
                  : "bg-[rgba(255,255,255,0.2)]",
            ].join(" ")}
          />
        ))}
      </div>

      {/* Question */}
      <div className="flex flex-1 items-center justify-center px-4">
        {currentItem && (
          <div className="w-full max-w-lg">
            <div className="cr-glass-reading p-6">
              <p className="text-lg font-semibold leading-snug text-(--cr-text-heading)">
                {currentItem.questionText}
              </p>

              <div className="mt-5 space-y-2">
                {currentItem.choices.map((choice, i) => {
                  const isSelected = selectedChoice === choice.choiceId;
                  const isCorrectChoice = choice.choiceId === currentItem.correctChoiceId;
                  const showCorrect = feedback && isCorrectChoice;
                  const showWrong = feedback === "incorrect" && isSelected;

                  return (
                    <button
                      key={choice.choiceId}
                      type="button"
                      disabled={feedback !== null}
                      onClick={() => handleAnswer(choice.choiceId)}
                      className={[
                        "cr-answer-option w-full text-left",
                        showCorrect
                          ? "cr-answer-correct"
                          : showWrong
                            ? "cr-answer-incorrect"
                            : isSelected
                              ? "cr-answer-selected"
                              : "",
                        feedback && !showCorrect && !showWrong ? "opacity-40" : "",
                      ].join(" ")}
                    >
                      <span
                        className={[
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                          showCorrect
                            ? "bg-(--cr-success) text-(--cr-text-inverse)"
                            : showWrong
                              ? "bg-(--cr-error) text-(--cr-text-inverse)"
                              : "bg-[rgba(255,255,255,0.08)] text-(--cr-text-secondary)",
                        ].join(" ")}
                      >
                        {showCorrect ? <Check className="h-3.5 w-3.5" /> : showWrong ? <X className="h-3.5 w-3.5" /> : OPTION_LABELS[i]}
                      </span>
                      <span className="flex-1 text-sm leading-relaxed text-(--cr-text-primary)">
                        {choice.text}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Feedback */}
              {feedback === "correct" && (
                <div className="mt-3 rounded-lg border-l-3 border-(--cr-success) bg-(--cr-success-bg) px-4 py-2.5 text-sm font-semibold text-(--cr-success)">
                  <Check className="mr-1.5 inline h-4 w-4" /> Correct!
                </div>
              )}
              {feedback === "incorrect" && (
                <div className="mt-3 space-y-2">
                  <div className="rounded-lg border-l-3 border-(--cr-error) bg-(--cr-error-bg) px-4 py-2.5 text-sm text-(--cr-error)">
                    The correct answer is highlighted above.
                  </div>
                  <div className="rounded-xl border border-(--cr-glass-border) bg-(--cr-bg-surface-3) px-4 py-3 text-xs text-(--cr-text-primary)">
                    {currentItem.explanation}
                  </div>
                </div>
              )}
            </div>

            {/* Context */}
            <p className="mt-3 text-center text-xs text-(--cr-text-disabled)">
              From: {currentItem.bookTitle} · {currentItem.chapterTitle}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
