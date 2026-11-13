/**
 * Follow-through points rules for commitments (pure, unit-tested).
 *
 * A completed check-in earns Insight Points only when all of these hold:
 *  - the follow-up date has passed (the copy promises "come back days later");
 *  - the reader has completed that chapter (a commitment is made after a chapter);
 *  - no follow-through award was paid for the same book chapter before;
 *  - the reader is under the daily cap for this award.
 * The check-in itself is still recorded when an award is withheld.
 */

/** Follow-through awards a reader can earn per UTC day (25 IP each). */
export const COMMITMENT_FOLLOW_THROUGH_DAILY_CAP = 3;

export type CommitmentAwardDenial =
  | "not_due"
  | "chapter_not_completed"
  | "already_awarded"
  | "daily_cap";

/** Grant key: one follow-through award per (user, book, chapter). */
export function commitmentAwardSourceId(bookId: string, chapterNumber: number): string {
  return `${bookId}:${chapterNumber}`;
}

export function commitmentAwardLimitSk(dateKey: string): string {
  return `COMMITMENT_IP_LIMIT#${dateKey}`;
}

export function isCommitmentDue(followUpDate: string, nowMs: number): boolean {
  const dueMs = Date.parse(followUpDate);
  return Number.isFinite(dueMs) && nowMs >= dueMs;
}

/**
 * Checks that need no write, in the order they are cheapest to evaluate.
 * Returns null when the award may proceed to the daily-cap reservation.
 */
export function precheckCommitmentAward(params: {
  followUpDate: string;
  nowMs: number;
  chapterNumber: number;
  completedChapters: readonly number[] | null | undefined;
  alreadyAwardedForChapter: boolean;
}): CommitmentAwardDenial | null {
  if (!isCommitmentDue(params.followUpDate, params.nowMs)) return "not_due";
  if (!(params.completedChapters ?? []).includes(params.chapterNumber)) {
    return "chapter_not_completed";
  }
  if (params.alreadyAwardedForChapter) return "already_awarded";
  return null;
}
