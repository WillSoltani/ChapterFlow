import assert from "node:assert/strict";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { resolve } from "path";

import { checkChapterProvenance } from "../src/critics/sourceGrounding.js";
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
  // ch01.ex.lantern is a named_example (supportsClaimTypes includes quiz_prompt), so it is a
  // legal anchor for a quiz unit; the quiz prose simply never names lantern/ledger/beacon.
  const missingSpecific = fullyAnchoredChapter();
  missingSpecific.authoring!.sourceAnchors!.effectiveAnchors["quiz.questions[0]"] = ["ch01.ex.lantern"];
  const specificFindings = checkChapterProvenance(missingSpecific, sidecar());
  const sc112 = specificFindings.filter((f) => String(f.checkId) === "SC11.2.anchor_specific_not_present" && f.evidence === "ch01.ex.lantern");
  assert.ok(sc112.length > 0, "supported anchor missing its hardSpecifics must raise SC11.2");
  assert.ok(sc112.every((f) => f.severity === "blocker"), "SC11.2 must stay a blocker");
  assert.ok(
    !specificFindings.some((f) => String(f.checkId) === "SC11.6.unsupported_anchor" && f.evidence === "ch01.ex.lantern"),
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

test("SC11.2 quota rebalance (P15 ship-layer): non-narrative units need 1 verbatim specific, narration keeps 2", () => {
  // Quiz units citing a hardSpecifics-bearing named-example anchor: ONE verbatim
  // specific now clears the ship gate (matches SEC56/SEC58/SEC74 write-time quota).
  const one = fullyAnchoredChapter();
  one.authoring!.sourceAnchors!.effectiveAnchors["quiz.questions[0]"] = ["ch01.ex.lantern"];
  one.quiz.questions[0].prompt = "The lantern shift changes hands mid-morning - what do you check first?";
  one.quiz.questions[0].explanation = "Check the lantern record first, before the shift note is overwritten.";
  const oneHits = checkChapterProvenance(one, sidecar())
    .filter((f) => String(f.checkId) === "SC11.2.anchor_specific_not_present" && String(f.message).includes("quiz.questions[0]"));
  assert.deepEqual(oneHits.map((f) => f.message), [], "one verbatim specific clears SC11.2 on quiz units");
  // ZERO specifics still blocks, and the message carries the rebalanced quota.
  const zero = fullyAnchoredChapter();
  zero.authoring!.sourceAnchors!.effectiveAnchors["quiz.questions[0]"] = ["ch01.ex.lantern"];
  zero.quiz.questions[0].prompt = "The shift changes hands mid-morning - what do you check first?";
  zero.quiz.questions[0].explanation = "Check the record first, before the shift note is overwritten.";
  const zeroHits = checkChapterProvenance(zero, sidecar())
    .filter((f) => String(f.checkId) === "SC11.2.anchor_specific_not_present" && String(f.message).includes("quiz.questions[0]"));
  assert.ok(zeroHits.length >= 1, "zero specifics still blocks quiz units");
  assert.match(zeroHits[0].message, /<1 of its hardSpecifics/, "message reports the min-1 quota");
  // NARRATION keeps min 2: an example using only 1 of the anchor's specifics blocks.
  // (Fully overwrite the unit text — the makeChapter harbor fixture naturally contains
  // several specifics words, so a surgical suffix replace leaves >=2 present.)
  const ex = fullyAnchoredChapter();
  ex.examples[0].title = "A rushed handover";
  ex.examples[0].scenario = "A rushed handover; the lantern record gets checked before the shift ends.";
  ex.examples[0].whatToDo = "Check the record before the handover.";
  ex.examples[0].whyItMatters = "Early checks catch drift before it compounds.";
  const exHits = checkChapterProvenance(ex, sidecar())
    .filter((f) => String(f.checkId) === "SC11.2.anchor_specific_not_present" && String(f.message).includes("example["));
  assert.ok(exHits.length >= 1, "an example with 1 of 2+ specifics still blocks (narration keeps 2)");
  assert.match(exHits[0].message, /<2 of its hardSpecifics/, "narration message keeps the min-2 quota");
});

test("SC11.2 memorable_line OR-semantics (11p ship mirror): one fully-grounding cited case clears a multi-case line; zero blocks ONCE", () => {
  // LIVE WEDGE this pins: a memorable line inherits every case its source tier
  // cites, and the per-anchor loop demanded 2 specifics from EACH — a <=14-word
  // line citing three cases is structurally unsatisfiable. The write-time gate
  // (SEC16) was corrected to OR-semantics under owner delegation (11p); the
  // first live QC round to reach the ship gate re-blocked a freshly-passed book
  // with 9 identical SC11.2 blockers. Ship must agree with write-time.

  // Case 1 — the line fully grounds ONE cited case (lantern+ledger verbatim);
  // the other two cited cases contribute nothing. Must pass.
  const grounded = fullyAnchoredChapter();
  grounded.memorableLines![0].text = "The lantern ledger closed the gap the beacon left open.";
  grounded.authoring!.sourceAnchors!.effectiveAnchors["memorableLines[0]"] = ["ch01.ex.lantern", "ch01.ex.compass", "ch01.ex.quay"];
  const groundedFindings = checkChapterProvenance(grounded, sidecar())
    .filter((f) => String(f.checkId) === "SC11.2.anchor_specific_not_present" && f.message.includes("memorableLines[0]"));
  assert.deepEqual(groundedFindings.map((f) => f.message), [], "one fully-grounding case must clear the line");

  // Case 2 — NO cited case reaches 2 specifics. Blocks exactly ONCE (not once
  // per anchor), and the message names every shortfall so the writer can pick one.
  const ungrounded = fullyAnchoredChapter();
  ungrounded.memorableLines![0].text = "A tidy record beats a good memory every single time.";
  ungrounded.authoring!.sourceAnchors!.effectiveAnchors["memorableLines[0]"] = ["ch01.ex.lantern", "ch01.ex.compass", "ch01.ex.quay"];
  const ungroundedFindings = checkChapterProvenance(ungrounded, sidecar())
    .filter((f) => String(f.checkId) === "SC11.2.anchor_specific_not_present" && f.message.includes("memorableLines[0]"));
  assert.equal(ungroundedFindings.length, 1, `zero grounding blocks once, not per anchor: ${JSON.stringify(ungroundedFindings.map((f) => f.message))}`);
  assert.match(ungroundedFindings[0].message, /none of them fully grounds/, "the message states the OR rule");
  for (const id of ["ch01.ex.lantern", "ch01.ex.compass", "ch01.ex.quay"]) {
    assert.ok(ungroundedFindings[0].message.includes(id), `every shortfall named: ${id}`);
  }

  // Control — NON-memorable narration units keep per-anchor AND semantics: a quiz
  // unit's per-anchor blocker shape is pinned by the boundary test above, and an
  // example unit citing a case it never names still blocks per anchor.
  // (fixture examples append lantern specifics to every scenario, so cite compass —
  // a case the example text never names — to prove the per-anchor demand still fires)
  // (the base fixture's example text names EVERY synthetic specific, so blank it —
  // the control needs an example whose text carries at most one of compass/tide/mast)
  const example = fullyAnchoredChapter();
  example.examples[0].title = "A quiet morning";
  example.examples[0].scenario = "A reviewer walks the dock and files one note before lunch.";
  example.examples[0].whatToDo = "File the note before the morning meeting.";
  example.examples[0].whyItMatters = "Early notes keep the record honest.";
  example.examples[0].sourceAnchorId = "ch01.ex.compass";
  example.examples[0].sourceAnchorIds = ["ch01.ex.compass"];
  example.authoring!.sourceAnchors!.effectiveAnchors["examples[0]"] = ["ch01.ex.compass"];
  const exampleFindings = checkChapterProvenance(example, sidecar())
    .filter((f) => String(f.checkId) === "SC11.2.anchor_specific_not_present" && f.evidence === "ch01.ex.compass");
  assert.ok(exampleFindings.length > 0, "non-memorable narration keeps AND semantics");
});

test("SC11.2 CF-J tolerance: a page-citation-shaped hardSpecific counts as satisfied by construction; real specifics still bind", () => {
  // CF-J Task 4 investigation result: SC11 matches anchors BY ID against the sidecar
  // catalog; its ONE text-based clause is SC11.2, which requires the unit text to
  // contain the cited anchor's hardSpecifics VERBATIM. The radical-candor research
  // minted page citations INTO hardSpecifics ("Ch. 6 p. 138"), so writers satisfied
  // SC11.2 by quoting the citation into reader prose. The projection now withholds
  // citations from the writer — SC11.2 therefore treats a citation-shaped specific
  // as an internal coordinate, satisfied by construction. Strictly TOLERANT:
  // `present` can only rise, so no unit can newly block.
  const citedSidecar = sidecar();
  // lantern anchor: one REAL specific + one citation locator (the radical-candor shape).
  citedSidecar.namedExamples[0].hardSpecifics = ["lantern", "Ch. 6 p. 138"];

  // NARRATION unit (example, min 2): text carries the real specific but NOT the
  // citation — previously SC11.2 blocked; the citation now counts by construction.
  const tolerant = fullyAnchoredChapter();
  tolerant.examples[0].title = "A rushed handover";
  tolerant.examples[0].scenario = "A rushed handover; the lantern record gets checked before the shift ends.";
  tolerant.examples[0].whatToDo = "Check the record before the handover.";
  tolerant.examples[0].whyItMatters = "Early checks catch drift before it compounds.";
  const tolerantHits = checkChapterProvenance(tolerant, citedSidecar)
    .filter((f) => String(f.checkId) === "SC11.2.anchor_specific_not_present" && String(f.message).includes("example[0]"));
  assert.deepEqual(tolerantHits.map((f) => f.message), [], "real specific present + citation auto-satisfied → SC11.2 passes without page cites in reader prose");

  // The tolerance is BOUNDED: drop the real specific too and the unit still blocks
  // (the citation contributes 1; the narration quota is 2).
  const stillBound = fullyAnchoredChapter();
  stillBound.examples[0].title = "A rushed handover";
  stillBound.examples[0].scenario = "A rushed handover; the record gets checked before the shift ends.";
  stillBound.examples[0].whatToDo = "Check the record before the handover.";
  stillBound.examples[0].whyItMatters = "Early checks catch drift before it compounds.";
  const boundHits = checkChapterProvenance(stillBound, citedSidecar)
    .filter((f) => String(f.checkId) === "SC11.2.anchor_specific_not_present" && String(f.message).includes("example[0]"));
  assert.ok(boundHits.length >= 1, "with the real specific absent, SC11.2 still blocks — the tolerance covers ONLY citation-shaped specifics");
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
