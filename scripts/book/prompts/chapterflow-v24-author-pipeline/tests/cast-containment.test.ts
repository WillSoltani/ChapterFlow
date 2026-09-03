/**
 * SEC119 cast containment + the F14 hardSpecifics quota rebalance (P15).
 *
 * F13 — CAST LEAK. The example pack deals fictional protagonist names
 * (reservedVariety.allowedNames + per-slot allowedNames) so its six scenes stay
 * distinct. The regenerated the-power-of-moments ch01 leaked them into the reader's
 * OWN plan: coreSkill said "what will Margaret, Lorne, or another real person
 * remember" and an ifThen plan said "hand it to Sophie by name". SEC119 forbids any
 * USED fictional-cast name in the ACTION pack's reader-facing plan. (It is scoped to
 * the action pack: the summary narrating a named case is the SUMMARY_VOICE house style,
 * and reusing an example protagonist in a quiz is the C25-blessed callback pattern — see
 * the scope note in sectionGate.ts and scratch/calibrate-cast-containment.ts.) The USED
 * intersection (a dealt name must actually appear in the example pack before it can
 * leak) keeps common-word bank names (Chase, Grant, Dean, Drew) from false-positiving.
 *
 * F14 — QUOTA-DRIVEN STUFFING. The ≥2 verbatim-hardSpecifics quota on NON-NARRATIVE
 * units (quiz SEC56, action SEC74) mechanically forced identifier-sentence stapling.
 * The rebalance drops those to ≥1; NARRATION units (example SEC33, summary SEC13/14)
 * keep ≥2.
 */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import {
  castContainmentFindings,
  usedExampleCast,
  exampleCastCandidates,
  validateAnchorHardSpecifics,
  validateLearningPack,
  validateExamplePack,
  type SectionFinding,
} from "../src/sections/sectionGate.js";
import type {
  ChapterBlueprintV1,
  ExamplePackV1,
  LearningPackV1,
  ActionPackV1,
  SummaryPackV1,
  SourcePacketV1,
} from "../src/artifacts/artifactTypes.js";
import type { SourceAnchorForPrompt } from "../src/types.js";

const CH = 1;
const CHID = "zz-cast-ch01";

// Six dealt names. "Chase" is dealt but the example pack never uses it — it is a
// bank name that is also a common English verb, so it must NEVER trip SEC119.
const DEALT = ["Margaret", "Lorne", "Leah", "Tristan", "Sophie", "Chase"];

function blueprint(): ChapterBlueprintV1 {
  return {
    chapterNumber: CH,
    chapterId: CHID,
    reservedVariety: { allowedNames: DEALT, forbiddenNames: [] },
    sections: {
      examples: [
        { allowedNames: ["Margaret", "Lorne", "Leah"] },
        { allowedNames: ["Tristan", "Sophie", "Chase"] },
      ],
    },
  } as unknown as ChapterBlueprintV1;
}

// An example pack that USES Margaret/Lorne/Leah/Tristan/Sophie but NOT "Chase".
function examplePack(): ExamplePackV1 {
  const mk = (id: string, scenario: string) => ({ exampleId: id, title: "A moment", scenario, whatToDo: "Do the thing.", whyItMatters: "It matters." });
  return {
    schemaVersion: "section-artifact-v1",
    artifactType: "example-pack",
    chapterId: CHID,
    examples: [
      mk("ex01", "Margaret redesigns the ending of a hospital scan while Lorne watches."),
      mk("ex02", "Leah and Tristan rebuild a graduation moment; Sophie hands over the ritual."),
    ],
  } as unknown as ExamplePackV1;
}

function summaryPack(fields: Partial<Record<"fullRead" | "keyTakeaway", string>>): SummaryPackV1 {
  return {
    schemaVersion: "section-artifact-v1",
    artifactType: "summary-pack",
    chapterId: CHID,
    hook: { hook: "Ordinary moments can be engineered.", counterintuition: "" },
    breakdown: { fastRead: "", deepRead: "", fullRead: fields.fullRead ?? "" },
    keyTakeaway: fields.keyTakeaway ?? "Build the peak on purpose.",
    keyTakeawaySourceAnchorIds: [],
    sourceFactIds: [],
  } as unknown as SummaryPackV1;
}

