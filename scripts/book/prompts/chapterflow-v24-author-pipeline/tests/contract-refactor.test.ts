/**
 * P07 — the section-writer contract refactor. The four mega-paragraph blocklists
 * became a layered brief (universalCore + gateAwareness + craftBrief) plus a
 * per-book scars file rendered only into its owning book's task. These tests pin:
 *
 *  1. CROSS-CONTAMINATION (the load-bearing assertion): a scar-bearing book's task
 *     carries ITS scars and never another book's — "red phone by the pool" (POM)
 *     must be absent from an intelligent-investor render, and "prospectus packet"
 *     (TI) absent from a power-of-moments render.
 *  2. universal invariants present for all four kinds.
 *  3. the VOICE / LIVED-MOMENTS paragraph retained verbatim (exact snapshot).
 *  4. a token-count regression bound: every rendered task is <= 72% of the pinned
 *     pre-refactor length (the full-blueprint duplication was dropped; re-pinned
 *     60->62% for Task 11z's functional quiz-specifics preflight, 62->69% for
 *     the wave-0 contract-truth batch and 69->72% for the grounding redesign plus
 *     R-055's read-only chapter-context block — deliberate, tested additions, not prose
 *     creep; see the re-pin rationale at the test itself).
 *  5. class-B gate-restatement prose was actually deleted (only the ~8 design-around
 *     rules survive, each naming its validator).
 *  6. the book-scars loader validates + fails loud, and returns null for no file.
 */

import assert from "node:assert/strict";
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { resolve } from "path";

import { test } from "./harness.js";
import { FRANKLIN_SLICE_PATH, PIPELINE_DIR } from "./helpers.js";
import { buildSectionTaskMarkdown, sectionContract, sectionDoNotLines } from "../src/sections/sectionTasks.js";
import { loadBannedPhrases } from "../src/critics/shared.js";
import { CHAPTER_PROSE_CARD_BUDGET } from "../src/sections/chapterProse.js";
import { bookRuleChapters, loadBookScars, validateBookScars } from "../src/lib/bookScars.js";
import { voiceCard } from "../src/lib/voiceCard.js";
import { compileSourcePacketFromSidecar } from "../src/compiler/sourcePacket.js";
import { compileChapterBlueprint } from "../src/compiler/chapterBlueprint.js";
import { SECTION_KINDS, type ChapterBlueprintV1, type SectionKind, type SourcePacketV1 } from "../src/artifacts/artifactTypes.js";
import type { SourceSidecarV2 } from "../src/source/sidecarSchema.js";
import { MAX_SOURCE_QUOTE_CHARS, normalizeIngestedText } from "../src/source/sourceText.js";
import { MAX_RESEARCH_UNITS } from "../src/source/sourceQuoteGrounding.js";
import type { ChapterSpec } from "../src/generateChapter.js";

// ---- Pinned PRE-REFACTOR rendered lengths (chars), measured on the realistic
// money-book fixture below at branch point (commit 4266c629c) with the pre-P07
// sectionTasks.ts. The bound is <= 62% of these (re-pinned for Task 11z); see the P07 completion report. ----
const PRE_REFACTOR_CHARS: Record<SectionKind, number> = {
  "summary-pack": 48356,
  "example-pack": 54639,
  "learning-pack": 53312,
  "action-pack": 46948,
};

// The VOICE / LIVED-MOMENTS paragraph. It validated a +3.0 composite (commit 3702dd2d5)
// and MUST survive the refactor verbatim. This snapshot is the exact expected text.
//
// ONE WORD MOVED (R-015): the closing clause read "state it plainly rather than
// embroidering it". "rather than" is soft-banned in the SAME prompt
// (config/banned-phrases.json, perBookBudget 15, budgeted book-wide at
// critics/bookGate.ts), so the paragraph the writer is told to imitate as a style
// model spent one of the book's allowance and modelled a tic the DO NOT block asks
// it to avoid. "instead of" is the plain substitute the ban's own reason names.
// Nothing else in the paragraph changed: the scene, the contrast pair, and the
// invent-nothing clause are byte-identical.
const VOICE_PARAGRAPH_SNAPSHOT =
  `VOICE — narrate the real cases as LIVED MOMENTS, not abstract summaries: this genre teaches through concrete stories, so build deepRead and fullRead AROUND this chapter's real named cases. Open a case with one specific sensory moment drawn ONLY from its hardSpecifics (a named person, place, object, or number that is actually in the source), let the reader briefly FEEL the moment, THEN name the principle it proves. As a STYLE model only: prefer "The nurse taped a bright cartoon over the ceiling light so the boy staring up during the scan had something to find, and he stopped crying" over "Environments can be redesigned to reduce patient distress." Invent nothing beyond this chapter's own source hardSpecifics — the sample scene is only a voice model, so never import its nurse/boy/scan or any other book's cast, and if you have only a bare fact, state it plainly instead of embroidering it.`;

// A minimal blueprint/packet is enough to render a task's contract + scars + voice
// (the scars block is keyed off bookId, not the blueprint), so cross-contamination,
// invariants, and the voice snapshot use it. The token bound uses the realistic
// fixture instead, to match how the pre-refactor constants were measured.
function minimalBlueprint(bookId: string): ChapterBlueprintV1 {
  return {
    chapterId: `${bookId}-ch01`,
    chapterNumber: 1,
    coreMove: { name: "change the visible signal" },
    reservedVariety: { hookShape: "direct_claim", answerIndexPattern: [0, 1, 2] },
    constraints: { forbiddenLeakage: [] },
    sections: { hook: {}, summaries: {}, examples: [], quiz: [], cards: [], action: {} },
  } as unknown as ChapterBlueprintV1;
}
const PACKET = { schemaVersion: "source-packet-v1", facts: [] } as unknown as SourcePacketV1;

function renderTask(bookId: string, kind: SectionKind): string {
  return buildSectionTaskMarkdown({ bookId, kind, blueprint: minimalBlueprint(bookId), sourcePacket: PACKET, outputPath: `/tmp/${kind}.json`, context: { voiceCard: voiceCard(bookId), bookScars: loadBookScars(bookId) } });
}

// ---------- realistic fixture (mirrors tests/compiler-pipeline.test.ts) ----------
function sidecar(): SourceSidecarV2 {
  const facts = Array.from({ length: 9 }, (_, i) => ({
    id: `ch01.fact.${i + 1}`,
    claim: `Credit utilization signal ${i + 1} changes lender-visible risk before a bill is fully paid.`,
    becauseMechanism: `Because balances can be reported before payment, a lower visible balance gives the scoring model cleaner information ${i + 1}.`,
    commonError: `Assuming only the due date matters ${i + 1}.`,
    errorIsWhy: `The reporting snapshot can matter before the due date ${i + 1}.`,
  }));
  return {
    schemaVersion: "source-v2",
    chapterNumber: 1,
    chapterTitle: "Optimize Your Credit Cards",
    centralConcept: { id: "ch01.concept.credit", name: "Credit card optimization", plainDefinition: "Small payment and utilization choices change what lenders see.", whyItMatters: "The reader can improve the signal without pretending money is magic." },
    keyClaims: facts.map((f) => f.claim),
    namedExamples: [
      { id: "ch01.case.fico", label: "FICO score range", summary: "FICO scores are commonly discussed on a 300 to 850 scale when explaining credit behavior.", teachesWhat: "Credit behavior becomes a lender-facing signal.", hardSpecifics: ["300 to 850 scale", "credit utilization"], realWorld: true },
      { id: "ch01.case.cfpb", label: "Consumer Financial Protection Bureau credit reports", summary: "The CFPB explains that credit reports collect account and payment information used by lenders.", teachesWhat: "A report is an input, not a moral judgment.", hardSpecifics: ["credit reports", "lenders use account information"], realWorld: true },
    ],
    hardEdge: "Do not promise an exact score increase.",
    paraphraseNotes: "Keep numbers limited to the verified 300 to 850 score range and the source-local credit utilization mechanism.",
    testableFacts: facts,
    frameworks: [{ name: "Three-part credit signal", members: ["payment history", "utilization", "account age"] }],
  };
}

/**
 * The SOURCE-TEXT worst case (R-046/R-056/R-058), for the second budget below.
 *
 * The model-memory fixture above cannot bound a source-text card: it carries no
 * `sourceQuote` and no `hardSpecificEvidence`, so the card's largest new payload
 * renders as nothing. This is the biggest packet the pipeline can now produce —
 * researchFloorsForSpan() caps a research unit at MAX_RESEARCH_UNITS = 2, i.e.
 * 9*2 = 18 testable facts and 3*2 = 6 named examples — with every quote at the
 * MAX_SOURCE_QUOTE_CHARS ceiling and a proposition behind every hardSpecific.
 */
function sourceTextSidecar(): SourceSidecarV2 {
  // The quotes are REAL BOOK TEXT, taken from the frozen public-domain Franklin
  // slice (review round 2). A made-up string of the right length would measure
  // the wrong card: printed prose carries the straight quotes, backslashes and
  // newlines that JSON.stringify escapes, and the card's budget is pinned in
  // characters of rendered JSON. Distinct per item, as a real sidecar's are.
  const frozen = normalizeIngestedText(readFileSync(FRANKLIN_SLICE_PATH, "utf8"));
  const quoteAt = (i: number): string => {
    const from = (i * 977) % Math.max(1, frozen.length - MAX_SOURCE_QUOTE_CHARS);
    return frozen.slice(from, from + MAX_SOURCE_QUOTE_CHARS);
  };
  const facts = Array.from({ length: 9 * MAX_RESEARCH_UNITS }, (_, i) => ({
    id: `ch01.fact.${i + 1}`,
    claim: `Credit utilization signal ${i + 1} changes lender-visible risk before a bill is fully paid.`,
    becauseMechanism: `Because balances can be reported before payment, a lower visible balance gives the scoring model cleaner information ${i + 1}.`,
    commonError: `Assuming only the due date matters ${i + 1}.`,
    errorIsWhy: `The reporting snapshot can matter before the due date ${i + 1}.`,
    sourceQuote: quoteAt(i + 1),
  }));
  const namedExamples = Array.from({ length: 3 * MAX_RESEARCH_UNITS }, (_, i) => {
    const hardSpecifics = [`300 to 850 scale ${i + 1}`, `credit utilization ${i + 1}`, `reporting date ${i + 1}`];
    return {
      id: `ch01.case.${i + 1}`,
      label: `Named case ${i + 1}`,
      summary: `The source describes case ${i + 1} at length, naming the parties, the date and the outcome it turned on.`,
      teachesWhat: "Credit behavior becomes a lender-facing signal.",
      hardSpecifics,
      realWorld: true,
      sourceQuote: quoteAt(i + 31),
      hardSpecificEvidence: hardSpecifics.map((specific, j) => ({
        specific,
        proposition: `The source states that ${specific} is what the lender actually sees at the moment of the report.`,
        sourceQuote: quoteAt(i * 3 + j + 61),
      })),
    };
  });
  return {
    ...sidecar(),
    sourceProvenance: "source-text",
    focus: "How a reported balance, not a paid one, is what the lender scores.",
    coreClaim: "The reporting snapshot, not the due date, is the lever the reader controls.",
    keyClaims: facts.slice(0, 8).map((f) => f.claim),
    testableFacts: facts,
    namedExamples,
  } as unknown as SourceSidecarV2;
}

