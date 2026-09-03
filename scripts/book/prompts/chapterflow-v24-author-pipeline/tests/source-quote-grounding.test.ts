/**
 * WP source-ingestion (R-046, R-049, R-050, R-051, R-052, R-056, R-058, R-282).
 *
 * With the chapter's span in hand, every checkable item the researcher emits must
 * carry a `sourceQuote` that is verbatim in that span. These tests pin:
 *   - what counts as grounded, per item kind;
 *   - that a hardSpecific must itself occur in the source (R-049's external
 *     signal) and must keep the proposition it belongs to (R-056);
 *   - that a predicate fragment or an unbalanced quotation opening is rejected as
 *     a hardSpecific and routed to the `quotations` channel instead (R-051/R-282);
 *   - that an item which cannot be quoted is DROPPED, never fabricated (R-052);
 *   - that the floors scale with the span (R-058);
 *   - and that WITHOUT a span every one of these checks is inert.
 */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import {
  MAX_ITEM_QUOTE_ATTEMPTS,
  collectSourceQuoteProblems,
  dropUngroundedItems,
  researchFloorsForSpan,
} from "../src/source/sourceQuoteGrounding.js";
import { collectHardSpecificShapeProblems } from "../src/agents/researcher-chapter.js";
import type { ChapterResearchResult } from "../src/agents/researcher-chapter.js";

const SPAN = [
  "My whole stock of cash consisted of a Dutch dollar, and about a shilling in copper.",
  "He gave me, accordingly, three great puffy rolls. I was surpriz'd at the quantity, but took it.",
  "In 1736 I form'd most of my ingenious acquaintance into a club of mutual improvement, which we called the Junto.",
  "I think I like a speckled ax best, said the man who turned the grindstone.",
].join("\n\n");

function baseResult(): ChapterResearchResult {
  return {
    schemaVersion: "source-v2",
    chapterNumber: 1,
    chapterTitle: "Arrival in Philadelphia",
    focus: "f".repeat(60),
    coreClaim: "c".repeat(40),
    centralConcept: { id: "ch01.concept.a", name: "n", plainDefinition: "d".repeat(50), whyItMatters: "w".repeat(40) },
    keyClaims: ["k1", "k2", "k3", "k4"],
    namedExamples: [
      {
        id: "ch01.case.rolls",
        label: "The three puffy rolls",
        summary: "A newly arrived printer buys bread with almost no money and is handed three great puffy rolls.",
        teachesWhat: "Small resources set the scene",
        hardSpecifics: ["three great puffy rolls", "Dutch dollar"],
        realWorld: true,
        sourceQuote: "He gave me, accordingly, three great puffy rolls.",
        hardSpecificEvidence: [
          { specific: "three great puffy rolls", proposition: "The baker hands over three great puffy rolls.", sourceQuote: "He gave me, accordingly, three great puffy rolls." },
          { specific: "Dutch dollar", proposition: "The whole stock of cash is a Dutch dollar and a shilling in copper.", sourceQuote: "My whole stock of cash consisted of a Dutch dollar, and about a shilling in copper." },
        ],
      },
    ],
    hardEdge: "h".repeat(90),
    voiceCues: ["a", "b"],
    paraphraseNotes: "p".repeat(700),
    testableFacts: [
      {
        id: "ch01.fact.1",
        claim: "The Junto was formed in 1736 as a club of mutual improvement.",
        becauseMechanism: "Because a standing club creates a repeated occasion for improvement.",
        commonError: "Assuming it was a printing partnership.",
        errorIsWhy: "It was a discussion club, not a business.",
        sourceQuote: "In 1736 I form'd most of my ingenious acquaintance into a club of mutual improvement",
      },
    ],
  };
}

function keys(problems: ReturnType<typeof collectSourceQuoteProblems>): string[] {
  return problems.map((p) => p.itemKey).sort();
}

// ── grounded / ungrounded ─────────────────────────────────────────────────────

test("R-046: a fully quoted sidecar produces no grounding problems", () => {
  assert.deepEqual(collectSourceQuoteProblems(baseResult(), SPAN), []);
});

test("R-046: a fact whose sourceQuote is absent is reported by item id", () => {
  const r = baseResult();
  delete (r.testableFacts![0] as { sourceQuote?: string }).sourceQuote;
  const problems = collectSourceQuoteProblems(r, SPAN);
  assert.deepEqual(keys(problems), ["fact:ch01.fact.1"]);
  assert.match(problems[0].message, /ch01\.fact\.1/);
  assert.match(problems[0].message, /sourceQuote/);
});

test("R-046: a fact whose sourceQuote is NOT in the span is reported (a recalled paraphrase is not a quote)", () => {
  const r = baseResult();
  r.testableFacts![0].sourceQuote = "In 1727 I founded a club of mutual improvement called the Junto";
  const problems = collectSourceQuoteProblems(r, SPAN);
  assert.deepEqual(keys(problems), ["fact:ch01.fact.1"]);
  assert.match(problems[0].message, /not a verbatim substring/);
});

