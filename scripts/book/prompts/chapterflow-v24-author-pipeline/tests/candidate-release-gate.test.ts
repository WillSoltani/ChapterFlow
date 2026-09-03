/**
 * R-228 — the candidate release must consult the book gate it already runs.
 *
 * `createCliV25Composition` calls `runBookGateFromCandidate` and used to read
 * exactly one field out of the report (the pattern audit). `passed`, the blockers
 * and the majors had no reader at all, so `promote-book --candidate-id …` shipped
 * a book its own gate rejected.
 *
 * These cases pin the pure verdict. The CLI refusal itself is pinned end-to-end in
 * tests/v25/v4-canonical-promotion-adapters-migration.test.ts
 * ("candidate release REFUSES a candidate whose own book gate reports a blocker").
 */
import assert from "node:assert/strict";

import { test } from "./harness.js";
import type { BookGateFinding, BookGateReport } from "../src/critics/bookGate.js";
import { evaluateCandidateReleaseGate } from "../src/release/candidateReleaseGate.js";

function report(findings: BookGateFinding[], auditFindings: Array<{ code: string; severity: "blocker" | "major" | "minor"; message: string }> = []): BookGateReport {
  const blockers = findings.filter((f) => f.severity === "blocker").length;
  return {
    bookId: "fixture-book",
    chapterCount: 4,
    passed: blockers === 0,
    findings,
    stats: {
      answerPositionCounts: [1, 1, 1],
      answerPositionPctMax: 0.34,
      totalQuizQuestions: 3,
      duplicatedNames: [],
      duplicatedHookOpeners: [],
      schemaInconsistencies: [],
      patternAudit: {
        bookId: "fixture-book",
        chapterCount: 4,
        passed: auditFindings.every((f) => f.severity !== "blocker"),
        findings: auditFindings,
        stats: {
          repeatedQuizExplanationGroups: 0,
          repeatedSurfaceFrameGroups: 0,
          repeatedExampleFrameGroups: 0,
          repeatedConcreteAnchors: 0,
          templatedBreakdownShellGroups: 0,
          shortParagraphDuplicateGroups: 0,
          literalSubstringGroups: 0,
          quizPositionTemplateDuplicates: 0,
          missingPlanChapters: [],
          missingBrief: false,
          sourceAlignmentWarnings: 0,
        },
      },
    },
  };
}

test("R-228: a blocker in the candidate's book gate REFUSES the release and names the finding", () => {
  const verdict = evaluateCandidateReleaseGate(report([
    { catalogId: "F1", severity: "blocker", message: "protagonist name reused across chapters", chapters: [1, 3] },
    { catalogId: "F9", severity: "major", message: "soft-banned phrase over budget" },
    { catalogId: "F12", severity: "minor", message: "cosmetic" },
  ]));
  assert.equal(verdict.passed, false, "a gate blocker must refuse the release");
  assert.equal(verdict.blockers, 1);
  assert.equal(verdict.majors, 1);
  assert.equal(verdict.minors, 1);
  assert.deepEqual(verdict.blockerFindings.map((f) => f.catalogId), ["F1"]);
  assert.match(verdict.refusal, /V25_RELEASE_BLOCKED/);
  const printed = verdict.lines.join("\n");
  assert.match(printed, /BLOCKED — 1 blocker \/ 1 major \/ 1 minor/);
  assert.match(printed, /BLOCKER F1 \(ch1,3\): protagonist name reused/, "the blocker is printed with its chapters");
  assert.match(printed, /MAJOR F9: soft-banned phrase over budget/, "majors are printed too (advisory, not enforced here)");
});

test("R-228: a clean gate passes, and the pattern-audit codes are printed either way", () => {
  const clean = evaluateCandidateReleaseGate(report([]));
  assert.equal(clean.passed, true);
  assert.equal(clean.refusal, "");
  assert.match(clean.lines.join("\n"), /PASS — 0 blocker \/ 0 major \/ 0 minor/);
  assert.match(clean.lines.join("\n"), /pattern audit: PASS — 0 finding\(s\)/);

  const audited = evaluateCandidateReleaseGate(report([], [
    { code: "BP12", severity: "major", message: "repeated example frame" },
  ]));
  assert.equal(audited.passed, true, "a MAJOR pattern-audit finding is not a gate blocker");
  assert.match(audited.lines.join("\n"), /pattern audit: PASS — 1 finding\(s\): BP12\(major\)/);
});

test("R-228: majors and minors alone never refuse — the bar stays the gate's own `blockers === 0`", () => {
  const verdict = evaluateCandidateReleaseGate(report([
    { catalogId: "F9", severity: "major", message: "a" },
    { catalogId: "F9", severity: "major", message: "b" },
    { catalogId: "F12", severity: "minor", message: "c" },
  ]));
  assert.equal(verdict.passed, true, "this module must not invent a stricter bar than the gate it reports on");
  assert.equal(verdict.majors, 2);
  assert.equal(verdict.refusal, "");
});
