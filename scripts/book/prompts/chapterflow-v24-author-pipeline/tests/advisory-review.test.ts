/**
 * WP-403 — advisory cross-model review lane (rescoped, non-blocking, scales pinned).
 *
 * Model-free proofs of the four rescope guarantees:
 *   1. SEVERANCE — a review verdict (BLOCK included) never blocks publish; its
 *      reasons become bounded-repair inputs + telemetry. The D7 ship gate is the
 *      only ship authority; a static guard locks promote/publish off the split-lane
 *      aggregator's finalStatus.
 *   2. SOURCE-EQUIPPED — the source lane runtime REFUSES a source-blind / dieted
 *      input fail-closed (assertSourceReviewPacketEquipped wired into the lane).
 *   3. SCALE-PINNED — every review numeric declares the single canonical scale
 *      [0,100]; an off-scale reader score or aggregate composite/bar fails validation.
 *   4. DIFFERENT-MODEL — reviewer profile ≠ writer profile is enforced (a same-model
 *      selection is BLOCKED); the D-2/M9 sol self-review fallback shifts effort +
 *      reduces finding weight and records the reviewer profile in the run ledger;
 *      advisory-finding-precision tracking with the D-2 drop condition.
 *
 * No live model calls: the source lane's spawn seam is a dummy that MUST NOT be
 * reached, and every other assertion is pure.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { test } from "./harness.js";
import { PIPELINE_DIR } from "./helpers.js";
import { fxChapter, fxPacket, fxPlan, fxPlanUnit } from "./migrationFixtures.js";
import { sha256Hex } from "../src/contracts/contractUtil.js";
import { sourcePacketHash } from "../src/compiler/sourcePacket.js";
import type { SourcePacketV1 } from "../src/artifacts/artifactTypes.js";

import type { AggregatedChapterReviewV1 } from "../src/contracts/aggregateChapterReview.js";
import { validateAggregatedChapterReview } from "../src/contracts/aggregateChapterReview.js";
import {
  REVIEW_SCORE_SCALE,
  isReviewScore,
  validateReaderExperienceReview,
  type ReaderExperienceReviewV1,
} from "../src/contracts/readerExperienceReview.js";
import { validateRepairFinding } from "../src/contracts/repairContracts.js";
import { REVIEW_FACTORS } from "../src/artifacts/artifactTypes.js";
import { SourceProjectionBoundaryError } from "../src/contracts/sourceProjectionBoundary.js";
import {
  runSourceIntegrityReview,
  type SourceIntegritySpawnFn,
} from "../src/review/sourceIntegrityReview.js";

import {
  advisoryReviewDisposition,
  reviewReasonsForRepair,
  selectAdvisoryReviewerRoles,
  assertReviewerDiffersFromWriter,
  AdvisoryRoleSelectionError,
  ADVISORY_REVIEWER_SEED_V6,
  ADVISORY_FULL_FINDING_WEIGHT,
  ADVISORY_SELF_REVIEW_FINDING_WEIGHT,
  profileId,
  emptyAdvisoryPrecisionCounter,
  recordAdvisoryFindingOutcomes,
  advisoryLanePrecision,
  advisoryLaneShouldBeDropped,
  type AdvisoryReviewerSelectionV1,
} from "../src/review/advisoryReview.js";

import {
  RUBRIC_AUDIT_BAR_D7,
} from "../src/bakeoff/migration/rubricAuditInstrument.js";
import {
  D7_REAUTHOR_BUDGET_PER_AUDIT,
  evaluateD7ShipGate,
  sealD7ShipGateReceipt,
  type D7CurrentContent,
  type D7ShipGateReceiptV1,
} from "../src/critics/d7ShipGate.js";

// ── fixtures ──────────────────────────────────────────────────────────────────

/** A fully-formed aggregate with a chosen finalStatus + reason buckets. */
function aggregate(over: Partial<AggregatedChapterReviewV1> = {}): AggregatedChapterReviewV1 {
  return {
    schema: "aggregated-chapter-review-v1",
    chapterContentSha256: "c".repeat(64),
    readerResultSha256: "r".repeat(64),
    sourceResultSha256: "s".repeat(64),
    quizResultSha256: "q".repeat(64),
    deterministicCriticBundleSha256: "d".repeat(64),
    readerComposite: 88.5,
    readerBar: 74,
    finalStatus: "PASS",
    blockingReasons: [],
    revisionReasons: [],
    escalationReasons: [],
    ...over,
  };
}

