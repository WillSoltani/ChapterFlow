/**
 * s16-forward-pilot-role-readiness-v1 — deterministic case compiler + frozen
 * gold evaluator (plan v2 P5).
 *
 * MODEL-FREE. Compiles every frozen readiness case into its exact inline
 * instrument (envelope + self-contained task) and evaluates raw reviewer
 * output against the frozen gold under the owner-ratified §2.5 metric
 * semantics: reader decisions derive under reader-decision-policy-v3, so an
 * acceptable control is judged by PASS + zero blocking findings + composite,
 * and a craft case is judged by DIRECT advisory-category detection — never by
 * the v2 REVISE side effect (under v3, advisories no longer force REVISE).
 *
 * Bundle-origin cases reuse the exact certified IMP-24 per-lane compilers so
 * a readiness envelope is byte-identical to the qualified instrument's.
 * Acceptable-control cases compile the frozen v21 chapter through the same
 * production reader envelope compiler, after proving the chapter is the exact
 * one the internal adjudication scored (pool-doc rendering hash equality).
 */

import { hashCanonical, sha256Hex } from "../../contracts/contractUtil.js";
import type { ReviewEvidenceEnvelopeV1 } from "../../contracts/reviewEvidenceEnvelope.js";
import type { ReviewRouteEvidenceV2 } from "../../contracts/reviewModelOutputV2.js";
import type { ChapterV21 } from "../../types.js";
import { chapterContentHash } from "../../critics/qcAttestation.js";
import { computeReaderComposite } from "../../review/aggregateChapterReview.js";
import {
  completeKeyFreeReaderDocumentBytesV2,
  completeKeyFreeReaderDocumentSha256V2,
} from "../../review/completeKeyFreeReaderDocumentV2.js";
import {
  assembleProductionQuizReviewV2,
  assembleProductionSourcePartitionReviewV2,
  compileProductionReaderEnvelopeV2,
} from "../../review/forwardProductionReviewV2.js";
import { readerAuthorityViolationsV2 } from "../../review/readerAuthorityBoundaryV2.js";
import { serializeReviewEvidenceEnvelope } from "../../review/reviewEvidenceEnvelope.js";
import {
  assembleReaderExperienceReviewV2,
  buildReaderExperienceInlineReviewTask,
  parseQuizIntegrityModelOutputV2,
  parseReaderExperienceModelOutputV2,
  parseSourceIntegrityModelOutputV2,
} from "../../review/reviewModelOutputV2.js";
import {
  REVIEW_EVIDENCE_PROTOCOL_V2,
  deriveReaderDecisionCategoryV3,
  reviewProtocolFileAccessFailureV2,
  reviewProtocolFreshnessErrorsV2,
  reviewProtocolHasProhibitedConductorEchoV2,
} from "../../review/reviewProtocolV2.js";
import {
  compileImp24QuizProductionInstrument,
  compileImp24ReaderEvidenceEnvelope,
  compileImp24SourceProductionPartition,
  failedReferenceResolution,
  invalidEvaluation,
  projectEvidenceReferenceResolution,
} from "./imp24InstrumentCertification.js";
import {
  deriveImp24SourceSemantics,
  type Imp24QuizCase,
  type Imp24ReaderCase,
  type Imp24SourceCase,
} from "./imp24Corpus.js";
import type {
  CaseEvaluationV3,
  QualificationOutputEvaluatorV3,
} from "./roleQualificationRunnerV3.js";
import { renderKeyFreeReaderDocument } from "./readerGoldDevDocs.js";
import {
  PILOT_ROLE_READINESS_V6_CORPUS_SCHEMA,
  PILOT_ROLE_READINESS_V6_EXPERIMENT_ID,
  READINESS_CANARY_GOLD_ADJUDICATIONS_V1,
  READINESS_CRAFT_WEAKNESS_ACCEPTED_CATEGORIES_V2,
  READINESS_SOURCE_HOLDOUT_GOLD_ADJUDICATIONS_V2,
  type PilotRoleReadinessCorpusV6,
  type ReadinessCaseV1,
} from "./pilotRoleReadinessInstrument.js";

type ReadinessSourceAdjudications = typeof READINESS_SOURCE_HOLDOUT_GOLD_ADJUDICATIONS_V2;

type ReadinessCraftMap = Readonly<Record<string, readonly string[]>>;

type ReadinessGoldAdjudications = typeof READINESS_CANARY_GOLD_ADJUDICATIONS_V1;

/** Reader decision bar (plan bindings: reader-decision-policy-v3 at bar 80). */
export const READINESS_READER_BAR = 80 as const;
export const READINESS_READER_INSTRUMENT_VERSION = "pilot-role-readiness-reader-v1" as const;

/** Frozen mechanization of "the required advisory category is detected": the
 * corpus craft weaknesses mapped onto the reader advisory-category enum. The
 * map errs toward requiring the reviewer to flag the right KIND of craft
 * defect without demanding a label the v2 output schema does not offer. */
