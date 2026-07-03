/**
 * rubricThresholds — loader + validator for config/rubric-thresholds.json.
 *
 * Follows the src/librarian/venuePlan.ts loader convention: read the JSON,
 * hand-validate its shape, and THROW a specific error on drift rather than
 * limping along with a partial object (there is no ajv in this pipeline; the
 * .schema.json ships for documentation + the runtimeSchemas $schema-exists
 * check, and this loader is the runtime enforcement).
 *
 * Units note: tellRateMax / transferMin are FRACTIONS in [0,1]. P01's
 * distractorTellRate / transferRatio return score.py-style 0..100 percentages;
 * bookRubricMetrics divides those by 100 before comparing here, so a single
 * "0.20" in config reads naturally as "20%".
 */

import { readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url)); // .../src/metrics
const RUBRIC_THRESHOLDS_PATH = resolve(__dirname, "../../config/rubric-thresholds.json");

export type MetricBand = {
  /** Lower bound of the PASS band. */
  min: number;
  /** Upper bound of the PASS band. */
  max: number;
  /** How far outside [min,max] still counts as WARN (rather than FAIL). */
  warnTolerance: number;
};

/** W2 (plan §WS5) card-quality gate caps — see src/metrics/cardQualityGates.ts.
 *  All are BLOCKING; calibrated in docs/v24/w2-card-preflight-calibration.md. */
export type CardQualityThresholds = {
  /** Min KEY content-n-gram to flag an echo-tell (calibrated zero-FP tier = 5). */
  echoKeyThreshold: number;
  /** A flag also requires EVERY distractor strictly below this n-gram (= 4). */
  echoDistractorCeiling: number;
  /** Max questions/chapter where the key may be the uniquely-shortest choice (= 4). */
  lengthTellShortestMax: number;
  /** Max questions/chapter where the key may be the uniquely-longest choice (= 9). */
  lengthTellLongestMax: number;
};

/** Fail-closed defaults used when a legacy config omits the `cardQuality` block.
 *  These are the CALIBRATED caps (top-5 pass, POM v24 fails), so an absent block
 *  keeps the gates ON at their intended strength — never silently disabled. */
export const DEFAULT_CARD_QUALITY_THRESHOLDS: CardQualityThresholds = {
  echoKeyThreshold: 5,
  echoDistractorCeiling: 4,
  lengthTellShortestMax: 4,
  lengthTellLongestMax: 9,
};

export type RubricThresholds = {
  schemaVersion: "rubric-thresholds-v1";
  /** Flesch Reading Ease band (RUBRIC §11 beginner-friendliness: 72–84). */
  fleschEase: MetricBand;
  /** Flesch-Kincaid grade band (RUBRIC §11: ~7–8). */
  fkGrade: MetricBand;
  /** Max distractor-tell rate as a fraction (RUBRIC §3 goal < 0.20). Fail above. */
  tellRateMax: number;
  /** Min transfer ratio as a fraction (RUBRIC §3 goal > 0.70). Fail below. */
  transferMin: number;
  /** Min clean (≤14-word) memorable lines per chapter (RUBRIC §2: ≥2). Fail below. */
  memorableCleanMin: number;
  /** Diagnostic (WARN-only) ceiling for house-tic occurrences in chapter prose. */
  houseTicDensityWarnMax: number;
  /** Diagnostic (WARN-only) ceiling for nominalization rate (percent of words). */
  nominalizationRateWarnMax: number;
  /** W2 per-chapter card-quality gate caps (defaults applied when the block is absent). */
  cardQuality: CardQualityThresholds;
};

function fail(msg: string): never {
  throw new Error(`rubric-thresholds.json invalid: ${msg}`);
}

function num(obj: Record<string, unknown>, key: string, where: string): number {
  const v = obj[key];
  if (typeof v !== "number" || !Number.isFinite(v)) fail(`${where}.${key} must be a finite number (got ${JSON.stringify(v)})`);
  return v as number;
}

/** Validate the optional `cardQuality` block. Absent → calibrated defaults
 *  (fail-closed: the gates stay ON at their intended strength). Present but wrong
 *  shape → THROW (no silent partial). */
