import type {
  BadgeCategory,
  BadgeCategoryGroup,
  BadgeFilter,
  BadgeTier,
  BadgeWithProgress,
  UserAchievementProfile,
} from "./badge-types";
import type { BadgeState } from "./badge-ui-definitions";

// ── Level system ────────────────────────────────────────────────────────────

type LevelEntry = { level: number; name: string; fpThreshold: number };

const LEVELS: LevelEntry[] = [
  { level: 1, name: "Newcomer", fpThreshold: 0 },
  { level: 2, name: "Reader", fpThreshold: 50 },
  { level: 3, name: "Thinker", fpThreshold: 100 },
  { level: 4, name: "Scholar", fpThreshold: 200 },
  { level: 5, name: "Sage", fpThreshold: 350 },
  { level: 6, name: "Luminary", fpThreshold: 550 },
  { level: 7, name: "Polymath", fpThreshold: 800 },
  { level: 8, name: "Oracle", fpThreshold: 1100 },
  { level: 9, name: "Philosopher", fpThreshold: 1500 },
  { level: 10, name: "Grandmaster", fpThreshold: 2000 },
];

export function getLevel(fp: number) {
  let current = LEVELS[0];
  for (const level of LEVELS) {
    if (fp >= level.fpThreshold) current = level;
    else break;
  }
  const next = LEVELS.find((l) => l.fpThreshold > current.fpThreshold);
  const fpInCurrentLevel = fp - current.fpThreshold;
  const fpToNextLevel = next ? next.fpThreshold - current.fpThreshold : 0;
  const progress = fpToNextLevel > 0 ? Math.min(100, Math.round((fpInCurrentLevel / fpToNextLevel) * 100)) : 100;

  return {
    level: current.level,
    name: current.name,
    progress,
    fpToNextLevel: next ? next.fpThreshold - fp : 0,
    nextLevelName: next?.name ?? null,
  };
}

// ── Canonical catalog adapter ───────────────────────────────────────────────
// badge-ui-definitions.ts is the single source of truth for badges; it is
// evaluated against server-truth earned state by useBadgeSystem (which fetches
// /me/badges and honors earnedAt). This adapter reshapes a materialized
// BadgeState into the BadgeWithProgress contract the /book/badges component
// tree consumes, so one catalog feeds the dashboard, profile, and this page.

function deriveTier(badge: BadgeState): BadgeTier {
  if (badge.tier) return badge.tier.toLowerCase() as BadgeTier;
  if (badge.prestige >= 4) return "platinum";
  if (badge.prestige === 3) return "gold";
  if (badge.prestige === 2) return "silver";
  return "bronze";
}

export function badgeStateToBadgeWithProgress(badge: BadgeState): BadgeWithProgress {
  const current = badge.progressValue;
  const target = badge.targetValue;
  const percentage = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  const isSecret = Boolean(badge.hiddenUntilDiscovered);
  const isDiscovered = !isSecret || badge.earned || Boolean(badge.earnedAt) || current > 0;
  const tier = deriveTier(badge);

  return {
    id: badge.id,
    name: badge.name,
    description: badge.description,
    narrative: badge.whyItMatters,
    category: badge.category,
    tier,
    icon: badge.icon,
    fpValue: badge.flowPoints,
    isSecret,
    criteria: { type: "count", description: badge.howToEarn, target },
    relatedBadgeIds: badge.nextTierId ? [badge.nextTierId] : [],
    tieredProgression: badge.nextTierId
      ? { currentTier: tier, nextTierBadgeId: badge.nextTierId }
      : undefined,
    evaluate: () => ({ current, target }),
    isEarned: badge.earned,
    earnedDate: badge.earnedAt,
    isDiscovered,
    current,
    target,
    percentage,
  };
}

// ── Profile computation ─────────────────────────────────────────────────────

export function computeProfile(
  badges: BadgeWithProgress[],
  showcaseBadgeIds: string[]
): UserAchievementProfile {
  const nonSecret = badges.filter((b) => !b.isSecret);
  const earned = badges.filter((b) => b.isEarned);
  const totalFP = earned.reduce((sum, b) => sum + b.fpValue, 0);
  const levelInfo = getLevel(totalFP);
  const nearlyUnlocked = badges.filter((b) => !b.isEarned && b.percentage >= 60);

  return {
    totalEarned: earned.length,
    totalAvailable: nonSecret.length,
    totalFP,
    level: levelInfo.level,
    levelName: levelInfo.name,
    levelProgress: levelInfo.progress,
    fpToNextLevel: levelInfo.fpToNextLevel,
    nearlyUnlockedCount: nearlyUnlocked.length,
    showcaseBadgeIds,
  };
}

