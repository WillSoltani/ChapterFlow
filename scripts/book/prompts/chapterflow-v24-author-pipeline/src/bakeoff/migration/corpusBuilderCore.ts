/**
 * IMP-20 WP-B7 — shared core for the hermetic split-lane role corpus builders
 * (design §§H/I/J). This module owns the pieces every role builder reuses:
 * fail-closed spec/ledger reading, the schema-only chapter normalization that
 * NEVER infers source semantics (E-04 fix), deterministic mutation application,
 * canonical hashing + byte-reproducible serialization, and the gold-governance
 * assertions (§I).
 *
 * Hermetic guarantees (§J):
 *  - Roots arrive TYPED and INJECTED via SplitLaneCorpusConfigV1 — this module
 *    reads NO ambient environment and hardcodes NO absolute user/temporary
 *    path (verified by the split-lane-corpus static grep, test 31).
 *  - A missing mutation spec or score ledger FAILS CLOSED (throws) — a required
 *    input is never silently replaced with an empty set (test 30).
 *  - Output bytes are canonical (recursively key-sorted) with no timestamp in
 *    any hashed content, so an identical config reproduces byte-identical
 *    output (test 32).
 *  - Source ORIGIN / FORM / CLAIM-STRENGTH are NEVER inferred during
 *    normalization; when a chapter carries no source semantics the case is
 *    stamped sourceSemanticsStatus:MISSING and excluded from source-clean gold
 *    (test 33). The neutral schema-scaffold planSpec below is explicitly NOT a
 *    source-origin signal (its format literal is "unspecified", never a scene
 *    or source claim), and it is excluded from the chapter content hash by the
 *    existing v2 projection.
 *
 * The builders are PURE: they read the injected inputs and RETURN
 * {corpus, provenanceManifest, corpusBytes}; they write NOTHING. The Wave-C CLI
 * performs the single sanctioned committed write (assertNotCanonical +
 * writeFileAtomic) — never this module and never the leak-guarded test suite.
 */

import { existsSync, readFileSync } from "node:fs";

import type { ChapterV21 } from "../../types.js";
import { hashCanonical, sha256Hex, canonicalJson } from "../../contracts/contractUtil.js";
import { chapterContentHash } from "../../critics/qcAttestation.js";
import { admitChapter, resolveJsonPath, type ChapterAdmission } from "./nativeReviewQualification.js";
import type { SplitLaneCorpusConfigV1, ReviewLaneRole } from "./reviewLaneTypes.js";

// ── Builder identity ──────────────────────────────────────────────────────────

export const SPLIT_LANE_CORPUS_BUILDER_VERSION = "split-lane-corpus-builder-v1" as const;
export const SPLIT_LANE_CORPUS_SCHEMA = "split-lane-role-corpus-v1" as const;
export const SPLIT_LANE_CORPUS_PROVENANCE_SCHEMA = "split-lane-corpus-provenance-manifest-v1" as const;
export const SPLIT_LANE_MUTATION_SPEC_SCHEMA = "split-lane-corpus-mutation-spec-v1" as const;
export const CLEAN_BASE_SCORE_LEDGER_SCHEMA = "clean-base-score-ledger-v1" as const;

/** IMP-22 forward-only corpus identities. These are intentionally additive: the
 * IMP-20 v1 specs and built evidence remain readable and byte-stable. */
export const SPLIT_LANE_CORPUS_BUILDER_V2_VERSION = "split-lane-corpus-builder-v2" as const;
export const SPLIT_LANE_CORPUS_SPEC_V2_SCHEMA = "split-lane-corpus-spec-v2" as const;
export const SPLIT_LANE_CORPUS_V2_SCHEMA = "split-lane-role-corpus-v2" as const;
export const SPLIT_LANE_CORPUS_PROVENANCE_V2_SCHEMA = "split-lane-corpus-provenance-manifest-v2" as const;
export const CURATOR_DEVELOPMENT_LABEL = "curator-authored-development-fixture" as const;
export const CORPUS_PARTITIONS_V2 = ["calibration", "holdout"] as const;
export type CorpusPartitionV2 = (typeof CORPUS_PARTITIONS_V2)[number];
export const IMP22_RESERVED_CANDIDATE_BOOK_IDS = [
  "start-with-why",
  "radical-candor",
  "the-gifts-of-imperfection",
] as const;

/** The one PRESENT sentinel a source unit must carry for its semantics to be
 *  admitted; every other value (including OWNER_INPUT_PENDING or absent) is
 *  normalized to MISSING and excluded from source-clean gold (§J / test 33). */
export const SOURCE_SEMANTICS_PRESENT = "PRESENT" as const;
export const SOURCE_SEMANTICS_MISSING = "MISSING" as const;

/**
 * Neutral schema-scaffold planSpec added ONLY when a normalized 140-eval base
 * chapter lacks the field the CURRENT ChapterV21 schema requires. It is NOT a
 * source-origin inference: the `format` literal is "unspecified" (never
 * "scenario"), every value is the same explicit "unspecified", and the field is
 * excluded from the chapter content hash. It exists solely so a reader/quiz
 * base validates structurally; the source lane NEVER reads chapter planSpec for
 * semantics (it reads the owner-supplied SourceUsePlanV1 unit), and any case
 * whose semantics are absent is stamped MISSING.
 */
