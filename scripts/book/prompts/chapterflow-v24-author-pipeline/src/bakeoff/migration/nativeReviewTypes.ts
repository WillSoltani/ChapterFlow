/**
 * IMP-19 — Layer-N v2: native production-reviewer qualification (types + schemas
 * + evidence-boundary registry).
 *
 * Layer-N v1 (QualCorpusV1 / migration-judge-qualification-v1) is preserved as
 * INSTRUMENT_INVALID (see LAYER-N-V1-DISPOSITION.json). This module is a DISTINCT
 * v2 surface — new schema strings, new types — so a v1 record can never satisfy
 * v2 enforcement.
 *
 * What Layer-N v2 qualifies (its non-duplicative purpose vs Layer-O v3): the EXACT
 * production chapter-review lane on COMPLETE chapters — phase-1 render, isolated
 * reader workspace, reader-JSON parse, quote verification, quiz derivation,
 * ship/no-ship calibration at AUTHOR_CHAPTER_BAR, hard-blocker (mustFix) complaints,
 * and the phase-2 key-visible quiz adjudication. It measures ONLY capabilities the
 * isolated reviewer can observe from the reader-facing document (+ the committed
 * phase-2 derivation). Source truth, cross-book clone detection, and review-finding
 * validity remain in Layer-O / deterministic critics / source-sensitive reviews —
 * they are OUT OF the Layer-N evidence boundary (see OUT_OF_BOUNDARY_TARGETS).
 *
 * Everything here is DATA. Hashing, validation, scoring, and the runner live in
 * nativeReviewQualification.ts and nativeReviewRunner.ts.
 */

import type { EffortLevelV1 } from "../../contracts/executionProfile.js";
import type { ChapterV21 } from "../../types.js";

export const NATIVE_REVIEW_CORPUS_SCHEMA = "migration-native-review-corpus-v2" as const;
export const NATIVE_REVIEW_QUALIFICATION_SCHEMA = "migration-native-review-qualification-v2" as const;
export const NATIVE_REVIEW_THRESHOLDS_SCHEMA = "migration-native-review-thresholds-v2" as const;
export const NATIVE_REVIEW_SEAL_SCHEMA = "migration-native-review-seal-v2" as const;
export const NATIVE_REVIEW_INSTRUMENT_MANIFEST_SCHEMA = "migration-native-review-instrument-manifest-v2" as const;
export const NATIVE_REVIEW_ITEM_EVIDENCE_SCHEMA = "migration-native-review-item-evidence-v2" as const;

/** The frozen version of the capability scorer (bumping it stales prior v2
 *  qualifications through the instrument manifest).
 *  v2.1 (owner frozen decision 2026-07-11): security is NOT_APPLICABLE in Layer-N
 *  (no vacuous injection pass-check when the corpus has 0 security cases), and the
 *  qualification binds a Layer-O v3 security prerequisite (§1).
 *  v2.2 (owner-authorized 2026-07-11): hard-blocker DETECTION = mustFix-in-target-
 *  unit + verified mutation evidence (the sealed channel doc + production ship
 *  semantics); the score-based ship bit no longer gates detection (it stays the
 *  separate pairedDirectionalityRate metric). Fixes the INSTRUMENT_INVALID scoring
 *  defect that failed a genuine detection whose composite stayed >= bar. */
export const NATIVE_REVIEW_SCORER_VERSION = "native-review-scorer-v2.2" as const;

/** Schema for the Layer-O v3 security-qualification prerequisite binding (§1):
 *  Layer-N does NOT claim independent security qualification — it binds the exact
 *  valid Stage-Q Layer-O v3 result + hashes; any Layer-O drift (seal, instrument,
 *  panel, required security result) stales the combined reviewer qualification. */
export const NATIVE_REVIEW_LAYER_O_PREREQ_SCHEMA = "migration-layer-o-prerequisite-binding-v1" as const;

// ── Case kinds (reviewer-observable only) ─────────────────────────────────────

/** Every kind is decidable from the reader-facing document (+ the phase-2
 *  committed derivation/key for quiz kinds). `security-boundary` is included for
 *  schema completeness but the v2 corpus omits BLOCKING security cases pending the
 *  owner decision (LN-08): ChapterReviewV1 carries no behavioral security field,
 *  so injection is observed ADVISORY-only and security qualification stays in
 *  Layer-O v3. */
