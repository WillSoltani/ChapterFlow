/* ── Book catalog for onboarding ── */

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
  "48-laws-power": "the-48-laws-of-power",
  "how-to-win-friends": "friends-and-influence",
};

/** Get cover image path for a book (returns null if no cover available) */
export function getBookCoverPath(bookId: string): string | null {
  const coverId = COVER_MAP[bookId];
  if (!coverId) return null;
  return `/book-covers/${coverId}.jpg`;
}

export const ONBOARDING_BOOKS: OnboardingBook[] = [
  // Strategy
  { id: "48-laws-power", title: "The 48 Laws of Power", author: "Robert Greene", category: "Strategy", difficulty: "Hard", estimatedHours: 5.0, gradient: "linear-gradient(135deg, #991B1B, #7F1D1D)", interests: ["history", "strategy", "leadership"], tagline: "3,000 years of power distilled into 48 laws." },

  // Communication
  { id: "how-to-win-friends", title: "How to Win Friends and Influence People", author: "Dale Carnegie", category: "Communication", difficulty: "Easy", estimatedHours: 2.6, gradient: "linear-gradient(135deg, #059669, #047857)", interests: ["communication", "relationships"], tagline: "The timeless guide to human connection." },
];

export function getBookById(id: string): OnboardingBook | undefined {
  return ONBOARDING_BOOKS.find((b) => b.id === id);
}
