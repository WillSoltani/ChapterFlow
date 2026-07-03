/**
 * bookRubricMetrics — the in-pipeline rubric pre-flight (P04).
 *
 * WHAT IT MEASURES
 * ----------------
 * For every ASSEMBLED chapter of a book it computes the deterministic half of
 * the post-publish rubric (via P01's src/metrics/rubricMetrics.ts) and issues a
 * per-metric verdict against config/rubric-thresholds.json:
 *
 *   fleschEase ................. breakdown-only, score.py-parity input → GATE
 *   fkGrade .................... breakdown-only → ADVISORY (warn-only). The
 *       rubric's enforceable readability commitment is the EASE band; its FK
 *       "~7–8" is descriptive. Review calibration on the real catalog showed
 *       the BEST books read easier than the band (atomic-habits breakdown FK
 *       ≈ 4.2 → 20/20 chapters would have failed a two-sided FK gate), so an
 *       FK-min gate contradicts the rubric's own exemplars. Easier-than-band
 *       is not a defect in a beginner product.
 *   fleschEaseWhole / fkGradeWhole  whole assembled chapter → ADVISORY diagnostic
 *   tellRate ................... distractor-tell as a fraction 0..1 → GATE
 *   transferRatio ............. transfer as a fraction 0..1 → GATE
 *   memorableClean ............ clean (≤14-word) memorable lines → GATE
 *   houseTicDensity ........... chapter-prose tic count → WARN-ONLY diagnostic
 *   nominalizationRate ........ breakdown nominalization % → WARN-ONLY diagnostic
 *
 * The GATE metrics can drive a chapter to `fail`; ADVISORY/WARN-ONLY metrics can
 * only ever raise a chapter to `warn` (never `fail`) — they are diagnostic
 * signals score.py reports without a hard rubric cutoff, so failing on them
 * would risk false positives against the published catalog.
 *
 * ARTIFACT — state/books/<bookId>.rubric-metrics.json
 * ---------------------------------------------------
 * {
 *   schemaVersion: "rubric-metrics-v1",
 *   bookId, generatedAt,
 *   thresholds: <the resolved RubricThresholds>,
 *   chapters: [ ChapterRubricMetrics, ... ],   // per chapter, book order
 *   summary: { pass, warn, fail },             // chapter verdict counts
 *   verdict: "pass" | "warn" | "fail",         // worst chapter verdict
 *   findings: string[]                          // chapters that could not be measured
 * }
 * Each ChapterRubricMetrics carries every metric as { value, verdict, note? }
 * plus a chapter-level verdict and the list of failing GATE-metric keys.
 *
 * This module is PURE (no fs beyond the threshold-config read done by the loader
 * it calls, and no chapter loading unless asked). The CLI verb owns writing the
 * artifact; risk scoring owns reading it. See src/cli.ts `rubric-metrics` and
 * src/risk/chapterRisk.ts.
 */

import type { ChapterV21 } from "../types.js";
import { loadBookChapters } from "../qc/manualKeyJudge.js";
import { readJsonFile, rubricMetricsPath, type CompilerStoreRoots } from "../artifacts/artifactStore.js";
import { normSlug } from "../lib/chapterPaths.js";
import { breakdownProse, chapterProse, readerVisibleText } from "./chapterText.js";
import {
  cleanMemorableLineCount,
  distractorTellRate,
  houseTicDensity,
  nominalizationRate,
  readabilityMetrics,
  transferRatio,
} from "./rubricMetrics.js";
import { loadRubricThresholds, type MetricBand, type RubricThresholds } from "./rubricThresholds.js";

export const RUBRIC_METRICS_SCHEMA_VERSION = "rubric-metrics-v1" as const;

export type MetricVerdict = "pass" | "warn" | "fail";

export type MetricResult = { value: number; verdict: MetricVerdict; note?: string };

