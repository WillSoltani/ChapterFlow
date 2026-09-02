/**
 * Researcher chapter-sidecar guards (R-023, R-024, R-025, R-034).
 *
 * The chapter validator is the only thing standing between a model-minted
 * sidecar and every downstream writer, because no downstream agent ever sees
 * the book. These tests pin four properties the Phase-A audit found broken on
 * the released Franklin book:
 *
 *  R-023 the author-verb guard must be derived from THIS book's author, not a
 *        hardcoded surname list that happens to omit the author in hand.
 *  R-024 the meta-reference guard must scan testableFacts, example labels and
 *        hardSpecifics — narrative fields the packet carries to writers.
 *  R-025 one attempt must report EVERY distinct meta hit, so a single retry can
 *        fix them all rather than burning the 3-attempt budget one hit at a time.
 *  R-034 the .txt sidecar (what source-loader.ts and the BP6 pattern audit read)
 *        must carry hardSpecifics, testableFacts and frameworks.
 */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import {
  authorSurnames,
  collectChapterResearchProblems,
  renderChapterSidecar,
  type ChapterResearchInput,
  type ChapterResearchResult,
} from "../src/agents/researcher-chapter.js";
import type { BibliographyResult } from "../src/agents/researcher-bibliography.js";

function bibliography(author: string): BibliographyResult {
  return {
    bookId: "zz-guards",
    title: "Synthetic Guard Book",
    author,
    edition: { name: "Synthetic edition", publisher: "Fixture Press", publishedYear: 2026, language: "English", chapterCount: 1 },
    flatChapters: [{ number: 1, title: "Unit One" }],
    thesis: "A validator that cannot name this book's author cannot guard this book's sidecars.",
    teachingArc: "The arc moves from a hardcoded surname list to a surname derived from the bibliography itself.",
    authorVoice: { register: "plainspoken", signatureMoves: ["concrete operations", "short causal chains", "explicit tradeoffs"], avoidMoves: ["mysticism"] },
    confidence: "high",
  } as BibliographyResult;
}

/** A structurally VALID chapter result, so any problem a test observes comes
 *  from the guard under test rather than from unrelated shape complaints. */
function baseResult(): ChapterResearchResult {
  return {
    chapterNumber: 1,
    chapterTitle: "Unit One",
    focus: "Rotating duty in a small mutual-improvement club keeps every member accountable to the same weekly question.",
    coreClaim: "A duty that rotates by name is kept because the next person inherits a visible record of it.",
    centralConcept: {
      name: "rotating duty",
      plainDefinition: "Rotating duty means one named person owns a recurring obligation for a fixed term before it passes on.",
      whyItMatters: "Rotation makes neglect visible to a named successor instead of dissolving into a group.",
    },
    keyClaims: [
      "A rotating duty is inherited by name, not by committee.",
      "A visible ledger of the duty makes neglect legible.",
      "Fixed terms keep the obligation from calcifying onto one member.",
      "Named succession turns an abstract obligation into a personal handover.",
    ],
    namedExamples: [{
      label: "Leather Apron Club",
      summary: "A dozen Philadelphia tradesmen met each Friday and each member in turn produced a written query for the group.",
      teachesWhat: "Rotation distributes preparation cost while keeping one named owner each week.",
      hardSpecifics: ["Philadelphia", "each Friday", "written query"],
      realWorld: true,
    }],
    hardEdge: "Rotation is often read as fairness machinery. It is accountability machinery: the point is that a named successor inherits the record, so neglect cannot hide inside a group average.",
    voiceCues: ["plain enumeration", "concrete trades and hours"],
    paraphraseNotes: Array.from({ length: 90 }, (_, i) => `token-${i} evidence-${i} restart-${i} claim-${i} handover-${i}`).join(" "),
    testableFacts: [{
      id: "ch01.fact.01",
      claim: "A rotating weekly query was produced by each member in turn.",
      becauseMechanism: "Turn-taking assigns one named owner per meeting, so preparation cannot diffuse across the group.",
      commonError: "Rotation exists so that no single member is overburdened.",
      errorIsWhy: "Load-sharing is a side effect; the mechanism that makes rotation work is single-owner accountability.",
    }],
    frameworks: [{ name: "Junto queries", members: ["query", "answer", "record"] }],
  };
}

function input(author: string): ChapterResearchInput {
  return { bibliography: bibliography(author), chapter: { number: 1, title: "Unit One" } };
}

const metaProblems = (problems: string[]): string[] => problems.filter((p) => p.startsWith("meta-reference"));
const verbProblems = (problems: string[]): string[] => problems.filter((p) => p.startsWith("author-surname-verb"));

// ── R-023 ────────────────────────────────────────────────────────────────────

test("R-023: authorSurnames derives the surname from a full author name", () => {
  assert.deepEqual(authorSurnames("Benjamin Franklin"), ["franklin"]);
  assert.deepEqual(authorSurnames("Nassim Nicholas Taleb"), ["taleb"]);
  assert.deepEqual(authorSurnames("Chip Heath and Dan Heath"), ["heath"]);
  assert.deepEqual(authorSurnames("Martin Luther King, Jr."), ["king"]);
  assert.deepEqual(authorSurnames(""), []);
});

