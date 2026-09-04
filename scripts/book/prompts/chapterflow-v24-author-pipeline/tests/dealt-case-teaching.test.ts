/**
 * DEALT CASES MUST BE TAUGHT BY THE PACK THAT CAN TEACH THEM (SEC136).
 *
 * Live Franklin run, attempt 3 (2026-09-04). Round 2 stored a gate-clean ch02
 * summary pack and then failed deterministically, three attempts running:
 *
 *   BOOK_RUN_COMPILER_FAILED:COMPILER_SECTION_BLOCKED:example-pack:after 3
 *   attempts:SEC128.chapter_case_untaught@/examples/0: example 1 cite
 *   ch02.case.matthew_adams_ballads but this chapter's reader-visible prose
 *   carries only 1/2 of that case's hardSpecifics (Matthew Adams, The Lighthouse
 *   Tragedy, Captain Worthilake, Blackbeard); a chapter may not test a case it
 *   never taught — teach it in the summary tiers or cite a case the prose covers
 *
 * Neither half of that instruction was a move the example writer had. The case is
 * DEALT: recompiling ch02's blueprint from the frozen sidecar puts
 * ch02.case.matthew_adams_ballads on ex1, q2 and card 1, so it cannot "cite a case
 * the prose covers"; and the summary it would have to fix was already stored,
 * already gate-clean, and reused verbatim on every resume round. Measured on the
 * stored ch02 summary with the gate's own normalization, that case is taught 1/4
 * ("Matthew Adams" only) — the 1/2 the blocker reports.
 *
 * SEC136 moves the obligation to the pack that can discharge it: a summary must
 * teach every case its own blueprint dealt, to the SAME bar SEC128 will later
 * demand of the units built on it. The failure now surfaces on the summary, on the
 * first draft, with the missing specifics named.
 *
 * The gate deliberately holds SEC128's bar and no more (the whole reader-visible
 * prose, fullRead included). Measured on the same live ch02 summary, three of its
 * four dealt cases are taught in the full prose and ZERO in the standalone tiers,
 * so a standalone-measured gate would block chapters SEC128 passes today. The
 * PROMPT carries the stronger ask (teach it where a reader who stops after Deep
 * will see it, which is also what SEC120 needs); the GATE never demands more than
 * the downstream gate that would fire.
 */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import { validateSummaryPack, type SectionFinding } from "../src/sections/sectionGate.js";
import {
  CHAPTER_CASE_MIN_SPECIFICS,
  dealtCaseCoverage,
  untaughtDealtCases,
  untaughtStandaloneDealtCases,
} from "../src/sections/dealtCases.js";
import { buildSectionTaskMarkdown } from "../src/sections/sectionTasks.js";
import { compileCreditFixture } from "./fixtures/creditBookFixture.js";
import type { ChapterBlueprintV1, SourcePacketV1, SummaryPackV1 } from "../src/artifacts/artifactTypes.js";
import type { SourceAnchorForPrompt } from "../src/types.js";

const CHID = "zz-dealt-ch02";
const BALLADS_ID = "ch02.case.matthew_adams_ballads";
const COURANT_ID = "ch02.case.courant_imprisonment";

/** The live ch02 cases, verbatim from the frozen Franklin sidecar. */
const BALLADS: SourceAnchorForPrompt = {
  id: BALLADS_ID,
  kind: "named_example",
  label: "Matthew Adams / lending library and pirate ballads",
  text: "A tradesman opened his library to young Franklin; his brother had him hawk topical ballads.",
  hardSpecifics: ["Matthew Adams", "The Lighthouse Tragedy", "Captain Worthilake", "Blackbeard"],
  supportsClaimTypes: ["example", "quiz_prompt", "quiz_explanation", "quiz_key_evidence", "review_card", "breakdown_claim", "hook", "takeaway"],
};
const COURANT: SourceAnchorForPrompt = {
  id: COURANT_ID,
  kind: "named_example",
  label: "New England Courant imprisonment",
  text: "James was jailed for a month over the Courant, and Benjamin ran the paper.",
  hardSpecifics: ["New England Courant", "Boston News-Letter", "a month"],
  supportsClaimTypes: ["example", "quiz_prompt", "quiz_explanation", "quiz_key_evidence", "review_card", "breakdown_claim"],
};

