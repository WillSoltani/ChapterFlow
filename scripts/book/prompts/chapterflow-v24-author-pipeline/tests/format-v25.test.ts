/** Chapter Format v25 (D8, plan v2 P2) — schema, gate, card, and conductor
 * threading. Proves: (1) F-2 fields are additive (pre-v25 chapters stay
 * schema-valid; malformed F-2 fields fail); (2) the F25.quiz_feedback check
 * blocks ONLY when formatV25 enforcement is on, so gate-chapter replays of the
 * shipped corpus never regress; (3) the advisory heuristics fire on the
 * verified corpus defect shapes without gating; (4) the writer card carries the
 * format contract; (5) the frozen review config accepts the D1 policy only on
 * the V2 protocol path. */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import type { ChapterV21 } from "../src/types.js";
import { validateChapterV21 } from "../src/runtimeSchemas.js";
import {
  checkFormatV25DuplicateExamples,
  checkFormatV25QuizFeedback,
  checkFormatV25TierSerialOpeners,
} from "../src/critics/formatV25.js";
import { runShipGate } from "../src/critics/finalGate.js";
import {
  AUTHOR_FORMAT_V25_BLOCK,
  CARD_BLOCK_VERSIONS,
  authorCardComposition,
  authorSchemaHint,
  authorSelfVerify,
} from "../src/orchestrator/authorRun.js";
function long(base: string, target: number): string {
  let out = base;
  while (out.length < target) out += ` ${base}`;
  return out.slice(0, target);
}

/** A minimal schema-valid chapter WITHOUT the F-2 feedback block (the shipped
 *  pre-v25 shape). */
function preV25Chapter(): ChapterV21 {
  const question = (index: number) => ({
    questionId: `q0${index + 1}`,
    prompt: `Which choice fits scenario ${index + 1}?`,
    choices: ["first option", "second option", "third option"],
    correctIndex: 0,
    explanation: long("The first option is right because the mechanism the chapter teaches predicts it.", 140),
    bloomsLevel: "apply" as const,
    depthLevel: "standard" as const,
  });
  return {
    schemaVersion: "chapterflow-v21-authored",
    chapterId: "zz-format-fixture-ch03",
    number: 3,
    title: "Fixture Chapter",
    readingTimeMinutes: 7,
    hook: long("A concrete stake the reader can see before any abstraction arrives.", 80),
    counterintuition: "The obvious default is exactly backwards here.",
    tryThisNow: long("Pick one live claim and add one checkable support to it now.", 100),
    keyTakeaway: long("Move belief from speaker confidence onto support the audience can inspect and challenge.", 150),
    breakdown: {
      fastRead: long("A scene establishes the rule in plain words with its own context.", 450),
      deepRead: long("A second self-contained pass explains the mechanism with fresh context and one named study bridged to its limits.", 1300),
      fullRead: long("A third self-contained pass adds boundaries, misuse, and integration with its own opening scene and complete core lesson.", 2600),
    },
    examples: [
      {
        exampleId: "ex01",
        title: "Market stall",
        tags: ["consumer"],
        planSpec: { domain: "retail", audience: "buyer", stakes: "money", format: "scene", requiredBeat: "proof" },
        scenario: long("A buyer weighs a vendor claim against a visible batch log at a market stall.", 300),
        whatToDo: long("Ask for the checkable record before accepting the claim.", 130),
        whyItMatters: long("Inspection beats confidence when money is on the line.", 130),
      },
      {
        exampleId: "ex02",
        title: "Team memo",
        tags: ["work"],
        planSpec: { domain: "office", audience: "manager", stakes: "time", format: "scene", requiredBeat: "proof" },
        scenario: long("A manager rewrites a memo so the evidence sits beside the recommendation it supports.", 300),
        whatToDo: long("Place the support next to the claim so readers can check it.", 130),
        whyItMatters: long("Colleagues change their minds without social pressure.", 130),
      },
    ],
    quiz: { passingScorePercent: 70, questions: [question(0), question(1)] },
    reviewCards: [
      { cardId: "c01", front: long("What beats confidence?", 40), back: long("Support the audience can inspect and challenge on their own.", 90), difficulty: "medium" },
    ],
    implementationPlan: {
      title: "Show the proof",
      coreSkill: "Show the proof. Put checkable support beside every claim you make. Watch what the audience checks. Revise the claim if the check fails.",
      ifThenPlans: [{ context: "If a claim meets doubt", plan: "If doubt appears, then show the log and invite the check." }],
      twentyFourHourChallenge: "Add one checkable support to one live claim within 24 hours, then note whether it was checked.",
      weeklyPractice: "Each week classify three claims you made and whether each carried inspectable support.",
    },
    memorableLines: [{ text: "Confidence asks for trust; credibility survives a check.", location: "breakdown.deepRead", why: "carries the central image" }],
  };
}

/** The same chapter WITH a complete F-2 feedback block. */
function v25Chapter(): ChapterV21 {
  const chapter = preV25Chapter();
  for (const question of chapter.quiz.questions) {
    question.choiceRationales = [
      "Right: the mechanism predicts inspection wins.",
      "Encodes the confidence-equals-credibility misconception.",
      "Encodes the more-drama-more-belief misconception.",
    ];
    question.revisit = { component: "Deep read", ref: "the mechanism paragraph that contrasts confidence with inspection" };
  }
  return chapter;
}

// ── Schema: additive F-2 fields ───────────────────────────────────────────────

