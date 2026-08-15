/**
 * DECLARED-ANCHOR ALIGNMENT — SEC122 (compile backstop) and BP35 (audit stat honesty).
 *
 * The defect these lock down was found by the blind reader panel on a live chapter:
 * a quiz question whose prompt, choices and explanation were entirely about one event
 * declared `sourceAnchorIds` pointing at an anchor about a completely different one,
 * and a review card did the same. Every deterministic check passed — the section gate
 * reported no anchor-family finding, and the book pattern audit reported
 * `passed: true, findings: [], sourceAlignmentWarnings: 0`.
 *
 * TWO mechanisms produced that silence, both verified against this repo before the
 * checks below existed:
 *
 *  1. COMPILE. `validateAnchorHardSpecifics` returns early on
 *     `if (specifics.length < min) continue`, and `buildSourceAnchorCatalog`
 *     (source/sourceIntegrity.ts) attaches `hardSpecifics` to `named_example` anchors
 *     ONLY — `concept`, `testable_fact` and `framework` anchors are built without the
 *     field. A unit citing a testable_fact anchor therefore carried no content
 *     obligation whatsoever: SEC56/SEC58/SEC74 skipped it for want of specifics and
 *     SEC120's `anySpecificOnThePage` guard skipped it for the same reason, leaving
 *     only the claim-CLASS gates, which never look at what the unit says.
 *     A compile-blocker (SEC123) was built for that case and REJECTED in adversarial
 *     review: transfer-style units legitimately share zero vocabulary with their
 *     anchor, so a lexical proxy must not refuse a compile. BP35 carries the signal
 *     instead — as an audit finding with NO score cap, for the panel to judge.
 *
 *     Separately, every anchor-CONTENT gate skips an id it cannot resolve
 *     (`if (!anchor) continue` and friends). The id-level gates SEC47/SEC51/etc. do
 *     refuse those ids today, so a pack could not compile — but the content family
 *     stayed silent about them, so SEC122 makes it refuse on its own.
 *
 *  2. AUDIT. `stats.sourceAlignmentWarnings` counted BP6 only, which measures
 *     CHAPTER-level lexical overlap with the source sidecar and with the stored
 *     coreMove. No check compared a UNIT to the anchor that unit CITES, so per-unit
 *     mismatch could not move a stat whose name promises alignment coverage. BP35
 *     adds the per-unit check and increments the same counter.
 *
 * No live model call, no network, no filesystem write. BP35's fixtures pass an
 * explicit `sourceAnchorsByChapter` catalog, so the audit reads nothing from disk.
 */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import {
  validateActionPack,
  validateAnchorResolution,
  validateLearningPack,
  type SectionFinding,
} from "../src/sections/sectionGate.js";
import { runBookPatternAudit } from "../src/critics/bookPatternAudit.js";
import type {
  ChapterBlueprintV1,
  LearningPackV1,
  SourcePacketV1,
} from "../src/artifacts/artifactTypes.js";
import type { ChapterV21, SourceAnchorForPrompt } from "../src/types.js";

const CHID = "zz-anchor-align-ch03";
const CH = 3;

// A testable_fact anchor exactly as buildSourceAnchorCatalog builds one: label + text,
// and NO hardSpecifics (that field is populated for named_example anchors only).
const FACT_ANCHOR: SourceAnchorForPrompt = {
  id: "ch03.fact.poor-richard-sales",
  kind: "testable_fact",
  label: "Poor Richard's Almanack sold about ten thousand copies a year",
  text: "Poor Richard's Almanack sold roughly ten thousand copies annually because its proverbs were priced for tradesmen who bought nothing else.",
  supportsClaimTypes: ["quiz_prompt", "quiz_explanation", "quiz_key_evidence", "review_card"],
};

function packet(anchors: SourceAnchorForPrompt[]): SourcePacketV1 {
  return { allowedAnchors: anchors, facts: [], namedCases: [], allowedEntities: [], allowedNumbers: [] } as unknown as SourcePacketV1;
}

function blueprint(): ChapterBlueprintV1 {
  return {
    chapterNumber: CH,
    chapterId: CHID,
    sections: { quiz: [{ questionId: "q07", correctIndex: 0, depthLevel: "standard" }], cards: [{ cardId: "rc07" }] },
  } as unknown as ChapterBlueprintV1;
}

/** Off-topic quiz + card: both declare the almanack-sales anchor while the text is
 *  entirely about the 1755 wagon crisis / hospital fundraising — the panel's shape. */
