/**
 * s16-forward-pilot-role-readiness-v1 — the development-only role-readiness
 * instrument (plan v2 P3; IMP-24G Phase 5 adopted with the D9 re-scope; design
 * record: docs/v25/reports/V25_P3_READINESS_INSTRUMENT_DESIGN.md).
 *
 * Objective PILOT_ROLE_READINESS: practical future-content readiness for the
 * fresh SOL pilot — never publication certification, never a historical
 * model-comparison claim. Everything here is MODEL-FREE: deterministic corpus
 * selection (create-once), the §5.5 thresholds verbatim, the frozen §5.6
 * candidate orders + stopping, the §5.7 budget arithmetic, and the plan
 * builder that binds the then-current candidate instrument at campaign launch.
 * Live execution (plan v2 P5) reuses the V3 runner discipline.
 *
 * D9 re-scope (owner-ratified): corpus labels are `pipeline-internal`; the
 * three owner-rubric-audited chapters are EXCLUDED from acceptable controls
 * (they scored 67.7–70.8 on the owner bar and are reserved as sealed craft
 * ground truth) — an "acceptable control" here anchors the reader lane's
 * internal construct (0 blockers + composite >= 80), not the owner bar.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { hashCanonical, sha256Hex } from "../../contracts/contractUtil.js";
import { canonicalPretty } from "./corpusBuilderCore.js";
import { writeFileAtomic } from "../../lib/atomicWrite.js";
import {
  READER_GOLD_DEV_POOL_MANIFEST_REL_PATH,
  validateReaderGoldDevPoolSelectionManifest,
  type ReaderGoldDevPoolSelectionManifestV1,
} from "./readerGoldDevPool.js";

const PIPELINE_REL = "scripts/book/prompts/chapterflow-v24-author-pipeline";

export const PILOT_ROLE_READINESS_EXPERIMENT_ID = "s16-forward-pilot-role-readiness-v1" as const;
export const PILOT_ROLE_READINESS_OBJECTIVE = "PILOT_ROLE_READINESS" as const;
export const PILOT_ROLE_READINESS_DIR_REL_PATH =
  `${PIPELINE_REL}/state/migration-experiments/pilot-role-readiness-v1` as const;
export const PILOT_ROLE_READINESS_CORPUS_SCHEMA = "pilot-role-readiness-corpus-v1" as const;
export const PILOT_ROLE_READINESS_PLAN_SCHEMA = "pilot-role-readiness-plan-v1" as const;

/** v2 successor identity (owner directive "Proceed with A", 2026-07-15): the
 * v1 campaign is CLOSED (BLOCKED_ROLE_READINESS @ 36 calls, evidence branch
 * 2af264d43); v2 = v1 corpus selection + the three owner-authorized canary
 * gold adjudications below. The imp24 bundle stays byte-immutable — every
 * correction lives in this readiness-level overlay. */
export const PILOT_ROLE_READINESS_V2_EXPERIMENT_ID = "s16-forward-pilot-role-readiness-v2" as const;
export const PILOT_ROLE_READINESS_V2_DIR_REL_PATH =
  `${PIPELINE_REL}/state/migration-experiments/pilot-role-readiness-v2` as const;
export const PILOT_ROLE_READINESS_V2_CORPUS_SCHEMA = "pilot-role-readiness-corpus-v2" as const;
export const PILOT_ROLE_READINESS_V2_PLAN_SCHEMA = "pilot-role-readiness-plan-v2" as const;

/** v3 successor identity (owner directive "proceed and continue the same
 * way", 2026-07-16 = Option B + fresh <=84/168 envelope): v2 closed BLOCKED
 * at the exact ceiling with reader sol@xhigh QUALIFIED; v3 = v2 + the ONE
 * craft-map widening below. */
export const PILOT_ROLE_READINESS_V3_EXPERIMENT_ID = "s16-forward-pilot-role-readiness-v3" as const;
export const PILOT_ROLE_READINESS_V3_DIR_REL_PATH =
  `${PIPELINE_REL}/state/migration-experiments/pilot-role-readiness-v3` as const;
export const PILOT_ROLE_READINESS_V3_CORPUS_SCHEMA = "pilot-role-readiness-corpus-v3" as const;
export const PILOT_ROLE_READINESS_V3_PLAN_SCHEMA = "pilot-role-readiness-plan-v3" as const;

/** Option B ruling (owner-authorized): craft weakness->category acceptance
 * map v2. ONE change vs v1: `pacing` also accepts `density` — the schema's
 * closest adjacent label for information-rate/flow weaknesses (both v2
 * gpt-5.5 profiles emitted adjacent labels on the pacing case). Universal
 * `other_craft` acceptance was CONSIDERED AND REJECTED: it would make
 * craftCategoryDetected trivially passable for advisory-spamming reviewers.
 * Prospective-only: applies to the v3 identity, never retroactively. */
export const READINESS_CRAFT_WEAKNESS_ACCEPTED_CATEGORIES_V2: Readonly<Record<string, readonly string[]>> =
  Object.freeze({
    weak_transition: Object.freeze(["pacing", "other_craft"]),
    thin_explanation: Object.freeze(["thin_example", "other_craft"]),
    tone: Object.freeze(["tone"]),
    pacing: Object.freeze(["pacing", "density"]),
  });

/** Canary-gold adjudication record (owner: "Proceed with A"). Basis for each
 * ruling: unanimous model divergence across TWO independent campaigns (this
 * run 4/4 profiles + the archived IMP-24 attempts) on a single secondary
 * field per case, with the VERDICT correct everywhere; full evidence in
 * docs/v25/reports/V25_P5_READINESS_CAMPAIGN_RESULT_AND_CANARY_ADJUDICATION.md.
 * Scope limits: craft weakness->category map UNCHANGED, semantic-rules text
 * UNCHANGED, holdout hard-blocker gold UNCHANGED (Option B not exercised). */
