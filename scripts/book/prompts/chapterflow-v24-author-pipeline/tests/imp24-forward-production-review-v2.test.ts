/** IMP-24 future-production compiler/conductor seams. Zero live/model calls. */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import { fxCase, fxChapter, fxFact, fxPacket, fxPlan, fxPlanUnit } from "./migrationFixtures.js";
import { sourcePacketHash } from "../src/compiler/sourcePacket.js";
import { sourceUsePlanHash } from "../src/contracts/sourceUsePlan.js";
import { hashCanonical, sha256Hex } from "../src/contracts/contractUtil.js";
import { chapterContentHash } from "../src/critics/qcAttestation.js";
import { semanticSourceHash } from "../src/source/sourceIntegrity.js";
import { ensureTrailingNewline } from "../src/lib/atomicWrite.js";
import { renderChapterReaderDocPhase1 } from "../src/review/renderReaderDoc.js";
import {
  completeKeyFreeReaderDocumentBytesV2,
  completeKeyFreeReaderDocumentSha256V2,
} from "../src/review/completeKeyFreeReaderDocumentV2.js";
import { buildQuizDerivation, commitQuizDerivation, quizItemId, renderQuizPhase2Doc } from "../src/review/quizDerivation.js";
import {
  QUIZ_INTEGRITY_MODEL_OUTPUT_V2_SCHEMA,
  READER_EXPERIENCE_MODEL_OUTPUT_V2_SCHEMA,
  SOURCE_INTEGRITY_MODEL_OUTPUT_V2_SCHEMA,
} from "../src/contracts/reviewModelOutputV2.js";
import {
  ReviewEvidenceEnvelopeBudgetError,
} from "../src/review/reviewEvidenceEnvelope.js";
import {
  parseQuizIntegrityModelOutputV2,
  parseReaderExperienceModelOutputV2,
  parseSourceIntegrityModelOutputV2,
} from "../src/review/reviewModelOutputV2.js";
import {
  FORWARD_PRODUCTION_REVIEW_INSTRUMENT_V2,
  FORWARD_PRODUCTION_REVIEW_PROTOCOL_V2,
  assembleProductionQuizReviewV2,
  assembleProductionReaderReviewV2,
  assembleProductionSourcePartitionReviewV2,
  compileProductionQuizEnvelopeV2,
  compileProductionReaderEnvelopeV2,
  compileProductionSourceEnvelopesV2,
  mergeProductionSourceReviewsV2,
  productionReviewEnvelopeSetSha256,
  productionReviewV2FreshnessErrors,
  type ForwardProductionAuthoritativeReviewsV2,
} from "../src/review/forwardProductionReviewV2.js";
import {
  REVIEW_EVIDENCE_PROTOCOL_V2,
  deriveReaderDecisionCategoryV2,
  reviewProtocolFileAccessFailureV2,
  reviewProtocolFreshnessErrorsV2,
  reviewProtocolHasProhibitedConductorEchoV2,
} from "../src/review/reviewProtocolV2.js";
import type { ChapterV21 } from "../src/types.js";

const ROUTE = { model: "fixture-profile", effort: "high", routeReceiptSha256: "9".repeat(64) };
const SCHEMA = { reader: "4".repeat(64), source: "5".repeat(64), quiz: "6".repeat(64) };

