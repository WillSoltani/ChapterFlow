/**
 * IMP-11 — migration-experiment typed schemas (F-002, F-015, F-017, F-022,
 * F-023, F-024; master plan §16).
 *
 * The migration harness runs three frozen stages, none of which can promote,
 * publish, repair, or touch canonical state:
 *
 *   Stage Q — judge qualification on a labeled adversarial corpus;
 *   Stage D — diagnostic prompt-stack factorial (legacy v24 vs SOL-native);
 *   Stage C — confirmatory four-way model/effort bakeoff (55-H/55-XH/56S-H/56S-XH)
 *             under the final frozen stack.
 *
 * Everything in this file is DATA — versioned module schemas in the bakeoff
 * `model-bakeoff-*-v1` tradition. The nine Phase-0 frozen contracts are
 * untouched; guards live in guards.ts; behavior in the runners.
 */

import type { EffortLevelV1 } from "../../contracts/executionProfile.js";
import type { ProviderOutcomeV1, TaskClassV1 } from "../../contracts/routeContracts.js";
import type { DiversityFeaturesV1 } from "../../telemetry/diversityFeatures.js";
import type { ChapterV21 } from "../../types.js";
import type { FrozenFileV1 } from "../types.js";

export const MIGRATION_SPEC_SCHEMA = "migration-experiment-spec-v1" as const;
export const MIGRATION_SEALED_SCHEMA = "migration-sealed-manifest-v1" as const;
export const MIGRATION_MANIFEST_SCHEMA = "migration-run-manifest-v1" as const;
export const MIGRATION_SCHEDULE_SCHEMA = "migration-sample-schedule-v1" as const;
export const MIGRATION_SAMPLE_SCHEMA = "migration-sample-record-v1" as const;
export const MIGRATION_QUAL_CORPUS_SCHEMA = "migration-qual-corpus-v1" as const;
export const MIGRATION_QUALIFICATION_SCHEMA = "migration-judge-qualification-v1" as const;
export const MIGRATION_METRIC_TABLES_SCHEMA = "migration-metric-tables-v1" as const;
export const SOL_BAKEOFF_DECISION_SCHEMA = "sol-bakeoff-decision-v1" as const;

/** The frozen repair-demand projection formula version (metrics.ts documents it). */
export const REPAIR_PROJECTION_VERSION = "repair-projection-v1" as const;

/** Migration phases, in lifecycle order. NO promote/qc/publish phase EXISTS —
 *  the ladder simply has no rung that crosses into canonical state. */
export const MIGRATION_PHASES = [
  "seal",
  "qualify",
  "generate",
  "review",
  "metrics",
  "analyze",
  "unblind",
  "decide",
  "report",
] as const;
export type MigrationPhase = (typeof MIGRATION_PHASES)[number];

/** The four prespecified chapter strata (prompt inst. 8). No existing pipeline
 *  artifact tags strata — the experiment spec carries them, prespecified before
 *  any output exists. */
export const CHAPTER_STRATA = [
  "research-heavy",
  "abstract-conceptual",
  "example-heavy",
  "causal-quiz-sensitive",
] as const;
export type ChapterStratumV1 = (typeof CHAPTER_STRATA)[number];

/** A frozen prompt stack. "current-builders" = the live buildAuthorCard chain
 *  (the SOL-native stack after IMP-03..IMP-06); "snapshot" = a directory of
 *  pre-rendered per-chapter card templates (the §16 operator renders the legacy
 *  v24 stack from git history OUTSIDE this harness) using the freeze.ts
 *  CARD_OUTPUT_PLACEHOLDER convention. */
export type PromptStackSpecV1 =
  | { id: string; source: "current-builders" }
  | { id: string; source: "snapshot"; snapshotDirRelPath: string; combinedSha256: string };

/** One experiment cell: the ONLY things that may differ between compared
 *  candidates (prompt inst. 7 / §16 control 3). Stage C canonical ids are
 *  "55-H", "55-XH", "56S-H", "56S-XH". */
export type ExperimentCellV1 = {
  cellId: string;
  model: string;
  effort: EffortLevelV1;
  stackId: string;
};

export type ExperimentBookV1 = {
  bookId: string;
  chapters: Array<{ chapterNumber: number; stratum: ChapterStratumV1 }>;
};

export type PrecisionEndpointV1 = {
  id: string;
  /** One-sided 95% upper bound the campaign wants to be able to CLAIM (percent). */
  targetUpperBoundPct: number;
  /** Independent units (chapters) required for that claim by rule-of-three. */
  minIndependentUnits: number;
};

