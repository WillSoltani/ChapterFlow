/**
 * s16-rubric-audit-v1 — rater harness (Track C, the measurement loop).
 *
 * The missing middle between rubric-audit-batch (which renders the app-faithful
 * audit documents + per-layer docs + a frozen batch manifest with a hidden
 * calibration item) and rubric-audit-report (which consumes ADJUDICATED
 * records). This module:
 *
 *  - renders one self-contained rater/adjudicator TASK per (unit, role): the
 *    audit chapter document, the three per-layer documents (for the D7
 *    layer-independence gate), the EXACT rubric contract the validators enforce,
 *    and the required output JSON shape — with the identity block the worker
 *    copies verbatim so its record binds to a deterministic chain of custody.
 *  - ingests a returned record fail-closed THROUGH THE EXISTING validators
 *    (never a reimplementation), mints + persists the chain-of-custody artifacts
 *    (inspection / dispatch receipts / blind pair seal) with the receipt helpers,
 *    and persists the immutable record in the exact layout validatePairChain and
 *    the report expect under state/migration-experiments/rubric-audits/<id>/.
 *  - summarizes per-unit progress (which records exist, what is missing).
 *
 * Every function here is model-free and API-free. Custody identities are DERIVED
 * deterministically from (auditId, unit, role) so render-task and ingest mint the
 * byte-identical dispatch — the worker never has to be handed a live clock, and a
 * re-mint is create-once tamper-evident.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { sha256Hex } from "../../contracts/contractUtil.js";
import { writeFileAtomic } from "../../lib/atomicWrite.js";
import { canonicalPretty } from "./corpusBuilderCore.js";
import { artifactSha256FromText } from "./rubricAuditCanonical.js";
import {
  issueDispatchReceipt,
  loadRecord,
  sealPairReceipt,
  type JsonRecord,
  type RubricInspection,
} from "./rubricAuditReceipts.js";
import {
  PIPELINE_REL,
  RUBRIC_BASE_GATE_KEYS,
  RUBRIC_CHAPTER_WEIGHT_TOTAL,
  RUBRIC_DOMAINS,
  RUBRIC_LAYER_INDEPENDENCE_GATE_KEY,
  buildRubricAuditBatch,
  headingInventorySha256,
  rubricAuditDirRelPath,
  validateChapterAdjudicationRecord,
  validateChapterRaterRecord,
  type RubricAuditBatchManifestV1,
  type RubricAuditProfile,
  type RubricLayerKey,
} from "./rubricAuditInstrument.js";
import { appendCallLedgerEntry } from "../../telemetry/runCallLedger.js";

export class RubricAuditHarnessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RubricAuditHarnessError";
  }
}

export const RUBRIC_AUDIT_HARNESS_ROLES = ["primary", "verification", "adjudicator"] as const;
export type RubricAuditHarnessRole = (typeof RUBRIC_AUDIT_HARNESS_ROLES)[number];
type DispatchRole = "primary" | "verification";

const LAYER_KEYS: readonly RubricLayerKey[] = ["fast", "deep", "full"];

function requireCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new RubricAuditHarnessError(message);
}

// ── Unit resolution ───────────────────────────────────────────────────────────

type UnitResolution = {
  unit: string;
  kind: "candidate" | "calibration";
  /** Custody book_id — the AUDIT UNIT string (owner-run semantics), never the slug. */
  bookId: string;
  chapterId: string;
  chapterNumber: number;
  chapterTitle: string;
  sourceText: string;
  sourceHash: string;
  headingInventorySha256: string;
  headingCount: number;
  profile: RubricAuditProfile;
  layerDocs: Record<RubricLayerKey, string> | null;
  adjudicationRelPath: string;
};

/** Deterministically rebuild every audit/layer document for the batch's package.
 *  Reuses the frozen builder so render/ingest never depend on a --written doc. */
function rebuildDocuments(
  repositoryRoot: string,
  manifest: RubricAuditBatchManifestV1,
): Map<string, string> {
  const packagePath = manifest.chapters[0]?.packagePath;
  requireCondition(typeof packagePath === "string" && packagePath.length > 0,
    "batch manifest has no package path to rebuild audit documents from");
  const built = buildRubricAuditBatch({
    repositoryRoot,
    auditId: manifest.auditId,
    purpose: manifest.purpose,
    packagePath,
    chapterNumbers: manifest.chapters.map((chapter) => chapter.chapterNumber),
    calibrationUnit: manifest.calibration.unit,
    bar: manifest.bar,
  });
  // Bind the rebuild to the frozen manifest — a package edited after freeze is a
  // tamper, not a fresh render.
  requireCondition(built.manifest.manifestSha256 === manifest.manifestSha256,
    "audit-document rebuild does not match the frozen batch manifest (package drifted)");
  return built.documents;
}

function firstHeadingTitle(sourceText: string): string {
  for (const line of sourceText.split("\n")) {
    if (line.startsWith("# ")) return line.slice(2).trim();
  }
  return "";
}

function headingCount(sourceText: string): number {
  return sourceText.split("\n").filter((line) => line.startsWith("#")).length;
}