function completeChapter(): ChapterV21 {
  return fxChapter({
    chapterId: "zz-fixture-book-ch01",
    number: 1,
    title: "Defaults and friction",
    readingTimeMinutes: 7,
    hook: "Friction hides in defaults nobody questions.",
    counterintuition: "The default is not neutral; it quietly decides how much effort continuation requires.",
    breakdown: {
      fastRead: "A team shortened a form and completion rose.",
      deepRead: "Removing a field reduced the work required to continue.",
      fullRead: "The same mechanism applies when a default path carries avoidable steps.",
    },
    keyTakeaway: "Change the default path, not the person.",
    tryThisNow: "Remove one field from a form you own.",
    examples: [{
      exampleId: "internal-example-id",
      sourceAnchorId: "ch01.ex.a",
      sourceAnchorIds: ["ch01.ex.a"],
      title: "The shorter form",
      tags: ["support", "forms"],
      planSpec: {
        domain: "internal-domain-marker",
        audience: "internal-audience-marker",
        stakes: "internal-stakes-marker",
        format: "internal-format-marker",
        requiredBeat: "internal-required-beat-marker",
      },
      scenario: "A support team removed one optional field from an intake form.",
      whatToDo: "Cut one field.",
      whyItMatters: "Completion improved.",
    }],
    quiz: {
      passingScorePercent: 70,
      questions: [{
        questionId: "internal-question-id",
        sourceAnchorId: "ch01.fact.1",
        sourceAnchorIds: ["ch01.fact.1"],
        keyEvidenceAnchorIds: ["ch01.fact.1"],
        prompt: "Why did completion rise?",
        choices: ["The team advertised", "A field was removed", "Users were paid"],
        correctIndex: 1,
        explanation: "Hidden key explanation: removing the field lowered friction.",
        bloomsLevel: "apply",
        depthLevel: "standard",
      }],
    },
    reviewCards: [{
      cardId: "internal-card-id",
      sourceAnchorId: "ch01.fact.1",
      sourceAnchorIds: ["ch01.fact.1"],
      front: "What moved behavior?",
      back: "The default.",
      difficulty: "medium",
    }],
    implementationPlan: {
      title: "Reduce friction",
      coreSkill: "Spot the default",
      ifThenPlans: [{ context: "designing a form", plan: "cut one field" }],
      twentyFourHourChallenge: "Remove one field.",
      weeklyPractice: "Audit one default a week.",
    },
    memorableLines: [{ text: "Defaults decide.", location: "breakdown.deepRead", why: "Compact." }],
    experiencePlan: {
      failureRecovery: {
        normalizingLine: "A missed friction check is a signal to shorten the path, not a reason to abandon the practice.",
        cueQuestion: "Which avoidable step made continuation harder?",
        options: ["Remove one optional field.", "Pre-fill one known value."],
        repairLine: "Return to the smallest removable step and test the path again.",
      },
      transferPrompt: {
        prompt: "Where else does an unquestioned default add avoidable work?",
        contexts: ["Meeting agendas", "Household routines"],
      },
      behaviorLoop: {
        readerPatterns: [{
          id: "internal-reader-pattern-id",
          label: "When a form feels harder than the decision it records",
          mapsToPlanIndex: 0,
          mapsToExampleIndex: 0,
        }],
      },
    },
    authoring: {
      schemaVersion: "chapter-authoring-v1",
      sourceAnchors: {
        schemaVersion: "chapter-source-anchor-map-v1",
        sourceHash: "fixture-source",
        observedAnchorIds: ["ch01.fact.1", "ch01.fact.2", "ch01.ex.a", "ch01.ex.b"],
        effectiveAnchors: {
          hook: ["ch01.fact.1"],
          counterintuition: ["ch01.fact.1"],
          "breakdown.fastRead": ["ch01.fact.1"],
          "breakdown.deepRead": ["ch01.fact.1"],
          "breakdown.fullRead": ["ch01.fact.1"],
          keyTakeaway: ["ch01.fact.1"],
          tryThisNow: ["ch01.fact.1"],
          "examples[0]": ["ch01.ex.a"],
          "quiz.questions[0]": ["ch01.fact.1"],
          "reviewCards[0]": ["ch01.fact.1"],
          "implementationPlan.title": ["ch01.fact.1"],
          "implementationPlan.coreSkill": ["ch01.fact.1"],
          "implementationPlan.ifThenPlans[0]": ["ch01.fact.1"],
          "implementationPlan.twentyFourHourChallenge": ["ch01.fact.1"],
          "implementationPlan.weeklyPractice": ["ch01.fact.1"],
          "memorableLines[0]": ["ch01.fact.1"],
        },
      },
    },
  } as unknown as Partial<ChapterV21>);
}

function sourceFixture() {
  const firstFact = fxFact("ch01.fact.1", {
    claim: "Removing one optional field reduced completion friction.",
    mechanism: "One fewer decision shortened the continuation path.",
    groundedNumbers: ["one field"],
    groundedEntities: ["support team"],
    verificationRefs: ["source-note-1"],
  });
  const secondFact = fxFact("ch01.fact.2", { claim: "A second, unrelated claim." });
  const firstCase = fxCase("ch01.ex.a", { hardSpecifics: ["case-a-specific"] });
  const secondCase = fxCase("ch01.ex.b", { hardSpecifics: ["case-b-specific"] });
  const packet = fxPacket({
    facts: [firstFact, secondFact],
    namedCases: [firstCase, secondCase],
    frameworks: [{ id: "fw.1", name: "Three checks", members: ["one", "two", "three"], completenessRequired: true }],
    allowedAnchors: [
      { id: firstFact.id, kind: "testable_fact", label: "fact one", text: firstFact.claim, supportsClaimTypes: [] },
      { id: secondFact.id, kind: "testable_fact", label: "fact two", text: secondFact.claim, supportsClaimTypes: [] },
      { id: firstCase.id, kind: "named_example", label: firstCase.label, text: firstCase.summary, supportsClaimTypes: [] },
      { id: secondCase.id, kind: "named_example", label: secondCase.label, text: secondCase.summary, supportsClaimTypes: [] },
    ],
  });
  const plan = fxPlan({
    sourcePacketSha256: sourcePacketHash(packet),
    units: [
      fxPlanUnit({
        unitId: "unit.fact.ch01.fact.1",
        origin: "source_bound",
        form: "explanation",
        anchorIds: [firstFact.id],
        detailSufficiency: "concept_only",
      }),
      fxPlanUnit({
        unitId: `unit.case.${firstCase.id}`,
        origin: "source_bound",
        form: "case",
        caseId: firstCase.id,
        anchorIds: [firstCase.id],
        detailSufficiency: "full",
      }),
      fxPlanUnit({
        unitId: "unit.constructed.1",
        origin: "constructed",
        form: "application",
        anchorIds: [],
        framingRequired: true,
        detailSufficiency: "full",
      }),
      fxPlanUnit({
        unitId: "unit.generic.1",
        origin: "generic",
        form: "operational_scenario",
        anchorIds: [],
        framingRequired: false,
        detailSufficiency: "full",
      }),
    ],
  });
  const sidecar = {
    schemaVersion: "source-v2",
    chapterNumber: 1,
    chapterTitle: "Defaults and friction",
    centralConcept: { name: "friction", plainDefinition: "work required to continue" },
    keyClaims: [firstFact.claim],
    namedExamples: [],
    hardEdge: "Do not claim causality beyond the supplied evidence.",
    testableFacts: [],
  };
  return { packet, plan, sidecar };
}

