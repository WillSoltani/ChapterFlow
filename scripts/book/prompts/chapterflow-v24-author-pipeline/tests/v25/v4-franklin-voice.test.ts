/**
 * Q05 (wave Q, tone levers L1-L5 + existence-proof lever 3): the writers get the
 * book's own words, and the voice lanes stop asking for maxims and chopped sentences.
 *
 * Tone is the rubric factor below its floor on rr21 (median 68 < 70). Every reader
 * rationale names the same thing: a flat narrator cadence of short declaratives and
 * generic parable prose where the author's dry irony should be. The four verified
 * causes this file pins the fix for:
 *   L1 research verified the author's own quotations and per-chapter voiceCues, and
 *      nothing ever reached a writer (0 quotation marks in 20,560 tier words);
 *   L2 four contract lines asked for principle sentences, so paragraphs ended on
 *      maxims (3.1% of tier sentences against 0.6% in the source);
 *   L3 the SEC12 retry feedback said "prefer short sentences", so accepted prose
 *      averages 12.4 words a sentence against the author's 30;
 *   L4 the repair/editor voice line still said "plain verbs, short sentences".
 * Owner decisions: D18 = A (quote at most two research-verified lines per chapter,
 * verbatim, quoted and attributed; never a line that demeans a people), D17 = A (the
 * scar file's prohibitions, and so the pinned research run's configHash, untouched).
 *
 * Hermetic: every fixture is a COPY of a real pinned-run sidecar under
 * tests/fixtures/q05, and no model is called.
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { SECTION_KINDS, type SectionKind, type SourcePacketV1, type SummaryPackV1, type ChapterBlueprintV1 } from "../../src/artifacts/artifactTypes.js";
import { buildChapterEditorCard, CHAPTER_EDITOR_BRIEF } from "../../src/app/chapterEditorContract.js";
import { buildRepairWritingContract } from "../../src/app/candidateRepairWritingContract.js";
import { compileChapterBlueprint } from "../../src/compiler/chapterBlueprint.js";
import { compileSourcePacketFromSidecar, sourcePacketHash } from "../../src/compiler/sourcePacket.js";
import { writerPacketProjection } from "../../src/compiler/sourcePacketProjection.js";
import { checkBreakdownReadingEase, checkReadingLevel } from "../../src/critics/readingLevel.js";
import { loadBookScars } from "../../src/lib/bookScars.js";
import { researchConfigHash } from "../../src/lib/researchRunManifest.js";
import { voiceCard } from "../../src/lib/voiceCard.js";
import { buildAuthorCard } from "../../src/orchestrator/authorRun.js";
import { validateSummaryPack } from "../../src/sections/sectionGate.js";
import { buildSectionTaskMarkdown, renderBookScarsBlock, sectionContract } from "../../src/sections/sectionTasks.js";
import type { SourceSidecarV2 } from "../../src/source/sidecarSchema.js";
import type { SourceAnchorForPrompt } from "../../src/types.js";
import { finishV25Tests, requiredTest } from "./harness.js";
import { bytes as repairBytes, rig } from "./repairPortRig.js";
import { reverseSubstituteQ05ContractLines as reverseSubstitute } from "./q05ChangedContractLines.js";

const FRANKLIN = "the-autobiography-of-benjamin-franklin";
const FIXTURES = resolve(dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "q05");

/** D18, verbatim. The summary writer's quotation block must carry exactly this. */
const D18_RULE = "Quote at most two of these lines verbatim, in quotation marks and attributed, inside deepRead or fullRead where that moment is narrated; let the line carry the irony and do not explain it; never turn a quoted line into indirect speech; never quote a line that demeans a people.";

const CARLISLE_QUOTE = "Let this be for the Indians to get drunk with";
const CH15_EXCLUDED_CUE = "folds a racially charged period joke into political commentary without separate condemnation, reflecting the era's casual language";

function sha(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function realSidecar(chapterNumber: 13 | 15 | 19): SourceSidecarV2 {
  return JSON.parse(readFileSync(resolve(FIXTURES, `franklin-ch${chapterNumber}.source.json`), "utf8")) as SourceSidecarV2;
}

function build(bookId: string, chapterNumber: number, sidecar: SourceSidecarV2): { packet: SourcePacketV1; blueprint: ChapterBlueprintV1 } {
  const chapter = { chapterId: `${bookId}-ch${String(chapterNumber).padStart(2, "0")}`, chapterNumber, chapterTitle: String((sidecar as { chapterTitle?: string }).chapterTitle ?? "Chapter") };
  const packet = compileSourcePacketFromSidecar({ bookId, chapter, sidecar, sidecarPath: `/tmp/ch${chapterNumber}.source.json`, sourceHash: "hash" });
  const blueprint = compileChapterBlueprint({ bookId, chapter, packet, packetPath: `/tmp/ch${chapterNumber}.source-packet.json` });
  return { packet, blueprint };
}

/** Voice card on, scars OFF: the scar notes are Franklin data this package edits on
 *  purpose and are pinned by their own test below, so the byte-identity proofs keep
 *  them out of the card they hash. */
function card(bookId: string, kind: SectionKind, fx: { packet: SourcePacketV1; blueprint: ChapterBlueprintV1 }, deliveryMode: "FILE_WRITE" | "DIRECT_JSON" = "FILE_WRITE"): string {
  return buildSectionTaskMarkdown({ bookId, kind, blueprint: fx.blueprint, sourcePacket: fx.packet, outputPath: `/tmp/${kind}.json`, context: { voiceCard: voiceCard(bookId), bookScars: null }, deliveryMode });
}

/** The non-Franklin fixture: the money-book sidecar the contract tests render. */
function moneySidecar(): SourceSidecarV2 {
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
    voiceCues: ["opens with a direct claim about a number", "addresses the reader as a borrower"],
    paraphraseNotes: "Keep numbers limited to the verified 300 to 850 score range.",
    testableFacts: facts,
  } as unknown as SourceSidecarV2;
}

