/**
 * WP source-ingestion — the research RULES (R-050, R-053, R-054, R-055, R-056).
 *
 * These pin the contract the researcher is held to, and the two redesigned
 * guards. Each redesign states what it now catches and what it stops blocking.
 */

import assert from "node:assert/strict";
import { readFileSync } from "fs";
import { resolve } from "path";

import { test } from "./harness.js";
import { PIPELINE_DIR } from "./helpers.js";
import { authorVerbRegexes, buildUserPrompt, type ChapterResearchInput } from "../src/agents/researcher-chapter.js";
import { BIBLIOGRAPHY_GENRES, type BibliographyResult } from "../src/agents/researcher-bibliography.js";
import { evaluateSourceV2Integrity } from "../src/source/sourceIntegrity.js";
import { compileSourcePacketFromSidecar } from "../src/compiler/sourcePacket.js";
import { writerPacketProjection, PROJECTED_SOURCE_QUOTE_CHARS } from "../src/compiler/sourcePacketProjection.js";
import type { SourceSidecarV2 } from "../src/source/sidecarSchema.js";
import type { ChapterSpec } from "../src/generateChapter.js";

const CHAPTER_PROMPT = readFileSync(resolve(PIPELINE_DIR, "prompts", "researcher-chapter.system.md"), "utf8");

// ── R-054: the system prompt carries no other book's content ─────────────────

test("R-054: the research system prompt contains no other book's cast, numbers or thesis", () => {
  // Every token below appeared in the shipped prompt and belongs to ONE book
  // (Atomic Habits): the "Good paraphraseNotes" exemplar was a full paragraph of
  // its chapter 1, and rules 3, 5 and 12 each quoted it again. The measured
  // consequence is in the register: every Franklin paraphraseNotes followed that
  // mold — one template per project, closing with a practical rule.
  const leaked = [
    "Brailsford",
    "British Cycling",
    "1% per day",
    "90 seconds",
    "Atomic Habits",
    "identity-based habits",
    "Clear argues",
    "Kahneman",
    "Taleb",
  ].filter((token) => CHAPTER_PROMPT.includes(token));
  assert.deepEqual(leaked, [], `one book's content is still installed as the universal default: ${leaked.join(", ")}`);
  // And the replacement is schematic, not a second book's worth of content.
  assert.match(CHAPTER_PROMPT, /These are SHAPES, not content\./);
  assert.match(CHAPTER_PROMPT, /<Concrete claim with its mechanism/);
});

// ── R-050: paraphrase and verbatim are scoped, not contradictory ─────────────

test("R-050: the prompt scopes paraphrase to prose fields and verbatim to the quote fields", () => {
  assert.doesNotMatch(CHAPTER_PROMPT, /Paraphrase only, never verbatim/);
  const rule1 = CHAPTER_PROMPT.match(/1\. \*\*([^*]+)\*\*([^\n]*)/);
  assert.ok(rule1);
  assert.match(rule1![0], /Paraphrase in the PROSE fields; quote in the QUOTE fields/);
  assert.match(rule1![0], /`hardSpecifics`, `quotations\[\]\.quote` and every `sourceQuote` are the opposite/);
  // The quotability test the register asked for.
  assert.match(CHAPTER_PROMPT, /If you cannot reproduce the sentence AROUND it from the source, it is not a source token/);
});

test("R-050 (register claim REFUTED): SC6 never scanned hardSpecifics, so no exemption was needed", () => {
  // The register's proposed fix included "Exempt hardSpecifics from SC6". The
  // code disagrees: SC6 reads ch.paraphraseNotes and nothing else, so a quoted
  // hardSpecific could never have tripped it. Pinned so a future edit that
  // widens SC6 has to face this deliberately.
  const critic = readFileSync(resolve(PIPELINE_DIR, "src", "critics", "sourceCoherence.ts"), "utf8");
  const sc6 = critic.slice(critic.indexOf("// SC6"), critic.indexOf("// SC7"));
  assert.match(sc6, /ch\.paraphraseNotes\?\.match\(QUOTED_LONG_SPAN\)/);
  assert.doesNotMatch(sc6, /hardSpecifics/);
});

// ── R-053: the memoir carve-out ──────────────────────────────────────────────