function compileAll() {
  const chapter = completeChapter();
  const legacyPhase1Document = ensureTrailingNewline(renderChapterReaderDocPhase1(chapter));
  const phase1Document = completeKeyFreeReaderDocumentBytesV2(chapter);
  const completeReaderDocument = phase1Document;
  const chapterContentSha256 = chapterContentHash(chapter);
  const readerDocumentSha256 = completeKeyFreeReaderDocumentSha256V2(chapter);
  const { packet, plan, sidecar } = sourceFixture();
  const sourceUsePlanSha256 = sourceUsePlanHash(plan);
  const sourcePacketSha256 = sourcePacketHash(packet);
  const sidecarSha256 = semanticSourceHash(sidecar);
  const reader = compileProductionReaderEnvelopeV2({
    caseId: "production-fixture",
    instrumentVersion: FORWARD_PRODUCTION_REVIEW_INSTRUMENT_V2,
    chapter,
    phase1Document,
    chapterContentSha256,
    readerDocumentSha256,
  });
  const source = compileProductionSourceEnvelopesV2({
    caseId: "production-fixture",
    instrumentVersion: FORWARD_PRODUCTION_REVIEW_INSTRUMENT_V2,
    chapter,
    phase1Document,
    plan,
    packet,
    sidecar,
    anchorCatalog: packet.allowedAnchors,
    chapterContentSha256,
    sourceUsePlanSha256,
    sourcePacketSha256,
    sidecarSha256,
  });
  const derivation = buildQuizDerivation(chapter, {
    answers: ["b"],
    mechanisms: ["Removing the field reduces the work required to continue."],
    confidence: ["high"],
    ambiguities: [],
  }, readerDocumentSha256, "reader-session-fixture");
  const committed = commitQuizDerivation(derivation, {
    documentSha256: readerDocumentSha256,
    questionCount: 1,
    itemIds: [quizItemId(chapter, 0)],
  });
  const quiz = compileProductionQuizEnvelopeV2({
    caseId: "production-fixture",
    instrumentVersion: FORWARD_PRODUCTION_REVIEW_INSTRUMENT_V2,
    chapter,
    phase1Document,
    chapterContentSha256,
    committedDerivation: committed,
  });
  return {
    chapter, phase1Document, legacyPhase1Document, completeReaderDocument, chapterContentSha256, readerDocumentSha256,
    packet, plan, sidecar, sourceUsePlanSha256, sourcePacketSha256, sidecarSha256,
    reader, source, committed, quiz,
  };
}

function assertOrderedDocumentCoverage(document: string, segments: readonly string[]): void {
  assert.ok(segments.length > 0, "reader envelope must contain at least one natural document segment");
  let cursor = 0;
  for (const segment of segments) {
    const offset = document.indexOf(segment, cursor);
    assert.ok(offset >= cursor, "reader segments must be exact document substrings in source order");
    assert.equal(document.slice(cursor, offset).trim(), "", "reader segment gaps may contain only structural whitespace");
    cursor = offset + segment.length;
  }
  assert.equal(document.slice(cursor).trim(), "", "reader segments must cover the document through its final visible byte");
}

test("production V2 uses the shared complete inline compiler and deterministic per-unit source partitions", () => {
  const fixture = compileAll();
  assert.deepEqual(
    fixture.reader.envelope.segments.map((segment) => segment.refId),
    fixture.reader.envelope.segments.map((_, index) => `RD-${String(index + 1).padStart(3, "0")}`),
  );
  assertOrderedDocumentCoverage(
    fixture.phase1Document,
    fixture.reader.envelope.segments.map((segment) => segment.text),
  );
  assert.equal(fixture.source.partitions.length, fixture.plan.units.length);
  assert.equal(fixture.source.partitions[0].targetRef, "U1");
  assert.equal(fixture.source.partitions[1].targetRef, "U2");
  assert.equal(fixture.source.partitions[2].targetRef, "U3");
  assert.equal(fixture.source.partitions[3].targetRef, "U4");

  const sourceBound = fixture.source.partitions[0].envelope.segments;
  const sourceBoundChapter = sourceBound.filter((segment) => segment.kind === "chapter");
  assert.ok(sourceBound.some((segment) => segment.kind === "source_claim"));
  assert.ok(sourceBound.some((segment) => segment.kind === "source_mechanism"));
  assert.ok(sourceBound.some((segment) => segment.kind === "source_anchor" && segment.text.includes("ch01.fact.1")));
  assert.ok(!sourceBound.some((segment) => segment.refId === "SRC-PACKET-ALL" || segment.refId === "SRC-SIDECAR-ALL"));
  assert.ok(!sourceBound.some((segment) => segment.text.includes("A second, unrelated claim.")), "unrelated facts stay outside the target partition");
  assert.ok(!sourceBound.some((segment) => segment.text.includes("case-a-specific")), "unrelated cases stay outside a fact partition");
  assert.ok(!sourceBound.some((segment) => segment.text.includes("case-b-specific")), "unrelated named cases stay outside the target partition");
  const explicitAnchors = sourceBound.filter((segment) => segment.refId.includes("-ANCHOR-"));
  assert.equal(explicitAnchors.length, 1, "only the unit's allowed anchor-catalog subset is visible");
  assert.ok(explicitAnchors[0].text.includes("ch01.fact.1"));
  assert.ok(sourceBoundChapter.some((segment) => segment.text === `## Counterintuition\n${fixture.chapter.counterintuition}`));
  assert.ok(sourceBoundChapter.some((segment) => segment.text === "Card 1 (medium) — Front: What moved behavior?\n          Back: The default."));
  assert.ok(sourceBoundChapter.every((segment) => !segment.text.includes(fixture.chapter.implementationPlan.title)),
    "implementationPlan.title has no complete-reader rendering and cannot become provenance evidence");

  const sourceCase = fixture.source.partitions[1].envelope.segments;
  assert.ok(sourceCase.some((segment) => segment.text.includes("case-a-specific")));
  assert.ok(!sourceCase.some((segment) => segment.text.includes("case-b-specific")));
  assert.ok(!sourceCase.some((segment) => segment.text.includes("A second, unrelated claim.")));
  assert.ok(sourceCase.some((segment) => segment.kind === "chapter" && segment.text === [
    "### Example 1: The shorter form",
    "Tags: support, forms",
    "A support team removed one optional field from an intake form.",
    "",
    "What to do: Cut one field.",
    "",
    "Why it matters: Completion improved.",
  ].join("\n")), "example provenance must match the complete V2 tags-inclusive bytes exactly");

  for (const partition of fixture.source.partitions.slice(2)) {
    assert.deepEqual([...new Set(partition.envelope.segments.map((segment) => segment.kind))].sort(), ["chapter", "plan"]);
    assert.deepEqual(partition.targetSourceEvidenceRefIds, []);
  }
  for (const partition of fixture.source.partitions) {
    assert.match(String(partition.envelope.immutableBindings.chapterEvidenceSetSha256), /^[a-f0-9]{64}$/);
  }
  for (const task of [fixture.reader.task, ...fixture.source.partitions.map((partition) => partition.task), fixture.quiz.task]) {
    assert.doesNotMatch(task, /file is at|read this file|required (?:file|filesystem) path/i);
  }
});