export const SCHEMA_SCAFFOLD_PLAN_SPEC = {
  domain: "unspecified",
  audience: "unspecified",
  stakes: "unspecified",
  format: "unspecified",
  requiredBeat: "unspecified",
} as const;

// ── Errors ────────────────────────────────────────────────────────────────────

/** Fail-closed builder error. `detail` carries the partial composition /
 *  excluded-unit diagnostics so a red-team test can inspect WHY the builder
 *  refused (never a silent []). */
export class CorpusBuildError extends Error {
  readonly detail: Record<string, unknown>;
  constructor(message: string, detail: Record<string, unknown> = {}) {
    super(message);
    this.name = "CorpusBuildError";
    this.detail = detail;
  }
}

// ── Mutation spec + ledger shapes ─────────────────────────────────────────────

export type MutationOpV1 = { path: string; op: "append" | "replace"; value: unknown };

/** A reader/quiz mutation variant. `builderGenerated` variants carry a concrete
 *  op the builder mints deterministically; `ownerAuthoredOps` variants require
 *  owner-authored gold ops and FAIL CLOSED until supplied (never fabricated). */
export type CorpusVariantSpecV1 = {
  variantKey: string;
  baseBookId: string;
  baseChapter: number;
  kind: string;
  targetUnit?: string;
  targetQuestionIndex1?: number;
  ops: MutationOpV1[];
  expected: Record<string, unknown>;
  goldRationale?: string;
  builderGenerated?: boolean;
  ownerAuthoredOps?: boolean;
};

/** A source unit slot. Only PRESENT slots carrying complete evidence are built;
 *  everything else is excluded and recorded MISSING. */
export type SourceUnitSpecV1 = {
  unitSlotId: string;
  family: string;
  ownerInputRequired?: boolean;
  sourceSemanticsStatus?: string;
  bookId?: string;
  chapterNumber?: number;
  evidence?: Record<string, unknown>;
  expected?: Record<string, unknown>;
};

export type SplitLaneMutationSpecV1 = {
  schema: typeof SPLIT_LANE_MUTATION_SPEC_SCHEMA;
  role: ReviewLaneRole;
  corpusId: string;
  governance: Record<string, unknown>;
  cleanBaseScoreLedger: string;
  minRenderBytes: number;
  basePool?: string[];
  excludedCandidateBookIds?: string[];
  expectedComposition: Record<string, number>;
  softDenominators?: Record<string, unknown>;
  variants?: CorpusVariantSpecV1[];
  units?: SourceUnitSpecV1[];
  familyGold?: Record<string, Record<string, unknown>>;
  pairedFamilies?: Array<{ positive: string; negative: string }>;
  zeroMissCategories?: string[];
  requiresPhase2?: boolean;
};

/** Common envelope for the additive IMP-22 reader/quiz specs. Role builders own
 * the typed case definitions, while this core owns governance, partition, and
 * exact-composition semantics. */
export type SplitLaneCorpusSpecV2Base = {
  schema: typeof SPLIT_LANE_CORPUS_SPEC_V2_SCHEMA;
  role: ReviewLaneRole;
  corpusId: string;
  builderMode: string;
  governance: Record<string, unknown>;
  cleanBaseScoreLedger: string;
  minRenderBytes: number;
  excludedCandidateBookIds: string[];
  expectedCompositionByPartition: Record<CorpusPartitionV2, Record<string, number>>;
};

export type CuratorDevelopmentProvenanceV2 = {
  labelProvenance: typeof CURATOR_DEVELOPMENT_LABEL;
  ownerApprovedForDevelopmentBakeoff: true;
  independentHumanRater: false;
  curatorRationale: string;
  sourceDesignation: string;
};

export type CleanBaseLedgerEntryV1 = {
  bookId: string;
  packageFile: string;
  contentDesignScore: number;
  packageSha256: string;
  packageCanonicalSha256: string;
  gates: { epistemic: string; ethics: string; externalAccuracy: string };
};

export type CleanBaseScoreLedgerV1 = {
  schema: typeof CLEAN_BASE_SCORE_LEDGER_SCHEMA;
  cleanBaseFloor: number;
  cleanBases: CleanBaseLedgerEntryV1[];
};

// ── Fail-closed readers (§J: fail when a required input is missing) ────────────

function readJsonFile(path: string, label: string): unknown {
  if (!existsSync(path)) {
    throw new CorpusBuildError(`${label} missing at the injected path — the builder fails closed and never substitutes an empty set`, { path, label });
  }
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (err) {
    throw new CorpusBuildError(`${label} unreadable: ${(err as Error).message}`, { path, label });
  }
  try {
    return JSON.parse(text) as unknown;
  } catch (err) {
    throw new CorpusBuildError(`${label} is not valid JSON: ${(err as Error).message}`, { path, label });
  }
}

/** Read + validate the committed, in-repo mutation spec. FAIL CLOSED if the
 *  file is missing, the schema/role is wrong, or the expected content is absent. */
