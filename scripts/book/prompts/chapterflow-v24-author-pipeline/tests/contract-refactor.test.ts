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
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "fs";
import { resolve } from "path";

import { test } from "./harness.js";
import { PIPELINE_DIR } from "./helpers.js";
import { buildSectionTaskMarkdown } from "../src/sections/sectionTasks.js";
import { CHAPTER_PROSE_CARD_BUDGET } from "../src/sections/chapterProse.js";
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
  assert.ok(withProse.length <= 0.76 * pre, `learning-pack with prose: rendered ${withProse.length} chars is ${(ratio * 100).toFixed(1)}% of pre-refactor ${pre}; must be <= 76% (re-pin only with a stated rationale)`);
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
  assert.ok(withProse.length <= 0.80 * pre, `a 126k-char summary pack rendered ${withProse.length} chars (${(ratio * 100).toFixed(1)}% of ${pre}); the clamp must hold the card at <= 80%`);
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
  assert.ok(franklin.prohibitions.some((p) => /COUNT CONSISTENCY/.test(p)), "virtue count rule present");
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
