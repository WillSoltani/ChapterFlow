/* ── Recommendation logic for the starter shelf ────────────────────────────
 *
 * Ranks the real catalog (ONBOARDING_BOOKS) by how well each book matches the
 * interests + motivation the user picked, so the swipe deck is seeded from the
 * full published catalog rather than a 3-book stub. Pure + deterministic: the
 * same inputs always produce the same ordering (no Math.random tie-breaks).
 */

import { ONBOARDING_BOOKS, type OnboardingBook } from "./books";
import type { Motivation } from "../hooks/useOnboarding";

/* Map motivations to preferred interest categories (secondary ranking signal) */
const MOTIVATION_INTERESTS: Record<Motivation, string[]> = {
  career: ["productivity", "leadership", "strategy", "communication", "negotiation"],
  academic: ["psychology", "decision-making", "education", "philosophy"],
  personal: ["habits", "self-awareness", "relationships", "health-wellness", "philosophy"],
  curiosity: ["psychology", "philosophy", "creativity", "decision-making"],
};

/* Score a book by how well it matches user interests + motivation. */
function scoreBook(
  book: OnboardingBook,
  userInterests: string[],
  motivation: Motivation | null,
): number {
  let score = 0;

  // Interest overlap (primary signal)
  for (const interest of userInterests) {
    if (book.interests.includes(interest)) score += 3;
  }

  // Motivation alignment (secondary signal)
  if (motivation) {
    for (const mi of MOTIVATION_INTERESTS[motivation]) {
      if (book.interests.includes(mi)) score += 1;
    }
  }

  // Gentle bias toward shorter, more approachable books for a first session.
  if (book.difficulty === "Easy") score += 1;
  else if (book.difficulty === "Medium") score += 0.5;

  return score;
}

/** Stable, relevance-first ordering of the whole catalog. */
function rankBooks(
  userInterests: string[],
  motivation: Motivation | null,
): OnboardingBook[] {
  return ONBOARDING_BOOKS.map((book, index) => ({
    book,
    score: scoreBook(book, userInterests, motivation),
    index,
  }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      // Tie-break: shorter books first, then original catalog order (stable).
      if (a.book.estimatedHours !== b.book.estimatedHours) {
        return a.book.estimatedHours - b.book.estimatedHours;
      }
      return a.index - b.index;
    })
    .map(({ book }) => book);
}

/**
 * Seed the swipe deck: the catalog ranked by relevance, capped so the deck
 * stays snappy. Always returns enough cards that swiping left never strands the
 * user (the catalog has far more than MAX_PICKS books).
 */
export function generateSwipeDeck(
  userInterests: string[],
  motivation: Motivation | null,
  limit = 24,
): OnboardingBook[] {
  return rankBooks(userInterests, motivation).slice(0, limit);
}

/**
 * Top recommendations excluding books already chosen — used to auto-fill the
 * remaining shelf slots when the deck empties before the user hits MAX_PICKS.
 */
export function getTopPicks(
  userInterests: string[],
  motivation: Motivation | null,
  excludeIds: string[],
  limit: number,
): OnboardingBook[] {
  const exclude = new Set(excludeIds);
  return rankBooks(userInterests, motivation)
    .filter((book) => !exclude.has(book.id))
    .slice(0, limit);
}
