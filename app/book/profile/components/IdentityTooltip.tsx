"use client";

import { useState } from "react";
import { Check, ChevronDown, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const IDENTITY_LEVELS = [
  { label: "Getting Started", books: 0 },
  { label: "Curious Reader", books: 1 },
  { label: "Knowledge Seeker", books: 3 },
  { label: "Dedicated Learner", books: 6 },
  { label: "Knowledge Builder", books: 11 },
  { label: "Polymath", books: 21 },
];

export function IdentityTooltip({
  currentLabel,
  booksCompleted,
}: {
  currentLabel: string;
  booksCompleted: number;
}) {
  const [open, setOpen] = useState(false);
  const currentIdx = IDENTITY_LEVELS.findIndex((l) => l.label === currentLabel);
  const nextLevel = IDENTITY_LEVELS[currentIdx + 1];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 rounded-full border border-(--cf-border) bg-(--cf-surface-muted) px-3 py-1 text-cf-caption font-medium uppercase tracking-[0.22em] text-(--cf-text-2) transition hover:bg-(--cf-surface)"
        aria-expanded={open}
      >
        <Sparkles className="h-3 w-3" />
        {currentLabel}
        <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-30 mt-2 w-72 rounded-2xl border border-(--cf-border) bg-(--cf-surface-strong) p-4 shadow-shadow-elevated">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-(--cf-text-3)">Reading level progression</p>
          {nextLevel ? (
            <p className="mt-2 text-sm text-(--cf-text-2)">
              Next: <span className="font-semibold text-(--cf-text-1)">{nextLevel.label}</span> — Complete {nextLevel.books} books
            </p>
          ) : (
            <p className="mt-2 text-sm text-accent-amber">You&apos;ve reached the highest level!</p>
          )}
          {nextLevel ? (
            <div className="mt-2 text-xs text-(--cf-text-3)">
              {booksCompleted}/{nextLevel.books} books to next level
            </div>
          ) : null}
          <div className="mt-3 space-y-1.5">
            {IDENTITY_LEVELS.map((level, i) => {
              const isActive = level.label === currentLabel;
              const isPast = i < currentIdx;
              return (
                <div key={level.label} className="flex items-center gap-2 text-xs">
                  <span className={cn(
                    "inline-flex h-4 w-4 items-center justify-center rounded-full text-cf-caption",
                    isActive ? "bg-(--cf-accent) text-(--cf-accent-contrast)" : isPast ? "bg-(--cf-success-soft) text-(--cf-success-text)" : "border border-(--cf-border) bg-(--cf-surface-muted) text-(--cf-text-soft)"
                  )}>
                    {isPast ? <Check className="h-2.5 w-2.5" /> : isActive ? "→" : ""}
                  </span>
                  <span className={cn(isActive ? "font-semibold text-(--cf-text-1)" : isPast ? "text-(--cf-text-2)" : "text-(--cf-text-soft)")}>
                    {level.label}
                  </span>
                  {level.books > 0 ? (
                    <span className="text-(--cf-text-soft)">({level.books} books)</span>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
