import type {
  Badge,
  BadgeCategoryGroup,
  BadgeFilter,
  BadgeProgressStats,
  BadgeTier,
  BadgeWithProgress,
  UserAchievementProfile,
} from "./badge-types";
import { BADGE_DEFINITIONS, CATEGORY_META, CATEGORY_ORDER } from "./badge-data";

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

// ── Badge evaluation ────────────────────────────────────────────────────────

export function evaluateBadges(
  stats: BadgeProgressStats,
  earnedHistory: Record<string, string>
): BadgeWithProgress[] {
  return BADGE_DEFINITIONS.map((badge) => {
    const { current, target } = badge.evaluate(stats);
    const isEarned = current >= target;
    const percentage = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
    const isDiscovered = badge.isSecret ? isEarned || Boolean(earnedHistory[badge.id]) : true;

    return {
      ...badge,
      isEarned,
      earnedDate: earnedHistory[badge.id] ?? null,
      isDiscovered,
      current,
      target,
      percentage,
    };
  });
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

// ── Tier colors ─────────────────────────────────────────────────────────────

export const TIER_COLORS: Record<BadgeTier, { bg: string; text: string; glow: string; gradient: string }> = {
  bronze: {
    bg: "bg-[#cd7f32]/20",
    text: "text-[#cd7f32]",
    glow: "shadow-[0_0_15px_rgba(205,127,50,0.12)]",
    gradient: "from-[#cd7f32] to-[#a0622a]",
  },
  silver: {
    bg: "bg-[#c0c0c0]/20",
    text: "text-[#c0c0c0]",
    glow: "shadow-[0_0_15px_rgba(192,192,192,0.12)]",
    gradient: "from-[#c0c0c0] to-[#a8a8a8]",
  },
  gold: {
    bg: "bg-[#ffd700]/20",
    text: "text-[#ffd700]",
    glow: "shadow-[0_0_15px_rgba(255,215,0,0.15)]",
    gradient: "from-[#ffd700] to-[#e6c200]",
  },
  platinum: {
    bg: "bg-[#8b7dff]/20",
    text: "text-[#8b7dff]",
    glow: "shadow-[0_0_20px_rgba(139,125,255,0.15)]",
    gradient: "from-[#e5e4e2] via-[#8b7dff] to-[#e5e4e2]",
  },
  unique: {
    bg: "bg-accent-amber/20",
    text: "text-accent-amber",
    glow: "shadow-[0_0_12px_rgba(245,158,11,0.1)]",
    gradient: "from-accent-amber to-accent-amber",
  },
  secret: {
    bg: "bg-accent-violet/20",
    text: "text-accent-violet",
    glow: "shadow-[0_0_12px_rgba(139,92,246,0.1)]",
    gradient: "from-accent-violet to-accent-violet",
  },
};

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

// ── Earned history storage ──────────────────────────────────────────────────

const EARNED_KEY = "cf:badge-earned-v2";

export function getEarnedHistory(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(EARNED_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function persistEarnedBadge(badgeId: string, earnedAt: string): void {
  const history = getEarnedHistory();
  if (history[badgeId]) return;
  history[badgeId] = earnedAt;
  window.localStorage.setItem(EARNED_KEY, JSON.stringify(history));
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

// ── Rarity (mock) ───────────────────────────────────────────────────────────

export function getBadgeRarity(badge: BadgeWithProgress): number {
  if (!badge.isEarned) return 0;
  const base = badge.tier === "platinum" ? 2 : badge.tier === "gold" ? 8 : badge.tier === "silver" ? 18 : 34;
  const jitter = ((badge.id.charCodeAt(0) * 7 + badge.id.charCodeAt(1) * 3) % 20) - 10;
  return Math.max(1, Math.min(95, base + jitter));
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
