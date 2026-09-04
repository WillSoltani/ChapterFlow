/**
 * ONE PREDICATE, FOR REAL — THE CARD AND SEC120 MUST JUDGE A SHORT FIGURE ALIKE.
 *
 * Round 2 of the review of the number-word fix. That fix widened the SHARED predicate
 * (`specificDerivable`) so a short DIGIT-bearing needle — "seventeen" → "17",
 * "thirteen" → "13" — is credited by whole-TOKEN equality, and SEC14/SEC136 became
 * satisfiable again. But SEC120 kept its own inline ≥3-char floor and the writer
 * card's `add()` kept its own `key.length < 3` filter, so THREE answers to one
 * question survived in the tree. Measured on the reviewer's fixture — an anchor whose
 * hardSpecifics are ["seventeen", "forty shillings", "Sherburne town"] against prose
 * that shows only "seventeen":
 *
 *   origin/main : standDownIds=[anchor]  notDerivable=[]  derivable=[]
 *   PR head     : standDownIds=[]        notDerivable=["forty shillings",
 *                                                      "Sherburne town"]  derivable=[]
 *
 * At the PR head the card printed a DO-NOT-USE list and NO allowed list, for an anchor
 * SEC120 (still on its own floor) stood down on and would never block — while SEC56 /
 * SEC58 compel a citing unit to carry one of that anchor's specifics verbatim. The
 * writer was handed two forbidden strings, no permitted one, and a gate that would in
 * fact have accepted any of the three. Live on ch01: the case is dealt to quiz 1 and
 * card 1.
 *
 * The fix is the one the widened predicate promised: SEC120's inline comparisons call
 * `specificDerivable`, and `add()` keeps a short needle the shared predicate can
 * actually judge. Consequences, both intended:
 *
 *  - SEC120 can now BLOCK a unit that names a short figure the prose never states
 *    ("thirteen" in a stem against prose that never says it). That is the correct
 *    direction — it is the same judgement SEC14/SEC136 make about the same string.
 *    What they share is the PREDICATE, not the HAYSTACK: SEC14/SEC136 measure
 *    `chapterProseText` (fullRead included), SEC120 measures `standaloneProseText`
 *    (fullRead excluded). One predicate, but SEC120's haystack excludes fullRead, so
 *    a case taught only in fullRead still satisfies SEC14/SEC136 and still blocks
 *    under SEC120 — unchanged from origin/main. The last test in this file pins that
 *    pincer as documented behaviour.
 *  - The ALLOWED list surfaces the credited short figure, so the writer has a legal
 *    move for the anchor SEC56/SEC58 compel it to cite.
 *
 * MINOR, same round: whole-token crediting of "one" and "two" with no context let
 * incidental prose ("One of the boys… two of the shops…") score a case fully taught.
 * A BARE number word is creditable only from ten up (SHORT_FIGURE_MIN_VALUE); a
 * one-digit specific is inert everywhere — never credited, never blocked, never listed.
 */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import {
  chapterProseText,
  normalizeDerivabilityText,
  packetProseDerivability,
  renderProseSpecificList,
  specificDerivable,
  standaloneProseText,
} from "../src/sections/chapterProse.js";
import { learningProseDerivabilityFindings, validateSummaryPack } from "../src/sections/sectionGate.js";
import type { ChapterBlueprintV1, LearningPackV1, SourcePacketV1, SummaryPackV1 } from "../src/artifacts/artifactTypes.js";
import type { SourceAnchorForPrompt } from "../src/types.js";

const CHID = "zz-shortfigure-ch01";
const ANCHOR_ID = "ch01.case.josiahEmigration";

/** The reviewer's fixture, verbatim: one anchor, three hardSpecifics, exactly one of
 *  them a SHORT figure (the number word "seventeen" folds to "17"). */
const ANCHOR: SourceAnchorForPrompt = {
  id: ANCHOR_ID,
  kind: "named_example",
  label: "Josiah Franklin / emigration to New England",
  text: "Josiah Franklin fathered seventeen children. His wife's people came out of Sherburne town, and the passage cost forty shillings.",
  hardSpecifics: ["seventeen", "forty shillings", "Sherburne town"],
  supportsClaimTypes: ["example", "hook", "breakdown_claim", "quiz_prompt", "quiz_explanation", "quiz_key_evidence", "review_card", "takeaway"],
};

/** Prose that states ONE of the three — the short one — and neither other. The year
 *  1682 is on the page so SEC120's independent year rule is not what is being measured. */