test("production V2 source envelopes include complete key-free reader surfaces without hidden key or internal identities", () => {
  const fixture = compileAll();
  const complete = fixture.completeReaderDocument;
  assert.equal(complete, completeKeyFreeReaderDocumentBytesV2(fixture.chapter));
  assert.ok(complete.includes(`## Counterintuition\n${fixture.chapter.counterintuition}`));
  assert.ok(complete.includes("## Failure recovery\nA missed friction check is a signal to shorten the path"));
  assert.ok(complete.includes("## Transfer prompt\nWhere else does an unquestioned default add avoidable work?"));
  assert.ok(complete.includes("## Reader patterns\n- When a form feels harder than the decision it records"));
  assert.ok(complete.includes("Tags: support, forms"));
  assert.ok(complete.includes("Card 1 (medium) — Front: What moved behavior?"));

  const hiddenValues = [
    fixture.chapter.quiz.questions[0].explanation,
    fixture.chapter.quiz.questions[0].questionId,
    fixture.chapter.examples[0].exampleId,
    fixture.chapter.examples[0].planSpec.requiredBeat,
    fixture.chapter.reviewCards[0].cardId,
    fixture.chapter.experiencePlan!.behaviorLoop!.readerPatterns![0].id,
    fixture.chapter.authoring!.sourceAnchors!.sourceHash,
    fixture.chapter.authoring!.sourceAnchors!.observedAnchorIds[0],
    fixture.chapter.implementationPlan.title,
  ];
  for (const hidden of hiddenValues) {
    assert.ok(!complete.includes(hidden), `complete key-free bytes must exclude hidden/internal value: ${hidden}`);
  }
  assert.doesNotMatch(complete, /answer key|correctIndex|keyEvidenceAnchorIds|sourceAnchorIds|planSpec/i);

  const machineryTagChapter = structuredClone(fixture.chapter);
  machineryTagChapter.examples[0].tags.push("early signal");
  const machineryFiltered = completeKeyFreeReaderDocumentBytesV2(machineryTagChapter);
  assert.ok(!machineryFiltered.includes("early signal"), "reader packaging machinery tags must not enter review evidence");

  const constructedChapterEvidence = fixture.source.partitions[2].envelope.segments
    .filter((segment) => segment.kind === "chapter")
    .map((segment) => segment.text)
    .join("\n\n");
  assert.ok(constructedChapterEvidence.includes(fixture.chapter.counterintuition!));
  assert.ok(constructedChapterEvidence.includes("Where else does an unquestioned default add avoidable work?"));
  assert.ok(!constructedChapterEvidence.includes(fixture.chapter.quiz.questions[0].explanation));

  const compileMutation = (chapter: ChapterV21) => compileProductionSourceEnvelopesV2({
    caseId: "complete-reader-mutation",
    instrumentVersion: FORWARD_PRODUCTION_REVIEW_INSTRUMENT_V2,
    chapter,
    phase1Document: completeKeyFreeReaderDocumentBytesV2(chapter),
    plan: fixture.plan,
    packet: fixture.packet,
    sidecar: fixture.sidecar,
    anchorCatalog: fixture.packet.allowedAnchors,
    chapterContentSha256: chapterContentHash(chapter),
    sourceUsePlanSha256: fixture.sourceUsePlanSha256,
    sourcePacketSha256: fixture.sourcePacketSha256,
    sidecarSha256: fixture.sidecarSha256,
  });
  const mutations: ChapterV21[] = [];
  const counterMutation = structuredClone(fixture.chapter);
  counterMutation.counterintuition = `${counterMutation.counterintuition} Counter mutation marker.`;
  mutations.push(counterMutation);
  const experienceMutation = structuredClone(fixture.chapter);
  experienceMutation.experiencePlan!.transferPrompt!.prompt = "Experience mutation marker: find another default that adds work.";
  mutations.push(experienceMutation);

  const baselineCompleteSha256 = completeKeyFreeReaderDocumentSha256V2(fixture.chapter);
  for (const mutation of mutations) {
    assert.equal(
      ensureTrailingNewline(renderChapterReaderDocPhase1(mutation)),
      fixture.legacyPhase1Document,
      "the adversarial mutation must remain invisible to the legacy Phase-1 renderer",
    );
    assert.notEqual(completeKeyFreeReaderDocumentSha256V2(mutation), baselineCompleteSha256);
    const mutatedSource = compileMutation(mutation);
    assert.notEqual(mutatedSource.envelopeSetSha256, fixture.source.envelopeSetSha256);
  }
});

