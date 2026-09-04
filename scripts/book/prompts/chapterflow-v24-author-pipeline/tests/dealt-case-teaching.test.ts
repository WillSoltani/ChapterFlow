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
  dealtCasesNamedByBlockers,
  dealtFactYearFigures,
  describeUntaughtDealtCase,
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

// ── The message must describe the haystack its own count was taken over ──────

test("SEC136's 'still missing' list is measured on the SAME haystack as its count", () => {
  // Adversarial review, 2026-09-04: the finding counted taughtInProse (the WHOLE
  // reader-visible prose) and then appended the list of specifics missing from the
  // STANDALONE tiers, so a summary carrying "Matthew Adams" in fullRead alone was
  // told "1/2 ... still missing: "Matthew Adams", ..." — naming as absent the one
  // specific the count had just credited. A writer cannot act on that.
  const pack = summary({
    fastRead: "A printing house is a business before it is a school, and the trade decides which pages sell.",
    deepRead: "The boy learned that a page finds its buyer through timing rather than through the care he put in.",
    fullRead: "Matthew Adams kept a collection worth borrowing, and the loan of it turned an apprentice toward verse.",
  });
  const findings = sec136(validateSummaryPack(pack, blueprint([BALLADS_ID]), packet([BALLADS])));
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /1\/2/, "the count is taken over the full prose, fullRead included");
  const stillMissing = /still missing: (.+?)\)$/.exec(findings[0].message)?.[1] ?? "";
  assert.ok(stillMissing.length > 0, "the finding must name what is missing");
  assert.ok(
    !stillMissing.includes("Matthew Adams"),
    `the credited specific must not be listed as missing (got: ${stillMissing})`,
  );
  for (const specific of ["The Lighthouse Tragedy", "Captain Worthilake", "Blackbeard"]) {
    assert.ok(stillMissing.includes(specific), `"${specific}" is genuinely absent and must be listed`);
  }
  // The other haystack is still available, and still names the harder list — the
  // compiler's re-draft brief asks for it by name.
  assert.deepEqual(
    [...untaughtStandaloneDealtCases(blueprint([BALLADS_ID]), packet([BALLADS]), pack)[0].missingFromStandalone],
    ["Matthew Adams", "The Lighthouse Tragedy", "Captain Worthilake", "Blackbeard"],
  );
  assert.equal(
    describeUntaughtDealtCase(dealtCaseCoverage(blueprint([BALLADS_ID]), packet([BALLADS]), pack)[0], "prose"),
    `${BALLADS_ID} (still missing: "The Lighthouse Tragedy", "Captain Worthilake", "Blackbeard")`,
  );
});

// ── WHICH dealt case a blocker actually implicates ───────────────────────────

test("dealtCasesNamedByBlockers returns only the cases the blocker lines NAME", () => {
  const pack = summary({
    fastRead: "A printing house is a business before it is a school, and the trade decides which pages sell.",
    deepRead: "The boy learned that a page finds its buyer through timing rather than through care.",
    fullRead: "Matthew Adams kept a collection worth borrowing. James was jailed for a month over the New England Courant.",
  });
  const bp = blueprint([BALLADS_ID], [COURANT_ID]);
  const pk = packet([BALLADS, COURANT]);
  const untaught = untaughtStandaloneDealtCases(bp, pk, pack);
  assert.deepEqual(untaught.map((c) => c.id).sort(), [BALLADS_ID, COURANT_ID].sort(), "both are untaught: the arming set is wide");

  // A SEC120 block over a figure that belongs to no dealt case implicates NOTHING —
  // the live run's own terminal shape, and the blocked writer keeps its retries.
  const unrelated = ['SEC120.learning_prose_derivable@/cards/cards/0:card 1 names "1555", which appears nowhere in this chapter\'s drafted prose'];
  assert.deepEqual(dealtCasesNamedByBlockers(unrelated, untaught), []);

  // A SEC128 block names its case id, and only that one is returned.
  const sec128Line = `SEC128.chapter_case_untaught@/examples/0:example 1 cite ${BALLADS_ID} but this chapter's reader-visible prose carries only 1/2 of that case's hardSpecifics (Matthew Adams, The Lighthouse Tragedy)`;
  assert.deepEqual(dealtCasesNamedByBlockers([sec128Line], untaught).map((c) => c.id), [BALLADS_ID]);

  // A SEC120 block quoting a dealt case's own specific IS the coverage gap.
  const sec120Line = 'SEC120.learning_prose_derivable@/quiz/questions/1:q2 names "New England Courant", which appears nowhere in this chapter\'s drafted prose';
  assert.deepEqual(dealtCasesNamedByBlockers([sec120Line], untaught).map((c) => c.id), [COURANT_ID]);

  // Neither the id nor a specific: any other check id is the blocked pack's own
  // problem, whatever else is untaught.
  assert.deepEqual(dealtCasesNamedByBlockers(["SEC3.hook_length@/hook:the hook is too short"], untaught), []);
  assert.deepEqual(dealtCasesNamedByBlockers([], untaught), []);
  assert.deepEqual(dealtCasesNamedByBlockers([sec128Line], []), []);
});