export const READINESS_CRAFT_WEAKNESS_ACCEPTED_CATEGORIES: Readonly<Record<string, readonly string[]>> =
  Object.freeze({
    weak_transition: Object.freeze(["pacing", "other_craft"]),
    thin_explanation: Object.freeze(["thin_example", "other_craft"]),
    tone: Object.freeze(["tone"]),
    pacing: Object.freeze(["pacing"]),
  });

/** Route facts are validated at the live-executor boundary, never here; the
 * evaluator uses the same model-free fixture posture as certification. */
const READINESS_ROUTE_FIXTURE: ReviewRouteEvidenceV2 = Object.freeze({
  model: "model-free-readiness-fixture",
  effort: "not-invoked",
  routeReceiptSha256: `sha256:${"0".repeat(64)}`,
});

export class PilotRoleReadinessEvaluatorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PilotRoleReadinessEvaluatorError";
  }
}

function requireCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new PilotRoleReadinessEvaluatorError(message);
}

type AcceptableControlPayload = {
  caseId: string;
  role: "reader";
  kind: "acceptable-control";
  partition: string;
  baseBookId: string;
  baseChapter: number;
  chapter: ChapterV21;
  expected: {
    expectedRecommendation: "SHIP";
    prohibitBlockingFindings: true;
    readerAuthorityOnly: true;
    minComposite: number;
    policy: "reader-decision-policy-v3";
  };
  adjudication: Record<string, unknown>;
};

export type CompiledReadinessCaseV1 = {
  caseId: string;
  role: "reader" | "source" | "quiz";
  category: string;
  envelope: ReviewEvidenceEnvelopeV1;
  evidenceEnvelopeBytes: string;
  task: string;
  gold: unknown;
  /** Exact string the prepared case must bind as sourceCaseSha256 (bundle
   * cases: the carried `sha256:`-prefixed substantive hash; acceptable
   * controls: the corpus wrapper's caseSha256). */
  sourceCaseSha256: string;
  /** Reader-lane assembly bindings; null on source/quiz lanes. */
  chapterContentSha256: string | null;
  readerDocumentSha256: string | null;
  /** Lane-specific assembly context retained for the evaluator. */
  sourcePartition: ReturnType<typeof compileImp24SourceProductionPartition> | null;
  quizInstrument: ReturnType<typeof compileImp24QuizProductionInstrument> | null;
  readerChapter: ChapterV21 | null;
};

function isBundleOrigin(entry: ReadinessCaseV1): boolean {
  return entry.origin.source === "imp24-v3-bundle";
}

/** Apply the owner-adjudicated canary gold overlay (v2). The payload stays
 * verbatim (caseSha256 binds bundle lineage); only the EFFECTIVE gold the
 * instrument compares against changes, and it is hash-bound into goldSha256
 * and therefore into every live request. */
function effectiveGold(
  entry: ReadinessCaseV1,
  bundleGold: unknown,
  adjudications: ReadinessGoldAdjudications | undefined,
  craftMap: ReadinessCraftMap | undefined,
  sourceAdjudications?: ReadinessSourceAdjudications,
): unknown {
  // C2 (owner packet C): source HOLDOUT accepted-set overlays, matched on the
  // original bundle caseId; hash-bound into goldSha256 like every adjudication.
  if (entry.role === "source" && sourceAdjudications) {
    const payloadCaseId = String((entry.payload as { caseId?: unknown }).caseId ?? "");
    const ruling = sourceAdjudications.cases.find((item) => payloadCaseId.includes(item.match));
    if (ruling) {
      const overlaid = { ...(bundleGold as Record<string, unknown>) };
      if (ruling.acceptedSupport) overlaid.acceptedSupport = [...ruling.acceptedSupport];
      if (ruling.acceptedRegisters) overlaid.acceptedRegisters = [...ruling.acceptedRegisters];
      if (ruling.acceptedPrimaryCategories) overlaid.acceptedPrimaryCategories = [...ruling.acceptedPrimaryCategories];
      return overlaid;
    }
  }
  if (entry.role === "reader" && entry.category === "craft-nonblocker" && craftMap) {
    const weakness = String((bundleGold as { expectedWeakness?: unknown }).expectedWeakness ?? "");
    const accepted = craftMap[weakness];
    if (accepted) {
      return { ...(bundleGold as Record<string, unknown>), acceptedCraftCategories: [...accepted] };
    }
  }
  if (!adjudications) return bundleGold;
  const payloadCaseId = String((entry.payload as { caseId?: unknown }).caseId ?? "");
  if (entry.role === "reader" && payloadCaseId === adjudications.reader.caseId) {
    return {
      ...(bundleGold as Record<string, unknown>),
      acceptedBlockingCategories: [...adjudications.reader.acceptedBlockingCategories],
    };
  }
  if (entry.role === "source" && payloadCaseId === adjudications.source.caseId) {
    return {
      ...(bundleGold as Record<string, unknown>),
      supportStatus: adjudications.source.adjudicatedSupportStatus,
      visibleRegister: adjudications.source.adjudicatedVisibleRegister,
      acceptedPrimaryCategories: [...adjudications.source.acceptedPrimaryCategories],
    };
  }
  if (entry.role === "quiz" && entry.category === adjudications.quiz.kind) {
    return {
      ...(bundleGold as Record<string, unknown>),
      keyedMechanismComparison: adjudications.quiz.ruling,
    };
  }
  return bundleGold;
}