test("R-053 REDESIGN: on a memoir the author-verb guard keeps the speaking verbs and drops the two worldly ones", () => {
  const hits = (text: string, genre?: BibliographyResult["genre"]) =>
    authorVerbRegexes("Benjamin Franklin", genre).some((pattern) => {
      pattern.lastIndex = 0;
      return pattern.test(text);
    });

  // WHAT IT STILL CATCHES, on a memoir: every construction that makes the sidecar
  // a statement about a text rather than about the world.
  for (const speaking of ["Franklin argues that thrift compounds", "Franklin writes about the fire company", "Franklin claims a share", "Franklin notes the price", "Franklin observes the tide", "Franklin says so", "Franklin explains the stove", "Franklin points out the cost"]) {
    assert.equal(hits(speaking, "memoir"), true, `memoir guard must still catch: ${speaking}`);
  }
  // WHAT IT STOPS BLOCKING, on a memoir only: the two verbs whose ordinary
  // reading has the author as an actor in the world. R-053 measured the cost of
  // banning them — ch03's paraphraseNotes went fully agentless and the shipped
  // chapter never named Franklin once.
  assert.equal(hits("Franklin opens a printing house on Market Street", "memoir"), false);
  assert.equal(hits("Franklin introduces the lightning rod", "memoir"), false);
  // Every other genre is byte-for-byte unchanged: both are still blocked.
  assert.equal(hits("Franklin opens a printing house on Market Street"), true);
  assert.equal(hits("Franklin introduces the lightning rod", "practical"), true);
});

test("R-053: the prompt states the carve-out and names the defect it replaces", () => {
  assert.match(CHAPTER_PROMPT, /Memoir carve-out/);
  assert.match(CHAPTER_PROMPT, /the author is the SUBJECT of the book/);
  assert.match(CHAPTER_PROMPT, /An agentless passive is a defect in that genre/);
});

test("R-053: a memoir sidecar that never names its subject raises an ADVISORY, and only for a memoir", () => {
  const sidecar = {
    schemaVersion: "source-v2",
    chapterNumber: 3,
    chapterTitle: "Public Services",
    centralConcept: { id: "ch03.concept.a", name: "civic subscription", plainDefinition: "Money pooled by subscription to fund a shared service." },
    keyClaims: ["Pooling money is proposed."],
    namedExamples: [{ id: "ch03.case.1", label: "A fire company", summary: "A fire company is organized by subscription.", hardSpecifics: ["thirty members", "leathern buckets"], realWorld: true }],
    hardEdge: "e",
    testableFacts: [{ id: "ch03.fact.1", claim: "A fire company is organized by subscription.", becauseMechanism: "b", commonError: "c", errorIsWhy: "d" }],
  } as unknown as SourceSidecarV2;
  const memoir = evaluateSourceV2Integrity(sidecar, { chapterNumber: 3, genre: "memoir", authorSurnames: ["franklin"] });
  const finding = memoir.findings.find((f) => f.checkId === "SV2.memoir_subject_absent");
  assert.ok(finding, "a memoir chapter with its subject written out must be surfaced");
  assert.equal(finding!.severity, "advisory", "ADVISORY on purpose: a memoir chapter can legitimately be about other people");

  // Unclassified or non-memoir books never see it.
  assert.equal(evaluateSourceV2Integrity(sidecar, { chapterNumber: 3, authorSurnames: ["franklin"] }).findings.some((f) => f.checkId === "SV2.memoir_subject_absent"), false);
  assert.equal(evaluateSourceV2Integrity(sidecar, { chapterNumber: 3, genre: "practical", authorSurnames: ["franklin"] }).findings.some((f) => f.checkId === "SV2.memoir_subject_absent"), false);
  // And a memoir that DOES name him does not.
  const named = JSON.parse(JSON.stringify(sidecar));
  named.testableFacts[0].claim = "Franklin organized the Union Fire Company by subscription.";
  assert.equal(evaluateSourceV2Integrity(named, { chapterNumber: 3, genre: "memoir", authorSurnames: ["franklin"] }).findings.some((f) => f.checkId === "SV2.memoir_subject_absent"), false);
});

test("R-053: genre is a validated bibliography field, not a hardcoded title list", () => {
  assert.deepEqual([...BIBLIOGRAPHY_GENRES], ["memoir", "narrative-nonfiction", "practical", "argument", "reference"]);
  const bibliographyPrompt = readFileSync(resolve(PIPELINE_DIR, "prompts", "researcher-bibliography.system.md"), "utf8");
  assert.match(bibliographyPrompt, /"memoir" whenever the AUTHOR is the SUBJECT of the book/);
});

// ── R-055 / R-056 / R-046: what reaches the writer ───────────────────────────

