/** Chapter Format v25 (D8, plan v2 P2) — schema, gate, card, and conductor
 * threading. Proves: (1) F-2 fields are additive (pre-v25 chapters stay
 * schema-valid; malformed F-2 fields fail); (2) the F25.quiz_feedback check
 * blocks ONLY when formatV25 enforcement is on, so gate-chapter replays of the
 * shipped corpus never regress; (3) the advisory heuristics fire on the
 * verified corpus defect shapes without gating; (4) the writer card carries the
 * format contract; (5) the frozen review config accepts the D1 policy only on
 * the V2 protocol path. */

import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "fs";
import { resolve } from "path";

import { test, xenv } from "./harness.js";
import { PIPELINE_DIR } from "./helpers.js";
import type { ChapterV21 } from "../src/types.js";
import { validateChapterV21 } from "../src/runtimeSchemas.js";
import {
  checkFormatV25DuplicateExamples,
  checkFormatV25QuizFeedback,
  checkFormatV25TierSerialOpeners,
  checkFormatV25LoopClosure,
  checkFormatV25,
} from "../src/critics/formatV25.js";
import { runShipGate, ENFORCED_MAJOR } from "../src/critics/finalGate.js";
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

// ── F25.loop_closure (D6.3/6.4) — shadow loop-closure/boundary critic ─────────

/** A minimal happy-path chapter: concrete if-then action steps that name NO
 *  failure/obstacle, and prose with ZERO boundary cue. Cast for the unit checks
 *  (checkFormatV25LoopClosure reads only implementationPlan + string fields). */
function happyPathSynthetic(): ChapterV21 {
  return {
    hook: "Name one clear aim before the day opens.",
    breakdown: {
      fastRead: "Momentum grows the moment you write the day's aim where your eye lands first.",
      deepRead: "A second pass shows the aim compounding into a rhythm you can feel by the weekend.",
      fullRead: "A third pass widens that rhythm across a full week of clean starts and steady wins.",
    },
    implementationPlan: {
      ifThenPlans: [{ context: "morning", plan: "If you sit at your desk, then open the planner and write the day's single aim." }],
      coreSkill: "Write one concrete aim where you will see it, then begin.",
      twentyFourHourChallenge: "Today, write one aim on a sticky note and place it on your screen.",
      weeklyPractice: "Each week, review the aims you wrote and keep the phrasing that pulled you forward.",
    },
  } as unknown as ChapterV21;
}

test("F25.loop_closure fires on an initiation-only plan with no boundary cue", () => {
  const hits = checkFormatV25LoopClosure(happyPathSynthetic());
  assert.equal(hits.length, 1, "a happy-path chapter (no contingency if-then, no boundary cue) fires");
  assert.equal(hits[0].catalogId, "F25.loop_closure");
  assert.equal(hits[0].unit, "implementationPlan.ifThenPlans");
});

test("F25.loop_closure is silent when the loop is closed OR a boundary is drawn", () => {
  // (a) a single boundary cue anywhere in prose silences it.
  const withCue = happyPathSynthetic();
  withCue.keyTakeaway = "This routine is not a substitute for real rest.";
  assert.equal(checkFormatV25LoopClosure(withCue).length, 0, "a boundary cue in the prose silences the critic");

  // (b) an if-then that names a failure/obstacle contingency silences it.
  const withContingency = happyPathSynthetic();
  withContingency.implementationPlan.ifThenPlans = [
    { context: "recovery", plan: "If you slip and skip a day, then shrink the aim and restart the next morning." },
  ];
  assert.equal(checkFormatV25LoopClosure(withContingency).length, 0, "a contingency if-then closes the loop");

  // (c) no if-then action steps → nothing to close; the critic is not this check's job.
  const noPlans = happyPathSynthetic();
  noPlans.implementationPlan.ifThenPlans = [];
  assert.equal(checkFormatV25LoopClosure(noPlans).length, 0, "no action steps → no finding");
});

test("F25.loop_closure is wired into checkFormatV25 and ships SHADOW (major, never enforced/blocking)", () => {
  // Wiring: the aggregate carries the loop-closure finding.
  const ch = happyPathValidChapter();
  assert.ok(checkFormatV25LoopClosure(ch).length === 1, "fixture must fire the unit check");
  assert.ok(checkFormatV25(ch).some((f) => f.catalogId === "F25.loop_closure"), "checkFormatV25 includes the loop-closure finding");

  // Severity: surfaced as a MAJOR under enforcement, never a blocker, never enforced.
  const gated = runShipGate(ch, { isolationMode: "experiment", allocatedNames: [], exampleFloor: 2, sourceSidecar: {}, sourceUsePlan: null, formatV25: true });
  assert.ok(gated.majors.some((f) => f.catalogId === "F25.loop_closure"), "F25.loop_closure surfaces as a major");
  assert.ok(gated.blockers.every((f) => f.catalogId !== "F25.loop_closure"), "F25.loop_closure never blocks (STIER-2 shadow)");
  assert.equal(ENFORCED_MAJOR.has("F25.loop_closure"), false, "F25.loop_closure is NOT in ENFORCED_MAJOR");

  // And it never fires when formatV25 enforcement is off (shipped-corpus replay safety).
  const replay = runShipGate(ch, { isolationMode: "experiment", allocatedNames: [], exampleFloor: 2, sourceSidecar: {}, sourceUsePlan: null });
  assert.ok([...replay.blockers, ...replay.majors, ...replay.minors].every((f) => f.catalogId !== "F25.loop_closure"), "no F25 without formatV25");
});