export const READINESS_CANARY_GOLD_ADJUDICATIONS_V1 = Object.freeze({
  schema: "pilot-readiness-canary-gold-adjudications-v1",
  ownerDirective: "Proceed with A (2026-07-15)",
  reader: Object.freeze({
    caseId: "READER-V3-CANARY-reader-visible-hard-blocker-make-it-stick-ch02",
    field: "expectedBlockingCategory",
    bundleValue: "unusable",
    acceptedBlockingCategories: Object.freeze(["unusable", "internal_contradiction"]),
    rationale: "The /tryThisNow mutation is simultaneously operationally vacuous (unusable) and contradicts the chapter's retrieval-with-feedback teaching (internal_contradiction); both categories identify the one planted defect.",
  }),
  source: Object.freeze({
    caseId: "SOURCE-V3-CANARY-source-bound-detail-ch01-fact-1-defect",
    adjudicatedSupportStatus: "PARTIALLY_SUPPORTED",
    bundleSupportStatus: "UNSUPPORTED",
    adjudicatedVisibleRegister: "clearly_sourced",
    bundleVisibleRegister: "presented_as_fact",
    acceptedPrimaryCategories: Object.freeze(["unsupported_attribution", "invented_detail"]),
    bundlePrimaryCategory: "invented_detail",
    rationale: "The unit contains one source-backed claim plus one invented claim under explicit 'the source states/reports' attribution: whole-unit support is PARTIALLY_SUPPORTED, the surface register is clearly_sourced, and the written category precedence makes unsupported_attribution the controlling label (both coherent applications accepted).",
  }),
  quiz: Object.freeze({
    kind: "key-mismatch",
    field: "keyedMechanismSupported",
    ruling: "excluded-from-semantic-comparison",
    rationale: "The rule's two prongs ('true for an item that makes no mechanism claim' vs 'false when the key asserts an unsupported mechanism') collide exactly on wrong-key non-mechanism items; 5/5 model attempts across two campaigns resolved the collision opposite to gold. The key-mismatch construct is BLOCK + keyCorrect=wrong; the underdetermined field no longer gates it. Mechanism-item gold is untouched and no holdout metric reads this field on key-mismatch cases.",
  }),
});

/** Immutable inputs (raw-byte pins — any drift fails closed). */
export const IMP24_V3_BUNDLE_REL_PATH =
  `${PIPELINE_REL}/state/migration-experiments/contracts/imp24/role-qualification-corpus-bundle.v3-envelope.json` as const;
export const IMP24_V3_BUNDLE_RAW_SHA256 =
  "666b8b55e06336f254cb7a6e0c3dc140badedc32d0d0f203c3963fcbe24ff46a" as const;
export const READER_CONTROLS_REL_PATH =
  `${PIPELINE_REL}/state/migration-experiments/reader-gold-dev-pool-v1/reader-acceptable-controls.v1.json` as const;
export const READER_CONTROLS_RAW_SHA256 =
  "86bb2eb05544a4b1c233f84929b3c358b781a8462f16c60a588c76ce8d5e121f" as const;
export const READER_CONTROLS_SHA256 =
  "f3b3a85e47365db8ab7722cef0caebfcd5fee4387a85ec24ee49f41e392fbcc8" as const;

/** D9: owner-rubric-audited controls (67.7–70.8 on the owner bar, sealed run
 *  docs/v25/rubric-audit-2026-07-15) — never acceptable-control anchors. */
export const OWNER_AUDITED_CONTROL_DOCS: readonly string[] = [
  "made-to-stick-ch04.md",
  "the-happiness-hypothesis-ch06.md",
  "nudge-ch03.md",
];

export const CANDIDATE_INSTRUMENT_SEAL_REL_PATH =
  `${PIPELINE_REL}/state/migration-experiments/contracts/imp24f/forward-production-instrument-seal.json` as const;
export const CANDIDATE_INSTRUMENT_CERT_REL_PATH =
  `${PIPELINE_REL}/state/migration-experiments/contracts/imp24f/instrument-certification-binding.json` as const;

export class PilotRoleReadinessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PilotRoleReadinessError";
  }
}

function requireCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new PilotRoleReadinessError(message);
}

// ── §5.5 thresholds (verbatim counts; never weakened) ────────────────────────

export type ReadinessCountBar = { min: number; of: number; zeroMiss: boolean };

export const PILOT_READINESS_THRESHOLDS = {
  schema: "pilot-role-readiness-thresholds-v1",
  source_of_truth: "IMP-24G §5.5 (development pilot-readiness thresholds, not rare-event production certification; no true hard blocker weakened)",
  reader: {
    protocolValidity: { min: 12, of: 12, zeroMiss: true },
    canarySemanticCorrectness: { min: 2, of: 2, zeroMiss: true },
    hardBlockerSensitivity: { min: 4, of: 4, zeroMiss: true },
    falseReaderBlockersOnAcceptableAndCraft: { min: 8, of: 8, zeroMiss: true },
    acceptableControlSuccess: { min: 3, of: 4, zeroMiss: false },
    craftCategoryDetected: { min: 3, of: 4, zeroMiss: false },
    requiredCasesResolved: { min: 12, of: 12, zeroMiss: true },
  },
  source: {
    protocolValidity: { min: 12, of: 12, zeroMiss: true },
    canarySemanticCorrectness: { min: 2, of: 2, zeroMiss: true },
    highSeverityDefectSensitivity: { min: 10, of: 10, zeroMiss: true },
    falseHighSeverityBlockerFreeOnClean: { min: 2, of: 2, zeroMiss: true },
    supportRegisterAccuracy: { min: 10, of: 12, zeroMiss: false },
    requiredCasesResolved: { min: 12, of: 12, zeroMiss: true },
    missingEvidenceInconclusive: { min: 1, of: 1, zeroMiss: true },
  },
  quiz: {
    protocolValidity: { min: 12, of: 12, zeroMiss: true },
    canarySemanticCorrectness: { min: 2, of: 2, zeroMiss: true },
    wrongKeyDetection: { min: 3, of: 3, zeroMiss: true },
    cleanUniqueAnswerSuccess: { min: 2, of: 3, zeroMiss: false },
    ambiguityDetection: { min: 2, of: 3, zeroMiss: false },
    mechanismAccuracy: { min: 2, of: 3, zeroMiss: false },
    requiredCasesResolved: { min: 12, of: 12, zeroMiss: true },
  },
} as const;

/** §2.5 metric semantics under reader-decision-policy-v3 (D1). */
export const PILOT_READINESS_METRIC_SEMANTICS = {
  acceptableControlSuccess: "reader decision PASS and zero blocking findings and composite >= 80 (advisory detection never fails an acceptable control)",
  craftCaseSuccess: "the required advisory category is detected with valid evidence and zero blocking findings",
  hardBlockerCaseSuccess: "the required reader blocker is detected with valid evidence",
} as const;

