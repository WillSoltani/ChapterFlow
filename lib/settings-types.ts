// ---------------------------------------------------------------------------
// Shared types for the redesigned Settings page (WS3-001)
// ---------------------------------------------------------------------------

export type ReadingProfile = "quick" | "balanced" | "deep";

export type LearningMode = "guided" | "standard" | "challenge";

export type FontFamily = "serif" | "sans-serif" | "opendyslexic";

export type LineSpacing = "compact" | "comfortable" | "relaxed";

export type LetterSpacing = "tight" | "normal" | "wide";

export type StreakMode = "off" | "standard" | "flexible";

export type QuizStyle = "comfortable" | "challenge" | "surprise";

export type MotivationPersona = "coach" | "partner" | "rival";

export type ContentTone = "gentle" | "direct" | "competitive";

export type ColorBlindMode = "off" | "protanopia" | "deuteranopia" | "tritanopia";

export type ExportFormat = "csv" | "markdown" | "json";

export type DailyGoalPreset = 5 | 10 | 20 | 30;

/** Extended settings that are NEW to the redesign (not in existing hooks) */
export type ExtendedSettings = {
  // Reading Experience
  readingProfile: ReadingProfile;
  fontFamily: FontFamily;
  lineSpacing: LineSpacing;
  letterSpacing: LetterSpacing;

  // Text-to-Speech (Pro). ttsSpeed seeds + persists the reader AudioPlayer's
  // playback speed (SET-2). ttsVoice / ttsAutoAdvance were removed: there is no
  // multi-voice narration backend (one hardcoded voice, no voice param) and
  // auto-advance conflicts with quiz-gated chapter unlocks.
  ttsSpeed: number;

  // Learning Mode
  learningMode: LearningMode;

  // Goals & Motivation
  streakMode: StreakMode;
  streakSkipDays: number;
  motivationPersona: MotivationPersona;
  contentTone: ContentTone;
  quizStyle: QuizStyle;
  dailyGoalPreset: DailyGoalPreset;
  spacedRepetitionTarget: number; // 70-95%

  // Appearance
  scheduledDarkMode: boolean;
  darkModeFrom: string;
  darkModeTo: string;

  // Accessibility
  colorBlindMode: ColorBlindMode;

  // Notifications
  breakReminders: boolean;
  breakReminderMinutes: number;

  // UI State
  personalizationDismissed: boolean;
  sectionStates: Record<string, boolean>;
  profileCustomized: boolean;
};

export type SettingSearchItem = {
  id: string;
  section: string;
  label: string;
  description: string;
  keywords: string[];
};

export type SectionId =
  | "reading"
  | "goals"
  | "appearance"
  | "accessibility"
  | "notifications"
  | "account";

export type ReadingProfilePreset = {
  id: ReadingProfile;
  label: string;
  emoji: string;
  description: string;
  tint: string;
  selectedTint: string;
  defaults: {
    learningStyle: "concise" | "balanced" | "deep";
    quizStyle: QuizStyle;
    dailyGoalPreset: DailyGoalPreset;
    fontSize: number;
  };
};

export type DailyGoalOption = {
  value: DailyGoalPreset;
  emoji: string;
  label: string;
  subtext: string;
  tint: string;
  selectedTint: string;
  recommended?: boolean;
};

export type MotivationOption = {
  id: MotivationPersona;
  emoji: string;
  persona: string;
  description: string;
  tint: string;
  selectedTint: string;
};

export type CelebrationEvent =
  | "goal-increased"
  | "streak-enabled"
  | "rival-selected"
  | "profile-selected"
  | "score-50"
  | "score-100";
