"use client";

import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

export function AchievementBadgeCard({
  icon, title, description, earned, progressLabel, category, onOpen,
}: {
  icon: string; title: string; description: string; earned: boolean;
  progressLabel?: string; category?: string; onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "group cf-pressable cf-focus rounded-3xl border p-4 text-left transition",
        earned ? "border-(--cf-warning-border) bg-(--cf-warning-soft)" : "border-(--cf-border) bg-(--cf-surface-muted) hover:border-(--cf-border-strong) hover:bg-(--cf-surface)"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className={cn("text-3xl transition", !earned && "opacity-45 grayscale")}>{icon}</span>
        {!earned ? <Lock className="h-4 w-4 text-(--cf-text-soft)" /> : null}
      </div>
      <p className={cn("mt-4 text-sm font-semibold", earned ? "text-(--cf-warning-text)" : "text-(--cf-text-1)")}>{title}</p>
      <p className="mt-2 text-sm leading-6 text-(--cf-text-3)">{description}</p>
      {category ? <p className="mt-2 text-[10px] uppercase tracking-[0.22em] text-(--cf-text-3)">{category}</p> : null}
      {progressLabel ? <p className="mt-2 text-xs uppercase tracking-[0.18em] text-(--cf-text-3)">{progressLabel}</p> : null}
    </button>
  );
}
