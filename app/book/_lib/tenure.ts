// Implements §8.3 — Tenure-aware presentation.
// Three phases: scaffolding (1-14d), forming (15-60d), intrinsic (60+d).
// CSS data-tenure attribute applied to dashboard container.

export type TenurePhase = "scaffolding" | "forming" | "intrinsic";

/**
 * §8.3 — Determine the user's tenure phase based on account age.
 * @param accountCreatedAt ISO timestamp of account creation
 * @returns The tenure phase for presentation rules
 */
export function getTenurePhase(accountCreatedAt: string | null | undefined): TenurePhase {
  if (!accountCreatedAt) return "scaffolding";

  const created = new Date(accountCreatedAt);
  if (isNaN(created.getTime())) return "scaffolding";

  const now = new Date();
  const daysSinceCreation = Math.floor(
    (now.getTime() - created.getTime()) / (24 * 60 * 60 * 1000)
  );

  if (daysSinceCreation <= 14) return "scaffolding";
  if (daysSinceCreation <= 60) return "forming";
  return "intrinsic";
}

/**
 * §8.3 — Minimum IP amount to show an earning toast, based on tenure phase.
 *
 * Scaffolding: show toast for every earning event
 * Forming: show toast only for ≥50 IP (milestones, bonuses, tier advances)
 * Intrinsic: show toast only for milestones, tier advances, and hidden achievements
 */
export function getToastThreshold(phase: TenurePhase): number {
  switch (phase) {
    case "scaffolding":
      return 0; // Show all
    case "forming":
      return 50; // Milestones and bonuses only
    case "intrinsic":
      return Infinity; // Handled by type check, not amount
  }
}

/**
 * §8.3 — Should a toast be shown for this earning event?
 */
export function shouldShowEarningToast(
  phase: TenurePhase,
  ipAmount: number,
  sourceType: string
): boolean {
  // These always show regardless of phase (milestones, achievements, tiers)
  const alwaysShowTypes = [
    "streak_milestone",
    "tier_advance",
    "achievement_earned",
    "insight_spark",
  ];

  if (phase === "scaffolding") return true; // Show everything
  if (alwaysShowTypes.includes(sourceType)) return true;

  if (phase === "forming") return ipAmount >= 50;

  // Intrinsic: only milestone/achievement types (handled above)
  return false;
}

/**
 * §8.3 — CSS data attributes for the dashboard container.
 * Apply to the top-level dashboard wrapper:
 * <div data-tenure={phase} ...>
 */
export function getTenureDataAttributes(phase: TenurePhase): Record<string, string> {
  return {
    "data-tenure": phase,
  };
}

/**
 * §8.3 — Whether "Ways to Earn" should be expanded by default.
 */
export function shouldExpandWaysToEarn(phase: TenurePhase): boolean {
  return phase === "scaffolding";
}

/**
 * §8.3 — Whether the IP counter should have a glow animation.
 */
export function shouldGlowIPCounter(phase: TenurePhase): boolean {
  return phase === "scaffolding";
}

/**
 * §8.3 — Whether learning stats should be shown prominently.
 */
export function shouldShowLearningStatsFirst(phase: TenurePhase): boolean {
  return phase === "forming" || phase === "intrinsic";
}
