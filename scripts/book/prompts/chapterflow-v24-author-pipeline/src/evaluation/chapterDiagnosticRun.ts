/**
 * WP-E13 — the standalone chapter-diagnostic RUNNER: orchestrate one full
 * adjudicated chapter diagnostic (2 mutually-blind rater sessions + 1 fresh
 * adjudicator) over a genuine blind 1-chapter package (owner policy §3.2 / §5.2
 * of docs/v25/V25_EVALUATOR_AND_MODEL_SELECTION_EXECUTION_PLAN.md).
 *
 * This is the canonical-evaluator adapter's dual-blind path. It NEVER spawns a
 * model itself: every rater/adjudicator turn goes through an INJECTED session
 * runner compatible with ultraSession.ts's `UltraSessionRequestV1`/`ResultV1`
 * (the D7 → GPT-5.6 Sol@Ultra route in production; a double in tests). The
 * deterministic receipt chain (issue → seal) goes through an INJECTED harness
 * that defaults to the real, read-only ChapterFlow Book Evaluator skill scripts
 * (WP-E12 `evaluatorSkillHarness`); those scripts are offline python and are the
 * sole authority on receipt hashing — this module never re-implements them.
 *
 * ARTIFACT FAMILY (owner policy §3.2 — "no third format"): the records match the
 * EXISTING `chapterflow_standalone_chapter_rating` / `..._adjudication` 1.0.0
 * family (PM-4..6 precedent). Every record is scoped `standalone_chapter_audit`
 * with `full_book_score: null`, certification "unevaluable", Domain 9
 * "unassessable" — a chapter diagnostic is NOT a book score (the NEW-05 boundary,
 * enforced by diagnosticBoundary.ts). The rater/adjudicator session supplies the
 * blind JUDGMENT (the 8-domain scores, narrative, gate reads, agreement/calibration);
 * this orchestrator stamps the identity/binding/scope/chapter fields it — not the
 * rater — is authoritative over, so blinding and receipt binding can never depend
 * on the rater getting a hash right.
 *
 * SPLIT OF AUTHORITY (why the orchestrator overwrites, not trusts):
 *   - rater owns  → domains + subcriteria ratings/rationale/evidence, per-domain
 *                   strengths/limitations/pattern/scope_note, chapter_diagnostic_score,
 *                   diagnostic_band, gate STATUS reads, narrative sections, the
 *                   three improvements; (adjudicator only) rater_agreement stats,
 *                   confidence, calibration_changes, evaluation_construct.
 *   - runner owns → schema_version/artifact_type, run_id/job_id/rater_role,
 *                   worker_task_id/worker_session_id, worker_dispatch_receipt_sha256
 *                   (rating) or blind_pair_seal_sha256 + rater_agreement.input_records
 *                   canonical hashes (adjudication), book identity, source_hash,
 *                   the chapter block (from the source inspection), and the fixed
 *                   scope object. Every stamped value is validated by the same
 *                   arithmetic/structure checks the skill's chapter validators run.
 *
 * RETRY + CAP (V25-AUD-02, "retry once" contract): each role gets at most 2
 * attempts; each attempt is preserved under `<role>/attempt-<n>/` (NEVER deleted —
 * failures stay in the denominator). After the second failed attempt the role — and
 * therefore the diagnostic — is terminal `instrument-fail`, with all attempts on
 * disk and the partial receipt chain retained.
 */

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import type { BlindLabel, CandidateEvalDiagnosticV1, D7TerminalState } from "../bakeoff/types.js";
import type { ChapterV21 } from "../types.js";
import {
  buildChapterDiagnosticPackage,
  serializeChapterDiagnosticPackage,
  type ChapterDiagnosticBookMetadataInput,
  type ChapterDiagnosticChapterV1,
} from "./chapterDiagnosticPackage.js";
import {
  inspectPackage as defaultInspectPackage,
  issueWorkerReceipts as defaultIssueWorkerReceipts,
  sealBlindPairReceipt as defaultSealBlindPairReceipt,
} from "./evaluatorSkillHarness.js";
import { runUltraSession, type UltraSessionRequestV1, type UltraSessionResultV1 } from "../exec/ultraSession.js";
import {
  assertChapterDiagnosticBookId,
  assertWithinChapterDiagnosticRoot,
  NOT_A_BOOK_SCORE_LABEL,
  resolveChapterDiagnosticRunRoot,
  withNotABookScoreLabel,
} from "./diagnosticBoundary.js";

export const CHAPTER_RATING_ARTIFACT_TYPE = "chapterflow_standalone_chapter_rating" as const;
export const CHAPTER_ADJUDICATION_ARTIFACT_TYPE = "chapterflow_standalone_chapter_adjudication" as const;
export const CHAPTER_DIAGNOSTIC_SCHEMA_VERSION = "1.0.0" as const;

/** Per the skill's retry-once contract (V25-AUD-02): 2 attempts per role, then
 *  the role is terminal `instrument-fail`. */
export const MAX_ATTEMPTS_PER_ROLE = 2;

/** The fixed scope every standalone-chapter record carries — a chapter diagnostic
 *  is never a book score (owner policy §3.2; matches the reference records under
 *  artifacts/chapterflow-chapter-audits/…). */
export const STANDALONE_CHAPTER_SCOPE = {
  scope_type: "standalone_chapter_audit",
  actual_book_inventory_complete: false,
  full_book_score: null,
  full_book_certification: "unevaluable",
  domain_9: "unassessable",
} as const;

export class ChapterDiagnosticRunError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChapterDiagnosticRunError";
  }
}

