import type { LearningMode, ReadingProfile } from "@/lib/settings-types";

/**
 * The reading profile card that matches the depth the reader actually gets.
 *
 * The cards (Lite, Standard, Deeper) carry the same names as the reader's own
 * mode menu, and that menu saves the learning mode, not the profile id. Until a
 * depth has been chosen anywhere (`profileCustomized` false) the reader and the
 * quizzes use the short path, which is Lite.
 */
export function effectiveReadingProfile(extended: {
  profileCustomized: boolean;
  learningMode: LearningMode;
  readingProfile: ReadingProfile;
}): ReadingProfile {
  if (!extended.profileCustomized) return "quick";
  switch (extended.learningMode) {
    case "guided":
      return "quick";
    case "standard":
      return "balanced";
    case "challenge":
      return "deep";
    default:
      return extended.readingProfile;
  }
}