// ── §5.6 candidate orders + stopping; §5.7 budget; D6 probe ──────────────────

export type ReadinessProfile = { profileId: string; model: string; effort: string };

function profile(model: string, effort: string): ReadinessProfile {
  return { profileId: `${model}@${effort}`, model, effort };
}

/** Frozen qualifying orders — availability may skip an entry, never reorder. */
export const PILOT_READINESS_CANDIDATE_ORDERS = {
  reader: [profile("gpt-5.6-sol", "high"), profile("gpt-5.5", "high"), profile("gpt-5.6-sol", "xhigh"), profile("gpt-5.5", "xhigh")],
  source: [profile("gpt-5.6-sol", "xhigh"), profile("gpt-5.5", "xhigh"), profile("gpt-5.6-sol", "high"), profile("gpt-5.5", "high")],
  quiz: [profile("gpt-5.6-sol", "xhigh"), profile("gpt-5.5", "xhigh"), profile("gpt-5.6-sol", "high"), profile("gpt-5.5", "high")],
} as const;

export const PILOT_READINESS_STOPPING = { reader: 2, source: 2, quiz: 1 } as const;

export const PILOT_READINESS_BUDGET = {
  schema: "pilot-role-readiness-budget-v1",
  canaryCallsPerProfileRole: 2,
  holdoutCallsPerRole: 12,
  /** 24 canaries (4 profiles × 2 × 3 roles) + stop-set holdouts (reader 2×12 +
   *  source 2×12 + quiz 1×12) = 84. The maximum is not a target. */
  baseMaximumCalls: 84,
  /** One typed infrastructure replay per attempted call; never for judgment,
   *  score, protocol error, refusal, evidence-reference error, or content
   *  disagreement. */
  hardMaximumCalls: 168,
} as const;

/** D6 — Terra/Luna cost-candidate probes: post-ready, budgeted, non-qualifying,
 *  never reordering the frozen qualifying order. */
export const PILOT_READINESS_COST_PROBE = {
  schema: "pilot-role-readiness-cost-probe-v1",
  label: "COST_CANDIDATE_PROBE",
  nonQualifying: true,
  runsOnlyAfter: "PILOT_ROLE_SET_READY",
  profiles: [
    profile("gpt-5.6-terra", "medium"), profile("gpt-5.6-terra", "high"), profile("gpt-5.6-terra", "xhigh"),
    profile("gpt-5.6-luna", "high"), profile("gpt-5.6-luna", "xhigh"),
  ],
  readerBaseMaximumCalls: 70,
  maxShortlistedProfiles: 2,
  shortlistedExtensionMaximumCalls: 56,
  selectionRule: "quality-first: all floors met -> higher semantic metrics win -> within tolerance (<=1 holdout case delta, identical zero-miss record) the cheaper profile may take the role; any swap happens before the pilot role freeze or not at all",
} as const;

export const PILOT_READINESS_TERMINAL_STATES = ["PILOT_ROLE_SET_READY", "BLOCKED_ROLE_READINESS"] as const;

// ── Corpus selection (deterministic; model-free) ─────────────────────────────

type BundleCase = Record<string, unknown> & {
  caseId: string;
  kind?: string;
  family?: string;
  pairSide?: string;
  partition: string;
  substantiveCaseSha256?: string;
  expected?: Record<string, unknown>;
};

type RoleCorpus = { canary: { cases: BundleCase[] }; holdout: { cases: BundleCase[] } };

type Imp24Bundle = {
  schema: string;
  substantiveBundleSha256: string;
  reader: RoleCorpus;
  source: RoleCorpus;
  quiz: RoleCorpus;
};

export type ReadinessCaseV1 = {
  caseId: string;
  role: "reader" | "source" | "quiz";
  partition: "canary" | "holdout";
  category: string;
  origin:
    | { source: "imp24-v3-bundle"; caseId: string; substantiveCaseSha256: string }
    | {
        source: "reader-acceptable-controls-v1";
        doc: string;
        readerDocumentSha256: string;
        agreedComposite: number;
        packagePath: string;
        packageBytesSha256: string;
      };
  /** The full frozen case payload (bundle cases verbatim; control cases carry
   *  the loaded chapter + gold). Self-contained — live execution never re-reads
   *  the inputs this was selected from. */
  payload: Record<string, unknown>;
  caseSha256: string;
};

export type PilotRoleReadinessCorpusV1 = {
  schema: typeof PILOT_ROLE_READINESS_CORPUS_SCHEMA;
  experimentId: typeof PILOT_ROLE_READINESS_EXPERIMENT_ID;
  objective: typeof PILOT_ROLE_READINESS_OBJECTIVE;
  labels: {
    readinessScope: "pipeline-internal";
    ownerApprovedForDevelopmentBakeoff: true;
    independentHumanRater: false;
    publicationCertification: false;
    candidateOutputsUsedForLabels: false;
  };
  inputs: {
    imp24BundleRawSha256: string;
    imp24SubstantiveBundleSha256: string;
    readerControlsRawSha256: string;
    readerControlsSha256: string;
    poolSelectionSha256: string;
  };
  excludedOwnerAuditedControls: {
    docs: readonly string[];
    reason: string;
  };
  reader: { canary: ReadinessCaseV1[]; holdout: ReadinessCaseV1[] };
  source: { canary: ReadinessCaseV1[]; holdout: ReadinessCaseV1[] };
  quiz: { canary: ReadinessCaseV1[]; holdout: ReadinessCaseV1[] };
  corpusSha256: string;
};

function readPinned(repositoryRoot: string, relPath: string, expectedSha256: string, label: string): string {
  const bytes = readFileSync(resolve(repositoryRoot, relPath));
  requireCondition(sha256Hex(bytes) === expectedSha256,
    `${label} drifted from the pinned bytes (${relPath}) — the readiness corpus selects from FROZEN inputs only`);
  return bytes.toString("utf8");
}

function bundleCase(raw: BundleCase, role: ReadinessCaseV1["role"], partition: ReadinessCaseV1["partition"], category: string): ReadinessCaseV1 {
  requireCondition(typeof raw.substantiveCaseSha256 === "string" && raw.substantiveCaseSha256.length > 0,
    `bundle case ${raw.caseId} has no substantive hash`);
  return {
    caseId: `RDY-${raw.caseId}`,
    role,
    partition,
    category,
    origin: { source: "imp24-v3-bundle", caseId: raw.caseId, substantiveCaseSha256: raw.substantiveCaseSha256 },
    payload: raw,
    caseSha256: hashCanonical(raw),
  };
}