test("production V2 gives same-shape source facts deterministic target-local prose and source evidence", () => {
  const fixture = compileAll();
  const second = fixture.packet.facts[1];
  const firstUnit = fixture.plan.units[0];
  const chapter = structuredClone(fixture.chapter);
  chapter.authoring!.sourceAnchors!.effectiveAnchors["breakdown.deepRead"] = [second.id];
  const twinPlan = {
    ...fixture.plan,
    units: [
      firstUnit,
      { ...firstUnit, unitId: `unit.fact.${second.id}`, anchorIds: [second.id] },
    ],
  };
  const compileTwins = () => compileProductionSourceEnvelopesV2({
    caseId: "same-shape-source-units",
    instrumentVersion: FORWARD_PRODUCTION_REVIEW_INSTRUMENT_V2,
    chapter,
    phase1Document: fixture.phase1Document,
    plan: twinPlan,
    packet: fixture.packet,
    sidecar: fixture.sidecar,
    anchorCatalog: fixture.packet.allowedAnchors,
    chapterContentSha256: fixture.chapterContentSha256,
    sourceUsePlanSha256: sourceUsePlanHash(twinPlan),
    sourcePacketSha256: fixture.sourcePacketSha256,
    sidecarSha256: fixture.sidecarSha256,
  });

  const first = compileTwins();
  const replay = compileTwins();
  assert.equal(first.partitions.length, 2);
  assert.deepEqual(
    first.partitions.map((partition) => partition.envelope.envelopeSha256),
    replay.partitions.map((partition) => partition.envelope.envelopeSha256),
    "packet-local chapter evidence must compile deterministically",
  );

  const chapterSegments = first.partitions.map((partition) =>
    partition.envelope.segments.filter((segment) => segment.kind === "chapter"));
  assert.ok(chapterSegments.every((segments) => segments.length >= 1), "each source fact must resolve exact provenance-owned prose");
  assert.ok(chapterSegments[0].every((segment) => segment.refId.startsWith("CH-U001-")));
  assert.ok(chapterSegments[1].every((segment) => segment.refId.startsWith("CH-U002-")));
  assert.equal(
    chapterSegments[0].some((left) => chapterSegments[1].some((right) => left.refId === right.refId)),
    false,
    "same-shape units must not share an ambiguous chapter evidence namespace",
  );
  assert.ok(chapterSegments[0].every((segment) => !segment.text.includes("## Deep read")), "fact one cannot borrow fact two's prose");
  assert.deepEqual(chapterSegments[1].map((segment) => segment.text), [`## Deep read\n${chapter.breakdown.deepRead}`]);
  assert.ok(first.partitions[0].envelope.segments.some((segment) => segment.kind === "source_claim" && segment.text === fixture.packet.facts[0].claim));
  assert.ok(!first.partitions[0].envelope.segments.some((segment) => segment.text === second.claim));
  assert.ok(first.partitions[1].envelope.segments.some((segment) => segment.kind === "source_claim" && segment.text === second.claim));
  assert.ok(!first.partitions[1].envelope.segments.some((segment) => segment.text === fixture.packet.facts[0].claim));
  for (const segment of chapterSegments.flat()) {
    assert.ok(completeKeyFreeReaderDocumentBytesV2(chapter).includes(segment.text),
      `${segment.refId} must be an exact complete V2 key-free substring`);
  }
});

test("production V2 rejects fallback/shared anchors and missing target-local provenance before spawn", () => {
  const fixture = compileAll();
  const firstUnit = fixture.plan.units[0];
  const secondFact = fixture.packet.facts[1];
  const fallbackPlan = {
    ...fixture.plan,
    units: [
      firstUnit,
      { ...firstUnit, unitId: `unit.fact.${secondFact.id}`, anchorIds: [fixture.packet.facts[0].id] },
    ],
  };
  assert.throws(() => compileProductionSourceEnvelopesV2({
    caseId: "fallback-anchor-source-units",
    instrumentVersion: FORWARD_PRODUCTION_REVIEW_INSTRUMENT_V2,
    chapter: fixture.chapter,
    phase1Document: fixture.phase1Document,
    plan: fallbackPlan,
    packet: fixture.packet,
    sidecar: fixture.sidecar,
    anchorCatalog: fixture.packet.allowedAnchors,
    chapterContentSha256: fixture.chapterContentSha256,
    sourceUsePlanSha256: sourceUsePlanHash(fallbackPlan),
    sourcePacketSha256: fixture.sourcePacketSha256,
    sidecarSha256: fixture.sidecarSha256,
  }), /fallback\/shared fact anchor cannot provide target-local evidence/);

  const unmappedChapter = structuredClone(fixture.chapter);
  const effective = unmappedChapter.authoring!.sourceAnchors!.effectiveAnchors;
  for (const [path, ids] of Object.entries(effective)) {
    effective[path] = ids.filter((id) => id !== fixture.packet.facts[0].id);
  }
  for (const example of unmappedChapter.examples) {
    delete example.sourceAnchorId;
    delete example.sourceAnchorIds;
  }
  for (const question of unmappedChapter.quiz.questions) {
    delete question.sourceAnchorId;
    delete question.sourceAnchorIds;
    delete question.keyEvidenceAnchorIds;
  }
  for (const card of unmappedChapter.reviewCards) {
    delete card.sourceAnchorId;
    delete card.sourceAnchorIds;
  }
  const unmappedDocument = completeKeyFreeReaderDocumentBytesV2(unmappedChapter);
  const oneFactPlan = { ...fixture.plan, units: [firstUnit] };
  assert.throws(() => compileProductionSourceEnvelopesV2({
    caseId: "unmapped-source-unit",
    instrumentVersion: FORWARD_PRODUCTION_REVIEW_INSTRUMENT_V2,
    chapter: unmappedChapter,
    phase1Document: unmappedDocument,
    plan: oneFactPlan,
    packet: fixture.packet,
    sidecar: fixture.sidecar,
    anchorCatalog: fixture.packet.allowedAnchors,
    chapterContentSha256: chapterContentHash(unmappedChapter),
    sourceUsePlanSha256: sourceUsePlanHash(oneFactPlan),
    sourcePacketSha256: fixture.sourcePacketSha256,
    sidecarSha256: fixture.sidecarSha256,
  }), /missing target-local chapter evidence/);
});

