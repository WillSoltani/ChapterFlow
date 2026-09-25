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

// ── round-3 fixtures: verbatim excerpts of the real rr21 packets (ch14, ch15, ch16) ──

// ch16: the named case is "The Two Doctors Bond", and the packet also writes "bond" in
// lower case ("Franklin's personal bond").
const CH16_BOND_CASE = {
  id: "ch16.case.fireworks-subscription",
  label: "The Two Doctors Bond / Premature Victory Fireworks Subscription",
  summary: "Before news of the defeat arrived, two men named Bond brought Franklin a subscription paper to fund a celebratory firework display for an assumed victory at Fort Duquesne. Franklin declined, arguing that the outcome of the campaign was still uncertain, and the subscription was abandoned before the bad news made it moot.",
  hardSpecifics: ["the two Doctors Bond", "a grand firework", "Fort Duquesne"],
  specificPropositions: [
    { specific: "the two Doctors Bond", proposition: "Two men both named Bond approached Franklin with a subscription paper to fund a fireworks celebration." },
    { specific: "a grand firework", proposition: "The subscription money was meant to pay for a large celebratory fireworks display." },
    { specific: "Fort Duquesne", proposition: "The planned celebration was tied to an assumed victory in capturing Fort Duquesne." },
  ],
};

const CH16_PERSONAL_BOND_FACT = {
  id: "ch16.fact.personal-bond",
  claim: "Waggon owners required Franklin's personal bond, not Braddock's word, before releasing their equipment.",
  mechanism: "The owners had no direct knowledge of Braddock or confidence in his promise, so they demanded a guarantor they knew locally.",
  commonError: "General Braddock's official promise alone was sufficient collateral for the farmers.",
  whyWrong: "The owners stated they did not know Braddock or trust his promise and insisted on Franklin's bond instead.",
  groundedEntities: ["Franklin's", "Braddock's", "Braddock"],
};

function ch16ShapePacket(): SourcePacketV1 {
  return {
    chapterTitle: "Braddock's Expedition",
    allowedAnchors: [BROWNELL_ANCHOR],
    namedCases: [CH16_BOND_CASE],
    facts: [CH16_PERSONAL_BOND_FACT],
    allowedEntities: [
      "Braddock's Expedition", "British", "Franklin", "Braddock's", "European", "Indian", "Hands-on", "Acting", "Franklin's",
      "Pennsylvania", "Colonel Dunbar's", "News", "England", "Pennsylvania's", "Benjamin Franklin", "Waggon Advertisement",
      "General Braddock", "April", "Braddock", "Defeat", "Fort Duquesne", "Indians", "French", "Rigid", "Sixty-three", "Seven",
      "Colonel Dunbar", "Panicked Retreat", "Broken Promise", "Trenton", "After Braddock's", "Dunbar", "Panic", "Dunbar's",
      "The Two Doctors Bond", "Premature Victory Fireworks Subscription", "Before", "Bond", "Fort Duquesne. Franklin",
      "Withholding", "Doctors Bond", "Two", "Britain", "Assembly", "Direct", "Military", "Waggon", "Confidence", "Soldiers",
      "Only", "The Pennsylvania Assembly", "Shirley", "They", "Colonial", "Assembly's", "Who", "Captain Orme",
      "The Two Doctors Bond / Premature Victory Fireworks Subscription",
    ],
    allowedPlaces: [],
    allowedNumbers: [],
  } as unknown as SourcePacketV1;
}

