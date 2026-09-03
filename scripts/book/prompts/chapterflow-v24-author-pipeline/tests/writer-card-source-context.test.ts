/**
 * Wave-1 source-ingestion, review round 2 — WHERE the researcher's paraphrase and
 * the book's own words land inside a writer card.
 *
 * Two findings from the round-1 review, both about the same block:
 *
 *  1. R-055's contract says the chapter thesis (focus / coreClaim / hardEdge /
 *     keyClaims) is READ-ONLY CONTEXT — "it orients the writer, it is not a source
 *     of citable specifics". Round 1 shipped it INSIDE the packet JSON, under the
 *     headers "SOURCE PACKET — ONLY allowed facts/cases/numbers/entities" and
 *     "This is the ONLY allowed factual material. Every claim, number, name, and
 *     case detail must trace to it." So the researcher's own unquoted paraphrase —
 *     hardEdge included, whose first move is by contract the tempting WRONG reading
 *     (researcher-chapter.system.md rule 5) — was presented as citable fact inside
 *     an ACCURACY package. These tests pin the block OUT of the citable channel and
 *     INTO a labelled read-only one, in both render paths.
 *
 *  2. The section-task card renders the RAW packet, not the bounded projection, so
 *     on a source-text packet it took an unbounded sourceQuote per fact and per
 *     case. These tests pin the same bound the projection applies.
 */
import assert from "node:assert/strict";

import { test } from "./harness.js";
import { buildSectionTaskMarkdown } from "../src/sections/sectionTasks.js";
import { PROJECTED_SOURCE_QUOTE_CHARS } from "../src/compiler/sourcePacketProjection.js";
import { MAX_SOURCE_QUOTE_CHARS } from "../src/source/sourceText.js";
import { SECTION_KINDS, type ChapterBlueprintV1, type SectionKind, type SourcePacketV1 } from "../src/artifacts/artifactTypes.js";

const HARD_EDGE = "ZZTOP-HARD-EDGE-the-tempting-wrong-reading-that-must-never-be-cited";
const FOCUS = "ZZTOP-FOCUS-line";
const CORE_CLAIM = "ZZTOP-CORE-CLAIM-line";
const KEY_CLAIM = "ZZTOP-KEY-CLAIM-line";
/** Longer than MAX_SOURCE_QUOTE_CHARS' 240 so a raw render is unmistakable. */
const LONG_QUOTE = `ZZTOP-QUOTE ${"the book's own words ".repeat(20)}`.slice(0, MAX_SOURCE_QUOTE_CHARS);

function blueprint(): ChapterBlueprintV1 {
  return {
    chapterId: "ctx-book-ch01",
    chapterNumber: 1,
    title: "Context",
    coreMove: { name: "change the visible signal" },
    reservedVariety: { hookShape: "direct_claim", answerIndexPattern: [0, 1, 2] },
    constraints: { forbiddenLeakage: [] },
    sections: { hook: {}, summaries: {}, examples: [], quiz: [], cards: [], action: {} },
  } as unknown as ChapterBlueprintV1;
}

function packetWithContext(): SourcePacketV1 {
  return {
    schemaVersion: "source-packet-v1",
    bookId: "ctx-book",
    chapterId: "ctx-book-ch01",
    chapterNumber: 1,
    chapterTitle: "Context",
    sourceSidecarPath: null,
    sourceHash: null,
    facts: [{ id: "ch01.fact.1", claim: "A claim.", mechanism: "A mechanism.", sourceQuote: LONG_QUOTE } as SourcePacketV1["facts"][number]],
    namedCases: [{
      id: "ch01.case.1",
      label: "A case",
      summary: "A summary.",
      hardSpecifics: ["one token"],
      realWorld: true,
      supportsClaimTypes: [],
      allowedUses: [],
      forbiddenUses: [],
      doNotRestamp: [],
      sourceQuote: LONG_QUOTE,
      specificPropositions: [{ specific: "one token", proposition: "The book says the token belongs to this proposition." }],
    } as unknown as SourcePacketV1["namedCases"][number]],
    frameworks: [],
    allowedAnchors: [],
    allowedNumbers: [],
    allowedEntities: [],
    allowedPlaces: [],
    forbiddenClaims: [],
    forbiddenLeakage: [],
    sourceQuality: { status: "adequate", risks: [] },
    sourceProvenance: "source-text",
    chapterContext: { focus: FOCUS, coreClaim: CORE_CLAIM, hardEdge: HARD_EDGE, keyClaims: [KEY_CLAIM] },
  } as unknown as SourcePacketV1;
}

function renderSection(kind: SectionKind): string {
  return buildSectionTaskMarkdown({
    bookId: "ctx-book",
    kind,
    blueprint: blueprint(),
    sourcePacket: packetWithContext(),
    outputPath: `/tmp/${kind}.json`,
    context: { voiceCard: null, bookScars: null },
  });
}

