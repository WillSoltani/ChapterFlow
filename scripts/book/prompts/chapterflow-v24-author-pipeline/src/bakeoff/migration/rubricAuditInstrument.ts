/**
 * s16-rubric-audit-v1 — the D7 gold-bar gate instrument (plan v2 P1).
 *
 * Mechanizes the owner's rubric-v2.0 standalone chapter audit
 * (docs/v25/rubric-audit-2026-07-15/, anchors in
 * .agents/skills/chapterflow-book-evaluator/references/rubric-v2.md) as a
 * repeatable, fail-closed pipeline instrument:
 *
 *  - APP-FAITHFUL rendering: audit documents carry the full quiz key +
 *    explanations (the owner's spot-check run scored key-stripped adjudication
 *    docs; product audits must score what readers get), plus standalone
 *    per-layer documents for the D7 layer-independence hard gate.
 *  - Record validation: exact TS ports of the owner's rater/adjudication
 *    validators, proven bit-compatible against the sealed owner run.
 *  - Deterministic report: bar verdict (mean >= 85, min >= 80, core domains
 *    >= 3.0, required gates, layer independence) and the +-3.0
 *    hidden-calibration guard — a batch whose calibration re-adjudication
 *    drifts from the owner's sealed score is VOID, never re-scored.
 *
 * The rating itself is performed by isolated Claude worker agents under the
 * owner's contracts (zero codex/API calls); this module renders their inputs
 * and fail-closes their outputs. Adjudicated records, once retained, are
 * immutable evidence.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { hashCanonical, sha256Hex } from "../../contracts/contractUtil.js";
import { canonicalPretty } from "./corpusBuilderCore.js";
import { writeFileAtomic } from "../../lib/atomicWrite.js";
import { artifactSha256FromText } from "./rubricAuditCanonical.js";
import {
  RubricAuditError,
  loadRecord,
  validateDispatchReceipt,
  validatePairChain,
  type JsonRecord,
  type LoadedRecord,
  type RubricInspection,
} from "./rubricAuditReceipts.js";

// WP-503: exported (was module-private) so rubricAuditHarness.ts can resolve the
// SAME pipeline-relative root the ledger writes under, from the `repositoryRoot`
// this module already threads everywhere — never a second literal copy of the string.
export const PIPELINE_REL = "scripts/book/prompts/chapterflow-v24-author-pipeline";

export const RUBRIC_AUDIT_SCHEMA_BATCH = "rubric-audit-batch-v1" as const;
export const RUBRIC_AUDIT_SCHEMA_REPORT = "rubric-audit-report-v1" as const;
export const RUBRIC_AUDIT_RUBRIC_VERSION = "2.0" as const;
export const RUBRIC_AUDITS_DIR_REL_PATH =
  `${PIPELINE_REL}/state/migration-experiments/rubric-audits` as const;

/** Rubric v2.0 Domains 1-8 (standalone-chapter scope): weight + subcriteria. */
export const RUBRIC_DOMAINS: ReadonlyArray<{ key: string; weight: number; subcriteria: readonly string[] }> = [
  { key: "epistemic_integrity", weight: 15, subcriteria: ["claim_support_fit", "uncertainty_limitations", "internal_consistency_qa", "misuse_safeguards"] },
  { key: "audience_fit", weight: 12, subcriteria: ["language_clarity", "beginner_onboarding", "signal_noise_framework_load", "audience_context_accessibility"] },
  { key: "mental_model_coherence", weight: 15, subcriteria: ["central_model", "mechanism_causal_explanation", "cross_concept_integration", "nuance_diagnostic_power"] },
  { key: "learning_architecture", weight: 12, subcriteria: ["sequencing_scaffolding", "worked_examples_contrasts", "active_processing", "feedback_metacognitive_calibration"] },
  { key: "retention_retrieval", weight: 10, subcriteria: ["meaningful_retrieval_cues", "cumulative_reinforcement", "quiz_retrieval_depth", "interference_control_consolidation"] },
  { key: "transfer_action_judgment", weight: 15, subcriteria: ["concrete_actions", "cross_context_transfer", "implementation_feedback_support", "boundaries_adaptation_tradeoffs"] },
  { key: "motivation_autonomy", weight: 8, subcriteria: ["personal_relevance", "achievable_progress", "autonomy_non_shaming_tone", "calibrated_confidence"] },
  { key: "engagement_momentum", weight: 8, subcriteria: ["curiosity_momentum", "narrative_example_vividness", "emotional_relevance", "instructional_alignment"] },
];

export const RUBRIC_CHAPTER_WEIGHT_TOTAL = 95;

/** D7 core domains (rubric Domains 1-6): each must average >= the floor. */
export const RUBRIC_CORE_DOMAIN_KEYS: readonly string[] = [
  "epistemic_integrity", "audience_fit", "mental_model_coherence",
  "learning_architecture", "retention_retrieval", "transfer_action_judgment",
];

export const RUBRIC_BASE_GATE_KEYS: readonly string[] = [
  "chapter_artifact_completeness", "epistemic_instructional_safety", "ethics_reader_autonomy",
  "purpose_audience_declaration", "external_accuracy", "actual_book_completeness",
];
export const RUBRIC_LAYER_INDEPENDENCE_GATE_KEY = "layer_independence" as const;
const GATE_STATUSES = new Set(["pass", "conditional", "fail", "not_assessed", "unevaluable"]);

/** Which gate statuses a D7-passing chapter may carry. */
const GATE_ALLOWED: ReadonlyArray<[string, ReadonlySet<string>]> = [
  ["chapter_artifact_completeness", new Set(["pass"])],
  ["epistemic_instructional_safety", new Set(["pass"])],
  ["ethics_reader_autonomy", new Set(["pass"])],
  ["purpose_audience_declaration", new Set(["pass", "conditional"])],
  ["external_accuracy", new Set(["pass", "not_assessed"])],
  ["actual_book_completeness", new Set(["pass", "unevaluable"])],
];

/** Validation profiles: the sealed owner run carries exactly the 6 base gates;
 *  v25 candidate audits additionally REQUIRE the layer-independence gate.
 *  Calibration re-adjudications mirror the owner-run conditions. */
export type RubricAuditProfile = "owner-run-compat" | "v25";

