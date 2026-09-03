/**
 * GROUNDING REDESIGN (package 1B, register R-059/R-061/R-063 + the SEC56/SEC58
 * demotion the rotation cap pays for).
 *
 * The rule that changed: grounding used to be a PER-UNIT verbatim-token quota —
 * every specifics-rich anchor a unit cited had to contribute two (tiers, hook,
 * takeaway, examples) or one (quiz, cards) of its hardSpecifics verbatim to THAT
 * unit. Measured on the live Franklin rev-6 candidate
 * (candidates/repair-r7-candidate-88b631ed39a56eb62937d07df3bd0f72), every one of
 * the four chapters' top case specifics appears in 100% of the units citing its
 * case: "three puffy rolls" in 9/9 ch01 units, "Silence Dogood" 8/8,
 * "Heads of Complaint" 9/9, "Lord Loudoun" 10/10. That is the mechanical source of
 * the seams and the repetition, and it never caught a wrong fact.
 *
 * The replacement is CHAPTER-LEVEL presence plus derivability:
 *   - SEC14 — each case the chapter's own reader-visible prose cites must show >=2
 *     of its hardSpecifics somewhere across hook + counterintuition + the three
 *     tiers + keyTakeaway. Once per chapter, not once per unit.
 *   - SEC128 — a case that ONLY the quiz/cards/examples/action cite must be taught
 *     by the same prose to the same bar: a chapter may not test what it never says.
 *   - SEC129 — no single specific may carry more than half the units citing its
 *     case (advisory above 30%).
 *   - SEC56/SEC58 stop demanding a verbatim token per unit; SEC120 derivability
 *     (unchanged, still a blocker) keeps a unit from naming what the page never says.
 *   - SEC33 keeps a floor of ONE specific pooled across scenario+whatToDo+whyItMatters,
 *     and SEC133 refuses the recall beat the two-specific quota produced.
 *
 * Fixtures below are the live rev-6 bytes wherever the defect is quoted.
 */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import {
  packGroundingFindings,
  validateExamplePack,
  validateLearningPack,
  validateSummaryPack,
  type SectionFinding,
} from "../src/sections/sectionGate.js";
import type {
  ChapterBlueprintV1,
  ExamplePackV1,
  LearningPackV1,
  SectionKind,
  SectionPackV1,
  SourcePacketV1,
  SummaryPackV1,
} from "../src/artifacts/artifactTypes.js";
import type { SourceAnchorForPrompt } from "../src/types.js";

const CHID = "zz-grounding-ch01";
const CH = 1;

function byCheck(findings: SectionFinding[], id: string): SectionFinding[] {
  return findings.filter((f) => f.checkId === id);
}

/** The live ch01 arrival case, verbatim from the rev-6 source packet. */
const ARRIVAL: SourceAnchorForPrompt = {
  id: "ch01.case.arrival-philadelphia",
  kind: "named_example",
  label: "Arrival in Philadelphia",
  text: "A runaway apprentice reaches Philadelphia with one Dutch dollar and buys three puffy rolls on Market Street.",
  hardSpecifics: ["three puffy rolls", "one Dutch dollar", "Market Street"],
  supportsClaimTypes: ["example", "hook", "breakdown_claim", "quiz_prompt", "quiz_explanation", "quiz_key_evidence", "review_card", "implementation_guidance", "takeaway", "memorable_line"],
};

/** The live ch01 Silence Dogood case, verbatim from the rev-6 source packet. */
const DOGOOD: SourceAnchorForPrompt = {
  id: "ch01.case.silence-dogood",
  kind: "named_example",
  label: "Silence Dogood essays",
  text: "Essays written under the name Silence Dogood are slipped under the shop door and printed by the New England Courant.",
  hardSpecifics: ["Silence Dogood", "New England Courant", "age sixteen"],
  supportsClaimTypes: ["example", "hook", "breakdown_claim", "quiz_prompt", "quiz_explanation", "quiz_key_evidence", "review_card", "implementation_guidance", "takeaway", "memorable_line"],
};

function packet(anchors: SourceAnchorForPrompt[], facts: unknown[] = []): SourcePacketV1 {
  return { allowedAnchors: anchors, facts, namedCases: [], allowedEntities: [], allowedPlaces: [], allowedNumbers: [] } as unknown as SourcePacketV1;
}

