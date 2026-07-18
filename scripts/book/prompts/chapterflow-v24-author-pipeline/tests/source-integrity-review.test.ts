/**
 * IMP-20 §B / WP-B2 — the source-and-claim-integrity lane.
 *
 * Covers IMP-20 unit tests 4-12 + integration 8, plus the R-9 packet-blindness
 * requirement. Every semantic verdict is INJECTED through the fake `deps.spawn`
 * seam (mirroring quiz-two-phase.test.ts / native-review-runner.test.ts): the test
 * constructs a canned strict-schema-valid SourceIntegrityReviewV1 model output,
 * the lane parses + hash-stamps + strict-validates it, and the assertions check the
 * lane's composition of {deterministic bundle} ∪ {semantic verdict}. ZERO live
 * model calls — the deterministic-block / stale / refuse paths never even reach the
 * seam, and the seam is a fake that returns a string.
 */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import { fxChapter, fxPacket, fxPlan, fxPlanUnit } from "./migrationFixtures.js";
import type { ChapterV21 } from "../src/types.js";
import type { SourceUsePlanV1 } from "../src/contracts/sourceUsePlan.js";
import type { SourcePacketV1 } from "../src/artifacts/artifactTypes.js";
import type { SourceIntegrityReviewUnitV1 } from "../src/contracts/sourceIntegrityReview.js";
import { sourcePacketHash } from "../src/compiler/sourcePacket.js";
import {
  assembleSourceReviewPacket,
  buildSourceIntegrityTask,
  computeRequiredSourceUnitIds,
  parseSourceIntegrityReview,
  runSourceDeterministicPrechecks,
  runSourceIntegrityReview,
  SOURCE_CRITIC_INFRASTRUCTURE_FAILURE_CHECK_ID,
  SourceIntegrityLaneError,
  summarizeDeterministicBundle,
  type SourceIntegrityLaneInputV1,
  type SourceIntegritySpawnFn,
} from "../src/review/sourceIntegrityReview.js";

const SCHEMA_SHA = "a".repeat(64);

// ── fixtures ──────────────────────────────────────────────────────────────────

function sourceChapter(over: Partial<ChapterV21> = {}): ChapterV21 {
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
        { questionId: "q1", prompt: "Why did completion rise?", choices: ["The team advertised", "A field was removed", "Users were paid"], correctIndex: 1, explanation: "SECRET-KEY-EXPLANATION: the prose credits removing a field." },
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
  } as Partial<ChapterV21>);
}

/** A packet whose plan is FRESH (plan.sourcePacketSha256 === live packet hash). */
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

const NON_V2_SIDECAR = { schemaVersion: "source-v1", namedExamples: [] as unknown[] };

