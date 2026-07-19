import type { OnboardingBook } from "../data/books";

export const MAX_STARTER_SHELF_PICKS = 3;

export type StarterShelfSwipeDirection = "left" | "right";

export interface StarterShelfSelection {
  currentIndex: number;
  selectedBooks: OnboardingBook[];
  rejectedIds: string[];
  isComplete: boolean;
}

export function createStarterShelfSelection(): StarterShelfSelection {
  return {
    currentIndex: 0,
    selectedBooks: [],
    rejectedIds: [],
    isComplete: false,
  };
}

export function advanceStarterShelfSelection(
  selection: StarterShelfSelection,
  frontBook: OnboardingBook,
  direction: StarterShelfSwipeDirection,
): StarterShelfSelection {
  if (direction === "right") {
    const selectedBooks = [...selection.selectedBooks, frontBook];
    const isComplete = selectedBooks.length >= MAX_STARTER_SHELF_PICKS;

    return {
      ...selection,
      currentIndex: isComplete ? selection.currentIndex : selection.currentIndex + 1,
      selectedBooks,
      isComplete,
    };
  }

  return {
    ...selection,
    currentIndex: selection.currentIndex + 1,
    rejectedIds: selection.rejectedIds.includes(frontBook.id)
      ? selection.rejectedIds
      : [...selection.rejectedIds, frontBook.id],
  };
}

export function getStarterShelfFillerPicks(
  candidates: OnboardingBook[],
  selectedBooks: OnboardingBook[],
  rejectedIds: string[],
  limit: number,
): OnboardingBook[] {
  const excludedIds = new Set([
    ...selectedBooks.map(({ id }) => id),
    ...rejectedIds,
  ]);

  return candidates
    .filter(({ id }) => !excludedIds.has(id))
    .slice(0, Math.max(0, limit));
}

export function buildStarterShelf(
  selectedBooks: OnboardingBook[],
  fillerPicks: OnboardingBook[],
): OnboardingBook[] {
  return [...selectedBooks, ...fillerPicks].slice(0, MAX_STARTER_SHELF_PICKS);
}