function packet(anchors: SourceAnchorForPrompt[]): SourcePacketV1 {
  return { allowedAnchors: anchors, facts: [], namedCases: [], allowedEntities: [], allowedPlaces: [] } as unknown as SourcePacketV1;
}

/** A blueprint that DEALS `exampleCaseIds` to its one example slot and nothing else. */
function blueprint(exampleCaseIds: string[], quizCueIds: string[] = [], cardCueIds: string[] = []): ChapterBlueprintV1 {
  return {
    chapterNumber: 2,
    chapterId: CHID,
    sections: {
      quiz: quizCueIds.map((id) => ({ caseCueIds: [id] })),
      cards: cardCueIds.map((id) => ({ caseCueIds: [id] })),
      examples: exampleCaseIds.map((id) => ({ requiredCaseIds: [id] })),
    },
    constraints: { allowedFactIds: [], allowedCaseIds: [], forbiddenClaims: [], forbiddenLeakage: [], bannedHouseTics: [] },
  } as unknown as ChapterBlueprintV1;
}

/** A summary pack whose tiers carry exactly the text handed in. */
function summary(tiers: { fastRead: string; deepRead: string; fullRead: string; hook?: string; keyTakeaway?: string }): SummaryPackV1 {
  return {
    schemaVersion: "section-artifact-v1",
    artifactType: "summary-pack",
    chapterId: CHID,
    hook: { hook: tiers.hook ?? "A boy sets type by day and sells his verses in the street by night.", sourceAnchorIds: [BALLADS_ID] },
    breakdown: {
      fastRead: tiers.fastRead,
      deepRead: tiers.deepRead,
      fullRead: tiers.fullRead,
      sourceAnchorIds: { fastRead: [], deepRead: [], fullRead: [] },
    },
    keyTakeaway: tiers.keyTakeaway ?? "Notice who lends you the tools before you notice who pays you for them.",
    keyTakeawaySourceAnchorIds: [],
    sourceFactIds: [],
  } as unknown as SummaryPackV1;
}

function sec136(findings: SectionFinding[]): SectionFinding[] {
  return findings.filter((f) => f.checkId === "SEC136.dealt_case_untaught");
}

// ── SEC136 — the summary-side gate on the DEALT cases ────────────────────────

test("SEC136 blocks a summary that teaches 1 of 2 required specifics of a DEALT case (live ch02 shape)", () => {
  const pack = summary({
    fastRead: "Matthew Adams noticed the boy and lent him books, and the boy started writing verses.",
    deepRead: "Matthew Adams kept a collection worth borrowing, and the loan of it turned a printer's apprentice toward poetry for a season.",
    fullRead: "Matthew Adams kept a collection worth borrowing. The loan of it turned an apprentice toward poetry, and the market decided how long that lasted.",
  });
  const findings = sec136(validateSummaryPack(pack, blueprint([BALLADS_ID]), packet([BALLADS])));
  assert.equal(findings.length, 1, "the one untaught dealt case must block");
  assert.equal(findings[0].severity, "blocker");
  assert.equal(findings[0].chapterNumber, 2);
  assert.equal(findings[0].section, "summary-pack");
  assert.match(findings[0].message, new RegExp(BALLADS_ID.replace(/\./g, "\\.")));
  assert.match(findings[0].message, /1\/2/, "the message must report present/required exactly as SEC128 does");
  // The feedback must NAME the specifics the writer has to put on the page — the
  // half the live SEC128 blocker could only list as "this case's hardSpecifics".
  assert.match(findings[0].message, /The Lighthouse Tragedy/);
  assert.match(findings[0].message, /Captain Worthilake/);
  assert.match(findings[0].message, /Blackbeard/);
});

