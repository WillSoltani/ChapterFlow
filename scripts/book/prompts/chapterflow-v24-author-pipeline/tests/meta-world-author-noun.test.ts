/**
 * R-286 — "the author" as a WORLD noun.
 *
 * `META_REGEXES` rejects `the author` everywhere, and that is right for the
 * sense it was written against: the book's author as the SPEAKER of the text
 * ("the author argues", "the author's memoir", "according to the author"). A
 * sidecar sentence in that sense states a fact about a document, not about the
 * world, and naming the person is always available as a repair.
 *
 * But English has a second, ordinary noun of the same shape, and the live
 * Franklin run (2026-09-04T19:51:59Z, attempt 4) died on it. Chapter 2 of the
 * Autobiography is ABOUT an anonymous writer: Franklin slid the Silence Dogood
 * essays under the printing-house door unsigned, and the Assembly gaoled James
 * Franklin for refusing to say who had written a Courant piece. Three sentences
 * of `rejected/ch02.attempt1.json`'s successor draft were rejected as
 * meta-references:
 *
 *   namedExamples[2].summary        …his brother's writer friends praised it
 *                                   without knowing the author…
 *   testableFacts[8].claim          …imprisoned James Franklin … because he
 *                                   would not name the author.
 *   testableFacts[9].becauseMechanism …reason enough to withhold the author's
 *                                   name, short of true guilt.
 *
 * (and, one attempt earlier, `namedExamples[1].teachesWhat`: "Concealing the
 * author's identity let the work be judged on its own merit…")
 *
 * Every one of those is a fact about the world, and NONE of them can be repaired
 * by naming the person — the whole point of each sentence is that the author was
 * NOT named. The validator's own remedy ("write Benjamin Franklin rather than
 * the author") makes the sentences false. The chapter had no legal move and
 * burned its attempt budget three times.
 *
 * So the carve-out is deliberately NARROW and enumerated: `the author` survives
 * only where it is the object of a naming / identity / anonymity construction.
 * It is one exported list, applied by ONE predicate, used by both routes a
 * sidecar travels — the researcher's own validator and SC4 in
 * `critics/sourceCoherence.ts` — because R-023/R-024 already recorded what
 * happens when those two disagree about what a meta-reference is.
 *
 * RED against the old code: every assertion in the first test fails, because
 * `/\bthe author\b/i` matched them all.
 */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import {
  META_REGEXES,
  WORLD_NOUN_AUTHOR_REGEXES,
  collectChapterResearchProblems,
  isWorldNounAuthorReference,
  type ChapterResearchResult,
} from "../src/agents/researcher-chapter.js";
import type { BibliographyResult } from "../src/agents/researcher-bibliography.js";
import { runSourceCoherenceCheck } from "../src/critics/sourceCoherence.js";
import { baseResult, input } from "./researchSidecarFixture.js";

const metaProblems = (problems: string[]): string[] => problems.filter((p) => p.startsWith("meta-reference"));
const verbProblems = (problems: string[]): string[] => problems.filter((p) => p.startsWith("author-surname-verb"));

/** Both routes' verdicts for one sentence placed in a narrative field. */
function bothRoutes(sentence: string, genre: BibliographyResult["genre"] = "memoir") {
  const r: ChapterResearchResult = baseResult();
  r.keyClaims[0] = sentence;
  const in_ = input("Benjamin Franklin", genre);
  const problems = collectChapterResearchProblems(r, in_);
  const report = runSourceCoherenceCheck({ bibliography: in_.bibliography, chapters: [r] });
  return {
    meta: metaProblems(problems),
    verb: verbProblems(problems),
    codes: report.findings.map((f) => f.code),
    passed: report.passed,
  };
}

/** The four sentences the live run rejected, verbatim from the run manifest. */
const LIVE_WORLD_NOUN_SENTENCES = [
  "Franklin disguised his handwriting, wrote an anonymous essay, and slid it under the printing-house door at night; his brother's writer friends praised it without knowing the author, and Franklin kept submitting pieces this way until he eventually disclosed himself.",
  "The Massachusetts Assembly imprisoned James Franklin for a month over an offending Courant piece because he would not name the author.",
  "Officials treated his bound status as an apprentice as reason enough to withhold the author's name, short of true guilt.",
  "Concealing the author's identity let the work be judged on its own merit rather than dismissed for the writer's youth.",
];

/** Sentences in the META sense: the book's author as the speaker of the text. */
const META_SENSE_SENTENCES = [
  "the author argues that a rotating duty is inherited by name.",
  "The author's memoir records the ward rota in its second half.",
  "The author recalls the price of the borrowed press.",
  "According to the author, the query is written down before the meeting.",
  "In this chapter the author introduces the handover ledger.",
];

test("R-286 (baseline): the fixture is clean on both routes, so any finding below is the mutation", () => {
  const in_ = input("Benjamin Franklin", "memoir");
  assert.deepEqual(collectChapterResearchProblems(baseResult(), in_), []);
});

