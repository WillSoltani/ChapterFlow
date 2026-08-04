/**
 * IMP-06 — the diversity ACTIVATION CONTRACT (F-008/F-016, instruction 8/9).
 *
 * Diversity intervention is evidence-gated by design: the pipeline may MEASURE
 * structural features and clone signals freely (shadow), but a check may become
 * advisory or blocking ONLY through a versioned config that names its held-out
 * evidence and freezes its thresholds. No code path may activate a check ad hoc —
 * `validateDiversityConfig` is the single admission gate and every consumer
 * resolves the effective mode through `effectiveMode`.
 *
 * DEFAULT_DIVERSITY_CONFIG ships ALL-SHADOW: reports only, no rejection, no
 * assignment, no writer-card change. That is the required v25 state until the
 * IMP-11 bakeoff / held-out evaluation produces the evidence instruction 8 demands
 * (harmful concentration shown; intervention improves quality; source/quiz/causal
 * defects do not increase). Exact-clone checks are separated from broad similarity
 * (instruction 10): they may be promoted after fixture calibration, but they SHIP
 * shadow like everything else — promotion is a config change with evidence, never
 * a code default.
 *
 * When a check IS active, the render contract (instruction 9) caps exposure at
 * MOST maxActiveConstraintsPerChapter (≤2) compact OUTCOME lines, never an
 * internal taxonomy label, and each active constraint must record WHY it was
 * selected. The label→outcome phrasing lives here so no caller can leak a
 * taxonomy name onto a card by accident.
 */

import { createHash } from "node:crypto";

export const DIVERSITY_CONFIG_SCHEMA_VERSION = "diversity-config-v1" as const;

export type DiversityMode = "shadow" | "advisory" | "blocking";

/** The check classes the config can govern. `exact-clone` is deliberately its own
 *  class (instruction 10) — it is the only class eligible for `blocking` in v1. */
export type DiversityCheckClass =
  | "exact-clone"
  | "near-clone"
  | "feature-concentration";

export type DiversityCheckConfig = {
  mode: DiversityMode;
  /** Frozen numeric thresholds for the check (e.g. { minNgramWords: 12,
   *  scenarioJaccard: 0.82 }). Required non-empty when mode !== "shadow". */
  thresholds: Record<string, number>;
  /** Pointer to the held-out evidence that justified activation (report path,
   *  bakeoff run id, …). Required non-empty when mode !== "shadow". */
  evidenceRef: string | null;
  /** Why this check was selected for activation — recorded, human-readable.
   *  Required non-empty when mode !== "shadow". */
  selectionReason: string | null;
};

export type DiversityConfigV1 = {
  schema: typeof DIVERSITY_CONFIG_SCHEMA_VERSION;
  configVersion: number;
  checks: Record<DiversityCheckClass, DiversityCheckConfig>;
  /** Hard cap on ACTIVE outcome constraints rendered to any one chapter
   *  (instruction 9: "at most one or two"). Validation rejects > 2. */
  maxActiveConstraintsPerChapter: number;
};

export const DIVERSITY_CHECK_CLASSES: DiversityCheckClass[] = [
  "exact-clone",
  "near-clone",
  "feature-concentration",
];

/** The shipped default: everything shadow, thresholds present for the DETECTORS'
 *  calibration (they parameterize measurement, not rejection), no evidence needed
 *  because nothing is active. */
export const DEFAULT_DIVERSITY_CONFIG: DiversityConfigV1 = {
  schema: DIVERSITY_CONFIG_SCHEMA_VERSION,
  configVersion: 1,
  checks: {
    "exact-clone": {
      mode: "shadow",
      thresholds: { minNgramWords: 12, minHookChars: 24 },
      evidenceRef: null,
      selectionReason: null,
    },
    "near-clone": {
      mode: "shadow",
      thresholds: { scenarioJaccard: 0.82, stemFamilyShare: 0.5 },
      evidenceRef: null,
      selectionReason: null,
    },
    "feature-concentration": {
      mode: "shadow",
      thresholds: { maxShare: 0.67 },
      evidenceRef: null,
      selectionReason: null,
    },
  },
  maxActiveConstraintsPerChapter: 2,
};