function sourceTextFixtureFor(bookId: string): { blueprint: ChapterBlueprintV1; packet: SourcePacketV1 } {
  const chapter: ChapterSpec = { chapterId: `${bookId}-ch01`, chapterNumber: 1, chapterTitle: "Optimize Your Credit Cards" };
  const packet = compileSourcePacketFromSidecar({ bookId, chapter, sidecar: sourceTextSidecar(), sidecarPath: "/tmp/ch01.source.json", sourceHash: "hash" });
  const blueprint = compileChapterBlueprint({ bookId, chapter, packet, packetPath: "/tmp/ch01.source-packet.json" });
  return { blueprint, packet };
}

function realisticFixtureFor(bookId: string): { blueprint: ChapterBlueprintV1; packet: SourcePacketV1 } {
  const chapter: ChapterSpec = { chapterId: `${bookId}-ch01`, chapterNumber: 1, chapterTitle: "Optimize Your Credit Cards" };
  const packet = compileSourcePacketFromSidecar({ bookId, chapter, sidecar: sidecar(), sidecarPath: "/tmp/ch01.source.json", sourceHash: "hash" });
  const blueprint = compileChapterBlueprint({ bookId, chapter, packet, packetPath: "/tmp/ch01.source-packet.json" });
  return { blueprint, packet };
}

function realisticFixture(): { blueprint: ChapterBlueprintV1; packet: SourcePacketV1 } {
  return realisticFixtureFor("money-book");
}

// ---------------------------------- tests ----------------------------------

test("book scars render ONLY into their owning book — no cross-contamination", () => {
  for (const kind of SECTION_KINDS) {
    const pom = renderTask("the-power-of-moments", kind);
    const ti = renderTask("the-intelligent-investor", kind);

    // Each scar-bearing book carries its own material...
    assert.match(pom, /KNOWN OVER-USED MATERIAL FOR THIS BOOK/, `${kind}: POM gets its scars block`);
    assert.match(pom, /red phone by the pool/, `${kind}: POM carries its own scar`);
    assert.match(ti, /prospectus packet/, `${kind}: TI carries its own scar`);

    // ...and NEVER the other book's (the load-bearing assertion of this prompt).
    assert.doesNotMatch(ti, /red phone/, `${kind}: TI must not inherit POM's "red phone by the pool"`);
    assert.doesNotMatch(pom, /prospectus packet/, `${kind}: POM must not inherit TI's "prospectus packet"`);
  }
});

test("a book with no scar file gets no scars block and no other book's scars", () => {
  for (const kind of SECTION_KINDS) {
    const md = renderTask("money-book", kind);
    assert.doesNotMatch(md, /KNOWN OVER-USED MATERIAL/, `${kind}: no scars block for a scar-free book`);
    assert.doesNotMatch(md, /red phone/, `${kind}: no POM scar leaks into a scar-free book`);
    assert.doesNotMatch(md, /prospectus packet|tradeoff memo/, `${kind}: no TI scar leaks into a scar-free book`);
  }
});

test("universal invariants are present for all four kinds", () => {
  const bp = realisticFixture();
  const render = (kind: SectionKind) => buildSectionTaskMarkdown({ bookId: "money-book", kind, blueprint: bp.blueprint, sourcePacket: bp.packet, outputPath: `/tmp/${kind}.json`, context: { voiceCard: voiceCard("money-book"), bookScars: loadBookScars("money-book") } });
  for (const kind of SECTION_KINDS) {
    const md = render(kind);
    assert.match(md, /UNIVERSAL —/, `${kind}: universalCore header present`);
    assert.match(md, /DESIGN AROUND THE GATES:/, `${kind}: gateAwareness header present`);
    assert.match(md, /WHAT EXCELLENT LOOKS LIKE:/, `${kind}: craftBrief header present`);
    assert.match(md, /the validator enforces this/, `${kind}: design-around rules name the validator`);
  }
  assert.match(render("summary-pack"), /Write ONLY the hook, tiered summaries, keyTakeaway/);
  assert.match(render("summary-pack"), /keyTakeaway: 30 words or fewer/);
  assert.match(render("summary-pack"), /Output SummaryPackV1 JSON only\./);
  assert.match(render("example-pack"), /Produce exactly the six blueprint slots/);
  assert.match(render("example-pack"), /Output ExamplePackV1 JSON only\./);
  assert.match(render("learning-pack"), /correctIndex \(MUST match the blueprint slot\)/);
  assert.match(render("learning-pack"), /Output LearningPackV1 JSON only\./);
  assert.match(render("action-pack"), /Write ONLY tryThisNow and implementationPlan/);
  assert.match(render("action-pack"), /Output ActionPackV1 JSON only\./);
});

test("summary craft brief pre-states the SEC16 memorable-line rule the gate actually applies", () => {
  // Finding 16: the summary contract told the model memorable lines must be 8-14 words
  // and portable, but never what SEC16 validates on the three lines that ship — so the
  // rule reached the writer only through retry cards.
  //
  // Package 1B INVERTED that rule. It used to demand two of a cited case's
  // hardSpecifics verbatim INSIDE the line, which is why every line on the live
  // Franklin book is an identifier pair; a line now carries AT MOST ONE specific,
  // must not reproduce the hook/counterintuition/keyTakeaway, and may not share its
  // detail with another line. The contract must state THAT, or the writer is being
  // told to produce exactly what the gate now refuses.
  const md = renderTask("money-book", "summary-pack");
  assert.match(md, /\(SEC16\/SEC118\/SEC135\)/, "summary craft brief must name the memorable-line checks");
  assert.match(md, /AT MOST ONE source specific/, "and state the cap the gate applies");
  assert.doesNotMatch(md, /at least two of them verbatim/, "the retired two-verbatim demand must not survive in the prompt");
  // Sibling style: every design/craft rule that names a gate ends by naming the validator.
  assert.match(md, /\(SEC16\/SEC118\/SEC135\)[\s\S]*?the validator enforces this/, "the memorable-line rule names the validator");

  // The rule is summary-pack-specific — SEC16 governs the summary breakdown's memorable
  // lines only, so it must not leak into the other three section contracts.
  for (const kind of ["example-pack", "learning-pack", "action-pack"] as const) {
    assert.doesNotMatch(renderTask("money-book", kind), /SEC16\b/, `${kind}: SEC16 memorable-line rule is summary-only`);
  }
});

test("the VOICE / LIVED-MOMENTS paragraph survives verbatim in the summary contract", () => {
  const md = renderTask("money-book", "summary-pack");
  assert.ok(md.includes(VOICE_PARAGRAPH_SNAPSHOT), "summary contract must contain the exact VOICE paragraph");
  // And it belongs to the summary writer only.
  assert.doesNotMatch(renderTask("money-book", "example-pack"), /narrate the real cases as LIVED MOMENTS/);
});

test("class-B gate-restatement prose was deleted (only design-around rules survive)", () => {
  const learning = renderTask("money-book", "learning-pack");
  const example = renderTask("money-book", "example-pack");
  // The enumerated strawman-absolute list (SEC52) is deleted — the design-around line
  // says "no strawman absolutes" and points at the validator instead.
  assert.doesNotMatch(learning, /automatically, impossible, guaranteed, entirely/);
  // The enumerated default-venue list (SEC85/SEC93) is deleted from the example contract.
  assert.doesNotMatch(example, /budget apps, shared spreadsheets, calendar reminders/);
  // The pre-P07 dangling voice prefix is gone (P07 made it conditional).
  assert.doesNotMatch(learning, /Write in the VOICE CARD register;/);
});

// RE-PINNED 62% -> 69% for the wave-0 contract-truth batch. Measured on this
// commit with the same money-book fixture: summary 32,321 (66.8%), example 34,912
// (63.9%), learning 36,298 (68.1%), action 30,451 (64.9%). The growth is four
// functional additions, each covered by a test above: the full hard/soft banned
// phrase list rendered from config (R-014, ~2.6k and the only large one — 76 of the
// 82 strings that fail a draft were previously undisclosed), the TIER ROLES line
// (R-012), the cards/actions staging-directions rules (R-013), and the chapter
// title plus the DIRECT_JSON validation frame (R-018/R-019). The binding ceiling is
// the absolute HONEST budget below, measured on the render production actually
// sends; this ratio still catches prose creep on the packet-only card.
// RE-PINNED 69% -> 71% for the wave-1 source-ingestion package's single prompt
// addition, R-055's READ-ONLY CONTEXT block (the chapter's focus, coreClaim,
// hardEdge and up to six keyClaims, projected onto the writer card). Measured on
// this same money-book fixture, the block costs +994 characters on EVERY card —
// summary 32,321 -> 33,315, example 34,912 -> 35,906, learning 36,298 -> 37,292
// (70.0%, the binding card), action 30,451 -> 31,445. Nothing else in this
// package touches the card. The pin is moved to 71%, one point above the
// measurement, exactly as the 60->62 and 62->69 re-pins above did.
// MERGE RE-MEASURE (this branch, package 1C the dealing redesign, merged origin/main
// d6bf5933d, wave-1 source-text ingestion). MEASURED on the merge, all four kinds:
//   summary 33,199 = 68.7%   example 35,288 = 64.6%
//   learning 37,435 = 70.2% (binding)   action 31,548 = 67.2%
// Every kind is BELOW the pre-merge measurement recorded above (binding learning was
// 38,169 = 71.6%), so the 72% pin holds unchanged and is re-stated here against the
// merged render, so the next creep is measured from a true baseline. The reduction is
// not contract prose: 1C's only section-contract edit is in the EXAMPLE-pack block and
// ADDS characters (R-064's SCENE ENGINE BY SLOT rule, +307 measured at
// candidateRepairWritingContract.ts), yet the example card fell the FURTHEST (-1,270).
// What shrank is the packet JSON every card embeds: R-116's properNounTokens filter
// drops sentence-opening ordinary words from facts[].groundedEntities, which
// tests/compiler-pipeline.test.ts pins by name.
test("every rendered task is <= 72% of its pinned pre-refactor length", () => {
  const bp = realisticFixture();
  for (const kind of SECTION_KINDS) {
    const md = buildSectionTaskMarkdown({ bookId: "money-book", kind, blueprint: bp.blueprint, sourcePacket: bp.packet, outputPath: `/tmp/${kind}.json`, context: { voiceCard: voiceCard("money-book"), bookScars: loadBookScars("money-book") } });
    const pre = PRE_REFACTOR_CHARS[kind];
    const ratio = md.length / pre;
  // MERGE RE-PIN (this package merged origin/main's package 1B, grounding redesign).
  // 1B re-pinned 69% -> 70% for four rule changes the gates enforce and the writer was
  // not being told: quiz provenance by natural reference (SEC55/SEC120 replacing the
  // retired SEC56 token demand), the transfer floor measured on the stem rather than the
  // bloomsLevel label (SEC117), qualifier-shape parity in the choices (SEC134), and the
  // three-identical-openers refusal (SEC132). This package independently re-pinned
  // 69% -> 71% for R-055's READ-ONLY CONTEXT block (+994 chars on EVERY card). Both
  // additions are in the merged render, so the pin is re-measured on the merge rather
  // than taken as the larger of the two. MEASURED on the merge, all four kinds:
  // summary 33,813 = 69.9%, example 36,558 = 66.9%, learning 38,169 = 71.6% (binding),
  // action 31,781 = 67.7%. Pin 72%, one point above the binding measurement, exactly as
  // the 60->62, 62->69 and 69->70 re-pins above did.
  // SEC136 RE-MEASURE (the summary card's MUST TEACH list of the chapter's dealt
  // cases). Only the summary-pack card moves; the other three render byte-identically.
  // MEASURED on this fixture, before -> after:
  //   summary 33,199 = 68.7%  ->  34,159 = 70.6%   (+960 chars, the dealt-case block)
  //   example 35,288 = 64.6%  ->  35,288 = 64.6%   (unchanged)
  //   learning 37,435 = 70.2% ->  37,435 = 70.2%   (unchanged)
  //   action  31,548 = 67.2%  ->  31,548 = 67.2%   (unchanged)
  // The summary card is now the binding render at 70.6%, still under the standing
  // 72% pin, so the pin is NOT re-pinned — it is only re-measured here so the next
  // creep starts from a true baseline. (The 69.9% figure the merge note above
  // records for summary had itself drifted to 68.7% before this change.)
    assert.ok(md.length <= 0.72 * pre, `${kind}: rendered ${md.length} chars is ${(ratio * 100).toFixed(1)}% of pre-refactor ${pre}; must be <= 72%`);
  }
});

