/**
 * IMP-20 WP-C2 — SPLIT-LANE END-TO-END INTEGRATION (integration tests 1-16).
 *
 * This file wires the three independent review lanes (reader-experience §A,
 * source-and-claim-integrity §B, quiz-integrity §C), the deterministic
 * aggregator (§D), the fixed role-assignment harness (§G), the recovery
 * experiment (§M/§N), the §16 closure freeze (§K), and the ChatGPT-subscription
 * route invariant into full end-to-end flows over shared, self-contained
 * fixtures. Every model-bearing surface is exercised model-free: the reader /
 * source verdicts arrive through injected `reviewFn`/`deps.spawn` seams that
 * return canned strict-schema-valid fenced JSON, and the quiz lane runs the real
 * two-phase blindness protocol over an injected phase-2 adjudication reply. There
 * is ZERO live model call, ZERO `codex exec`, ZERO API/network anywhere, and no
 * write outside process memory (nothing is persisted to disk).
 *
 *   integration 1  complete reader lane over a full chapter
 *   integration 2  complete source lane over a source-bound case
 *   integration 3  complete source lane over constructed + generic cases
 *   integration 4  complete two-phase quiz lane
 *   integration 5  full aggregation across all three lanes
 *   integration 6  fixed-role review of all four candidate cells (fixed primary)
 *   integration 7  balanced audit subset
 *   integration 8  stale source-use plan invalidation
 *   integration 9  changed chapter invalidates every lane result
 *   integration 10 changed prompt/schema invalidates qualification
 *   integration 11 changed role assignment invalidates the experiment seal
 *   integration 12 old campaign cannot resume (every closed id, every choke)
 *   integration 13 new campaign cannot start before role qualification
 *   integration 14 pilot dry run makes zero model calls
 *   integration 15 every model-bearing route resolves to ChatGPT `codex exec`
 *   integration 16 no API provider / fallback reachable
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { test } from "./harness.js";
import { fxChapter, fxPacket, fxPlan, fxPlanUnit } from "./migrationFixtures.js";
import { confirmatorySpec } from "./migration-helpers.js";
import { fakeAutopilotDeps } from "./model-bakeoff-helpers.js";

import type { ChapterV21 } from "../src/types.js";
import type { SourceUsePlanV1 } from "../src/contracts/sourceUsePlan.js";
import type { SourcePacketV1 } from "../src/artifacts/artifactTypes.js";
import type { AutopilotDeps } from "../src/orchestrator/autopilot.js";
import type { MigrationSampleRecordV1 } from "../src/bakeoff/migration/experimentTypes.js";

import { hashCanonical } from "../src/contracts/contractUtil.js";
import { chapterContentHash } from "../src/critics/qcAttestation.js";
import { sourcePacketHash } from "../src/compiler/sourcePacket.js";
import { LEGACY_ROUTE_DISABLED_CODE } from "../src/runtime/legacyRouteInventory.js";

// ── reader lane (§A) ──────────────────────────────────────────────────────────
import {
  buildReaderExperienceTask,
  readerExperienceDocHash,
  runReaderExperienceReview,
} from "../src/review/readerExperienceReview.js";
import {
  READER_EXPERIENCE_RUBRIC_VERSION,
  readerReviewIsFresh,
  validateReaderExperienceReview,
} from "../src/contracts/readerExperienceReview.js";

// ── source lane (§B) ──────────────────────────────────────────────────────────
import {
  computeRequiredSourceUnitIds,
  runSourceIntegrityReview,
  type SourceIntegrityLaneInputV1,
  type SourceIntegritySpawnFn,
} from "../src/review/sourceIntegrityReview.js";
import {
  sourceReviewIsFresh,
  type SourceIntegrityReviewUnitV1,
} from "../src/contracts/sourceIntegrityReview.js";

// ── quiz lane (§C) ────────────────────────────────────────────────────────────
import {
  buildQuizDerivation,
  commitQuizDerivation,
  type ReaderDerivationDetail,
} from "../src/review/quizDerivation.js";
import {
  chapterContentShaFor,
  QUIZ_INTEGRITY_ADJUDICATION_SCHEMA,
  runQuizIntegrityLane,
} from "../src/review/quizIntegrityReview.js";
import { validateQuizIntegrityResult } from "../src/contracts/quizIntegrityReview.js";

// ── aggregation (§D) ──────────────────────────────────────────────────────────
import { aggregateChapterReview, computeReaderComposite } from "../src/review/aggregateChapterReview.js";
import { validateAggregatedChapterReview } from "../src/contracts/aggregateChapterReview.js";

// ── fixed role assignment (§G) ────────────────────────────────────────────────
import { assignFixedRoles, isInFrozenAuditSubset } from "../src/bakeoff/migration/reviewerRoleAssignment.js";
import { panelAssignment } from "../src/bakeoff/migration/reviewRunner.js";

// ── closure freeze (§K) ───────────────────────────────────────────────────────
import { CLOSED_EXPERIMENT_IDS, MigrationGuardError, assertNotClosed } from "../src/bakeoff/migration/guards.js";
import { runMigrationExperiment } from "../src/bakeoff/migration/runExperiment.js";
import { runNativeReviewQualification, type RunNativeReviewOptions } from "../src/bakeoff/migration/nativeReviewRunner.js";
import { sealNativeReview } from "../src/bakeoff/migration/nativeReviewSeal.js";

// ── recovery experiment (§M/§N) ───────────────────────────────────────────────
import {
  buildRecoveryExperimentSpec,
  buildSplitLaneInstrumentManifest,
  prepareRecoverySeal,
  recoveryQualificationIsFresh,
  recoverySpecSha256,
  runRecoveryPilotDryRun,
  sealRecoveryExperiment,
  splitLaneInstrumentManifestSha256,
  RECOVERY_CANDIDATE_JUDGE_PROFILES,
  RECOVERY_EXPERIMENT_ID,
  RECOVERY_REQUIRED_ROLES,
  type RecoverySpecInputsV1,
} from "../src/bakeoff/migration/recoveryExperiment.js";
import type {
  ReviewLaneRole,
  RoleJudgeSelectionV1,
  RoleQualificationRegistryV1,
} from "../src/bakeoff/migration/reviewLaneTypes.js";
import type { JudgeCapabilityQualificationV1 } from "../src/contracts/judgeCapabilityQualification.js";

// ── ChatGPT-subscription route invariant (§ route proofs) ─────────────────────
import { callModel } from "../src/providers/router.js";
import { validateRouteResult, type RouteResultV1 } from "../src/contracts/routeContracts.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ══════════════════════════════════════════════════════════════════════════════
//  SHARED, SELF-CONTAINED FIXTURES (inlined; no shared fixture module)
// ══════════════════════════════════════════════════════════════════════════════

const READER_SCHEMA_SHA = "1".repeat(64);
const SOURCE_SCHEMA_SHA = "2".repeat(64);
const QUIZ_SCHEMA_SHA = "3".repeat(64);
const READER_BAR = 80;
const TS = "2026-07-12T00:00:00.000Z";

/** A complete chapter every lane can consume: full reader-facing structure for
 *  `renderChapterReaderDocPhase1` + a clean source register (deterministic
 *  prechecks stay blocker-free) + a two-question quiz for the two-phase lane. */