const PROSE_SHOWS_ONLY_THE_SHORT_FIGURE =
  "Josiah carried his wife and three children into New England about 1682. He fathered seventeen children across two marriages, and the house he kept feeding was the first fact of his son's life.";

function packet(anchors: SourceAnchorForPrompt[]): SourcePacketV1 {
  return { allowedAnchors: anchors, facts: [], namedCases: [], allowedEntities: [], allowedPlaces: [] } as unknown as SourcePacketV1;
}

function blueprint(): ChapterBlueprintV1 {
  return {
    chapterNumber: 1,
    chapterId: CHID,
    sections: { quiz: [{ caseCueIds: [ANCHOR_ID] }], cards: [{ caseCueIds: [ANCHOR_ID] }], examples: [] },
    constraints: { allowedFactIds: [], allowedCaseIds: [], forbiddenClaims: [], forbiddenLeakage: [], bannedHouseTics: [] },
  } as unknown as ChapterBlueprintV1;
}

function summary(body: string): SummaryPackV1 {
  return {
    schemaVersion: "section-artifact-v1",
    artifactType: "summary-pack",
    chapterId: CHID,
    hook: { hook: "A three-hundred-year freehold is not an inheritance story.", sourceAnchorIds: [ANCHOR_ID] },
    breakdown: {
      fastRead: body,
      deepRead: "Josiah made candles and soap in Boston, and the household he kept feeding decided how much schooling there was to go round.",
      fullRead: "Josiah made candles and soap in Boston. The household he kept feeding decided how much schooling there was to go round, and it ended his son's schooling at ten.",
      sourceAnchorIds: { fastRead: [], deepRead: [], fullRead: [] },
    },
    keyTakeaway: "Write down the particular means that carried you, so someone else can test them.",
    keyTakeawaySourceAnchorIds: [],
    sourceFactIds: [],
  } as unknown as SummaryPackV1;
}

/** A learning pack whose only quiz question cites the anchor and names `value`. */
function packUsing(value: string): LearningPackV1 {
  return {
    schemaVersion: "section-artifact-v1",
    artifactType: "learning-pack",
    chapterId: CHID,
    quiz: {
      questions: [{
        prompt: `A reader recalls ${value} while deciding which move changed what the household could afford. Which action did it?`,
        choices: ["He kept the shop books", "He apprenticed the boy out", "He moved the meeting", "He sold the freehold"],
        answerIndex: 1,
        explanation: `The keyed move changed what the house could afford; ${value} is the detail the chapter used to make the point.`,
        sourceAnchorIds: [ANCHOR_ID],
        keyEvidenceAnchorIds: [ANCHOR_ID],
      }],
    },
    cards: { cards: [] },
  } as unknown as LearningPackV1;
}

function sec120(pack: LearningPackV1, prose: SummaryPackV1): string[] {
  return learningProseDerivabilityFindings(pack, blueprint(), packet([ANCHOR]), prose)
    .map((f) => f.message);
}

// ── the reviewer's measurement, pinned ───────────────────────────────────────

test("the card's split credits the short figure it is allowed to offer (reviewer's fixture)", () => {
  const split = packetProseDerivability(packet([ANCHOR]), summary(PROSE_SHOWS_ONLY_THE_SHORT_FIGURE));
  assert.equal(split.available, true);

  // The anchor does NOT stand down — one of its specifics IS on the page.
  assert.deepEqual([...split.standDownIds], [], "an anchor with a credited specific never stands down");
  // The two strings the prose omits are forbidden, exactly as the PR head had them.
  assert.deepEqual(
    split.notDerivable.map((e) => e.value),
    ["forty shillings", "Sherburne town"],
    "the off-page specifics stay on the DO-NOT-USE list",
  );
  // THE DEFECT: the credited short figure must be OFFERED, so the writer has a legal
  // move for an anchor SEC56/SEC58 compel it to cite verbatim.
  assert.deepEqual(
    split.derivable.map((e) => e.value),
    ["seventeen"],
    "the short figure the prose states must be listed under ALLOWED, not dropped by a length filter",
  );
  assert.match(renderProseSpecificList(split.derivable), /"seventeen"/, "and it must survive into the rendered ALLOWED list");
});

