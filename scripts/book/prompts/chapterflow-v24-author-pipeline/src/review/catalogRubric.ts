/**
 * catalogRubric — the WHOLE-BOOK catalog rubric instrument (R-080).
 *
 * WHAT THIS IS, AND WHAT IT IS NOT.
 *
 * The per-chapter reader panel (`semanticPanelReviewEvaluator` →
 * `laneOrchestrator`) is a per-CHAPTER defect detector: three blind seats read
 * ONE chapter, their composites are medianed, and a chapter below
 * `AUTHOR_CHAPTER_BAR` (70) blocks. That bar is the FLOOR and it does not move
 * here (R-144: Phase A's calibration recommendation stands).
 *
 * This module is the CEILING, and it is a different measurement: three readers
 * each read the WHOLE book — every reader-facing chapter when the book has six
 * or fewer, otherwise the md5-seeded four the catalog scorer has always used —
 * and score the book on the ten-factor catalog rubric the owner actually judges
 * the library on. Phase A §5 measured why both are needed: across 32 scored
 * Franklin reviews the per-chapter composite stayed inside 75.4–79.3 while
 * blockers swung 0→7, and a fresh six-reader whole-book panel scored the same
 * bytes twelve points lower than the per-chapter handoff card. A per-chapter
 * instrument cannot see cross-chapter sameness, one-house voice, or a book that
 * is uniformly mediocre — every chapter clears the floor and the book is still
 * not one the owner would ship (R-147).
 *
 * INSTRUMENT PROVENANCE, and WHICH copy of the skill.
 *
 * There are TWO copies of the book-score skill on this machine and they are not
 * the same instrument: `~/ChapterFlow/.claude/skills/book-score/` (137-line
 * SKILL.md, sha256 73988eed…) and `~/ChapterFlow-books/.claude/skills/book-score/`
 * (208-line SKILL.md, sha256 8c74b696…, "v2 — CF-I/CF-J-calibrated"). The v2
 * copy in the CANONICAL books worktree is the one ported here, and it is the
 * one the catalog was actually scored with: it adds three gate criteria the
 * older copy lacks (a quiz key that contradicts the chapter's OWN stated rule;
 * the DATE-AS-EVENT and NAME-DRIFT classes the skill annotates as having
 * "shipped past gates"; implied-real fabrication), the anti-sameness clauses in
 * the `quizzes` and `practical` definitions, an apparatus-leakage defect class,
 * four texture-sameness axes, and a CROSS-LIBRARY churn question. Phase A found
 * eight source distortions in Franklin of exactly the date/name class, so a port
 * of the older copy would have been blind to the defect this wave exists to
 * catch.
 *
 * The reader prompt is a LINE-FOR-LINE port of that v2 template's step 3, and
 * `tests/v25/v4-catalog-rubric.test.ts` proves it against a checked-in copy of
 * the template rather than against this module's own output. FOUR lines of the
 * template are adapted, each because it describes a mechanism this pipeline does
 * not have, and the test names all four:
 *
 *   1. `BOOK PACKAGE: «PKG»` and the `python3 -c` extraction one-liner. There is
 *      no `book-packages/<id>.v21.json` here — a candidate is not a released
 *      package — so the chapters ride INLINE as untrusted source data beside the
 *      task, exactly as the per-chapter seats already receive their chapter.
 *   2. The "For each read: hook, counterintuition, breakdown.{…}" line names
 *      PACKAGE FIELDS. The document these readers get is the rendered
 *      reader-facing page (`renderChapterReaderDoc`), whose sections are named
 *      differently and which carries no `counterintuition` field at all, so the
 *      line names the document's own sections instead. Telling a reader to read
 *      a field the page does not contain would be an instruction to hallucinate.
 *   3. The `«TITLE»/«AUTHOR»/«ONE-LINE REGISTER HINT»` slots are filled (that is
 *      what a slot is for).
 *   4. The template hard-codes "4 chapters"; this port substitutes the number of
 *      chapters actually sent, which is four for a sampled book and the whole
 *      book for one with six chapters or fewer.
 *
 * The WEIGHTS are not ported at all — they are IMPORTED from
 * `readerReview.REVIEW_WEIGHTS`, which is the pipeline's single source of truth
 * for the rubric and already equals `compose.py`'s WEIGHTS. A test asserts that
 * equality against the literal table so a drift on either side is caught rather
 * than discovered in a scorecard.
 *
 * AGGREGATION follows `compose.py` (v2): factor MEDIANS, the weighted composite,
 * the five tier bands, the high-quality badge, and the SEVERITY MEDIAN
 * (`SEV`/`SEV_LBL`, `round(median(...))`) for churn and for each texture axis.
 * Not a mode: a mode breaks a 1/1/1 three-way split by reader order, so the same
 * three opinions would decide promotion differently depending on which seat held
 * which — and that order-dependent value would land in the released sidecar.
 *
 * WHAT IS RECORDED BUT NOT GATED. The four texture axes and the apparatus-leakage
 * quotes are parsed, medianed, stored and printed, but they do NOT decide
 * promotion. In `compose.py` they feed only the A-D release classification,
 * which also needs `score.py`'s whole-book leakage scan (page-cites, opener
 * saturation, tail/8-gram clones) — a deterministic layer this stage does not
 * run. Computing a classification from half its inputs would be a fabricated
 * measurement, so the stage reports the panel's texture evidence and gates on
 * what the package specifies: gate, composite vs bar, factor floor, churn.
 *
 * ONE DELIBERATE DEVIATION FROM compose.py, and it is a gate deviation.
 * `compose.py` adjudicates the correctness gate as `"PASS" if npass >= nfail`,
 * i.e. a mechanical majority — with three readers, one FAIL is out-voted and
 * disappears. The skill's own step 4 says NOT to do that ("do not blindly
 * majority-vote") and requires a human to adjudicate the dispute against a cited
 * source. This module has no human and no WebSearch, so a SPLIT vote FAILS
 * CLOSED (`RUBRIC_GATE_SPLIT`) carrying the disputed quotes for the operator.
 * A unanimous FAIL is `RUBRIC_GATE_FAIL`. Nothing here can manufacture a PASS
 * out of disagreement.
 *
 * This module makes NO model call and reads no files: it builds prompts, parses
 * reader JSON, and aggregates. Every model call is the evaluator's, through the
 * injected runner.
 */

import { createHash } from "node:crypto";

import { REVIEW_FACTORS, type ReviewFactor } from "../artifacts/artifactTypes.js";
import { REVIEW_WEIGHTS } from "./readerReview.js";
import { renderChapterReaderDoc } from "./renderReaderDoc.js";
import type { ChapterV21 } from "../types.js";

