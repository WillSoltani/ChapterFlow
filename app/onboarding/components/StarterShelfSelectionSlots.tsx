import type { OnboardingBook } from "@/app/onboarding/data/books";
import { MAX_STARTER_SHELF_PICKS } from "@/app/onboarding/hooks/starter-shelf-selection-core";
import { StarterShelfSelectionSlot } from "./StarterShelfSelectionSlot";

interface StarterShelfSelectionSlotsProps {
  books: OnboardingBook[];
  reducedMotion: boolean | null;
}

export function StarterShelfSelectionSlots({
  books,
  reducedMotion,
}: StarterShelfSelectionSlotsProps) {
  return (
    <div className="flex items-center justify-center gap-3" style={{ marginTop: 24 }}>
      {Array.from({ length: MAX_STARTER_SHELF_PICKS }, (_, index) => (
        <StarterShelfSelectionSlot
          key={index}
          book={books[index]}
          index={index}
          reducedMotion={reducedMotion}
        />
      ))}
    </div>
  );
}