// ── SEC119: used-cast derivation ─────────────────────────────────────────────

test("SEC119: usedExampleCast is the dealt names actually used by the examples (Chase excluded)", () => {
  const used = usedExampleCast(blueprint(), examplePack());
  assert.deepEqual([...used].sort(), ["Leah", "Lorne", "Margaret", "Sophie", "Tristan"]);
  assert.ok(!used.has("Chase"), "Chase is dealt but unused → not cast");
  // Candidates include every dealt name (book-level + per-slot), Chase included.
  assert.ok(exampleCastCandidates(blueprint()).has("Chase"), "Chase is a dealt candidate");
});

// ── SEC119: leaks fire; the example pack itself is never scanned ──────────────

test("SEC119: a used-cast name in an action plan/coreSkill is a blocker naming the field and name", () => {
  const used = usedExampleCast(blueprint(), examplePack());
  const action = {
    schemaVersion: "section-artifact-v1",
    artifactType: "action-pack",
    chapterId: CHID,
    tryThisNow: "Name the current ending of one routine and redesign its final sixty seconds today.",
    tryThisNowSourceAnchorIds: [],
    implementationPlan: {
      title: "Redesign the ending",
      coreSkill: "First name the current ending: what will Margaret or Lorne remember afterward?",
      ifThenPlans: [
        { context: "When no one owns the moment", plan: "If no one can carry it, then hand it to Sophie by name or refuse the ceremony." },
      ],
      twentyFourHourChallenge: "Pick one routine and lift its ending once.",
      weeklyPractice: "Audit one ending each week.",
    },
  } as unknown as ActionPackV1;
  const hits = castContainmentFindings(action, used, CH).filter((f) => f.checkId === "SEC119.cast_containment");
  const names = hits.map((h) => h.message.match(/names "([^"]+)"/)?.[1]).sort();
  assert.deepEqual(names, ["Lorne", "Margaret", "Sophie"], `expected Margaret/Lorne/Sophie leaks; got ${JSON.stringify(hits.map((h) => h.message))}`);
  assert.ok(hits.every((f) => f.severity === "blocker" && f.section === "action-pack"), "SEC119 is an action-pack blocker");
  assert.ok(hits.some((f) => f.path === "/implementationPlan/coreSkill"), "coreSkill leak names its field");
  assert.ok(hits.some((f) => f.path === "/implementationPlan/ifThenPlans/0/plan"), "ifThen plan leak names its field");
});

// A schema-valid action pack whose plan names the given text in one ifThen plan.
function actionPack(ifThenPlan: string, coreSkill = "Name the current ending, then redesign its final sixty seconds."): ActionPackV1 {
  return {
    schemaVersion: "section-artifact-v1",
    artifactType: "action-pack",
    chapterId: CHID,
    tryThisNow: "Name the current ending of one routine and redesign its final sixty seconds today.",
    tryThisNowSourceAnchorIds: [],
    implementationPlan: {
      title: "Redesign the ending",
      coreSkill,
      ifThenPlans: [{ context: "When no one owns the moment", plan: ifThenPlan }],
      twentyFourHourChallenge: "Pick one routine and lift its ending once.",
      weeklyPractice: "Audit one ending each week.",
    },
  } as unknown as ActionPackV1;
}

test("SEC119: a dealt-but-unused name as a common word (Chase) never fires in the plan", () => {
  const used = usedExampleCast(blueprint(), examplePack());
  const action = actionPack("If the metric tempts you, then do not Chase every number; lift the one ending readers remember.");
  const hits = castContainmentFindings(action, used, CH).filter((f) => f.checkId === "SEC119.cast_containment");
  assert.deepEqual(hits, [], `"Chase" is unused cast + a common word → no leak; got ${JSON.stringify(hits.map((h) => h.message))}`);
});