export function resolveAuditUnit(args: {
  repositoryRoot: string;
  manifest: RubricAuditBatchManifestV1;
  unit: string;
}): UnitResolution {
  const { repositoryRoot, manifest, unit } = args;
  const auditDir = rubricAuditDirRelPath(manifest.auditId);
  const candidate = manifest.chapters.find((chapter) => chapter.unit === unit);
  if (candidate !== undefined) {
    const documents = rebuildDocuments(repositoryRoot, manifest);
    const sourceText = documents.get(candidate.docRelPath);
    requireCondition(sourceText !== undefined, `audit document for ${unit} is missing from the rebuild`);
    const layerDocs = {} as Record<RubricLayerKey, string>;
    for (const layer of LAYER_KEYS) {
      const doc = documents.get(candidate.layerDocs[layer].relPath);
      requireCondition(doc !== undefined, `layer document ${layer} for ${unit} is missing from the rebuild`);
      layerDocs[layer] = doc;
    }
    return {
      unit,
      kind: "candidate",
      bookId: unit,
      chapterId: `ch${String(candidate.chapterNumber).padStart(2, "0")}`,
      chapterNumber: candidate.chapterNumber,
      chapterTitle: candidate.chapterTitle,
      sourceText,
      sourceHash: sha256Hex(Buffer.from(sourceText, "utf8")),
      headingInventorySha256: headingInventorySha256(sourceText),
      headingCount: headingCount(sourceText),
      profile: "v25",
      layerDocs,
      adjudicationRelPath: `${auditDir}/raw/adjudicated/${unit}.json`,
    };
  }

  if (unit === manifest.calibration.unit) {
    const bytes = readFileSync(resolve(repositoryRoot, manifest.calibration.docRelPath));
    requireCondition(sha256Hex(bytes) === manifest.calibration.docSha256,
      "calibration reference document drifted from the owner-audited bytes");
    const sourceText = bytes.toString("utf8");
    const match = /-ch(\d+)$/.exec(unit);
    requireCondition(match !== null, `calibration unit '${unit}' is not <book>-ch<NN>`);
    const chapterNumber = Number(match[1]);
    return {
      unit,
      kind: "calibration",
      bookId: unit,
      chapterId: `ch${String(chapterNumber).padStart(2, "0")}`,
      chapterNumber,
      chapterTitle: firstHeadingTitle(sourceText),
      sourceText,
      sourceHash: sha256Hex(bytes),
      headingInventorySha256: headingInventorySha256(sourceText),
      headingCount: headingCount(sourceText),
      // The hidden calibration item is re-adjudicated under the OWNER-RUN
      // conditions it was sealed under (6 base gates, key-free reader doc) so its
      // score is comparable to the sealed reference; layer independence is a v25
      // candidate-only gate.
      profile: "owner-run-compat",
      layerDocs: null,
      adjudicationRelPath: `${auditDir}/calibration/${unit}.adjudicated.json`,
    };
  }

  throw new RubricAuditHarnessError(
    `unit '${unit}' is neither a batch chapter nor the calibration unit '${manifest.calibration.unit}'`);
}

// ── Deterministic chain-of-custody minting ────────────────────────────────────

type CustodyIdentity = {
  pairId: string;
  runId: string;
  jobId: string;
  workerTaskId: string;
  workerSessionId: string;
  issuedAtUtc: string;
};

/** A stable synthetic UTC stamp — this instrument is clock-free and model-free,
 *  and issued_at_utc is part of the dispatch binding, so it must re-mint
 *  byte-identically. Derived from the dispatch identity, never a live clock. */
function syntheticIssuedAt(auditId: string, unit: string, role: DispatchRole): string {
  const digest = sha256Hex(Buffer.from(`rubric-audit-harness-issued-at:${auditId}:${unit}:${role}`, "utf8"));
  const seconds = parseInt(digest.slice(0, 10), 16) % (10 * 365 * 24 * 3600);
  const epochMs = Date.UTC(2020, 0, 1) + seconds * 1000;
  return new Date(epochMs).toISOString().replace(/\.\d{3}Z$/, "Z");
}

function custodyIdentity(auditId: string, unit: string, role: DispatchRole): CustodyIdentity {
  const base = `rubric-audit/${auditId}/${unit}/${role}`;
  return {
    pairId: `${unit}-pair-${auditId}`,
    runId: auditId,
    jobId: `${unit}-${role}-${auditId}`,
    workerTaskId: base,
    workerSessionId: `${base}@${auditId}`,
    issuedAtUtc: syntheticIssuedAt(auditId, unit, role),
  };
}

function mintInspection(resolution: UnitResolution, auditId: string): RubricInspection {
  return {
    book_id: resolution.bookId,
    scope: "standalone_chapter_audit_unit",
    // Synthetic, non-filesystem locator — the validators only require the record
    // and inspection agree, never a real path.
    source_path: `rubric-audit:${auditId}/${resolution.unit}`,
    source_hash: resolution.sourceHash,
    inventory_complete: true,
    chapter_count: 1,
    chapter_inventory: [{
      chapter_index: 1,
      chapter_id: resolution.chapterId,
      number: resolution.chapterNumber,
      title: resolution.chapterTitle,
    }],
    actual_book_inventory_complete: false,
    heading_inventory_sha256: resolution.headingInventorySha256,
  };
}

/** The deterministic binding envelope a rater record MUST carry: the identity
 *  block bound to the minted dispatch + the source/chapter/scope binding the
 *  validators check. Exposed so an orchestrator (or a fixture) can pre-fill or
 *  independently reproduce the exact envelope render-task instructs the worker to
 *  copy — the domains/gates/analysis are the worker's own judgment on top. */
