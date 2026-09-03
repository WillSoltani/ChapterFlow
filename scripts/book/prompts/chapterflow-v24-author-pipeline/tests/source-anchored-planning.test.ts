import assert from "node:assert/strict";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { resolve } from "path";

import { checkChapterProvenance } from "../src/critics/sourceGrounding.js";
import { validateExamplePack, type SectionFinding } from "../src/sections/sectionGate.js";
import type { ChapterBlueprintV1, ExamplePackV1, SourcePacketV1 } from "../src/artifacts/artifactTypes.js";
import { chapterContentHash } from "../src/critics/qcAttestation.js";
import {
  currentProviderIdentity,
  validateStageCache,
  writeStageCacheManifest,
} from "../src/cache/stageCache.js";
import {
  buildBriefCacheInputs,
  buildChapterCacheInputs,
  buildPlanCacheInputs,
  type BookMeta,
  type ChapterSpec,
} from "../src/generateChapter.js";
import { stripInternalFields } from "../src/lib/readerContent.js";
import { buildProductionManifest } from "../src/productionManifest.js";
import { collectSourceVerifyItems } from "../src/qc/sourceRealityPolicy.js";
import { loadPlanningSourceEvidence, renderBookSourceForEditor, renderChapterSourceForPlanner } from "../src/source/sourceEvidence.js";
import type { ChapterV21 } from "../src/types.js";
import { makeChapter, TMP_DIR, writeCanonicalIndexFixture, writeResearchRunManifestFixture } from "./helpers.js";
import { test } from "./harness.js";

const BOOK = "zz-fixture-source-anchors";