test("SEC119: only the action pack is scanned — the example, learning, and summary packs are exempt", () => {
  const used = usedExampleCast(blueprint(), examplePack());
  // The example pack legitimately holds the whole cast.
  assert.deepEqual(castContainmentFindings(examplePack(), used, CH), [], "example pack exempt by design");
  // A learning pack whose quiz reuses a cast name (the C25-blessed callback) is NOT a SEC119 blocker.
  const learning = {
    schemaVersion: "section-artifact-v1", artifactType: "learning-pack", chapterId: CHID,
    quiz: { passingScorePercent: 70, questions: [{ questionId: "q01", prompt: "Margaret faces the same call again and must decide first.", choices: ["a", "b", "c"], correctIndex: 0, explanation: "…" }] },
    cards: { cards: [] },
  } as unknown as LearningPackV1;
  assert.deepEqual(castContainmentFindings(learning, used, CH), [], "quiz callback is C25's domain, not SEC119");
  // A summary narrating a named case is the SUMMARY_VOICE house style, not a SEC119 blocker.
  assert.deepEqual(castContainmentFindings(summaryPack({ fullRead: "Margaret shows how endings can be rebuilt on purpose." }), used, CH), [], "summary narration is house style");
});

test("SEC119: with no example pack (empty used-cast) nothing fires", () => {
  const clean = castContainmentFindings(actionPack("If no one can carry it, then hand it to Margaret by name."), new Set<string>(), CH);
  assert.deepEqual(clean, [], "empty cast → no containment findings (example pack not generated yet)");
});

// ── F14: hardSpecifics quota — boundary ──────────────────────────────────────

function anchorMap(anchor: SourceAnchorForPrompt): Map<string, SourceAnchorForPrompt> {
  return new Map([[anchor.id, anchor]]);
}

test("F14: a quiz/action unit passes with ONE verbatim specific and fails with zero (min=1)", () => {
  const anchor: SourceAnchorForPrompt = {
    id: "a1", kind: "named_example", label: "Magic Castle", text: "…",
    hardSpecifics: ["Magic Castle Hotel", "free popsicles"],
    supportsClaimTypes: ["quiz_prompt", "implementation_guidance"],
  };
  const map = anchorMap(anchor);
  const oneQuiz = validateAnchorHardSpecifics(["a1"], map, "quiz_prompt", "Suppose the Magic Castle Hotel wants a stronger ending.", "q", 1);
  assert.deepEqual(oneQuiz, [], "one verbatim specific satisfies the rebalanced quiz quota");
  const zeroQuiz = validateAnchorHardSpecifics(["a1"], map, "quiz_prompt", "Suppose a resort wants a stronger ending.", "q", 1);
  assert.equal(zeroQuiz.length, 1, "zero specifics still fails");
  assert.match(zeroQuiz[0], /0\/1/, "message reports the 1-specific quota");
  const oneAction = validateAnchorHardSpecifics(["a1"], map, "implementation_guidance", "Add free popsicles to one routine ending.", "coreSkill", 1);
  assert.deepEqual(oneAction, [], "one verbatim specific satisfies the rebalanced action quota");
});

test("F14: NARRATION units keep min=2 — one specific still fails (SEC33/SEC13/SEC14 unchanged)", () => {
  const anchor: SourceAnchorForPrompt = {
    id: "a1", kind: "named_example", label: "Magic Castle", text: "…",
    hardSpecifics: ["Magic Castle Hotel", "free popsicles"],
    supportsClaimTypes: ["example", "breakdown_claim"],
  };
  const map = anchorMap(anchor);
  const oneExample = validateAnchorHardSpecifics(["a1"], map, "example", "The Magic Castle Hotel redesigns a stay.", "ex", 2);
  assert.equal(oneExample.length, 1, "one specific fails the ≥2 narration quota");
  assert.match(oneExample[0], /1\/2/, "message reports the 2-specific quota");
  const twoExample = validateAnchorHardSpecifics(["a1"], map, "example", "The Magic Castle Hotel hands out free popsicles.", "ex", 2);
  assert.deepEqual(twoExample, [], "two specifics satisfy the narration quota");
});

