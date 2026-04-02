"use client";

import { ArrowRight, Bookmark, Trophy } from "lucide-react";
import { ImplementationPlanCard } from "./ImplementationPlanCard";
import { ReviewCardsPanel } from "./ReviewCardsPanel";
import type { ImplementationPlanItem, ReviewCardItem } from "@/app/book/data/mockChapters";

type PracticePhaseProps = {
  keyTakeawayCard?: string;
  implementationPlan?: ImplementationPlanItem;
  reviewCards?: ReviewCardItem[];
  predictionPrompt?: string;
  fontScaleClass: string;
  onContinueToNextChapter: () => void;
  nextChapterLabel: string;
  bookmarkedTakeaways?: string[];
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
}: PracticePhaseProps) {
  return (
    <div className="cr-reading-content space-y-5">
      {/* The One Takeaway */}
      {keyTakeawayCard && (
        <section className="cr-glass-card relative overflow-hidden border-(--cr-accent)/30 px-6 py-5">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.1em] text-(--cr-accent)">
            The One Takeaway
          </p>
          <p
            className={`text-(--cr-text-heading) leading-[1.75] ${fontScaleClass}`}
            style={{ fontSize: "1.1em", fontWeight: 500 }}
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
                className={`flex gap-3 rounded-xl border border-(--cr-glass-border) bg-(--cr-bg-surface-2) px-4 py-3 text-(--cr-text-primary) leading-[1.75] ${fontScaleClass}`}
                style={{ fontWeight: 450 }}
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

      {/* Predict the Next Chapter */}
      {predictionPrompt && (
        <section className="rounded-xl border border-(--cr-info)/20 bg-(--cr-info)/5 px-5 py-4">
          <p className="mb-1.5 text-xs font-bold uppercase tracking-[0.08em] text-(--cr-info)">
            Predict the Next Chapter
          </p>
          <p className={`text-(--cr-text-primary) leading-[1.75] ${fontScaleClass}`}>
            {predictionPrompt}
          </p>
        </section>
      )}

      {/* Review Cards */}
      {reviewCards && reviewCards.length > 0 && (
        <ReviewCardsPanel cards={reviewCards} fontScaleClass={fontScaleClass} />
      )}

      {/* Continue to Next Chapter */}
      <div className="pt-4 pb-2">
        <button
          type="button"
          onClick={onContinueToNextChapter}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-(--cr-accent) px-6 py-4 text-lg font-bold text-(--cr-text-inverse) transition hover:opacity-90 hover:shadow-[0_4px_20px_rgba(77,182,172,0.3)]"
        >
          <Trophy className="h-5 w-5" /> {nextChapterLabel} <ArrowRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