test("production V2 rejects cross-target source and plan references", () => {
  const fixture = compileAll();
  const [factPartition, casePartition, constructedPartition, genericPartition] = fixture.source.partitions;
  const factChapterRef = factPartition.targetChapterEvidenceRefIds[0];
  const caseSourceRef = casePartition.targetSourceEvidenceRefIds.find((ref) => ref.includes("-CLAIM-"));
  assert.ok(caseSourceRef);
  assert.throws(() => assembleProductionSourcePartitionReviewV2({
    rawOutput: JSON.stringify({
      schema: SOURCE_INTEGRITY_MODEL_OUTPUT_V2_SCHEMA,
      assessments: [{
        targetRef: factPartition.targetRef,
        visibleRegister: "presented_as_fact",
        supportStatus: "UNSUPPORTED",
        framingAdequate: null,
        claimStrengthFit: false,
        namedSpecificityAllowed: false,
        findings: [{
          primaryCategory: "source_contradiction",
          secondaryCategories: [],
          severity: "blocker",
          explanation: "Attempted to support one fact with another target's evidence.",
          chapterEvidenceRefIds: [factChapterRef],
          sourceEvidenceRefIds: [caseSourceRef],
        }],
        rationale: "Cross-target evidence must be rejected.",
      }],
    }),
    partition: factPartition,
    chapterContentSha256: fixture.chapterContentSha256,
    sourceUsePlanSha256: fixture.sourceUsePlanSha256,
    sourcePacketSha256: fixture.sourcePacketSha256,
    sidecarSha256: fixture.sidecarSha256,
    schemaSha256: SCHEMA.source,
    routeEvidence: ROUTE,
  }), /missing evidence reference/);

  for (const partition of [constructedPartition, genericPartition]) {
    assert.deepEqual(partition.targetSourceEvidenceRefIds, []);
    assert.equal(partition.envelope.segments.filter((segment) => segment.kind === "plan").length, 1);
  }
  const constructedPlanRef = constructedPartition.envelope.segments.find((segment) => segment.kind === "plan")!.refId;
  const genericPlanRef = genericPartition.envelope.segments.find((segment) => segment.kind === "plan")!.refId;
  assert.notEqual(constructedPlanRef, genericPlanRef);
  assert.throws(() => assembleProductionSourcePartitionReviewV2({
    rawOutput: JSON.stringify({
      schema: SOURCE_INTEGRITY_MODEL_OUTPUT_V2_SCHEMA,
      assessments: [{
        targetRef: constructedPartition.targetRef,
        visibleRegister: "presented_as_fact",
        supportStatus: "NOT_APPLICABLE",
        framingAdequate: false,
        claimStrengthFit: null,
        namedSpecificityAllowed: null,
        findings: [{
          primaryCategory: "missing_visible_framing",
          secondaryCategories: [],
          severity: "blocker",
          explanation: "Attempted to cite the generic license for a constructed target.",
          chapterEvidenceRefIds: [constructedPartition.targetChapterEvidenceRefIds[0]],
          sourceEvidenceRefIds: [genericPlanRef],
        }],
        rationale: "Cross-target plan evidence must be rejected.",
      }],
    }),
    partition: constructedPartition,
    chapterContentSha256: fixture.chapterContentSha256,
    sourceUsePlanSha256: fixture.sourceUsePlanSha256,
    sourcePacketSha256: fixture.sourcePacketSha256,
    sidecarSha256: fixture.sidecarSha256,
    schemaSha256: SCHEMA.source,
    routeEvidence: ROUTE,
  }), /missing evidence reference/);

  const duplicateLicensePlan = {
    ...fixture.plan,
    units: [fixture.plan.units[3], { ...fixture.plan.units[3], unitId: "unit.generic.duplicate" }],
  };
  assert.throws(() => compileProductionSourceEnvelopesV2({
    caseId: "duplicate-chapter-license",
    instrumentVersion: FORWARD_PRODUCTION_REVIEW_INSTRUMENT_V2,
    chapter: fixture.chapter,
    phase1Document: fixture.phase1Document,
    plan: duplicateLicensePlan,
    packet: fixture.packet,
    sidecar: fixture.sidecar,
    anchorCatalog: fixture.packet.allowedAnchors,
    chapterContentSha256: fixture.chapterContentSha256,
    sourceUsePlanSha256: sourceUsePlanHash(duplicateLicensePlan),
    sourcePacketSha256: fixture.sourcePacketSha256,
    sidecarSha256: fixture.sidecarSha256,
  }), /duplicate chapter-level license/);
});

