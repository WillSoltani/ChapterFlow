/**
 * Quiz answer-key EVIDENCE resolver (F-10).
 *
 * The key-judge gate (`quizKeyGate.checkKeyJudge`) only BLOCKS when a FRESH judge
 * result flagged a confident wrong key; a missing/stale result is advisory by
 * default (fail-open). That silence is the mechanism that shipped `hooked` with
 * 21/72 wrong keys. This module makes the silence LOUD without changing the gate:
 * for every chapter it resolves what independent key evidence promote actually
 * has, so the promote report can state it per chapter and summarize the chapters
 * that have NONE.
 *
 * Three states, in priority order:
 *   - `judge-verified`  — a FRESH key-judge result (its v2 content hash still
 *     matches the chapter). The judge ran against the current bytes.
 *   - `reader-verified` — a DURABLE reader review bound to the CURRENT content
 *     hash that PASSed valid and independently re-derived EVERY key
 *     (keyCheck.matches === keyCheck.of). The author-path blinded reader derives
 *     all 9 keys, so author-arch books carry semantic key evidence at review
 *     time; this surfaces it at promote without spawning anything.
 *   - `unverified`      — neither. Promote has NO independent check of these keys.
 *
 * Both checks bind to `chapterContentHash(chapter)` (the same v2 hash the gate
 * and the review ledger use), so a post-review / post-judge edit that changes the
 * chapter demotes the chapter to `unverified` — evidence never outlives the bytes
 * it was produced over. This resolver is PURE (read-only) and spawns nothing.
 */

import type { ChapterV21 } from "../types.js";
import { parseChapterId } from "../lib/chapterPaths.js";
import { chapterContentHash } from "./qcAttestation.js";
import { loadKeyJudge, isKeyJudgeFresh } from "./quizKeyGate.js";
import { loadReviewHistory } from "../orchestrator/authorReviewLedger.js";

export type KeyEvidenceState = "judge-verified" | "reader-verified" | "unverified";

export type ChapterKeyEvidence = {
  chapterNumber: number;
  state: KeyEvidenceState;
  /** Count of quiz questions on the chapter (context for the report line). */
  questions: number;
  /** Human-readable report line. Never leaks a reviewer session id. */
  line: string;
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Resolve the key evidence promote has for ONE chapter. Read-only; binds every
 * evidence source to the chapter's CURRENT content hash.
 */
export function resolveChapterKeyEvidence(
  chapter: ChapterV21,
  stateRoot?: string,
): ChapterKeyEvidence {
  const parsed = chapter.chapterId ? parseChapterId(chapter.chapterId) : null;
  const bookId = parsed?.bookId ?? "";
  const nn = chapter.number;
  const questions = chapter.quiz?.questions?.length ?? 0;
  const wantContent = chapterContentHash(chapter);

  // 1. Fresh judge evidence — the model-backed judge ran against these bytes.
  const rec = loadKeyJudge(bookId, nn);
  if (rec && isKeyJudgeFresh(rec, chapter)) {
    const flaggedNote = rec.flagged.length > 0 ? `, ${rec.flagged.length} flagged (see quizKeyJudge gate)` : "";
    return {
      chapterNumber: nn,
      state: "judge-verified",
      questions,
      line: `ch${pad(nn)}: judge-verified (fresh) — ${rec.questionsJudged} question(s) judged${flaggedNote}`,
    };
  }

  // 2. Reader-side evidence — a DURABLE PASS+valid review bound to the CURRENT
  //    content hash whose blinded reader re-derived every key (matches === of).
  //    (`pass` already implies matches === of, but we assert it explicitly so a
  //    legacy record cannot count as key evidence on a technicality.)
  const history = stateRoot ? loadReviewHistory(bookId, stateRoot) : loadReviewHistory(bookId);
  const readerEvidence = history.find(
    (r) =>
      r.chapterNumber === nn &&
      r.contentHash === wantContent &&
      r.pass === true &&
      r.valid === true &&
      !!r.keyCheck &&
      r.keyCheck.of > 0 &&
      r.keyCheck.matches === r.keyCheck.of,
  );
  if (readerEvidence) {
    const kc = readerEvidence.keyCheck;
    return {
      chapterNumber: nn,
      state: "reader-verified",
      questions,
      line: `ch${pad(nn)}: reader-verified (review ${kc.matches}/${kc.of} at current contentHash)`,
    };
  }

  // 3. No fresh judge, no bound reader evidence → loudly unverified.
  return {
    chapterNumber: nn,
    state: "unverified",
    questions,
    line: `ch${pad(nn)}: UNVERIFIED — no fresh key-judge result and no reader review that re-derived all ${questions} key(s) at the current content`,
  };
}

export type BookKeyEvidence = {
  schemaVersion: "quiz-key-evidence-v1";
  perChapter: ChapterKeyEvidence[];
  counts: { judgeVerified: number; readerVerified: number; unverified: number };
  /** Chapter numbers with NO independent key evidence at the current content. */
  unverifiedChapters: number[];
  /** A prominent one-line summary; empty-string sentinel is never used — always
   *  present so the promote report can render it unconditionally. */
  summary: string;
};

/**
 * Resolve key evidence for a whole book (the chapters promote is about to ship).
 * The `summary` line is the prominent UNVERIFIED block the promote report prints:
 * it either names the unverified chapters or states that every chapter is
 * key-verified.
 */
export function resolveBookKeyEvidence(
  chapters: ChapterV21[],
  stateRoot?: string,
): BookKeyEvidence {
  const perChapter = chapters
    .map((ch) => resolveChapterKeyEvidence(ch, stateRoot))
    .sort((a, b) => a.chapterNumber - b.chapterNumber);
  const counts = {
    judgeVerified: perChapter.filter((c) => c.state === "judge-verified").length,
    readerVerified: perChapter.filter((c) => c.state === "reader-verified").length,
    unverified: perChapter.filter((c) => c.state === "unverified").length,
  };
  const unverifiedChapters = perChapter.filter((c) => c.state === "unverified").map((c) => c.chapterNumber);
  const summary =
    unverifiedChapters.length === 0
      ? `KEY EVIDENCE: all ${perChapter.length} chapter(s) key-verified (${counts.judgeVerified} judge, ${counts.readerVerified} reader).`
      : `⚠ KEY EVIDENCE UNVERIFIED for ${unverifiedChapters.length}/${perChapter.length} chapter(s): ${unverifiedChapters.map(pad).map((n) => `ch${n}`).join(", ")}. ` +
        `Their quiz answer keys have NO independent check (no fresh \`quiz-judge\` result and no reader review at the current content). ` +
        `Run \`quiz-judge <bookId>\` or re-review these chapters. (Advisory — does not block this promote.)`;
  return {
    schemaVersion: "quiz-key-evidence-v1",
    perChapter,
    counts,
    unverifiedChapters,
    summary,
  };
}