export type RaterBindingEnvelopeV1 = {
  schema_version: "1.0.0";
  artifact_type: "chapterflow_standalone_chapter_rating";
  run_id: string;
  job_id: string;
  rater_role: DispatchRole;
  worker_task_id: string;
  worker_session_id: string;
  worker_dispatch_receipt_sha256: string;
  book: { book_id: string };
  source_hash: string;
  chapter: {
    chapter_id: string;
    number: number;
    title: string;
    source_path: string;
    heading_inventory_sha256: string;
    read_status: "full";
    section_inventory: Array<{ order: number; level: number; title: string; locator: string }>;
  };
  scope: {
    scope_type: "standalone_chapter_audit";
    actual_book_inventory_complete: false;
    full_book_score: null;
    full_book_certification: "unevaluable";
    domain_9: "unassessable";
  };
};

export function raterBindingEnvelope(args: {
  repositoryRoot: string;
  manifest: RubricAuditBatchManifestV1;
  unit: string;
  role: DispatchRole;
}): RaterBindingEnvelopeV1 {
  const resolution = resolveAuditUnit(args);
  const inspection = mintInspection(resolution, args.manifest.auditId);
  const dispatch = mintDispatch(inspection, resolution, args.manifest.auditId, args.role);
  const id = custodyIdentity(args.manifest.auditId, resolution.unit, args.role);
  const sectionCount = resolution.headingCount - 1;
  const sectionInventory = Array.from({ length: sectionCount }, (_unused, index) => ({
    order: index + 1,
    level: 2,
    title: `section ${index + 1}`,
    locator: `section ${index + 1}`,
  }));
  return {
    schema_version: "1.0.0",
    artifact_type: "chapterflow_standalone_chapter_rating",
    run_id: id.runId,
    job_id: id.jobId,
    rater_role: args.role,
    worker_task_id: id.workerTaskId,
    worker_session_id: id.workerSessionId,
    worker_dispatch_receipt_sha256: artifactSha256FromText(serializeRecord(dispatch)),
    book: { book_id: resolution.bookId },
    source_hash: resolution.sourceHash,
    chapter: {
      chapter_id: resolution.chapterId,
      number: resolution.chapterNumber,
      title: resolution.chapterTitle,
      source_path: String(inspection.source_path),
      heading_inventory_sha256: resolution.headingInventorySha256,
      read_status: "full",
      section_inventory: sectionInventory,
    },
    scope: {
      scope_type: "standalone_chapter_audit",
      actual_book_inventory_complete: false,
      full_book_score: null,
      full_book_certification: "unevaluable",
      domain_9: "unassessable",
    },
  };
}

function mintDispatch(
  inspection: RubricInspection,
  resolution: UnitResolution,
  auditId: string,
  role: DispatchRole,
): JsonRecord {
  const id = custodyIdentity(auditId, resolution.unit, role);
  return issueDispatchReceipt({
    pairId: id.pairId,
    runId: id.runId,
    bookId: resolution.bookId,
    sourceHash: resolution.sourceHash,
    inspection,
    role,
    jobId: id.jobId,
    workerTaskId: id.workerTaskId,
    workerSessionId: id.workerSessionId,
    issuedAtUtc: id.issuedAtUtc,
  });
}

function serializeRecord(value: JsonRecord): string {
  return canonicalPretty(value);
}

/** Create-once write: mint the artifact and either write it (first time) or
 *  assert the retained bytes match the deterministic re-mint (tamper-evident). */
function persistCreateOnce(absPath: string, bytes: string): void {
  if (existsSync(absPath)) {
    requireCondition(readFileSync(absPath, "utf8") === bytes,
      `retained rubric-audit custody artifact differs from the deterministic re-mint: ${absPath}`);
    return;
  }
  writeFileAtomic(absPath, bytes);
}

/** Immutable-evidence write: a worker record is retained VERBATIM and can never
 *  be silently overwritten by a different submission. */
function persistEvidence(absPath: string, bytes: string): void {
  if (existsSync(absPath)) {
    requireCondition(readFileSync(absPath, "utf8") === bytes,
      `a different record is already retained for this slot (immutable evidence): ${absPath}`);
    return;
  }
  writeFileAtomic(absPath, bytes);
}

function custodyPaths(repositoryRoot: string, auditId: string, unit: string): {
  inspection: string;
  dispatch: (role: DispatchRole) => string;
  seal: string;
  record: (role: DispatchRole) => string;
} {
  const auditDir = resolve(repositoryRoot, rubricAuditDirRelPath(auditId));
  return {
    inspection: resolve(auditDir, `jobs/${unit}.inspection.json`),
    dispatch: (role) => resolve(auditDir, `jobs/${unit}.receipts/${role}.dispatch.json`),
    seal: resolve(auditDir, `jobs/${unit}.receipts/pair.seal.json`),
    record: (role) => resolve(auditDir, `raw/${role}/${unit}.json`),
  };
}

// ── Task rendering ────────────────────────────────────────────────────────────

function renderDomainContract(): string {
  const lines: string[] = ["Domains (exactly these eight, in this order) with weights and subcriteria:"];
  for (const [index, domain] of RUBRIC_DOMAINS.entries()) {
    lines.push(`  ${index + 1}. ${domain.key} (weight ${domain.weight}): ${domain.subcriteria.join(", ")}`);
  }
  return lines.join("\n");
}

