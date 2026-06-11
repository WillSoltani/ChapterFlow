/**
 * Catalog fingerprint audit — measures the CROSS-BOOK sameness no per-book
 * gate can see (2026-06-10 reader review: catalog variety 4/10, "one house
 * voice wearing 26 masks").
 *
 * The fingerprints, as found and hand-counted by the review:
 *   - one hook shape everywhere ([concrete image] + [ironic turn]; zero
 *     questions/direct-address/stats across all 26 chapter-1 hooks)
 *   - one tryThisNow grammar ("Write one X, then name Y" — "Write one" x175)
 *   - one quiz-opener family ("What should" x259, "Which response" x169)
 *   - house tic-phrases ("The point is" x240 across 26/26 books)
 *   - the scenario deadline tic (~37% of all 1,953 scenarios)
 *   - cross-book character reuse (Marta in 9 books; "Asha" starring in two
 *     books' chapter 1) — the smoking-gun churn tell
 *   - the distractor tell (keyed answer = longest choice → quiz guessable)
 *
 * This module turns each into a number so the remediation campaign has a
 * before/after and `catalog-gate` (Phase D) has thresholds. The composed
 * varietyScore is a TREND heuristic, not truth — the formula is documented
 * inline and deliberately simple; judge with the raw metrics.
 */

