"use client";

import Link from "next/link";
import type { BadgeWithProgress } from "../lib/badge-types";
import { BADGE_ICONS, FALLBACK_BADGE_ICON } from "../lib/badge-ui-definitions";

type BadgeRecommendationsProps = {
  recommendations: BadgeWithProgress[];
  onBadgeClick: (badge: BadgeWithProgress) => void;
  allEarned: boolean;
};

function getCtaHref(badge: BadgeWithProgress): string {
  switch (badge.category) {
    case "Books":
    case "Exploration":
    case "Examples":
      return "/book/library";
    default:
      return "/dashboard";
  }
}

function getEstimateText(badge: BadgeWithProgress): string {
  const remaining = badge.target - badge.current;
  if (remaining <= 0) return "Almost there!";

  if (badge.category === "Consistency") {
    return `~${remaining} more reading ${remaining === 1 ? "day" : "days"}`;
  }
  if (badge.category === "Mastery" || badge.category === "Reading Depth") {
    if (badge.id.includes("quiz") || badge.id.includes("perfect")) {
      return `~${remaining} more ${remaining === 1 ? "quiz" : "quizzes"}`;
    }
    if (badge.id.includes("answer")) return `~${remaining} more answers`;
    if (badge.id.includes("focus")) return `~${remaining} more chapters`;
    return `~${remaining} more to go`;
  }
  if (badge.category === "Books") {
    return `~${remaining} more ${remaining === 1 ? "book" : "books"} to finish`;
  }
  if (badge.category === "Notes") {
    return `~${remaining} more ${remaining === 1 ? "note" : "notes"}`;
  }
  return `~${remaining} more to go`;
}

function getProgressMessage(badge: BadgeWithProgress): string {
  if (badge.percentage >= 60) return getEstimateText(badge);
  if (badge.percentage >= 30) return "Keep going!";
  return "Building toward...";
}

export function BadgeRecommendations({
  recommendations,
  onBadgeClick,
  allEarned,
}: BadgeRecommendationsProps) {
  if (allEarned) {
    return (
      <div>
        <h2 className="text-base font-semibold tracking-tight text-(--cf-text-1)">Almost There</h2>
        <p className="mt-0.5 text-xs text-(--cf-text-soft)">Your nearest achievements</p>
        <div className="mt-4 rounded-2xl border border-(--cf-border) bg-(--cf-surface-muted) px-5 py-8 text-center backdrop-blur-xl">
          <p className="text-lg font-semibold text-accent-amber">
            You have earned every achievement. Legendary.
          </p>
        </div>
      </div>
    );
  }

  if (recommendations.length === 0) return null;

  return (
    <div>
      <h2 className="text-base font-semibold tracking-tight text-(--cf-text-1)">Almost There</h2>
      <p className="mt-0.5 text-xs text-(--cf-text-soft)">Your nearest achievements</p>

      <div className="scrollbar-hide -mx-4 mt-4 flex gap-3 overflow-x-auto px-4 pb-1 snap-x sm:mx-0 sm:px-0">
        {recommendations.map((badge) => {
          const message = getProgressMessage(badge);
          const ctaHref = getCtaHref(badge);
          const Icon = BADGE_ICONS[badge.icon] ?? FALLBACK_BADGE_ICON;

          return (
            <div
              key={badge.id}
              className="group flex w-65 shrink-0 snap-start flex-col rounded-2xl border border-(--cf-border) bg-(--cf-surface-muted) p-4 text-left backdrop-blur-xl transition hover:border-(--cf-border-strong)"
              style={{
                borderLeftWidth: 3,
                borderLeftColor: "var(--accent-amber)",
                ...(badge.target - badge.current <= 1 && badge.current > 0
                  ? {
                      boxShadow: "0 0 20px color-mix(in srgb, var(--accent-amber) 10%, transparent)",
                      animation: "badge-almost-pulse 1.5s ease-in-out 2",
                    }
                  : {}),
              }}
            >
              <button
                type="button"
                onClick={() => onBadgeClick(badge)}
                className="cf-pressable flex flex-1 flex-col text-left"
              >
                <div className="relative">
                  <Icon
                    className="h-12 w-12"
                    style={{
                      color: "var(--accent-amber)",
                      maskImage: "linear-gradient(to bottom, black 60%, transparent 100%)",
                      WebkitMaskImage: "linear-gradient(to bottom, black 60%, transparent 100%)",
                    }}
                    aria-hidden
                  />
                </div>

                <h3 className="mt-2 text-sm font-semibold" style={{ color: "var(--accent-amber)" }}>{badge.name}</h3>

                <div className="mt-3 w-full">
                  <div className="relative h-1.5 overflow-hidden rounded-full bg-(--cf-surface-strong)">
                    <div
                      className="h-full rounded-full transition-[width] duration-500"
                      style={{ width: `${Math.max(4, badge.percentage)}%`, background: "var(--accent-amber)" }}
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-(--cf-text-3)">
                    {badge.current} of {badge.target}
                  </p>
                </div>

                <p className="mt-2 text-xs font-bold" style={{ color: "var(--accent-amber)" }}>{message}</p>
              </button>

              <Link
                href={ctaHref}
                className="mt-auto block pt-3 text-xs font-medium underline-offset-2 transition hover:underline group-hover:translate-y-[-1px]"
                style={{ color: "var(--accent-cyan)" }}
              >
                Continue reading &rarr;
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
