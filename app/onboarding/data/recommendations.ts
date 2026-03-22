/* ── Recommendation logic for starter shelf ── */

import { ONBOARDING_BOOKS, type OnboardingBook } from "./books";
import type { Motivation } from "../hooks/useOnboarding";

/* Map motivations to preferred interest categories */
const MOTIVATION_INTERESTS: Record<Motivation, string[]> = {
  career: ["productivity", "leadership", "strategy", "communication", "negotiation"],
  academic: ["psychology", "science", "education", "decision-making", "philosophy"],
  personal: ["habits", "self-awareness", "relationships", "health-wellness", "philosophy"],
  curiosity: ["psychology", "science", "history", "philosophy", "creativity"],
};

/* Score a book based on how well it matches user interests + motivation */
function scoreBook(
  book: OnboardingBook,
  userInterests: string[],
  motivation: Motivation | null,
): number {
  let score = 0;

  // Interest overlap (primary signal)
  for (const interest of userInterests) {
    if (book.interests.includes(interest)) {
      score += 3;
    }
  }

  // Motivation alignment (secondary signal)
  if (motivation) {
    const motInterests = MOTIVATION_INTERESTS[motivation];
    for (const mi of motInterests) {
      if (book.interests.includes(mi)) {
        score += 1;
      }
    }
  }

  // Slight preference for easy/medium books in onboarding
  if (book.difficulty === "Easy") score += 1;
  if (book.difficulty === "Medium") score += 0.5;

  return score;
}

/* Get recommended starter shelf (3 books) */
export function getRecommendedBooks(
  userInterests: string[],
  motivation: Motivation | null,
): OnboardingBook[] {
  // Always include Atomic Habits as the first book (it's the first loop content)
  const atomicHabits = ONBOARDING_BOOKS.find((b) => b.id === "atomic-habits")!;

  // Score remaining books
  const candidates = ONBOARDING_BOOKS
    .filter((b) => b.id !== "atomic-habits")
    .map((book) => ({
      book,
      score: scoreBook(book, userInterests, motivation),
    }))
    .sort((a, b) => b.score - a.score);

  // Pick top 2, but ensure category diversity
  const selected: OnboardingBook[] = [atomicHabits];
  const usedCategories = new Set([atomicHabits.category]);

  for (const { book } of candidates) {
    if (selected.length >= 3) break;

    // Prefer different categories for variety
    if (!usedCategories.has(book.category) || selected.length >= 2) {
      selected.push(book);
      usedCategories.add(book.category);
    }
  }

  // Fill if needed
  while (selected.length < 3) {
    const next = candidates.find(
      ({ book }) => !selected.some((s) => s.id === book.id),
    );
    if (next) selected.push(next.book);
    else break;
  }

  return selected;
}

/* Generate a swipe deck of 10 books sorted by relevance */
export function generateSwipeDeck(
  userInterests: string[],
  motivation: Motivation | null,
): OnboardingBook[] {
  // Always put Atomic Habits first (it's the first loop content)
  const atomicHabits = ONBOARDING_BOOKS.find((b) => b.id === "atomic-habits")!;

  const candidates = ONBOARDING_BOOKS
    .filter((b) => b.id !== "atomic-habits")
    .map((book) => ({
      book,
      score: scoreBook(book, userInterests, motivation),
    }))
    .sort((a, b) => b.score - a.score);

  // Take top 9 to fill deck of 10 (Atomic Habits + 9 best matches)
  const deck: OnboardingBook[] = [atomicHabits];
  const usedCategories = new Set([atomicHabits.category]);

  // First pass: prefer category diversity
  for (const { book } of candidates) {
    if (deck.length >= 10) break;
    if (!usedCategories.has(book.category)) {
      deck.push(book);
      usedCategories.add(book.category);
    }
  }

  // Second pass: fill remaining slots with highest-scored books
  for (const { book } of candidates) {
    if (deck.length >= 10) break;
    if (!deck.some((d) => d.id === book.id)) {
      deck.push(book);
    }
  }

  return deck;
}

/* Get swap alternatives (books not on shelf, matching interests) */
export function getSwapAlternatives(
  currentShelfIds: string[],
  userInterests: string[],
  motivation: Motivation | null,
  limit = 6,
): OnboardingBook[] {
  const shelfSet = new Set(currentShelfIds);

  return ONBOARDING_BOOKS
    .filter((b) => !shelfSet.has(b.id))
    .map((book) => ({
      book,
      score: scoreBook(book, userInterests, motivation),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ book }) => book);
}