// Task 11ai — DELIBERATE RE-PIN for the learning-pack card only, 62% -> 76%.
//
// In production the learning-pack card ALSO carries THIS chapter's already-drafted
// reader-visible prose (finding 45: the 3-seat blind panel failed every canary chapter
// because quiz stems and cards named facts — "Dr. Thomas Bond", "1751", "Temperance" —
// that appear nowhere in the read tiers). The prose is the chapter itself, so it cannot
// be summarised away without defeating the fix: a writer told "be derivable from the
// prose" needs the prose. Worst case (every tier at the TOP of its contract aim band:
// fastRead 600 / deepRead 1600 / fullRead 3400 chars, plus hook, counterintuition and
// keyTakeaway) adds ~7.0k chars to a ~32.7k card = 74.3% of the 53,312-char pin.
//
// The re-pin is SCOPED and DOUBLE-BOUNDED so it cannot become a prose-creep loophole:
//   - the four packet-only cards keep the 62% bound (test above, untouched);
//   - only the with-prose learning card gets 76%; and
//   - the DELTA over the same card without prose must stay within the prose payload
//     plus a small allowance for the block header and the derivability rule, so growth
//     is the chapter's own text and nothing else.
// Precedent: the 60->62% re-pin for Task 11z's quiz-specifics preflight, same reasoning.
// The 76% figure assumes tiers that RESPECT their aim bands, which nothing in
// production enforces (SEC6 checks floors only) — the hard ceiling that holds for any
// input at all is the clamp test below.
const WORST_CASE_PROSE_CHARS = 220 + 220 + 600 + 1600 + 3400 + 200;
const PROSE_BLOCK_SCAFFOLD_ALLOWANCE = 1200;

function worstCaseChapterProse() {
  const filler = (chars: number) => "The reader sees the visible balance change before the lender reads it. ".repeat(Math.ceil(chars / 70)).slice(0, chars);
  return {
    hook: { hook: filler(220), counterintuition: filler(220) },
    breakdown: { fastRead: filler(600), deepRead: filler(1600), fullRead: filler(3400) },
    keyTakeaway: filler(200),
  };
}

test("the production learning-pack card (with drafted chapter prose) is bounded at 76% and grows only by the prose", () => {
  const bp = realisticFixture();
  const args = { bookId: "money-book", kind: "learning-pack" as const, blueprint: bp.blueprint, sourcePacket: bp.packet, outputPath: "/tmp/learning-pack.json", context: { voiceCard: voiceCard("money-book"), bookScars: loadBookScars("money-book") } };
  const withProse = buildSectionTaskMarkdown({ ...args, chapterProse: worstCaseChapterProse() });
  const bare = buildSectionTaskMarkdown(args);
  assert.ok(withProse.length > bare.length, "the prose block must actually render");
  const pre = PRE_REFACTOR_CHARS["learning-pack"];
  const ratio = withProse.length / pre;
  // RE-PINNED 76% -> 82% by the same wave-0 contract-truth batch as the 62->69%
  // above, and for the same four additions: measured 43,564 chars = 81.7%. The
  // prose delta this test bounds (7,290) is unchanged by that batch.
  // MERGE RE-PIN. 1B took 82% -> 84% for its four additions; this package took
  // 82% -> 85% for R-055's READ-ONLY CONTEXT block (+994). Re-measured on the merge:
  // 45,459 = 85.3%, so the pin is 86%. The DELTA assertion below — the thing this test
  // is really for — is unchanged at 7,290, which is the proof that the growth is the
  // context block and 1B's contract lines, not prose creep.
  // MERGE RE-MEASURE (1C + wave-1): 44,725 = 83.9%, prose delta 7,290 (unchanged).
  // Below the 45,459 = 85.3% recorded above, for the same reason as the ratio pin; 86% holds.
  assert.ok(withProse.length <= 0.86 * pre, `learning-pack with prose: rendered ${withProse.length} chars is ${(ratio * 100).toFixed(1)}% of pre-refactor ${pre}; must be <= 86% (re-pin only with a stated rationale)`);
  const delta = withProse.length - bare.length;
  assert.ok(
    delta <= WORST_CASE_PROSE_CHARS + PROSE_BLOCK_SCAFFOLD_ALLOWANCE,
    `the prose block added ${delta} chars for a ${WORST_CASE_PROSE_CHARS}-char payload; growth beyond the chapter's own text + ${PROSE_BLOCK_SCAFFOLD_ALLOWANCE} chars of header/rule is prose creep`,
  );
});

// Task 11ai REVIEW (minor a) — the 76% figure above assumes tiers that RESPECT their
// aim bands, and nothing in production enforces a tier CEILING (SEC6.breakdown_length
// checks floors only; the aim bands are prompt guidance). A model that overshoots
// fullRead would silently blow the pin. The renderer now clamps each passage to
// CHAPTER_PROSE_CARD_CAPS, so the ceiling below holds for ANY input, not just
// well-behaved input.
test("a runaway summary pack cannot blow the learning card: the prose block is clamped at a hard ceiling", () => {
  const bp = realisticFixture();
  const args = { bookId: "money-book", kind: "learning-pack" as const, blueprint: bp.blueprint, sourcePacket: bp.packet, outputPath: "/tmp/learning-pack.json", context: { voiceCard: voiceCard("money-book"), bookScars: loadBookScars("money-book") } };
  const filler = (chars: number) => "The reader sees the visible balance change before the lender reads it. ".repeat(Math.ceil(chars / 70)).slice(0, chars);
  const runaway = {
    hook: { hook: filler(9000), counterintuition: filler(9000) },
    breakdown: { fastRead: filler(9000), deepRead: filler(30000), fullRead: filler(60000) },
    keyTakeaway: filler(9000),
  };
  const withProse = buildSectionTaskMarkdown({ ...args, chapterProse: runaway });
  const bare = buildSectionTaskMarkdown(args);
  const pre = PRE_REFACTOR_CHARS["learning-pack"];
  const ratio = withProse.length / pre;
  // RE-PINNED 80% -> 86%, same batch, same additions: measured 45,273 = 84.9%
  // — arithmetic identical to the 82% pin above plus the clamped-prose allowance.
  // RE-PINNED AGAIN 86% -> 88% for R-055's +994: measured 46,269 = 86.8%. The
  // clamp delta this test guards (8,977 against a CHAPTER_PROSE_CARD_BUDGET +
  // 1,200 allowance) is unchanged, which is the point — the card grew by the
  // context block, not by unbounded prose.
  // MERGE RE-PIN 88% -> 89%: origin/main's package 1B added its contract lines to the
  // same card and the merged render measures 47,146 = 88.4%. The clamp delta is STILL
  // 8,977 — unchanged by both packages, which is exactly what this test asserts below.
  // MERGE RE-MEASURE (1C + wave-1): 46,412 = 87.1%, below the 88.x% the 89% pin was set
  // on; the clamp still holds the card and the pin does not move.
  assert.ok(withProse.length <= 0.89 * pre, `a 126k-char summary pack rendered ${withProse.length} chars (${(ratio * 100).toFixed(1)}% of ${pre}); the clamp must hold the card at <= 89%`);
  const delta = withProse.length - bare.length;
  assert.ok(
    delta <= CHAPTER_PROSE_CARD_BUDGET + PROSE_BLOCK_SCAFFOLD_ALLOWANCE,
    `unbounded prose added ${delta} chars against a ${CHAPTER_PROSE_CARD_BUDGET}-char clamp budget + ${PROSE_BLOCK_SCAFFOLD_ALLOWANCE} of scaffold`,
  );
  // Aim-band-conformant prose is never touched by the clamp (the test above still
  // measures the real, whole passages).
  const conformant = buildSectionTaskMarkdown({ ...args, chapterProse: worstCaseChapterProse() });
  assert.doesNotMatch(conformant, /prose truncated/, "well-behaved tiers render whole");
  assert.match(withProse, /prose truncated/, "a clamped passage says so, so the writer knows the tail exists");
  // The header cannot claim completeness it no longer has.
  assert.match(conformant, /This is EVERYTHING the reader has seen/);
  assert.doesNotMatch(withProse, /This is EVERYTHING the reader has seen/, "a clamped block must not claim to be everything");
});

// ── R-002 — AN HONEST BUDGET, measured on what production actually sends ──────
//
// Every pin above is measured on "money-book", a fixture with NO scar file and NO
// author-voice profile, so `loadBookScars` and `voiceCard` both return null and the
// two largest per-book blocks render as the empty string. The 62%/76% ratios
// therefore bound a prompt no book is ever compiled with.
//
// Measured on this branch's HEAD with the SAME realistic fixture and only the
// bookId changed (this file's render path, all four kinds, plus the with-prose
// learning card):
//
//   money-book                             learning-pack 32,973 chars =  61.8% of 53,312
//                                          + worst-case prose 40,263 chars =  75.5%
//   the-autobiography-of-benjamin-franklin summary  49,269 / example  52,291
//                                          learning 52,471 / action   46,889
//                                          learning-pack           =  98.4% of 53,312
//                                          + worst-case prose 59,761 chars = 112.1%
//
// (Re-measured in review round 2, after voiceCardSection gained the line naming the
// voice record the card was rendered from — R-004's second half — and the tier-floor
// rule's E7/E8 clause was restated at the severity those critics actually carry. Both
// grew the render; neither needed a re-pin, the budgets below still hold with 529
// chars of headroom on the packet-only cards and 739 on the with-prose card.)
//
// The real worst case already exceeds BOTH ratio pins. Those pins are left exactly
// as they are — they still bound the packet-only card and would catch contract prose
// creep — and the real ceiling is pinned HERE, in absolute characters, on the render
// production sends: the largest shipped scar file plus a real voice card.
const LARGEST_SCAR_BOOK = "the-autobiography-of-benjamin-franklin";

