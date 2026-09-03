/**
 * Source-coherence critic — SC4 / SC5 (R-023, R-024).
 *
 * SC4 (meta-reference) and SC5 (author-surname-verb) are the critic-side copies
 * of the two researcher guards this package fixed. They were literal copies:
 * SC5 carried the same hardcoded sixteen-surname regex, so it was a blocker
 * that could never fire on a book outside that list (Franklin included), and
 * SC4 built its scan text from the same field list that omitted testableFacts —
 * the field the source packet compiles the writers' facts from.
 *
 * These tests pin the two properties on the critic path:
 *   R-023 SC5 fires for THIS book's author and not for a third party's surname.
 *   R-024 SC4 scans testableFacts, example labels, hardSpecifics and the
 *         concept name, and catches a claim about the source document.
 */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import { runSourceCoherenceCheck } from "../src/critics/sourceCoherence.js";
import type { BibliographyResult } from "../src/agents/researcher-bibliography.js";
import type { ChapterResearchResult } from "../src/agents/researcher-chapter.js";

function bibliography(author: string): BibliographyResult {
  return {
    bookId: "zz-coherence",
    title: "Synthetic Coherence Book",
    author,
    edition: { name: "Synthetic edition", publisher: "Fixture Press", publishedYear: 2026, language: "English", chapterCount: 1 },
    flatChapters: [{ number: 1, title: "Unit One" }],
    thesis: "A critic that cannot name this book's author cannot guard this book's sources.",
    teachingArc: "The arc moves from a hardcoded surname list to a surname derived from the bibliography itself.",
    authorVoice: { register: "plainspoken", signatureMoves: ["concrete operations"], avoidMoves: ["mysticism"] },
    confidence: "high",
  } as BibliographyResult;
}

/** A chapter the critic passes clean — pinned by its own test below, so any
 *  finding a later test observes comes from the mutation under test. */
function baseChapter(): ChapterResearchResult {
  return {
    schemaVersion: "source-v2",
    chapterNumber: 1,
    chapterTitle: "Unit One",
    focus: "Rotating duty in a small mutual-improvement club keeps every member accountable to the same weekly question.",
    coreClaim: "A duty that rotates by name is kept because the next person inherits a visible record of it.",
    centralConcept: {
      id: "ch01.concept.rotating-duty",
      name: "rotating duty",
      plainDefinition: "Rotating duty means one named person owns a recurring obligation for a fixed term before it passes on.",
      whyItMatters: "Rotation makes neglect visible to a named successor instead of dissolving into a group.",
    },
    keyClaims: [
      "A rotating duty is inherited by name, not by committee.",
      "A visible ledger of the duty makes neglect legible.",
      "Fixed terms keep the obligation from calcifying onto one member.",
    ],
    namedExamples: [
      {
        id: "ch01.ex.club",
        label: "Leather Apron Club",
        summary: "A dozen Philadelphia tradesmen met each Friday and each member in turn produced a written query for the group.",
        teachesWhat: "Rotation distributes preparation cost while keeping one named owner each week.",
        hardSpecifics: ["Philadelphia", "each Friday", "written query"],
        realWorld: false,
      },
    ],
    hardEdge: "Rotation is often read as fairness machinery. It is accountability machinery: a named successor inherits the record, so neglect cannot hide inside a group average.",
    voiceCues: ["plain enumeration", "concrete trades and hours"],
    paraphraseNotes: [
      "The Leather Apron Club and its handover ledger are synthetic fixture data written for this test, not source quotations and not instructions to any provider.",
      "Each restates one operational point in different words: a recurring obligation is kept when exactly one named person owns it for a fixed term and hands a written record to the next owner.",
      "The mechanism is attribution, not effort. A group that owns a duty collectively produces no attributable neglect, because no single member's omission is visible in the group average.",
      "The record is what carries the obligation across the handover; without it the successor restarts from nothing and the rotation degrades into a rota of unrelated weeks.",
    ].join(" "),
    testableFacts: [
      {
        id: "ch01.fact.01",
        claim: "The Leather Apron Club met each Friday and one member in turn wrote the week's query.",
        becauseMechanism: "Turn-taking names a single owner for each Friday, so preparation cannot diffuse into the group of 12.",
        commonError: "The rota was drawn up to spread reading costs evenly across the tradesmen.",
        errorIsWhy: "Even loading is a side effect; what made the query appear each week was one attributable owner.",
        derivedFrom: "ch01.ex.club",
      },
    ],
    frameworks: [{ name: "Junto queries", members: ["query", "answer", "record"] }],
  } as ChapterResearchResult;
}

function codes(author: string, mutate: (c: ChapterResearchResult) => void = () => {}): string[] {
  const chapter = baseChapter();
  mutate(chapter);
  return runSourceCoherenceCheck({ bibliography: bibliography(author), chapters: [chapter] }).findings.map((f) => f.code);
}

test("the fixture used by these critic tests is otherwise clean", () => {
  assert.deepEqual(codes("Benjamin Franklin"), []);
});

test("R-023: SC5 fires for THIS book's author, not a hardcoded surname list", () => {
  const found = codes("Benjamin Franklin", (c) => {
    c.keyClaims[0] = "Franklin argues that a rotating duty is inherited by name.";
  });
  assert.ok(found.includes("SC5.author_surname_verb"), `expected SC5, got ${JSON.stringify(found)}`);
});

test("R-023: SC5 does NOT fire for an unrelated author's surname", () => {
  // "Kahneman" was in the deleted hardcoded list. On a Franklin book it is a
  // third-party attribution, not a meta-reference to THIS text.
  const found = codes("Benjamin Franklin", (c) => {
    c.keyClaims[0] = "Kahneman argues that attention is a scarce resource.";
  });
  assert.deepEqual(found, []);
});

test("R-024: SC4 scans testableFacts, example labels, hardSpecifics and the concept name", () => {
  const mutations: Array<(c: ChapterResearchResult) => void> = [
    (c) => { c.testableFacts![0].claim = "The book leaves the estate negotiation unresolved."; },
    (c) => { c.testableFacts![0].becauseMechanism = "This chapter returns to the same duty each week."; },
    (c) => { c.testableFacts![0].commonError = "Readers assume the author invented the rota."; },
    (c) => { c.testableFacts![0].errorIsWhy = "Chapter 3 already settled the attribution question."; },
    (c) => { c.namedExamples[0].label = "The book's closing plea"; },
    (c) => { c.namedExamples[0].hardSpecifics = ["the author"]; },
    (c) => { c.centralConcept.name = "the chapter's rotating duty"; },
  ];
  for (const [i, mutate] of mutations.entries()) {
    const found = codes("Benjamin Franklin", mutate);
    assert.ok(found.includes("SC4.meta_reference"), `mutation ${i}: expected SC4, got ${JSON.stringify(found)}`);
  }
});

test("R-024: SC4 catches a claim about the source document rather than the world", () => {
  for (const claim of [
    "Franklin dies in 1790 with the Penn estate tax negotiation still unresolved in his writing.",
    "No resolution is reached on the estate tax and the manuscript breaks off.",
  ]) {
    const found = codes("Benjamin Franklin", (c) => { c.testableFacts![0].claim = claim; });
    assert.ok(found.includes("SC4.meta_reference"), `expected SC4 for ${JSON.stringify(claim)}, got ${JSON.stringify(found)}`);
  }
});