/** First case per category (in listed category order), walking the frozen
 *  bundle order; then, if more are needed, the next unpicked cases in bundle
 *  order. Pure and deterministic. */
function pickByCategories(cases: BundleCase[], categoryOf: (c: BundleCase) => string, categories: readonly string[], perCategory: number): BundleCase[] {
  const picked: BundleCase[] = [];
  const pickedIds = new Set<string>();
  for (const category of categories) {
    let taken = 0;
    for (const candidate of cases) {
      if (taken >= perCategory) break;
      if (pickedIds.has(candidate.caseId) || categoryOf(candidate) !== category) continue;
      picked.push(candidate);
      pickedIds.add(candidate.caseId);
      taken += 1;
    }
    requireCondition(taken === perCategory,
      `frozen bundle has fewer than ${perCategory} case(s) of category '${category}'`);
  }
  return picked;
}

type ControlEntry = { doc: string; readerDocumentSha256: string; agreedComposite: number };

function controlBookId(doc: string): { bookId: string; chapterNumber: number } {
  const match = /^(.+)-ch(\d{2})\.md$/.exec(doc);
  requireCondition(match !== null, `unparseable control doc name: ${doc}`);
  return { bookId: match[1], chapterNumber: Number(match[2]) };
}

/** D9 acceptable-control selection: frozen controls order, skip the three
 *  owner-audited docs, take the first 4 with at most 2 per book (holdouts);
 *  the canary control is the next eligible after the holdout picks. */
export function selectAcceptableControls(controls: ControlEntry[]): { holdout: ControlEntry[]; canary: ControlEntry } {
  const excluded = new Set(OWNER_AUDITED_CONTROL_DOCS);
  const perBook = new Map<string, number>();
  const holdout: ControlEntry[] = [];
  let canary: ControlEntry | undefined;
  for (const control of controls) {
    if (excluded.has(control.doc)) continue;
    const { bookId } = controlBookId(control.doc);
    if (holdout.length < 4) {
      if ((perBook.get(bookId) ?? 0) >= 2) continue;
      holdout.push(control);
      perBook.set(bookId, (perBook.get(bookId) ?? 0) + 1);
    } else {
      canary = control;
      break;
    }
  }
  requireCondition(holdout.length === 4 && canary !== undefined,
    "controls pool cannot satisfy 4 acceptable holdouts + 1 canary under the D9 exclusion");
  return { holdout, canary };
}

function acceptableCase(
  repositoryRoot: string,
  control: ControlEntry,
  partition: ReadinessCaseV1["partition"],
  pool: ReaderGoldDevPoolSelectionManifestV1,
): ReadinessCaseV1 {
  const { bookId, chapterNumber } = controlBookId(control.doc);
  const poolBook = pool.books.find((entry) => entry.bookId === bookId);
  requireCondition(poolBook !== undefined, `control book ${bookId} missing from the frozen pool selection`);
  const packageBytes = readFileSync(resolve(repositoryRoot, poolBook.packagePath));
  requireCondition(sha256Hex(packageBytes) === poolBook.packageBytesSha256,
    `package bytes drifted since the frozen pool selection: ${poolBook.packagePath}`);
  const parsed = JSON.parse(packageBytes.toString("utf8")) as { chapters: Array<Record<string, unknown> & { number: number }> };
  const chapter = parsed.chapters.find((entry) => entry.number === chapterNumber);
  requireCondition(chapter !== undefined, `control chapter ${control.doc} missing from its package`);
  const payload: Record<string, unknown> = {
    caseId: `READER-RDY-${partition.toUpperCase()}-acceptable-${bookId}-ch${String(chapterNumber).padStart(2, "0")}`,
    role: "reader",
    kind: "acceptable-control",
    partition,
    baseBookId: bookId,
    baseChapter: chapterNumber,
    chapter,
    expected: {
      expectedRecommendation: "SHIP",
      prohibitBlockingFindings: true,
      readerAuthorityOnly: true,
      minComposite: 80,
      policy: "reader-decision-policy-v3",
    },
    adjudication: {
      controlsSha256: READER_CONTROLS_SHA256,
      agreedComposite: control.agreedComposite,
      readerDocumentSha256: control.readerDocumentSha256,
      independentHumanRater: false,
      readinessScope: "pipeline-internal",
    },
  };
  return {
    caseId: String(payload.caseId),
    role: "reader",
    partition,
    category: "acceptable-control",
    origin: {
      source: "reader-acceptable-controls-v1",
      doc: control.doc,
      readerDocumentSha256: control.readerDocumentSha256,
      agreedComposite: control.agreedComposite,
      packagePath: poolBook.packagePath,
      packageBytesSha256: poolBook.packageBytesSha256,
    },
    payload,
    caseSha256: hashCanonical(payload),
  };
}

const READER_HARD_BLOCKER_CATEGORY_ORDER = ["internal_contradiction", "unsafe", "unusable"] as const;
const SOURCE_FAMILY_MIX: ReadonlyArray<[string, number]> = [
  ["supported-source-bound", 2],
  ["unsupported-invented", 2],
  ["unframed-constructed", 2],
  ["generic-historical-specificity", 2],
  ["causal-overreach", 2],
  ["unsupported-or-contradicted-attribution", 2],
];
const QUIZ_KIND_MIX: ReadonlyArray<[string, number]> = [
  ["uniquely-correct-clean", 3],
  ["key-mismatch", 3],
  ["genuine-ambiguity", 3],
  ["mechanism-causal-key", 3],
];

