"use client";

import { cn } from "@/app/book/components/ui/cn";
import type { UserAchievementProfile } from "../lib/badge-types";
import { ProgressRing } from "./ProgressRing";

type BadgePageHeaderProps = {
  profile: UserAchievementProfile;
};

export function BadgePageHeader({ profile }: BadgePageHeaderProps) {
  const progressPercent =
    profile.totalAvailable > 0
      ? Math.round((profile.totalEarned / profile.totalAvailable) * 100)
      : 0;

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight text-(--cf-text-1) sm:text-4xl">
        Achievements
      </h1>
      <p className="mt-2 text-sm leading-6 text-(--cf-text-3)">
        Every badge marks a real step in your reading journey.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {/* Earned stat */}
        <div className="flex items-center gap-3 rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] px-4 py-3.5 backdrop-blur-xl">
          <ProgressRing size={40} strokeWidth={3} progress={progressPercent} />
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-(--cf-text-soft)">Earned</p>
            <p className="mt-0.5 text-lg font-semibold text-amber-500">
              {profile.totalEarned}{" "}
              <span className="text-sm font-normal text-(--cf-text-soft)">/ {profile.totalAvailable}</span>
            </p>
          </div>
        </div>

        {/* Reader Level */}
        <div className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] px-4 py-3.5 backdrop-blur-xl">
          <p className="text-[11px] uppercase tracking-[0.2em] text-(--cf-text-soft)">Reader Level</p>
          <p className="mt-0.5 text-lg font-semibold text-(--cf-text-1)">
            Level {profile.level}{" "}
            <span className="text-sm font-normal text-(--cf-text-3)">&mdash; {profile.levelName}</span>
          </p>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-[rgba(255,255,255,0.08)]">
            <div
              className="h-full rounded-full bg-amber-500 transition-[width] duration-500"
              style={{ width: `${profile.levelProgress}%` }}
            />
          </div>
        </div>

        {/* Almost There */}
        <div className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] px-4 py-3.5 backdrop-blur-xl">
          <p className="text-[11px] uppercase tracking-[0.2em] text-(--cf-text-soft)">Almost There</p>
          <p className="mt-0.5 text-lg font-semibold text-(--cf-text-1)">
            {profile.nearlyUnlockedCount}{" "}
            <span className="text-sm font-normal text-(--cf-text-3)">
              {profile.nearlyUnlockedCount === 1 ? "badge" : "badges"} nearly unlocked
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
