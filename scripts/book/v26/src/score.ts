/** Scores a landed book 0 to 100 for the publish gate: per chapter, the share of the owner-calibrated judge's items that
 *  pass (`eval`, docs/eval/eval-items.md), with the book's hard gates on top: a chapter with an open blocking flag (a
 *  fact, a key, the render) can never pass unread. The score decides the band; the owner's thresholds live in the book
 *  config (`gate`, default 80 and 70). */
import * as fs from "node:fs";
import * as path from "node:path";
import { evalChapter, type ChapterStatus, type EvalResult, type PipelineCtx } from "./pipeline";

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
    const existing = opts.force ? null : readJson<EvalResult>(evalFile);
    const r = existing ?? (await evalChapter(ctx, path.join(dir, "final.json"), n, chapterName(n), evalDir));
    const status = readJson<ChapterStatus>(path.join(dir, "status.json"));
    const blocking = status ? status.open.filter((i) => i.blocking).length : 0;
    return {
      chapter: n,
      score: r.total > 0 ? round1((r.passCount / r.total) * 100) : 0,
      passCount: r.passCount,
      total: r.total,
      failed: r.items.filter((i) => !i.pass).map((i) => i.id),
      stage: status?.stage ?? "unknown",
      blocking,
      guessable: r.noChapterScores.length > 0 && r.noChapterScores.every((s) => s > 3),
    };
  }));
  const thresholds = thresholdsOf(ctx);
  const book: BookScore = { bookId: ctx.config.bookId, at: new Date().toISOString(), thresholds, chapters: scored, skipped, ...bandOf(scored, thresholds) };
  fs.mkdirSync(ctx.config.runDir, { recursive: true });
  fs.writeFileSync(path.join(ctx.config.runDir, "score.json"), JSON.stringify(book, null, 2) + "\n");
  return book;
}