// A schema-valid happy-path chapter (preV25 base, breakdown/plan scrubbed of every
// boundary cue) so the gate wiring + severity can be exercised end-to-end.
function happyPathValidChapter(): ChapterV21 {
  const ch = preV25Chapter();
  ch.breakdown.deepRead = long("A second self-contained pass explains the mechanism with fresh context and one named study bridged to a second worked case.", 1300);
  ch.breakdown.fullRead = long("A third self-contained pass adds a fresh scene, a second domain, and integration with its own opening context and a complete core lesson.", 2600);
  ch.memorableLines = [{ text: "A second self-contained pass explains the mechanism with fresh context", location: "breakdown.deepRead", why: "carries the mechanism image" }];
  ch.implementationPlan = {
    title: "Show the proof",
    coreSkill: "Put a checkable support beside every claim you make, then note which one the audience opens first.",
    ifThenPlans: [{ context: "standup", plan: "If you state a number in the meeting, then paste the source link beside it before you move on." }],
    twentyFourHourChallenge: "Within a day, attach one source link to one claim you already made and post it in the channel.",
    weeklyPractice: "Each week, pick three claims you shared and add one inspectable support to each.",
  };
  return ch;
}

// Zero-FP calibration on the gold corpus: the loop-closure critic must NOT fire on
// any shipped reference chapter (calibrated 2026-07-15 across 140 packages).
const BOOK_PACKAGES_DIR = resolve(PIPELINE_DIR, "../../../../book-packages");
function goldPackageFiles(): string[] {
  return existsSync(BOOK_PACKAGES_DIR)
    ? readdirSync(BOOK_PACKAGES_DIR).filter((f) => f.endsWith(".v21.json"))
    : [];
}
xenv(
  "F25.loop_closure: ZERO false positives across the gold book-packages corpus",
  "no gold corpus at book-packages/*.v21.json on this checkout",
  () => goldPackageFiles().length > 0,
  () => {
    const offenders: string[] = [];
    let chapters = 0;
    for (const f of goldPackageFiles()) {
      const pkg = JSON.parse(readFileSync(resolve(BOOK_PACKAGES_DIR, f), "utf8")) as { chapters?: ChapterV21[] };
      for (const ch of pkg.chapters ?? []) {
        chapters += 1;
        for (const hit of checkFormatV25LoopClosure(ch)) offenders.push(`${f} ${ch.chapterId ?? ch.number}: ${hit.message.slice(0, 80)}`);
      }
    }
    assert.ok(chapters > 1000, `expected the full gold corpus; only scanned ${chapters} chapters`);
    assert.equal(offenders.length, 0, `F25.loop_closure false positives on gold (miscalibrated):\n${offenders.slice(0, 30).join("\n")}`);
  },
);

// ── Writer card ───────────────────────────────────────────────────────────────

test("the writer card carries the Format v25 contract, version-stamped", () => {
  assert.match(AUTHOR_FORMAT_V25_BLOCK, /SELF-CONTAINED TIERS/);
  assert.match(AUTHOR_FORMAT_V25_BLOCK, /QUIZ FEEDBACK \[GATED\]/);
  assert.match(AUTHOR_FORMAT_V25_BLOCK, /exactly ONE read tier/);
  assert.equal(CARD_BLOCK_VERSIONS.formatV25, "format-v25-v2");
  assert.equal(CARD_BLOCK_VERSIONS.schemaHint, "schema-hint-v2");
  assert.equal(CARD_BLOCK_VERSIONS.selfVerify, "self-verify-v4");
  const hint = authorSchemaHint("zz-format-fixture", 3);
  assert.ok(hint.includes("choiceRationales") && hint.includes("revisit") && hint.includes("SELF-CONTAINED"));
  // The write-time self-check carries the full F-1..F-8 evidence block (F-1 layer
  // independence + F-2 quiz feedback lead it), each a PASS/FAIL + one-line evidence.
  const sv = authorSelfVerify("zz-format-fixture", 3);
  assert.match(sv, /FORMAT v25 EVIDENCE/);
  assert.match(sv, /F-1 LAYERS/);
  assert.match(sv, /F-2 QUIZ FEEDBACK/);
  for (const f of ["F-3", "F-4", "F-5", "F-6", "F-7", "F-8"]) assert.ok(sv.includes(f), `self-verify carries ${f}`);
  // The control hash includes the format block — card drift stays detectable.
  const composition = authorCardComposition();
  assert.equal(composition.versions.formatV25, "format-v25-v2");
});

// The D1 policy-threading validation (readerDecisionPolicy is V2-protocol-only)
// lives in forward-chapter-conductor.test.ts, next to the frozen-config
// fixture builders it needs.
