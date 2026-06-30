/**
 * Calibration tests for the 2026-06-14 false-positive fixes (year-of-less repair
 * loop got stuck on majors that were false positives, which a content-only repair
 * can never clear):
 *   - C3 (decision point) must recognise NATURALISTIC forks, not just ~20 cue
 *     phrases, while STILL catching a decision-format scene with no decision.
 *   - A13 (run-on opener) must NOT flag a coordinated list ("X, Y, Z, or W"),
 *     while STILL catching a true comma run-on.
 */

import assert from "node:assert/strict";

import { checkDecisionPoint } from "../src/critics/narrative.js";
import { checkSentenceSanity } from "../src/critics/integrity.js";
import { test } from "./harness.js";

const ex = (scenario: string) => ({ format: "decision_point", scenario, whatToDo: "x", whyItMatters: "y", title: "t" } as any);

test("C3 recognises naturalistic decision forks (no false positive)", () => {
  // The exact phrasings the year-of-less authors used that C3 used to miss.
  assert.deepEqual(
    checkDecisionPoint(ex("Two paths sit in front of her. She can walk to the corner store or dig through the drawer.")),
    [],
    "'two paths / she can X' is a decision and must not flag C3",
  );
  assert.deepEqual(
    checkDecisionPoint(ex("Lin has to answer before the report goes out, and she wants the headline to show what the money made possible.")),
    [],
    "'has to answer' is a decision and must not flag C3",
  );
});

test("C3 still catches a decision-format scene with NO decision (no false negative)", () => {
  const findings = checkDecisionPoint(ex("The room was warm and the afternoon light fell across the shelf. She tidied the cans and hummed an old tune."));
  assert.ok(
    findings.some((f) => f.checkId === "narrative.decision_point"),
    `a decision_point scene with no decision must still flag C3, got: ${JSON.stringify(findings.map((f) => f.checkId))}`,
  );
});

test("A13 does not flag a coordinated list opener (no false positive)", () => {
  const findings = checkSentenceSanity("Name one hour, call, trip, or work option you would rather fund instead.", "tryThisNow");
  assert.ok(
    !findings.some((f) => /commas in the first 80/.test(f.message)),
    `a 4-item 'X, Y, Z, or W' list must not be flagged as a run-on, got: ${JSON.stringify(findings.map((f) => f.message))}`,
  );
});

test("A13 still catches a true comma run-on (no false negative)", () => {
  const findings = checkSentenceSanity("She woke early, she checked the inbox, she skipped breakfast, she left.", "scenario");
  assert.ok(
    findings.some((f) => /commas in the first 80/.test(f.message)),
    `a comma-spliced run-on with no list coordinator must still flag, got: ${JSON.stringify(findings.map((f) => f.message))}`,
  );
});