export function buildPilotRoleReadinessCorpus(args: { repositoryRoot: string }): PilotRoleReadinessCorpusV1 {
  const repositoryRoot = resolve(args.repositoryRoot);
  const bundle = JSON.parse(
    readPinned(repositoryRoot, IMP24_V3_BUNDLE_REL_PATH, IMP24_V3_BUNDLE_RAW_SHA256, "imp24 v3 corpus bundle"),
  ) as Imp24Bundle;
  const controlsFile = JSON.parse(
    readPinned(repositoryRoot, READER_CONTROLS_REL_PATH, READER_CONTROLS_RAW_SHA256, "reader acceptable controls"),
  ) as { controlsSha256: string; controls: ControlEntry[] };
  requireCondition(controlsFile.controlsSha256 === READER_CONTROLS_SHA256, "controls internal hash mismatch");
  const poolRaw = readFileSync(resolve(repositoryRoot, READER_GOLD_DEV_POOL_MANIFEST_REL_PATH), "utf8");
  const pool = JSON.parse(poolRaw) as ReaderGoldDevPoolSelectionManifestV1;
  const poolIssues = validateReaderGoldDevPoolSelectionManifest(pool);
  requireCondition(poolIssues.length === 0, `frozen pool selection invalid: ${poolIssues.join("; ")}`);

  // Reader: 4 acceptable (new pool, D9 exclusion) + 4 hard blockers + 4 craft.
  const acceptable = selectAcceptableControls(controlsFile.controls);
  const readerHoldoutPool = bundle.reader.holdout.cases;
  const hardBlockers = pickByCategories(
    readerHoldoutPool.filter((entry) => entry.kind === "reader-visible-hard-blocker"),
    (entry) => String((entry.expected ?? {}).expectedBlockingCategory ?? ""),
    READER_HARD_BLOCKER_CATEGORY_ORDER, 1,
  );
  // 4th hard blocker: next unpicked in bundle order (category coverage first).
  const pickedHardIds = new Set(hardBlockers.map((entry) => entry.caseId));
  const fourthHard = readerHoldoutPool.find(
    (entry) => entry.kind === "reader-visible-hard-blocker" && !pickedHardIds.has(entry.caseId));
  requireCondition(fourthHard !== undefined, "bundle has no fourth reader hard-blocker case");
  hardBlockers.push(fourthHard);
  const craftPool = readerHoldoutPool.filter((entry) => entry.kind === "craft-nonblocker");
  const craft: BundleCase[] = [];
  const craftWeaknesses = new Set<string>();
  for (const entry of craftPool) {
    if (craft.length >= 4) break;
    const weakness = String((entry.expected ?? {}).expectedWeakness ?? "");
    if (craftWeaknesses.has(weakness)) continue;
    craftWeaknesses.add(weakness);
    craft.push(entry);
  }
  requireCondition(craft.length === 4, "bundle has fewer than 4 distinct craft weaknesses");
  const readerCanaryHardBlocker = bundle.reader.canary.cases.find((entry) => entry.kind === "reader-visible-hard-blocker");
  requireCondition(readerCanaryHardBlocker !== undefined, "bundle reader canary hard blocker missing");

  // Source: §5.3 mix, first N per family in bundle order; bundle canaries.
  const sourceHoldout = SOURCE_FAMILY_MIX.flatMap(([family, count]) =>
    pickByCategories(bundle.source.holdout.cases, (entry) => String(entry.family ?? ""), [family], count)
      .map((entry) => bundleCase(entry, "source", "holdout", family)));
  const sourceCanaries = bundle.source.canary.cases.map((entry) =>
    bundleCase(entry, "source", "canary", String(entry.family ?? "")));
  requireCondition(sourceCanaries.length === 2, "bundle must carry exactly 2 source canaries");

  // Quiz: §5.4 mix; bundle canaries. The old quiz qualification is not carried.
  const quizHoldout = QUIZ_KIND_MIX.flatMap(([kind, count]) =>
    pickByCategories(bundle.quiz.holdout.cases, (entry) => String(entry.kind ?? ""), [kind], count)
      .map((entry) => bundleCase(entry, "quiz", "holdout", kind)));
  const quizCanaries = bundle.quiz.canary.cases.map((entry) =>
    bundleCase(entry, "quiz", "canary", String(entry.kind ?? "")));
  requireCondition(quizCanaries.length === 2, "bundle must carry exactly 2 quiz canaries");

  const reader = {
    canary: [
      acceptableCase(repositoryRoot, acceptable.canary, "canary", pool),
      bundleCase(readerCanaryHardBlocker, "reader", "canary", "reader-visible-hard-blocker"),
    ],
    holdout: [
      ...acceptable.holdout.map((control) => acceptableCase(repositoryRoot, control, "holdout", pool)),
      ...hardBlockers.map((entry) => bundleCase(entry, "reader", "holdout", "reader-visible-hard-blocker")),
      ...craft.map((entry) => bundleCase(entry, "reader", "holdout", "craft-nonblocker")),
    ],
  };
  requireCondition(reader.holdout.length === 12 && reader.canary.length === 2, "reader corpus counts drifted");
  requireCondition(sourceHoldout.length === 12 && quizHoldout.length === 12, "source/quiz corpus counts drifted");

  // Canaries must be disjoint from holdouts (IMP-24G §5.2-§5.4).
  for (const role of [reader, { canary: sourceCanaries, holdout: sourceHoldout }, { canary: quizCanaries, holdout: quizHoldout }]) {
    const holdoutIds = new Set(role.holdout.map((entry) => entry.caseId));
    for (const canary of role.canary) {
      requireCondition(!holdoutIds.has(canary.caseId), `canary ${canary.caseId} overlaps the holdout set`);
    }
  }

  const core: Omit<PilotRoleReadinessCorpusV1, "corpusSha256"> = {
    schema: PILOT_ROLE_READINESS_CORPUS_SCHEMA,
    experimentId: PILOT_ROLE_READINESS_EXPERIMENT_ID,
    objective: PILOT_ROLE_READINESS_OBJECTIVE,
    labels: {
      readinessScope: "pipeline-internal",
      ownerApprovedForDevelopmentBakeoff: true,
      independentHumanRater: false,
      publicationCertification: false,
      candidateOutputsUsedForLabels: false,
    },
    inputs: {
      imp24BundleRawSha256: IMP24_V3_BUNDLE_RAW_SHA256,
      imp24SubstantiveBundleSha256: bundle.substantiveBundleSha256,
      readerControlsRawSha256: READER_CONTROLS_RAW_SHA256,
      readerControlsSha256: READER_CONTROLS_SHA256,
      poolSelectionSha256: pool.selectionSha256,
    },
    excludedOwnerAuditedControls: {
      docs: OWNER_AUDITED_CONTROL_DOCS,
      reason: "D9: owner rubric-v2 audit (sealed run 20260715T110908Z) scored these 67.7-70.8 — reserved as craft ground truth, never acceptable anchors",
    },
    reader,
    source: { canary: sourceCanaries, holdout: sourceHoldout },
    quiz: { canary: quizCanaries, holdout: quizHoldout },
  };
  return { ...core, corpusSha256: hashCanonical(core) };
}

