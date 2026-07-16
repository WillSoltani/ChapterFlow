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
 *   tellRate ................... distractor-tell (KEY uniquely-longest) as a
 *       fraction 0..1 → ADVISORY (warn-only). DEMOTED from a blocking gate per
 *       WP-402 / ledger L-14 D-9(a): the 0.20 blocking cutoff contradicted the
 *       owner corpus (the reference-standard exemplar runs 79% key-longest; the
 *       top-10 owner packages mean 0.456; an 0.20 blocking gate false-positive-
 *       failed 1,718/1,903 chapters across 131/140 shipped book-packages). It
 *       DOUBLE-COUNTS lengthTell.uniquelyLongest, and the genuine key-length
 *       defect is the SHORTEST side — still BLOCKED by the symmetric lengthTell
 *       gate at shortestMax=4. See docs/v24/w2-card-preflight-calibration.md §(d).
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
import { cardQualityChapter, type CardQualityChapterResult } from "./cardQualityGates.js";

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
    /** W2 echo-tell gate (per-question KEY prose lift). */
    echoTell: MetricResult;
    /** W2 symmetric length-tell gate (key uniquely shortest/longest cap). */
    lengthTell: MetricResult;
    /** W2 practice-floor gate (imperative + concrete number/timebox). */
    practiceFloor: MetricResult;
  };
  /** Worst verdict across the GATE metrics (advisory/warn-only excluded from fail). */
  verdict: MetricVerdict;
  /** GATE-metric keys currently at `fail`. */
  failing: string[];
  /** W2 card-quality raw result (echo flags, length counts, practice items) and
   *  human-readable repair reasons — the strings the author retry card carries. */
  cardQuality: CardQualityChapterResult;
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

/** A binary gate verdict: `ok` → pass, else fail with `note`. Used by the W2
 *  card-quality gates that BLOCK (lengthTell, practiceFloor). */
function boolVerdict(ok: boolean, value: number, note: string): MetricResult {
  return ok ? { value, verdict: "pass" } : { value, verdict: "fail", note };
}

/** A binary ADVISORY verdict: `ok` → pass, else WARN (never fail). Used for
 *  echo-tell, which the calibration corpus proved is NOT a clean defect
 *  discriminator — the top-5 owner books (85.3) carry ≥5-token key echoes at the
 *  same rate/field/coverage as the-power-of-moments v24 (74.7), so a BLOCKING
 *  echo gate would fail 4 of the 5 books the spec REQUIRES to pass. It surfaces
 *  the exact lifts as a paraphrase advisory (and the writer card's W1 rule 2 asks
 *  for a paraphrased key up front), but it cannot force a whole-chapter rewrite.
 *  See docs/v24/w2-card-preflight-calibration.md. */
function advisoryBoolVerdict(ok: boolean, value: number, note: string): MetricResult {
  return ok ? { value, verdict: "pass" } : { value, verdict: "warn", note };
}

/** A warn-only advisory for the distractor-tell rate (KEY uniquely-longest fraction).
 *  DEMOTED from a blocking gate to warn-only per WP-402 / ledger L-14 D-9(a): the
 *  0.20 blocking cutoff CONTRADICTED the owner corpus — the reference-standard
 *  exemplar runs 79% key-longest and the top-10 owner packages average 0.456, so an
 *  0.20 gate false-positive-failed 1,718/1,903 chapters across 131/140 shipped
 *  book-packages. The signal also DOUBLE-COUNTS lengthTell.uniquelyLongest, and the
 *  genuine key-length defect is the SHORTEST side, which the symmetric lengthTell
 *  gate still BLOCKS at shortestMax=4 (the-power-of-moments v24 runs 5–8/9 → FAIL).
 *  So tellRate can only ever `warn`, never `fail`. NaN (nothing scorable) is a clean
 *  `pass`. See docs/v24/w2-card-preflight-calibration.md §(d). */