function blueprint(quizCount = 0, cardCount = 0, exampleCount = 0): ChapterBlueprintV1 {
  return {
    chapterNumber: CH,
    chapterId: CHID,
    sections: {
      quiz: Array.from({ length: quizCount }, (_, i) => ({ questionId: `q0${i + 1}`, correctIndex: 0, depthLevel: "standard" })),
      cards: Array.from({ length: cardCount }, (_, i) => ({ cardId: `rc0${i + 1}` })),
      examples: Array.from({ length: exampleCount }, (_, i) => ({ slotId: `ex0${i + 1}`, allowedNames: ["Brielle"] })),
    },
    reservedVariety: { allowedNames: ["Brielle"] },
    constraints: { allowedFactIds: [FACT.id], allowedCaseIds: [ARRIVAL.id, DOGOOD.id], forbiddenClaims: [], forbiddenLeakage: [], bannedHouseTics: [] },
  } as unknown as ChapterBlueprintV1;
}

const FILLER = "A reader who acts on the visible signal changes the outcome the ledger records later. ";
function pad(base: string, chars: number): string {
  let out = base;
  while (out.length < chars) out += FILLER;
  return out;
}

type TierText = { fast: string; deep: string; full: string; hook?: string; ids?: string[] };

function summaryPack(t: TierText): SummaryPackV1 {
  const ids = t.ids ?? [ARRIVAL.id];
  return {
    schemaVersion: "section-artifact-v1",
    artifactType: "summary-pack",
    chapterId: CHID,
    hook: { hook: t.hook ?? "A runaway apprentice walks into a strange city with almost nothing in his pocket.", sourceAnchorIds: ids },
    breakdown: {
      fastRead: pad(t.fast, 360),
      deepRead: pad(t.deep, 1010),
      fullRead: pad(t.full, 2410),
      sourceAnchorIds: { fastRead: ids, deepRead: ids, fullRead: ids },
    },
    keyTakeaway: "Spend the first coin on what keeps you working tomorrow, not on what looks safe today.",
    keyTakeawaySourceAnchorIds: ids,
  } as unknown as SummaryPackV1;
}

// ── SEC14 — chapter-level case grounding (R-059) ─────────────────────────────

test("SEC14 grounds a cited case ONCE across the chapter's prose, not once per tier", () => {
  // The rev-6 shape the per-unit rule forced: the two specifics live in ONE tier.
  // Under the old rule fastRead, fullRead, the hook and the keyTakeaway each owed
  // two verbatim tokens of the same case — four more copies of "three puffy rolls".
  const pack = summaryPack({
    fast: "He arrives with nothing anyone would call capital and spends it on food.",
    deep: "He lands on Market Street carrying one Dutch dollar and buys three puffy rolls with almost all of it.",
    full: "The first purchase is the whole story: the money buys work-fuel, not a cushion.",
  });
  const findings = byCheck(validateSummaryPack(pack, blueprint(), packet([ARRIVAL])), "SEC14.chapter_case_grounding");
  assert.deepEqual(findings, [], `two specifics anywhere in the chapter's prose is the whole requirement; got:\n${findings.map((f) => f.message).join("\n")}`);
});

test("SEC14 still blocks a chapter that cites a case its reader-visible prose never teaches", () => {
  const pack = summaryPack({
    fast: "He arrives with nothing anyone would call capital and spends it on food.",
    deep: "The first purchase buys work-fuel rather than a cushion, and the habit holds for years.",
    full: "Nothing here names the case the tiers claim to be built from.",
  });
  const findings = byCheck(validateSummaryPack(pack, blueprint(), packet([ARRIVAL])), "SEC14.chapter_case_grounding");
  assert.equal(findings.length, 1, "an ungrounded cited case must still block");
  assert.equal(findings[0].severity, "blocker");
  assert.match(findings[0].message, /ch01\.case\.arrival-philadelphia/);
  assert.match(findings[0].message, /0\/2/, "the message reports how many specifics reached the page");
});

