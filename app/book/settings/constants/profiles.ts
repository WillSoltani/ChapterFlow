import type {
  ReadingProfilePreset,
  DailyGoalOption,
  MotivationOption,
} from "../types/settings";

export const READING_PROFILES: ReadingProfilePreset[] = [
  {
    id: "quick",
    label: "Quick Learner",
    emoji: "\u26A1",
    description: "Key takeaways, fast pace. Perfect for busy schedules.",
    tint: "from-amber-500/[0.07] to-orange-500/[0.03]",
    selectedTint: "border-amber-400/30 shadow-[0_0_20px_rgba(251,191,36,0.12)]",
    defaults: {
      learningStyle: "concise",
      quizStyle: "comfortable",
      dailyGoalPreset: 5,
      fontSize: 16,
    },
  },
  {
    id: "balanced",
    label: "Balanced Reader",
    emoji: "\uD83D\uDCDA",
    description: "The sweet spot between speed and depth.",
    tint: "from-blue-500/[0.07] to-cyan-500/[0.03]",
    selectedTint: "border-(--cf-accent)/30 shadow-[0_0_20px_var(--cf-accent-shadow)]",
    defaults: {
      learningStyle: "balanced",
      quizStyle: "challenge",
      dailyGoalPreset: 10,
      fontSize: 16,
    },
  },
  {
    id: "deep",
    label: "Deep Diver",
    emoji: "\uD83E\uDDE0",
    description: "Full detail, real challenge. Master every chapter.",
    tint: "from-purple-500/[0.07] to-indigo-500/[0.03]",
    selectedTint: "border-purple-400/30 shadow-[0_0_20px_rgba(168,85,247,0.12)]",
    defaults: {
      learningStyle: "deep",
      quizStyle: "surprise",
      dailyGoalPreset: 30,
      fontSize: 18,
    },
  },
];

export const DAILY_GOAL_OPTIONS: DailyGoalOption[] = [
  {
    value: 5,
    emoji: "\u2615",
    label: "Casual",
    subtext: "A quick chapter over coffee",
    tint: "from-slate-400/[0.05] to-gray-500/[0.02]",
    selectedTint: "border-gray-400/30 shadow-[0_0_15px_rgba(156,163,175,0.10)]",
  },
  {
    value: 10,
    emoji: "\uD83D\uDCD6",
    label: "Regular",
    subtext: "Build a steady habit",
    tint: "from-cyan-500/[0.07] to-blue-500/[0.03]",
    selectedTint: "border-(--cf-accent)/30 shadow-[0_0_20px_var(--cf-accent-shadow)]",
    recommended: true,
  },
  {
    value: 20,
    emoji: "\uD83D\uDCAA",
    label: "Committed",
    subtext: "Real progress, every day",
    tint: "from-amber-500/[0.07] to-orange-500/[0.03]",
    selectedTint: "border-amber-400/30 shadow-[0_0_20px_rgba(251,191,36,0.12)]",
  },
  {
    value: 30,
    emoji: "\uD83D\uDD25",
    label: "Intense",
    subtext: "For the truly dedicated",
    tint: "from-red-500/[0.07] to-orange-500/[0.03]",
    selectedTint: "border-red-400/30 shadow-[0_0_20px_rgba(248,113,113,0.12)]",
  },
];

export const MOTIVATION_OPTIONS: MotivationOption[] = [
  {
    id: "coach",
    emoji: "\uD83C\uDF31",
    persona: "Personal Coach",
    description:
      "Warm encouragement. Celebrates effort, not just results.",
    tint: "from-emerald-500/[0.07] to-teal-500/[0.03]",
    selectedTint: "border-emerald-400/30 shadow-[0_0_20px_rgba(52,211,153,0.12)]",
  },
  {
    id: "partner",
    emoji: "\uD83D\uDCCB",
    persona: "Accountability Partner",
    description:
      "Straight talk. Clear progress updates and honest check-ins.",
    tint: "from-blue-500/[0.07] to-slate-500/[0.03]",
    selectedTint: "border-blue-400/30 shadow-[0_0_20px_rgba(96,165,250,0.12)]",
  },
  {
    id: "rival",
    emoji: "\u2694\uFE0F",
    persona: "Rival",
    description:
      "Competitive edge. Leaderboard energy and bold challenges.",
    tint: "from-red-500/[0.07] to-orange-500/[0.03]",
    selectedTint: "border-red-400/30 shadow-[0_0_20px_rgba(248,113,113,0.12)]",
  },
];
