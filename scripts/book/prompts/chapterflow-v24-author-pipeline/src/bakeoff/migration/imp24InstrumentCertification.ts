/**
 * IMP-24 model-free instrument certification.
 *
 * No function in this module can spawn a model.  It compiles every V3 corpus
 * case through the same shared inline-envelope/task and V2 conductor-assembly
 * implementation used by production, executes deterministic fixture outputs,
 * validates reference resolution and conductor-derived outcomes, binds the
 * exact retained production seal and frozen instrument inputs, then emits a
 * self-hashed `CERTIFIED_MODEL_FREE` binding.
 */

import { existsSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";

import { REVIEW_FACTORS, type ReviewFactor } from "../../artifacts/artifactTypes.js";
import { canonicalJson, hashCanonical, sha256Hex } from "../../contracts/contractUtil.js";
import {
  QUIZ_INTEGRITY_MODEL_OUTPUT_V2_SCHEMA,
  READER_EXPERIENCE_MODEL_OUTPUT_V2_SCHEMA,
  SOURCE_INTEGRITY_MODEL_OUTPUT_V2_SCHEMA,
  SOURCE_PRIMARY_CATEGORY_PRECEDENCE_V2,
  type QuizIntegrityModelOutputV2,
  type ReaderExperienceModelOutputV2,
  type ReviewRouteEvidenceV2,
  type SourceIntegrityModelOutputV2,
} from "../../contracts/reviewModelOutputV2.js";
import type { ReviewEvidenceEnvelopeV1 } from "../../contracts/reviewEvidenceEnvelope.js";
import { writeFileAtomic } from "../../lib/atomicWrite.js";
import {
  IMP24_FORWARD_PRODUCTION_INSTRUMENT_SEAL_ARTIFACT_REL_PATH,
  verifyRetainedForwardProductionInstrumentSeal,
} from "../../orchestrator/forwardProductionInstrumentSeal.js";
import {
  completeKeyFreeReaderDocumentBytesV2,
  completeKeyFreeReaderDocumentSha256V2,
} from "../../review/completeKeyFreeReaderDocumentV2.js";
import {
  assembleProductionQuizReviewV2,
  assembleProductionSourcePartitionReviewV2,
  compileProductionQuizEnvelopeV2,
  compileProductionReaderEnvelopeV2,
  compileProductionResolvedSourceEnvelopeSetV2,
  type ProductionQuizEnvelopeV2,
  type ProductionSourcePartitionV2,
} from "../../review/forwardProductionReviewV2.js";
import {
  buildQuizDerivation,
  commitQuizDerivation,
  quizItemId,
  renderQuizPhase2Doc,
  type CommittedQuizDerivation,
} from "../../review/quizDerivation.js";
import { serializeReviewEvidenceEnvelope } from "../../review/reviewEvidenceEnvelope.js";
import { readerAuthorityViolationsV2 } from "../../review/readerAuthorityBoundaryV2.js";
import {
  READER_EXPERIENCE_SEMANTIC_RUBRIC_VERSION,
  READER_EXPERIENCE_SEMANTIC_SHA256,
} from "../../review/readerExperienceSemanticRubric.js";
import {
  SOURCE_INTEGRITY_SEMANTIC_RULES_VERSION,
  SOURCE_INTEGRITY_SEMANTIC_SHA256,
} from "../../review/sourceIntegritySemanticRules.js";
import {
  QUIZ_INTEGRITY_SEMANTIC_RULES_VERSION,
  QUIZ_INTEGRITY_SEMANTIC_SHA256,
} from "../../review/quizIntegritySemanticRules.js";
import {
  REVIEW_EVIDENCE_PROTOCOL_V2,
  deriveReaderDecisionCategoryV2,
  reviewProtocolFileAccessFailureV2,
  reviewProtocolFreshnessErrorsV2,
  reviewProtocolHasProhibitedConductorEchoV2,
} from "../../review/reviewProtocolV2.js";
import {
  assembleReaderExperienceReviewV2,
  buildReaderExperienceInlineReviewTask,
  parseQuizIntegrityModelOutputV2,
  parseReaderExperienceModelOutputV2,
  parseSourceIntegrityModelOutputV2,
} from "../../review/reviewModelOutputV2.js";
import { canonicalPretty, hashValue } from "./corpusBuilderCore.js";
import {
  IMP24_PRODUCTION_QUALIFICATION_PARITY_ARTIFACT_REL_PATH,
  buildImp24ProductionQualificationParity,
  serializeImp24ProductionQualificationParity,
  type Imp24ProductionQualificationParity,
} from "./imp24ProductionQualificationParity.js";
import {
  IMP24_ROLE_CANDIDATE_ORDER_SHA256,
  IMP24_ROLE_QUALIFICATION_CALL_BUDGET_SHA256,
  IMP24_ROLE_QUALIFICATION_CALL_BUDGET_V3,
  IMP24_FROZEN_ROLE_THRESHOLDS,
  buildFrozenRoleQualificationScheduleV3,
  instrumentCertificationBindingSha256,
  projectPreparedQualificationCasesV3,
  type CaseEvaluationV3,
  type EvidenceReferenceResolutionBindingV3,
  type EvidenceReferenceResolutionV3,
  type InstrumentCertificationBindingV3,
  type PreparedQualificationCasesV3,
  type QualificationOutputEvaluatorV3,
} from "./roleQualificationRunnerV3.js";
import {
  IMP24_ROLE_QUALIFICATION_ID,
  auditImp24CorpusPassA,
  auditImp24CorpusRetainedArtifactPassB,
  assertImp24LegacyEvidencePreservation,
  buildImp24CorpusBundle,
  certifyImp24Corpora,
  deriveImp24SourceSemantics,
  loadImp24FrozenV2Inputs,
  serializeImp24CorpusBundle,
  type Imp24CorpusBundle,
  type Imp24CorpusCertification,
  type Imp24LegacyEvidenceClosureArtifact,
  type Imp24QuizCase,
  type Imp24ReaderCase,
  type Imp24ReviewRole,
  type Imp24SourceCase,
} from "./imp24Corpus.js";

export const IMP24_INSTRUMENT_CERTIFICATION_STATUS = "CERTIFIED_MODEL_FREE" as const;
export const IMP24_INSTRUMENT_CERTIFICATION_SCHEMA = "imp24-instrument-certification-v1" as const;
export const IMP24_INSTRUMENT_CERTIFICATION_BINDING_SCHEMA = "imp24-instrument-certification-binding-v1" as const;
export const IMP24_INSTRUMENT_VERSION = "imp24-inline-evidence-envelope-v1" as const;

export const IMP24_CERTIFICATION_ARTIFACT_PATHS = {
  corpusBundle: "scripts/book/prompts/chapterflow-v24-author-pipeline/state/migration-experiments/contracts/imp24/role-qualification-corpus-bundle.v3-envelope.json",
  certificationBinding: "scripts/book/prompts/chapterflow-v24-author-pipeline/state/migration-experiments/contracts/imp24/instrument-certification-binding.json",
  legacyClosure: "scripts/book/prompts/chapterflow-v24-author-pipeline/state/migration-experiments/contracts/imp24/legacy-v1-v2-evidence-closure.json",
  productionQualificationParity: IMP24_PRODUCTION_QUALIFICATION_PARITY_ARTIFACT_REL_PATH,
  reportJson: "docs/v25/reports/IMP-24_INSTRUMENT_CERTIFICATION.json",
  reportMarkdown: "docs/v25/reports/IMP-24_INSTRUMENT_CERTIFICATION.md",
  thresholds: "scripts/book/prompts/chapterflow-v24-author-pipeline/state/migration-experiments/contracts/imp24/role-thresholds.v3-envelope.json",
  productionConductor: "scripts/book/prompts/chapterflow-v24-author-pipeline/src/orchestrator/forwardChapterConductor.ts",
  qualificationRunner: "scripts/book/prompts/chapterflow-v24-author-pipeline/src/bakeoff/migration/roleQualificationRunnerV3.ts",
  qualificationLiveAdapter: "scripts/book/prompts/chapterflow-v24-author-pipeline/src/orchestrator/forwardRoleQualificationLiveV3.ts",
} as const;

const PIPELINE_REL = "scripts/book/prompts/chapterflow-v24-author-pipeline";
const SCHEMA_RELATIVE_PATHS = [
  `${PIPELINE_REL}/state/migration-experiments/contracts/schemas/reader-experience-model-output-v2.schema.json`,
  `${PIPELINE_REL}/state/migration-experiments/contracts/schemas/source-integrity-model-output-v2.schema.json`,
  `${PIPELINE_REL}/state/migration-experiments/contracts/schemas/quiz-integrity-model-output-v2.schema.json`,
] as const;
const SHARED_IMPLEMENTATION_RELATIVE_PATHS = [
  `${PIPELINE_REL}/src/contracts/aggregateChapterReview.ts`,
  `${PIPELINE_REL}/src/contracts/reviewEvidenceEnvelope.ts`,
  `${PIPELINE_REL}/src/contracts/reviewModelOutputV2.ts`,
  `${PIPELINE_REL}/src/review/aggregateChapterReview.ts`,
  `${PIPELINE_REL}/src/review/completeKeyFreeReaderDocumentV2.ts`,
  `${PIPELINE_REL}/src/review/evidenceReferenceResolver.ts`,
  `${PIPELINE_REL}/src/review/forwardProductionReviewV2.ts`,
  `${PIPELINE_REL}/src/review/quizDerivation.ts`,
  `${PIPELINE_REL}/src/review/quizIntegrityReview.ts`,
  `${PIPELINE_REL}/src/review/readerAuthorityBoundaryV2.ts`,
  `${PIPELINE_REL}/src/review/reviewEvidenceEnvelope.ts`,
  `${PIPELINE_REL}/src/review/reviewModelOutputV2.ts`,
  `${PIPELINE_REL}/src/review/reviewProtocolV2.ts`,
  `${PIPELINE_REL}/src/orchestrator/forwardChapterConductor.ts`,
  `${PIPELINE_REL}/src/orchestrator/codexAgent.ts`,
  `${PIPELINE_REL}/src/orchestrator/forwardReviewerExecutor.ts`,
  `${PIPELINE_REL}/src/orchestrator/forwardRoleAssignmentFreezeV3.ts`,
  `${PIPELINE_REL}/src/orchestrator/forwardRoleQualificationCampaignV3.ts`,
  `${PIPELINE_REL}/src/orchestrator/forwardRoleQualificationLiveV3.ts`,
  `${PIPELINE_REL}/src/orchestrator/modelPolicy.ts`,
  `${PIPELINE_REL}/src/bakeoff/migration/imp24InstrumentCertification.ts`,
  `${PIPELINE_REL}/src/bakeoff/migration/imp24ProductionQualificationParity.ts`,
  `${PIPELINE_REL}/src/bakeoff/migration/roleQualificationRunnerV3.ts`,
  `${PIPELINE_REL}/src/lib/readerContent.ts`,
] as const;

const ROUTE_FIXTURE: ReviewRouteEvidenceV2 = Object.freeze({
  model: "model-free-certification-fixture",
  effort: "not-invoked",
  routeReceiptSha256: `sha256:${"0".repeat(64)}`,
});

const TASK_FORBIDDEN_PATTERNS: ReadonlyArray<{ label: string; pattern: RegExp }> = [
  { label: "file-is-at instruction", pattern: /\bfile\s+is\s+at\b/i },
  { label: "read-this-file instruction", pattern: /\bread\s+(?:only\s+)?this\s+file\b/i },
  { label: "absolute private path", pattern: /\/(?:Users|home|private\/tmp)\//i },
  { label: "model identity", pattern: /\b(?:gpt-[a-z0-9.-]+|claude(?:-[a-z0-9.-]+)?|gemini(?:-[a-z0-9.-]+)?|o[1-9](?:-[a-z0-9.-]+)?)\b/i },
  { label: "immutable hash echo", pattern: /\b(?:emit|echo|copy|return)\b[^\n]{0,80}\b(?:content|document|schema|plan|packet|sidecar|envelope)\s*hash/i },
  { label: "immutable index echo", pattern: /\b(?:emit|echo|copy|return)\b[^\n]{0,80}\b(?:keyed|committed|derived)\s+(?:answer\s+)?index/i },
];

export class Imp24InstrumentCertificationError extends Error {
  readonly issues: string[];

  constructor(message: string, issues: string[] = []) {
    super(message);
    this.name = "Imp24InstrumentCertificationError";
    this.issues = issues;
  }
}

export type Imp24CompiledCaseCertification = {
  role: Imp24ReviewRole;
  partition: "canary" | "holdout";
  caseId: string;
  caseSha256: string;
  envelopeSha256: string;
  envelopeBytesSha256: string;
  taskSha256: string;
  fixtureOutputSha256: string;
  assembledReviewSha256: string;
  expectedOutcome: string;
  derivedOutcome: string;
  protocolValid: true;
  referenceResolutionValid: true;
  taskSelfContained: true;
};

/** Exact live-runner binding.  There is one schema and one self-hash recipe. */
export type Imp24InstrumentCertificationBinding = InstrumentCertificationBindingV3;

export type Imp24InstrumentCertificationReport = {
  schema: typeof IMP24_INSTRUMENT_CERTIFICATION_SCHEMA;
  status: typeof IMP24_INSTRUMENT_CERTIFICATION_STATUS;
  experimentId: typeof IMP24_ROLE_QUALIFICATION_ID;
  binding: Imp24InstrumentCertificationBinding;
  corpusAudit: ReturnType<typeof certifyImp24Corpora>;
  legacyClosure: Imp24LegacyEvidenceClosureArtifact;
  productionSeal: {
    sealSha256: string;
    artifactBytesSha256: string;
    fileCount: number;
    verified: true;
  };
  productionQualificationParity: {
    paritySha256: string;
    artifactBytesSha256: string;
    sourceCount: number;
    verified: true;
  };
  frozenInputHashes: {
    corpusPartitions: Record<Imp24ReviewRole, Record<"canary" | "holdout", string>>;
    candidateOrderSha256: string;
    preparedCasesSha256: string;
    scheduleSha256: string;
    callBudgetSha256: string;
    callBudget: typeof IMP24_ROLE_QUALIFICATION_CALL_BUDGET_V3;
    productionQualificationParitySha256: string;
    implementationSetSha256: string;
    implementationSources: Array<{ relativePath: string; bytesSha256: string; bytes: number }>;
  };
  limitations: string[];
  exactCaseCounts: { reader: number; source: number; quiz: number; total: number };
  cases: Imp24CompiledCaseCertification[];
  checks: {
    allEnvelopesInlineAndHashValid: true;
    allTasksSelfContained: true;
    allFixtureOutputsStrictV2: true;
    allConductorAssembliesValid: true;
    allEvidenceReferencesResolved: true;
    sourceMissingEvidenceIsInconclusive: true;
    oldV1V2FreshnessRejected: true;
    productionQualificationSharedImplementation: true;
    exactProductionSealVerified: true;
    twoIndependentCorpusAuditsAgree: true;
  };
  modelCalls: 0;
  apiCalls: 0;
};

export type Imp24CertificationOptions = {
  repositoryRoot: string;
  pipelineRoot?: string;
  contractsDir?: string;
  /** Exact retained V3 corpus bundle that genuine independent Pass B re-reads. */
  corpusBundlePath?: string;
  thresholdsPath?: string;
  productionSealPath?: string;
};

export type Imp24CertificationMaterializationOptions = Imp24CertificationOptions & {
  outputPaths?: Partial<Record<keyof typeof IMP24_CERTIFICATION_ARTIFACT_PATHS, string>>;
};

export type Imp24CertificationMaterializationResult = {
  schema: "imp24-instrument-certification-materialization-v1";
  status: typeof IMP24_INSTRUMENT_CERTIFICATION_STATUS;
  binding: Imp24InstrumentCertificationBinding;
  outputs: Record<"corpusBundle" | "certificationBinding" | "legacyClosure" | "productionQualificationParity" | "reportJson" | "reportMarkdown", {
    relativePath: string;
    bytesSha256: string;
    bytes: number;
  }>;
  modelCalls: 0;
  apiCalls: 0;
};

function sha(value: unknown): string {
  return hashValue(value);
}

function exactTextHash(text: string): string {
  return `sha256:${sha256Hex(text)}`;
}

function readerDocument(item: Imp24ReaderCase): string {
  return completeKeyFreeReaderDocumentBytesV2(item.chapter);
}

export function compileImp24ReaderEvidenceEnvelope(item: Imp24ReaderCase): ReviewEvidenceEnvelopeV1 {
  return compileProductionReaderEnvelopeV2({
    caseId: item.caseId,
    instrumentVersion: IMP24_INSTRUMENT_VERSION,
    chapter: item.chapter,
    phase1Document: readerDocument(item),
    chapterContentSha256: item.provenance.variantContentSha256,
    readerDocumentSha256: completeKeyFreeReaderDocumentSha256V2(item.chapter),
  }).envelope;
}

export function compileImp24SourceProductionPartition(item: Imp24SourceCase): ProductionSourcePartitionV2 {
  const compiled = compileProductionResolvedSourceEnvelopeSetV2({
    caseId: item.caseId,
    instrumentVersion: IMP24_INSTRUMENT_VERSION,
    targets: [{
      targetRef: "U1",
      unit: item.evidence.sourceUsePlanUnit,
      chapterSpans: [item.evidence.chapterUnit],
    }],
    packet: item.evidence.sourcePacket,
    anchorCatalog: item.evidence.anchorCatalog,
    chapterContentSha256: item.evidence.provenanceHashes.chapterContentSha256,
    sourceUsePlanSha256: item.evidence.provenanceHashes.sourceUsePlanSha256,
    sourcePacketSha256: item.evidence.provenanceHashes.sourcePacketSha256,
    sidecarSha256: item.evidence.provenanceHashes.sidecarSha256,
  });
  if (compiled.partitions.length !== 1 || compiled.partitions[0].targetRef !== "U1") {
    throw new Imp24InstrumentCertificationError(`${item.caseId}: shared source compiler did not emit exactly U1`);
  }
  return compiled.partitions[0];
}

export function compileImp24SourceEvidenceEnvelope(item: Imp24SourceCase): ReviewEvidenceEnvelopeV1 {
  return compileImp24SourceProductionPartition(item).envelope;
}

function quizDefensibleIndices(item: Imp24QuizCase): number[] {
  return [...item.expected.defensibleAnswerIndices as number[]];
}

type Imp24CompiledQuizProductionInstrument = {
  compiled: ProductionQuizEnvelopeV2;
  committedDerivation: CommittedQuizDerivation;
  phase1Document: string;
  phase2DocumentSha256: string;
};

/** Compile qualification quiz cases through the exact production phase-1
 * commitment, envelope compiler, task renderer, and question-binding path. */
export function compileImp24QuizProductionInstrument(
  item: Imp24QuizCase,
): Imp24CompiledQuizProductionInstrument {
  const questions = item.chapter.quiz.questions;
  if (questions.length !== 1) {
    throw new Imp24InstrumentCertificationError(`${item.caseId}: quiz qualification cases must isolate exactly one question`);
  }
  const committedIndex = quizDefensibleIndices(item)[0];
  const answer = ["a", "b", "c"][committedIndex];
  if (answer === undefined || committedIndex >= questions[0].choices.length) {
    throw new Imp24InstrumentCertificationError(`${item.caseId}: frozen blind derivation index is outside the real choices`);
  }
  const phase1Document = completeKeyFreeReaderDocumentBytesV2(item.chapter);
  const derivation = buildQuizDerivation(item.chapter, {
    answers: [answer],
    mechanisms: ["The committed phase-1 judgment follows from the cited key-free chapter evidence."],
    confidence: ["high"],
    ambiguities: [item.kind === "genuine-ambiguity" ? "two-defensible-identical-choices" : ""],
  }, sha256Hex(phase1Document), `imp24-blind-derivation:${item.caseId}`);
  const committedDerivation = commitQuizDerivation(derivation, {
    documentSha256: sha256Hex(phase1Document),
    questionCount: questions.length,
    itemIds: questions.map((_question, index) => quizItemId(item.chapter, index)),
  });
  const compiled = compileProductionQuizEnvelopeV2({
    caseId: item.caseId,
    instrumentVersion: IMP24_INSTRUMENT_VERSION,
    chapter: item.chapter,
    phase1Document,
    chapterContentSha256: item.provenance.variantContentSha256,
    committedDerivation,
  });
  const phase2DocumentSha256 = sha256Hex(
    renderQuizPhase2Doc(item.chapter, committedDerivation, phase1Document),
  );
  return { compiled, committedDerivation, phase1Document, phase2DocumentSha256 };
}

export function compileImp24QuizEvidenceEnvelope(item: Imp24QuizCase): ReviewEvidenceEnvelopeV1 {
  return compileImp24QuizProductionInstrument(item).compiled.envelope;
}

export type Imp24PreparedQualificationInstrument = {
  schemaHashes: Record<Imp24ReviewRole, string>;
  promptSourceHashes: Record<Imp24ReviewRole, string>;
  preparedCases: PreparedQualificationCasesV3;
};

export function schemaPathByRole(repositoryRoot: string): Record<Imp24ReviewRole, string> {
  return {
    reader: resolve(repositoryRoot, SCHEMA_RELATIVE_PATHS[0]),
    source: resolve(repositoryRoot, SCHEMA_RELATIVE_PATHS[1]),
    quiz: resolve(repositoryRoot, SCHEMA_RELATIVE_PATHS[2]),
  };
}

export type Imp24SemanticPromptHashes = Record<Imp24ReviewRole, {
  version: string;
  sha256: string;
}>;

export const IMP24_SEMANTIC_PROMPT_HASHES: Imp24SemanticPromptHashes = Object.freeze({
  reader: Object.freeze({ version: READER_EXPERIENCE_SEMANTIC_RUBRIC_VERSION, sha256: READER_EXPERIENCE_SEMANTIC_SHA256 }),
  source: Object.freeze({ version: SOURCE_INTEGRITY_SEMANTIC_RULES_VERSION, sha256: SOURCE_INTEGRITY_SEMANTIC_SHA256 }),
  quiz: Object.freeze({ version: QUIZ_INTEGRITY_SEMANTIC_RULES_VERSION, sha256: QUIZ_INTEGRITY_SEMANTIC_SHA256 }),
});

/** Lane prompt identities bind exact inline-builder bytes and the imported
 * semantic projection. Changing a shared semantic renderer therefore stales
 * qualification evidence even when reviewModelOutputV2.ts itself is untouched. */
export function buildImp24RolePromptSourceHashes(args: {
  moduleSha256: string;
  semantic?: Imp24SemanticPromptHashes;
}): Record<Imp24ReviewRole, string> {
  const semantic = args.semantic ?? IMP24_SEMANTIC_PROMPT_HASHES;
  return {
    reader: hashCanonical({
      moduleSha256: args.moduleSha256,
      builder: "buildReaderExperienceInlineReviewTask",
      schema: READER_EXPERIENCE_MODEL_OUTPUT_V2_SCHEMA,
      semanticVersion: semantic.reader.version,
      semanticSha256: semantic.reader.sha256,
    }),
    source: hashCanonical({
      moduleSha256: args.moduleSha256,
      builder: "buildSourceIntegrityInlineReviewTask",
      schema: SOURCE_INTEGRITY_MODEL_OUTPUT_V2_SCHEMA,
      semanticVersion: semantic.source.version,
      semanticSha256: semantic.source.sha256,
    }),
    quiz: hashCanonical({
      moduleSha256: args.moduleSha256,
      builder: "buildQuizIntegrityInlineReviewTask",
      schema: QUIZ_INTEGRITY_MODEL_OUTPUT_V2_SCHEMA,
      semanticVersion: semantic.quiz.version,
      semanticSha256: semantic.quiz.sha256,
    }),
  };
}

export function rolePromptSourceHashes(repositoryRoot: string): Record<Imp24ReviewRole, string> {
  const modulePath = resolve(repositoryRoot, `${PIPELINE_REL}/src/review/reviewModelOutputV2.ts`);
  return buildImp24RolePromptSourceHashes({ moduleSha256: sha256Hex(readFileSync(modulePath)) });
}

export const IMP24_RETAINED_PROMPT_BUNDLE_REL_PATHS: Record<Imp24ReviewRole, string> = Object.freeze({
  reader: `${PIPELINE_REL}/state/migration-experiments/contracts/imp24/prompts/reader-prompt-bundle.v3-envelope.json`,
  source: `${PIPELINE_REL}/state/migration-experiments/contracts/imp24/prompts/source-prompt-bundle.v3-envelope.json`,
  quiz: `${PIPELINE_REL}/state/migration-experiments/contracts/imp24/prompts/quiz-prompt-bundle.v3-envelope.json`,
});

/** Load the per-role prompt-source hashes RETAINED by the closed V3 identity
 * from its committed prompt-bundle sidecars. After an authorized successor
 * changes the prompt recipe or bytes, historical replay must stamp these
 * retained values — re-deriving from current checkout would compare closed
 * evidence against an instrument that never ran it. When the retained
 * certification binding is supplied, the loaded set is pinned to its
 * promptBundleSha256 so a tampered sidecar fails closed. */
export function loadRetainedImp24RolePromptSourceHashes(args: {
  repositoryRoot: string;
  certification?: Pick<Imp24InstrumentCertificationBinding, "promptBundleSha256">;
}): Record<Imp24ReviewRole, string> {
  const hashes = Object.fromEntries((Object.keys(IMP24_RETAINED_PROMPT_BUNDLE_REL_PATHS) as Imp24ReviewRole[])
    .map((role) => {
      const path = resolve(args.repositoryRoot, IMP24_RETAINED_PROMPT_BUNDLE_REL_PATHS[role]);
      const sidecar = JSON.parse(readFileSync(path, "utf8")) as { role?: string; promptSourceSha256?: string };
      if (sidecar.role !== role || typeof sidecar.promptSourceSha256 !== "string"
        || !/^[a-f0-9]{64}$/.test(sidecar.promptSourceSha256)) {
        throw new Imp24InstrumentCertificationError(`retained ${role} prompt bundle sidecar is malformed: ${path}`);
      }
      return [role, sidecar.promptSourceSha256];
    })) as Record<Imp24ReviewRole, string>;
  if (args.certification !== undefined && hashCanonical(hashes) !== args.certification.promptBundleSha256) {
    throw new Imp24InstrumentCertificationError(
      "retained prompt-bundle sidecars do not reproduce the retained certification promptBundleSha256",
    );
  }
  return hashes;
}

/**
 * The sole prepared-case builder consumed by both certification and the live
 * runner.  It retains exact canonical envelope bytes and their bare SHA-256.
 */
export function prepareImp24QualificationCases(args: {
  repositoryRoot: string;
  corpusBundle: Imp24CorpusBundle;
  /** Historical-identity replay ONLY: stamp the prompt-source hashes retained
   * by a closed identity (see loadRetainedImp24RolePromptSourceHashes) instead
   * of re-deriving them from current checkout bytes. Never pass this for an
   * active-candidate certification. */
  retainedPromptSourceHashes?: Record<Imp24ReviewRole, string>;
}): Imp24PreparedQualificationInstrument {
  const schemaPaths = schemaPathByRole(args.repositoryRoot);
  const schemaHashes: Record<Imp24ReviewRole, string> = {
    reader: sha256Hex(readFileSync(schemaPaths.reader)),
    source: sha256Hex(readFileSync(schemaPaths.source)),
    quiz: sha256Hex(readFileSync(schemaPaths.quiz)),
  };
  const promptSourceHashes = args.retainedPromptSourceHashes ?? rolePromptSourceHashes(args.repositoryRoot);
  const preparedCases = {
    reader: { canary: [], holdout: [] },
    source: { canary: [], holdout: [] },
    quiz: { canary: [], holdout: [] },
  } as unknown as {
    [R in Imp24ReviewRole]: {
      canary: Array<PreparedQualificationCasesV3[R]["canary"][number]>;
      holdout: Array<PreparedQualificationCasesV3[R]["holdout"][number]>;
    };
  };

  const add = (
    role: Imp24ReviewRole,
    item: Imp24ReaderCase | Imp24SourceCase | Imp24QuizCase,
    family: string,
    envelope: ReviewEvidenceEnvelopeV1,
    task: string,
    gold: unknown,
  ): void => {
    assertTask(task, envelope, item.caseId);
    const evidenceEnvelopeBytes = serializeReviewEvidenceEnvelope(envelope);
    preparedCases[role][item.partition].push({
      role,
      partition: item.partition,
      caseId: item.caseId,
      family,
      sourceCaseSha256: item.substantiveCaseSha256,
      goldSha256: hashCanonical(gold),
      schemaSha256: schemaHashes[role],
      promptSourceSha256: promptSourceHashes[role],
      task,
      envelope,
      evidenceEnvelopeBytes,
      evidenceEnvelopeBytesSha256: sha256Hex(evidenceEnvelopeBytes),
    });
  };

  for (const partition of ["canary", "holdout"] as const) {
    for (const item of args.corpusBundle.reader[partition].cases) {
      const envelope = compileImp24ReaderEvidenceEnvelope(item);
      add("reader", item, item.kind, envelope, buildReaderExperienceInlineReviewTask(envelope), item.expected);
    }
    for (const item of args.corpusBundle.source[partition].cases) {
      const sourcePartition = compileImp24SourceProductionPartition(item);
      add(
        "source",
        item,
        item.family,
        sourcePartition.envelope,
        sourcePartition.task,
        deriveImp24SourceSemantics(item),
      );
    }
    for (const item of args.corpusBundle.quiz[partition].cases) {
      const instrument = compileImp24QuizProductionInstrument(item);
      add("quiz", item, item.kind, instrument.compiled.envelope, instrument.compiled.task, item.expected);
    }
  }
  return { schemaHashes, promptSourceHashes, preparedCases };
}

function assertTask(task: string, envelope: ReviewEvidenceEnvelopeV1, caseId: string): void {
  const issues: string[] = [];
  const exactEnvelope = serializeReviewEvidenceEnvelope(envelope);
  if (!task.includes(exactEnvelope)) issues.push(`${caseId}: task omits exact canonical envelope bytes`);
  for (const forbidden of TASK_FORBIDDEN_PATTERNS) {
    if (forbidden.pattern.test(task)) issues.push(`${caseId}: task contains forbidden ${forbidden.label}`);
  }
  if (!task.includes("Judge only the inline evidence envelope.")) issues.push(`${caseId}: task is not self-contained`);
  if (issues.length > 0) throw new Imp24InstrumentCertificationError(`${caseId}: inline task validation failed`, issues);
}

function readerScores(): Record<ReviewFactor, number> {
  return Object.fromEntries(REVIEW_FACTORS.map((factor) => [factor, 80])) as Record<ReviewFactor, number>;
}

function readerFixture(
  item: Imp24ReaderCase,
  envelope: ReviewEvidenceEnvelopeV1 = compileImp24ReaderEvidenceEnvelope(item),
): ReaderExperienceModelOutputV2 {
  const recommendation = item.expected.expectedRecommendation as "SHIP" | "REVISE" | "BLOCK";
  const hard = item.kind === "reader-visible-hard-blocker";
  const craft = item.kind === "craft-nonblocker";
  // The fixture is model-free gold, so cite every natural reader section. This
  // guarantees that the declared issue and each blind quiz mechanism are bound
  // to the complete chapter without inventing a model-specific span choice.
  const evidenceRefIds = envelope.segments.map((segment) => segment.refId);
  return {
    schema: READER_EXPERIENCE_MODEL_OUTPUT_V2_SCHEMA,
    scores: readerScores(),
    quizDerivation: {
      answers: item.chapter.quiz.questions.map((question) => (["a", "b", "c"] as const)[question.correctIndex] ?? "a"),
      mechanisms: item.chapter.quiz.questions.map(() => "The answer follows from the key-free chapter evidence."),
      confidence: item.chapter.quiz.questions.map(() => "high" as const),
      ambiguities: [],
      tells: [],
      evidenceRefIds: item.chapter.quiz.questions.map(() => [...evidenceRefIds]),
    },
    recommendation,
    blockingFindings: hard ? [{
      category: item.expected.expectedBlockingCategory as "unsafe" | "internal_contradiction" | "structurally_invalid" | "schema_or_app_breaking" | "unusable",
      unit: "chapter",
      problem: "The deterministic fixture exposes the declared reader-visible blocker.",
      evidenceRefIds: [...evidenceRefIds],
    }] : [],
    escalationSignals: [],
    advisoryFindings: craft ? [{
      category: "other_craft",
      unit: "chapter",
      problem: `The deterministic fixture exposes the declared ${String(item.expected.expectedWeakness)} craft weakness.`,
      evidenceRefIds: [...evidenceRefIds],
    }] : [],
    strongestEvidenceRefIds: [...evidenceRefIds],
    weakestEvidenceRefIds: [...evidenceRefIds],
    oneParagraphVerdict: `Model-free fixture for ${item.caseId}.`,
  };
}

function sourceFixture(item: Imp24SourceCase, envelope: ReviewEvidenceEnvelopeV1): SourceIntegrityModelOutputV2 {
  const gold = deriveImp24SourceSemantics(item);
  const primary = gold.primaryCategory;
  const chapterRef = envelope.segments.find((segment) => segment.kind === "chapter")?.refId;
  const sourceRef = envelope.segments.find((segment) => segment.kind === "source_claim")?.refId;
  const planRef = envelope.segments.find((segment) => segment.kind === "plan")?.refId;
  if (!chapterRef || !planRef) throw new Imp24InstrumentCertificationError(`${item.caseId}: shared source envelope lacks chapter/plan refs`);
  const sourceEvidenceRefIds = item.evidence.sourceUsePlanUnit.origin === "source_bound"
    ? sourceRef ? [sourceRef] : []
    : primary !== null ? [planRef] : [];
  return {
    schema: SOURCE_INTEGRITY_MODEL_OUTPUT_V2_SCHEMA,
    assessments: [{
      targetRef: "U1",
      visibleRegister: gold.visibleRegister,
      supportStatus: gold.supportStatus,
      framingAdequate: gold.framingAdequate,
      claimStrengthFit: gold.claimStrengthFit,
      namedSpecificityAllowed: gold.namedSpecificityAllowed,
      findings: primary ? [{
        primaryCategory: primary,
        secondaryCategories: gold.secondaryCategories,
        severity: "blocker",
        explanation: `The deterministic fixture exposes ${primary}.`,
        chapterEvidenceRefIds: [chapterRef],
        sourceEvidenceRefIds,
      }] : [],
      rationale: `Model-free fixture for ${item.caseId}.`,
    }],
  };
}

function quizFixture(item: Imp24QuizCase, envelope: ReviewEvidenceEnvelopeV1): QuizIntegrityModelOutputV2 {
  const evidenceRefIds = envelope.segments.map((segment) => segment.refId);
  return {
    schema: QUIZ_INTEGRITY_MODEL_OUTPUT_V2_SCHEMA,
    items: [{
      questionRef: "Q1",
      keyCorrect: item.expected.keyCorrect as "correct" | "ambiguous" | "wrong",
      defensibleAnswerIndices: quizDefensibleIndices(item),
      keyedMechanismSupported: item.expected.keyedMechanismSupported as boolean,
      rationale: `Model-free fixture for ${item.caseId}.`,
      evidenceRefIds,
    }],
  };
}

function compileReaderCase(item: Imp24ReaderCase): Imp24CompiledCaseCertification {
  const envelope = compileImp24ReaderEvidenceEnvelope(item);
  const task = buildReaderExperienceInlineReviewTask(envelope);
  assertTask(task, envelope, item.caseId);
  const fixture = readerFixture(item, envelope);
  const parsed = parseReaderExperienceModelOutputV2(canonicalJson(fixture));
  const assembled = assembleReaderExperienceReviewV2({
    output: parsed,
    envelope,
    chapterContentSha256: item.provenance.variantContentSha256,
    readerDocumentSha256: completeKeyFreeReaderDocumentSha256V2(item.chapter),
    schemaSha256: exactTextHash(READER_EXPERIENCE_MODEL_OUTPUT_V2_SCHEMA),
    rubricVersion: "reader-experience-v2-envelope",
    routeEvidence: ROUTE_FIXTURE,
  });
  const expectedOutcome = String(item.expected.expectedRecommendation);
  if (assembled.recommendation !== expectedOutcome) throw new Imp24InstrumentCertificationError(`${item.caseId}: reader fixture outcome mismatch`);
  return caseCertification(item, envelope, task, fixture, assembled, expectedOutcome, assembled.recommendation);
}

function compileSourceCase(item: Imp24SourceCase): Imp24CompiledCaseCertification {
  const partition = compileImp24SourceProductionPartition(item);
  const envelope = partition.envelope;
  const task = partition.task;
  assertTask(task, envelope, item.caseId);
  const fixture = sourceFixture(item, envelope);
  const assembled = assembleProductionSourcePartitionReviewV2({
    rawOutput: canonicalJson(fixture),
    partition,
    chapterContentSha256: item.evidence.provenanceHashes.chapterContentSha256,
    sourceUsePlanSha256: item.evidence.provenanceHashes.sourceUsePlanSha256,
    sourcePacketSha256: item.evidence.provenanceHashes.sourcePacketSha256,
    sidecarSha256: item.evidence.provenanceHashes.sidecarSha256,
    schemaSha256: exactTextHash(SOURCE_INTEGRITY_MODEL_OUTPUT_V2_SCHEMA),
    routeEvidence: ROUTE_FIXTURE,
  });
  const expectedOutcome = deriveImp24SourceSemantics(item).result;
  if (assembled.result !== expectedOutcome) {
    throw new Imp24InstrumentCertificationError(`${item.caseId}: source fixture outcome ${assembled.result} != ${expectedOutcome}`);
  }
  return caseCertification(item, envelope, task, fixture, assembled, expectedOutcome, assembled.result);
}

function compileQuizCase(item: Imp24QuizCase): Imp24CompiledCaseCertification {
  const instrument = compileImp24QuizProductionInstrument(item);
  const { compiled, committedDerivation, phase2DocumentSha256 } = instrument;
  const envelope = compiled.envelope;
  const task = compiled.task;
  assertTask(task, envelope, item.caseId);
  const fixture = quizFixture(item, envelope);
  const assembled = assembleProductionQuizReviewV2({
    rawOutput: canonicalJson(fixture),
    compiled,
    chapterContentSha256: item.provenance.variantContentSha256,
    phase2DocumentSha256,
    derivationSha256: committedDerivation.sha256,
    schemaSha256: exactTextHash(QUIZ_INTEGRITY_MODEL_OUTPUT_V2_SCHEMA),
    routeEvidence: ROUTE_FIXTURE,
  });
  const expectedOutcome = item.expected.goldResult as "PASS" | "BLOCK";
  if (assembled.result !== expectedOutcome) {
    throw new Imp24InstrumentCertificationError(`${item.caseId}: quiz fixture outcome ${assembled.result} != ${expectedOutcome}`);
  }
  return caseCertification(item, envelope, task, fixture, assembled, expectedOutcome, assembled.result);
}

function caseCertification(
  item: { role: Imp24ReviewRole; partition: "canary" | "holdout"; caseId: string; substantiveCaseSha256: string },
  envelope: ReviewEvidenceEnvelopeV1,
  task: string,
  fixture: unknown,
  assembled: unknown,
  expectedOutcome: string,
  derivedOutcome: string,
): Imp24CompiledCaseCertification {
  const envelopeBytes = serializeReviewEvidenceEnvelope(envelope);
  return {
    role: item.role,
    partition: item.partition,
    caseId: item.caseId,
    caseSha256: item.substantiveCaseSha256,
    envelopeSha256: envelope.envelopeSha256,
    envelopeBytesSha256: exactTextHash(envelopeBytes),
    taskSha256: exactTextHash(task),
    fixtureOutputSha256: sha(fixture),
    assembledReviewSha256: sha(assembled),
    expectedOutcome,
    derivedOutcome,
    protocolValid: true,
    referenceResolutionValid: true,
    taskSelfContained: true,
  };
}

export function compileEveryImp24CorpusCase(bundle: Imp24CorpusBundle): Imp24CompiledCaseCertification[] {
  const cases: Imp24CompiledCaseCertification[] = [];
  for (const item of [...bundle.reader.canary.cases, ...bundle.reader.holdout.cases]) cases.push(compileReaderCase(item));
  for (const item of [...bundle.source.canary.cases, ...bundle.source.holdout.cases]) cases.push(compileSourceCase(item));
  for (const item of [...bundle.quiz.canary.cases, ...bundle.quiz.holdout.cases]) cases.push(compileQuizCase(item));
  return cases.sort((a, b) => a.role.localeCompare(b.role) || a.caseId.localeCompare(b.caseId));
}

type AnyImp24Case = Imp24ReaderCase | Imp24SourceCase | Imp24QuizCase;

function deterministicFixtureOutput(item: AnyImp24Case): string {
  if (item.role === "reader") return canonicalJson(readerFixture(item as Imp24ReaderCase));
  const envelope = expectedEnvelopeForCase(item);
  if (item.role === "source") return canonicalJson(sourceFixture(item as Imp24SourceCase, envelope));
  return canonicalJson(quizFixture(item as Imp24QuizCase, envelope));
}

export type Imp24QualificationEvaluator = {
  evaluateOutput: QualificationOutputEvaluatorV3;
  /** Canonical strict-V2 output, keyed by the globally unique frozen case id. */
  fixtureOutputByCaseId: Readonly<Record<string, string>>;
};

export function invalidEvaluation(args: {
  envelopeBound: boolean;
  fileAccessFailure: boolean;
  prohibitedConductorEcho: boolean;
  schemaValid?: boolean;
  authorityCompliant?: boolean;
  semanticSummary: string;
  parsedOutput?: unknown | null;
  parseError?: string | null;
  assemblyError?: string | null;
  evidenceReferenceResolution?: EvidenceReferenceResolutionV3;
}): CaseEvaluationV3 {
  return {
    schemaValid: args.schemaValid ?? false,
    envelopeBound: args.envelopeBound,
    evidenceReferenceValid: false,
    authorityCompliant: args.authorityCompliant ?? false,
    complete: false,
    fileAccessFailure: args.fileAccessFailure,
    prohibitedConductorEcho: args.prohibitedConductorEcho,
    resolved: false,
    semanticCorrect: false,
    semanticSummary: args.semanticSummary,
    metricObservations: {},
    parsedOutput: args.parsedOutput ?? null,
    parseError: args.parseError ?? null,
    assembledReview: null,
    assemblyError: args.assemblyError ?? null,
    evidenceReferenceResolution: args.evidenceReferenceResolution ?? emptyReferenceResolution(),
  };
}

function errorDetail(error: unknown): EvidenceReferenceResolutionV3["error"] {
  const value = error as { name?: unknown; message?: unknown; code?: unknown; refId?: unknown } | null;
  return {
    name: typeof value?.name === "string" && value.name.length > 0 ? value.name : "Error",
    message: typeof value?.message === "string" ? value.message : String(error),
    code: typeof value?.code === "string" ? value.code : null,
    refId: typeof value?.refId === "string" ? value.refId : null,
  };
}

function emptyReferenceResolution(): EvidenceReferenceResolutionV3 {
  return {
    status: "NOT_APPLICABLE",
    bindings: [],
    unresolvedTargetRefs: [],
    unresolvedQuestionRefs: [],
    error: null,
  };
}

export function failedReferenceResolution(error: unknown): EvidenceReferenceResolutionV3 {
  return {
    status: "FAILED",
    bindings: [],
    unresolvedTargetRefs: [],
    unresolvedQuestionRefs: [],
    error: errorDetail(error),
  };
}

/** Preserve an explicit, stable projection of the resolver's conductor-owned
 * output. The assembled review remains authoritative; this projection makes
 * each ref-id -> exact inline span resolution independently inspectable. */
export function projectEvidenceReferenceResolution(assembled: unknown): EvidenceReferenceResolutionV3 {
  const bindings: EvidenceReferenceResolutionBindingV3[] = [];
  const unresolvedTargetRefs: string[] = [];
  const unresolvedQuestionRefs: string[] = [];
  const visit = (value: unknown, path: string): void => {
    if (Array.isArray(value)) {
      value.forEach((child, index) => visit(child, `${path}[${index}]`));
      return;
    }
    if (value === null || typeof value !== "object") return;
    const record = value as Record<string, unknown>;
    const capture = (refKey: string, spanKey: string): void => {
      const refs = record[refKey];
      const spans = record[spanKey];
      if (!Array.isArray(refs) || !Array.isArray(spans)) return;
      if (refs.every((item) => typeof item === "string") && spans.every((item) => typeof item === "string")) {
        bindings.push({
          path: `${path}.${refKey}`,
          refIds: [...refs] as string[],
          evidenceSpans: [...spans] as string[],
        });
        return;
      }
      if (refs.every((item) => Array.isArray(item) && item.every((ref) => typeof ref === "string"))
        && spans.every((item) => Array.isArray(item) && item.every((span) => typeof span === "string"))
        && refs.length === spans.length) {
        refs.forEach((group, index) => bindings.push({
          path: `${path}.${refKey}[${index}]`,
          refIds: [...group] as string[],
          evidenceSpans: [...(spans[index] as string[])],
        }));
      }
    };
    capture("evidenceRefIds", "evidenceSpans");
    capture("chapterEvidenceRefIds", "chapterEvidenceSpans");
    capture("sourceEvidenceRefIds", "sourceEvidenceSpans");
    capture("strongestEvidenceRefIds", "strongestEvidenceSpans");
    capture("weakestEvidenceRefIds", "weakestEvidenceSpans");
    if (Array.isArray(record.unresolvedTargetRefs)) {
      unresolvedTargetRefs.push(...record.unresolvedTargetRefs.filter((item): item is string => typeof item === "string"));
    }
    if (Array.isArray(record.unresolvedQuestionRefs)) {
      unresolvedQuestionRefs.push(...record.unresolvedQuestionRefs.filter((item): item is string => typeof item === "string"));
    }
    for (const key of Object.keys(record).sort()) visit(record[key], `${path}.${key}`);
  };
  visit(assembled, "$assembled");
  bindings.sort((left, right) => left.path.localeCompare(right.path));
  unresolvedTargetRefs.sort();
  unresolvedQuestionRefs.sort();
  return {
    status: unresolvedTargetRefs.length > 0 || unresolvedQuestionRefs.length > 0 ? "INCOMPLETE" : "RESOLVED",
    bindings,
    unresolvedTargetRefs,
    unresolvedQuestionRefs,
    error: null,
  };
}

function expectedEnvelopeForCase(item: AnyImp24Case): ReviewEvidenceEnvelopeV1 {
  if (item.role === "reader") return compileImp24ReaderEvidenceEnvelope(item as Imp24ReaderCase);
  if (item.role === "source") return compileImp24SourceEvidenceEnvelope(item as Imp24SourceCase);
  return compileImp24QuizEvidenceEnvelope(item as Imp24QuizCase);
}

/**
 * Frozen-gold V3 evaluator factory.  Protocol flags are computed independently
 * from `semanticCorrect`; canary semantics are therefore observable but cannot
 * affect the canary protocol gate.  Repository/preparation mismatches throw
 * before considering the model output.
 */
export function createImp24QualificationOutputEvaluator(
  bundle: Imp24CorpusBundle,
): QualificationOutputEvaluatorV3 {
  const byKey = new Map<string, AnyImp24Case>();
  for (const role of ["reader", "source", "quiz"] as const) {
    for (const partition of ["canary", "holdout"] as const) {
      for (const item of bundle[role][partition].cases as AnyImp24Case[]) {
        const key = `${role}|${item.caseId}`;
        if (byKey.has(key)) throw new Imp24InstrumentCertificationError(`duplicate evaluator gold case ${key}`);
        byKey.set(key, item);
      }
    }
  }
  if (byKey.size !== 116) throw new Imp24InstrumentCertificationError(`V3 evaluator requires all 116 frozen cases, got ${byKey.size}`);

  return ({ preparedCase, request, receipt, rawOutput }): CaseEvaluationV3 => {
    const item = byKey.get(`${preparedCase.role}|${preparedCase.caseId}`);
    if (!item) throw new Imp24InstrumentCertificationError(`prepared case is absent from frozen V3 corpus: ${preparedCase.role}/${preparedCase.caseId}`);
    if (preparedCase.sourceCaseSha256 !== item.substantiveCaseSha256) {
      throw new Imp24InstrumentCertificationError(`${item.caseId}: prepared source-case hash mismatch`);
    }
    const independentlyDerivedGold = item.role === "source"
      ? deriveImp24SourceSemantics(item as Imp24SourceCase)
      : item.expected;
    if (preparedCase.goldSha256 !== hashCanonical(independentlyDerivedGold)) {
      throw new Imp24InstrumentCertificationError(`${item.caseId}: prepared gold hash mismatch`);
    }
    const expectedEnvelope = expectedEnvelopeForCase(item);
    const expectedBytes = serializeReviewEvidenceEnvelope(expectedEnvelope);
    if (preparedCase.envelope.envelopeSha256 !== expectedEnvelope.envelopeSha256
      || preparedCase.evidenceEnvelopeBytes !== expectedBytes
      || preparedCase.evidenceEnvelopeBytesSha256 !== sha256Hex(expectedBytes)) {
      throw new Imp24InstrumentCertificationError(`${item.caseId}: prepared envelope differs from the certified compiler output`);
    }
    const expectedToRequestFreshness = reviewProtocolFreshnessErrorsV2({
      reviewProtocol: REVIEW_EVIDENCE_PROTOCOL_V2,
      lane: item.role,
      evidenceEnvelopeSha256: expectedEnvelope.envelopeSha256,
      evidenceEnvelopeBytesSha256: sha256Hex(expectedBytes),
      bindings: {
        caseId: item.caseId,
        evidenceEnvelopeBytesContentSha256: sha256Hex(expectedBytes),
        goldSha256: preparedCase.goldSha256,
        promptSourceSha256: preparedCase.promptSourceSha256,
        schemaSha256: preparedCase.schemaSha256,
        sourceCaseSha256: item.substantiveCaseSha256,
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
    const prohibitedEcho = reviewProtocolHasProhibitedConductorEchoV2(rawOutput, item.role);

    if (item.role === "reader") {
      const reader = item as Imp24ReaderCase;
      let parsed: ReaderExperienceModelOutputV2;
      try {
        parsed = parseReaderExperienceModelOutputV2(rawOutput);
      } catch (error) {
        return invalidEvaluation({
          envelopeBound,
          fileAccessFailure: fileFailure,
          prohibitedConductorEcho: prohibitedEcho,
          semanticSummary: (error as Error).message,
          parseError: (error as Error).message,
        });
      }
      const authorityViolations = readerAuthorityViolationsV2(parsed);
      if (authorityViolations.length > 0) {
        const first = authorityViolations[0];
        return invalidEvaluation({
          envelopeBound,
          fileAccessFailure: fileFailure,
          prohibitedConductorEcho: prohibitedEcho,
          schemaValid: true,
          authorityCompliant: false,
          semanticSummary: `reader authority violation at ${first.surface}: ${first.kind}`,
          parsedOutput: parsed,
        });
      }
      try {
        const assembled = assembleReaderExperienceReviewV2({
          output: parsed,
          envelope: expectedEnvelope,
          chapterContentSha256: reader.provenance.variantContentSha256,
          readerDocumentSha256: completeKeyFreeReaderDocumentSha256V2(reader.chapter),
          schemaSha256: preparedCase.schemaSha256,
          rubricVersion: "reader-experience-v2-envelope",
          routeEvidence: ROUTE_FIXTURE,
        });
        const blockingCategories = assembled.blockingFindings.map((finding) => finding.category);
        const result = deriveReaderDecisionCategoryV2(assembled, 80);
        const observations: Record<string, boolean> = {};
        let semanticCorrect = false;
        if (reader.kind === "reader-visible-hard-blocker") {
          const expectedCategory = String(reader.expected.expectedBlockingCategory);
          observations.hardBlockerSensitivity = result === "BLOCK" && blockingCategories.includes(expectedCategory as never);
          semanticCorrect = observations.hardBlockerSensitivity;
        } else if (reader.kind === "clean") {
          observations.hardBlockerFalsePositiveFree = blockingCategories.length === 0;
          observations.cleanControlPassRate = result === "PASS" && observations.hardBlockerFalsePositiveFree;
          semanticCorrect = observations.cleanControlPassRate;
        } else {
          observations.craftCalibrationAccuracy = result === "REVISE" && blockingCategories.length === 0;
          semanticCorrect = observations.craftCalibrationAccuracy;
        }
        const complete = assembled.quizDerivation.answers.length === reader.chapter.quiz.questions.length;
        return {
          schemaValid: true,
          envelopeBound,
          evidenceReferenceValid: true,
          authorityCompliant: !prohibitedEcho,
          complete,
          fileAccessFailure: fileFailure,
          prohibitedConductorEcho: prohibitedEcho,
          resolved: complete,
          semanticCorrect,
          semanticSummary: `${result}; blockers=${blockingCategories.join(",") || "none"}`,
          metricObservations: observations,
          parsedOutput: parsed,
          parseError: null,
          assembledReview: assembled,
          assemblyError: null,
          evidenceReferenceResolution: projectEvidenceReferenceResolution(assembled),
        };
      } catch (error) {
        return invalidEvaluation({
          envelopeBound,
          fileAccessFailure: fileFailure,
          prohibitedConductorEcho: prohibitedEcho,
          schemaValid: true,
          authorityCompliant: !prohibitedEcho,
          semanticSummary: (error as Error).message,
          parsedOutput: parsed,
          assemblyError: (error as Error).message,
          evidenceReferenceResolution: failedReferenceResolution(error),
        });
      }
    }

    if (item.role === "source") {
      const source = item as Imp24SourceCase;
      const gold = deriveImp24SourceSemantics(source);
      let parsed: SourceIntegrityModelOutputV2;
      try {
        parsed = parseSourceIntegrityModelOutputV2(rawOutput);
      } catch (error) {
        return invalidEvaluation({
          envelopeBound,
          fileAccessFailure: fileFailure,
          prohibitedConductorEcho: prohibitedEcho,
          semanticSummary: (error as Error).message,
          parseError: (error as Error).message,
        });
      }
      try {
        const partition = compileImp24SourceProductionPartition(source);
        if (partition.envelope.envelopeSha256 !== expectedEnvelope.envelopeSha256) {
          throw new Imp24InstrumentCertificationError(`${source.caseId}: evaluator production source envelope drift`);
        }
        const assembled = assembleProductionSourcePartitionReviewV2({
          rawOutput,
          partition,
          chapterContentSha256: source.evidence.provenanceHashes.chapterContentSha256,
          sourceUsePlanSha256: source.evidence.provenanceHashes.sourceUsePlanSha256,
          sourcePacketSha256: source.evidence.provenanceHashes.sourcePacketSha256,
          sidecarSha256: source.evidence.provenanceHashes.sidecarSha256,
          schemaSha256: preparedCase.schemaSha256,
          routeEvidence: ROUTE_FIXTURE,
        });
        const unit = assembled.units[0];
        const categories = unit?.findings.map((finding) => finding.primaryCategory) ?? [];
        const expectedPrimary = gold.primaryCategory;
        const observations: Record<string, boolean> = {
          supportStatusAccuracy: unit?.supportStatus === gold.supportStatus,
          visibleRegisterAccuracy: unit?.visibleRegister === gold.visibleRegister,
        };
        if (expectedPrimary === "invented_detail") observations.fabricationSensitivity = assembled.result === "BLOCK" && categories.includes(expectedPrimary);
        if (expectedPrimary === "claim_strength_overreach") observations.causalOverreachSensitivity = assembled.result === "BLOCK" && categories.includes(expectedPrimary);
        if (expectedPrimary === "source_contradiction") observations.sourceContradictionSensitivity = assembled.result === "BLOCK" && categories.includes(expectedPrimary);
        if (gold.primaryCategory === null) {
          observations.highSeverityFalsePositiveFree = assembled.result !== "BLOCK" && !unit?.findings.some((finding) => finding.severity === "blocker");
          observations.cleanCasePassRate = assembled.result === "PASS";
        }
        const complete = assembled.unresolvedTargetRefs.length === 0 && assembled.units.length === 1;
        const semanticCorrect = complete
          && assembled.result === gold.result
          && observations.supportStatusAccuracy
          && observations.visibleRegisterAccuracy
          && (expectedPrimary === null || categories.includes(expectedPrimary));
        return {
          schemaValid: true,
          envelopeBound,
          evidenceReferenceValid: true,
          authorityCompliant: !prohibitedEcho,
          complete,
          fileAccessFailure: fileFailure,
          prohibitedConductorEcho: prohibitedEcho,
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
          envelopeBound,
          fileAccessFailure: fileFailure,
          prohibitedConductorEcho: prohibitedEcho,
          schemaValid: true,
          authorityCompliant: !prohibitedEcho,
          semanticSummary: (error as Error).message,
          parsedOutput: parsed,
          assemblyError: (error as Error).message,
          evidenceReferenceResolution: failedReferenceResolution(error),
        });
      }
    }

    const quiz = item as Imp24QuizCase;
    let parsed: QuizIntegrityModelOutputV2;
    try {
      parsed = parseQuizIntegrityModelOutputV2(rawOutput);
    } catch (error) {
      return invalidEvaluation({
        envelopeBound,
        fileAccessFailure: fileFailure,
        prohibitedConductorEcho: prohibitedEcho,
        semanticSummary: (error as Error).message,
        parseError: (error as Error).message,
      });
    }
    try {
      const instrument = compileImp24QuizProductionInstrument(quiz);
      if (instrument.compiled.envelope.envelopeSha256 !== expectedEnvelope.envelopeSha256) {
        throw new Imp24InstrumentCertificationError(`${quiz.caseId}: evaluator production quiz envelope drift`);
      }
      const assembled = assembleProductionQuizReviewV2({
        rawOutput,
        compiled: instrument.compiled,
        chapterContentSha256: quiz.provenance.variantContentSha256,
        phase2DocumentSha256: instrument.phase2DocumentSha256,
        derivationSha256: instrument.committedDerivation.sha256,
        schemaSha256: preparedCase.schemaSha256,
        routeEvidence: ROUTE_FIXTURE,
      });
      const question = assembled.questions[0];
      const observations: Record<string, boolean> = {};
      if (quiz.kind === "key-mismatch") observations.wrongKeyDetection = assembled.result === "BLOCK" && question?.keyCorrect === "wrong";
      if (quiz.kind === "uniquely-correct-clean") observations.cleanUniquePassRate = assembled.result === "PASS" && question?.keyCorrect === "correct";
      if (quiz.kind === "genuine-ambiguity") observations.ambiguityDetection = assembled.result === "BLOCK" && question?.keyCorrect === "ambiguous";
      if (quiz.kind === "mechanism-causal-key") {
        observations.mechanismAccuracy = assembled.result === quiz.expected.goldResult
          && question?.keyedMechanismSupported === quiz.expected.keyedMechanismSupported;
      }
      const complete = assembled.unresolvedQuestionRefs.length === 0 && assembled.questions.length === 1;
      const semanticCorrect = complete
        && assembled.result === quiz.expected.goldResult
        && question?.keyCorrect === quiz.expected.keyCorrect
        && question?.keyedMechanismSupported === quiz.expected.keyedMechanismSupported;
      return {
        schemaValid: true,
        envelopeBound,
        evidenceReferenceValid: true,
        authorityCompliant: !prohibitedEcho,
        complete,
        fileAccessFailure: fileFailure,
        prohibitedConductorEcho: prohibitedEcho,
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
        envelopeBound,
        fileAccessFailure: fileFailure,
        prohibitedConductorEcho: prohibitedEcho,
        schemaValid: true,
        authorityCompliant: !prohibitedEcho,
        semanticSummary: (error as Error).message,
        parsedOutput: parsed,
        assemblyError: (error as Error).message,
        evidenceReferenceResolution: failedReferenceResolution(error),
      });
    }
  };
}

/**
 * Model-free evaluator kit for injected runner tests.  The fixture lookup is
 * produced by the same frozen-gold functions used by certification, so a fake
 * executor never needs to duplicate or reinterpret role gold.
 */
export function createImp24QualificationEvaluator(bundle: Imp24CorpusBundle): Imp24QualificationEvaluator {
  const fixtureOutputByCaseId: Record<string, string> = {};
  for (const role of ["reader", "source", "quiz"] as const) {
    for (const partition of ["canary", "holdout"] as const) {
      for (const item of bundle[role][partition].cases as unknown as AnyImp24Case[]) {
        if (fixtureOutputByCaseId[item.caseId] !== undefined) {
          throw new Imp24InstrumentCertificationError(`duplicate frozen fixture case id ${item.caseId}`);
        }
        fixtureOutputByCaseId[item.caseId] = deterministicFixtureOutput(item);
      }
    }
  }
  if (Object.keys(fixtureOutputByCaseId).length !== 116) {
    throw new Imp24InstrumentCertificationError(
      `V3 fixture evaluator requires all 116 frozen cases, got ${Object.keys(fixtureOutputByCaseId).length}`,
    );
  }
  return {
    evaluateOutput: createImp24QualificationOutputEvaluator(bundle),
    fixtureOutputByCaseId: Object.freeze(fixtureOutputByCaseId),
  };
}

export function certifyImp24SourceMissingEvidence(bundle: Imp24CorpusBundle): true {
  const item = [...bundle.source.canary.cases, ...bundle.source.holdout.cases]
    .find((candidate) => candidate.evidence.expectedOrigin === "source_bound");
  if (!item) throw new Imp24InstrumentCertificationError("no source-bound case exists for missing-evidence certification");
  const partition = compileImp24SourceProductionPartition(item);
  const envelope = partition.envelope;
  const chapterRef = partition.targetChapterEvidenceRefIds[0];
  if (!chapterRef) throw new Imp24InstrumentCertificationError("missing-evidence source probe lacks chapter evidence");
  const output: SourceIntegrityModelOutputV2 = {
    schema: SOURCE_INTEGRITY_MODEL_OUTPUT_V2_SCHEMA,
    assessments: [{
      targetRef: "U1",
      visibleRegister: "ambiguous",
      supportStatus: "INCONCLUSIVE",
      framingAdequate: null,
      claimStrengthFit: null,
      namedSpecificityAllowed: null,
      findings: [{
        primaryCategory: "missing_required_evidence",
        secondaryCategories: [],
        severity: "blocker",
        explanation: "Required source evidence is unavailable.",
        chapterEvidenceRefIds: [chapterRef],
        sourceEvidenceRefIds: [],
      }],
      rationale: "Fail closed without inventing support.",
    }],
  };
  const assembled = assembleProductionSourcePartitionReviewV2({
    rawOutput: canonicalJson(output),
    partition,
    chapterContentSha256: item.evidence.provenanceHashes.chapterContentSha256,
    sourceUsePlanSha256: item.evidence.provenanceHashes.sourceUsePlanSha256,
    sourcePacketSha256: item.evidence.provenanceHashes.sourcePacketSha256,
    sidecarSha256: item.evidence.provenanceHashes.sidecarSha256,
    schemaSha256: exactTextHash(SOURCE_INTEGRITY_MODEL_OUTPUT_V2_SCHEMA),
    routeEvidence: ROUTE_FIXTURE,
  });
  if (assembled.result !== "INCONCLUSIVE") {
    throw new Imp24InstrumentCertificationError(`missing source evidence derived ${assembled.result}, expected INCONCLUSIVE`);
  }
  return true;
}

export type Imp24FreshnessCandidate = {
  experimentId?: string;
  evidenceEnvelopeSha256?: string;
  certificationSha256?: string;
  corpusBundleSha256?: string;
};

export function imp24FreshnessCandidateMatchesBinding(
  candidate: Imp24FreshnessCandidate,
  binding: Imp24InstrumentCertificationBinding,
): boolean {
  return candidate.experimentId === IMP24_ROLE_QUALIFICATION_ID
    && candidate.evidenceEnvelopeSha256 !== undefined
    && /^[a-f0-9]{64}$/.test(candidate.evidenceEnvelopeSha256)
    && candidate.certificationSha256 === binding.certificationSha256
    && candidate.corpusBundleSha256 === binding.corpusBundleSha256;
}

type FileHashSet = {
  files: Array<{ relativePath: string; bytesSha256: string; bytes: number }>;
  setSha256: string;
};

function hashFileSet(repositoryRoot: string, relativePaths: readonly string[]): FileHashSet {
  const files = [...relativePaths].sort().map((relativePath) => {
    const path = resolve(repositoryRoot, relativePath);
    if (!existsSync(path)) throw new Imp24InstrumentCertificationError(`required certification input is missing: ${relativePath}`);
    const bytes = readFileSync(path);
    return { relativePath, bytesSha256: sha256Hex(bytes), bytes: bytes.length };
  });
  return { files, setSha256: hashCanonical(files) };
}

function requireThresholds(path: string): { value: Record<string, unknown>; bytesSha256: string; semanticSha256: string } {
  if (!existsSync(path)) throw new Imp24InstrumentCertificationError(`V3 threshold artifact is missing: ${path}`);
  const bytes = readFileSync(path);
  let value: Record<string, unknown>;
  try {
    value = JSON.parse(bytes.toString("utf8")) as Record<string, unknown>;
  } catch (error) {
    throw new Imp24InstrumentCertificationError("V3 threshold artifact is not JSON", [(error as Error).message]);
  }
  if (hashCanonical(value) !== hashCanonical(IMP24_FROZEN_ROLE_THRESHOLDS)) {
    throw new Imp24InstrumentCertificationError(
      "V3 threshold artifact differs from the owner-frozen IMP-24 thresholds",
      [`expected=${hashCanonical(IMP24_FROZEN_ROLE_THRESHOLDS)}`, `actual=${hashCanonical(value)}`],
    );
  }
  const expectedDenominators = { reader: 30, source: 40, quiz: 40 } as const;
  const issues: string[] = [];
  for (const role of ["reader", "source", "quiz"] as const) {
    const lane = value[role] as Record<string, unknown> | undefined;
    const referenceValidity = lane?.evidenceSpanValidity as Record<string, unknown> | undefined;
    const resolved = lane?.requiredCasesResolved as Record<string, unknown> | undefined;
    if (referenceValidity?.minRate !== 1
      || referenceValidity?.minDenominator !== expectedDenominators[role]
      || referenceValidity?.zeroMiss !== true) {
      issues.push(`${role}: evidence/reference validity must be 1.0, denominator ${expectedDenominators[role]}, zeroMiss=true`);
    }
    if (resolved?.minRate !== 1 || resolved?.minDenominator !== expectedDenominators[role] || resolved?.zeroMiss !== true) {
      issues.push(`${role}: requiredCasesResolved must be 1.0, denominator ${expectedDenominators[role]}, zeroMiss=true`);
    }
  }
  if (issues.length > 0) throw new Imp24InstrumentCertificationError("V3 thresholds violate IMP-24 floors", issues);
  return { value, bytesSha256: sha256Hex(bytes), semanticSha256: hashCanonical(value) };
}

function certificationBindingCore(binding: Imp24InstrumentCertificationBinding): Omit<Imp24InstrumentCertificationBinding, "certificationSha256"> {
  const { certificationSha256: _ignored, ...core } = binding;
  return core;
}

export function validateImp24InstrumentCertificationBinding(
  binding: Imp24InstrumentCertificationBinding,
): string[] {
  const errors: string[] = [];
  if (binding.schema !== IMP24_INSTRUMENT_CERTIFICATION_BINDING_SCHEMA) errors.push("wrong certification binding schema");
  if (binding.status !== IMP24_INSTRUMENT_CERTIFICATION_STATUS) errors.push("certification status is not CERTIFIED_MODEL_FREE");
  if (binding.experimentId !== IMP24_ROLE_QUALIFICATION_ID) errors.push("certification belongs to another experiment");
  if (binding.sourceMissingEvidenceInconclusiveCertified !== true) {
    errors.push("missing-source-evidence INCONCLUSIVE probe is not certified");
  }
  if (binding.independentAuditPasses !== 2) errors.push("exactly two independent corpus audit passes are required");
  if (binding.modelCalls !== 0 || binding.apiCalls !== 0) errors.push("certification must be model/API free");
  const bareHashFields = [
    "productionInstrumentSealSha256", "corpusCertificationSha256", "envelopeContractSha256",
    "envelopeCompilerSha256", "modelOutputContractsSha256", "productionQualificationParitySha256",
    "scorerSha256", "promptBundleSha256",
    "schemaBundleSha256", "thresholdsSha256", "legacyEvidenceClosureSha256", "certificationSha256",
  ] as const;
  for (const field of bareHashFields) {
    if (!/^[a-f0-9]{64}$/.test(binding[field])) errors.push(`${field} is not a bare lowercase SHA-256`);
  }
  if (!/^sha256:[a-f0-9]{64}$/.test(binding.corpusBundleSha256)) errors.push("corpusBundleSha256 is not the self-hashed corpus identity");
  if (instrumentCertificationBindingSha256(certificationBindingCore(binding)) !== binding.certificationSha256) {
    errors.push("certification self hash mismatch");
  }
  return errors;
}

function expectedCaseCounts(cases: Imp24CompiledCaseCertification[]): { reader: number; source: number; quiz: number; total: number } {
  const counts = {
    reader: cases.filter((item) => item.role === "reader").length,
    source: cases.filter((item) => item.role === "source").length,
    quiz: cases.filter((item) => item.role === "quiz").length,
    total: cases.length,
  };
  if (counts.reader !== 32 || counts.source !== 42 || counts.quiz !== 42 || counts.total !== 116) {
    throw new Imp24InstrumentCertificationError("certification did not compile the complete 116-case inventory", [canonicalJson(counts)]);
  }
  return counts;
}

function certifyRetainedImp24Corpora(args: {
  bundle: Imp24CorpusBundle;
  corpusBundlePath: string;
  contractsDir: string;
}): Imp24CorpusCertification {
  const expectedBytes = serializeImp24CorpusBundle(args.bundle);
  let retainedBytes: Buffer;
  try {
    retainedBytes = readFileSync(args.corpusBundlePath);
  } catch (error) {
    throw new Imp24InstrumentCertificationError("retained V3 corpus bundle is required before certification", [
      (error as Error).message,
    ]);
  }
  if (retainedBytes.toString("utf8") !== expectedBytes) {
    throw new Imp24InstrumentCertificationError("retained V3 corpus bytes differ from the freshly rebuilt frozen corpus", [
      `expected=${sha256Hex(expectedBytes)}`,
      `retained=${sha256Hex(retainedBytes)}`,
    ]);
  }
  const passA = auditImp24CorpusPassA(args.bundle);
  const passB = auditImp24CorpusRetainedArtifactPassB({
    corpusBundlePath: args.corpusBundlePath,
    contractsDir: args.contractsDir,
  });
  if (passA.status !== "PASS" || passB.status !== "PASS") {
    throw new Imp24InstrumentCertificationError("IMP-24 retained corpus audit failed", [
      ...passA.issues,
      ...passB.issues,
    ]);
  }
  if (passA.agreementProjectionSha256 !== passB.agreementProjectionSha256) {
    throw new Imp24InstrumentCertificationError("independent retained IMP-24 corpus audits disagree", [
      `passA=${passA.agreementProjectionSha256}`,
      `passB=${passB.agreementProjectionSha256}`,
    ]);
  }
  return {
    schema: "imp24-corpus-certification-v1",
    status: "PASS",
    experimentId: IMP24_ROLE_QUALIFICATION_ID,
    passA,
    passB,
    agreementSha256: passA.agreementProjectionSha256,
  };
}

export function certifyImp24Instrument(options: Imp24CertificationOptions): {
  report: Imp24InstrumentCertificationReport;
  corpusBundle: Imp24CorpusBundle;
  prepared: Imp24PreparedQualificationInstrument;
  productionQualificationParity: Imp24ProductionQualificationParity;
} {
  const repositoryRoot = resolve(options.repositoryRoot);
  const pipelineRoot = resolve(options.pipelineRoot ?? resolve(repositoryRoot, PIPELINE_REL));
  const contractsDir = resolve(options.contractsDir ?? resolve(pipelineRoot, "state/migration-experiments/contracts"));
  const corpusBundlePath = resolve(options.corpusBundlePath
    ?? resolve(repositoryRoot, IMP24_CERTIFICATION_ARTIFACT_PATHS.corpusBundle));
  const thresholdsPath = resolve(options.thresholdsPath ?? resolve(repositoryRoot, IMP24_CERTIFICATION_ARTIFACT_PATHS.thresholds));
  const productionSealPath = resolve(options.productionSealPath
    ?? resolve(repositoryRoot, IMP24_FORWARD_PRODUCTION_INSTRUMENT_SEAL_ARTIFACT_REL_PATH));

  const corpusBundle = buildImp24CorpusBundle(loadImp24FrozenV2Inputs(contractsDir));
  const corpusAudit = certifyRetainedImp24Corpora({ corpusBundlePath, contractsDir, bundle: corpusBundle });
  const legacyClosure = assertImp24LegacyEvidencePreservation(repositoryRoot);
  const prepared = prepareImp24QualificationCases({ repositoryRoot, corpusBundle });
  const cases = compileEveryImp24CorpusCase(corpusBundle);
  const counts = expectedCaseCounts(cases);
  certifyImp24SourceMissingEvidence(corpusBundle);

  const productionSeal = verifyRetainedForwardProductionInstrumentSeal({
    repositoryRoot,
    outputPath: productionSealPath,
  });
  const thresholds = requireThresholds(thresholdsPath);
  const schemas = hashFileSet(repositoryRoot, SCHEMA_RELATIVE_PATHS);
  const implementation = hashFileSet(repositoryRoot, SHARED_IMPLEMENTATION_RELATIVE_PATHS);
  const envelopeContractSha256 = sha256Hex(readFileSync(resolve(
    repositoryRoot, `${PIPELINE_REL}/src/contracts/reviewEvidenceEnvelope.ts`,
  )));
  const envelopeCompilerSha256 = sha256Hex(readFileSync(resolve(
    repositoryRoot, `${PIPELINE_REL}/src/review/reviewEvidenceEnvelope.ts`,
  )));
  const modelOutputContractsSha256 = hashCanonical({
    contractBytesSha256: sha256Hex(readFileSync(resolve(
      repositoryRoot, `${PIPELINE_REL}/src/contracts/reviewModelOutputV2.ts`,
    ))),
    schemaSetSha256: schemas.setSha256,
  });
  const scorerImplementationSha256 = hashCanonical({
    assemblerBytesSha256: sha256Hex(readFileSync(resolve(
      repositoryRoot, `${PIPELINE_REL}/src/review/reviewModelOutputV2.ts`,
    ))),
    qualificationRunnerBytesSha256: sha256Hex(readFileSync(resolve(
      repositoryRoot, IMP24_CERTIFICATION_ARTIFACT_PATHS.qualificationRunner,
    ))),
    categoryPrecedence: SOURCE_PRIMARY_CATEGORY_PRECEDENCE_V2,
  });
  const productionQualificationParity = buildImp24ProductionQualificationParity({ repositoryRoot });
  const paritySha256 = productionQualificationParity.paritySha256;
  const scorerSha256 = hashCanonical({
    scorerImplementationSha256,
    productionQualificationParitySha256: paritySha256,
  });
  const promptBundleSha256 = hashCanonical(prepared.promptSourceHashes);
  const schemaBundleSha256 = hashCanonical(prepared.schemaHashes);
  const frozenSchedule = buildFrozenRoleQualificationScheduleV3(prepared.preparedCases);
  const preparedCasesSha256 = hashCanonical(projectPreparedQualificationCasesV3(prepared.preparedCases));

  const bindingCore: Omit<Imp24InstrumentCertificationBinding, "certificationSha256"> = {
    schema: IMP24_INSTRUMENT_CERTIFICATION_BINDING_SCHEMA,
    status: IMP24_INSTRUMENT_CERTIFICATION_STATUS,
    sourceMissingEvidenceInconclusiveCertified: true,
    experimentId: IMP24_ROLE_QUALIFICATION_ID,
    corpusCertificationSha256: hashCanonical(corpusAudit),
    corpusBundleSha256: corpusBundle.substantiveBundleSha256,
    productionInstrumentSealSha256: productionSeal.sealSha256,
    envelopeContractSha256,
    envelopeCompilerSha256,
    modelOutputContractsSha256,
    productionQualificationParitySha256: paritySha256,
    scorerSha256,
    promptBundleSha256,
    schemaBundleSha256,
    thresholdsSha256: thresholds.semanticSha256,
    legacyEvidenceClosureSha256: hashCanonical(legacyClosure),
    independentAuditPasses: 2,
    modelCalls: 0,
    apiCalls: 0,
  };
  const binding: Imp24InstrumentCertificationBinding = {
    ...bindingCore,
    certificationSha256: instrumentCertificationBindingSha256(bindingCore),
  };
  const bindingErrors = validateImp24InstrumentCertificationBinding(binding);
  if (bindingErrors.length > 0) throw new Imp24InstrumentCertificationError("instrument certification binding is invalid", bindingErrors);
  for (const legacyExperimentId of ["s16-forward-role-qualification-v1", "s16-forward-role-qualification-v2"]) {
    if (imp24FreshnessCandidateMatchesBinding({
      experimentId: legacyExperimentId,
      evidenceEnvelopeSha256: "0".repeat(64),
      certificationSha256: binding.certificationSha256,
      corpusBundleSha256: binding.corpusBundleSha256,
    }, binding)) throw new Imp24InstrumentCertificationError(`${legacyExperimentId} incorrectly satisfies V3 freshness`);
  }

  const report: Imp24InstrumentCertificationReport = {
    schema: IMP24_INSTRUMENT_CERTIFICATION_SCHEMA,
    status: IMP24_INSTRUMENT_CERTIFICATION_STATUS,
    experimentId: IMP24_ROLE_QUALIFICATION_ID,
    binding,
    corpusAudit,
    legacyClosure,
    productionSeal: {
      sealSha256: productionSeal.sealSha256,
      artifactBytesSha256: productionSeal.artifactBytesSha256,
      fileCount: productionSeal.fileCount,
      verified: true,
    },
    productionQualificationParity: {
      paritySha256,
      artifactBytesSha256: sha256Hex(serializeImp24ProductionQualificationParity(productionQualificationParity)),
      sourceCount: productionQualificationParity.implementationSources.length,
      verified: true,
    },
    frozenInputHashes: {
      corpusPartitions: {
        reader: {
          canary: corpusBundle.reader.canary.substantivePartitionSha256,
          holdout: corpusBundle.reader.holdout.substantivePartitionSha256,
        },
        source: {
          canary: corpusBundle.source.canary.substantivePartitionSha256,
          holdout: corpusBundle.source.holdout.substantivePartitionSha256,
        },
        quiz: {
          canary: corpusBundle.quiz.canary.substantivePartitionSha256,
          holdout: corpusBundle.quiz.holdout.substantivePartitionSha256,
        },
      },
      candidateOrderSha256: IMP24_ROLE_CANDIDATE_ORDER_SHA256,
      preparedCasesSha256,
      scheduleSha256: hashCanonical(frozenSchedule),
      callBudgetSha256: IMP24_ROLE_QUALIFICATION_CALL_BUDGET_SHA256,
      callBudget: IMP24_ROLE_QUALIFICATION_CALL_BUDGET_V3,
      productionQualificationParitySha256: paritySha256,
      implementationSetSha256: implementation.setSha256,
      implementationSources: implementation.files,
    },
    limitations: [
      "Model-free certification does not qualify any live model profile.",
      "Certification authorizes no publication, promotion, deployment, upload, merge, force-push, API call, or provider fallback.",
      "Candidate availability and the exact live route must be frozen and verified again before the first canary.",
    ],
    exactCaseCounts: counts,
    cases,
    checks: {
      allEnvelopesInlineAndHashValid: true,
      allTasksSelfContained: true,
      allFixtureOutputsStrictV2: true,
      allConductorAssembliesValid: true,
      allEvidenceReferencesResolved: true,
      sourceMissingEvidenceIsInconclusive: true,
      oldV1V2FreshnessRejected: true,
      productionQualificationSharedImplementation: true,
      exactProductionSealVerified: true,
      twoIndependentCorpusAuditsAgree: true,
    },
    modelCalls: 0,
    apiCalls: 0,
  };
  return { report, corpusBundle, prepared, productionQualificationParity };
}

function certificationMarkdown(report: Imp24InstrumentCertificationReport): string {
  return [
    "# IMP-24 Instrument Certification",
    "",
    `Status: **${report.status}**`,
    "",
    `Experiment: \`${report.experimentId}\``,
    `Certification binding: \`${report.binding.certificationSha256}\``,
    `Production instrument seal: \`${report.binding.productionInstrumentSealSha256}\``,
    `Production/qualification parity: \`${report.binding.productionQualificationParitySha256}\``,
    `Corpus bundle: \`${report.binding.corpusBundleSha256}\``,
    `Corpus audit agreement: \`${report.corpusAudit.agreementSha256}\``,
    "",
    "## Model-free checks",
    "",
    `- Compiled cases: ${report.exactCaseCounts.total} (reader ${report.exactCaseCounts.reader}, source ${report.exactCaseCounts.source}, quiz ${report.exactCaseCounts.quiz}).`,
    "- Canary cases are separate from the 30/40/40 holdouts.",
    "- Every exact envelope is inline, hash-valid, and reference-resolvable.",
    "- Every deterministic fixture passes strict V2 parsing and conductor assembly.",
    "- Missing required source evidence deterministically yields INCONCLUSIVE.",
    "- V1 and V2 evidence is preserved, closed, and cannot satisfy V3 freshness.",
    "- Production and qualification bind the same shared envelope compiler and V2 assemblers.",
    `- Frozen candidate order: \`${report.frozenInputHashes.candidateOrderSha256}\`.`,
    `- Frozen 464-entry schedule: \`${report.frozenInputHashes.scheduleSha256}\`.`,
    `- Frozen 464/928 call budget: \`${report.frozenInputHashes.callBudgetSha256}\`.`,
    "- Model calls: 0. API calls: 0.",
    "",
    "This certificate authorizes no live call by itself. The exact implementation must still be committed, pushed, and pass the dedicated V25 CI gate before the first V3 canary.",
    "",
  ].join("\n");
}

function resolveOutputPath(
  repositoryRoot: string,
  overrides: Imp24CertificationMaterializationOptions["outputPaths"],
  key: "corpusBundle" | "certificationBinding" | "legacyClosure" | "productionQualificationParity" | "reportJson" | "reportMarkdown",
): string {
  return resolve(overrides?.[key] ?? resolve(repositoryRoot, IMP24_CERTIFICATION_ARTIFACT_PATHS[key]));
}

/** Validate everything first, then atomically replace each deterministic artifact. */
export function materializeImp24InstrumentCertification(
  options: Imp24CertificationMaterializationOptions,
): Imp24CertificationMaterializationResult {
  const repositoryRoot = resolve(options.repositoryRoot);
  const corpusBundlePath = resolveOutputPath(repositoryRoot, options.outputPaths, "corpusBundle");
  const pipelineRoot = resolve(options.pipelineRoot ?? resolve(repositoryRoot, PIPELINE_REL));
  const contractsDir = resolve(options.contractsDir ?? resolve(pipelineRoot, "state/migration-experiments/contracts"));
  const stagedCorpusBundle = buildImp24CorpusBundle(loadImp24FrozenV2Inputs(contractsDir));
  const stagedCorpusBytes = serializeImp24CorpusBundle(stagedCorpusBundle);
  writeFileAtomic(corpusBundlePath, stagedCorpusBytes);
  if (readFileSync(corpusBundlePath, "utf8") !== stagedCorpusBytes) {
    throw new Imp24InstrumentCertificationError("corpusBundle atomic read-back drift before retained Pass B");
  }
  const certified = certifyImp24Instrument({ ...options, corpusBundlePath });
  const paths = {
    corpusBundle: corpusBundlePath,
    certificationBinding: resolveOutputPath(repositoryRoot, options.outputPaths, "certificationBinding"),
    legacyClosure: resolveOutputPath(repositoryRoot, options.outputPaths, "legacyClosure"),
    productionQualificationParity: resolveOutputPath(repositoryRoot, options.outputPaths, "productionQualificationParity"),
    reportJson: resolveOutputPath(repositoryRoot, options.outputPaths, "reportJson"),
    reportMarkdown: resolveOutputPath(repositoryRoot, options.outputPaths, "reportMarkdown"),
  };
  const bytes = {
    corpusBundle: serializeImp24CorpusBundle(certified.corpusBundle),
    certificationBinding: canonicalPretty(certified.report.binding),
    legacyClosure: canonicalPretty(certified.report.legacyClosure),
    productionQualificationParity: serializeImp24ProductionQualificationParity(certified.productionQualificationParity),
    reportJson: canonicalPretty(certified.report),
    reportMarkdown: certificationMarkdown(certified.report),
  };
  for (const key of Object.keys(paths) as Array<keyof typeof paths>) writeFileAtomic(paths[key], bytes[key]);
  const outputs = Object.fromEntries((Object.keys(paths) as Array<keyof typeof paths>).map((key) => {
    const retained = readFileSync(paths[key]);
    if (retained.toString("utf8") !== bytes[key]) throw new Imp24InstrumentCertificationError(`${key} atomic read-back drift`);
    return [key, {
      relativePath: relative(repositoryRoot, paths[key]),
      bytesSha256: sha256Hex(retained),
      bytes: retained.length,
    }];
  })) as Imp24CertificationMaterializationResult["outputs"];
  return {
    schema: "imp24-instrument-certification-materialization-v1",
    status: IMP24_INSTRUMENT_CERTIFICATION_STATUS,
    binding: certified.report.binding,
    outputs,
    modelCalls: 0,
    apiCalls: 0,
  };
}