export type ChapterRubricMetrics = {
  chapterId: string;
  chapterNumber: number;
  metrics: {
    fleschEase: MetricResult;
    fkGrade: MetricResult;
    fleschEaseWhole: MetricResult;
    fkGradeWhole: MetricResult;
    tellRate: MetricResult;
    transferRatio: MetricResult;
    memorableClean: MetricResult;
    houseTicDensity: MetricResult;
    nominalizationRate: MetricResult;
  };
  /** Worst verdict across the GATE metrics (advisory/warn-only excluded from fail). */
  verdict: MetricVerdict;
  /** GATE-metric keys currently at `fail`. */
  failing: string[];
};

export type BookRubricMetricsReport = {
  schemaVersion: typeof RUBRIC_METRICS_SCHEMA_VERSION;
  bookId: string;
  generatedAt: string;
  thresholds: RubricThresholds;
  chapters: ChapterRubricMetrics[];
  summary: { pass: number; warn: number; fail: number };
  verdict: MetricVerdict;
  findings: string[];
};

const WORST: Record<MetricVerdict, number> = { pass: 0, warn: 1, fail: 2 };

function worst(a: MetricVerdict, b: MetricVerdict): MetricVerdict {
  return WORST[a] >= WORST[b] ? a : b;
}

/** A two-sided band verdict: inside [min,max] passes; within warnTolerance of the
 *  band is warn; further out is fail. NaN (degenerate/unmeasurable prose) is a
 *  cautious `warn`, never a fail — a real assembled chapter always has words, so
 *  NaN means "could not measure", not "bad", and must not create false positives. */
function bandVerdict(value: number, band: MetricBand): MetricResult {
  if (!Number.isFinite(value)) return { value, verdict: "warn", note: "unmeasurable (no words/sentences)" };
  if (value >= band.min && value <= band.max) return { value, verdict: "pass" };
  if (value >= band.min - band.warnTolerance && value <= band.max + band.warnTolerance) {
    return { value, verdict: "warn", note: `outside [${band.min},${band.max}] but within ±${band.warnTolerance}` };
  }
  return { value, verdict: "fail", note: `outside [${band.min},${band.max}] by more than ±${band.warnTolerance}` };
}

/** A one-sided max: pass when value <= max, fail when above. NaN → warn. */
function maxVerdict(value: number, max: number, label: string): MetricResult {
  if (!Number.isFinite(value)) return { value, verdict: "warn", note: `unmeasurable ${label}` };
  return value <= max ? { value, verdict: "pass" } : { value, verdict: "fail", note: `${label} ${round(value)} exceeds max ${max}` };
}

/** A one-sided min: pass when value >= min, fail when below. NaN → warn. */
function minVerdict(value: number, min: number, label: string): MetricResult {
  if (!Number.isFinite(value)) return { value, verdict: "warn", note: `unmeasurable ${label}` };
  return value >= min ? { value, verdict: "pass" } : { value, verdict: "fail", note: `${label} ${round(value)} below min ${min}` };
}

/** A warn-only max: pass when value <= max, else WARN (never fail). Diagnostic. */
function warnOnlyMaxVerdict(value: number, max: number, label: string): MetricResult {
  if (!Number.isFinite(value)) return { value, verdict: "pass" };
  return value <= max ? { value, verdict: "pass" } : { value, verdict: "warn", note: `${label} ${round(value)} above diagnostic ceiling ${max}` };
}

/** A warn-only band: inside passes, outside WARNS (never fails). Used for FK grade,
 *  where the rubric's number is descriptive, not an enforceable floor/ceiling. */
function warnOnlyBandVerdict(value: number, band: MetricBand, label: string): MetricResult {
  const r = bandVerdict(value, band);
  if (r.verdict !== "fail") return r;
  return { value: r.value, verdict: "warn", note: `${label} outside [${band.min},${band.max}] (advisory — ease band is the gate)` };
}

function round(n: number): number {
  return Number.isFinite(n) ? Math.round(n * 1000) / 1000 : n;
}