test("production V2 refuses oversize evidence instead of truncating and rejects old semantic artifacts", () => {
  const fixture = compileAll();
  assert.throws(() => compileProductionReaderEnvelopeV2({
    caseId: "mismatched-reader-hash",
    instrumentVersion: FORWARD_PRODUCTION_REVIEW_INSTRUMENT_V2,
    chapter: fixture.chapter,
    phase1Document: fixture.phase1Document,
    chapterContentSha256: fixture.chapterContentSha256,
    readerDocumentSha256: "0".repeat(64),
  }), /bytes do not match readerDocumentSha256/);
  assert.throws(() => compileProductionReaderEnvelopeV2({
    caseId: "oversize-reader",
    instrumentVersion: FORWARD_PRODUCTION_REVIEW_INSTRUMENT_V2,
    chapter: fixture.chapter,
    phase1Document: fixture.phase1Document,
    chapterContentSha256: fixture.chapterContentSha256,
    readerDocumentSha256: fixture.readerDocumentSha256,
    maxBytes: 128,
  }), ReviewEvidenceEnvelopeBudgetError);
  assert.throws(() => compileProductionSourceEnvelopesV2({
    caseId: "oversize-source",
    instrumentVersion: FORWARD_PRODUCTION_REVIEW_INSTRUMENT_V2,
    chapter: fixture.chapter,
    phase1Document: fixture.phase1Document,
    plan: fixture.plan,
    packet: fixture.packet,
    sidecar: fixture.sidecar,
    anchorCatalog: fixture.packet.allowedAnchors,
    chapterContentSha256: fixture.chapterContentSha256,
    sourceUsePlanSha256: fixture.sourceUsePlanSha256,
    sourcePacketSha256: fixture.sourcePacketSha256,
    sidecarSha256: fixture.sidecarSha256,
    maxBytes: 256,
  }), ReviewEvidenceEnvelopeBudgetError);
  assert.throws(() => parseReaderExperienceModelOutputV2(JSON.stringify({ schema: "reader-experience-review-v1" })), /wrong schema|missing required/i);
  assert.throws(() => parseSourceIntegrityModelOutputV2(JSON.stringify({ schema: "source-integrity-review-v1" })), /wrong schema|missing required/i);
  assert.throws(() => parseQuizIntegrityModelOutputV2(JSON.stringify({ schema: "quiz-integrity-adjudication-v1" })), /wrong schema|missing required/i);
});

