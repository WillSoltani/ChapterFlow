import type { BadgeProgressStats } from "@/app/book/badges/lib/badge-ui-definitions";

// Categories mirror the canonical catalog (badge-ui-definitions.ts BadgeCategory).
export type BadgeCategory =
  | "Getting Started"
  | "Consistency"
  | "Reading Depth"
  | "Mastery"
  | "Books"
  | "Examples"
  | "Notes"
  | "Exploration"
  | "Elite";

export type BadgeTier = "bronze" | "silver" | "gold" | "platinum" | "unique" | "secret";

export type BadgeCriteria = {
  type: "count" | "streak" | "score" | "boolean" | "compound";
  description: string;
  target: number;
};

export type Badge = {
  id: string;
  name: string;
  description: string;
  narrative: string;
  category: BadgeCategory;
  tier: BadgeTier;
  /** lucide-react icon name (carried from BadgeDefinition.icon); resolved via BADGE_ICONS. */
  icon: string;
  fpValue: number;
  isSecret: boolean;
  criteria: BadgeCriteria;
  relatedBadgeIds: string[];
  tieredProgression?: {
    currentTier: BadgeTier;
    nextTier?: BadgeTier | undefined;
    nextTierTarget?: number | undefined;
    nextTierBadgeId?: string | undefined;
  } | undefined;
  evaluate: (stats: BadgeProgressStats) => { current: number; target: number };
};

export type BadgeWithProgress = Badge & {
  isEarned: boolean;
  earnedDate: string | null;
  isDiscovered: boolean;
  current: number;
  target: number;
  percentage: number;
};

export type UserAchievementProfile = {
  totalEarned: number;
  totalAvailable: number;
  totalFP: number;
  level: number;
  levelName: string;
  levelProgress: number;
  fpToNextLevel: number;
  nearlyUnlockedCount: number;
  showcaseBadgeIds: string[];
};

export type SeasonalChallenge = {
  id: string;
  title: string;
  description: string;
  /** Admin-authored event badge glyph (an emoji from EventDefinition.badge.icon),
   *  NOT a catalog badge — intentionally left as emoji, separate from the lucide
   *  achievements catalog. */
  badgeIcon: string;
  startDate: string;
  endDate: string;
  criteria: { description: string; target: number };
  progress: number;
};

export type BadgeCategoryGroup = {
  id: BadgeCategory;
  title: string;
  description: string;
  badges: BadgeWithProgress[];
};

export type BadgeFilter = "all" | "earned" | "locked" | BadgeCategory;

export type { BadgeProgressStats };