function readerReview(scoreOverride?: Partial<Record<string, number>>): ReaderExperienceReviewV1 {
  const scores = {} as Record<string, number>;
  for (const f of REVIEW_FACTORS) scores[f] = 85;
  Object.assign(scores, scoreOverride ?? {});
  return {
    schema: "reader-experience-review-v1",
    reviewerRole: "reader-experience",
    chapterContentSha256: "c".repeat(64),
    readerDocumentSha256: "e".repeat(64),
    rubricVersion: "reader-experience-review-v1",
    schemaSha256: "a".repeat(64),
    scores: scores as ReaderExperienceReviewV1["scores"],
    quizDerivation: { answers: ["a"], mechanisms: ["m"], confidence: ["high"], ambiguities: [], tells: [] },
    recommendation: "SHIP",
    blockingFindings: [],
    escalationSignals: [],
    advisoryFindings: [],
    strongestEvidence: [],
    weakestEvidence: [],
    oneParagraphVerdict: "ok",
  };
}

// ── 1. SEVERANCE: a review verdict never blocks publish ───────────────────────

test("severance: a BLOCK review verdict is advisory-only — shipBlocking is false and its reasons become repair inputs", () => {
  const blockAggregate = aggregate({
    finalStatus: "BLOCK",
    blockingReasons: ["source lane BLOCK: unit.case.ch01.ex.a::invented_detail#0", "quiz lane BLOCK: q1: wrong key"],
    revisionReasons: ["reader composite 70 is below the bar 74"],
    escalationReasons: ["reader escalation [possible_real_world_claim] @ hook: reads as factual"],
  });

  const disp = advisoryReviewDisposition(blockAggregate);
  // Type + value: the ship-blocking bit is the literal false regardless of BLOCK.
  assert.equal(disp.shipBlocking, false);
  assert.equal(disp.finalStatus, "BLOCK"); // carried as telemetry only

  // Every reason (blocking + revision + escalation) flowed into the repair stream.
  const complaints = reviewReasonsForRepair(blockAggregate);
  assert.equal(complaints.length, 4);
  assert.equal(disp.repairComplaints.length, 4);
  assert.deepEqual(disp.telemetry, { blocking: 2, revision: 1, escalation: 1 });

  // The mapped findings are contract-valid frozen RepairFindingV1 (WP-404 inputs).
  assert.equal(disp.repairFindings.length, 4);
  for (const f of disp.repairFindings) {
    assert.deepEqual(validateRepairFinding(f), []);
    assert.equal(f.schema, "repair-finding-v1");
  }
});

test("severance: a REVISE review verdict is also advisory-only (never a publish blocker)", () => {
  const disp = advisoryReviewDisposition(
    aggregate({ finalStatus: "REVISE", revisionReasons: ["reader composite 72 is below the bar 74"] }),
  );
  assert.equal(disp.shipBlocking, false);
  assert.equal(disp.repairFindings.length, 1);
});

// A tiny 1-chapter current-content map + a matching sealed PASS receipt (the same
// shape the D7 gate test builds — kept minimal here).
function currentContent(bookId: string): D7CurrentContent {
  const out: D7CurrentContent = new Map();
  const unit = `${bookId}-ch01`;
  out.set(unit, {
    chapterNumber: 1,
    contentDocSha256: sha256Hex(Buffer.from(`${unit}-doc`, "utf8")),
    headingInventorySha256: sha256Hex(Buffer.from(`${unit}-headings`, "utf8")),
  });
  return out;
}

function passReceipt(bookId: string, content: D7CurrentContent): D7ShipGateReceiptV1 {
  const chapters = [...content.entries()].map(([unit, entry]) => ({
    unit,
    chapterNumber: entry.chapterNumber,
    chapterDiagnostic: 90,
    coreDomainMin: 3.5,
    coreDomainsPass: true,
    gatesPass: true,
    layerIndependencePass: true,
    pass: true,
    contentDocSha256: entry.contentDocSha256,
    headingInventorySha256: entry.headingInventorySha256,
  }));
  return sealD7ShipGateReceipt({
    schema_version: "1.0.0",
    artifact_type: "chapterflow_d7_ship_gate_receipt",
    issuer: "chapterflow_evaluation_orchestrator",
    book_id: bookId,
    audit_id: "zz-advisory-audit",
    round: 1,
    reauthor_budget_per_audit: D7_REAUTHOR_BUDGET_PER_AUDIT,
    instrument: { rubric_version: "2.0", bar: RUBRIC_AUDIT_BAR_D7 },
    verdict: "PASS",
    book_cds: 90,
    summary: {
      chapter_count: chapters.length,
      mean: 90,
      min: 88,
      mean_pass: true,
      min_pass: true,
      all_core_domains_pass: true,
      all_gates_pass: true,
      all_layer_independence_pass: true,
      calibration_pass: true,
    },
    calibration: { unit: "made-to-stick-ch04", expected: 67.66, observed: 67.66, abs_delta: 0, tolerance: 3, pass: true },
    chapters,
    custody: chapters.map((c) => ({
      unit: c.unit,
      primaryDispatchSha256: sha256Hex(Buffer.from(`${c.unit}-primary`, "utf8")),
      verificationDispatchSha256: sha256Hex(Buffer.from(`${c.unit}-verification`, "utf8")),
      pairSealSha256: sha256Hex(Buffer.from(`${c.unit}-pair-seal`, "utf8")),
      adjudicationCanonicalSha256: sha256Hex(Buffer.from(`${c.unit}-adjudication`, "utf8")),
    })),
    report_sha256: "0".repeat(64),
  });
}