function renderGateContract(profile: RubricAuditProfile): string {
  const base = RUBRIC_BASE_GATE_KEYS.map((key) => `  - ${key}: {status, rationale}`).join("\n");
  if (profile !== "v25") {
    return [
      "gates (exactly these six; each {status one of pass|conditional|fail|not_assessed|unevaluable, rationale}):",
      base,
      "  external_accuracy status is not_assessed; actual_book_completeness status is unevaluable.",
    ].join("\n");
  }
  return [
    "gates (exactly these seven):",
    base,
    `  - ${RUBRIC_LAYER_INDEPENDENCE_GATE_KEY}: {status one of pass|fail, rationale, layers:` +
      " {fast, deep, full} each {self_contained: boolean, findings: []}}.",
    "  Judge each read layer standalone: unresolved references, characters introduced elsewhere, or a",
    "  missing core lesson are layer-independence findings. The gate cannot pass if any layer is not",
    "  self_contained. external_accuracy is not_assessed; actual_book_completeness is unevaluable.",
  ].join("\n");
}

function renderArithmeticContract(ratingRule: string): string {
  return [
    "Ratings + arithmetic:",
    `  - every subcriterion rating ${ratingRule}`,
    "  - domain_score = sum(the four subcriterion ratings) / 4",
    "  - weighted_points = (domain_score / 4) * domain_weight",
    `  - chapter_diagnostic_score = sum(weighted_points for all 8 domains) / ${RUBRIC_CHAPTER_WEIGHT_TOTAL} * 100`,
    "  Use full precision. The diagnostic band is descriptive and must be worded as a CHAPTER diagnostic,",
    "  never a full-book certification.",
  ].join("\n");
}

function renderRequiredFields(): string {
  return [
    "Each domain record carries: weight, its four subcriterion records, domain_score, weighted_points,",
    "at least two strengths, at least one limitation, a within-chapter pattern, an anchor-linked rationale,",
    "and a scope_note. Each subcriterion record carries: rating, anchor-linked rationale, and one or more",
    "{locator, paraphrase} evidence objects. The record also carries: scope (scope_type",
    "standalone_chapter_audit, actual_book_inventory_complete false, full_book_score null,",
    "full_book_certification unevaluable, domain_9 unassessable), evaluation_construct, strongest_qualities,",
    "weakest_qualities, engagement_curve, comprehension_retention_analysis, practical_use_judgment_analysis,",
    "best_fit_readers, struggling_readers, EXACTLY THREE ordered improvements, and a two-or-three-sentence verdict.",
  ].join("\n");
}

function renderIdentityBlock(resolution: UnitResolution, auditId: string, role: DispatchRole): string {
  const inspection = mintInspection(resolution, auditId);
  const dispatch = mintDispatch(inspection, resolution, auditId, role);
  const dispatchSha = artifactSha256FromText(serializeRecord(dispatch));
  const id = custodyIdentity(auditId, resolution.unit, role);
  return [
    "Copy this identity block VERBATIM into your record (do not invent or alter any value):",
    `  schema_version: "1.0.0"`,
    `  artifact_type: "chapterflow_standalone_chapter_rating"`,
    `  run_id: "${id.runId}"`,
    `  job_id: "${id.jobId}"`,
    `  rater_role: "${role}"`,
    `  worker_task_id: "${id.workerTaskId}"`,
    `  worker_session_id: "${id.workerSessionId}"`,
    `  worker_dispatch_receipt_sha256: "${dispatchSha}"`,
    `  book: { book_id: "${resolution.bookId}", source_book_title: <inferred from the document only> }`,
    `  source_hash: "${resolution.sourceHash}"`,
    `  chapter: { chapter_id: "${resolution.chapterId}", number: ${resolution.chapterNumber},`,
    `            title: ${JSON.stringify(resolution.chapterTitle)}, source_path: ${JSON.stringify(inspection.source_path)},`,
    `            heading_inventory_sha256: "${resolution.headingInventorySha256}", read_status: "full",`,
    `            section_inventory: [ exactly ${resolution.headingCount - 1} entries, one per H2/H3 reader-facing section,`,
    `                                 each {order, level, title, locator} in source order ] }`,
  ].join("\n");
}

function renderLayerSection(resolution: UnitResolution): string {
  if (resolution.layerDocs === null) return "";
  const parts = ["", "── Per-layer documents (for the layer-independence gate) ──"];
  for (const layer of LAYER_KEYS) {
    parts.push("", resolution.layerDocs[layer]);
  }
  return parts.join("\n");
}

// ── Fill-in record skeleton (the task↔validator shape closure) ────────────────

/** Delimiters that fence the literal fill-in record skeleton inside a rater task,
 *  so a driver/orchestrator/test can extract the exact JSON deterministically. */
export const RATER_SKELETON_BEGIN = "<<<BEGIN_RATER_RECORD_SKELETON";
export const RATER_SKELETON_END = "END_RATER_RECORD_SKELETON>>>";

/** The base + (v25) layer-independence gate block, pre-filled with the ONLY
 *  statuses a passing chapter may carry, so the skeleton is itself ingest-valid. */
function raterGateSkeleton(profile: RubricAuditProfile): JsonRecord {
  const statusOf: Record<string, string> = {
    chapter_artifact_completeness: "pass",
    epistemic_instructional_safety: "pass",
    ethics_reader_autonomy: "pass",
    purpose_audience_declaration: "pass",
    external_accuracy: "not_assessed",
    actual_book_completeness: "unevaluable",
  };
  const gates: JsonRecord = {};
  for (const key of RUBRIC_BASE_GATE_KEYS) {
    gates[key] = { status: statusOf[key] ?? "pass", rationale: `TODO: rationale for the ${key} gate` };
  }
  if (profile === "v25") {
    gates[RUBRIC_LAYER_INDEPENDENCE_GATE_KEY] = {
      status: "pass",
      rationale: "TODO: rationale (this gate cannot pass if any layer is not self_contained)",
      layers: {
        fast: { self_contained: true, findings: [] },
        deep: { self_contained: true, findings: [] },
        full: { self_contained: true, findings: [] },
      },
    };
  }
  return gates;
}