export function readMutationSpec(specPath: string, expectedRole: ReviewLaneRole): SplitLaneMutationSpecV1 {
  const raw = readJsonFile(specPath, "mutation spec") as Partial<SplitLaneMutationSpecV1>;
  if (raw.schema !== SPLIT_LANE_MUTATION_SPEC_SCHEMA) {
    throw new CorpusBuildError(`mutation spec schema must be ${SPLIT_LANE_MUTATION_SPEC_SCHEMA} (got ${String(raw.schema)})`, { specPath });
  }
  if (raw.role !== expectedRole) {
    throw new CorpusBuildError(`mutation spec role mismatch: expected ${expectedRole}, got ${String(raw.role)}`, { specPath });
  }
  if (typeof raw.corpusId !== "string" || raw.corpusId.length === 0) {
    throw new CorpusBuildError("mutation spec is missing corpusId", { specPath });
  }
  if (!raw.expectedComposition || typeof raw.expectedComposition !== "object") {
    throw new CorpusBuildError("mutation spec is missing expectedComposition", { specPath });
  }
  return raw as SplitLaneMutationSpecV1;
}

/** Read the additive IMP-22 spec without accepting an IMP-20 v1 recipe by
 * accident. A caller may extend this base with role-specific fields only after
 * this common validation succeeds. */
export function readCorpusSpecV2(specPath: string, expectedRole: ReviewLaneRole): SplitLaneCorpusSpecV2Base {
  const raw = readJsonFile(specPath, "IMP-22 corpus spec") as Partial<SplitLaneCorpusSpecV2Base>;
  if (raw.schema !== SPLIT_LANE_CORPUS_SPEC_V2_SCHEMA) {
    throw new CorpusBuildError(`IMP-22 corpus spec schema must be ${SPLIT_LANE_CORPUS_SPEC_V2_SCHEMA} (got ${String(raw.schema)})`, { specPath });
  }
  if (raw.role !== expectedRole) {
    throw new CorpusBuildError(`IMP-22 corpus spec role mismatch: expected ${expectedRole}, got ${String(raw.role)}`, { specPath });
  }
  if (typeof raw.corpusId !== "string" || raw.corpusId.length === 0) {
    throw new CorpusBuildError("IMP-22 corpus spec is missing corpusId", { specPath });
  }
  if (typeof raw.builderMode !== "string" || raw.builderMode.length === 0) {
    throw new CorpusBuildError("IMP-22 corpus spec is missing builderMode", { specPath });
  }
  if (typeof raw.cleanBaseScoreLedger !== "string" || raw.cleanBaseScoreLedger.trim().length === 0) {
    throw new CorpusBuildError("IMP-22 corpus spec is missing cleanBaseScoreLedger", { specPath });
  }
  if (typeof raw.minRenderBytes !== "number" || !Number.isInteger(raw.minRenderBytes) || raw.minRenderBytes <= 0) {
    throw new CorpusBuildError("IMP-22 corpus spec must declare a positive integer minRenderBytes", { specPath });
  }
  if (!raw.expectedCompositionByPartition || typeof raw.expectedCompositionByPartition !== "object") {
    throw new CorpusBuildError("IMP-22 corpus spec is missing expectedCompositionByPartition", { specPath });
  }
  for (const partition of CORPUS_PARTITIONS_V2) {
    const composition = raw.expectedCompositionByPartition[partition];
    if (!composition || typeof composition !== "object" || typeof composition.total !== "number") {
      throw new CorpusBuildError(`IMP-22 corpus spec is missing ${partition} expected composition/total`, { specPath, partition });
    }
    for (const [bucket, count] of Object.entries(composition)) {
      if (!Number.isInteger(count) || count < 0) {
        throw new CorpusBuildError(`IMP-22 ${partition} composition ${bucket} must be a non-negative integer`, { specPath, partition, bucket, count });
      }
    }
  }
  if (!Array.isArray(raw.excludedCandidateBookIds)
    || raw.excludedCandidateBookIds.some((bookId) => typeof bookId !== "string" || bookId.trim().length === 0)) {
    throw new CorpusBuildError("IMP-22 corpus spec must declare excludedCandidateBookIds[]", { specPath });
  }
  return raw as SplitLaneCorpusSpecV2Base;
}

/** Freeze the non-root instrument inputs selected by the typed builder config.
 * Corpus bytes already hash the actual ledger; this additionally prevents a
 * caller from weakening the committed render floor or silently selecting a
 * differently named ledger while claiming the frozen spec. */
export function assertCorpusConfigMatchesSpecV2(spec: SplitLaneCorpusSpecV2Base, config: SplitLaneCorpusConfigV1): void {
  if (config.role !== spec.role) {
    throw new CorpusBuildError(`IMP-22 config role ${config.role} does not match spec role ${spec.role}`, { configRole: config.role, specRole: spec.role });
  }
  if (config.minRenderBytes !== spec.minRenderBytes) {
    throw new CorpusBuildError("IMP-22 config minRenderBytes does not match the frozen spec", {
      configMinRenderBytes: config.minRenderBytes,
      specMinRenderBytes: spec.minRenderBytes,
    });
  }
  const normalizedLedgerPath = config.cleanBaseScoreLedgerPath.replace(/\\/g, "/");
  if (!normalizedLedgerPath.endsWith(`/${spec.cleanBaseScoreLedger}`) && normalizedLedgerPath !== spec.cleanBaseScoreLedger) {
    throw new CorpusBuildError("IMP-22 config score-ledger path does not select the ledger named by the frozen spec", {
      configLedgerPath: config.cleanBaseScoreLedgerPath,
      specLedger: spec.cleanBaseScoreLedger,
    });
  }
}

/** Read + validate the clean-base 140-eval score ledger (E-03). FAIL CLOSED if
 *  the file is missing or the schema is wrong. */
