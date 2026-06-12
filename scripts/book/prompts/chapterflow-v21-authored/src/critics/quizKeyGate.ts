/**
 * Quiz answer-key gate — persistence + enforcement for the model-backed
 * answer-key judge (src/critics/semantic/quizKeyJudge.ts).
 *
 * The deterministic gates can only check that `correctIndex` is in range, not
 * that it points at the RIGHT choice — the blind spot that shipped `hooked`
 * with 21/72 wrong keys past a GREEN gate. The judge that closes it is async +
 * model-backed, so it cannot live inside the sync, offline promote gate.
 * Instead `quiz-judge <bookId>` runs the judge once and writes a per-chapter
 * result here; the sync gate (promote / gate-chapter) reads that result and
 * ENFORCES it — so the catch is independent of any single agent's honesty,
 * which is what makes it safe to let one agent both write AND QC a book.
 *
 *   - DEFAULT: a FRESH result (its content hash still matches the chapter) that
 *     flagged a confident wrong key BLOCKS promote (QC1.wrong_quiz_key). A
 *     missing or stale result does NOT block (backward compatible; a stale
 *     result's flags may already be fixed by the edit that staled it, and that
 *     same edit also stales the QC attestation → forces human re-review).
 *   - REQUIRE mode (`require: true`, wired from CHAPTERFLOW_REQUIRE_KEYJUDGE=1):
 *     every chapter must carry a FRESH CLEAN result, else it blocks
 *     (QC1.keyjudge_missing / QC1.keyjudge_stale). Use this for the single-agent
 *     (Codex generates AND QCs) topology, where "did the judge run?" must not be
 *     left to the agent's discretion.
 *
 * Freshness reuses the v2 content hash from qcAttestation, so the staleness
 * model is identical to the attestation gate's.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

import { ChapterV21 } from "../types.js";
import { CANONICAL_STATE, parseChapterId } from "../lib/chapterPaths.js";
import { chapterContentHash } from "./qcAttestation.js";
import type { QuizKeyReport } from "./semantic/quizKeyJudge.js";

/** Same directory as the QC attestations — these are sibling QC artifacts. */
export const QC_DIR = resolve(CANONICAL_STATE, "qc");

export type FlaggedKey = {
  questionId: string;
  storedIndex: number;
  modelIndex: number;
  modelCorrectText: string;
  reason: string;
};

export type QuizKeyJudgeRecord = {
  schemaVersion: "quiz-keyjudge-v1";
  bookId: string;
  chapterNumber: number;
  chapterId: string;
  judgedAt: string;
  /** model that produced the verdicts (audit). */
  model: string;
  /** who ran the judge, e.g. "keyjudge:openai-api". */
  reviewer: string;
  /** v2 content hash captured at judge time (same algorithm as attestations). */
  contentHash: string;
  hashVersion: "v2";
  questionsJudged: number;
  /** Confident disagreements — the wrong-key findings that BLOCK while fresh. */
  flagged: FlaggedKey[];
  /** Medium-confidence disagreements — surfaced for a human read, never block. */
  review: FlaggedKey[];
};

export function keyJudgePath(bookId: string, chapterNumber: number): string {
  return resolve(QC_DIR, `${bookId}-ch${String(chapterNumber).padStart(2, "0")}.keyjudge.json`);
}

export function loadKeyJudge(bookId: string, chapterNumber: number): QuizKeyJudgeRecord | null {
  const p = keyJudgePath(bookId, chapterNumber);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8")) as QuizKeyJudgeRecord;
  } catch {
    return null;
  }
}

export function writeKeyJudge(rec: QuizKeyJudgeRecord): string {
  mkdirSync(QC_DIR, { recursive: true });
  const p = keyJudgePath(rec.bookId, rec.chapterNumber);
  writeFileSync(p, JSON.stringify(rec, null, 2), "utf8");
  return p;
}

/** Whether the recorded result still describes the chapter as it is now. */
export function isKeyJudgeFresh(rec: QuizKeyJudgeRecord, chapter: ChapterV21): boolean {
  return rec.contentHash === chapterContentHash(chapter);
}

/** Build a record from a judge report + the chapter it judged, stamping the
 *  CURRENT content hash so any later edit makes the record stale. */
export function recordFromReport(
  report: QuizKeyReport,
  chapter: ChapterV21,
  opts: { bookId: string; reviewer: string; now: string },
): QuizKeyJudgeRecord {
  const toFlagged = (v: { questionId: string; storedIndex: number; modelIndex: number; modelCorrectText: string; reason: string }): FlaggedKey => ({
    questionId: v.questionId,
    storedIndex: v.storedIndex,
    modelIndex: v.modelIndex,
    modelCorrectText: v.modelCorrectText,
    reason: v.reason,
  });
  return {
    schemaVersion: "quiz-keyjudge-v1",
    bookId: opts.bookId,
    chapterNumber: chapter.number,
    chapterId: chapter.chapterId!,
    judgedAt: opts.now,
    model: report.model,
    reviewer: opts.reviewer,
    contentHash: chapterContentHash(chapter),
    hashVersion: "v2",
    questionsJudged: report.questionsJudged,
    flagged: report.flagged.map(toFlagged),
    review: report.review.map(toFlagged),
  };
}

export type KeyJudgeFinding = { checkId: string; severity: "blocker" | "advisory"; message: string };

/**
 * The gate check. `enforce` true → "blocker" (promote); false → "advisory"
 * (gate-chapter, so authoring iteration is never blocked by this). `require`
 * true → a chapter with no FRESH result fails (missing/stale block); false →
 * only a fresh result that flagged a wrong key blocks.
 */
export function checkKeyJudge(chapter: ChapterV21, enforce: boolean, require = false): KeyJudgeFinding[] {
  const sev: "blocker" | "advisory" = enforce ? "blocker" : "advisory";
  const parsed = chapter.chapterId ? parseChapterId(chapter.chapterId) : null;
  const bookId = parsed?.bookId ?? "";
  const rec = loadKeyJudge(bookId, chapter.number);

  if (!rec) {
    return require
      ? [{ checkId: "QC1.keyjudge_missing", severity: sev,
          message: `No quiz answer-key judge result for ${bookId}-ch${chapter.number}. Run \`quiz-judge ${bookId}\` (require mode is on).` }]
      : [];
  }
  if (!isKeyJudgeFresh(rec, chapter)) {
    return require
      ? [{ checkId: "QC1.keyjudge_stale", severity: sev,
          message: `Quiz answer-key judge result for ${bookId}-ch${chapter.number} is STALE (chapter changed since judged). Re-run \`quiz-judge ${bookId}\`.` }]
      : [];
  }
  if (rec.flagged.length > 0) {
    const sample = rec.flagged
      .slice(0, 5)
      .map((f) => `${f.questionId} (stored ${f.storedIndex}, model says ${f.modelIndex})`)
      .join("; ");
    return [{ checkId: "QC1.wrong_quiz_key", severity: sev,
      message: `Quiz answer-key judge flagged ${rec.flagged.length} confident wrong key(s) in ${bookId}-ch${chapter.number}: ${sample}${rec.flagged.length > 5 ? ", …" : ""}. Fix the keys (or the questions), then re-run \`quiz-judge\`.` }];
  }
  return [];
}