function sidecar(chapterNumber = 1): any {
  const nn = String(chapterNumber).padStart(2, "0");
  return {
    schemaVersion: "source-v2",
    chapterNumber,
    chapterTitle: "The harbor principle",
    centralConcept: {
      id: `ch${nn}.concept.harbor`,
      name: "Harbor Principle",
      plainDefinition: "A synthetic concept used for provenance tests.",
    },
    keyClaims: ["Synthetic claim."],
    namedExamples: [
      {
        id: `ch${nn}.ex.lantern`,
        label: "Lantern Ledger",
        summary: "The lantern ledger case turns on beacon, quay, and cargo specifics.",
        teachesWhat: "Use concrete source examples.",
        hardSpecifics: ["lantern", "ledger", "beacon"],
        realWorld: false,
      },
      {
        id: `ch${nn}.ex.compass`,
        label: "Compass Review",
        summary: "The compass review case turns on tide, mast, and anchor specifics.",
        teachesWhat: "Check early evidence.",
        hardSpecifics: ["compass", "tide", "mast"],
        realWorld: false,
      },
      {
        id: `ch${nn}.ex.quay`,
        label: "Quay Handoff",
        summary: "The quay handoff case turns on harbor, cargo, and beacon specifics.",
        teachesWhat: "Preserve audit trails.",
        hardSpecifics: ["quay", "cargo", "harbor"],
        realWorld: false,
      },
    ],
    hardEdge: "Do not replace source evidence with generic memory.",
    testableFacts: [
      ["Lantern Ledger reduced missed beacon checks from 17 to 4 after a Tuesday intake review.", "Because the Tuesday intake review happens before the harbor shift changes hands, the ledger error can be fixed while the beacon record is still fresh.", "Treat the missed beacon checks as a training issue after the shift ends."],
      ["Compass Review found 8 tide mismatches before the mast inspection window closed.", "Because the tide check happens before the mast inspection, the team can separate a bad reading from a bad repair.", "Wait for the mast inspection before checking the tide record."],
      ["Quay Handoff caught 6 cargo labels that disagreed with the harbor manifest.", "Because the handoff compares cargo labels to the manifest before loading, the mismatch stays attached to the original crate.", "Assume the loading team will notice the cargo mismatch later."],
      ["Beacon Desk kept a 24-hour ledger so overnight drift retained its first timestamp.", "Because the timestamp is recorded before morning triage, the team can trace the defect without guessing when it began.", "Let the morning team infer the overnight sequence from memory."],
      ["Harbor Audit moved 5 scattered notes into one quay log before Friday review.", "Because the quay log gathers the notes before review, the operator sees one source of truth instead of five partial records.", "Keep each note where it first arrived."],
      ["Mast Crew named Rowan as the single owner for 12 open repair tickets.", "Because Rowan owns the repair queue before assignment, every ticket has one authoritative status.", "Let every crew member update their own version of the repair queue."],
      ["Anchor Trial paused a launch for 9 minutes after the compass reading jumped twice.", "Because the pause happens at the first jump, the team can test the compass before the launch hides the cause.", "Continue the launch and inspect the compass afterward."],
      ["Ledger Pilot separated reminder cards from reward cards across 220 practice sessions.", "Because the pilot separates the two card types, the team can tell which prompt changed behavior.", "Blend reminders and rewards because both support practice."],
      ["Cargo Review documented 31 crate transfers before the evening manifest was signed.", "Because the transfers are documented before signoff, a missing crate can be traced to a specific handoff.", "Sign the manifest first and reconcile transfers later."],
    ].map(([claim, becauseMechanism, commonError], i) => ({
      id: `ch${nn}.fact.${i + 1}`,
      claim,
      becauseMechanism,
      commonError,
      errorIsWhy: `That misses the timing advantage in fixture fact ${i + 1}: the check works because the original source context is still available.`,
    })),
  };
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(resolve(path, ".."), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function fixtureRoot(name: string): string {
  return resolve(TMP_DIR, `source-anchored-planning-${name}`);
}

function writeSourceRun(root: string, bookId = BOOK, chapterNumber = 1, source = sidecar(chapterNumber)): { stateRoot: string; runsRoot: string; sidecarPath: string } {
  const stateRoot = resolve(root, "state");
  const runsRoot = resolve(root, "runs");
  const runDir = resolve(runsRoot, bookId, "run-a");
  writeResearchRunManifestFixture({
    runDir,
    bookId,
    chapters: [{ number: chapterNumber, title: source.chapterTitle ?? `Chapter ${chapterNumber}` }],
  });
  mkdirSync(resolve(runDir, "source-freeze"), { recursive: true });
  writeFileSync(resolve(runDir, "source-freeze", "book-source.md"), "Synthetic book source says evidence comes first.\n", "utf8");
  writeJson(resolve(runDir, "source-freeze", "toc.json"), [{ number: chapterNumber, title: source.chapterTitle ?? `Chapter ${chapterNumber}` }]);
  const sidecarPath = resolve(runDir, "sidecars", "source", `ch${String(chapterNumber).padStart(2, "0")}.source.json`);
  writeJson(sidecarPath, source);
  return { stateRoot, runsRoot, sidecarPath };
}

function bookMeta(bookId = BOOK): BookMeta {
  return { bookId, title: "Source Anchors", author: "Fixture Author" };
}

function chapterSpec(bookId = BOOK, n = 1): ChapterSpec {
  return {
    chapterId: `${bookId}-ch${String(n).padStart(2, "0")}`,
    chapterNumber: n,
    chapterTitle: "The harbor principle",
  };
}

function fullyAnchorLegacyUnits(chapter: ReturnType<typeof makeChapter>): void {
  for (const example of chapter.examples) example.sourceAnchorId = "ch01.fact.1";
  for (const question of chapter.quiz.questions) question.sourceAnchorId = "ch01.fact.2";
  for (const card of chapter.reviewCards) card.sourceAnchorId = "ch01.fact.3";
  for (const item of chapter.implementationPlan.ifThenPlans) item.sourceAnchorId = "ch01.fact.4";
}

test("source-v2 provenance requires anchors for every claim-bearing chapter unit, not only legacy arrays", () => {
  const chapter = makeChapter(BOOK, 1);
  fullyAnchorLegacyUnits(chapter);

  const findings = checkChapterProvenance(chapter, sidecar());
  const messages = findings.map((finding) => finding.message).join("\n");

  for (const unit of [
    "hook",
    "counterintuition",
    "breakdown.fastRead",
    "breakdown.deepRead",
    "breakdown.fullRead",
    "keyTakeaway",
    "implementationPlan.coreSkill",
    "implementationPlan.twentyFourHourChallenge",
    "implementationPlan.weeklyPractice",
    "memorableLines[0]",
  ]) {
    assert.match(messages, new RegExp(unit.replace(/[.[\]]/g, "\\$&")), `${unit} must require source anchors`);
  }
});

function fullyAnchoredChapter(): ChapterV21 {
  const chapter = makeChapter(BOOK, 1);
  for (const example of chapter.examples) {
    example.sourceAnchorId = "ch01.ex.lantern";
    example.sourceAnchorIds = ["ch01.ex.lantern"];
    example.scenario += " Lantern ledger beacon.";
  }
  for (const question of chapter.quiz.questions) {
    question.sourceAnchorId = "ch01.fact.2";
    question.sourceAnchorIds = ["ch01.fact.2"];
    question.keyEvidenceAnchorIds = ["ch01.fact.2"];
  }
  for (const card of chapter.reviewCards) {
    card.sourceAnchorId = "ch01.fact.3";
    card.sourceAnchorIds = ["ch01.fact.3"];
  }
  chapter.implementationPlan.titleSourceAnchorIds = ["ch01.fact.4"];
  chapter.implementationPlan.coreSkillSourceAnchorIds = ["ch01.fact.4"];
  chapter.implementationPlan.twentyFourHourChallengeSourceAnchorIds = ["ch01.fact.4"];
  chapter.implementationPlan.weeklyPracticeSourceAnchorIds = ["ch01.fact.4"];
  for (const item of chapter.implementationPlan.ifThenPlans) {
    item.sourceAnchorId = "ch01.fact.4";
    item.sourceAnchorIds = ["ch01.fact.4"];
  }
  const effectiveAnchors: Record<string, string[]> = {
    hook: ["ch01.fact.1"],
    counterintuition: ["ch01.fact.1"],
    "breakdown.fastRead": ["ch01.fact.1"],
    "breakdown.deepRead": ["ch01.fact.1"],
    "breakdown.fullRead": ["ch01.fact.1"],
    keyTakeaway: ["ch01.fact.1"],
    tryThisNow: ["ch01.fact.4"],
    "implementationPlan.title": ["ch01.fact.4"],
    "implementationPlan.coreSkill": ["ch01.fact.4"],
    "implementationPlan.twentyFourHourChallenge": ["ch01.fact.4"],
    "implementationPlan.weeklyPractice": ["ch01.fact.4"],
  };
  chapter.examples.forEach((_, i) => {
    effectiveAnchors[`examples[${i}]`] = ["ch01.ex.lantern"];
  });
  chapter.quiz.questions.forEach((_, i) => {
    effectiveAnchors[`quiz.questions[${i}]`] = ["ch01.fact.2"];
    effectiveAnchors[`quiz.questions[${i}].keyEvidence`] = ["ch01.fact.2"];
  });
  chapter.reviewCards.forEach((_, i) => {
    effectiveAnchors[`reviewCards[${i}]`] = ["ch01.fact.3"];
  });
  chapter.implementationPlan.ifThenPlans.forEach((_, i) => {
    effectiveAnchors[`implementationPlan.ifThenPlans[${i}]`] = ["ch01.fact.4"];
  });
  chapter.memorableLines?.forEach((line, i) => {
    // Package 1B: a memorable line carries AT MOST ONE source specific (SC11.8, the
    // ship-side reading of SEC16). The shared fixture generates lines out of the
    // chapter's own vocabulary, which stacks two of the harbor sidecar's specifics —
    // exactly the defect the cap names — so the fully-anchored CONTROL states the idea.
    const stated = [
      "The early check is the only cheap one you will ever get.",
      "A tidy record beats a good memory every single time.",
      "You pay less for the small fix than for the argument about it.",
    ];
    line.text = stated[i] ?? line.text;
    line.sourceAnchorIds = ["ch01.fact.1"];
    effectiveAnchors[`memorableLines[${i}]`] = ["ch01.fact.1"];
  });
  chapter.authoring = {
    schemaVersion: "chapter-authoring-v1",
    sourceAnchors: {
      schemaVersion: "chapter-source-anchor-map-v1",
      sourceHash: "test-source-hash",
      sourceSidecarPath: "/tmp/source.json",
      observedAnchorIds: ["ch01.concept.harbor", "ch01.ex.lantern", ...Array.from({ length: 9 }, (_, i) => `ch01.fact.${i + 1}`)],
      effectiveAnchors,
    },
  };
  return chapter;
}

test("source-v2 provenance passes when every claim-bearing unit has valid allowed anchors", () => {
  const findings = checkChapterProvenance(fullyAnchoredChapter(), sidecar());
  assert.deepEqual(findings, []);
});

test("source-v2 provenance rejects nonexistent, wrong-chapter, placeholder, and unsupported anchors precisely", () => {
  const cases: Array<{ name: string; mutate: (chapter: ChapterV21) => void; checkId: string; evidence: string }> = [
    {
      name: "nonexistent",
      checkId: "SC11.5.unknown_anchor",
      evidence: "ch01.fact.404",
      mutate: (chapter) => { chapter.authoring!.sourceAnchors!.effectiveAnchors.hook = ["ch01.fact.404"]; },
    },
    {
      name: "wrong-chapter",
      checkId: "SC11.4.wrong_chapter_anchor",
      evidence: "ch02.fact.1",
      mutate: (chapter) => { chapter.authoring!.sourceAnchors!.effectiveAnchors.hook = ["ch02.fact.1"]; },
    },
    {
      name: "placeholder",
      checkId: "SC11.3.placeholder_anchor",
      evidence: "anchor-99",
      mutate: (chapter) => { chapter.authoring!.sourceAnchors!.effectiveAnchors.hook = ["anchor-99"]; },
    },
    {
      // SC11.6 fires for an anchor that EXISTS and is chapter-correct but whose KIND cannot
      // back the unit's claim type. ch01.concept.harbor is a `concept` anchor, and
      // defaultClaimTypesFor("concept") omits quiz_prompt/quiz_explanation — so citing it on a
      // quiz unit is genuinely unsupportive and must surface the precise SC11.6.
      // NOTE: an earlier revision planted ch01.ex.lantern here, but a named_example anchor DOES
      // support quiz claims — that under-uses its hardSpecifics, which is the distinct, coarser
      // SC11.2 failure (exercised as the boundary's other side below), not SC11.6.
      name: "unsupported",
      checkId: "SC11.6.unsupported_anchor",
      evidence: "ch01.concept.harbor",
      mutate: (chapter) => { chapter.authoring!.sourceAnchors!.effectiveAnchors["quiz.questions[0]"] = ["ch01.concept.harbor"]; },
    },
  ];
  for (const c of cases) {
    const chapter = fullyAnchoredChapter();
    c.mutate(chapter);
    const findings = checkChapterProvenance(chapter, sidecar());
    assert.ok(
      findings.some((finding) => finding.checkId === c.checkId && finding.evidence === c.evidence),
      `${c.name} should raise ${c.checkId}; got ${findings.map((finding) => `${finding.checkId}:${finding.evidence}`).join(", ")}`,
    );
  }
});

test("SC11 boundary: supported-but-missing-specific → SC11.2; present-but-unsupportive → SC11.6", () => {
  // These two failure modes are DISTINCT and must not collapse. SC11.2 is the coarser "you
  // cited a supporting anchor but did not build the unit from its hardSpecifics"; SC11.6 is the
  // precise "this anchor's kind cannot back this claim type at all". The validator checks SC11.6
  // before SC11.2 (with `continue`), so each failure mode reports its own most-actionable code.
  // Both are v2 blockers (finalGate catalog). This test pins each side so the precedence cannot
  // silently invert.

  // Side A — anchor SUPPORTS the claim type but the unit omits its verbatim specifics → SC11.2.
  // Package 1B: the unit is an EXAMPLE, not a quiz question. SC11.2's per-unit minimums are
  // now derived from the section gate, which stopped demanding a verbatim token of quiz
  // stems and cards (SEC56/SEC58 retired) and keeps one for examples (SEC33) and the
  // implementation plan (SEC74) — a ship gate that demanded what write-time does not would
  // re-block every freshly compiled book. The BOUNDARY this test pins is unchanged.
  const missingSpecific = fullyAnchoredChapter();
  missingSpecific.examples[0].title = "A quiet morning";
  missingSpecific.examples[0].scenario = "A reviewer walks the dock and files one note before lunch.";
  missingSpecific.examples[0].whatToDo = "File the note before the morning meeting.";
  missingSpecific.examples[0].whyItMatters = "Early notes keep the record honest.";
  missingSpecific.authoring!.sourceAnchors!.effectiveAnchors["examples[0]"] = ["ch01.ex.compass"];
  const specificFindings = checkChapterProvenance(missingSpecific, sidecar());
  const sc112 = specificFindings.filter((f) => String(f.checkId) === "SC11.2.anchor_specific_not_present" && f.evidence === "ch01.ex.compass");
  assert.ok(sc112.length > 0, "supported anchor missing its hardSpecifics must raise SC11.2");
  assert.ok(sc112.every((f) => f.severity === "blocker"), "SC11.2 must stay a blocker");
  assert.ok(
    !specificFindings.some((f) => String(f.checkId) === "SC11.6.unsupported_anchor" && f.evidence === "ch01.ex.compass"),
    "a genuinely supporting anchor must NOT be mislabeled unsupported (SC11.6)",
  );

  // Side B — anchor EXISTS and is chapter-correct but its kind cannot back the claim type → SC11.6.
  // ch01.concept.harbor is a `concept` anchor; concept.supportsClaimTypes omits quiz_prompt.
  const unsupportive = fullyAnchoredChapter();
  unsupportive.authoring!.sourceAnchors!.effectiveAnchors["quiz.questions[0]"] = ["ch01.concept.harbor"];
  const unsupportiveFindings = checkChapterProvenance(unsupportive, sidecar());
  const sc116 = unsupportiveFindings.filter((f) => String(f.checkId) === "SC11.6.unsupported_anchor" && f.evidence === "ch01.concept.harbor");
  assert.ok(sc116.length > 0, "present-but-unsupportive anchor must raise SC11.6");
  assert.ok(sc116.every((f) => f.severity === "blocker"), "SC11.6 must stay a blocker");
  assert.ok(
    !unsupportiveFindings.some((f) => String(f.checkId) === "SC11.2.anchor_specific_not_present" && f.evidence === "ch01.concept.harbor"),
    "an unsupportive anchor must report the precise SC11.6, not the coarser SC11.2",
  );
});

test("SC11.2 minimums are DERIVED from the section gate (package 1B): quiz and cards owe nothing, examples owe one", () => {
  // The ship gate must never demand what the write-time gate does not, or every freshly
  // compiled book re-blocks at QC — this file's own history records that happening twice.
  // Package 1B retired SEC56/SEC58 (a quiz stem, its explanation and a card back no longer
  // owe a verbatim token of the case they cite) and dropped SEC33 from two to one, so the
  // table here follows: example 1, implementation_guidance 1, everything else 0.

  // A quiz unit citing a specifics-rich case and naming none of its details: no SC11.2.
  const quiz = fullyAnchoredChapter();
  quiz.authoring!.sourceAnchors!.effectiveAnchors["quiz.questions[0]"] = ["ch01.ex.lantern"];
  quiz.quiz.questions[0].prompt = "The shift changes hands mid-morning - what do you check first?";
  quiz.quiz.questions[0].explanation = "Check the record first, before the shift note is overwritten.";
  const quizHits = checkChapterProvenance(quiz, sidecar())
    .filter((f) => String(f.checkId) === "SC11.2.anchor_specific_not_present" && String(f.message).includes("quiz.questions[0]"));
  assert.deepEqual(quizHits.map((f) => f.message), [], "a quiz unit no longer owes a verbatim specific at ship, because write-time no longer demands one");

  // A review card, same shape, same answer.
  const card = fullyAnchoredChapter();
  card.authoring!.sourceAnchors!.effectiveAnchors["reviewCards[0]"] = ["ch01.ex.lantern"];
  card.reviewCards[0].front = "What do you check when a shift changes hands?";
  card.reviewCards[0].back = "Check the record before the note is overwritten, because the earlier state is the one that decides.";
  const cardHits = checkChapterProvenance(card, sidecar())
    .filter((f) => String(f.checkId) === "SC11.2.anchor_specific_not_present" && String(f.message).includes("reviewCards[0]"));
  assert.deepEqual(cardHits.map((f) => f.message), [], "a card no longer owes a verbatim specific at ship");

  // An EXAMPLE keeps a floor of one, and the message states it.
  const example = fullyAnchoredChapter();
  example.examples[0].title = "A quiet morning";
  example.examples[0].scenario = "A reviewer walks the dock and files one note before lunch.";
  example.examples[0].whatToDo = "File the note before the morning meeting.";
  example.examples[0].whyItMatters = "Early notes keep the record honest.";
  example.authoring!.sourceAnchors!.effectiveAnchors["examples[0]"] = ["ch01.ex.compass"];
  const exampleHits = checkChapterProvenance(example, sidecar())
    .filter((f) => String(f.checkId) === "SC11.2.anchor_specific_not_present" && f.evidence === "ch01.ex.compass");
  assert.ok(exampleHits.length >= 1, "an example that names none of its cited case's details still blocks");
  assert.match(exampleHits[0].message, /<1 of its hardSpecifics/, "and the message states the one-specific floor");

  // One of the two specifics present clears it (the retired demand was two).
  const oneSpecific = fullyAnchoredChapter();
  oneSpecific.examples[0].title = "A rushed handover";
  oneSpecific.examples[0].scenario = "A rushed handover; the compass reading is taken before the shift ends.";
  oneSpecific.examples[0].whatToDo = "Take the reading before the handover.";
  oneSpecific.examples[0].whyItMatters = "Early checks catch drift before it compounds.";
  oneSpecific.authoring!.sourceAnchors!.effectiveAnchors["examples[0]"] = ["ch01.ex.compass"];
  const oneHits = checkChapterProvenance(oneSpecific, sidecar())
    .filter((f) => String(f.checkId) === "SC11.2.anchor_specific_not_present" && f.evidence === "ch01.ex.compass");
  assert.deepEqual(oneHits.map((f) => f.message), [], "one pooled specific clears the example floor");
});

test("SC11.8 (package 1B): a memorable line stacking two source specifics is reported as MAJOR, never a blocker", () => {
  // The write-time rule inverted: SEC16 used to demand TWO of one cited case's specifics
  // inside the line — which is why 11 of the 12 lines on the live Franklin package are
  // identifier pairs — and now caps a line at ONE. The ship gate reports the cap instead of
  // blocking on it, ON PURPOSE: every package promoted before this change carries token-pair
  // lines, and a blocker here would retro-block them at re-promote for a defect the
  // write-time gate now prevents at the source.
  const stacked = fullyAnchoredChapter();
  stacked.memorableLines![0].text = "The lantern ledger closed the gap the beacon left open.";
  const findings = checkChapterProvenance(stacked, sidecar())
    .filter((f) => String(f.checkId) === "SC11.8.memorable_line_specific_stack");
  assert.equal(findings.length, 1, `a stacked line must be reported once; got ${JSON.stringify(findings.map((f) => f.message))}`);
  assert.equal(findings[0].severity, "major", "reported, not blocked — see the retro-block note above");
  assert.match(findings[0].message, /carries 3 source specifics/, "the message states what it counted");

  // A line that states the idea, or names one detail, is silent.
  const stated = fullyAnchoredChapter();
  stated.memorableLines![0].text = "A tidy record beats a good memory every single time.";
  assert.deepEqual(
    checkChapterProvenance(stated, sidecar()).filter((f) => String(f.checkId) === "SC11.8.memorable_line_specific_stack"),
    [],
    "a line that states the principle carries no quota at all",
  );
  const one = fullyAnchoredChapter();
  one.memorableLines![0].text = "A lantern is cheaper than the argument about who left it dark.";
  assert.deepEqual(
    checkChapterProvenance(one, sidecar()).filter((f) => String(f.checkId) === "SC11.8.memorable_line_specific_stack"),
    [],
    "one specific is inside the cap",
  );
});

test("SC11.7 (package 1B): the chapter must TEACH the case its quiz cites, and the example arm is write-time only", () => {
  // The ship-side mirror of SEC14/SEC128, and what replaces the per-unit quotas removed
  // above: grounding is no longer "every unit repeats a token" but "the chapter's own
  // reader-visible prose carries at least two of each cited case's hard specifics, once".
  const untaught = fullyAnchoredChapter();
  untaught.authoring!.sourceAnchors!.effectiveAnchors["quiz.questions[0]"] = ["ch01.ex.quay"];
  untaught.breakdown.fastRead = "A shift changes hands and the record decides what happened.";
  untaught.breakdown.deepRead = "The earlier state is the one that settles the argument later on.";
  untaught.breakdown.fullRead = "Nothing here names the case the quiz is built from.";
  untaught.hook = "A shift changes hands and nobody writes the number down.";
  untaught.counterintuition = "The later note is the one everyone trusts and the wrong one to trust.";
  untaught.keyTakeaway = "Write the number down while it is still true.";
  const taughtFindings = checkChapterProvenance(untaught, sidecar())
    .filter((f) => String(f.checkId) === "SC11.7.chapter_case_not_taught" && f.evidence === "ch01.ex.quay");
  assert.equal(taughtFindings.length, 1, `a case the quiz tests and the prose never teaches must block; got ${JSON.stringify(taughtFindings)}`);
  assert.equal(taughtFindings[0].severity, "blocker");

  // The SAME case cited by an EXAMPLE is not a ship-time finding. The write-time gate
  // (SEC128) does cover the example pack — a fresh draft can be retried into shape — but
  // applying that arm at ship would retro-block already-promoted packages for a defect no
  // repair round is aimed at, and it is the scope SEC120 chose for the same reason.
  const exampleOnly = fullyAnchoredChapter();
  exampleOnly.authoring!.sourceAnchors!.effectiveAnchors["examples[0]"] = ["ch01.ex.quay"];
  exampleOnly.examples[0].scenario = "A dock hand counts the quay cargo before the harbor office closes.";
  exampleOnly.breakdown.fastRead = "A shift changes hands and the record decides what happened.";
  exampleOnly.breakdown.deepRead = "The earlier state is the one that settles the argument later on.";
  exampleOnly.breakdown.fullRead = "Nothing here names the case the example is built from.";
  exampleOnly.hook = "A shift changes hands and nobody writes the number down.";
  exampleOnly.counterintuition = "The later note is the one everyone trusts and the wrong one to trust.";
  exampleOnly.keyTakeaway = "Write the number down while it is still true.";
  assert.deepEqual(
    checkChapterProvenance(exampleOnly, sidecar()).filter((f) => String(f.checkId) === "SC11.7.chapter_case_not_taught"),
    [],
    "the example arm of chapter coverage is write-time only",
  );
});

test("SC11.2 CF-J tolerance: a page-citation-shaped hardSpecific counts as satisfied by construction", () => {
  // CF-J Task 4: SC11.2's one text-based clause requires the cited anchor's hardSpecifics
  // verbatim in the unit, and the radical-candor research minted page citations INTO
  // hardSpecifics ("Ch. 6 p. 138"), so writers satisfied it by quoting the citation into
  // reader prose. The projection now withholds citations from the writer, so a
  // citation-shaped specific is an internal coordinate, satisfied by construction.
  const citedSidecar = sidecar();
  citedSidecar.namedExamples[1].hardSpecifics = ["compass", "Ch. 6 p. 138"];

  const tolerant = fullyAnchoredChapter();
  tolerant.examples[0].title = "A rushed handover";
  tolerant.examples[0].scenario = "A rushed handover; the compass reading is taken before the shift ends.";
  tolerant.examples[0].whatToDo = "Take the reading before the handover.";
  tolerant.examples[0].whyItMatters = "Early checks catch drift before it compounds.";
  tolerant.authoring!.sourceAnchors!.effectiveAnchors["examples[0]"] = ["ch01.ex.compass"];
  const tolerantHits = checkChapterProvenance(tolerant, citedSidecar)
    .filter((f) => String(f.checkId) === "SC11.2.anchor_specific_not_present" && String(f.message).includes("example[0]"));
  assert.deepEqual(tolerantHits.map((f) => f.message), [], "no page citation is required in reader prose");

  // Package 1B moved the BOUND to write time. At ship, with the example floor at one, a
  // citation-shaped specific alone satisfies SC11.2 — which is the tolerant direction, the
  // only safe one for a ship gate. The write-time gate grants no such credit: SEC33 counts
  // raw inclusion and the same example, with the real specific gone, blocks there.
  const bare = {
    schemaVersion: "section-artifact-v1",
    artifactType: "example-pack",
    chapterId: "zz-cfj-ch01",
    examples: [{
      exampleId: "ex01",
      slotId: "s1",
      title: "A rushed handover",
      scenario: "A rushed handover; the record gets checked before the shift ends, and the note is filed the same hour.",
      whatToDo: "Check the record before the handover.",
      whyItMatters: "Early checks catch drift before it compounds.",
      sourceAnchorIds: ["ch01.ex.compass"],
      sourceFactIds: [],
      namedCaseIds: [],
    }],
  } as unknown as ExamplePackV1;
  const packet = {
    allowedAnchors: [{
      id: "ch01.ex.compass",
      kind: "named_example",
      label: "compass",
      text: "compass",
      hardSpecifics: ["compass", "Ch. 6 p. 138"],
      supportsClaimTypes: ["example"],
    }],
    facts: [],
    namedCases: [],
    allowedEntities: [],
    allowedPlaces: [],
    allowedNumbers: [],
  } as unknown as SourcePacketV1;
  const bp = {
    chapterNumber: 1,
    chapterId: "zz-cfj-ch01",
    reservedVariety: { allowedNames: [] },
    sections: { quiz: [], cards: [], examples: [{ slotId: "s1", allowedNames: [], requiredFactIds: [], requiredCaseIds: [], forbiddenVenues: [] }] },
    constraints: { allowedFactIds: [], allowedCaseIds: [], forbiddenClaims: [], forbiddenLeakage: [], bannedHouseTics: [] },
  } as unknown as ChapterBlueprintV1;
  const writeTime = validateExamplePack(bare, bp, packet).filter((f: SectionFinding) => f.checkId === "SEC33.example_anchor_specifics");
  assert.equal(writeTime.length, 1, "write-time SEC33 grants no page-citation credit — the bound lives there");
  assert.match(writeTime[0].message, /0\/1/);
});

test("source evidence loader validates before rendering explicit editor and planner inputs", () => {
  const root = fixtureRoot("order");
  rmSync(root, { recursive: true, force: true });
  const { runsRoot } = writeSourceRun(root);
  try {
    const evidence = loadPlanningSourceEvidence(BOOK, 1, { runsRoot, requireSourceV2: true, chapterTitle: "The harbor principle" });
    assert.equal(evidence.sourceV2, true);
    assert.equal(evidence.anchors.some((anchor) => anchor.id === "ch01.fact.1"), true);
    assert.match(renderBookSourceForEditor(evidence) ?? "", /Validated source-v2 anchor catalog/);
    assert.match(renderChapterSourceForPlanner(evidence) ?? "", /Exact validated chapter sidecar/);
    assert.match(renderChapterSourceForPlanner(evidence) ?? "", /Allowed source anchors/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("missing or invalid required source-v2 evidence fails closed during pure evidence loading", () => {
  for (const variant of ["missing", "invalid"] as const) {
    const root = fixtureRoot(`fail-closed-${variant}`);
    rmSync(root, { recursive: true, force: true });
    const runsRoot = resolve(root, "runs");
    if (variant === "invalid") {
      const invalid = sidecar();
      delete invalid.centralConcept.id;
      writeSourceRun(root, BOOK, 1, invalid);
    }
    try {
      assert.throws(
        () => loadPlanningSourceEvidence(BOOK, 1, { runsRoot, requireSourceV2: true, chapterTitle: "The harbor principle" }),
        /source evidence blocked/,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

test("source fact changes invalidate brief, plan, and downstream chapter cache manifests", () => {
  const root = fixtureRoot("cache");
  rmSync(root, { recursive: true, force: true });
  const { stateRoot, runsRoot, sidecarPath } = writeSourceRun(root);
  try {
    const provider = currentProviderIdentity("writer");
    const codeVersion = "source-cache-test";
    const book = bookMeta();
    const chapter = chapterSpec();
    const before = loadPlanningSourceEvidence(book.bookId, chapter.chapterNumber, { runsRoot, requireSourceV2: true });
    const artifacts = [
      {
        path: resolve(stateRoot, "briefs", `${BOOK}.brief.json`),
        artifactType: "book-brief" as const,
        artifactId: BOOK,
        generatorName: "book-brief",
        oldInputs: buildBriefCacheInputs(book, provider, codeVersion, { stateRoot, runsRoot, sourceEvidence: before }),
        newInputs: () => buildBriefCacheInputs(book, provider, codeVersion, { stateRoot, runsRoot, sourceEvidence: loadPlanningSourceEvidence(book.bookId, chapter.chapterNumber, { runsRoot, requireSourceV2: true }) }),
      },
      {
        path: resolve(stateRoot, "plans", `${chapter.chapterId}.plan.json`),
        artifactType: "chapter-plan" as const,
        artifactId: chapter.chapterId,
        generatorName: "chapter-plan",
        oldInputs: buildPlanCacheInputs(book, chapter, provider, codeVersion, { stateRoot, runsRoot, sourceEvidence: before }),
        newInputs: () => buildPlanCacheInputs(book, chapter, provider, codeVersion, { stateRoot, runsRoot, sourceEvidence: loadPlanningSourceEvidence(book.bookId, chapter.chapterNumber, { runsRoot, requireSourceV2: true }) }),
      },
      {
        path: resolve(stateRoot, "chapters", `${chapter.chapterId}.v21-native.chapter.json`),
        artifactType: "chapter" as const,
        artifactId: chapter.chapterId,
        generatorName: "generateChapter",
        oldInputs: buildChapterCacheInputs(book, chapter, provider, codeVersion, { stateRoot, runsRoot, sourceEvidence: before }),
        newInputs: () => buildChapterCacheInputs(book, chapter, provider, codeVersion, { stateRoot, runsRoot, sourceEvidence: loadPlanningSourceEvidence(book.bookId, chapter.chapterNumber, { runsRoot, requireSourceV2: true }) }),
      },
    ];
    for (const artifact of artifacts) {
      writeJson(artifact.path, { ok: true, artifact: artifact.artifactId });
      writeStageCacheManifest({
        artifactPath: artifact.path,
        artifactType: artifact.artifactType,
        artifactId: artifact.artifactId,
        inputs: artifact.oldInputs,
        generatorName: artifact.generatorName,
        provider,
        codeVersion,
      });
    }
    const changed = sidecar();
    changed.testableFacts[0].claim = "Synthetic fact 1 changed at the source.";
    writeJson(sidecarPath, changed);
    for (const artifact of artifacts) {
      const validation = validateStageCache({
        artifactPath: artifact.path,
        artifactType: artifact.artifactType,
        artifactId: artifact.artifactId,
        inputs: artifact.newInputs(),
        generatorName: artifact.generatorName,
        provider,
        codeVersion,
      });
      assert.equal(validation.ok, false, `${artifact.artifactType} cache must stale after source change`);
      assert.ok(!validation.ok && validation.changedDependencies.includes("source-evidence"), `${artifact.artifactType} should name source-evidence as changed`);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("promotion projection strips public internals but manifest retains state authoring evidence", () => {
  const root = fixtureRoot("promotion");
  rmSync(root, { recursive: true, force: true });
  const { stateRoot, runsRoot } = writeSourceRun(root);
  try {
    const chapter = fullyAnchoredChapter();
    const shipped = stripInternalFields(chapter);
    writeCanonicalIndexFixture(BOOK, [{ chapterId: chapter.chapterId, number: chapter.number, title: chapter.title }], resolve(stateRoot, "indexes"));
    writeJson(resolve(stateRoot, "chapters", `${chapter.chapterId}.v21-native.chapter.json`), chapter);
    writeJson(resolve(stateRoot, "qc", `${BOOK}-ch01.qc.json`), {
      schemaVersion: "qc-attest-v1",
      bookId: BOOK,
      chapterNumber: 1,
      chapterId: chapter.chapterId,
      verdict: "PUBLISHABLE",
      contentHash: chapterContentHash(chapter),
      hashVersion: "v2",
      reviewer: "codex-qc:source-anchor-test",
      reviewedAt: "2026-06-23T00:00:00.000Z",
      roundId: "round-source-anchor-test",
      roundRole: "attest",
    });
    // A source-v2 book requires a verified source-reality record before a v2
    // manifest can bind it. Write one covering every verifiable item.
    const recordPath = resolve(root, ".chapterflow", `source-verify-${BOOK}.md`);
    const items = collectSourceVerifyItems(BOOK, { stateRoot, runsRoot });
    const byChapter = new Map<number, Array<{ id: string; kind: string; verdict: string; sourceRef: string; note: string }>>();
    for (const it of items) {
      const arr = byChapter.get(it.chapterNumber) ?? [];
      arr.push({ id: it.id, kind: it.kind, verdict: "VERIFIED", sourceRef: `https://example.com/${BOOK}/${it.id}`, note: `verified ${it.id} against its cited source` });
      byChapter.set(it.chapterNumber, arr);
    }
    const record = {
      schemaVersion: "source-verify-record-v1",
      bookId: BOOK,
      chapters: [...byChapter.keys()].sort((a, b) => a - b).map((chapterNumber) => ({ chapterNumber, items: byChapter.get(chapterNumber)! })),
    };
    mkdirSync(resolve(recordPath, ".."), { recursive: true });
    writeFileSync(recordPath, "```json\n" + JSON.stringify(record, null, 2) + "\n```\n", "utf8");

    const manifest = buildProductionManifest({
      bookId: BOOK,
      title: "Source Anchors",
      author: "Fixture Author",
      contentOwner: "chapterflow",
      chapters: [shipped],
      stateRoot,
      runsRoot,
      recordPath,
      createdAt: "2026-06-23T00:00:00.000Z",
      runId: "run-a",
      packagePath: resolve(root, "book-packages", `${BOOK}.v21.json`),
    });
    assert.equal(manifest.ok, true, manifest.ok ? "" : manifest.findings.map((finding) => finding.message).join("\n"));
    if (!manifest.ok) throw new Error("manifest failed");

    const publicJson = JSON.stringify(shipped);
    assert.doesNotMatch(publicJson, /authoring|sourceAnchorId|sourceAnchorIds|keyEvidenceAnchorIds/);
    const stateChapter = JSON.parse(readFileSync(resolve(stateRoot, "chapters", `${chapter.chapterId}.v21-native.chapter.json`), "utf8"));
    assert.ok(stateChapter.authoring?.sourceAnchors?.effectiveAnchors?.hook, "state artifact must retain authoring anchors");
    const manifestChapter = manifest.manifest.payload.chapters[0];
    assert.equal(manifestChapter.authoringEvidence?.schemaVersion, "chapter-source-anchor-map-v1");
    assert.ok(manifestChapter.authoringEvidence?.semanticHash, "manifest must retain a verifiable authoring evidence hash");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
