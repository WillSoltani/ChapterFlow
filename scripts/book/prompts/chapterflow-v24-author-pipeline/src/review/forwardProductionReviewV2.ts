/**
 * IMP-24 production compiler/assembler shared with the qualification protocol.
 *
 * This module is pure with respect to execution: it compiles complete inline
 * evidence envelopes, builds the shared V2 task cards, parses semantic-only
 * outputs, and assembles conductor-owned reviews.  The forward conductor owns
 * routing, receipts, deterministic critics, panel policy, and atomic commit.
 */

import type { SourcePacketV1 } from "../artifacts/artifactTypes.js";
import { hashCanonical, sha256Hex } from "../contracts/contractUtil.js";
import type { SourceIntegrityReviewV1 } from "../contracts/sourceIntegrityReview.js";
import type { SourceUsePlanV1 } from "../contracts/sourceUsePlan.js";
import type {
  QuizIntegrityReviewV2,
  ReaderExperienceReviewV2,
  ReviewRouteEvidenceV2,
  SourceIntegrityReviewV2,
  SourceTargetBindingV2,
} from "../contracts/reviewModelOutputV2.js";
import type { ReviewEvidenceEnvelopeV1 } from "../contracts/reviewEvidenceEnvelope.js";
import type { ChapterV21, SourceAnchorForPrompt } from "../types.js";
import {
  createReviewEvidenceEnvelope,
  partitionSourceReviewEvidenceEnvelopes,
  serializeReviewEvidenceEnvelope,
  type ReviewEvidenceSegmentInputV1,
  type SourceReviewEvidencePartitionV1,
} from "./reviewEvidenceEnvelope.js";
import {
  adaptSourceIntegrityReviewV2ToV1,
  assembleQuizIntegrityReviewV2,
  assembleReaderExperienceReviewV2,
  assembleSourceIntegrityReviewV2,
  buildQuizIntegrityInlineReviewTask,
  buildReaderExperienceInlineReviewTask,
  buildSourceIntegrityInlineReviewTask,
  deriveSourceIntegrityResultV2,
  parseQuizIntegrityModelOutputV2,
  parseReaderExperienceModelOutputV2,
  parseSourceIntegrityModelOutputV2,
} from "./reviewModelOutputV2.js";
import { computeQuizItemTells } from "./quizIntegrityReview.js";
import { quizItemId, type CommittedQuizDerivation } from "./quizDerivation.js";
import { isMachineryExampleTag } from "../lib/readerContent.js";
import {
  completeKeyFreeReaderDocumentBytesV2,
  segmentCompleteKeyFreeReaderDocumentV2,
} from "./completeKeyFreeReaderDocumentV2.js";
import {
  REVIEW_EVIDENCE_PROTOCOL_V2,
  reviewProtocolFreshnessErrorsV2,
  type ReviewProtocolFreshnessProjectionV2,
} from "./reviewProtocolV2.js";

export const FORWARD_PRODUCTION_REVIEW_PROTOCOL_V2 = "imp24-review-v2" as const;
/** Same frozen evidence/task instrument used by V3 qualification. Kept here so
 * production activation need not import the certification/reporting runtime. */
export const FORWARD_PRODUCTION_REVIEW_INSTRUMENT_V2 = "imp24-inline-evidence-envelope-v1" as const;

export class ForwardProductionReviewV2Error extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ForwardProductionReviewV2Error";
  }
}

export type ProductionEnvelopeV2 = {
  envelope: ReviewEvidenceEnvelopeV1;
  envelopeBytes: string;
  task: string;
};

export type ProductionReaderEnvelopeV2 = ProductionEnvelopeV2 & {
  readerDocumentSha256: string;
};

export type ProductionSourcePartitionV2 = ProductionEnvelopeV2 & SourceReviewEvidencePartitionV1 & {
  /** Exact target-local references available to this one packet. They are
   * conductor-owned and never supplied by the model. */
  targetChapterEvidenceRefIds: string[];
  targetSourceEvidenceRefIds: string[];
};

export type ProductionSourceEnvelopeSetV2 = {
  partitions: ProductionSourcePartitionV2[];
  envelopeSetSha256: string;
};

export type ProductionQuizEnvelopeV2 = ProductionEnvelopeV2 & {
  questionBindings: Parameters<typeof assembleQuizIntegrityReviewV2>[0]["questionBindings"];
};

export type ForwardProductionSourceReviewV2 = SourceIntegrityReviewV2 & {
  evidenceEnvelopeSha256s: string[];
  deterministicCriticBundleSha256: string;
};

export type ForwardProductionAuthoritativeReviewsV2 = {
  protocolVersion: typeof FORWARD_PRODUCTION_REVIEW_PROTOCOL_V2;
  readerEnvelopeSha256: string | null;
  reader: ReaderExperienceReviewV2 | null;
  readerAudit: ReaderExperienceReviewV2 | null;
  sourceEnvelopeSha256s: string[];
  source: ForwardProductionSourceReviewV2 | null;
  sourceAdjudication: ForwardProductionSourceReviewV2 | null;
  quizEnvelopeSha256: string | null;
  quiz: QuizIntegrityReviewV2 | null;
  envelopeSetSha256: string | null;
};

export function emptyForwardProductionAuthoritativeReviewsV2(): ForwardProductionAuthoritativeReviewsV2 {
  return {
    protocolVersion: FORWARD_PRODUCTION_REVIEW_PROTOCOL_V2,
    readerEnvelopeSha256: null,
    reader: null,
    readerAudit: null,
    sourceEnvelopeSha256s: [],
    source: null,
    sourceAdjudication: null,
    quizEnvelopeSha256: null,
    quiz: null,
    envelopeSetSha256: null,
  };
}

