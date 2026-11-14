import { Flame } from "lucide-react";

interface StreakBadgeProps {
  count: number;
  /** Streak alive through yesterday, nothing read yet today (C2). */
  atRisk?: boolean;
}

export function StreakBadge({ count, atRisk = false }: StreakBadgeProps) {
  // Show the earned streak whenever count > 0 — even for a brand-new user whose
  // day-1 streak (1) was just granted at onboarding. Conflating "new user" with
  // "no streak" hid the just-awarded reward one screen after the celebration.
  if (count === 0) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-sm" style={{ color: "var(--cf-text-soft)" }}>
          Start your streak today
        </span>
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-1.5"
      aria-label={atRisk ? undefined : `${count} day streak`}
    >
      <span className="relative inline-flex" aria-hidden="true">
        <Flame
          size={18}
          strokeWidth={2.25}
          className="leading-none"
          style={{ color: "var(--cf-gold-text)" }}
        />
        {/* Glow behind flame */}
        <span
          className="absolute inset-0 rounded-full blur-[6px]"
          style={{ background: "var(--accent-amber-glow)" }}
        />
      </span>
      {atRisk ? (
        <span className="text-sm tabular-nums" style={{ color: "var(--cf-text-2)" }}>
          Read today to keep your {count}-day streak.
        </span>
      ) : (
        <span
          className="text-sm font-semibold tabular-nums"
          style={{ color: "var(--cf-text-1)" }}
        >
          {count}
        </span>
      )}
    </div>
  );
}
