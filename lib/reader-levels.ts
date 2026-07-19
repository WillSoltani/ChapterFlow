// Canonical reader-level system: NAMED TIERS derived from total completed
// chapters. This is the single source of truth shared by the Progress page
// (hero reader-level + progress bar) and the Library completion toast, so the
// two surfaces never disagree on a reader's tier. There is intentionally no
// numeric "Level N" exposed to users — tiers are named, not numbered.

// Canonical definition (WS3-007): lib/ is the base layer, so the type lives
// here and components/progress/progressTypes re-exports it — never the
// reverse. Named tiers, deliberately not numeric "Level N" values.
export type ReaderLevel =
  | "Curious Reader"
  | "Active Learner"
  | "Knowledge Builder"
  | "Thought Leader";

/** Named tier for a reader, derived from their total completed chapters. */
export function deriveReaderLevel(totalChapters: number): ReaderLevel {
  if (totalChapters >= 100) return "Thought Leader";
  if (totalChapters >= 25) return "Knowledge Builder";
  if (totalChapters >= 5) return "Active Learner";
  return "Curious Reader";
}

/** Percent (0-100) of progress toward the next named tier. */
export function deriveReaderLevelProgress(totalChapters: number): number {
  if (totalChapters >= 100) return 100;
  if (totalChapters >= 25) return Math.round(((totalChapters - 25) / 75) * 100);
  if (totalChapters >= 5) return Math.round(((totalChapters - 5) / 20) * 100);
  return Math.round((totalChapters / 5) * 100);
}
