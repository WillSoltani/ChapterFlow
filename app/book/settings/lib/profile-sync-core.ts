/**
 * Pure helpers for the Settings page's onboarding-answers → server profile sync.
 *
 * The onboarding answers (learning style, quiz intensity, daily goal, ...) live in
 * device-local state that falls back to defaults on a fresh browser. Settings used
 * to PATCH the whole snapshot on every visit, which overwrote the server profile
 * with those defaults (ACCT-04 / DATA-10). The page now treats the first snapshot
 * as a baseline and sends only the fields that differ from it.
 */

export type OnboardingProfileSource = {
  learningStyle: string;
  quizIntensity: string;
  streakMode: boolean;
  motivationStyle: string;
  dailyGoalMinutes: number;
  reminderTime: string;
};

export type OnboardingProfileSnapshot = {
  learningStyle: string;
  quizIntensity: string;
  streakMode: boolean;
  motivationStyle: string;
  dailyGoalMinutes: number;
  reminderTime: string | null;
};

export function buildOnboardingProfileSnapshot(
  source: OnboardingProfileSource,
): OnboardingProfileSnapshot {
  return {
    learningStyle: source.learningStyle,
    quizIntensity: source.quizIntensity,
    streakMode: source.streakMode,
    motivationStyle: source.motivationStyle,
    dailyGoalMinutes: source.dailyGoalMinutes,
    reminderTime: source.reminderTime.trim() ? source.reminderTime : null,
  };
}

/** The fields of `next` that differ from `baseline`, or null when none do. */
export function diffOnboardingProfile(
  baseline: OnboardingProfileSnapshot,
  next: OnboardingProfileSnapshot,
): Partial<OnboardingProfileSnapshot> | null {
  const changed: Record<string, unknown> = {};
  for (const key of Object.keys(next) as Array<keyof OnboardingProfileSnapshot>) {
    if (next[key] !== baseline[key]) changed[key] = next[key];
  }
  return Object.keys(changed).length > 0
    ? (changed as Partial<OnboardingProfileSnapshot>)
    : null;
}
