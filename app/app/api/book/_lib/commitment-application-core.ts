import type { BookUserCommitmentItem, ChapterApplicationState } from "./types";

/**
 * Two-axis completion (feedback #4) — the APPLICATION axis, PURE/CLIENT-SAFE core.
 *
 * `applicationComplete` ("you used it") is DERIVED from the existing commitment
 * follow-through loop, never persisted on BookUserProgress. It is READ-ONLY,
 * GATELESS, and awards NO new IP: it never unlocks the next chapter and never
 * touches streak/tier/FSRS/journey. The quiz pass (`knowledgeComplete`) remains the
 * one and only completion gate. (See docs/two-axis-completion.md.)
 *
 * This module has NO `server-only` / AWS imports on purpose: the reducer is used both
 * server-side (the /state read) AND client-side (the reader celebration modal derives
 * the current chapter's state from the live commitment list).
 *
 * `outcome` (helped/partly/didnt) is IRRELEVANT to this state — a followed-through
 * commitment is `applied` regardless of whether it helped. Outcome is a separate
 * efficacy signal, not part of the application axis.
 */

/** Source of the commitment list (DI seam so the aggregator core stays pure/testable). */
export type CommitmentLister = (
  tableName: string,
  userId: string,
) => Promise<BookUserCommitmentItem[]>;

/**
 * Pure reducer. Operates on the FULL, unfiltered commitment list (ALL statuses) and
 * returns the STRONGEST application state for a single (bookId, chapterNumber), by
 * status-strength — applied > committed > none — NOT by recency.
 *
 *   - "applied"   — any commitment with status "completed" AND
 *                   followThroughSubmittedAt != null (outcome-independent).
 *   - "committed" — else, any commitment with status "active" (an overdue-but-not-
 *                   yet-expired active still counts as committed).
 *   - "none"      — otherwise (no commitments, or only skipped/expired).
 *
 * NOTE: callers must pass the full list. A status-filtered list (e.g. only actives)
 * would wrongly report "committed"/"none" when an "applied" commitment exists.
 */
export function deriveChapterApplicationState(
  commitments: BookUserCommitmentItem[],
  bookId: string,
  chapterNumber: number,
): ChapterApplicationState {
  let committed = false;
  for (const c of commitments) {
    if (c.bookId !== bookId || c.chapterNumber !== chapterNumber) continue;
    if (c.status === "completed" && c.followThroughSubmittedAt != null) {
      // Strongest state — wins over any active regardless of recency.
      return "applied";
    }
    if (c.status === "active") {
      committed = true;
    }
  }
  return committed ? "committed" : "none";
}

/**
 * Pure aggregator core: reduce a full commitment list (any books) into a SPARSE map
 * keyed by chapterNumber for one book — only chapters with a non-"none" state appear.
 * Every consumer must read `map[n] ?? "none"`.
 */
export function reduceBookApplicationStates(
  commitments: BookUserCommitmentItem[],
  bookId: string,
): Record<number, ChapterApplicationState> {
  const byChapter = new Map<number, BookUserCommitmentItem[]>();
  for (const c of commitments) {
    if (c.bookId !== bookId) continue;
    const list = byChapter.get(c.chapterNumber);
    if (list) list.push(c);
    else byChapter.set(c.chapterNumber, [c]);
  }

  const result: Record<number, ChapterApplicationState> = {};
  for (const [chapterNumber, list] of byChapter) {
    const state = deriveChapterApplicationState(list, bookId, chapterNumber);
    if (state !== "none") {
      result[chapterNumber] = state;
    }
  }
  return result;
}

/**
 * Pure remap: chapterNumber-keyed -> chapterId-keyed, dropping any chapterNumber not
 * present in the manifest map. The /state read returns the chapterId-keyed form so it
 * matches the sibling completedChapterIds / chapterScores fields and the cards, which
 * all key off chapterId.
 */
export function toChapterIdKeyedApplicationStates(
  byNumber: Record<number, ChapterApplicationState>,
  chapterIdByNumber: Map<number, string>,
): Record<string, ChapterApplicationState> {
  const result: Record<string, ChapterApplicationState> = {};
  for (const [number, state] of Object.entries(byNumber)) {
    const chapterId = chapterIdByNumber.get(Number(number));
    if (chapterId) {
      result[chapterId] = state;
    }
  }
  return result;
}

/**
 * Pure aggregator: ONE call to `lister` (no N+1 per chapter), reduced in memory.
 * The server wrapper passes the real listCommitments (no status filter); tests pass
 * a spy to assert the single-query contract.
 */
export async function aggregateBookApplicationStates(
  lister: CommitmentLister,
  tableName: string,
  userId: string,
  bookId: string,
): Promise<Record<number, ChapterApplicationState>> {
  const all = await lister(tableName, userId);
  return reduceBookApplicationStates(all, bookId);
}