test("authoritative V2 freshness binds every envelope, content hash, derivation, and phase-2 document", () => {
  const fixture = compileAll();
  const reader = assembleProductionReaderReviewV2({
    rawOutput: JSON.stringify({
      schema: READER_EXPERIENCE_MODEL_OUTPUT_V2_SCHEMA,
      scores: {
        retention: 90, quizzes: 90, transfer: 90, practical: 90, summaries: 90,
        tone: 90, limits: 90, insight: 90, density: 90, beginner: 90,
      },
      quizDerivation: {
        answers: ["b"], mechanisms: ["Removing a field lowers friction."], confidence: ["high"],
        ambiguities: [], tells: [], evidenceRefIds: [["RD-001"]],
      },
      recommendation: "SHIP",
      blockingFindings: [], escalationSignals: [], advisoryFindings: [],
      strongestEvidenceRefIds: ["RD-001"], weakestEvidenceRefIds: ["RD-001"],
      oneParagraphVerdict: "Clear and complete.",
    }),
    compiled: fixture.reader,
    chapterContentSha256: fixture.chapterContentSha256,
    schemaSha256: SCHEMA.reader,
    rubricVersion: FORWARD_PRODUCTION_REVIEW_INSTRUMENT_V2,
    routeEvidence: ROUTE,
  });
  const sourceParts = fixture.source.partitions.map((partition) => assembleProductionSourcePartitionReviewV2({
    rawOutput: JSON.stringify({
      schema: SOURCE_INTEGRITY_MODEL_OUTPUT_V2_SCHEMA,
      assessments: [{
        targetRef: partition.targetRef,
        visibleRegister: partition.targetBindings[0].expectedOrigin === "source_bound"
          ? "clearly_sourced"
          : partition.targetBindings[0].expectedOrigin === "constructed"
            ? "clearly_constructed"
            : "clearly_generic",
        supportStatus: partition.targetBindings[0].expectedOrigin === "source_bound" ? "SUPPORTED" : "NOT_APPLICABLE",
        framingAdequate: partition.targetBindings[0].framingRequired ? true : null,
        claimStrengthFit: true,
        namedSpecificityAllowed: true,
        findings: [],
        rationale: "The packet-local target is resolved by the complete inline evidence.",
      }],
    }),
    partition,
    chapterContentSha256: fixture.chapterContentSha256,
    sourceUsePlanSha256: fixture.sourceUsePlanSha256,
    sourcePacketSha256: fixture.sourcePacketSha256,
    sidecarSha256: fixture.sidecarSha256,
    schemaSha256: SCHEMA.source,
    routeEvidence: ROUTE,
  }));
  const source = mergeProductionSourceReviewsV2({
    reviews: sourceParts,
    envelopeSha256s: fixture.source.partitions.map((partition) => partition.envelope.envelopeSha256),
    deterministicCriticBundleSha256: "8".repeat(64),
  });
  const phase2DocumentSha256 = sha256Hex(renderQuizPhase2Doc(fixture.chapter, fixture.committed, fixture.phase1Document));
  const quiz = assembleProductionQuizReviewV2({
    rawOutput: JSON.stringify({
      schema: QUIZ_INTEGRITY_MODEL_OUTPUT_V2_SCHEMA,
      items: [{
        questionRef: "Q1",
        keyCorrect: "correct",
        defensibleAnswerIndices: [1],
        keyedMechanismSupported: true,
        rationale: "The stored key matches the one defensible answer.",
        evidenceRefIds: [
          "CH-001", "Q001-PROMPT",
          "Q001-CHOICE-000", "Q001-CHOICE-001", "Q001-CHOICE-002",
          "Q001-DERIVATION", "Q001-KEY", "Q001-EXPLANATION",
        ],
      }],
    }),
    compiled: fixture.quiz,
    chapterContentSha256: fixture.chapterContentSha256,
    phase2DocumentSha256,
    derivationSha256: fixture.committed.sha256,
    schemaSha256: SCHEMA.quiz,
    routeEvidence: ROUTE,
  });
  const sourceEnvelopeSha256s = fixture.source.partitions.map((partition) => partition.envelope.envelopeSha256);
  const authoritative: ForwardProductionAuthoritativeReviewsV2 = {
    protocolVersion: FORWARD_PRODUCTION_REVIEW_PROTOCOL_V2,
    readerEnvelopeSha256: fixture.reader.envelope.envelopeSha256,
    reader,
    readerAudit: null,
    sourceEnvelopeSha256s,
    source,
    sourceAdjudication: null,
    quizEnvelopeSha256: fixture.quiz.envelope.envelopeSha256,
    quiz,
    envelopeSetSha256: productionReviewEnvelopeSetSha256({
      readerEnvelopeSha256: fixture.reader.envelope.envelopeSha256,
      sourceEnvelopeSha256s,
      quizEnvelopeSha256: fixture.quiz.envelope.envelopeSha256,
    }),
  };
  const contraryRecommendation = { ...reader, recommendation: "BLOCK" as const };
  assert.equal(deriveReaderDecisionCategoryV2(contraryRecommendation, 80), "PASS",
    "production reader category must ignore a contrary advisory model recommendation");
  const binding = {
    authoritative,
    chapterContentSha256: fixture.chapterContentSha256,
    readerDocumentSha256: fixture.readerDocumentSha256,
    readerSchemaSha256: SCHEMA.reader,
    sourceUsePlanSha256: fixture.sourceUsePlanSha256,
    sourcePacketSha256: fixture.sourcePacketSha256,
    sidecarSha256: fixture.sidecarSha256,
    sourceSchemaSha256: SCHEMA.source,
    derivationSha256: fixture.committed.sha256,
    phase2DocumentSha256,
    quizSchemaSha256: SCHEMA.quiz,
  };
  assert.deepEqual(productionReviewV2FreshnessErrors(binding), []);
  assert.ok(productionReviewV2FreshnessErrors({ ...binding, chapterContentSha256: hashCanonical("changed-content") }).length >= 1);
  assert.ok(productionReviewV2FreshnessErrors({ ...binding, phase2DocumentSha256: hashCanonical("changed-phase2") }).includes("stale quiz V2 evidence"));
  const changedChapter = structuredClone(fixture.chapter);
  changedChapter.hook = `${changedChapter.hook} Changed content.`;
  const changedReaderDocument = completeKeyFreeReaderDocumentBytesV2(changedChapter);
  const changedReader = compileProductionReaderEnvelopeV2({
    caseId: "production-fixture",
    instrumentVersion: FORWARD_PRODUCTION_REVIEW_INSTRUMENT_V2,
    chapter: changedChapter,
    phase1Document: changedReaderDocument,
    chapterContentSha256: chapterContentHash(changedChapter),
    readerDocumentSha256: sha256Hex(changedReaderDocument),
  });
  assert.notEqual(changedReader.envelope.envelopeSha256, fixture.reader.envelope.envelopeSha256);
});

test("shared V2 protocol freshness and raw-output classifiers fail closed on tamper", () => {
  const envelopeSha256 = "a".repeat(64);
  const bytesSha256 = "b".repeat(64);
  const expected = {
    reviewProtocol: REVIEW_EVIDENCE_PROTOCOL_V2,
    lane: "reader" as const,
    evidenceEnvelopeSha256: envelopeSha256,
    evidenceEnvelopeBytesSha256: bytesSha256,
    bindings: { chapterContentSha256: "c".repeat(64), schemaSha256: "d".repeat(64) },
  };
  assert.deepEqual(reviewProtocolFreshnessErrorsV2(expected, structuredClone(expected)), []);
  assert.ok(reviewProtocolFreshnessErrorsV2(expected, {
    ...structuredClone(expected),
    evidenceEnvelopeBytesSha256: "e".repeat(64),
  }).includes("evidence envelope bytes hash mismatch"));
  assert.ok(reviewProtocolFreshnessErrorsV2(expected, {
    ...structuredClone(expected),
    bindings: { ...expected.bindings, schemaSha256: "f".repeat(64) },
  }).includes("freshness binding mismatch: schemaSha256"));
  assert.equal(reviewProtocolFileAccessFailureV2("I could not read the file at the supplied path."), true);
  assert.equal(reviewProtocolHasProhibitedConductorEchoV2('{"chapterContentSha256":"x"}', "reader"), true);
});