test("dealtCasesNamedByBlockers matches a case id on whole-id boundaries only", () => {
  const pack = summary({
    fastRead: "A printing house is a business before it is a school, and the trade decides which pages sell.",
    deepRead: "The boy learned that a page finds its buyer through timing rather than through care.",
    fullRead: "Matthew Adams kept a collection worth borrowing.",
  });
  const untaught = untaughtStandaloneDealtCases(blueprint([BALLADS_ID]), packet([BALLADS]), pack);
  assert.equal(untaught.length, 1);
  const longer = `SEC128.chapter_case_untaught@/examples/0:example 1 cite ${BALLADS_ID}.reprise but the prose carries only 1/2`;
  assert.deepEqual(dealtCasesNamedByBlockers([longer], untaught), [], "a longer id must not match the shorter one");
  const exact = `SEC128.chapter_case_untaught@/examples/0:example 1 cite ${BALLADS_ID} but the prose carries only 1/2`;
  assert.deepEqual(dealtCasesNamedByBlockers([exact], untaught).map((c) => c.id), [BALLADS_ID]);
});

// ── The dealt FACTS whose figures SEC120 will demand (prompt only, no gate) ───

test("the summary card names the year-band figures of the FACTS dealt to quiz and card slots", () => {
  // The live ch01 card 6 was dealt ch01.fact.parish_registers, whose only content
  // is "1555". SEC120's year rule fires on ANY year-band figure a unit names that
  // the standalone tiers never showed, whatever the unit cites — so the card could
  // neither be built without the year nor built with it. Nothing on the summary
  // side had ever mentioned the figures of the facts it was dealt.
  const registers: SourceAnchorForPrompt = {
    id: "ch02.fact.parish_registers",
    kind: "testable_fact",
    label: "Parish registers begin in 1555",
    text: "Parish registers begin in 1555, which is as far back as the family can be traced.",
    supportsClaimTypes: ["quiz_prompt", "quiz_explanation", "quiz_key_evidence", "review_card", "breakdown_claim"],
  };
  const undated: SourceAnchorForPrompt = {
    id: "ch02.fact.trade",
    kind: "testable_fact",
    label: "A printing house is a business",
    text: "A printing house sells what the street will buy.",
    supportsClaimTypes: ["quiz_prompt", "review_card"],
  };
  const bp = {
    chapterNumber: 2,
    chapterId: CHID,
    sections: {
      quiz: [{ caseCueIds: [], requiredFactIds: ["ch02.fact.parish_registers"] }],
      cards: [{ caseCueIds: [], requiredFactIds: ["ch02.fact.trade"] }],
      examples: [],
    },
    constraints: { allowedFactIds: [], allowedCaseIds: [], forbiddenClaims: [], forbiddenLeakage: [], bannedHouseTics: [] },
  } as unknown as ChapterBlueprintV1;
  const pk = packet([registers, undated]);

  assert.deepEqual(
    dealtFactYearFigures(bp, pk).map((fact) => [fact.id, [...fact.years]]),
    [["ch02.fact.parish_registers", ["1555"]]],
    "only a dealt fact that actually carries a year-band figure is listed",
  );

  const card = buildSectionTaskMarkdown({
    bookId: "dealt-fact-book",
    kind: "summary-pack",
    blueprint: bp,
    sourcePacket: pk,
    outputPath: "/tmp/summary-pack.json",
    context: { voiceCard: null, bookScars: null },
  });
  // Read the block itself, not the whole card: the blueprint JSON the card already
  // embedded names every requiredFactId regardless.
  const factBlock = /MUST TEACH — the year figures[\s\S]*?unwritable\./.exec(card)?.[0] ?? "";
  assert.ok(factBlock.length > 0, "the dated-facts ask must render on the summary card");
  assert.ok(factBlock.includes("ch02.fact.parish_registers"));
  assert.ok(factBlock.includes('"1555"'));
  assert.ok(!factBlock.includes("ch02.fact.trade"), "a dealt fact with no year adds nothing to the ask");
  assert.match(factBlock, /SEC120/);
  // Bounded by construction: even a chapter whose every dealt fact is dated cannot
  // grow this ask past the summary card's remaining budget under the 72% pin.
  assert.ok(factBlock.length <= 700, `the dated-facts ask must stay bounded (got ${factBlock.length})`);

  // Prompt only: no gate reads it, so a summary that ignores the year still passes
  // the summary gate exactly as it does today. Gating dealt FACTS is a separate
  // design decision.
  const pack = summary({
    fastRead: "A printing house is a business before it is a school, and the trade decides which pages sell.",
    deepRead: "The boy learned that a page finds its buyer through timing rather than through care.",
    fullRead: "The trade decided which pages were worth setting and which were not.",
  });
  assert.deepEqual(sec136(validateSummaryPack(pack, bp, pk)), []);
});