test("R-023: the author-verb guard fires for THIS book's author, not a hardcoded list", () => {
  const r = baseResult();
  r.keyClaims[0] = "Franklin argues that a rotating duty is inherited by name.";
  const problems = collectChapterResearchProblems(r, input("Benjamin Franklin"));
  assert.equal(verbProblems(problems).length, 1, `expected one author-verb problem, got ${JSON.stringify(problems)}`);
  assert.match(verbProblems(problems)[0], /Franklin argues/);
});

test("R-023: the author-verb guard does NOT fire for an unrelated author's surname", () => {
  const r = baseResult();
  // "Kahneman" is a surname from the deleted hardcoded list. On a Franklin book
  // it is a third-party attribution, not a meta-reference to THIS text.
  r.keyClaims[0] = "Kahneman argues that attention is a scarce resource.";
  const problems = collectChapterResearchProblems(r, input("Benjamin Franklin"));
  assert.deepEqual(verbProblems(problems), []);
});

// ── R-024 ────────────────────────────────────────────────────────────────────

test("R-024: the meta-reference guard scans every testableFacts field", () => {
  const fields = ["claim", "becauseMechanism", "commonError", "errorIsWhy"] as const;
  for (const field of fields) {
    const r = baseResult();
    r.testableFacts![0][field] = "The book leaves the estate negotiation unresolved.";
    const problems = collectChapterResearchProblems(r, input("Benjamin Franklin"));
    assert.ok(
      metaProblems(problems).length > 0,
      `expected a meta-reference problem for testableFacts[0].${field}, got ${JSON.stringify(problems)}`,
    );
  }
});

test("R-024: the meta-reference guard scans example labels, hardSpecifics and the concept name", () => {
  for (const mutate of [
    (r: ChapterResearchResult) => { r.namedExamples[0].label = "The book's closing plea"; },
    (r: ChapterResearchResult) => { r.namedExamples[0].hardSpecifics = ["chapter 4", "each Friday"]; },
    (r: ChapterResearchResult) => { r.centralConcept.name = "the author's rotating duty"; },
  ]) {
    const r = baseResult();
    mutate(r);
    const problems = collectChapterResearchProblems(r, input("Benjamin Franklin"));
    assert.ok(metaProblems(problems).length > 0, `expected a meta-reference problem, got ${JSON.stringify(problems)}`);
  }
});

// ── R-025 ────────────────────────────────────────────────────────────────────

test("R-025: one attempt reports every DISTINCT meta-reference, not only the first", () => {
  const r = baseResult();
  r.focus = "This chapter explains why a rotating duty is inherited by name in a small club.";
  r.coreClaim = "The author records the duty in a ledger the next member inherits.";
  r.hardEdge = "The book is often read as fairness machinery. It is accountability machinery, because a named successor inherits the record and neglect cannot hide.";
  const found = metaProblems(collectChapterResearchProblems(r, input("Benjamin Franklin")));
  const joined = found.join(" | ").toLowerCase();
  for (const phrase of ["this chapter", "the author", "the book"]) {
    assert.ok(joined.includes(`"${phrase}"`), `expected "${phrase}" to be reported; got ${JSON.stringify(found)}`);
  }
});

test("R-025: a repeated meta-reference is reported once and the report is capped", () => {
  const r = baseResult();
  r.keyClaims = r.keyClaims.map(() => "The author repeats the same phrase in every claim.");
  const found = metaProblems(collectChapterResearchProblems(r, input("Benjamin Franklin")));
  assert.equal(found.length, 1, `expected one deduped problem, got ${JSON.stringify(found)}`);
});

test("R-025: every distinct author-verb construction is reported, not only the first", () => {
  const r = baseResult();
  r.keyClaims[0] = "Franklin argues that a rotating duty is inherited by name.";
  r.keyClaims[1] = "Franklin writes that a visible ledger makes neglect legible.";
  const found = verbProblems(collectChapterResearchProblems(r, input("Benjamin Franklin")));
  assert.equal(found.length, 2, `expected both constructions, got ${JSON.stringify(found)}`);
});

// ── R-034 ────────────────────────────────────────────────────────────────────

test("R-034: the .txt sidecar carries hardSpecifics, testableFacts and frameworks", () => {
  const rendered = renderChapterSidecar(baseResult());
  assert.match(rendered, /written query/, "hardSpecifics missing from the .txt sidecar");
  assert.match(rendered, /A rotating weekly query was produced by each member in turn\./, "testableFacts claim missing");
  assert.match(rendered, /Turn-taking assigns one named owner per meeting/, "testableFacts becauseMechanism missing");
  assert.match(rendered, /Rotation exists so that no single member is overburdened\./, "testableFacts commonError missing");
  assert.match(rendered, /Load-sharing is a side effect/, "testableFacts errorIsWhy missing");
  assert.match(rendered, /Junto queries/, "frameworks missing");
});