import { readdirSync, readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { ChapterV21 } from "../types.js";
import { parseChapterId } from "../lib/chapterPaths.js";
import { extractNamesFromText } from "../librarian/libraryState.js";
import { loadNameBank } from "../librarian/namePlan.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CHAPTERS_DIR = resolve(__dirname, "../../state/chapters");

/** Case-insensitive tic phrases counted across all reader-facing prose.
 *  Extend deliberately — every entry should trace to observed saturation.
 *  2026-06-10 qc-run sweeps added: "the hard edge" (undefined generator
 *  scaffolding in reader-facing copy across 18/20 TBKTS chapters + outliers'
 *  q09 closers) and "guardrail" (same class). */
export const HOUSE_TICS = ["the point is", "the question is", "that is the", "scoreboard", "the hard edge", "guardrail"] as const;

const DEADLINE_TIC = /\b(before the|before she|before he|before they|minutes before|must decide|must choose|must tell)\b/i;

export type HookShape = "question" | "direct_address" | "numeric" | "first_person" | "declarative_image";

export function classifyHook(hook: string): HookShape {
  const h = (hook ?? "").trim();
  if (/\?\s*$/.test(h)) return "question";
  if (/\b(you|your)\b/i.test(h)) return "direct_address";
  if (/\d/.test(h)) return "numeric";
  if (/\bI\b/.test(h)) return "first_person";
  return "declarative_image"; // the current house move
}

/** Leading imperative of a tryThisNow ("Write", "Name", "Pick", …). */
export function tryThisNowVerb(t: string): string {
  const m = (t ?? "").trim().match(/^([A-Za-z']+)/);
  return m ? m[1] : "(none)";
}

const THEN_NAME_TAIL = /\bthen (name|label|write|note)\b/i;

/** Normalized quiz-prompt opener: the generic-role family is bucketed. */
export function quizOpener(prompt: string): string {
  const p = (prompt ?? "").trim();
  const role = p.match(/^An? ([a-z]+(?: [a-z]+)?)\b/i);
  if (role && /^(team|founder|manager|friend|leader|colleague|coach|client|reader|volunteer|parent|teacher|nurse|developer|designer|writer|student|customer|boss|mentor)/i.test(role[1])) {
    return "a <role>";
  }
  const words = p.split(/\s+/).slice(0, 2).join(" ").toLowerCase();
  return words || "(none)";
}

export type BookAudit = {
  bookId: string;
  chapters: number;
  hookShapes: Record<string, number>;
  tryVerbs: Record<string, number>;
  thenNameTailRate: number;
  quizOpeners: Record<string, number>;
  ticCounts: Record<string, number>;
  scenarioCount: number;
  deadlineTicRate: number;
  correctLongestRate: number;
  bankNames: string[];
};

export type NameCollision = { name: string; books: string[] };

export type CatalogAuditReport = {
  generatedAt: string;
  bookCount: number;
  chapterCount: number;
  books: BookAudit[];
  catalog: {
    hookShapes: Record<string, number>;
    dominantHookShare: number;
    tryVerbs: Record<string, number>;
    dominantTryVerbShare: number;
    thenNameTailRate: number;
    quizOpeners: Record<string, number>;
    ticTotals: Record<string, number>;
    ticsPerChapter: number;
    deadlineTicRate: number;
    correctLongestRate: number;
    nameCollisions: NameCollision[];
    varietyScore: number;
  };
};

function bump(map: Record<string, number>, key: string, by = 1): void {
  map[key] = (map[key] ?? 0) + by;
}

function readerProse(ch: ChapterV21): string {
  const parts: string[] = [
    ch.hook ?? "", ch.counterintuition ?? "", ch.keyTakeaway ?? "", ch.tryThisNow ?? "",
    ch.breakdown?.fastRead ?? "", ch.breakdown?.deepRead ?? "", ch.breakdown?.fullRead ?? "",
  ];
  for (const e of ch.examples ?? []) parts.push(e.scenario ?? "", e.whatToDo ?? "", e.whyItMatters ?? "");
  for (const q of ch.quiz?.questions ?? []) parts.push(q.prompt ?? "", q.explanation ?? "", ...(q.choices ?? []));
  for (const c of ch.reviewCards ?? []) parts.push(String(c.front ?? ""), String(c.back ?? ""));
  for (const m of ch.memorableLines ?? []) parts.push(m?.text ?? "");
  if (ch.implementationPlan) parts.push(JSON.stringify(ch.implementationPlan));
  return parts.join("\n").toLowerCase();
}

export function auditBook(bookId: string, chapters: ChapterV21[]): BookAudit {
  const bank = new Set(loadNameBank());
  const a: BookAudit = {
    bookId,
    chapters: chapters.length,
    hookShapes: {},
    tryVerbs: {},
    thenNameTailRate: 0,
    quizOpeners: {},
    ticCounts: {},
    scenarioCount: 0,
    deadlineTicRate: 0,
    correctLongestRate: 0,
    bankNames: [],
  };
  const names = new Set<string>();
  let tryCount = 0, tailCount = 0;
  let deadlineHits = 0;
  let questions = 0, correctLongest = 0;
  for (const ch of chapters) {
    if (ch.hook) bump(a.hookShapes, classifyHook(ch.hook));
    if (ch.tryThisNow) {
      tryCount++;
      bump(a.tryVerbs, tryThisNowVerb(ch.tryThisNow));
      if (THEN_NAME_TAIL.test(ch.tryThisNow)) tailCount++;
    }
    for (const q of ch.quiz?.questions ?? []) {
      bump(a.quizOpeners, quizOpener(q.prompt));
      const keyed = q.correctIndex ?? (q as any).correctAnswerIndex;
      const choices = q.choices ?? [];
      if (typeof keyed === "number" && choices[keyed] !== undefined && choices.length > 1) {
        questions++;
        if (choices.every((c, i) => i === keyed || (c?.length ?? 0) < choices[keyed].length)) correctLongest++;
      }
    }
    for (const e of ch.examples ?? []) {
      a.scenarioCount++;
      if (DEADLINE_TIC.test(e.scenario ?? "")) deadlineHits++;
      for (const n of extractNamesFromText(`${e.scenario ?? ""} ${e.whatToDo ?? ""}`)) {
        if (bank.has(n)) names.add(n);
      }
    }
    const prose = readerProse(ch);
    for (const tic of HOUSE_TICS) {
      const hits = prose.split(tic).length - 1;
      if (hits > 0) bump(a.ticCounts, tic, hits);
    }
  }
  a.thenNameTailRate = tryCount > 0 ? tailCount / tryCount : 0;
  a.deadlineTicRate = a.scenarioCount > 0 ? deadlineHits / a.scenarioCount : 0;
  a.correctLongestRate = questions > 0 ? correctLongest / questions : 0;
  a.bankNames = [...names].sort();
  return a;
}

function dominantShare(map: Record<string, number>): number {
  const total = Object.values(map).reduce((s, n) => s + n, 0);
  if (total === 0) return 0;
  return Math.max(...Object.values(map)) / total;
}

/** 0–10 trend heuristic. Transparent on purpose:
 *  start at 10; subtract capped penalties for hook-shape concentration,
 *  tryThisNow-grammar concentration, cross-book name collisions, tic
 *  saturation, and the deadline tic. Judge with the raw metrics; this
 *  number exists so the campaign has a single line to move. */
export function varietyScore(c: CatalogAuditReport["catalog"], chapterCount: number): number {
  let score = 10;
  score -= Math.min(2.5, Math.max(0, c.dominantHookShare - 0.5) * 8);
  score -= Math.min(2.5, Math.max(0, c.dominantTryVerbShare - 0.4) * 8);
  score -= Math.min(2.5, c.nameCollisions.length * 0.25);
  score -= Math.min(1.5, c.ticsPerChapter / 2);
  score -= Math.min(1.0, Math.max(0, c.deadlineTicRate - 0.15) * 4);
  return Math.max(0, Math.round(score * 10) / 10);
}

export function auditCatalog(byBook: Map<string, ChapterV21[]>): CatalogAuditReport {
  const books = [...byBook.entries()]
    .sort((x, y) => (x[0] < y[0] ? -1 : 1))
    .map(([bookId, chapters]) => auditBook(bookId, chapters));

  const hookShapes: Record<string, number> = {};
  const tryVerbs: Record<string, number> = {};
  const quizOpeners: Record<string, number> = {};
  const ticTotals: Record<string, number> = {};
  const nameToBooks = new Map<string, string[]>();
  let chapterCount = 0, scenarioCount = 0, deadlineHits = 0;
  let tailRateNum = 0, tailRateDen = 0;
  let clNum = 0, clDen = 0;
  for (const b of books) {
    chapterCount += b.chapters;
    for (const [k, v] of Object.entries(b.hookShapes)) bump(hookShapes, k, v);
    for (const [k, v] of Object.entries(b.tryVerbs)) bump(tryVerbs, k, v);
    for (const [k, v] of Object.entries(b.quizOpeners)) bump(quizOpeners, k, v);
    for (const [k, v] of Object.entries(b.ticCounts)) bump(ticTotals, k, v);
    scenarioCount += b.scenarioCount;
    deadlineHits += Math.round(b.deadlineTicRate * b.scenarioCount);
    tailRateNum += b.thenNameTailRate * b.chapters;
    tailRateDen += b.chapters;
    clNum += b.correctLongestRate * b.chapters;
    clDen += b.chapters;
    for (const n of b.bankNames) {
      if (!nameToBooks.has(n)) nameToBooks.set(n, []);
      nameToBooks.get(n)!.push(b.bookId);
    }
  }
  const nameCollisions: NameCollision[] = [...nameToBooks.entries()]
    .filter(([, bs]) => bs.length >= 2)
    .map(([name, bs]) => ({ name, books: bs }))
    .sort((a, b) => b.books.length - a.books.length);

  const catalog = {
    hookShapes,
    dominantHookShare: dominantShare(hookShapes),
    tryVerbs,
    dominantTryVerbShare: dominantShare(tryVerbs),
    thenNameTailRate: tailRateDen > 0 ? tailRateNum / tailRateDen : 0,
    quizOpeners,
    ticTotals,
    ticsPerChapter: chapterCount > 0 ? Object.values(ticTotals).reduce((s, n) => s + n, 0) / chapterCount : 0,
    deadlineTicRate: scenarioCount > 0 ? deadlineHits / scenarioCount : 0,
    correctLongestRate: clDen > 0 ? clNum / clDen : 0,
    nameCollisions,
    varietyScore: 0,
  };
  catalog.varietyScore = varietyScore(catalog, chapterCount);
  return {
    generatedAt: new Date().toISOString(),
    bookCount: books.length,
    chapterCount,
    books,
    catalog,
  };
}

/** Load every book in state/chapters, grouped by normalized bookId. */
export function loadCatalog(filterBookId?: string): Map<string, ChapterV21[]> {
  const byBook = new Map<string, ChapterV21[]>();
  for (const f of readdirSync(CHAPTERS_DIR).filter((f) => f.endsWith(".chapter.json")).sort()) {
    try {
      const ch = JSON.parse(readFileSync(resolve(CHAPTERS_DIR, f), "utf8")) as ChapterV21;
      const parsed = ch.chapterId ? parseChapterId(ch.chapterId) : null;
      if (!parsed) continue;
      if (filterBookId && parsed.bookId !== filterBookId) continue;
      if (!byBook.has(parsed.bookId)) byBook.set(parsed.bookId, []);
      byBook.get(parsed.bookId)!.push(ch);
    } catch {
      // unreadable chapter — skip; state-status surfaces those
    }
  }
  return byBook;
}

export function formatCatalogAudit(r: CatalogAuditReport): string {
  const lines: string[] = [];
  const c = r.catalog;
  const top = (m: Record<string, number>, n: number) =>
    Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${k}:${v}`).join("  ");
  lines.push(`Catalog audit — ${r.bookCount} book(s), ${r.chapterCount} chapter(s)`);
  lines.push(`  variety score: ${c.varietyScore}/10  (trend heuristic — see raw metrics)`);
  lines.push(`  hook shapes: ${top(c.hookShapes, 6)}  (dominant share ${(c.dominantHookShare * 100).toFixed(0)}%)`);
  lines.push(`  tryThisNow verbs: ${top(c.tryVerbs, 6)}  (dominant share ${(c.dominantTryVerbShare * 100).toFixed(0)}%; "then name/label" tail ${(c.thenNameTailRate * 100).toFixed(0)}%)`);
  lines.push(`  quiz openers: ${top(c.quizOpeners, 6)}`);
  lines.push(`  house tics: ${Object.entries(c.ticTotals).map(([k, v]) => `"${k}":${v}`).join("  ")}  (${c.ticsPerChapter.toFixed(2)}/chapter)`);
  lines.push(`  scenario deadline tic: ${(c.deadlineTicRate * 100).toFixed(0)}% of scenarios`);
  lines.push(`  distractor tell (keyed answer is longest): ${(c.correctLongestRate * 100).toFixed(0)}% of questions`);
  lines.push(`  cross-book name collisions: ${c.nameCollisions.length}`);
  for (const col of c.nameCollisions.slice(0, 10)) {
    lines.push(`    ${col.name}: ${col.books.length} books (${col.books.slice(0, 6).join(", ")}${col.books.length > 6 ? ", …" : ""})`);
  }
  lines.push("");
  lines.push("  per-book:");
  const w = Math.max(...r.books.map((b) => b.bookId.length), 8);
  for (const b of r.books) {
    const tics = Object.values(b.ticCounts).reduce((s, n) => s + n, 0);
    lines.push(
      `    ${b.bookId.padEnd(w)}  ch:${String(b.chapters).padStart(3)}  hooks[${top(b.hookShapes, 2)}]  try[${top(b.tryVerbs, 2)}]  tics:${tics}  deadline:${(b.deadlineTicRate * 100).toFixed(0)}%  tell:${(b.correctLongestRate * 100).toFixed(0)}%`,
    );
  }
  return lines.join("\n");
}