/** Compile one frozen readiness case into its exact inline instrument. Pure
 * and deterministic; both the prepared-case builder and the evaluator call
 * this same function, so a prepared artifact that drifts from the compiler
 * output is always detected at evaluation time. */
export function compilePilotReadinessCaseInstrument(
  entry: ReadinessCaseV1,
  adjudications?: ReadinessGoldAdjudications,
  craftMap?: ReadinessCraftMap,
  sourceAdjudications?: ReadinessSourceAdjudications,
): CompiledReadinessCaseV1 {
  requireCondition(hashCanonical(entry.payload) === entry.caseSha256,
    `${entry.caseId}: frozen payload no longer matches its corpus caseSha256`);
  if (entry.role === "reader" && !isBundleOrigin(entry)) {
    requireCondition(entry.origin.source === "reader-acceptable-controls-v1"
        && entry.category === "acceptable-control",
      `${entry.caseId}: non-bundle reader case must be an acceptable control`);
    const payload = entry.payload as unknown as AcceptableControlPayload;
    const chapter = payload.chapter;
    // Owner-adjudication identity link: the frozen chapter must re-render to
    // the exact pool document bytes the internal composite was agreed on.
    // The pool renderer declares a stricter chapter shape than ChapterV21's
    // optional fields; the hash equality below fails closed on any deficit.
    const poolDocument = renderKeyFreeReaderDocument({
      bookId: payload.baseBookId,
      chapter: chapter as unknown as Parameters<typeof renderKeyFreeReaderDocument>[0]["chapter"],
    });
    requireCondition(sha256Hex(Buffer.from(poolDocument, "utf8")) === entry.origin.readerDocumentSha256,
      `${entry.caseId}: chapter no longer renders to the adjudicated pool document`);
    const phase1Document = completeKeyFreeReaderDocumentBytesV2(chapter);
    const compiled = compileProductionReaderEnvelopeV2({
      caseId: payload.caseId,
      instrumentVersion: READINESS_READER_INSTRUMENT_VERSION,
      chapter,
      phase1Document,
      chapterContentSha256: chapterContentHash(chapter),
      readerDocumentSha256: completeKeyFreeReaderDocumentSha256V2(chapter),
    });
    return {
      caseId: entry.caseId,
      role: "reader",
      category: entry.category,
      envelope: compiled.envelope,
      evidenceEnvelopeBytes: compiled.envelopeBytes,
      task: compiled.task,
      gold: effectiveGold(entry, payload.expected, adjudications, craftMap, sourceAdjudications),
      sourceCaseSha256: entry.caseSha256,
      chapterContentSha256: chapterContentHash(chapter),
      readerDocumentSha256: compiled.readerDocumentSha256,
      sourcePartition: null,
      quizInstrument: null,
      readerChapter: chapter,
    };
  }
  requireCondition(isBundleOrigin(entry), `${entry.caseId}: unknown case origin`);
  requireCondition(entry.origin.source === "imp24-v3-bundle", `${entry.caseId}: origin mismatch`);
  const substantive = (entry.payload as { substantiveCaseSha256?: unknown }).substantiveCaseSha256;
  requireCondition(typeof substantive === "string" && substantive === entry.origin.substantiveCaseSha256,
    `${entry.caseId}: payload substantive hash differs from its recorded origin`);
  if (entry.role === "reader") {
    const item = entry.payload as unknown as Imp24ReaderCase;
    const envelope = compileImp24ReaderEvidenceEnvelope(item);
    return {
      caseId: entry.caseId,
      role: "reader",
      category: entry.category,
      envelope,
      evidenceEnvelopeBytes: serializeReviewEvidenceEnvelope(envelope),
      task: buildReaderExperienceInlineReviewTask(envelope),
      gold: effectiveGold(entry, item.expected, adjudications, craftMap, sourceAdjudications),
      sourceCaseSha256: substantive,
      chapterContentSha256: item.provenance.variantContentSha256,
      readerDocumentSha256: completeKeyFreeReaderDocumentSha256V2(item.chapter),
      sourcePartition: null,
      quizInstrument: null,
      readerChapter: item.chapter,
    };
  }
  if (entry.role === "source") {
    const item = entry.payload as unknown as Imp24SourceCase;
    const partition = compileImp24SourceProductionPartition(item);
    return {
      caseId: entry.caseId,
      role: "source",
      category: entry.category,
      envelope: partition.envelope,
      evidenceEnvelopeBytes: serializeReviewEvidenceEnvelope(partition.envelope),
      task: partition.task,
      gold: effectiveGold(entry, deriveImp24SourceSemantics(item), adjudications, craftMap, sourceAdjudications),
      sourceCaseSha256: substantive,
      chapterContentSha256: null,
      readerDocumentSha256: null,
      sourcePartition: partition,
      quizInstrument: null,
      readerChapter: null,
    };
  }
  const item = entry.payload as unknown as Imp24QuizCase;
  const instrument = compileImp24QuizProductionInstrument(item);
  return {
    caseId: entry.caseId,
    role: "quiz",
    category: entry.category,
    envelope: instrument.compiled.envelope,
    evidenceEnvelopeBytes: serializeReviewEvidenceEnvelope(instrument.compiled.envelope),
    task: instrument.compiled.task,
    gold: effectiveGold(entry, item.expected, adjudications, craftMap, sourceAdjudications),
    sourceCaseSha256: substantive,
    chapterContentSha256: null,
    readerDocumentSha256: null,
    sourcePartition: null,
    quizInstrument: instrument,
    readerChapter: null,
  };
}