export const RUBRIC_AUDIT_BANDS: ReadonlyArray<{ min: number; label: string }> = [
  { min: 90, label: "Reference-standard design, subject to gate and core-domain rules" },
  { min: 80, label: "Strong design with identifiable improvements" },
  { min: 70, label: "Valuable but materially uneven; targeted redesign needed" },
  { min: 60, label: "Substantial redesign needed" },
  { min: 0, label: "Not ready as a ChapterFlow learning product" },
];

export function rubricBand(score: number): string {
  for (const band of RUBRIC_AUDIT_BANDS) {
    if (score >= band.min) return band.label;
  }
  return RUBRIC_AUDIT_BANDS[RUBRIC_AUDIT_BANDS.length - 1].label;
}

export type RubricAuditBar = {
  perChapterMin: number;
  meanMin: number;
  coreDomainFloor: number;
  calibrationTolerance: number;
};

/** D7 ratified bar (plan v2). */
export const RUBRIC_AUDIT_BAR_D7: RubricAuditBar = {
  perChapterMin: 80,
  meanMin: 85,
  coreDomainFloor: 3.0,
  calibrationTolerance: 3.0,
};

/** The three owner-adjudicated calibration references (sealed run
 *  20260715T110908Z). Expected scores are the exact adjudicated
 *  chapter diagnostics; sources are the retained key-free reader docs the
 *  owner audited (byte-identical Desktop copies). */
export const RUBRIC_CALIBRATION_REFERENCES: ReadonlyArray<{
  unit: string;
  docRelPath: string;
  docSha256: string;
  expectedChapterDiagnostic: number;
}> = [
  {
    unit: "nudge-ch03",
    docRelPath: `${PIPELINE_REL}/state/migration-experiments/reader-gold-dev-pool-v1/reader-docs/nudge-ch03.md`,
    docSha256: "5561431cdd87978ec2bd4def5cf4e2fc7ab53d8379f48e0eaaf7327a9dcaeda7",
    expectedChapterDiagnostic: 70.75657894736842,
  },
  {
    unit: "the-happiness-hypothesis-ch06",
    docRelPath: `${PIPELINE_REL}/state/migration-experiments/reader-gold-dev-pool-v1/reader-docs/the-happiness-hypothesis-ch06.md`,
    docSha256: "98fb3e50e070ca44543881613f39dbaf5c478bfff7e2aea838688f2b3d0e5dd2",
    expectedChapterDiagnostic: 68.8157894736842,
  },
  {
    unit: "made-to-stick-ch04",
    docRelPath: `${PIPELINE_REL}/state/migration-experiments/reader-gold-dev-pool-v1/reader-docs/made-to-stick-ch04.md`,
    docSha256: "9a20a3afd9612faf43ea26575e0f471401c180f58fdef2bcaceedd4a54194120",
    expectedChapterDiagnostic: 67.66447368421052,
  },
];

export const RUBRIC_OWNER_RUN_ID = "20260715T110908Z" as const;
export const RUBRIC_OWNER_RUN_REL_PATH = "docs/v25/rubric-audit-2026-07-15" as const;

function requireCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new RubricAuditError(message);
}

/** python math.isclose(a, b, abs_tol=1e-9) with its default rel_tol=1e-9. */
function isClose(a: number, b: number): boolean {
  return Math.abs(a - b) <= Math.max(1e-9 * Math.max(Math.abs(a), Math.abs(b)), 1e-9);
}

function headingLines(sourceText: string): string[] {
  return sourceText.split("\n").filter((line) => line.startsWith("#"));
}

export function headingInventorySha256(sourceText: string): string {
  return sha256Hex(Buffer.from(`${headingLines(sourceText).join("\n")}\n`, "utf8"));
}

// ── Record validation (TS ports of the owner's validators) ───────────────────

type RatingsByPath = Map<string, number>;

/** Collect the 32 subcriterion ratings keyed by canonical path
 *  (domains.<domain>.subcriteria.<sub>), or null if any is missing/non-numeric.
 *  Exported so the harness's adjudication skeleton computes its rater_agreement
 *  prefill with the SAME walk the validator uses — never a reimplementation. */
export function collectRatings(record: JsonRecord): RatingsByPath | null {
  const out: RatingsByPath = new Map();
  const domains = record.domains as JsonRecord | undefined;
  if (domains === null || typeof domains !== "object") return null;
  for (const domain of RUBRIC_DOMAINS) {
    const entry = domains[domain.key] as JsonRecord | undefined;
    const subs = entry?.subcriteria as JsonRecord | undefined;
    if (subs === null || typeof subs !== "object") return null;
    for (const sub of domain.subcriteria) {
      const rating = (subs[sub] as JsonRecord | undefined)?.rating;
      if (typeof rating !== "number") return null;
      out.set(`domains.${domain.key}.subcriteria.${sub}`, rating);
    }
  }
  return out;
}