export function readCleanBaseScoreLedger(ledgerPath: string): CleanBaseScoreLedgerV1 {
  const raw = readJsonFile(ledgerPath, "clean-base score ledger") as Partial<CleanBaseScoreLedgerV1>;
  if (raw.schema !== CLEAN_BASE_SCORE_LEDGER_SCHEMA) {
    throw new CorpusBuildError(`score ledger schema must be ${CLEAN_BASE_SCORE_LEDGER_SCHEMA} (got ${String(raw.schema)})`, { ledgerPath });
  }
  if (typeof raw.cleanBaseFloor !== "number") {
    throw new CorpusBuildError("score ledger is missing a numeric cleanBaseFloor", { ledgerPath });
  }
  if (!Array.isArray(raw.cleanBases)) {
    throw new CorpusBuildError("score ledger is missing cleanBases[]", { ledgerPath });
  }
  return raw as CleanBaseScoreLedgerV1;
}

// ── §I gold-governance assertion (encoded, not merely documented) ─────────────

/** Enforce the frozen gold-governance invariants a role spec must record (§I):
 *  definitions frozen before live output, calibration/holdout separated, holdout
 *  immutable once qualification begins, no in-campaign instrument treadmill,
 *  independentHumanRater recorded honestly false, and clean status never
 *  inferred from an overall score. A spec that omits or flips any of these FAILS
 *  CLOSED — the builder never proceeds on ungoverned gold. */
export function assertGoldGovernance(spec: SplitLaneMutationSpecV1): void {
  const g = spec.governance ?? {};
  const requireTrue = (key: string): void => {
    if (g[key] !== true) throw new CorpusBuildError(`gold governance violated: ${key} must be recorded true (§I)`, { key, corpusId: spec.corpusId });
  };
  requireTrue("definitionsFrozenBeforeLiveOutput");
  requireTrue("calibrationVsHoldoutSeparated");
  requireTrue("holdoutImmutableOnceLiveQualificationBegins");
  if (typeof g.noInCampaignInstrumentTreadmill !== "string" || (g.noInCampaignInstrumentTreadmill as string).length === 0) {
    throw new CorpusBuildError("gold governance violated: noInCampaignInstrumentTreadmill must be recorded (§I: terminate + new id, never a v4/v5 treadmill)", { corpusId: spec.corpusId });
  }
  if (g.independentHumanRater !== false) {
    throw new CorpusBuildError("gold governance violated: independentHumanRater must be recorded honestly as false (§I)", { corpusId: spec.corpusId });
  }
  // Clean status must never be inferred from an overall score — the ledger's
  // floor+gates are the label, not a composite (§I). This applies to the
  // score-labelled roles: reader records cleanStatusNeverInferredFromOverallScore
  // and source records sourceCleanStatusNeverInferredFromOverallScore. The quiz
  // role's clean-ness is DETERMINISTIC key-correctness (never score-inferred), so
  // it carries quiz-specific governance instead.
  if (spec.role === "reader" && g.cleanStatusNeverInferredFromOverallScore !== true) {
    throw new CorpusBuildError("gold governance violated: reader spec must record cleanStatusNeverInferredFromOverallScore=true (§I)", { corpusId: spec.corpusId });
  }
  if (spec.role === "source" && g.sourceCleanStatusNeverInferredFromOverallScore !== true) {
    throw new CorpusBuildError("gold governance violated: source spec must record sourceCleanStatusNeverInferredFromOverallScore=true (§I)", { corpusId: spec.corpusId });
  }
}

/** IMP-22 governance is stronger than the preserved IMP-20 rule: development
 * approval is explicit, labels are honestly curator-authored, and calibration is
 * structurally separate from qualification holdout rather than asserted only in
 * prose. */
export function assertGoldGovernanceV2(spec: SplitLaneCorpusSpecV2Base): void {
  const g = spec.governance ?? {};
  const requireTrue = (key: string): void => {
    if (g[key] !== true) throw new CorpusBuildError(`IMP-22 gold governance violated: ${key} must be true`, { key, corpusId: spec.corpusId });
  };
  requireTrue("definitionsFrozenBeforeLiveOutput");
  requireTrue("calibrationVsHoldoutSeparated");
  requireTrue("holdoutImmutableOnceLiveQualificationBegins");
  requireTrue("ownerApprovedForDevelopmentBakeoff");
  requireTrue("curatorAuthoredDevelopmentGold");
  if (spec.role === "reader") requireTrue("cleanStatusNeverInferredFromOverallScore");
  if (g.independentHumanRater !== false) {
    throw new CorpusBuildError("IMP-22 gold governance violated: independentHumanRater must be false", { corpusId: spec.corpusId });
  }
  if (g.labelProvenance !== CURATOR_DEVELOPMENT_LABEL) {
    throw new CorpusBuildError(`IMP-22 gold governance violated: labelProvenance must be ${CURATOR_DEVELOPMENT_LABEL}`, { corpusId: spec.corpusId });
  }
  if (typeof g.noInCampaignInstrumentTreadmill !== "string" || g.noInCampaignInstrumentTreadmill.length === 0) {
    throw new CorpusBuildError("IMP-22 gold governance violated: noInCampaignInstrumentTreadmill must be recorded", { corpusId: spec.corpusId });
  }
}