function quotedSidecar(): SourceSidecarV2 {
  const facts = Array.from({ length: 9 }, (_, i) => ({
    id: `ch01.fact.${i + 1}`,
    claim: `Checkable claim ${i + 1} about the Union Fire Company.`,
    becauseMechanism: `Because the company kept a roster, claim ${i + 1} can be checked.`,
    commonError: `Assuming claim ${i + 1} is later invention.`,
    errorIsWhy: `The roster records it.`,
    sourceQuote: `The company was formed in seventeen thirty-six with thirty members, and claim ${i + 1} follows from its roster which the account reproduces in full for the reader.`,
  }));
  return {
    schemaVersion: "source-v2",
    chapterNumber: 1,
    chapterTitle: "Public Services",
    centralConcept: { id: "ch01.concept.a", name: "subscription", plainDefinition: "Money pooled by subscription to fund a shared service." },
    keyClaims: ["Pooled money buys a shared service.", "A roster makes membership checkable.", "Thirty members is the founding number.", "Buckets and bags are the required kit.", "The idea spread to other companies.", "The company outlived its founders.", "A seventh claim that must be cut by the projection cap."],
    namedExamples: [{
      id: "ch01.case.1",
      label: "Union Fire Company",
      summary: "Thirty men agreed to keep buckets and bags in order and to meet monthly.",
      hardSpecifics: ["thirty members", "leathern buckets"],
      realWorld: true,
      sourceQuote: "Each member kept two leathern buckets and four bags in good order at home, ready for any alarm of fire in the neighbourhood.",
      hardSpecificEvidence: [
        { specific: "thirty members", proposition: "The company was founded with thirty members.", sourceQuote: "The company was formed in seventeen thirty-six with thirty members." },
        { specific: "leathern buckets", proposition: "Each member kept two leathern buckets at home.", sourceQuote: "Each member kept two leathern buckets and four bags in good order at home." },
      ],
    }],
    hardEdge: "A reader concludes the company fought fires; it mostly prevented them by keeping kit ready.",
    paraphraseNotes: "n",
    testableFacts: facts,
    sourceProvenance: "source-text",
  } as unknown as SourceSidecarV2;
}

test("R-055: the packet and the writer card carry the chapter's thesis, marked READ-ONLY", () => {
  const chapter: ChapterSpec = { chapterId: "b-ch01", chapterNumber: 1, chapterTitle: "Public Services" };
  const sidecar = { ...quotedSidecar(), focus: "The chapter establishes that a shared risk can be funded by subscription before any authority orders it.", coreClaim: "Subscription funds a service that no one household can buy alone." } as unknown as SourceSidecarV2;
  const packet = compileSourcePacketFromSidecar({ bookId: "b", chapter, sidecar });
  assert.equal(packet.chapterContext?.coreClaim, "Subscription funds a service that no one household can buy alone.");
  assert.equal(packet.chapterContext?.keyClaims.length, 7);
  const projection = writerPacketProjection(packet);
  assert.equal(projection.chapterContext?.focus, sidecar.focus as unknown as string);
  assert.equal(projection.chapterContext?.keyClaims?.length, 6, "the card takes the thesis, not the tail");
  assert.equal(projection.sourceProvenance, "source-text");
});

test("R-046: the writer card carries the book's own words behind each fact and case, bounded", () => {
  const chapter: ChapterSpec = { chapterId: "b-ch01", chapterNumber: 1, chapterTitle: "Public Services" };
  const packet = compileSourcePacketFromSidecar({ bookId: "b", chapter, sidecar: quotedSidecar() });
  const projection = writerPacketProjection(packet);
  assert.match(projection.facts[0].sourceQuote!, /^The company was formed in seventeen thirty-six/);
  assert.match(projection.namedCases[0].sourceQuote!, /^Each member kept two leathern buckets/);
  for (const fact of projection.facts) {
    assert.ok(fact.sourceQuote!.length <= PROJECTED_SOURCE_QUOTE_CHARS + 1, `quote is ${fact.sourceQuote!.length} chars`);
  }
});

test("R-056: each hardSpecific reaches the writer with the proposition it belongs to", () => {
  const chapter: ChapterSpec = { chapterId: "b-ch01", chapterNumber: 1, chapterTitle: "Public Services" };
  const packet = compileSourcePacketFromSidecar({ bookId: "b", chapter, sidecar: quotedSidecar() });
  assert.deepEqual(packet.namedCases[0].specificPropositions, [
    { specific: "thirty members", proposition: "The company was founded with thirty members." },
    { specific: "leathern buckets", proposition: "Each member kept two leathern buckets at home." },
  ]);
  const projection = writerPacketProjection(packet);
  assert.equal(projection.namedCases[0].specificPropositions?.[0].proposition, "The company was founded with thirty members.");
});

test("R-046: a model-memory sidecar projects exactly as before — no quote keys, no context provenance", () => {
  const chapter: ChapterSpec = { chapterId: "b-ch01", chapterNumber: 1, chapterTitle: "Public Services" };
  const bare = JSON.parse(JSON.stringify(quotedSidecar())) as SourceSidecarV2;
  delete (bare as { sourceProvenance?: string }).sourceProvenance;
  for (const fact of bare.testableFacts) delete fact.sourceQuote;
  for (const example of bare.namedExamples) {
    delete example.sourceQuote;
    delete example.hardSpecificEvidence;
  }
  const projection = writerPacketProjection(compileSourcePacketFromSidecar({ bookId: "b", chapter, sidecar: bare }));
  assert.equal(projection.sourceProvenance, undefined);
  for (const fact of projection.facts) assert.equal(fact.sourceQuote, undefined);
  for (const namedCase of projection.namedCases) {
    assert.equal(namedCase.sourceQuote, undefined);
    assert.equal(namedCase.specificPropositions, undefined);
  }
});

