/**
 * Package 2B — the deterministic "facts preserved" guard.
 *
 * The editor pass may REWORD; it may never RE-FACT. Every case below drives
 * `checkEditPreservesFacts` over the compliant credit fixture: an edit that only
 * changes wording is accepted, and each way of changing a fact is refused by its
 * own named check. The guard is pure, so no model, clock or filesystem is
 * involved.
 */
import assert from "node:assert/strict";

import {
  checkEditPreservesFacts,
  editGuardEntities,
  editGuardNumbers,
  type ChapterEditPacks,
} from "../../src/sections/chapterEditGuard.js";
import type { LearningPackV1, SummaryPackV1, ExamplePackV1, ActionPackV1 } from "../../src/artifacts/artifactTypes.js";
import { compileCreditFixture } from "../fixtures/creditBookFixture.js";
import { finishV25Tests, requiredTest } from "./harness.js";

const BOOK = "edit-guard-book";

function packs(): ChapterEditPacks {
  const fixture = compileCreditFixture(BOOK);
  return {
    "summary-pack": clone(fixture.summary),
    "example-pack": clone(fixture.examples),
    "learning-pack": clone(fixture.learning),
    "action-pack": clone(fixture.action),
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function codes(findings: readonly { checkId: string }[]): string[] {
  return [...new Set(findings.map((finding) => finding.checkId))].sort();
}

requiredTest("G1 an unchanged bundle preserves every fact", () => {
  assert.deepEqual(checkEditPreservesFacts(packs(), packs()), []);
});

requiredTest("G2 pure rewording is accepted, including a changed sentence-initial word", () => {
  const before = packs();
  const after = packs();
  const summary = after["summary-pack"] as unknown as SummaryPackV1;
  // Same facts, different words. "Pay"/"Lower" are sentence-initial-only tokens,
  // so neither may be read as a named entity.
  summary.breakdown.fastRead = summary.breakdown.fastRead.replaceAll(
    "Pay before the snapshot.",
    "Lower the balance before the snapshot.",
  );
  const action = after["action-pack"] as unknown as ActionPackV1;
  action.implementationPlan.weeklyPractice =
    "Once a week, look at the visible balance and decide whether a small payment or a reminder would make the signal cleaner.";
  assert.deepEqual(checkEditPreservesFacts(before, after), []);
});

requiredTest("G3 a moved quiz key is refused", () => {
  const before = packs();
  const after = packs();
  const learning = after["learning-pack"] as unknown as LearningPackV1;
  learning.quiz.questions[0].correctIndex = (learning.quiz.questions[0].correctIndex + 1) % 3;
  assert.deepEqual(codes(checkEditPreservesFacts(before, after)), ["EDIT.quiz_key"]);
});

requiredTest("G4 a dropped choice is refused", () => {
  const before = packs();
  const after = packs();
  const learning = after["learning-pack"] as unknown as LearningPackV1;
  learning.quiz.questions[2].choices = learning.quiz.questions[2].choices.slice(0, 2);
  learning.quiz.questions[2].correctIndex = 0;
  assert.ok(codes(checkEditPreservesFacts(before, after)).includes("EDIT.quiz_choice_count"));
});

requiredTest("G5 a changed number is refused and an unchanged one is not", () => {
  const before = packs();
  const after = packs();
  const summary = after["summary-pack"] as unknown as SummaryPackV1;
  summary.breakdown.fullRead = summary.breakdown.fullRead.replace("300 to 850 scale", "300 to 800 scale");
  assert.deepEqual(codes(checkEditPreservesFacts(before, after)), ["EDIT.numbers"]);
  assert.ok(editGuardNumbers(before).has("850"));
  assert.ok(!editGuardNumbers(before).has("800"));
  assert.ok(editGuardNumbers(after).has("800"));

  // …and a figure that leaves the chapter entirely is refused the same way.
  const deleted = packs();
  const deletedSummary = deleted["summary-pack"] as unknown as SummaryPackV1;
  deletedSummary.breakdown.fullRead = deletedSummary.breakdown.fullRead.replace("on a 300 to 850 scale", "on a published scale");
  const deletedExamples = deleted["example-pack"] as unknown as ExamplePackV1;
  for (const example of deletedExamples.examples) {
    example.whyItMatters = example.whyItMatters.replace("300 to 850 scale", "published score scale");
  }
  const dropFindings = checkEditPreservesFacts(before, deleted);
  assert.deepEqual(codes(dropFindings), ["EDIT.numbers"]);
  assert.ok(dropFindings.some((f) => f.message.includes("dropped [300, 850]")));
});

requiredTest("G6 an invented named entity is refused", () => {
  const before = packs();
  const after = packs();
  const summary = after["summary-pack"] as unknown as SummaryPackV1;
  summary.keyTakeaway = `${summary.keyTakeaway} It also held for Wanamaker in Philadelphia.`;
  assert.deepEqual(codes(checkEditPreservesFacts(before, after)), ["EDIT.entities"]);
});

requiredTest("G7 a deleted named entity is refused", () => {
  const before = packs();
  const after = packs();
  const examples = after["example-pack"] as unknown as ExamplePackV1;
  for (const example of examples.examples) {
    example.scenario = example.scenario.replace(/\bGracie\b/g, "the cardholder");
    example.whyItMatters = example.whyItMatters.replace(/\bGracie\b/g, "the cardholder");
  }
  const findings = checkEditPreservesFacts(before, after);
  assert.ok(codes(findings).includes("EDIT.entities"));
  assert.ok(findings.some((finding) => finding.message.includes("Gracie")));
});

requiredTest("G8 a re-cited anchor is refused", () => {
  const before = packs();
  const after = packs();
  const summary = after["summary-pack"] as unknown as SummaryPackV1;
  summary.keyTakeawaySourceAnchorIds = ["ch01.case.fico"];
  assert.deepEqual(codes(checkEditPreservesFacts(before, after)), ["EDIT.citations"]);
});

requiredTest("G9 a renamed or dropped unit is refused", () => {
  const renamed = packs();
  (renamed["learning-pack"] as unknown as LearningPackV1).quiz.questions[4].questionId = "q99";
  assert.ok(codes(checkEditPreservesFacts(packs(), renamed)).includes("EDIT.unit_ids"));

  const dropped = packs();
  const examples = dropped["example-pack"] as unknown as ExamplePackV1;
  examples.examples = examples.examples.slice(0, 5);
  assert.ok(codes(checkEditPreservesFacts(packs(), dropped)).includes("EDIT.unit_ids"));
});

requiredTest("G10 a structurally broken edit is refused rather than crashing", () => {
  const before = packs();
  const after = { ...packs(), "learning-pack": { artifactType: "learning-pack" } as unknown as Record<string, unknown> };
  const findings = checkEditPreservesFacts(before, after as ChapterEditPacks);
  assert.ok(findings.length > 0);
  assert.ok(codes(findings).includes("EDIT.pack_shape"));
});

requiredTest("G11 the entity set keeps names and drops openers, Title Case nouns and citation ids", () => {
  const entities = editGuardEntities(packs());
  // A dealt protagonist, written mid-sentence and never lowercased anywhere.
  assert.ok(entities.has("Gracie"));
  // "Open" opens `tryThisNow`; it never appears mid-sentence, so it is not an entity.
  assert.ok(!entities.has("Open"));
  // Title Case heading words whose lowercase form is ordinary chapter prose.
  assert.ok(!entities.has("The"));
  assert.ok(!entities.has("Balance"));
  // Anchor ids are citations, not prose: neither their digits nor their words leak in.
  assert.ok(!editGuardNumbers(packs()).has("01"));
  assert.ok(!entities.has("Credit"));
});

requiredTest("G12 a permuted choice list is refused even though correctIndex never moved", () => {
  const before = packs();
  const after = packs();
  const learning = after["learning-pack"] as unknown as LearningPackV1;
  const question = learning.quiz.questions[0];
  // The exact class the guard used to miss: the SAME three choices, the SAME
  // correctIndex, the key now sitting behind a distractor's words. Nothing else
  // in the chapter changes, so every other check is satisfied by construction.
  const key = question.correctIndex;
  const other = (key + 1) % 3;
  const swapped = question.choices[key];
  question.choices[key] = question.choices[other];
  question.choices[other] = swapped;
  const findings = checkEditPreservesFacts(before, after);
  assert.deepEqual(codes(findings), ["EDIT.quiz_key_text"]);
  assert.ok(findings.some((finding) => finding.message.includes(question.questionId)), findings.map((f) => f.message).join(" | "));
});

requiredTest("G13 a reworded keyed answer is refused, and a reworded distractor is accepted", () => {
  const reworded = packs();
  const rewordedLearning = reworded["learning-pack"] as unknown as LearningPackV1;
  const keyed = rewordedLearning.quiz.questions[1];
  keyed.choices[keyed.correctIndex] = "Pay before the reportable total is read";
  assert.deepEqual(codes(checkEditPreservesFacts(packs(), reworded)), ["EDIT.quiz_key_text"]);

  // The other half of the rule: the brief asks for better distractors, so a
  // rewritten WRONG choice is still an edit the guard admits.
  const distractor = packs();
  const distractorLearning = distractor["learning-pack"] as unknown as LearningPackV1;
  const question = distractorLearning.quiz.questions[1];
  const wrong = (question.correctIndex + 1) % 3;
  question.choices[wrong] = "Assume the lender will read repayment intent out of the account history";
  assert.deepEqual(checkEditPreservesFacts(packs(), distractor), []);
});

requiredTest("G14 an edit that changes only an explanation sentence is accepted", () => {
  const after = packs();
  const learning = after["learning-pack"] as unknown as LearningPackV1;
  learning.quiz.questions[0].explanation =
    "The keyed move lowers what a lender can read before the signal travels; the other options lean on intention or on extra accounts.";
  assert.deepEqual(checkEditPreservesFacts(packs(), after), []);
});

requiredTest("G15 a keyed answer copied onto a distractor, or two choices collapsed into one, is refused", () => {
  const copied = packs();
  const copiedLearning = copied["learning-pack"] as unknown as LearningPackV1;
  const first = copiedLearning.quiz.questions[2];
  // Case-and-punctuation clothes do not make it a different choice.
  first.choices[(first.correctIndex + 1) % 3] = `${first.choices[first.correctIndex].toLowerCase()}.`;
  const copiedFindings = codes(checkEditPreservesFacts(packs(), copied));
  assert.ok(copiedFindings.includes("EDIT.quiz_key_text"), copiedFindings.join(", "));
  assert.ok(copiedFindings.includes("EDIT.quiz_choice_text"), copiedFindings.join(", "));

  const collapsed = packs();
  const collapsedLearning = collapsed["learning-pack"] as unknown as LearningPackV1;
  const second = collapsedLearning.quiz.questions[3];
  const wrongA = (second.correctIndex + 1) % 3;
  const wrongB = (second.correctIndex + 2) % 3;
  second.choices[wrongB] = second.choices[wrongA];
  assert.deepEqual(codes(checkEditPreservesFacts(packs(), collapsed)), ["EDIT.quiz_choice_text"]);
});

requiredTest("G16 a pack that gains or loses a top-level field is refused", () => {
  const added = packs();
  // The class the brief's MEMORABLE LINES clause used to invite: a field that
  // exists in no pack schema, emitted into a pack and carried into the artifact.
  (added["summary-pack"] as Record<string, unknown>).memorableLines = ["a principle that stands on its own"];
  assert.deepEqual(codes(checkEditPreservesFacts(packs(), added)), ["EDIT.pack_shape"]);

  const dropped = packs();
  delete (dropped["action-pack"] as Record<string, unknown>).tryThisNow;
  assert.ok(codes(checkEditPreservesFacts(packs(), dropped)).includes("EDIT.pack_shape"));
});

finishV25Tests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