// ── Category metadata (canonical 9 categories) ──────────────────────────────

export const CATEGORY_ORDER: BadgeCategory[] = [
  "Getting Started",
  "Consistency",
  "Reading Depth",
  "Mastery",
  "Books",
  "Examples",
  "Notes",
  "Exploration",
  "Elite",
];

export const CATEGORY_META: Record<BadgeCategory, { title: string; description: string }> = {
  "Getting Started": {
    title: "Getting Started",
    description: "Early wins that turn setup into real reading momentum.",
  },
  Consistency: {
    title: "Consistency & Streaks",
    description: "Building the rhythm of a reading life.",
  },
  "Reading Depth": {
    title: "Reading Depth",
    description: "Moving beyond quick skims into stronger engagement and retention.",
  },
  Mastery: {
    title: "Mastery & Depth",
    description: "Performance and review milestones that reflect real understanding.",
  },
  Books: {
    title: "Books & Completion",
    description: "Finishing what you start — the hardest part.",
  },
  Examples: {
    title: "Examples & Application",
    description: "Putting ideas to work in personal, school, and work contexts.",
  },
  Notes: {
    title: "Notes & Reflection",
    description: "The quiet work that makes reading stick.",
  },
  Exploration: {
    title: "Exploration & Discovery",
    description: "Expanding the boundaries of what you read.",
  },
  Elite: {
    title: "Elite",
    description: "Subtle markers that reward advanced usage without punishing free readers.",
  },
};

export const FILTER_OPTIONS: { value: BadgeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "earned", label: "Earned" },
  { value: "locked", label: "Locked" },
  { value: "Getting Started", label: "Getting Started" },
  { value: "Consistency", label: "Consistency" },
  { value: "Reading Depth", label: "Depth" },
  { value: "Mastery", label: "Mastery" },
  { value: "Books", label: "Books" },
  { value: "Examples", label: "Examples" },
  { value: "Notes", label: "Notes" },
  { value: "Exploration", label: "Exploration" },
  { value: "Elite", label: "Elite" },
];

// ── Category grouping ───────────────────────────────────────────────────────

export function groupByCategory(badges: BadgeWithProgress[]): BadgeCategoryGroup[] {
  return CATEGORY_ORDER.map((id) => {
    const meta = CATEGORY_META[id];
    return {
      id,
      title: meta.title,
      description: meta.description,
      badges: badges.filter((b) => b.category === id),
    };
  }).filter((g) => g.badges.length > 0);
}

// ── Filtering ───────────────────────────────────────────────────────────────

export function filterBadges(badges: BadgeWithProgress[], filter: BadgeFilter): BadgeWithProgress[] {
  switch (filter) {
    case "all":
      return badges;
    case "earned":
      return badges.filter((b) => b.isEarned);
    case "locked":
      return badges.filter((b) => !b.isEarned);
    default:
      return badges.filter((b) => b.category === filter);
  }
}

// ── Recommendations ─────────────────────────────────────────────────────────

export function getRecommendations(badges: BadgeWithProgress[], count = 3): BadgeWithProgress[] {
  const candidates = badges
    .filter((b) => !b.isEarned && !b.isSecret)
    .sort((a, b) => b.percentage - a.percentage);

  const primary = candidates.filter((b) => b.percentage >= 40).slice(0, count);
  if (primary.length >= count) return primary;

  const remaining = candidates
    .filter((b) => !primary.includes(b))
    .slice(0, count - primary.length);

  return [...primary, ...remaining];
}

// ── Default open category ───────────────────────────────────────────────────

export function getDefaultOpenCategory(groups: BadgeCategoryGroup[]): string | null {
  let bestCategory: string | null = null;
  let bestCount = -1;

  for (const group of groups) {
    const almostCount = group.badges.filter((b) => !b.isEarned && b.percentage >= 60).length;
    if (almostCount > bestCount) {
      bestCount = almostCount;
      bestCategory = group.id;
    }
  }

  return bestCategory ?? groups[0]?.id ?? null;
}