test("SEC120 answers the reviewer's fixture exactly as the card's split does", () => {
  const prose = summary(PROSE_SHOWS_ONLY_THE_SHORT_FIGURE);
  const split = packetProseDerivability(packet([ANCHOR]), prose);

  // Every string the split OFFERS, the gate accepts.
  for (const entry of split.derivable) {
    assert.deepEqual(sec120(packUsing(entry.value), prose), [], `the card offers "${entry.value}", so SEC120 must accept a unit that uses it`);
  }
  // Every string the split FORBIDS, the gate rejects. At the PR head SEC120 stood down
  // for this anchor (its own floor skipped the only on-page specific), so it accepted
  // both — the card's DO-NOT-USE list was a claim about a gate that never fired.
  for (const entry of split.notDerivable) {
    const messages = sec120(packUsing(entry.value), prose);
    assert.equal(messages.length, 1, `the card forbids "${entry.value}", so SEC120 must reject a unit that uses it`);
    assert.match(messages[0], new RegExp(`"${entry.value}"`));
  }
});

test("SEC120 blocks a unit naming a short figure the prose never states (the new, correct direction)", () => {
  // Prose shows "forty shillings" and NOT "seventeen". A stem that says "seventeen"
  // teaches a reader nothing this chapter showed — the same judgement SEC14/SEC136
  // make about the same string, now made here too.
  const prose = summary("Josiah carried his wife and three children into New England about 1682, and the passage cost forty shillings out of a purse that had little else in it.");
  const split = packetProseDerivability(packet([ANCHOR]), prose);
  assert.deepEqual([...split.standDownIds], []);
  assert.equal(split.notDerivable.some((e) => e.value === "seventeen"), true, "the card forbids it");
  const messages = sec120(packUsing("seventeen"), prose);
  assert.equal(messages.length, 1, "and SEC120 blocks it");
  assert.match(messages[0], /"seventeen"/);
});

test("SEC120 never reads a short figure out of the middle of a longer number in the unit", () => {
  // The floor SEC120 is giving up was guarding substring matching on BOTH sides. The
  // unit here names 1776 and never names seventeen; "17" is inside "1776", so a
  // substring test on the unit side would invent a blocker. 1776 is on the page, so
  // the independent year rule is satisfied and only the specific rule is measured.
  const prose = summary("Josiah carried his wife and three children into New England about 1682, and the passage cost forty shillings; the freehold was still standing in 1776.");
  assert.deepEqual(sec120(packUsing("the winter of 1776"), prose), [], '"1776" in a stem does not name "seventeen"');
});

test("SEC120 still stands down for an anchor whose specifics are ALL off the page", () => {
  // The Task 11an carve is unchanged: SEC56/SEC58 compel one of these strings, so
  // SEC120 must not forbid every one of them.
  const prose = summary("Josiah made candles and soap in Boston, and the household he kept feeding was the first fact of his son's life.");
  const split = packetProseDerivability(packet([ANCHOR]), prose);
  assert.deepEqual([...split.standDownIds], [ANCHOR_ID], "no specific on the page → the anchor stands down");
  assert.deepEqual(split.notDerivable, [], "and none of its specifics is forbidden");
  assert.deepEqual(split.derivable, []);
  for (const value of ANCHOR.hardSpecifics ?? []) {
    assert.deepEqual(sec120(packUsing(value), prose), [], `SEC120 stands down, so "${value}" is accepted`);
  }
});

// ── MINOR: a bare one-digit number word is not a specific ────────────────────

test("a bare single-digit number word is not credited by incidental prose", () => {
  // "One of the boys… two of the shops…" is not a chapter teaching a case. Bare "one"
  // and "two" fold to one character and carry no unit or qualifier, so whole-token
  // crediting would score any English prose at all.
  const incidental = normalizeDerivabilityText("One of the boys was sent to the grammar school, and two of the shops on the street were his father's customers.");
  for (const word of ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "zero"]) {
    assert.equal(specificDerivable(word, incidental), false, `bare "${word}" must not be creditable`);
    assert.equal(specificDerivable(String(["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"].indexOf(word)), incidental), false);
  }
});

test("a single-digit specific is inert everywhere — never credited, never blocked, never listed", () => {
  const inert: SourceAnchorForPrompt = { ...ANCHOR, hardSpecifics: ["two", "forty shillings"] };
  const prose = summary("Josiah kept two apprentices and a boy, and the passage had cost forty shillings out of a purse that had little else in it.");
  const split = packetProseDerivability(packet([inert]), prose);
  assert.deepEqual(split.derivable.map((e) => e.value), ["forty shillings"], '"two" is not offered even though the page says it');
  assert.deepEqual(split.notDerivable.map((e) => e.value), [], '"two" is not forbidden either — the gate never judges it');
  const findings = learningProseDerivabilityFindings(packUsing("two"), blueprint(), packet([inert]), prose)
    .map((f) => f.message);
  assert.deepEqual(findings, [], "and SEC120 neither credits nor blocks it");
});

