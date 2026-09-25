/**
 * Q06 PR 2 (owner decision D16 = B): examples no longer carry a source-case token, so
 * the tie-back closer can go.
 *
 * Churn read HIGH in 4 of 4 rubric draws on the Franklin candidate rr21, and every
 * reader named the same example shell: a modern stand-in resolves a dilemma, then a
 * closing paragraph maps it back to a named Franklin anecdote (107 of 114 whyItMatters
 * name Franklin or a source entity; 88 of 114 carry the required case token only
 * there). SEC33 demanded one verbatim source specific per example, SEC34 keeps source
 * figures out of scenes and SEC133 bans the recall beat, so the closing paragraph was
 * the only practical place for the token.
 *
 * This file pins the change:
 *   - SEC33's per-example minimum is 0, and its ship mirror SC11.2 is 0 for examples
 *     (implementation_guidance stays at 1);
 *   - the example-pack contract says examples cite their anchor for provenance only
 *     and never name or retell the source case;
 *   - SEC137 blocks a whyItMatters that names a source figure or source entity of the
 *     packet, and stays silent on ordinary capitalized words and the dealt cast.
 * Chapter-level grounding (SEC14/SEC128/SEC136, SEC32 anchors, SEC39 overlap) is
 * unchanged.
 */

import assert from "node:assert/strict";

import { buildRepairWritingContract } from "../../src/app/candidateRepairWritingContract.js";
import type { ChapterBlueprintV1, ExamplePackV1, SourcePacketV1 } from "../../src/artifacts/artifactTypes.js";
import { checkChapterProvenance } from "../../src/critics/sourceGrounding.js";
import { validateExamplePack, type SectionFinding } from "../../src/sections/sectionGate.js";
import { sectionContract } from "../../src/sections/sectionTasks.js";
import type { ChapterV21 } from "../../src/types.js";
import { finishV25Tests, requiredTest } from "./harness.js";

const EM_DASH = "—";
const CHID = "zz-q06b-ch01";

// ── fixtures: a Franklin-shaped packet, verbatim labels and entity noise from rr21 ch01 ──

const BROWNELL_ANCHOR = {
  id: "ch01.case.brownell",
  kind: "named_example",
  label: "George Brownell / a Boston school for writing and arithmetic",
  text: "Franklin attends George Brownell's school, acquires fair writing quickly, and failed in the arithmetic.",
  hardSpecifics: ["George Brownell", "fair writing", "failed in the arithmetic"],
  supportsClaimTypes: ["example", "breakdown_claim", "quiz_prompt", "implementation_guidance"],
};

function franklinPacket(): SourcePacketV1 {
  return {
    chapterTitle: "Family History and Boyhood",
    allowedAnchors: [BROWNELL_ANCHOR],
    namedCases: [
      {
        id: "ch01.case.brownell",
        label: "George Brownell / a Boston school for writing and arithmetic",
        summary: "Franklin is sent to the school of Mr. George Brownell, where he acquires fair writing quickly but failed in the arithmetic.",
        hardSpecifics: ["George Brownell", "fair writing", "failed in the arithmetic"],
      },
      {
        id: "ch01.case.josiah",
        label: "Josiah Franklin / informal adviser and arbitrator without public office",
        summary: "His father Josiah Franklin was frequently chosen an arbitrator between contending parties by leading people.",
        hardSpecifics: ["frequently chosen an arbitrator", "leading people", "sound understanding and solid judgment"],
      },
    ],
    facts: [
      {
        id: "ch01.fact.1",
        claim: "At Brownell's school Franklin picked up fair writing quickly but made no progress in arithmetic.",
        mechanism: "A skill that looks orderly on the page can hide one that was never learned, so each skill has to be checked on its own.",
        commonError: "Assuming a neat hand means sound sums.",
        whyWrong: "Neatness is evidence of one skill only; the sums still need a separate check after birth of the habit.",
        groundedEntities: ["Franklin", "Brownell's", "Boston. The", "English"],
      },
    ],
    // Verbatim noise from the rr21 ch01 packet: sentence openers, adjectives and titles
    // sit next to the real names, so the detector must filter this list, not trust it.
    allowedEntities: [
      "Family History", "Boyhood", "Boston", "Franklin", "England", "Benjamin Franklin's", "The Franklin",
      "Josiah Franklin", "Franklin's", "Protestant", "English Bible", "Financial", "After", "Though",
      "Neighbors", "Leading", "Opens", "Dear", "Backs", "States", "Digresses", "Assuming", "Treating",
      "Three", "Birth", "His", "Fastening", "Uncle Benjamin", "Mr. George Brownell", "Brownell", "Bishop",
      "Speaker", "Governor", "Captain", "Englishman", "Queen Mary", "George Brownell / a Boston school for writing and arithmetic",
    ],
    allowedPlaces: [],
    allowedNumbers: [],
  } as unknown as SourcePacketV1;
}