/** IMP-22 freezes one candidate set before qualification. A caller may not
 * silently add or remove an exclusion, because doing so would change which
 * material can enter the live holdout. Order is deliberately irrelevant. */
export function assertExactCandidateExclusionsV2(excludedCandidateBookIds: readonly string[]): void {
  const expected = [...IMP22_RESERVED_CANDIDATE_BOOK_IDS].sort();
  const actual = [...excludedCandidateBookIds].sort();
  const missing = expected.filter((bookId) => !actual.includes(bookId));
  const unexpected = actual.filter((bookId) => !expected.includes(bookId as (typeof IMP22_RESERVED_CANDIDATE_BOOK_IDS)[number]));
  const duplicates = actual.filter((bookId, index) => actual.indexOf(bookId) !== index);
  if (missing.length > 0 || unexpected.length > 0 || duplicates.length > 0) {
    throw new CorpusBuildError("IMP-22 candidate exclusions must match the frozen candidate set exactly", {
      expected,
      actual,
      missing,
      unexpected,
      duplicates,
    });
  }
}

/** Private-machine paths cannot become corpus semantics or dependencies. */
export function assertPortableCorpusSpecV2(spec: SplitLaneCorpusSpecV2Base): void {
  const serialized = JSON.stringify(spec);
  const match = serialized.match(/\/(?:Users|private\/tmp)\/[^"]*/);
  if (match) {
    throw new CorpusBuildError("IMP-22 corpus spec contains a private absolute path", {
      corpusId: spec.corpusId,
      matchedPrefix: match[0].slice(0, 120),
    });
  }
}

// ── Schema-only chapter normalization (NEVER infers source semantics) ─────────

/**
 * Deterministically bring a 140-eval book-package chapter onto the CURRENT
 * ChapterV21 schema by adding ONLY missing NON-source metadata. This adds a
 * neutral schema-scaffold planSpec (format "unspecified", never "scenario"), a
 * benign default quiz depthLevel, an implementationPlan.title derived from the
 * existing coreSkill, and memorableLine location/why defaults. It NEVER infers
 * source ORIGIN / FORM / CLAIM-STRENGTH and NEVER writes a source-semantic
 * value — the E-04 defect is removed here (design §J, IMP-20 §16 lines 963-973).
 */
/** Deterministic reading-time estimate (words / 200, min 1) over every string
 *  value in the chapter — used only to fill a missing non-source metadata field
 *  a deeper 140-eval chapter may lack. Deterministic → byte-reproducible. */
function estimateReadingTimeMinutes(chapter: unknown): number {
  let words = 0;
  const walk = (v: unknown): void => {
    if (typeof v === "string") {
      const t = v.trim();
      if (t.length > 0) words += t.split(/\s+/).length;
    } else if (Array.isArray(v)) {
      for (const item of v) walk(item);
    } else if (v !== null && typeof v === "object") {
      for (const val of Object.values(v as Record<string, unknown>)) walk(val);
    }
  };
  walk(chapter);
  return Math.max(1, Math.round(words / 200));
}

export function normalizeChapterSchemaOnly(input: ChapterV21): ChapterV21 {
  const ch = JSON.parse(JSON.stringify(input)) as Record<string, unknown>;
  if (typeof ch.readingTimeMinutes !== "number" || !Number.isFinite(ch.readingTimeMinutes)) {
    ch.readingTimeMinutes = estimateReadingTimeMinutes(ch);
  }
  const examples = (ch.examples as Array<Record<string, unknown>> | undefined) ?? [];
  for (const e of examples) {
    if (!e.planSpec) e.planSpec = { ...SCHEMA_SCAFFOLD_PLAN_SPEC };
  }
  const quiz = ch.quiz as { questions?: Array<Record<string, unknown>> } | undefined;
  for (const q of quiz?.questions ?? []) {
    if (!q.depthLevel) q.depthLevel = "standard";
  }
  const plan = ch.implementationPlan as Record<string, unknown> | undefined;
  if (plan && !plan.title) {
    const cs = String(plan.coreSkill ?? "").trim();
    const first = (cs.split(/(?<=[.!?])\s/)[0] ?? cs).replace(/[.]+$/, "").trim();
    plan.title = first || "Practice the core skill";
  }
  const memorableLines = (ch.memorableLines as Array<Record<string, unknown>> | undefined) ?? [];
  for (const m of memorableLines) {
    if (!m.location) m.location = "breakdown";
    if (!m.why) m.why = "A memorable distillation of the chapter's core idea.";
  }
  return ch as ChapterV21;
}

// ── Deterministic mutation helpers ────────────────────────────────────────────

export function cloneChapterAs(chapter: ChapterV21, newChapterId: string): ChapterV21 {
  const c = JSON.parse(JSON.stringify(chapter)) as ChapterV21 & { chapterId: string };
  c.chapterId = newChapterId;
  return c;
}

function setAtPath(root: unknown, path: string, value: unknown): void {
  const parts = path.split("/").filter(Boolean);
  if (parts.length === 0) throw new CorpusBuildError(`mutation path is empty`, { path });
  let cur = root as Record<string, unknown>;
  for (let i = 0; i < parts.length - 1; i++) {
    const next = cur[parts[i]];
    if (next === null || typeof next !== "object") throw new CorpusBuildError(`mutation path does not resolve: ${path}`, { path });
    cur = next as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]] = value;
}

/** Apply a list of append/replace ops deterministically. An `append` op must
 *  target a string; a `replace` op sets the value verbatim. Fail-closed on a
 *  bad target (never a silent no-op). */
export function applyMutationOps(chapter: ChapterV21, ops: MutationOpV1[]): void {
  for (const o of ops) {
    if (o.op === "append") {
      const cur = resolveJsonPath(chapter as unknown, o.path);
      if (typeof cur !== "string") throw new CorpusBuildError(`append target is not a string: ${o.path}`, { path: o.path });
      if (typeof o.value !== "string") throw new CorpusBuildError(`append value is not a string: ${o.path}`, { path: o.path });
      setAtPath(chapter, o.path, cur + o.value);
    } else if (o.op === "replace") {
      setAtPath(chapter, o.path, o.value);
    } else {
      throw new CorpusBuildError(`unsupported mutation op ${String((o as MutationOpV1).op)}`, { op: o.op });
    }
  }
}

/** Verify that a controlled mutation changed only its declared paths. Both the
 * base and variant are masked at every mutation path; any remaining difference
 * is scope drift and fails closed. The returned hash binds all protected fields. */
export function assertProtectedContentUnchanged(
  base: ChapterV21,
  variant: ChapterV21,
  ops: MutationOpV1[],
  caseId: string,
): string {
  if (ops.length === 0) return hashValue(base);
  const baseProjection = JSON.parse(JSON.stringify(base)) as ChapterV21;
  const variantProjection = JSON.parse(JSON.stringify(variant)) as ChapterV21;
  for (const op of ops) {
    setAtPath(baseProjection, op.path, "__IMP22_DECLARED_MUTATION_PATH__");
    setAtPath(variantProjection, op.path, "__IMP22_DECLARED_MUTATION_PATH__");
  }
  const baseHash = hashValue(baseProjection);
  const variantHash = hashValue(variantProjection);
  if (baseHash !== variantHash) {
    throw new CorpusBuildError(`IMP-22 controlled mutation ${caseId} changed protected content outside declared mutation paths`, {
      caseId,
      baseProtectedSha256: baseHash,
      variantProtectedSha256: variantHash,
      mutationPaths: ops.map((op) => op.path),
    });
  }
  return baseHash;
}

/** Candidate exclusion applies to every lane in IMP-22, not only source truth. */
export function assertCandidateBookExcluded(
  bookId: string,
  excludedCandidateBookIds: readonly string[],
  caseId: string,
): void {
  if (excludedCandidateBookIds.includes(bookId)) {
    throw new CorpusBuildError(`IMP-22 case ${caseId} overlaps reserved candidate book "${bookId}"`, {
      caseId,
      bookId,
      excludedCandidateBookIds,
    });
  }
}

// ── Clean-base admission (structural + data-enforced ledger floor) ─────────────

export type LedgerFloorResult = {
  ok: boolean;
  score: number;
  gates: { epistemic: string; ethics: string; externalAccuracy: string };
  reasons: string[];
  entry: CleanBaseLedgerEntryV1;
};

/** Data-enforced clean-base floor (E-03): a base is admissible only if it is in
 *  the ledger with contentDesignScore >= cleanBaseFloor AND epistemic == Pass
 *  AND ethics == Pass. The floor is READ from the committed ledger, never
 *  re-asserted in a comment. FAIL CLOSED if the base is not ledgered. */
export function assertLedgerFloor(ledger: CleanBaseScoreLedgerV1, bookId: string): LedgerFloorResult {
  const entry = ledger.cleanBases.find((b) => b.bookId === bookId);
  if (!entry) {
    throw new CorpusBuildError(`clean base ${bookId} is not in the score ledger — it has no owner reader-quality label (E-03)`, { bookId });
  }
  const reasons: string[] = [];
  if (!(entry.contentDesignScore >= ledger.cleanBaseFloor)) reasons.push(`contentDesignScore ${entry.contentDesignScore} < floor ${ledger.cleanBaseFloor}`);
  if (entry.gates.epistemic !== "Pass") reasons.push(`epistemic gate ${entry.gates.epistemic} != Pass`);
  if (entry.gates.ethics !== "Pass") reasons.push(`ethics gate ${entry.gates.ethics} != Pass`);
  if (reasons.length > 0) {
    throw new CorpusBuildError(`clean base ${bookId} fails the ledger floor/gates: ${reasons.join("; ")}`, { bookId, reasons });
  }
  return { ok: true, score: entry.contentDesignScore, gates: entry.gates, reasons, entry };
}

export type LoadedBase = {
  bookId: string;
  chapterNumber: number;
  chapter: ChapterV21;
  admission: ChapterAdmission;
  ledgerScore: number;
  ledgerGates: { epistemic: string; ethics: string; externalAccuracy: string };
  packageCanonicalSha256: string;
  packageRawSha256: string;
};

/** Load + normalize a base chapter from the INJECTED bookPackagesDir, bind it to
 *  its ledger entry (E-03), and gate on structural admission (schema + render +
 *  render-byte floor + completeness) plus the data-enforced ledger floor. FAIL
 *  CLOSED on any failure. The full production ship gate's craft/quiz-cue
 *  blockers are recorded ADVISORY (transparency), never a clean disqualifier —
 *  reader/quiz clean-ness is the ledger label + structural admission, not the
 *  composite ship verdict (design H1: "not a high total score"). */
export function loadAdmittedBase(
  bookPackagesDir: string,
  bookId: string,
  chapterNumber: number,
  minRenderBytes: number,
  ledger: CleanBaseScoreLedgerV1,
): LoadedBase {
  const floor = assertLedgerFloor(ledger, bookId);
  const file = `${bookPackagesDir}/${bookId}.v21.json`;
  if (!existsSync(file)) {
    throw new CorpusBuildError(`book package missing for clean base ${bookId} under the injected root`, { bookId, file });
  }
  const bytes = readFileSync(file);
  const pkg = JSON.parse(bytes.toString("utf8")) as { chapters?: ChapterV21[] };
  const raw = pkg.chapters?.[chapterNumber - 1];
  if (!raw) {
    throw new CorpusBuildError(`book package ${bookId} has no chapter ${chapterNumber}`, { bookId, chapterNumber });
  }
  // Bind the on-disk base to its ledgered content sha (E-03): a base that no
  // longer matches its 140-eval-scored bytes is refused, not silently rebound.
  const packageCanonicalSha256 = `sha256:${sha256Hex(canonicalJson(pkg))}`;
  const packageRawSha256 = `sha256:${sha256Hex(bytes)}`;
  if (packageCanonicalSha256 !== floor.entry.packageCanonicalSha256) {
    throw new CorpusBuildError(
      `clean base ${bookId} on-disk canonical sha ${packageCanonicalSha256} != ledgered ${floor.entry.packageCanonicalSha256} — the scored bytes drifted`,
      { bookId },
    );
  }
  const chapter = normalizeChapterSchemaOnly(raw);
  const admission = admitChapter(chapter);
  if (!admission.schemaOk) throw new CorpusBuildError(`base ${bookId} ch${chapterNumber} fails ChapterV21 schema after schema-only normalization`, { bookId, chapterNumber });
  if (!admission.renderOk) throw new CorpusBuildError(`base ${bookId} ch${chapterNumber} does not render (phase-1)`, { bookId, chapterNumber });
  if (admission.renderedBytes < minRenderBytes) throw new CorpusBuildError(`base ${bookId} ch${chapterNumber} rendered ${admission.renderedBytes}B < floor ${minRenderBytes}B (stub)`, { bookId, chapterNumber, renderedBytes: admission.renderedBytes });
  if (!admission.complete) throw new CorpusBuildError(`base ${bookId} ch${chapterNumber} incomplete: ${admission.completenessProblems.join("; ")}`, { bookId, chapterNumber });
  return {
    bookId,
    chapterNumber,
    chapter,
    admission,
    ledgerScore: floor.score,
    ledgerGates: floor.gates,
    packageCanonicalSha256,
    packageRawSha256,
  };
}

// ── Hashing + byte-reproducible serialization ─────────────────────────────────

/** sha256 over canonical JSON (recursively key-sorted); order-independent. */
export function hashValue(value: unknown): string {
  return `sha256:${hashCanonical(value)}`;
}

export { chapterContentHash };

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value as Record<string, unknown>).sort()) {
      const v = (value as Record<string, unknown>)[k];
      if (v !== undefined) out[k] = canonicalize(v);
    }
    return out;
  }
  return value;
}