test("pre-v25 chapters stay schema-valid; well-formed F-2 fields validate; malformed fail", () => {
  assert.equal(validateChapterV21(preV25Chapter()).ok, true, "the shipped corpus shape must keep parsing");
  assert.equal(validateChapterV21(v25Chapter()).ok, true, "the F-2 feedback block is schema-valid");

  const wrongCount = v25Chapter();
  wrongCount.quiz.questions[0].choiceRationales = ["only one"];
  assert.equal(validateChapterV21(wrongCount).ok, false, "choiceRationales must match choice count");

  const badRevisit = v25Chapter();
  (badRevisit.quiz.questions[0] as { revisit?: unknown }).revisit = { component: "Deep read" };
  assert.equal(validateChapterV21(badRevisit).ok, false, "revisit needs component AND ref");
});

// ── Gate: F25.quiz_feedback blocks only under enforcement ────────────────────

test("F25.quiz_feedback: missing feedback block blocks NEW authoring, never replays", () => {
  const chapter = preV25Chapter();
  const replay = runShipGate(chapter, { isolationMode: "experiment", allocatedNames: [], exampleFloor: 2, sourceSidecar: {}, sourceUsePlan: null });
  const allFindings = (r: { blockers: { catalogId: string }[]; majors: { catalogId: string }[]; minors: { catalogId: string }[] }) => [...r.blockers, ...r.majors, ...r.minors];
  assert.ok(!allFindings(replay).some((f) => f.catalogId.startsWith("F25.")),
    "without formatV25 the gate never emits F25 findings (shipped-corpus replay safety)");

  const enforced = runShipGate(chapter, { isolationMode: "experiment", allocatedNames: [], exampleFloor: 2, sourceSidecar: {}, sourceUsePlan: null, formatV25: true });
  const f25 = enforced.blockers.filter((f) => f.catalogId === "F25.quiz_feedback");
  assert.equal(f25.length, 4, "each of 2 questions is missing rationales AND revisit, as blockers");

  const complete = runShipGate(v25Chapter(), { isolationMode: "experiment", allocatedNames: [], exampleFloor: 2, sourceSidecar: {}, sourceUsePlan: null, formatV25: true });
  assert.ok(!allFindings(complete).some((f) => f.catalogId === "F25.quiz_feedback"),
    "a complete feedback block passes");
});

test("F25 revisit pointers must resolve to a real component", () => {
  const chapter = v25Chapter();
  chapter.quiz.questions[0].revisit = { component: "Example 7", ref: "does not exist" };
  const findings = checkFormatV25QuizFeedback(chapter);
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /real reader-facing component/);

  chapter.quiz.questions[0].revisit = { component: "Example 2", ref: "the memo rewrite" };
  assert.equal(checkFormatV25QuizFeedback(chapter).length, 0, "an in-range Example N resolves");
});

// ── Advisories: verified corpus defect shapes ─────────────────────────────────

test("F25 advisories fire on duplicate staging and serial tier openers, as minors", () => {
  const dup = v25Chapter();
  dup.examples[1].scenario = dup.examples[0].scenario;
  dup.examples[1].whatToDo = dup.examples[0].whatToDo;
  dup.examples[1].whyItMatters = dup.examples[0].whyItMatters;
  const dupFindings = checkFormatV25DuplicateExamples(dup);
  assert.equal(dupFindings.length, 1, "identical staging is flagged");

  const serial = v25Chapter();
  serial.breakdown.deepRead = `Rachel's proof works because the buyer can check it. ${serial.breakdown.deepRead}`;
  serial.breakdown.fullRead = `${serial.breakdown.fullRead} As we saw, the towel study made the norm visible.`;
  const serialFindings = checkFormatV25TierSerialOpeners(serial);
  assert.equal(serialFindings.length, 2, "possessive opener + back-reference connective both flagged");

  const gated = runShipGate(serial, { isolationMode: "experiment", allocatedNames: [], exampleFloor: 2, sourceSidecar: {}, sourceUsePlan: null, formatV25: true });
  const advisories = gated.minors.filter((f) => f.catalogId === "F25.tier_serial_opener");
  assert.ok(advisories.length >= 2 && gated.blockers.every((f) => f.catalogId !== "F25.tier_serial_opener"),
    "serial-opener heuristics are ADVISORY (STIER-2: semantic properties never gate lexically)");
});

// ── Writer card ───────────────────────────────────────────────────────────────

test("the writer card carries the Format v25 contract, version-stamped", () => {
  assert.match(AUTHOR_FORMAT_V25_BLOCK, /SELF-CONTAINED TIERS/);
  assert.match(AUTHOR_FORMAT_V25_BLOCK, /QUIZ FEEDBACK \[GATED\]/);
  assert.match(AUTHOR_FORMAT_V25_BLOCK, /exactly ONE read tier/);
  assert.equal(CARD_BLOCK_VERSIONS.formatV25, "format-v25-v1");
  assert.equal(CARD_BLOCK_VERSIONS.schemaHint, "schema-hint-v2");
  assert.equal(CARD_BLOCK_VERSIONS.selfVerify, "self-verify-v3");
  const hint = authorSchemaHint("zz-format-fixture", 3);
  assert.ok(hint.includes("choiceRationales") && hint.includes("revisit") && hint.includes("SELF-CONTAINED"));
  assert.match(authorSelfVerify("zz-format-fixture", 3), /5\. TIERS & FEEDBACK/);
  // The control hash includes the format block — card drift stays detectable.
  const composition = authorCardComposition();
  assert.equal(composition.versions.formatV25, "format-v25-v1");
});

// The D1 policy-threading validation (readerDecisionPolicy is V2-protocol-only)
// lives in forward-chapter-conductor.test.ts, next to the frozen-config
// fixture builders it needs.