test("SEC136 passes a summary that teaches 2 of the dealt case's specifics", () => {
  const pack = summary({
    fastRead: "Matthew Adams lent the boy books, and The Lighthouse Tragedy sold briskly because the drowning was fresh news.",
    deepRead: "Matthew Adams kept a collection worth borrowing, and the loan of it turned a printer's apprentice toward verse for a season.",
    fullRead: "Matthew Adams kept a collection worth borrowing. The Lighthouse Tragedy sold while the drowning was still news, which taught the boy what timing is worth.",
  });
  assert.deepEqual(sec136(validateSummaryPack(pack, blueprint([BALLADS_ID]), packet([BALLADS]))), []);
});

test("SEC136 counts a case cued to a QUIZ or CARD slot, not only an example slot", () => {
  const pack = summary({
    fastRead: "The boy set type and sold verses; the paper he worked on later put his brother in trouble.",
    deepRead: "A printing house is a business before it is a school, and the business decides which of your pages get sold.",
    fullRead: "A printing house is a business before it is a school. The trade decided which pages were worth setting and which were not.",
  });
  const packetAll = packet([BALLADS, COURANT]);
  assert.equal(sec136(validateSummaryPack(pack, blueprint([], [BALLADS_ID]), packetAll)).length, 1, "a quiz cue is a dealt case");
  assert.equal(sec136(validateSummaryPack(pack, blueprint([], [], [COURANT_ID]), packetAll)).length, 1, "a card cue is a dealt case");
  assert.equal(sec136(validateSummaryPack(pack, blueprint([], [BALLADS_ID], [COURANT_ID]), packetAll)).length, 2);
});

test("SEC136 holds SEC128's bar exactly: a dealt case taught only in fullRead passes the gate", () => {
  // Measured on the live ch02 summary, three of four dealt cases are in exactly
  // this state. SEC128 passes them, so SEC136 must too — a stricter gate here
  // would block chapters that ship today. The standalone shortfall is reported by
  // untaughtStandaloneDealtCases instead, which is what the prompt and the
  // compiler's re-draft feedback act on.
  const pack = summary({
    fastRead: "A printing house is a business before it is a school, and the trade decides which of your pages sell.",
    deepRead: "The boy learned that a page finds its buyer through timing, not through the care he put into the verses.",
    fullRead: "Matthew Adams kept a collection worth borrowing, and The Lighthouse Tragedy sold briskly while the drowning was still fresh news.",
  });
  const bp = blueprint([BALLADS_ID]);
  const pk = packet([BALLADS]);
  assert.deepEqual(sec136(validateSummaryPack(pack, bp, pk)), [], "the gate holds SEC128's haystack");
  assert.deepEqual(untaughtDealtCases(bp, pk, pack), []);
  const standalone = untaughtStandaloneDealtCases(bp, pk, pack);
  assert.equal(standalone.length, 1, "the reader who stops after Deep was never taught the case");
  assert.deepEqual([...standalone[0].missingFromStandalone], ["Matthew Adams", "The Lighthouse Tragedy", "Captain Worthilake", "Blackbeard"]);
});

test("SEC136 never fires on a case the blueprint did not deal", () => {
  const pack = summary({
    fastRead: "Matthew Adams lent the boy books, and The Lighthouse Tragedy sold briskly because the drowning was fresh news.",
    deepRead: "Matthew Adams kept a collection worth borrowing, and the loan of it turned an apprentice toward verse.",
    fullRead: "Matthew Adams kept a collection worth borrowing. The Lighthouse Tragedy sold while the drowning was still news.",
  });
  // COURANT is rich and untaught, but nothing deals it: SEC14 owns the summary's
  // own citations and SEC128 owns a unit that chooses to cite it — both of which
  // the writer that cites it can still fix.
  assert.deepEqual(sec136(validateSummaryPack(pack, blueprint([BALLADS_ID]), packet([BALLADS, COURANT]))), []);
});

test("SEC136 no-ops on a pack with no drafted read tiers, exactly as SEC120 and SEC128 do", () => {
  const stub = summary({ fastRead: "", deepRead: "", fullRead: "" });
  assert.deepEqual(sec136(validateSummaryPack(stub, blueprint([BALLADS_ID]), packet([BALLADS]))), []);
  assert.deepEqual(untaughtDealtCases(blueprint([BALLADS_ID]), packet([BALLADS]), stub), []);
  assert.deepEqual(untaughtStandaloneDealtCases(blueprint([BALLADS_ID]), packet([BALLADS]), stub), []);
});

