/**
 * R-254 / R-229 — the verdict a released candidate pair carries about itself.
 *
 * Pure: no roots, no model, no filesystem. The manifest ROUND TRIP (build →
 * validate → declared-evidence replay) is asserted in
 * `v4-canonical-promotion-adapters-migration.test.ts`, which already owns the
 * package/candidate fixtures a real build needs.
 */

import assert from "node:assert/strict";

import {
  buildCandidateReleaseVerdict,
  chapterNumberFromLocation,
  countIssuesBySeverity,
  parsePanelChapterComposites,
} from "../../src/release/candidateReleaseVerdict.js";
import { READER_PANEL_FACTOR_SCORES_CODE } from "../../src/review/readerPanelIssueCodes.js";
import { validCandidateReleaseVerdict } from "../../src/productionManifest.js";
import type { ReviewIssue } from "../../src/review/reviewTypes.js";
import { finishV25Tests, requiredTest } from "./harness.js";

function factorScores(chapter: string, composite: number): ReviewIssue {
  return {
    code: READER_PANEL_FACTOR_SCORES_CODE,
    severity: "WARN",
    message:
      `reader-panel median composite ${composite} (chapter bar 70); factor medians weakest-first: `
      + "limits 64, density 66, tone 71, beginner 74, insight 76, practical 78, quizzes 79, retention 80, summaries 81, transfer 82",
    location: chapter,
  };
}

requiredTest("issue counts cover every severity, including the zeroes", () => {
  assert.deepEqual(countIssuesBySeverity([]), { BLOCKER: 0, WARN: 0, INFO: 0 });
  assert.deepEqual(
    countIssuesBySeverity([
      { severity: "WARN" }, { severity: "WARN" }, { severity: "BLOCKER" }, { severity: "INFO" },
    ]),
    { BLOCKER: 1, WARN: 2, INFO: 1 },
  );
});

requiredTest("the per-chapter panel composites are parsed out of the review's own FACTOR_SCORES WARNs", () => {
  // The shipped Franklin round's shape: WARNs carrying composites as free text
  // that nothing downstream ever read (R-229).
  const issues: ReviewIssue[] = [
    factorScores("ch03", 78.6),
    factorScores("ch01", 75.4),
    factorScores("ch02", 76.7),
    // A different code with a similar message must not be harvested.
    { code: "REVIEW.READER.ADVISORY.repetition", severity: "WARN", message: "reader-panel median composite 99", location: "ch04" },
    // A FACTOR_SCORES WARN whose message does not match is SKIPPED, not guessed.
    { code: READER_PANEL_FACTOR_SCORES_CODE, severity: "WARN", message: "unparseable", location: "ch05" },
    // A malformed location is skipped too.
    { code: READER_PANEL_FACTOR_SCORES_CODE, severity: "WARN", message: "reader-panel median composite 80", location: "chapter-6" },
    // A duplicate chapter cannot inflate the list; the first wins.
    factorScores("ch01", 10),
  ];
  assert.deepEqual([...parsePanelChapterComposites(issues)], [
    { chapterNumber: 1, composite: 75.4 },
    { chapterNumber: 2, composite: 76.7 },
    { chapterNumber: 3, composite: 78.6 },
  ]);
  assert.deepEqual([...parsePanelChapterComposites([])], []);

  assert.equal(chapterNumberFromLocation("ch07"), 7);
  assert.equal(chapterNumberFromLocation("ch14"), 14);
  assert.equal(chapterNumberFromLocation("ch00"), null);
  assert.equal(chapterNumberFromLocation("ch01/reader-b/deep"), null);
  assert.equal(chapterNumberFromLocation(undefined), null);
});

requiredTest("the verdict block states the outcome and counts a released pair could not state before", () => {
  const verdict = buildCandidateReleaseVerdict({
    review: { outcome: "PASS", issues: [factorScores("ch01", 75.4), { code: "REVIEW.READER.ADVISORY.repetition", severity: "WARN", message: "restated image" }] },
    qcRound: { outcome: "PASS", issues: [{ code: "QC.X", severity: "WARN", message: "one warn" }] },
  });
  assert.equal(verdict.qcOutcome, "PASS");
  assert.deepEqual(verdict.qcIssueCounts, { BLOCKER: 0, WARN: 1, INFO: 0 });
  assert.equal(verdict.reviewOutcome, "PASS");
  assert.deepEqual(verdict.reviewIssueCounts, { BLOCKER: 0, WARN: 2, INFO: 0 });
  assert.deepEqual([...verdict.panelChapterComposites], [{ chapterNumber: 1, composite: 75.4 }]);
  assert.equal(verdict.rubric, undefined, "a candidate with no rubric record records NO rubric, not a passing one");
  assert.equal("rubric" in verdict, false);
  assert.equal(validCandidateReleaseVerdict(verdict), true);
});

requiredTest("a rubric-bearing verdict validates, and a malformed one is refused", () => {
  const rubric = {
    instrumentVersion: "catalog-rubric-v1",
    composite: 84,
    tier: "strong/ships (80-90)",
    gate: "PASS" as const,
    churn: "LOW" as const,
    bar: 80,
    factorFloor: 70,
    highQuality: false,
    factorMedians: { retention: 84, quizzes: 84 },
    sampledChapterNumbers: [1, 2, 3],
    totalChapters: 3,
    readerCount: 3,
  };
  const verdict = buildCandidateReleaseVerdict({
    review: { outcome: "PASS", issues: [] },
    qcRound: { outcome: "PASS", issues: [] },
    rubric,
  });
  assert.equal(validCandidateReleaseVerdict(verdict), true);
  assert.equal(verdict.rubric?.composite, 84);

  // Every refusal below is a shape a consumer could not trust.
  assert.equal(validCandidateReleaseVerdict(undefined), false);
  assert.equal(validCandidateReleaseVerdict({ ...verdict, qcOutcome: "MAYBE" }), false);
  assert.equal(validCandidateReleaseVerdict({ ...verdict, qcIssueCounts: { BLOCKER: 0, WARN: 1 } }), false);
  assert.equal(validCandidateReleaseVerdict({ ...verdict, qcIssueCounts: { BLOCKER: -1, WARN: 0, INFO: 0 } }), false);
  assert.equal(validCandidateReleaseVerdict({ ...verdict, panelChapterComposites: [{ chapterNumber: 0, composite: 70 }] }), false);
  assert.equal(validCandidateReleaseVerdict({ ...verdict, panelChapterComposites: "none" }), false);
  assert.equal(validCandidateReleaseVerdict({ ...verdict, rubric: { ...rubric, gate: "MAYBE" } }), false);
  assert.equal(validCandidateReleaseVerdict({ ...verdict, rubric: { ...rubric, churn: "low" } }), false);
  assert.equal(validCandidateReleaseVerdict({ ...verdict, rubric: { ...rubric, bar: 80.5 } }), false);
  assert.equal(validCandidateReleaseVerdict({ ...verdict, rubric: { ...rubric, sampledChapterNumbers: [] } }), false);
  assert.equal(validCandidateReleaseVerdict({ ...verdict, rubric: { ...rubric, factorMedians: { retention: "84" } } }), false);
  // An unknown extra key is refused: the block is a fixed contract, not a bag.
  assert.equal(validCandidateReleaseVerdict({ ...verdict, extra: 1 }), false);
  const { readerCount: _readerCount, ...missing } = rubric;
  assert.equal(validCandidateReleaseVerdict({ ...verdict, rubric: missing }), false);
});

finishV25Tests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
