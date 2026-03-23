"use client";

import Link from "next/link";
import type { BadgeWithProgress } from "../lib/badge-types";

type BadgeRecommendationsProps = {
  recommendations: BadgeWithProgress[];
  onBadgeClick: (badge: BadgeWithProgress) => void;
  allEarned: boolean;
};

function getCtaHref(badge: BadgeWithProgress): string {
  switch (badge.category) {
    case "consistency":
      return "/book/workspace";
    case "mastery":
      return "/book/workspace";
    case "books":
      return "/book/library";
    case "exploration":
      return "/book/library";
    case "notes":
      return "/book/workspace";
    default:
      return "/book/library";
  }
}

function getEstimateText(badge: BadgeWithProgress): string {
  const remaining = badge.target - badge.current;
  if (remaining <= 0) return "Almost there!";

  if (badge.criteria.type === "streak") {
    return `~${remaining} more reading ${remaining === 1 ? "day" : "days"}`;
  }
  if (badge.category === "mastery") {
    if (badge.id.includes("quiz") || badge.id.includes("examiner") || badge.id.includes("proof")) {
      return `~${remaining} more ${remaining === 1 ? "quiz" : "quizzes"}`;
    }
    if (badge.id.includes("answer")) return `~${remaining} more answers`;
    if (badge.id.includes("focus")) return `~${remaining} more chapters`;
    return `~${remaining} more to go`;
  }
  if (badge.category === "books") {
    return `~${remaining} more ${remaining === 1 ? "book" : "books"} to finish`;
  }
  if (badge.category === "notes") {
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
        <div className="mt-4 rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] px-5 py-8 text-center backdrop-blur-xl">
          <p className="text-lg font-semibold text-amber-500">
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

      <div className="hide-scrollbar -mx-4 mt-4 flex gap-3 overflow-x-auto px-4 pb-1 snap-x sm:mx-0 sm:px-0">
        {recommendations.map((badge) => {
          const message = getProgressMessage(badge);
          const ctaHref = getCtaHref(badge);

          return (
            <div
              key={badge.id}
              className="group flex w-65 shrink-0 snap-start flex-col rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] p-4 text-left backdrop-blur-xl transition hover:border-[rgba(255,255,255,0.1)]"
              style={{ borderTopWidth: 2, borderTopColor: "#f59e0b" }}
            >
              <button
                type="button"
                onClick={() => onBadgeClick(badge)}
                className="flex flex-1 flex-col text-left"
              >
                <div className="relative">
                  <span
                    className="text-[48px] leading-none"
                    style={{
                      maskImage: "linear-gradient(to bottom, black 60%, transparent 100%)",
                      WebkitMaskImage: "linear-gradient(to bottom, black 60%, transparent 100%)",
                    }}
                  >
                    {badge.icon}
                  </span>
                </div>

                <h3 className="mt-2 text-sm font-semibold text-amber-500">{badge.name}</h3>

                <div className="mt-3 w-full">
                  <div className="h-1.5 overflow-hidden rounded-full bg-[rgba(255,255,255,0.08)]">
                    <div
                      className="h-full rounded-full bg-amber-500 transition-[width] duration-500"
                      style={{ width: `${Math.max(4, badge.percentage)}%` }}
                    />
                  </div>
                  {badge.percentage >= 30 && (
                    <p className="mt-1.5 text-xs text-neutral-400">
                      {badge.current} of {badge.target}
                    </p>
                  )}
                </div>

                <p className="mt-2 text-xs text-neutral-500">{message}</p>
              </button>

              <Link
                href={ctaHref}
                className="mt-auto block pt-3 text-xs font-medium text-amber-500/80 underline-offset-2 transition hover:text-amber-500 hover:underline group-hover:translate-y-[-1px]"
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
