/**
 * IMP-20 WP-B6 — per-role judge qualification registry + fail-closed role-set
 * gate + frozen judge selection. Covers unit tests 25–29:
 *  25. A judge may qualify for one role and fail another.
 *  26. One unqualified UNUSED profile does not block the campaign.
 *  27. A missing required primary or backup DOES block the campaign.
 *  28. Soft metrics reject denominators below the minimum.
 *  29. A threshold of 0.85 over four cases is refused as underpowered.
 *
 * Plus the WP-B6 selection/inheritance invariants: security-boundary inheritance
 * from Layer-O v3, selection frozen before outputs (never tie-broken by model
 * family), and a single-qualifier safety-critical source lane staying BLOCKED.
 *
 * PURE — no model calls, no file I/O; every input is constructed inline.
 */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import { MigrationGuardError } from "../src/bakeoff/migration/guards.js";
import {
  MIN_SOFT_DENOMINATOR,
  ROLE_JUDGE_SELECTION_SCHEMA,
  ROLE_QUALIFICATION_OUTCOME_SCHEMA,
  type RecoveryRoleThresholdsV1,
  type RequiredRoleSetV1,
  type ReviewLaneRole,
  type RoleMetricDenominatorsV1,
  type RoleMetricRatesV1,
  type RoleQualificationRegistryV1,
  type RoleQualificationStatus,
} from "../src/bakeoff/migration/reviewLaneTypes.js";
import {
  assembleJudgeQualification,
  assertRoleSetReady,
  inheritSecurityBoundary,
  qualifyRole,
  selectRoleJudges,
  type LayerOV3QualificationResultV1,
} from "../src/bakeoff/migration/roleQualification.js";
import { validateJudgeCapabilityQualification } from "../src/contracts/judgeCapabilityQualification.js";
import type { JudgeCapabilityQualificationV1 } from "../src/contracts/judgeCapabilityQualification.js";

// ── fixtures ──────────────────────────────────────────────────────────────────

/** Thresholds where every role carries one well-powered soft bar (min den 10)
 *  and one reserved zero-miss bar. */
function thresholds(): RecoveryRoleThresholdsV1 {
  const roleBars = () => ({
    cleanPass: { minRate: 0.85, minDenominator: 10, zeroMiss: false },
    reservedZeroMiss: { minRate: 1.0, minDenominator: 8, zeroMiss: true },
  });
  return {
    schema: "split-lane-recovery-role-thresholds-v1",
    thresholdsVersion: "test-thresholds-v1",
    reader: roleBars(),
    source: roleBars(),
    quiz: roleBars(),
  };
}

/** A fully-powered clean-sweep measurement for one role. */
const PASS_RATES: RoleMetricRatesV1 = { cleanPass: 0.9, reservedZeroMiss: 1.0 };
const PASS_DENS: RoleMetricDenominatorsV1 = { cleanPass: 12, reservedZeroMiss: 12 };

function profile(
  profileId: string,
  statuses: {
    reader?: RoleQualificationStatus;
    source?: RoleQualificationStatus;
    quiz?: RoleQualificationStatus;
    security?: RoleQualificationStatus;
  },
): JudgeCapabilityQualificationV1 {
  return {
    profileId,
    model: profileId.split("@")[0],
    effort: (profileId.split("@")[1] as JudgeCapabilityQualificationV1["effort"]) ?? "high",
    readerExperience: statuses.reader ?? "NOT_TESTED",
    sourceIntegrity: statuses.source ?? "NOT_TESTED",
    quizIntegrity: statuses.quiz ?? "NOT_TESTED",
    securityBoundary: statuses.security ?? "NOT_TESTED",
    evidenceHashes: ["ev"],
    corpusHashes: ["co"],
    instrumentHashes: ["in"],
    qualifiedAt: "2026-07-12T00:00:00Z",
  };
}

function registry(profiles: JudgeCapabilityQualificationV1[]): RoleQualificationRegistryV1 {
  return { schema: "split-lane-role-qualification-registry-v1", profiles };
}

// ── test 25 — a judge may qualify one role and fail another ───────────────────