// Budgets = the measured worst case above, rounded UP to the next 500 characters,
// plus one further 500 as the stated headroom for the rest of the wave-0/1 prompt
// work, computed on the first-round worst case (52,391 -> 52,500 -> 53,000;
// 59,681 -> 60,000 -> 60,500) and left unchanged when round 2's edits spent part of
// that stated headroom: the two cards the budgets bind grew +80 each (learning-pack
// 52,391 -> 52,471, with-prose 59,681 -> 59,761); summary (+292) and example (+229)
// carry the longer full-card naming line and stay far below. Anything that needs
// more than this must re-pin here with a written rationale, exactly as the 60->62%
// and 62->76% re-pins above did.
//
// The wave-0 contract-truth batch spent part of that stated headroom and stayed
// inside the budgets, so neither number moves. Its four prompt additions (the
// config-rendered banned-phrase list, TIER ROLES, the cards/actions staging
// directions, the chapter title + DIRECT_JSON validation frame) cost ~+3.0k on the
// binding card, and R-274's chapter scoping returned more than that by not
// rendering other chapters' fact pins.
//
// RE-MEASURED in review round 2, after the scope reader was narrowed to a
// pure-chapter-marker parenthesis and reader-safety labels were exempted from
// scoping altogether: Franklin's SAFETY rules are book-wide again, which adds
// 871 chars back to every chapter EXCEPT ch03 — and ch03 is the binding chapter,
// so the budgets are unmoved. Worst kind per chapter on this commit:
//   ch01 learning-pack 51,160   ch02 51,252   ch03 52,849 (binding)   ch04 51,097
//   ch05-ch08 (no scoped rules) 50,154
//   with worst-case prose: 58,450 / 58,542 / 60,139 (binding) / 58,387 / 57,444
// That leaves 151 characters of headroom on the binding packet-only card and 361
// with prose, so the next prompt package almost certainly re-pins here — with the
// same kind of measured rationale, not by rounding the number up.
//
// RE-PINNED by package 1B (grounding redesign), which is the "next prompt package"
// the paragraph above predicted. Measured on this commit with the same loop below
// (largest scar file + a real voice card, every chapter, all four kinds):
//   worst packet-only card  53,390 chars  (ch03 learning-pack, the binding render)
//   worst with-prose card   61,188 chars  (ch03 learning-pack + worst-case prose)
// Rounded UP to the next 500 (53,500 / 61,500) with no extra headroom added this
// time — the previous 500-char headroom is exactly what this package spent.
//
// WHAT THE PACKAGE ADDED, and why each line is prompt text rather than a gate note:
// every one of them is a rule the gates now enforce and the writer was not told.
//   summary  — teach each case ONCE in the prose, then rotate which detail each unit
//              uses (SEC14/SEC129, replacing the retired per-unit token quota); the
//              memorable-line rule inverted to a ONE-specific cap (SEC16/SEC118/
//              SEC135); the tier-roles line gained its measurables (SEC130/SEC131).
//   example  — one pooled specific instead of two, and the explicit ban on getting it
//              in by having the character recall the source (SEC33/SEC133); whyItMatters
//              explains the fact's mechanism (SEC39).
//   learning — citation by natural reference (SEC55/SEC120), transfer measured on the
//              stem (SEC117), absolutes symmetric and the tell budget as a rate
//              (SEC52/SEC116), qualifier-shape parity (SEC134), opener variety (SEC132).
// The summary and example cards stay far below the binding learning card; the
// summary contract's memorable-line paragraph is SHORTER than the one it replaced.
//
// RE-MEASURED AGAIN on the Franklin scar rewrite (PR #538), on top of package 1B,
// because the round-2 paragraph above describes a scar file that no longer exists:
// origin/main's 37 accreted prohibitions were replaced by 42 source-quoted rules,
// of which 32 are labelled for one chapter (30 FACT PINs + 2 NAMED ACTOR rules),
// leaving 10 book-wide. What shrank is not the FILE, it is the RENDER — the rules
// a chapter's writer actually receives. renderBookScarsBlock over each shipped
// file, in characters, measured on THIS merge's renderer:
//   origin/main's file  ch01 14,449  ch02 14,541  ch03 16,138  ch04 14,386  ch05 13,443
//   this branch's file  ch01  6,989  ch02  7,619  ch03  9,283  ch04  7,344  ch05  5,352
// ch03 is still the binding chapter: 12 of the 32 chapter-scoped rules, against
// 6 for ch01, 8 for ch02 and 6 for ch04, plus the 10 book-wide rules (3 SAFETY +
// 7 craft) every chapter gets. (Re-measured in review round 4, which restored
// three chapter-scoped pins the round-3 ledger had wrongly dispositioned away:
// the kite pin and the personal-vs-civic-funds pin on ch03, the notebook pin on
// ch02. ch03 grew 656 chars, ch02 280; nothing book-wide changed, so ch01, ch04
// and ch05+ are unmoved.) The per-card consequence of that 6,855-char drop on
// ch03 is measured at each budget below, on the merge.

// MERGE RE-PIN — this package merged origin/main (package 1B, grounding redesign)
// after both had independently re-pinned the same two budgets. 1B measured
// 53,390 / 61,188 for its contract lines; this package measured 54,179 / 61,445 for
// R-055's READ-ONLY CONTEXT block. Neither number bounds the merged render, so the
// budgets below are RE-MEASURED on the merge with the same loop and the same
// arithmetic (worst case rounded UP to the next 500, plus one further 500 of stated
// headroom), not taken as the larger of the two. Worst kind per chapter ON THE MERGE:
//   ch01 learning-pack 53,031   ch02 53,123   ch03 54,720 (binding)   ch04 52,968
//   ch05-ch08 (no scoped rules) 52,025
//   with worst-case prose: 60,321 / 60,413 / 62,010 (binding) / 60,258 / 59,315
// 54,720 -> 55,000 -> 55,500 and 62,010 -> 62,500 -> 63,000.
// The source-text budgets below are re-measured the same way in the same run.
// RE-PINNED for wave-1 source-ingestion (R-055). The package adds one block to
// the writer card — the chapter's focus, coreClaim, hardEdge and up to six
// keyClaims. Worst kind per chapter, MEASURED on this commit:
//   ch01 learning-pack 52,490   ch02 52,582   ch03 54,179 (binding)   ch04 52,427
//   ch05-ch08 (no scoped rules) 51,484
//   with worst-case prose: 59,756 / 59,848 / 61,445 (binding) / 59,693 / 58,750
// Budgets = that worst case rounded UP to the next 500 (54,179 -> 54,500;
// 61,445 -> 61,500) plus one further 500 of stated headroom, which is the same
// arithmetic the previous pin used.
//
// REVIEW ROUND 2 re-measured these. Round 1 pinned 53,843 / 61,133 for a render
// that carried chapterContext INSIDE the packet JSON; the fix moves it out into
// its own labelled READ-ONLY block, whose header prose costs +336 characters on
// every card (53,843 -> 54,179). The budgets do not move: 54,179 still rounds to
// 54,500 and 61,445 still rounds to 62,000.
// MERGE RE-MEASURE (1C + wave-1, origin/main d6bf5933d). Same loop, same arithmetic.
// Worst kind per chapter ON THIS MERGE:
//   ch01 learning-pack 52,309   ch02 52,401   ch03 53,998 (binding)   ch04 52,246
//   ch05-ch08 (no scoped rules) 51,303
//   with worst-case prose: 59,599 / 59,691 / 61,288 (binding) / 59,536 / 58,593
// 53,998 -> 54,000 -> 54,500 and 61,288 -> 61,500 -> 62,000 by the stated arithmetic,
// both BELOW the pins already standing (the merged render is 722 chars smaller on the
// binding card than the 54,720 measured pre-merge). The budgets therefore do not move;
// they keep their headroom and this measurement is the baseline the next creep is read
// against.
//
// MERGE RE-MEASURE (PR #538's Franklin scar rewrite x origin/main 9df63c5c5). The
// scar block renders INTO this card, so the rewrite had to be re-measured here, not
// argued from the pre-merge numbers. Same loop, same arithmetic. Worst kind per
// chapter ON THIS MERGE (learning-pack every time; reproduce by printing md.length
// in the loop below):
//   ch01 44,849   ch02 45,479   ch03 47,143 (binding)   ch04 45,204
//   ch05-ch08 (no scoped rules) 43,212
//   with worst-case prose: 52,139 / 52,769 / 54,433 (binding) / 52,494 / 50,502
// 47,143 -> 47,500 -> 48,000 and 54,433 -> 54,500 -> 55,000 by the stated arithmetic,
// both BELOW the pins standing above; every card is exactly 6,855 chars smaller than
// the 1C+wave-1 merge measured (53,998 / 61,288), which is ch03's scar-block drop
// (16,138 -> 9,283) to the character. The budgets therefore DO NOT MOVE: they are a
// ceiling on what production may send, not a target, and lowering them to one book's
// current scar file would re-pin the contract to one config file. That leaves 8,357
// characters of headroom on the binding packet-only card and 8,567 with prose.
// SEC136 RE-MEASURE: the summary card's MUST TEACH list adds ~960 chars. Measured
// across every scoped chapter of the largest-scar book, the heaviest summary render
// is ch3 at 44,476 (+960) and the BINDING kind is still learning-pack at
// 47,143 — both well under this budget, which is therefore left unchanged.
const HONEST_TASK_CHAR_BUDGET = 55_500;
const HONEST_LEARNING_WITH_PROSE_CHAR_BUDGET = 63_000;

/**
 * The SOURCE-TEXT budgets (review round 2, finding 2).
 *
 * Round 1 re-pinned the budget above on a MODEL-MEMORY sidecar, which carries no
 * sourceQuote and no hardSpecificEvidence, so the one thing this package adds to
 * a packet rendered as nothing and the pin had zero coverage of the route the
 * package exists to build. These are the same renders on `sourceTextSidecar()` —
 * the largest packet the pipeline can now produce (MAX_RESEARCH_UNITS = 2, so 18
 * testable facts and 6 named examples), every quote at the MAX_SOURCE_QUOTE_CHARS
 * ceiling, a proposition behind every hardSpecific.
 *
 * ITS QUOTES ARE REAL BOOK TEXT. An invented string of the right length measures
 * the wrong card: printed prose carries the straight quotes and newlines that
 * JSON.stringify escapes into two characters. The fixture takes distinct
 * 240-character quotes out of the frozen Franklin slice, which costs 939
 * characters more on the binding card than the synthetic string it replaced
 * (85,690 -> 86,629) — the whole reason to measure this route on a real text.
 *
 * RE-MEASURED ON THE MERGE with origin/main (package 1B), worst kind per chapter:
 *   ch01 learning-pack 85,481   ch02 85,573   ch03 87,170 (binding)   ch04 85,418
 *   ch05-ch08 84,475
 *   with worst-case prose: 92,771 / 92,863 / 94,460 (binding) / 92,708 / 91,765
 * Budgets = 87,170 -> 87,500 -> 88,000 and 94,460 -> 94,500 -> 95,000, the same
 * arithmetic as above. (Every card grew by exactly the 541 chars 1B's contract
 * lines cost, so the source-text OVERHEAD below is unchanged to the character.)
 *
 * WHERE THAT 32,450 OVER THE MODEL-MEMORY CARD COMES FROM (measured by stripping
 * one field at a time from the same packet, binding ch03 card: 87,170 full,
 * 81,743 with no sourceQuote, 77,975 with neither sourceQuote nor
 * specificPropositions, against the model-memory card's 54,720):
 *   +23,255  the packet is simply BIGGER — 18 facts and 6 cases instead of 9 and
 *            2. Nothing in this package renders those; a model-memory packet with
 *            18 facts costs the same, and always did. What R-058 changed is that
 *            an oversized unit now REQUIRES that many, so the big card went from
 *            possible to likely.
 *    +5,427  the sourceQuote on each of the 24 items, already bounded to
 *            PROJECTED_SOURCE_QUOTE_CHARS (200) by boundSourceQuoteForCard — the
 *            same bound the whole-chapter projection applies.
 *    +3,768  R-056's specificPropositions, one per hardSpecific.
 *
 * THE LIVE ROUTE IS CHEAPER, and is pinned separately below.
 * buildSectionTaskMarkdown is PURE_RETAINED in the legacy-route inventory: it
 * renders the RAW packet and no v25 route calls it. The card the v25 writer
 * actually receives is buildAuthorCard's, which renders the slim projection.
 */
