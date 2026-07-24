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
 *  4. a token-count regression bound: every rendered task is <= 62% of the pinned
 *     pre-refactor length (the full-blueprint duplication was dropped; re-pinned
 *     60->62% for Task 11z's functional quiz-specifics preflight — a deliberate,
 *     tested addition, not prose creep).
 *  5. class-B gate-restatement prose was actually deleted (only the ~8 design-around
 *     rules survive, each naming its validator).
 *  6. the book-scars loader validates + fails loud, and returns null for no file.
 */

import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "fs";
import { resolve } from "path";

import { test } from "./harness.js";
import { PIPELINE_DIR } from "./helpers.js";
import { buildSectionTaskMarkdown } from "../src/sections/sectionTasks.js";
import { loadBookScars, validateBookScars } from "../src/lib/bookScars.js";
import { voiceCard } from "../src/lib/voiceCard.js";
import { compileSourcePacketFromSidecar } from "../src/compiler/sourcePacket.js";
import { compileChapterBlueprint } from "../src/compiler/chapterBlueprint.js";
import { SECTION_KINDS, type ChapterBlueprintV1, type SectionKind, type SourcePacketV1 } from "../src/artifacts/artifactTypes.js";
import type { SourceSidecarV2 } from "../src/source/sidecarSchema.js";
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
const VOICE_PARAGRAPH_SNAPSHOT =
  `VOICE — narrate the real cases as LIVED MOMENTS, not abstract summaries: this genre teaches through concrete stories, so build deepRead and fullRead AROUND this chapter's real named cases. Open a case with one specific sensory moment drawn ONLY from its hardSpecifics (a named person, place, object, or number that is actually in the source), let the reader briefly FEEL the moment, THEN name the principle it proves. As a STYLE model only: prefer "The nurse taped a bright cartoon over the ceiling light so the boy staring up during the scan had something to find, and he stopped crying" over "Environments can be redesigned to reduce patient distress." Invent nothing beyond this chapter's own source hardSpecifics — the sample scene is only a voice model, so never import its nurse/boy/scan or any other book's cast, and if you have only a bare fact, state it plainly rather than embroidering it.`;

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

function realisticFixture(): { blueprint: ChapterBlueprintV1; packet: SourcePacketV1 } {
  const chapter: ChapterSpec = { chapterId: "money-book-ch01", chapterNumber: 1, chapterTitle: "Optimize Your Credit Cards" };
  const packet = compileSourcePacketFromSidecar({ bookId: "money-book", chapter, sidecar: sidecar(), sidecarPath: "/tmp/ch01.source.json", sourceHash: "hash" });
  const blueprint = compileChapterBlueprint({ bookId: "money-book", chapter, packet, packetPath: "/tmp/ch01.source-packet.json" });
  return { blueprint, packet };
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

test("summary craft brief pre-states the SEC16 memorable-line hardSpecifics rule", () => {
  // Finding 16: the summary contract told the model memorable lines must be 8-14 words
  // and portable, but never that SEC16 validates the top-3 selected lines against their
  // tier's cited anchors — so a line citing a case with 0/2 of its hardSpecifics only
  // surfaced via retry cards. The sibling anchor-specifics rules (SEC13/SEC14 :116,
  // SEC33 :125, SEC73/SEC74 :146) all pre-state their "two hardSpecifics verbatim; the
  // validator enforces this" contract; the memorable-line bullet must too.
  const md = renderTask("money-book", "summary-pack");
  // Names the enforcing check and its actual rule (two hardSpecifics verbatim IN THE LINE).
  assert.match(md, /\(SEC16\)/, "summary craft brief must name the SEC16 memorable-line check");
  assert.match(md, /at least two of them verbatim \(SEC16\)/, "SEC16 rule states the two-verbatim-hardSpecifics requirement");
  // Sibling style: every design/craft rule that names a gate ends by naming the validator.
  assert.match(md, /verbatim \(SEC16\)[\s\S]*?the validator enforces this/, "SEC16 memorable-line rule names the validator");

  // The rule is summary-pack-specific — SEC16 governs the summary breakdown's memorable
  // lines only, so it must not leak into the other three section contracts.
  for (const kind of ["example-pack", "learning-pack", "action-pack"] as const) {
    assert.doesNotMatch(renderTask("money-book", kind), /\(SEC16\)/, `${kind}: SEC16 memorable-line rule is summary-only`);
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

test("every rendered task is <= 62% of its pinned pre-refactor length", () => {
  const bp = realisticFixture();
  for (const kind of SECTION_KINDS) {
    const md = buildSectionTaskMarkdown({ bookId: "money-book", kind, blueprint: bp.blueprint, sourcePacket: bp.packet, outputPath: `/tmp/${kind}.json`, context: { voiceCard: voiceCard("money-book"), bookScars: loadBookScars("money-book") } });
    const pre = PRE_REFACTOR_CHARS[kind];
    const ratio = md.length / pre;
    assert.ok(md.length <= 0.62 * pre, `${kind}: rendered ${md.length} chars is ${(ratio * 100).toFixed(1)}% of pre-refactor ${pre}; must be <= 62%`);
  }
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
    assert.throws(() => loadBookScars("zz-fixture-bad-scar"), /no phrases, frames, or notes/);
  } finally {
    rmSync(bad, { force: true });
  }
});