// ── v2 corpus (v1 selection + owner-adjudicated canary gold overlay) ─────────

export type PilotRoleReadinessCorpusV2 = Omit<PilotRoleReadinessCorpusV1, "schema" | "experimentId"> & {
  schema: typeof PILOT_ROLE_READINESS_V2_CORPUS_SCHEMA;
  experimentId: typeof PILOT_ROLE_READINESS_V2_EXPERIMENT_ID;
  goldAdjudications: typeof READINESS_CANARY_GOLD_ADJUDICATIONS_V1;
};

/** v2 = the byte-stable v1 selection re-identified under the successor id
 * with the frozen adjudication record embedded (hash-bound into corpusSha256,
 * hence into the freeze and every live request). Payloads stay verbatim. */
export function buildPilotRoleReadinessCorpusV2(args: { repositoryRoot: string }): PilotRoleReadinessCorpusV2 {
  const v1 = buildPilotRoleReadinessCorpus(args);
  const { corpusSha256: _v1Sha256, ...v1Core } = v1;
  const core = {
    ...v1Core,
    schema: PILOT_ROLE_READINESS_V2_CORPUS_SCHEMA,
    experimentId: PILOT_ROLE_READINESS_V2_EXPERIMENT_ID,
    goldAdjudications: READINESS_CANARY_GOLD_ADJUDICATIONS_V1,
  };
  return { ...core, corpusSha256: hashCanonical(core) };
}

export type PilotRoleReadinessPlanV2 = Omit<PilotRoleReadinessPlanV1, "schema" | "experimentId"> & {
  schema: typeof PILOT_ROLE_READINESS_V2_PLAN_SCHEMA;
  experimentId: typeof PILOT_ROLE_READINESS_V2_EXPERIMENT_ID;
  goldAdjudicationsSha256: string;
};

export function buildPilotRoleReadinessPlanV2(args: {
  repositoryRoot: string;
  corpus: PilotRoleReadinessCorpusV2;
}): PilotRoleReadinessPlanV2 {
  const repositoryRoot = resolve(args.repositoryRoot);
  const sealBytes = readFileSync(resolve(repositoryRoot, CANDIDATE_INSTRUMENT_SEAL_REL_PATH));
  const certBytes = readFileSync(resolve(repositoryRoot, CANDIDATE_INSTRUMENT_CERT_REL_PATH));
  const core: Omit<PilotRoleReadinessPlanV2, "planSha256"> = {
    schema: PILOT_ROLE_READINESS_V2_PLAN_SCHEMA,
    experimentId: PILOT_ROLE_READINESS_V2_EXPERIMENT_ID,
    objective: PILOT_ROLE_READINESS_OBJECTIVE,
    corpusSha256: args.corpus.corpusSha256,
    goldAdjudicationsSha256: hashCanonical(READINESS_CANARY_GOLD_ADJUDICATIONS_V1),
    thresholds: PILOT_READINESS_THRESHOLDS,
    thresholdsSha256: hashCanonical(PILOT_READINESS_THRESHOLDS),
    metricSemantics: PILOT_READINESS_METRIC_SEMANTICS,
    candidateOrders: PILOT_READINESS_CANDIDATE_ORDERS,
    candidateOrdersSha256: hashCanonical(PILOT_READINESS_CANDIDATE_ORDERS),
    stopping: PILOT_READINESS_STOPPING,
    budget: PILOT_READINESS_BUDGET,
    costCandidateProbe: PILOT_READINESS_COST_PROBE,
    canaryGate: {
      requiredCorrect: 2,
      rule: "both canaries protocol-valid AND semantically correct before any holdout call; a canary failure means zero holdout calls for that profile-role",
    },
    bindings: {
      candidateSealRawSha256: sha256Hex(sealBytes),
      candidateCertificationRawSha256: sha256Hex(certBytes),
      readerDecisionPolicy: "reader-decision-policy-v3",
      aggregatePolicy: "aggregate-chapter-review-policy-v2",
    },
    terminalStates: PILOT_READINESS_TERMINAL_STATES,
  };
  return { ...core, planSha256: hashCanonical(core) };
}

export type PilotRoleReadinessMaterializationV2 = Omit<PilotRoleReadinessMaterializationV1, "schema" | "experimentId"> & {
  schema: "pilot-role-readiness-materialization-v2";
  experimentId: typeof PILOT_ROLE_READINESS_V2_EXPERIMENT_ID;
};

export function materializePilotRoleReadinessV2(args: {
  repositoryRoot: string;
  write?: boolean;
  mintPlan?: boolean;
}): PilotRoleReadinessMaterializationV2 {
  const repositoryRoot = resolve(args.repositoryRoot);
  const corpus = buildPilotRoleReadinessCorpusV2({ repositoryRoot });
  const corpusPath = resolve(repositoryRoot, `${PILOT_ROLE_READINESS_V2_DIR_REL_PATH}/readiness-corpus.v2.json`);
  const corpusBytes = canonicalPretty(corpus);
  if (existsSync(corpusPath)) {
    requireCondition(readFileSync(corpusPath, "utf8") === corpusBytes,
      "retained v2 readiness corpus differs from the deterministic rebuild — the corpus is frozen at creation");
  } else if (args.write === true) {
    writeFileAtomic(corpusPath, corpusBytes);
    requireCondition(readFileSync(corpusPath, "utf8") === corpusBytes, "v2 readiness corpus read-back drift");
  }
  const planPath = resolve(repositoryRoot, `${PILOT_ROLE_READINESS_V2_DIR_REL_PATH}/readiness-plan.v2.json`);
  let planSha256: string | null = null;
  let planWritten = false;
  if (existsSync(planPath)) {
    const retained = JSON.parse(readFileSync(planPath, "utf8")) as PilotRoleReadinessPlanV2;
    requireCondition(retained.corpusSha256 === corpus.corpusSha256, "retained v2 plan is bound to a different corpus");
    const rebuilt = buildPilotRoleReadinessPlanV2({ repositoryRoot, corpus });
    requireCondition(rebuilt.planSha256 === retained.planSha256,
      "retained v2 readiness plan no longer matches the current inputs (candidate re-minted since plan freeze?) — mint a fresh plan identity");
    planSha256 = retained.planSha256;
    planWritten = true;
  } else if (args.mintPlan === true && args.write === true) {
    const plan = buildPilotRoleReadinessPlanV2({ repositoryRoot, corpus });
    writeFileAtomic(planPath, canonicalPretty(plan));
    planSha256 = plan.planSha256;
    planWritten = true;
  }
  return {
    schema: "pilot-role-readiness-materialization-v2",
    experimentId: PILOT_ROLE_READINESS_V2_EXPERIMENT_ID,
    corpusPath,
    corpusSha256: corpus.corpusSha256,
    planPath,
    planSha256,
    planWritten,
    written: args.write === true || existsSync(corpusPath),
    modelCalls: 0,
    apiCalls: 0,
  };
}