test("severance: with a passing D7 receipt the ship gate PASSES even though a BLOCK review exists — D7 is the only ship authority", () => {
  const bookId = "zz-advisory-book";
  const content = currentContent(bookId);

  // A BLOCK review over the SAME book — its verdict is loud but severed from ship.
  const blockAggregate = aggregate({ finalStatus: "BLOCK", blockingReasons: ["source lane BLOCK: x"] });
  assert.equal(advisoryReviewDisposition(blockAggregate).shipBlocking, false);

  // The D7 gate decides ship, and it PASSES — the review BLOCK contributes nothing.
  const r = evaluateD7ShipGate({
    bookId,
    candidatePackageBytes: `{"schemaVersion":"chapterflow-book-v21","packageId":"${bookId}-new"}`,
    shippedPackageBytes: null, // new book (not exempt) — must be D7-gated
    receipt: passReceipt(bookId, content),
    currentContent: content,
    // REQUIRE mode mandates the retained audit be present; the happy path carries a
    // verified custody (mirrors the D7 gate's own PASS test).
    custodyVerification: { status: "verified", blockers: [] },
    require: true,
  });
  assert.equal(r.decision, "pass", r.reason);
  assert.deepEqual(r.blockers, []);
});

test("severance guard: the promote/publish ship path does not read the split-lane aggregator finalStatus as a blocker", () => {
  // Regression lock: the only ship-path consumer of a split-lane finalStatus is the
  // WP-202-quarantined forwardChapterConductor (zero promote/publish reach). If a
  // future edit imports the aggregator into promote/publish, this fails.
  for (const rel of ["src/promoteBook.ts", "src/qc/publishAfterQc.ts"]) {
    const srcText = readFileSync(resolve(PIPELINE_DIR, rel), "utf8");
    assert.ok(!/aggregateChapterReview/.test(srcText), `${rel} must not reference the split-lane aggregator`);
    assert.ok(!/AggregatedChapterReview/.test(srcText), `${rel} must not import the aggregate review type`);
    assert.ok(!/\bfinalStatus\b/.test(srcText), `${rel} must not read a review finalStatus`);
  }
});

// ── 2. SOURCE-EQUIPPED: the lane runtime refuses a source-blind / dieted input ──

const SCHEMA_SHA = "a".repeat(64);
const NON_V2_SIDECAR = { schemaVersion: "source-v1", namedExamples: [] as unknown[] };
const spawnMustNotRun: SourceIntegritySpawnFn = () => {
  throw new Error("the source-lane spawn seam must never be reached when the packet is not source-equipped");
};

test("source-equipped: runSourceIntegrityReview REFUSES a non-equipped packet fail-closed (never reaches the model)", async () => {
  // A packet whose named case has been DIETED — the writer-stripped `allowedUses`
  // permission is gone (the exact V25-10 source-blind class). The plan is refreshed
  // over the mutated packet so it is not merely stale — the equipped guard is what
  // fires, before the spawn seam.
  const packet = fxPacket();
  delete (packet.namedCases[0] as Record<string, unknown>).allowedUses;
  const plan = fxPlan({
    sourcePacketSha256: sourcePacketHash(packet),
    units: [fxPlanUnit({ unitId: "unit.fact.ch01.fact.1", origin: "source_bound", form: "explanation", anchorIds: ["ch01.fact.1"], claimStrength: "descriptive" })],
  });

  await assert.rejects(
    () =>
      runSourceIntegrityReview(
        { chapter: fxChapter(), plan, packet, sidecar: NON_V2_SIDECAR, anchorCatalog: packet.allowedAnchors, schemaSha256: SCHEMA_SHA },
        { spawn: spawnMustNotRun },
      ),
    SourceProjectionBoundaryError,
  );
});