// ── R-046 / R-057 / R-277: what the chapter researcher is actually told ──────

function baseInput(): ChapterResearchInput {
  return {
    bibliography: {
      bookId: "b", title: "T", author: "A",
      edition: { chapterCount: 2 }, flatChapters: [{ number: 1, title: "One" }, { number: 2, title: "Two" }],
      thesis: "t", teachingArc: "The first unit establishes the trade; the second establishes the civic ventures.",
      authorVoice: { register: "plainspoken", signatureMoves: ["x", "y", "z"], avoidMoves: [] },
      confidence: "high",
    },
    chapter: { number: 2, title: "Two" },
  };
}

test("R-046: with a span the prompt carries the text as untrusted data plus the quoting rules; without one it carries neither", () => {
  const span = "The Union Fire Company was formed in seventeen thirty-six with thirty members.\n".repeat(20);
  const withText = buildUserPrompt({ ...baseInput(), sourceSpan: { startOffset: 0, endOffset: span.length, text: span } });
  assert.match(withText, /THIS CHAPTER'S SOURCE TEXT/);
  assert.match(withText, /chapterflow_untrusted_source_data/);
  assert.match(withText, /MUST carry a `sourceQuote`/);
  assert.match(withText, /checked character by character/);
  assert.match(withText, /Prose fields \(focus, coreClaim, keyClaims, summary, paraphraseNotes, hardEdge\) stay in YOUR OWN WORDS/);
  assert.ok(withText.includes(span.slice(0, 60)), "the span itself must be in the prompt");

  const withoutText = buildUserPrompt(baseInput());
  assert.doesNotMatch(withoutText, /SOURCE TEXT/);
  assert.doesNotMatch(withoutText, /sourceQuote/);
  assert.match(withoutText, /Paraphrase only — no verbatim text from the book/, "the model-memory prompt is unchanged");
});

test("R-046: an over-long span is excerpted into the prompt while the validator still holds the whole span", () => {
  const span = Array.from({ length: 30_000 }, (_, i) => `sentence ${i} of the very long part.`).join(" ");
  const prompt = buildUserPrompt({ ...baseInput(), sourceSpan: { startOffset: 0, endOffset: span.length, text: span } });
  assert.match(prompt, /sampled across the whole chapter/);
  assert.match(prompt, /\[\.\.\. omitted \d+ characters of this chapter \.\.\.\]/);
  assert.ok(prompt.length < span.length, "the whole span must not be pasted into the prompt");
  assert.match(prompt, /covers \d{6,} characters of the book, so it needs at least 18 testable facts, 6 named examples and 8 key claims/);
});

test("R-057: the prompt names the framings and cases earlier chapters already took", () => {
  const prompt = buildUserPrompt({
    ...baseInput(),
    priorChapterDigests: [{ chapterNumber: 1, title: "One", focus: "The trade is learned by imitation of a printed model.", caseLabels: ["The Spectator exercise", "The vegetable diet"] }],
  });
  assert.match(prompt, /these framings and cases are TAKEN/);
  assert.match(prompt, /Ch1 "One": The trade is learned by imitation of a printed model\./);
  assert.match(prompt, /cases already used: The Spectator exercise; The vegetable diet/);
  assert.match(prompt, /Choose different organizing moves and different cases/);
  // Absent when there is nothing taken yet — chapter 1 of a fresh book.
  assert.doesNotMatch(buildUserPrompt(baseInput()), /TAKEN/);
});

test("R-277: the book's fact pins reach the CHAPTER RESEARCHER, with the source-wins rule stated", () => {
  const pin = "Never write that the fire company fought fires with rotating duty; the roster is a standing list.";
  const prompt = buildUserPrompt({ ...baseInput(), factPins: [pin] });
  assert.match(prompt, /Corrections already established for this book/);
  assert.ok(prompt.includes(pin));
  // How a pin and a quote interact when they disagree: the TEXT wins and the pin
  // is reported as the defect. A pin that contradicts the book is a pin bug.
  assert.match(prompt, /If this chapter's source text CONTRADICTS one of them/);
  assert.match(prompt, /the source is the authority and the pin is then a defect to report/);
  assert.doesNotMatch(buildUserPrompt(baseInput()), /Corrections already established/);
});