/** Build the literal fill-in record skeleton for a blind rater task: the EXACT
 *  JSON shape validateChapterRaterRecord accepts, with the deterministic binding
 *  envelope already filled and every JUDGMENT field a clearly-marked "TODO:"
 *  placeholder. `domains` and each `subcriteria` are OBJECTS keyed by the exact
 *  rubric snake_case ids (never arrays, never renamed) — the shape the prose
 *  contract alone did NOT pin down, which made task-following raters emit an array
 *  (Object.keys → "0".."3") or human-named keys and fail ingest on all eight
 *  domains ("<domain>.subcriteria keys are invalid" + a zeroed chapter_diagnostic
 *  arithmetic mismatch). The skeleton is itself ingest-valid (integer 0 placeholder
 *  ratings + non-empty placeholder prose): a rater who replaces the ratings/prose
 *  and recomputes the arithmetic per the contract emits exactly what ingest
 *  accepts, closing the task↔validator loop. */
export function renderRaterRecordSkeleton(args: {
  repositoryRoot: string;
  manifest: RubricAuditBatchManifestV1;
  unit: string;
  role: DispatchRole;
}): JsonRecord {
  const resolution = resolveAuditUnit(args);
  const envelope = raterBindingEnvelope(args);
  const domains: JsonRecord = {};
  for (const spec of RUBRIC_DOMAINS) {
    const subcriteria: JsonRecord = {};
    for (const sub of spec.subcriteria) {
      subcriteria[sub] = {
        rating: 0,
        anchor_rationale: `TODO: one-sentence anchor-linked rationale for ${sub}, citing a specific locator in the document`,
        evidence: [{ locator: "TODO: section or paragraph locator", paraphrase: "TODO: what the cited text says" }],
      };
    }
    domains[spec.key] = {
      weight: spec.weight,
      subcriteria,
      domain_score: 0,
      weighted_points: 0,
      strengths: [`TODO: a ${spec.key} strength observed in the document`, "TODO: a second strength"],
      limitations: [`TODO: a ${spec.key} limitation observed in the document`],
      within_chapter_pattern: `TODO: the within-chapter pattern for ${spec.key}`,
      anchor_linked_rationale: `TODO: domain-level anchor-linked rationale for ${spec.key}`,
      scope_note: "TODO: chapter-local scope note",
    };
  }
  return {
    schema_version: envelope.schema_version,
    artifact_type: envelope.artifact_type,
    run_id: envelope.run_id,
    job_id: envelope.job_id,
    rater_role: envelope.rater_role,
    worker_task_id: envelope.worker_task_id,
    worker_session_id: envelope.worker_session_id,
    worker_dispatch_receipt_sha256: envelope.worker_dispatch_receipt_sha256,
    book: { book_id: envelope.book.book_id, source_book_title: "TODO: source book title inferred from the document only" },
    source_hash: envelope.source_hash,
    chapter: envelope.chapter,
    scope: envelope.scope,
    evaluation_construct: "TODO: what this chapter teaches and to whom",
    gates: raterGateSkeleton(resolution.profile),
    domains,
    chapter_diagnostic_score: 0,
    diagnostic_band: "TODO: chapter diagnostic band phrase (a CHAPTER diagnostic, never a full-book certification)",
    strongest_qualities: "TODO: the chapter's strongest qualities",
    weakest_qualities: "TODO: the chapter's weakest qualities",
    engagement_curve: "TODO: the engagement curve across the chapter",
    comprehension_retention_analysis: "TODO: comprehension and retention analysis",
    practical_use_judgment_analysis: "TODO: practical-use and judgment analysis",
    best_fit_readers: "TODO: readers this chapter fits best",
    struggling_readers: "TODO: readers who will struggle",
    improvements: ["TODO: highest-priority improvement", "TODO: second improvement", "TODO: third improvement"],
    verdict: "TODO: two or three sentence chapter-diagnostic verdict",
  };
}

/** The rater task's record-skeleton section: the shape instructions + the fenced,
 *  extractable literal JSON the rater fills. */
function renderRaterSkeletonSection(skeleton: JsonRecord): string {
  return [
    "── Record skeleton (the EXACT output shape — copy it, keep every key) ──",
    "Return a JSON object with EXACTLY these keys. `domains` is an OBJECT keyed by the eight domain ids, and",
    "each domain's `subcriteria` is an OBJECT keyed by that domain's four subcriterion ids (NEVER an array,",
    "NEVER renamed or human-worded keys). The identity, source, chapter, and scope block is already filled —",
    'keep it verbatim. Replace every 0 rating with your integer 0-4 judgment, replace every "TODO:"',
    "placeholder string with your finding, and RECOMPUTE each domain_score, weighted_points, and",
    "chapter_diagnostic_score per the arithmetic above. Return ONLY the JSON object (no prose around it).",
    RATER_SKELETON_BEGIN,
    JSON.stringify(skeleton, null, 2),
    RATER_SKELETON_END,
  ].join("\n");
}