// ── 11p: SEC16 memorable-line grounding is per-ONE-cited-case (OR), not all-cases (AND) ──
//
// FINDING 20: memorable-line candidates inherit ALL of their tier's sourceAnchorIds, and
// SEC16 (validateAnchorHardSpecifics over candidate.ids) fired AND-per-anchor — so a tier
// citing several specifics-rich cases demanded 2 verbatim hardSpecifics from EVERY case
// inside one 8-14-word aphorism. Structurally unsatisfiable (latent in v24, exposed by 11o
// making specifics universal + short). The memorable-line check ONLY now treats the cited
// specifics-rich anchors as ALTERNATIVES: pass if ANY ONE contributes >=2 verbatim
// specifics; only when NONE does surface one blocker per unsatisfied anchor (message shape
// unchanged, so the 11h retry card still enumerates every option). SEC14/SEC33/quiz stay AND.

const memAnchorMap = (): Map<string, SourceAnchorForPrompt> =>
  new Map<string, SourceAnchorForPrompt>([
    ["a1", { id: "a1", kind: "named_example", label: "Magic Castle", text: "…", hardSpecifics: ["Magic Castle Hotel", "free popsicles"], supportsClaimTypes: ["memorable_line", "breakdown_claim"] }],
    ["a2", { id: "a2", kind: "named_example", label: "Panera", text: "…", hardSpecifics: ["Panera Bread", "pay what you can"], supportsClaimTypes: ["memorable_line", "breakdown_claim"] }],
    ["a3", { id: "a3", kind: "named_example", label: "Sparse", text: "…", hardSpecifics: ["one detail"], supportsClaimTypes: ["memorable_line"] }],
  ]);

test("11p (a): a memorable line grounding ONE cited case (2 verbatim specifics) passes SEC16 even when the tier cites OTHER specifics-rich cases (OR)", () => {
  const map = memAnchorMap();
  // Satisfies a1 (both specifics) but NOT a2 (Panera). Under the old AND-per-anchor
  // semantics this returned one blocker for a2; under OR it passes.
  const line = "The Magic Castle Hotel wins on free popsicles, not room averages.";
  const orPass = validateAnchorHardSpecifics(["a1", "a2"], map, "memorable_line", line, `selected memorable line "${line}"`, 2, "any");
  assert.deepEqual(orPass, [], `one fully-grounded cited case satisfies SEC16 under OR; got ${JSON.stringify(orPass)}`);
});