// ── Domains (Domains 1-8; Domain 9 is unassessable for a single chapter) ──────
// Key set + weights only — the rater/adjudicator session is the sole authority on
// scoring semantics; this table exists so the runner can re-check the arithmetic
// exactly the way the skill's chapter validators do.
const DOMAINS: Array<{ key: string; weight: number; subcriteria: [string, string, string, string] }> = [
  { key: "epistemic_integrity", weight: 15, subcriteria: ["claim_support_fit", "uncertainty_limitations", "internal_consistency_qa", "misuse_safeguards"] },
  { key: "audience_fit", weight: 12, subcriteria: ["language_clarity", "beginner_onboarding", "signal_noise_framework_load", "audience_context_accessibility"] },
  { key: "mental_model_coherence", weight: 15, subcriteria: ["central_model", "mechanism_causal_explanation", "cross_concept_integration", "nuance_diagnostic_power"] },
  { key: "learning_architecture", weight: 12, subcriteria: ["sequencing_scaffolding", "worked_examples_contrasts", "active_processing", "feedback_metacognitive_calibration"] },
  { key: "retention_retrieval", weight: 10, subcriteria: ["meaningful_retrieval_cues", "cumulative_reinforcement", "quiz_retrieval_depth", "interference_control_consolidation"] },
  { key: "transfer_action_judgment", weight: 15, subcriteria: ["concrete_actions", "cross_context_transfer", "implementation_feedback_support", "boundaries_adaptation_tradeoffs"] },
  { key: "motivation_autonomy", weight: 8, subcriteria: ["personal_relevance", "achievable_progress", "autonomy_non_shaming_tone", "calibrated_confidence"] },
  { key: "engagement_momentum", weight: 8, subcriteria: ["curiosity_momentum", "narrative_example_vividness", "emotional_relevance", "instructional_alignment"] },
];
const DIAGNOSTIC_WEIGHT_TOTAL = 95; // Σ Domain 1-8 weights (Domain 9 = 5, excluded).
const CONTENT_GATE_KEYS = [
  "chapter_artifact_completeness",
  "epistemic_instructional_safety",
  "ethics_reader_autonomy",
  "purpose_audience_declaration",
] as const;

// The NON-reader keys prepare_chapter_inspection.py strips before building the
// ordered section inventory (kept byte-identical to the skill's list so the
// inventory this runner records matches what the skill would compute).
const NON_READER_KEYS = new Set<string>([
  "schemaVersion", "chapterId", "number", "title", "readingTimeMinutes",
  "authoring", "planSpec", "sourceAnchorId", "sourceAnchorIds",
  "keyEvidenceAnchorIds", "titleSourceAnchorIds", "coreSkillSourceAnchorIds",
  "twentyFourHourChallengeSourceAnchorIds", "weeklyPracticeSourceAnchorIds",
  "hookSourceAnchorIds", "counterintuitionSourceAnchorIds",
  "keyTakeawaySourceAnchorIds", "tryThisNowSourceAnchorIds",
]);

// The four candidate model tokens that must never surface in a rater-visible
// artifact (owner policy §5.5). Book/block identity is NOT secret; only model
// identity is — so this generic scan checks the model tokens alone (effort words
// like "high"/"medium" false-positive on ordinary prose and are handled by the
// package builder's structural scan, not here).
const MODEL_IDENTITY_TOKENS = ["gpt-5.6", "sol", "terra", "luna"] as const;

// ── Injected seams ────────────────────────────────────────────────────────────

export type UltraSessionRunner = (req: UltraSessionRequestV1) => Promise<UltraSessionResultV1>;

/** The deterministic receipt-chain surface. Defaults to the real WP-E12 skill
 *  harness (offline python); tests inject a double so the unit path never spawns. */
export type DiagnosticHarness = {
  inspectPackage: typeof defaultInspectPackage;
  issueWorkerReceipts: typeof defaultIssueWorkerReceipts;
  sealBlindPairReceipt: typeof defaultSealBlindPairReceipt;
};

export const DEFAULT_DIAGNOSTIC_HARNESS: DiagnosticHarness = {
  inspectPackage: defaultInspectPackage,
  issueWorkerReceipts: defaultIssueWorkerReceipts,
  sealBlindPairReceipt: defaultSealBlindPairReceipt,
};

export type ChapterDiagnosticRunInput = {
  /** The blind label this candidate occupies in the experiment (A..F). */
  label: BlindLabel;
  /** Opaque per-campaign hash — never derived from a model name (see E11). */
  runHash: string;
  /** Frozen corpus block (e.g. "nudge-ch03") — book/block identity is not secret. */
  blockCode: string;
  /** Blind slot token (w1/w2/w3 …) — never a model name. */
  slot: string;
  /** Artifact run id (a timestamp-like token; used for run root + record ids). */
  runId: string;
  /** The candidate's (or anchor's) authored chapter, in memory. */
  chapter: ChapterV21;
  /** Reader-facing WHITELIST metadata (title/categories/tags). Never model/effort. */
  book: ChapterDiagnosticBookMetadataInput;
  /** State root override (tests pass a tmp dir so nothing lands in real state). */
  stateRoot?: string;
  /** Injected rater/adjudicator route. Defaults to the real ultraSession spawn. */
  sessionRunner?: UltraSessionRunner;
  /** Injected receipt harness. Defaults to the real WP-E12 skill scripts. */
  harness?: DiagnosticHarness;
  /** Clock injection (tests freeze it). */
  now?: () => Date;
  /** Per-session timeout forwarded to the runner. */
  timeoutMs?: number;
  /** Forwarded to the harness (python interpreter override for tests). */
  pythonBin?: string;
  /** Optional worktree root carrying `.agents/skills/**` (forwarded to harness). */
  repoRoot?: string;
};

export type ChapterDiagnosticRoleAttempt = {
  attempt: number;
  ok: boolean;
  sessionModel: string | null;
  outcome: string;
  failure: string | null;
  replyPath: string | null;
  recordPath: string | null;
};

export type ChapterDiagnosticRoleResult = {
  role: "primary" | "verification" | "adjudicator";
  terminalState: D7TerminalState;
  attempts: ChapterDiagnosticRoleAttempt[];
  /** Path of the accepted record (null when the role reached instrument-fail). */
  recordPath: string | null;
  /** Resolved rater model, when observable from the session envelope. */
  raterModel: string | null;
};