function validateDomains(
  record: JsonRecord,
  errors: string[],
  args: { ratingCheck: (rating: unknown) => boolean; ratingMessage: string },
): void {
  const domains = (record.domains ?? {}) as JsonRecord;
  const expectedKeys = new Set(RUBRIC_DOMAINS.map((d) => d.key));
  const actualKeys = new Set(Object.keys(domains));
  if (actualKeys.size !== expectedKeys.size || [...expectedKeys].some((key) => !actualKeys.has(key))) {
    errors.push("domains must contain exactly Domains 1-8");
  }
  let weightedTotal = 0;
  for (const spec of RUBRIC_DOMAINS) {
    const domain = (domains[spec.key] ?? {}) as JsonRecord;
    if (domain.weight !== spec.weight) errors.push(`${spec.key}.weight must be ${spec.weight}`);
    const subs = (domain.subcriteria ?? {}) as JsonRecord;
    const subKeys = new Set(Object.keys(subs));
    if (subKeys.size !== spec.subcriteria.length || spec.subcriteria.some((key) => !subKeys.has(key))) {
      errors.push(`${spec.key}.subcriteria keys are invalid`);
      continue;
    }
    const ratings: number[] = [];
    for (const subKey of spec.subcriteria) {
      const sub = (subs[subKey] ?? {}) as JsonRecord;
      const rating = sub.rating;
      if (!args.ratingCheck(rating)) {
        errors.push(`${spec.key}.${subKey}.rating ${args.ratingMessage}`);
        continue;
      }
      ratings.push(rating as number);
      const rationale = String(sub.rationale ?? sub.anchor_rationale ?? "").trim();
      if (rationale.length === 0) errors.push(`${spec.key}.${subKey} needs rationale`);
      const evidence = sub.evidence;
      if (!Array.isArray(evidence) || evidence.length === 0) errors.push(`${spec.key}.${subKey} needs evidence`);
    }
    if (ratings.length === 4) {
      const expectedScore = ratings.reduce((a, b) => a + b, 0) / 4;
      const expectedPoints = (expectedScore / 4) * spec.weight;
      if (!isClose(Number(domain.domain_score ?? -1), expectedScore)) {
        errors.push(`${spec.key}.domain_score arithmetic mismatch`);
      }
      if (!isClose(Number(domain.weighted_points ?? -1), expectedPoints)) {
        errors.push(`${spec.key}.weighted_points arithmetic mismatch`);
      }
      weightedTotal += expectedPoints;
    }
    if (!Array.isArray(domain.strengths) || domain.strengths.length < 2) errors.push(`${spec.key} needs at least two strengths`);
    if (!Array.isArray(domain.limitations) || domain.limitations.length < 1) errors.push(`${spec.key} needs at least one limitation`);
    if (String(domain.pattern ?? domain.within_chapter_pattern ?? "").trim().length === 0) errors.push(`${spec.key} needs pattern`);
    if (String(domain.rationale ?? domain.anchor_linked_rationale ?? domain.anchor_rationale ?? "").trim().length === 0) {
      errors.push(`${spec.key} needs rationale`);
    }
    if (String(domain.scope_note ?? "").trim().length === 0) errors.push(`${spec.key} needs scope_note`);
  }
  const expectedDiagnostic = (weightedTotal / RUBRIC_CHAPTER_WEIGHT_TOTAL) * 100;
  if (!isClose(Number(record.chapter_diagnostic_score ?? -1), expectedDiagnostic)) {
    errors.push("chapter_diagnostic_score arithmetic mismatch");
  }
}

function validateSourceBinding(
  record: JsonRecord,
  errors: string[],
  args: { inspection: RubricInspection; sourceText: string },
): void {
  const sourceHash = sha256Hex(Buffer.from(args.sourceText, "utf8"));
  if (sourceHash !== args.inspection.source_hash) errors.push("source hash drift");
  const headings = headingLines(args.sourceText);
  const headingHash = headingInventorySha256(args.sourceText);
  const chapter = (record.chapter ?? {}) as JsonRecord;
  if (headingHash !== args.inspection.heading_inventory_sha256) errors.push("heading inventory drift");
  const expectedChapter = (args.inspection.chapter_inventory?.[0] ?? {}) as JsonRecord;
  for (const key of ["chapter_id", "number", "title"]) {
    if (chapter[key] !== expectedChapter[key]) errors.push(`chapter.${key} differs from inspection`);
  }
  if (chapter.source_path !== args.inspection.source_path) errors.push("chapter.source_path differs from inspection");
  if (chapter.heading_inventory_sha256 !== headingHash) errors.push("chapter.heading_inventory_sha256 differs from inspection");
  if (chapter.read_status !== "full") errors.push("chapter.read_status must be full");
  const sections = chapter.section_inventory;
  if (!Array.isArray(sections) || sections.length !== headings.length - 1) {
    errors.push(`section_inventory must cover all ${headings.length - 1} H2/H3 headings`);
  }
}

function validateScope(record: JsonRecord, errors: string[], args: { requireScopeType: boolean }): void {
  const scope = (record.scope ?? {}) as JsonRecord;
  if (args.requireScopeType) {
    if (scope.scope_type !== "standalone_chapter_audit") errors.push("scope.scope_type mismatch");
  } else if (scope.scope_type !== undefined && scope.scope_type !== "standalone_chapter_audit") {
    errors.push("scope type must be standalone_chapter_audit");
  }
  const expected: Array<[string, unknown]> = [
    ["actual_book_inventory_complete", false],
    ["full_book_score", null],
    ["full_book_certification", "unevaluable"],
    ["domain_9", "unassessable"],
  ];
  for (const [key, value] of expected) {
    if (scope[key] !== value) errors.push(`scope.${key} must equal ${JSON.stringify(value)}`);
  }
}

/** The EXACT gate-key set a record must carry under a profile — the single
 *  source both validateGates and the harness's task/record skeletons derive
 *  from, so the rendered task can never teach a different gate set than the
 *  validator counts. */
export function expectedGateKeys(profile: RubricAuditProfile): string[] {
  return profile === "v25"
    ? [...RUBRIC_BASE_GATE_KEYS, RUBRIC_LAYER_INDEPENDENCE_GATE_KEY]
    : [...RUBRIC_BASE_GATE_KEYS];
}

function validateGates(record: JsonRecord, errors: string[], profile: RubricAuditProfile): void {
  const gates = (record.gates ?? {}) as JsonRecord;
  const expectedKeys = expectedGateKeys(profile);
  const actualKeys = new Set(Object.keys(gates));
  if (actualKeys.size !== expectedKeys.length || expectedKeys.some((key) => !actualKeys.has(key))) {
    errors.push(`gates must contain exactly: ${expectedKeys.join(", ")}`);
    return;
  }
  for (const key of RUBRIC_BASE_GATE_KEYS) {
    const gate = (gates[key] ?? {}) as JsonRecord;
    if (!GATE_STATUSES.has(String(gate.status ?? ""))) errors.push(`gate ${key} status is invalid`);
    if (String(gate.rationale ?? "").trim().length === 0) errors.push(`gate ${key} needs rationale`);
  }
  if (profile === "v25") {
    const gate = (gates[RUBRIC_LAYER_INDEPENDENCE_GATE_KEY] ?? {}) as JsonRecord;
    if (gate.status !== "pass" && gate.status !== "fail") {
      errors.push("layer_independence gate status must be pass or fail");
    }
    if (String(gate.rationale ?? "").trim().length === 0) errors.push("layer_independence gate needs rationale");
    const layers = (gate.layers ?? {}) as JsonRecord;
    for (const layerKey of ["fast", "deep", "full"]) {
      const layer = (layers[layerKey] ?? {}) as JsonRecord;
      if (typeof layer.self_contained !== "boolean") {
        errors.push(`layer_independence.layers.${layerKey}.self_contained must be boolean`);
      }
      if (!Array.isArray(layer.findings)) {
        errors.push(`layer_independence.layers.${layerKey}.findings must be an array`);
      }
    }
    const anyNotSelfContained = ["fast", "deep", "full"].some((layerKey) => {
      const layer = (layers[layerKey] ?? {}) as JsonRecord;
      return layer.self_contained === false;
    });
    if (gate.status === "pass" && anyNotSelfContained) {
      errors.push("layer_independence gate cannot pass with a non-self-contained layer");
    }
  }
}

