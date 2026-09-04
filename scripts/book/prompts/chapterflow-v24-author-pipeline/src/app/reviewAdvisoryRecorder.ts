/**
 * R-166 — keep a PASSING review's WARN advisories instead of dropping them.
 *
 * THE DEFECT, measured. The shipped Franklin revision's canonical review is
 * outcome PASS carrying 94 issues: 92 WARN, 2 INFO. Every one of the 92 names
 * exactly one chapter. `bookRunApplicationService`'s repair lane is reachable
 * only from a FAIL, and `reviewService` refuses a PASS only when it carries a
 * BLOCKER, so all 92 reader-decidable judgements were produced at reader-panel
 * cost and consumed by nothing.
 *
 * WHAT THIS MODULE DOES. It is the SELECTION and the RECORDING, kept out of the
 * 2,900-line service so both are testable without standing up a book run. The
 * consumer is the compile stage's editor pass, which renders a chapter's stored
 * advisories into ONE extra bounded editor INVOCATION for that chapter (one call
 * when it is accepted, MAX_EDITOR_ATTEMPTS at worst, exactly like the standing
 * invocation).
 *
 * WHAT R-166 STILL OWES, STATED HERE RATHER THAN ONLY IN A PULL REQUEST.
 * This closes the register entry PARTIALLY, in two disclosed ways:
 *   - With the default flag OFF, `recordReviewAdvisories` returns `disabled`
 *     before writing anything, so in the DEFAULT configuration a PASS review's
 *     WARN advisories are still discarded exactly as they were before this
 *     module existed. Nothing about the default pipeline changed.
 *   - Even with the flag ON, the advisories reach an editor on the NEXT compile
 *     of the book, never in the run whose panel filed them, because compile runs
 *     before review inside one run (see the cost note below).
 * The register's own suggested fix — one bounded review-repair round through
 * `runFromReviewFail` after a PASS, inside the same run — is NOT implemented and
 * is a larger change than this module: it would re-enter the repair lane on a
 * verdict that passed, which is a policy decision about what a PASS means.
 *
 * OFF BY DEFAULT. Nothing is recorded and nothing is spent unless the operator
 * sets CHAPTERFLOW_EDITOR_ADVISORY_PASS=1. A reader advisory is a judgement no
 * gate enforces, so acting on one is an operator decision, and the cost is real:
 * one additional author call per chapter that carries advisories, on the next
 * compile of that book.
 *
 * BEST-EFFORT, ALWAYS. Recording happens after a PASS review, on the way to
 * fresh QC and promotion. A store failure must never turn a passing book into a
 * failed run, so every error is logged and swallowed; the worst case is that the
 * advisories are dropped exactly as they are today.
 */

import { CHAPTER_EDITOR_ADVISORY_ENV } from "./chapterEditorPass.js";
import {
  boundedChapterAdvisories,
  type ReviewAdvisoryEntry,
  type ReviewAdvisoryStore,
} from "../books/reviewAdvisoryStore.js";
import type { CandidateSnapshot } from "../books/candidateTypes.js";

/** One chapter of the reviewed candidate, as this module needs it. */
export type AdvisoryChapter = Readonly<{ chapterNumber: number; chapterId: string }>;

/** The issue shape both the canonical review and a panel evaluation carry. */
export type AdvisoryIssue = Readonly<{
  code: string;
  severity: string;
  message: string;
  location?: string;
}>;

/**
 * The chapters a reviewed candidate carries, read from its own chapter
 * artifacts. Returns [] on anything unreadable: a candidate whose chapters
 * cannot be enumerated simply records no advisories.
 */
export function advisoryChaptersFromCandidate(snapshot: CandidateSnapshot): AdvisoryChapter[] {
  const chapters: AdvisoryChapter[] = [];
  for (const file of snapshot.files) {
    if (file.kind !== "CHAPTER") continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(Buffer.from(file.bytes).toString("utf8"));
    } catch {
      continue;
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) continue;
    const chapter = parsed as { number?: unknown; chapterId?: unknown };
    if (typeof chapter.number !== "number" || typeof chapter.chapterId !== "string") continue;
    chapters.push({ chapterNumber: chapter.number, chapterId: chapter.chapterId });
  }
  return chapters.sort((left, right) => left.chapterNumber - right.chapterNumber);
}

