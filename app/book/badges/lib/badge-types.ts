import type { BadgeProgressStats } from "@/app/book/data/mockBadges";

export type BadgeCategory = "consistency" | "mastery" | "books" | "exploration" | "notes" | "secret";

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
  icon: string;
  fpValue: number;
  isSecret: boolean;
  criteria: BadgeCriteria;
  relatedBadgeIds: string[];
  tieredProgression?: {
    currentTier: BadgeTier;
    nextTier?: BadgeTier;
    nextTierTarget?: number;
    nextTierBadgeId?: string;
  };
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