export type ExperimentSpecV1 = {
  schema: typeof MIGRATION_SPEC_SCHEMA;
  experimentId: string;
  stage: "diagnostic" | "confirmatory";
  title: string;
  cells: ExperimentCellV1[];
  stacks: PromptStackSpecV1[];
  books: ExperimentBookV1[];
  /** Independent first-write samples per cell per chapter (≥2; inst. 8). */
  samplesPerCell: number;
  /** Screening → prespecified expansion (inst. 14): the screening subset runs
   *  first; `expandWhen` rule ids (evaluated by stats.evaluateStopping) decide
   *  expansion up to maxSamplesPerCell. Frozen at seal. */
  screening: { samplesPerCell: number; expandWhen: string[]; maxSamplesPerCell: number };
  randomizationSeed: string;
  judgePanel: Array<{ model: string; effort: EffortLevelV1 }>;
  /** Pipeline-relative path of the frozen thresholds file (hashed at seal). */
  thresholdsRelPath: string;
  /** Frozen price snapshot per cell model; null = prices unavailable — cost
   *  fields are then MARKED unavailable, never estimated (inst. 18). */
  priceSnapshot: Record<string, { inputPerMTok: number; outputPerMTok: number } | null>;
  precision: { primaryEndpoints: PrecisionEndpointV1[] };
  /** Sequential stopping rule ids, frozen before execution (inst. 17). */
  stopping: { rules: string[] };
  /** Bounded infrastructure replay (inst. 9 / §16 control 5): at most one, only
   *  for these DISJOINT provider outcomes, NEVER content or safeguard/refusal. */
  infraReplay: { maxPerSample: number; replayableOutcomes: ProviderOutcomeV1[] };
};

export type SampleScheduleEntryV1 = {
  blindSampleId: string;
  cellId: string;
  bookId: string;
  chapterNumber: number;
  stratum: ChapterStratumV1;
  sampleIndex: number;
  /** Global randomized execution order (blocked by book/chapter; §16 control 6). */
  executionOrder: number;
  /** True while the entry is beyond the screening subset (runs only if the
   *  frozen expansion rules fire). */
  expansion: boolean;
};

export type SampleScheduleV1 = {
  schema: typeof MIGRATION_SCHEDULE_SCHEMA;
  experimentId: string;
  randomizationSeed: string;
  entries: SampleScheduleEntryV1[];
};

export type SealedManifestV1 = {
  schema: typeof MIGRATION_SEALED_SCHEMA;
  experimentId: string;
  specSha256: string;
  sealedAt: string;
  randomizationSeed: string;
  scheduleSha256: string;
  thresholdsSha256: string;
  books: Array<{
    bookId: string;
    /** The book's REAL index length — candidate cards must gate the content-
     *  device deal exactly like production authoring, even on chapter subsets. */
    totalChapters: number;
    frozen: { files: FrozenFileV1[]; combinedSha256: string };
  }>;
  stacks: Array<{
    id: string;
    source: PromptStackSpecV1["source"];
    /** Per "bookId:chNN" card-template hash (CARD_OUTPUT_PLACEHOLDER substituted). */
    cardTemplateSha256: Record<string, string>;
    combinedSha256: string;
  }>;
  instruments: {
    readerRubricVersion: string;
    reviewDocHashVersion: string;
    authorChapterBar: number;
    routePolicyVersion: string;
    contractManifestSha256: string;
    repairProjectionVersion: string;
  };
  judgePanel: Array<{ model: string; effort: EffortLevelV1 }>;
  priceSnapshot: ExperimentSpecV1["priceSnapshot"];
  expectedCells: string[];
};

export type MigrationManifestV1 = {
  schema: typeof MIGRATION_MANIFEST_SCHEMA;
  experimentId: string;
  createdAt: string;
  updatedAt: string;
  specSha256: string;
  completedPhases: MigrationPhase[];
  /** Set the moment metric tables are frozen — unblinding is refused before it
   *  (verification #5); thresholds may never change after it (inst. 17). */
  metricTablesSha256?: string;
  unblindedAt?: string;
  haltReason?: string;
};

export type MigrationReviewSummaryV1 = {
  composite: number;
  ship: boolean;
  keysClean: boolean;
  valid: boolean;
  pass: boolean;
  quizAdjudicationStatus: string;
  complaintsMustFix: number;
  reviewerSessionId: string;
  judgeModel: string;
  judgeEffort: EffortLevelV1;
};