/** Deterministic pretty-printed bytes: recursively key-sorted, 2-space indent,
 *  trailing newline, NO timestamp anywhere. Two builds of the same config
 *  produce byte-identical output (test 32). */
export function canonicalPretty(value: unknown): string {
  return JSON.stringify(canonicalize(value), null, 2) + "\n";
}

// ── Shared corpus + provenance envelope ───────────────────────────────────────

export type SplitLaneRoleCorpusV1<TCase> = {
  schema: typeof SPLIT_LANE_CORPUS_SCHEMA;
  role: ReviewLaneRole;
  corpusId: string;
  builderVersion: typeof SPLIT_LANE_CORPUS_BUILDER_VERSION;
  sourceCorpus: string;
  independentHumanRater: false;
  minRenderBytes: number;
  expectedComposition: Record<string, number>;
  generatedComposition: Record<string, number>;
  softDenominators: Record<string, unknown>;
  /** source-only: reserved zero-miss categories + paired families the qualifier
   *  binds (fabrication / causal-overreach / source-contradiction fail on any
   *  single miss). Absent for reader/quiz. */
  zeroMissCategories?: string[];
  pairedFamilies?: Array<{ positive: string; negative: string }>;
  cases: TCase[];
};

export type CorpusProvenanceManifestV1 = {
  schema: typeof SPLIT_LANE_CORPUS_PROVENANCE_SCHEMA;
  role: ReviewLaneRole;
  corpusId: string;
  builderVersion: typeof SPLIT_LANE_CORPUS_BUILDER_VERSION;
  mutationSpecSha256: string;
  cleanBaseScoreLedgerSha256: string;
  minRenderBytes: number;
  independentHumanRater: false;
  governance: Record<string, unknown>;
  expectedComposition: Record<string, number>;
  generatedComposition: Record<string, number>;
  softDenominators: Record<string, unknown>;
  cleanBases: Array<Record<string, unknown>>;
  cases: Array<Record<string, unknown>>;
  excludedUnits: Array<Record<string, unknown>>;
  zeroMissCategories?: string[];
  pairedFamilies?: Array<{ positive: string; negative: string }>;
  corpusSha256: string;
};