test("R-286: the three live Franklin sentences pass BOTH routes", () => {
  for (const sentence of LIVE_WORLD_NOUN_SENTENCES) {
    const v = bothRoutes(sentence);
    assert.deepEqual(v.meta, [], `research validator blocked a world-noun sentence: ${sentence}`);
    assert.ok(!v.codes.includes("SC4.meta_reference"), `SC4 blocked a world-noun sentence: ${sentence}`);
    assert.equal(v.passed, true, `the research stage would abort on: ${sentence}`);
  }
});

test("R-286: the META sense of \"the author\" is still rejected on BOTH routes", () => {
  for (const sentence of META_SENSE_SENTENCES) {
    const v = bothRoutes(sentence);
    assert.ok(v.meta.length >= 1, `research validator admitted a meta-reference: ${sentence}`);
    assert.ok(v.codes.includes("SC4.meta_reference"), `SC4 admitted a meta-reference: ${sentence}`);
    assert.equal(v.passed, false, `the coherence critic must fail-closed on: ${sentence}`);
  }
});

test("R-286: the carve-out never touches the OTHER meta patterns", () => {
  for (const sentence of [
    "This chapter shows the ward rota naming one householder a night.",
    "The book returns to the Junto in its later units.",
    "Chapter 4 records the price of the borrowed press.",
    "The manuscript breaks off before the negotiation is settled.",
  ]) {
    const v = bothRoutes(sentence);
    assert.ok(v.meta.length >= 1, `research validator admitted: ${sentence}`);
    assert.ok(v.codes.includes("SC4.meta_reference"), `SC4 admitted: ${sentence}`);
  }
});

test("R-286: the author-verb guard and its memoir carve-out are untouched", () => {
  // Still blocked on a memoir (text attribution).
  for (const speaking of [
    "Franklin argues that a rotating duty is inherited by name.",
    "Franklin writes that a visible ledger makes neglect legible.",
  ]) {
    const v = bothRoutes(speaking);
    assert.equal(v.verb.length, 1, `memoir research must still block: ${speaking}`);
    assert.ok(v.codes.includes("SC5.author_surname_verb"), `memoir SC5 must still block: ${speaking}`);
  }
  // Still allowed on a memoir (worldly reading), still blocked off it.
  const worldly = "Franklin opens a printing house on Market Street with a borrowed press.";
  assert.deepEqual(bothRoutes(worldly, "memoir").verb, []);
  assert.equal(bothRoutes(worldly, "practical").verb.length, 1);
});

test("R-286: a world-noun sentence carrying a REAL meta-reference is still rejected", () => {
  // The carve-out is per-occurrence, not per-sentence: exempting "the author"
  // here must not exempt "this chapter" beside it.
  const v = bothRoutes("This chapter explains why the Assembly would not name the author.");
  assert.ok(v.meta.length >= 1, "a co-occurring meta-reference must still fire");
  assert.match(v.meta.join(" "), /this chapter/i);
  assert.ok(
    !v.meta.some((problem) => problem.startsWith('meta-reference "the author"')),
    `the carved-out occurrence must not be reported: ${JSON.stringify(v.meta)}`,
  );
});

test("R-286: the validator message TELLS the writer how to phrase the world-noun sense", () => {
  const v = bothRoutes("the author argues that a rotating duty is inherited by name.");
  const message = v.meta.join("\n");
  assert.match(message, /the author/i);
  // It names the admissible constructions, so a chapter that genuinely means the
  // unnamed writer of a piece has a legal move instead of an unwinnable retry.
  assert.match(message, /name the author/i);
  assert.match(message, /anonymous/i);
});

test("R-286: the predicate is exact about WHICH occurrence it exempts", () => {
  const text = "The Assembly would not name the author, though the author argues elsewhere for plain dealing.";
  const first = text.indexOf("the author");
  const second = text.indexOf("the author", first + 1);
  assert.equal(isWorldNounAuthorReference(text, first, "the author".length), true);
  assert.equal(isWorldNounAuthorReference(text, second, "the author".length), false);
  // It only ever speaks about "the author"; every other meta pattern is none of
  // its business.
  const bookAt = "the book closes here".indexOf("the book");
  assert.equal(isWorldNounAuthorReference("the book closes here", bookAt, "the book".length), false);
});

test("R-286: the carve-out list is bounded and every entry is anchored on \"the author\"", () => {
  assert.ok(WORLD_NOUN_AUTHOR_REGEXES.length > 0);
  assert.ok(WORLD_NOUN_AUTHOR_REGEXES.length <= 16, "an unbounded carve-out list is a hole, not a carve-out");
  for (const pattern of WORLD_NOUN_AUTHOR_REGEXES) {
    assert.match(pattern.source, /the author/, `carve-out ${pattern} is not anchored on "the author"`);
    // Dead entries are worse than missing ones: a carve-out that cannot contain
    // a `the author` occurrence exempts nothing and misleads the next reader.
    assert.ok(pattern.source.includes("the author"), `carve-out ${pattern} can never contain the guarded phrase`);
    assert.ok(pattern.flags.includes("i"), `carve-out ${pattern} must be case-insensitive`);
  }
  // The list is a carve-out FROM META_REGEXES, so the phrase it carves must be
  // one META_REGEXES actually rejects.
  assert.ok(META_REGEXES.some((pattern) => pattern.test("the author")));
});