/** The card text between the SOURCE PACKET header and the end of its fenced JSON —
 *  i.e. exactly the bytes the writer is told are the only allowed material. */
function citableBlock(card: string): string {
  const header = card.indexOf("SOURCE PACKET — ONLY allowed");
  assert.ok(header >= 0, "precondition: the card carries the citable SOURCE PACKET header");
  const fenceOpen = card.indexOf("```json", header);
  const fenceClose = card.indexOf("```", fenceOpen + 7);
  assert.ok(fenceOpen > 0 && fenceClose > fenceOpen, "precondition: the SOURCE PACKET block is a fenced JSON block");
  return card.slice(fenceOpen, fenceClose);
}

// ── finding 1 — the thesis is READ-ONLY, and is rendered that way ──────────────

test("R-055: the chapter thesis is NOT inside the section writer's citable SOURCE PACKET block", () => {
  for (const kind of SECTION_KINDS) {
    const citable = citableBlock(renderSection(kind));
    assert.ok(!citable.includes("chapterContext"), `${kind}: chapterContext must not be a key of the citable packet JSON`);
    for (const line of [FOCUS, CORE_CLAIM, HARD_EDGE, KEY_CLAIM]) {
      assert.ok(!citable.includes(line), `${kind}: ${line} reached the block the writer is told is the ONLY allowed material`);
    }
  }
});

test("R-055: the section card carries the thesis in a labelled READ-ONLY, not-citable block", () => {
  for (const kind of SECTION_KINDS) {
    const card = renderSection(kind);
    assert.match(card, /CHAPTER CONTEXT — READ-ONLY/, `${kind}: the read-only context header must render`);
    assert.match(card, /not a source of citable specifics/i, `${kind}: the block must say it is not citable`);
    // hardEdge is the dangerous one: the contract makes its first move the tempting
    // WRONG reading, so the card must warn instead of presenting it as a fact.
    assert.match(card, /hardEdge/, `${kind}: the block must name hardEdge`);
    for (const line of [FOCUS, CORE_CLAIM, HARD_EDGE, KEY_CLAIM]) {
      assert.ok(card.includes(line), `${kind}: ${line} must still reach the writer as orientation`);
    }
  }
});

test("R-055: the whole-chapter author card also keeps the thesis out of the citable projection", async () => {
  const { buildAuthorCard } = await import("../src/orchestrator/authorRun.js");
  const card = buildAuthorCard({ bookId: "ctx-book", chapterNumber: 1, briefMd: "# brief\n", packet: packetWithContext(), voice: null });
  const start = card.indexOf("SOURCE PACKET (writer projection)");
  assert.ok(start >= 0, "precondition: the author card carries the projection block");
  const end = card.indexOf("CHAPTER CONTEXT — READ-ONLY", start) >= 0
    ? card.indexOf("CHAPTER CONTEXT — READ-ONLY", start)
    : card.length;
  const citable = card.slice(start, end);
  assert.ok(citable.includes("This is the ONLY allowed factual material"), "precondition: the citable instruction is in this block");
  for (const line of [FOCUS, CORE_CLAIM, HARD_EDGE, KEY_CLAIM]) {
    assert.ok(!citable.includes(line), `${line} reached the author card's ONLY-allowed-material block`);
  }
  assert.match(card, /CHAPTER CONTEXT — READ-ONLY/, "the author card must render the read-only context block");
  assert.match(card, /not a source of citable specifics/i, "the author card's context block must say it is not citable");
  for (const line of [FOCUS, CORE_CLAIM, HARD_EDGE, KEY_CLAIM]) {
    assert.ok(card.includes(line), `${line} must still reach the whole-chapter writer as orientation`);
  }
});

// ── finding 2 — the raw card render bounds the book's words like the projection ──

test("R-046: a source-text packet's quotes are bounded in the section-task render", () => {
  for (const kind of SECTION_KINDS) {
    const citable = citableBlock(renderSection(kind));
    assert.ok(citable.includes("sourceQuote"), `${kind}: the quote must still reach the writer`);
    assert.ok(!citable.includes(LONG_QUOTE), `${kind}: the full ${LONG_QUOTE.length}-char quote must not be rendered raw`);
    assert.ok(citable.includes(LONG_QUOTE.slice(0, 120)), `${kind}: the head of the quote must survive the bound`);
    for (const match of citable.matchAll(/"sourceQuote":\s*"((?:[^"\\]|\\.)*)"/g)) {
      assert.ok(
        match[1].length <= PROJECTED_SOURCE_QUOTE_CHARS + 4,
        `${kind}: a rendered sourceQuote is ${match[1].length} chars, over the ${PROJECTED_SOURCE_QUOTE_CHARS}-char card bound`,
      );
    }
  }
});