export type ChapterDiagnosticRunResult = {
  blindBookId: string;
  runRoot: string;
  diagnostic: CandidateEvalDiagnosticV1;
  roles: {
    primary: ChapterDiagnosticRoleResult;
    verification: ChapterDiagnosticRoleResult;
    adjudicator: ChapterDiagnosticRoleResult | null;
  };
  /** The one-line, self-labeled human summary (always carries the NOT-A-BOOK-SCORE
   *  banner — owner policy §3.2). */
  summaryLine: string;
};

// ── Canonicalization (matches worker_receipts.canonical_sha256 / json.dumps
//    sort_keys=True, separators=(",",":"), ensure_ascii=False for the ASCII
//    section-inventory content this module hashes) ─────────────────────────────

function canonicalJson(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
  }
  return "null";
}

function sha256Hex(data: string): string {
  return createHash("sha256").update(data, "utf8").digest("hex");
}

function mathClose(a: number, b: number): boolean {
  return Math.abs(a - b) <= Math.max(1e-9 * Math.max(Math.abs(a), Math.abs(b)), 1e-9);
}

function pyTypeName(value: unknown): string {
  if (value === null) return "NoneType";
  if (typeof value === "boolean") return "bool";
  if (typeof value === "number") return Number.isInteger(value) ? "int" : "float";
  if (typeof value === "string") return "str";
  if (Array.isArray(value)) return "list";
  return "dict";
}

// ── Section inventory (mirrors prepare_chapter_inspection.py) ─────────────────

export type ChapterSection = {
  section_index: number;
  key: string;
  json_pointer: string;
  value_type: string;
  item_count: number;
};

function computeSectionInventory(chapter: Record<string, unknown>): ChapterSection[] {
  const sections: ChapterSection[] = [];
  for (const [key, value] of Object.entries(chapter)) {
    if (NON_READER_KEYS.has(key)) continue;
    let itemCount: number;
    if (Array.isArray(value)) itemCount = value.length;
    else if (value && typeof value === "object") itemCount = Object.keys(value).length;
    else itemCount = value !== null && value !== "" ? 1 : 0;
    sections.push({
      section_index: sections.length + 1,
      key,
      json_pointer: `/${key}`,
      value_type: pyTypeName(value),
      item_count: itemCount,
    });
  }
  return sections;
}

// ── Leak scan (rater-visible strings) ─────────────────────────────────────────

function walkStrings(value: unknown, visit: (s: string) => void): void {
  if (typeof value === "string") { visit(value); return; }
  if (Array.isArray(value)) { value.forEach((v) => walkStrings(v, visit)); return; }
  if (value && typeof value === "object") {
    for (const v of Object.values(value as Record<string, unknown>)) walkStrings(v, visit);
  }
}

/** Fail-closed scan for a model-identity token in a rater-visible artifact
 *  (package, prompt, or produced record). Throws on any whole-word hit. */
