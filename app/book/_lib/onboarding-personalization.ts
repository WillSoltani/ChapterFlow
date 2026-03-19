export type ChapterStartMode = "summary-first" | "practical-first" | "balanced";
export type PreferredExampleContext = "all" | "work" | "school" | "personal";
export type ReminderPreset = "none" | "morning" | "midday" | "evening" | "custom";

export const CHAPTER_START_MODE_VALUES = [
  "summary-first",
  "practical-first",
  "balanced",
] as const satisfies readonly ChapterStartMode[];

export const PREFERRED_EXAMPLE_CONTEXT_VALUES = [
  "all",
  "work",
  "school",
  "personal",
] as const satisfies readonly PreferredExampleContext[];

const REMINDER_PRESET_TIMES: Record<Exclude<ReminderPreset, "none" | "custom">, string> = {
  morning: "08:00",
  midday: "12:30",
  evening: "20:00",
};

export function isChapterStartMode(value: unknown): value is ChapterStartMode {
  return (
    typeof value === "string" &&
    (CHAPTER_START_MODE_VALUES as readonly string[]).includes(value)
  );
}

export function isPreferredExampleContext(
  value: unknown
): value is PreferredExampleContext {
  return (
    typeof value === "string" &&
    (PREFERRED_EXAMPLE_CONTEXT_VALUES as readonly string[]).includes(value)
  );
}

export function getChapterStartModeLabel(value: ChapterStartMode): string {
  if (value === "summary-first") return "Summary first";
  if (value === "practical-first") return "Practical scenarios first";
  return "Balanced flow";
}

export function getChapterStartModeShortLabel(value: ChapterStartMode): string {
  if (value === "summary-first") return "Summary";
  if (value === "practical-first") return "Scenarios";
  return "Balanced";
}

export function chapterStartModeToInitialTab(
  value: ChapterStartMode
): "summary" | "examples" {
  return value === "practical-first" ? "examples" : "summary";
}

export function getPreferredExampleContextLabel(
  value: PreferredExampleContext
): string {
  if (value === "work") return "Work";
  if (value === "school") return "School";
  if (value === "personal") return "Personal life";
  return "Mix of everything";
}

export function getPreferredExampleContextShortLabel(
  value: PreferredExampleContext
): string {
  if (value === "work") return "Work";
  if (value === "school") return "School";
  if (value === "personal") return "Personal";
  return "Mixed";
}

export function getExampleContextTaskLabel(
  value: PreferredExampleContext
): string {
  if (value === "work") return "Open the work scenarios";
  if (value === "school") return "Open the school scenarios";
  if (value === "personal") return "Open the personal-life scenarios";
  return "Open the most relevant scenarios";
}

export function getExampleContextLead(
  value: PreferredExampleContext
): string {
  if (value === "work") return "work examples";
  if (value === "school") return "school examples";
  if (value === "personal") return "personal-life examples";
  return "the most relevant examples";
}

export function getMotivationStyleLabel(value: string): string {
  if (value === "direct") return "Clear accountability";
  if (value === "competitive") return "Visible milestones";
  return "Calm consistency";
}

export function getMotivationStyleSummary(value: string): string {
  if (value === "direct") {
    return "Keep the tone clear, goal-focused, and action oriented.";
  }
  if (value === "competitive") {
    return "Make progress feel visible with milestones and momentum cues.";
  }
  return "Keep the tone calm, steady, and easy to return to.";
}

export function getLearningStyleLabel(value: string): string {
  if (value === "concise") return "Quick read";
  if (value === "deep") return "Deeper read";
  return "Balanced detail";
}

export function getLearningStyleSummary(value: string): string {
  if (value === "concise") {
    return "Start with the shortest possible version of the idea.";
  }
  if (value === "deep") {
    return "Give more context before moving on.";
  }
  return "Keep the first pass clear without feeling too sparse or too dense.";
}

export function getReminderPresetForTime(value: string): ReminderPreset {
  const trimmed = value.trim();
  if (!trimmed) return "none";
  if (trimmed === REMINDER_PRESET_TIMES.morning) return "morning";
  if (trimmed === REMINDER_PRESET_TIMES.midday) return "midday";
  if (trimmed === REMINDER_PRESET_TIMES.evening) return "evening";
  return "custom";
}

export function reminderPresetToTime(
  preset: Exclude<ReminderPreset, "none" | "custom">
): string {
  return REMINDER_PRESET_TIMES[preset];
}

export function formatReminderTimeLabel(value: string): string {
  if (!value.trim()) return "No reminder";
  const [hourRaw, minuteRaw] = value.split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return value;
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function buildPersonalizationRecommendation(params: {
  readingGoalLabel: string | null;
  chapterStartMode: ChapterStartMode;
  preferredExampleContext: PreferredExampleContext;
  learningStyle: string;
  motivationStyle: string;
  dailyGoalMinutes: number;
  selectedBookTitle?: string | null;
}) {
  const goalLead = params.readingGoalLabel
    ? `around ${params.readingGoalLabel.toLowerCase()}`
    : "around practical understanding";
  const chapterLead =
    params.chapterStartMode === "practical-first"
      ? "open chapters in real-life scenarios first"
      : params.chapterStartMode === "summary-first"
        ? "open chapters with the main point first"
        : "guide you through a balanced chapter flow";

  const contextLead =
    params.preferredExampleContext === "all"
      ? "keep all three life contexts within reach"
      : `surface ${getExampleContextLead(params.preferredExampleContext)} first`;

  const supportLead =
    params.motivationStyle === "direct"
      ? "keep the tone clear and accountable"
      : params.motivationStyle === "competitive"
        ? "make progress feel visible with milestone cues"
        : "keep the tone calm and steady";

  const firstSession = params.selectedBookTitle
    ? `Your first session will lean ${goalLead} with ${getLearningStyleLabel(params.learningStyle).toLowerCase()} guidance in ${params.selectedBookTitle}.`
    : `Your first sessions will lean ${goalLead} with ${getLearningStyleLabel(params.learningStyle).toLowerCase()} guidance.`;

  return {
    headline: `We’ll ${chapterLead}, ${contextLead}, and ${supportLead}.`,
    body: firstSession,
    bullets: [
      `${getChapterStartModeLabel(params.chapterStartMode)} will shape how chapters open.`,
      `${getPreferredExampleContextLabel(params.preferredExampleContext)} will shape which scenarios feel closest to you first.`,
      `${params.dailyGoalMinutes} minutes a day stays your default pace until you change it.`,
    ],
  };
}
