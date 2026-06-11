// Consolidated achievement definitions — implements §4.1–4.4.
// Replaces the dual-file system (mockBadges.ts with .flowPoints + badge-data.ts with .fpValue).
// This is the single source of truth for all achievement metadata and IP values.

export type AchievementTrack = "mastery" | "consistency" | "exploration" | "hidden";

export interface AchievementDefinition {
  id: string;
  name: string;
  track: AchievementTrack;
  criteria: string;
  ipValue: number;
  celebrationCopy: string;
  isHidden: boolean;
}

// ── Mastery Track (§4.1) ───────────────────────────────────────────────────

const MASTERY_ACHIEVEMENTS: AchievementDefinition[] = [
  {
    id: "sharp-focus",
    name: "Sharp Focus",
    track: "mastery",
    criteria: "Score 100% on any quiz",
    ipValue: 20,
    celebrationCopy:
      "Perfect comprehension. Every concept, every nuance — you didn't miss a thing.",
    isHidden: false,
  },
  {
    id: "precision-reader",
    name: "Precision Reader",
    track: "mastery",
    criteria: "Average ≥ 85% across 10 completed chapters",
    ipValue: 40,
    celebrationCopy:
      "Consistent excellence across ten chapters. You don't just read — you understand.",
    isHidden: false,
  },
  {
    id: "challenge-accepted",
    name: "Challenge Accepted",
    track: "mastery",
    criteria: "Complete 10 learning loops in Challenge mode",
    ipValue: 60,
    celebrationCopy:
      "Ten chapters under the hardest conditions. You chose difficulty, and you met it.",
    isHidden: false,
  },
  {
    id: "flawless-run",
    name: "Flawless Run",
    track: "mastery",
    criteria: "Score 100% on 5 different chapter quizzes",
    ipValue: 80,
    celebrationCopy:
      "Five perfect scores. This level of comprehension is genuinely rare.",
    isHidden: false,
  },
  {
    id: "challenge-mastery",
    name: "Challenge Mastery",
    track: "mastery",
    criteria: "Complete every chapter of a book in Challenge mode",
    ipValue: 120,
    celebrationCopy:
      "An entire book in Challenge mode. That takes more than ability — it takes resolve.",
    isHidden: false,
  },
];

// ── Consistency Track (§4.2) ───────────────────────────────────────────────

const CONSISTENCY_ACHIEVEMENTS: AchievementDefinition[] = [
  {
    id: "first-spark",
    name: "First Spark",
    track: "consistency",
    criteria: "Reach a 3-day streak",
    ipValue: 15,
    celebrationCopy:
      "Three days in a row. Every lasting habit starts exactly like this.",
    isHidden: false,
  },
  {
    id: "weekly-rhythm",
    name: "Weekly Rhythm",
    track: "consistency",
    criteria: "Reach a 7-day streak",
    ipValue: 30,
    celebrationCopy:
      "One full week of choosing to learn. The rhythm is real now.",
    isHidden: false,
  },
  {
    id: "monthly-discipline",
    name: "Monthly Discipline",
    track: "consistency",
    criteria: "Reach a 30-day streak",
    ipValue: 75,
    celebrationCopy:
      "Thirty days. The research is clear — this is a habit, not a streak.",
    isHidden: false,
  },
  {
    id: "centurion",
    name: "Centurion",
    track: "consistency",
    criteria: "Reach a 100-day streak",
    ipValue: 200,
    celebrationCopy:
      "One hundred days. Most people set goals. You built a practice.",
    isHidden: false,
  },
  {
    id: "year-of-insight",
    name: "Year of Insight",
    track: "consistency",
    criteria: "Reach a 365-day streak",
    ipValue: 500,
    celebrationCopy:
      "Three hundred sixty-five days. A full year of deliberate curiosity. Extraordinary.",
    isHidden: false,
  },
  {
    id: "steady-state",
    name: "Steady State",
    track: "consistency",
    criteria: "Maintain 80%+ consistency score for 60 consecutive days",
    ipValue: 50,
    celebrationCopy:
      "Sixty days above eighty percent. You don't need a perfect streak — you just keep showing up.",
    isHidden: false,
  },
];

// ── Exploration Track (§4.3) ───────────────────────────────────────────────

