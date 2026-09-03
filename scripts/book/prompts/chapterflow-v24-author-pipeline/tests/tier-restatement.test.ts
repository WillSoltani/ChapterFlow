/**
 * TIER RESTATEMENT — SEC130 (sentence-level twinning) and SEC131 (novelty floor).
 * Register R-066 and R-072, package 1B item (d).
 *
 * The defect, in the reader panel's words and in the bytes: "tiers restate instead
 * of deepen". The gate collected the three tiers of every chapter into one
 * cross-chapter comparison and then threw away the same-chapter pairs
 * (`if (a.chapterNumber === b.chapterNumber) continue`), so INTRA-chapter overlap was
 * never measured at write time at all. Ship time measured it (B15, content-lemma
 * Jaccard) and filed it as a `minor` advisory — the live repair-r7 QC record carries
 * two B15 WARNs at "share 45%" and "share 58%" and the book shipped anyway.
 *
 * MEASURED on the live rev-6 candidate with the normalisation this check uses
 * (contentLemmaSet, the same lemmatiser B15 uses), twinned sentences as a share of
 * the deeper tier:
 *
 *            deepRead vs fastRead      fullRead vs deepRead
 *   ch01           3.3%  (1/30)              12.5%  (6/48)
 *   ch02           0.0%  (0/31)               9.8%  (6/61)
 *   ch03           8.3%  (2/24)              14.3%  (5/35)
 *   ch04          12.1%  (4/33)              31.4%  (16/51)   <- the chapter Phase A named
 *
 * ch04 is the chapter both Phase A and the blind panel called out ("Every war tax
 * bill the Assembly passes hits the same wall." appears VERBATIM in deepRead and
 * fullRead). A blocker at 25% separates it from every other measured pair by more
 * than ten points on both sides; the advisory at 15% warns in the band between.
 *
 * Novelty (share of the deeper tier's content lemmas absent from the shallower one)
 * on the same four chapters: deepRead 60.8-81.4%, fullRead 39.9-68.7%. The floors
 * are set BELOW the lowest observed value (50% and 35%) on purpose: SEC131 is not
 * meant to re-decide the chapters SEC130 already decides, it is the floor that stops
 * a tier from meeting its CHARACTER count by recycling its predecessor's vocabulary
 * while dodging sentence-level twinning.
 */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import { validateSummaryPack, type SectionFinding } from "../src/sections/sectionGate.js";
import type { ChapterBlueprintV1, SourcePacketV1, SummaryPackV1 } from "../src/artifacts/artifactTypes.js";

const CHID = "zz-tier-ch04";
const EMPTY_PACKET = { allowedAnchors: [], facts: [], namedCases: [] } as unknown as SourcePacketV1;
const BP = { chapterNumber: 4, chapterId: CHID, sections: { quiz: [], cards: [], examples: [] }, constraints: { allowedFactIds: [], allowedCaseIds: [], forbiddenClaims: [], forbiddenLeakage: [], bannedHouseTics: [] } } as unknown as ChapterBlueprintV1;

function byCheck(findings: SectionFinding[], id: string): SectionFinding[] {
  return findings.filter((f) => f.checkId === id);
}

/** Live rev-6 ch04 sentences (deepRead), verbatim from the candidate. */
const DEEP_LIVE = [
  "Every war tax bill the Assembly passes hits the same wall.",
  "The governors who work for the Penn family must block any bill that taxes the family's own land.",
  "Franklin runs his own life by strict habit and firm deadlines.",
  "Lord Granville tells Franklin the king's instructions bind a governor like law.",
];
/** The rev-6 fullRead's twins of those four — two verbatim, two reworded. */
const FULL_TWINS = [
  "Every war tax bill the Assembly passes hits the same wall.",
  "The governors who work for that family must block any bill that taxes the family's own land.",
  "Franklin runs his own life by strict habit and firm deadlines.",
  "Lord Granville tells Franklin that the king's instructions to a governor carry the force of law.",
];
/** Sentences that ADD instead: antecedents, consequence, limit. */
const FULL_NEW = [
  "A charter signed in London decades earlier reserved the proprietors' quit-rents from every provincial levy.",
  "Merchants in Bristol read the same dispatches and priced Pennsylvania paper accordingly.",
  "The Privy Council eventually allowed the disputed statute, which nobody in Philadelphia expected.",
  "Nothing in the arrangement stopped a later governor from reviving the exemption on his own authority.",
  "Quakers in the Assembly refused a militia vote for reasons that had nothing to do with taxes.",
  "A single clerk's copy of the disputed schedule survived the crossing and settled the argument in committee.",
  "The dispute cost two sailing seasons, which mattered more to the wagon contractors than to the lawyers.",
  "Colonial agents in London were paid by the Assembly and answered to nobody else.",
];

