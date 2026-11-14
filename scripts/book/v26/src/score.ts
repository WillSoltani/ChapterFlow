/** Scores a landed book 0 to 100 for the publish gate: per chapter, the share of the owner-calibrated judge's items that
 *  pass (`eval`, docs/eval/eval-items.md), with the book's hard gates on top: a chapter with an open blocking flag (a
 *  fact, a key, the render) can never pass unread. The score decides the band; the owner's thresholds live in the book
 *  config (`gate`, default 80 and 70). */
import * as fs from "node:fs";
import * as path from "node:path";
import { evalChapter, JUDGE_VERSION, type ChapterStatus, type EvalResult, type PipelineCtx } from "./pipeline";

export interface ChapterScore {
  chapter: number;
  score: number;
  passCount: number;
  total: number;
  failed: string[];
  stage: string;
  blocking: number;
  /** Every no-chapter solver run got more than 3 of the first 5 keys right without reading: the quiz is guessable. */
  guessable: boolean;
  /** The kinds of judge item (TRY, ARC-fastRead, QUIZ, TEMPT, ...) that failed in at least half their items here. */
  weak?: string[];
}

export type Band = "auto" | "manual" | "fail";

export interface BookScore {
  bookId: string;
  at: string;
  thresholds: { auto: number; manual: number };
  chapters: ChapterScore[];
  skipped: number[];
  mean: number;
  min: number;
  score: number;
  band: Band;
  reasons: string[];
  /** Chapters to write again before another try: under the manual bar, or with an open blocking flag. */
  redo: number[];
  /** The judge that gave this score (JUDGE_VERSION); the publish gate refuses a score from another judge. */
  judgeVersion?: number;
}

const chapterName = (n: number): string => `ch${String(n).padStart(2, "0")}`;
const round1 = (x: number): number => Math.round(x * 10) / 10;

function readJson<T>(file: string): T | null {
  return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as T) : null;
}

/** Up to `limit` of the thunks run at once; every result is awaited. */
async function pool<T>(limit: number, thunks: Array<() => Promise<T>>): Promise<T[]> {
  const out: T[] = new Array(thunks.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < thunks.length) {
      const i = next++;
      out[i] = await thunks[i]!();
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, thunks.length)) }, worker));
  return out;
}

/** The kind of a judge item: the per-part families share one kind (EX, EXFIT, QUIZ, TEMPT, KEY, TELL, CARD); every other id is its own. */
export function kindOf(id: string): string {
  const m = /^(EXFIT|EX|QUIZ|TEMPT|KEY|TELL|CARD)-/.exec(id);
  return m ? m[1]! : id;
}

/** The kinds that failed in at least half their items in one chapter. */
export function weakKinds(items: Array<{ id: string; pass: boolean }>): string[] {
  const seen = new Map<string, { fail: number; total: number }>();
  for (const i of items) {
    const k = seen.get(kindOf(i.id)) ?? { fail: 0, total: 0 };
    k.total++;
    if (!i.pass) k.fail++;
    seen.set(kindOf(i.id), k);
  }
  return [...seen].filter(([, v]) => v.fail * 2 >= v.total).map(([k]) => k).sort();
}

/** A repeat needs a population: the rule applies from this many chapters up. */
const REPEAT_MIN_CHAPTERS = 4;

export function thresholdsOf(ctx: PipelineCtx): { auto: number; manual: number } {
  return ctx.config.gate ?? { auto: 80, manual: 70 };
}

/** The band for a scored book: `auto` only when the mean clears the bar, no chapter is under the manual bar and no
 *  blocking flag is open; `fail` when the mean is under the manual bar; `manual` otherwise, with the reasons. */