test("the dated-FACTS ask is bounded by construction, however many dated facts a chapter deals", () => {
  // The summary card is the binding render against the 72% task-length pin, with
  // ~677 chars of headroom on the pinned money-book fixture. A per-fact list would
  // have been unbounded: 20 dealt facts each carrying two figures is 40 lines. The
  // ask is keyed by the FIGURE and truncated, so its worst case is a constant.
  const anchors: SourceAnchorForPrompt[] = Array.from({ length: 20 }, (_, i) => ({
    id: `ch02.fact.dated_${i + 1}`,
    kind: "testable_fact",
    label: `A dated fact ${i + 1} the chapter must be able to test`,
    text: `The register for this entry is dated 1${600 + i}, and the follow-up is dated 1${700 + i}.`,
    supportsClaimTypes: ["quiz_prompt", "quiz_explanation", "quiz_key_evidence", "review_card"],
  }));
  const bp = {
    chapterNumber: 2,
    chapterId: CHID,
    sections: {
      quiz: anchors.slice(0, 10).map((anchor) => ({ caseCueIds: [], requiredFactIds: [anchor.id] })),
      cards: anchors.slice(10).map((anchor) => ({ caseCueIds: [], requiredFactIds: [anchor.id] })),
      examples: [],
    },
    constraints: { allowedFactIds: [], allowedCaseIds: [], forbiddenClaims: [], forbiddenLeakage: [], bannedHouseTics: [] },
  } as unknown as ChapterBlueprintV1;
  assert.equal(dealtFactYearFigures(bp, packet(anchors)).length, 20, "every dealt fact here carries figures");

  const card = buildSectionTaskMarkdown({
    bookId: "dealt-fact-bound-book",
    kind: "summary-pack",
    blueprint: bp,
    sourcePacket: packet(anchors),
    outputPath: "/tmp/summary-pack.json",
    context: { voiceCard: null, bookScars: null },
  });
  const factBlock = /MUST TEACH — the year figures[\s\S]*?unwritable\./.exec(card)?.[0] ?? "";
  assert.ok(factBlock.length > 0);
  assert.ok(factBlock.length <= 700, `40 figures across 20 facts must still fit a bounded ask (got ${factBlock.length})`);
  // Truncated, not silently dropped: the writer is told how much it is not seeing,
  // and the SOURCE PACKET rendered below the ask carries every one of them.
  assert.match(factBlock, /\+30 more/, "the untruncated figure count must be reported");
  assert.match(factBlock, /\+14 more/, "the untruncated fact-id count must be reported");
});