test("25: a judge may qualify one role and fail another (independent per-role verdicts)", () => {
  const th = thresholds();

  // reader: clean sweep, well powered → QUALIFIED.
  const reader = qualifyRole("reader", PASS_RATES, th, PASS_DENS);
  assert.equal(reader.status, "QUALIFIED");
  assert.equal(reader.refusedUnderpowered, false);
  assert.equal(reader.schema, ROLE_QUALIFICATION_OUTCOME_SCHEMA);

  // source: same profile, but a well-powered genuine miss on the soft bar → NOT_QUALIFIED.
  const source = qualifyRole(
    "source",
    { cleanPass: 0.5, reservedZeroMiss: 1.0 },
    th,
    { cleanPass: 12, reservedZeroMiss: 12 },
  );
  assert.equal(source.status, "NOT_QUALIFIED");
  assert.equal(source.refusedUnderpowered, false);
  assert.deepEqual(source.failedThresholds, ["cleanPass"]);

  // quiz: a reserved zero-miss violation → NOT_QUALIFIED even with the soft bar clean.
  const quiz = qualifyRole(
    "quiz",
    { cleanPass: 0.95, reservedZeroMiss: 0.9 },
    th,
    { cleanPass: 12, reservedZeroMiss: 12 },
  );
  assert.equal(quiz.status, "NOT_QUALIFIED");
  assert.deepEqual(quiz.failedThresholds, ["reservedZeroMiss"]);

  // the assembled registry entry carries the mixed statuses and validates.
  const entry = assembleJudgeQualification({
    profileId: "gpt-5.5@high",
    model: "gpt-5.5",
    effort: "high",
    readerOutcome: reader,
    sourceOutcome: source,
    quizOutcome: quiz,
    securityBoundary: "QUALIFIED",
    evidenceHashes: ["ev"],
    corpusHashes: ["co"],
    instrumentHashes: ["in"],
    qualifiedAt: "2026-07-12T00:00:00Z",
  });
  assert.equal(entry.readerExperience, "QUALIFIED");
  assert.equal(entry.sourceIntegrity, "NOT_QUALIFIED");
  assert.equal(entry.quizIntegrity, "NOT_QUALIFIED");
  assert.deepEqual(validateJudgeCapabilityQualification(entry), []);
});

// ── test 26 — one unqualified UNUSED profile does not block ───────────────────

test("26: one unqualified UNUSED profile does not block a satisfied role set", () => {
  const reg = registry([
    profile("gpt-5.5@high", { reader: "QUALIFIED", source: "QUALIFIED", quiz: "QUALIFIED" }),
    profile("gpt-5.6-sol@high", { reader: "QUALIFIED", source: "QUALIFIED", quiz: "QUALIFIED" }),
    // a fourth candidate that failed every lane — present but UNUSED.
    profile("gpt-5.6-sol@xhigh", { reader: "NOT_QUALIFIED", source: "NOT_QUALIFIED", quiz: "NOT_QUALIFIED" }),
  ]);
  const required: RequiredRoleSetV1 = {
    schema: "split-lane-required-role-set-v1",
    reader: { primary: true, backup: true },
    source: { primary: true, independentAdjudicator: true, blindHumanAdjudicationPath: false },
    quiz: { deterministicChecker: true, semanticAdjudicator: true },
  };
  // Two qualified profiles satisfy every requirement; the unqualified third is ignored.
  assert.doesNotThrow(() => assertRoleSetReady(reg, required));
});

// ── test 27 — a missing required primary/backup DOES block ────────────────────