/** Tiers are built at their real sentence counts and NOT padded to the SEC6
 *  character floors: this file measures restatement, and padding to 2,400 characters
 *  would bury a 4-in-5 twin rate under forty filler sentences. Every assertion below
 *  filters to the check under test, so SEC6's own length blocker is not in the way. */
function tiers(fast: string[], deep: string[], full: string[]): SummaryPackV1 {
  const pad = (sentences: string[]): string => sentences.join(" ");
  return {
    schemaVersion: "section-artifact-v1",
    artifactType: "summary-pack",
    chapterId: CHID,
    hook: { hook: "A colonial agent crosses an ocean to argue a tax question with a family that owns the province.", sourceAnchorIds: [] },
    breakdown: {
      fastRead: pad(fast),
      deepRead: pad(deep),
      fullRead: pad(full),
      sourceAnchorIds: { fastRead: [], deepRead: [], fullRead: [] },
    },
    keyTakeaway: "Argue where the decision is actually made, not where the grievance is loudest.",
    keyTakeawaySourceAnchorIds: [],
  } as unknown as SummaryPackV1;
}

const FAST = ["The province cannot tax the family that owns it.", "So the argument moves to London."];

test("SEC130 blocks the rev-6 ch04 shape: a fullRead whose sentences twin the deepRead", () => {
  // 4 twins in a 5-sentence fullRead = 80%, far above the 25% blocker.
  const pack = tiers(FAST, DEEP_LIVE, [...FULL_TWINS, FULL_NEW[0]]);
  const findings = byCheck(validateSummaryPack(pack, BP, EMPTY_PACKET), "SEC130.tier_restatement");
  const blocker = findings.find((f) => f.severity === "blocker" && /fullRead/.test(f.message));
  assert.ok(blocker, `a fullRead that re-runs deepRead's sentences must block; got:\n${findings.map((f) => f.message).join("\n")}`);
  assert.match(blocker!.message, /Every war tax bill the Assembly passes hits the same wall/, "the message quotes a twinned sentence so the retry knows which one");
});

test("SEC130 leaves a fullRead that ADDS: antecedents, consequence and limits", () => {
  const pack = tiers(FAST, DEEP_LIVE, FULL_NEW);
  const findings = byCheck(validateSummaryPack(pack, BP, EMPTY_PACKET), "SEC130.tier_restatement");
  assert.deepEqual(findings, [], `a deepening tier must pass; got:\n${findings.map((f) => f.message).join("\n")}`);
});

test("SEC130 advises, not blocks, in the band between 15% and 25%", () => {
  // 1 twin in 6 fullRead sentences = 16.7%.
  const pack = tiers(FAST, DEEP_LIVE, [FULL_TWINS[0], ...FULL_NEW.slice(0, 5)]);
  const findings = byCheck(validateSummaryPack(pack, BP, EMPTY_PACKET), "SEC130.tier_restatement");
  assert.equal(findings.length, 1, `one twin in six sentences should advise; got:\n${findings.map((f) => f.message).join("\n")}`);
  assert.equal(findings[0].severity, "advisory");
});

test("SEC130 measures the deepRead against the fastRead too", () => {
  const pack = tiers([DEEP_LIVE[0], DEEP_LIVE[1]], DEEP_LIVE, FULL_NEW);
  const findings = byCheck(validateSummaryPack(pack, BP, EMPTY_PACKET), "SEC130.tier_restatement");
  assert.ok(findings.some((f) => /deepRead/.test(f.message)), `the fast/deep pair must be measured too; got:\n${findings.map((f) => f.message).join("\n")}`);
});

test("SEC131 blocks a fullRead that meets its character floor on recycled vocabulary", () => {
  // Every sentence is a re-ordering of the deepRead's own words, so sentence-level
  // twinning stays low while the tier introduces almost nothing new.
  const recycled = [
    "The Assembly passes a war tax bill and the wall it hits is the same one.",
    "Bills that tax the family's own land are what governors working for the Penn family block.",
    "Strict habit and firm deadlines are how Franklin runs his own life.",
    "A governor is bound by the king's instructions like law, Lord Granville tells Franklin.",
    "The wall the war tax bill hits is the family land the Penn governors will not tax.",
    "Franklin, bound by habit and deadlines, hears the king's instructions bind a governor.",
  ];
  const pack = tiers(FAST, DEEP_LIVE, recycled);
  const findings = byCheck(validateSummaryPack(pack, BP, EMPTY_PACKET), "SEC131.tier_novelty");
  assert.equal(findings.length, 1, `a recycled tier must block; got:\n${findings.map((f) => f.message).join("\n")}`);
  assert.equal(findings[0].severity, "blocker");
  assert.match(findings[0].message, /fullRead/);
});

test("SEC131 stays silent on every tier pair of the live rev-6 book (floors sit below the measured minimum)", () => {
  const pack = tiers(FAST, DEEP_LIVE, FULL_NEW);
  assert.deepEqual(byCheck(validateSummaryPack(pack, BP, EMPTY_PACKET), "SEC131.tier_novelty"), []);
});
