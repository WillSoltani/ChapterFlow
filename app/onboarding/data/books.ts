/* ── Book catalog for onboarding ── */

import { getBookCoverPath as getCanonicalBookCoverPath } from "@/lib/book-covers";

export interface OnboardingBook {
  id: string;
  title: string;
  author: string;
  category: string;
  difficulty: "Easy" | "Medium" | "Hard";
  estimatedHours: number;
  gradient: string;
  interests: string[]; // which interest categories this book maps to
  tagline: string;     // short 1-sentence description for swipe cards
  coverId?: string;    // filename in public/book-covers/ (without extension)
}

/** Map book id to the cover filename in public/book-covers/ */
const COVER_MAP: Record<string, string> = {
  "crucial-conversations": "crucial-conversations",
  "thinking-fast-and-slow": "thinking-fast-and-slow",
  "the-almanack-of-naval-ravikant": "the-almanack-of-naval-ravikant",
};

/** Get cover image path for a book (returns null if no cover available) */
export function getBookCoverPath(bookId: string): string | null {
  const coverId = COVER_MAP[bookId];
  if (!coverId) return null;
  return getCanonicalBookCoverPath(coverId);
}

export const ONBOARDING_BOOKS: OnboardingBook[] = [
  // Communication
  { id: "crucial-conversations", title: "Crucial Conversations", author: "Joseph Grenny, Kerry Patterson, Ron McMillan, Al Switzler", category: "Communication", difficulty: "Medium", estimatedHours: 2.2, gradient: "linear-gradient(135deg, #0f766e, #0f172a)", interests: ["communication", "relationships"], tagline: "A practical guide to handling hard conversations well." },
  { id: "thinking-fast-and-slow", title: "Thinking, Fast and Slow", author: "Daniel Kahneman", category: "Psychology", difficulty: "Hard", estimatedHours: 18.5, gradient: "linear-gradient(135deg, #0f172a, #1d4ed8)", interests: ["psychology", "decision-making", "self-improvement"], tagline: "A deep guide to bias, judgment, and better decisions under uncertainty." },
  { id: "the-almanack-of-naval-ravikant", title: "The Almanack of Naval Ravikant", author: "Eric Jorgenson", category: "Philosophy", difficulty: "Medium", estimatedHours: 1.4, gradient: "linear-gradient(135deg, #0f172a, #155e75)", interests: ["philosophy", "finance", "self-awareness", "leadership"], tagline: "A compact guide to wealth, judgment, and inner freedom." },
];

export function getBookById(id: string): OnboardingBook | undefined {
  return ONBOARDING_BOOKS.find((b) => b.id === id);
}
