/**
 * Answer-key plan — namePlan's prevention pattern applied to quiz correctIndex.
 *
 * THE PROBLEM (F3): a single author writing 13 chapters in one long session
 * loses answer-position discipline as it goes — the-book-of-boundaries was a
 * clean 3-3-3 in ch1-4 then collapsed to 7-of-9 at index 0 by ch13. F3 only
 * DETECTS this at book-gate (any position ≥45% of all questions); it never
 * prevents it. Parallel blind authors can't see the book-wide ceiling at all.
 *
 * The fix is PREVENTION: deal each chapter a balanced target correctIndex
 * distribution BEFORE authoring. The author scores each question for truth
 * first, then arranges the (unchanged) choices so the correct answer lands at
 * the planned position. The book aggregates to ~1/P per position by
 * construction — provably under the 0.45 ceiling.
 *
 * Deterministic (no RNG), like namePlan/shapePlan/venuePlan:
 *   - the per-chapter remainder offset + sequence rotation are FNV-1a(bookId#n),
 *     so books don't share a global sequence and chapters differ from each other.
 *   - NOT carried from disk: the target is always the balanced deal, so a
 *     re-dispatch of an imbalanced chapter hands the SAME target and converges.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import type { ChapterV21 } from "../types.js";
import { fnv1a } from "../lib/fnv1a.js";

const __dirname = dirname(fileURLToPath(import.meta.url)); // .../src/librarian
const ANSWER_KEY_PLANS_DIR = resolve(__dirname, "../../state/answer-key-plans");

/** Corpus quizzes are 3-choice; the F3 ceiling is per-position regardless of P. */
export const DEFAULT_POSITIONS = 3;
export const DEFAULT_QUESTIONS = 9;
/** Hard aggregate ceiling the deal must stay strictly under (F3 blocks at 0.45). */
export const AGGREGATE_CEILING = 0.4;

export type AnswerKeyPlan = {
  schemaVersion: "answer-key-plan-v1";
  bookId: string;
  createdAt: string;
  questionsPerChapter: number;
  positions: number;
  /** chapter number → target correctIndex sequence (balanced, distinct per chapter). */
  allocation: Record<number, number[]>;
  /** book-wide position counts + the largest position fraction (must be < AGGREGATE_CEILING). */
  aggregate: { counts: number[]; maxFraction: number };
};

/** Balanced position counts for Q questions over P positions; the remainder
 *  (when Q is not divisible by P) is spread starting at `offset` so it rotates
 *  across chapters and the book aggregate stays even. */
export function balancedCounts(questions: number, positions: number, offset: number): number[] {
  const base = Math.floor(questions / positions);
  const counts = new Array(positions).fill(base);
  let remainder = questions % positions;
  for (let k = 0; remainder > 0; k++, remainder--) counts[(offset + k) % positions]++;
  return counts;
}

/** Deterministic PRNG (mulberry32) — pure arithmetic, no Math.random, so the
 *  deal is reproducible. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A balanced correctIndex sequence: the balanced multiset, deterministically
 *  SHUFFLED per (bookId, chapter, salt). A shuffle (not a rotation) is required
 *  so chapters get genuinely distinct orderings — otherwise every chapter is a
 *  cyclic rotation of one base and followable targets would collide (→ AS12). */
function balancedSequence(bookId: string, chapterNumber: number, questions: number, positions: number, salt = 0): number[] {
  const offset = fnv1a(`${bookId}#${chapterNumber}`) % positions;
  const counts = balancedCounts(questions, positions, offset);
  const seq: number[] = [];
  counts.forEach((c, idx) => { for (let k = 0; k < c; k++) seq.push(idx); });
  const rand = mulberry32(fnv1a(`${bookId}:seq:${chapterNumber}:${salt}`));
  for (let i = seq.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [seq[i], seq[j]] = [seq[j], seq[i]];
  }
  return seq;
}