function blueprint(): ChapterBlueprintV1 {
  return {
    chapterNumber: 1,
    chapterId: CHID,
    sections: {
      quiz: [],
      cards: [],
      examples: [{ slotId: "ex01", allowedNames: ["Brielle"] }],
    },
    reservedVariety: { allowedNames: ["Brielle"] },
    constraints: { allowedFactIds: ["ch01.fact.1"], allowedCaseIds: ["ch01.case.brownell", "ch01.case.josiah"], forbiddenClaims: [], forbiddenLeakage: [], bannedHouseTics: [] },
  } as unknown as ChapterBlueprintV1;
}

const SCENARIO = "Brielle runs the loading yard's tally on Friday afternoon. Her columns look clean and her handwriting is neat, but the truck is waiting and the driver wants a signature now. She stops, recounts the pallets against the sheet, finds two bundles missing, and holds the signature until the count and the page agree.";
const WHAT_TO_DO = "Recount the load against the sheet before you sign, even when the page already looks finished.";

function pack(whyItMatters: string): ExamplePackV1 {
  return {
    schemaVersion: "section-artifact-v1",
    artifactType: "example-pack",
    chapterId: CHID,
    examples: [{
      exampleId: "ex01",
      slotId: "ex01",
      title: "The Tally Before the Truck",
      scenario: SCENARIO,
      whatToDo: WHAT_TO_DO,
      whyItMatters,
      sourceAnchorIds: [BROWNELL_ANCHOR.id],
      sourceFactIds: [],
      namedCaseIds: [],
    }],
  } as unknown as ExamplePackV1;
}

function byCheck(findings: SectionFinding[], prefix: string): SectionFinding[] {
  return findings.filter((f) => f.checkId.startsWith(prefix));
}

const NAME_FREE_WHY = "A neat page proves the handwriting, not the sums, so the recount is the only check that catches a missing bundle before it leaves the yard.";

// ── SEC33 / SC11.2: the per-example token is gone ────────────────────────────────

requiredTest("Q06b: an example that carries 0 of its cited case's hardSpecifics passes SEC33 (D16: minimum 0)", () => {
  const findings = validateExamplePack(pack(NAME_FREE_WHY), blueprint(), franklinPacket());
  const sec33 = byCheck(findings, "SEC33.");
  assert.deepEqual(sec33.map((f) => `${f.severity}: ${f.message}`), [], "SEC33 must raise nothing for an example with no case specific");
  // The anchor citation itself is still checked: SEC32 (claim type) stays.
  assert.deepEqual(byCheck(findings, "SEC32."), []);
});

function shipSidecar(): any {
  return {
    schemaVersion: "source-v2",
    chapterNumber: 1,
    chapterTitle: "Family History and Boyhood",
    centralConcept: { id: "ch01.concept.check", name: "Separate checks", plainDefinition: "Each skill is checked on its own." },
    keyClaims: ["Each skill is checked on its own."],
    namedExamples: [
      {
        id: "ch01.ex.brownell",
        label: "George Brownell",
        summary: "Franklin acquires fair writing quickly at George Brownell's school but failed in the arithmetic.",
        teachesWhat: "Check each skill separately.",
        hardSpecifics: ["George Brownell", "fair writing", "failed in the arithmetic"],
        realWorld: true,
      },
    ],
    hardEdge: "A neat page is not a correct sum.",
    testableFacts: [],
  };
}