// ── v3 corpus (v2 + Option B craft-map widening) ─────────────────────────────

export type PilotRoleReadinessCorpusV3 = Omit<PilotRoleReadinessCorpusV2, "schema" | "experimentId"> & {
  schema: typeof PILOT_ROLE_READINESS_V3_CORPUS_SCHEMA;
  experimentId: typeof PILOT_ROLE_READINESS_V3_EXPERIMENT_ID;
  craftWeaknessAcceptedCategories: typeof READINESS_CRAFT_WEAKNESS_ACCEPTED_CATEGORIES_V2;
};

export function buildPilotRoleReadinessCorpusV3(args: { repositoryRoot: string }): PilotRoleReadinessCorpusV3 {
  const v2 = buildPilotRoleReadinessCorpusV2(args);
  const { corpusSha256: _v2Sha256, ...v2Core } = v2;
  const core = {
    ...v2Core,
    schema: PILOT_ROLE_READINESS_V3_CORPUS_SCHEMA,
    experimentId: PILOT_ROLE_READINESS_V3_EXPERIMENT_ID,
    craftWeaknessAcceptedCategories: READINESS_CRAFT_WEAKNESS_ACCEPTED_CATEGORIES_V2,
  };
  return { ...core, corpusSha256: hashCanonical(core) };
}

export type PilotRoleReadinessPlanV3 = Omit<PilotRoleReadinessPlanV2, "schema" | "experimentId"> & {
  schema: typeof PILOT_ROLE_READINESS_V3_PLAN_SCHEMA;
  experimentId: typeof PILOT_ROLE_READINESS_V3_EXPERIMENT_ID;
  craftWeaknessAcceptedCategoriesSha256: string;
};

export function buildPilotRoleReadinessPlanV3(args: {
  repositoryRoot: string;
  corpus: PilotRoleReadinessCorpusV3;
}): PilotRoleReadinessPlanV3 {
  const v2Style = buildPilotRoleReadinessPlanV2({
    repositoryRoot: args.repositoryRoot,
    corpus: args.corpus as unknown as PilotRoleReadinessCorpusV2,
  });
  const { planSha256: _v2PlanSha256, ...v2Core } = v2Style;
  const core = {
    ...v2Core,
    schema: PILOT_ROLE_READINESS_V3_PLAN_SCHEMA,
    experimentId: PILOT_ROLE_READINESS_V3_EXPERIMENT_ID,
    corpusSha256: args.corpus.corpusSha256,
    craftWeaknessAcceptedCategoriesSha256: hashCanonical(READINESS_CRAFT_WEAKNESS_ACCEPTED_CATEGORIES_V2),
  };
  return { ...core, planSha256: hashCanonical(core) };
}

export function materializePilotRoleReadinessV3(args: {
  repositoryRoot: string;
  write?: boolean;
  mintPlan?: boolean;
}): Omit<PilotRoleReadinessMaterializationV2, "schema" | "experimentId"> & {
  schema: "pilot-role-readiness-materialization-v3";
  experimentId: typeof PILOT_ROLE_READINESS_V3_EXPERIMENT_ID;
} {
  const repositoryRoot = resolve(args.repositoryRoot);
  const corpus = buildPilotRoleReadinessCorpusV3({ repositoryRoot });
  const corpusPath = resolve(repositoryRoot, `${PILOT_ROLE_READINESS_V3_DIR_REL_PATH}/readiness-corpus.v3.json`);
  const corpusBytes = canonicalPretty(corpus);
  if (existsSync(corpusPath)) {
    requireCondition(readFileSync(corpusPath, "utf8") === corpusBytes,
      "retained v3 readiness corpus differs from the deterministic rebuild — the corpus is frozen at creation");
  } else if (args.write === true) {
    writeFileAtomic(corpusPath, corpusBytes);
    requireCondition(readFileSync(corpusPath, "utf8") === corpusBytes, "v3 readiness corpus read-back drift");
  }
  const planPath = resolve(repositoryRoot, `${PILOT_ROLE_READINESS_V3_DIR_REL_PATH}/readiness-plan.v3.json`);
  let planSha256: string | null = null;
  let planWritten = false;
  if (existsSync(planPath)) {
    const retained = JSON.parse(readFileSync(planPath, "utf8")) as PilotRoleReadinessPlanV3;
    requireCondition(retained.corpusSha256 === corpus.corpusSha256, "retained v3 plan is bound to a different corpus");
    const rebuilt = buildPilotRoleReadinessPlanV3({ repositoryRoot, corpus });
    requireCondition(rebuilt.planSha256 === retained.planSha256,
      "retained v3 readiness plan no longer matches the current inputs (candidate re-minted since plan freeze?) — mint a fresh plan identity");
    planSha256 = retained.planSha256;
    planWritten = true;
  } else if (args.mintPlan === true && args.write === true) {
    const plan = buildPilotRoleReadinessPlanV3({ repositoryRoot, corpus });
    writeFileAtomic(planPath, canonicalPretty(plan));
    planSha256 = plan.planSha256;
    planWritten = true;
  }
  return {
    schema: "pilot-role-readiness-materialization-v3",
    experimentId: PILOT_ROLE_READINESS_V3_EXPERIMENT_ID,
    corpusPath,
    corpusSha256: corpus.corpusSha256,
    planPath,
    planSha256,
    planWritten,
    written: args.write === true || existsSync(corpusPath),
    modelCalls: 0,
    apiCalls: 0,
  };
}

// ── Plan (binds the then-current candidate instrument at campaign launch) ────