test("SEC14 counts a specific written out naturally, exactly as SEC120 does", () => {
  // "one Dutch dollar" arrives as "one Dutch dollar and some copper"; "three puffy
  // rolls" as "three great puffy rolls" — the clipped-phrase fold both sides share.
  const pack = summaryPack({
    fast: "He arrives with one Dutch dollar and some copper in his pocket.",
    deep: "The baker hands him three great puffy rolls, which is what the coin buys that morning.",
    full: "The first purchase is the whole story: the money buys work-fuel, not a cushion.",
  });
  const findings = byCheck(validateSummaryPack(pack, blueprint(), packet([ARRIVAL])), "SEC14.chapter_case_grounding");
  assert.deepEqual(findings, [], `naturalized prose must count; got:\n${findings.map((f) => f.message).join("\n")}`);
});

// ── SEC128 — a case the chapter TESTS but never TEACHES ──────────────────────

function learningPack(opts: { quizIds?: string[]; cardIds?: string[]; stem?: string; explanation?: string; front?: string; back?: string }): LearningPackV1 {
  return {
    schemaVersion: "section-artifact-v1",
    artifactType: "learning-pack",
    chapterId: CHID,
    quiz: { passingScorePercent: 70, questions: [{
      questionId: "q01",
      sourceAnchorIds: opts.quizIds ?? [ARRIVAL.id],
      keyEvidenceAnchorIds: opts.quizIds ?? [ARRIVAL.id],
      prompt: opts.stem ?? "Suppose you land in a new city with one week of money and no contacts at all. What do you buy first?",
      choices: [
        "Whatever keeps you working tomorrow, because the first purchase decides the second week.",
        "The cheapest room available, because shelter always precedes any other spending decision.",
        "A week of meals in advance, because food security removes the pressure to decide.",
      ],
      correctIndex: 0,
      explanation: opts.explanation ?? "The first purchase buys work-fuel rather than a cushion, which is what keeps the next week open.",
      bloomsLevel: "apply",
      depthLevel: "standard",
    }] },
    cards: { cards: [{
      cardId: "rc01",
      sourceAnchorIds: opts.cardIds ?? [ARRIVAL.id],
      front: opts.front ?? "What does the first purchase in a new city decide?",
      back: opts.back ?? "It decides the second week: money spent on work-fuel keeps the next decision open, money spent on comfort closes it.",
      difficulty: "easy",
    }] },
  } as unknown as LearningPackV1;
}

/** SEC128/SEC129 are measured PER PACK against the chapter's own drafted prose —
 *  see packGroundingFindings for why the chapter-wide shape could not ship (a
 *  per-chapter blocker reaching assembly has no eviction path and wedges the compile
 *  loop permanently). */
function groundingArgs(summary: SummaryPackV1, section: SectionKind, pack: SectionPackV1, anchors: SourceAnchorForPrompt[]) {
  return { chapterNumber: CH, section, packet: packet(anchors), pack, prose: summary };
}

test("SEC128 blocks a case the quiz cites when the chapter's prose never taught it", () => {
  const summary = summaryPack({
    fast: "He arrives with one Dutch dollar and spends it on three puffy rolls.",
    deep: "Market Street is where the coin goes, and the purchase decides the next week.",
    full: "The first purchase is the whole story: the money buys work-fuel, not a cushion.",
  });
  const findings = byCheck(
    packGroundingFindings(groundingArgs(summary, "learning-pack", learningPack({ quizIds: [DOGOOD.id], cardIds: [DOGOOD.id] }) as SectionPackV1, [ARRIVAL, DOGOOD])),
    "SEC128.chapter_case_untaught",
  );
  assert.ok(findings.length >= 1, "a case the quiz cites must still be taught by the prose");
  assert.ok(findings.every((f) => f.severity === "blocker"));
  assert.ok(findings.every((f) => f.section === "learning-pack"), "attributed to the pack that cites it, so the retry lands there");
  assert.match(findings[0].message, /ch01\.case\.silence-dogood/);
});

test("SEC128 never fires on the summary pack itself — SEC14 owns those citations", () => {
  const summary = summaryPack({
    fast: "He arrives with nothing anyone would call capital.",
    deep: "The purchase decides the next week and the habit holds for years.",
    full: "Nothing here names the case the tiers claim to be built from.",
  });
  const findings = byCheck(
    packGroundingFindings(groundingArgs(summary, "summary-pack", summary as unknown as SectionPackV1, [ARRIVAL])),
    "SEC128.chapter_case_untaught",
  );
  assert.deepEqual(findings, [], "the summary pack's own ungrounded citation is SEC14's finding, not a second one");
  const sec14 = byCheck(validateSummaryPack(summary, blueprint(), packet([ARRIVAL])), "SEC14.chapter_case_grounding");
  assert.equal(sec14.length, 1, "and SEC14 does report it");
});