const RATER_REQUIRED_FIELDS = [
  "diagnostic_band", "strongest_qualities", "weakest_qualities", "engagement_curve",
  "comprehension_retention_analysis", "practical_use_judgment_analysis",
  "best_fit_readers", "struggling_readers", "verdict",
] as const;

export function validateChapterRaterRecord(args: {
  record: LoadedRecord;
  dispatch: LoadedRecord;
  inspection: RubricInspection;
  sourceText: string;
  profile: RubricAuditProfile;
}): string[] {
  const errors: string[] = [];
  const record = args.record.value;
  if (record.schema_version !== "1.0.0") errors.push("schema_version must be 1.0.0");
  if (record.artifact_type !== "chapterflow_standalone_chapter_rating") errors.push("artifact_type is invalid");
  errors.push(...validateDispatchReceipt(args.dispatch, { result: args.record, inspection: args.inspection }));
  if (record.worker_task_id !== args.dispatch.value.worker_task_id) errors.push("worker_task_id differs from receipt");
  if (record.worker_session_id !== args.dispatch.value.worker_session_id) errors.push("worker_session_id differs from receipt");
  validateSourceBinding(record, errors, { inspection: args.inspection, sourceText: args.sourceText });
  validateScope(record, errors, { requireScopeType: false });
  validateDomains(record, errors, {
    ratingCheck: (rating) => typeof rating === "number" && Number.isInteger(rating) && rating >= 0 && rating <= 4,
    ratingMessage: "must be integer 0-4",
  });
  if (!Array.isArray(record.improvements) || record.improvements.length !== 3) {
    errors.push("exactly three improvements required");
  }
  for (const key of RATER_REQUIRED_FIELDS) {
    const value = record[key];
    const missing = value === undefined || value === null || value === "" ||
      (Array.isArray(value) && value.length === 0);
    if (missing) errors.push(`missing ${key}`);
  }
  validateGates(record, errors, args.profile);
  return [...new Set(errors)].sort();
}

export function validateChapterAdjudicationRecord(args: {
  record: LoadedRecord;
  primary: LoadedRecord;
  verification: LoadedRecord;
  primaryDispatch: LoadedRecord;
  verificationDispatch: LoadedRecord;
  pairSeal: LoadedRecord;
  inspection: RubricInspection;
  sourceText: string;
  profile: RubricAuditProfile;
}): string[] {
  const errors: string[] = [];
  const record = args.record.value;
  errors.push(...validatePairChain({
    primary: args.primary,
    verification: args.verification,
    primaryDispatch: args.primaryDispatch,
    verificationDispatch: args.verificationDispatch,
    pairSeal: args.pairSeal,
    inspection: args.inspection,
  }));
  if (record.schema_version !== "1.0.0" || record.artifact_type !== "chapterflow_standalone_chapter_adjudication") {
    errors.push("adjudication schema identity is invalid");
  }
  if (record.rater_role !== "adjudicated") errors.push("rater_role must be adjudicated");
  if (record.run_id !== args.primary.value.run_id || record.source_hash !== args.inspection.source_hash) {
    errors.push("adjudication source/run binding mismatch");
  }
  const book = (record.book ?? {}) as JsonRecord;
  if (book.book_id !== args.inspection.book_id) errors.push("adjudication book id mismatch");
  if (record.blind_pair_seal_sha256 !== artifactSha256FromText(args.pairSeal.raw)) {
    errors.push("blind_pair_seal_sha256 mismatch");
  }
  validateSourceBinding(record, errors, { inspection: args.inspection, sourceText: args.sourceText });
  validateScope(record, errors, { requireScopeType: true });
  validateDomains(record, errors, {
    ratingCheck: (rating) => typeof rating === "number" && rating >= 0 && rating <= 4 && isClose(rating * 2, Math.round(rating * 2)),
    ratingMessage: "must be a half-point 0-4",
  });

  const primaryRatings = collectRatings(args.primary.value);
  const verificationRatings = collectRatings(args.verification.value);
  if (primaryRatings === null || verificationRatings === null) {
    errors.push("blind rater records are missing ratings");
    return [...new Set(errors)].sort();
  }
  const diffs = new Map<string, number>();
  for (const [path, value] of primaryRatings) {
    diffs.set(path, Math.abs(value - (verificationRatings.get(path) ?? Number.NaN)));
  }
  const agreement = (record.rater_agreement ?? {}) as JsonRecord;
  const diffValues = [...diffs.values()];
  const expectedMad = diffValues.reduce((a, b) => a + b, 0) / diffValues.length;
  if (!isClose(Number(agreement.mean_absolute_subcriterion_difference ?? -1), expectedMad)) {
    errors.push("mean agreement metric mismatch");
  }
  if (!isClose(Number(agreement.maximum_subcriterion_difference ?? -1), Math.max(...diffValues))) {
    errors.push("maximum agreement metric mismatch");
  }
  const expectedScoreDiff = Math.abs(
    Number(args.primary.value.chapter_diagnostic_score) - Number(args.verification.value.chapter_diagnostic_score));
  if (!isClose(Number(agreement.chapter_diagnostic_score_difference ?? -1), expectedScoreDiff)) {
    errors.push("diagnostic score difference mismatch");
  }
  const inputRecords = (agreement.input_records ?? {}) as JsonRecord;
  if (inputRecords.primary_canonical_sha256 !== artifactSha256FromText(args.primary.raw) ||
      inputRecords.verification_canonical_sha256 !== artifactSha256FromText(args.verification.raw)) {
    errors.push("agreement input record hashes mismatch");
  }
  const expectedDisagreements = new Set([...diffs.entries()].filter(([, diff]) => diff !== 0).map(([path]) => path));
  const disagreements = Array.isArray(agreement.disagreements) ? agreement.disagreements as JsonRecord[] : [];
  const actualDisagreements = new Set(disagreements.map((item) => String(item.path ?? "")));
  const sameInventory = actualDisagreements.size === expectedDisagreements.size &&
    [...expectedDisagreements].every((path) => actualDisagreements.has(path));
  if (!sameInventory) errors.push("disagreement inventory mismatch");
  for (const item of disagreements) {
    const path = String(item.path ?? "");
    if (primaryRatings.has(path)) {
      if (item.primary !== primaryRatings.get(path) || item.verification !== verificationRatings.get(path) || !item.source_rechecked) {
        errors.push(`disagreement record invalid for ${path}`);
      }
    }
  }

  if (!Array.isArray(record.improvements) || record.improvements.length !== 3) {
    errors.push("exactly three improvements required");
  }
  const calibrationChanges = record.calibration_changes;
  if (!Array.isArray(calibrationChanges)) {
    errors.push("calibration_changes must be an array");
  } else {
    const finalRatings = collectRatings(record);
    const seenPaths = new Set<string>();
    for (const changeRaw of calibrationChanges) {
      const change = (changeRaw ?? {}) as JsonRecord;
      const path = typeof change.path === "string" ? change.path : null;
      if (path === null || finalRatings === null || !finalRatings.has(path) || seenPaths.has(path)) {
        errors.push("calibration change path is invalid or duplicated");
        continue;
      }
      seenPaths.add(path);
      const original = change.original;
      const final = change.final;
      if (typeof original !== "number" || typeof final !== "number") {
        errors.push(`calibration change values invalid for ${path}`);
      } else if (original === final || final !== finalRatings.get(path) || !isClose(final * 2, Math.round(final * 2))) {
        errors.push(`calibration change binding invalid for ${path}`);
      }
      if (String(change.reason ?? "").trim().length === 0 || !Array.isArray(change.evidence) || change.evidence.length === 0) {
        errors.push(`calibration change lacks reason/evidence for ${path}`);
      }
    }
  }
  const confidence = (record.confidence ?? {}) as JsonRecord;
  if (confidence.supplied_chapter_completeness_ratio !== 1.0 || confidence.actual_book_ambiguity !== "material") {
    errors.push("confidence must preserve chapter completeness and actual-book ambiguity");
  }
  validateGates(record, errors, args.profile);
  return [...new Set(errors)].sort();
}