/** Extract the fenced literal record skeleton from a rendered rater task and parse
 *  it (top-level-object checked). The inverse of renderRaterSkeletonSection — lets
 *  a driver/test recover the exact fill-in JSON the task taught. */
export function extractRecordSkeleton(taskText: string): JsonRecord {
  const begin = taskText.indexOf(RATER_SKELETON_BEGIN);
  const end = taskText.indexOf(RATER_SKELETON_END);
  requireCondition(begin >= 0 && end > begin, "rater task has no record skeleton block");
  const json = taskText.slice(begin + RATER_SKELETON_BEGIN.length, end).trim();
  return loadRecord(json).value;
}

/** Render one self-contained rater/adjudicator task string. No filesystem paths
 *  appear in the returned text. */
export function renderRaterTaskDocument(args: {
  repositoryRoot: string;
  manifest: RubricAuditBatchManifestV1;
  unit: string;
  role: RubricAuditHarnessRole;
}): string {
  const resolution = resolveAuditUnit(args);
  const { manifest, unit, role } = args;
  if (role === "adjudicator") {
    return renderAdjudicatorTask(args.repositoryRoot, manifest, resolution);
  }
  const sections: string[] = [
    `# Rubric-v2 standalone chapter audit — ${role} rater — unit ${unit}`,
    "",
    "You are one of two MUTUALLY BLIND raters. Read ONLY the audit document below (and, where present, the",
    "per-layer documents). Use no external facts, author reputation, reviews, remembered source-book content,",
    "prior scores, or any counterpart's result. Score the eight domains for observable CHAPTER-LOCAL support",
    "only; Domain 9 (whole-book) is unassessable and excluded. Return exactly one JSON object.",
    "",
    "── Audit document (app-faithful: full quiz key + explanations, as graded in the app) ──",
    "",
    resolution.sourceText,
    renderLayerSection(resolution),
    "",
    "── Rubric contract ──",
    renderDomainContract(),
    "",
    renderArithmeticContract("is an INTEGER 0 through 4"),
    "",
    renderGateContract(resolution.profile),
    "",
    renderRequiredFields(),
    "",
    "── Required output ──",
    renderIdentityBlock(resolution, manifest.auditId, role),
    "The record skeleton below already carries this identity block (fill your judgment into it, keep the",
    "identity/source/scope values verbatim).",
    "",
    renderRaterSkeletonSection(renderRaterRecordSkeleton({ repositoryRoot: args.repositoryRoot, manifest, unit, role })),
  ];
  return sections.filter((section) => section !== "").join("\n");
}

function readCustodyText(absPath: string, label: string): string {
  requireCondition(existsSync(absPath), `${label} is missing — ingest both rater records before the adjudicator task`);
  return readFileSync(absPath, "utf8");
}

function renderAdjudicatorTask(
  repositoryRoot: string,
  manifest: RubricAuditBatchManifestV1,
  resolution: UnitResolution,
): string {
  const paths = custodyPaths(repositoryRoot, manifest.auditId, resolution.unit);
  const primaryRaw = readCustodyText(paths.record("primary"), "primary rater record");
  const verificationRaw = readCustodyText(paths.record("verification"), "verification rater record");
  const sealRaw = readCustodyText(paths.seal, "blind pair seal");
  const sealSha = artifactSha256FromText(sealRaw);
  const primarySha = artifactSha256FromText(primaryRaw);
  const verificationSha = artifactSha256FromText(verificationRaw);
  return [
    `# Rubric-v2 standalone chapter audit — ADJUDICATOR — unit ${resolution.unit}`,
    "",
    "You receive the single source chapter, the two independently validated blind rater records, and their",
    "sealed pair. Independently inspect the source for all 32 subcriteria and select the best-supported",
    "anchor — never average automatically. Where the blind ratings match, still verify the source. Where they",
    "differ by 1, weigh both rationales. Where they differ by 2+, deeply reread the implicated components. Use",
    "a half-point ONLY when adjacent anchors remain equally supported after source review.",
    "",
    "── Audit document ──",
    "",
    resolution.sourceText,
    renderLayerSection(resolution),
    "",
    "── Blind primary rater record ──",
    "",
    primaryRaw,
    "",
    "── Blind verification rater record ──",
    "",
    verificationRaw,
    "",
    "── Rubric contract ──",
    renderDomainContract(),
    "",
    renderArithmeticContract("is a MULTIPLE OF 0.5 from 0 through 4"),
    "",
    renderGateContract(resolution.profile),
    "",
    renderRequiredFields(),
    "",
    "── Required output (adjudication record) ──",
    'artifact_type "chapterflow_standalone_chapter_adjudication"; rater_role "adjudicated"; run_id equal to the',
    "rater records' run_id; source_hash equal to the sealed source; preserve the source binding, scope,",
    "construct, gates, analysis fields, exactly three improvements, and a two-or-three-sentence verdict.",
    `Set blind_pair_seal_sha256 to "${sealSha}".`,
    "Recompute every domain_score, weighted_point, and the chapter_diagnostic_score deterministically from the",
    "final half-point ratings. Include:",
    "  - rater_agreement: mean_absolute_subcriterion_difference and maximum_subcriterion_difference across the",
    "    32 blind ratings, chapter_diagnostic_score_difference, gate_conflicts, a disagreements[] record for",
    "    EVERY differing subcriterion (canonical path, primary, verification, final, rationale, source_rechecked,",
    "    evidence), and input_records:",
    `    { primary_canonical_sha256: "${primarySha}", verification_canonical_sha256: "${verificationSha}" }.`,
    "  - confidence: { level, rationale, supplied_chapter_completeness_ratio 1.0, actual_book_ambiguity",
    '    "material", unresolved_issues }.',
    "  - calibration_changes: one record { path, original, final, reason, evidence } for every subcriterion whose",
    "    final differs from BOTH blind ratings (empty array if none).",
    "Return ONLY the JSON object.",
  ].filter((section) => section !== "").join("\n");
}