export function everyReadinessCase(corpus: Pick<PilotRoleReadinessCorpusV6, "reader" | "source" | "quiz">): ReadinessCaseV1[] {
  const cases: ReadinessCaseV1[] = [];
  for (const role of ["reader", "source", "quiz"] as const) {
    for (const partition of ["canary", "holdout"] as const) {
      cases.push(...corpus[role][partition]);
    }
  }
  return cases;
}

/** Frozen-gold evaluator over the readiness corpus. Mirrors the certified
 * IMP-24 evaluator's protocol/freshness/authority handling exactly; only the
 * metric identities and the reader decision policy differ (v3, per D1). */
export function createPilotRoleReadinessEvaluator(
  corpus: PilotRoleReadinessCorpusV6,
): QualificationOutputEvaluatorV3 {
  requireCondition(corpus.schema === PILOT_ROLE_READINESS_V6_CORPUS_SCHEMA
      && corpus.experimentId === PILOT_ROLE_READINESS_V6_EXPERIMENT_ID,
    "readiness evaluator requires the exact frozen v6 readiness corpus");
  requireCondition(hashCanonical(corpus.sourceHoldoutGoldAdjudications)
      === hashCanonical(READINESS_SOURCE_HOLDOUT_GOLD_ADJUDICATIONS_V2),
    "readiness corpus source-holdout adjudications differ from the frozen owner-authorized record");
  requireCondition(hashCanonical(corpus.goldAdjudications) === hashCanonical(READINESS_CANARY_GOLD_ADJUDICATIONS_V1),
    "readiness corpus gold adjudications differ from the frozen owner-authorized record");
  requireCondition(hashCanonical(corpus.craftWeaknessAcceptedCategories)
      === hashCanonical(READINESS_CRAFT_WEAKNESS_ACCEPTED_CATEGORIES_V2),
    "readiness corpus craft-category map differs from the frozen owner-authorized v2 map");
  const byCaseId = new Map<string, { entry: ReadinessCaseV1; compiled: CompiledReadinessCaseV1 }>();
  for (const entry of everyReadinessCase(corpus)) {
    requireCondition(!byCaseId.has(entry.caseId), `duplicate readiness case ${entry.caseId}`);
    byCaseId.set(entry.caseId, { entry, compiled: compilePilotReadinessCaseInstrument(entry, corpus.goldAdjudications, corpus.craftWeaknessAcceptedCategories, corpus.sourceHoldoutGoldAdjudications) });
  }
  requireCondition(byCaseId.size === 42, `readiness evaluator requires all 42 frozen cases, got ${byCaseId.size}`);

  return ({ preparedCase, request, receipt, rawOutput }): CaseEvaluationV3 => {
    const found = byCaseId.get(preparedCase.caseId);
    requireCondition(found !== undefined, `prepared case is absent from the frozen readiness corpus: ${preparedCase.role}/${preparedCase.caseId}`);
    const { entry, compiled } = found;
    requireCondition(preparedCase.role === entry.role && preparedCase.family === entry.category,
      `${entry.caseId}: prepared role/category binding mismatch`);
    requireCondition(preparedCase.sourceCaseSha256 === compiled.sourceCaseSha256,
      `${entry.caseId}: prepared source-case hash mismatch`);
    requireCondition(preparedCase.goldSha256 === hashCanonical(compiled.gold),
      `${entry.caseId}: prepared gold hash mismatch`);
    requireCondition(preparedCase.envelope.envelopeSha256 === compiled.envelope.envelopeSha256
        && preparedCase.evidenceEnvelopeBytes === compiled.evidenceEnvelopeBytes
        && preparedCase.evidenceEnvelopeBytesSha256 === sha256Hex(compiled.evidenceEnvelopeBytes),
      `${entry.caseId}: prepared envelope differs from the deterministic compiler output`);

    const expectedToRequestFreshness = reviewProtocolFreshnessErrorsV2({
      reviewProtocol: REVIEW_EVIDENCE_PROTOCOL_V2,
      lane: entry.role,
      evidenceEnvelopeSha256: compiled.envelope.envelopeSha256,
      evidenceEnvelopeBytesSha256: sha256Hex(compiled.evidenceEnvelopeBytes),
      bindings: {
        caseId: entry.caseId,
        evidenceEnvelopeBytesContentSha256: sha256Hex(compiled.evidenceEnvelopeBytes),
        goldSha256: preparedCase.goldSha256,
        promptSourceSha256: preparedCase.promptSourceSha256,
        schemaSha256: preparedCase.schemaSha256,
        sourceCaseSha256: compiled.sourceCaseSha256,
      },
    }, {
      reviewProtocol: request.reviewProtocol,
      lane: request.role,
      evidenceEnvelopeSha256: request.evidenceEnvelopeSha256,
      evidenceEnvelopeBytesSha256: request.evidenceEnvelopeBytesSha256,
      bindings: {
        caseId: request.caseId,
        evidenceEnvelopeBytesContentSha256: sha256Hex(request.evidenceEnvelopeBytes),
        goldSha256: request.goldSha256,
        promptSourceSha256: request.promptSourceSha256,
        schemaSha256: request.schemaSha256,
        sourceCaseSha256: request.sourceCaseSha256,
      },
    });
    const requestToReceiptFreshness = reviewProtocolFreshnessErrorsV2({
      reviewProtocol: request.reviewProtocol,
      lane: request.role,
      evidenceEnvelopeSha256: request.evidenceEnvelopeSha256,
      evidenceEnvelopeBytesSha256: request.evidenceEnvelopeBytesSha256,
      bindings: {
        certificationSha256: request.certificationSha256,
        evidenceEnvelopeBytesContentSha256: sha256Hex(request.evidenceEnvelopeBytes),
        freezeSha256: request.freezeSha256,
        productionInstrumentSealSha256: request.productionInstrumentSealSha256,
        schemaSha256: request.schemaSha256,
      },
    }, {
      reviewProtocol: receipt.reviewProtocol,
      lane: receipt.role,
      evidenceEnvelopeSha256: receipt.evidenceEnvelopeSha256,
      evidenceEnvelopeBytesSha256: receipt.evidenceEnvelopeBytesSha256,
      bindings: {
        certificationSha256: receipt.certificationSha256,
        evidenceEnvelopeBytesContentSha256: sha256Hex(receipt.evidenceEnvelopeBytes),
        freezeSha256: receipt.freezeSha256,
        productionInstrumentSealSha256: receipt.productionInstrumentSealSha256,
        schemaSha256: receipt.schemaSha256,
      },
    });
    const envelopeBound = expectedToRequestFreshness.length === 0 && requestToReceiptFreshness.length === 0;
    const fileFailure = reviewProtocolFileAccessFailureV2(rawOutput);
    const prohibitedEcho = reviewProtocolHasProhibitedConductorEchoV2(rawOutput, entry.role);

    if (entry.role === "reader") return evaluateReader({ entry, compiled, preparedCase, rawOutput, envelopeBound, fileFailure, prohibitedEcho });
    if (entry.role === "source") return evaluateSource({ entry, compiled, preparedCase, rawOutput, envelopeBound, fileFailure, prohibitedEcho });
    return evaluateQuiz({ entry, compiled, preparedCase, rawOutput, envelopeBound, fileFailure, prohibitedEcho });
  };
}