test("27: a missing required backup (and a missing primary) blocks the campaign", () => {
  const required: RequiredRoleSetV1 = {
    schema: "split-lane-required-role-set-v1",
    reader: { primary: true, backup: true },
    source: { primary: true, independentAdjudicator: true, blindHumanAdjudicationPath: false },
    quiz: { deterministicChecker: true, semanticAdjudicator: true },
  };

  // Only ONE qualified reader → backup requirement fails.
  const oneReader = registry([
    profile("gpt-5.5@high", { reader: "QUALIFIED", source: "QUALIFIED", quiz: "QUALIFIED" }),
    profile("gpt-5.6-sol@high", { reader: "NOT_QUALIFIED", source: "QUALIFIED", quiz: "QUALIFIED" }),
  ]);
  assert.throws(() => assertRoleSetReady(oneReader, required), MigrationGuardError);
  assert.throws(() => assertRoleSetReady(oneReader, required), /backup/);

  // No qualified reader at all → primary requirement fails.
  const noReader = registry([
    profile("gpt-5.5@high", { reader: "NOT_QUALIFIED", source: "QUALIFIED", quiz: "QUALIFIED" }),
    profile("gpt-5.6-sol@high", { reader: "NOT_TESTED", source: "QUALIFIED", quiz: "QUALIFIED" }),
  ]);
  assert.throws(() => assertRoleSetReady(noReader, required), /no qualified primary/);

  // A single-qualifier source lane with no blind-human path is a safety-critical block.
  const oneSource = registry([
    profile("gpt-5.5@high", { reader: "QUALIFIED", source: "QUALIFIED", quiz: "QUALIFIED" }),
    profile("gpt-5.6-sol@high", { reader: "QUALIFIED", source: "NOT_QUALIFIED", quiz: "QUALIFIED" }),
  ]);
  assert.throws(() => assertRoleSetReady(oneSource, required), /independent adjudicator/);

  // Declaring a blind-human adjudication path rescues the single-qualifier source lane.
  const withHumanPath: RequiredRoleSetV1 = {
    ...required,
    source: { primary: true, independentAdjudicator: true, blindHumanAdjudicationPath: true },
  };
  assert.doesNotThrow(() => assertRoleSetReady(oneSource, withHumanPath));

  // Missing quiz semantic adjudicator blocks.
  const noQuiz = registry([
    profile("gpt-5.5@high", { reader: "QUALIFIED", source: "QUALIFIED", quiz: "NOT_QUALIFIED" }),
    profile("gpt-5.6-sol@high", { reader: "QUALIFIED", source: "QUALIFIED", quiz: "NOT_QUALIFIED" }),
  ]);
  assert.throws(() => assertRoleSetReady(noQuiz, required), /semantic adjudicator/);
});

// ── test 28 — soft metrics reject denominators below the minimum ──────────────

test("28: a soft metric with a denominator below the minimum is refused underpowered", () => {
  const th = thresholds();

  // Soft bar measured over 9 cases (< MIN_SOFT_DENOMINATOR) even at a passing
  // rate → refused, NOT a pass and NOT a genuine fail.
  const under = qualifyRole(
    "reader",
    { cleanPass: 0.95, reservedZeroMiss: 1.0 },
    th,
    { cleanPass: MIN_SOFT_DENOMINATOR - 1, reservedZeroMiss: 12 },
  );
  assert.equal(under.refusedUnderpowered, true);
  assert.deepEqual(under.underpoweredMetrics, ["cleanPass"]);
  assert.equal(under.status, "NOT_TESTED");
  assert.deepEqual(under.failedThresholds, []);

  // A vacuous den === 0 soft metric is likewise refused (guards the rate()===1 trap).
  const vacuous = qualifyRole(
    "reader",
    { cleanPass: 1.0, reservedZeroMiss: 1.0 },
    th,
    { cleanPass: 0, reservedZeroMiss: 12 },
  );
  assert.equal(vacuous.refusedUnderpowered, true);
  assert.equal(vacuous.status, "NOT_TESTED");

  // Exactly at the minimum with a passing rate → genuinely QUALIFIED.
  const powered = qualifyRole(
    "reader",
    { cleanPass: 0.9, reservedZeroMiss: 1.0 },
    th,
    { cleanPass: MIN_SOFT_DENOMINATOR, reservedZeroMiss: 12 },
  );
  assert.equal(powered.refusedUnderpowered, false);
  assert.equal(powered.status, "QUALIFIED");
});

// ── test 29 — 0.85 over four cases is refused as underpowered ─────────────────