// ── Progress text ───────────────────────────────────────────────────────────

export function getProgressText(badge: BadgeWithProgress): string {
  if (badge.isEarned) return "Earned";
  if (badge.current === 0) return "Start your journey \u2192";
  if (badge.percentage <= 15) return `${badge.current} of ${badge.target} \u2014 Just getting started`;
  return `${badge.current} of ${badge.target}`;
}

// ── Showcase storage ────────────────────────────────────────────────────────

const SHOWCASE_KEY = "cf:badge-showcase-v1";
const MAX_SHOWCASE = 5;

export function getShowcaseBadgeIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SHOWCASE_KEY);
    return raw ? (JSON.parse(raw) as string[]).slice(0, MAX_SHOWCASE) : [];
  } catch {
    return [];
  }
}

export function toggleShowcaseBadge(badgeId: string): string[] {
  const current = getShowcaseBadgeIds();
  const idx = current.indexOf(badgeId);
  let next: string[];
  if (idx >= 0) {
    next = current.filter((id) => id !== badgeId);
  } else if (current.length < MAX_SHOWCASE) {
    next = [...current, badgeId];
  } else {
    return current;
  }
  window.localStorage.setItem(SHOWCASE_KEY, JSON.stringify(next));
  return next;
}

// ── Last-seen timestamp (for celebration gating) ────────────────────────────

const LAST_SEEN_KEY = "cf:badges-last-seen";

export function getLastSeenTimestamp(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(LAST_SEEN_KEY);
}

export function setLastSeenTimestamp(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LAST_SEEN_KEY, new Date().toISOString());
}

// ── Tier border colors (inline styles) ──────────────────────────────────────

export const TIER_BORDER_COLORS: Record<BadgeTier, string> = {
  bronze: "#cd7f32",
  silver: "#c0c0c0",
  gold: "#ffd700",
  platinum: "#8b7dff",
  unique: "#f59e0b",
  secret: "#8b5cf6",
};

export const TIER_GLOW_STYLES: Record<BadgeTier, string> = {
  bronze: "0 0 20px rgba(205,127,50,0.08), inset 0 1px 0 rgba(205,127,50,0.1)",
  silver: "0 0 20px rgba(192,192,192,0.08), inset 0 1px 0 rgba(192,192,192,0.1)",
  gold: "0 0 20px rgba(255,215,0,0.1), inset 0 1px 0 rgba(255,215,0,0.12)",
  platinum: "0 0 25px rgba(139,125,255,0.1), inset 0 1px 0 rgba(139,125,255,0.12)",
  unique: "0 0 15px rgba(245,158,11,0.07), inset 0 1px 0 rgba(245,158,11,0.08)",
  secret: "0 0 20px rgba(139,92,246,0.1), inset 0 1px 0 rgba(139,92,246,0.1)",
};

// ── Metallic tier pill styles (inline) ──────────────────────────────────────

export const TIER_PILL_STYLES: Record<BadgeTier, { background: string; color: string; textShadow: string }> = {
  bronze: {
    background: "linear-gradient(135deg, #CD7F32, #E8A862)",
    color: "#1a0f00",
    textShadow: "0 1px 0 rgba(255,200,120,0.3)",
  },
  silver: {
    background: "linear-gradient(135deg, #C0C0C0, #E8E8E8)",
    color: "#1a1a1a",
    textShadow: "0 1px 0 rgba(255,255,255,0.4)",
  },
  gold: {
    background: "linear-gradient(135deg, #FFD700, #FFF0A0)",
    color: "#1a1200",
    textShadow: "0 1px 0 rgba(255,240,150,0.4)",
  },
  platinum: {
    background: "linear-gradient(135deg, #E5E4E2, #FFFFFF)",
    color: "#1a1a2e",
    textShadow: "0 1px 0 rgba(200,180,255,0.4)",
  },
  unique: {
    background: "linear-gradient(135deg, #8B5CF6, #EC4899)",
    color: "#ffffff",
    textShadow: "0 1px 0 rgba(139,92,246,0.3)",
  },
  secret: {
    background: "linear-gradient(135deg, #8B5CF6, #EC4899)",
    color: "#ffffff",
    textShadow: "0 1px 0 rgba(139,92,246,0.5)",
  },
};