type LaneEvaluationArgs = {
  entry: ReadinessCaseV1;
  compiled: CompiledReadinessCaseV1;
  preparedCase: { schemaSha256: string };
  rawOutput: string;
  envelopeBound: boolean;
  fileFailure: boolean;
  prohibitedEcho: boolean;
};

function evaluateReader(args: LaneEvaluationArgs): CaseEvaluationV3 {
  const { entry, compiled, rawOutput } = args;
  let parsed: ReturnType<typeof parseReaderExperienceModelOutputV2>;
  try {
    parsed = parseReaderExperienceModelOutputV2(rawOutput);
  } catch (error) {
    return invalidEvaluation({
      envelopeBound: args.envelopeBound,
      fileAccessFailure: args.fileFailure,
      prohibitedConductorEcho: args.prohibitedEcho,
      semanticSummary: (error as Error).message,
      parseError: (error as Error).message,
    });
  }
  const authorityViolations = readerAuthorityViolationsV2(parsed);
  if (authorityViolations.length > 0) {
    const first = authorityViolations[0];
    return invalidEvaluation({
      envelopeBound: args.envelopeBound,
      fileAccessFailure: args.fileFailure,
      prohibitedConductorEcho: args.prohibitedEcho,
      schemaValid: true,
      authorityCompliant: false,
      semanticSummary: `reader authority violation at ${first.surface}: ${first.kind}`,
      parsedOutput: parsed,
    });
  }
  try {
    const assembled = assembleReaderExperienceReviewV2({
      output: parsed,
      envelope: compiled.envelope,
      chapterContentSha256: compiled.chapterContentSha256!,
      readerDocumentSha256: compiled.readerDocumentSha256!,
      schemaSha256: args.preparedCase.schemaSha256,
      rubricVersion: "reader-experience-v2-envelope",
      routeEvidence: READINESS_ROUTE_FIXTURE,
    });
    const blockingCategories = assembled.blockingFindings.map((finding) => finding.category);
    const result = deriveReaderDecisionCategoryV3(assembled, READINESS_READER_BAR);
    const composite = computeReaderComposite(assembled.scores);
    const observations: Record<string, boolean> = {};
    let semanticCorrect = false;
    if (entry.category === "reader-visible-hard-blocker") {
      const gold = compiled.gold as { expectedBlockingCategory?: unknown; acceptedBlockingCategories?: string[] };
      const accepted = gold.acceptedBlockingCategories ?? [String(gold.expectedBlockingCategory)];
      observations.hardBlockerSensitivity = result === "BLOCK"
        && blockingCategories.some((category) => accepted.includes(category));
      semanticCorrect = observations.hardBlockerSensitivity;
    } else if (entry.category === "acceptable-control") {
      const minComposite = Number((compiled.gold as { minComposite?: unknown }).minComposite ?? READINESS_READER_BAR);
      observations.falseReaderBlockersOnAcceptableAndCraft = blockingCategories.length === 0;
      observations.acceptableControlSuccess = result === "PASS"
        && blockingCategories.length === 0
        && composite >= minComposite;
      semanticCorrect = observations.acceptableControlSuccess;
    } else {
      const craftGold = compiled.gold as { expectedWeakness?: unknown; acceptedCraftCategories?: string[] };
      const weakness = String(craftGold.expectedWeakness ?? "");
      const accepted = craftGold.acceptedCraftCategories ?? READINESS_CRAFT_WEAKNESS_ACCEPTED_CATEGORIES[weakness];
      requireCondition(accepted !== undefined,
        `${entry.caseId}: craft weakness '${weakness}' has no frozen advisory-category mapping`);
      observations.falseReaderBlockersOnAcceptableAndCraft = blockingCategories.length === 0;
      // v3 semantics: detection is the advisory finding itself (assembly has
      // already proven its evidence refs resolve), never the REVISE decision.
      observations.craftCategoryDetected = blockingCategories.length === 0
        && assembled.advisoryFindings.some((finding) => accepted.includes(finding.category));
      semanticCorrect = observations.craftCategoryDetected;
    }
    const complete = assembled.quizDerivation.answers.length === compiled.readerChapter!.quiz.questions.length;
    return {
      schemaValid: true,
      envelopeBound: args.envelopeBound,
      evidenceReferenceValid: true,
      authorityCompliant: !args.prohibitedEcho,
      complete,
      fileAccessFailure: args.fileFailure,
      prohibitedConductorEcho: args.prohibitedEcho,
      resolved: complete,
      semanticCorrect,
      semanticSummary: `${result}; composite=${composite}; blockers=${blockingCategories.join(",") || "none"}`,
      metricObservations: observations,
      parsedOutput: parsed,
      parseError: null,
      assembledReview: assembled,
      assemblyError: null,
      evidenceReferenceResolution: projectEvidenceReferenceResolution(assembled),
    };
  } catch (error) {
    return invalidEvaluation({
      envelopeBound: args.envelopeBound,
      fileAccessFailure: args.fileFailure,
      prohibitedConductorEcho: args.prohibitedEcho,
      schemaValid: true,
      authorityCompliant: !args.prohibitedEcho,
      semanticSummary: (error as Error).message,
      parsedOutput: parsed,
      assemblyError: (error as Error).message,
      evidenceReferenceResolution: failedReferenceResolution(error),
    });
  }
}