function shipChapter(example: { title: string; scenario: string; whatToDo: string; whyItMatters: string }, anchorId: string, plan?: string): ChapterV21 {
  return {
    chapterId: CHID,
    number: 1,
    title: "Family History and Boyhood",
    hook: "",
    breakdown: { fastRead: "", deepRead: "", fullRead: "" },
    keyTakeaway: "",
    examples: [{ ...example, sourceAnchorIds: [anchorId] }],
    quiz: { questions: [] },
    reviewCards: [],
    ...(plan ? { implementationPlan: { title: "", coreSkill: plan, ifThenPlans: [], twentyFourHourChallenge: "", weeklyPractice: "" } } : {}),
    authoring: { sourceAnchors: { effectiveAnchors: plan ? { "implementationPlan.coreSkill": [anchorId] } : {} } },
  } as unknown as ChapterV21;
}

requiredTest("Q06b: SC11.2 at ship time asks an example for 0 case specifics, and still asks implementation_guidance for 1", () => {
  const example = { title: "The Tally Before the Truck", scenario: SCENARIO, whatToDo: WHAT_TO_DO, whyItMatters: NAME_FREE_WHY };
  const exampleHits = checkChapterProvenance(shipChapter(example, "ch01.ex.brownell"), shipSidecar())
    .filter((f) => String(f.checkId) === "SC11.2.anchor_specific_not_present" && String(f.message).includes("example[0]"));
  assert.deepEqual(exampleHits.map((f) => f.message), [], "an example with no case specific must not raise SC11.2 at ship");

  // The implementation_guidance floor is unchanged (SEC74 stays at 1).
  const planHits = checkChapterProvenance(
    shipChapter(example, "ch01.ex.brownell", "Recount each column on its own before you sign the sheet."),
    shipSidecar(),
  ).filter((f) => String(f.checkId) === "SC11.2.anchor_specific_not_present" && String(f.message).includes("implementationPlan.coreSkill"));
  assert.equal(planHits.length, 1, "implementation_guidance keeps its one-specific floor at ship");
  assert.match(planHits[0].message, /<1 of its hardSpecifics/);
});

// ── SEC137: a whyItMatters that names the source is refused ──────────────────────