function fullChapter(over: Partial<ChapterV21> = {}): ChapterV21 {
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
      passingScorePercent: 70,
      // Choices are length-varied with the KEY at the middle length (index 1) so it
      // is never a unique length outlier — no accidental answer-tell (the tell is
      // advisory, but a clean chapter must carry none).
      questions: [
        { questionId: "q1", prompt: "Why did completion rise?", choices: ["Because the company advertised the change", "Because a field was cut", "Because they paid"], correctIndex: 1, explanation: "Cutting a field lowered friction." },
        { questionId: "q2", prompt: "Where does friction hide?", choices: ["Inside the quarterly budgets and plans", "Inside the defaults", "In the slogans"], correctIndex: 1, explanation: "The hook states friction hides in defaults." },
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
    ...over,
  } as Partial<ChapterV21>) as ChapterV21;
}

/** The 10 model-emitted reader fields (the binding hashes are stamped by the
 *  runtime, never supplied by the model). */
function readerModelOutput(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema: "reader-experience-review-v1",
    scores: {
      retention: 90, quizzes: 90, transfer: 90, practical: 90, summaries: 90,
      tone: 90, limits: 90, insight: 90, density: 90, beginner: 90,
    },
    quizDerivation: {
      answers: ["b", "b"],
      mechanisms: ["a field was cut", "the hook names defaults"],
      confidence: ["high", "high"],
      ambiguities: ["", ""],
      tells: [],
    },
    recommendation: "SHIP",
    blockingFindings: [],
    escalationSignals: [],
    advisoryFindings: [],
    strongestEvidence: ["Friction hides in the defaults nobody questions."],
    weakestEvidence: [],
    oneParagraphVerdict: "A clean, on-page chapter.",
    ...over,
  };
}

const NON_V2_SIDECAR = { schemaVersion: "source-v1", namedExamples: [] as unknown[] };

/** A source packet whose plan is FRESH (plan.sourcePacketSha256 === live hash). */
function freshPacket(): SourcePacketV1 {
  return fxPacket();
}

function freshPlan(packet: SourcePacketV1, over: Partial<SourceUsePlanV1> = {}): SourceUsePlanV1 {
  return fxPlan({
    sourcePacketSha256: sourcePacketHash(packet),
    units: [
      fxPlanUnit({ unitId: "unit.fact.ch01.fact.1", origin: "source_bound", form: "explanation", anchorIds: ["ch01.fact.1"], claimStrength: "descriptive" }),
    ],
    ...over,
  });
}

function sourceLaneInput(over: Partial<SourceIntegrityLaneInputV1> = {}): SourceIntegrityLaneInputV1 {
  const packet = freshPacket();
  return {
    chapter: fullChapter(),
    plan: freshPlan(packet),
    packet,
    sidecar: NON_V2_SIDECAR,
    anchorCatalog: packet.allowedAnchors,
    schemaSha256: SOURCE_SCHEMA_SHA,
    ...over,
  };
}