// ── Ingest ────────────────────────────────────────────────────────────────────

export type RubricAuditIngestResultV1 = {
  schema: "rubric-audit-ingest-v1";
  auditId: string;
  unit: string;
  role: RubricAuditHarnessRole;
  kind: "candidate" | "calibration";
  persistedPath: string;
  sealed: boolean;
  modelCalls: 0;
  apiCalls: 0;
};

function throwIfInvalid(errors: string[], label: string): void {
  if (errors.length > 0) {
    throw new RubricAuditHarnessError(`${label} failed fail-closed validation:\n- ${errors.join("\n- ")}`);
  }
}

/** WP-503 — the Claude-side D7 rater/adjudicator call ledger choke point. This
 *  harness is model-free CODE (`modelCalls: 0` on every ingest result above):
 *  the real model turn happens in an EXTERNAL Claude session this process never
 *  observes — renderRaterTaskDocument/renderAdjudicatorTask hand it a task, and
 *  ingestRaterRecord/ingestAdjudicationRecord are the ONLY place that session's
 *  outcome becomes visible to this codebase. So this is where it gets ledgered.
 *
 *  Unconditional (called before throwIfInvalid, on BOTH success and failure) —
 *  every real ingest attempt appends exactly one entry, never zero. model/
 *  effort/latencyMs are recorded `null`: this process genuinely cannot observe
 *  which model, effort, or wall-clock duration the external session used —
 *  never a guessed value standing in for that gap. Best-effort: a ledger bug
 *  must never turn a valid rating into a lost book audit. */
function recordD7CallLedgerEntry(args: {
  repositoryRoot: string;
  auditId: string;
  unit: string;
  bookId: string;
  role: RubricAuditHarnessRole;
  outcome: "content_completed" | "content_invalid";
}): void {
  try {
    appendCallLedgerEntry({
      pipelineDir: resolve(args.repositoryRoot, PIPELINE_REL),
      bookId: args.bookId,
      runId: args.auditId,
      family: "claude-side",
      stage: "d7-rubric-audit",
      role: args.role,
      model: null,
      effort: null,
      latencyMs: null,
      outcome: args.outcome,
      sessionId: `${args.auditId}/${args.unit}/${args.role}`,
    });
  } catch { /* telemetry must never brick the D7 audit ingest */ }
}

/** Ingest a primary/verification rater record: validate through the existing
 *  validator, persist the inspection + dispatch + record, and (once both raters
 *  are in) mint + persist the blind pair seal. */
export function ingestRaterRecord(args: {
  repositoryRoot: string;
  manifest: RubricAuditBatchManifestV1;
  unit: string;
  role: DispatchRole;
  recordText: string;
}): RubricAuditIngestResultV1 {
  const { repositoryRoot, manifest, unit, role, recordText } = args;
  requireCondition(role === "primary" || role === "verification",
    "ingestRaterRecord role must be primary or verification");
  const resolution = resolveAuditUnit({ repositoryRoot, manifest, unit });
  const inspection = mintInspection(resolution, manifest.auditId);
  const dispatch = mintDispatch(inspection, resolution, manifest.auditId, role);
  const inspectionBytes = serializeRecord(inspection);
  const dispatchBytes = serializeRecord(dispatch);

  const record = loadRecord(recordText);
  const errors = validateChapterRaterRecord({
    record,
    dispatch: loadRecord(dispatchBytes),
    inspection,
    sourceText: resolution.sourceText,
    profile: resolution.profile,
  });
  recordD7CallLedgerEntry({
    repositoryRoot, auditId: manifest.auditId, unit, bookId: resolution.bookId, role,
    outcome: errors.length > 0 ? "content_invalid" : "content_completed",
  });
  throwIfInvalid(errors, `${unit} ${role} rater record`);

  const paths = custodyPaths(repositoryRoot, manifest.auditId, unit);
  persistCreateOnce(paths.inspection, inspectionBytes);
  persistCreateOnce(paths.dispatch(role), dispatchBytes);
  persistEvidence(paths.record(role), recordText);

  const sealed = maybeSealPair(repositoryRoot, manifest, resolution);
  return {
    schema: "rubric-audit-ingest-v1",
    auditId: manifest.auditId,
    unit,
    role,
    kind: resolution.kind,
    persistedPath: paths.record(role),
    sealed,
    modelCalls: 0,
    apiCalls: 0,
  };
}

/** Seal the blind pair once BOTH rater records + both dispatches exist. Idempotent
 *  and create-once. Returns whether a seal is now present. */