// ── App-faithful rendering ────────────────────────────────────────────────────

const CHOICE_LETTERS = "abcdefghij";
const LAYER_KEYS = ["fast", "deep", "full"] as const;
export type RubricLayerKey = (typeof LAYER_KEYS)[number];
const LAYER_APP_MODES: Record<RubricLayerKey, string> = {
  fast: "Guided", deep: "Standard", full: "Challenge",
};

export type AuditChapter = {
  number: number;
  title: string;
  hook: string;
  counterintuition: string;
  tryThisNow: string;
  keyTakeaway: string;
  breakdown: { fastRead: string; deepRead: string; fullRead: string };
  examples: Array<{ title: string; scenario: string; whatToDo: string; whyItMatters: string }>;
  quiz: {
    questions: Array<{
      prompt: string;
      choices: string[];
      correctIndex: number;
      explanation: string;
      /** Chapter Format v25 (F-2) additive fields — rendered when present. */
      choiceRationales?: string[];
      revisit?: { component: string; ref: string };
      confidencePrompt?: string;
    }>;
  };
  reviewCards: Array<{ front: string; back: string }>;
  implementationPlan: {
    coreSkill: string;
    ifThenPlans: Array<{ context: string; plan: string }>;
    twentyFourHourChallenge: string;
    weeklyPractice: string;
  };
  memorableLines: Array<{ text: string }>;
};

/** Render the APP-FAITHFUL audit document: everything a reader can reach in
 *  the product, INCLUDING the quiz key + explanations (never audit key-stripped
 *  content as product), with each read layer labeled with its app mode. */
export function renderAuditChapterDocument(args: { bookId: string; chapter: AuditChapter }): string {
  const { bookId, chapter } = args;
  const lines: string[] = [
    `# ${chapter.title}`,
    "",
    `> Audit document — ${bookId} chapter ${chapter.number}. App-faithful rendering for rubric-v2 chapter audit: full quiz key and explanations included; each read layer is what a reader in that app mode receives as the chapter body.`,
    "",
    "## Hook",
    chapter.hook,
    "",
    "## Counterintuition",
    chapter.counterintuition,
    "",
    `## Fast read (app mode: ${LAYER_APP_MODES.fast})`,
    chapter.breakdown.fastRead,
    "",
    `## Deep read (app mode: ${LAYER_APP_MODES.deep})`,
    chapter.breakdown.deepRead,
    "",
    `## Full read (app mode: ${LAYER_APP_MODES.full})`,
    chapter.breakdown.fullRead,
    "",
    "## Examples",
  ];
  chapter.examples.forEach((example, index) => {
    lines.push(
      `### Example ${index + 1}: ${example.title}`,
      `Scenario: ${example.scenario}`,
      `What to do: ${example.whatToDo}`,
      `Why it matters: ${example.whyItMatters}`,
      "",
    );
  });
  lines.push("## Quiz (with answer key and explanations, as graded in the app)");
  chapter.quiz.questions.forEach((question, index) => {
    lines.push(`### Question ${index + 1}`, question.prompt);
    question.choices.forEach((choice, choiceIndex) => {
      lines.push(`${CHOICE_LETTERS[choiceIndex]}) ${choice}`);
    });
    requireCondition(
      Number.isInteger(question.correctIndex) && question.correctIndex >= 0 && question.correctIndex < question.choices.length,
      `quiz question ${index + 1} correctIndex is out of range`);
    lines.push(`Answer: ${CHOICE_LETTERS[question.correctIndex]})`);
    lines.push(`Explanation: ${question.explanation}`);
    if (Array.isArray(question.choiceRationales)) {
      question.choiceRationales.forEach((rationale, choiceIndex) => {
        lines.push(`Choice ${CHOICE_LETTERS[choiceIndex]}) rationale: ${rationale}`);
      });
    }
    if (question.revisit !== undefined) {
      lines.push(`Revisit: ${question.revisit.component} — ${question.revisit.ref}`);
    }
    if (question.confidencePrompt !== undefined) {
      lines.push(`Confidence prompt: ${question.confidencePrompt}`);
    }
    lines.push("");
  });
  lines.push("## Review cards");
  chapter.reviewCards.forEach((card, index) => {
    lines.push(`### Card ${index + 1}`, `Front: ${card.front}`, `Back: ${card.back}`, "");
  });
  lines.push(
    "## Implementation plan",
    `Core skill: ${chapter.implementationPlan.coreSkill}`,
    ...chapter.implementationPlan.ifThenPlans.map((plan) => `If-then (${plan.context}): ${plan.plan}`),
    `24-hour challenge: ${chapter.implementationPlan.twentyFourHourChallenge}`,
    `Weekly practice: ${chapter.implementationPlan.weeklyPractice}`,
    "",
    "## Try this now",
    chapter.tryThisNow,
    "",
    "## Key takeaway",
    chapter.keyTakeaway,
    "",
    "## Memorable lines",
    ...chapter.memorableLines.map((line) => `- ${line.text}`),
    "",
  );
  const document = lines.join("\n");
  requireCondition(!document.includes("[object Object]"),
    "audit document contains a raw serialization leak ([object Object])");
  // Inverse of the key-free guard: an audit document without the full key
  // surface would re-create the spot-check artifact this instrument exists to
  // prevent. Fail closed if any answer or explanation is missing.
  for (const [index, question] of chapter.quiz.questions.entries()) {
    requireCondition(question.explanation.trim().length > 0, `quiz question ${index + 1} has no explanation`);
    requireCondition(document.includes(question.explanation), `audit document is missing explanation ${index + 1}`);
  }
  const answerLines = document.split("\n").filter((line) => line.startsWith("Answer: ")).length;
  requireCondition(answerLines === chapter.quiz.questions.length,
    "audit document must carry exactly one answer line per quiz question");
  return document;
}