test("R-046: a case whose summary carries no quote is reported", () => {
  const r = baseResult();
  delete (r.namedExamples[0] as { sourceQuote?: string }).sourceQuote;
  assert.deepEqual(keys(collectSourceQuoteProblems(r, SPAN)), ["case:ch01.case.rolls"]);
});

test("R-049: a hardSpecific that does not occur in the source text is reported (the external realness signal)", () => {
  const r = baseResult();
  r.namedExamples[0].hardSpecifics = ["three great puffy rolls", "Leather Apron Club"];
  r.namedExamples[0].hardSpecificEvidence![1] = {
    specific: "Leather Apron Club",
    proposition: "The club was known as the Leather Apron Club.",
    sourceQuote: "In 1736 I form'd most of my ingenious acquaintance into a club of mutual improvement",
  };
  const problems = collectSourceQuoteProblems(r, SPAN);
  assert.deepEqual(keys(problems), ["specific:ch01.case.rolls#1"]);
  assert.match(problems[0].message, /does not occur in this chapter's source text/);
});

test("R-056: a hardSpecific with no proposition is reported — a bare token can be re-attached to a false claim", () => {
  const r = baseResult();
  r.namedExamples[0].hardSpecificEvidence![1] = {
    specific: "Dutch dollar",
    proposition: "   ",
    sourceQuote: "My whole stock of cash consisted of a Dutch dollar, and about a shilling in copper.",
  };
  const problems = collectSourceQuoteProblems(r, SPAN);
  assert.deepEqual(keys(problems), ["specific:ch01.case.rolls#1"]);
  assert.match(problems[0].message, /proposition/);
});

test("R-282: a quotation must be verbatim AND its attribution frame must contain it", () => {
  const r = baseResult();
  r.quotations = [
    { id: "ch01.quote.1", quote: "I think I like a speckled ax best", attributionFrame: 'The man at the grindstone answers, "I think I like a speckled ax best."' },
  ];
  assert.deepEqual(collectSourceQuoteProblems(r, SPAN), []);

  r.quotations[0].attributionFrame = "The man at the grindstone gives up on polishing.";
  const problems = collectSourceQuoteProblems(r, SPAN);
  assert.deepEqual(keys(problems), ["quotation:ch01.quote.1"]);
  assert.match(problems[0].message, /attributionFrame/);
});

test("R-050: the model-memory path is inert — no span means no grounding problems at all", () => {
  const r = baseResult();
  delete (r.testableFacts![0] as { sourceQuote?: string }).sourceQuote;
  delete (r.namedExamples[0] as { sourceQuote?: string }).sourceQuote;
  r.namedExamples[0].hardSpecifics = ["Leather Apron Club", "speckled Ax is best"];
  assert.deepEqual(collectSourceQuoteProblems(r, null), []);
});

// ── abstention (R-052) ────────────────────────────────────────────────────────

test("R-052: an unquotable item is DROPPED, never fabricated, and the drop is recorded", () => {
  const r = baseResult();
  r.testableFacts![0].sourceQuote = "a claim that appears nowhere in the source";
  const problems = collectSourceQuoteProblems(r, SPAN);
  const dropped = dropUngroundedItems(r, problems, MAX_ITEM_QUOTE_ATTEMPTS);
  assert.equal(dropped.result.testableFacts!.length, 0, "the unquotable fact must be gone, not repaired");
  assert.equal(dropped.dropped.length, 1);
  assert.equal(dropped.dropped[0].id, "ch01.fact.1");
  assert.equal(dropped.dropped[0].kind, "fact");
  assert.equal(dropped.dropped[0].attempts, MAX_ITEM_QUOTE_ATTEMPTS);
  assert.match(dropped.dropped[0].reason, /not a verbatim substring/);
  assert.deepEqual(dropped.result.droppedItems, dropped.dropped);
});

test("R-052: dropping a specific below the two-per-case floor drops the whole case and clears dangling references", () => {
  const r = baseResult();
  r.namedExamples[0].hardSpecificEvidence![1].sourceQuote = "nowhere in the source at all, not one word of it";
  r.testableFacts![0].derivedFrom = "ch01.case.rolls";
  const problems = collectSourceQuoteProblems(r, SPAN);
  const dropped = dropUngroundedItems(r, problems, MAX_ITEM_QUOTE_ATTEMPTS);
  assert.equal(dropped.result.namedExamples.length, 0, "a case with one surviving specific cannot satisfy the >=2 floor");
  assert.ok(dropped.dropped.some((d) => d.kind === "case" && d.id === "ch01.case.rolls"));
  assert.equal(dropped.result.testableFacts![0].derivedFrom, undefined, "a fact must not point at a dropped case");
});

test("R-052: dropping is a pure function — the input result is not mutated", () => {
  const r = baseResult();
  r.testableFacts![0].sourceQuote = "not in the source";
  const before = JSON.stringify(r);
  dropUngroundedItems(r, collectSourceQuoteProblems(r, SPAN), MAX_ITEM_QUOTE_ATTEMPTS);
  assert.equal(JSON.stringify(r), before);
});

// ── R-058 span-scaled floors ──────────────────────────────────────────────────

test("R-058: floors scale with span length, and a normal chapter keeps today's floors exactly", () => {
  const normal = researchFloorsForSpan(20_000);
  assert.deepEqual(normal, { units: 1, testableFacts: 9, namedExamples: 3, keyClaims: 4 });
  // A "Part" covering a quarter of a memoir asks for proportionally more evidence.
  const part = researchFloorsForSpan(110_000);
  assert.equal(part.units, 2);
  assert.equal(part.testableFacts, 18);
  assert.equal(part.namedExamples, 6);
  // The cap holds: one research call still returns one JSON object.
  assert.equal(researchFloorsForSpan(400_000).units, 2);
  // Absent span ⇒ today's floors, unchanged.
  assert.deepEqual(researchFloorsForSpan(null), { units: 1, testableFacts: 9, namedExamples: 3, keyClaims: 4 });
});

// ── R-051 / R-282 hardSpecific shape ──────────────────────────────────────────

test("R-051: a hardSpecific containing a finite verb is rejected and pointed at the quotations channel", () => {
  const problems = collectHardSpecificShapeProblems([
    { label: "Speckled axe", hardSpecifics: ["speckled Ax is best", "three puffy rolls"] },
  ] as ChapterResearchResult["namedExamples"]);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /speckled Ax is best/);
  assert.match(problems[0], /quotations/);
});

