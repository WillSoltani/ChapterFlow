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
  buildReleaseRubricEvidence,
  chapterNumberFromLocation,
  countIssuesBySeverity,
  parsePanelChapterComposites,
} from "../../src/release/candidateReleaseVerdict.js";
import { REVIEW_FACTORS } from "../../src/artifacts/artifactTypes.js";
import { CATALOG_RUBRIC_INSTRUMENT_VERSION } from "../../src/review/catalogRubric.js";
import type { CatalogRubricRecordV1 } from "../../src/review/catalogRubricStore.js";
import { unanimousReaders } from "./catalogRubricFakes.js";
import { READER_PANEL_FACTOR_SCORES_CODE } from "../../src/review/readerPanelIssueCodes.js";
import { validCandidateReleaseVerdict } from "../../src/productionManifest.js";
import type { ReviewIssue } from "../../src/review/reviewTypes.js";
import { finishV25Tests, requiredTest } from "./harness.js";

/** The ten factor medians a rubric block must carry — the REVIEW_WEIGHTS keys,
 *  no more and no fewer. */
function factorMedians(base = 84): Record<string, number> {
  return Object.fromEntries(REVIEW_FACTORS.map((factor) => [factor, base]));
}

function rubricRecord(overrides: Partial<CatalogRubricRecordV1> = {}): CatalogRubricRecordV1 {
  return {
    schemaVersion: "1",
    instrumentVersion: CATALOG_RUBRIC_INSTRUMENT_VERSION,
    bookId: "verdict-book",
    candidate: { candidateId: "candidate-1", manifestDigest: "a".repeat(64) },
    title: "Verdict Book",
    author: "Fixture Author",
    totalChapters: 3,
    sampledChapterNumbers: [1, 2, 3],
    documentSha256: "0".repeat(64),
    readers: unanimousReaders(84),
    completedAt: "2026-09-02T01:00:00.000Z",
    ...overrides,
  };
}

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
    factorMedians: factorMedians(84),
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
  // R-254 minor 2 — factorMedians is the TEN-factor ruler or it is not evidence.
  // `{}` used to validate, so a verdict block could claim a composite while
  // recording no factor at all.
  assert.equal(validCandidateReleaseVerdict({ ...verdict, rubric: { ...rubric, factorMedians: {} } }), false);
  const { limits: _limits, ...missingFactor } = factorMedians(84);
  assert.equal(validCandidateReleaseVerdict({ ...verdict, rubric: { ...rubric, factorMedians: missingFactor } }), false);
  assert.equal(
    validCandidateReleaseVerdict({ ...verdict, rubric: { ...rubric, factorMedians: { ...factorMedians(84), vibes: 84 } } }),
    false,
    "a factor the rubric does not weigh is not a factor median",
  );
  assert.equal(validCandidateReleaseVerdict({ ...verdict, rubric: { ...rubric, factorMedians: factorMedians(101) } }), false);
  assert.equal(validCandidateReleaseVerdict({ ...verdict, rubric: { ...rubric, factorMedians: factorMedians(-1) } }), false);
  assert.equal(
    validCandidateReleaseVerdict({ ...verdict, rubric: { ...rubric, factorMedians: { ...factorMedians(84), limits: Number.NaN } } }),
    false,
  );
  assert.equal(validCandidateReleaseVerdict({ ...verdict, rubric: { ...rubric, factorMedians: factorMedians(0) } }), true);
  // An unknown extra key is refused: the block is a fixed contract, not a bag.
  assert.equal(validCandidateReleaseVerdict({ ...verdict, extra: 1 }), false);
  const { readerCount: _readerCount, ...missing } = rubric;
  assert.equal(validCandidateReleaseVerdict({ ...verdict, rubric: missing }), false);
});

requiredTest("the release evidence records the bar the GATE enforced, never the release process's own env", () => {
  const previous = process.env.CHAPTERFLOW_RUBRIC_BAR;
  const review = { outcome: "PASS" as const, issues: [] };
  const qcRound = { outcome: "PASS" as const, issues: [] };
  try {
    // The release route runs in its OWN environment, long after the book run.
    // Resolving the bar here (env, else the compiled 80) recorded a sidecar
    // claiming bar 80 for a book the gate actually enforced at 90.
    process.env.CHAPTERFLOW_RUBRIC_BAR = "80";
    const gated = buildReleaseRubricEvidence(rubricRecord({ gateBar: 90 }));
    assert.equal(gated.bar, 90, "the bar in the sidecar is the bar the gate ran against");
    assert.equal(gated.composite, 84);
    assert.equal(gated.factorFloor, 70);
    assert.equal(gated.readerCount, 3);
    assert.equal(gated.gate, "PASS");
    assert.deepEqual({ ...gated.factorMedians }, factorMedians(84));
    assert.equal(validCandidateReleaseVerdict(buildCandidateReleaseVerdict({ review, qcRound, rubric: gated })), true);

    // A record written before the bar was recorded says UNKNOWN. Inventing the
    // default here would be a fabricated measurement wearing the shape of one.
    const legacy = buildReleaseRubricEvidence(rubricRecord());
    assert.equal(legacy.bar, null, "an unrecorded bar is unknown, and the compiled default is not evidence");
    assert.equal(legacy.composite, 84);
    assert.equal(validCandidateReleaseVerdict(buildCandidateReleaseVerdict({ review, qcRound, rubric: legacy })), true);

    // Unknown is the ONLY non-integer the block accepts.
    const unknown = buildCandidateReleaseVerdict({ review, qcRound, rubric: legacy });
    assert.equal(validCandidateReleaseVerdict({ ...unknown, rubric: { ...legacy, bar: 80.5 } }), false);
    assert.equal(validCandidateReleaseVerdict({ ...unknown, rubric: { ...legacy, bar: "unknown" } }), false);
  } finally {
    if (previous === undefined) delete process.env.CHAPTERFLOW_RUBRIC_BAR;
    else process.env.CHAPTERFLOW_RUBRIC_BAR = previous;
  }
});

finishV25Tests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
