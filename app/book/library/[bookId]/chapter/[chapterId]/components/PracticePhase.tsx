"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Bookmark, BookmarkCheck, Trophy } from "lucide-react";
import { ImplementationPlanCard } from "./ImplementationPlanCard";
import { ReviewCardsPanel } from "./ReviewCardsPanel";
import { CommitmentPrompt } from "./CommitmentPrompt";
import { FailureRecoveryCard } from "./FailureRecoveryCard";
import { TransferPromptCard } from "./TransferPromptCard";
import type { ImplementationPlanItem, ReviewCardItem } from "@/app/book/data/bookChapters";
import type { V21ExperiencePlan } from "@/app/book/lib/v21-adapter";

type PracticePhaseProps = {
  keyTakeawayCard?: string;
  implementationPlan?: ImplementationPlanItem;
  reviewCards?: ReviewCardItem[];
  predictionPrompt?: string;
  fontScaleClass: string;
  onContinueToNextChapter: () => void;
  nextChapterLabel: string;
  bookmarkedTakeaways?: string[];
  chapterId?: string;
  bookId?: string;
  chapterNumber?: number;
  /** Called when a user bookmarks a step. Receives the step text so the
   *  parent can append it to the chapter's notes. */
  onBookmarkStep?: (text: string) => void;
  /** Called when user commits to an if-then plan. */
  onCommit?: (params: {
    bookId: string;
    chapterNumber: number;
    ifThenPlan: string;
    followUpDays: 3 | 7;
  }) => Promise<void>;
  hasActiveCommitment?: boolean;
  /** v21-only behavior-change layer (Layer A). Rendered at chapter end. */
  failureRecovery?: V21ExperiencePlan["failureRecovery"];
  transferPrompt?: V21ExperiencePlan["transferPrompt"];
  /** When true, hide the trailing "Continue to next chapter" CTA — used
   *  when this component is embedded inside ChapterCompleteModal which
   *  renders its own primary CTA below the content. */
  hideContinueCta?: boolean;
};