export const NATIVE_REVIEW_CASE_KINDS = [
  "clean-pass",
  "reader-visible-hard-blocker",
  "quiz-key-mismatch",
  "quiz-ambiguity",
  "craft-nonblocker",
  "security-boundary",
] as const;
export type NativeReviewCaseKind = (typeof NATIVE_REVIEW_CASE_KINDS)[number];

/** Which output CHANNEL each kind is scored through (never a universal complaint
 *  anchor — that was the v1 LN-04 defect). */
export const NATIVE_REVIEW_CHANNEL: Record<NativeReviewCaseKind, string> = {
  "clean-pass": "ship-decision (valid && pass && keys clean && no mustFix)",
  "reader-visible-hard-blocker": "mustFix complaint in a target unit + verified evidence (quote or complaint) intersecting the mutation span",
  "quiz-key-mismatch": "phase-1 keyCheck.disagreements + phase-2 quizAdjudication.items[].keyCorrect==='wrong'",
  "quiz-ambiguity": "phase-2 quizAdjudication.items[].keyCorrect==='ambiguous' (+ phase-1 tells)",
  "craft-nonblocker": "target weakness lowers scores but is NOT escalated to a reserved-harm mustFix",
  "security-boundary": "ADVISORY behavioral observation (protocol preserved + demanded token only inside evidence quotes); NOT a blocking metric in v2",
};

/** Blocking capabilities (a miss disqualifies at the frozen threshold). */
export const NATIVE_REVIEW_BLOCKING_KINDS: readonly NativeReviewCaseKind[] = [
  "clean-pass",
  "reader-visible-hard-blocker",
  "quiz-key-mismatch",
  "quiz-ambiguity",
  "craft-nonblocker",
];

// ── Evidence boundary (LN-03 / instruction 3) ─────────────────────────────────

/** Targets that Layer-N v2 must REJECT — they require evidence absent from the
 *  isolated reviewer's workspace (only the reader-facing phase-1 doc, and for the
 *  quiz subset the committed derivation + real key at phase-2). The v2 corpus
 *  validator rejects any item whose gold depends on these. */
export const OUT_OF_BOUNDARY_TARGETS = [
  {
    id: "source-factual-truth",
    why: "external factual verification (is a historical claim true / does a source contain a claim) needs source packets the reviewer never receives — stays in Layer-O / source-sensitive review",
  },
  {
    id: "cross-chapter-or-book-comparison",
    why: "structural clone / cross-book sameness needs sibling chapters the isolated reviewer never receives — stays in deterministic intra-book critics / book-level eval",
  },
  {
    id: "prior-review-finding-validity",
    why: "review-finding validity is not chapter-content review and needs a prior finding the reviewer never receives — stays in Layer-O v3",
  },
  {
    id: "hidden-author-prompt-or-source-plan",
    why: "author prompts / source plans are never in the reviewer workspace",
  },
  {
    id: "answer-key-during-phase-1",
    why: "phase-1 is key-free by construction (renderChapterReaderDocPhase1); key-dependent gold is scored ONLY through the phase-2 committed-key channel, never a phase-1 complaint anchor",
  },
  {
    id: "any-artifact-absent-from-reviewer-workspace",
    why: "the physical role workspace contains only the phase-1 doc; nothing else is observable",
  },
] as const;
export type OutOfBoundaryTargetId = (typeof OUT_OF_BOUNDARY_TARGETS)[number]["id"];

/** Layer-O v1/v3 classes deliberately NOT carried into Layer-N v2, with the
 *  boundary reason (documentation for the static-review separation). */
export const LAYER_O_ONLY_CLASSES: Record<string, OutOfBoundaryTargetId> = {
  "sourced-fabrication": "source-factual-truth",
  "structural-clone": "cross-chapter-or-book-comparison",
  "unsupported-complaint-bait": "prior-review-finding-validity",
  "prompt-injection": "any-artifact-absent-from-reviewer-workspace",
};

// ── Corpus ────────────────────────────────────────────────────────────────────

export type NativeReviewApprovalStatus =
  | "owner-approved-development-fixture"
  | "independently-human-labeled";

/** Case-specific expected outcome — NEVER reduced to `!pass + complaint anchor`.
 *  Each field is decidable from a reviewer-observable channel. */
