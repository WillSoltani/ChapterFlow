"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, RotateCcw, Layers } from "lucide-react";
import type { ReviewCardItem } from "@/lib/reader-content-types";

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: "bg-accent-emerald/10 text-accent-emerald border-accent-emerald/20",
  medium: "bg-accent-amber/10 text-accent-amber border-accent-amber/20",
  hard: "bg-accent-rose/10 text-accent-rose border-accent-rose/20",
};

type ReviewCardsPanelProps = {
  cards: ReviewCardItem[];
  fontScaleClass: string;
};

function FlipCard({ card, fontScaleClass }: { card: ReviewCardItem; fontScaleClass: string }) {
  const [flipped, setFlipped] = useState(false);

  return (
    <button
      onClick={() => setFlipped(!flipped)}
      className="w-full text-left rounded-lg border border-(--cr-glass-border) bg-(--cr-glass-card) p-4 transition-all duration-200 hover:border-(--cr-accent)/30"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <span
          className={`inline-block rounded-md border px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.08em] ${DIFFICULTY_COLORS[card.difficulty] ?? DIFFICULTY_COLORS.easy}`}
        >
          {card.difficulty}
        </span>
        <span className="text-[0.65rem] font-medium text-(--cr-text-disabled)">
          {flipped ? "Answer" : "Tap to reveal"}
        </span>
      </div>
      <div className={`${fontScaleClass} text-(--cr-text-primary)`}>
        {flipped ? (
          <div
            className="rounded-md border border-(--cr-accent)/15 bg-(--cr-accent-muted) px-3 py-2.5"
            style={{ animation: "cr-card-enter 200ms ease-out" }}
          >
            {card.back}
          </div>
        ) : (
          <p>{card.front}</p>
        )}
      </div>
      {flipped && (
        <p className="mt-2 text-[0.7rem] text-(--cr-text-disabled) flex items-center gap-1">
          <RotateCcw className="h-3 w-3" /> Tap to reset
        </p>
      )}
    </button>
  );
}

export function ReviewCardsPanel({ cards, fontScaleClass }: ReviewCardsPanelProps) {
  const [expanded, setExpanded] = useState(true);

  if (!cards || cards.length === 0) return null;

  return (
    <section className="cr-glass-reading overflow-hidden rounded-xl">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-6 py-4 text-left"
      >
        <div className="flex items-center gap-2.5">
          <Layers className="h-4.5 w-4.5 text-(--cr-accent)" />
          <h3 className="text-xs font-bold uppercase tracking-[0.08em] text-(--cr-text-secondary)">
            Review Cards
          </h3>
          <span className="text-[0.65rem] text-(--cr-text-disabled)">
            {cards.length} cards
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-(--cr-text-disabled)" />
        ) : (
          <ChevronDown className="h-4 w-4 text-(--cr-text-disabled)" />
        )}
      </button>

      {expanded && (
        <div className="space-y-3 px-6 pb-6">
          {cards.map((card) => (
            <FlipCard key={card.id} card={card} fontScaleClass={fontScaleClass} />
          ))}
        </div>
      )}
    </section>
  );
}
