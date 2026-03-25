"use client";

import type { SeasonalChallenge as SeasonalChallengeType } from "../lib/badge-types";

type SeasonalChallengeProps = {
  challenge: SeasonalChallengeType | null;
};

export function SeasonalChallenge({ challenge }: SeasonalChallengeProps) {
  if (!challenge) return null;

  const now = new Date();
  const end = new Date(challenge.endDate);
  const daysRemaining = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86400000));

  if (daysRemaining <= 0) return null;

  const progressPercent = challenge.criteria.target > 0
    ? Math.min(100, Math.round((challenge.progress / challenge.criteria.target) * 100))
    : 0;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-(--cf-surface-muted) p-5 backdrop-blur-xl">
      <div
        className="pointer-events-none absolute inset-0 rounded-2xl"
        style={{
          background: "linear-gradient(135deg, var(--cf-warning-soft) 0%, var(--cf-accent-soft) 100%)",
        }}
      />

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="text-4xl">{challenge.badgeIcon}</span>
          <div>
            <h3 className="text-base font-semibold text-(--cf-text-1)">{challenge.title}</h3>
            <p className="mt-0.5 text-sm text-(--cf-text-3)">{challenge.description}</p>
          </div>
        </div>

        <div className="flex-1 sm:max-w-xs">
          <div className="h-2 overflow-hidden rounded-full bg-(--cf-surface-strong)">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-500 to-violet-500 transition-[width] duration-500"
              style={{ width: `${Math.max(4, progressPercent)}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-(--cf-text-3)">
            {challenge.progress} / {challenge.criteria.target} {challenge.criteria.description.toLowerCase()}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold text-(--cf-text-1)">
            {daysRemaining} {daysRemaining === 1 ? "day" : "days"}
          </p>
          <p className="text-xs text-(--cf-text-soft)">remaining</p>
        </div>
      </div>
    </div>
  );
}