/** Base values, pinned from renders at origin/main (before Q05). The packet hashes were
 *  taken at 496adf0d2 and re-measured unchanged at 60a25ad63 (#585, Q06, which does not
 *  touch the packet builder); the card shas are re-pinned from renders at 60a25ad63,
 *  because Q06 rewrote section-contract text on every card. */
const BASE = {
  moneyPacketHash: "sha256:707bcb7b5a1da21961f30e1d016d14da28ada791a44e6f4ace0690e51b866ddb",
  ch13PacketHash: "sha256:1eaba3a69138c0fe6d5ea1ad6385a9016b9201f170bb068a850d58b6894c93fc",
  ch15PacketHash: "sha256:41e5060051555fc52a7c65b1ebfe0c24548e688aac7d3a0a9e0038425d847f35",
  ch19PacketHash: "sha256:e96c81aaf86c4995f4468bf7674431e7a7b4eb3245e664e6d7e2c19fa665a1b8",
  /** The ch19 copy stamped model-memory / with no provenance field, built by the base
   *  compiler/sourcePacket.ts (496adf0d2; the same at 60a25ad63). */
  ch19ModelMemoryPacketHash: "sha256:eb696c2d504925f8eab9b95cd8edc1900a103d7b371cd4db02782338e27cf8f8",
  ch19UnstampedPacketHash: "sha256:fca000a83d1e034dabbf869dc2223e5d2dfaeb1f2c8337c397c67e27130db851",
  /** sha256 of each card (voice card on, scars off), keyed fixture.kind.mode. */
  cards: {
    "money.summary-pack.FILE_WRITE": "60fd51d46faa1ac32a411c2c8efe7d884ca33a97248b6b0b0c2757f39fe5d520",
    "money.summary-pack.DIRECT_JSON": "734289173b1da4705a762f338554d5406f604df1bfa6792641f00de71fdc567e",
    "money.example-pack.FILE_WRITE": "7ee47079c9d92e7b4cbfcd121299f542e3bc223a9671372d637fecd81b645622",
    "money.example-pack.DIRECT_JSON": "22d2d65312be722aae0083e4f96ac6835ea54934739b322e2f91bc9919ac8459",
    "money.learning-pack.FILE_WRITE": "b1cafbd013513bba79df058e9715f6b8b44a67553700236fff4616b6b495c314",
    "money.learning-pack.DIRECT_JSON": "abbf17d80d166d8cc34e3863e4fb1e81ab9a2082e334238e5d3aaf7eec4c432b",
    "money.action-pack.FILE_WRITE": "85cbb4795f7ade6c944895b059fcf2dc3b1466e082b63a534f8d2777dd7e6b9f",
    "money.action-pack.DIRECT_JSON": "3eae1f13fe1c3f36fb5700e27bf1c91faef1aaf667d29e98c3c52a3000ac646a",
    "ch13.summary-pack.FILE_WRITE": "5a557ecdaaabf1136b57067c9200cb6e4d95e11e97a8f992679a0c90a317205f",
    "ch13.summary-pack.DIRECT_JSON": "f5b18dca1929046a25f39ffaf6dfc774b12c3aa382a112eca79a922b9c5d5bb4",
    "ch13.example-pack.FILE_WRITE": "d6ef754aac2d339d1dfe5b6ddb69283a9efd4ff02294f697378a4dc468a8813c",
    "ch13.example-pack.DIRECT_JSON": "fde23de16e1d373154245c3229a3f5931e3e48a7090ee136d01b6fb3495c26b9",
    "ch13.learning-pack.FILE_WRITE": "d4b5cff62c17c46bc8ff136ef95466585249599fcb1190fe9fb8a8b9a340b729",
    "ch13.learning-pack.DIRECT_JSON": "40873a7316ac7f07b61a96c7e9be671e339e04a92b5c58f78da1a9694441ea1e",
    "ch13.action-pack.FILE_WRITE": "80232e34e68cbfb2aea35cc002ac62e13edea1236a96acabdbff2a538e4207bb",
    "ch13.action-pack.DIRECT_JSON": "d65e309fd52f7edc1fb5dd9ad12d1c36d284d8e438b75f9c198ddc78578ef589",
    "ch19.summary-pack.FILE_WRITE": "a75dcd35ff1295d4c7c0328f5f1ed5a2c434f32534dfb5129594cfc415901595",
    "ch19.summary-pack.DIRECT_JSON": "843721c22c36de55c8da8d3caede3c23dec339d9a5d9fd6737a0ca09375a474f",
    "ch19.example-pack.FILE_WRITE": "8abd7712462582a7e9a20c8a01d9f8acdc79a570178a85ce219eeaca7805e5ce",
    "ch19.example-pack.DIRECT_JSON": "4e5c9f231067a4b8d8e5531cd510867853f40e65a83a43d53bd1dbfd188eb146",
    "ch19.learning-pack.FILE_WRITE": "dda222caa974b05198529ae201b72ee4074df2b8e847e024f32446eab2076a66",
    "ch19.learning-pack.DIRECT_JSON": "18da6847ce8560ec7199d90bf51030b455134455f56bfdbd01df22f6677cb4a6",
    "ch19.action-pack.FILE_WRITE": "450fe16f7d795ebf65aafa809433cce2d0bbe466f408d437091a4ec3ada53ce5",
    "ch19.action-pack.DIRECT_JSON": "b003b3601cd37a07122d05920c951e3b581143f8fb5771ee48eb75c5924b1fb3",
  } as Record<string, string>,
};