export type PilotRoleReadinessPlanV1 = {
  schema: typeof PILOT_ROLE_READINESS_PLAN_SCHEMA;
  experimentId: typeof PILOT_ROLE_READINESS_EXPERIMENT_ID;
  objective: typeof PILOT_ROLE_READINESS_OBJECTIVE;
  corpusSha256: string;
  thresholds: typeof PILOT_READINESS_THRESHOLDS;
  thresholdsSha256: string;
  metricSemantics: typeof PILOT_READINESS_METRIC_SEMANTICS;
  candidateOrders: typeof PILOT_READINESS_CANDIDATE_ORDERS;
  candidateOrdersSha256: string;
  stopping: typeof PILOT_READINESS_STOPPING;
  budget: typeof PILOT_READINESS_BUDGET;
  costCandidateProbe: typeof PILOT_READINESS_COST_PROBE;
  canaryGate: { requiredCorrect: 2; rule: string };
  bindings: {
    candidateSealRawSha256: string;
    candidateCertificationRawSha256: string;
    readerDecisionPolicy: "reader-decision-policy-v3";
    aggregatePolicy: "aggregate-chapter-review-policy-v2";
  };
  terminalStates: typeof PILOT_READINESS_TERMINAL_STATES;
  planSha256: string;
};

export function buildPilotRoleReadinessPlan(args: {
  repositoryRoot: string;
  corpus: PilotRoleReadinessCorpusV1;
}): PilotRoleReadinessPlanV1 {
  const repositoryRoot = resolve(args.repositoryRoot);
  const sealBytes = readFileSync(resolve(repositoryRoot, CANDIDATE_INSTRUMENT_SEAL_REL_PATH));
  const certBytes = readFileSync(resolve(repositoryRoot, CANDIDATE_INSTRUMENT_CERT_REL_PATH));
  const core: Omit<PilotRoleReadinessPlanV1, "planSha256"> = {
    schema: PILOT_ROLE_READINESS_PLAN_SCHEMA,
    experimentId: PILOT_ROLE_READINESS_EXPERIMENT_ID,
    objective: PILOT_ROLE_READINESS_OBJECTIVE,
    corpusSha256: args.corpus.corpusSha256,
    thresholds: PILOT_READINESS_THRESHOLDS,
    thresholdsSha256: hashCanonical(PILOT_READINESS_THRESHOLDS),
    metricSemantics: PILOT_READINESS_METRIC_SEMANTICS,
    candidateOrders: PILOT_READINESS_CANDIDATE_ORDERS,
    candidateOrdersSha256: hashCanonical(PILOT_READINESS_CANDIDATE_ORDERS),
    stopping: PILOT_READINESS_STOPPING,
    budget: PILOT_READINESS_BUDGET,
    costCandidateProbe: PILOT_READINESS_COST_PROBE,
    canaryGate: {
      requiredCorrect: 2,
      rule: "both canaries protocol-valid AND semantically correct before any holdout call; a canary failure means zero holdout calls for that profile-role",
    },
    bindings: {
      candidateSealRawSha256: sha256Hex(sealBytes),
      candidateCertificationRawSha256: sha256Hex(certBytes),
      readerDecisionPolicy: "reader-decision-policy-v3",
      aggregatePolicy: "aggregate-chapter-review-policy-v2",
    },
    terminalStates: PILOT_READINESS_TERMINAL_STATES,
  };
  return { ...core, planSha256: hashCanonical(core) };
}

// ── Materialization (corpus create-once; plan minted at campaign launch) ─────

export type PilotRoleReadinessMaterializationV1 = {
  schema: "pilot-role-readiness-materialization-v1";
  experimentId: typeof PILOT_ROLE_READINESS_EXPERIMENT_ID;
  corpusPath: string;
  corpusSha256: string;
  planPath: string;
  planSha256: string | null;
  planWritten: boolean;
  written: boolean;
  modelCalls: 0;
  apiCalls: 0;
};

export function materializePilotRoleReadiness(args: {
  repositoryRoot: string;
  write?: boolean;
  mintPlan?: boolean;
}): PilotRoleReadinessMaterializationV1 {
  const repositoryRoot = resolve(args.repositoryRoot);
  const corpus = buildPilotRoleReadinessCorpus({ repositoryRoot });
  const corpusPath = resolve(repositoryRoot, `${PILOT_ROLE_READINESS_DIR_REL_PATH}/readiness-corpus.v1.json`);
  const corpusBytes = canonicalPretty(corpus);
  if (existsSync(corpusPath)) {
    requireCondition(readFileSync(corpusPath, "utf8") === corpusBytes,
      "retained readiness corpus differs from the deterministic rebuild — the corpus is frozen at creation");
  } else if (args.write === true) {
    writeFileAtomic(corpusPath, corpusBytes);
    requireCondition(readFileSync(corpusPath, "utf8") === corpusBytes, "readiness corpus read-back drift");
  }

  const planPath = resolve(repositoryRoot, `${PILOT_ROLE_READINESS_DIR_REL_PATH}/readiness-plan.v1.json`);
  let planSha256: string | null = null;
  let planWritten = false;
  if (existsSync(planPath)) {
    // Bind-once: the retained plan froze the candidate mint at launch. Reassert
    // the corpus binding AND that the candidate has not been re-minted since —
    // a re-mint after plan freeze requires a fresh plan identity, never reuse.
    const retained = JSON.parse(readFileSync(planPath, "utf8")) as PilotRoleReadinessPlanV1;
    requireCondition(retained.corpusSha256 === corpus.corpusSha256, "retained plan is bound to a different corpus");
    const rebuilt = buildPilotRoleReadinessPlan({ repositoryRoot, corpus });
    requireCondition(rebuilt.planSha256 === retained.planSha256,
      "retained readiness plan no longer matches the current inputs (candidate re-minted since plan freeze?) — mint a fresh plan identity");
    planSha256 = retained.planSha256;
    planWritten = true;
  } else if (args.mintPlan === true && args.write === true) {
    const plan = buildPilotRoleReadinessPlan({ repositoryRoot, corpus });
    writeFileAtomic(planPath, canonicalPretty(plan));
    planSha256 = plan.planSha256;
    planWritten = true;
  }
  return {
    schema: "pilot-role-readiness-materialization-v1",
    experimentId: PILOT_ROLE_READINESS_EXPERIMENT_ID,
    corpusPath,
    corpusSha256: corpus.corpusSha256,
    planPath,
    planSha256,
    planWritten,
    written: args.write === true || existsSync(corpusPath),
    modelCalls: 0,
    apiCalls: 0,
  };
}
