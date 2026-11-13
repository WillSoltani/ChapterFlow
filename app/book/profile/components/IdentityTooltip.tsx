"use client";

import { useState } from "react";
import { Check, ChevronDown, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TierIdentity } from "@/components/progress/progressTypes";

function requirementLine(tier: { loopsRequired: number; avgScoreRequired: number; categoriesRequired: number }): string | null {
  if (tier.loopsRequired <= 0) return null;
  return `${tier.loopsRequired} chapters · ${tier.avgScoreRequired}% avg quiz · ${tier.categoriesRequired} categories`;
}

export function IdentityTooltip({ identity }: { identity: TierIdentity }) {
  const [open, setOpen] = useState(false);
  const next = identity.nextTier;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 rounded-full border border-(--cf-border) bg-(--cf-surface-muted) px-3 py-1 text-cf-caption font-medium uppercase tracking-[0.22em] text-(--cf-text-2) transition hover:bg-(--cf-surface)"
        aria-expanded={open}
      >
        <Sparkles className="h-3 w-3" />
        {identity.displayName}
        <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-30 mt-2 w-72 rounded-2xl border border-(--cf-border) bg-(--cf-surface-strong) p-4 shadow-shadow-elevated">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-(--cf-text-3)">Your tier</p>
          <p className="mt-2 text-sm font-semibold text-(--cf-text-1)">{identity.displayName}</p>
          <p className="mt-0.5 text-sm italic text-(--cf-text-2)">&ldquo;{identity.identityStatement}&rdquo;</p>
          {next ? (
            <p className="mt-2 text-xs text-(--cf-text-3)">
              Next: <span className="font-semibold text-(--cf-text-1)">{next.displayName}</span> · {next.loopsRemaining} more {next.loopsRemaining === 1 ? "chapter" : "chapters"}
              {next.avgScoreMet ? "" : `, ${next.avgScoreRequired}% avg quiz`}
              {next.categoriesRemaining > 0 ? `, ${next.categoriesRemaining} more ${next.categoriesRemaining === 1 ? "category" : "categories"}` : ""}
            </p>
          ) : (
            <p className="mt-2 text-sm text-accent-amber">You&apos;ve reached the highest tier!</p>
          )}
          <div className="mt-3 space-y-1.5">
            {identity.ladder.map((tier) => {
              const isActive = tier.status === "current";
              const isPast = tier.status === "passed";
              const requirement = requirementLine(tier);
              return (
                <div key={tier.name} className="flex items-start gap-2 text-xs">
                  <span className={cn(
                    "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-cf-caption",
                    isActive ? "bg-(--cf-accent) text-(--cf-accent-contrast)" : isPast ? "bg-(--cf-success-soft) text-(--cf-success-text)" : "border border-(--cf-border) bg-(--cf-surface-muted) text-(--cf-text-soft)"
                  )}>
                    {isPast ? <Check className="h-2.5 w-2.5" /> : isActive ? "→" : ""}
                  </span>
                  <span className="min-w-0">
                    <span className={cn("block", isActive ? "font-semibold text-(--cf-text-1)" : isPast ? "text-(--cf-text-2)" : "text-(--cf-text-soft)")}>
                      {tier.displayName}
                    </span>
                    {requirement ? (
                      <span className="block text-(--cf-text-soft)">{requirement}</span>
                    ) : null}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