test("R-282: an unbalanced quotation opening is rejected as a hardSpecific", () => {
  const problems = collectHardSpecificShapeProblems([
    { label: "Prayer", hardSpecifics: ['"O powerful Goodness'] },
  ] as ChapterResearchResult["namedExamples"]);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /quotation/i);
});

test("R-051: ordinary noun-phrase specifics are admissible (no false positives on the shipped shapes)", () => {
  assert.deepEqual(
    collectHardSpecificShapeProblems([
      {
        label: "ok",
        hardSpecifics: [
          "three puffy rolls",
          "one Dutch dollar",
          "Market Street",
          "300 to 850 scale",
          "1% per day",
          "Union Fire Company",
          "a speckled ax",
        ],
      },
    ] as ChapterResearchResult["namedExamples"]),
    [],
  );
});

// ── ROUND 3, minor: what the hardSpecific token check ACTUALLY covers ────────
//
// The PR body's R-046 table said "a `realWorld` hardSpecific must occur verbatim
// in the chapter's own source text". The check is WIDER than that: it runs over
// every named example's hardSpecifics regardless of `realWorld`, unlike
// buildSourceTextVerifyRecord and verifiableItems, which both skip
// realWorld:false. That is deliberate and stricter, and it is the right way
// round — a named conceptual device whose token is not on the page is exactly as
// ungroundable as an invented person, and "Leather Apron Club" (zero occurrences
// in the Autobiography) would have been declarable realWorld:false to escape.
// Pinned here so the behaviour is stated where it is enforced, and so a later
// edit that narrows it to realWorld:true has to face this test.

test("R-049 (round 3): the hardSpecific token check covers realWorld:FALSE examples too, which the record-builder skips", () => {
  const offPage = (realWorld: boolean): ChapterResearchResult => {
    const r = baseResult();
    r.namedExamples = [{
      ...r.namedExamples[0],
      id: "ch01.case.device",
      label: "The mutual-improvement device",
      realWorld,
      hardSpecifics: ["Leather Apron Club"],
      hardSpecificEvidence: [
        { specific: "Leather Apron Club", proposition: "The club of mutual improvement is named.", sourceQuote: "In 1736 I form'd most of my ingenious acquaintance into a club of mutual improvement, which we called the Junto." },
      ],
    }] as ChapterResearchResult["namedExamples"];
    return r;
  };

  for (const realWorld of [true, false]) {
    const problems = collectSourceQuoteProblems(offPage(realWorld), SPAN)
      .filter((p) => p.message.includes("SV2.specific_not_in_source"));
    assert.equal(problems.length, 1, `realWorld=${realWorld}: an off-page token must be caught either way`);
    assert.match(problems[0].message, /Leather Apron Club/);
  }

  // And a token that IS on the page passes on both settings, so the check is
  // about the page and not about the flag.
  for (const realWorld of [true, false]) {
    const onPage = offPage(realWorld);
    onPage.namedExamples[0].hardSpecifics = ["club of mutual improvement"];
    onPage.namedExamples[0].hardSpecificEvidence = [
      { specific: "club of mutual improvement", proposition: "The club of mutual improvement is named.", sourceQuote: "In 1736 I form'd most of my ingenious acquaintance into a club of mutual improvement, which we called the Junto." },
    ];
    assert.deepEqual(
      collectSourceQuoteProblems(onPage, SPAN).filter((p) => p.message.includes("SV2.specific_not_in_source")),
      [],
      `realWorld=${realWorld}: an on-page token must pass`,
    );
  }
});
