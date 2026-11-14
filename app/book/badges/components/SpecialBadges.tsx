"use client";

import type { SpecialBadge } from "../lib/special-badges";
import { BADGE_ICONS, FALLBACK_BADGE_ICON } from "../lib/badge-ui-definitions";

/** PROG-11: journey and event completion badges, shown once earned. */
export function SpecialBadges({ badges }: { badges: SpecialBadge[] }) {
  if (badges.length === 0) return null;
  return (
    <section aria-labelledby="special-badges-heading">
      <h2 id="special-badges-heading" className="text-base font-semibold tracking-tight text-(--cf-text-1)">
        Special
      </h2>
      <p className="mt-1 text-sm text-(--cf-text-3)">Earned by finishing journeys and events.</p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {badges.map((badge) => {
          const Icon = BADGE_ICONS[badge.icon] ?? FALLBACK_BADGE_ICON;
          return (
            <li
              key={badge.id}
              className="flex items-start gap-3 rounded-2xl border border-(--cf-border) bg-(--cf-surface-muted) p-4"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-(--cf-border) bg-(--cf-surface)">
                <Icon className="h-5 w-5" style={{ color: "var(--accent-amber)" }} aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-(--cf-text-1)">{badge.name}</p>
                <p className="mt-0.5 text-xs text-(--cf-text-3)">
                  {badge.source === "journey" ? "Journey" : "Event"} · {badge.sourceTitle}
                </p>
                <p className="mt-0.5 text-xs text-(--cf-text-3)">
                  Earned{" "}
                  {new Date(badge.earnedAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