/** Compute the full rubric-metrics record for a single assembled chapter. Pure. */
export function computeChapterRubricMetrics(chapter: ChapterV21, thresholds: RubricThresholds): ChapterRubricMetrics {
  const bdReadability = readabilityMetrics(breakdownProse(chapter));
  const wholeReadability = readabilityMetrics(readerVisibleText(chapter).all);
  const questions = chapter.quiz?.questions ?? [];
  const memorableTexts = (chapter.memorableLines ?? []).map((m) => m.text ?? "");

  const fleschEase = bandVerdict(bdReadability?.flesch ?? NaN, thresholds.fleschEase);
  const fkGrade = warnOnlyBandVerdict(bdReadability?.fk ?? NaN, thresholds.fkGrade, "FK grade");
  const fleschEaseWhole = warnOnlyBandVerdict(wholeReadability?.flesch ?? NaN, thresholds.fleschEase, "whole-chapter ease");
  const fkGradeWhole = warnOnlyBandVerdict(wholeReadability?.fk ?? NaN, thresholds.fkGrade, "whole-chapter FK");

  // P01 rates are score.py 0..100 percentages; the thresholds are fractions.
  const tellPct = distractorTellRate(questions);
  const transferPct = transferRatio(questions);
  const tellRate = maxVerdict(Number.isFinite(tellPct) ? tellPct / 100 : NaN, thresholds.tellRateMax, "distractor-tell rate");
  const transfer = minVerdict(Number.isFinite(transferPct) ? transferPct / 100 : NaN, thresholds.transferMin, "transfer ratio");

  const memorableClean = minVerdict(cleanMemorableLineCount(memorableTexts), thresholds.memorableCleanMin, "clean memorable lines");
  const houseTic = warnOnlyMaxVerdict(houseTicDensity(chapterProse(chapter)), thresholds.houseTicDensityWarnMax, "house-tic density");
  const nominal = warnOnlyMaxVerdict(nominalizationRate(breakdownProse(chapter)), thresholds.nominalizationRateWarnMax, "nominalization rate");

  // Whole-chapter readability is ADVISORY (score.py measures breakdown-only, so the
  // rubric band is calibrated there); FK grade, house-tic + nominalization are
  // warn-only. Only the GATE metrics below can drive a chapter to `fail` — and of
  // these, fkGrade/houseTic/nominal are warn-only by construction, so the effective
  // fail set is fleschEase, tellRate, transferRatio, memorableClean.
  const gate: Record<string, MetricResult> = {
    fleschEase,
    fkGrade,
    tellRate,
    transferRatio: transfer,
    memorableClean,
    houseTicDensity: houseTic,
    nominalizationRate: nominal,
  };
  let verdict: MetricVerdict = "pass";
  const failing: string[] = [];
  for (const [key, res] of Object.entries(gate)) {
    verdict = worst(verdict, res.verdict);
    if (res.verdict === "fail") failing.push(key);
  }

  return {
    chapterId: chapter.chapterId,
    chapterNumber: chapter.number,
    metrics: {
      fleschEase: roundResult(fleschEase),
      fkGrade: roundResult(fkGrade),
      fleschEaseWhole: roundResult(fleschEaseWhole),
      fkGradeWhole: roundResult(fkGradeWhole),
      tellRate: roundResult(tellRate),
      transferRatio: roundResult(transfer),
      memorableClean,
      houseTicDensity: roundResult(houseTic),
      nominalizationRate: roundResult(nominal),
    },
    verdict,
    failing,
  };
}

function roundResult(r: MetricResult): MetricResult {
  return { ...r, value: round(r.value) };
}

export type ComputeRubricOptions = {
  /** Supply chapters directly (tests / already-loaded callers). Defaults to
   *  loadBookChapters(bookId), which reads the canonical state/chapters dir. */
  chapters?: ChapterV21[];
  /** Override thresholds (tests). Defaults to config/rubric-thresholds.json. */
  thresholds?: RubricThresholds;
};