// ---------------------------------------------------------------------------
// L1 — the packet carries the author's own words (and only where they exist)
// ---------------------------------------------------------------------------

requiredTest("Q05-L1 a quotation chapter's packet carries its quotations and voiceCues; the pinned exclusions never reach it", () => {
  const ch19 = build(FRANKLIN, 19, realSidecar(19)).packet as SourcePacketV1 & { quotations?: Array<{ quote: string; attributionFrame: string }>; voiceCues?: string[] };
  assert.ok(Array.isArray(ch19.quotations), "ch19 has two research-verified quotations; the packet must carry them");
  assert.deepEqual(ch19.quotations!.map((q) => q.quote), ["I find a low seat the easiest.", "he is like St. George on the signs, always on horseback, and never rides on"]);
  assert.ok(ch19.quotations!.every((q) => q.attributionFrame.includes(q.quote)), "each quotation travels with the attribution frame that contains it");
  assert.equal(ch19.voiceCues?.length, 4, "the chapter's voiceCues travel with its quotations");

  // ch13: the Carlisle orator's line is the chapter's ONLY quotation and D18 excludes
  // it, so neither field is set and the packet is the base packet, hash for hash.
  const ch13 = build(FRANKLIN, 13, realSidecar(13)).packet as SourcePacketV1 & { quotations?: unknown; voiceCues?: unknown };
  assert.equal("quotations" in ch13, false, "ch13's only quotation is excluded, so the packet carries none");
  assert.equal("voiceCues" in ch13, false, "no quotations left means no voiceCues either");
  assert.doesNotMatch(JSON.stringify(ch13), /get drunk with"/, "the excluded line never becomes a packet field");

  // The exclusion is by id, not by "drop the chapter": a second, benign line survives.
  const ch13Plus = realSidecar(13) as unknown as { quotations: Array<Record<string, string>> };
  ch13Plus.quotations.push({ id: "ch13.quote.test-benign", quote: "a benign test line", attributionFrame: "A test frame quotes \"a benign test line\".", sourceQuote: "a benign test line" });
  const ch13PlusPacket = build(FRANKLIN, 13, ch13Plus as unknown as SourceSidecarV2).packet as SourcePacketV1 & { quotations?: Array<{ quote: string }> };
  assert.deepEqual(ch13PlusPacket.quotations?.map((q) => q.quote), ["a benign test line"], "only the D18-excluded id is dropped");

  // ch15 carries the excluded voiceCue. Give its copy one quotation so the cues travel,
  // and the excluded cue must not travel with them.
  const ch15Plus = realSidecar(15) as unknown as { quotations?: Array<Record<string, string>>; voiceCues: string[] };
  assert.ok(ch15Plus.voiceCues.includes(CH15_EXCLUDED_CUE), "fixture: the real ch15 sidecar carries the excluded cue");
  ch15Plus.quotations = [{ id: "ch15.quote.test", quote: "a test line", attributionFrame: "A test frame quotes \"a test line\".", sourceQuote: "a test line" }];
  const ch15Packet = build(FRANKLIN, 15, ch15Plus as unknown as SourceSidecarV2).packet as SourcePacketV1 & { voiceCues?: string[] };
  assert.equal(ch15Packet.voiceCues?.length, 4, "four of ch15's five cues travel");
  assert.equal(ch15Packet.voiceCues?.includes(CH15_EXCLUDED_CUE), false, "the D18-excluded cue never reaches a writer");
});

requiredTest("Q05-L1 a packet with no quotations is the base packet: deep-equal shape and the pinned base sourcePacketHash", () => {
  const money = build("money-book", 1, moneySidecar()).packet;
  const ch13 = build(FRANKLIN, 13, realSidecar(13)).packet;
  const ch15 = build(FRANKLIN, 15, realSidecar(15)).packet;
  if (process.env.Q05_PRINT === "1") console.log(`Q05_PRINT moneyPacketHash=${sourcePacketHash(money)} ch13=${sourcePacketHash(ch13)} ch15=${sourcePacketHash(ch15)}`);
  // A quotation chapter differs from its base packet by the two new fields and nothing else.
  const ch19 = build(FRANKLIN, 19, realSidecar(19)).packet as SourcePacketV1 & { quotations?: unknown; voiceCues?: unknown };
  const { quotations: _q, voiceCues: _v, ...ch19Base } = ch19;
  if (process.env.Q05_PRINT === "1") console.log(`Q05_PRINT ch19PacketHash(stripped)=${sourcePacketHash(ch19Base as SourcePacketV1)}`);
  for (const packet of [money, ch13, ch15]) {
    assert.equal("quotations" in packet, false, `${packet.chapterId}: no quotation field`);
    assert.equal("voiceCues" in packet, false, `${packet.chapterId}: no voiceCues field`);
  }
  assert.equal(sourcePacketHash(money), BASE.moneyPacketHash, "a non-Franklin packet hashes exactly as at base");
  assert.equal(sourcePacketHash(ch13), BASE.ch13PacketHash, "Franklin ch13 (quotation excluded) hashes exactly as at base");
  assert.equal(sourcePacketHash(ch15), BASE.ch15PacketHash, "Franklin ch15 (no quotations) hashes exactly as at base");
  assert.equal(sourcePacketHash(ch19Base as SourcePacketV1), BASE.ch19PacketHash, "ch19 minus the two new fields is the base packet");
});

requiredTest("Q05-L1 only source-text research is 'checked verbatim': a model-memory (or unstamped) sidecar's quotations never reach a writer", () => {
  // Model-memory research never runs collectSourceQuoteProblems (researcher.ts
  // stampChapterProvenance), yet the chapter prompt allows 0-3 quotations on every
  // route. Such lines are recalled, not verified, so D18 ("research-verified lines")
  // bars them: no fields, the base packet hash, and no block on the summary card.
  // A sidecar with no provenance stamp (pre-R-046 runs) is treated the same way.
  const variants: Array<[string, (sidecar: Record<string, unknown>) => void, string]> = [
    ["model-memory", (sidecar) => { sidecar.sourceProvenance = "model-memory"; }, BASE.ch19ModelMemoryPacketHash],
    ["unstamped", (sidecar) => { delete sidecar.sourceProvenance; }, BASE.ch19UnstampedPacketHash],
  ];
  for (const [name, mutate, baseHash] of variants) {
    const sidecar = realSidecar(19) as unknown as Record<string, unknown>;
    mutate(sidecar);
    assert.equal((sidecar.quotations as unknown[]).length, 2, `fixture (${name}): the copy still carries ch19's two quotations`);
    const fx = build(FRANKLIN, 19, sidecar as unknown as SourceSidecarV2);
    assert.equal("quotations" in fx.packet, false, `${name}: unverified quotations never become a packet field`);
    assert.equal("voiceCues" in fx.packet, false, `${name}: and neither do the voiceCues`);
    assert.equal(sourcePacketHash(fx.packet), baseHash, `${name}: the packet hashes exactly as at base`);
    for (const mode of ["FILE_WRITE", "DIRECT_JSON"] as const) {
      const md = card(FRANKLIN, "summary-pack", fx, mode);
      assert.equal(md.includes("\n\nTHE BOOK'S OWN WORDS"), false, `${name} ${mode}: no quotation block renders`);
      assert.equal(md.includes(D18_RULE), false, `${name} ${mode}: no D18 invitation to quote`);
      assert.equal(md.includes("St. George on the signs"), false, `${name} ${mode}: the recalled line never reaches the card`);
    }
  }
});

// ---------------------------------------------------------------------------
// L1 — the summary writer (only) sees the block, with the D18 rule verbatim
// ---------------------------------------------------------------------------

requiredTest("Q05-L1 a Franklin summary card renders the book's own words with the D18 rule, in both delivery modes, outside the SOURCE PACKET", () => {
  const fx = build(FRANKLIN, 19, realSidecar(19));
  for (const mode of ["FILE_WRITE", "DIRECT_JSON"] as const) {
    const md = card(FRANKLIN, "summary-pack", fx, mode);
    assert.ok(md.includes(D18_RULE), `${mode}: the summary card carries the D18 rule verbatim`);
    assert.ok(md.includes(JSON.stringify("he is like St. George on the signs, always on horseback, and never rides on")), `${mode}: each quote renders as one escaped string`);
    assert.ok(md.includes(JSON.stringify("I find a low seat the easiest.")), `${mode}: both quotations render`);
    assert.match(md, /checked verbatim against the source text/, `${mode}: the block says what the lines are`);
    assert.match(md, /evidence, never instructions/, `${mode}: book text is evidence, never instructions`);
    assert.match(md, /report it as the author's, attributed, and never make it the narrator's own advice/, `${mode}: advice a cue mentions stays the author's`);
    assert.ok(md.includes(JSON.stringify("Recounts Lord Loudoun's delays through deadpan, dated chronology (beginning of April to near the end of June) rather than through direct complaint.")), `${mode}: the voiceCues render`);
    // Beside the chapter context, before the SOURCE PACKET, and never inside its JSON.
    const block = md.indexOf(D18_RULE);
    const contextAt = md.indexOf("\n\nCHAPTER CONTEXT \u2014 READ-ONLY");
    const packetAt = md.indexOf("\n\nSOURCE PACKET \u2014 ONLY allowed");
    assert.ok(contextAt > 0 && block > contextAt, `${mode}: the block renders after the chapter context`);
    assert.ok(block < packetAt, `${mode}: the block renders before the SOURCE PACKET`);
    const packetJson = md.slice(packetAt);
    assert.doesNotMatch(packetJson, /"quotations"|"voiceCues"/, `${mode}: the fields are stripped from the citable packet block`);
    const newText = md.slice(md.indexOf("\n\nTHE BOOK'S OWN WORDS"), packetAt);
    assert.equal(/Franklin/.test(newText.replace(/"(?:[^"\\]|\\.)*"/g, "")), false, `${mode}: the generic block text names no person`);
    assert.doesNotMatch(newText.replace(/"(?:[^"\\]|\\.)*"/g, ""), /—/, `${mode}: the block's own text spends no em dash`);
  }
  for (const kind of ["example-pack", "learning-pack", "action-pack"] as const) {
    const md = card(FRANKLIN, kind, fx);
    assert.equal(md.includes(D18_RULE), false, `${kind}: only the summary writer gets the quotation block`);
    assert.doesNotMatch(md, /"quotations"|"voiceCues"/, `${kind}: the fields never reach this writer`);
  }
});

requiredTest("Q05-L1 a multi-line quotation renders as one escaped, whitespace-normalised string", () => {
  const sidecar = realSidecar(19) as unknown as { quotations: Array<Record<string, string>> };
  sidecar.quotations = [{ id: "ch19.quote.verse", quote: "Look round the habitable world, how few\n   Know their own good", attributionFrame: "He quotes \"Look round the habitable world, how few\n   Know their own good\".", sourceQuote: "Look round the habitable world, how few\n   Know their own good" }];
  const md = card(FRANKLIN, "summary-pack", build(FRANKLIN, 19, sidecar as unknown as SourceSidecarV2));
  assert.ok(md.includes(JSON.stringify("Look round the habitable world, how few Know their own good")), "internal whitespace collapses to one space before escaping");
  assert.equal(md.includes("how few\n   Know"), false, "a raw newline from book text never enters the card");
});

requiredTest("Q05-L1 a quotation-less chapter's cards are the base cards: only the deliberate contract lines moved", () => {
  const print = process.env.Q05_PRINT === "1";
  const fixtures: Array<[string, string, { packet: SourcePacketV1; blueprint: ChapterBlueprintV1 }]> = [
    ["money", "money-book", build("money-book", 1, moneySidecar())],
    ["ch13", FRANKLIN, build(FRANKLIN, 13, realSidecar(13))],
    ["ch19", FRANKLIN, build(FRANKLIN, 19, realSidecar(19))],
  ];
  const checks: Array<() => void> = [];
  for (const [name, bookId, fx] of fixtures) {
    for (const kind of SECTION_KINDS) {
      for (const mode of ["FILE_WRITE", "DIRECT_JSON"] as const) {
        const key = `${name}.${kind}.${mode}`;
        const md = card(bookId, kind, fx, mode);
        if (name === "ch19" && kind === "summary-pack") continue; // the one card that gains the block
        const restored = reverseSubstitute(md);
        if (print) console.log(`Q05_PRINT card ${key} ${sha(restored)}`);
        checks.push(() => {
          assert.equal(sha(restored), BASE.cards[key], `${key}: after reverse-substituting the deliberate contract lines the card is the base card`);
          if (kind !== "summary-pack") assert.equal(restored, md, `${key}: no contract line of this kind changed`);
        });
      }
    }
  }
  // The ch19 summary card is the base card plus exactly the new block.
  const fx19 = fixtures[2][2];
  for (const mode of ["FILE_WRITE", "DIRECT_JSON"] as const) {
    const md = card(FRANKLIN, "summary-pack", fx19, mode);
    const start = md.indexOf("\n\nTHE BOOK'S OWN WORDS");
    const end = md.indexOf("\n\nSOURCE PACKET \u2014 ONLY allowed");
    const without = start >= 0 ? md.slice(0, start) + md.slice(end) : md;
    const key = `ch19.summary-pack.${mode}`;
    if (print) console.log(`Q05_PRINT card ${key} ${sha(reverseSubstitute(without))}`);
    checks.push(() => {
      assert.ok(start > 0 && end > start, `${mode}: the ch19 summary card renders the block`);
      assert.equal(sha(reverseSubstitute(without)), BASE.cards[key], `${key}: minus the block and the deliberate lines it is the base card`);
    });
  }
  for (const check of checks) check();
});

// ---------------------------------------------------------------------------
// L1 / N5 — the editor sees them; the v24 author card never does
// ---------------------------------------------------------------------------

requiredTest("Q05-L1 the chapter editor's SOURCE PACKET view carries the quotations; a quotation-less chapter's view is unchanged", () => {
  const editorCard = (packet: SourcePacketV1): string => buildChapterEditorCard({
    bookId: FRANKLIN, chapterId: packet.chapterId, chapterNumber: packet.chapterNumber, chapterTitle: packet.chapterTitle,
    voiceCard: voiceCard(FRANKLIN), bookScars: null, packs: {} as never, readerView: {}, sourcePacket: packet,
  });
  const ch19 = build(FRANKLIN, 19, realSidecar(19)).packet;
  const md = editorCard(ch19);
  const view = md.slice(md.indexOf("SOURCE PACKET: the only allowed"));
  assert.match(view, /"quotations": \[/, "the editor's packet view lists the quotations");
  assert.ok(view.includes(JSON.stringify("he is like St. George on the signs, always on horseback, and never rides on")), "quotes are JSON-escaped strings");
  assert.match(view, /"voiceCues": \[/, "and this chapter's voiceCues");
  const ch13 = build(FRANKLIN, 13, realSidecar(13)).packet;
  const md13 = editorCard(ch13);
  assert.ok(md13.includes(JSON.stringify(writerPacketProjection(ch13), null, 2)), "a quotation-less chapter renders exactly the projection it did");
  assert.doesNotMatch(md13, /"quotations"|"voiceCues"/);
});

requiredTest("Q05-L1 the v24 author card and its writerProjection are byte-identical with or without the new fields", () => {
  const ch19 = build(FRANKLIN, 19, realSidecar(19)).packet as SourcePacketV1 & { quotations?: unknown; voiceCues?: unknown };
  const { quotations: _q, voiceCues: _v, ...stripped } = ch19;
  const voice = voiceCard(FRANKLIN);
  const withFields = buildAuthorCard({ bookId: FRANKLIN, chapterNumber: 19, briefMd: "# brief\n", packet: ch19, voice });
  const without = buildAuthorCard({ bookId: FRANKLIN, chapterNumber: 19, briefMd: "# brief\n", packet: stripped as SourcePacketV1, voice });
  assert.equal(withFields, without, "the author card never renders the quotation fields");
  assert.equal(JSON.stringify(writerPacketProjection(ch19)), JSON.stringify(writerPacketProjection(stripped as SourcePacketV1)), "writerPacketProjection is unchanged");
  assert.doesNotMatch(withFields, /St\. George on the signs|"voiceCues"/);
});

/**
 * Round-3 review (MUST-FIX): the compiler stages the WHOLE packet at
 * compiler/chNN/source-packet.json, and the chapter-repair lane forwards those bytes
 * to its writer as the "source_packet" record, the one its control text calls the
 * only source of names, numbers and cases. The quotations and voiceCues must never
 * ride there: that writer gets none of the D18 framing (at most two, deepRead or
 * fullRead only, never indirect speech, cues are orientation only).
 */
requiredTest("Q05-L1 the chapter-repair writer's source_packet carries neither the quotations nor the voiceCues (real ch19)", async (context) => {
  const ch19 = build(FRANKLIN, 19, realSidecar(19)).packet;
  assert.equal(ch19.quotations?.length, 2, "the real ch19 packet carries its two quotations");
  assert.ok((ch19.voiceCues ?? []).length > 0, "and its voiceCues");
  const subject = rig(context, { packetOneFields: { quotations: ch19.quotations, voiceCues: ch19.voiceCues } });
  const staged = JSON.parse(Buffer.from(subject.predecessor.files.find((file) => file.logicalPath === "compiler/ch01/source-packet.json")!.bytes).toString("utf8")) as Record<string, unknown>;
  assert.ok("quotations" in staged && "voiceCues" in staged, "the staged candidate packet carries both fields (the compiler stages the full packet)");
  const result = await subject.port.run(subject.request);
  assert.equal(result.ok, true, JSON.stringify(result));
  const inputs = subject.prompts[0].prompt.inputs;
  const record = inputs.find((input) => input.name === "source_packet");
  assert.ok(record, "the repair writer still receives source_packet");
  const sent = JSON.parse(Buffer.from(record!.bytes).toString("utf8")) as Record<string, unknown>;
  assert.equal("quotations" in sent, false, "source_packet carries no quotations");
  assert.equal("voiceCues" in sent, false, "source_packet carries no voiceCues");
  const { quotations: _q, voiceCues: _v, ...rest } = staged;
  assert.deepEqual(Buffer.from(record!.bytes), repairBytes(rest), "every other packet field is sent exactly as staged");
  const everything = inputs.map((input) => Buffer.from(input.bytes).toString("utf8")).join("\n");
  for (const entry of ch19.quotations!) {
    assert.equal(everything.includes(entry.quote) || everything.includes(JSON.stringify(entry.quote).slice(1, -1)), false, `no repair input carries: ${entry.quote}`);
  }
  for (const cue of ch19.voiceCues!) {
    assert.equal(everything.includes(cue) || everything.includes(JSON.stringify(cue).slice(1, -1)), false, `no repair input carries the cue: ${cue}`);
  }
});

requiredTest("Q05-L1 a quotation-less packet reaches the chapter-repair writer byte-identical to the staged file", async (context) => {
  const subject = rig(context);
  const result = await subject.port.run(subject.request);
  assert.equal(result.ok, true, JSON.stringify(result));
  const record = subject.prompts[0].prompt.inputs.find((input) => input.name === "source_packet");
  assert.deepEqual(
    Buffer.from(record!.bytes),
    Buffer.from(subject.predecessor.files.find((file) => file.logicalPath === "compiler/ch01/source-packet.json")!.bytes),
  );
});

// ---------------------------------------------------------------------------
// L2 + lever 3 — no maxims, the author's own self-judgement kept
// ---------------------------------------------------------------------------

requiredTest("Q05-L2 the editor brief asks for concrete, quotable lines and carries a VOICE entry; the maxim and coaching invitations are gone", () => {
  const memorable = CHAPTER_EDITOR_BRIEF.find((line) => line.startsWith("MEMORABLE LINES."))!;
  assert.doesNotMatch(memorable, /so the principle stands on its own/, "the brief must stop asking for a standalone principle");
  assert.match(memorable, /concrete, quotable line/);
  assert.match(memorable, /never add a new maxim, and never end a paragraph on one/);
  const voice = CHAPTER_EDITOR_BRIEF.find((line) => line.startsWith("VOICE."));
  assert.ok(voice, "the editor brief carries a VOICE entry");
  assert.match(voice!, /hook, fastRead, counterintuition and the fullRead close/);
  assert.match(voice!, /the author's own dry self-judgement/);
  assert.match(voice!, /no reader-directed moral tag line/);
  assert.match(voice!, /verbatim, in quotation marks and attributed, at most two in the whole chapter, never a line that demeans a people/);
  const tiers = CHAPTER_EDITOR_BRIEF.find((line) => line.startsWith("TIERS."))!;
  assert.doesNotMatch(tiers, /immediate move/);
  assert.match(tiers, /fastRead gives the core idea and why it matters/);
  for (const line of CHAPTER_EDITOR_BRIEF) {
    assert.doesNotMatch(line, /—/, "no em dash in the brief");
    assert.doesNotMatch(line, /Franklin/, "the brief is shared by every book");
  }
});

requiredTest("Q05-L2 the summary contract caps standalone principle sentences and never invites the coaching tag line", () => {
  const summary = sectionContract("summary-pack");
  assert.doesNotMatch(summary, /immediate move/);
  assert.match(summary, /fastRead gives the core idea and why it matters/);
  assert.match(summary, /At most one standalone principle sentence per tier, never a paragraph's last\./);
  // The validated voice paragraph is untouched, THEN-name-the-principle included.
  assert.match(summary, /let the reader briefly FEEL the moment, THEN name the principle it proves\./);
});

requiredTest("Q05-L2 the memorable-line floors stay satisfiable with one standalone principle per tier, none paragraph-final (real gate)", () => {
  const anchor: SourceAnchorForPrompt = {
    id: "ch19.case.loudoun", kind: "named_example", label: "Loudoun's delays",
    text: "Lord Loudoun kept the packet boats waiting for his letters for weeks.",
    hardSpecifics: ["Lord Loudoun", "packet boats"],
    supportsClaimTypes: ["memorable_line", "breakdown_claim", "hook", "takeaway"],
  };
  const packet = { allowedAnchors: [anchor], facts: [], namedCases: [], allowedEntities: [], allowedPlaces: [] } as unknown as SourcePacketV1;
  const bp = { chapterNumber: 19, chapterId: "zz-q05-ch19", sections: { quiz: [], cards: [], examples: [] }, constraints: { allowedFactIds: [], allowedCaseIds: [], forbiddenClaims: [], forbiddenLeakage: [], bannedHouseTics: [] } } as unknown as ChapterBlueprintV1;
  const ids = [anchor.id];
  // One standalone principle sentence per tier (the second sentence of a paragraph),
  // every paragraph ending on the concrete moment.
  const fastRead = [
    "The general wrote letters every day, and the boats sat at the wharf waiting for them.",
    "A leader who never finishes a task keeps everyone else waiting too.",
    "The captains paced the dock while the tide came and went twice.",
  ].join(" ");
  const deepRead = [
    "Week after week the messenger came back with the same news, and the ships still did not sail.",
    "Delay costs more when other people must stand still for it.",
    "By June the merchants had paid for months of idle crews and spoiled stores.",
  ].join(" ");
  const fullRead = [
    "He had been sent to lead the war in the colonies, and he spent the spring at his desk.",
    "Motion on paper is not the same as motion on the road.",
    "When the fleet finally left, the season for a campaign was nearly gone.",
  ].join(" ");
  const pack = {
    schemaVersion: "section-artifact-v1", artifactType: "summary-pack", chapterId: bp.chapterId,
    hook: { hook: "The boats waited at the wharf while the general wrote one more letter.", sourceAnchorIds: ids },
    breakdown: { fastRead, deepRead, fullRead, sourceAnchorIds: { fastRead: ids, deepRead: ids, fullRead: ids } },
    keyTakeaway: "A plan that never leaves the desk costs everyone who waits on it.",
    keyTakeawaySourceAnchorIds: ids,
  } as unknown as SummaryPackV1;
  const findings = validateSummaryPack(pack, bp, packet);
  const memorableFamily = findings.filter((f) => /^SEC(15|16|17|118|135)\./.test(f.checkId));
  assert.deepEqual(memorableFamily.map((f) => `${f.checkId}: ${f.message}`), [], "SEC15/SEC16/SEC17/SEC118/SEC135 must all pass");
});

// ---------------------------------------------------------------------------
// L3 — SEC12 feedback: shorter words first, then only the longest sentence
// ---------------------------------------------------------------------------

requiredTest("Q05-L3 the SEC12 feedback and the summary contract say shorter words first and never 'shorten sentences'", () => {
  const dense = "Notwithstanding considerable institutional hesitation, the administration's comprehensive deliberations regarding infrastructural appropriations necessitated extraordinarily complicated negotiations, and consequently the representatives' accumulated recommendations were systematically reconsidered throughout the subsequent legislative consultations.";
  const grade = checkReadingLevel(dense, "fastRead");
  assert.ok(grade.length > 0, "fixture: the dense text must trip the grade ceiling");
  const ease = checkBreakdownReadingEase(dense);
  assert.ok(ease.length > 0, "fixture: the dense text must trip the ease floor");
  for (const message of [...grade.filter((f) => f.checkId === "prose.reading_level"), ...ease].map((f) => f.message)) {
    assert.doesNotMatch(message, /shorten sentences/i, message);
    assert.doesNotMatch(message, /prefer short sentences/i, message);
    assert.match(message, /shorter common words first \(keep every name and date\), then split only the longest sentence/, message);
    assert.match(message, /a long clause-linked sentence of short words passes/, message);
  }
  const summary = sectionContract("summary-pack");
  assert.match(summary, /Use shorter common words first \(keep every name and date\), then split only the longest sentence; a long clause-linked sentence of short words passes\./);
  // Thresholds unchanged.
  assert.match(summary, /no sentence over 30 words/);
  assert.match(summary, /fastRead >=350 chars at grade <=7 .*deepRead >=1000 chars at grade <=8\.5 .*fullRead >=2400 chars at grade <=9\.5 .*Flesch ease >=70\./);
});

// ---------------------------------------------------------------------------
// L4 — the repair/editor voice line
// ---------------------------------------------------------------------------

requiredTest("Q05-L4 the repair/editor voice line no longer asks for short sentences", () => {
  for (const lane of [undefined, "editor"] as const) {
    const contract = buildRepairWritingContract({ voiceCard: "voice: dry, self-aware irony", ...(lane ? { lane } : {}) } as Parameters<typeof buildRepairWritingContract>[0]);
    const line = contract.split("\n").find((l) => l.startsWith("- Keep explanations and actions in this register too"));
    assert.ok(line, `${lane ?? "repair"}: the voice trailer is still there`);
    assert.doesNotMatch(line!, /short sentences/, `${lane ?? "repair"}: ${line}`);
    assert.equal(line, "- Keep explanations and actions in this register too, not a neutral textbook voice.");
  }
});

// ---------------------------------------------------------------------------
// L5 — Franklin's style notes; the research configHash does not move
// ---------------------------------------------------------------------------

const STYLE_NOTES = [
  "fastRead, deepRead and fullRead narrate Franklin's life; they never address the reader or give advice.",
  "Let his comic and self-mocking details stand as he tells them; never explain the joke away.",
  "Never announce a limit or nuance ('worth noticing', 'looked at closely'); state it inside the story.",
];

requiredTest("Q05-L5 the three Franklin STYLE NOTES load and render; prohibitions and the research configHash are unchanged", () => {
  const scars = loadBookScars(FRANKLIN)!;
  for (const note of STYLE_NOTES) {
    assert.ok(scars.notes.includes(note), `missing style note: ${note}`);
    assert.ok(renderBookScarsBlock(scars, 3).includes(`- ${note}`), `the note renders under STYLE NOTES: ${note}`);
  }
  assert.equal(scars.prohibitions.length, 42, "D17: the prohibitions are untouched");
  assert.equal(
    researchConfigHash(scars.prohibitions),
    "23b47ae0597dd2818c27765c929959c2f005afb3173f7e40481f0ae2e34ecbd8",
    "the pinned research run's compatibility.configHash must not move (D17)",
  );
});

finishV25Tests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