test("source-equipped: a fully-equipped packet still adjudicates (the guard does not break the equipped path)", async () => {
  const packet: SourcePacketV1 = fxPacket();
  const plan = fxPlan({
    sourcePacketSha256: sourcePacketHash(packet),
    units: [fxPlanUnit({ unitId: "unit.fact.ch01.fact.1", origin: "source_bound", form: "explanation", anchorIds: ["ch01.fact.1"], claimStrength: "descriptive" })],
  });
  const modelReply = () => ({
    finalMessage:
      "```json\n" +
      JSON.stringify({
        schema: "source-integrity-review-v1",
        units: [
          {
            unitId: "unit.fact.ch01.fact.1",
            expectedOrigin: "source_bound",
            expectedForm: "explanation",
            claimStrengthExpected: "descriptive",
            visibleRegister: "clearly_sourced",
            supportStatus: "SUPPORTED",
            framingAdequate: null,
            claimStrengthFit: true,
            namedSpecificityAllowed: true,
            chapterEvidenceSpans: [],
            sourceEvidenceSpans: [],
            findings: [],
          },
        ],
        result: "PASS",
        blockingFindingIds: [],
        rationale: "equipped",
      }) +
      "\n```",
  });
  const out = await runSourceIntegrityReview(
    { chapter: fxChapter(), plan, packet, sidecar: NON_V2_SIDECAR, anchorCatalog: packet.allowedAnchors, schemaSha256: SCHEMA_SHA },
    { spawn: modelReply },
  );
  assert.equal(out.result, "PASS");
});

// ── 3. SCALE-PINNED: every review numeric declares the single canonical scale ──

test("scale-pin: the canonical review scale is declared ONCE as [0,100]", () => {
  assert.deepEqual({ ...REVIEW_SCORE_SCALE }, { min: 0, max: 100 });
  assert.equal(isReviewScore(0), true);
  assert.equal(isReviewScore(100), true);
  assert.equal(isReviewScore(4), true); // 4 is a valid 0-100 score — the single scale removes the 1-5 ambiguity
  assert.equal(isReviewScore(105), false); // a 0-1 / 1-5 / 1-10 value that overshoots [0,100] is rejected
  assert.equal(isReviewScore(-1), false);
  assert.equal(isReviewScore(Number.NaN), false);
});

test("scale-pin: a reader score off the canonical [0,100] scale fails validation", () => {
  assert.deepEqual(validateReaderExperienceReview(readerReview()), []); // baseline valid
  const high = validateReaderExperienceReview(readerReview({ retention: 850 }));
  assert.ok(high.some((e) => e.includes("retention") && e.includes("[0,100]")), high.join("\n"));
  const neg = validateReaderExperienceReview(readerReview({ insight: -5 }));
  assert.ok(neg.some((e) => e.includes("insight")), neg.join("\n"));
});

test("scale-pin: an aggregate readerComposite/readerBar off the canonical scale fails validation", () => {
  assert.deepEqual(validateAggregatedChapterReview(aggregate()), []); // baseline valid
  const badComposite = validateAggregatedChapterReview(aggregate({ readerComposite: 105 }));
  assert.ok(badComposite.some((e) => e.includes("readerComposite") && e.includes("[0,100]")), badComposite.join("\n"));
  const badBar = validateAggregatedChapterReview(aggregate({ readerBar: 850 }));
  assert.ok(badBar.some((e) => e.includes("readerBar") && e.includes("[0,100]")), badBar.join("\n"));
  const negComposite = validateAggregatedChapterReview(aggregate({ readerComposite: -1 }));
  assert.ok(negComposite.some((e) => e.includes("readerComposite")), negComposite.join("\n"));
});

// ── 4. DIFFERENT-MODEL: reviewer ≠ writer, D-2/M9 fallback, ledger, precision ──