/** The instrument id stamped on every stored rubric record. Bump when the
 *  prompt, the sampling rule or the aggregation semantics change, so an
 *  instrument change is attributable in evidence instead of silent. `-v2`
 *  names the book-score SKILL revision this ports (the CF-I/CF-J-calibrated
 *  template with the full gate list, the texture axes and the severity-median
 *  aggregation), not a second version of this file. */
export const CATALOG_RUBRIC_INSTRUMENT_VERSION = "catalog-rubric-v2" as const;

/** How many independent readers score the book. THREE, matching the book-score
 *  skill and the per-chapter panel: odd, so every factor median is a real
 *  reader's number rather than an average of two. */
export const CATALOG_RUBRIC_READERS = 3;

/** Books with at most this many chapters are read WHOLE. Above it the readers
 *  get the md5-seeded sample below. Six is the skill's own break-even: its
 *  sample is four, and sampling four out of five or six chapters costs nearly a
 *  whole book's tokens while throwing away the cross-chapter signal this
 *  instrument exists to measure. */
export const CATALOG_RUBRIC_WHOLE_BOOK_MAX_CHAPTERS = 6;

/** The seeded sample size, identical to `score.py -n` default. */
export const CATALOG_RUBRIC_SAMPLE_SIZE = 4;

/** The catalog rubric's factor weights. NOT a second copy of the table: the
 *  pipeline's single source of truth, re-exported under the catalog name so a
 *  reader of this module can see which ruler it uses. `tests/v25/…` asserts it
 *  equals the book-score `compose.py` literal. */
export const CATALOG_RUBRIC_WEIGHTS: Readonly<Record<ReviewFactor, number>> = REVIEW_WEIGHTS;

/** Human factor labels, byte-identical to `compose.py`'s LBL — the scorecard is
 *  meant to be diffable against a scorecard the skill produced. */
export const CATALOG_RUBRIC_FACTOR_LABELS: Readonly<Record<ReviewFactor, string>> = Object.freeze({
  retention: "Retention",
  quizzes: "Quizzes",
  transfer: "Transfer (lens>tactic)",
  practical: "Practicalness",
  summaries: "Quality of summaries",
  tone: "Tone",
  limits: "Honesty about limits",
  insight: "Insight & concreteness",
  density: "Idea density",
  beginner: "Beginner-friendliness",
});

/** The order the scorecard prints factors in — the skill's weight order, which
 *  is NOT alphabetical and is what makes two scorecards comparable by eye. */
export const CATALOG_RUBRIC_FACTOR_ORDER: readonly ReviewFactor[] = Object.freeze([
  "retention", "quizzes", "transfer", "practical", "summaries",
  "tone", "limits", "insight", "density", "beginner",
] as const);

// Module-load assertions. The label/order tables are hand-written constants and
// a missing factor would silently drop a whole weight class out of the
// scorecard (and, for the order table, out of the composite's printed
// evidence). Fail at import rather than at the first live book.
{
  const factors = [...REVIEW_FACTORS].sort().join(",");
  const labels = Object.keys(CATALOG_RUBRIC_FACTOR_LABELS).sort().join(",");
  const order = [...CATALOG_RUBRIC_FACTOR_ORDER].sort().join(",");
  if (labels !== factors) throw new Error(`CATALOG_RUBRIC_FACTOR_LABELS (${labels}) must cover REVIEW_FACTORS (${factors})`);
  if (order !== factors) throw new Error(`CATALOG_RUBRIC_FACTOR_ORDER (${order}) must cover REVIEW_FACTORS (${factors})`);
  if (CATALOG_RUBRIC_FACTOR_ORDER.length !== REVIEW_FACTORS.length) {
    throw new Error("CATALOG_RUBRIC_FACTOR_ORDER must not repeat a factor");
  }
}

/** The promotion bar's compiled default. 80 is the top of the skill's own
 *  "solid draft (70-80)" band and the bottom of "strong/ships (80-90)": the
 *  first composite the taxonomy calls shippable rather than a draft. It is NOT
 *  85 — that is the skill's HIGH-QUALITY badge, and Phase A measured that
 *  holding a gate at the badge would reject ~96% of the live catalogue. */
export const CATALOG_RUBRIC_DEFAULT_BAR = 80;

/** Every factor median must clear this to promote. Deliberately the SAME number
 *  as `AUTHOR_CHAPTER_BAR` and deliberately NOT importing it: they are two
 *  different rulers that happen to agree today (one bounds a chapter composite,
 *  this one bounds a whole-book factor median), and coupling them would mean a
 *  future move of one silently moved the other. */
export const CATALOG_RUBRIC_FACTOR_FLOOR = 70;

/** Bar bounds for the env override / `--rubric-bar` flag. */
export const CATALOG_RUBRIC_BAR_MIN = 60;
export const CATALOG_RUBRIC_BAR_MAX = 95;

/**
 * Resolve the promotion bar: absent or empty keeps the compiled default,
 * anything else must be an integer inside [60, 95].
 *
 * Fails closed on a malformed or out-of-range value rather than reverting to
 * the default — the same contract every other CHAPTERFLOW_* budget in the book
 * run carries. A bar that quietly ignores what the operator asked for is worse
 * than one that refuses.
 */
export function resolveRubricBar(override?: number): number {
  if (override !== undefined) {
    if (!Number.isInteger(override) || override < CATALOG_RUBRIC_BAR_MIN || override > CATALOG_RUBRIC_BAR_MAX) {
      throw new Error(`rubric bar must be an integer ${CATALOG_RUBRIC_BAR_MIN}-${CATALOG_RUBRIC_BAR_MAX} (got ${override})`);
    }
    return override;
  }
  const raw = globalThis.process?.env?.CHAPTERFLOW_RUBRIC_BAR;
  if (raw === undefined || raw.trim() === "") return CATALOG_RUBRIC_DEFAULT_BAR;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed)) throw new Error(`CHAPTERFLOW_RUBRIC_BAR is set but not an integer: ${raw}`);
  if (parsed < CATALOG_RUBRIC_BAR_MIN || parsed > CATALOG_RUBRIC_BAR_MAX) {
    throw new Error(`CHAPTERFLOW_RUBRIC_BAR must be ${CATALOG_RUBRIC_BAR_MIN}-${CATALOG_RUBRIC_BAR_MAX} (got ${parsed})`);
  }
  return parsed;
}