function escaped(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * The chapters one issue names, or [] when it names none.
 *
 * The boundary class deliberately mirrors `matchedChapters` in
 * candidateRepairApplicationPort: a chapter id or a `chNN` token bounded by
 * whitespace, comma, slash, hash, colon or the ends of the string, because a
 * book-wide panel finding legitimately locates itself as "ch01,ch02,ch03" and a
 * class without those boundaries matched zero of them. It is a small
 * reimplementation rather than a shared helper because the repair port's version
 * is bound to that port's `ChapterEntry` (it also matches a candidate FILE path),
 * and extracting it would refactor an 1,800-line port this package does not
 * otherwise touch. A drift between the two costs an advisory its chapter, never
 * a blocker its repair.
 */
export function advisoryChaptersOfIssue(issue: AdvisoryIssue, chapters: readonly AdvisoryChapter[]): number[] {
  if (!issue.location) return [];
  const location = issue.location.replaceAll("\\", "/");
  return chapters
    .filter((chapter) => {
      if (location === `chapter:${chapter.chapterNumber}` || location === `chapter:${chapter.chapterId}` || location === chapter.chapterId) return true;
      const byId = new RegExp(`(^|[\\s,/#:])${escaped(chapter.chapterId)}([.,/#:\\s]|$)`);
      const byNumber = new RegExp(`(^|[\\s,/#:])ch0*${chapter.chapterNumber}([.,/#:\\s]|$)`, "i");
      return byId.test(location) || byNumber.test(location);
    })
    .map((chapter) => chapter.chapterNumber);
}

/**
 * Group a review's WARN advisories by the chapter each one names, bounded.
 *
 * Only WARN is carried: an INFO is not a defect, and a BLOCKER never reaches a
 * PASS. An advisory that names no chapter is DROPPED rather than broadcast to
 * every chapter, because the editor is chapter-scoped and an unscoped judgement
 * would arrive at twelve editors as twelve different instructions.
 */
export function chapterAdvisoriesFromReview(
  issues: readonly AdvisoryIssue[],
  chapters: readonly AdvisoryChapter[],
): Map<string, ReviewAdvisoryEntry[]> {
  const byChapterNumber = new Map<number, AdvisoryIssue[]>();
  for (const issue of issues) {
    if (issue.severity !== "WARN") continue;
    for (const chapterNumber of advisoryChaptersOfIssue(issue, chapters)) {
      const group = byChapterNumber.get(chapterNumber) ?? [];
      group.push(issue);
      byChapterNumber.set(chapterNumber, group);
    }
  }
  const byChapterId = new Map<string, ReviewAdvisoryEntry[]>();
  for (const chapter of chapters) {
    const group = byChapterNumber.get(chapter.chapterNumber);
    if (!group || group.length === 0) continue;
    const entries = boundedChapterAdvisories(group);
    if (entries.length > 0) byChapterId.set(chapter.chapterId, entries);
  }
  return byChapterId;
}

/** True when the operator has asked for the advisory pass. */
export function advisoryPassEnabled(env: Readonly<Record<string, string | undefined>>): boolean {
  return env[CHAPTER_EDITOR_ADVISORY_ENV] === "1";
}

export type RecordReviewAdvisoriesInput = Readonly<{
  store?: ReviewAdvisoryStore;
  env?: Readonly<Record<string, string | undefined>>;
  bookId: string;
  reviewId: string;
  issues: readonly AdvisoryIssue[];
  candidate: CandidateSnapshot;
}>;

export type RecordReviewAdvisoriesResult = Readonly<{
  /** Chapters whose advisories were written. */
  recorded: number;
  /** Advisories written, summed over chapters. */
  advisories: number;
  /** Why nothing was written, when nothing was. */
  reason: "recorded" | "disabled" | "no-store" | "none";
}>;

/**
 * Record a PASSING review's WARN advisories for the chapters they name.
 *
 * A chapter that HAD advisories and now has none has its entry CLEARED, so a
 * later compile is never handed a judgement the current panel no longer makes.
 */
export async function recordReviewAdvisories(
  input: RecordReviewAdvisoriesInput,
): Promise<RecordReviewAdvisoriesResult> {
  const env = input.env ?? globalThis.process?.env ?? {};
  if (!advisoryPassEnabled(env)) return { recorded: 0, advisories: 0, reason: "disabled" };
  if (!input.store) return { recorded: 0, advisories: 0, reason: "no-store" };
  const chapters = advisoryChaptersFromCandidate(input.candidate);
  if (chapters.length === 0) return { recorded: 0, advisories: 0, reason: "none" };
  const grouped = chapterAdvisoriesFromReview(input.issues, chapters);
  let recorded = 0;
  let advisories = 0;
  for (const chapter of chapters) {
    const entries = grouped.get(chapter.chapterId);
    try {
      if (entries === undefined) {
        await input.store.clear({ bookId: input.bookId, chapterId: chapter.chapterId });
        continue;
      }
      await input.store.write(
        { bookId: input.bookId, chapterId: chapter.chapterId },
        { reviewId: input.reviewId, entries },
      );
      recorded += 1;
      advisories += entries.length;
    } catch (error) {
      console.error(
        `[book-run] review-advisory book=${input.bookId} chapter=${chapter.chapterNumber}`
        + ` action=RECORD_ADVISORIES_FAILED detail=${(error as Error).message.slice(0, 200)}`,
      );
    }
  }
  console.error(
    `[book-run] review-advisory book=${input.bookId} reviewId=${input.reviewId}`
    + ` action=RECORD_PASS_ADVISORIES chapters=${recorded} advisories=${advisories}`,
  );
  return { recorded, advisories, reason: recorded > 0 ? "recorded" : "none" };
}