// ch15: the prose names Franklin only bare ("Morris asked Franklin whether..."), never as
// "Franklin's" or "Mr. Franklin"; "Franklin's" and "Governor Denny's" sit in allowedEntities.
function ch15ShapePacket(): SourcePacketV1 {
  return {
    chapterTitle: "Quarrels with the Proprietary Governors",
    allowedAnchors: [
      BROWNELL_ANCHOR,
      {
        id: "ch15.concept.loan-office-orders",
        kind: "concept",
        label: "Loan-Office order financing",
        text: "A way of raising money for a public expense by having the Assembly issue interest-bearing paper drawn on the provincial loan office, instead of relying on a tax bill the governor could veto. It let a legislature fund an urgent commitment even when the executive refused consent, because it never required an act the governor had to sign.",
        supportsClaimTypes: ["example", "core_move"],
      },
    ],
    namedCases: [
      {
        id: "ch15.case.morris-broken-promise",
        label: "Robert Hunter Morris / promised to avoid Assembly disputes, then didn't",
        summary: "Newly arrived to succeed Governor Hamilton, Morris asked Franklin whether he should expect an uncomfortable term; Franklin advised avoiding quarrels with the Assembly, and Morris promised to try despite admitting he loved disputing. By the time Franklin returned from a trip to Boston, the Assembly's own voting record already showed Morris locked in constant conflict with the House, a battle that lasted his entire administration.",
        hardSpecifics: ["Mr. Morris", "Mr. Hamilton", "New York"],
      },
      {
        id: "ch15.case.crown-point-loan-office-orders",
        label: "Massachusetts Bay's Crown Point appeal / Loan-Office orders funding Pennsylvania's ten-thousand-pound aid",
        summary: "Massachusetts Bay sent Mr. Quincy to Pennsylvania seeking help for an attack on Crown Point, and Franklin, as Quincy's fellow New Englander and a sitting Assembly member, dictated the address that won the Assembly's vote of ten thousand pounds. Governor Morris refused to sign the funding bill unless the proprietary estate was exempted from the tax paying for it, so Franklin proposed issuing Loan-Office orders instead, letting the Assembly raise the money on its own authority. The orders sold out within weeks as an attractive investment, and Quincy went home with the aid secured and a lasting friendship with Franklin.",
        hardSpecifics: ["Mr. Quincy", "Crown Point", "ten thousand pounds", "the Loan office"],
      },
    ],
    facts: [
      {
        id: "ch15.fact.morris-succeeds-hamilton",
        claim: "Robert Hunter Morris arrived from England to replace Hamilton as Pennsylvania's governor after Hamilton resigned worn out by disputes forced on him by his proprietary instructions.",
        mechanism: "Proprietary instructions bound any governor to demands the Assembly resisted, so occupying the office meant inheriting the same forced conflict regardless of personal temperament.",
        commonError: "Hamilton resigned because he personally disliked politics in general.",
        whyWrong: "The text ties his exhaustion specifically to disputes generated by his proprietary instructions, not to distaste for the job itself.",
        groundedEntities: ["Hunter Morris", "England", "Hamilton", "Pennsylvania's", "Assembly"],
      },
      {
        id: "ch15.fact.morris-admits-loving-disputes",
        claim: "Morris openly told Franklin he loved disputing and considered it one of his greatest pleasures, even while promising to try to avoid disputes with the Assembly.",
        mechanism: "His pleasure in argument came from being eloquent and a skilled sophister, which made him generally successful in argumentative conversation and thus reluctant to give it up.",
        commonError: "Morris disliked conflict and was dragged into it unwillingly.",
        whyWrong: "He explicitly says disputing is one of his greatest pleasures, so the conflict was not merely imposed on him.",
        groundedEntities: ["Franklin", "Assembly. His"],
      },
    ],
    allowedEntities: [
      "Quarrels", "Proprietary Governors", "Governor Robert Hunter Morris's", "Pennsylvania Assembly", "Franklin", "Penn",
      "When Morris", "Assembly", "Chronic", "Pennsylvania's", "Loan-Office", "Robert Hunter Morris", "England",
      "Governor Hamilton", "Morris", "Habitual", "Morris's", "Assembly's", "Hamilton", "Crown Point", "Newly", "Boston",
      "House", "Mr. Morris", "Mr. Hamilton", "New York", "Sancho Panza", "Sancho Panza's", "Quakers",
      "Massachusetts Bay's Crown Point", "Massachusetts Bay", "Mr. Quincy", "Pennsylvania", "Quincy's", "New Englander",
      "Governor Morris", "Quincy", "Loan", "Mr. Pownall", "Governor", "The Pennsylvania Assembly", "They", "Franklin's",
      "Governor Denny's", "His", "Despite", "Proprietary", "Habitually", "Winning", "The Assembly's", "Writing",
      "The Assembly", "The Assemblies", "Continued", "Penns", "Massachusetts Bay's", "Loan-office", "The Loan-Office",
      "Robert Hunter Morris / promised to avoid Assembly disputes, then didn't",
      "Massachusetts Bay's Crown Point appeal / Loan-Office orders funding Pennsylvania's ten-thousand-pound aid",
    ],
    allowedPlaces: [],
    allowedNumbers: [],
  } as unknown as SourcePacketV1;
}