/**
 * The md5-seeded chapter sample, a PORT of `score.py:select_idxs`:
 *
 *     seed = int(md5(book_id).hexdigest(), 16)
 *     idxs = set(); i = 0
 *     while len(idxs) < min(n, N): idxs.add((seed + i*2654435761) % N); i += 1
 *     return sorted(idxs)
 *
 * Reproduced exactly — same book id, same chapter count, same four 0-based
 * indices — so this panel reads the SAME pages a catalog run would have read.
 * That makes the sample comparable; the SCORE is comparable only with catalog
 * scores produced under the same instrument (the v2 template ported above),
 * which is what `instrumentVersion` on every stored record is for. BigInt because the md5 seed
 * is a 128-bit integer and Number would lose the low bits that decide the
 * modulus. A test pins the output against `score.py` for a 10-chapter book.
 */
export function selectSeededChapterIndexes(
  bookId: string,
  chapterCount: number,
  sampleSize: number = CATALOG_RUBRIC_SAMPLE_SIZE,
): readonly number[] {
  if (!Number.isInteger(chapterCount) || chapterCount < 1) {
    throw new Error(`selectSeededChapterIndexes requires a positive chapter count (got ${chapterCount})`);
  }
  if (!Number.isInteger(sampleSize) || sampleSize < 1) {
    throw new Error(`selectSeededChapterIndexes requires a positive sample size (got ${sampleSize})`);
  }
  const seed = BigInt(`0x${createHash("md5").update(bookId, "utf8").digest("hex")}`);
  const modulus = BigInt(chapterCount);
  const want = Math.min(sampleSize, chapterCount);
  const chosen = new Set<number>();
  for (let i = 0; chosen.size < want; i += 1) {
    chosen.add(Number((seed + BigInt(i) * 2654435761n) % modulus));
  }
  return Object.freeze([...chosen].sort((left, right) => left - right));
}

/**
 * Which chapters the panel reads: ALL of them when the book has at most
 * `CATALOG_RUBRIC_WHOLE_BOOK_MAX_CHAPTERS`, otherwise the seeded sample.
 * Returns 0-based indexes into the ordered chapter set, ascending.
 */
export function selectRubricChapterIndexes(bookId: string, chapterCount: number): readonly number[] {
  if (!Number.isInteger(chapterCount) || chapterCount < 1) {
    throw new Error(`selectRubricChapterIndexes requires a positive chapter count (got ${chapterCount})`);
  }
  if (chapterCount <= CATALOG_RUBRIC_WHOLE_BOOK_MAX_CHAPTERS) {
    return Object.freeze([...Array(chapterCount).keys()]);
  }
  return selectSeededChapterIndexes(bookId, chapterCount);
}

/** The skill's three-valued severity scale (`compose.py`'s SEV/SEV_LBL). */
export type CatalogRubricSeverity = "LOW" | "MED" | "HIGH";

/** The four texture-sameness axes the skill's v2 template asks every reader to
 *  judge across the chapters it read. Ordered as `compose.py`'s TEXTURE dict. */
export const CATALOG_RUBRIC_TEXTURE_AXES = Object.freeze([
  "scene_skeleton", "repeated_unit", "prop_stamp", "proxy_cast",
] as const);

export type CatalogRubricTextureAxis = (typeof CATALOG_RUBRIC_TEXTURE_AXES)[number];

/** `compose.py`'s TEXTURE labels, byte-identical, for the scorecard line. */
export const CATALOG_RUBRIC_TEXTURE_LABELS: Readonly<Record<CatalogRubricTextureAxis, string>> = Object.freeze({
  scene_skeleton: "Scene skeleton (one dramatic shape)",
  repeated_unit: "Repeated structural unit",
  prop_stamp: "Prop/location stamping",
  proxy_cast: "Proxy cast vs named humans",
});

/** One reader's returned block, after strict parsing. Every field the v2
 *  template declares is carried: asking a reader for a judgement and then
 *  discarding it would be spend with no evidence behind it. */
export type CatalogRubricReaderResultV1 = {
  readonly reader: number;
  readonly gateVerdict: "PASS" | "FAIL";
  readonly gateFailures: string;
  readonly scores: Readonly<Record<ReviewFactor, number>>;
  readonly churn: CatalogRubricSeverity;
  /** The four texture-sameness axes, LOW/MED/HIGH each. */
  readonly texture: Readonly<Record<CatalogRubricTextureAxis, CatalogRubricSeverity>>;
  /** Verbatim apparatus/machinery leaks, or the literal "none". A defect class,
   *  NOT a gate fail — the template says so explicitly. */
  readonly apparatusQuotes: string;
  readonly textureNote: string;
  readonly note: string;
};

/** Thrown when a reader's output cannot be strictly assembled. Distinguished
 *  from an infrastructure failure by the caller, exactly as the per-chapter
 *  panel distinguishes `ReaderExperienceReviewError`. */
export class CatalogRubricReaderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CatalogRubricReaderError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Extract the LAST balanced top-level JSON object in the output, mirroring the
 *  reader-experience parser's tolerance for a model that prefixes prose. */
export function parseCatalogRubricReaderJson(stdout: string): unknown {
  const text = typeof stdout === "string" ? stdout : "";
  let depth = 0;
  let start = -1;
  let last: string | null = null;
  let inString = false;
  let escaped = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') { inString = true; continue; }
    if (character === "{") { if (depth === 0) start = index; depth += 1; continue; }
    if (character === "}") {
      if (depth === 0) continue;
      depth -= 1;
      if (depth === 0 && start >= 0) last = text.slice(start, index + 1);
    }
  }
  if (last === null) return null;
  try {
    return JSON.parse(last);
  } catch {
    return null;
  }
}

/**
 * Strictly assemble one reader block. Every field the JSON contract names must
 * be present and in range; nothing is defaulted, coerced or repaired. A reader
 * that omits `gate_failures` on a FAIL is refused rather than recorded as an
 * unquoted FAIL, because the operator's only way to adjudicate a split is the
 * quote.
 */
