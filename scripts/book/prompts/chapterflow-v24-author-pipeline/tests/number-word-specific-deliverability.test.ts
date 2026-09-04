/**
 * A SPECIFIC THE PROSE SPELLS OUT MUST COUNT AS TAUGHT (SEC14 / SEC128 / SEC136).
 *
 * Live Franklin run, attempt 4 (2026-09-04). The compile stage failed ch01's
 * SUMMARY pack three attempts running in round 2 and again in round 3, on the same
 * pair of blockers:
 *
 *   BOOK_RUN_COMPILER_FAILED:COMPILER_SECTION_BLOCKED:summary-pack:after 3 attempts:
 *   SEC14.chapter_case_grounding@/breakdown: this chapter cites
 *   ch01.case.josiahEmigration but its reader-visible prose carries only 1/2
 *   (round 3: 0/2) of that case's hardSpecifics (about 1682, seventeen, thirteen)
 *   | SEC136.dealt_case_untaught@/breakdown: … (still missing: "seventeen", "thirteen")
 *
 * The writer card was NOT the problem. Rebuilding ch01's summary task card
 * deterministically from the frozen sidecar (compileSourcePacketFromSidecar →
 * compileChapterBlueprint → buildSectionTaskMarkdown) renders the MUST TEACH block
 * naming exactly those strings:
 *
 *   - ch01.case.josiahEmigration — Josiah Franklin / emigration to New England:
 *     "about 1682" | "seventeen" | "thirteen"
 *
 * The GATE could not be satisfied. `normalizeDerivabilityText` folds standalone
 * number WORDS to digits so "thirteen virtues" and "13 virtues" compare equal —
 * and `specificDerivable` then applies its ≥3-character floor to the FOLDED
 * string. "seventeen" → "17" and "thirteen" → "13" are two characters, so both
 * were skipped as too short and reported as absent from prose that states them in
 * full. Every number word below one hundred folds to at most two characters, so a
 * case whose hardSpecifics are number words could never reach the two-specific bar
 * however the chapter was written: SEC14 and SEC136 were UNSATISFIABLE BY
 * CONSTRUCTION, and the compiler burned its whole retry budget on a re-draft no
 * draft could pass.
 *
 * The floor exists for a real reason — `includes("13")` matches inside "1913" and
 * "213 pages" — so the fix is not to drop it. A short needle that carries a DIGIT
 * is matched by whole-TOKEN equality instead of substring inclusion: strictly
 * narrower than the check the floor was protecting against, and it answers the
 * question the gate actually asks. Short needles with no digit ("a", "of") keep
 * the old skip.
 */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import {
  countSpecificsInProse,
  normalizeDerivabilityText,
  specificDerivable,
} from "../src/sections/chapterProse.js";
import { CHAPTER_CASE_MIN_SPECIFICS, dealtCaseCoverage } from "../src/sections/dealtCases.js";
import { validateSummaryPack, type SectionFinding } from "../src/sections/sectionGate.js";
import type { ChapterBlueprintV1, SourcePacketV1, SummaryPackV1 } from "../src/artifacts/artifactTypes.js";
import type { SourceAnchorForPrompt } from "../src/types.js";

const CHID = "zz-numberword-ch01";
const JOSIAH_ID = "ch01.case.josiahEmigration";

/** The live ch01 case, verbatim from the frozen Franklin sidecar
 *  (research-runs/…/sidecars/source/ch01.source.json, namedExamples[0]). */
const JOSIAH: SourceAnchorForPrompt = {
  id: JOSIAH_ID,
  kind: "named_example",
  label: "Josiah Franklin / emigration to New England",
  text: "Josiah Franklin married young and carried his wife and three children to New England around 1682. He went on to father seventeen children across two marriages, thirteen of whom survived to adulthood.",
  hardSpecifics: ["about 1682", "seventeen", "thirteen"],
  supportsClaimTypes: ["example", "hook", "breakdown_claim", "quiz_prompt", "quiz_explanation", "quiz_key_evidence", "review_card", "takeaway"],
};

/** The prose a writer obeying the MUST TEACH block writes: all three specifics on
 *  the page, in ordinary English. */
const TEACHING_PROSE = "Josiah, the father, carried his wife and three children into New England about 1682, after the law shut the meetings he worshipped at. He fathered seventeen children across two marriages, and thirteen of them grew up and once sat down together at his table.";

function packet(anchors: SourceAnchorForPrompt[]): SourcePacketV1 {
  return { allowedAnchors: anchors, facts: [], namedCases: [], allowedEntities: [], allowedPlaces: [] } as unknown as SourcePacketV1;
}

function blueprint(): ChapterBlueprintV1 {
  return {
    chapterNumber: 1,
    chapterId: CHID,
    sections: {
      quiz: [{ caseCueIds: [JOSIAH_ID] }],
      cards: [{ caseCueIds: [JOSIAH_ID] }],
      examples: [{ requiredCaseIds: [JOSIAH_ID] }],
    },
    constraints: { allowedFactIds: [], allowedCaseIds: [], forbiddenClaims: [], forbiddenLeakage: [], bannedHouseTics: [] },
  } as unknown as ChapterBlueprintV1;
}

function summary(tiers: { fastRead: string; deepRead: string; fullRead: string }): SummaryPackV1 {
  return {
    schemaVersion: "section-artifact-v1",
    artifactType: "summary-pack",
    chapterId: CHID,
    hook: { hook: "A three-hundred-year freehold is not an inheritance story; it is evidence that method ran in this family.", sourceAnchorIds: [JOSIAH_ID] },
    breakdown: {
      fastRead: tiers.fastRead,
      deepRead: tiers.deepRead,
      fullRead: tiers.fullRead,
      sourceAnchorIds: { fastRead: [], deepRead: [], fullRead: [] },
    },
    keyTakeaway: "Write down the particular means that carried you, so someone else can test them.",
    keyTakeawaySourceAnchorIds: [],
    sourceFactIds: [],
  } as unknown as SummaryPackV1;
}

