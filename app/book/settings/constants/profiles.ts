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
    tint: "from-amber-500/[0.06] to-orange-500/[0.03]",
    selectedTint: "shadow-[0_0_15px_rgba(251,191,36,0.15)] border-amber-400/40",
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
    tint: "from-blue-500/[0.06] to-cyan-500/[0.03]",
    selectedTint: "shadow-[0_0_15px_rgba(34,211,238,0.15)] border-cyan-400/40",
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
    tint: "from-purple-500/[0.06] to-indigo-500/[0.03]",
    selectedTint: "shadow-[0_0_15px_rgba(168,85,247,0.15)] border-purple-400/40",
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
    tint: "from-gray-500/[0.04] to-gray-400/[0.02]",
    selectedTint: "shadow-[0_0_12px_rgba(156,163,175,0.12)] border-gray-400/30",
  },
  {
    value: 10,
    emoji: "\uD83D\uDCD6",
    label: "Regular",
    subtext: "Build a steady habit",
    tint: "from-cyan-500/[0.06] to-blue-500/[0.03]",
    selectedTint: "shadow-[0_0_12px_rgba(34,211,238,0.15)] border-cyan-400/30",
    recommended: true,
  },
  {
    value: 20,
    emoji: "\uD83D\uDCAA",
    label: "Committed",
    subtext: "Real progress, every day",
    tint: "from-amber-500/[0.06] to-orange-500/[0.03]",
    selectedTint: "shadow-[0_0_12px_rgba(251,191,36,0.15)] border-amber-400/30",
  },
  {
    value: 30,
    emoji: "\uD83D\uDD25",
    label: "Intense",
    subtext: "For the truly dedicated",
    tint: "from-red-500/[0.06] to-orange-500/[0.03]",
    selectedTint: "shadow-[0_0_12px_rgba(239,68,68,0.15)] border-red-400/30",
  },
];

export const MOTIVATION_OPTIONS: MotivationOption[] = [
  {
    id: "coach",
    emoji: "\uD83C\uDF31",
    persona: "Personal Coach",
    description:
      "Warm encouragement. Celebrates effort, not just results.",
    tint: "from-emerald-500/[0.06] to-teal-500/[0.03]",
    selectedTint: "shadow-[0_0_15px_rgba(16,185,129,0.15)] border-emerald-400/40",
  },
  {
    id: "partner",
    emoji: "\uD83D\uDCCB",
    persona: "Accountability Partner",
    description:
      "Straight talk. Clear progress updates and honest check-ins.",
    tint: "from-blue-500/[0.06] to-slate-500/[0.03]",
    selectedTint: "shadow-[0_0_15px_rgba(59,130,246,0.15)] border-blue-400/40",
  },
  {
    id: "rival",
    emoji: "\u2694\uFE0F",
    persona: "Rival",
    description:
      "Competitive edge. Leaderboard energy and bold challenges.",
    tint: "from-red-500/[0.06] to-orange-500/[0.03]",
    selectedTint: "shadow-[0_0_15px_rgba(239,68,68,0.15)] border-red-400/40",
  },
];