export type NativeReviewExpectedV2 = {
  /** clean-pass / directionality: the reviewer SHOULD ship (true) or block (false). */
  expectedPass?: boolean;
  /** quiz-key-mismatch: 1-based quiz question numbers whose stored key is wrong. */
  expectedKeyMismatchQuestions?: number[];
  /** quiz-ambiguity: 1-based quiz question numbers with two defensible answers. */
  expectedAmbiguousQuestions?: number[];
  /** hard-blocker: at least one mustFix complaint is REQUIRED. */
  requireMustFix?: boolean;
  /** clean-pass / craft-nonblocker: NO mustFix complaint may be raised. */
  prohibitMustFix?: boolean;
  /** hard-blocker: reviewer complaint `unit` strings that legitimately carry the
   *  target mustFix (matched case-insensitively / normalized). */
  targetUnits?: string[];
  /** hard-blocker: verbatim substrings of the reviewer-visible doc that count as
   *  target evidence (a verified quote OR a complaint quoting one of these, that
   *  intersects the mutation span, satisfies evidence accuracy). */
  acceptedEvidenceSpans?: string[];
  /** security-boundary (ADVISORY): the reviewer's task boundary must be preserved. */
  expectedBoundaryPreserved?: boolean;
  /** security-boundary (ADVISORY): whether obeying the injection is the failure. */
  expectedInjectionObeyed?: boolean;
};

/** Deterministic base→variant diff manifest (protected regions byte-pinned). */
export type NativeReviewMutationManifestV2 = {
  baseContentSha256: string;
  variantContentSha256: string;
  /** JSON pointer paths permitted to differ base→variant. */
  allowedPaths: string[];
  /** JSON pointer paths that actually differ (must be a subset of allowedPaths). */
  changedPaths: string[];
  /** JSON pointer path → sha256 of the base value that MUST be byte-identical in
   *  the variant (structural integrity: quiz shape, section presence, etc.). */
  protectedRegionHashes: Record<string, string>;
};

export type NativeReviewCorpusItemV2 = {
  itemId: string;
  /** The clean base this item derives from (equals itemId for clean-pass items). */
  baseItemId: string;
  kind: NativeReviewCaseKind;
  /** A COMPLETE ChapterV21 (authoring shape: breakdown tiers + quiz + examples +
   *  implementationPlan + reviewCards + keyTakeaway). Clean bases are v21-gold
   *  chapters that pass the deterministic ship gate; variants are controlled
   *  mutations of an admitted base. */
  chapter: ChapterV21;
  expected: NativeReviewExpectedV2;
  /** null for clean-pass; required for every variant. */
  mutationManifest: NativeReviewMutationManifestV2 | null;
  /** Where the base came from, e.g. "v21-gold:daring-greatly:ch01". */
  evidenceProvenance: string;
  approvalStatus: NativeReviewApprovalStatus;
  /** True for the frozen quiz subset (key-mismatch / ambiguity) that MUST run
   *  phase-2; the runner uses persist=true (migration-isolated io) for these. */
  requiresPhase2: boolean;
};

export type NativeReviewCorpusV2 = {
  schema: typeof NATIVE_REVIEW_CORPUS_SCHEMA;
  corpusId: string;
  version: string;
  /** Human-readable source of the base chapters (must be OUTSIDE candidate books). */
  sourceCorpus: string;
  items: NativeReviewCorpusItemV2[];
  approvalStatus: NativeReviewApprovalStatus;
  /** Honest provenance: owner-approved development fixtures are NOT an independent
   *  human publication rating. */
  independentHumanRater: boolean;
};

// ── Instrument manifest (LN-08 / instruction 10) ──────────────────────────────

/** Every behavior-affecting component of the native review instrument. A change
 *  to ANY field stales prior v2 qualifications (bound into the seal + enforced by
 *  assertNativeReviewQualified). */
export type NativeReviewInstrumentManifestV2 = {
  schema: typeof NATIVE_REVIEW_INSTRUMENT_MANIFEST_SCHEMA;
  readerRubricVersion: string;
  phase1DocVersion: string;
  reviewDocHashVersion: string;
  authorChapterBar: number;
  readerTaskTemplateSha256: string;
  parserAdjudicatorVersion: string;
  phase2TaskSchemaVersion: string;
  outputContractVersion: string;
  reviewerWorkspaceRoleContract: string;
  executionProfileHash: string;
  routePolicyVersion: string;
  qualificationScorerVersion: string;
  thresholdsSha256: string;
};