test("different-model: the source seed (sol@xhigh) that collides with a sol@xhigh writer shifts effort + reduces weight (D-2/M9)", () => {
  const writerProfileId = "gpt-5.6-sol@xhigh"; // author-first-write resolves here
  const sel = selectAdvisoryReviewerRoles({ writerProfileId });

  // Reader (sol@high) already differs from the writer → full weight, no fallback.
  assert.equal(sel.lanes.reader.profileId, "gpt-5.6-sol@high");
  assert.notEqual(sel.lanes.reader.profileId, writerProfileId);
  assert.equal(sel.lanes.reader.findingWeight, ADVISORY_FULL_FINDING_WEIGHT);
  assert.equal(sel.lanes.reader.selfReview, false);

  // Source (seed sol@xhigh) collides → shifted to a DIFFERENT effort, reduced weight.
  assert.notEqual(sel.lanes.source.profileId, writerProfileId);
  assert.equal(sel.lanes.source.selfReview, true);
  assert.equal(sel.lanes.source.findingWeight, ADVISORY_SELF_REVIEW_FINDING_WEIGHT);
  assert.ok(sel.lanes.source.fallbackReason && sel.lanes.source.fallbackReason.includes("D-2/M9"));
  assert.equal(sel.lanes.source.model, "gpt-5.6-sol"); // stayed sol, only the effort moved

  // The run-ledger record carries every reviewer profile + the honesty note.
  assert.equal(sel.ledgerRecord.schema, "advisory-reviewer-ledger-record-v1");
  assert.equal(sel.ledgerRecord.writerProfileId, writerProfileId);
  assert.equal(sel.ledgerRecord.independenceGuaranteedBy, "claude-side-d7-gate");
  assert.equal(sel.ledgerRecord.lanes.source.profileId, sel.lanes.source.profileId);

  // The invariant holds: no gated reviewer equals the writer.
  assert.doesNotThrow(() => assertReviewerDiffersFromWriter(sel, writerProfileId));
});

test("different-model: the fallback also fires for the reader lane when the writer is sol@high", () => {
  const writerProfileId = "gpt-5.6-sol@high";
  const sel = selectAdvisoryReviewerRoles({ writerProfileId });
  // Reader seed sol@high now collides → shifted; source seed sol@xhigh already differs.
  assert.notEqual(sel.lanes.reader.profileId, writerProfileId);
  assert.equal(sel.lanes.reader.selfReview, true);
  assert.equal(sel.lanes.source.profileId, "gpt-5.6-sol@xhigh");
  assert.equal(sel.lanes.source.selfReview, false);
});

test("different-model: quiz is NOT different-model-gated (deterministic correctness) and is recorded verbatim", () => {
  const sel = selectAdvisoryReviewerRoles({ writerProfileId: "gpt-5.6-sol@xhigh" });
  assert.equal(sel.lanes.quiz.differentModelGated, false);
  assert.equal(sel.lanes.quiz.profileId, profileId(ADVISORY_REVIEWER_SEED_V6.quiz));
});

test("different-model: a hand-built selection where a gated reviewer equals the writer is a BLOCKED role selection", () => {
  const writerProfileId = "gpt-5.6-sol@xhigh";
  const good = selectAdvisoryReviewerRoles({ writerProfileId });
  // Force the source reviewer onto the writer profile — the illegal state.
  const tampered: AdvisoryReviewerSelectionV1 = {
    ...good,
    lanes: {
      ...good.lanes,
      source: { ...good.lanes.source, profileId: writerProfileId, model: "gpt-5.6-sol", effort: "xhigh" },
    },
  };
  assert.throws(() => assertReviewerDiffersFromWriter(tampered, writerProfileId), AdvisoryRoleSelectionError);
});

test("precision-tracking: advisory-finding precision + the D-2 drop condition (<50% over a meaningful sample)", () => {
  let counter = emptyAdvisoryPrecisionCounter();
  assert.equal(advisoryLanePrecision(counter, "source"), null); // no sample yet
  assert.equal(advisoryLaneShouldBeDropped(counter, "source"), false);

  // A thin low-precision sample must NOT drop the lane (not "persistent").
  counter = recordAdvisoryFindingOutcomes(counter, "source", { confirmed: 1, total: 5 });
  assert.equal(advisoryLanePrecision(counter, "source"), 0.2);
  assert.equal(advisoryLaneShouldBeDropped(counter, "source"), false);

  // Accumulate to a meaningful sample still under 50% → drop.
  counter = recordAdvisoryFindingOutcomes(counter, "source", { confirmed: 4, total: 20 });
  assert.equal(counter.lanes.source.total, 25);
  assert.equal(advisoryLanePrecision(counter, "source"), 5 / 25);
  assert.equal(advisoryLaneShouldBeDropped(counter, "source"), true);

  // A lane above the floor is kept even at a large sample.
  let keep = emptyAdvisoryPrecisionCounter();
  keep = recordAdvisoryFindingOutcomes(keep, "reader", { confirmed: 18, total: 25 });
  assert.equal(advisoryLaneShouldBeDropped(keep, "reader"), false);

  // Guardrails: confirmed cannot exceed total; negatives refused.
  assert.throws(() => recordAdvisoryFindingOutcomes(keep, "reader", { confirmed: 3, total: 1 }), AdvisoryRoleSelectionError);
  assert.throws(() => recordAdvisoryFindingOutcomes(keep, "reader", { confirmed: -1, total: 1 }), AdvisoryRoleSelectionError);
});