// ch14: "Mr. Norris" appears only in allowedEntities (and a sourceQuote the gate does not read).
function ch14ShapePacket(): SourcePacketV1 {
  return {
    chapterTitle: "Albany Plan of Union",
    allowedAnchors: [BROWNELL_ANCHOR],
    namedCases: [
      {
        id: "ch14.case.pa_assembly_rejection",
        label: "Pennsylvania Assembly / Rejection of the Plan in Franklin's Absence",
        summary: "Pennsylvania's governor forwarded the union plan to the Assembly with praise for its clarity and judgment, recommending serious attention. A certain member nonetheless managed to bring the plan up for consideration while Franklin happened to be absent, and the House rejected it without giving it real attention.",
        hardSpecifics: ["great clearness and strength", "a certain member"],
      },
    ],
    facts: [
      {
        id: "ch14.fact.albany_order",
        claim: "The 1754 Albany congress was ordered by the Lords of Trade to coordinate colonial defense against France and relations with the Six Nations.",
        mechanism: "Renewed fear of war with France prompted London to direct a joint colonial-Indian diplomatic meeting rather than leave it to individual colonies.",
        commonError: "The congress was a colonial initiative rather than a directive from London.",
        whyWrong: "Governor Hamilton is described as having \"receiv'd this order\" from the Lords of Trade, meaning the meeting originated with crown authority, not colonial choice.",
        groundedEntities: ["Albany", "Lords", "Trade", "France", "Six Nations. Renewed", "London", "Indian", "London. Governor Hamilton"],
      },
    ],
    allowedEntities: [
      "Albany Plan", "Union", "Facing", "France", "Franklin", "American", "Albany", "British Board", "Trade", "England",
      "Recognizing", "Coordinated", "Six Nations", "Lords", "Opposite", "Rejecting", "America", "Britain", "Albany Congress",
      "Speaker", "Thomas Penn", "Secretary Peters", "Assembly", "Indian", "June", "The Albany", "The Pennsylvania",
      "Benjamin Franklin", "Plan", "Colonies", "Traveling", "After", "Franklin's", "JOIN", "DIE", "Mr. James Alexander",
      "Under", "Board", "British", "Parliament", "The Board", "Pennsylvania Assembly", "Rejection", "Pennsylvania's",
      "House", "Procedural", "The Governor", "Pennsylvania", "The House", "Look", "Kennedy", "Several", "Officials",
      "Governor Shirley", "Boston", "Renewed", "London", "Governor Hamilton", "Trade's", "Mr. Norris", "Mr. Thomas Penn",
      "Mr. Secretary Peters", "The Pennsylvania Assembly", "Obligation", "House's", "The Assembly", "Despite", "Many",
      "Shirley", "Being", "Pennsylvania Assembly / Rejection of the Plan in Franklin's Absence",
    ],
    allowedPlaces: [],
    allowedNumbers: [],
  } as unknown as SourcePacketV1;
}

function sec137Tokens(why: string, packet: SourcePacketV1): string[] {
  return byCheck(validateExamplePack(pack(why), blueprint(), packet), "SEC137.").flatMap((f) => [...f.message.matchAll(/"([^"]+)"/g)].map((m) => m[1]));
}

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
      CH16_BOND_CASE,
      {
        id: "ch09.case.virtues",
        label: "Benjamin Franklin / thirteen-virtue tracking book",
        summary: "Franklin listed Temperance, Silence, Order, Resolution, Frugality and Industry, and credited Industry and Frugality with his early easiness.",
        hardSpecifics: ["seven columns", "red ink"],
      },
    ],
    // Round 3: ch16's own fact writes "bond" in lower case ("Franklin's personal bond").
    facts: [...base.facts, CH16_PERSONAL_BOND_FACT],
    allowedEntities: [...base.allowedEntities, "Silence", "Club-Tested Civic Reform", "Premature Victory Fireworks Subscription", "Temperance", "Industry", "The Two Doctors Bond", "Doctors Bond", "Bond", "Two"],
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

// ── round 3: the real packet shapes the round-2 detector missed ──────────────────