export function assembleCatalogRubricReader(value: unknown, expectedReader: number): CatalogRubricReaderResultV1 {
  if (!isRecord(value)) {
    throw new CatalogRubricReaderError(`catalog-rubric reader ${expectedReader}: output is not a JSON object`);
  }
  const reader = value.reader;
  if (reader !== expectedReader) {
    throw new CatalogRubricReaderError(
      `catalog-rubric reader ${expectedReader}: "reader" must be ${expectedReader} (got ${JSON.stringify(reader)})`,
    );
  }
  const gateVerdict = value.gate_verdict;
  if (gateVerdict !== "PASS" && gateVerdict !== "FAIL") {
    throw new CatalogRubricReaderError(
      `catalog-rubric reader ${expectedReader}: "gate_verdict" must be "PASS" or "FAIL" (got ${JSON.stringify(gateVerdict)})`,
    );
  }
  const gateFailures = value.gate_failures;
  if (typeof gateFailures !== "string" || gateFailures.trim().length === 0) {
    throw new CatalogRubricReaderError(
      `catalog-rubric reader ${expectedReader}: "gate_failures" must be a non-empty string ("none" when clean)`,
    );
  }
  if (gateVerdict === "FAIL" && gateFailures.trim().toLowerCase() === "none") {
    throw new CatalogRubricReaderError(
      `catalog-rubric reader ${expectedReader}: a FAIL gate must quote the violation; "gate_failures" is "none"`,
    );
  }
  const scores: Record<string, number> = {};
  for (const factor of REVIEW_FACTORS) {
    const score = value[factor];
    if (typeof score !== "number" || !Number.isFinite(score) || score < 0 || score > 100) {
      throw new CatalogRubricReaderError(
        `catalog-rubric reader ${expectedReader}: "${factor}" must be a number 0-100 (got ${JSON.stringify(score)})`,
      );
    }
    scores[factor] = score;
  }
  const churn = value.book3_churn;
  if (churn !== "LOW" && churn !== "MED" && churn !== "HIGH") {
    throw new CatalogRubricReaderError(
      `catalog-rubric reader ${expectedReader}: "book3_churn" must be LOW, MED or HIGH (got ${JSON.stringify(churn)})`,
    );
  }
  const texture: Record<string, CatalogRubricSeverity> = {};
  for (const axis of CATALOG_RUBRIC_TEXTURE_AXES) {
    const value_ = value[axis];
    if (value_ !== "LOW" && value_ !== "MED" && value_ !== "HIGH") {
      throw new CatalogRubricReaderError(
        `catalog-rubric reader ${expectedReader}: "${axis}" must be LOW, MED or HIGH (got ${JSON.stringify(value_)})`,
      );
    }
    texture[axis] = value_;
  }
  const apparatusQuotes = value.apparatus_quotes;
  if (typeof apparatusQuotes !== "string" || apparatusQuotes.trim().length === 0) {
    throw new CatalogRubricReaderError(
      `catalog-rubric reader ${expectedReader}: "apparatus_quotes" must be a non-empty string ("none" when clean)`,
    );
  }
  const textureNote = value.texture_note;
  if (typeof textureNote !== "string" || textureNote.trim().length === 0) {
    throw new CatalogRubricReaderError(
      `catalog-rubric reader ${expectedReader}: "texture_note" must be a non-empty string`,
    );
  }
  const note = value.note;
  if (typeof note !== "string" || note.trim().length === 0) {
    throw new CatalogRubricReaderError(`catalog-rubric reader ${expectedReader}: "note" must be a non-empty string`);
  }
  return Object.freeze({
    reader: expectedReader,
    gateVerdict,
    gateFailures,
    scores: Object.freeze(scores) as Readonly<Record<ReviewFactor, number>>,
    churn,
    texture: Object.freeze(texture) as Readonly<Record<CatalogRubricTextureAxis, CatalogRubricSeverity>>,
    apparatusQuotes,
    textureNote,
    note,
  });
}

/** The median of a non-empty numeric list (odd length → the middle element;
 *  even length → the mean of the two middle elements). Local rather than
 *  imported from `laneOrchestrator` so this instrument does not depend on the
 *  per-chapter panel's module graph. */