test("a number word from ten up is still a real specific", () => {
  // The bound is on VALUE, not on the fold: the live ch01 wedge ("seventeen",
  // "thirteen") must stay closed.
  for (const [word, digits] of [["ten", "10"], ["thirteen", "13"], ["seventeen", "17"], ["ninety", "90"]] as const) {
    const prose = normalizeDerivabilityText(`The record counts ${word} of them in that household.`);
    assert.equal(specificDerivable(word, prose), true, `"${word}" must stay deliverable`);
    assert.equal(specificDerivable(digits, prose), true, `and so must "${digits}"`);
  }
});

// ── ROUND 3: one predicate is not one haystack — the fullRead pincer ─────────

/** The reviewer's Round-3 measurement, pinned as DOCUMENTED behaviour.
 *
 *  SEC14/SEC136 and SEC120 run the same derivability predicate, but they run it over
 *  DIFFERENT prose: SEC14/SEC136 over `chapterProseText` (hook + all three tiers +
 *  keyTakeaway) and SEC120 over `standaloneProseText` (the same MINUS fullRead,
 *  because a Deep-read reader must be able to answer). So a case whose specifics are
 *  split across the Deep read and the Full read can be fully credited upstream and
 *  still block a unit downstream. That is not a defect introduced by the shared
 *  predicate — it is the Task 11ak progressive-depth rule, identical on origin/main
 *  for every >=3-char specific, and SEC136's own message spells it out. */
const PINCER_ANCHOR: SourceAnchorForPrompt = {
  ...ANCHOR,
  hardSpecifics: ["about 1682", "seventeen"],
};

function pincerSummary(): SummaryPackV1 {
  return {
    ...summary("Josiah carried his wife and three children into New England about 1682, and the house he kept feeding was the first fact of his son's life."),
    breakdown: {
      // "about 1682" is on the standalone page; "seventeen" appears ONLY in fullRead.
      fastRead: "Josiah carried his wife and three children into New England about 1682.",
      deepRead: "He made candles and soap in Boston, and the household he kept feeding decided how much schooling there was to go round.",
      fullRead: "He fathered seventeen children across two marriages, and that household ended his son's schooling at ten.",
      sourceAnchorIds: { fastRead: [ANCHOR_ID], deepRead: [ANCHOR_ID], fullRead: [ANCHOR_ID] },
    },
  } as unknown as SummaryPackV1;
}

test("a case taught only in fullRead satisfies SEC14/SEC136 and still blocks under SEC120", () => {
  const prose = pincerSummary();
  const upstream = validateSummaryPack(prose, blueprint(), packet([PINCER_ANCHOR]))
    .filter((f) => f.checkId.startsWith("SEC14.") || f.checkId.startsWith("SEC136."));

  // Upstream haystack INCLUDES fullRead → both specifics credited, nothing to report.
  assert.equal(
    normalizeDerivabilityText(chapterProseText(prose)).includes(normalizeDerivabilityText("seventeen")),
    true,
    "chapterProseText carries the fullRead-only specific",
  );
  assert.deepEqual(upstream.map((f) => f.checkId), [], "SEC14/SEC136 credit 2/2 — fullRead counts for them");

  // SEC120's haystack EXCLUDES fullRead → the same string is not on the standalone
  // page, so a quiz that turns on it is blocked. One predicate, two haystacks.
  assert.equal(
    normalizeDerivabilityText(standaloneProseText(prose)).includes(normalizeDerivabilityText("seventeen")),
    false,
    "standaloneProseText does not",
  );
  const blocked = learningProseDerivabilityFindings(packUsing("seventeen"), blueprint(), packet([PINCER_ANCHOR]), prose)
    .map((f) => f.message);
  assert.equal(blocked.length, 1, "SEC120 blocks the fullRead-only specific");
  assert.match(blocked[0], /"seventeen"/);

  // And the specific the standalone page DOES show is accepted by all three.
  assert.deepEqual(
    learningProseDerivabilityFindings(packUsing("about 1682"), blueprint(), packet([PINCER_ANCHOR]), prose),
    [],
    "the fastRead specific is derivable for SEC120 too",
  );
});