function advisoryTellRateVerdict(value: number, max: number): MetricResult {
  if (!Number.isFinite(value)) return { value, verdict: "pass" };
  if (value <= max) return { value, verdict: "pass" };
  return {
    value,
    verdict: "warn",
    note:
      `distractor-tell rate ${round(value)} exceeds advisory ceiling ${max} — warn-only: the owner ` +
      `corpus runs high (reference exemplar 79% key-longest; top-10 mean 0.456), so this never blocks; ` +
      `the shortest-side lengthTell gate carries the real key-length safety signal`,
  };
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
  // tellRate is ADVISORY (warn-only) — see advisoryTellRateVerdict + WP-402. Its
  // value is still measured + reported; it just cannot drive a chapter to `fail`.
  const tellRate = advisoryTellRateVerdict(Number.isFinite(tellPct) ? tellPct / 100 : NaN, thresholds.tellRateMax);
  const transfer = minVerdict(Number.isFinite(transferPct) ? transferPct / 100 : NaN, thresholds.transferMin, "transfer ratio");

  const memorableClean = minVerdict(cleanMemorableLineCount(memorableTexts), thresholds.memorableCleanMin, "clean memorable lines");
  const houseTic = warnOnlyMaxVerdict(houseTicDensity(chapterProse(chapter)), thresholds.houseTicDensityWarnMax, "house-tic density");
  const nominal = warnOnlyMaxVerdict(nominalizationRate(breakdownProse(chapter)), thresholds.nominalizationRateWarnMax, "nominalization rate");

  // W2 (plan §WS5) card-quality gates, fed the SAME retry card as tellRate. Values
  // encode the signal: echoTell.value = #flagged questions; lengthTell.value =
  // worse-side count; practiceFloor.value = #items that satisfied the floor.
  //   - lengthTell (shortest side) + practiceFloor BLOCK — the calibration corpus
  //     proves they cleanly separate the top-5 (pass) from POM v24 (fail).
  //   - echoTell is ADVISORY (warn, never fail) — the same corpus proves ≥5-token
  //     key echoes are within-norm for 85.3 books, so it cannot force a rewrite.
  const cq = cardQualityChapter(chapter, {
    keyThreshold: thresholds.cardQuality.echoKeyThreshold,
    distractorCeiling: thresholds.cardQuality.echoDistractorCeiling,
    shortestMax: thresholds.cardQuality.lengthTellShortestMax,
    longestMax: thresholds.cardQuality.lengthTellLongestMax,
  });
  const echoTell = advisoryBoolVerdict(
    !cq.echo.fail,
    cq.echo.flagged.length,
    cq.echo.fail ? `echo-tell (advisory): ${cq.echo.flagged.length} question(s) lift a key phrase (${cq.echo.flagged.join(", ")}) — prefer a paraphrased key` : "",
  );
  const lengthTell = boolVerdict(
    !cq.length.fail,
    Math.max(cq.length.uniquelyShortest, cq.length.uniquelyLongest),
    cq.length.fail
      ? [
          cq.length.shortestFail ? `key uniquely-shortest in ${cq.length.uniquelyShortest}/${cq.length.questionCount}` : "",
          cq.length.longestFail ? `key uniquely-longest in ${cq.length.uniquelyLongest}/${cq.length.questionCount}` : "",
        ].filter(Boolean).join("; ")
      : "",
  );
  const practiceFloor = boolVerdict(
    !cq.practice.fail,
    cq.practice.passingItems.length,
    cq.practice.fail ? "no practice item is imperative-led with a concrete number/timebox" : "",
  );

  // Whole-chapter readability is ADVISORY (score.py measures breakdown-only, so the
  // rubric band is calibrated there); FK grade, house-tic + nominalization are
  // warn-only. Only the GATE metrics below can drive a chapter to `fail` — and of
  // these, fkGrade/houseTic/nominal/tellRate are warn-only by construction (tellRate
  // was DEMOTED from blocking per WP-402 — see advisoryTellRateVerdict), so the
  // effective fail set is fleschEase, transferRatio, memorableClean, and the two
  // BLOCKING W2 card-quality gates (lengthTell, practiceFloor). tellRate stays in
  // the gate map so its `warn` still surfaces on the chapter verdict — exactly like
  // the other warn-only metrics — but it can no longer contribute a `fail`.
  const gate: Record<string, MetricResult> = {
    fleschEase,
    fkGrade,
    tellRate,
    transferRatio: transfer,
    memorableClean,
    houseTicDensity: houseTic,
    nominalizationRate: nominal,
    // W2 card-quality gates are fail-capable (boolean pass/fail).
    echoTell,
    lengthTell,
    practiceFloor,
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
      echoTell,
      lengthTell,
      practiceFloor,
    },
    verdict,
    failing,
    cardQuality: cq,
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
        `memClean=${fmt(m.memorableClean)} tic=${fmt(m.houseTicDensity)} nom=${fmt(m.nominalizationRate)} ` +
        `echo=${fmt(m.echoTell)} lenTell=${fmt(m.lengthTell)} practice=${fmt(m.practiceFloor)}` +
        (ch.failing.length ? ` — FAIL: ${ch.failing.join(", ")}` : ""),
    );
    // The card-quality repair reasons ride on the SAME chNN line-block so the
    // author retry card (which slices the `chNN:` line + follow-on) carries the
    // concrete fix instruction verbatim, not just the failing metric key.
    for (const reason of ch.cardQuality.reasons) lines.push(`    ch${String(ch.chapterNumber).padStart(2, "0")} fix: ${reason}`);
  }
  for (const f of report.findings) lines.push(`  [FINDING] ${f}`);
  return lines.join("\n");
}

function fmt(r: MetricResult): string {
  const val = Number.isFinite(r.value) ? String(r.value) : "n/a";
  const mark = r.verdict === "fail" ? "✗" : r.verdict === "warn" ? "~" : "";
  return `${val}${mark}`;
}