const EXPLORATION_ACHIEVEMENTS: AchievementDefinition[] = [
  {
    id: "curious-mind",
    name: "Curious Mind",
    track: "exploration",
    criteria: "Complete loops in 3 different categories",
    ipValue: 25,
    celebrationCopy:
      "Three different domains. Curiosity doesn't stay in one lane — neither do you.",
    isHidden: false,
  },
  {
    id: "cross-disciplinary",
    name: "Cross-Disciplinary",
    track: "exploration",
    criteria: "Complete loops in 6 different categories",
    ipValue: 50,
    celebrationCopy:
      "Six categories. You're building the kind of broad foundation that makes deep work possible.",
    isHidden: false,
  },
  {
    id: "renaissance-reader",
    name: "Renaissance Reader",
    track: "exploration",
    criteria: "Complete loops in 8 different categories",
    ipValue: 80,
    celebrationCopy:
      "Eight domains. The connections between fields — that's where the real insights live.",
    isHidden: false,
  },
  {
    id: "omnivore",
    name: "Omnivore",
    track: "exploration",
    criteria: "Complete loops in 10+ different categories",
    ipValue: 150,
    celebrationCopy:
      "Ten categories. Very few readers venture this wide. The mental models you're accumulating are compounding.",
    isHidden: false,
  },
  {
    id: "bridge-builder",
    name: "Bridge Builder",
    track: "exploration",
    criteria: "Complete 3 entire books in 3 different categories",
    ipValue: 60,
    celebrationCopy:
      "Three books across three domains. You don't just sample — you finish.",
    isHidden: false,
  },
];

// ── Hidden Track (§4.4) ────────────────────────────────────────────────────

const HIDDEN_ACHIEVEMENTS: AchievementDefinition[] = [
  {
    id: "night-owl",
    name: "Night Owl",
    track: "hidden",
    criteria: "Complete 5 learning loops between 10pm and 5am",
    ipValue: 30,
    celebrationCopy:
      "Discovery: Night Owl. Some of the best thinking happens when the world is quiet.",
    isHidden: true,
  },
  {
    id: "dawn-reader",
    name: "Dawn Reader",
    track: "hidden",
    criteria: "Complete 5 learning loops between 5am and 7am",
    ipValue: 30,
    celebrationCopy:
      "Discovery: Dawn Reader. Starting the day with learning — there's something powerful in that.",
    isHidden: true,
  },
  {
    id: "weekend-scholar",
    name: "Weekend Scholar",
    track: "hidden",
    criteria: "Complete loops on 8 consecutive weekend days",
    ipValue: 40,
    celebrationCopy:
      "Discovery: Weekend Scholar. While others rest, you chose to grow.",
    isHidden: true,
  },
  {
    id: "marathon-session",
    name: "Marathon Session",
    track: "hidden",
    criteria: "Complete 5 learning loops in a single calendar day",
    ipValue: 35,
    celebrationCopy:
      "Discovery: Marathon Session. Five chapters in one sitting — that's genuine immersion.",
    isHidden: true,
  },
  {
    id: "full-circle",
    name: "Full Circle",
    track: "hidden",
    criteria: "Finish a book that was started more than 90 days ago",
    ipValue: 45,
    celebrationCopy:
      "Discovery: Full Circle. You came back and finished what you started. Most people don't.",
    isHidden: true,
  },
  {
    id: "second-wind",
    name: "Second Wind",
    track: "hidden",
    criteria: "Complete a learning loop after 14+ consecutive days of inactivity",
    ipValue: 25,
    celebrationCopy:
      "Discovery: Second Wind. Coming back is harder than starting. Welcome back.",
    isHidden: true,
  },
  {
    id: "century-loop",
    name: "Century Loop",
    track: "hidden",
    criteria: "Complete the 100th learning loop",
    ipValue: 50,
    celebrationCopy:
      "Discovery: Century Loop. One hundred chapters of genuine understanding. Milestone unlocked.",
    isHidden: true,
  },
];

// ── Combined Exports ───────────────────────────────────────────────────────

export const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  ...MASTERY_ACHIEVEMENTS,
  ...CONSISTENCY_ACHIEVEMENTS,
  ...EXPLORATION_ACHIEVEMENTS,
  ...HIDDEN_ACHIEVEMENTS,
];

export function getAchievementById(
  achievementId: string
): AchievementDefinition | null {
  return ACHIEVEMENT_DEFINITIONS.find((a) => a.id === achievementId) ?? null;
}

export function getAchievementIPValue(achievementId: string): number {
  return getAchievementById(achievementId)?.ipValue ?? 0;
}

export function getAchievementName(achievementId: string): string | null {
  return getAchievementById(achievementId)?.name ?? null;
}

export function getAchievementsByTrack(
  track: AchievementTrack
): AchievementDefinition[] {
  return ACHIEVEMENT_DEFINITIONS.filter((a) => a.track === track);
}

export const MASTERY_TRACK = MASTERY_ACHIEVEMENTS;
export const CONSISTENCY_TRACK = CONSISTENCY_ACHIEVEMENTS;
export const EXPLORATION_TRACK = EXPLORATION_ACHIEVEMENTS;
export const HIDDEN_TRACK = HIDDEN_ACHIEVEMENTS;