function stableId(value: string, label: string): string {
  const normalized = value.replace(/[^A-Za-z0-9._:-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  if (!normalized) throw new ForwardProductionReviewV2Error(`${label} cannot normalize to a stable identifier`);
  return normalized;
}

function padded(index: number): string {
  return String(index + 1).padStart(3, "0");
}

function jsonText(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function atomicJsonLeaves(value: unknown, path = "$", out: Array<{ path: string; value: unknown }> = []): Array<{ path: string; value: unknown }> {
  if (Array.isArray(value)) {
    if (value.length === 0) out.push({ path, value: [] });
    else value.forEach((item, index) => atomicJsonLeaves(item, `${path}[${index}]`, out));
    return out;
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0);
    if (entries.length === 0) out.push({ path, value: {} });
    else entries.forEach(([key, item]) => atomicJsonLeaves(item, `${path}.${key}`, out));
    return out;
  }
  out.push({ path, value });
  return out;
}

export function compileProductionReaderEnvelopeV2(input: {
  caseId: string;
  instrumentVersion: string;
  chapter: ChapterV21;
  phase1Document: string;
  chapterContentSha256: string;
  readerDocumentSha256: string;
  maxBytes?: number;
}): ProductionReaderEnvelopeV2 {
  if (!input.phase1Document.trim()) throw new ForwardProductionReviewV2Error("reader phase-1 document is empty");
  if (input.phase1Document !== completeKeyFreeReaderDocumentBytesV2(input.chapter)) {
    throw new ForwardProductionReviewV2Error("reader phase-1 document is not the exact complete V2 key-free renderer output");
  }
  if (sha256Hex(input.phase1Document) !== input.readerDocumentSha256) {
    throw new ForwardProductionReviewV2Error("reader document bytes do not match readerDocumentSha256");
  }
  const caseId = stableId(input.caseId, "reader caseId");
  const envelope = createReviewEvidenceEnvelope({
    lane: "reader",
    envelopeId: `${caseId}:reader`,
    caseId,
    instrumentVersion: stableId(input.instrumentVersion, "reader instrumentVersion"),
    // Natural top-level sections remain coherent evidence units while their
    // concatenation preserves every byte of the complete key-free document.
    segments: segmentCompleteKeyFreeReaderDocumentV2(input.phase1Document)
      .map((segment) => ({ ...segment, kind: "chapter" as const })),
    immutableBindings: {
      chapterContentSha256: input.chapterContentSha256,
      readerDocumentSha256: input.readerDocumentSha256,
      keyFree: true,
    },
    ...(input.maxBytes === undefined ? {} : { maxBytes: input.maxBytes }),
  });
  return {
    envelope,
    envelopeBytes: serializeReviewEvidenceEnvelope(envelope),
    task: buildReaderExperienceInlineReviewTask(envelope),
    readerDocumentSha256: input.readerDocumentSha256,
  };
}

export function assembleProductionReaderReviewV2(input: {
  rawOutput: string;
  compiled: ProductionReaderEnvelopeV2;
  chapterContentSha256: string;
  schemaSha256: string;
  rubricVersion: string;
  routeEvidence: ReviewRouteEvidenceV2;
}): ReaderExperienceReviewV2 {
  return assembleReaderExperienceReviewV2({
    output: parseReaderExperienceModelOutputV2(input.rawOutput),
    envelope: input.compiled.envelope,
    chapterContentSha256: input.chapterContentSha256,
    readerDocumentSha256: input.compiled.readerDocumentSha256,
    schemaSha256: input.schemaSha256,
    rubricVersion: input.rubricVersion,
    routeEvidence: input.routeEvidence,
  });
}

function planSegmentText(targetRef: string, unit: SourceUsePlanV1["units"][number]): string {
  return jsonText({
    targetRef,
    originLicense: unit.origin,
    formLicense: unit.form,
    maximumClaimStrength: unit.claimStrength,
    allowedDetailTypes: unit.allowedDetailTypes,
    forbiddenDetailTypes: unit.forbiddenDetailTypes,
    detailSufficiency: unit.detailSufficiency,
    framingRequired: unit.framingRequired,
    allowedAnchorRefs: unit.anchorIds,
  });
}

/** Preserve the complete V2 key-free chapter as exact, citeable paragraph blocks
 * for the three compiler-owned chapter-level invented-material licenses. */
function completeChapterEvidenceSpans(completeReaderDocument: string): string[] {
  const spans = completeReaderDocument
    .split(/\r?\n[\t ]*\r?\n+/)
    .filter((span) => span.trim().length > 0);
  if (spans.length === 0) throw new ForwardProductionReviewV2Error("complete V2 key-free chapter has no citeable spans");
  return spans;
}

type ProvenancedChapterSpanV2 = {
  path: string;
  text: string;
  anchorIds: string[];
};

function normalizedAnchorIds(value: unknown): string[] {
  const values = typeof value === "string"
    ? [value]
    : Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : [];
  return [...new Set(values.map((item) => item.trim()).filter(Boolean))];
}

/**
 * Reconstruct the exact reader-visible units already governed by the
 * compiler-owned `effectiveAnchors` map. This follows the same path inventory as
 * sourceGrounding/evidenceMap, while retaining the exact complete V2 key-free
 * reader bytes the model sees. Hidden provenance is used only to select a packet;
 * it is never serialized into the evidence envelope.
 */
function provenancedChapterSpans(
  chapter: ChapterV21,
  completeReaderDocument: string,
): ProvenancedChapterSpanV2[] {
  const rendered = completeKeyFreeReaderDocumentBytesV2(chapter);
  if (completeReaderDocument !== rendered) {
    throw new ForwardProductionReviewV2Error("source chapter document is not the exact complete V2 key-free renderer output");
  }
  const effective = chapter.authoring?.sourceAnchors?.effectiveAnchors ?? {};
  const idsFor = (path: string, legacy?: unknown, fallbackPath?: string): string[] => {
    const mapped = normalizedAnchorIds(effective[path]);
    if (mapped.length > 0) return mapped;
    const legacyIds = normalizedAnchorIds(legacy);
    if (legacyIds.length > 0) return legacyIds;
    return fallbackPath ? normalizedAnchorIds(effective[fallbackPath]) : [];
  };
  const spans: ProvenancedChapterSpanV2[] = [];
  const add = (path: string, text: string | undefined, anchorIds: string[]): void => {
    if (!text || text.trim().length === 0 || anchorIds.length === 0) return;
    if (!completeReaderDocument.includes(text)) {
      throw new ForwardProductionReviewV2Error(`${path}: compiler-owned provenance does not resolve to exact complete V2 reader bytes`);
    }
    spans.push({ path, text, anchorIds: [...anchorIds] });
  };
  const anyChapter = chapter as ChapterV21 & Record<string, unknown>;

  add("hook", `## Hook\n${chapter.hook}`, idsFor("hook", anyChapter.hookSourceAnchorIds));
  if (chapter.counterintuition) {
    add("counterintuition", `## Counterintuition\n${chapter.counterintuition}`,
      idsFor("counterintuition", anyChapter.counterintuitionSourceAnchorIds, "hook"));
  }
  add("breakdown.fastRead", `## Fast read\n${chapter.breakdown.fastRead}`, idsFor("breakdown.fastRead"));
  add("breakdown.deepRead", `## Deep read\n${chapter.breakdown.deepRead}`, idsFor("breakdown.deepRead"));
  add("breakdown.fullRead", `## Full read\n${chapter.breakdown.fullRead}`, idsFor("breakdown.fullRead"));
  add("keyTakeaway", `## Key takeaway\n${chapter.keyTakeaway}`, idsFor("keyTakeaway", anyChapter.keyTakeawaySourceAnchorIds));
  if (chapter.tryThisNow) {
    add("tryThisNow", `## Try this now\n${chapter.tryThisNow}`, idsFor("tryThisNow", anyChapter.tryThisNowSourceAnchorIds));
  }

  chapter.examples.forEach((example, index) => {
    const path = `examples[${index}]`;
    const legacy = example.sourceAnchorIds ?? example.sourceAnchorId;
    const readerTags = (example.tags ?? []).filter((tag) => !isMachineryExampleTag(tag));
    add(path, [
      `### Example ${index + 1}: ${example.title}`,
      ...(readerTags.length > 0 ? [`Tags: ${readerTags.join(", ")}`] : []),
      example.scenario,
      "",
      `What to do: ${example.whatToDo}`,
      "",
      `Why it matters: ${example.whyItMatters}`,
    ].join("\n"), idsFor(path, legacy));
  });

  chapter.quiz.questions.forEach((question, index) => {
    const base = `quiz.questions[${index}]`;
    const baseIds = idsFor(base, question.sourceAnchorIds ?? question.sourceAnchorId);
    const promptIds = [...new Set([...idsFor(`${base}.prompt`, undefined, base), ...baseIds])];
    add(`${base}.prompt`, [
      `Q${index + 1}. ${question.prompt}`,
      ...question.choices.map((choice, choiceIndex) => `   ${"abc"[choiceIndex]}) ${choice}`),
    ].join("\n"), promptIds);
  });

  chapter.reviewCards.forEach((card, index) => {
    const path = `reviewCards[${index}]`;
    const difficulty = card.difficulty ? ` (${card.difficulty})` : "";
    add(path, `Card ${index + 1}${difficulty} — Front: ${card.front}\n          Back: ${card.back}`,
      idsFor(path, card.sourceAnchorIds ?? card.sourceAnchorId));
  });

  const plan = chapter.implementationPlan;
  if (plan) {
    add("implementationPlan.coreSkill", `Core skill: ${plan.coreSkill}`,
      idsFor("implementationPlan.coreSkill", plan.coreSkillSourceAnchorIds));
    plan.ifThenPlans.forEach((item, index) => {
      const path = `implementationPlan.ifThenPlans[${index}]`;
      add(path, `If-then ${index + 1}: [${item.context}] ${item.plan}`,
        idsFor(path, item.sourceAnchorIds ?? item.sourceAnchorId));
    });
    add("implementationPlan.twentyFourHourChallenge", `24-hour challenge: ${plan.twentyFourHourChallenge}`,
      idsFor("implementationPlan.twentyFourHourChallenge", plan.twentyFourHourChallengeSourceAnchorIds));
    add("implementationPlan.weeklyPractice", `Weekly practice: ${plan.weeklyPractice}`,
      idsFor("implementationPlan.weeklyPractice", plan.weeklyPracticeSourceAnchorIds));
  }

  chapter.memorableLines?.forEach((line, index) => {
    const path = `memorableLines[${index}]`;
    add(path, `- ${line.text}`, idsFor(path, line.sourceAnchorIds, line.location));
  });
  return spans;
}

type ResolvedSourceTargetV2 = {
  identity: string;
  primaryAnchorId: string;
  claim: string;
  mechanism?: string;
  atomicEvidence: Array<{ label: string; value: unknown }>;
};

function resolveSourceTarget(
  unit: SourceUsePlanV1["units"][number],
  packet: SourcePacketV1,
): ResolvedSourceTargetV2 {
  if (unit.caseId) {
    const namedCase = packet.namedCases.find((item) => item.id === unit.caseId);
    if (!namedCase || unit.unitId !== `unit.case.${namedCase.id}`) {
      throw new ForwardProductionReviewV2Error(`${unit.unitId}: source-bound case cannot resolve one exact packet case`);
    }
    if (unit.anchorIds.length !== 1 || unit.anchorIds[0] !== namedCase.id) {
      throw new ForwardProductionReviewV2Error(`${unit.unitId}: fallback/shared case anchor cannot provide target-local evidence`);
    }
    return {
      identity: `case:${namedCase.id}`,
      primaryAnchorId: namedCase.id,
      claim: namedCase.summary,
      atomicEvidence: [
        { label: `case.${namedCase.id}.label`, value: namedCase.label },
        { label: `case.${namedCase.id}.realWorld`, value: namedCase.realWorld },
        { label: `case.${namedCase.id}.naturalSetting`, value: namedCase.naturalSetting ?? null },
        ...namedCase.hardSpecifics.map((value, index) => ({ label: `case.${namedCase.id}.hardSpecifics[${index}]`, value })),
        ...namedCase.allowedUses.map((value, index) => ({ label: `case.${namedCase.id}.allowedUses[${index}]`, value })),
        ...namedCase.forbiddenUses.map((value, index) => ({ label: `case.${namedCase.id}.forbiddenUses[${index}]`, value })),
        ...namedCase.doNotRestamp.map((value, index) => ({ label: `case.${namedCase.id}.doNotRestamp[${index}]`, value })),
      ],
    };
  }
  if (!unit.unitId.startsWith("unit.fact.")) {
    throw new ForwardProductionReviewV2Error(`${unit.unitId}: source-bound target is not an exact compiler-owned fact/case unit`);
  }
  const factId = unit.unitId.slice("unit.fact.".length);
  const fact = packet.facts.find((item) => item.id === factId);
  if (!fact) throw new ForwardProductionReviewV2Error(`${unit.unitId}: source-bound fact is absent from the bound packet`);
  if (unit.anchorIds.length !== 1 || unit.anchorIds[0] !== fact.id) {
    throw new ForwardProductionReviewV2Error(`${unit.unitId}: fallback/shared fact anchor cannot provide target-local evidence`);
  }
  return {
    identity: `fact:${fact.id}`,
    primaryAnchorId: fact.id,
    claim: fact.claim,
    ...(fact.mechanism.trim().length > 0 ? { mechanism: fact.mechanism } : {}),
    atomicEvidence: [
      { label: `fact.${fact.id}.commonError`, value: fact.commonError },
      { label: `fact.${fact.id}.whyWrong`, value: fact.whyWrong },
      ...fact.allowedClaimTypes.map((value, index) => ({ label: `fact.${fact.id}.allowedClaimTypes[${index}]`, value })),
      ...fact.groundedNumbers.map((value, index) => ({ label: `fact.${fact.id}.groundedNumbers[${index}]`, value })),
      ...fact.groundedEntities.map((value, index) => ({ label: `fact.${fact.id}.groundedEntities[${index}]`, value })),
      ...fact.groundedPlaces.map((value, index) => ({ label: `fact.${fact.id}.groundedPlaces[${index}]`, value })),
      ...fact.verificationRefs.map((value, index) => ({ label: `fact.${fact.id}.verificationRefs[${index}]`, value })),
      ...(fact.replicationStatus ? [{ label: `fact.${fact.id}.replicationStatus`, value: fact.replicationStatus }] : []),
    ],
  };
}

export type ProductionResolvedSourceTargetV2 = {
  targetRef: string;
  unit: SourceUsePlanV1["units"][number];
  chapterSpans: string[];
};

/** Shared final source packet compiler. Production resolves target-local spans
 * from ChapterV21 provenance; qualification supplies its frozen isolated
 * chapter unit. Both then use these exact segment, plan, packet, partition,
 * immutable-binding, task, and hash bytes. */
export function compileProductionResolvedSourceEnvelopeSetV2(input: {
  caseId: string;
  instrumentVersion: string;
  targets: ProductionResolvedSourceTargetV2[];
  packet: SourcePacketV1;
  anchorCatalog: SourceAnchorForPrompt[];
  chapterContentSha256: string;
  sourceUsePlanSha256: string;
  sourcePacketSha256: string;
  sidecarSha256: string;
  maxBytes?: number;
}): ProductionSourceEnvelopeSetV2 {
  if (input.targets.length === 0) throw new ForwardProductionReviewV2Error("source-use plan has no review targets");
  const caseId = stableId(input.caseId, "source caseId");
  const catalog: ReviewEvidenceSegmentInputV1[] = [];
  const anchorsById = new Map(input.anchorCatalog.map((anchor) => [anchor.id, anchor]));
  if (anchorsById.size !== input.anchorCatalog.length) {
    throw new ForwardProductionReviewV2Error("source anchor catalog contains duplicate ids");
  }
  const seenSourceIdentities = new Set<string>();
  const seenChapterLicenseSignatures = new Set<string>();

  const targets = input.targets.map((resolved, index) => {
    const { targetRef, unit } = resolved;
    if (targetRef !== `U${index + 1}`) {
      throw new ForwardProductionReviewV2Error(`source target order drift: expected U${index + 1}, got ${targetRef}`);
    }
    const suffix = padded(index);
    const sourceBound = unit.origin === "source_bound";
    let sourceTarget: ResolvedSourceTargetV2 | null = null;
    const chapterSpans = [...resolved.chapterSpans];
    if (chapterSpans.length === 0 || chapterSpans.some((span) => !span.trim())) {
      throw new ForwardProductionReviewV2Error(`${targetRef}: missing target-local chapter evidence`);
    }
    if (sourceBound) {
      sourceTarget = resolveSourceTarget(unit, input.packet);
      if (seenSourceIdentities.has(sourceTarget.identity)) {
        throw new ForwardProductionReviewV2Error(`${targetRef}: duplicate/shared source target ${sourceTarget.identity}`);
      }
      seenSourceIdentities.add(sourceTarget.identity);
      const anchor = anchorsById.get(sourceTarget.primaryAnchorId);
      if (!anchor) throw new ForwardProductionReviewV2Error(`${targetRef}: missing exact source anchor ${sourceTarget.primaryAnchorId}`);
    } else {
      const signature = `${unit.origin}:${unit.form}`;
      if (seenChapterLicenseSignatures.has(signature)) {
        throw new ForwardProductionReviewV2Error(`${targetRef}: duplicate chapter-level license ${signature} is ambiguous`);
      }
      seenChapterLicenseSignatures.add(signature);
    }
    const chapterRefIds = chapterSpans.map((text, spanIndex) => {
      const refId = `CH-U${padded(index)}-${padded(spanIndex)}`;
      catalog.push({ refId, kind: "chapter", text });
      return refId;
    });
    const planRef = `PLAN-U${suffix}`;
    catalog.push({ refId: planRef, kind: "plan", text: planSegmentText(targetRef, unit) });
    const sourceClaimRefIds: string[] = [];
    const sourceMechanismRefIds: string[] = [];
    const sourceAnchorRefIds: string[] = [];
    if (sourceTarget) {
      const claimRef = `SRC-U${suffix}-CLAIM-001`;
      sourceClaimRefIds.push(claimRef);
      catalog.push({ refId: claimRef, kind: "source_claim", text: sourceTarget.claim });
      if (sourceTarget.mechanism) {
        const mechanismRef = `SRC-U${suffix}-MECHANISM-001`;
        sourceMechanismRefIds.push(mechanismRef);
        catalog.push({ refId: mechanismRef, kind: "source_mechanism", text: sourceTarget.mechanism });
      }
      const anchor = anchorsById.get(sourceTarget.primaryAnchorId)!;
      const allowedAnchorRef = `SRC-U${suffix}-ANCHOR-001`;
      sourceAnchorRefIds.push(allowedAnchorRef);
      catalog.push({ refId: allowedAnchorRef, kind: "source_anchor", text: jsonText(anchor) });
      const atomic = [
        ...sourceTarget.atomicEvidence,
        ...input.packet.forbiddenClaims.map((value, itemIndex) => ({ label: `packet.forbiddenClaims[${itemIndex}]`, value })),
        ...input.packet.forbiddenLeakage.flatMap((value, itemIndex) => atomicJsonLeaves(value, `packet.forbiddenLeakage[${itemIndex}]`)
          .map((leaf) => ({ label: leaf.path, value: leaf.value }))),
        { label: "packet.sourceQuality.status", value: input.packet.sourceQuality.status },
        ...input.packet.sourceQuality.risks.map((value, itemIndex) => ({ label: `packet.sourceQuality.risks[${itemIndex}]`, value })),
      ];
      atomic.forEach(({ label, value }, atomicIndex) => {
        const refId = `SRC-U${suffix}-ATOMIC-${padded(atomicIndex)}`;
        sourceAnchorRefIds.push(refId);
        catalog.push({ refId, kind: "source_anchor", text: jsonText({ label, value }) });
      });
    }
    const targetBinding: SourceTargetBindingV2 = {
      targetRef,
      unitId: unit.unitId,
      expectedOrigin: unit.origin,
      expectedForm: unit.form,
      claimStrengthExpected: unit.claimStrength,
      framingRequired: unit.framingRequired,
      requiredSourceSupport: sourceBound,
    };
    return {
      targetRef,
      targetBinding,
      chapterRefIds,
      sourceClaimRefIds,
      sourceMechanismRefIds,
      sourceAnchorRefIds,
      planRefIds: [planRef],
      immutablePlanMetadata: {
        targetRef,
        originLicense: unit.origin,
        formLicense: unit.form,
        maximumClaimStrength: unit.claimStrength,
        framingRequired: unit.framingRequired,
        detailSufficiency: unit.detailSufficiency,
      },
    };
  });
  const partitions = partitionSourceReviewEvidenceEnvelopes({
    envelopeIdPrefix: `${caseId}:source`,
    caseIdPrefix: caseId,
    instrumentVersion: stableId(input.instrumentVersion, "source instrumentVersion"),
    segmentCatalog: catalog,
    targets,
    commonImmutableBindings: {
      chapterContentSha256: input.chapterContentSha256,
      chapterEvidenceSetSha256: hashCanonical(input.targets.map((target) => ({
        targetRef: target.targetRef,
        chapterSpans: target.chapterSpans,
      }))),
      sourceUsePlanSha256: input.sourceUsePlanSha256,
      sourcePacketSha256: input.sourcePacketSha256,
      sidecarSha256: input.sidecarSha256,
    },
    ...(input.maxBytes === undefined ? {} : { maxBytes: input.maxBytes }),
  }).map((partition): ProductionSourcePartitionV2 => {
    const chapterRefs = partition.envelope.segments.filter((segment) => segment.kind === "chapter").map((segment) => segment.refId);
    const sourceRefs = partition.envelope.segments
      .filter((segment) => segment.kind === "source_claim" || segment.kind === "source_mechanism" || segment.kind === "source_anchor")
      .map((segment) => segment.refId);
    return {
      ...partition,
      envelopeBytes: serializeReviewEvidenceEnvelope(partition.envelope),
      task: buildSourceIntegrityInlineReviewTask(partition.envelope),
      targetChapterEvidenceRefIds: chapterRefs,
      targetSourceEvidenceRefIds: sourceRefs,
    };
  });
  return {
    partitions,
    envelopeSetSha256: hashCanonical(partitions.map((partition) => partition.envelope.envelopeSha256)),
  };
}

/**
 * Compile one complete source envelope per source-use-plan unit. Source-bound
 * fact/case units receive only their exact provenance-mapped prose, exact
 * target-local packet evidence, and global policy atoms. Chapter-level
 * constructed/generic/analogy licenses receive the complete chapter and their
 * own plan ref, but no source evidence.
 */
export function compileProductionSourceEnvelopesV2(input: {
  caseId: string;
  instrumentVersion: string;
  chapter: ChapterV21;
  phase1Document: string;
  plan: SourceUsePlanV1;
  packet: SourcePacketV1;
  sidecar: unknown;
  anchorCatalog: SourceAnchorForPrompt[];
  chapterContentSha256: string;
  sourceUsePlanSha256: string;
  sourcePacketSha256: string;
  sidecarSha256: string;
  maxBytes?: number;
}): ProductionSourceEnvelopeSetV2 {
  if (input.plan.units.length === 0) throw new ForwardProductionReviewV2Error("source-use plan has no review targets");
  const completeReaderDocument = completeKeyFreeReaderDocumentBytesV2(input.chapter);
  if (input.phase1Document !== completeReaderDocument) {
    throw new ForwardProductionReviewV2Error("source phase-1 document is not the exact complete V2 key-free renderer output");
  }
  const fullChapterSpans = completeChapterEvidenceSpans(completeReaderDocument);
  const provenanceSpans = provenancedChapterSpans(input.chapter, completeReaderDocument);
  const anchorsById = new Map(input.anchorCatalog.map((anchor) => [anchor.id, anchor]));
  const targets = input.plan.units.map((unit, index): ProductionResolvedSourceTargetV2 => {
    const targetRef = `U${index + 1}`;
    if (unit.origin !== "source_bound") return { targetRef, unit, chapterSpans: fullChapterSpans };
    const sourceTarget = resolveSourceTarget(unit, input.packet);
    if (!anchorsById.has(sourceTarget.primaryAnchorId)) {
      throw new ForwardProductionReviewV2Error(`${targetRef}: missing exact source anchor ${sourceTarget.primaryAnchorId}`);
    }
    const chapterSpans = provenanceSpans
      .filter((span) => span.anchorIds.includes(sourceTarget.primaryAnchorId))
      .map((span) => span.text);
    if (chapterSpans.length === 0) {
      throw new ForwardProductionReviewV2Error(`${targetRef}: missing target-local chapter evidence for ${sourceTarget.primaryAnchorId}`);
    }
    return { targetRef, unit, chapterSpans };
  });
  return compileProductionResolvedSourceEnvelopeSetV2({
    caseId: input.caseId,
    instrumentVersion: input.instrumentVersion,
    targets,
    packet: input.packet,
    anchorCatalog: input.anchorCatalog,
    chapterContentSha256: input.chapterContentSha256,
    sourceUsePlanSha256: input.sourceUsePlanSha256,
    sourcePacketSha256: input.sourcePacketSha256,
    sidecarSha256: input.sidecarSha256,
    ...(input.maxBytes === undefined ? {} : { maxBytes: input.maxBytes }),
  });
}

export function assembleProductionSourcePartitionReviewV2(input: {
  rawOutput: string;
  partition: ProductionSourcePartitionV2;
  chapterContentSha256: string;
  sourceUsePlanSha256: string;
  sourcePacketSha256: string;
  sidecarSha256: string;
  schemaSha256: string;
  routeEvidence: ReviewRouteEvidenceV2;
}): SourceIntegrityReviewV2 {
  return assembleSourceIntegrityReviewV2({
    output: parseSourceIntegrityModelOutputV2(input.rawOutput),
    envelope: input.partition.envelope,
    targetBindings: input.partition.targetBindings,
    chapterContentSha256: input.chapterContentSha256,
    sourceUsePlanSha256: input.sourceUsePlanSha256,
    sourcePacketSha256: input.sourcePacketSha256,
    sidecarSha256: input.sidecarSha256,
    schemaSha256: input.schemaSha256,
    routeEvidence: input.routeEvidence,
  });
}

export function mergeProductionSourceReviewsV2(input: {
  reviews: SourceIntegrityReviewV2[];
  envelopeSha256s: string[];
  deterministicCriticBundleSha256: string;
  deterministicBlockerIds?: string[];
}): ForwardProductionSourceReviewV2 {
  if (input.reviews.length === 0) throw new ForwardProductionReviewV2Error("cannot merge an empty source review set");
  if (input.reviews.length !== input.envelopeSha256s.length) throw new ForwardProductionReviewV2Error("source review/envelope cardinality mismatch");
  const first = input.reviews[0];
  for (const review of input.reviews) {
    for (const field of ["chapterContentSha256", "sourceUsePlanSha256", "sourcePacketSha256", "sidecarSha256", "schemaSha256"] as const) {
      if (review[field] !== first[field]) throw new ForwardProductionReviewV2Error(`source partition ${field} mismatch`);
    }
    if (review.routeEvidence.model !== first.routeEvidence.model || review.routeEvidence.effort !== first.routeEvidence.effort) {
      throw new ForwardProductionReviewV2Error("source partitions used different frozen routes");
    }
  }
  const units = input.reviews.flatMap((review) => review.units).sort((left, right) => {
    const leftNumber = Number(left.targetRef.slice(1));
    const rightNumber = Number(right.targetRef.slice(1));
    return leftNumber - rightNumber;
  });
  const unresolvedTargetRefs = input.reviews.flatMap((review) => review.unresolvedTargetRefs).sort();
  const derived = deriveSourceIntegrityResultV2(units, unresolvedTargetRefs);
  const deterministicBlockers = [...new Set(input.deterministicBlockerIds ?? [])].sort();
  const result = deterministicBlockers.length > 0 ? "BLOCK" : derived.result;
  return {
    schema: "source-integrity-review-v2",
    reviewerRole: "source-integrity",
    chapterContentSha256: first.chapterContentSha256,
    sourceUsePlanSha256: first.sourceUsePlanSha256,
    sourcePacketSha256: first.sourcePacketSha256,
    sidecarSha256: first.sidecarSha256,
    evidenceEnvelopeSha256: hashCanonical(input.envelopeSha256s),
    evidenceEnvelopeSha256s: [...input.envelopeSha256s],
    deterministicCriticBundleSha256: input.deterministicCriticBundleSha256,
    schemaSha256: first.schemaSha256,
    routeEvidence: {
      model: first.routeEvidence.model,
      effort: first.routeEvidence.effort,
      routeReceiptSha256: hashCanonical(input.reviews.map((review) => review.routeEvidence.routeReceiptSha256)),
    },
    units,
    unresolvedTargetRefs,
    result,
    blockingFindingIds: [...new Set([...deterministicBlockers, ...derived.blockingFindingIds])].sort(),
    rationale: input.reviews.map((review) => review.rationale).join("\n"),
  };
}

export function synthesizeProductionSourceReviewV2(input: {
  envelopeSha256s: string[];
  deterministicCriticBundleSha256: string;
  chapterContentSha256: string;
  sourceUsePlanSha256: string;
  sourcePacketSha256: string;
  sidecarSha256: string;
  schemaSha256: string;
  unresolvedTargetRefs: string[];
  result: "BLOCK" | "INCONCLUSIVE";
  blockingFindingIds: string[];
  rationale: string;
}): ForwardProductionSourceReviewV2 {
  return {
    schema: "source-integrity-review-v2",
    reviewerRole: "source-integrity",
    chapterContentSha256: input.chapterContentSha256,
    sourceUsePlanSha256: input.sourceUsePlanSha256,
    sourcePacketSha256: input.sourcePacketSha256,
    sidecarSha256: input.sidecarSha256,
    evidenceEnvelopeSha256: hashCanonical(input.envelopeSha256s),
    evidenceEnvelopeSha256s: [...input.envelopeSha256s],
    deterministicCriticBundleSha256: input.deterministicCriticBundleSha256,
    schemaSha256: input.schemaSha256,
    routeEvidence: {
      model: "deterministic-conductor",
      effort: "model-free",
      routeReceiptSha256: input.deterministicCriticBundleSha256,
    },
    units: [],
    unresolvedTargetRefs: [...input.unresolvedTargetRefs],
    result: input.result,
    blockingFindingIds: [...input.blockingFindingIds],
    rationale: input.rationale,
  };
}

/** Existing aggregate accepts V1 source inputs. Preserve V2 REVISE explicitly:
 * project it as PASS for the legacy aggregate, then the conductor reapplies the
 * authoritative `sourceRevisionRequired` signal after aggregation. */
export function adaptProductionSourceReviewV2ForAggregate(review: ForwardProductionSourceReviewV2): {
  review: SourceIntegrityReviewV1;
  sourceRevisionRequired: boolean;
} {
  const projection = adaptSourceIntegrityReviewV2ToV1(review);
  return {
    sourceRevisionRequired: projection.sourceRevisionRequired,
    review: projection.sourceRevisionRequired ? { ...projection.review, result: "PASS" } : projection.review,
  };
}

export function compileProductionQuizEnvelopeV2(input: {
  caseId: string;
  instrumentVersion: string;
  chapter: ChapterV21;
  phase1Document: string;
  chapterContentSha256: string;
  committedDerivation: CommittedQuizDerivation;
  maxBytes?: number;
}): ProductionQuizEnvelopeV2 {
  if (sha256Hex(input.phase1Document) !== input.committedDerivation.derivation.documentSha256) {
    throw new ForwardProductionReviewV2Error("quiz envelope phase-1 bytes do not match committed derivation");
  }
  const questions = input.chapter.quiz?.questions ?? [];
  if (questions.length === 0 || questions.length !== input.committedDerivation.derivation.items.length) {
    throw new ForwardProductionReviewV2Error("quiz envelope question/derivation cardinality mismatch");
  }
  const tellFlags = computeQuizItemTells(input.chapter);
  const segments: ReviewEvidenceSegmentInputV1[] = [{ refId: "CH-001", kind: "chapter", text: input.phase1Document }];
  const questionBindings = questions.map((question, index) => {
    const suffix = padded(index);
    const questionRef = `Q${index + 1}`;
    const derivation = input.committedDerivation.derivation.items[index];
    if (derivation.derivedAnswerIndex < 0) {
      throw new ForwardProductionReviewV2Error(`${questionRef}: committed blind derivation is unresolved`);
    }
    segments.push(
      { refId: `Q${suffix}-PROMPT`, kind: "quiz_prompt", text: question.prompt },
      ...question.choices.map((choice, choiceIndex) => ({
        refId: `Q${suffix}-CHOICE-${String(choiceIndex).padStart(3, "0")}`,
        kind: "quiz_choice" as const,
        text: `${choiceIndex}: ${choice}`,
      })),
      { refId: `Q${suffix}-DERIVATION`, kind: "quiz_derivation", text: jsonText({
        questionRef,
        committedAnswerIndex: derivation.derivedAnswerIndex,
        mechanism: derivation.mechanism,
        confidence: derivation.confidence,
        ambiguityFlags: derivation.ambiguityFlags,
      }) },
      { refId: `Q${suffix}-KEY`, kind: "quiz_key", text: jsonText({ questionRef, storedKeyIndex: question.correctIndex }) },
      { refId: `Q${suffix}-EXPLANATION`, kind: "quiz_explanation", text: question.explanation || "No stored key explanation was supplied." },
    );
    return {
      questionRef,
      evidenceRefPrefix: `Q${suffix}`,
      itemId: quizItemId(input.chapter, index),
      choiceCount: question.choices.length,
      keyedAnswerIndex: question.correctIndex,
      committedDerivedAnswerIndex: derivation.derivedAnswerIndex,
      tellDetected: tellFlags[index] ?? false,
    };
  });
  const caseId = stableId(input.caseId, "quiz caseId");
  const envelope = createReviewEvidenceEnvelope({
    lane: "quiz",
    envelopeId: `${caseId}:quiz`,
    caseId,
    instrumentVersion: stableId(input.instrumentVersion, "quiz instrumentVersion"),
    segments,
    immutableBindings: {
      chapterContentSha256: input.chapterContentSha256,
      phase1DocumentSha256: input.committedDerivation.derivation.documentSha256,
      derivationSha256: input.committedDerivation.sha256,
      questionCount: questions.length,
    },
    ...(input.maxBytes === undefined ? {} : { maxBytes: input.maxBytes }),
  });
  return {
    envelope,
    envelopeBytes: serializeReviewEvidenceEnvelope(envelope),
    task: buildQuizIntegrityInlineReviewTask(envelope),
    questionBindings,
  };
}

export function assembleProductionQuizReviewV2(input: {
  rawOutput: string;
  compiled: ProductionQuizEnvelopeV2;
  chapterContentSha256: string;
  phase2DocumentSha256: string;
  derivationSha256: string;
  schemaSha256: string;
  routeEvidence: ReviewRouteEvidenceV2;
}): QuizIntegrityReviewV2 {
  return assembleQuizIntegrityReviewV2({
    output: parseQuizIntegrityModelOutputV2(input.rawOutput),
    envelope: input.compiled.envelope,
    questionBindings: input.compiled.questionBindings,
    chapterContentSha256: input.chapterContentSha256,
    phase2DocumentSha256: input.phase2DocumentSha256,
    derivationSha256: input.derivationSha256,
    schemaSha256: input.schemaSha256,
    routeEvidence: input.routeEvidence,
  });
}

export function productionReviewEnvelopeSetSha256(input: {
  readerEnvelopeSha256: string;
  sourceEnvelopeSha256s: string[];
  quizEnvelopeSha256: string;
}): string {
  return hashCanonical({
    protocolVersion: FORWARD_PRODUCTION_REVIEW_PROTOCOL_V2,
    readerEnvelopeSha256: input.readerEnvelopeSha256,
    sourceEnvelopeSha256s: input.sourceEnvelopeSha256s,
    quizEnvelopeSha256: input.quizEnvelopeSha256,
  });
}

export function productionReviewV2FreshnessErrors(input: {
  authoritative: ForwardProductionAuthoritativeReviewsV2;
  chapterContentSha256: string;
  readerDocumentSha256: string;
  readerSchemaSha256: string;
  sourceUsePlanSha256: string;
  sourcePacketSha256: string;
  sidecarSha256: string;
  sourceSchemaSha256: string;
  derivationSha256: string;
  phase2DocumentSha256: string;
  quizSchemaSha256: string;
}): string[] {
  const errors: string[] = [];
  const { authoritative } = input;
  if (authoritative.protocolVersion !== FORWARD_PRODUCTION_REVIEW_PROTOCOL_V2) errors.push("wrong production review protocol");

  const projection = (
    lane: ReviewProtocolFreshnessProjectionV2["lane"],
    evidenceEnvelopeSha256: string | null,
    bindings: Record<string, string | null>,
  ): ReviewProtocolFreshnessProjectionV2 => ({
    reviewProtocol: REVIEW_EVIDENCE_PROTOCOL_V2,
    lane,
    evidenceEnvelopeSha256,
    evidenceEnvelopeBytesSha256: null,
    bindings,
  });

  const readerExpected = projection("reader", authoritative.readerEnvelopeSha256, {
    chapterContentSha256: input.chapterContentSha256,
    readerDocumentSha256: input.readerDocumentSha256,
    schemaSha256: input.readerSchemaSha256,
  });
  const readerObserved = projection("reader", authoritative.reader?.evidenceEnvelopeSha256 ?? null, {
    chapterContentSha256: authoritative.reader?.chapterContentSha256 ?? null,
    readerDocumentSha256: authoritative.reader?.readerDocumentSha256 ?? null,
    schemaSha256: authoritative.reader?.schemaSha256 ?? null,
  });
  const readerFreshnessErrors = reviewProtocolFreshnessErrorsV2(readerExpected, readerObserved);
  if (readerFreshnessErrors.length > 0) {
    errors.push("stale reader V2 evidence");
  }

  const sourceEnvelopeSetSha256 = hashCanonical(authoritative.sourceEnvelopeSha256s);
  const sourceExpected = projection("source", sourceEnvelopeSetSha256, {
    chapterContentSha256: input.chapterContentSha256,
    schemaSha256: input.sourceSchemaSha256,
    sidecarSha256: input.sidecarSha256,
    sourcePacketSha256: input.sourcePacketSha256,
    sourceUsePlanSha256: input.sourceUsePlanSha256,
  });
  const sourceObserved = projection("source", authoritative.source?.evidenceEnvelopeSha256 ?? null, {
    chapterContentSha256: authoritative.source?.chapterContentSha256 ?? null,
    schemaSha256: authoritative.source?.schemaSha256 ?? null,
    sidecarSha256: authoritative.source?.sidecarSha256 ?? null,
    sourcePacketSha256: authoritative.source?.sourcePacketSha256 ?? null,
    sourceUsePlanSha256: authoritative.source?.sourceUsePlanSha256 ?? null,
  });
  const sourceFreshnessErrors = reviewProtocolFreshnessErrorsV2(sourceExpected, sourceObserved);
  if (sourceFreshnessErrors.length > 0) {
    errors.push("stale source V2 evidence");
  }

  const quizExpected = projection("quiz", authoritative.quizEnvelopeSha256, {
    chapterContentSha256: input.chapterContentSha256,
    derivationSha256: input.derivationSha256,
    phase2DocumentSha256: input.phase2DocumentSha256,
    schemaSha256: input.quizSchemaSha256,
  });
  const quizObserved = projection("quiz", authoritative.quiz?.evidenceEnvelopeSha256 ?? null, {
    chapterContentSha256: authoritative.quiz?.chapterContentSha256 ?? null,
    derivationSha256: authoritative.quiz?.derivationSha256 ?? null,
    phase2DocumentSha256: authoritative.quiz?.phase2DocumentSha256 ?? null,
    schemaSha256: authoritative.quiz?.schemaSha256 ?? null,
  });
  if (reviewProtocolFreshnessErrorsV2(quizExpected, quizObserved).length > 0) {
    errors.push("stale quiz V2 evidence");
  }

  const expectedEnvelopeSetSha256 = authoritative.readerEnvelopeSha256 && authoritative.quizEnvelopeSha256
    ? productionReviewEnvelopeSetSha256({
      readerEnvelopeSha256: authoritative.readerEnvelopeSha256,
      sourceEnvelopeSha256s: authoritative.sourceEnvelopeSha256s,
      quizEnvelopeSha256: authoritative.quizEnvelopeSha256,
    })
    : null;
  const aggregateExpected = projection("aggregate", expectedEnvelopeSetSha256, {
    quizEnvelopeSha256: authoritative.quizEnvelopeSha256,
    readerEnvelopeSha256: authoritative.readerEnvelopeSha256,
    sourceEnvelopeSetSha256,
  });
  const aggregateObserved = projection("aggregate", authoritative.envelopeSetSha256, {
    quizEnvelopeSha256: authoritative.quiz?.evidenceEnvelopeSha256 ?? null,
    readerEnvelopeSha256: authoritative.reader?.evidenceEnvelopeSha256 ?? null,
    sourceEnvelopeSetSha256: authoritative.source?.evidenceEnvelopeSha256 ?? null,
  });
  if (reviewProtocolFreshnessErrorsV2(aggregateExpected, aggregateObserved).length > 0) {
    errors.push("stale production envelope set");
  }
  return errors;
}
