"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Check, Eye, Layers, RotateCcw, X } from "lucide-react";
import {
  type ReviewItem,
  getPendingReviews,
  processReviewAnswer,
} from "@/app/book/_lib/spaced-repetition";

const OPTION_LABELS = ["A", "B", "C", "D"];

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: "bg-accent-emerald/10 text-accent-emerald border border-accent-emerald/20",
  medium: "bg-accent-amber/10 text-accent-amber border border-accent-amber/20",
  hard: "bg-accent-rose/10 text-accent-rose border border-accent-rose/20",
};

type ReviewSessionProps = {
  onClose: () => void;
};

export function ReviewSession({ onClose }: ReviewSessionProps) {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<"correct" | "incorrect" | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState<boolean[]>([]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setItems(getPendingReviews());
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const currentItem = items[currentIndex] ?? null;
  const isFlashcard = currentItem?.type === "flashcard";

  const advanceToNext = useCallback(
    (delay: number) => {
      setTimeout(() => {
        if (currentIndex < items.length - 1) {
          setCurrentIndex((prev) => prev + 1);
          setSelectedChoice(null);
          setFeedback(null);
          setRevealed(false);
        } else {
          setDone(true);
        }
      }, delay);
    },
    [currentIndex, items.length]
  );

  // Quiz-style answer handler
  const handleAnswer = useCallback(
    (choiceId: string) => {
      if (!currentItem || feedback) return;
      setSelectedChoice(choiceId);

      const isCorrect = choiceId === currentItem.correctChoiceId;
      setFeedback(isCorrect ? "correct" : "incorrect");
      processReviewAnswer(currentItem.id, isCorrect);
      setResults((prev) => [...prev, isCorrect]);

      advanceToNext(isCorrect ? 1500 : 2500);
    },
    [currentItem, feedback, advanceToNext]
  );

  // Flashcard self-rating handler
  const handleSelfRate = useCallback(
    (gotIt: boolean) => {
      if (!currentItem || feedback) return;
      setFeedback(gotIt ? "correct" : "incorrect");
      processReviewAnswer(currentItem.id, gotIt);
      setResults((prev) => [...prev, gotIt]);

      advanceToNext(gotIt ? 1000 : 1500);
    },
    [currentItem, feedback, advanceToNext]
  );

  const correctCount = results.filter(Boolean).length;
  const incorrectCount = results.length - correctCount;

  // Helper to get display text for an item
  function getItemDisplayText(item: ReviewItem): string {
    if (item.type === "flashcard") return item.front ?? "Flashcard";
    return item.questionText ?? "Question";
  }

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
              We&apos;ll revisit {incorrectCount} concept{incorrectCount !== 1 ? "s" : ""} tomorrow.
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
                  {getItemDisplayText(item).slice(0, 60)}
                  {getItemDisplayText(item).length > 60 ? "..." : ""}
                </span>
                <span className="text-(--cr-text-disabled)">
                  {results[i] ? `in ${item.intervalDays}d` : "tomorrow"}
                </span>
              </div>
            ))}
          </div>

          <p className="mt-3 text-sm font-semibold text-(--cr-accent)">
            {"\u{2728}"} Knowledge reinforced
          </p>

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

  // ─── Question/Flashcard Screen ──────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-(--cr-bg-root)/95 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-(--cr-glass-border) px-4 py-3">
        <div className="flex items-center gap-2">
          {isFlashcard ? (
            <Layers className="h-4 w-4 text-(--cr-accent)" />
          ) : (
            <RotateCcw className="h-4 w-4 text-(--cr-accent)" />
          )}
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

      {/* Content */}
      <div className="flex flex-1 items-center justify-center px-4">
        {currentItem && isFlashcard ? (
          /* ─── Flashcard Item ─── */
          <div className="w-full max-w-lg">
            <div className="cr-glass-reading p-6">
              {/* Difficulty badge */}
              {currentItem.difficulty && (
                <span
                  className={`mb-3 inline-block rounded-md px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.08em] ${DIFFICULTY_COLORS[currentItem.difficulty] ?? DIFFICULTY_COLORS.easy}`}
                >
                  {currentItem.difficulty}
                </span>
              )}

              {/* Front text */}
              <p className="text-lg font-semibold leading-snug text-(--cr-text-heading)">
                {currentItem.front}
              </p>

              {!revealed && !feedback ? (
                /* Reveal button */
                <button
                  type="button"
                  onClick={() => setRevealed(true)}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-(--cr-accent)/30 bg-(--cr-accent)/10 px-5 py-3 text-sm font-semibold text-(--cr-accent) transition-colors hover:bg-(--cr-accent)/20"
                >
                  <Eye className="h-4 w-4" />
                  Reveal Answer
                </button>
              ) : (
                <>
                  {/* Back text (answer) */}
                  <div
                    className="mt-5 rounded-xl border border-(--cr-accent)/20 bg-(--cr-accent)/5 px-4 py-3 text-sm leading-relaxed text-(--cr-text-primary)"
                    style={{ animation: "cr-card-enter 200ms ease-out" }}
                  >
                    {currentItem.back}
                  </div>

                  {/* Self-rating buttons */}
                  {!feedback && (
                    <div className="mt-4 flex gap-3">
                      <button
                        type="button"
                        onClick={() => handleSelfRate(false)}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-accent-amber/30 bg-accent-amber/10 px-4 py-2.5 text-sm font-semibold text-accent-amber transition-colors hover:bg-accent-amber/20"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Still learning
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSelfRate(true)}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-accent-emerald/30 bg-accent-emerald/10 px-4 py-2.5 text-sm font-semibold text-accent-emerald transition-colors hover:bg-accent-emerald/20"
                      >
                        <Check className="h-3.5 w-3.5" />
                        Got it
                      </button>
                    </div>
                  )}

                  {/* Feedback after self-rating */}
                  {feedback === "correct" && (
                    <div className="mt-3 rounded-lg border-l-3 border-(--cr-success) bg-(--cr-success-bg) px-4 py-2.5 text-sm font-semibold text-(--cr-success)">
                      <Check className="mr-1.5 inline h-4 w-4" /> Nice! See you in a few days.
                    </div>
                  )}
                  {feedback === "incorrect" && (
                    <div className="mt-3 rounded-lg border-l-3 border-accent-amber bg-accent-amber/10 px-4 py-2.5 text-sm text-accent-amber">
                      <RotateCcw className="mr-1.5 inline h-4 w-4" /> We&apos;ll review this again tomorrow.
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Context */}
            <p className="mt-3 text-center text-xs text-(--cr-text-disabled)">
              From: {currentItem.bookTitle} · {currentItem.chapterTitle}
            </p>
          </div>
        ) : currentItem ? (
          /* ─── Quiz Item ─── */
          <div className="w-full max-w-lg">
            <div className="cr-glass-reading p-6">
              <p className="text-lg font-semibold leading-snug text-(--cr-text-heading)">
                {currentItem.questionText}
              </p>

              <div className="mt-5 space-y-2">
                {(currentItem.choices ?? []).map((choice, i) => {
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
                  {currentItem.explanation && (
                    <div className="rounded-xl border border-(--cr-glass-border) bg-(--cr-bg-surface-3) px-4 py-3 text-xs text-(--cr-text-primary)">
                      {currentItem.explanation}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Context */}
            <p className="mt-3 text-center text-xs text-(--cr-text-disabled)">
              From: {currentItem.bookTitle} · {currentItem.chapterTitle}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