/*
 * MERGE RE-MEASURE (1C + wave-1). Worst kind per chapter ON THIS MERGE:
 *   ch01 learning-pack 84,536   ch02 84,628   ch03 86,225 (binding)   ch04 84,473
 *   ch05-ch08 83,530
 *   with worst-case prose: 91,826 / 91,918 / 93,515 (binding) / 91,763 / 90,820
 * 86,225 -> 86,500 -> 87,000 and 93,515 -> 93,500 -> 94,000, both below the pins
 * already standing (the merged binding card is 945 chars smaller than the 87,170
 * measured pre-merge). The budgets do not move.
 *
 * MERGE RE-MEASURE (#538's scar rewrite x origin/main 9df63c5c5). Worst kind per
 * chapter ON THIS MERGE:
 *   ch01 learning-pack 77,076   ch02 77,706   ch03 79,370 (binding)   ch04 77,431
 *   ch05-ch08 75,439
 *   with worst-case prose: 84,366 / 84,996 / 86,660 (binding) / 84,721 / 82,729
 * 79,370 -> 79,500 -> 80,000 and 86,660 -> 87,000 -> 87,500 by the same arithmetic,
 * both below the pins standing here — again exactly 6,855 chars under the 1C+wave-1
 * numbers (86,225 / 93,515), the same ch03 scar-block drop. The budgets do not move;
 * headroom is 8,630 on the binding card and 8,340 with prose.
 */
const HONEST_SOURCE_TEXT_TASK_CHAR_BUDGET = 88_000;
const HONEST_SOURCE_TEXT_WITH_PROSE_CHAR_BUDGET = 95_000;

/**
 * The LIVE v25 writer card had no length pin at all before this package; it gets
 * one here, because a source-text packet is the largest input it has ever taken.
 * MEASURED on the same two fixtures, ch03, with the Franklin voice card:
 *   model-memory 15,854   source-text worst case 30,045
 * Budget = 30,045 -> 30,500 -> 31,000, the same arithmetic. It is far below the
 * section card above because buildAuthorCard renders the PROJECTION, whose quotes
 * are bounded and whose per-fact prose is trimmed.
 */
// MERGE RE-MEASURE (1C + wave-1): model-memory 15,845, source-text worst case 29,865
// (was 15,854 / 30,045 pre-merge). 29,865 -> 30,000 -> 30,500 by the same arithmetic,
// below the standing pin; 31,000 holds.
// MERGE RE-MEASURE (#538's scar rewrite x origin/main 9df63c5c5): model-memory 15,845,
// source-text worst case 29,865 — UNCHANGED to the character, because buildAuthorCard
// renders the projection and the voice card and never the scars block, so a scar-file
// rewrite cannot move this pin. 31,000 holds, with 1,135 chars of headroom.
const HONEST_AUTHOR_CARD_CHAR_BUDGET = 31_000;

test("R-002: the prompt-length budget is pinned on a render that carries BOTH large per-book blocks", () => {
  const scars = loadBookScars(LARGEST_SCAR_BOOK);
  const card = voiceCard(LARGEST_SCAR_BOOK);
  // The two assertions that make the budget below mean something. A fixture that
  // silently loses either block measures a prompt production never sends — the exact
  // way the ratio pins above stopped bounding anything.
  assert.ok(scars, `${LARGEST_SCAR_BOOK} must have a scar file; this budget is measured on it`);
  assert.ok(card, `${LARGEST_SCAR_BOOK} must resolve a voice card; a null card measures a prompt with no register instruction`);

  const bp = realisticFixtureFor(LARGEST_SCAR_BOOK);
  const args = (kind: SectionKind, chapterNumber: number) => ({
    bookId: LARGEST_SCAR_BOOK,
    kind,
    // Only the chapter NUMBER varies across the loop below, which is exactly the
    // input the scar filter reads (R-274): everything else about the render is held
    // constant, so each iteration measures one chapter's rule set and nothing else.
    blueprint: { ...bp.blueprint, chapterNumber },
    sourcePacket: bp.packet,
    outputPath: `/tmp/${kind}.json`,
    context: { voiceCard: card, bookScars: scars },
  });

  // EVERY chapter, not just ch01. Since R-274 the rendered rule set differs per
  // chapter, so measuring one chapter would leave the heaviest one unbounded —
  // Franklin's ch03 carries 12 of the 32 scoped rules and is the binding render.
  //
  // The range is a LITERAL, deliberately: an earlier cut derived it from
  // bookRuleChapters, so the budget loop re-used the very scope reader it was
  // supposed to bound and could not have noticed a chapter the reader mis-scoped
  // out of existence. MEASURED_CHAPTERS covers every chapter this file labels
  // (1-4) with room either side; the assertion below pins that the labels have not
  // drifted past it.
  const MEASURED_CHAPTERS = [1, 2, 3, 4, 5, 6, 7, 8];
  const labelled = new Set<number>();
  for (const rule of scars!.prohibitions) for (const chapterNumber of bookRuleChapters(rule)) labelled.add(chapterNumber);
  assert.ok(labelled.size > 1, "this book's rules must actually be chapter-scoped, or the loop measures one render eight times");
  for (const chapterNumber of labelled) {
    assert.ok(MEASURED_CHAPTERS.includes(chapterNumber), `ch${chapterNumber} is scoped by a rule but outside MEASURED_CHAPTERS; widen the literal range`);
  }

  for (const chapterNumber of MEASURED_CHAPTERS) {
    for (const kind of SECTION_KINDS) {
      const md = buildSectionTaskMarkdown(args(kind, chapterNumber));
      assert.match(md, /NON-NEGOTIABLE RULES FOR THIS BOOK/, `ch${chapterNumber} ${kind}: the scars block must actually render into the measured task`);
      assert.match(md, /VOICE CARD/, `ch${chapterNumber} ${kind}: the voice card must actually render into the measured task`);
      assert.ok(
        md.length <= HONEST_TASK_CHAR_BUDGET,
        `ch${chapterNumber} ${kind}: rendered ${md.length} chars against a ${HONEST_TASK_CHAR_BUDGET}-char budget; re-pin only with a written rationale`,
      );
    }

    // The production learning card also carries the chapter's drafted prose (Task 11ai).
    const withProse = buildSectionTaskMarkdown({ ...args("learning-pack", chapterNumber), chapterProse: worstCaseChapterProse() });
    assert.ok(
      withProse.length <= HONEST_LEARNING_WITH_PROSE_CHAR_BUDGET,
      `ch${chapterNumber} learning-pack with prose: rendered ${withProse.length} chars against a ${HONEST_LEARNING_WITH_PROSE_CHAR_BUDGET}-char budget; re-pin only with a written rationale`,
    );
  }
});

test("R-046: the SOURCE-TEXT prompt-length budget is pinned on a packet that actually carries quotes", async () => {
  const scars = loadBookScars(LARGEST_SCAR_BOOK);
  const card = voiceCard(LARGEST_SCAR_BOOK);
  const bp = sourceTextFixtureFor(LARGEST_SCAR_BOOK);

  // The assertions that make the budget mean something: this fixture must really
  // be the source-text route, or it measures the model-memory card twice.
  assert.equal(bp.packet.sourceProvenance, "source-text", "the fixture must compile to a source-text packet");
  assert.equal(bp.packet.facts.length, 9 * MAX_RESEARCH_UNITS, "the fixture must carry the R-058 oversized-unit fact floor");
  assert.equal(bp.packet.namedCases.length, 3 * MAX_RESEARCH_UNITS, "the fixture must carry the R-058 oversized-unit case floor");
  assert.ok(bp.packet.facts.every((f) => typeof f.sourceQuote === "string" && f.sourceQuote.length > 0), "every fact must carry a quote");
  assert.ok(bp.packet.namedCases.every((c) => (c.specificPropositions ?? []).length > 0), "every case must carry its R-056 propositions");

  for (const chapterNumber of [1, 2, 3, 4, 5, 6, 7, 8]) {
    for (const kind of SECTION_KINDS) {
      const md = buildSectionTaskMarkdown({ bookId: LARGEST_SCAR_BOOK, kind, blueprint: { ...bp.blueprint, chapterNumber }, sourcePacket: bp.packet, outputPath: `/tmp/${kind}.json`, context: { voiceCard: card, bookScars: scars } });
      assert.match(md, /"sourceQuote"/, `ch${chapterNumber} ${kind}: the book's own words must actually reach the measured card`);
      assert.ok(
        md.length <= HONEST_SOURCE_TEXT_TASK_CHAR_BUDGET,
        `ch${chapterNumber} ${kind}: rendered ${md.length} chars against a ${HONEST_SOURCE_TEXT_TASK_CHAR_BUDGET}-char source-text budget; re-pin only with a written rationale`,
      );
    }
    const withProse = buildSectionTaskMarkdown({ bookId: LARGEST_SCAR_BOOK, kind: "learning-pack", blueprint: { ...bp.blueprint, chapterNumber }, sourcePacket: bp.packet, outputPath: "/tmp/learning-pack.json", context: { voiceCard: card, bookScars: scars }, chapterProse: worstCaseChapterProse() });
    assert.ok(
      withProse.length <= HONEST_SOURCE_TEXT_WITH_PROSE_CHAR_BUDGET,
      `ch${chapterNumber} learning-pack with prose: rendered ${withProse.length} chars against a ${HONEST_SOURCE_TEXT_WITH_PROSE_CHAR_BUDGET}-char source-text budget; re-pin only with a written rationale`,
    );
  }

  // The card the v25 writer actually receives — pinned for the first time here.
  const { buildAuthorCard } = await import("../src/orchestrator/authorRun.js");
  for (const fixture of [realisticFixtureFor(LARGEST_SCAR_BOOK), bp]) {
    const authorCard = buildAuthorCard({ bookId: LARGEST_SCAR_BOOK, chapterNumber: 3, briefMd: "# brief\n", packet: fixture.packet, voice: card });
    assert.ok(
      authorCard.length <= HONEST_AUTHOR_CARD_CHAR_BUDGET,
      `whole-chapter author card rendered ${authorCard.length} chars against a ${HONEST_AUTHOR_CARD_CHAR_BUDGET}-char budget; re-pin only with a written rationale`,
    );
  }
});