function maybeSealPair(
  repositoryRoot: string,
  manifest: RubricAuditBatchManifestV1,
  resolution: UnitResolution,
): boolean {
  const paths = custodyPaths(repositoryRoot, manifest.auditId, resolution.unit);
  const ready = existsSync(paths.record("primary")) && existsSync(paths.record("verification")) &&
    existsSync(paths.dispatch("primary")) && existsSync(paths.dispatch("verification")) &&
    existsSync(paths.inspection);
  if (!ready) return existsSync(paths.seal);
  const inspection = loadRecord(readFileSync(paths.inspection, "utf8")).value as RubricInspection;
  const seal = sealPairReceipt({
    primary: loadRecord(readFileSync(paths.record("primary"), "utf8")),
    verification: loadRecord(readFileSync(paths.record("verification"), "utf8")),
    primaryDispatch: loadRecord(readFileSync(paths.dispatch("primary"), "utf8")),
    verificationDispatch: loadRecord(readFileSync(paths.dispatch("verification"), "utf8")),
    inspection,
    sealedAtUtc: syntheticIssuedAt(manifest.auditId, resolution.unit, "primary"),
  });
  persistCreateOnce(paths.seal, serializeRecord(seal));
  return true;
}

/** Ingest an adjudication record: validate the full pair chain + adjudication
 *  through the existing validator, then persist it immutably at the report's
 *  expected path (raw/adjudicated for a chapter, calibration/ for the hidden
 *  calibration item). */
export function ingestAdjudicationRecord(args: {
  repositoryRoot: string;
  manifest: RubricAuditBatchManifestV1;
  unit: string;
  recordText: string;
}): RubricAuditIngestResultV1 {
  const { repositoryRoot, manifest, unit, recordText } = args;
  const resolution = resolveAuditUnit({ repositoryRoot, manifest, unit });
  const paths = custodyPaths(repositoryRoot, manifest.auditId, unit);
  const primary = loadRecord(readCustodyText(paths.record("primary"), "primary rater record"));
  const verification = loadRecord(readCustodyText(paths.record("verification"), "verification rater record"));
  const primaryDispatch = loadRecord(readCustodyText(paths.dispatch("primary"), "primary dispatch receipt"));
  const verificationDispatch = loadRecord(readCustodyText(paths.dispatch("verification"), "verification dispatch receipt"));
  const pairSeal = loadRecord(readCustodyText(paths.seal, "blind pair seal"));
  const inspection = loadRecord(readCustodyText(paths.inspection, "source inspection")).value as RubricInspection;

  const record = loadRecord(recordText);
  const errors = validateChapterAdjudicationRecord({
    record,
    primary,
    verification,
    primaryDispatch,
    verificationDispatch,
    pairSeal,
    inspection,
    sourceText: resolution.sourceText,
    profile: resolution.profile,
  });
  recordD7CallLedgerEntry({
    repositoryRoot, auditId: manifest.auditId, unit, bookId: resolution.bookId, role: "adjudicator",
    outcome: errors.length > 0 ? "content_invalid" : "content_completed",
  });
  throwIfInvalid(errors, `${unit} adjudication record`);

  const persistedPath = resolve(repositoryRoot, resolution.adjudicationRelPath);
  persistEvidence(persistedPath, recordText);
  return {
    schema: "rubric-audit-ingest-v1",
    auditId: manifest.auditId,
    unit,
    role: "adjudicator",
    kind: resolution.kind,
    persistedPath,
    sealed: existsSync(paths.seal),
    modelCalls: 0,
    apiCalls: 0,
  };
}

// ── Summary ───────────────────────────────────────────────────────────────────

export type RubricAuditUnitStatusV1 = {
  unit: string;
  kind: "candidate" | "calibration";
  primary: boolean;
  verification: boolean;
  sealed: boolean;
  adjudicated: boolean;
  complete: boolean;
  missing: string[];
};

export type RubricAuditStatusV1 = {
  schema: "rubric-audit-status-v1";
  auditId: string;
  units: RubricAuditUnitStatusV1[];
  allComplete: boolean;
};

/** Pure (read-only) per-unit progress: which records exist, what is missing. */
export function summarizeAudit(args: {
  repositoryRoot: string;
  manifest: RubricAuditBatchManifestV1;
}): RubricAuditStatusV1 {
  const { repositoryRoot, manifest } = args;
  const units: RubricAuditUnitStatusV1[] = [];
  const entries: Array<{ unit: string; kind: "candidate" | "calibration"; adjudicationRelPath: string }> = [
    ...manifest.chapters.map((chapter) => ({
      unit: chapter.unit,
      kind: "candidate" as const,
      adjudicationRelPath: `${rubricAuditDirRelPath(manifest.auditId)}/raw/adjudicated/${chapter.unit}.json`,
    })),
    {
      unit: manifest.calibration.unit,
      kind: "calibration" as const,
      adjudicationRelPath: `${rubricAuditDirRelPath(manifest.auditId)}/calibration/${manifest.calibration.unit}.adjudicated.json`,
    },
  ];
  for (const entry of entries) {
    const paths = custodyPaths(repositoryRoot, manifest.auditId, entry.unit);
    const primary = existsSync(paths.record("primary"));
    const verification = existsSync(paths.record("verification"));
    const sealed = existsSync(paths.seal);
    const adjudicated = existsSync(resolve(repositoryRoot, entry.adjudicationRelPath));
    const missing: string[] = [];
    if (!primary) missing.push("primary");
    if (!verification) missing.push("verification");
    if (!sealed) missing.push("seal");
    if (!adjudicated) missing.push("adjudication");
    units.push({
      unit: entry.unit,
      kind: entry.kind,
      primary,
      verification,
      sealed,
      adjudicated,
      complete: missing.length === 0,
      missing,
    });
  }
  return {
    schema: "rubric-audit-status-v1",
    auditId: manifest.auditId,
    units,
    allComplete: units.every((unit) => unit.complete),
  };
}