test("SEC136 skips a dealt case the packet cannot support: unresolvable, or too few specifics", () => {
  const thin: SourceAnchorForPrompt = { ...BALLADS, id: "ch02.case.thin", hardSpecifics: ["Matthew Adams"] };
  const pack = summary({
    fastRead: "A printing house is a business before it is a school, and the trade decides which pages sell.",
    deepRead: "The boy learned that a page finds its buyer through timing rather than through care.",
    fullRead: "The boy learned that a page finds its buyer through timing. The trade decided the rest.",
  });
  // Fewer than CHAPTER_CASE_MIN_SPECIFICS specifics: the bar is unsatisfiable by
  // construction, and citedRichAnchors drops it on the SEC128 side for the same
  // reason.
  assert.equal(CHAPTER_CASE_MIN_SPECIFICS, 2);
  assert.deepEqual(sec136(validateSummaryPack(pack, blueprint(["ch02.case.thin"]), packet([thin]))), []);
  // Unresolvable: BPV10 owns an unknown dealt case id, not this gate.
  assert.deepEqual(sec136(validateSummaryPack(pack, blueprint(["ch02.case.nowhere"]), packet([BALLADS]))), []);
});

test("SEC136 does not fire on the compliant credit fixture (the gate must not over-block what ships)", () => {
  const fx = compileCreditFixture("dealt-case-fixture-book", {});
  assert.ok(dealtCaseCoverage(fx.blueprint, fx.packet, fx.summary).length >= 2, "the fixture must actually deal cases");
  assert.deepEqual(sec136(validateSummaryPack(fx.summary, fx.blueprint, fx.packet)), []);
});

// ── The summary WRITER's must-teach list ─────────────────────────────────────

test("the summary task card lists every dealt case and its specifics as MUST TEACH", () => {
  const fx = compileCreditFixture("dealt-case-card-book", {});
  const card = buildSectionTaskMarkdown({
    bookId: "dealt-case-card-book",
    kind: "summary-pack",
    blueprint: fx.blueprint,
    sourcePacket: fx.packet,
    outputPath: "/tmp/summary-pack.json",
    context: { voiceCard: null, bookScars: null },
  });
  assert.match(card, /MUST TEACH/, "the block must render on the summary card");
  for (const coverage of dealtCaseCoverage(fx.blueprint, fx.packet, fx.summary)) {
    assert.ok(card.includes(coverage.id), `the card must name the dealt case ${coverage.id}`);
    for (const specific of coverage.hardSpecifics) {
      assert.ok(card.includes(specific), `the card must list "${specific}"`);
    }
  }
  // The ask is the STANDALONE tiers (what SEC120 measures and what a reader who
  // stops after Deep actually sees), and it names the gate that will check it.
  assert.match(card, /SEC136/);
  assert.match(card, /fullRead/, "the card must say fullRead alone does not discharge the obligation");
});

test("the must-teach block renders only on the summary card, and only when cases are dealt", () => {
  const fx = compileCreditFixture("dealt-case-other-book", {});
  for (const kind of ["example-pack", "learning-pack", "action-pack"] as const) {
    const card = buildSectionTaskMarkdown({
      bookId: "dealt-case-other-book",
      kind,
      blueprint: fx.blueprint,
      sourcePacket: fx.packet,
      outputPath: `/tmp/${kind}.json`,
      context: { voiceCard: null, bookScars: null },
    });
    assert.ok(!card.includes("MUST TEACH"), `${kind} must render exactly as it did before`);
  }
  const undealt = { ...fx.blueprint, sections: { ...fx.blueprint.sections, examples: [], quiz: [], cards: [] } } as ChapterBlueprintV1;
  const card = buildSectionTaskMarkdown({
    bookId: "dealt-case-other-book",
    kind: "summary-pack",
    blueprint: undealt,
    sourcePacket: fx.packet,
    outputPath: "/tmp/summary-pack.json",
    context: { voiceCard: null, bookScars: null },
  });
  assert.ok(!card.includes("MUST TEACH"), "a chapter with no dealt cases renders byte-identically to before");
});