// ── R-005 — the contract must not countermand the card it just handed the writer.
//
// "short sentences, plain verbs" was stated UNCONDITIONALLY in the summary
// universalCore, twice more as the no-card fallback, and a fourth time inside
// voiceCardSection — the ONE site that fires only when a card exists, so it
// contradicted the card it had just introduced. Six of the 60 shipped author-voice
// profiles ask for a longer, measured cadence, and the released Franklin book's own
// scar note says "a run of sub-seven-word declaratives is a spice, not a default
// register" (config/book-scars/the-autobiography-of-benjamin-franklin.json).
//
// The ship gate agrees with the scar note, not with the contract:
// E8.monotone_cadence (src/critics/prose.ts:270, MAJOR in critics/finalGate.ts:378)
// fires on a run of >=7 same-length short sentences, and E7.long_sentence
// (src/critics/plainLanguage.ts, cap 34 words) fires on the run-on at the other end.
// The rewritten rule states that pair instead of a single hardcoded rhythm.
test("R-005: the contract asks for varied cadence and never hardcodes 'short sentences'", () => {
  for (const kind of SECTION_KINDS) {
    // money-book resolves no voice card, so any "short sentences" in these renders is
    // the CONTRACT's own instruction, never a card's chosen rhythm.
    assert.doesNotMatch(renderTask("money-book", kind), /short sentences/i, `${kind}: the contract must not hardcode a sentence length`);
  }
  const summary = renderTask("money-book", "summary-pack");
  assert.match(summary, /Vary sentence length/, "the tier-floor rule asks for varied length instead");
  assert.match(summary, /never a run of same-length short declaratives/, "and names the defect the ship gate actually raises");

  // The register note that INTRODUCES a card must not restate a rhythm the card may
  // have just contradicted.
  const learning = renderTask(LARGEST_SCAR_BOOK, "learning-pack");
  assert.match(learning, /VOICE CARD — register note/, "this render carries a card");
  assert.doesNotMatch(learning, /register — plain verbs, short sentences/, "the register note no longer overrides the card it just introduced");
});

// ── R-005 (review round 2) — the replacement rule must not overstate the gate
//    either. The first cut shipped "(E7/E8 block both)" into every summary writer
//    prompt. Neither critic blocks and neither runs at this gate:
//      - E8.monotone_cadence is severity "major" (src/critics/finalGate.ts:378) and
//        its own registry comment calls it a "SHADOW major: surfaces as QC debt but
//        does not block (ENFORCED_MAJOR stays empty)" (finalGate.ts:372-378);
//      - E7.long_sentence is likewise "major" (finalGate.ts:384), not a blocker;
//      - ENFORCED_MAJOR (finalGate.ts:607-611) holds only EW1.invented_witness,
//        SEAM1.adjacent_duplicate_word and SEAM2.verbatim_repetition;
//      - both run in finalGate (checkSentenceLengthVariance at finalGate.ts:946,
//        checkPlainLanguage at :970) — chapter assembly, not sectionGate.
//    Telling a writer a shadow major "blocks" is the same defect this package
//    refused to ship for the per-tier reading-ease floor: a contract sentence that
//    says something false about what is checked. The rule states the severity that
//    exists, and this pins it.
test("R-005: the tier-floor rule states E7/E8's real severity, not a block", () => {
  const summary = renderTask("money-book", "summary-pack");
  assert.doesNotMatch(summary, /E7\/E8 block/, "E8 is a shadow major and E7 is a major; neither blocks");
  assert.doesNotMatch(summary, /\bE[78][^.]{0,80}\bblocks?\b/, "no E7/E8 sentence may claim a block");
  assert.match(
    summary,
    /E7\.long_sentence and E8\.monotone_cadence each raise a major at chapter assembly/,
    "the rule names the severity the critics actually carry, and where they run",
  );
});

// ── R-004 (review round 2) — the card must NAME the record it echoes.
//
//    R-004 asked for two halves: parse the run's frozen authorVoice into voiceCard()
//    through sanitizeVoiceMoves, AND name that record in the contract. The parser
//    shipped; the naming did not, so the block introduced itself only as "how THIS
//    book sounds" and a writer holding both the card and the source packet could not
//    tell they are one voice. The packet's freeze carries an "## Author voice" block
//    (Register / Signature moves / Avoid moves — src/researcher.ts:958-964), and
//    voiceCard()'s three sources are the editor charter, the curated author-voice
//    profile, and that frozen block (src/lib/voiceCard.ts, voiceCard()). The header
//    names all three rather than asserting one, because which source fired is not
//    knowable from the card string.
test("R-004: the VOICE CARD block names the voice record it was rendered from", () => {
  const summary = renderTask(LARGEST_SCAR_BOOK, "summary-pack");
  assert.match(summary, /VOICE CARD \u2014 how THIS book sounds/, "this render carries a full card");
  assert.match(summary, /the book's own voice record/, "the full card names the record it renders");
  assert.match(summary, /"Author voice" block/, "and points at the block frozen into the source packet");

  const action = renderTask(LARGEST_SCAR_BOOK, "action-pack");
  assert.match(action, /VOICE CARD \u2014 register note/, "this render carries a register note");
  assert.match(action, /same book voice record/, "the note ties itself to the same record the summary writer matched");
});

test("book-scars loader: real seed files load; unknown book is null; malformed fails loud", () => {
  const pom = loadBookScars("the-power-of-moments");
  assert.ok(pom, "POM has a scar file");
  assert.ok(pom!.phrases.includes("red phone by the pool"));
  assert.equal(loadBookScars("zz-fixture-no-scar-file"), null, "a book with no file returns null");

  // Shape validation throws on drift.
  assert.throws(() => validateBookScars({ bookId: "x", phrases: "nope", frames: [], notes: [] }, "x"), /phrases must be an array/);
  assert.throws(() => validateBookScars({ bookId: "other", phrases: [], frames: [], notes: [] }, "x"), /does not match its filename/);

  // A malformed on-disk file fails loud (not silently ignored).
  const dir = resolve(PIPELINE_DIR, "config", "book-scars");
  const bad = resolve(dir, "zz-fixture-bad-scar.json");
  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(bad, JSON.stringify({ bookId: "zz-fixture-bad-scar", phrases: [], frames: [], notes: [] }), "utf8");
    assert.throws(() => loadBookScars("zz-fixture-bad-scar"), /no phrases, frames, notes, or prohibitions/);
  } finally {
    rmSync(bad, { force: true });
  }
});

test("book-scars: prohibitions render as absolute rules, never under the over-use quota", () => {
  // The whole point of the channel. phrases/frames/notes render under a header
  // granting a quota of one and telling the writer to paraphrase the item
  // everywhere else — filing a safety rule there instructs the model to restate
  // the unsafe line in different words.
  const scars = validateBookScars({
    bookId: "zz-scar-render",
    phrases: ["an over-used case phrase"],
    frames: [],
    notes: [],
    prohibitions: ["SAFETY: never tell the reader to do the dangerous thing."],
  }, "zz-scar-render");
  const md = buildSectionTaskMarkdown({
    bookId: "zz-scar-render",
    kind: "summary-pack",
    blueprint: minimalBlueprint("zz-scar-render"),
    sourcePacket: PACKET,
    outputPath: "/tmp/summary.json",
    context: { voiceCard: null, bookScars: scars },
  });

  const hardAt = md.indexOf("NON-NEGOTIABLE RULES FOR THIS BOOK");
  const overUseAt = md.indexOf("KNOWN OVER-USED MATERIAL FOR THIS BOOK");
  assert.ok(hardAt >= 0, "prohibitions must render their own block");
  assert.ok(overUseAt >= 0, "over-used material still renders");
  assert.ok(hardAt < overUseAt, "prohibitions must come BEFORE the over-use block");
  assert.match(md, /carry no quota/, "the prohibition block must deny the quota explicitly");

  // The prohibition text must not fall inside the over-use block.
  const overUseBlock = md.slice(overUseAt);
  assert.doesNotMatch(overUseBlock, /never tell the reader to do the dangerous thing/,
    "a prohibition rendered under the over-use header would be budgeted and paraphrased");

  // A book with only prohibitions must not emit an empty over-use scaffold.
  const onlyHard = validateBookScars({
    bookId: "zz-scar-render", phrases: [], frames: [], notes: [],
    prohibitions: ["SAFETY: never do the thing."],
  }, "zz-scar-render");
  const md2 = buildSectionTaskMarkdown({
    bookId: "zz-scar-render", kind: "summary-pack", blueprint: minimalBlueprint("zz-scar-render"),
    sourcePacket: PACKET, outputPath: "/tmp/summary.json",
    context: { voiceCard: null, bookScars: onlyHard },
  });
  assert.match(md2, /NON-NEGOTIABLE RULES FOR THIS BOOK/);
  assert.doesNotMatch(md2, /KNOWN OVER-USED MATERIAL FOR THIS BOOK/, "no empty over-use scaffolding");
});

test("book-scars: a filename differing only by a leading article fails loud, never silently", () => {
  // autobiography-of-benjamin-franklin.json sat unread for the entire canary
  // while its book compiled as the-autobiography-of-benjamin-franklin. A missing
  // file is a legitimate no-op for most books, so the near-miss produced no
  // signal at all — including for a fact pin written straight off a panel FAIL.
  const dir = resolve(PIPELINE_DIR, "config", "book-scars");
  const stray = resolve(dir, "zz-fixture-article.json");
  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(stray, JSON.stringify({
      bookId: "zz-fixture-article", phrases: ["x"], frames: [], notes: [],
    }), "utf8");
    assert.throws(
      () => loadBookScars("the-zz-fixture-article"),
      /differs only by a leading article|zz-fixture-article\.json exists/,
      "the-<slug> must not silently miss <slug>.json",
    );
  } finally {
    rmSync(stray, { force: true });
  }
});