function caseFindings(findings: SectionFinding[]): SectionFinding[] {
  return findings.filter((f) => f.checkId === "SEC14.chapter_case_grounding" || f.checkId === "SEC136.dealt_case_untaught");
}

// ── the predicate ────────────────────────────────────────────────────────────

test("a number-word specific the prose spells out is derivable (the live ch01 wedge)", () => {
  const prose = normalizeDerivabilityText(TEACHING_PROSE);
  assert.equal(specificDerivable("seventeen", prose), true, '"seventeen" is on the page');
  assert.equal(specificDerivable("thirteen", prose), true, '"thirteen" is on the page');
  assert.equal(specificDerivable("about 1682", prose), true);
});

test("the digit form and the word form of a specific are still one fact", () => {
  // The fold exists so SEC56's verbatim "thirteen virtues" and prose saying
  // "13 virtues" are not jointly unsatisfiable. Both directions must hold.
  const wordProse = normalizeDerivabilityText("He fathered seventeen children, and thirteen of them grew up.");
  const digitProse = normalizeDerivabilityText("He fathered 17 children, and 13 of them grew up.");
  for (const prose of [wordProse, digitProse]) {
    assert.equal(specificDerivable("seventeen", prose), true);
    assert.equal(specificDerivable("17", prose), true);
    assert.equal(specificDerivable("thirteen", prose), true);
    assert.equal(specificDerivable("13", prose), true);
  }
});

test("a short figure is matched as a whole token, never inside a longer number", () => {
  // The ≥3-char floor was protecting against exactly this: `includes("13")` is
  // true of "1913" and of "213 pages". The fix must not buy satisfiability with
  // a false positive — nothing here is on the page.
  const decoy = normalizeDerivabilityText("The register was begun in 1913 and runs to 213 pages, with 170 entries and a note dated 1682-03.");
  assert.equal(specificDerivable("thirteen", decoy), false, '"1913" does not teach thirteen');
  assert.equal(specificDerivable("13", decoy), false);
  assert.equal(specificDerivable("seventeen", decoy), false, '"170" does not teach seventeen');
  assert.equal(specificDerivable("17", decoy), false);
});

test("a short specific with no digit keeps the floor's skip", () => {
  // Unchanged behaviour: a one- or two-character word is semantically empty or
  // ambiguous, and substring-matching it would credit any prose at all.
  const prose = normalizeDerivabilityText("A cutler of Boston took him on liking, and the fee ended it.");
  assert.equal(specificDerivable("a", prose), false);
  assert.equal(specificDerivable("of", prose), false);
});

test("every number word the fold knows survives it as a deliverable specific", () => {
  // The class guard: a normalisation that makes a specific impossible to put on
  // the page turns every gate that measures it into an unsatisfiable one.
  const words = ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
    "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen",
    "nineteen", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
  for (const word of words) {
    const prose = normalizeDerivabilityText(`The record counts ${word} of them in that household.`);
    assert.equal(specificDerivable(word, prose), true, `"${word}" must be deliverable as prose`);
  }
});

// ── the gates that measure it ────────────────────────────────────────────────

test("the live ch01 case reaches the two-specific bar from prose that teaches it", () => {
  const prose = normalizeDerivabilityText(TEACHING_PROSE);
  assert.equal(countSpecificsInProse(JOSIAH.hardSpecifics ?? [], prose), 3);
  assert.ok(countSpecificsInProse(JOSIAH.hardSpecifics ?? [], prose) >= CHAPTER_CASE_MIN_SPECIFICS);
});

test("SEC14 and SEC136 pass the ch01 summary that obeys the MUST TEACH block", () => {
  const pack = summary({
    fastRead: TEACHING_PROSE,
    deepRead: "Josiah made candles and soap in Boston, and the household he kept feeding was the first fact of his son's life.",
    fullRead: "Josiah made candles and soap in Boston. The household he kept feeding was the first fact of his son's life, and it decided how much schooling there was to go round.",
  });
  const findings = caseFindings(validateSummaryPack(pack, blueprint(), packet([JOSIAH])));
  assert.deepEqual(findings.map((f) => f.checkId), [], "prose that states all three specifics must not be reported as teaching none");
});

test("SEC14 and SEC136 still block a ch01 summary that teaches only one specific", () => {
  // The gate is repaired, not relaxed: one specific is still below the bar.
  const pack = summary({
    fastRead: "Josiah, the father, carried his wife and three children into New England about 1682, after the law shut the meetings he worshipped at.",
    deepRead: "Josiah made candles and soap in Boston, and the household he kept feeding was the first fact of his son's life.",
    fullRead: "Josiah made candles and soap in Boston. The household he kept feeding was the first fact of his son's life.",
  });
  const findings = caseFindings(validateSummaryPack(pack, blueprint(), packet([JOSIAH])));
  assert.equal(findings.length, 2, "SEC14 and SEC136 both still fire");
  for (const finding of findings) {
    assert.equal(finding.severity, "blocker");
    assert.match(finding.message, /1\/2/);
  }
  const coverage = dealtCaseCoverage(blueprint(), packet([JOSIAH]), pack);
  assert.equal(coverage.length, 1);
  assert.equal(coverage[0].taughtInProse, 1);
  assert.deepEqual([...coverage[0].missingFromProse], ["seventeen", "thirteen"]);
});