/** Render one read layer as the standalone chapter body a reader in that app
 *  mode receives — the input for the D7 layer-independence hard gate. */
export function renderLayerDocument(args: {
  bookId: string;
  chapter: AuditChapter;
  layer: RubricLayerKey;
}): string {
  const prose = args.layer === "fast"
    ? args.chapter.breakdown.fastRead
    : args.layer === "deep" ? args.chapter.breakdown.deepRead : args.chapter.breakdown.fullRead;
  requireCondition(prose.trim().length > 0, `layer document ${args.layer} is empty`);
  const mode = LAYER_APP_MODES[args.layer];
  const layerTitle = `${args.layer.charAt(0).toUpperCase()}${args.layer.slice(1)} read`;
  const document = [
    `# ${args.chapter.title}`,
    "",
    `> Layer document — ${args.bookId} chapter ${args.chapter.number}, ${layerTitle} only (app mode: ${mode}). A reader in this mode receives EXACTLY this text as the chapter body. Judge it standalone: unresolved references, characters introduced elsewhere, or a missing core lesson are layer-independence findings.`,
    "",
    `## ${layerTitle} (app mode: ${mode})`,
    prose,
    "",
  ].join("\n");
  requireCondition(!document.includes("[object Object]"),
    "layer document contains a raw serialization leak ([object Object])");
  return document;
}

// ── Batch manifest ────────────────────────────────────────────────────────────

export type RubricAuditBatchChapterV1 = {
  unit: string;
  bookId: string;
  chapterNumber: number;
  chapterTitle: string;
  packagePath: string;
  packageBytesSha256: string;
  docRelPath: string;
  docSha256: string;
  headingInventorySha256: string;
  layerDocs: Record<RubricLayerKey, { relPath: string; sha256: string }>;
};

export type RubricAuditBatchManifestV1 = {
  schema: typeof RUBRIC_AUDIT_SCHEMA_BATCH;
  auditId: string;
  purpose: string;
  rubricVersion: typeof RUBRIC_AUDIT_RUBRIC_VERSION;
  bar: RubricAuditBar;
  calibration: {
    unit: string;
    docRelPath: string;
    docSha256: string;
    ownerRunId: typeof RUBRIC_OWNER_RUN_ID;
    expectedChapterDiagnostic: number;
  };
  chapters: RubricAuditBatchChapterV1[];
  manifestSha256: string;
};

export function rubricAuditDirRelPath(auditId: string): string {
  return `${RUBRIC_AUDITS_DIR_REL_PATH}/${auditId}`;
}

export function buildRubricAuditBatch(args: {
  repositoryRoot: string;
  auditId: string;
  purpose: string;
  packagePath: string;
  chapterNumbers: number[];
  calibrationUnit: string;
  bar?: RubricAuditBar;
}): { manifest: RubricAuditBatchManifestV1; documents: Map<string, string> } {
  const repositoryRoot = resolve(args.repositoryRoot);
  requireCondition(/^[a-z0-9][a-z0-9-]*$/.test(args.auditId), "auditId must be kebab-case");
  requireCondition(args.chapterNumbers.length > 0, "an audit batch needs at least one chapter");
  requireCondition(new Set(args.chapterNumbers).size === args.chapterNumbers.length, "duplicate chapter numbers");
  const calibration = RUBRIC_CALIBRATION_REFERENCES.find((ref) => ref.unit === args.calibrationUnit);
  requireCondition(calibration !== undefined,
    `unknown calibration unit '${args.calibrationUnit}' — must be one of the owner-adjudicated references`);
  const calibrationBytes = readFileSync(resolve(repositoryRoot, calibration.docRelPath));
  requireCondition(sha256Hex(calibrationBytes) === calibration.docSha256,
    "calibration reference document drifted from the owner-audited bytes");

  const packageBytes = readFileSync(resolve(repositoryRoot, args.packagePath));
  const parsed = JSON.parse(packageBytes.toString("utf8")) as { book?: { slug?: string; id?: string }; chapters: AuditChapter[] };
  const bookId = String(parsed.book?.slug ?? parsed.book?.id ?? "").trim();
  requireCondition(bookId.length > 0, "package has no book slug/id");
  const auditDir = rubricAuditDirRelPath(args.auditId);
  const documents = new Map<string, string>();
  const chapters: RubricAuditBatchChapterV1[] = [];
  for (const chapterNumber of args.chapterNumbers) {
    const chapter = parsed.chapters.find((entry) => entry.number === chapterNumber);
    requireCondition(chapter !== undefined, `chapter ${chapterNumber} is missing from the package`);
    const unit = `${bookId}-ch${String(chapterNumber).padStart(2, "0")}`;
    const document = renderAuditChapterDocument({ bookId, chapter });
    const docRelPath = `${auditDir}/docs/${unit}.audit.md`;
    documents.set(docRelPath, document);
    const layerDocs = {} as Record<RubricLayerKey, { relPath: string; sha256: string }>;
    for (const layer of LAYER_KEYS) {
      const layerDocument = renderLayerDocument({ bookId, chapter, layer });
      const relPath = `${auditDir}/docs/${unit}.layer-${layer}.md`;
      documents.set(relPath, layerDocument);
      layerDocs[layer] = { relPath, sha256: sha256Hex(Buffer.from(layerDocument, "utf8")) };
    }
    chapters.push({
      unit,
      bookId,
      chapterNumber,
      chapterTitle: chapter.title,
      packagePath: args.packagePath,
      packageBytesSha256: sha256Hex(packageBytes),
      docRelPath,
      docSha256: sha256Hex(Buffer.from(document, "utf8")),
      headingInventorySha256: headingInventorySha256(document),
      layerDocs,
    });
  }
  const core: Omit<RubricAuditBatchManifestV1, "manifestSha256"> = {
    schema: RUBRIC_AUDIT_SCHEMA_BATCH,
    auditId: args.auditId,
    purpose: args.purpose,
    rubricVersion: RUBRIC_AUDIT_RUBRIC_VERSION,
    bar: args.bar ?? RUBRIC_AUDIT_BAR_D7,
    calibration: {
      unit: calibration.unit,
      docRelPath: calibration.docRelPath,
      docSha256: calibration.docSha256,
      ownerRunId: RUBRIC_OWNER_RUN_ID,
      expectedChapterDiagnostic: calibration.expectedChapterDiagnostic,
    },
    chapters,
  };
  return { manifest: { ...core, manifestSha256: hashCanonical(core) }, documents };
}