export function PracticePhase({
  keyTakeawayCard,
  implementationPlan,
  reviewCards,
  predictionPrompt,
  fontScaleClass,
  onContinueToNextChapter,
  nextChapterLabel,
  bookmarkedTakeaways,
  chapterId,
  bookId,
  chapterNumber,
  onBookmarkStep,
  onCommit,
  hasActiveCommitment = false,
  failureRecovery,
  transferPrompt,
  hideContinueCta = false,
}: PracticePhaseProps) {
  // Implementation plan checkbox state (persisted per chapter)
  const checkStorageKey = chapterId ? `cf-impl-checks-${chapterId}` : null;
  const [checkedSteps, setCheckedSteps] = useState<string[]>([]);

  useEffect(() => {
    if (!checkStorageKey) return;
    try {
      const raw = window.localStorage.getItem(checkStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setCheckedSteps(parsed.filter((v) => typeof v === "string"));
      }
    } catch {
      // ignore
    }
  }, [checkStorageKey]);

  useEffect(() => {
    if (!checkStorageKey) return;
    try {
      window.localStorage.setItem(checkStorageKey, JSON.stringify(checkedSteps));
    } catch {
      // ignore
    }
  }, [checkStorageKey, checkedSteps]);

  const toggleStep = (id: string, text: string) => {
    const isBookmarking = !checkedSteps.includes(id);
    setCheckedSteps((prev) =>
      isBookmarking ? [...prev, id] : prev.filter((s) => s !== id)
    );
    if (isBookmarking) {
      onBookmarkStep?.(text);
    }
  };

  // Derive step list from implementation plan if-then plans
  const planSteps = implementationPlan?.ifThenPlans?.map((item, index) => ({
    id: `step-${index}`,
    text: item.plan,
    context: item.context,
  })) ?? [];

  return (
    <div className="cr-reading-content space-y-8">
      <h2 data-phase-heading className="sr-only">Practice</h2>
      {/* Celebratory section header */}
      <div className="text-center mb-2">
        <p
          className="text-[18px] font-semibold text-(--cr-accent)"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {"\u2728"} You&rsquo;ve earned this. Lock it in.
        </p>
        <p className="text-[14px] mt-1 text-(--cr-text-disabled)">
          One final step {"\u2014"} cement what you learned.
        </p>
      </div>

      {/* The One Takeaway */}
      {keyTakeawayCard && (
        <section className="cr-glass-card relative overflow-hidden border-(--cr-accent)/30 px-6 py-5">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.1em] text-(--cr-accent)">
            The One Takeaway
          </p>
          <p
            className={`text-(--cr-text-heading) text-[1.1em] font-medium ${fontScaleClass}`}
          >
            {keyTakeawayCard}
          </p>
        </section>
      )}

      {/* Your Bookmarked Takeaways */}
      {bookmarkedTakeaways && bookmarkedTakeaways.length > 0 && (
        <section className="cr-glass-card border-(--cr-accent)/20 px-6 py-5">
          <div className="mb-3 flex items-center gap-2">
            <Bookmark className="h-4 w-4 text-(--cr-accent)" fill="currentColor" />
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-(--cr-accent)">
              Your Bookmarked Takeaways
            </p>
          </div>
          <ul className="space-y-2">
            {bookmarkedTakeaways.map((takeaway, i) => (
              <li
                key={i}
                className={`flex gap-3 rounded-xl border border-(--cr-glass-border) bg-(--cr-bg-surface-2) px-4 py-3 text-(--cr-text-primary) ${fontScaleClass}`}
              >
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-(--cr-accent)/15 text-[0.65rem] font-bold text-(--cr-accent)">
                  {i + 1}
                </span>
                <span>{takeaway}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Implementation Plan */}
      {implementationPlan && (
        <ImplementationPlanCard
          plan={implementationPlan}
          fontScaleClass={fontScaleClass}
        />
      )}

      {/* Implementation step bookmarks — saves to chapter notes */}
      {planSteps.length > 0 && (
        <section className="cr-glass-card border-(--cr-accent)/20 px-6 py-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-(--cr-accent)">
              Commit to your steps
            </p>
            <span className="text-[12px] text-(--cr-text-disabled)">
              {checkedSteps.length} of {planSteps.length} saved
            </span>
          </div>
          <p className="mb-3 text-[12px] text-(--cr-text-disabled)">
            Bookmark a step to save it to your notes.
          </p>
          <ul className="space-y-2.5">
            {planSteps.map((step) => {
              const saved = checkedSteps.includes(step.id);
              return (
                <li key={step.id}>
                  <button
                    type="button"
                    onClick={() => toggleStep(step.id, step.text)}
                    aria-pressed={saved}
                    className="group flex w-full items-start gap-3 rounded-lg border border-(--cr-glass-border) bg-(--cr-bg-surface-3) px-3 py-2 text-left transition hover:border-(--cr-accent)/40 hover:bg-(--cr-bg-surface-2) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--cr-accent)_55%,transparent)]"
                  >
                    {saved ? (
                      <BookmarkCheck className="mt-0.5 h-4 w-4 shrink-0 text-(--cr-accent)" />
                    ) : (
                      <Bookmark className="mt-0.5 h-4 w-4 shrink-0 text-(--cr-text-disabled) group-hover:text-(--cr-accent)" />
                    )}
                    <span
                      className={`text-[14px] leading-relaxed transition-colors ${
                        saved ? "text-(--cr-text-primary)" : "text-(--cr-text-secondary)"
                      }`}
                    >
                      {step.text}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Apply This Week — Commitment Prompt */}
      {onCommit && bookId && chapterNumber && implementationPlan?.ifThenPlans && (
        <CommitmentPrompt
          ifThenPlans={implementationPlan.ifThenPlans}
          bookId={bookId}
          chapterNumber={chapterNumber}
          fontScaleClass={fontScaleClass}
          onCommit={onCommit}
          hasActiveCommitment={hasActiveCommitment}
        />
      )}

      {/* When you slip — failure-recovery (v21 behavior-change layer) */}
      <FailureRecoveryCard failureRecovery={failureRecovery} />

      {/* Predict the Next Chapter */}
      {predictionPrompt && (
        <section className="rounded-xl border border-(--cr-info)/20 bg-(--cr-info)/5 px-5 py-4">
          <p className="mb-1.5 text-xs font-bold uppercase tracking-[0.08em] text-(--cr-info)">
            Predict the Next Chapter
          </p>
          <p className={`text-(--cr-text-primary) ${fontScaleClass}`}>
            {predictionPrompt}
          </p>
        </section>
      )}

      {/* Review Cards */}
      {reviewCards && reviewCards.length > 0 && (
        <ReviewCardsPanel cards={reviewCards} fontScaleClass={fontScaleClass} />
      )}

      {/* Where else this applies — far-transfer (v21 behavior-change layer) */}
      <TransferPromptCard transferPrompt={transferPrompt} />

      {/* Continue to Next Chapter */}
      {!hideContinueCta && (
      <div className="pt-4 pb-2 flex justify-center">
        <button
          type="button"
          onClick={onContinueToNextChapter}
          className="w-full md:w-auto px-8 py-4 rounded-full font-semibold text-[16px] bg-(--cr-accent) text-(--cr-text-inverse) transition-transform hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--cr-accent)_60%,transparent)] focus-visible:ring-offset-2 inline-flex items-center justify-center gap-2"
          style={{
            boxShadow:
              "0 0 24px color-mix(in srgb, var(--cr-accent) 35%, transparent)",
          }}
        >
          <Trophy className="h-5 w-5" /> {nextChapterLabel} <ArrowRight className="h-5 w-5" />
        </button>
      </div>
      )}
    </div>
  );
}