export type CorpusBuildResultV1<TCase> = {
  corpus: SplitLaneRoleCorpusV1<TCase>;
  provenanceManifest: CorpusProvenanceManifestV1;
  corpusBytes: string;
};

/** Fail-closed composition check: every declared bucket must have AT LEAST the
 *  expected count. The builder REFUSES to shrink (never emits a smaller corpus)
 *  — the E-09 silent-drop defect is removed here. */
export function assertComposition(
  expected: Record<string, number>,
  generated: Record<string, number>,
  what: string,
  detail: Record<string, unknown> = {},
): void {
  const shortfalls: string[] = [];
  for (const [bucket, min] of Object.entries(expected)) {
    if (bucket === "total") continue;
    const got = generated[bucket] ?? 0;
    if (got < min) shortfalls.push(`${bucket}: ${got} < ${min}`);
  }
  const totalExpected = expected.total;
  if (typeof totalExpected === "number") {
    const totalGot = Object.entries(generated).reduce((n, [b, c]) => (b === "total" ? n : n + c), 0);
    if (totalGot < totalExpected) shortfalls.push(`total: ${totalGot} < ${totalExpected}`);
  }
  if (shortfalls.length > 0) {
    throw new CorpusBuildError(
      `${what} corpus fails closed rather than shrink below expectedComposition (${shortfalls.join("; ")}) — a required variant set was not assembled (owner input pending or an admission refusal); the builder never substitutes []`,
      { ...detail, shortfalls, expected, generated },
    );
  }
}