function offTopicPack(ids: string[]): LearningPackV1 {
  return {
    schemaVersion: "section-artifact-v1", artifactType: "learning-pack", chapterId: CHID,
    quiz: { passingScorePercent: 70, questions: [{
      questionId: "q07",
      sourceAnchorIds: ids, keyEvidenceAnchorIds: ids,
      prompt: "A general demands one hundred fifty wagons within two weeks or his campaign collapses.",
      choices: ["Recruit wagons by appealing to farmers", "Wait for the militia to volunteer", "Refuse the demand outright"],
      correctIndex: 0,
      explanation: "Recruiting wagons through a direct appeal moved teams the army could never seize.",
      bloomsLevel: "apply", depthLevel: "standard",
    }] },
    cards: { cards: [{
      cardId: "rc07", sourceAnchorIds: ids,
      front: "How was the hospital funding secured?",
      back: "A matching grant tied public money to private subscriptions so each side unlocked the other and doubled the total raised.",
      difficulty: "medium",
    }] },
  } as unknown as LearningPackV1;
}

/** The same units rewritten ON TOPIC for the SAME anchor — the control. */
function onTopicPack(ids: string[]): LearningPackV1 {
  return {
    schemaVersion: "section-artifact-v1", artifactType: "learning-pack", chapterId: CHID,
    quiz: { passingScorePercent: 70, questions: [{
      questionId: "q07",
      sourceAnchorIds: ids, keyEvidenceAnchorIds: ids,
      prompt: "Your almanack sells ten thousand copies a year to tradesmen who buy nothing else all season.",
      choices: ["Keep pricing the almanack for tradesmen", "Raise the price for collectors", "Stop printing it"],
      correctIndex: 0,
      explanation: "The almanack reached tradesmen precisely because its yearly copies stayed cheap.",
      bloomsLevel: "apply", depthLevel: "standard",
    }] },
    cards: { cards: [{
      cardId: "rc07", sourceAnchorIds: ids,
      front: "Why did the almanack reach so many tradesmen each year?",
      back: "It sold roughly ten thousand copies annually because its proverbs were priced for tradesmen who bought nothing else.",
      difficulty: "medium",
    }] },
  } as unknown as LearningPackV1;
}

const byCheck = (findings: SectionFinding[], checkId: string) => findings.filter((f) => f.checkId === checkId);

// ── A. COMPILE REFUSAL ───────────────────────────────────────────────────────

test("SEC122: an unresolved cited id refuses inside the anchor-content family itself", () => {
  const findings = validateLearningPack(offTopicPack(["ch03.fact.ghost-anchor"]), blueprint(), packet([FACT_ANCHOR]));
  const hits = byCheck(findings, "SEC122.unit_anchor_unresolved");
  assert.ok(hits.length >= 2, `expected SEC122 on the quiz and the card; got ${hits.length}`);
  for (const hit of hits) {
    assert.equal(hit.severity, "blocker");
    assert.match(hit.message, /ch03\.fact\.ghost-anchor/, "the message names the unknown id");
  }
  assert.ok(hits.some((f) => f.path === "/quiz/questions/0/sourceAnchorIds"), "the quiz sourceAnchorIds path is named");
  assert.ok(hits.some((f) => f.path === "/cards/cards/0/sourceAnchorIds"), "the card sourceAnchorIds path is named");
});

test("SEC122 CONTROL: a known id produces nothing, and the helper is a pure resolution test", () => {
  const findings = validateLearningPack(onTopicPack([FACT_ANCHOR.id]), blueprint(), packet([FACT_ANCHOR]));
  assert.deepEqual(byCheck(findings, "SEC122.unit_anchor_unresolved"), [], "a resolvable id must never trip SEC122");
  const anchors = new Map([[FACT_ANCHOR.id, FACT_ANCHOR]]);
  assert.deepEqual(validateAnchorResolution([FACT_ANCHOR.id], anchors, "q"), []);
  assert.deepEqual(validateAnchorResolution([], anchors, "q"), [], "SEC122 owns resolution only — an empty citation is SEC47's business");
  assert.equal(validateAnchorResolution(["nope"], anchors, "q").length, 1);
});

// ── B. AUDIT PER-UNIT CHECK ──────────────────────────────────────────────────

function auditChapter(quizIds: string[], cardIds: string[], onTopic: boolean): ChapterV21 {
  const quiz = onTopic
    ? {
      prompt: "Your almanack sells ten thousand copies a year to tradesmen who buy nothing else all season.",
      choices: ["Keep pricing the almanack for tradesmen", "Raise the price for collectors", "Stop printing it"],
      explanation: "The almanack reached tradesmen precisely because its yearly copies stayed cheap.",
    }
    : {
      prompt: "A general demands one hundred fifty wagons within two weeks or his campaign collapses.",
      choices: ["Recruit wagons by appealing to farmers", "Wait for the militia to volunteer", "Refuse the demand outright"],
      explanation: "Recruiting wagons through a direct appeal moved teams the army could never seize.",
    };
  const card = onTopic
    ? { front: "Why did the almanack reach so many tradesmen?", back: "It sold roughly ten thousand copies annually because its proverbs were priced for tradesmen." }
    : { front: "How was the hospital funding secured?", back: "A matching grant tied public money to private subscriptions so each side unlocked the other." };
  return {
    chapterId: CHID,
    number: CH,
    title: "Errata",
    hook: "A printer learns that a promise is a ledger entry.",
    keyTakeaway: "Write the promise down before the week eats it.",
    breakdown: { fastRead: "", deepRead: "", fullRead: "" },
    examples: [],
    quiz: { passingScorePercent: 70, questions: [{ questionId: "q07", sourceAnchorIds: quizIds, ...quiz, correctIndex: 0, bloomsLevel: "apply", depthLevel: "standard" }] },
    reviewCards: [{ cardId: "rc07", sourceAnchorIds: cardIds, ...card, difficulty: "medium" }],
    implementationPlan: { title: "Log the promise", coreSkill: "", ifThenPlans: [], twentyFourHourChallenge: "", weeklyPractice: "" },
  } as unknown as ChapterV21;
}