export type RubricAuditBatchMaterializationV1 = {
  schema: "rubric-audit-batch-materialization-v1";
  auditId: string;
  manifestPath: string;
  manifestSha256: string;
  chapterCount: number;
  written: boolean;
  modelCalls: 0;
  apiCalls: 0;
};

export function materializeRubricAuditBatch(args: {
  repositoryRoot: string;
  auditId: string;
  purpose: string;
  packagePath: string;
  chapterNumbers: number[];
  calibrationUnit: string;
  write?: boolean;
}): RubricAuditBatchMaterializationV1 {
  const repositoryRoot = resolve(args.repositoryRoot);
  const built = buildRubricAuditBatch(args);
  const manifestPath = resolve(repositoryRoot, `${rubricAuditDirRelPath(args.auditId)}/batch-manifest.json`);
  const manifestBytes = canonicalPretty(built.manifest);
  if (existsSync(manifestPath)) {
    requireCondition(readFileSync(manifestPath, "utf8") === manifestBytes,
      "retained rubric-audit batch manifest differs from the deterministic rebuild — an audit batch is frozen at creation");
    for (const [relPath, document] of built.documents) {
      requireCondition(readFileSync(resolve(repositoryRoot, relPath), "utf8") === document,
        `retained audit document differs from the deterministic rebuild: ${relPath}`);
    }
  } else if (args.write === true) {
    for (const [relPath, document] of built.documents) {
      writeFileAtomic(resolve(repositoryRoot, relPath), document);
    }
    writeFileAtomic(manifestPath, manifestBytes);
    requireCondition(readFileSync(manifestPath, "utf8") === manifestBytes, "batch manifest read-back drift");
  }
  return {
    schema: "rubric-audit-batch-materialization-v1",
    auditId: args.auditId,
    manifestPath,
    manifestSha256: built.manifest.manifestSha256,
    chapterCount: built.manifest.chapters.length,
    written: args.write === true || existsSync(manifestPath),
    modelCalls: 0,
    apiCalls: 0,
  };
}

// ── Report ────────────────────────────────────────────────────────────────────

export type RubricAuditChapterResultV1 = {
  unit: string;
  chapterDiagnostic: number;
  band: string;
  coreDomainMin: number;
  coreDomainsPass: boolean;
  gatesPass: boolean;
  gateStatuses: Record<string, string>;
  layerIndependencePass: boolean;
  agreement: { meanAbsoluteDifference: number; maximumDifference: number; scoreDifference: number };
  pass: boolean;
};

export type RubricAuditReportV1 = {
  schema: typeof RUBRIC_AUDIT_SCHEMA_REPORT;
  auditId: string;
  rubricVersion: typeof RUBRIC_AUDIT_RUBRIC_VERSION;
  bar: RubricAuditBar;
  chapters: RubricAuditChapterResultV1[];
  calibration: {
    unit: string;
    expected: number;
    observed: number;
    absDelta: number;
    tolerance: number;
    pass: boolean;
  };
  summary: {
    chapterCount: number;
    mean: number;
    min: number;
    meanPass: boolean;
    minPass: boolean;
    allCoreDomainsPass: boolean;
    allGatesPass: boolean;
    allLayerIndependencePass: boolean;
    calibrationPass: boolean;
    verdict: "PASS" | "FAIL" | "VOID_CALIBRATION";
  };
  reportSha256: string;
};

function chapterResultFromAdjudication(
  unit: string,
  record: JsonRecord,
  bar: RubricAuditBar,
): RubricAuditChapterResultV1 {
  const score = Number(record.chapter_diagnostic_score);
  const domains = (record.domains ?? {}) as JsonRecord;
  let coreDomainMin = Number.POSITIVE_INFINITY;
  for (const key of RUBRIC_CORE_DOMAIN_KEYS) {
    const domainScore = Number(((domains[key] ?? {}) as JsonRecord).domain_score);
    coreDomainMin = Math.min(coreDomainMin, domainScore);
  }
  const gates = (record.gates ?? {}) as JsonRecord;
  const gateStatuses: Record<string, string> = {};
  for (const key of Object.keys(gates).sort()) {
    gateStatuses[key] = String(((gates[key] ?? {}) as JsonRecord).status ?? "");
  }
  const gatesPass = GATE_ALLOWED.every(([key, allowed]) => allowed.has(gateStatuses[key] ?? ""));
  const layerGate = (gates[RUBRIC_LAYER_INDEPENDENCE_GATE_KEY] ?? {}) as JsonRecord;
  const layerIndependencePass = layerGate.status === "pass";
  const agreement = (record.rater_agreement ?? {}) as JsonRecord;
  const coreDomainsPass = coreDomainMin >= bar.coreDomainFloor;
  return {
    unit,
    chapterDiagnostic: score,
    band: rubricBand(score),
    coreDomainMin,
    coreDomainsPass,
    gatesPass,
    gateStatuses,
    layerIndependencePass,
    agreement: {
      meanAbsoluteDifference: Number(agreement.mean_absolute_subcriterion_difference),
      maximumDifference: Number(agreement.maximum_subcriterion_difference),
      scoreDifference: Number(agreement.chapter_diagnostic_score_difference),
    },
    pass: score >= bar.perChapterMin && coreDomainsPass && gatesPass && layerIndependencePass,
  };
}