function baseInput(over: Partial<SourceIntegrityLaneInputV1> = {}): SourceIntegrityLaneInputV1 {
  const packet = freshPacket();
  const chapter = sourceChapter();
  return {
    chapter,
    plan: freshPlan(packet),
    packet,
    sidecar: NON_V2_SIDECAR,
    anchorCatalog: packet.allowedAnchors,
    schemaSha256: SCHEMA_SHA,
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

function modelReply(
  units: SourceIntegrityReviewUnitV1[],
  result: "PASS" | "BLOCK" | "INCONCLUSIVE",
  blockingFindingIds: string[] = [],
  rationale = "test verdict",
): string {
  return "```json\n" + JSON.stringify({ schema: "source-integrity-review-v1", units, result, blockingFindingIds, rationale }) + "\n```";
}

function trackedSpawn(reply: string): { fn: SourceIntegritySpawnFn; calls: () => number } {
  let called = 0;
  const fn: SourceIntegritySpawnFn = () => {
    called += 1;
    return { finalMessage: reply };
  };
  return { fn, calls: () => called };
}

// ── test 4 — the lane refuses without the plan + source hashes ────────────────

test("4: source reviewer requires the source-use plan and every source hash (refuses to run)", async () => {
  const spawn = trackedSpawn(modelReply([mkUnit()], "PASS"));

  // Missing plan → refuse.
  await assert.rejects(
    () => runSourceIntegrityReview(baseInput({ plan: null as unknown as SourceUsePlanV1 }), { spawn: spawn.fn }),
    SourceIntegrityLaneError,
  );
  // Missing bound output-schema hash → refuse.
  await assert.rejects(
    () => runSourceIntegrityReview(baseInput({ schemaSha256: "" }), { spawn: spawn.fn }),
    SourceIntegrityLaneError,
  );
  // Missing sidecar → refuse (a source blocker is unfalsifiable without evidence).
  await assert.rejects(
    () => runSourceIntegrityReview(baseInput({ sidecar: null }), { spawn: spawn.fn }),
    SourceIntegrityLaneError,
  );
  assert.equal(spawn.calls(), 0, "a refusal never reaches the model seam");
});

// ── test 5 — missing evidence → INCONCLUSIVE, never a guessed PASS ────────────

test("5: missing source evidence returns INCONCLUSIVE (never converts to PASS)", async () => {
  const spawn = trackedSpawn(
    modelReply(
      [mkUnit({ supportStatus: "INCONCLUSIVE", sourceEvidenceSpans: [], findings: [{ category: "missing_required_evidence", severity: "major", explanation: "no source evidence provided for this claim" }] })],
      "INCONCLUSIVE",
    ),
  );
  const out = await runSourceIntegrityReview(baseInput(), { spawn: spawn.fn });
  assert.equal(out.result, "INCONCLUSIVE");
  assert.notEqual(out.result, "PASS");
  assert.equal(out.review.result, "INCONCLUSIVE");
});

// ── tests 6/8/10 — clean deterministic + no semantic blocker → PASS ───────────

test("6: supported source-bound detail passes", async () => {
  const spawn = trackedSpawn(JSON.stringify({
    schema: "source-integrity-review-v1",
    units: [mkUnit({ supportStatus: "SUPPORTED" })],
    result: "PASS",
    blockingFindingIds: [],
    rationale: "schema-bound raw JSON verdict",
  }));
  const out = await runSourceIntegrityReview(baseInput(), { spawn: spawn.fn });
  assert.equal(out.result, "PASS");
  assert.equal(out.summary.hasBlocker, false, "deterministic prechecks are clean");
  assert.equal(spawn.calls(), 1, "the semantic reviewer runs on a clean deterministic bundle");
});

test("8: framed constructed application passes", async () => {
  const unit = mkUnit({
    unitId: "unit.constructed-application",
    expectedOrigin: "constructed",
    expectedForm: "application",
    visibleRegister: "clearly_constructed",
    supportStatus: "NOT_APPLICABLE",
    framingAdequate: true,
    namedSpecificityAllowed: false,
  });
  const out = await runSourceIntegrityReview(baseInput(), { spawn: trackedSpawn(modelReply([unit], "PASS")).fn });
  assert.equal(out.result, "PASS");
});

test("10: generic role scenario passes", async () => {
  const unit = mkUnit({
    unitId: "unit.generic-scenario",
    expectedOrigin: "generic",
    expectedForm: "operational_scenario",
    visibleRegister: "clearly_generic",
    supportStatus: "NOT_APPLICABLE",
    framingAdequate: null,
    namedSpecificityAllowed: false,
  });
  const out = await runSourceIntegrityReview(baseInput(), { spawn: trackedSpawn(modelReply([unit], "PASS")).fn });
  assert.equal(out.result, "PASS");
});

// ── tests 7/9/11/12 — a matching semantic blocker finding → BLOCK ─────────────

test("7: unsupported invented detail blocks", async () => {
  const unit = mkUnit({
    supportStatus: "UNSUPPORTED",
    visibleRegister: "presented_as_fact",
    findings: [{ category: "invented_detail", severity: "blocker", explanation: "invents a participant and quotation the source never records" }],
  });
  const out = await runSourceIntegrityReview(baseInput(), { spawn: trackedSpawn(modelReply([unit], "BLOCK")).fn });
  assert.equal(out.result, "BLOCK");
  assert.ok(out.review.blockingFindingIds.some((id) => id.includes("invented_detail")), "the blocking finding id names the invented-detail category");
});

test("9: unframed constructed application blocks", async () => {
  const unit = mkUnit({
    unitId: "unit.constructed-application",
    expectedOrigin: "constructed",
    expectedForm: "application",
    visibleRegister: "presented_as_fact",
    supportStatus: "NOT_APPLICABLE",
    framingAdequate: false,
    findings: [{ category: "missing_visible_framing", severity: "blocker", explanation: "reads as reported history with no hypothetical framing at first entry" }],
  });
  const out = await runSourceIntegrityReview(baseInput(), { spawn: trackedSpawn(modelReply([unit], "BLOCK")).fn });
  assert.equal(out.result, "BLOCK");
});

test("11: generic historical specificity blocks", async () => {
  const unit = mkUnit({
    unitId: "unit.generic-scenario",
    expectedOrigin: "generic",
    expectedForm: "operational_scenario",
    visibleRegister: "presented_as_fact",
    supportStatus: "NOT_APPLICABLE",
    namedSpecificityAllowed: false,
    findings: [{ category: "generic_specificity_leak", severity: "blocker", explanation: "a generic scenario invents a specific year and dollar figure" }],
  });
  const out = await runSourceIntegrityReview(baseInput(), { spawn: trackedSpawn(modelReply([unit], "BLOCK")).fn });
  assert.equal(out.result, "BLOCK");
});

test("12: causal overreach blocks", async () => {
  const unit = mkUnit({
    claimStrengthExpected: "descriptive",
    claimStrengthFit: false,
    findings: [{ category: "claim_strength_overreach", severity: "blocker", explanation: "states a guaranteed causal outcome the descriptive source cannot support" }],
  });
  const out = await runSourceIntegrityReview(baseInput(), { spawn: trackedSpawn(modelReply([unit], "BLOCK")).fn });
  assert.equal(out.result, "BLOCK");
});

// ── integration 8 — a stale source-use plan invalidates the lane ──────────────

test("integration 8: a stale source-use plan short-circuits to INCONCLUSIVE without a model call", async () => {
  const packet = freshPacket();
  // A plan compiled against a DIFFERENT packet hash → sourceUsePlanStale != null.
  const stalePlan = fxPlan({ sourcePacketSha256: "0".repeat(64), units: [fxPlanUnit()] });
  const spawn = trackedSpawn(modelReply([mkUnit()], "PASS"));
  const out = await runSourceIntegrityReview(
    { chapter: sourceChapter(), plan: stalePlan, packet, sidecar: NON_V2_SIDECAR, anchorCatalog: packet.allowedAnchors, schemaSha256: SCHEMA_SHA },
    { spawn: spawn.fn },
  );
  assert.equal(out.result, "INCONCLUSIVE");
  assert.match(out.review.rationale, /stale/i);
  assert.equal(spawn.calls(), 0, "a stale plan is never sent to a model — the deterministic layer refuses first");
});

test("a deterministic critic exception fails closed to INCONCLUSIVE without a model call", async () => {
  const input = baseInput();
  const throwingUnit = { ...input.plan.units[0] };
  Object.defineProperty(throwingUnit, "claimStrength", {
    configurable: true,
    enumerable: false,
    get: () => { throw new Error("fixture critic failure"); },
  });
  input.plan = { ...input.plan, units: [throwingUnit] };

  const spawn = trackedSpawn(modelReply([mkUnit()], "PASS"));
  const out = await runSourceIntegrityReview(input, { spawn: spawn.fn });

  assert.equal(out.result, "INCONCLUSIVE");
  assert.equal(out.review.result, "INCONCLUSIVE");
  assert.equal(spawn.calls(), 0, "semantic review cannot vote away missing deterministic evidence");
  assert.ok(out.bundle.checks.some((finding) => finding.checkId === SOURCE_CRITIC_INFRASTRUCTURE_FAILURE_CHECK_ID));
  assert.match(out.review.rationale, /checkSourceRegister.*fixture critic failure/);
});

// ── deterministic authority — relabel containment blocks without a model call ──

test("deterministic relabel-containment blocks (embedded plan-control key) without a model call", async () => {
  const chapter = sourceChapter();
  (chapter as unknown as Record<string, unknown>).claimStrength = "causal"; // reserved plan-control key
  const spawn = trackedSpawn(modelReply([mkUnit()], "PASS"));
  const out = await runSourceIntegrityReview(baseInput({ chapter }), { spawn: spawn.fn });
  assert.equal(out.result, "BLOCK");
  assert.equal(out.summary.hasBlocker, true);
  assert.ok(out.summary.blockerCheckIds.some((id) => id.startsWith("SUP.embedded_plan_mutation")));
  assert.equal(spawn.calls(), 0, "a deterministic blocker is never re-voted by the model");
});

// ── R-9 packet blindness + rules-from-arrays (explicit WP requirement) ────────

test("R-9: the source packet excludes model identity, prior verdicts, acceptance, and the answer key", () => {
  const packet = freshPacket();
  const chapter = sourceChapter();
  const reviewPacket = assembleSourceReviewPacket(chapter, freshPlan(packet), packet, NON_V2_SIDECAR, packet.allowedAnchors);
  const task = buildSourceIntegrityTask(reviewPacket, { outputSchemaRelPath: "schemas/source-integrity-review.schema.json", schemaSha256: SCHEMA_SHA });

  // The chapter is rendered key-blind: no answer key, no explanation text.
  assert.ok(!reviewPacket.chapterDocument.includes("## ANSWER KEY"), "no answer-key section in the packet");
  assert.ok(!reviewPacket.chapterDocument.includes("SECRET-KEY-EXPLANATION"), "no quiz explanation (key tell) in the packet");
  assert.ok(!/^Q\d+:\s[abc]/m.test(reviewPacket.chapterDocument), "no key rows in the packet");

  // The task never carries model identity, stack, prior verdicts, acceptance, or the key.
  for (const forbidden of ["## ANSWER KEY", "SECRET-KEY-EXPLANATION", "correctIndex", "ship84", "recommendation", "acceptance", "executionOrder", "gpt-5", "sol-high"]) {
    assert.ok(!task.task.includes(forbidden), `task must not contain "${forbidden}"`);
  }
  // Untrusted-data barrier present, and the rules are GENERATED from the compiler arrays.
  assert.ok(task.task.includes("UNTRUSTED SOURCE DATA"), "non-instruction artifacts are wrapped as untrusted data");
  assert.ok(task.task.includes("invented_dialogue"), "case-forbidden kinds come from CASE_DETAIL_FORBIDDEN");
  assert.ok(task.task.includes("fabricated_statistic"), "constructed-forbidden kinds come from CONSTRUCTED_DETAIL_FORBIDDEN");
  assert.ok(task.task.includes("INCONCLUSIVE"), "the missing-evidence rule is stated");
  assert.ok(task.task.includes(`REQUIRED REVIEW UNIT IDS: ${reviewPacket.requiredSourceUnitIds.join(", ")}`), "the semantic reviewer is bound to exact plan-unit ids");
  assert.ok(task.task.includes("A BLOCK result requires at least one finding with severity blocker"), "BLOCK severity consistency is explicit");
  assert.match(task.task, /emit only the JSON object conforming to the bound output schema/i);
  assert.doesNotMatch(task.task, /exactly one fenced/i);
  assert.equal(task.role, "source-verifier", "reuses the existing source-verifier workspace role (R-5)");
});

// ── unit-level helper coverage ────────────────────────────────────────────────

test("required-source-unit predicate = source_bound + anchored", () => {
  const plan = fxPlan({
    units: [
      fxPlanUnit({ unitId: "u.bound.anchored", origin: "source_bound", anchorIds: ["a1"] }),
      fxPlanUnit({ unitId: "u.bound.unanchored", origin: "source_bound", anchorIds: [] }),
      fxPlanUnit({ unitId: "u.generic", origin: "generic", anchorIds: [] }),
    ],
  });
  assert.deepEqual(computeRequiredSourceUnitIds(plan), ["u.bound.anchored"]);
});

test("the deterministic bundle summary counts only blocker-severity findings", () => {
  const packet = freshPacket();
  const bundle = runSourceDeterministicPrechecks(sourceChapter(), freshPlan(packet), packet, NON_V2_SIDECAR);
  const summary = summarizeDeterministicBundle(bundle);
  // A clean fixture yields at most a `major` SC11.0 shadow (no on-disk source run) —
  // never a blocker.
  assert.equal(summary.hasBlocker, false);
  assert.ok(bundle.checks.every((c) => c.severity !== "blocker"));
  assert.equal(summary.bundleSha256, bundle.bundleSha256);
});

test("parseSourceIntegrityReview accepts schema-bound raw JSON, retains the fence fallback, and rejects malformed output", () => {
  const raw = JSON.stringify({
    schema: "source-integrity-review-v1",
    units: [mkUnit()],
    result: "PASS",
    blockingFindingIds: [],
    rationale: "raw",
  });
  assert.equal(parseSourceIntegrityReview(raw)?.result, "PASS");
  const good = parseSourceIntegrityReview(modelReply([mkUnit()], "PASS"));
  assert.ok(good && good.result === "PASS");
  assert.equal(parseSourceIntegrityReview("no fence here"), null);
  assert.equal(parseSourceIntegrityReview("```json\n{\"schema\":\"wrong\"}\n```"), null);
});