test("29: a 0.85 bar over four cases is refused as underpowered (not a hidden 4/4)", () => {
  const th = thresholds();
  // 4/4 = 1.0 clears the 0.85 bar numerically, but den 4 < 10 → refused.
  const outcome = qualifyRole(
    "quiz",
    { cleanPass: 1.0, reservedZeroMiss: 1.0 },
    th,
    { cleanPass: 4, reservedZeroMiss: 12 },
  );
  assert.equal(outcome.refusedUnderpowered, true);
  assert.deepEqual(outcome.underpoweredMetrics, ["cleanPass"]);
  assert.equal(outcome.status, "NOT_TESTED");
  // Not silently passed: status is never QUALIFIED.
  assert.notEqual(outcome.status, "QUALIFIED");

  // A well-powered 12-case sweep at the same rate DOES qualify — proving the
  // refusal is about power, not about the rate.
  const powered = qualifyRole(
    "quiz",
    { cleanPass: 1.0, reservedZeroMiss: 1.0 },
    th,
    { cleanPass: 12, reservedZeroMiss: 12 },
  );
  assert.equal(powered.status, "QUALIFIED");
});

// ── WP-B6 selection + security-boundary inheritance invariants ────────────────

test("selection is frozen and never tie-broken by model family", () => {
  // Input order is deliberately reversed to prove the choice is stable and does
  // not depend on array order or model family.
  const reg = registry([
    profile("gpt-5.6-sol@high", { reader: "QUALIFIED" }),
    profile("gpt-5.5@high", { reader: "QUALIFIED" }),
  ]);
  const a = selectRoleJudges(reg, "reader");
  const b = selectRoleJudges(registry([...reg.profiles].reverse()), "reader");
  assert.equal(a.schema, ROLE_JUDGE_SELECTION_SCHEMA);
  assert.equal(a.status, "SELECTED");
  assert.equal(a.primaryProfileId, b.primaryProfileId);
  assert.equal(a.backupProfileId, b.backupProfileId);
  // Deterministic, family-agnostic order (profile id), not the input order.
  assert.equal(a.primaryProfileId, "gpt-5.5@high");
  assert.equal(a.backupProfileId, "gpt-5.6-sol@high");
});

test("a single-qualifier safety-critical source lane stays BLOCKED", () => {
  const oneSource = registry([
    profile("gpt-5.5@high", { source: "QUALIFIED" }),
    profile("gpt-5.6-sol@high", { source: "NOT_QUALIFIED" }),
  ]);
  const sel = selectRoleJudges(oneSource, "source");
  assert.equal(sel.status, "BLOCKED");
  assert.equal(sel.primaryProfileId, "gpt-5.5@high");
  assert.equal(sel.backupProfileId, null);
  assert.match(sel.blockedReason ?? "", /independent adjudication/);

  // Two qualified source profiles → SELECTED with an independent adjudicator.
  const twoSource = registry([
    profile("gpt-5.5@high", { source: "QUALIFIED" }),
    profile("gpt-5.6-sol@high", { source: "QUALIFIED" }),
  ]);
  const ok = selectRoleJudges(twoSource, "source");
  assert.equal(ok.status, "SELECTED");
  assert.equal(ok.primaryProfileId, "gpt-5.5@high");
  assert.equal(ok.backupProfileId, "gpt-5.6-sol@high");

  // No qualified profile for a role → BLOCKED with a null primary.
  const none = selectRoleJudges(registry([profile("gpt-5.5@high", {})]), "reader");
  assert.equal(none.status, "BLOCKED");
  assert.equal(none.primaryProfileId, null);
});

test("securityBoundary is INHERITED from the Layer-O v3 panel, else NOT_TESTED", () => {
  const layerO: LayerOV3QualificationResultV1 = {
    result: "ALL_THREE_JUDGES_QUALIFIED",
    judges: [
      { judge: "gpt-5.5@high", qualified: true },
      { judge: "gpt-5.6-sol@high", qualified: true },
      { judge: "gpt-5.5@xhigh", qualified: true },
    ],
  };
  const panelRoles: ReviewLaneRole[] = ["reader", "source", "quiz"];
  assert.ok(panelRoles.length === 3); // roles are lanes; security is inherited, not a lane
  assert.equal(inheritSecurityBoundary("gpt-5.5@high", layerO), "QUALIFIED");
  assert.equal(inheritSecurityBoundary("gpt-5.6-sol@high", layerO), "QUALIFIED");
  // A 4th candidate never run through Layer-O inherits NOT_TESTED — never assumed pass.
  assert.equal(inheritSecurityBoundary("gpt-5.6-sol@xhigh", layerO), "NOT_TESTED");
});
