// PROG-11: journey and event completion badges. The server stores them in
// /me/badges with the ids from content/journeys/journeys.json and
// content/events/events.json; the regular badge catalog does not know them.

import journeys from "@/content/journeys/journeys.json";
import events from "@/content/events/events.json";

export type SpecialBadge = {
  id: string;
  name: string;
  /** Lucide icon name for BADGE_ICONS (falls back to the trophy). */
  icon: string;
  source: "journey" | "event";
  sourceTitle: string;
  earnedAt: string;
};

type BadgeBlock = { badgeId?: unknown; name?: unknown; icon?: unknown };
type ContentItem = { title?: unknown; badge?: BadgeBlock | null };

function iconName(icon: unknown): string {
  if (typeof icon !== "string" || !icon) return "";
  return icon.charAt(0).toUpperCase() + icon.slice(1);
}

function catalogFrom(items: unknown, source: SpecialBadge["source"]) {
  if (!Array.isArray(items)) return [];
  return (items as ContentItem[]).flatMap((item) => {
    const badge = item.badge;
    if (!badge || typeof badge.badgeId !== "string" || typeof badge.name !== "string") return [];
    return [{
      id: badge.badgeId,
      name: badge.name,
      icon: iconName(badge.icon),
      source,
      sourceTitle: typeof item.title === "string" ? item.title : "",
    }];
  });
}

export const SPECIAL_BADGE_CATALOG: ReadonlyArray<Omit<SpecialBadge, "earnedAt">> = [
  ...catalogFrom(journeys, "journey"),
  ...catalogFrom(events, "event"),
];

/** Awards from /me/badges that are journey or event badges, newest first. */
export function buildSpecialBadges(
  awards: ReadonlyArray<{ badgeId: string; earnedAt: string }>,
  catalog: ReadonlyArray<Omit<SpecialBadge, "earnedAt">> = SPECIAL_BADGE_CATALOG
): SpecialBadge[] {
  const byId = new Map(catalog.map((entry) => [entry.id, entry]));
  const earned = new Map<string, SpecialBadge>();
  for (const award of awards) {
    const entry = byId.get(award.badgeId);
    if (!entry || earned.has(entry.id)) continue;
    earned.set(entry.id, { ...entry, earnedAt: award.earnedAt });
  }
  return [...earned.values()].sort(
    (a, b) => new Date(b.earnedAt).getTime() - new Date(a.earnedAt).getTime()
  );
}