export function bandOf(chapters: ChapterScore[], thresholds: { auto: number; manual: number }): { score: number; mean: number; min: number; band: Band; reasons: string[]; redo: number[] } {
  if (chapters.length === 0) return { score: 0, mean: 0, min: 0, band: "fail", reasons: ["no chapter was scored"], redo: [] };
  const mean = round1(chapters.reduce((s, c) => s + c.score, 0) / chapters.length);
  const min = Math.min(...chapters.map((c) => c.score));
  const reasons: string[] = [];
  const flagged = chapters.filter((c) => c.blocking > 0).map((c) => c.chapter);
  const low = chapters.filter((c) => c.score < thresholds.manual).map((c) => c.chapter);
  if (flagged.length > 0) reasons.push(`open blocking flags in ${flagged.map(chapterName).join(", ")}`);
  if (low.length > 0) reasons.push(`under ${thresholds.manual} in ${low.map(chapterName).join(", ")}`);
  // A flaw repeated across the book costs about one item in sixty per chapter, so the mean hides it; a reader meets it in
  // every chapter. A kind that is weak in at least half the chapters holds the book for the owner, by name.
  if (chapters.length >= REPEAT_MIN_CHAPTERS) {
    const counts = new Map<string, number>();
    for (const c of chapters) for (const k of c.weak ?? []) counts.set(k, (counts.get(k) ?? 0) + 1);
    for (const [k, n] of [...counts].sort(([a], [b]) => a.localeCompare(b))) {
      if (n * 2 >= chapters.length) reasons.push(`${k} fails in ${n} of ${chapters.length} chapters`);
    }
  }
  const redo = [...new Set([...flagged, ...low])].sort((a, b) => a - b);
  if (mean < thresholds.manual) return { score: mean, mean, min, band: "fail", reasons: [`mean ${mean} is under ${thresholds.manual}`, ...reasons], redo };
  if (mean >= thresholds.auto && reasons.length === 0) return { score: mean, mean, min, band: "auto", reasons: [], redo: [] };
  if (mean < thresholds.auto) reasons.unshift(`mean ${mean} is under ${thresholds.auto}`);
  return { score: mean, mean, min, band: "manual", reasons, redo };
}

/** Scores the given chapters (every landed one by default). An existing `<runDir>/eval/chNN.eval.json` is reused unless
 *  `force`; a chapter without final.json is skipped and listed. Writes `<runDir>/score.json`. */
export async function scoreBook(ctx: PipelineCtx, chapters: number[], opts: { force?: boolean } = {}): Promise<BookScore> {
  const evalDir = path.join(ctx.config.runDir, "eval");
  const landed = chapters.filter((n) => fs.existsSync(path.join(ctx.config.runDir, chapterName(n), "final.json")));
  const skipped = chapters.filter((n) => !landed.includes(n));
  const scored = await pool(ctx.config.concurrency, landed.map((n) => async (): Promise<ChapterScore> => {
    const dir = path.join(ctx.config.runDir, chapterName(n));
    const evalFile = path.join(evalDir, `${chapterName(n)}.eval.json`);
    const fresh = fs.existsSync(evalFile) && fs.statSync(evalFile).mtimeMs >= fs.statSync(path.join(dir, "final.json")).mtimeMs;
    const saved = opts.force || !fresh ? null : readJson<EvalResult>(evalFile);
    // A saved eval the judge left incomplete (ids missing, or nothing at all), or one from another judge version (a
    // missing stamp counts as another), is asked again, not trusted: one book is never scored by two judges.
    const existing = saved && saved.total > 0 && saved.missingIds.length === 0 && saved.judgeVersion === JUDGE_VERSION ? saved : null;
    const r = existing ?? (await evalChapter(ctx, path.join(dir, "final.json"), n, chapterName(n), evalDir));
    const status = readJson<ChapterStatus>(path.join(dir, "status.json"));
    const blocking = status ? status.open.filter((i) => i.blocking).length : 0;
    return {
      chapter: n,
      // An item the judge never answered counts as failed: an incomplete answer must not lift a chapter into the auto band.
      score: r.total + r.missingIds.length > 0 ? round1((r.passCount / (r.total + r.missingIds.length)) * 100) : 0,
      passCount: r.passCount,
      total: r.total + r.missingIds.length,
      failed: [...r.items.filter((i) => !i.pass).map((i) => i.id), ...r.missingIds],
      stage: status?.stage ?? "unknown",
      blocking,
      guessable: r.noChapterScores.length > 0 && r.noChapterScores.every((s) => s > 3),
      weak: weakKinds([...r.items, ...r.missingIds.map((id) => ({ id, pass: false }))]),
    };
  }));
  const thresholds = thresholdsOf(ctx);
  const book: BookScore = { bookId: ctx.config.bookId, at: new Date().toISOString(), thresholds, chapters: scored, skipped, ...bandOf(scored, thresholds), judgeVersion: JUDGE_VERSION };
  fs.mkdirSync(ctx.config.runDir, { recursive: true });
  fs.writeFileSync(path.join(ctx.config.runDir, "score.json"), JSON.stringify(book, null, 2) + "\n");
  return book;
}