export function assertNoModelIdentityLeak(value: unknown, where: string): void {
  const patterns = MODEL_IDENTITY_TOKENS.map((t) => new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i"));
  walkStrings(value, (s) => {
    for (let i = 0; i < patterns.length; i += 1) {
      if (patterns[i].test(s)) {
        throw new ChapterDiagnosticRunError(
          `refusing to proceed: model-identity token ${JSON.stringify(MODEL_IDENTITY_TOKENS[i])} leaked into ${where} ` +
          `(rater-visible artifacts must be blind — owner policy §5.5)`);
      }
    }
  });
}

// ── Role identities (distinct per role; blind — no model token) ───────────────

type RoleIdentity = { jobId: string; workerTaskId: string; workerSessionId: string };

function mintRoleIdentity(blindBookId: string, runId: string, role: string): RoleIdentity {
  return {
    jobId: `${blindBookId}-${role}-${runId}`,
    // NB: `/root/${role}` — never `/root/<model>_<role>` (the reference records'
    // "/root/sol_primary" leaked the model; the blind runner uses the role alone).
    workerTaskId: `/root/${role}`,
    workerSessionId: `${blindBookId}-${role}-session-${runId}`,
  };
}

// ── Record assembly (stamp the runner-owned identity/binding/scope fields) ────

type ChapterBlock = {
  chapter_id: string;
  number: number;
  title: string;
  source_path: string;
  section_inventory_sha256: string;
  read_status: "full";
  section_inventory: ChapterSection[];
};

type StampContext = {
  runId: string;
  identity: RoleIdentity;
  bookBlock: { book_id: string; source_book_title: string };
  sourceHash: string;
  chapterBlock: ChapterBlock;
};

function stampRatingRecord(
  judgment: Record<string, unknown>,
  ctx: StampContext,
  role: "primary" | "verification",
  workerDispatchReceiptSha256: string,
): Record<string, unknown> {
  return {
    ...judgment,
    schema_version: CHAPTER_DIAGNOSTIC_SCHEMA_VERSION,
    artifact_type: CHAPTER_RATING_ARTIFACT_TYPE,
    run_id: ctx.runId,
    job_id: ctx.identity.jobId,
    rater_role: role,
    worker_task_id: ctx.identity.workerTaskId,
    worker_session_id: ctx.identity.workerSessionId,
    worker_dispatch_receipt_sha256: workerDispatchReceiptSha256,
    book: ctx.bookBlock,
    source_hash: ctx.sourceHash,
    chapter: ctx.chapterBlock,
    scope: { ...STANDALONE_CHAPTER_SCOPE },
  };
}

function stampAdjudicationRecord(
  judgment: Record<string, unknown>,
  ctx: StampContext,
  blindPairSealSha256: string,
  canonicalShas: { primary: string; verification: string },
): Record<string, unknown> {
  const agreement = (judgment.rater_agreement && typeof judgment.rater_agreement === "object"
    ? { ...(judgment.rater_agreement as Record<string, unknown>) }
    : {}) as Record<string, unknown>;
  // Runner is authoritative over the input-record hashes (they bind to the exact
  // sealed rater records, whose canonical sha the seal already computed).
  agreement.input_records = {
    primary_canonical_sha256: canonicalShas.primary,
    verification_canonical_sha256: canonicalShas.verification,
  };
  return {
    ...judgment,
    schema_version: CHAPTER_DIAGNOSTIC_SCHEMA_VERSION,
    artifact_type: CHAPTER_ADJUDICATION_ARTIFACT_TYPE,
    run_id: ctx.runId,
    job_id: ctx.identity.jobId,
    rater_role: "adjudicated",
    worker_task_id: ctx.identity.workerTaskId,
    worker_session_id: ctx.identity.workerSessionId,
    blind_pair_seal_sha256: blindPairSealSha256,
    book: ctx.bookBlock,
    source_hash: ctx.sourceHash,
    chapter: ctx.chapterBlock,
    scope: { ...STANDALONE_CHAPTER_SCOPE },
    rater_agreement: agreement,
  };
}

// ── Structural + arithmetic validation (mirrors the skill's chapter validators) ─

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function domainRatings(record: Record<string, unknown>): Record<string, number> {
  const out: Record<string, number> = {};
  const domains = asRecord(record.domains);
  for (const { key, subcriteria } of DOMAINS) {
    const subs = asRecord(asRecord(domains[key]).subcriteria);
    for (const sub of subcriteria) {
      const rating = asRecord(subs[sub]).rating;
      out[`domains.${key}.subcriteria.${sub}`] = typeof rating === "number" ? rating : NaN;
    }
  }
  return out;
}

function isHalfPoint(value: number): boolean {
  return mathClose(value * 2, Math.round(value * 2));
}

/** Validate a standalone chapter RATING record (mirrors validate_chapter_rating.py's
 *  structure + arithmetic + scope rules; the receipt-binding half is proven by the
 *  real skill seal, so it is not re-checked here). Returns [] when valid. */
export function validateChapterRatingRecord(record: Record<string, unknown>): string[] {
  return validateChapterRecordShared(record, { adjudicated: false });
}

function validateChapterRecordShared(record: Record<string, unknown>, opts: { adjudicated: boolean }): string[] {
  const errors: string[] = [];
  const expectedType = opts.adjudicated ? CHAPTER_ADJUDICATION_ARTIFACT_TYPE : CHAPTER_RATING_ARTIFACT_TYPE;
  if (record.schema_version !== CHAPTER_DIAGNOSTIC_SCHEMA_VERSION) errors.push("schema_version must be 1.0.0");
  if (record.artifact_type !== expectedType) errors.push(`artifact_type must be ${expectedType}`);

  const chapter = asRecord(record.chapter);
  if (chapter.read_status !== "full") errors.push("chapter.read_status must be full");
  const sections = Array.isArray(chapter.section_inventory) ? (chapter.section_inventory as unknown[]) : [];
  if (sections.length === 0) errors.push("chapter.section_inventory must cover every reader-facing section");
  if (chapter.section_inventory_sha256 !== sha256Hex(canonicalJson(sections))) {
    errors.push("chapter.section_inventory_sha256 does not match its section_inventory");
  }

  const scope = asRecord(record.scope);
  for (const [key, value] of Object.entries(STANDALONE_CHAPTER_SCOPE)) {
    if (scope[key] !== value) errors.push(`scope.${key} must equal ${JSON.stringify(value)}`);
  }

  const domains = asRecord(record.domains);
  if (JSON.stringify(Object.keys(domains).sort()) !== JSON.stringify(DOMAINS.map((d) => d.key).sort())) {
    errors.push("domains must contain exactly Domains 1-8");
  }
  let weightedTotal = 0;
  for (const { key, weight, subcriteria } of DOMAINS) {
    const domain = asRecord(domains[key]);
    if (domain.weight !== weight) errors.push(`${key}.weight must be ${weight}`);
    const subs = asRecord(domain.subcriteria);
    if (JSON.stringify(Object.keys(subs).sort()) !== JSON.stringify([...subcriteria].sort())) {
      errors.push(`${key}.subcriteria keys are invalid`);
      continue;
    }
    const ratings: number[] = [];
    for (const sub of subcriteria) {
      const item = asRecord(subs[sub]);
      const rating = item.rating;
      const validRange = typeof rating === "number" && !Number.isNaN(rating) && rating >= 0 && rating <= 4;
      if (!validRange || (opts.adjudicated ? !isHalfPoint(rating as number) : !Number.isInteger(rating))) {
        errors.push(`${key}.${sub}.rating must be ${opts.adjudicated ? "a half-point 0-4" : "an integer 0-4"}`);
        continue;
      }
      ratings.push(rating as number);
      const rationale = item.rationale ?? item.anchor_rationale;
      if (typeof rationale !== "string" || rationale.trim().length === 0) errors.push(`${key}.${sub} needs rationale`);
      if (!Array.isArray(item.evidence) || item.evidence.length === 0) errors.push(`${key}.${sub} needs evidence`);
    }
    if (ratings.length === 4) {
      const expectedScore = ratings.reduce((a, b) => a + b, 0) / 4;
      const expectedPoints = (expectedScore / 4) * weight;
      if (!mathClose(Number(domain.domain_score), expectedScore)) errors.push(`${key}.domain_score arithmetic mismatch`);
      if (!mathClose(Number(domain.weighted_points), expectedPoints)) errors.push(`${key}.weighted_points arithmetic mismatch`);
      weightedTotal += expectedPoints;
    }
    if (!Array.isArray(domain.strengths) || domain.strengths.length < 2) errors.push(`${key} needs at least two strengths`);
    if (!Array.isArray(domain.limitations) || domain.limitations.length < 1) errors.push(`${key} needs at least one limitation`);
    if (typeof (domain.pattern ?? domain.within_chapter_pattern) !== "string") errors.push(`${key} needs pattern`);
    const domainRationale = domain.rationale ?? domain.anchor_linked_rationale ?? domain.anchor_rationale;
    if (typeof domainRationale !== "string" || domainRationale.trim().length === 0) errors.push(`${key} needs rationale`);
    if (typeof domain.scope_note !== "string" || domain.scope_note.trim().length === 0) errors.push(`${key} needs scope_note`);
  }
  const expectedDiagnostic = (weightedTotal / DIAGNOSTIC_WEIGHT_TOTAL) * 100;
  if (!mathClose(Number(record.chapter_diagnostic_score), expectedDiagnostic)) {
    errors.push("chapter_diagnostic_score arithmetic mismatch");
  }
  if (!Array.isArray(record.improvements) || record.improvements.length !== 3) errors.push("exactly three improvements required");
  for (const key of ["diagnostic_band", "strongest_qualities", "weakest_qualities", "engagement_curve", "comprehension_retention_analysis", "practical_use_judgment_analysis", "best_fit_readers", "struggling_readers", "verdict"]) {
    if (!record[key]) errors.push(`missing ${key}`);
  }
  return errors;
}

/** Validate a standalone chapter ADJUDICATION record against its two blind rater
 *  records (mirrors validate_chapter_adjudication.py: shape + half-point arithmetic
 *  + derived rater_agreement + calibration binding + confidence invariants). */
export function validateChapterAdjudicationRecord(
  record: Record<string, unknown>,
  primary: Record<string, unknown>,
  verification: Record<string, unknown>,
): string[] {
  const errors = validateChapterRecordShared(record, { adjudicated: true });
  if (record.rater_role !== "adjudicated") errors.push("rater_role must be adjudicated");

  const pvals = domainRatings(primary);
  const vvals = domainRatings(verification);
  const finals = domainRatings(record);
  const diffs: Record<string, number> = {};
  for (const path of Object.keys(pvals)) diffs[path] = Math.abs(pvals[path] - vvals[path]);
  const diffValues = Object.values(diffs);

  const agreement = asRecord(record.rater_agreement);
  const expectedMad = diffValues.reduce((a, b) => a + b, 0) / diffValues.length;
  if (!mathClose(Number(agreement.mean_absolute_subcriterion_difference), expectedMad)) errors.push("mean agreement metric mismatch");
  if (!mathClose(Number(agreement.maximum_subcriterion_difference), Math.max(...diffValues))) errors.push("maximum agreement metric mismatch");
  const expectedScoreDiff = Math.abs(Number(primary.chapter_diagnostic_score) - Number(verification.chapter_diagnostic_score));
  if (!mathClose(Number(agreement.chapter_diagnostic_score_difference), expectedScoreDiff)) errors.push("diagnostic score difference mismatch");

  const expectedDisagreements = new Set(Object.keys(diffs).filter((p) => diffs[p] !== 0));
  const actualDisagreements = new Set(
    (Array.isArray(agreement.disagreements) ? (agreement.disagreements as unknown[]) : [])
      .map((item) => asRecord(item).path)
      .filter((p): p is string => typeof p === "string"),
  );
  if (expectedDisagreements.size !== actualDisagreements.size || [...expectedDisagreements].some((p) => !actualDisagreements.has(p))) {
    errors.push("disagreement inventory mismatch");
  }
  for (const item of Array.isArray(agreement.disagreements) ? (agreement.disagreements as unknown[]) : []) {
    const d = asRecord(item);
    const path = typeof d.path === "string" ? d.path : "";
    if (path in pvals && (d.primary !== pvals[path] || d.verification !== vvals[path] || !d.source_rechecked)) {
      errors.push(`disagreement record invalid for ${path}`);
    }
  }

  const calibration = record.calibration_changes;
  if (!Array.isArray(calibration)) {
    errors.push("calibration_changes must be an array");
  } else {
    const seen = new Set<string>();
    for (const change of calibration) {
      const c = asRecord(change);
      const path = typeof c.path === "string" ? c.path : "";
      if (!(path in finals) || seen.has(path)) { errors.push("calibration change path is invalid or duplicated"); continue; }
      seen.add(path);
      const original = c.original;
      const final = c.final;
      if (typeof original !== "number" || typeof final !== "number") errors.push(`calibration change values invalid for ${path}`);
      else if (original === final || final !== finals[path] || !isHalfPoint(final)) errors.push(`calibration change binding invalid for ${path}`);
      if (typeof c.reason !== "string" || c.reason.trim().length === 0 || !Array.isArray(c.evidence) || c.evidence.length === 0) {
        errors.push(`calibration change lacks reason/evidence for ${path}`);
      }
    }
  }

  const confidence = asRecord(record.confidence);
  if (confidence.supplied_chapter_completeness_ratio !== 1.0 || confidence.actual_book_ambiguity !== "material") {
    errors.push("confidence must preserve chapter completeness and actual-book ambiguity");
  }
  return errors;
}

// ── Prompt rendering (blind; the double parses the embedded INPUTS block) ─────

function renderPrompt(kind: "rating" | "adjudication", inputs: Record<string, unknown>): string {
  const role = kind === "rating" ? "blind chapter rater" : "fresh chapter adjudicator";
  const contract = kind === "rating" ? CHAPTER_RATING_ARTIFACT_TYPE : CHAPTER_ADJUDICATION_ARTIFACT_TYPE;
  return [
    `# ChapterFlow standalone chapter diagnostic — ${role}`,
    "",
    withNotABookScoreLabel("read ONE chapter in full and score it on the 8-domain chapter rubric."),
    "Scope is standalone_chapter_audit: full_book_score is null, Domain 9 is unassessable,",
    "full-book certification is unevaluable. Do NOT infer or emit a whole-book score.",
    "",
    `Emit a ${contract} 1.0.0 JSON record. Inputs (paths are under the blind run root):`,
    "",
    "```json",
    canonicalJson(inputs),
    "```",
  ].join("\n");
}

// ── Attempt loop ──────────────────────────────────────────────────────────────

type RunOneRoleArgs = {
  role: "primary" | "verification" | "adjudicator";
  runRoot: string;
  runId: string;
  blindBookId: string;
  timeoutMs: number;
  sessionRunner: UltraSessionRunner;
  promptKind: "rating" | "adjudication";
  promptInputs: Record<string, unknown>;
  /** Turn one accepted session reply into a validated final record; return null +
   *  a reason to reject the attempt (triggers retry / cap). */
  finalize: (reply: Record<string, unknown>) => { record: Record<string, unknown> } | { reject: string };
};

function writeArtifact(runRoot: string, relPath: string, bytes: string): string {
  const abs = assertWithinChapterDiagnosticRoot(join(runRoot, relPath), runRoot);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, bytes);
  return abs;
}