function evaluateSource(args: LaneEvaluationArgs): CaseEvaluationV3 {
  const { entry, compiled, rawOutput } = args;
  const gold = compiled.gold as {
    result: string;
    primaryCategory: string | null;
    supportStatus: string;
    visibleRegister: string;
    acceptedPrimaryCategories?: string[];
    acceptedSupport?: string[];
    acceptedRegisters?: string[];
  };
  const acceptedPrimary = gold.primaryCategory === null
    ? null
    : gold.acceptedPrimaryCategories ?? [gold.primaryCategory];
  const acceptedSupport = gold.acceptedSupport ?? [gold.supportStatus];
  const acceptedRegisters = gold.acceptedRegisters ?? [gold.visibleRegister];
  let parsed: ReturnType<typeof parseSourceIntegrityModelOutputV2>;
  try {
    parsed = parseSourceIntegrityModelOutputV2(rawOutput);
  } catch (error) {
    return invalidEvaluation({
      envelopeBound: args.envelopeBound,
      fileAccessFailure: args.fileFailure,
      prohibitedConductorEcho: args.prohibitedEcho,
      semanticSummary: (error as Error).message,
      parseError: (error as Error).message,
    });
  }
  try {
    const item = entry.payload as unknown as Imp24SourceCase;
    const partition = compiled.sourcePartition!;
    // C1 (owner packet C, readiness-scoped): on constructed/generic-family
    // cases the task never states the plan-evidence citation requirement; a
    // finding citing only chapter evidence is augmented with the envelope's
    // deterministic plan-segment ref (context, not model judgment) so the
    // shared production assembly rule can bind it. Production is untouched.
    let effectiveRawOutput = rawOutput;
    {
      const planRef = partition.envelope.segments.find((segment) => segment.kind === "plan")?.refId;
      const nonChapterRefIds = new Set(partition.envelope.segments
        .filter((segment) => segment.kind !== "chapter")
        .map((segment) => segment.refId));
      try {
        const reparsed = JSON.parse(rawOutput) as { assessments?: Array<{ findings?: Array<Record<string, unknown>> }> };
        let changed = false;
        for (const assessment of reparsed.assessments ?? []) {
          for (const finding of assessment.findings ?? []) {
            // Packet-E re-slot (READINESS_ASSEMBLY_RESLOT_RULING_V1): the
            // model's own plan/source citations misfiled in
            // chapterEvidenceRefIds move to sourceEvidenceRefIds verbatim.
            const chapterRefs = finding.chapterEvidenceRefIds;
            if (Array.isArray(chapterRefs)) {
              const misfiled = chapterRefs.filter((ref) => nonChapterRefIds.has(String(ref)));
              if (misfiled.length > 0) {
                finding.chapterEvidenceRefIds = chapterRefs.filter((ref) => !nonChapterRefIds.has(String(ref)));
                const src = Array.isArray(finding.sourceEvidenceRefIds) ? finding.sourceEvidenceRefIds as unknown[] : [];
                finding.sourceEvidenceRefIds = [...src, ...misfiled.filter((ref) => !src.includes(ref))];
                changed = true;
              }
            }
            // C1 augmentation (constructed/generic families): an empty
            // sourceEvidenceRefIds gains the deterministic plan ref.
            if ((entry.category === "constructed-application" || entry.category === "generic-operational"
              || entry.category.startsWith("unframed-") || entry.category.startsWith("generic-")) && planRef) {
              const refs = finding.sourceEvidenceRefIds;
              if (Array.isArray(refs) && refs.length === 0) {
                finding.sourceEvidenceRefIds = [planRef];
                changed = true;
              }
            }
          }
        }
        if (changed) effectiveRawOutput = JSON.stringify(reparsed);
      } catch {
        // fall through to normal assembly on unparseable output
      }
    }
    const assembled = assembleProductionSourcePartitionReviewV2({
      rawOutput: effectiveRawOutput,
      partition,
      chapterContentSha256: item.evidence.provenanceHashes.chapterContentSha256,
      sourceUsePlanSha256: item.evidence.provenanceHashes.sourceUsePlanSha256,
      sourcePacketSha256: item.evidence.provenanceHashes.sourcePacketSha256,
      sidecarSha256: item.evidence.provenanceHashes.sidecarSha256,
      schemaSha256: args.preparedCase.schemaSha256,
      routeEvidence: READINESS_ROUTE_FIXTURE,
    });
    const unit = assembled.units[0];
    const categories = unit?.findings.map((finding) => finding.primaryCategory) ?? [];
    const observations: Record<string, boolean> = {
      supportRegisterAccuracy: acceptedSupport.includes(String(unit?.supportStatus))
        && acceptedRegisters.includes(String(unit?.visibleRegister)),
    };
    if (acceptedPrimary !== null) {
      observations.highSeverityDefectSensitivity = assembled.result === "BLOCK"
        && categories.some((category) => acceptedPrimary.includes(category));
    } else {
      observations.falseHighSeverityBlockerFreeOnClean = assembled.result !== "BLOCK"
        && !unit?.findings.some((finding) => finding.severity === "blocker");
    }
    const complete = assembled.unresolvedTargetRefs.length === 0 && assembled.units.length === 1;
    const semanticCorrect = complete
      && assembled.result === gold.result
      && observations.supportRegisterAccuracy
      && (acceptedPrimary === null || categories.some((category) => acceptedPrimary.includes(category)));
    return {
      schemaValid: true,
      envelopeBound: args.envelopeBound,
      evidenceReferenceValid: true,
      authorityCompliant: !args.prohibitedEcho,
      complete,
      fileAccessFailure: args.fileFailure,
      prohibitedConductorEcho: args.prohibitedEcho,
      resolved: complete,
      semanticCorrect,
      semanticSummary: `${assembled.result}; primary=${categories.join(",") || "none"}`,
      metricObservations: observations,
      parsedOutput: parsed,
      parseError: null,
      assembledReview: assembled,
      assemblyError: null,
      evidenceReferenceResolution: projectEvidenceReferenceResolution(assembled),
    };
  } catch (error) {
    return invalidEvaluation({
      envelopeBound: args.envelopeBound,
      fileAccessFailure: args.fileFailure,
      prohibitedConductorEcho: args.prohibitedEcho,
      schemaValid: true,
      authorityCompliant: !args.prohibitedEcho,
      semanticSummary: (error as Error).message,
      parsedOutput: parsed,
      assemblyError: (error as Error).message,
      evidenceReferenceResolution: failedReferenceResolution(error),
    });
  }
}