test("11p (b): a memorable line grounding NO cited case still fails SEC16, one blocker per unsatisfied anchor, message shape unchanged", () => {
  const map = memAnchorMap();
  const line = "A resort wins on small gifts, not on averages.";
  const findings = validateAnchorHardSpecifics(["a1", "a2"], map, "memorable_line", line, `selected memorable line "${line}"`, 2, "any");
  assert.equal(findings.length, 2, "no cited case grounded → one blocker per specifics-rich anchor (retry-card enumeration)");
  for (const f of findings) assert.match(f, /but uses \d+\/2 required hardSpecifics verbatim; build the unit from the anchor's concrete details/, "message shape is unchanged from the AND-era wording");
  assert.ok(findings.some((f) => f.includes("a1")) && findings.some((f) => f.includes("a2")), "both cited anchors are enumerated as options");
});

test("11p (c): a memorable line whose tier cites only specifics-poor anchors (<2 each) still passes SEC16 (vacuous skip preserved)", () => {
  const map = memAnchorMap();
  const line = "Small gifts beat smooth averages every time.";
  const findings = validateAnchorHardSpecifics(["a3"], map, "memorable_line", line, `selected memorable line "${line}"`, 2, "any");
  assert.deepEqual(findings, [], "an anchor carrying <2 hardSpecifics is skipped, so SEC16 passes vacuously");
});

test("11p (d): SEC14 tier-level multi-anchor grounding stays AND (default combine) — an unsatisfied specifics-rich anchor still blocks", () => {
  const map = memAnchorMap();
  // Same line that satisfies a1 but not a2. As a breakdown_claim (SEC14, default AND),
  // the unsatisfied a2 MUST still surface — the tier prose has a 350-2400 char budget.
  const line = "The Magic Castle Hotel wins on free popsicles, not room averages.";
  const andFail = validateAnchorHardSpecifics(["a1", "a2"], map, "breakdown_claim", line, "breakdown.fullRead", 2);
  assert.equal(andFail.length, 1, "AND semantics: the unsatisfied a2 still blocks under the default combine");
  assert.match(andFail[0], /a2 but uses \d+\/2 required hardSpecifics verbatim/, "the blocker names the unsatisfied anchor a2");
});

// ── F14: quota flows through the real gates (integration) ─────────────────────

function packetWithAnchor(anchor: SourceAnchorForPrompt): SourcePacketV1 {
  return {
    allowedAnchors: [anchor], facts: [], namedCases: [], allowedEntities: [], allowedNumbers: [],
  } as unknown as SourcePacketV1;
}

function quizBlueprint(): ChapterBlueprintV1 {
  return {
    chapterNumber: CH,
    chapterId: CHID,
    sections: { quiz: [{ questionId: "q01", correctIndex: 0, depthLevel: "standard" }], cards: [] },
  } as unknown as ChapterBlueprintV1;
}

test("F14 (integration): SEC56 passes a quiz citing an anchor with ONE verbatim specific", () => {
  const anchor: SourceAnchorForPrompt = {
    id: "a1", kind: "named_example", label: "Magic Castle", text: "…",
    hardSpecifics: ["Magic Castle Hotel", "free popsicles"],
    supportsClaimTypes: ["quiz_prompt", "quiz_explanation", "quiz_key_evidence"],
  };
  const learning = {
    schemaVersion: "section-artifact-v1", artifactType: "learning-pack", chapterId: CHID,
    quiz: { passingScorePercent: 70, questions: [{
      questionId: "q01",
      sourceAnchorIds: ["a1"], keyEvidenceAnchorIds: ["a1"],
      prompt: "You run the Magic Castle Hotel and want a stronger checkout moment for guests.",
      choices: ["Redesign the Magic Castle Hotel checkout ending", "Wait for a survey", "Do nothing"],
      correctIndex: 0,
      explanation: "The Magic Castle Hotel wins by lifting the ending, not the average.",
      bloomsLevel: "apply", depthLevel: "standard",
    }] },
    cards: { cards: [] },
  } as unknown as LearningPackV1;
  const sec56 = validateLearningPack(learning, quizBlueprint(), packetWithAnchor(anchor)).filter((f: SectionFinding) => f.checkId === "SEC56.quiz_anchor_specifics");
  assert.deepEqual(sec56, [], `one verbatim specific should clear SEC56; got ${JSON.stringify(sec56.map((f) => f.message))}`);
});

test("F14/1B (integration): SEC33 takes ONE specific, pooled across the example's three fields", () => {
  const anchor: SourceAnchorForPrompt = {
    id: "a1", kind: "named_example", label: "Magic Castle", text: "…",
    hardSpecifics: ["Magic Castle Hotel", "free popsicles"],
    supportsClaimTypes: ["example"],
  };
  const example = {
    schemaVersion: "section-artifact-v1", artifactType: "example-pack", chapterId: CHID,
    examples: [{
      exampleId: "ex01", title: "A better ending",
      scenario: "A manager decides to redesign the Magic Castle Hotel checkout after weighing two options.",
      whatToDo: "Lift the final moment.", whyItMatters: "Endings dominate memory.",
      sourceAnchorIds: ["a1"], sourceFactIds: [], namedCaseIds: [],
    }],
  } as unknown as ExamplePackV1;
  const bp = {
    chapterNumber: CH, chapterId: CHID,
    coreMove: { statement: "Lift the ending.", sourceFactIds: [] },
    reservedVariety: { allowedNames: [], forbiddenNames: [] },
    sections: { examples: [{ slotId: "s1", allowedNames: [], requiredFactIds: [], requiredCaseIds: [], forbiddenVenues: [] }] },
    constraints: { allowedFactIds: [], allowedCaseIds: [], forbiddenClaims: [], forbiddenLeakage: [], bannedHouseTics: [] },
  } as unknown as ChapterBlueprintV1;
  // Package 1B: the quota dropped from two to one. Two was a scenario obligation on a
  // historical source — the scene had to carry two of the case's proper nouns while the
  // book's own rules forbade the source figure appearing in it — and the writer's only
  // legal move was the recall beat SEC133 now refuses.
  const sec33 = validateExamplePack(example, bp, packetWithAnchor(anchor)).filter((f: SectionFinding) => f.checkId === "SEC33.example_anchor_specifics");
  assert.deepEqual(sec33, [], `one pooled specific clears SEC33; got ${JSON.stringify(sec33.map((f) => f.message))}`);

  // Zero specifics anywhere across scenario/whatToDo/whyItMatters still blocks.
  const bare = JSON.parse(JSON.stringify(example)) as ExamplePackV1;
  bare.examples[0].scenario = "A manager decides to redesign the hotel checkout after weighing two options.";
  const none = validateExamplePack(bare, bp, packetWithAnchor(anchor)).filter((f: SectionFinding) => f.checkId === "SEC33.example_anchor_specifics");
  assert.equal(none.length, 1, "an example that cites a case and uses none of its details still fails SEC33");
  assert.match(none[0].message, /0\/1/, "SEC33 message reports the one-specific floor");
});

test("F14/1B (integration): SEC58 is retired — a card cites its case by natural reference", () => {
  const anchor: SourceAnchorForPrompt = {
    id: "a1", kind: "named_example", label: "Magic Castle", text: "…",
    hardSpecifics: ["Magic Castle Hotel", "free popsicles"],
    supportsClaimTypes: ["review_card"],
  };
  const mkLearning = (front: string, back: string) => ({
    schemaVersion: "section-artifact-v1", artifactType: "learning-pack", chapterId: CHID,
    quiz: { passingScorePercent: 70, questions: [] },
    cards: { cards: [{ cardId: "c01", sourceAnchorIds: ["a1"], front, back }] },
  } as unknown as LearningPackV1);
  const sec58 = (lp: LearningPackV1) =>
    validateLearningPack(lp, quizBlueprint(), packetWithAnchor(anchor)).filter((f: SectionFinding) => f.checkId === "SEC58.card_anchor_specifics");
  // Package 1B: the per-card verbatim demand is gone. A card back that had to carry a
  // proper noun to satisfy a quota is how 15 of the 28 backs on the live Franklin book
  // came to open on an announcement scaffold. What replaced it: SEC120 refuses a card
  // that names anything the chapter's standalone prose never showed, and SEC14/SEC128
  // require that prose to teach the case in the first place.
  const one = sec58(mkLearning(
    "What does the Magic Castle Hotel case say about where to spend an experience budget?",
    "Spend on one engineered peak; the hotel wins on a single staged moment, not the room average.",
  ));
  assert.deepEqual(one, [], `a card naming the case must pass; got ${JSON.stringify(one.map((f) => f.message))}`);
  const zero = sec58(mkLearning(
    "Where should an experience budget go, according to this chapter?",
    "Spend on one engineered peak, not the average.",
  ));
  assert.deepEqual(zero, [], "a card that names no source token is no longer a SEC58 failure");

  // The replacement still binds: the same card, measured against a chapter whose prose
  // shows one of the case's details but never the hotel's name, is refused by SEC120.
  // (The prose has to show SOMETHING of the case — SEC120 stands down entirely when a
  // cited anchor has no specific on the page, because that is the upstream defect
  // SEC14/SEC128 own, not a card the writer could have written differently.)
  const prose = {
    hook: "A hotel hands out free popsicles by the pool and wins on that one staged moment.",
    breakdown: {
      fastRead: "Spend the budget on one engineered peak rather than on raising the average.",
      deepRead: "The free popsicles are what a guest remembers, so put the money where the memory forms.",
      fullRead: "Averages are cheap to raise and cheap to forget.",
    },
    keyTakeaway: "Engineer the peak; the average takes care of itself.",
  };
  const derivable = validateLearningPack(
    mkLearning(
      "What does the Magic Castle Hotel case say about where to spend an experience budget?",
      "Spend on one engineered peak; the hotel wins on a single staged moment, not the room average.",
    ),
    quizBlueprint(),
    packetWithAnchor(anchor),
    prose as never,
  ).filter((f: SectionFinding) => f.checkId === "SEC120.learning_prose_derivable");
  assert.equal(derivable.length, 1, "naming a case the chapter's prose never shows is still refused");
  assert.match(derivable[0].message, /Magic Castle Hotel/);
});