function cardQuality(raw: unknown): CardQualityThresholds {
  if (raw === undefined) return { ...DEFAULT_CARD_QUALITY_THRESHOLDS };
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) fail("cardQuality must be an object");
  const obj = raw as Record<string, unknown>;
  const t: CardQualityThresholds = {
    echoKeyThreshold: num(obj, "echoKeyThreshold", "cardQuality"),
    echoDistractorCeiling: num(obj, "echoDistractorCeiling", "cardQuality"),
    lengthTellShortestMax: num(obj, "lengthTellShortestMax", "cardQuality"),
    lengthTellLongestMax: num(obj, "lengthTellLongestMax", "cardQuality"),
  };
  for (const [k, v] of Object.entries(t)) {
    if (!Number.isInteger(v) || v < 0) fail(`cardQuality.${k} must be a non-negative integer (got ${JSON.stringify(v)})`);
  }
  // The distractor ceiling MUST stay strictly below the key threshold, or the
  // echo gate can never distinguish key-only lifts from all-choice echoes.
  if (t.echoDistractorCeiling >= t.echoKeyThreshold) {
    fail(`cardQuality.echoDistractorCeiling (${t.echoDistractorCeiling}) must be < echoKeyThreshold (${t.echoKeyThreshold})`);
  }
  return t;
}

function band(raw: unknown, where: string): MetricBand {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) fail(`${where} must be an object`);
  const obj = raw as Record<string, unknown>;
  const b: MetricBand = { min: num(obj, "min", where), max: num(obj, "max", where), warnTolerance: num(obj, "warnTolerance", where) };
  if (b.min > b.max) fail(`${where}.min (${b.min}) must be <= ${where}.max (${b.max})`);
  if (b.warnTolerance < 0) fail(`${where}.warnTolerance must be >= 0`);
  return b;
}

/** Validate a parsed rubric-thresholds object, throwing on any drift. Exported
 *  so tests can validate synthetic threshold objects without touching disk. */
export function validateRubricThresholds(raw: unknown): RubricThresholds {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) fail("root must be an object");
  const obj = raw as Record<string, unknown>;
  if (obj.schemaVersion !== "rubric-thresholds-v1") fail(`schemaVersion must be "rubric-thresholds-v1" (got ${JSON.stringify(obj.schemaVersion)})`);
  const t: RubricThresholds = {
    schemaVersion: "rubric-thresholds-v1",
    fleschEase: band(obj.fleschEase, "fleschEase"),
    fkGrade: band(obj.fkGrade, "fkGrade"),
    tellRateMax: num(obj, "tellRateMax", "root"),
    transferMin: num(obj, "transferMin", "root"),
    memorableCleanMin: num(obj, "memorableCleanMin", "root"),
    houseTicDensityWarnMax: num(obj, "houseTicDensityWarnMax", "root"),
    nominalizationRateWarnMax: num(obj, "nominalizationRateWarnMax", "root"),
    cardQuality: cardQuality(obj.cardQuality),
  };
  if (t.tellRateMax < 0 || t.tellRateMax > 1) fail(`tellRateMax must be a fraction in [0,1] (got ${t.tellRateMax})`);
  if (t.transferMin < 0 || t.transferMin > 1) fail(`transferMin must be a fraction in [0,1] (got ${t.transferMin})`);
  if (!Number.isInteger(t.memorableCleanMin) || t.memorableCleanMin < 0) fail(`memorableCleanMin must be a non-negative integer (got ${t.memorableCleanMin})`);
  return t;
}

let _cached: RubricThresholds | null = null;

/** Load + validate config/rubric-thresholds.json (cached). Throws on drift. */
export function loadRubricThresholds(): RubricThresholds {
  if (_cached) return _cached;
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(RUBRIC_THRESHOLDS_PATH, "utf8"));
  } catch (err) {
    fail(`unreadable/invalid JSON at ${RUBRIC_THRESHOLDS_PATH}: ${(err as Error).message}`);
  }
  _cached = validateRubricThresholds(raw);
  return _cached;
}