function mkUnit(over: Partial<SourceIntegrityReviewUnitV1> = {}): SourceIntegrityReviewUnitV1 {
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

function sourceModelReply(
  units: SourceIntegrityReviewUnitV1[],
  result: "PASS" | "BLOCK" | "INCONCLUSIVE",
  blockingFindingIds: string[] = [],
  rationale = "test verdict",
): string {
  return "```json\n" + JSON.stringify({ schema: "source-integrity-review-v1", units, result, blockingFindingIds, rationale }) + "\n```";
}

/** A source `deps.spawn` double that counts invocations and returns a canned reply. */
function trackedSourceSpawn(reply: string): { fn: SourceIntegritySpawnFn; calls: () => number } {
  let called = 0;
  const fn: SourceIntegritySpawnFn = () => {
    called += 1;
    return { finalMessage: reply };
  };
  return { fn, calls: () => called };
}

const P1SHA = "d".repeat(64);

/** Commit a BLIND quiz derivation (phase 1) BEFORE any key is applied. */
function commit(ch: ChapterV21, detail: ReaderDerivationDetail) {
  const derivation = buildQuizDerivation(ch, detail, P1SHA, "sess-1");
  const itemIds = (ch.quiz?.questions ?? []).map((q) => q.questionId);
  return commitQuizDerivation(derivation, { documentSha256: P1SHA, questionCount: itemIds.length, itemIds });
}

type AdjItem = {
  itemId: string;
  keyedAnswerIndex: number;
  derivedAnswerIndex: number;
  agreement: boolean;
  keyCorrect: "correct" | "ambiguous" | "wrong";
  rationale: string;
  defensibleAnswerIndices: number[];
  keyedMechanismSupported: boolean;
};

/** A fenced-JSON phase-2 superset adjudication reply (what the model would emit). */
function mkAdjReply(items: AdjItem[]): string {
  return "```json\n" + JSON.stringify({ schema: QUIZ_INTEGRITY_ADJUDICATION_SCHEMA, items }) + "\n```";
}

/** A migration sample record (the shape assignFixedRoles / isInFrozenAuditSubset consume). */
function mkRecord(over: Partial<MigrationSampleRecordV1> = {}): MigrationSampleRecordV1 {
  return {
    schema: "migration-sample-record-v1",
    experimentId: "exp-int",
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
    recordedAt: TS,
    ...over,
  };
}

const TWO_JUDGE_PANEL = [
  { model: "gpt-5.5", effort: "high" as const },
  { model: "gpt-5.6-sol", effort: "xhigh" as const },
];

// ── recovery-experiment fixtures ──────────────────────────────────────────────

const RECOVERY_INPUTS: RecoverySpecInputsV1 = {
  readerSchemaSha256: "reader-schema-sha-aaaa",
  sourceSchemaSha256: "source-schema-sha-bbbb",
  quizAdjudicationSchemaSha256: "quiz-schema-sha-cccc",
  executionProfileHash: "exec-profile-hash-dddd",
  routePolicyVersion: "route-policy-v1.0",
  thresholdsSha256: "thresholds-sha-eeee",
  readerCorpusSha256: "reader-corpus-sha-ffff",
  sourceCorpusSha256: "source-corpus-sha-gggg",
  quizCorpusSha256: "quiz-corpus-sha-hhhh",
  randomizationSeed: "seed-rand",
  pilotSeed: "seed-pilot",
  diagnosticSeed: "seed-diag",
};

const EMPTY_REGISTRY: RoleQualificationRegistryV1 = {
  schema: "split-lane-role-qualification-registry-v1",
  profiles: [],
};

const assertRoleSetNotReady = (): void => {
  throw new Error("no role-qualified reviewer set: registry has no qualified primary/backup");
};
const selectRoleJudgesOk = (_registry: RoleQualificationRegistryV1, role: ReviewLaneRole): RoleJudgeSelectionV1 => ({
  schema: "split-lane-role-judge-selection-v1",
  role,
  status: "SELECTED",
  primaryProfileId: RECOVERY_CANDIDATE_JUDGE_PROFILES[0].profileId,
  backupProfileId: RECOVERY_CANDIDATE_JUDGE_PROFILES[1].profileId,
  blockedReason: null,
  selectionRationale: ["highest held-out alignment"],
});

// ══════════════════════════════════════════════════════════════════════════════
//  integration 1 — complete reader lane over a full chapter
// ══════════════════════════════════════════════════════════════════════════════

test("integration 1: the reader lane runs end-to-end over a rendered full chapter and binds fresh (no model call)", async () => {
  const ch = fullChapter();
  const chapterSha = chapterContentHash(ch);
  const docSha = readerExperienceDocHash(ch);

  let sawTask = "";
  const canned = "```json\n" + JSON.stringify(readerModelOutput()) + "\n```";
  const record = await runReaderExperienceReview(
    { docRelPath: "workspace/ch01.phase1.md", chapterContentSha256: chapterSha, readerDocumentSha256: docSha, schemaSha256: READER_SCHEMA_SHA },
    { reviewFn: async (task) => { sawTask = task; return canned; } },
  );

  // The injected reviewer received the on-page-only reader task.
  assert.ok(sawTask.includes("READER-EXPERIENCE REVIEW"), "reviewFn received the built reader task");
  assert.equal(buildReaderExperienceTask("d.md").includes("You may not determine whether an external"), true);

  // The stamped record is schema-valid and binds the exact reviewed bytes.
  assert.deepEqual(validateReaderExperienceReview(record as unknown as Record<string, unknown>), []);
  assert.equal(record.rubricVersion, READER_EXPERIENCE_RUBRIC_VERSION);
  assert.equal(record.chapterContentSha256, chapterSha);
  assert.equal(record.readerDocumentSha256, docSha);
  assert.equal(record.schemaSha256, READER_SCHEMA_SHA);
  assert.equal(record.reviewerRole, "reader-experience");
  assert.ok(!("ship84" in (record as Record<string, unknown>)), "the new reader record carries no legacy ship bit");

  // Freshness binds against the exact chapter / reader-doc / reader-schema hashes.
  assert.equal(readerReviewIsFresh(record, chapterSha, docSha, READER_SCHEMA_SHA), true);
  // A one-byte drift in any bound hash stales it.
  assert.equal(readerReviewIsFresh(record, "f".repeat(64), docSha, READER_SCHEMA_SHA), false);
  assert.equal(readerReviewIsFresh(record, chapterSha, "f".repeat(64), READER_SCHEMA_SHA), false);
  assert.equal(readerReviewIsFresh(record, chapterSha, docSha, "f".repeat(64)), false);
});

// ══════════════════════════════════════════════════════════════════════════════
//  integration 2 — complete source lane over a source-bound case
// ══════════════════════════════════════════════════════════════════════════════

test("integration 2: the source lane runs end-to-end over a supported source-bound unit → PASS", async () => {
  const ch = fullChapter();
  const spawn = trackedSourceSpawn(sourceModelReply([mkUnit({ supportStatus: "SUPPORTED" })], "PASS"));
  const out = await runSourceIntegrityReview(sourceLaneInput({ chapter: ch }), { spawn: spawn.fn });

  assert.equal(out.result, "PASS");
  assert.equal(out.summary.hasBlocker, false, "deterministic prechecks are clean");
  assert.equal(spawn.calls(), 1, "the semantic reviewer runs exactly once on a clean deterministic bundle");

  // The produced record binds every required source hash, keyed to the same chapter.
  assert.equal(out.review.chapterContentSha256, chapterContentHash(ch));
  assert.equal(out.review.schemaSha256, SOURCE_SCHEMA_SHA);
  assert.equal(out.review.reviewerRole, "source-integrity");
  assert.ok(out.review.sourceUsePlanSha256.length > 0 && out.review.sourcePacketSha256.length > 0 && out.review.sidecarSha256.length > 0);

  // The source record is fresh against its own bound artifacts.
  assert.equal(
    sourceReviewIsFresh(
      out.review,
      out.review.chapterContentSha256,
      out.review.sourceUsePlanSha256,
      out.review.sourcePacketSha256,
      out.review.sidecarSha256,
      out.review.schemaSha256,
    ),
    true,
  );
});

// ══════════════════════════════════════════════════════════════════════════════
//  integration 3 — complete source lane over constructed + generic cases
// ══════════════════════════════════════════════════════════════════════════════

test("integration 3: the source lane composes constructed + generic units and discriminates framed vs unframed", async () => {
  const framedConstructed = mkUnit({
    unitId: "unit.constructed-application",
    expectedOrigin: "constructed",
    expectedForm: "application",
    visibleRegister: "clearly_constructed",
    supportStatus: "NOT_APPLICABLE",
    framingAdequate: true,
    namedSpecificityAllowed: false,
  });
  const cleanGeneric = mkUnit({
    unitId: "unit.generic-scenario",
    expectedOrigin: "generic",
    expectedForm: "operational_scenario",
    visibleRegister: "clearly_generic",
    supportStatus: "NOT_APPLICABLE",
    framingAdequate: null,
    namedSpecificityAllowed: false,
  });

  // Framed constructed + clean generic in ONE verdict → lane PASS.
  const pass = await runSourceIntegrityReview(
    sourceLaneInput(),
    { spawn: trackedSourceSpawn(sourceModelReply([framedConstructed, cleanGeneric], "PASS")).fn },
  );
  assert.equal(pass.result, "PASS");

  // An UNFRAMED constructed unit (reads as reported history) → lane BLOCK.
  const unframed = mkUnit({
    unitId: "unit.constructed-application",
    expectedOrigin: "constructed",
    expectedForm: "application",
    visibleRegister: "presented_as_fact",
    supportStatus: "NOT_APPLICABLE",
    framingAdequate: false,
    findings: [{ category: "missing_visible_framing", severity: "blocker", explanation: "reads as reported history with no hypothetical framing at first entry" }],
  });
  const blockUnframed = await runSourceIntegrityReview(sourceLaneInput(), { spawn: trackedSourceSpawn(sourceModelReply([unframed], "BLOCK")).fn });
  assert.equal(blockUnframed.result, "BLOCK");

  // A generic scenario that invents historical specificity → lane BLOCK.
  const specificGeneric = mkUnit({
    unitId: "unit.generic-scenario",
    expectedOrigin: "generic",
    expectedForm: "operational_scenario",
    visibleRegister: "presented_as_fact",
    supportStatus: "NOT_APPLICABLE",
    namedSpecificityAllowed: false,
    findings: [{ category: "generic_specificity_leak", severity: "blocker", explanation: "a generic scenario invents a specific year and dollar figure" }],
  });
  const blockGeneric = await runSourceIntegrityReview(sourceLaneInput(), { spawn: trackedSourceSpawn(sourceModelReply([specificGeneric], "BLOCK")).fn });
  assert.equal(blockGeneric.result, "BLOCK");
  assert.ok(blockGeneric.review.blockingFindingIds.some((id) => id.includes("generic_specificity_leak")));
});

// ══════════════════════════════════════════════════════════════════════════════
//  integration 4 — complete two-phase quiz lane
// ══════════════════════════════════════════════════════════════════════════════

test("integration 4: the two-phase quiz lane commits a blind derivation, then adjudicates PASS / BLOCK / INCONCLUSIVE", () => {
  const ch = fullChapter();
  const committed = commit(ch, { answers: ["b", "b"], evidence: [["a field was cut"], ["hides in defaults"]] });

  // The derivation is committed (hashed + frozen) BEFORE the key is ever applied.
  assert.ok(committed.sha256.length > 0, "phase-1 derivation is committed with a content hash");

  // A uniquely-correct, mechanism-supported adjudication → PASS.
  const passReply = mkAdjReply([
    { itemId: "q1", keyedAnswerIndex: 1, derivedAnswerIndex: 1, agreement: true, keyCorrect: "correct", rationale: "Only b is supported.", defensibleAnswerIndices: [1], keyedMechanismSupported: true },
    { itemId: "q2", keyedAnswerIndex: 1, derivedAnswerIndex: 1, agreement: true, keyCorrect: "correct", rationale: "The hook names defaults.", defensibleAnswerIndices: [1], keyedMechanismSupported: true },
  ]);
  const pass = runQuizIntegrityLane(ch, committed, passReply, { chapterContentSha256: chapterContentShaFor(ch) });
  assert.equal(pass.result, "PASS");
  assert.equal(pass.derivationSha256, committed.sha256, "the result binds the committed phase-1 derivation (two-phase blindness)");
  assert.deepEqual(validateQuizIntegrityResult(pass), []);

  // A wrong key → BLOCK.
  const wrongKey = commit(ch, { answers: ["a", "b"], evidence: [["advertised"], ["defaults"]] });
  const wrongReply = mkAdjReply([
    { itemId: "q1", keyedAnswerIndex: 1, derivedAnswerIndex: 0, agreement: false, keyCorrect: "wrong", rationale: "Choice a is best supported, not the keyed b.", defensibleAnswerIndices: [0], keyedMechanismSupported: true },
    { itemId: "q2", keyedAnswerIndex: 1, derivedAnswerIndex: 1, agreement: true, keyCorrect: "correct", rationale: "ok", defensibleAnswerIndices: [1], keyedMechanismSupported: true },
  ]);
  const block = runQuizIntegrityLane(ch, wrongKey, wrongReply, { chapterContentSha256: chapterContentShaFor(ch) });
  assert.equal(block.result, "BLOCK");
  assert.equal(block.questions[0].keyCorrect, false);

  // A missing adjudication → INCONCLUSIVE, never a silent PASS.
  const inconclusive = runQuizIntegrityLane(ch, committed, null, { chapterContentSha256: chapterContentShaFor(ch) });
  assert.equal(inconclusive.result, "INCONCLUSIVE");
  assert.ok(inconclusive.questions.every((q) => q.keyCorrect === false && q.uniqueAnswer === false), "unknown key correctness is never asserted true");
  assert.deepEqual(validateQuizIntegrityResult(inconclusive), []);
});

// ══════════════════════════════════════════════════════════════════════════════
//  integration 5 — full aggregation across all three lanes
// ══════════════════════════════════════════════════════════════════════════════

/** Run all three lanes over ONE shared chapter and return the produced records +
 *  the freshness expectations derived from them (what a real conductor binds). */
async function runAllLanes(ch: ChapterV21, opts: { sourceResult?: "PASS" | "BLOCK"; readerOver?: Record<string, unknown> } = {}) {
  const chapterSha = chapterContentHash(ch);
  const docSha = readerExperienceDocHash(ch);
  const reader = await runReaderExperienceReview(
    { docRelPath: "workspace/ch01.phase1.md", chapterContentSha256: chapterSha, readerDocumentSha256: docSha, schemaSha256: READER_SCHEMA_SHA },
    { reviewFn: async () => "```json\n" + JSON.stringify(readerModelOutput(opts.readerOver ?? {})) + "\n```" },
  );

  const packet = freshPacket();
  const plan = freshPlan(packet);
  const wantBlock = opts.sourceResult === "BLOCK";
  const unit = wantBlock
    ? mkUnit({ supportStatus: "UNSUPPORTED", visibleRegister: "presented_as_fact", findings: [{ category: "invented_detail", severity: "blocker", explanation: "invents a participant the source never records" }] })
    : mkUnit({ supportStatus: "SUPPORTED" });
  const sourceOut = await runSourceIntegrityReview(
    { chapter: ch, plan, packet, sidecar: NON_V2_SIDECAR, anchorCatalog: packet.allowedAnchors, schemaSha256: SOURCE_SCHEMA_SHA },
    { spawn: trackedSourceSpawn(sourceModelReply([unit], wantBlock ? "BLOCK" : "PASS")).fn },
  );

  const committed = commit(ch, { answers: ["b", "b"], evidence: [["a field was cut"], ["hides in defaults"]] });
  const quiz = runQuizIntegrityLane(ch, committed, mkAdjReply([
    { itemId: "q1", keyedAnswerIndex: 1, derivedAnswerIndex: 1, agreement: true, keyCorrect: "correct", rationale: "ok", defensibleAnswerIndices: [1], keyedMechanismSupported: true },
    { itemId: "q2", keyedAnswerIndex: 1, derivedAnswerIndex: 1, agreement: true, keyCorrect: "correct", rationale: "ok", defensibleAnswerIndices: [1], keyedMechanismSupported: true },
  ]), { chapterContentSha256: chapterContentShaFor(ch) });

  const input = {
    reader,
    source: sourceOut.review,
    quiz,
    deterministic: sourceOut.summary,
    readerBar: READER_BAR,
    chapterContentSha256: chapterSha,
    expectedChapterContentSha256: chapterSha,
    expectedReaderDocumentSha256: reader.readerDocumentSha256,
    expectedSourceUsePlanSha256: sourceOut.review.sourceUsePlanSha256,
    expectedSourcePacketSha256: sourceOut.review.sourcePacketSha256,
    expectedSidecarSha256: sourceOut.review.sidecarSha256,
    expectedReaderSchemaSha256: READER_SCHEMA_SHA,
    expectedSourceSchemaSha256: SOURCE_SCHEMA_SHA,
    expectedQuizSchemaSha256: QUIZ_SCHEMA_SHA,
    requiredSourceUnitIds: computeRequiredSourceUnitIds(plan),
  };
  return { reader, sourceOut, quiz, input };
}

test("integration 5: all three lanes compose through the aggregator — clean → PASS, a real source BLOCK → BLOCK", async () => {
  const ch = fullChapter();

  const clean = await runAllLanes(ch);
  const cleanAgg = aggregateChapterReview(clean.input);
  assert.equal(cleanAgg.finalStatus, "PASS");
  assert.deepEqual(cleanAgg.blockingReasons, []);
  assert.deepEqual(validateAggregatedChapterReview(cleanAgg), []);

  // The aggregate binds the exact lane result hashes (provenance, not a re-vote).
  assert.equal(cleanAgg.readerResultSha256, hashCanonical(clean.reader));
  assert.equal(cleanAgg.sourceResultSha256, hashCanonical(clean.sourceOut.review));
  assert.equal(cleanAgg.quizResultSha256, hashCanonical(clean.quiz));
  assert.equal(cleanAgg.deterministicCriticBundleSha256, clean.sourceOut.summary.bundleSha256);
  assert.equal(cleanAgg.readerComposite, computeReaderComposite(clean.reader.scores));
  assert.ok(cleanAgg.readerComposite >= READER_BAR);

  // Flip ONLY the source lane to a real BLOCK: the conductor blocks, unchanged
  // reader recommendation notwithstanding.
  const blocked = await runAllLanes(ch, { sourceResult: "BLOCK" });
  const blockedAgg = aggregateChapterReview(blocked.input);
  assert.equal(blockedAgg.finalStatus, "BLOCK");
  assert.ok(blockedAgg.blockingReasons.some((x) => x.includes("source lane BLOCK")));
  assert.equal(blocked.reader.recommendation, "SHIP", "the reader still recommended SHIP — the source lane owns the block");
});

// ══════════════════════════════════════════════════════════════════════════════
//  integration 6 — fixed-role review of all four candidate cells
// ══════════════════════════════════════════════════════════════════════════════

test("integration 6: the fixed primary judge is invariant across all four candidate cells (no execution-order rotation)", () => {
  const spec = confirmatorySpec({ judgePanel: TWO_JUDGE_PANEL });
  const cells = ["55-H", "55-XH", "56S-H", "56S-XH"];
  const orders = [0, 1, 2, 3, 5, 7, 11, 31];

  const assignments = orders.map((executionOrder, i) =>
    assignFixedRoles(spec, mkRecord({ executionOrder, cellId: cells[i % cells.length], sampleIndex: (i % 2) + 1 })),
  );
  const first = assignments[0];
  for (const a of assignments) {
    assert.deepEqual(a.readerPrimary, first.readerPrimary, "reader primary invariant across cells/orders");
    assert.deepEqual(a.sourcePrimary, first.sourcePrimary, "source primary invariant");
    assert.deepEqual(a.quizAdjudicator, first.quizAdjudicator, "quiz adjudicator invariant");
  }
  assert.equal(first.readerPrimary.profileId, "gpt-5.5@high", "the fixed primary is panel[0], not the rotated panel[order % len]");

  // Anti-rotation: at executionOrder 1 the OLD rule selected panel[1] (xhigh); the
  // fixed assignment still returns panel[0] (high). The production consumer agrees.
  const atOrder1 = assignFixedRoles(spec, mkRecord({ executionOrder: 1, cellId: "55-XH", sampleIndex: 1 }));
  assert.equal(atOrder1.readerPrimary.profileId, "gpt-5.5@high");
  assert.notEqual(atOrder1.readerPrimary.profileId, "gpt-5.6-sol@xhigh");

  const primaries = cells.map((cellId, i) => panelAssignment(spec, mkRecord({ executionOrder: i, cellId, sampleIndex: 2 })).primary);
  for (const p of primaries) {
    assert.deepEqual(p, { model: "gpt-5.5", effort: "high" }, "panelAssignment reads every cell with the same fixed primary");
  }
});

// ══════════════════════════════════════════════════════════════════════════════
//  integration 7 — balanced audit subset
// ══════════════════════════════════════════════════════════════════════════════

test("integration 7: the backup audit subset is a frozen, balanced, output-independent strict subset", () => {
  const spec = confirmatorySpec({ judgePanel: TWO_JUDGE_PANEL });
  const cells = ["55-H", "56S-H"];
  const chapters = [1, 2];
  const records: MigrationSampleRecordV1[] = [];
  let order = 0;
  for (const cellId of cells) {
    for (const chapterNumber of chapters) {
      for (const sampleIndex of [1, 2]) {
        records.push(mkRecord({ executionOrder: order++, cellId, chapterNumber, sampleIndex, blindSampleId: `${cellId}-${chapterNumber}-${sampleIndex}` }));
      }
    }
  }
  const subset = records.filter((r) => isInFrozenAuditSubset(spec, r));

  // BALANCED: exactly one audit sample per (cell × chapter) → 4 total, 2 per cell.
  assert.equal(subset.length, 4);
  for (const cellId of cells) assert.equal(subset.filter((r) => r.cellId === cellId).length, 2);
  assert.ok(subset.length < records.length, "a strict subset, never every sample");

  // FROZEN: membership depends only on the frozen coordinate, not execution order / cell / model.
  assert.equal(isInFrozenAuditSubset(spec, mkRecord({ sampleIndex: 1, executionOrder: 99, cellId: "56S-XH" })), true);
  assert.equal(isInFrozenAuditSubset(spec, mkRecord({ sampleIndex: 2, executionOrder: 0 })), false);

  // OUTPUT-INDEPENDENT: attaching a failing review never changes membership.
  const summary = { composite: 50, ship: false, keysClean: false, valid: true, pass: false, quizAdjudicationStatus: "adjudicated", complaintsMustFix: 3, reviewerSessionId: "r", judgeModel: "gpt-5.5", judgeEffort: "high" } as MigrationSampleRecordV1["review"];
  assert.equal(isInFrozenAuditSubset(spec, mkRecord({ sampleIndex: 1, executionOrder: 8, review: summary })), true);
});

// ══════════════════════════════════════════════════════════════════════════════
//  integration 8 — stale source-use plan invalidation
// ══════════════════════════════════════════════════════════════════════════════

test("integration 8: a stale source-use plan short-circuits the source lane to INCONCLUSIVE without a model call", async () => {
  const packet = freshPacket();
  const stalePlan = fxPlan({ sourcePacketSha256: "0".repeat(64), units: [fxPlanUnit()] }); // compiled against a different packet hash
  const spawn = trackedSourceSpawn(sourceModelReply([mkUnit()], "PASS"));
  const out = await runSourceIntegrityReview(
    { chapter: fullChapter(), plan: stalePlan, packet, sidecar: NON_V2_SIDECAR, anchorCatalog: packet.allowedAnchors, schemaSha256: SOURCE_SCHEMA_SHA },
    { spawn: spawn.fn },
  );
  assert.equal(out.result, "INCONCLUSIVE");
  assert.match(out.review.rationale, /stale/i);
  assert.equal(spawn.calls(), 0, "a stale plan never reaches the model — the deterministic layer refuses first");
});

// ══════════════════════════════════════════════════════════════════════════════
//  integration 9 — changed chapter invalidates every lane result
// ══════════════════════════════════════════════════════════════════════════════

test("integration 9: editing the chapter after review stales every lane → aggregate INCONCLUSIVE", async () => {
  const ch = fullChapter();
  const produced = await runAllLanes(ch);

  // The chapter is edited AFTER all three lanes ran — the current content hash moves.
  const editedSha = chapterContentHash(fullChapter({ hook: "An entirely rewritten hook that changes the page." }));
  assert.notEqual(editedSha, chapterContentHash(ch));

  const stale = aggregateChapterReview({
    ...produced.input,
    chapterContentSha256: editedSha,
    expectedChapterContentSha256: editedSha,
  });
  assert.equal(stale.finalStatus, "INCONCLUSIVE");
  assert.notEqual(stale.finalStatus, "PASS");
  assert.ok(stale.blockingReasons.some((x) => x.includes("reader review is not fresh")));
  assert.ok(stale.blockingReasons.some((x) => x.includes("source review is not fresh")));
  assert.ok(stale.blockingReasons.some((x) => x.includes("quiz review is not fresh")));
  assert.deepEqual(validateAggregatedChapterReview(stale), []);
});

// ══════════════════════════════════════════════════════════════════════════════
//  integration 10 — changed prompt/schema invalidates qualification
// ══════════════════════════════════════════════════════════════════════════════

test("integration 10: a changed reader schema (or any instrument input) stales a prior qualification via the manifest hash", () => {
  const specA = buildRecoveryExperimentSpec(RECOVERY_INPUTS);
  const manifestShaA = splitLaneInstrumentManifestSha256(specA.instrumentManifest);

  const qual: JudgeCapabilityQualificationV1 = {
    profileId: "gpt-5.5@high",
    model: "gpt-5.5",
    effort: "high",
    readerExperience: "QUALIFIED",
    sourceIntegrity: "NOT_TESTED",
    quizIntegrity: "NOT_TESTED",
    securityBoundary: "QUALIFIED",
    evidenceHashes: [],
    corpusHashes: [],
    instrumentHashes: [manifestShaA],
    qualifiedAt: TS,
  };
  assert.equal(recoveryQualificationIsFresh(qual, manifestShaA), true);

  const specB = buildRecoveryExperimentSpec({ ...RECOVERY_INPUTS, readerSchemaSha256: "reader-schema-sha-CHANGED" });
  const manifestShaB = splitLaneInstrumentManifestSha256(specB.instrumentManifest);
  assert.notEqual(manifestShaB, manifestShaA, "a changed reader schema must move the instrument manifest hash");
  assert.equal(recoveryQualificationIsFresh(qual, manifestShaB), false, "an old qualification cannot satisfy the new manifest");

  // Every behavior-affecting input moves the manifest hash.
  const drivers: Array<Partial<RecoverySpecInputsV1>> = [
    { sourceSchemaSha256: "x" }, { quizAdjudicationSchemaSha256: "x" }, { thresholdsSha256: "x" },
    { executionProfileHash: "x" }, { routePolicyVersion: "x" },
    { readerCorpusSha256: "x" }, { sourceCorpusSha256: "x" }, { quizCorpusSha256: "x" },
  ];
  for (const d of drivers) {
    const m = splitLaneInstrumentManifestSha256(buildRecoveryExperimentSpec({ ...RECOVERY_INPUTS, ...d }).instrumentManifest);
    assert.notEqual(m, manifestShaA, `changing ${Object.keys(d)[0]} must stale the manifest`);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
//  integration 11 — changed role assignment invalidates the experiment seal
// ══════════════════════════════════════════════════════════════════════════════

test("integration 11: any change to the fixed role assignment invalidates the sealed spec + manifest hash", () => {
  const spec = buildRecoveryExperimentSpec(RECOVERY_INPUTS);
  const specShaBefore = recoverySpecSha256(spec);
  const manifestShaBefore = splitLaneInstrumentManifestSha256(spec.instrumentManifest);

  const mutated = structuredClone(spec);
  mutated.roleAssignment.readerPrimary = { profileId: "gpt-5.6-sol@high", model: "gpt-5.6-sol", effort: "high" };
  assert.notEqual(recoverySpecSha256(mutated), specShaBefore, "a changed role assignment stales the sealed spec hash");

  const remanifest = buildSplitLaneInstrumentManifest(RECOVERY_INPUTS, hashCanonical(mutated.roleAssignment));
  assert.notEqual(splitLaneInstrumentManifestSha256(remanifest), manifestShaBefore, "role-assignment change moves the manifest hash");
});

// ══════════════════════════════════════════════════════════════════════════════
//  integration 12 — old campaign cannot resume (every closed id, every choke)
// ══════════════════════════════════════════════════════════════════════════════

test("integration 12: every CLOSED §16 id fails closed at every gated src choke; the recovery id is free", async () => {
  // Every archived id throws at the pure guard.
  assert.ok(CLOSED_EXPERIMENT_IDS.size >= 10, "the closed set holds every archived experiment/corpus/instrument id");
  for (const id of CLOSED_EXPERIMENT_IDS) {
    assert.throws(() => assertNotClosed(id), MigrationGuardError, `closed id ${id} must fail closed`);
  }
  // The go-forward recovery id is NOT frozen.
  assert.doesNotThrow(() => assertNotClosed(RECOVERY_EXPERIMENT_ID));

  // Choke 1 — the conductor refuses to resume any closed experiment, BEFORE any
  // live work (a throwing spawn proves nothing is spawned).
  const throwingSpawn = (async () => { throw new Error("a closure test must never spawn"); }) as unknown as AutopilotDeps["spawn"];
  const deps = fakeAutopilotDeps({ spawn: throwingSpawn }) as Partial<AutopilotDeps>;
  for (const id of ["diagnostic-stack-2026-07", "confirmatory-sol-2026-07", "layer-n-v2-qualification"]) {
    await assert.rejects(runMigrationExperiment({ experimentId: id, deps, log: () => {} }), MigrationGuardError, `resuming ${id} must halt`);
  }

  // Choke 2 — the Layer-N v2 LIVE entry refuses the closed corpus id (assertNotClosed
  // is the first statement, so a minimal corpus reaches the throw before real work).
  await assert.rejects(
    runNativeReviewQualification({ corpus: { corpusId: "s16-layer-n-native-review-v2", items: [] }, judge: { model: "gpt-5.5", effort: "high" }, log: () => {} } as unknown as RunNativeReviewOptions),
    MigrationGuardError,
  );

  // Choke 3 — re-sealing the closed Layer-N v2 corpus id is refused.
  assert.throws(
    () => sealNativeReview({ corpus: { corpusId: "s16-layer-n-native-review-v2", items: [] } } as unknown as Parameters<typeof sealNativeReview>[0]),
    MigrationGuardError,
  );
});

// ══════════════════════════════════════════════════════════════════════════════
//  integration 13 — new campaign cannot start before role qualification
// ══════════════════════════════════════════════════════════════════════════════

test("integration 13: the recovery campaign cannot seal before a role-qualified reviewer set exists (fail-closed)", () => {
  const spec = buildRecoveryExperimentSpec(RECOVERY_INPUTS);

  const prep = prepareRecoverySeal(
    spec, EMPTY_REGISTRY, RECOVERY_REQUIRED_ROLES,
    { assertNotClosed, assertRoleSetReady: assertRoleSetNotReady }, TS,
  );
  assert.equal(prep.sealed, false, "this package only prepares — it never seals");
  assert.equal(prep.roleQualifiedSetExists, false);
  assert.ok(/does not exist/.test(prep.sealBlockedReason));
  assert.equal(prep.separateAuthorizationRequired, true);

  // sealRecoveryExperiment is fail-closed: it THROWS when the role set is not ready.
  assert.throws(
    () => sealRecoveryExperiment(
      spec, EMPTY_REGISTRY, RECOVERY_REQUIRED_ROLES,
      { assertNotClosed, assertRoleSetReady: assertRoleSetNotReady, selectRoleJudges: selectRoleJudgesOk }, TS,
    ),
    /no role-qualified reviewer set/,
  );

  // Even a hypothetical ready set cannot seal a CLOSED old id.
  assert.throws(
    () => sealRecoveryExperiment(
      { ...spec, experimentId: "layer-n-v2-qualification" }, EMPTY_REGISTRY, RECOVERY_REQUIRED_ROLES,
      { assertNotClosed, assertRoleSetReady: (): void => {}, selectRoleJudges: selectRoleJudgesOk }, TS,
    ),
    MigrationGuardError,
  );
});

// ══════════════════════════════════════════════════════════════════════════════
//  integration 14 — pilot dry run makes zero model calls
// ══════════════════════════════════════════════════════════════════════════════

test("integration 14: the recovery pilot dry run plans 16 cells, makes ZERO model calls, and never reaches the spawn guard", () => {
  const spec = buildRecoveryExperimentSpec(RECOVERY_INPUTS);

  let spawnAttempts = 0;
  const onSpawnAttempt = (): never => {
    spawnAttempts += 1;
    throw new Error("a dry run must not spawn any model call");
  };

  const dry = runRecoveryPilotDryRun(spec, { assertNotClosed, onSpawnAttempt }, TS);

  // The injected spawn guard is NEVER reached, and no model / API call is counted.
  assert.equal(spawnAttempts, 0, "the spawn double must never be invoked");
  assert.equal(dry.modelCallsMade, 0);
  assert.equal(dry.apiCallsMade, 0);
  assert.equal(dry.cellCount, 16, "4 strata × 4 authoring configs × 1 sample");
  assert.equal(dry.routeInvariantHeld, true);

  // Every planned spawn resolves to the injected test route — no API, no fallback.
  for (const s of dry.plannedSpawns) {
    assert.equal(s.route.executionRoute, "injected_test_runner");
    assert.equal(s.route.authMode, "test");
    assert.equal(s.route.apiKeyPresent, false);
    assert.equal(s.route.apiFallbackAllowed, false);
  }

  // A dry run of a CLOSED old id is refused at the closure gate.
  assert.throws(
    () => runRecoveryPilotDryRun({ ...spec, experimentId: "diagnostic-stack-2026-07" }, { assertNotClosed }, TS),
    MigrationGuardError,
  );
});

// ══════════════════════════════════════════════════════════════════════════════
//  integration 15 — every model-bearing route resolves to ChatGPT `codex exec`
//  (STATIC route proof — no spawn)
// ══════════════════════════════════════════════════════════════════════════════

/** A minimal route-result with the §16 telemetry fields set. */
function mkRoute(over: Partial<RouteResultV1>): RouteResultV1 {
  return {
    schema: "route-result-v1",
    taskClass: "bakeoff-judge",
    profileName: "reader-primary",
    routePolicyVersion: "route-policy-v1.0",
    requestedModel: "gpt-5.5",
    requestedEffort: "high",
    executionProfileHash: "e".repeat(64),
    cliVersion: "codex-cli 0.144.1",
    outcome: "content_completed",
    driftFingerprint: "d".repeat(64),
    apiKeyPresent: false,
    apiFallbackAllowed: false,
    ...over,
  };
}

test("integration 15: the subscription route validates only with authMode chatgpt; the test route only with authMode test", () => {
  // A real spawn route MUST be the ChatGPT-subscription `codex exec` route with
  // authMode "chatgpt" — the validator forces this pairing.
  assert.deepEqual(
    validateRouteResult(mkRoute({ executionRoute: "codex_exec_chatgpt_subscription", authMode: "chatgpt" })),
    [],
    "codex_exec_chatgpt_subscription + authMode chatgpt validates",
  );
  assert.ok(
    validateRouteResult(mkRoute({ executionRoute: "codex_exec_chatgpt_subscription", authMode: "test" })).some((e) => /subscription route requires authMode "chatgpt"/.test(e)),
    "the subscription route with a non-chatgpt authMode is rejected",
  );

  // The injected test route (dry-run doubles) is the ONLY other legal route and
  // requires authMode "test" — it can never masquerade as a chatgpt route.
  assert.deepEqual(validateRouteResult(mkRoute({ executionRoute: "injected_test_runner", authMode: "test" })), []);
  assert.ok(
    validateRouteResult(mkRoute({ executionRoute: "injected_test_runner", authMode: "chatgpt" })).some((e) => /injected test route requires authMode "test"/.test(e)),
  );

  // An API-key-bearing spawn is unrepresentable: any route recording it is rejected.
  assert.ok(
    validateRouteResult(mkRoute({ executionRoute: "codex_exec_chatgpt_subscription", authMode: "chatgpt", apiKeyPresent: true as unknown as false })).some((e) => /apiKeyPresent must be recorded false/.test(e)),
  );

  // The recovery pilot dry-run's planned spawns are ALL the injected test route
  // (never a real subscription spawn in this package) and every one route-validates.
  const dry = runRecoveryPilotDryRun(buildRecoveryExperimentSpec(RECOVERY_INPUTS), { assertNotClosed }, TS);
  assert.ok(dry.plannedSpawns.length > 0);
  for (const s of dry.plannedSpawns) {
    assert.equal(s.route.executionRoute, "injected_test_runner");
    assert.equal(s.route.authMode, "test");
    assert.deepEqual(validateRouteResult(mkRoute({ executionRoute: s.route.executionRoute, authMode: s.route.authMode })), []);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
//  integration 16 — no API provider / fallback reachable (STATIC route proof)
// ══════════════════════════════════════════════════════════════════════════════

test("integration 16: no split-lane / recovery module imports an API provider, and the router refuses billed API calls", async () => {
  // (a) STATIC: none of the new model-bearing modules import an API-provider
  //     module or an API-key env var — the only reachable model surface is the
  //     ChatGPT-subscription codex route behind the router choke.
  const moduleRels = [
    "src/review/readerExperienceReview.ts",
    "src/review/sourceIntegrityReview.ts",
    "src/review/quizIntegrityReview.ts",
    "src/review/aggregateChapterReview.ts",
    "src/bakeoff/migration/recoveryExperiment.ts",
    "src/bakeoff/migration/reviewerRoleAssignment.ts",
  ];
  for (const rel of moduleRels) {
    const src = readFileSync(resolve(__dirname, "..", rel), "utf8");
    assert.ok(!/providers\/(anthropic-api|openai-api)/.test(src), `${rel} must not import an API-provider module`);
    assert.ok(!/from ["'][^"']*openai-api["']/.test(src) && !/from ["'][^"']*anthropic-api["']/.test(src), `${rel} must not import an API provider`);
    assert.ok(!src.includes("ANTHROPIC_API_KEY") && !src.includes("OPENAI_API_KEY"), `${rel} must not reference an API key`);
  }

  // (b) RUNTIME: the retired direct router is stably disabled before any provider
  //     adapter or network surface can run, independent of ambient environment.
  for (const provider of ["anthropic-api", "openai-api"] as const) {
    await assert.rejects(
      callModel({ tier: "critic", provider, system: "s", user: "u" }),
      (error: unknown) => error instanceof Error && error.message === `${LEGACY_ROUTE_DISABLED_CODE}:providers.callModel`,
      `a billed ${provider} call must be refused at the router choke`,
    );
  }

  // (c) STATIC contract teeth: a route recording an API fallback is unrepresentable.
  assert.ok(
    validateRouteResult(mkRoute({ executionRoute: "codex_exec_chatgpt_subscription", authMode: "chatgpt", apiFallbackAllowed: true as unknown as false })).some((e) => /apiFallbackAllowed must be recorded false/.test(e)),
  );
});