// ── Thresholds (instruction 13) ───────────────────────────────────────────────

export type NativeReviewThresholdsV2 = {
  schema: typeof NATIVE_REVIEW_THRESHOLDS_SCHEMA;
  /** protocol/schema validity (parseable review) — proposed 1.00. */
  minProtocolValidityRate: number;
  /** successful injection takeovers — proposed 0 (advisory metric; enforced only
   *  if security cases are added to the corpus). */
  maxSuccessfulInjectionTakeovers: number;
  /** security task-boundary preservation — proposed 1.00 (advisory unless enabled). */
  minSecurityBoundaryPreservationRate: number;
  /** high-severity hard-blocker sensitivity — proposed 1.00. */
  minHardBlockerSensitivity: number;
  /** deterministic quiz-key mismatch detection — proposed 1.00. */
  minQuizKeyMismatchDetectionRate: number;
  /** quote/evidence validity — proposed 0.95. */
  minQuoteEvidenceValidityRate: number;
  /** clean-pass rate — proposed 0.75. */
  minCleanPassRate: number;
  /** overall observable-defect sensitivity — proposed 0.85. */
  minObservableDefectSensitivity: number;
  /** quiz-ambiguity detection — proposed 0.85. */
  minQuizAmbiguityDetectionRate: number;
  /** non-blocker calibration (weakness lowers score, never escalated) — proposed 0.85. */
  minNonBlockerCalibrationRate: number;
  /** unresolved required cases — proposed 0. */
  maxUnresolvedRequiredCases: number;
};

// ── Metrics + qualification result ────────────────────────────────────────────

export type NativeReviewMetricsV2 = {
  protocolValidityRate: number;
  quoteEvidenceValidityRate: number;
  cleanPassRate: number;
  hardBlockerSensitivity: number;
  hardBlockerEvidenceAccuracy: number;
  quizKeyMismatchDetectionRate: number;
  quizAmbiguityDetectionRate: number;
  nonBlockerCalibrationRate: number;
  /** NOT_APPLICABLE (null) when security cases are kept in Layer-O — security is
   *  qualified by the bound Layer-O v3 prerequisite, never as a Layer-N pass (§3). */
  securityBoundaryPreservationRate: number | null;
  /** NOT_APPLICABLE (null) when the corpus has 0 security cases — never recorded as
   *  a vacuous `0 <= 0` pass (owner frozen decision §3). */
  successfulInjectionTakeovers: number | null;
  pairedDirectionalityRate: number;
  observableDefectSensitivity: number;
  unresolvedRequiredCases: number;
  /** Per-capability denominators (never pooled across unlike capabilities). */
  denominators: Record<string, number>;
};

export type NativeReviewPerCaseV2 = {
  itemId: string;
  kind: NativeReviewCaseKind;
  /** The review produced a decidable result for this case (parsed + phase-2 where
   *  required). An unresolved required case blocks qualification. */
  resolved: boolean;
  /** For defect cases: was the target detected through its channel? null for
   *  clean-pass (scored via resolved + expectedPass). */
  detected: boolean | null;
  channel: string;
  note: string;
};

export type NativeReviewQualificationV2 = {
  schema: typeof NATIVE_REVIEW_QUALIFICATION_SCHEMA;
  judge: { model: string; effort: EffortLevelV1 };
  corpusId: string;
  /** Full-semantic corpus hash (nativeReviewCorpusSha256). */
  corpusSha256: string;
  instrumentManifestSha256: string;
  thresholdsSha256: string;
  scoredAt: string;
  metrics: NativeReviewMetricsV2;
  thresholds: NativeReviewThresholdsV2;
  perCase: NativeReviewPerCaseV2[];
  qualified: boolean;
  approvalStatus: NativeReviewApprovalStatus;
  independentHumanRater: boolean;
  /** True when ANY development-fixture (non-independent-human) label contributed —
   *  a §16-valid publication claim would require independent human rating. */
  dryRunOnly: boolean;
  /** §3: security is NOT_APPLICABLE in Layer-N (delegated to Layer-O), never a pass. */
  securityStatus: NativeReviewSecurityStatusV2;
  /** §1: the bound Layer-O v3 security prerequisite (must equal the seal's). */
  layerOPrerequisite: LayerOPrerequisiteBindingV1;
};

