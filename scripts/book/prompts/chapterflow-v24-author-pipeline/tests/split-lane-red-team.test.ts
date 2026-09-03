/**
 * IMP-20 WP-C2 — NEGATIVE / RED-TEAM suite for the split-lane reviewer.
 *
 * Each of the 15 IMP-20 "Negative and red-team tests" attempts is asserted to
 * FAIL CLOSED — no attack surface lets a defect through. Plus the two STATIC
 * route proofs (integration 15/16): every model-bearing route resolves to the
 * ChatGPT-authenticated `codex exec` subscription route, and no API provider or
 * fallback is reachable.
 *
 * The 15 attempts (design §3, red-team row):
 *   1  reader lane cannot claim an external event never happened (schema rejects)
 *   2  a source claim cannot pass with no source packet (lane refuses)
 *   3  hidden planSpec cannot serve as source provenance (never inferred)
 *   4  a constructed example merging a real company into an invented event blocks
 *   5  a generic scenario inventing a date/statistic blocks
 *   6  a source INCONCLUSIVE can never become PASS at the aggregator
 *   7  a model recommendation cannot bypass the aggregator (conductor-owned)
 *   8  routing one candidate cell to a different primary judge is rejected
 *   9  backup selection after seeing output is rejected (frozen audit subset only)
 *   10 silently omitted corpus variants throw (builder fails closed, never [])
 *   11 rebuilding from a private temp path is impossible (no absolute/env literals)
 *   12 altering an old §16 seal is detected (preserved-artifact hashes re-verify)
 *   13 API provider use throws at the router (no-API choke)
 *   14 adding a content retry beyond the bounded infra-replay policy is rejected
 *   15 a book-specific exception has no code path (no bookId-conditional override)
 *
 * ZERO live model calls anywhere: every source/quiz verdict is an injected fake,
 * the router API providers are asserted to THROW before any provider loads, and
 * the pilot dry run makes zero calls. This suite writes nothing to disk (it only
 * reads committed evidence + module source), so it stays clean under
 * CHAPTERFLOW_LEAK_GUARD=1.
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { test, xenv } from "./harness.js";
import { LEGACY_ROUTE_DISABLED_CODE } from "../src/runtime/legacyRouteInventory.js";

// ── split-lane contracts + runtimes under attack ─────────────────────────────
import {
  READER_BLOCKING_CATEGORIES,
  READER_ESCALATION_CATEGORIES,
  READER_EXPERIENCE_RUBRIC_VERSION,
  validateReaderExperienceReview,
  type ReaderExperienceReviewV1,
} from "../src/contracts/readerExperienceReview.js";
import type {
  SourceIntegrityReviewUnitV1,
  SourceIntegrityReviewV1,
} from "../src/contracts/sourceIntegrityReview.js";
import type {
  QuizIntegrityQuestionV1,
  QuizIntegrityResultV1,
} from "../src/contracts/quizIntegrityReview.js";
import {
  aggregateChapterReview,
} from "../src/review/aggregateChapterReview.js";
import type {
  AggregateChapterReviewInputV1,
  DeterministicCriticSummaryV1,
} from "../src/contracts/aggregateChapterReview.js";
import {
  runSourceIntegrityReview,
  SourceIntegrityLaneError,
  type SourceIntegrityLaneInputV1,
  type SourceIntegritySpawnFn,
} from "../src/review/sourceIntegrityReview.js";
import {
  assignFixedRoles,
  isInFrozenAuditSubset,
} from "../src/bakeoff/migration/reviewerRoleAssignment.js";
import {
  assertOneAttemptOpts,
  assertNotClosed,
  MigrationGuardError,
} from "../src/bakeoff/migration/guards.js";
import {
  assertComposition,
  CorpusBuildError,
  normalizeChapterSchemaOnly,
  readMutationSpec,
  SCHEMA_SCAFFOLD_PLAN_SPEC,
  SOURCE_SEMANTICS_MISSING,
  type SourceUnitSpecV1,
} from "../src/bakeoff/migration/corpusBuilderCore.js";
import { classifySourceUnit } from "../src/bakeoff/migration/sourceCorpusBuilder.js";
import {
  buildRecoveryExperimentSpec,
  runRecoveryPilotDryRun,
  RECOVERY_PILOT_STOP_CONDITIONS,
  type RecoverySpecInputsV1,
} from "../src/bakeoff/migration/recoveryExperiment.js";
import { validateRouteResult } from "../src/contracts/routeContracts.js";
import { callModel } from "../src/providers/router.js";
import type { ClosedExperimentRegistryV1 } from "../src/bakeoff/migration/reviewLaneTypes.js";

// ── shared harness/type imports for the migration-side fixtures ───────────────
import type { ChapterV21 } from "../src/types.js";
import type { SourceUsePlanV1 } from "../src/contracts/sourceUsePlan.js";
import type { SourcePacketV1 } from "../src/artifacts/artifactTypes.js";
import type {
  ExperimentSpecV1,
  MigrationReviewSummaryV1,
  MigrationSampleRecordV1,
} from "../src/bakeoff/migration/experimentTypes.js";
import { REVIEW_FACTORS, type ReviewFactor } from "../src/artifacts/artifactTypes.js";
import { sourcePacketHash } from "../src/compiler/sourcePacket.js";
import { confirmatorySpec } from "./migration-helpers.js";
import { fxChapter, fxPacket, fxPlan, fxPlanUnit } from "./migrationFixtures.js";

const PIPELINE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MIG = resolve(PIPELINE_ROOT, "state", "migration-experiments");

function readSrc(rel: string): string {
  return readFileSync(resolve(PIPELINE_ROOT, rel), "utf8");
}

// ══════════════════════════════════════════════════════════════════════════════
// Aggregator fixtures (inline; no shared fixture module) — model-free typed lanes
// ══════════════════════════════════════════════════════════════════════════════
const CHAP = "chap-sha-rt";
const READER_DOC = "reader-doc-rt";
const PLAN = "plan-rt";
const PACKET = "packet-rt";
const SIDECAR = "sidecar-rt";
const READER_SCHEMA = "reader-schema-rt";
const SOURCE_SCHEMA = "source-schema-rt";
const QUIZ_SCHEMA = "quiz-schema-rt";
const BAR = 80;

function mkScores(value: number): Record<ReviewFactor, number> {
  const s = {} as Record<ReviewFactor, number>;
  for (const f of REVIEW_FACTORS) s[f] = value;
  return s;
}

function mkReader(over: Partial<ReaderExperienceReviewV1> = {}): ReaderExperienceReviewV1 {
  return {
    schema: "reader-experience-review-v1",
    reviewerRole: "reader-experience",
    chapterContentSha256: CHAP,
    readerDocumentSha256: READER_DOC,
    rubricVersion: READER_EXPERIENCE_RUBRIC_VERSION,
    schemaSha256: READER_SCHEMA,
    scores: mkScores(90),
    quizDerivation: { answers: ["a"], mechanisms: ["the prose forces a"], confidence: ["high"], ambiguities: [""], tells: [] },
    recommendation: "SHIP",
    blockingFindings: [],
    escalationSignals: [],
    advisoryFindings: [],
    strongestEvidence: [],
    weakestEvidence: [],
    oneParagraphVerdict: "clean",
    ...over,
  };
}

function mkSourceUnit(over: Partial<SourceIntegrityReviewUnitV1> = {}): SourceIntegrityReviewUnitV1 {
  return {
    unitId: "u1",
    expectedOrigin: "source_bound",
    expectedForm: "case",
    claimStrengthExpected: "descriptive",
    visibleRegister: "clearly_sourced",
    supportStatus: "SUPPORTED",
    framingAdequate: true,
    claimStrengthFit: true,
    namedSpecificityAllowed: true,
    chapterEvidenceSpans: [],
    sourceEvidenceSpans: [],
    findings: [],
    ...over,
  };
}

function mkSource(over: Partial<SourceIntegrityReviewV1> = {}): SourceIntegrityReviewV1 {
  return {
    schema: "source-integrity-review-v1",
    reviewerRole: "source-integrity",
    chapterContentSha256: CHAP,
    sourceUsePlanSha256: PLAN,
    sourcePacketSha256: PACKET,
    sidecarSha256: SIDECAR,
    schemaSha256: SOURCE_SCHEMA,
    units: [],
    result: "PASS",
    blockingFindingIds: [],
    rationale: "clean",
    ...over,
  };
}

function mkQuizQuestion(over: Partial<QuizIntegrityQuestionV1> = {}): QuizIntegrityQuestionV1 {
  return {
    itemId: "Q1",
    derivedAnswer: "a",
    keyedAnswer: "a",
    keyCorrect: true,
    uniqueAnswer: true,
    defensibleAlternatives: [],
    mechanismSupported: true,
    tellDetected: false,
    explanation: "",
    evidenceSpans: [],
    ...over,
  };
}

function mkQuiz(over: Partial<QuizIntegrityResultV1> = {}): QuizIntegrityResultV1 {
  return {
    schema: "quiz-integrity-result-v1",
    chapterContentSha256: CHAP,
    derivationSha256: "deriv-rt",
    questions: [mkQuizQuestion()],
    result: "PASS",
    ...over,
  };
}

function mkDeterministic(over: Partial<DeterministicCriticSummaryV1> = {}): DeterministicCriticSummaryV1 {
  return { bundleSha256: "bundle-rt", hasBlocker: false, blockerCheckIds: [], ...over };
}

function mkInput(over: Partial<AggregateChapterReviewInputV1> = {}): AggregateChapterReviewInputV1 {
  return {
    reader: mkReader(),
    source: mkSource(),
    quiz: mkQuiz(),
    deterministic: mkDeterministic(),
    readerBar: BAR,
    chapterContentSha256: CHAP,
    expectedChapterContentSha256: CHAP,
    expectedReaderDocumentSha256: READER_DOC,
    expectedSourceUsePlanSha256: PLAN,
    expectedSourcePacketSha256: PACKET,
    expectedSidecarSha256: SIDECAR,
    expectedReaderSchemaSha256: READER_SCHEMA,
    expectedSourceSchemaSha256: SOURCE_SCHEMA,
    expectedQuizSchemaSha256: QUIZ_SCHEMA,
    requiredSourceUnitIds: [],
    ...over,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Source-lane fixtures (inline; injected-spawn seam, zero live calls)
// ══════════════════════════════════════════════════════════════════════════════
const SOURCE_SCHEMA_SHA = "a".repeat(64);
const NON_V2_SIDECAR = { schemaVersion: "source-v1", namedExamples: [] as unknown[] };

function sourceChapter(): ChapterV21 {
  return fxChapter({
    hook: "Friction hides in the defaults nobody questions.",
    breakdown: {
      fastRead: "A team shortened a form and completion rose.",
      deepRead: "The deep read explains why removing a field changed the default path, not the people.",
      fullRead: "The full read walks the same mechanism across a workflow and its limits.",
    },
    keyTakeaway: "Change the default path, not the person.",
    tryThisNow: "Remove one field from a form you own today.",
    examples: [
      { title: "The shorter form", scenario: "A support team removed one optional field from an intake form.", whatToDo: "Cut a field.", whyItMatters: "Completion improved." },
    ],
    quiz: {
      questions: [
        { questionId: "q1", prompt: "Why did completion rise?", choices: ["The team advertised", "A field was removed", "Users were paid"], correctIndex: 1, explanation: "the prose credits removing a field." },
      ],
    },
    reviewCards: [{ front: "What moved behavior?", back: "The default." }],
    implementationPlan: {
      title: "Reduce friction",
      coreSkill: "Spot the default",
      ifThenPlans: [{ context: "designing a form", plan: "cut one field" }],
      twentyFourHourChallenge: "Remove one field.",
      weeklyPractice: "Audit one default a week.",
    },
    memorableLines: [{ text: "Defaults decide.", why: "Compact." }],
  } as Partial<ChapterV21>);
}

function freshPlan(packet: SourcePacketV1): SourceUsePlanV1 {
  return fxPlan({
    sourcePacketSha256: sourcePacketHash(packet),
    units: [
      fxPlanUnit({ unitId: "unit.fact.ch01.fact.1", origin: "source_bound", form: "explanation", anchorIds: ["ch01.fact.1"], claimStrength: "descriptive" }),
    ],
  });
}

function baseSourceInput(over: Partial<SourceIntegrityLaneInputV1> = {}): SourceIntegrityLaneInputV1 {
  const packet = fxPacket();
  return {
    chapter: sourceChapter(),
    plan: freshPlan(packet),
    packet,
    sidecar: NON_V2_SIDECAR,
    anchorCatalog: packet.allowedAnchors,
    schemaSha256: SOURCE_SCHEMA_SHA,
    ...over,
  };
}

function mkLaneUnit(over: Partial<SourceIntegrityReviewUnitV1> = {}): SourceIntegrityReviewUnitV1 {
  return {
    unitId: "unit.fact.ch01.fact.1",
    expectedOrigin: "source_bound",
    expectedForm: "explanation",
    claimStrengthExpected: "descriptive",
    visibleRegister: "clearly_sourced",
    supportStatus: "SUPPORTED",
    framingAdequate: null,
    claimStrengthFit: true,
    namedSpecificityAllowed: true,
    chapterEvidenceSpans: ["A team shortened a form and completion rose."],
    sourceEvidenceSpans: ["a documented instance"],
    findings: [],
    ...over,
  };
}

function modelReply(units: SourceIntegrityReviewUnitV1[], result: "PASS" | "BLOCK" | "INCONCLUSIVE", blockingFindingIds: string[] = []): string {
  return "```json\n" + JSON.stringify({ schema: "source-integrity-review-v1", units, result, blockingFindingIds, rationale: "red-team verdict" }) + "\n```";
}

function trackedSpawn(reply: string): { fn: SourceIntegritySpawnFn; calls: () => number } {
  let called = 0;
  const fn: SourceIntegritySpawnFn = () => {
    called += 1;
    return { finalMessage: reply };
  };
  return { fn, calls: () => called };
}

// ══════════════════════════════════════════════════════════════════════════════
// Migration sample-record fixture (inline; for the fixed-assignment attacks)
// ══════════════════════════════════════════════════════════════════════════════
const TWO_JUDGE_PANEL = [
  { model: "gpt-5.5", effort: "high" as const },
  { model: "gpt-5.6-sol", effort: "xhigh" as const },
];

const REVIEW_SUMMARY: MigrationReviewSummaryV1 = {
  composite: 50,
  ship: false,
  keysClean: false,
  valid: true,
  pass: false,
  quizAdjudicationStatus: "adjudicated",
  complaintsMustFix: 3,
  reviewerSessionId: "r",
  judgeModel: "gpt-5.5",
  judgeEffort: "high",
};

function mkRecord(over: Partial<MigrationSampleRecordV1> = {}): MigrationSampleRecordV1 {
  return {
    schema: "migration-sample-record-v1",
    experimentId: "exp-red-team",
    stage: "confirmatory",
    blindSampleId: "aaaaaaaaaaaa",
    cellId: "55-H",
    bookId: "zz-mig-book-a",
    chapterNumber: 1,
    stratum: "research-heavy",
    sampleIndex: 1,
    executionOrder: 0,
    outcome: {
      providerOutcome: "content_completed",
      replayed: false,
      firstWriteDeterministicPass: true,
      durationMs: 1,
      writerSessionIds: ["w"],
    },
    artifact: { contentSha256: "0".repeat(64), chapterRelPath: "x/x.chapter.json" },
    critics: { c37Overreach: 0, c37SceneCompletion: 0, c37GenericLeak: 0, registerAdvisories: 0, causalClaims: 0, diversity: null },
    review: null,
    tokens: null,
    unavailableFields: ["tokens"],
    recordedAt: "2026-07-10T00:00:00.000Z",
    ...over,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Recovery-spec fixture (inline)
// ══════════════════════════════════════════════════════════════════════════════
function mkRecoveryInputs(over: Partial<RecoverySpecInputsV1> = {}): RecoverySpecInputsV1 {
  return {
    readerSchemaSha256: "reader-schema-sha",
    sourceSchemaSha256: "source-schema-sha",
    quizAdjudicationSchemaSha256: "quiz-schema-sha",
    executionProfileHash: "exec-profile-hash",
    routePolicyVersion: "route-policy-v1",
    thresholdsSha256: "thresholds-sha",
    readerCorpusSha256: "reader-corpus-sha",
    sourceCorpusSha256: "source-corpus-sha",
    quizCorpusSha256: "quiz-corpus-sha",
    randomizationSeed: "seed-r",
    pilotSeed: "seed-p",
    diagnosticSeed: "seed-d",
    ...over,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// 1 — reader lane cannot claim an external event never happened
// ══════════════════════════════════════════════════════════════════════════════
test("red-team 1: reader lane cannot claim an external event never happened (schema rejects source-truth categories)", () => {
  // The reader has no source evidence, so its blocking authority DELIBERATELY
  // omits every external-fabrication category. Attempting to encode "this event
  // never happened" as a blocking finding is unrepresentable.
  for (const forbidden of ["fabricated", "factually_wrong", "source_contradictory"]) {
    assert.ok(!(READER_BLOCKING_CATEGORIES as readonly string[]).includes(forbidden), `${forbidden} must not be a reader BLOCKING category`);
    assert.ok(!(READER_ESCALATION_CATEGORIES as readonly string[]).includes(forbidden), `${forbidden} must not be a reader ESCALATION category`);
  }

  // A clean reader review validates.
  assert.deepEqual(validateReaderExperienceReview(mkReader()), []);

  // Smuggling a fabrication verdict into blockingFindings is hard-rejected.
  const fabricationAttempt = mkReader({
    blockingFindings: [
      { category: "fabricated" as never, unit: "hook", problem: "the 1997 Kodak meeting never happened", evidenceSpans: ["in 1997 Kodak's board"] },
    ],
  });
  const errs = validateReaderExperienceReview(fabricationAttempt);
  assert.ok(errs.length > 0, "the fabrication category is rejected by the validator");
  assert.ok(errs.some((e) => e.includes("unknown category") && e.includes("fabricated")), "the validator names the rejected category");

  // Nor can it hide as a source-contradiction escalation signal.
  const escalationAttempt = mkReader({
    escalationSignals: [
      { category: "source_contradictory" as never, unit: "deep read", problem: "contradicts the cited study", evidenceSpans: ["the study found"] },
    ],
  });
  assert.ok(validateReaderExperienceReview(escalationAttempt).some((e) => e.includes("unknown category")), "a source-truth escalation category is also rejected");
});

// ══════════════════════════════════════════════════════════════════════════════
// 2 — a source claim cannot pass with no source packet
// ══════════════════════════════════════════════════════════════════════════════
test("red-team 2: a source claim cannot pass with no source packet — the lane refuses to run", async () => {
  // The injected verdict WOULD return PASS, but the packet is absent, so the
  // refuse-to-run guard fires before the semantic seam is ever reached.
  const spawn = trackedSpawn(modelReply([mkLaneUnit()], "PASS"));
  await assert.rejects(
    () => runSourceIntegrityReview(baseSourceInput({ packet: undefined as unknown as SourcePacketV1 }), { spawn: spawn.fn }),
    SourceIntegrityLaneError,
  );
  // Missing plan and missing sidecar refuse identically (a source verdict is
  // unfalsifiable without the evidence).
  await assert.rejects(
    () => runSourceIntegrityReview(baseSourceInput({ plan: null as unknown as SourceUsePlanV1 }), { spawn: spawn.fn }),
    SourceIntegrityLaneError,
  );
  await assert.rejects(
    () => runSourceIntegrityReview(baseSourceInput({ sidecar: null }), { spawn: spawn.fn }),
    SourceIntegrityLaneError,
  );
  assert.equal(spawn.calls(), 0, "no refusal ever reaches the model seam");
});

// ══════════════════════════════════════════════════════════════════════════════
// 3 — hidden planSpec cannot serve as source provenance
// ══════════════════════════════════════════════════════════════════════════════
test("red-team 3: hidden planSpec cannot serve as source provenance (never inferred; unit stamped MISSING)", () => {
  // The E-04 scaffold planSpec is neutral — its format literal is "unspecified",
  // never "scenario"; every field is the same explicit sentinel.
  assert.equal(SCHEMA_SCAFFOLD_PLAN_SPEC.format, "unspecified");
  assert.notEqual(SCHEMA_SCAFFOLD_PLAN_SPEC.format as string, "scenario");

  // Schema-only normalization NEVER mints a source-origin planSpec: an example
  // lacking planSpec gets the neutral "unspecified" scaffold, not "scenario".
  const raw = sourceChapter();
  (raw.examples as Array<Record<string, unknown>>).forEach((e) => delete e.planSpec);
  const normalized = normalizeChapterSchemaOnly(raw);
  for (const e of normalized.examples as unknown as Array<Record<string, unknown>>) {
    const ps = e.planSpec as Record<string, unknown>;
    assert.equal(ps.format, "unspecified", "no source-origin format is ever inferred");
    assert.notEqual(ps.format as string, "scenario");
  }

  // A source unit that carries a HIDDEN inferred planSpec but no owner-declared
  // PRESENT semantics is classified MISSING and excluded — the hidden metadata
  // buys it nothing.
  const smuggled: SourceUnitSpecV1 = {
    unitSlotId: "slot.hidden.1",
    family: "supported-source-bound",
    // no sourceSemanticsStatus === "PRESENT"; a planSpec hint is embedded in evidence
    sourceSemanticsStatus: "OWNER_INPUT_PENDING",
    bookId: "zz-book",
    chapterNumber: 1,
    evidence: { planSpec: { format: "scenario" }, chapterUnit: "…" },
  };
  const cls = classifySourceUnit(smuggled);
  assert.equal(cls.status, SOURCE_SEMANTICS_MISSING, "hidden planSpec is NOT promoted to PRESENT semantics");
  assert.match(cls.reason, /never inferred/i);
});

// ══════════════════════════════════════════════════════════════════════════════
// 4 — constructed example merging a real company into an invented event blocks
// ══════════════════════════════════════════════════════════════════════════════
test("red-team 4: a constructed example merging a real company into an invented event blocks (source BLOCK)", async () => {
  const unit = mkLaneUnit({
    unitId: "unit.constructed-application",
    expectedOrigin: "constructed",
    expectedForm: "application",
    visibleRegister: "presented_as_fact",
    supportStatus: "NOT_APPLICABLE",
    framingAdequate: false,
    namedSpecificityAllowed: false,
    findings: [
      { category: "missing_visible_framing", severity: "blocker", explanation: "a constructed application merges a real named company into an invented, unframed event presented as reported history" },
    ],
  });
  const spawn = trackedSpawn(modelReply([unit], "BLOCK", ["unit.constructed-application::missing_visible_framing#0"]));
  const out = await runSourceIntegrityReview(baseSourceInput(), { spawn: spawn.fn });
  assert.equal(out.result, "BLOCK");
  assert.equal(spawn.calls(), 1, "the semantic reviewer ran (deterministic prechecks were clean)");
  assert.ok(out.review.blockingFindingIds.some((id) => id.includes("missing_visible_framing")), "the block names the framing violation");
});

// ══════════════════════════════════════════════════════════════════════════════
// 5 — a generic scenario inventing a date/statistic blocks
// ══════════════════════════════════════════════════════════════════════════════
test("red-team 5: a generic scenario inventing a date/statistic blocks (source BLOCK)", async () => {
  const unit = mkLaneUnit({
    unitId: "unit.generic-scenario",
    expectedOrigin: "generic",
    expectedForm: "operational_scenario",
    visibleRegister: "presented_as_fact",
    supportStatus: "NOT_APPLICABLE",
    namedSpecificityAllowed: false,
    findings: [
      { category: "generic_specificity_leak", severity: "blocker", explanation: "a generic role scenario invents a specific year (2019) and a 47% statistic" },
    ],
  });
  const spawn = trackedSpawn(modelReply([unit], "BLOCK", ["unit.generic-scenario::generic_specificity_leak#0"]));
  const out = await runSourceIntegrityReview(baseSourceInput(), { spawn: spawn.fn });
  assert.equal(out.result, "BLOCK");
  assert.ok(out.review.blockingFindingIds.some((id) => id.includes("generic_specificity_leak")), "the block names the invented-specificity leak");
});

// ══════════════════════════════════════════════════════════════════════════════
// 6 — a source INCONCLUSIVE can never become PASS at the aggregator
// ══════════════════════════════════════════════════════════════════════════════
test("red-team 6: source INCONCLUSIVE can never become PASS at the aggregator", () => {
  // Required-unit INCONCLUSIVE → BLOCK (never PASS).
  const requiredInconclusive = aggregateChapterReview(
    mkInput({
      source: mkSource({ result: "INCONCLUSIVE", units: [mkSourceUnit({ unitId: "u1", supportStatus: "INCONCLUSIVE" })] }),
      requiredSourceUnitIds: ["u1"],
    }),
  );
  assert.equal(requiredInconclusive.finalStatus, "BLOCK");

  // Unpinned lane-level INCONCLUSIVE → INCONCLUSIVE (never PASS).
  const unpinned = aggregateChapterReview(mkInput({ source: mkSource({ result: "INCONCLUSIVE", units: [] }) }));
  assert.equal(unpinned.finalStatus, "INCONCLUSIVE");

  // The attacker tries to force it through with a SHIP recommendation + a clean
  // reader/quiz — the aggregator still refuses PASS.
  const forced = aggregateChapterReview(
    mkInput({
      reader: mkReader({ recommendation: "SHIP" }),
      source: mkSource({ result: "INCONCLUSIVE", units: [] }),
    }),
  );
  assert.notEqual(forced.finalStatus, "PASS");
  for (const r of [requiredInconclusive, unpinned, forced]) {
    assert.notEqual(r.finalStatus, "PASS", "an inconclusive source lane never yields PASS");
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// 7 — a model recommendation cannot bypass the aggregator
// ══════════════════════════════════════════════════════════════════════════════
test("red-team 7: a model recommendation cannot bypass the aggregator (conductor-owned final status)", () => {
  // SHIP over a genuine quiz BLOCK does NOT rescue it.
  const shipOverBlock = aggregateChapterReview(
    mkInput({
      reader: mkReader({ recommendation: "SHIP" }),
      quiz: mkQuiz({ result: "BLOCK", questions: [mkQuizQuestion({ keyCorrect: false })] }),
    }),
  );
  assert.equal(shipOverBlock.finalStatus, "BLOCK", "recommendation SHIP cannot override a quiz BLOCK");

  // SHIP over a source BLOCK does NOT rescue it either.
  const shipOverSourceBlock = aggregateChapterReview(
    mkInput({
      reader: mkReader({ recommendation: "SHIP" }),
      source: mkSource({ result: "BLOCK", blockingFindingIds: ["u1:invented_detail"] }),
    }),
  );
  assert.equal(shipOverSourceBlock.finalStatus, "BLOCK");

  // BLOCK recommendation over an otherwise-clean chapter does NOT fabricate a block.
  assert.equal(aggregateChapterReview(mkInput({ reader: mkReader({ recommendation: "BLOCK" }) })).finalStatus, "PASS");

  // finalStatus is invariant under the recommendation with the lanes held fixed.
  const base = mkInput();
  const statuses = (["SHIP", "REVISE", "BLOCK"] as const).map(
    (rec) => aggregateChapterReview({ ...base, reader: mkReader({ recommendation: rec }) }).finalStatus,
  );
  assert.deepEqual(statuses, ["PASS", "PASS", "PASS"], "the recommendation never moves a clean chapter's final status");
});

// ══════════════════════════════════════════════════════════════════════════════
// 8 — routing one candidate cell to a different primary judge is rejected
// ══════════════════════════════════════════════════════════════════════════════
test("red-team 8: routing one candidate cell to a different primary judge is rejected (assignment invariant)", () => {
  const spec = confirmatorySpec({ judgePanel: TWO_JUDGE_PANEL });
  const cells = ["55-H", "55-XH", "56S-H", "56S-XH"];
  // Every attempt to vary the assignment via execution order / cell / sample index
  // / candidate-model returns the SAME fixed primary (panel[0]).
  const first = assignFixedRoles(spec, mkRecord());
  for (let i = 0; i < 24; i++) {
    const a = assignFixedRoles(spec, mkRecord({ executionOrder: i * 3 + 1, cellId: cells[i % cells.length], sampleIndex: (i % 2) + 1 }));
    assert.deepEqual(a.readerPrimary, first.readerPrimary, "reader primary invariant");
    assert.deepEqual(a.sourcePrimary, first.sourcePrimary, "source primary invariant");
    assert.deepEqual(a.quizAdjudicator, first.quizAdjudicator, "quiz adjudicator invariant");
  }
  assert.equal(first.readerPrimary.profileId, "gpt-5.5@high", "the fixed primary is panel[0]");

  // The historical rotation would have selected panel[1] at executionOrder 1 —
  // the fixed assignment refuses that route.
  const atOrder1 = assignFixedRoles(spec, mkRecord({ executionOrder: 1, cellId: "56S-XH", sampleIndex: 1 }));
  assert.equal(atOrder1.readerPrimary.profileId, "gpt-5.5@high");
  assert.notEqual(atOrder1.readerPrimary.profileId, "gpt-5.6-sol@xhigh", "no execution-order rotation reaches the primary");
});

// ══════════════════════════════════════════════════════════════════════════════
// 9 — backup selection after seeing output is rejected
// ══════════════════════════════════════════════════════════════════════════════
test("red-team 9: backup selection after seeing output is rejected (frozen audit subset only)", () => {
  const spec = confirmatorySpec({ judgePanel: TWO_JUDGE_PANEL });

  // Membership depends ONLY on the frozen schedule coordinate (sample index),
  // never on the review outcome: attaching a passing vs failing review cannot
  // move a sample into or out of the audit subset.
  const inSubjectNoReview = mkRecord({ sampleIndex: 1, review: null });
  const inSubjectPass = mkRecord({ sampleIndex: 1, review: { ...REVIEW_SUMMARY, pass: true } });
  const inSubjectFail = mkRecord({ sampleIndex: 1, review: { ...REVIEW_SUMMARY, pass: false } });
  assert.equal(isInFrozenAuditSubset(spec, inSubjectNoReview), true);
  assert.equal(isInFrozenAuditSubset(spec, inSubjectPass), true);
  assert.equal(isInFrozenAuditSubset(spec, inSubjectFail), true, "a backup is never re-selected by the review outcome");

  // An out-of-subset sample is never rescued into a backup read by its output.
  const outPass = mkRecord({ sampleIndex: 2, executionOrder: 7, review: { ...REVIEW_SUMMARY, pass: true } });
  const outFail = mkRecord({ sampleIndex: 2, executionOrder: 9, review: { ...REVIEW_SUMMARY, pass: false } });
  assert.equal(isInFrozenAuditSubset(spec, outPass), false);
  assert.equal(isInFrozenAuditSubset(spec, outFail), false, "an inconvenient candidate cannot be re-rolled onto a backup read");

  // And it is independent of execution order / cell / authoring model.
  assert.equal(isInFrozenAuditSubset(spec, mkRecord({ sampleIndex: 1, executionOrder: 99, cellId: "56S-XH" })), true);
});

// ══════════════════════════════════════════════════════════════════════════════
// 10 — silently omitted corpus variants throw
// ══════════════════════════════════════════════════════════════════════════════
test("red-team 10: silently omitted corpus variants throw (builder fails closed, never [])", () => {
  // A missing mutation spec throws — never substitutes an empty variant set
  // (the E-09 `existsSync ? … : []` silent-drop defect is removed).
  const missing = resolve(PIPELINE_ROOT, "state", "migration-experiments", "contracts", "does-not-exist-red-team.json");
  assert.throws(() => readMutationSpec(missing, "source"), CorpusBuildError);

  // A shrunk composition fails closed rather than emit a smaller corpus.
  assert.throws(
    () => assertComposition({ total: 40, supported: 10, unsupported: 10 }, { supported: 10, unsupported: 6 }, "source"),
    (err: unknown) => err instanceof CorpusBuildError && /fails closed rather than shrink/.test((err as Error).message),
  );
  // A full composition does NOT throw.
  assert.doesNotThrow(() => assertComposition({ total: 20, a: 10, b: 10 }, { a: 10, b: 10 }, "source"));
});

// ══════════════════════════════════════════════════════════════════════════════
// 11 — rebuilding from a private temp path is impossible
// ══════════════════════════════════════════════════════════════════════════════
test("red-team 11: rebuilding from a private temp path is impossible (no absolute/env literals in the four builder files)", () => {
  const builders = [
    "src/bakeoff/migration/corpusBuilderCore.ts",
    "src/bakeoff/migration/readerCorpusBuilder.ts",
    "src/bakeoff/migration/sourceCorpusBuilder.ts",
    "src/bakeoff/migration/quizCorpusBuilder.ts",
  ];
  for (const rel of builders) {
    const text = readSrc(rel);
    assert.ok(!/\/Users\//.test(text), `${rel} must not embed a /Users/ absolute path`);
    assert.ok(!/\/private\/tmp\//.test(text), `${rel} must not embed a /private/tmp/ absolute path`);
    assert.ok(!/process\.env/.test(text), `${rel} must not read ambient process.env — roots arrive via typed config`);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// 12 — altering an old §16 seal is detected
// ══════════════════════════════════════════════════════════════════════════════
const CLOSURE_JSON = resolve(MIG, "S16_LEGACY_CAMPAIGN_CLOSURE.json");

function readClosure(): ClosedExperimentRegistryV1 {
  return JSON.parse(readFileSync(CLOSURE_JSON, "utf8")) as ClosedExperimentRegistryV1;
}

function allPreservedPresent(): boolean {
  try {
    if (!existsSync(CLOSURE_JSON)) return false;
    const closure = readClosure();
    const hashes = closure.preservedArtifactHashes;
    if (!hashes || Object.keys(hashes).length === 0) return false;
    return Object.keys(hashes).every((rel) => existsSync(resolve(MIG, rel)));
  } catch {
    return false;
  }
}

xenv(
  "red-team 12: altering an old §16 seal is detected (preserved-artifact hashes re-verify against disk)",
  "preserved migration-experiment evidence absent on a bare checkout",
  allPreservedPresent,
  () => {
    const closure = readClosure();
    const sha256Bytes = (buf: Buffer): string => createHash("sha256").update(buf).digest("hex");

    // (a) Every preserved artifact currently matches its recorded hash — old
    //     evidence is byte-unchanged.
    let seals = 0;
    for (const [rel, expected] of Object.entries(closure.preservedArtifactHashes)) {
      const abs = resolve(MIG, rel);
      const bytes = readFileSync(abs);
      assert.equal(sha256Bytes(bytes), expected, `preserved §16 artifact ${rel} changed — old evidence must be immutable`);
      if (/seal/i.test(rel)) seals += 1;

      // (b) A simulated one-byte alteration is DETECTED: the recomputed hash of
      //     mutated bytes never equals the recorded hash. (In-memory only — no
      //     disk write; old evidence stays untouched.)
      const mutated = Buffer.concat([bytes, Buffer.from("X")]);
      assert.notEqual(sha256Bytes(mutated), expected, `an alteration of ${rel} would be detected`);
    }

    // The recorded old seals are inventoried with their sealSha256 (a re-seal
    // would mint a different sha, and the closed-id freeze blocks resume anyway).
    assert.ok(Array.isArray(closure.oldSeals) && closure.oldSeals.length >= 5, "old seals are inventoried");
    assert.ok(seals >= 1 || closure.oldSeals.length >= 5, "seal artifacts are covered by the immutability map or the seal inventory");
  },
);

// ══════════════════════════════════════════════════════════════════════════════
// 13 — API provider use throws at the router
// ══════════════════════════════════════════════════════════════════════════════
test("red-team 13: API provider use hits stable legacy-route disable before provider execution", async () => {
  for (const provider of ["anthropic-api", "openai-api"] as const) {
    await assert.rejects(
      () => callModel({ tier: "critic", system: "s", user: "u", provider }),
      (err: unknown) => err instanceof Error && err.message === `${LEGACY_ROUTE_DISABLED_CODE}:providers.callModel`,
      `a billed ${provider} call must be refused at the router choke`,
    );
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// 14 — adding a content retry beyond the bounded infra-replay policy is rejected
// ══════════════════════════════════════════════════════════════════════════════
test("red-team 14: adding a content retry beyond the bounded infra-replay policy is rejected", () => {
  // One-attempt discipline: a non-first-write or a complaint-carrying write is
  // refused — there is NO content/repair retry path.
  assert.throws(() => assertOneAttemptOpts({ firstWriteOnly: false }), MigrationGuardError);
  assert.throws(() => assertOneAttemptOpts({ firstWriteOnly: true, complaints: ["fix the hook"] }), MigrationGuardError);
  assert.doesNotThrow(() => assertOneAttemptOpts({ firstWriteOnly: true }));
  assert.doesNotThrow(() => assertOneAttemptOpts({ firstWriteOnly: true, complaints: [] }));

  // The recovery spec's bounded retry is infra-only: at most one replay per call
  // and ONLY for disjoint provider-infrastructure outcomes — never a content,
  // safeguard, or output-informed retry.
  const spec = buildRecoveryExperimentSpec(mkRecoveryInputs());
  const retry = spec.execution.boundedRetry;
  assert.equal(retry.maxReplaysPerCall, 1, "replays are bounded to one per call");
  for (const forbidden of ["content_completed", "content_invalid", "provider_safeguard_or_refusal", "policy_preflight_failure"]) {
    assert.ok(!retry.replayableOutcomes.includes(forbidden as never), `${forbidden} is never a replayable outcome (no content/safeguard retry)`);
  }
  for (const o of retry.replayableOutcomes) {
    assert.ok(["infrastructure_failure", "timeout", "provider_rate_or_capacity"].includes(o), `only infra-class outcomes replay (got ${o})`);
  }
  // The pilot preflight explicitly stops on an unbounded/hidden retry.
  assert.ok((RECOVERY_PILOT_STOP_CONDITIONS as readonly string[]).some((c) => /unbounded or hidden retry/.test(c)), "the pilot halts on an unbounded/hidden retry");
});

// ══════════════════════════════════════════════════════════════════════════════
// 15 — a book-specific exception has no code path
// ══════════════════════════════════════════════════════════════════════════════
test("red-team 15: a book-specific exception has no code path (config surfaces accept no bookId-conditional override)", () => {
  // The recovery spec never carries a book-specific exception, for any inputs.
  for (const inputs of [mkRecoveryInputs(), mkRecoveryInputs({ readerCorpusSha256: "other", diagnosticSeed: "seed-z" })]) {
    const spec = buildRecoveryExperimentSpec(inputs);
    assert.deepEqual(spec.bookSpecificExceptions, [], "no per-book exception is ever minted");
  }

  // Prove by ABSENCE: the aggregator + its input contract carry no bookId branch
  // — the decision surface cannot be conditioned on a specific book.
  for (const rel of ["src/review/aggregateChapterReview.ts", "src/contracts/aggregateChapterReview.ts"]) {
    const text = readSrc(rel);
    assert.ok(!/\bbookId\b/.test(text), `${rel} must contain no bookId-conditional (no per-book branch in the aggregator/config)`);
  }

  // The aggregator input type has no bookId field, so an attacker cannot even
  // pass a book identity into the final-status decision. (Type-level: mkInput has
  // no bookId key; a runtime probe confirms the shape.)
  const probe = mkInput() as Record<string, unknown>;
  assert.ok(!("bookId" in probe), "the aggregator input carries no bookId");
});

// ══════════════════════════════════════════════════════════════════════════════
// integration 15 — every model-bearing route resolves to ChatGPT codex exec
// ══════════════════════════════════════════════════════════════════════════════
function mkRoute(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema: "route-result-v1",
    taskClass: "bakeoff-judge",
    profileName: "reader-primary",
    routePolicyVersion: "route-policy-v1",
    requestedModel: "gpt-5.5",
    requestedEffort: "high",
    executionProfileHash: "eph-1",
    cliVersion: "cli-1",
    outcome: "content_completed",
    driftFingerprint: "df-1",
    ...over,
  };
}

test("integration 15: every model-bearing route resolves to ChatGPT-authenticated codex exec", () => {
  // A real subscription route MUST be authMode "chatgpt", no API key, no fallback.
  assert.deepEqual(
    validateRouteResult(mkRoute({ executionRoute: "codex_exec_chatgpt_subscription", authMode: "chatgpt", apiKeyPresent: false, apiFallbackAllowed: false })),
    [],
    "the subscription route validates when authMode is chatgpt",
  );

  // Downgrading the subscription route to authMode "test" is rejected.
  assert.ok(
    validateRouteResult(mkRoute({ executionRoute: "codex_exec_chatgpt_subscription", authMode: "test", apiKeyPresent: false, apiFallbackAllowed: false }))
      .some((e) => /subscription route requires authMode "chatgpt"/.test(e)),
    "a chatgpt-subscription route cannot claim the test authMode",
  );

  // Claiming an API key on any route is rejected (an API-key spawn is unrepresentable).
  assert.ok(
    validateRouteResult(mkRoute({ executionRoute: "codex_exec_chatgpt_subscription", authMode: "chatgpt", apiKeyPresent: true, apiFallbackAllowed: false }))
      .some((e) => /apiKeyPresent must be recorded false/.test(e)),
    "an API-key-present route is rejected",
  );
  assert.ok(
    validateRouteResult(mkRoute({ executionRoute: "codex_exec_chatgpt_subscription", authMode: "chatgpt", apiKeyPresent: false, apiFallbackAllowed: true }))
      .some((e) => /apiFallbackAllowed must be recorded false/.test(e)),
    "an API-fallback-allowed route is rejected",
  );

  // The ONLY other legal route is the injected test runner (authMode "test") —
  // the path the pilot dry run uses; it may never claim the chatgpt authMode.
  assert.deepEqual(
    validateRouteResult(mkRoute({ executionRoute: "injected_test_runner", authMode: "test", apiKeyPresent: false, apiFallbackAllowed: false })),
    [],
    "the injected test route validates with authMode test",
  );
  assert.ok(
    validateRouteResult(mkRoute({ executionRoute: "injected_test_runner", authMode: "chatgpt", apiKeyPresent: false, apiFallbackAllowed: false }))
      .some((e) => /injected test route requires authMode "test"/.test(e)),
    "the test route cannot masquerade as the subscription route",
  );

  // The pilot dry run's planned spawns ALL resolve to the injected test route —
  // no subscription/API route is exercised in this package.
  const spec = buildRecoveryExperimentSpec(mkRecoveryInputs());
  const dry = runRecoveryPilotDryRun(spec, { assertNotClosed }, "2026-07-12T00:00:00.000Z");
  assert.ok(dry.plannedSpawns.length > 0);
  assert.equal(dry.routeInvariantHeld, true);
  assert.equal(dry.modelCallsMade, 0);
  assert.equal(dry.apiCallsMade, 0);
  for (const s of dry.plannedSpawns) {
    assert.equal(s.route.executionRoute, "injected_test_runner");
    assert.equal(s.route.authMode, "test");
    assert.equal(s.route.apiKeyPresent, false);
    assert.equal(s.route.apiFallbackAllowed, false);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// integration 16 — no API provider or fallback is reachable
// ══════════════════════════════════════════════════════════════════════════════
test("integration 16: no API provider or fallback is reachable (static import proof + router choke)", async () => {
  // STATIC: the new split-lane review + recovery modules import NO api-provider
  // module (anthropic-api / openai-api) and no direct provider/router surface —
  // there is no code path from a lane to a billed provider.
  const modules = [
    "src/review/readerExperienceReview.ts",
    "src/review/sourceIntegrityReview.ts",
    "src/review/quizIntegrityReview.ts",
    "src/review/aggregateChapterReview.ts",
    "src/bakeoff/migration/recoveryExperiment.ts",
  ];
  const importLine = /^\s*(import\b|export\b[^=]*\bfrom\b)/;
  for (const rel of modules) {
    for (const line of readSrc(rel).split("\n")) {
      if (!importLine.test(line)) continue;
      assert.ok(!/anthropic-api|openai-api/.test(line), `${rel} must not import an API-provider module: ${line.trim()}`);
      assert.ok(!/providers\/(anthropic|openai|cli)/.test(line), `${rel} must not import a concrete provider adapter: ${line.trim()}`);
    }
  }

  // DYNAMIC: even if some path reached retired router, stable disable throws for
  // every billed provider before any adapter loads or network call occurs.
  const isStableDisabled = (error: unknown): boolean =>
    error instanceof Error && error.message === `${LEGACY_ROUTE_DISABLED_CODE}:providers.callModel`;
  await assert.rejects(() => callModel({ tier: "writer", system: "s", user: "u", provider: "openai-api" }), isStableDisabled);
  await assert.rejects(() => callModel({ tier: "writer", system: "s", user: "u", provider: "anthropic-api" }), isStableDisabled);
});