/** Deterministic hash of a config — stamped into ledger records and attempt
 *  evidence (instruction 12) so every measurement names the exact config it ran
 *  under. */
export function diversityConfigHash(config: DiversityConfigV1): string {
  return createHash("sha256").update(canonicalJson(config)).digest("hex");
}

/** Key-sorted recursive canonical JSON — key order in the source object can never
 *  change the hash. */
function canonicalJson(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(",")}]`;
  const keys = Object.keys(v as object).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson((v as Record<string, unknown>)[k])}`).join(",")}}`;
}

/** The single admission gate (instruction 8). Returns [] when valid; every error
 *  names the field. Rejects: unknown modes/classes, active checks without
 *  evidenceRef + selectionReason + non-empty thresholds, a per-chapter constraint
 *  cap above 2, and — v1 policy — any `blocking` mode outside exact-clone (broad
 *  similarity stays shadow-first until IMP-11 calibrates it). */
export function validateDiversityConfig(c: unknown): string[] {
  const errors: string[] = [];
  if (c === null || typeof c !== "object") return ["config: not an object"];
  const v = c as Partial<DiversityConfigV1> & Record<string, unknown>;
  if (v.schema !== DIVERSITY_CONFIG_SCHEMA_VERSION) errors.push(`config.schema: expected ${DIVERSITY_CONFIG_SCHEMA_VERSION}`);
  if (typeof v.configVersion !== "number" || v.configVersion < 1) errors.push("config.configVersion: must be a number >= 1");
  if (typeof v.maxActiveConstraintsPerChapter !== "number" || v.maxActiveConstraintsPerChapter < 0 || v.maxActiveConstraintsPerChapter > 2) {
    errors.push("config.maxActiveConstraintsPerChapter: must be 0..2 (instruction 9: at most one or two)");
  }
  const checks = v.checks as Record<string, DiversityCheckConfig> | undefined;
  if (!checks || typeof checks !== "object") { errors.push("config.checks: missing"); return errors; }
  for (const cls of Object.keys(checks)) {
    if (!DIVERSITY_CHECK_CLASSES.includes(cls as DiversityCheckClass)) errors.push(`config.checks.${cls}: unknown check class`);
  }
  for (const cls of DIVERSITY_CHECK_CLASSES) {
    const check = checks[cls];
    if (!check) { errors.push(`config.checks.${cls}: missing`); continue; }
    if (!["shadow", "advisory", "blocking"].includes(check.mode)) {
      errors.push(`config.checks.${cls}.mode: unknown mode "${String(check.mode)}"`);
      continue;
    }
    if (check.mode !== "shadow") {
      if (typeof check.evidenceRef !== "string" || check.evidenceRef.trim().length === 0) {
        errors.push(`config.checks.${cls}.evidenceRef: required to activate (held-out evidence, instruction 8)`);
      }
      if (typeof check.selectionReason !== "string" || check.selectionReason.trim().length === 0) {
        errors.push(`config.checks.${cls}.selectionReason: required to activate (record why, instruction 9)`);
      }
      if (!check.thresholds || Object.keys(check.thresholds).length === 0) {
        errors.push(`config.checks.${cls}.thresholds: must be frozen non-empty to activate`);
      }
      if (check.mode === "blocking" && cls !== "exact-clone") {
        errors.push(`config.checks.${cls}.mode: only exact-clone may block in v1 — broad similarity stays shadow-first (instruction 10)`);
      }
    }
  }
  return errors;
}

/** Resolve a check's effective mode through validation: an INVALID config never
 *  activates anything — it degrades to shadow LOUDLY (the caller receives the
 *  errors and must surface them; measurement continues, rejection does not).
 *  This is fail-safe-to-shadow, not a silent fallback: the config error list is
 *  returned alongside so no caller can swallow it silently. */
export function effectiveMode(
  config: DiversityConfigV1,
  cls: DiversityCheckClass,
): { mode: DiversityMode; configErrors: string[] } {
  const configErrors = validateDiversityConfig(config);
  if (configErrors.length > 0) return { mode: "shadow", configErrors };
  return { mode: config.checks[cls].mode, configErrors: [] };
}