export function buildRubricAuditReport(args: {
  manifest: RubricAuditBatchManifestV1;
  adjudications: Map<string, JsonRecord>;
  calibrationAdjudication: JsonRecord;
}): RubricAuditReportV1 {
  const { manifest } = args;
  const chapters: RubricAuditChapterResultV1[] = [];
  for (const chapter of manifest.chapters) {
    const record = args.adjudications.get(chapter.unit);
    requireCondition(record !== undefined, `missing adjudication for ${chapter.unit}`);
    chapters.push(chapterResultFromAdjudication(chapter.unit, record, manifest.bar));
  }
  const observed = Number(args.calibrationAdjudication.chapter_diagnostic_score);
  const absDelta = Math.abs(observed - manifest.calibration.expectedChapterDiagnostic);
  const calibrationPass = absDelta <= manifest.bar.calibrationTolerance;
  const scores = chapters.map((chapter) => chapter.chapterDiagnostic);
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const min = Math.min(...scores);
  const meanPass = mean >= manifest.bar.meanMin;
  const minPass = min >= manifest.bar.perChapterMin;
  const allCoreDomainsPass = chapters.every((chapter) => chapter.coreDomainsPass);
  const allGatesPass = chapters.every((chapter) => chapter.gatesPass);
  const allLayerIndependencePass = chapters.every((chapter) => chapter.layerIndependencePass);
  const verdict: RubricAuditReportV1["summary"]["verdict"] = !calibrationPass
    ? "VOID_CALIBRATION"
    : meanPass && minPass && allCoreDomainsPass && allGatesPass && allLayerIndependencePass
      ? "PASS"
      : "FAIL";
  const core: Omit<RubricAuditReportV1, "reportSha256"> = {
    schema: RUBRIC_AUDIT_SCHEMA_REPORT,
    auditId: manifest.auditId,
    rubricVersion: manifest.rubricVersion,
    bar: manifest.bar,
    chapters,
    calibration: {
      unit: manifest.calibration.unit,
      expected: manifest.calibration.expectedChapterDiagnostic,
      observed,
      absDelta,
      tolerance: manifest.bar.calibrationTolerance,
      pass: calibrationPass,
    },
    summary: {
      chapterCount: chapters.length,
      mean,
      min,
      meanPass,
      minPass,
      allCoreDomainsPass,
      allGatesPass,
      allLayerIndependencePass,
      calibrationPass,
      verdict,
    },
  };
  return { ...core, reportSha256: hashCanonical(core) };
}

// ── Owner-run verification (CLI smoke + fixture surface) ─────────────────────

export type OwnerRunVerificationV1 = {
  schema: "rubric-owner-run-verification-v1";
  runId: typeof RUBRIC_OWNER_RUN_ID;
  units: Array<{
    unit: string;
    pairChainValid: boolean;
    primaryValid: boolean;
    verificationValid: boolean;
    adjudicationValid: boolean;
    adjudicatedScore: number;
    errors: string[];
  }>;
  allValid: boolean;
};

/** Re-validate the committed owner audit run end-to-end with the TS port —
 *  sources are the retained reader docs (byte-identical to the audited Desktop
 *  copies). Proves port fidelity; any error is a port defect or evidence
 *  tampering, both fail-closed. */
export function verifyOwnerRubricAuditRun(args: { repositoryRoot: string }): OwnerRunVerificationV1 {
  const repositoryRoot = resolve(args.repositoryRoot);
  const auditRoot = resolve(repositoryRoot, RUBRIC_OWNER_RUN_REL_PATH);
  const units: OwnerRunVerificationV1["units"] = [];
  for (const reference of RUBRIC_CALIBRATION_REFERENCES) {
    const unit = reference.unit;
    const read = (rel: string): LoadedRecord => loadRecord(readFileSync(resolve(auditRoot, rel), "utf8"));
    const inspection = read(`jobs/${unit}.inspection.json`).value as RubricInspection;
    const primary = read(`raw/primary/${unit}.json`);
    const verification = read(`raw/verification/${unit}.json`);
    const primaryDispatch = read(`jobs/${unit}.receipts/primary.dispatch.json`);
    const verificationDispatch = read(`jobs/${unit}.receipts/verification.dispatch.json`);
    const pairSeal = read(`jobs/${unit}.receipts/pair.seal.json`);
    const adjudication = read(`raw/adjudicated/${unit}.json`);
    const sourceText = readFileSync(resolve(repositoryRoot, reference.docRelPath), "utf8");
    const chainErrors = validatePairChain({
      primary, verification, primaryDispatch, verificationDispatch, pairSeal, inspection,
    });
    const primaryErrors = validateChapterRaterRecord({
      record: primary, dispatch: primaryDispatch, inspection, sourceText, profile: "owner-run-compat",
    });
    const verificationErrors = validateChapterRaterRecord({
      record: verification, dispatch: verificationDispatch, inspection, sourceText, profile: "owner-run-compat",
    });
    const adjudicationErrors = validateChapterAdjudicationRecord({
      record: adjudication, primary, verification, primaryDispatch, verificationDispatch,
      pairSeal, inspection, sourceText, profile: "owner-run-compat",
    });
    const errors = [...chainErrors, ...primaryErrors, ...verificationErrors, ...adjudicationErrors];
    const adjudicatedScore = Number(adjudication.value.chapter_diagnostic_score);
    requireCondition(isClose(adjudicatedScore, reference.expectedChapterDiagnostic),
      `owner-run adjudicated score drifted for ${unit}`);
    units.push({
      unit,
      pairChainValid: chainErrors.length === 0,
      primaryValid: primaryErrors.length === 0,
      verificationValid: verificationErrors.length === 0,
      adjudicationValid: adjudicationErrors.length === 0,
      adjudicatedScore,
      errors: [...new Set(errors)].sort(),
    });
  }
  return {
    schema: "rubric-owner-run-verification-v1",
    runId: RUBRIC_OWNER_RUN_ID,
    units,
    allValid: units.every((entry) => entry.errors.length === 0),
  };
}
