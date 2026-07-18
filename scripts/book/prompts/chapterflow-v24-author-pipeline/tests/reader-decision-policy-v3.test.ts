/** reader-decision-policy-v3 — the versioned decision predicate itself.
 * v2 stays byte-for-byte gating (closed identities replay under it); v3 gates
 * only on blockers and the composite bar. Owner-ratified D1 2026-07-15
 * (docs/v25/reports/V25_PILOT_READINESS_OWNER_RATIFICATION.md). */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import {
  READER_DECISION_POLICY_V2,
  READER_DECISION_POLICY_V3,
  deriveReaderDecisionCategory,
  deriveReaderDecisionCategoryV2,
  deriveReaderDecisionCategoryV3,
} from "../src/review/reviewProtocolV2.js";
import { REVIEW_FACTORS, type ReviewFactor } from "../src/artifacts/artifactTypes.js";

function scores(value: number): Record<ReviewFactor, number> {
  return Object.fromEntries(REVIEW_FACTORS.map((factor) => [factor, value])) as Record<ReviewFactor, number>;
}

const advisory = { category: "thin_example", unit: "examples", problem: "thin" };
const ambiguity = { category: "origin_ambiguous_to_reader", unit: "hook", problem: "unclear" };
const blocker = { category: "internal_contradiction", unit: "deep read", problem: "contradiction" };

test("v2 proof (historical behavior preserved): any advisory or origin-ambiguity forces REVISE at composite 90", () => {
  assert.equal(deriveReaderDecisionCategoryV2(
    { scores: scores(90), blockingFindings: [], advisoryFindings: [advisory], escalationSignals: [] }, 80), "REVISE");
  assert.equal(deriveReaderDecisionCategoryV2(
    { scores: scores(90), blockingFindings: [], advisoryFindings: [], escalationSignals: [ambiguity] }, 80), "REVISE");
  assert.equal(deriveReaderDecisionCategoryV2(
    { scores: scores(90), blockingFindings: [], advisoryFindings: [], escalationSignals: [] }, 80), "PASS");
});

test("v3: PASS = composite >= 80 + zero blockers; advisories and ambiguity never gate", () => {
  assert.equal(deriveReaderDecisionCategoryV3(
    { scores: scores(90), blockingFindings: [], advisoryFindings: [advisory], escalationSignals: [ambiguity] }, 80), "PASS");
  assert.equal(deriveReaderDecisionCategoryV3(
    { scores: scores(80), blockingFindings: [], advisoryFindings: [advisory], escalationSignals: [] }, 80), "PASS");
  assert.equal(deriveReaderDecisionCategoryV3(
    { scores: scores(79), blockingFindings: [], advisoryFindings: [], escalationSignals: [] }, 80), "REVISE");
  assert.equal(deriveReaderDecisionCategoryV3(
    { scores: scores(95), blockingFindings: [blocker], advisoryFindings: [], escalationSignals: [] }, 80), "BLOCK");
});

test("policy dispatcher selects the exact versioned predicate", () => {
  const input = { scores: scores(90), blockingFindings: [], advisoryFindings: [advisory], escalationSignals: [] };
  assert.equal(deriveReaderDecisionCategory(READER_DECISION_POLICY_V2, input, 80), "REVISE");
  assert.equal(deriveReaderDecisionCategory(READER_DECISION_POLICY_V3, input, 80), "PASS");
});