test("book-scars: every shipped scar file loads under the bookId the pipeline derives", () => {
  // Pins the wiring end of the same defect: a shipped file whose name does not
  // match a real derived bookId is dead weight that reads as protection. Reads the
  // DIRECTORY rather than a hardcoded list, so a file added later is covered too.
  const dir = resolve(PIPELINE_DIR, "config", "book-scars");
  const shipped = readdirSync(dir)
    .filter((f) => f.endsWith(".json") && f !== "book-scars.schema.json" && !f.startsWith("zz-fixture-"))
    .map((f) => f.replace(/\.json$/, ""));
  assert.ok(shipped.length >= 4, `expected the shipped scar files, found: ${shipped.join(", ")}`);
  for (const bookId of shipped) {
    const scars = loadBookScars(bookId);
    assert.ok(scars, `${bookId} must load`);
    assert.equal(scars!.bookId, bookId, "a file's bookId must round-trip its filename");
  }
  const franklin = loadBookScars("the-autobiography-of-benjamin-franklin")!;
  assert.ok(franklin.prohibitions.some((p) => /Silence Dogood|age sixteen/i.test(p)), "Dogood fact pin survives");
  assert.ok(franklin.prohibitions.some((p) => /shared or public property without permission/i.test(p)), "street-work safety rule present");
  assert.ok(franklin.prohibitions.some((p) => /COUNT (CONSISTENCY|SELF-DESCRIPTION)/.test(p)), "virtue count rule present");
  // BANNED VARIANTS must not sit in the over-use channel, where each would be
  // granted one permitted use. (Genuine echo-prone strings — "copper, silver,
  // and gold" — are the channel's proper cargo and are allowed.)
  assert.ok(
    !franklin.phrases.some((p) => /not yet sixteen|before age sixteen|nine years still owed|skip the permit/i.test(p)),
    "banned variants must not be filed as over-used phrases",
  );
  const allen = loadBookScars("as-a-man-thinketh")!;
  assert.ok(allen.prohibitions.some((p) => /no exceptions/i.test(p)), "absolutist wording is banned, not rationed");
  assert.ok(!allen.phrases.some((p) => /no exceptions/i.test(p)), "must not remain in the quota channel");
});

test("book-scars: an unknown key fails loud instead of silently dropping its rules", () => {
  // config/book-scars/ is never reached by validateAllConfigFiles (it reads config/
  // non-recursively), so the schema's additionalProperties:false never executes.
  // Misspelling `prohibitions` must not silently discard every safety rule.
  assert.throws(
    () => validateBookScars({
      bookId: "x", phrases: [], frames: [], notes: [],
      prohibition: ["SAFETY: never do the dangerous thing."],
    }, "x"),
    /unknown key\(s\): prohibition/,
  );
  // Documentation-only keys stay accepted.
  const ok = validateBookScars({
    $schema: "./book-scars.schema.json", _comment: "why", bookId: "x",
    phrases: ["p"], frames: [], notes: [], prohibitions: ["SAFETY: no."],
  }, "x");
  assert.equal(ok.prohibitions.length, 1);
});

// ── R-274 — a book's rules are rendered for the chapter being written ─────────
//
// Every one of Franklin's 37 prohibitions rendered into all 16 section-writer
// prompts. 16 of them scope themselves to the chapter they govern ("FACT PIN
// (ch03): …"), so a ch01 writer was handed 12 pins that cannot apply to the
// chapter in front of it — 4,736 characters of Franklin's 15,760-character
// prohibition block, measured on the shipped file. (18 labels carry a chapter
// marker; the two SAFETY ones are exempt from scoping — see the reader-safety
// test below.)
//
// The scope is read from the rule's own LABEL (the text before its first colon),
// never from its body: "TIER CONTRACT: … (ch02: …)" illustrates its rule with a
// chapter example and still governs the whole book.
test("R-274: a chapter-labelled prohibition renders only into its own chapter's prompt", () => {
  const scars = validateBookScars({
    bookId: "zz-scope",
    phrases: [],
    frames: [],
    notes: ["Ground the city once, early."],
    prohibitions: [
      "FACT PIN (ch02): the letter was slipped under the door.",
      "TIER CONTRACT: the tiers are standalone summaries (ch02: the break leads to leaving).",
      "SAFETY: never tell the reader to skip the permit.",
    ],
  }, "zz-scope");
  const render = (chapterNumber: number): string => buildSectionTaskMarkdown({
    bookId: "zz-scope",
    kind: "summary-pack",
    blueprint: { ...minimalBlueprint("zz-scope"), chapterNumber },
    sourcePacket: PACKET,
    outputPath: "/tmp/summary.json",
    context: { voiceCard: null, bookScars: scars },
  });
  const ch01 = render(1);
  const ch02 = render(2);
  assert.doesNotMatch(ch01, /slipped under the door/, "a ch02 fact pin must not reach the ch01 writer");
  assert.match(ch02, /slipped under the door/, "and must reach the ch02 writer");
  for (const [label, md] of [["ch01", ch01], ["ch02", ch02]] as const) {
    assert.match(md, /never tell the reader to skip the permit/, `${label}: an unlabelled rule governs every chapter`);
    assert.match(md, /the tiers are standalone summaries/, `${label}: a chapter marker in the BODY does not scope a rule`);
  }
});

test("R-274: a chapter whose scoped rules all drop out renders no empty rules scaffold", () => {
  const scars = validateBookScars({
    bookId: "zz-scope-empty",
    phrases: ["an over-used case phrase"],
    frames: [],
    notes: [],
    prohibitions: ["FACT PIN (ch09): the ninth chapter's number is nine."],
  }, "zz-scope-empty");
  const md = buildSectionTaskMarkdown({
    bookId: "zz-scope-empty",
    kind: "summary-pack",
    blueprint: minimalBlueprint("zz-scope-empty"),
    sourcePacket: PACKET,
    outputPath: "/tmp/summary.json",
    context: { voiceCard: null, bookScars: scars },
  });
  assert.doesNotMatch(md, /NON-NEGOTIABLE RULES FOR THIS BOOK/, "no header with nothing under it");
  assert.match(md, /KNOWN OVER-USED MATERIAL FOR THIS BOOK/, "the over-use block is unaffected by chapter scope");
});

// R-274 review round 1 found the first cut of the scope reader too greedy: it took
// ANY parenthesised group in a label as a scope. The shipped corpus uses the same
// punctuation for PROVENANCE — where the scar came from — and two of those
// provenance notes name a chapter:
//   config/book-scars/how-to-live-on-24-hours-a-day.json
//     "GRADUALISM CONSISTENCY (panel blockers, ch07): … Every example, quiz key,
//      and card must agree … in any unit."
//     "STATED CAUSES ONLY (panel blocker, ch13): a unit may attribute an outcome
//      only to the cause the prose actually states … no card may re-attribute it."
// Both bodies are explicitly book-wide, and under the greedy reader every chapter
// of that book except 7 and 13 rendered NO rules block at all — a silent removal of
// a shipped book's only hard rules, on the writer lane and the repair lane both.
//
// A scope marker is now a parenthesis that contains NOTHING BUT chapter markers and
// separators: "(ch03)", "(ch01, ch03)". A parenthesis carrying any other word is
// provenance and scopes nothing.
test("R-274: a chapter named inside a PROVENANCE label does not scope the rule", () => {
  assert.deepEqual(bookRuleChapters("FACT PIN (ch03): the sweeper was paid by nearby households."), [3]);
  assert.deepEqual(bookRuleChapters("FACT PIN (ch01, ch03): two chapters, one pin."), [1, 3]);
  assert.deepEqual(
    bookRuleChapters("GRADUALISM CONSISTENCY (panel blockers, ch07): the span is grown gradually in every unit."),
    [],
    "a parenthesis carrying words beyond chapter markers is provenance, not scope",
  );
  assert.deepEqual(
    bookRuleChapters("STATED CAUSES ONLY (panel blocker, ch13): attribute only the cause the prose states."),
    [],
  );
  assert.deepEqual(bookRuleChapters("SAFETY (panel blocker, round 11): name the authority."), []);

  // …and end to end, on the shipped file that carries the shape.
  const scars = loadBookScars("how-to-live-on-24-hours-a-day")!;
  // The regression is about the two PROVENANCE-labelled rules staying book-wide, so
  // it is pinned on those two rules rather than on a count of the file's contents —
  // a count a legitimate config edit changes (R-278 added an absolute phrase ban here).
  const provenanceScoped = scars.prohibitions.filter((rule) => /^(GRADUALISM CONSISTENCY|STATED CAUSES ONLY)\b/.test(rule));
  assert.equal(provenanceScoped.length, 2, "this book's two provenance-labelled rules are what the regression is about");
  for (const rule of provenanceScoped) {
    assert.deepEqual(bookRuleChapters(rule), [], `a provenance parenthesis must not scope: ${rule.split(":", 1)[0]}`);
  }
  for (const chapterNumber of [1, 2, 5, 7, 13]) {
    const md = buildSectionTaskMarkdown({
      bookId: "how-to-live-on-24-hours-a-day",
      kind: "summary-pack",
      blueprint: { ...minimalBlueprint("how-to-live-on-24-hours-a-day"), chapterNumber },
      sourcePacket: PACKET,
      outputPath: "/tmp/summary.json",
      context: { voiceCard: null, bookScars: scars },
    });
    assert.match(md, /GRADUALISM CONSISTENCY/, `ch${chapterNumber}: a book-wide rule must reach every chapter`);
    assert.match(md, /STATED CAUSES ONLY/, `ch${chapterNumber}: a book-wide rule must reach every chapter`);
  }
});

// Reader safety is the one class where a narrowing mistake harms the reader, so it
// is never chapter-scoped, whatever a label says. Franklin's two SAFETY rules are
// labelled "(ch03)" because that is the episode the panel blocked on, but their
// bodies govern every modern example and every action step the book produces
// ("Any modern example shows permission-and-funding ON THE PAGE"; "never apply the
// organize-and-fund-it-yourselves pattern to ARMED patrols … in a modern analog"),
// and example/action packs are written for every chapter. A code rule rather than a
// config edit, because the config edit can be undone by a later label trim without
// anyone noticing which class of rule it just narrowed.
test("R-274: a reader-safety rule is never narrowed to one chapter", () => {
  assert.deepEqual(
    bookRuleChapters("SAFETY (ch03): never advise beginning work on shared property without permission."),
    [],
    "a SAFETY label governs the whole book even with a pure chapter marker",
  );
  assert.deepEqual(bookRuleChapters("READER SAFETY (ch09): name the professional standard."), []);
  assert.deepEqual(bookRuleChapters("FACT PIN (ch09): the ninth chapter's number is nine."), [9], "…and nothing else changes");

  const franklin = loadBookScars("the-autobiography-of-benjamin-franklin")!;
  const md = buildSectionTaskMarkdown({
    bookId: "the-autobiography-of-benjamin-franklin",
    kind: "action-pack",
    blueprint: { ...minimalBlueprint("the-autobiography-of-benjamin-franklin"), chapterNumber: 1 },
    sourcePacket: PACKET,
    outputPath: "/tmp/action.json",
    context: { voiceCard: null, bookScars: franklin },
  });
  assert.match(md, /shared or public property without permission/, "the ch01 action writer gets the public-property rule");
  assert.match(md, /organize-and-fund-it-yourselves pattern to ARMED patrols/, "…and the armed-patrol rule");
});

test("R-274: every shipped scar file keeps at least one rule that governs every chapter", () => {
  // The corpus-level guard on the scope reader. A book whose rules ALL read as
  // chapter-scoped renders no rules block for most of its chapters, which is how
  // the greedy first cut removed how-to-live-on-24-hours-a-day's only hard rules
  // from eleven of its thirteen chapters without a single test noticing.
  const dir = resolve(PIPELINE_DIR, "config", "book-scars");
  const shipped = readdirSync(dir)
    .filter((f) => f.endsWith(".json") && f !== "book-scars.schema.json" && !f.startsWith("zz-fixture-"))
    .map((f) => f.replace(/\.json$/, ""));
  for (const bookId of shipped) {
    const scars = loadBookScars(bookId)!;
    if (scars.prohibitions.length === 0) continue;
    const bookWide = scars.prohibitions.filter((rule) => bookRuleChapters(rule).length === 0);
    assert.ok(
      bookWide.length > 0,
      `${bookId}: every one of its ${scars.prohibitions.length} rules reads as chapter-scoped, so most chapters would render no rules block at all`,
    );
  }
});