async function runOneRole(args: RunOneRoleArgs): Promise<ChapterDiagnosticRoleResult> {
  const attempts: ChapterDiagnosticRoleAttempt[] = [];
  let raterModel: string | null = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_ROLE; attempt += 1) {
    // Every attempt gets its OWN directory — never reused, never deleted, so a
    // failed attempt stays on disk as evidence (V25-AUD-02).
    const attemptRel = `${args.role}/attempt-${attempt}`;
    const attemptDir = assertWithinChapterDiagnosticRoot(join(args.runRoot, attemptRel), args.runRoot);
    mkdirSync(attemptDir, { recursive: true });
    const promptText = renderPrompt(args.promptKind, args.promptInputs);
    assertNoModelIdentityLeak(promptText, `${args.role} prompt`);
    const promptPath = writeArtifact(args.runRoot, `${attemptRel}/prompt.md`, promptText);

    const req: UltraSessionRequestV1 = {
      role: args.role,
      promptPath,
      outputSchemaPath: null,
      cwd: attemptDir,
      timeoutMs: args.timeoutMs,
      sessionTag: `chapterdiag-${args.role}-a${attempt}`,
      bookId: args.blindBookId,
      runId: args.runId,
    };
    let result: UltraSessionResultV1;
    try {
      result = await args.sessionRunner(req);
    } catch (err) {
      attempts.push({ attempt, ok: false, sessionModel: null, outcome: "error", failure: `session threw: ${(err as Error).message}`, replyPath: null, recordPath: null });
      continue;
    }
    if (result.model) raterModel = result.model;

    const fail = (failure: string, recordPath: string | null = null): void => {
      attempts.push({ attempt, ok: false, sessionModel: result.model ?? null, outcome: result.outcome, failure, replyPath: result.replyPath, recordPath });
    };
    if (!result.ok || !result.replyPath) { fail(result.failure ?? `session not ok (outcome ${result.outcome})`); continue; }

    let reply: Record<string, unknown>;
    try {
      reply = asRecord(JSON.parse(readFileSync(result.replyPath, "utf8")));
    } catch (err) {
      fail(`reply is not valid JSON: ${(err as Error).message}`);
      continue;
    }

    const finalized = args.finalize(reply);
    if ("reject" in finalized) { fail(finalized.reject); continue; }

    // Blinding is enforced on the FINAL record too (defense in depth on top of
    // the package/prompt scans) — a rater cannot smuggle its identity into prose.
    try {
      assertNoModelIdentityLeak(finalized.record, `${args.role} record`);
    } catch (err) {
      fail((err as Error).message);
      continue;
    }
    const recordPath = writeArtifact(args.runRoot, `${attemptRel}/record.json`, `${JSON.stringify(finalized.record, null, 2)}\n`);
    attempts.push({ attempt, ok: true, sessionModel: result.model ?? null, outcome: result.outcome, failure: null, replyPath: result.replyPath, recordPath });
    return { role: args.role, terminalState: "judged", attempts, recordPath, raterModel };
  }
  return { role: args.role, terminalState: "instrument-fail", attempts, recordPath: null, raterModel };
}