export function medianOf(values: readonly number[]): number {
  if (values.length === 0) throw new Error("medianOf requires a non-empty list");
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** `compose.py`'s SEV table: the severity scale churn and every texture axis are
 *  medianed on. */
const SEVERITY_RANK: Readonly<Record<CatalogRubricSeverity, number>> = Object.freeze({ LOW: 0, MED: 1, HIGH: 2 });
const SEVERITY_LABEL: readonly CatalogRubricSeverity[] = Object.freeze(["LOW", "MED", "HIGH"] as const);

/** Python's `round()`: half-to-EVEN, not half-away-from-zero. Only reachable
 *  with an even reader count (three readers always median to an element), but
 *  the skill's own note says the panel may be bumped to five — or four — and a
 *  banker's-rounding mismatch would then silently move a churn call. */
export function roundHalfToEven(value: number): number {
  const floor = Math.floor(value);
  const fraction = value - floor;
  if (fraction > 0.5) return floor + 1;
  if (fraction < 0.5) return floor;
  return floor % 2 === 0 ? floor : floor + 1;
}

/**
 * `compose.py`'s severity median:
 *
 *     SEV_LBL[round(statistics.median([SEV.get(c, 1) for c in churns]))]
 *
 * NOT a mode. A mode breaks a three-way 1/1/1 split by first occurrence, so
 * LOW/MED/HIGH and HIGH/LOW/MED — the same three opinions, different seats —
 * would produce different churn calls, a different promotion decision, and a
 * different value in the durable release sidecar. The median returns MED for
 * both, which is also what the catalog scorer recorded.
 */
export function medianSeverity(values: readonly CatalogRubricSeverity[]): CatalogRubricSeverity {
  if (values.length === 0) throw new Error("medianSeverity requires a non-empty list");
  return SEVERITY_LABEL[roundHalfToEven(medianOf(values.map((value) => SEVERITY_RANK[value])))];
}

/** `compose.py:tier` — the same five bands, byte-identical labels. */
export function catalogRubricTier(composite: number): string {
  if (composite >= 90) return "premium (90+)";
  if (composite >= 80) return "strong/ships (80-90)";
  if (composite >= 70) return "solid draft (70-80)";
  if (composite >= 60) return "mediocre (60-70)";
  return "not-publishable (<60)";
}

/** The gate the three readers voted, adjudicated the skill's way and not
 *  `compose.py`'s. SPLIT is its own value: it is neither a PASS nor a settled
 *  FAIL, and collapsing it into either is exactly the fail-open this stage
 *  exists to close. */
export type CatalogRubricGate = "PASS" | "FAIL" | "SPLIT";

/** One reader's quoted gate violation, kept with its reader number so an
 *  operator adjudicating a split knows who claimed what. */
export type CatalogRubricGateFailure = {
  readonly reader: number;
  readonly quoted: string;
};

/** The panel's aggregate over one candidate. Bar-free ON PURPOSE: this is what
 *  the readers said about these bytes, and it is what gets stored. The BAR is
 *  an operator dial applied to it (see {@link judgeCatalogRubric}), so raising
 *  or lowering the bar re-decides a stored panel without re-scoring anything. */
export type CatalogRubricAggregateV1 = {
  readonly schemaVersion: "1";
  readonly instrumentVersion: typeof CATALOG_RUBRIC_INSTRUMENT_VERSION;
  readonly readerCount: number;
  readonly gate: CatalogRubricGate;
  readonly gateVotes: Readonly<{ pass: number; fail: number }>;
  readonly gateFailures: readonly CatalogRubricGateFailure[];
  readonly factorMedians: Readonly<Record<ReviewFactor, number>>;
  readonly composite: number;
  readonly tier: string;
  readonly churn: CatalogRubricSeverity;
  readonly churnVotes: readonly CatalogRubricSeverity[];
  /** Panel median per texture axis (`compose.py:med_sev`). RECORDED, not gated
   *  — see this module's header for why the A-D classification that consumes
   *  them is not computed here. */
  readonly texture: Readonly<Record<CatalogRubricTextureAxis, CatalogRubricSeverity>>;
  /** Axes whose panel median is HIGH, in the skill's axis order. */
  readonly textureHigh: readonly CatalogRubricTextureAxis[];
  /** Apparatus/machinery leaks the readers quoted, "none" answers dropped
   *  exactly as `compose.py` drops them. A defect class, never a gate fail. */
  readonly apparatusQuotes: readonly CatalogRubricGateFailure[];
  /** The skill's HIGH-QUALITY BADGE, never the gate: gate PASS, composite ≥85,
   *  no factor <70, retention & quizzes ≥80, churn ≠ HIGH. Reported so a
   *  standout book is visible; promotion never requires it (R-080's own fix
   *  note: "Reserve >=85 as the badge, not the gate"). */
  readonly highQuality: boolean;
};

/** Median the reader blocks into the panel aggregate. Pure. */
export function aggregateCatalogRubric(
  readers: readonly CatalogRubricReaderResultV1[],
): CatalogRubricAggregateV1 {
  if (readers.length === 0) throw new Error("aggregateCatalogRubric requires at least one reader");
  const pass = readers.filter((reader) => reader.gateVerdict === "PASS").length;
  const fail = readers.length - pass;
  const gate: CatalogRubricGate = fail === 0 ? "PASS" : pass === 0 ? "FAIL" : "SPLIT";
  const gateFailures = readers
    .filter((reader) => reader.gateVerdict === "FAIL")
    .map((reader) => Object.freeze({ reader: reader.reader, quoted: reader.gateFailures }));
  const factorMedians = Object.fromEntries(
    REVIEW_FACTORS.map((factor) => [factor, medianOf(readers.map((reader) => reader.scores[factor]))]),
  ) as Record<ReviewFactor, number>;
  const composite = REVIEW_FACTORS.reduce(
    (sum, factor) => sum + factorMedians[factor] * CATALOG_RUBRIC_WEIGHTS[factor], 0,
  ) / 100;
  const churnVotes = readers.map((reader) => reader.churn);
  const churn = medianSeverity(churnVotes);
  const texture = Object.fromEntries(
    CATALOG_RUBRIC_TEXTURE_AXES.map((axis) => [axis, medianSeverity(readers.map((reader) => reader.texture[axis]))]),
  ) as Record<CatalogRubricTextureAxis, CatalogRubricSeverity>;
  const textureHigh = CATALOG_RUBRIC_TEXTURE_AXES.filter((axis) => texture[axis] === "HIGH");
  const apparatusQuotes = readers
    .filter((reader) => reader.apparatusQuotes.trim().toLowerCase() !== "none")
    .map((reader) => Object.freeze({ reader: reader.reader, quoted: reader.apparatusQuotes }));
  const highQuality = gate === "PASS"
    && composite >= 85
    && REVIEW_FACTORS.every((factor) => factorMedians[factor] >= 70)
    && factorMedians.retention >= 80
    && factorMedians.quizzes >= 80
    && churn !== "HIGH";
  return Object.freeze({
    schemaVersion: "1",
    instrumentVersion: CATALOG_RUBRIC_INSTRUMENT_VERSION,
    readerCount: readers.length,
    gate,
    gateVotes: Object.freeze({ pass, fail }),
    gateFailures: Object.freeze(gateFailures),
    factorMedians: Object.freeze(factorMedians),
    composite,
    tier: catalogRubricTier(composite),
    churn,
    churnVotes: Object.freeze(churnVotes),
    texture: Object.freeze(texture),
    textureHigh: Object.freeze(textureHigh),
    apparatusQuotes: Object.freeze(apparatusQuotes),
    highQuality,
  });
}

/** Why a rubric verdict refused promotion. Each is a distinct operator action:
 *  a settled corruption, an unadjudicated dispute, or a book that is simply not
 *  good enough yet. */
export type CatalogRubricFailureCode = "RUBRIC_GATE_FAIL" | "RUBRIC_GATE_SPLIT" | "RUBRIC_BELOW_BAR";

/** The bar applied to a stored aggregate. */
export type CatalogRubricVerdictV1 = {
  readonly promotable: boolean;
  readonly bar: number;
  readonly factorFloor: number;
  readonly failureCode?: CatalogRubricFailureCode;
  readonly message?: string;
  /** Factor medians below `factorFloor`, weakest first — named in the message
   *  so the operator is told WHICH factor to repair, never just a number. */
  readonly belowFloorFactors: readonly ReviewFactor[];
};

function orderedWeakestFirst(
  medians: Readonly<Record<ReviewFactor, number>>,
  predicate: (score: number) => boolean,
): readonly ReviewFactor[] {
  return [...REVIEW_FACTORS]
    .filter((factor) => predicate(medians[factor]))
    .sort((left, right) => medians[left] - medians[right] || left.localeCompare(right));
}

/**
 * Apply the promotion bar to a panel aggregate. PURE and re-runnable: it spends
 * nothing, so a resume — or an operator who moved the bar — re-decides a stored
 * panel for free.
 *
 * ORDER MATTERS. The correctness gate is a VETO and is adjudicated first: a
 * corrupt book is refused whatever its composite says, and a SPLIT vote is
 * refused before the numbers are consulted at all, because a disputed
 * fabrication makes every factor score suspect.
 */
export function judgeCatalogRubric(
  aggregate: CatalogRubricAggregateV1,
  bar: number,
): CatalogRubricVerdictV1 {
  if (!Number.isInteger(bar) || bar < CATALOG_RUBRIC_BAR_MIN || bar > CATALOG_RUBRIC_BAR_MAX) {
    throw new Error(`rubric bar must be an integer ${CATALOG_RUBRIC_BAR_MIN}-${CATALOG_RUBRIC_BAR_MAX} (got ${bar})`);
  }
  const belowFloorFactors = orderedWeakestFirst(aggregate.factorMedians, (score) => score < CATALOG_RUBRIC_FACTOR_FLOOR);
  const quotes = aggregate.gateFailures.map((failure) => `reader ${failure.reader}: ${failure.quoted}`).join(" | ");
  if (aggregate.gate === "FAIL") {
    return Object.freeze({
      promotable: false,
      bar,
      factorFloor: CATALOG_RUBRIC_FACTOR_FLOOR,
      failureCode: "RUBRIC_GATE_FAIL",
      message: `catalog-rubric correctness gate FAILED unanimously (${aggregate.gateVotes.fail}/${aggregate.readerCount}): ${quotes}`,
      belowFloorFactors,
    });
  }
  if (aggregate.gate === "SPLIT") {
    return Object.freeze({
      promotable: false,
      bar,
      factorFloor: CATALOG_RUBRIC_FACTOR_FLOOR,
      failureCode: "RUBRIC_GATE_SPLIT",
      message:
        `catalog-rubric correctness gate is SPLIT ${aggregate.gateVotes.pass} PASS / ${aggregate.gateVotes.fail} FAIL`
        + " — a split vote fails closed and is never resolved by majority; adjudicate the disputed quote against the"
        + ` source before promoting: ${quotes}`,
      belowFloorFactors,
    });
  }
  const reasons: string[] = [];
  if (aggregate.composite < bar) {
    reasons.push(`composite ${aggregate.composite.toFixed(1)} < bar ${bar}`);
  }
  if (belowFloorFactors.length > 0) {
    reasons.push(
      `factor medians below ${CATALOG_RUBRIC_FACTOR_FLOOR}: `
      + belowFloorFactors.map((factor) => `${factor} ${formatScore(aggregate.factorMedians[factor])}`).join(", "),
    );
  }
  if (aggregate.churn === "HIGH") {
    reasons.push(`book-3 churn is HIGH (votes ${aggregate.churnVotes.join("/")})`);
  }
  if (reasons.length === 0) {
    return Object.freeze({
      promotable: true,
      bar,
      factorFloor: CATALOG_RUBRIC_FACTOR_FLOOR,
      belowFloorFactors,
    });
  }
  return Object.freeze({
    promotable: false,
    bar,
    factorFloor: CATALOG_RUBRIC_FACTOR_FLOOR,
    failureCode: "RUBRIC_BELOW_BAR",
    message: `catalog-rubric verdict below the promotion bar — ${reasons.join("; ")}`,
    belowFloorFactors,
  });
}

/** `%g`-style score rendering, matching `compose.py`'s `{med:g}`: an integral
 *  median prints without a decimal point, a half-point median keeps it. */
export function formatScore(value: number): string {
  return String(Number(value));
}

/**
 * The scorecard table, laid out exactly as `compose.py` prints it.
 *
 * THREE of `compose.py`'s lines are absent and their absence is deliberate, not
 * a truncation: the **Deterministic** line (Flesch / distractor-tell / transfer
 * / memorable) and the **Apparatus/leakage scan** block both come from
 * `score.py`, which reads a RELEASED package this stage does not have;
 * **Placement** compares against `baseline.json`, a catalog snapshot that is not
 * part of the pipeline; and the **Release classification** (A-D) is not printed
 * because it is computed from those same missing scan inputs, so a
 * classification derived from half of them would be a fabricated measurement.
 * Printing any of the four from nothing would be exactly that.
 *
 * TWO lines are ADDED. The promotion bar and the verdict this run reached,
 * because unlike the skill this scorecard is attached to a gate and must say
 * what the gate decided; and the panel's quoted apparatus leaks, which
 * `compose.py` folds silently into the classification — with the classification
 * gone, quoting them is the only way the operator sees that defect class.
 *
 * The row-status and split-vote MARKERS are ASCII (`!! <75`, `** split vote`)
 * where `compose.py` uses emoji. That is a rendering choice, not a semantic one:
 * this string is printed to an operator terminal and into a durable run log, and
 * the thresholds it marks (<75, 75-79) are byte-identical to the skill's.
 */
export function renderCatalogRubricScorecard(input: Readonly<{
  title: string;
  chapterLabels: readonly string[];
  readers: readonly CatalogRubricReaderResultV1[];
  aggregate: CatalogRubricAggregateV1;
  verdict: CatalogRubricVerdictV1;
}>): string {
  const { aggregate, readers, verdict } = input;
  const lines: string[] = [];
  lines.push(`## ${input.title} — scorecard (ch ${input.chapterLabels.join(", ")})`, "");
  const gateNote = aggregate.gate === "SPLIT"
    ? `  ** split vote ${aggregate.gateVotes.pass} PASS / ${aggregate.gateVotes.fail} FAIL — fails closed; adjudicate the disputed quotes**`
    : aggregate.gateVotes.pass === readers.length ? "  (unanimous)" : "";
  lines.push(`**Gate:** ${aggregate.gate}${gateNote}   ·   **Book-3 churn:** ${aggregate.churn}`, "");
  const columns = readers.map((reader) => `R${reader.reader}`).join(" | ");
  lines.push(`| Factor | wt | ${columns} | **Median** | status |`);
  lines.push("|---|---|" + "---|".repeat(readers.length) + "---|---|");
  for (const factor of CATALOG_RUBRIC_FACTOR_ORDER) {
    const median = aggregate.factorMedians[factor];
    const status = median < 75 ? "!! <75" : median < 80 ? "~ weak" : "ok";
    const cells = readers.map((reader) => formatScore(reader.scores[factor])).join(" | ");
    lines.push(
      `| ${CATALOG_RUBRIC_FACTOR_LABELS[factor]} | ${CATALOG_RUBRIC_WEIGHTS[factor]} | ${cells}`
      + ` | **${formatScore(median)}** | ${status} |`,
    );
  }
  lines.push(
    `| **COMPOSITE** | | ${" | ".repeat(readers.length)}**${aggregate.composite.toFixed(1)}** | ${aggregate.tier} |`,
    "",
  );
  lines.push(
    "**Texture-sameness axes (panel median):** "
    + CATALOG_RUBRIC_TEXTURE_AXES.map((axis) => `${CATALOG_RUBRIC_TEXTURE_LABELS[axis]}: **${aggregate.texture[axis]}**`).join(" · "),
    "",
  );
  if (aggregate.apparatusQuotes.length > 0) {
    lines.push(`**Apparatus leakage quoted by the panel** (defect class, not a gate fail) — ${aggregate.apparatusQuotes.length} reader(s):`);
    for (const quote of aggregate.apparatusQuotes) lines.push(`  - reader ${quote.reader}: ${quote.quoted}`);
    lines.push("");
  }
  if (aggregate.gate !== "PASS") {
    lines.push(`> **CAPPED** — gate ${aggregate.gate}; the composite is advisory until the corruption is fixed.`, "");
  }
  lines.push(
    "**High-quality bar** (gate PASS · composite >=85 · no factor <70 · Retention & Quizzes >=80 · churn != HIGH):"
    + ` **${aggregate.highQuality ? "MEETS IT" : "no"}**`,
  );
  const below75 = CATALOG_RUBRIC_FACTOR_ORDER.filter((factor) => aggregate.factorMedians[factor] < 75);
  const weak = CATALOG_RUBRIC_FACTOR_ORDER.filter(
    (factor) => aggregate.factorMedians[factor] >= 75 && aggregate.factorMedians[factor] < 80,
  );
  if (below75.length > 0) {
    lines.push(`**Below standard (<75):** ${below75.map((factor) => CATALOG_RUBRIC_FACTOR_LABELS[factor]).join(", ")}`);
  }
  if (weak.length > 0) {
    lines.push(`**Weak (75-79):** ${weak.map((factor) => CATALOG_RUBRIC_FACTOR_LABELS[factor]).join(", ")}`);
  }
  lines.push(
    `**Promotion bar** (composite >=${verdict.bar} · every factor >=${verdict.factorFloor} · churn != HIGH · gate PASS):`
    + ` **${verdict.promotable ? "MET" : `NOT MET — ${verdict.failureCode}`}**`,
  );
  if (!verdict.promotable && verdict.message !== undefined) lines.push(`  ${verdict.message}`);
  return lines.join("\n");
}

// ── The register hint ────────────────────────────────────────────────────────

/**
 * The one-line register hint the skill's prompt slot asks for: "the source
 * author's voice, so Tone is judged on fidelity to it, not on being chatty".
 *
 * Derived from what the CANDIDATE already carries, in this order:
 *   1. the run's own VOICE CARD (`inputs/compiler-section-task-context.json`)
 *      — the same card the section writers were given, so Tone is judged
 *      against the register the book was actually written to;
 *   2. the bibliography's `authorVoice.register` (one of the five frozen
 *      values), when no card was compiled;
 *   3. nothing — in which case the hint says so rather than inventing a voice.
 *
 * A hint is a JUDGING instruction, never content: only the card's `voice:`
 * line (register adjectives, person, cadence) is lifted, never its `do:` /
 * `never:` lines, and never a sample sentence. The voice card's own guard line
 * exists to stop exactly that leak and is never forwarded.
 */
export function buildRegisterHint(input: Readonly<{
  author: string;
  voiceCard?: string | null;
  register?: string | null;
}>): string {
  const tail = "Judge Tone on fidelity to that voice, not on being chatty; if the register is dense or technical, do not"
    + " over-penalize density as tone.";
  const card = typeof input.voiceCard === "string" ? input.voiceCard : "";
  const voiceLine = card.split("\n").map((line) => line.trim()).find((line) => line.startsWith("voice:"));
  if (voiceLine !== undefined) {
    return `The register this book was written to is — ${voiceLine.slice("voice:".length).trim()}. ${tail}`;
  }
  const register = typeof input.register === "string" ? input.register.trim() : "";
  if (register.length > 0) {
    return `The source author's register is ${register}. ${tail}`;
  }
  return `No register profile was recorded for ${input.author}, so infer the intended voice from the pages themselves.`
    + ` ${tail}`;
}

// ── The whole-book reader document ───────────────────────────────────────────

/**
 * The document the readers judge: every sampled chapter's reader-facing page,
 * concatenated in chapter order under a book header.
 *
 * Each chapter body is `renderChapterReaderDoc` — the KEY-BEARING renderer,
 * unmodified. That is a deliberate choice against the phase-1 (key-stripped)
 * renderer the per-chapter blind panel uses, and the reason is the instrument:
 * the catalog rubric's correctness gate requires the reader to "derive each
 * answer BLIND from the prose, compare to correctIndex", which is impossible
 * without the key. The renderer already prints the key LAST, under a header
 * that instructs derive-first, which is the same instruction-based blind the
 * book-score skill relies on.
 *
 * The chapter header states the chapter's position in the WHOLE book, so a
 * reader scoring a four-chapter sample of a fourteen-chapter book knows it is
 * reading a sample and can judge sameness across the sample honestly.
 */
export function renderBookRubricDocument(input: Readonly<{
  title: string;
  author: string;
  chapters: readonly { readonly chapter: ChapterV21; readonly number: number }[];
  totalChapters: number;
}>): string {
  if (input.chapters.length === 0) throw new Error("renderBookRubricDocument requires at least one chapter");
  const blocks: string[] = [
    `# BOOK: ${input.title} — by ${input.author}`,
    `${input.chapters.length} of ${input.totalChapters} chapters follow, in book order:`
    + ` ${input.chapters.map(({ number }) => number).join(", ")}.`,
  ];
  for (const { chapter, number } of input.chapters) {
    blocks.push(`===== CHAPTER ${number} OF ${input.totalChapters} =====`);
    blocks.push(renderChapterReaderDoc(chapter));
  }
  return blocks.join("\n\n");
}

// ── The reader task ──────────────────────────────────────────────────────────

/**
 * The catalog-rubric reader prompt — a LINE-FOR-LINE port of
 * `.claude/skills/book-score/SKILL.md` step 3 (the canonical books-worktree
 * copy; see this module's header for why there are two).
 *
 * Everything from `CORRECTNESS GATE` to the closing brace of the JSON shape is
 * the skill's own text: the eight gate criteria (including the two error
 * classes the skill flags as having SHIPPED PAST GATES — date-as-event and name
 * drift — and the implied-real fabrication bullet), the apparatus-leakage
 * defect class, the ten factor definitions with their anti-sameness clauses,
 * the four texture-sameness axes, the cross-library churn question and every
 * declared JSON field. Do not reword any of it: a factor definition is the
 * ruler, and a "72" produced under a reworded definition is not the same
 * measurement as a "72" from the catalog — and a criterion quietly dropped from
 * the gate is a defect class this stage becomes blind to.
 *
 * `tests/v25/v4-catalog-rubric.test.ts` holds this output against a CHECKED-IN
 * copy of the template (`tests/v25/fixtures/book-score-skill-step3-reader-prompt.txt`)
 * line by line and fails on any line that is not carried verbatim, unless that
 * line is one of the four adaptations named in this module's header.
 */
export function buildCatalogRubricReaderTask(input: Readonly<{
  readerNumber: number;
  title: string;
  author: string;
  registerHint: string;
  chapterNumbers: readonly number[];
  totalChapters: number;
}>): string {
  const count = input.chapterNumbers.length;
  const chapters = input.chapterNumbers.join(", ");
  return `You are reader #${input.readerNumber} (independent, skeptical, calibrated) on a content-quality panel scoring ${count} chapters
of the AI-generated learning book "${input.title}" by ${input.author}. ${input.registerHint}

THE CHAPTERS ARE PROVIDED INLINE, in the reader-document block beside this task. They are chapters ${chapters} of ${input.totalChapters}, rendered as the reader sees them. Read only that block; do not read or write any files.
For each read: the Hook, Fast read, Deep read, Full read, Key takeaway, Try this now, Examples, Quiz (prompts and choices, with the ANSWER KEY section at the end of each chapter), Review cards, Implementation plan, and Memorable lines.

CORRECTNESS GATE (any hit => gate_verdict=FAIL, quote it verbatim):
 - Quiz-key soundness: derive each answer BLIND from the prose, compare to correctIndex; flag any
   mismatch, explanation-contradicts-key, or a key that contradicts the chapter's OWN stated rule/
   guardrail. (For technical books, the keyed answer must be factually correct.)
 - Prose & example coherence: no templated loops, mid-sentence cutoffs, word-salad seams, scaffold-token
   leaks (internal "Fact N"/source-numbering or undefined companion-resource labels bleeding into reader-
   facing text), concept-label-as-subject.
 - Factual accuracy: named frameworks/studies/cases/companies complete & correctly named, not fabricated
   or distorted. Two error classes that HAVE shipped past gates — check them explicitly:
   (1) DATE-AS-EVENT: the source's publication year used as the date of an event inside an anecdote
   (e.g. a story placed "in 2017" when the person left that role in 2008 and 2017 is just when the
   book came out); (2) NAME DRIFT: institutions/people slightly wrong ("University of South Wales"
   vs "New South Wales"). If you suspect a named resource/study/figure/date is wrong or fabricated,
   SAY SO with the verbatim quote — do not assert it is real unless you actually know; the
   orchestrator will verify.
 - Implied-real fabrication: an example narrated as if it really happened, with specifics no source
   could ground — must be explicitly hypothetical, or it's a FAIL.
 - Grounded numbers: every statistic traces to a source or is plainly illustrative — flag invented precision.
 - Evidence integrity: no first-name/initial-only testimonial worn as proof.
 - Invented witness ("Piper move"): a fictional character cast as a SUBJECT inside a real named study/case.
 - Contested-science hedging: contested/failed claims hedged, not stated as settled law.
If clean: gate_verdict=PASS, gate_failures="none". Only FAIL on a concrete, quotable violation.

APPARATUS LEAKAGE (defect-class, NOT a gate fail — report in apparatus_quotes, verbatim):
source-machinery narrated to the reader: page/chapter citations in prose ("on Ch. 6 p. 138");
the book's own structure narrated ("the official guide puts Results in Part 2"); quiz questions or
cards that reward knowing the SOURCE's layout/apparatus instead of the idea; spec-narration
sentences (prose that narrates its own writing constraints: "The outcome is not claimed here",
"...is the only hard detail"). If none: apparatus_quotes="none".

Score these TEN factors, each 0-100, as the MEAN across the ${count} chapters. Use the FULL range
(90+ standout, 80-89 strong, 70-79 solid, 60-69 mediocre, <60 weak; most AI content lands 70-85):
 - retention: remembered a week later? portable compact memorable lines, review-card backs reworded
   (not pasted), one-idea-per-card, sticky framing.
 - quizzes: keys sound; distractors plausible real misconceptions (not gameable by length/junk absolutes,
   not one repeated distractor MOLD across questions); test application vs bare recall; explanations
   say WHY wrong answers are wrong.
 - transfer (lens>tactic): a reusable way of SEEING a class of situations (names the mechanism,
   generalizes across domains) vs a one-off trick.
 - practical: if-then plans imperative/specific/varied (not the same numeric micro-action stamped
   everywhere); 24h challenge + weekly practice concrete & realistic & doable; not performative theater.
 - summaries: fast/deep/full progressively deepen (each tier ADDS, no paste-duplication), distilled,
   fast-read alone leaves the core idea.
 - tone: register fit to ${input.author}'s voice; NON-GENERIC (not interchangeable AI-narrator); warm without
   condescension; no aphorism-stacking.
 - limits: teaches when the idea does NOT apply / its failure mode / counter-cases?
 - insight: non-obvious (reverses a default); counterintuition strength; concreteness/narrative voltage
   (real specific cases vs hollow proxy characters); outcome variety.
 - density: each paragraph earns its place with new info; penalize restatement/padding.
 - beginner: a newcomer with ZERO background can follow; terms defined on first use; core examples/math
   TAUGHT not assumed; gentle on-ramp; not a dense unintroduced named cast.

TEXTURE-SAMENESS AXES — judge each LOW/MED/HIGH across your ${count} chapters (HIGH = 3+ chapters share it):
 - scene_skeleton: one dramatic shape reused (e.g. "a miss has already happened, a character traces it
   to a skipped framework step, applies the tool, small win") — HIGH if the same skeleton carries
   most chapters even when surface details differ.
 - repeated_unit: a recurring structural shell (numerical self-audit, the same checklist walk,
   identical example arc) stamped across chapters.
 - prop_stamp: the same concrete prop/location detail recycled as texture (a cold mug of coffee,
   a calendar block, the same kind of meeting room).
 - proxy_cast: generic role-named stand-ins ("a manager", "an analyst") crowding out real named
   humans from the source — HIGH if whole chapters have ZERO named real people.
Also judge book3_churn (would a reader of 3 books in this library feel they're re-reading the same
book — one house voice + one skeleton): LOW/MED/HIGH.

RETURN exactly this JSON (and nothing else):
{"reader":${input.readerNumber},"gate_verdict":"PASS|FAIL","gate_failures":"<verbatim or none>",
"retention":0,"quizzes":0,"transfer":0,"practical":0,"summaries":0,"tone":0,"limits":0,
"insight":0,"density":0,"beginner":0,"book3_churn":"LOW|MED|HIGH",
"scene_skeleton":"LOW|MED|HIGH","repeated_unit":"LOW|MED|HIGH","prop_stamp":"LOW|MED|HIGH",
"proxy_cast":"LOW|MED|HIGH","apparatus_quotes":"<verbatim leaks or none>",
"texture_note":"<1 line: the dominant repeated shape, if any>",
"note":"<1-2 lines: strongest + weakest>"}
`;
}