/** Compute the book-level rubric-metrics report. Pure (no artifact write). */
export function computeBookRubricMetrics(bookId: string, opts: ComputeRubricOptions = {}): BookRubricMetricsReport {
  const normalized = normSlug(bookId);
  const thresholds = opts.thresholds ?? loadRubricThresholds();
  const findings: string[] = [];
  let chapters: ChapterV21[];
  try {
    chapters = opts.chapters ?? loadBookChapters(normalized);
  } catch (err) {
    chapters = [];
    findings.push((err as Error).message);
  }
  if (chapters.length === 0 && findings.length === 0) findings.push(`no assembled chapters found for ${normalized}`);

  const perChapter = chapters
    .slice()
    .sort((a, b) => a.number - b.number)
    .map((ch) => computeChapterRubricMetrics(ch, thresholds));

  const summary = { pass: 0, warn: 0, fail: 0 };
  let verdict: MetricVerdict = "pass";
  for (const ch of perChapter) {
    summary[ch.verdict] += 1;
    verdict = worst(verdict, ch.verdict);
  }

  return {
    schemaVersion: RUBRIC_METRICS_SCHEMA_VERSION,
    bookId: normalized,
    generatedAt: new Date().toISOString(),
    thresholds,
    chapters: perChapter,
    summary,
    verdict,
    findings,
  };
}

/** Read a previously-written book rubric-metrics artifact, or null if absent/torn.
 *  Used by risk scoring to route `fail` chapters to qc-shadow visibility. */
export function loadBookRubricMetricsArtifact(bookId: string, roots: CompilerStoreRoots = {}): BookRubricMetricsReport | null {
  try {
    const report = readJsonFile<BookRubricMetricsReport>(rubricMetricsPath(bookId, roots));
    if (report?.schemaVersion !== RUBRIC_METRICS_SCHEMA_VERSION || !Array.isArray(report.chapters)) return null;
    return report;
  } catch {
    return null;
  }
}

function verdictTag(v: MetricVerdict): string {
  return v.toUpperCase();
}

/** Human-readable per-chapter table + book summary for the CLI verb + logs. */
export function formatRubricMetrics(report: BookRubricMetricsReport): string {
  const lines: string[] = [];
  lines.push(
    `rubric-metrics: ${verdictTag(report.verdict)} (pass ${report.summary.pass} · warn ${report.summary.warn} · fail ${report.summary.fail})`,
  );
  lines.push(`  thresholds: ease [${report.thresholds.fleschEase.min},${report.thresholds.fleschEase.max}]±${report.thresholds.fleschEase.warnTolerance} · FK [${report.thresholds.fkGrade.min},${report.thresholds.fkGrade.max}]±${report.thresholds.fkGrade.warnTolerance} · tell≤${report.thresholds.tellRateMax} · transfer≥${report.thresholds.transferMin} · memorable≥${report.thresholds.memorableCleanMin}`);
  for (const ch of report.chapters) {
    const m = ch.metrics;
    lines.push(
      `  ch${String(ch.chapterNumber).padStart(2, "0")}: ${verdictTag(ch.verdict).padEnd(4)} ` +
        `ease=${fmt(m.fleschEase)} fk=${fmt(m.fkGrade)} tell=${fmt(m.tellRate)} transfer=${fmt(m.transferRatio)} ` +
        `memClean=${fmt(m.memorableClean)} tic=${fmt(m.houseTicDensity)} nom=${fmt(m.nominalizationRate)}` +
        (ch.failing.length ? ` — FAIL: ${ch.failing.join(", ")}` : ""),
    );
  }
  for (const f of report.findings) lines.push(`  [FINDING] ${f}`);
  return lines.join("\n");
}

function fmt(r: MetricResult): string {
  const val = Number.isFinite(r.value) ? String(r.value) : "n/a";
  const mark = r.verdict === "fail" ? "✗" : r.verdict === "warn" ? "~" : "";
  return `${val}${mark}`;
}