requiredTest("Q06b round 3: ch15 shape, Franklin at a sentence start fires although the prose never writes Franklin's", () => {
  const packet = ch15ShapePacket();
  // The fixture reproduces the real ch15 shape: no possessive or titled Franklin outside allowedEntities.
  const { allowedEntities, ...rest } = packet as unknown as { allowedEntities: string[] };
  assert.ok(!/Franklin's|Mr\. Franklin/.test(JSON.stringify(rest)), "fixture drift: ch15 prose must not write Franklin's");
  assert.ok(allowedEntities.includes("Franklin's"));
  for (const why of [
    "Franklin stayed out of the dispute and kept the funding moving.",
    "A second vote moves the money without the governor's signature. Franklin did the same with the governor.",
    "A second vote moves the money. Franklin found the same route around the governor's blocked funding bill.",
    "A second vote moves the money. Franklin's own friendship with the governor survived comparable friction.",
    "A second vote moves the money, as Franklin found.",
  ]) assert.deepEqual(sec137Tokens(why, packet), ["Franklin"], `must flag Franklin: ${why}`);
  assert.deepEqual(sec137Tokens(NAME_FREE_WHY, packet), [], "a name-free whyItMatters stays clean in the ch15 shape");
});

requiredTest("Q06b round 3: ch16 shape, the Doctors Bond fire although the packet also writes lower-case bond", () => {
  const packet = ch16ShapePacket();
  assert.match(JSON.stringify(packet.facts), /personal bond/, "fixture drift: ch16 writes bond in lower case");
  for (const why of [
    "The Doctors Bond learned what an early celebration costs. A recount waits for the facts.",
    "Bond's subscription should have waited. A recount waits for the facts.",
    "A recount waits for the facts, as the Doctors Bond found.",
    "A recount waits for the facts, the way Bond's subscription should have.",
  ]) assert.deepEqual(sec137Tokens(why, packet), ["Bond"], `must flag Bond: ${why}`);
  for (const why of [
    "Two signatures are cheaper than one bad shipment. A personal bond is only as good as the count behind it.",
    "Before the truck leaves, the count and the page agree.",
    "Confidence in a neat page is not a count. Only the recount catches the missing bundle.",
  ]) assert.deepEqual(sec137Tokens(why, packet), [], `false positive on: ${why}`);
});

requiredTest("Q06b round 3: Denny and Norris fire from allowedEntities alone (Governor Denny's, Mr. Norris)", () => {
  for (const [why, token, packet] of [
    ["Governor Denny would have signed the second bill. A vote the governor cannot veto moves the money.", "Denny", ch15ShapePacket()],
    ["Denny would have signed the second bill. A vote the governor cannot veto moves the money.", "Denny", ch15ShapePacket()],
    ["A vote the governor cannot veto moves the money, as Denny found.", "Denny", ch15ShapePacket()],
    ["Mr. Norris kept the minutes. A plan read while its author is away gets no hearing.", "Norris", ch14ShapePacket()],
    ["Norris kept the minutes. A plan read while its author is away gets no hearing.", "Norris", ch14ShapePacket()],
    ["A plan read while its author is away gets no hearing, as Norris's minutes show.", "Norris", ch14ShapePacket()],
  ] as const) assert.deepEqual(sec137Tokens(why, packet), [token], `must flag ${token}: ${why}`);
});

requiredTest("Q06b round 3: institution words and entity noise stay clean at a sentence start in the real shapes", () => {
  // "House's", "Trade's", "Loan", "Writing", "Winning", "Obligation" are in these packets'
  // entity lists; the packets write the institutions after "the" ("the House", "the Lords of Trade").
  for (const [why, packet] of [
    ["House rules decide who signs. Loan terms matter less than who can veto them.", ch15ShapePacket()],
    ["Writing the vote down first keeps the governor out of it. Winning the argument is not the same as moving the money.", ch15ShapePacket()],
    ["Trade rules the timing here. Board members read the plan once, and rejection is cheap when nobody who wrote it is in the room.", ch14ShapePacket()],
    ["House members vote on what is in the room. Obligation to an absent author is not a check.", ch14ShapePacket()],
  ] as const) assert.deepEqual(sec137Tokens(why, packet), [], `false positive on: ${why}`);
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