function evaluateQuiz(args: LaneEvaluationArgs): CaseEvaluationV3 {
  const { entry, compiled, rawOutput } = args;
  const item = entry.payload as unknown as Imp24QuizCase;
  let parsed: ReturnType<typeof parseQuizIntegrityModelOutputV2>;
  try {
    parsed = parseQuizIntegrityModelOutputV2(rawOutput);
  } catch (error) {
    return invalidEvaluation({
      envelopeBound: args.envelopeBound,
      fileAccessFailure: args.fileFailure,
      prohibitedConductorEcho: args.prohibitedEcho,
      semanticSummary: (error as Error).message,
      parseError: (error as Error).message,
    });
  }
  try {
    const instrument = compiled.quizInstrument!;
    const assembled = assembleProductionQuizReviewV2({
      rawOutput,
      compiled: instrument.compiled,
      chapterContentSha256: item.provenance.variantContentSha256,
      phase2DocumentSha256: instrument.phase2DocumentSha256,
      derivationSha256: instrument.committedDerivation.sha256,
      schemaSha256: args.preparedCase.schemaSha256,
      routeEvidence: READINESS_ROUTE_FIXTURE,
    });
    const question = assembled.questions[0];
    const observations: Record<string, boolean> = {};
    if (entry.category === "key-mismatch") observations.wrongKeyDetection = assembled.result === "BLOCK" && question?.keyCorrect === "wrong";
    if (entry.category === "uniquely-correct-clean") observations.cleanUniqueAnswerSuccess = assembled.result === "PASS" && question?.keyCorrect === "correct";
    if (entry.category === "genuine-ambiguity") observations.ambiguityDetection = assembled.result === "BLOCK" && question?.keyCorrect === "ambiguous";
    if (entry.category === "mechanism-causal-key") {
      observations.mechanismAccuracy = assembled.result === item.expected.goldResult
        && question?.keyedMechanismSupported === item.expected.keyedMechanismSupported;
    }
    const complete = assembled.unresolvedQuestionRefs.length === 0 && assembled.questions.length === 1;
    const mechanismExcluded = (compiled.gold as { keyedMechanismComparison?: unknown }).keyedMechanismComparison
      === "excluded-from-semantic-comparison";
    const semanticCorrect = complete
      && assembled.result === item.expected.goldResult
      && question?.keyCorrect === item.expected.keyCorrect
      && (mechanismExcluded || question?.keyedMechanismSupported === item.expected.keyedMechanismSupported);
    return {
      schemaValid: true,
      envelopeBound: args.envelopeBound,
      evidenceReferenceValid: true,
      authorityCompliant: !args.prohibitedEcho,
      complete,
      fileAccessFailure: args.fileFailure,
      prohibitedConductorEcho: args.prohibitedEcho,
      resolved: complete,
      semanticCorrect,
      semanticSummary: `${assembled.result}; key=${question?.keyCorrect ?? "unresolved"}`,
      metricObservations: observations,
      parsedOutput: parsed,
      parseError: null,
      assembledReview: assembled,
      assemblyError: null,
      evidenceReferenceResolution: projectEvidenceReferenceResolution(assembled),
    };
  } catch (error) {
    return invalidEvaluation({
      envelopeBound: args.envelopeBound,
      fileAccessFailure: args.fileFailure,
      prohibitedConductorEcho: args.prohibitedEcho,
      schemaValid: true,
      authorityCompliant: !args.prohibitedEcho,
      semanticSummary: (error as Error).message,
      parsedOutput: parsed,
      assemblyError: (error as Error).message,
      evidenceReferenceResolution: failedReferenceResolution(error),
    });
  }
}