// ── R-008 — notes are not over-use material ──────────────────────────────────
//
// Every `notes` entry was pushed into the over-use list under a header granting
// each item "at most one teaching unit book-wide; paraphrase the mechanism
// everywhere else". Franklin's notes include two panel-blocker pins (CHRONOLOGY,
// CONSISTENCY) and three cadence rules, so the header told the writer to use each
// of them once and paraphrase them elsewhere — the same inversion the prohibition
// channel exists to prevent, one channel further down.
test("R-008: scar notes render under a no-quota header, never under the over-use quota", () => {
  const scars = validateBookScars({
    bookId: "zz-notes",
    phrases: ["an over-used case phrase"],
    frames: [],
    notes: ["CHRONOLOGY PIN: the library predates the fire company."],
    prohibitions: [],
  }, "zz-notes");
  const md = buildSectionTaskMarkdown({
    bookId: "zz-notes",
    kind: "summary-pack",
    blueprint: minimalBlueprint("zz-notes"),
    sourcePacket: PACKET,
    outputPath: "/tmp/summary.json",
    context: { voiceCard: null, bookScars: scars },
  });
  const notesAt = md.indexOf("STYLE NOTES FOR THIS BOOK");
  const overUseAt = md.indexOf("KNOWN OVER-USED MATERIAL FOR THIS BOOK");
  assert.ok(notesAt >= 0, "notes must carry their own header");
  assert.ok(overUseAt > notesAt, "the over-use quota block still renders, after the notes");
  assert.doesNotMatch(md.slice(overUseAt), /the library predates the fire company/,
    "a note under the over-use header would be rationed to one use and paraphrased everywhere else");
  assert.match(md.slice(notesAt, overUseAt), /apply throughout/, "the notes header states they are always in force");

  // A book with notes but no over-used material must not emit an empty quota block.
  const onlyNotes = validateBookScars({
    bookId: "zz-notes", phrases: [], frames: [], notes: ["Ground the city once, early."], prohibitions: [],
  }, "zz-notes");
  const md2 = buildSectionTaskMarkdown({
    bookId: "zz-notes", kind: "summary-pack", blueprint: minimalBlueprint("zz-notes"),
    sourcePacket: PACKET, outputPath: "/tmp/summary.json",
    context: { voiceCard: null, bookScars: onlyNotes },
  });
  assert.match(md2, /STYLE NOTES FOR THIS BOOK/);
  assert.doesNotMatch(md2, /KNOWN OVER-USED MATERIAL FOR THIS BOOK/, "no empty over-use scaffolding");
});

// ── R-009 — no line may claim a gate reads a field no gate reads ─────────────
//
// Four Layer-2 lines ended "the validator enforces this" for the DEALT fields
// (sceneFrame/requiredBeat, promptShape/answerStyle/distractorTrap/caseCueIds,
// frontShape/retrievalTarget/backShape, practiceForm/practiceConstraint/
// ifThenPlanShapes). `grep -a` over src/sections/sectionGate.ts finds sceneFrame
// only inside advisory message strings and the others nowhere, so the claim was
// false and, worse, the four rules it decorated are the ones only the writer can
// keep. The obedience stays; the false enforcement claim goes.
const DEALT_FIELD_TOKENS = [
  "sceneFrame/requiredBeat",
  "promptShape",
  "frontShape",
  "practiceForm",
];

test("R-009: no dealt-field instruction claims the validator enforces it", () => {
  for (const kind of SECTION_KINDS) {
    for (const line of sectionContract(kind).split("\n")) {
      const dealt = DEALT_FIELD_TOKENS.find((token) => line.includes(token));
      if (!dealt) continue;
      const claimAt = line.indexOf("the validator enforces this");
      if (claimAt < 0) continue;
      assert.ok(
        line.indexOf(dealt) > claimAt,
        `${kind}: "${dealt}" is covered by an enforcement claim no gate backs:\n${line}`,
      );
    }
  }
  // And the obedience survives, stated as the craft rule it is.
  assert.match(sectionContract("learning-pack"), /no gate reads them/i);
  assert.match(sectionContract("action-pack"), /no gate reads/i);
});

// ── R-012 — what a longer tier must ADD ─────────────────────────────────────
test("R-012: the summary contract states what each tier ADDS, not only its length", () => {
  const summary = sectionContract("summary-pack");
  assert.match(summary, /TIER ROLES/);
  assert.match(summary, /fastRead[^\n]*immediate move/);
  assert.match(summary, /deepRead[^\n]*mechanism/);
  assert.match(summary, /fullRead[^\n]*(hard edge|limit)/);
  assert.match(summary, /never reuses a deepRead sentence|no fullRead sentence reuses/i);
});

// ── R-013 — the dealt card/action shapes are staging directions ─────────────
//
// The example pack has carried "STAGING DIRECTIONS, not text" since P07; cards and
// actions never did, and the dealt CARD_BACK_SHAPES pool is phrased as literal
// openers ("start with the contrast"). The shipped Franklin book opens a card back
// "The contrast is" in 4 of 4 chapters.
test("R-013: cards and actions get the staging-directions rule the example pack has", () => {
  const learning = sectionContract("learning-pack");
  assert.match(learning, /STAGING DIRECTIONS/);
  assert.match(learning, /The contrast is/, "the observed literal opener is named as forbidden");
  const action = sectionContract("action-pack");
  assert.match(action, /STAGING DIRECTIONS/);
  assert.match(action, /twentyFourHourChallenge[^\n]*trigger/);
});

// ── R-015 — the style exemplar must obey the same prompt's bans ─────────────
test("R-015: the KEEP-VERBATIM voice exemplar uses no soft-banned phrase", () => {
  const summary = sectionContract("summary-pack");
  const exemplar = summary.split("\n").find((line) => line.startsWith("VOICE — narrate the real cases"))!;
  assert.ok(exemplar, "the exemplar paragraph must still be there");
  for (const entry of loadBannedPhrases().softBanned as Array<{ phrase: string }>) {
    assert.ok(
      !exemplar.toLowerCase().includes(entry.phrase.toLowerCase()),
      `the exemplar the writer is told to imitate uses the soft-banned "${entry.phrase}"`,
    );
  }
});

// ── R-017 — choice parity is measured in characters too ────────────────────
test("R-017: CHOICE PARITY names the character half of the gate and never parks overflow in the explanation", () => {
  const learning = sectionContract("learning-pack");
  const parity = learning.split("\n").find((line) => line.includes("CHOICE PARITY"))!;
  assert.ok(parity, "the CHOICE PARITY method must still be there");
  assert.match(parity, /character/i, "SEC53 measures characters as well as words");
  assert.doesNotMatch(parity, /moving overflow into the explanation/,
    "that instruction mints the disclaiming explanation the panel flagged");
  assert.match(parity, /explanation/, "it must still say what the explanation is for");
});

// ── R-014 — the writer is told every phrase that fails its draft ────────────
test("R-014: the DO NOT block discloses the whole hard-banned list, rendered from config", () => {
  const lines = sectionDoNotLines("compiler/ch01/summary-pack.json").join("\n");
  const config = loadBannedPhrases();
  for (const entry of config.hardBanned as Array<{ phrase: string }>) {
    assert.ok(lines.includes(entry.phrase), `hard-banned "${entry.phrase}" is never disclosed to the writer`);
  }
  for (const entry of config.softBanned as Array<{ phrase: string; perBookBudget: number }>) {
    assert.ok(lines.includes(entry.phrase), `soft-banned "${entry.phrase}" is never disclosed to the writer`);
  }
  // Budgets, not just names: "chapter argues that" has a budget of 0 and "rather
  // than" a budget of 15, and a writer told only "avoid these" cannot tell them apart.
  assert.match(lines, /chapter argues that[^\n]*0/);
  assert.match(lines, /rather than[^\n]*15/);
});

// ── R-018 / R-019 — the live DIRECT_JSON card ──────────────────────────────
test("R-018: every task card names the chapter it is writing", () => {
  const bp = realisticFixture();
  for (const kind of SECTION_KINDS) {
    for (const deliveryMode of ["DIRECT_JSON", "FILE_WRITE"] as const) {
      const md = buildSectionTaskMarkdown({
        bookId: "money-book", kind, blueprint: bp.blueprint, sourcePacket: bp.packet,
        outputPath: `/tmp/${kind}.json`, context: { voiceCard: null, bookScars: null }, deliveryMode,
      });
      const inputs = md.slice(md.indexOf("INPUTS"), md.indexOf("\n\nTASK"));
      assert.match(inputs, /chapterTitle: Optimize Your Credit Cards/, `${kind}/${deliveryMode}: the writer is never told the chapter's title`);
    }
  }
});

test("R-019: the live DIRECT_JSON card says a deterministic gate will validate the draft", () => {
  const bp = realisticFixture();
  const md = buildSectionTaskMarkdown({
    bookId: "money-book", kind: "summary-pack", blueprint: bp.blueprint, sourcePacket: bp.packet,
    outputPath: "/tmp/summary.json", context: { voiceCard: null, bookScars: null }, deliveryMode: "DIRECT_JSON",
  });
  assert.match(md, /validated externally by deterministic section gates/,
    "without it, ~20 lines ending 'the validator enforces this' name a validator the card never introduces");
});

// ── R-011 — the retry card states the rule the gate actually applies ────────
test("R-011: the anchor-specifics enumeration states the gate's real matching rule", () => {
  const bp = realisticFixture();
  const anchor = bp.packet.allowedAnchors.find((a) => (a.hardSpecifics ?? []).length >= 2)!;
  const md = buildSectionTaskMarkdown({
    bookId: "money-book", kind: "summary-pack", blueprint: bp.blueprint, sourcePacket: bp.packet,
    outputPath: "/tmp/summary.json", context: { voiceCard: null, bookScars: null },
    retryFeedback: {
      blockerLines: [`breakdown.fastRead cites ${anchor.id} but uses 0/2 required hardSpecifics verbatim; build the unit from the anchor's concrete details`],
      priorDraft: { hook: "x" },
    },
  });
  assert.match(md, /REQUIRED VERBATIM SPECIFICS/, "the enumeration must still fire");
  // The gate has folded an in-order clipped match since the Franklin pincer fix
  // (sectionGate.ts clippedPhraseDerivable, SUBSEQUENCE_GAP_TOKENS = 8), so the
  // card must not tell the writer that only an exact substring counts.
  assert.doesNotMatch(md, /Copy the listed strings into the cited unit verbatim/,
    "the gate accepts a naturalized in-order rendering; telling the writer to paste is what mints the seam");
  assert.doesNotMatch(md, /capitalizing the first letter of a specific that opens a sentence/,
    "this steered the raw token to sentence-initial position");
  assert.match(md, /in order/i, "state the fold the gate applies");
  assert.match(md, /eight words/i, "and the bounded gap it allows");
});
