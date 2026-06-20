import type { ChapterTab } from "@/app/book/library/[bookId]/chapter/[chapterId]/hooks/useChapterState";

/**
 * Pure scroll-progress → loop-phase mapping for the signature RetentionLoopSection.
 * Kept in a runtime-dependency-free module (only a type-only import, erased at
 * compile time) so it can be unit-tested without loading the "use client" +
 * framer-motion component tree.
 */

export const ORDER: ChapterTab[] = ["summary", "examples", "quiz", "practice"];

// Upper bound (exclusive) of each phase's scroll band. The quiz band is widest:
// it has the most to read and carries the "correct → unlock" beat into practice.
export const PHASE_BANDS: { max: number; phase: ChapterTab }[] = [
  { max: 0.27, phase: "summary" }, // Read
  { max: 0.5, phase: "examples" }, // Apply
  { max: 0.74, phase: "quiz" }, // Prove
  { max: Infinity, phase: "practice" }, // Unlock
];

/** Map continuous scroll progress (0..1, may overshoot) to a discrete loop phase. */
export function phaseForProgress(p: number): ChapterTab {
  for (const band of PHASE_BANDS) {
    if (p < band.max) return band.phase;
  }
  return "practice";
}