function audit(chapter: ChapterV21) {
  return runBookPatternAudit({
    bookId: "zz-anchor-align",
    chapters: [chapter],
    requirePlanArtifacts: false,
    checkSourceAlignment: true,
    // Explicit candidate-bound catalog: BP35 reads nothing from disk for this chapter.
    sourceAnchorsByChapter: { [CH]: [FACT_ANCHOR] },
  });
}

test("BP35: a quiz question and a review card declaring an anchor about a different topic are MAJOR findings", () => {
  const report = audit(auditChapter([FACT_ANCHOR.id], [FACT_ANCHOR.id], false));
  const bp35 = report.findings.filter((f) => f.code === "BP35");
  assert.equal(bp35.length, 2, `expected one BP35 per mismatched unit; got ${JSON.stringify(bp35.map((f) => f.message))}`);
  for (const finding of bp35) {
    assert.equal(finding.severity, "major", "BP35 matches BP6's severity — it caps the score, it does not flip passed");
    assert.deepEqual(finding.chapters, [CH], "BP35 is chapter-scoped");
    assert.match(finding.message, /ch03\.fact\.poor-richard-sales/, "the message names the declared anchor");
  }
  assert.ok(bp35.some((f) => /q07/.test(f.message)), "the quiz finding names the question");
  assert.ok(bp35.some((f) => /rc07/.test(f.message)), "the card finding names the card");
});

test("BP35: every per-unit mismatch increments sourceAlignmentWarnings, so the stat means what its name says", () => {
  const mismatched = audit(auditChapter([FACT_ANCHOR.id], [FACT_ANCHOR.id], false));
  assert.equal(mismatched.stats.sourceAlignmentWarnings, 2, "two mismatched units, two warnings");
  assert.equal(mismatched.passed, true, "major findings do not flip passed — the stat is what carries the signal");
  const aligned = audit(auditChapter([FACT_ANCHOR.id], [FACT_ANCHOR.id], true));
  assert.equal(aligned.stats.sourceAlignmentWarnings, 0, "on-topic units leave the counter at zero");
});

test("BP35 CONTROL: units actually built from the anchor they declare produce no finding", () => {
  const report = audit(auditChapter([FACT_ANCHOR.id], [FACT_ANCHOR.id], true));
  assert.deepEqual(report.findings.filter((f) => f.code === "BP35"), [], "on-topic units must never be flagged");
});

test("BP35 stays silent where it has no evidence: unresolved ids, no declared ids, no catalog", () => {
  const unresolved = audit(auditChapter(["ch03.fact.ghost"], ["ch03.fact.ghost"], false));
  assert.deepEqual(
    unresolved.findings.filter((f) => f.code === "BP35"),
    [],
    "an id that resolves to nothing is a different defect (SEC47/SEC122/SC11.5); BP35 must not inflate the alignment stat with it",
  );
  const undeclared = audit(auditChapter([], [], false));
  assert.deepEqual(undeclared.findings.filter((f) => f.code === "BP35"), [], "a unit that declares no anchor makes no alignment claim");
  const noCatalog = runBookPatternAudit({
    bookId: "zz-anchor-align",
    chapters: [auditChapter([FACT_ANCHOR.id], [FACT_ANCHOR.id], false)],
    requirePlanArtifacts: false,
    checkSourceAlignment: true,
    sourceAnchorsByChapter: { [CH]: [] },
  });
  assert.deepEqual(noCatalog.findings.filter((f) => f.code === "BP35"), [], "no anchor catalog means no evidence, and no evidence means no finding");
});

test("BP35 respects checkSourceAlignment:false — the candidate path gains no new discovery", () => {
  const report = runBookPatternAudit({
    bookId: "zz-anchor-align",
    chapters: [auditChapter([FACT_ANCHOR.id], [FACT_ANCHOR.id], false)],
    requirePlanArtifacts: false,
    checkSourceAlignment: false,
    sourceAnchorsByChapter: { [CH]: [FACT_ANCHOR] },
  });
  assert.deepEqual(report.findings.filter((f) => f.code === "BP35"), [], "BP35 lives inside the same opt-out BP6 already honours");
  assert.equal(report.stats.sourceAlignmentWarnings, 0);
});