export function planAnswerKeys(
  bookId: string,
  from: number,
  to: number,
  questionsPerChapter = DEFAULT_QUESTIONS,
  positions = DEFAULT_POSITIONS,
): AnswerKeyPlan {
  const allocation: Record<number, number[]> = {};
  const seen = new Set<string>();
  // Iterate from chapter 1 (not `from`) so a single-chapter redo resolves collisions
  // against the SAME prior chapters as the full-book deal — making each chapter's
  // target a pure function of (bookId, n, Q, P), independent of the requested range.
  // Only chapters in [from, to] are emitted.
  for (let n = 1; n <= to; n++) {
    // Keep targets distinct across chapters: a followable duplicate would trip
    // AS12 (cross-chapter quiz-position sequence). Re-shuffle with a bumped salt
    // on collision (re-shuffle, not rotate — rotations stay in the same family).
    let seq = balancedSequence(bookId, n, questionsPerChapter, positions);
    let salt = 1;
    while (seen.has(seq.join("")) && salt <= 64) {
      seq = balancedSequence(bookId, n, questionsPerChapter, positions, salt);
      salt++;
    }
    seen.add(seq.join(""));
    if (n >= from) allocation[n] = seq;
  }
  const counts = new Array(positions).fill(0);
  let total = 0;
  for (const seq of Object.values(allocation)) {
    for (const idx of seq) {
      counts[idx]++;
      total++;
    }
  }
  const emitted = Math.max(0, to - from + 1);
  const maxFraction = total > 0 ? Math.max(...counts) / total : 0;
  // The aggregate ceiling is a BOOK-wide guarantee; only assert it for a full/large
  // range (>=5 chapters, F3's threshold). A 1-chapter redo with a non-divisible
  // question count (e.g. Q=10 → 4/10) is balanced book-wide once the remainder rotates.
  if (emitted >= 5 && maxFraction >= AGGREGATE_CEILING) {
    throw new Error(
      `answer-key-plan invariant violated: max position fraction ${maxFraction.toFixed(3)} >= ${AGGREGATE_CEILING} (F3 risk). counts=${counts.join(",")}.`,
    );
  }
  return {
    schemaVersion: "answer-key-plan-v1",
    bookId,
    createdAt: new Date().toISOString(),
    questionsPerChapter,
    positions,
    allocation,
    aggregate: { counts, maxFraction },
  };
}

export function answerKeyPlanPath(bookId: string): string {
  return resolve(ANSWER_KEY_PLANS_DIR, `${bookId}.answer-key-plan.json`);
}

export function writeAnswerKeyPlan(plan: AnswerKeyPlan): string {
  mkdirSync(ANSWER_KEY_PLANS_DIR, { recursive: true });
  const p = answerKeyPlanPath(plan.bookId);
  writeFileSync(p, JSON.stringify(plan, null, 2), "utf8");
  return p;
}

export function loadAnswerKeyPlan(bookId: string): AnswerKeyPlan | null {
  const p = answerKeyPlanPath(bookId);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8")) as AnswerKeyPlan;
  } catch {
    return null;
  }
}

export type AnswerBalanceFinding = {
  checkId: "AK1.answer_distribution_drift";
  severity: "advisory";
  chapterNumber: number;
  message: string;
};

/** Advisory: does this chapter's actual correctIndex DISTRIBUTION (counts per
 *  position, what F3 sums) match the dealt target? Sequence order is the
 *  author's (and AS12's) concern; only the multiset matters for the book-wide
 *  ceiling. Returns [] when no plan exists or the counts match. */
export function checkChapterAnswerBalance(chapter: ChapterV21, plan: AnswerKeyPlan | null): AnswerBalanceFinding[] {
  if (!plan) return [];
  const target = plan.allocation[chapter.number];
  if (!Array.isArray(target)) return [];
  const positions = plan.positions;
  const actualCounts = new Array(positions).fill(0);
  for (const q of chapter.quiz?.questions ?? []) {
    const idx = q?.correctIndex;
    if (typeof idx === "number" && idx >= 0 && idx < positions) actualCounts[idx]++;
  }
  const targetCounts = new Array(positions).fill(0);
  for (const idx of target) if (idx >= 0 && idx < positions) targetCounts[idx]++;
  const matches = actualCounts.every((c, i) => c === targetCounts[i]);
  if (matches) return [];
  return [{
    checkId: "AK1.answer_distribution_drift",
    severity: "advisory",
    chapterNumber: chapter.number,
    message: `Answer-position distribution [${actualCounts.join(",")}] deviates from the dealt target [${targetCounts.join(",")}]. Re-arrange the (unchanged) choices so the correct answers land on the target positions — this keeps the book under the F3 ${Math.round(AGGREGATE_CEILING * 100)}% ceiling. (Score each question for truth FIRST; never change which choice is correct.)`,
  }];
}