// ── Orchestrator ──────────────────────────────────────────────────────────────

export async function runChapterDiagnostic(input: ChapterDiagnosticRunInput): Promise<ChapterDiagnosticRunResult> {
  const now = input.now ?? (() => new Date());
  const sessionRunner = input.sessionRunner ?? runUltraSession;
  const harness = input.harness ?? DEFAULT_DIAGNOSTIC_HARNESS;
  const timeoutMs = input.timeoutMs ?? 600_000;
  const harnessOpts = { repoRoot: input.repoRoot, pythonBin: input.pythonBin, timeoutMs } as const;

  // 1. Build the blind 1-chapter package (E11 mints the chapterdiag-- id, runs the
  //    allowlist + forbidden-token scan). Its id is the diagnostic's book id.
  const built = buildChapterDiagnosticPackage({
    runHash: input.runHash,
    blockCode: input.blockCode,
    slot: input.slot,
    chapter: input.chapter,
    book: input.book,
  });
  const blindBookId = built.blindBookId;
  assertChapterDiagnosticBookId(blindBookId); // masquerade wall (redundant with E11; explicit here).
  assertNoModelIdentityLeak(built.package, "blind package");

  const runRoot = resolveChapterDiagnosticRunRoot(blindBookId, input.runId, input.stateRoot);
  mkdirSync(runRoot, { recursive: true });
  const tempRoot = assertWithinChapterDiagnosticRoot(join(runRoot, "inspect-tmp"), runRoot);

  // Persist the package (rater-visible) + the bare chapter source (for source_path
  // + section inventory). Both live under the segregated diagnostic root.
  const packagePath = writeArtifact(runRoot, "package.json", built.bytes);
  const chapterSource = built.package.chapters[0] as unknown as ChapterDiagnosticChapterV1 & Record<string, unknown>;
  const chapterSourceBytes = `${JSON.stringify(chapterSource, null, 2)}\n`;
  const chapterSourcePath = writeArtifact(runRoot, "chapter-source.json", chapterSourceBytes);
  const contentSha256 = sha256Hex(chapterSourceBytes);

  // 2. Inspect the package via the harness (real skill script by default).
  const inspect = harness.inspectPackage(packagePath, { ...harnessOpts, tempRoot });
  if (inspect.process.exitCode !== 0 || !inspect.artifact) {
    throw new ChapterDiagnosticRunError(`inspect_package failed (exit ${inspect.process.exitCode}): ${inspect.process.stderr}`);
  }
  const sourceHash = inspect.artifact.source_hash;
  const inv0 = inspect.artifact.inspection.chapter_inventory[0];
  const sections = computeSectionInventory(chapterSource);
  const chapterBlock: ChapterBlock = {
    chapter_id: String(inv0.chapter_id ?? `${blindBookId}-ch01`),
    number: Number(inv0.number),
    title: String(inv0.title),
    source_path: chapterSourcePath,
    section_inventory_sha256: sha256Hex(canonicalJson(sections)),
    read_status: "full",
    section_inventory: sections,
  };
  const bookBlock = { book_id: blindBookId, source_book_title: input.book.title };

  // 3. Issue the two source-bound dispatch receipts (distinct identities per role).
  const primaryId = mintRoleIdentity(blindBookId, input.runId, "primary");
  const verificationId = mintRoleIdentity(blindBookId, input.runId, "verification");
  const adjudicatorId = mintRoleIdentity(blindBookId, input.runId, "adjudicator");
  const receiptsDir = assertWithinChapterDiagnosticRoot(join(runRoot, "receipts"), runRoot);
  const receipts = harness.issueWorkerReceipts({
    package: packagePath,
    tempRoot,
    runId: input.runId,
    bookId: blindBookId,
    pairId: `${blindBookId}-pair-${input.runId}`,
    primaryJobId: primaryId.jobId,
    primaryTaskId: primaryId.workerTaskId,
    primarySessionId: primaryId.workerSessionId,
    verificationJobId: verificationId.jobId,
    verificationTaskId: verificationId.workerTaskId,
    verificationSessionId: verificationId.workerSessionId,
    outputDir: receiptsDir,
  }, harnessOpts);
  if (receipts.process.exitCode !== 0 || !receipts.hashes) {
    throw new ChapterDiagnosticRunError(`issue_worker_receipts failed (exit ${receipts.process.exitCode}): ${receipts.process.stderr}`);
  }

  const primaryCtx: StampContext = { runId: input.runId, identity: primaryId, bookBlock, sourceHash, chapterBlock };
  const verificationCtx: StampContext = { runId: input.runId, identity: verificationId, bookBlock, sourceHash, chapterBlock };

  // 4. Primary + verification blind rater sessions (retry once → cap).
  const primaryResult = await runOneRole({
    role: "primary",
    runRoot, runId: input.runId, blindBookId, timeoutMs, sessionRunner,
    promptKind: "rating",
    promptInputs: { role: "primary", contract: CHAPTER_RATING_ARTIFACT_TYPE, packagePath, chapterSourcePath, dispatchReceiptPath: receipts.primaryDispatchPath, workerDispatchReceiptSha256: receipts.hashes.primary_sha256 },
    finalize: (reply) => {
      const record = stampRatingRecord(reply, primaryCtx, "primary", receipts.hashes!.primary_sha256);
      const errs = validateChapterRatingRecord(record);
      return errs.length ? { reject: `primary record invalid: ${errs.join("; ")}` } : { record };
    },
  });
  const verificationResult = await runOneRole({
    role: "verification",
    runRoot, runId: input.runId, blindBookId, timeoutMs, sessionRunner,
    promptKind: "rating",
    promptInputs: { role: "verification", contract: CHAPTER_RATING_ARTIFACT_TYPE, packagePath, chapterSourcePath, dispatchReceiptPath: receipts.verificationDispatchPath, workerDispatchReceiptSha256: receipts.hashes.verification_sha256 },
    finalize: (reply) => {
      const record = stampRatingRecord(reply, verificationCtx, "verification", receipts.hashes!.verification_sha256);
      const errs = validateChapterRatingRecord(record);
      return errs.length ? { reject: `verification record invalid: ${errs.join("; ")}` } : { record };
    },
  });

  const raterModels = {
    primary: primaryResult.raterModel,
    verification: verificationResult.raterModel,
    adjudicator: null as string | null,
  };

  // If either rater capped, the diagnostic is terminal instrument-fail — no seal,
  // no adjudication, attempts preserved.
  if (primaryResult.terminalState !== "judged" || verificationResult.terminalState !== "judged") {
    const which = primaryResult.terminalState !== "judged" ? "primary" : "verification";
    return finishInstrumentFail(input, { blindBookId, runRoot, contentSha256, raterModels, now, primaryResult, verificationResult, adjudicatorResult: null, reason: `${which} rater exhausted its ${MAX_ATTEMPTS_PER_ROLE}-attempt budget` });
  }

  // 5. Seal the two blind rater records via the harness (real skill script).
  const primaryRatingPath = primaryResult.recordPath!;
  const verificationRatingPath = verificationResult.recordPath!;
  const pairSealPath = assertWithinChapterDiagnosticRoot(join(runRoot, "pair.seal.json"), runRoot);
  const seal = harness.sealBlindPairReceipt({
    package: packagePath,
    tempRoot,
    primary: primaryRatingPath,
    verification: verificationRatingPath,
    primaryDispatch: receipts.primaryDispatchPath,
    verificationDispatch: receipts.verificationDispatchPath,
    output: pairSealPath,
  }, harnessOpts);
  if (seal.process.exitCode !== 0 || !seal.seal || !seal.summary) {
    throw new ChapterDiagnosticRunError(`seal_blind_pair_receipt failed (exit ${seal.process.exitCode}): ${seal.process.stderr}`);
  }
  const canonicalShas = {
    primary: seal.seal.workers.primary.result_canonical_sha256,
    verification: seal.seal.workers.verification.result_canonical_sha256,
  };

  // 6. Fresh adjudicator session (retry once → cap). It reads BOTH blind ratings.
  const primaryRecord = asRecord(JSON.parse(readFileSync(primaryRatingPath, "utf8")));
  const verificationRecord = asRecord(JSON.parse(readFileSync(verificationRatingPath, "utf8")));
  const adjudicatorCtx: StampContext = { runId: input.runId, identity: adjudicatorId, bookBlock, sourceHash, chapterBlock };
  const adjudicatorResult = await runOneRole({
    role: "adjudicator",
    runRoot, runId: input.runId, blindBookId, timeoutMs, sessionRunner,
    promptKind: "adjudication",
    promptInputs: { role: "adjudicator", contract: CHAPTER_ADJUDICATION_ARTIFACT_TYPE, packagePath, chapterSourcePath, primaryRatingPath, verificationRatingPath, pairSealPath, blindPairSealSha256: seal.summary.pair_seal_sha256 },
    finalize: (reply) => {
      const record = stampAdjudicationRecord(reply, adjudicatorCtx, seal.summary!.pair_seal_sha256, canonicalShas);
      const errs = validateChapterAdjudicationRecord(record, primaryRecord, verificationRecord);
      return errs.length ? { reject: `adjudication record invalid: ${errs.join("; ")}` } : { record };
    },
  });
  raterModels.adjudicator = adjudicatorResult.raterModel;

  if (adjudicatorResult.terminalState !== "judged") {
    return finishInstrumentFail(input, { blindBookId, runRoot, contentSha256, raterModels, now, primaryResult, verificationResult, adjudicatorResult, reason: `adjudicator exhausted its ${MAX_ATTEMPTS_PER_ROLE}-attempt budget` });
  }

  // 7. Persist the canonical adjudicated record (reference-parallel layout) and
  //    the CandidateEvalDiagnosticV1 summary.
  const adjudicated = asRecord(JSON.parse(readFileSync(adjudicatorResult.recordPath!, "utf8")));
  const adjudicatedRel = "raw/adjudicated/adjudicated.json";
  writeArtifact(runRoot, adjudicatedRel, `${JSON.stringify(adjudicated, null, 2)}\n`);
  const primaryRawRel = "raw/primary/rating.json";
  const verificationRawRel = "raw/verification/rating.json";
  writeArtifact(runRoot, primaryRawRel, `${JSON.stringify(primaryRecord, null, 2)}\n`);
  writeArtifact(runRoot, verificationRawRel, `${JSON.stringify(verificationRecord, null, 2)}\n`);

  const gates = asRecord(adjudicated.gates);
  const gatesPass = CONTENT_GATE_KEYS.every((k) => asRecord(gates[k]).status === "pass");
  const confidence = asRecord(adjudicated.confidence).level;
  const diagnostic: CandidateEvalDiagnosticV1 = {
    schemaVersion: "model-bakeoff-candidate-eval-diagnostic-v1",
    label: input.label,
    contentSha256,
    evalRunId: input.runId,
    chapterDiagnostic: typeof adjudicated.chapter_diagnostic_score === "number" ? adjudicated.chapter_diagnostic_score : null,
    confidence: confidence === "high" || confidence === "medium" || confidence === "low" ? confidence : null,
    gatesPass,
    raterModels,
    terminalState: "judged",
    receipts: {
      primaryDispatch: "receipts/primary.dispatch.json",
      verificationDispatch: "receipts/verification.dispatch.json",
      pairSeal: "pair.seal.json",
      adjudicated: adjudicatedRel,
    },
    judgedAt: now().toISOString(),
  };
  const summaryLine = withNotABookScoreLabel(
    `${input.label}: chapter_diagnostic_score=${diagnostic.chapterDiagnostic} (confidence ${diagnostic.confidence}) — judged`);
  persistSummary(runRoot, diagnostic, summaryLine);

  return {
    blindBookId, runRoot, diagnostic,
    roles: { primary: primaryResult, verification: verificationResult, adjudicator: adjudicatorResult },
    summaryLine,
  };
}