// ── SEC129 — the rotation cap the demotion pays for ──────────────────────────

test("SEC129 blocks a specific that carries every unit citing its case (the rev-6 shape)", () => {
  // ch01's "three puffy rolls" appears in 9 of the 9 rev-6 units citing the arrival
  // case. Six units here, all carrying it.
  const summary = summaryPack({
    fast: "He buys three puffy rolls with one Dutch dollar on Market Street.",
    deep: "Three puffy rolls is what the coin buys, and the purchase decides the next week.",
    full: "Three puffy rolls: the money buys work-fuel, not a cushion, and that is the whole story.",
  });
  const learning = learningPack({
    stem: "Suppose you land in a new city and can buy three puffy rolls or save the coin. Which fits the evidence?",
    explanation: "Three puffy rolls bought the working morning; the coin saved would have bought nothing at all.",
    front: "What did three puffy rolls decide?",
    back: "Three puffy rolls decided the second week: money spent on work-fuel keeps the next decision open.",
  });
  const findings = [
    ...byCheck(packGroundingFindings(groundingArgs(summary, "summary-pack", summary as unknown as SectionPackV1, [ARRIVAL])), "SEC129.case_specific_rotation"),
    ...byCheck(packGroundingFindings(groundingArgs(summary, "learning-pack", learning as SectionPackV1, [ARRIVAL])), "SEC129.case_specific_rotation"),
  ];
  const blockers = findings.filter((f) => f.severity === "blocker" && /three puffy rolls/.test(f.message));
  assert.equal(blockers.length, 1, `a specific in every citing unit must block; got:\n${findings.map((f) => f.message).join("\n")}`);
  assert.match(blockers[0].message, /\d+\/\d+ of the units citing that case \(\d+%/, `the message reports the realized share; got: ${blockers[0].message}`);
  assert.match(blockers[0].message, /fastRead, deepRead, fullRead/, "and names the units that carry it");
});

test("SEC129 leaves a rotated chapter alone: no specific above half its case's units", () => {
  const summary = summaryPack({
    fast: "He buys three puffy rolls the morning he arrives.",
    deep: "One Dutch dollar is the whole stock of cash, and the purchase decides the next week.",
    full: "Market Street is where it happens; the money buys work-fuel, not a cushion.",
  });
  const learning = learningPack({
    stem: "Suppose you land in a new city with a week of money and no contacts. What do you buy first?",
    explanation: "The first purchase buys work-fuel rather than a cushion, which keeps the next week open.",
    front: "What does the first purchase in a new city decide?",
    back: "It decides the second week: money spent on work-fuel keeps the next decision open.",
  });
  const findings = [
    ...byCheck(packGroundingFindings(groundingArgs(summary, "summary-pack", summary as unknown as SectionPackV1, [ARRIVAL])), "SEC129.case_specific_rotation"),
    ...byCheck(packGroundingFindings(groundingArgs(summary, "learning-pack", learning as SectionPackV1, [ARRIVAL])), "SEC129.case_specific_rotation"),
  ];
  assert.deepEqual(findings.filter((f) => f.severity === "blocker"), [], `rotated prose must pass; got:\n${findings.map((f) => f.message).join("\n")}`);
});

// ── SEC56 / SEC58 — the per-unit verbatim demand is gone ─────────────────────

// Shows two of the arrival case's three specifics and NOT "Market Street", so the
// derivability check has a satisfiable page to measure against.
const PROSE_FOR_DERIVABILITY = summaryPack({
  fast: "He arrives with one Dutch dollar and buys three puffy rolls the same morning.",
  deep: "The purchase decides the next week: the coin buys work-fuel rather than a cushion.",
  full: "Nothing else in the pocket, and the habit of spending on capacity holds for years.",
});

test("SEC56/SEC58: a quiz stem and a card may cite a case by natural reference, with no verbatim token", () => {
  const findings = validateLearningPack(learningPack({}), blueprint(1, 1), packet([ARRIVAL]), PROSE_FOR_DERIVABILITY);
  assert.deepEqual(byCheck(findings, "SEC56.quiz_anchor_specifics"), [], "the quiz quota is retired");
  assert.deepEqual(byCheck(findings, "SEC58.card_anchor_specifics"), [], "the card quota is retired");
});

test("SEC120 still blocks a card that names what the chapter's prose never says", () => {
  const findings = validateLearningPack(
    learningPack({ front: "Where did the first purchase happen?", back: "It happened on Market Street, and the money bought work-fuel rather than a cushion for the week ahead." }),
    blueprint(1, 1),
    packet([ARRIVAL]),
    PROSE_FOR_DERIVABILITY,
  );
  const derivable = byCheck(findings, "SEC120.learning_prose_derivable");
  assert.ok(derivable.length >= 1, "naming a case the prose never shows must still block");
  assert.equal(derivable[0].severity, "blocker");
});

// ── SEC33 / SEC133 — examples cite by natural reference, never by recall ─────

function examplePack(ex: { scenario: string; whatToDo: string; whyItMatters: string; ids?: string[]; factIds?: string[] }): ExamplePackV1 {
  return {
    schemaVersion: "section-artifact-v1",
    artifactType: "example-pack",
    chapterId: CHID,
    examples: [{
      exampleId: "ex01",
      slotId: "ex01",
      title: "The Ask Rewritten",
      scenario: ex.scenario,
      whatToDo: ex.whatToDo,
      whyItMatters: ex.whyItMatters,
      sourceAnchorIds: ex.ids ?? [ARRIVAL.id],
      sourceFactIds: ex.factIds ?? [],
      namedCaseIds: [],
    }],
  } as unknown as ExamplePackV1;
}

const SCENE_TAIL = " She wrote the names down, counted what each had promised, and set the opening date from the total rather than from the calendar. By the date she had first picked only eight neighbours had signed, so she moved the opening back two weeks and kept collecting instead of opening an empty shed.";

test("SEC33 accepts ONE specific pooled across scenario, whatToDo and whyItMatters", () => {
  const pack = examplePack({
    scenario: `Brielle had the flyer ready: one neighbour with money to spare covering the whole cost of a shared tool shed.${SCENE_TAIL}`,
    whatToDo: "Rewrite the ask as twelve small pledges instead of one large gift, and name the amount each one costs.",
    whyItMatters: "Three puffy rolls bought a working morning; small, repeated commitments buy the thing no single patron will fund.",
  });
  const findings = byCheck(validateExamplePack(pack, blueprint(0, 0, 1), packet([ARRIVAL])), "SEC33.example_anchor_specifics");
  assert.deepEqual(findings, [], `one pooled specific is the floor; got:\n${findings.map((f) => f.message).join("\n")}`);
});

test("SEC33 still blocks an example that cites a case and uses none of its details", () => {
  const pack = examplePack({
    scenario: `Brielle had the flyer ready: one neighbour with money to spare covering the whole cost of a shared tool shed.${SCENE_TAIL}`,
    whatToDo: "Rewrite the ask as twelve small pledges instead of one large gift, and name the amount each one costs.",
    whyItMatters: "Small, repeated commitments buy the thing no single patron will fund.",
  });
  const findings = byCheck(validateExamplePack(pack, blueprint(0, 0, 1), packet([ARRIVAL])), "SEC33.example_anchor_specifics");
  assert.equal(findings.length, 1, "zero specifics anywhere in the example must still block");
  assert.match(findings[0].message, /0\/1/);
});

test("SEC133 blocks the recall beat the two-specific quota produced (live rev-6 ch03 ex01)", () => {
  // Verbatim from the rev-6 candidate: the invented actor READS the source case,
  // because the quota demanded two of its proper-noun details inside the scene and
  // the book's scars forbid a character citing the source figure.
  const pack = examplePack({
    scenario: "Brielle had the flyer ready: one neighbor, a retired contractor with money to spare, covering the whole cost of a shared tool shed for the block. Then she read how the old Market Street arrival got its start, three puffy rolls bought with one Dutch dollar, no single wealthy backer footing the bill. She pulled the flyer and rewrote the ask as twelve small pledges instead of one large gift.",
    whatToDo: "Rewrite the ask as twelve small pledges instead of one large gift, and name the amount each one costs.",
    whyItMatters: "Small, repeated commitments buy the thing no single patron will fund.",
  });
  const findings = byCheck(validateExamplePack(pack, blueprint(0, 0, 1), packet([ARRIVAL])), "SEC133.example_source_recall_beat");
  assert.equal(findings.length, 1, "an actor who READS the source case is a recall beat, not a scene");
  assert.equal(findings[0].severity, "blocker");
  assert.match(findings[0].message, /read/i);
});

test("SEC133 leaves a scene that uses the same specifics without recalling the source", () => {
  const pack = examplePack({
    scenario: `Brielle counted three puffy rolls onto the table beside the flyer and priced the shed the same way, one small share at a time.${SCENE_TAIL}`,
    whatToDo: "Rewrite the ask as twelve small pledges instead of one large gift, and name the amount each one costs.",
    whyItMatters: "Small, repeated commitments buy the thing no single patron will fund.",
  });
  const findings = byCheck(validateExamplePack(pack, blueprint(0, 0, 1), packet([ARRIVAL])), "SEC133.example_source_recall_beat");
  assert.deepEqual(findings, [], `using a detail is not recalling the case; got:\n${findings.map((f) => f.message).join("\n")}`);
});

// ── SEC39 — fact alignment from mechanism and whyWrong only (R-063) ──────────

const FACT = {
  id: "ch01.fact.arrival-poverty",
  claim: "Franklin reached Philadelphia with almost no money and no contacts in the city.",
  mechanism: "Selling possessions to fund the passage leaves the arriving worker dependent on immediate wages rather than savings, so the first purchase must buy working capacity.",
  commonError: "Readers assume the arrival was a fresh start funded by family.",
  whyWrong: "No family money followed him; the wage from the first shop is what carried the week, so the purchase had to keep him working.",
  groundedEntities: ["Philadelphia", "Market Street", "Dutch dollar"],
  groundedNumbers: ["three", "one"],
};

function withFact(whyItMatters: string): SectionFinding[] {
  const pack = examplePack({
    scenario: `Brielle counted three puffy rolls onto the table beside the flyer and priced the shed one small share at a time.${SCENE_TAIL}`,
    whatToDo: "Rewrite the ask as twelve small pledges instead of one large gift, and name the amount each one costs.",
    whyItMatters,
    factIds: [FACT.id],
  });
  return byCheck(validateExamplePack(pack, blueprint(0, 0, 1), packet([ARRIVAL], [FACT])), "SEC39.example_why_fact_alignment");
}

test("SEC39 is no longer satisfied by repeating the case's proper nouns and numbers", () => {
  const findings = withFact("Philadelphia and Market Street are where one Dutch dollar and three puffy rolls changed hands, and that is the point.");
  assert.equal(findings.length, 1, "restating entities and numbers is not explaining the fact");
  assert.equal(findings[0].severity, "blocker");
});

test("SEC39 passes a whyItMatters that carries the fact's mechanism", () => {
  const findings = withFact("Because the passage was funded by selling possessions, the arriving worker depends on immediate wages, so the first purchase has to buy working capacity rather than comfort.");
  assert.deepEqual(findings, [], `mechanism terms are what the check is for; got:\n${findings.map((f) => f.message).join("\n")}`);
});

test("SEC39's bar does not rise with the researcher's word count", () => {
  // The old minimum was 3 overlapping terms once the fact carried >=12 terms, so a
  // verbose sidecar demanded more of the writer than a terse one for the same fact.
  const verbose = {
    ...FACT,
    mechanism: FACT.mechanism + " The wage arrives weekly, the rent arrives monthly, and the gap between them is what the first purchase either opens or closes for the newcomer.",
    whyWrong: FACT.whyWrong + " Nothing in the record shows a remittance, a loan, or a patron behind the arrival week.",
  };
  const pack = examplePack({
    scenario: `Brielle counted three puffy rolls onto the table beside the flyer and priced the shed one small share at a time.${SCENE_TAIL}`,
    whatToDo: "Rewrite the ask as twelve small pledges instead of one large gift, and name the amount each one costs.",
    whyItMatters: "The arriving worker depends on immediate wages, so the purchase has to buy working capacity.",
    factIds: [FACT.id],
  });
  const findings = byCheck(validateExamplePack(pack, blueprint(0, 0, 1), packet([ARRIVAL], [verbose])), "SEC39.example_why_fact_alignment");
  assert.deepEqual(findings, [], `a longer sidecar must not raise the bar; got:\n${findings.map((f) => f.message).join("\n")}`);
});