export type MigrationSampleRecordV1 = {
  schema: typeof MIGRATION_SAMPLE_SCHEMA;
  experimentId: string;
  stage: ExperimentSpecV1["stage"];
  blindSampleId: string;
  cellId: string;
  bookId: string;
  chapterNumber: number;
  stratum: ChapterStratumV1;
  sampleIndex: number;
  executionOrder: number;
  outcome: {
    providerOutcome: ProviderOutcomeV1;
    replayed: boolean;
    originalProviderOutcome?: ProviderOutcomeV1;
    /** True iff the ONE first-write attempt passed every write-time check. */
    firstWriteDeterministicPass: boolean;
    failureReason?: string;
    durationMs: number;
    writerSessionIds: string[];
  };
  artifact: { contentSha256: string | null; chapterRelPath: string | null };
  critics: {
    c37Overreach: number;
    c37SceneCompletion: number;
    c37GenericLeak: number;
    registerAdvisories: number;
    causalClaims: number;
    diversity: DiversityFeaturesV1 | null;
  } | null;
  review: MigrationReviewSummaryV1 | null;
  /** Second read by the NEXT panel judge on the prespecified agreement
   *  subsample (sampleIndex 1, panel size > 1) — judge-agreement metrics only. */
  agreementReview?: MigrationReviewSummaryV1 | null;
  /** Codex CLI exposes no usage fields (verified against codexAgent/cost-tracker)
   *  — tokens stay null and are listed in unavailableFields, never estimated. */
  tokens: { input: number; output: number; reasoning: number; cached: number } | null;
  unavailableFields: string[];
  recordedAt: string;
};

// ── Stage Q (judge qualification) ─────────────────────────────────────────────

/** The eight adversarial corpus classes (prompt inst. 3). */
export const QUAL_CLASSES = [
  "clean-control",
  "sourced-fabrication",
  "ambiguous-constructed",
  "causal-overreach",
  "two-valid-answer-quiz",
  "unsupported-complaint-bait",
  "structural-clone",
  "prompt-injection",
] as const;
export type QualClassV1 = (typeof QUAL_CLASSES)[number];

export type QualExpectedDefectV1 = {
  defectClass: string;
  severity: "high" | "medium" | "low";
  /** Anchor text a detecting complaint must reference (byte-substring of the
   *  chapter's rendered doc); scoring is anchored, never vibes. */
  mustQuote?: string;
};

export type QualCorpusItemV1 = {
  itemId: string;
  class: QualClassV1;
  /** Corpus items are SYNTHETIC chapters (IMP-12 fixture rules — never production
   *  state); the judge reads them through the REAL phase-1 review instrument. */
  chapter: ChapterV21;
  cleanControl: boolean;
  expected: QualExpectedDefectV1[];
  /** prompt-injection items: the compliance token the injected text demands the
   *  judge echo; echoing it (or obeying) fails resistance. */
  injectionMarker?: string;
  labelProvenance: "human" | "synthetic-seed";
};

export type QualCorpusV1 = {
  schema: typeof MIGRATION_QUAL_CORPUS_SCHEMA;
  corpusId: string;
  items: QualCorpusItemV1[];
};

export type QualThresholdsV1 = {
  minSensitivityPerClass: number;
  maxFalsePositiveRate: number;
  minEvidenceQuoteValidity: number;
  minSchemaValidity: number;
  minInjectionResistance: number;
};

export type JudgeQualificationV1 = {
  schema: typeof MIGRATION_QUALIFICATION_SCHEMA;
  judge: { model: string; effort: EffortLevelV1 };
  corpusId: string;
  corpusSha256: string;
  instrumentVersions: { readerRubricVersion: string; reviewDocHashVersion: string };
  scoredAt: string;
  perClass: Array<{ class: QualClassV1; expected: number; detected: number; sensitivity: number }>;
  falsePositiveRate: number;
  evidenceQuoteValidityRate: number;
  schemaValidityRate: number;
  injectionResistanceRate: number;
  thresholds: QualThresholdsV1;
  qualified: boolean;
  labelProvenance: { human: number; synthetic: number };
  /** True when ANY synthetic label contributed: a §16-valid qualification
   *  requires a human-labeled corpus — this flag makes a dry-run unmistakable. */
  dryRunOnly: boolean;
};

/** SOL profile decision entry (prompt inst. 20): task-class-scoped profiles are
 *  expressible; NOTHING here activates a route — activation is IMP-13's package. */
export type QualifiedProfileV1 = {
  model: string;
  effort: EffortLevelV1;
  taskClasses?: TaskClassV1[];
};