function finishInstrumentFail(
  input: ChapterDiagnosticRunInput,
  ctx: {
    blindBookId: string; runRoot: string; contentSha256: string;
    raterModels: { primary: string | null; verification: string | null; adjudicator: string | null };
    now: () => Date;
    primaryResult: ChapterDiagnosticRoleResult;
    verificationResult: ChapterDiagnosticRoleResult;
    adjudicatorResult: ChapterDiagnosticRoleResult | null;
    reason: string;
  },
): ChapterDiagnosticRunResult {
  const diagnostic: CandidateEvalDiagnosticV1 = {
    schemaVersion: "model-bakeoff-candidate-eval-diagnostic-v1",
    label: input.label,
    contentSha256: ctx.contentSha256,
    evalRunId: input.runId,
    chapterDiagnostic: null,
    confidence: null,
    gatesPass: null,
    raterModels: ctx.raterModels,
    terminalState: "instrument-fail",
    receipts: {
      primaryDispatch: "receipts/primary.dispatch.json",
      verificationDispatch: "receipts/verification.dispatch.json",
      pairSeal: ctx.adjudicatorResult ? "pair.seal.json" : "",
      adjudicated: "",
    },
    ineligibleReason: `INSTRUMENT_FAIL: ${ctx.reason}`,
    judgedAt: ctx.now().toISOString(),
  };
  const summaryLine = withNotABookScoreLabel(`${input.label}: INSTRUMENT_FAIL — ${ctx.reason}`);
  persistSummary(ctx.runRoot, diagnostic, summaryLine);
  return {
    blindBookId: ctx.blindBookId,
    runRoot: ctx.runRoot,
    diagnostic,
    roles: { primary: ctx.primaryResult, verification: ctx.verificationResult, adjudicator: ctx.adjudicatorResult },
    summaryLine,
  };
}

function persistSummary(runRoot: string, diagnostic: CandidateEvalDiagnosticV1, summaryLine: string): void {
  const wrapper = {
    not_a_book_score: true,
    label: NOT_A_BOOK_SCORE_LABEL,
    summary_line: summaryLine,
    diagnostic,
  };
  writeArtifact(runRoot, "diagnostic.summary.json", `${JSON.stringify(wrapper, null, 2)}\n`);
}