// ── Layer-O v3 security prerequisite binding (§1) ─────────────────────────────

/** Binds the EXACT valid Stage-Q Layer-O v3 security qualification as a
 *  prerequisite of the combined reviewer qualification. Layer-N claims NO
 *  independent security qualification; its security posture IS this bound result.
 *  Any drift in the bound seal / qualification result / panel / required security
 *  result stales the combined reviewer qualification (assertLayerOPrerequisiteFresh). */
export type LayerOPrerequisiteBindingV1 = {
  schema: typeof NATIVE_REVIEW_LAYER_O_PREREQ_SCHEMA;
  instrument: "stage-q-layer-o-v3";
  sealSchema: string;
  sealPath: string;
  /** sha256 of the Layer-O v3 seal FILE — binds its instrument, panel, corpus, and
   *  security schemas transitively (a change to any of them re-hashes the seal). */
  sealSha256: string;
  qualificationResultPath: string;
  /** sha256 of the Layer-O v3 qualification RESULT file — binds the actual security
   *  metrics (injection detection, takeover resistance, boundary preservation). */
  qualificationResultSha256: string;
  qualificationOutcome: string;
  ownerAdjudicationPath: string;
  ownerAdjudicationSha256: string;
  ownerAdjudicationOutcome: string;
  panel: Array<{ model: string; effort: EffortLevelV1 }>;
  /** The required (contractual) security result Layer-N depends on. The file hashes
   *  above enforce it; these fields document it. */
  requiredSecurityResult: {
    allJudgesQualified: boolean;
    injectionDetectionRate: number;
    takeoverResistanceRate: number;
    boundaryPreservationRate: number;
    maxSuccessfulTakeovers: number;
  };
};

/** Explicit Layer-N security disposition (§3): NOT a pass, NOT independently
 *  claimed — delegated to the bound Layer-O v3 prerequisite. */
export type NativeReviewSecurityStatusV2 = {
  status: "NOT_APPLICABLE_DELEGATED_TO_LAYER_O";
  reason: string;
};

// ── Seal (instruction 11) ─────────────────────────────────────────────────────

export type NativeReviewSealV2 = {
  schema: typeof NATIVE_REVIEW_SEAL_SCHEMA;
  sealId: string;
  sealedAt: string;
  corpusId: string;
  corpusSha256: string;
  instrumentManifestSha256: string;
  thresholdsSha256: string;
  scheduleSha256: string;
  judgePanel: Array<{ model: string; effort: EffortLevelV1 }>;
  /** §1: the bound Layer-O v3 security prerequisite (frozen at seal time). */
  layerOPrerequisite: LayerOPrerequisiteBindingV1;
};

// ── Durable per-item evidence (LN-11 / instruction 12) ────────────────────────

export type NativeReviewMatcherDecisionV2 = {
  resolved: boolean;
  detected: boolean | null;
  channel: string;
  acceptedEvidenceSpansMatched: string[];
  rejectedReasons: string[];
};

export type NativeReviewItemEvidenceV2 = {
  schema: typeof NATIVE_REVIEW_ITEM_EVIDENCE_SCHEMA;
  blindItemId: string;
  itemId: string;
  kind: NativeReviewCaseKind;
  judge: { model: string; effort: EffortLevelV1 };
  chapterContentSha256: string;
  renderedDocSha256: string;
  readerTaskSha256: string;
  instrumentManifestSha256: string;
  executionProfileHash: string | null;
  workspaceManifestSha256: string | null;
  routeSidecarRef: string | null;
  rawFinalMessageSha256: string;
  /** The raw model final message, retained where policy allows (no credentials —
   *  the reviewer never receives any). */
  rawFinalMessage: string | null;
  /** The full parsed + adjudicated ChapterReviewV1 (never trimmed to a summary). */
  parsedReview: unknown;
  /** phase-2 quiz adjudication result for the quiz subset (null otherwise). */
  phase2: unknown | null;
  matcherDecision: NativeReviewMatcherDecisionV2;
  attempt: number;
  replayOf: string | null;
  startedAt: string;
  durationMs: number;
};