/** IMP-22 compositions are exact. Extra cases are as invalid as missing cases:
 * neither an output-informed bonus case nor a silent shrink may enter holdout. */
export function assertExactCompositionV2(
  expected: Record<string, number>,
  generated: Record<string, number>,
  partition: CorpusPartitionV2,
  what: string,
): void {
  const problems: string[] = [];
  const expectedBuckets = Object.keys(expected).filter((key) => key !== "total").sort();
  const generatedBuckets = Object.keys(generated).filter((key) => key !== "total" && (generated[key] ?? 0) !== 0).sort();
  for (const bucket of expectedBuckets) {
    const want = expected[bucket];
    const got = generated[bucket] ?? 0;
    if (got !== want) problems.push(`${bucket}: ${got} != ${want}`);
  }
  for (const bucket of generatedBuckets) {
    if (!expectedBuckets.includes(bucket)) problems.push(`${bucket}: unexpected ${generated[bucket]}`);
  }
  const gotTotal = generatedBuckets.reduce((sum, bucket) => sum + (generated[bucket] ?? 0), 0);
  if (gotTotal !== expected.total) problems.push(`total: ${gotTotal} != ${expected.total}`);
  const declaredTotal = expectedBuckets.reduce((sum, bucket) => sum + expected[bucket], 0);
  if (declaredTotal !== expected.total) problems.push(`declared bucket sum: ${declaredTotal} != total ${expected.total}`);
  if (problems.length > 0) {
    throw new CorpusBuildError(`IMP-22 ${what} ${partition} composition must match exactly (${problems.join("; ")})`, {
      what,
      partition,
      expected,
      generated,
      problems,
    });
  }
}

export type SplitLaneCorpusPartitionEnvelopeV2<TCase> = {
  partition: CorpusPartitionV2;
  expectedComposition: Record<string, number>;
  generatedComposition: Record<string, number>;
  cases: TCase[];
  substantivePartitionSha256: string;
};

export type SplitLaneRoleCorpusV2<TCase> = {
  schema: typeof SPLIT_LANE_CORPUS_V2_SCHEMA;
  role: ReviewLaneRole;
  corpusId: string;
  builderVersion: typeof SPLIT_LANE_CORPUS_BUILDER_V2_VERSION;
  labelProvenance: typeof CURATOR_DEVELOPMENT_LABEL;
  ownerApprovedForDevelopmentBakeoff: true;
  independentHumanRater: false;
  specSha256: string;
  cleanBaseScoreLedgerSha256: string;
  excludedCandidateBookIds: string[];
  excludedCandidateBookIdsSha256: string;
  partitions: Record<CorpusPartitionV2, SplitLaneCorpusPartitionEnvelopeV2<TCase>>;
  substantiveCorpusSha256: string;
};

export type CorpusProvenanceManifestV2 = {
  schema: typeof SPLIT_LANE_CORPUS_PROVENANCE_V2_SCHEMA;
  role: ReviewLaneRole;
  corpusId: string;
  builderVersion: typeof SPLIT_LANE_CORPUS_BUILDER_V2_VERSION;
  labelProvenance: typeof CURATOR_DEVELOPMENT_LABEL;
  ownerApprovedForDevelopmentBakeoff: true;
  independentHumanRater: false;
  specSha256: string;
  cleanBaseScoreLedgerSha256: string;
  excludedCandidateBookIds: string[];
  excludedCandidateBookIdsSha256: string;
  partitionSha256: Record<CorpusPartitionV2, string>;
  caseSha256: Record<string, string>;
  substantiveCorpusSha256: string;
  corpusBytesSha256: string;
};

export type CorpusBuildResultV2<TCase> = {
  corpus: SplitLaneRoleCorpusV2<TCase>;
  provenanceManifest: CorpusProvenanceManifestV2;
  corpusBytes: string;
};
