import "server-only";

import { listCommitments } from "./commitment-repo";
import {
  aggregateBookApplicationStates,
  type CommitmentLister,
} from "./commitment-application-core";
import type { ChapterApplicationState } from "./types";

// Re-export the pure helpers so server callers (e.g. the /state route) have a single
// import site. Client callers must import these from ./commitment-application-core
// directly (this module carries `server-only`).
export {
  deriveChapterApplicationState,
  reduceBookApplicationStates,
  toChapterIdKeyedApplicationStates,
} from "./commitment-application-core";

const listForApplication: CommitmentLister = (tableName, userId) =>
  // No status filter — the reducer needs the FULL list (a filtered list would
  // mis-report committed/none when an applied commitment exists).
  listCommitments(tableName, userId);

/**
 * Aggregator — ONE query per book read, reduced in memory (never N+1 per chapter).
 * Returns a SPARSE map keyed by chapterNumber (only non-"none" chapters).
 *
 * Known benign side effect: listCommitments fire-and-forgets an idempotent
 * auto-expire write for overdue actives. This is read-only from the caller's
 * perspective (returns immediately); do not try to suppress it.
 */
export async function getBookApplicationStates(
  tableName: string,
  userId: string,
  bookId: string,
): Promise<Record<number, ChapterApplicationState>> {
  return aggregateBookApplicationStates(listForApplication, tableName, userId, bookId);
}