requiredTest("Q06b: SEC137 blocks a whyItMatters that names Franklin, and names the offending token", () => {
  const findings = byCheck(validateExamplePack(
    pack("A neat page proves the handwriting, not the sums. Franklin learned that at school, where fair writing came fast and the arithmetic never did."),
    blueprint(),
    franklinPacket(),
  ), "SEC137.");
  assert.equal(findings.length, 1, `expected one SEC137 finding; got ${JSON.stringify(findings)}`);
  assert.equal(findings[0].checkId, "SEC137.example_why_source_name");
  assert.equal(findings[0].severity, "blocker");
  assert.equal(findings[0].path, "/examples/0/whyItMatters");
  assert.match(findings[0].message, /"Franklin"/);
  assert.match(findings[0].message, /scene's own terms/);
  assert.ok(!findings[0].message.includes(EM_DASH), "a new message must not spend the em dash");
});

requiredTest("Q06b: SEC137 fires on the case figures' names, possessives included", () => {
  for (const [why, token] of [
    ["At Brownell's school the handwriting came fast and the sums never did, which is why a neat page proves nothing about the count.", "Brownell"],
    ["Josiah settled disputes because anyone could check his ruling, and a recount is the same kind of checkable ruling.", "Josiah"],
    ["A Boston schoolroom taught the same lesson: a neat page proves the handwriting, not the sums.", "Boston"],
  ] as const) {
    const findings = byCheck(validateExamplePack(pack(why), blueprint(), franklinPacket()), "SEC137.");
    assert.equal(findings.length, 1, `${token}: expected one SEC137 finding; got ${JSON.stringify(findings)}`);
    assert.match(findings[0].message, new RegExp(`"${token}"`), `${token}: the message must name the token`);
  }
});

requiredTest("Q06b: SEC137 is silent on a name-free whyItMatters, ordinary capitalized words and the packet's entity noise", () => {
  const whys = [
    NAME_FREE_WHY,
    // Sentence-initial words that sit in the packet's noisy allowedEntities list.
    "Leading with the recount keeps the promise honest. Though the page looks finished, only a second count proves it.",
    "Neighbors trust a count they can check. After the recount, the signature means something.",
    "Assuming the sums are right because the page is neat is the error. Treating each column as its own check fixes it.",
    "Financial records fail quietly. Birth order, rank or a tidy hand never proves a sum; a recount does.",
    // Titles, months, weekdays and nationalities are not names.
    "May is the busiest month in the yard. On Friday the English crew and the Speaker of the union both sign; each still recounts.",
  ];
  for (const why of whys) {
    const findings = byCheck(validateExamplePack(pack(why), blueprint(), franklinPacket()), "SEC137.");
    assert.deepEqual(findings.map((f) => f.message), [], `false positive on: ${why}`);
  }
});

// Round-2 regression: real rr21 case labels carry a title-cased right side (ch16, ch17),
// and ch09's prose capitalizes the virtue names mid-sentence ("Temperance, Silence,
// Order"). Those words are ordinary English at the start of a whyItMatters sentence,
// so they must not count as source names there; the figures still must.
function titleCasedPacket(): SourcePacketV1 {
  const base = franklinPacket() as unknown as Record<string, any>;
  return {
    ...base,
    namedCases: [
      ...base.namedCases,
      {
        id: "ch17.case.farmers",
        label: "Eleven Frontier Farmers / Killed After Guns Failed in the Rain",
        summary: "Eleven farmers on the frontier were killed after their guns failed to fire in wet weather, which Franklin used to argue for dry storage.",
        hardSpecifics: ["eleven farmers", "their guns would not go off"],
      },
      {
        id: "ch16.case.bond",
        label: "The Two Doctors Bond / Premature Victory Fireworks Subscription",
        summary: "Before news of the defeat arrived, two men named Bond brought Franklin a subscription paper for a celebratory firework, and Franklin declined.",
        hardSpecifics: ["the two Doctors Bond", "a grand firework"],
      },
      {
        id: "ch09.case.virtues",
        label: "Benjamin Franklin / thirteen-virtue tracking book",
        summary: "Franklin listed Temperance, Silence, Order, Resolution, Frugality and Industry, and credited Industry and Frugality with his early easiness.",
        hardSpecifics: ["seven columns", "red ink"],
      },
    ],
    allowedEntities: [...base.allowedEntities, "Silence", "Club-Tested Civic Reform", "Premature Victory Fireworks Subscription", "Temperance", "Industry"],
  } as unknown as SourcePacketV1;
}

requiredTest("Q06b round 2: SEC137 is silent on sentence-initial ordinary words from title-cased labels, entities and virtue names", () => {
  const whys = [
    "Failed checks tell you more than clean ones. Premature commitment locks the count in before anyone has looked.",
    "Premature sign-off is the risk here. Failed recounts are the cheap ones.",
    "Silence gives the driver room to notice the gap. Tested habits hold when the truck is waiting.",
    "Tested habits hold under pressure. Silence while counting keeps the tally clean.",
    "Industry without a recount only moves the error faster. Resolution comes from the second count, not the first.",
  ];
  for (const why of whys) {
    const findings = byCheck(validateExamplePack(pack(why), blueprint(), titleCasedPacket()), "SEC137.");
    assert.deepEqual(findings.map((f) => f.message), [], `false positive on: ${why}`);
  }
});

requiredTest("Q06b round 2: SEC137 still fires once on Franklin, Bond and Brownell's, at a sentence start or mid-sentence", () => {
  for (const [why, token] of [
    ["Franklin checked the same way. A neat page proves the handwriting, not the sums.", "Franklin"],
    ["A neat page proves the handwriting, not the sums, as Franklin found.", "Franklin"],
    ["The recount refuses a celebration before the facts, the way Bond's subscription should have waited.", "Bond"],
    ["Bond wanted the fireworks early. The recount waits for the facts.", "Bond"],
    ["Brownell's school taught the same lesson: a neat page proves the handwriting, not the sums.", "Brownell"],
  ] as const) {
    const findings = byCheck(validateExamplePack(pack(why), blueprint(), titleCasedPacket()), "SEC137.");
    assert.equal(findings.length, 1, `${token}: expected one SEC137 finding on "${why}"; got ${JSON.stringify(findings)}`);
    assert.match(findings[0].message, new RegExp(`"${token}"`), `${token}: the message must name the token`);
  }
});

requiredTest("Q06b: SEC137 does not flag the example's own dealt name", () => {
  const findings = byCheck(validateExamplePack(
    pack("Brielle's recount catches the missing bundles because a neat page proves the handwriting, not the sums."),
    blueprint(),
    franklinPacket(),
  ), "SEC137.");
  assert.deepEqual(findings.map((f) => f.message), []);

  // A dealt name that is ALSO a packet name belongs to the invented cast in this slot.
  const bp = blueprint();
  (bp.sections.examples[0] as { allowedNames: string[] }).allowedNames = ["Josiah"];
  (bp.reservedVariety as { allowedNames: string[] }).allowedNames = ["Josiah"];
  const dealt = byCheck(validateExamplePack(
    pack("Josiah's recount catches the missing bundles because a neat page proves the handwriting, not the sums."),
    bp,
    franklinPacket(),
  ), "SEC137.");
  assert.deepEqual(dealt.map((f) => f.message), [], "a dealt invented name is never a source name in its own slot");
});

// ── the contract ───────────────────────────────────────────────────────────────

const GATE_LINE = "Each example cites a namedExample/example anchor for provenance only. Never name or retell the source case, and never name a source figure, in the scenario, whatToDo or whyItMatters: the chapter's prose teaches the case, and the example shows the principle working in its own moment. Never have your character read, remember or recall the source case (SEC133). A whyItMatters that names a source figure or case is refused (SEC137); the validator enforces this.";
const WHY_LINE = "whyItMatters explains, in the scene's own terms, why the move works or where it stops working, using the cited fact's MECHANISM and what the moment shows (the choice, in a decision slot). Never name the source case or a source figure and never retell its anecdote: the chapter's prose teaches the case (SEC39 checks the mechanism).";
const REMOVED = ["uses at least ONE of its hardSpecifics", "in at most one short clause", "Name the source case"];

requiredTest("Q06b: the example-pack contract says provenance only and never name the source case", () => {
  const contract = sectionContract("example-pack");
  for (const line of [GATE_LINE, WHY_LINE]) {
    assert.ok(contract.includes(line), `missing the Q06b line: ${line}`);
    assert.ok(!line.includes(EM_DASH), `a new line must not spend the em dash: ${line}`);
  }
  for (const gone of REMOVED) assert.ok(!contract.includes(gone), `the removed rule is still in the contract: ${gone}`);
});

requiredTest("Q06b: the repair writer and the chapter editor receive the same example rule", () => {
  for (const lane of ["repair", "editor"] as const) {
    const contract = buildRepairWritingContract({ voiceCard: null, lane });
    for (const line of [GATE_LINE, WHY_LINE]) assert.ok(contract.includes(line), `${lane} lane: missing ${line}`);
    for (const gone of REMOVED) assert.ok(!contract.includes(gone), `${lane} lane: removed rule still rendered: ${gone}`);
  }
});

finishV25Tests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
