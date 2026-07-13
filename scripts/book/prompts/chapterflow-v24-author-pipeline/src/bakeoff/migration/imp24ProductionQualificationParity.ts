/**
 * IMP-24 production/qualification parity evidence.
 *
 * This module is deliberately model-free. `build` reads and hashes the fixed
 * implementation inventory and proves that the production and qualification
 * entrypoints call the same Review Evidence Envelope v1 compiler, renderer,
 * parser, resolver, assembly, lane-status, freshness, and raw-output protocol
 * functions. Only the explicit `materialize` function writes the canonical
 * self-hashed artifact.
 */

import { existsSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";

import { canonicalJson, hashCanonical, sha256Hex } from "../../contracts/contractUtil.js";
import { writeFileAtomic } from "../../lib/atomicWrite.js";
import { canonicalPretty } from "./corpusBuilderCore.js";

export const IMP24_PRODUCTION_QUALIFICATION_PARITY_SCHEMA =
  "imp24-production-qualification-parity-v1" as const;
export const IMP24_PRODUCTION_QUALIFICATION_PARITY_STATUS =
  "VERIFIED_SHARED_IMPLEMENTATION" as const;
export const IMP24_PRODUCTION_QUALIFICATION_PARITY_ARTIFACT_REL_PATH =
  "scripts/book/prompts/chapterflow-v24-author-pipeline/state/migration-experiments/contracts/imp24/production-qualification-parity.json" as const;
export const IMP24_PRODUCTION_QUALIFICATION_PARITY_PROTOCOL =
  "review-evidence-envelope-v1" as const;

const PIPELINE_REL = "scripts/book/prompts/chapterflow-v24-author-pipeline";
const SRC_REL = `${PIPELINE_REL}/src`;
const SHA256 = /^[a-f0-9]{64}$/;

const SOURCE = Object.freeze({
  conductor: `${SRC_REL}/orchestrator/forwardChapterConductor.ts`,
  productionReview: `${SRC_REL}/review/forwardProductionReviewV2.ts`,
  modelOutput: `${SRC_REL}/review/reviewModelOutputV2.ts`,
  resolver: `${SRC_REL}/review/evidenceReferenceResolver.ts`,
  protocol: `${SRC_REL}/review/reviewProtocolV2.ts`,
  certification: `${SRC_REL}/bakeoff/migration/imp24InstrumentCertification.ts`,
  qualificationRunner: `${SRC_REL}/bakeoff/migration/roleQualificationRunnerV3.ts`,
  qualificationLive: `${SRC_REL}/orchestrator/forwardRoleQualificationLiveV3.ts`,
  qualificationCampaign: `${SRC_REL}/orchestrator/forwardRoleQualificationCampaignV3.ts`,
} as const);

export type Imp24ParityLane = "reader" | "source" | "quiz";

export type Imp24ParitySymbolReference = {
  relativePath: string;
  symbol: string;
};

export type Imp24ParityExecutionPath = {
  entrypoint: Imp24ParitySymbolReference;
  /** Ordered outer-to-inner execution chain. Repeated symbols are omitted. */
  callChain: Imp24ParitySymbolReference[];
};

export type Imp24ParitySharedSymbols = {
  compiler: Imp24ParitySymbolReference;
  renderer: Imp24ParitySymbolReference;
  parser: Imp24ParitySymbolReference;
  resolver: Imp24ParitySymbolReference[];
  assembly: Imp24ParitySymbolReference;
  laneStatus: Imp24ParitySymbolReference;
  freshness: Imp24ParitySymbolReference;
  rawProtocol: Imp24ParitySymbolReference[];
};

export type Imp24ProductionQualificationParityLane = {
  production: Imp24ParityExecutionPath;
  qualification: Imp24ParityExecutionPath;
  shared: Imp24ParitySharedSymbols;
};

export type Imp24ProductionQualificationParityCore = {
  schema: typeof IMP24_PRODUCTION_QUALIFICATION_PARITY_SCHEMA;
  status: typeof IMP24_PRODUCTION_QUALIFICATION_PARITY_STATUS;
  artifactPath: typeof IMP24_PRODUCTION_QUALIFICATION_PARITY_ARTIFACT_REL_PATH;
  protocol: typeof IMP24_PRODUCTION_QUALIFICATION_PARITY_PROTOCOL;
  lanes: Record<Imp24ParityLane, Imp24ProductionQualificationParityLane>;
  implementationSources: Array<{ relativePath: string; bytesSha256: string }>;
  modelCalls: 0;
  apiCalls: 0;
};

export type Imp24ProductionQualificationParity = Imp24ProductionQualificationParityCore & {
  /** Bare lowercase SHA-256 of the canonical core above (self field excluded). */
  paritySha256: string;
};

export type Imp24ProductionQualificationParityMaterialization = {
  artifact: Imp24ProductionQualificationParity;
  relativePath: typeof IMP24_PRODUCTION_QUALIFICATION_PARITY_ARTIFACT_REL_PATH;
  absolutePath: string;
  bytesSha256: string;
  bytes: number;
};

export class Imp24ProductionQualificationParityError extends Error {
  constructor(message: string, readonly issues: readonly string[] = []) {
    super(issues.length === 0 ? message : `${message}: ${issues.join("; ")}`);
    this.name = "Imp24ProductionQualificationParityError";
  }
}

const ref = (relativePath: string, symbol: string): Imp24ParitySymbolReference => ({
  relativePath,
  symbol,
});

const productionEntrypoint = ref(SOURCE.conductor, "runForwardChapterConductor");
const qualificationEntrypoint = ref(SOURCE.qualificationCampaign, "runImp24RoleQualificationCampaignV3");
const qualificationPrefix = [
  qualificationEntrypoint,
  ref(SOURCE.qualificationLive, "prepareLiveRoleQualificationV3"),
  ref(SOURCE.certification, "prepareImp24QualificationCases"),
] as const;
const qualificationExecution = [
  ref(SOURCE.qualificationRunner, "runRoleQualificationV3"),
  ref(SOURCE.certification, "createImp24QualificationOutputEvaluator"),
] as const;
const sharedFreshness = ref(SOURCE.protocol, "reviewProtocolFreshnessErrorsV2");
const sharedRawProtocol = [
  ref(SOURCE.protocol, "reviewProtocolFileAccessFailureV2"),
  ref(SOURCE.protocol, "reviewProtocolHasProhibitedConductorEchoV2"),
];

const PARITY_LANES: Record<Imp24ParityLane, Imp24ProductionQualificationParityLane> = {
  reader: {
    production: {
      entrypoint: productionEntrypoint,
      callChain: [
        productionEntrypoint,
        ref(SOURCE.productionReview, "compileProductionReaderEnvelopeV2"),
        ref(SOURCE.modelOutput, "buildReaderExperienceInlineReviewTask"),
        ref(SOURCE.modelOutput, "parseReaderExperienceModelOutputV2"),
        ref(SOURCE.modelOutput, "assembleReaderExperienceReviewV2"),
        ref(SOURCE.resolver, "resolveEvidenceRefGroups"),
        ref(SOURCE.resolver, "resolveEvidenceRefIds"),
        ref(SOURCE.protocol, "deriveReaderDecisionCategoryV2"),
        ref(SOURCE.productionReview, "productionReviewV2FreshnessErrors"),
        sharedFreshness,
        ...sharedRawProtocol,
      ],
    },
    qualification: {
      entrypoint: qualificationEntrypoint,
      callChain: [
        ...qualificationPrefix,
        ref(SOURCE.certification, "compileImp24ReaderEvidenceEnvelope"),
        ref(SOURCE.productionReview, "compileProductionReaderEnvelopeV2"),
        ref(SOURCE.modelOutput, "buildReaderExperienceInlineReviewTask"),
        ...qualificationExecution,
        ref(SOURCE.modelOutput, "parseReaderExperienceModelOutputV2"),
        ref(SOURCE.modelOutput, "assembleReaderExperienceReviewV2"),
        ref(SOURCE.resolver, "resolveEvidenceRefGroups"),
        ref(SOURCE.resolver, "resolveEvidenceRefIds"),
        ref(SOURCE.protocol, "deriveReaderDecisionCategoryV2"),
        sharedFreshness,
        ...sharedRawProtocol,
      ],
    },
    shared: {
      compiler: ref(SOURCE.productionReview, "compileProductionReaderEnvelopeV2"),
      renderer: ref(SOURCE.modelOutput, "buildReaderExperienceInlineReviewTask"),
      parser: ref(SOURCE.modelOutput, "parseReaderExperienceModelOutputV2"),
      resolver: [
        ref(SOURCE.resolver, "resolveEvidenceRefGroups"),
        ref(SOURCE.resolver, "resolveEvidenceRefIds"),
      ],
      assembly: ref(SOURCE.modelOutput, "assembleReaderExperienceReviewV2"),
      laneStatus: ref(SOURCE.protocol, "deriveReaderDecisionCategoryV2"),
      freshness: sharedFreshness,
      rawProtocol: sharedRawProtocol,
    },
  },
  source: {
    production: {
      entrypoint: productionEntrypoint,
      callChain: [
        productionEntrypoint,
        ref(SOURCE.productionReview, "compileProductionSourceEnvelopesV2"),
        ref(SOURCE.productionReview, "compileProductionResolvedSourceEnvelopeSetV2"),
        ref(SOURCE.modelOutput, "buildSourceIntegrityInlineReviewTask"),
        ref(SOURCE.modelOutput, "parseSourceIntegrityModelOutputV2"),
        ref(SOURCE.modelOutput, "assembleSourceIntegrityReviewV2"),
        ref(SOURCE.resolver, "resolveEvidenceRefIds"),
        ref(SOURCE.productionReview, "mergeProductionSourceReviewsV2"),
        ref(SOURCE.modelOutput, "deriveSourceIntegrityResultV2"),
        ref(SOURCE.productionReview, "productionReviewV2FreshnessErrors"),
        sharedFreshness,
        ...sharedRawProtocol,
      ],
    },
    qualification: {
      entrypoint: qualificationEntrypoint,
      callChain: [
        ...qualificationPrefix,
        ref(SOURCE.certification, "compileImp24SourceProductionPartition"),
        ref(SOURCE.productionReview, "compileProductionResolvedSourceEnvelopeSetV2"),
        ref(SOURCE.modelOutput, "buildSourceIntegrityInlineReviewTask"),
        ...qualificationExecution,
        ref(SOURCE.productionReview, "assembleProductionSourcePartitionReviewV2"),
        ref(SOURCE.modelOutput, "parseSourceIntegrityModelOutputV2"),
        ref(SOURCE.modelOutput, "assembleSourceIntegrityReviewV2"),
        ref(SOURCE.resolver, "resolveEvidenceRefIds"),
        ref(SOURCE.modelOutput, "deriveSourceIntegrityResultV2"),
        sharedFreshness,
        ...sharedRawProtocol,
      ],
    },
    shared: {
      compiler: ref(SOURCE.productionReview, "compileProductionResolvedSourceEnvelopeSetV2"),
      renderer: ref(SOURCE.modelOutput, "buildSourceIntegrityInlineReviewTask"),
      parser: ref(SOURCE.modelOutput, "parseSourceIntegrityModelOutputV2"),
      resolver: [ref(SOURCE.resolver, "resolveEvidenceRefIds")],
      assembly: ref(SOURCE.modelOutput, "assembleSourceIntegrityReviewV2"),
      laneStatus: ref(SOURCE.modelOutput, "deriveSourceIntegrityResultV2"),
      freshness: sharedFreshness,
      rawProtocol: sharedRawProtocol,
    },
  },
  quiz: {
    production: {
      entrypoint: productionEntrypoint,
      callChain: [
        productionEntrypoint,
        ref(SOURCE.productionReview, "compileProductionQuizEnvelopeV2"),
        ref(SOURCE.modelOutput, "buildQuizIntegrityInlineReviewTask"),
        ref(SOURCE.modelOutput, "parseQuizIntegrityModelOutputV2"),
        ref(SOURCE.modelOutput, "assembleQuizIntegrityReviewV2"),
        ref(SOURCE.resolver, "resolveEvidenceRefIds"),
        ref(SOURCE.productionReview, "productionReviewV2FreshnessErrors"),
        sharedFreshness,
        ...sharedRawProtocol,
      ],
    },
    qualification: {
      entrypoint: qualificationEntrypoint,
      callChain: [
        ...qualificationPrefix,
        ref(SOURCE.certification, "compileImp24QuizProductionInstrument"),
        ref(SOURCE.productionReview, "compileProductionQuizEnvelopeV2"),
        ref(SOURCE.modelOutput, "buildQuizIntegrityInlineReviewTask"),
        ...qualificationExecution,
        ref(SOURCE.productionReview, "assembleProductionQuizReviewV2"),
        ref(SOURCE.modelOutput, "parseQuizIntegrityModelOutputV2"),
        ref(SOURCE.modelOutput, "assembleQuizIntegrityReviewV2"),
        ref(SOURCE.resolver, "resolveEvidenceRefIds"),
        sharedFreshness,
        ...sharedRawProtocol,
      ],
    },
    shared: {
      compiler: ref(SOURCE.productionReview, "compileProductionQuizEnvelopeV2"),
      renderer: ref(SOURCE.modelOutput, "buildQuizIntegrityInlineReviewTask"),
      parser: ref(SOURCE.modelOutput, "parseQuizIntegrityModelOutputV2"),
      resolver: [ref(SOURCE.resolver, "resolveEvidenceRefIds")],
      assembly: ref(SOURCE.modelOutput, "assembleQuizIntegrityReviewV2"),
      // Quiz status is intentionally derived inside the shared assembly.
      laneStatus: ref(SOURCE.modelOutput, "assembleQuizIntegrityReviewV2"),
      freshness: sharedFreshness,
      rawProtocol: sharedRawProtocol,
    },
  },
};

/** Fixed behavior-bearing inventory. Keep sorted in the emitted artifact. */
const IMPLEMENTATION_SOURCE_RELATIVE_PATHS = [
  `${SRC_REL}/bakeoff/migration/imp24InstrumentCertification.ts`,
  `${SRC_REL}/bakeoff/migration/imp24ProductionQualificationParity.ts`,
  `${SRC_REL}/bakeoff/migration/roleQualificationRunnerV3.ts`,
  `${SRC_REL}/contracts/reviewEvidenceEnvelope.ts`,
  `${SRC_REL}/contracts/reviewModelOutputV2.ts`,
  `${SRC_REL}/orchestrator/forwardChapterConductor.ts`,
  `${SRC_REL}/orchestrator/forwardReviewerExecutor.ts`,
  `${SRC_REL}/orchestrator/forwardRoleAssignmentFreezeV3.ts`,
  `${SRC_REL}/orchestrator/forwardRoleQualificationCampaignV3.ts`,
  `${SRC_REL}/orchestrator/forwardRoleQualificationLiveV3.ts`,
  `${SRC_REL}/review/aggregateChapterReview.ts`,
  `${SRC_REL}/review/completeKeyFreeReaderDocumentV2.ts`,
  `${SRC_REL}/review/evidenceReferenceResolver.ts`,
  `${SRC_REL}/review/forwardProductionReviewV2.ts`,
  `${SRC_REL}/review/quizDerivation.ts`,
  `${SRC_REL}/review/quizIntegrityReview.ts`,
  `${SRC_REL}/review/readerAuthorityBoundaryV2.ts`,
  `${SRC_REL}/review/reviewEvidenceEnvelope.ts`,
  `${SRC_REL}/review/reviewModelOutputV2.ts`,
  `${SRC_REL}/review/reviewProtocolV2.ts`,
] as const;

type ImportProof = { moduleSpecifier: string; symbols: readonly string[] };
type SourceProof = {
  relativePath: string;
  exportedFunctions?: readonly string[];
  imports?: readonly ImportProof[];
  calls?: readonly string[];
};

/**
 * These are execution proofs, not substring-presence checks. Each imported
 * symbol must be in the named import declaration and each call must occur as a
 * call expression outside comments/string literals and outside declarations.
 */
const SOURCE_PROOFS: readonly SourceProof[] = [
  {
    relativePath: SOURCE.conductor,
    exportedFunctions: ["runForwardChapterConductor"],
    imports: [
      {
        moduleSpecifier: "../review/forwardProductionReviewV2.js",
        symbols: [
          "compileProductionQuizEnvelopeV2",
          "compileProductionReaderEnvelopeV2",
          "compileProductionSourceEnvelopesV2",
          "productionReviewV2FreshnessErrors",
        ],
      },
      {
        moduleSpecifier: "../review/reviewModelOutputV2.js",
        symbols: [
          "assembleQuizIntegrityReviewV2",
          "assembleReaderExperienceReviewV2",
          "assembleSourceIntegrityReviewV2",
          "parseQuizIntegrityModelOutputV2",
          "parseReaderExperienceModelOutputV2",
          "parseSourceIntegrityModelOutputV2",
        ],
      },
      {
        moduleSpecifier: "../review/reviewProtocolV2.js",
        symbols: [
          "deriveReaderDecisionCategoryV2",
          "reviewProtocolFileAccessFailureV2",
          "reviewProtocolHasProhibitedConductorEchoV2",
        ],
      },
    ],
    calls: [
      "compileProductionQuizEnvelopeV2",
      "compileProductionReaderEnvelopeV2",
      "compileProductionSourceEnvelopesV2",
      "productionReviewV2FreshnessErrors",
      "assembleQuizIntegrityReviewV2",
      "assembleReaderExperienceReviewV2",
      "assembleSourceIntegrityReviewV2",
      "parseQuizIntegrityModelOutputV2",
      "parseReaderExperienceModelOutputV2",
      "parseSourceIntegrityModelOutputV2",
      "deriveReaderDecisionCategoryV2",
      "reviewProtocolFileAccessFailureV2",
      "reviewProtocolHasProhibitedConductorEchoV2",
    ],
  },
  {
    relativePath: SOURCE.productionReview,
    exportedFunctions: [
      "compileProductionQuizEnvelopeV2",
      "compileProductionReaderEnvelopeV2",
      "compileProductionResolvedSourceEnvelopeSetV2",
      "compileProductionSourceEnvelopesV2",
      "productionReviewV2FreshnessErrors",
    ],
    imports: [
      {
        moduleSpecifier: "./reviewModelOutputV2.js",
        symbols: [
          "assembleQuizIntegrityReviewV2",
          "assembleReaderExperienceReviewV2",
          "assembleSourceIntegrityReviewV2",
          "buildQuizIntegrityInlineReviewTask",
          "buildReaderExperienceInlineReviewTask",
          "buildSourceIntegrityInlineReviewTask",
          "deriveSourceIntegrityResultV2",
          "parseQuizIntegrityModelOutputV2",
          "parseReaderExperienceModelOutputV2",
          "parseSourceIntegrityModelOutputV2",
        ],
      },
      {
        moduleSpecifier: "./reviewProtocolV2.js",
        symbols: ["reviewProtocolFreshnessErrorsV2"],
      },
    ],
    calls: [
      "compileProductionResolvedSourceEnvelopeSetV2",
      "assembleQuizIntegrityReviewV2",
      "assembleReaderExperienceReviewV2",
      "assembleSourceIntegrityReviewV2",
      "buildQuizIntegrityInlineReviewTask",
      "buildReaderExperienceInlineReviewTask",
      "buildSourceIntegrityInlineReviewTask",
      "deriveSourceIntegrityResultV2",
      "parseQuizIntegrityModelOutputV2",
      "parseReaderExperienceModelOutputV2",
      "parseSourceIntegrityModelOutputV2",
      "reviewProtocolFreshnessErrorsV2",
    ],
  },
  {
    relativePath: SOURCE.modelOutput,
    exportedFunctions: [
      "assembleQuizIntegrityReviewV2",
      "assembleReaderExperienceReviewV2",
      "assembleSourceIntegrityReviewV2",
      "buildQuizIntegrityInlineReviewTask",
      "buildReaderExperienceInlineReviewTask",
      "buildSourceIntegrityInlineReviewTask",
      "deriveSourceIntegrityResultV2",
      "parseQuizIntegrityModelOutputV2",
      "parseReaderExperienceModelOutputV2",
      "parseSourceIntegrityModelOutputV2",
    ],
    imports: [{
      moduleSpecifier: "./evidenceReferenceResolver.js",
      symbols: ["resolveEvidenceRefGroups", "resolveEvidenceRefIds"],
    }],
    calls: ["resolveEvidenceRefGroups", "resolveEvidenceRefIds", "deriveSourceIntegrityResultV2"],
  },
  {
    relativePath: SOURCE.resolver,
    exportedFunctions: ["resolveEvidenceRefGroups", "resolveEvidenceRefIds"],
  },
  {
    relativePath: SOURCE.protocol,
    exportedFunctions: [
      "deriveReaderDecisionCategoryV2",
      "reviewProtocolFileAccessFailureV2",
      "reviewProtocolFreshnessErrorsV2",
      "reviewProtocolHasProhibitedConductorEchoV2",
    ],
  },
  {
    relativePath: SOURCE.certification,
    exportedFunctions: [
      "compileImp24QuizProductionInstrument",
      "compileImp24ReaderEvidenceEnvelope",
      "compileImp24SourceProductionPartition",
      "createImp24QualificationOutputEvaluator",
      "prepareImp24QualificationCases",
    ],
    imports: [
      {
        moduleSpecifier: "../../review/forwardProductionReviewV2.js",
        symbols: [
          "assembleProductionQuizReviewV2",
          "assembleProductionSourcePartitionReviewV2",
          "compileProductionQuizEnvelopeV2",
          "compileProductionReaderEnvelopeV2",
          "compileProductionResolvedSourceEnvelopeSetV2",
        ],
      },
      {
        moduleSpecifier: "../../review/reviewModelOutputV2.js",
        symbols: [
          "assembleReaderExperienceReviewV2",
          "buildReaderExperienceInlineReviewTask",
          "parseQuizIntegrityModelOutputV2",
          "parseReaderExperienceModelOutputV2",
          "parseSourceIntegrityModelOutputV2",
        ],
      },
      {
        moduleSpecifier: "../../review/reviewProtocolV2.js",
        symbols: [
          "deriveReaderDecisionCategoryV2",
          "reviewProtocolFileAccessFailureV2",
          "reviewProtocolFreshnessErrorsV2",
          "reviewProtocolHasProhibitedConductorEchoV2",
        ],
      },
    ],
    calls: [
      "assembleProductionQuizReviewV2",
      "assembleProductionSourcePartitionReviewV2",
      "compileProductionQuizEnvelopeV2",
      "compileProductionReaderEnvelopeV2",
      "compileProductionResolvedSourceEnvelopeSetV2",
      "assembleReaderExperienceReviewV2",
      "buildReaderExperienceInlineReviewTask",
      "parseQuizIntegrityModelOutputV2",
      "parseReaderExperienceModelOutputV2",
      "parseSourceIntegrityModelOutputV2",
      "deriveReaderDecisionCategoryV2",
      "reviewProtocolFileAccessFailureV2",
      "reviewProtocolFreshnessErrorsV2",
      "reviewProtocolHasProhibitedConductorEchoV2",
    ],
  },
  {
    relativePath: SOURCE.qualificationRunner,
    exportedFunctions: ["runRoleQualificationV3"],
    imports: [{
      moduleSpecifier: "../../review/reviewProtocolV2.js",
      symbols: [
        "reviewProtocolFileAccessFailureV2",
        "reviewProtocolFreshnessErrorsV2",
        "reviewProtocolHasProhibitedConductorEchoV2",
      ],
    }],
    calls: [
      "reviewProtocolFileAccessFailureV2",
      "reviewProtocolFreshnessErrorsV2",
      "reviewProtocolHasProhibitedConductorEchoV2",
    ],
  },
  {
    relativePath: SOURCE.qualificationLive,
    exportedFunctions: ["prepareLiveRoleQualificationV3"],
    imports: [{
      moduleSpecifier: "../bakeoff/migration/imp24InstrumentCertification.js",
      symbols: ["createImp24QualificationEvaluator", "prepareImp24QualificationCases"],
    }],
    calls: ["createImp24QualificationEvaluator", "prepareImp24QualificationCases"],
  },
  {
    relativePath: SOURCE.qualificationCampaign,
    exportedFunctions: ["runImp24RoleQualificationCampaignV3"],
    imports: [
      {
        moduleSpecifier: "../bakeoff/migration/roleQualificationRunnerV3.js",
        symbols: ["runRoleQualificationV3"],
      },
      {
        moduleSpecifier: "./forwardRoleQualificationLiveV3.js",
        symbols: ["prepareLiveRoleQualificationV3"],
      },
    ],
    calls: ["prepareLiveRoleQualificationV3", "runRoleQualificationV3"],
  },
];

function requireCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Imp24ProductionQualificationParityError(message);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function slashStartsRegularExpression(codeSoFar: string): boolean {
  const trimmed = codeSoFar.trimEnd();
  if (trimmed.length === 0) return true;
  const last = trimmed[trimmed.length - 1];
  if (/[=(:,!&|?{};[\]]/.test(last)) return true;
  return /(?:\breturn|\bcase|\bthrow|\btypeof|\binstanceof|\bin|\bof|\byield|\bawait|=>)$/.test(trimmed);
}

/** Remove comments, optionally replacing literal contents, while retaining line
 * positions and token boundaries. This is sufficient for fail-closed static
 * import/call proofs without executing or compiling repository source. */
function maskNonCode(source: string, maskLiterals: boolean): string {
  let output = "";
  let index = 0;
  let state: "code" | "line-comment" | "block-comment" | "single" | "double" | "template" | "regex" | "regex-class" = "code";
  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];
    if (state === "code") {
      if (char === "/" && next === "/") {
        output += "  ";
        index += 2;
        state = "line-comment";
      } else if (char === "/" && next === "*") {
        output += "  ";
        index += 2;
        state = "block-comment";
      } else if (char === "/" && slashStartsRegularExpression(output)) {
        output += maskLiterals ? " " : char;
        index += 1;
        state = "regex";
      } else if (char === "'") {
        output += maskLiterals ? " " : char;
        index += 1;
        state = "single";
      } else if (char === '"') {
        output += maskLiterals ? " " : char;
        index += 1;
        state = "double";
      } else if (char === "`") {
        output += maskLiterals ? " " : char;
        index += 1;
        state = "template";
      } else {
        output += char;
        index += 1;
      }
      continue;
    }
    if (state === "line-comment") {
      output += char === "\n" ? "\n" : " ";
      index += 1;
      if (char === "\n") state = "code";
      continue;
    }
    if (state === "block-comment") {
      if (char === "*" && next === "/") {
        output += "  ";
        index += 2;
        state = "code";
      } else {
        output += char === "\n" ? "\n" : " ";
        index += 1;
      }
      continue;
    }
    if (state === "regex" || state === "regex-class") {
      if (char === "\\") {
        output += maskLiterals ? "  " : `${char}${next ?? ""}`;
        index += next === undefined ? 1 : 2;
      } else if (state === "regex" && char === "[") {
        output += maskLiterals ? " " : char;
        index += 1;
        state = "regex-class";
      } else if (state === "regex-class" && char === "]") {
        output += maskLiterals ? " " : char;
        index += 1;
        state = "regex";
      } else if (state === "regex" && char === "/") {
        output += maskLiterals ? " " : char;
        index += 1;
        state = "code";
      } else {
        output += maskLiterals && char !== "\n" ? " " : char;
        index += 1;
      }
      continue;
    }
    const delimiter = state === "single" ? "'" : state === "double" ? '"' : "`";
    if (char === "\\") {
      output += maskLiterals ? "  " : `${char}${next ?? ""}`;
      index += next === undefined ? 1 : 2;
    } else if (char === delimiter) {
      output += maskLiterals ? " " : char;
      index += 1;
      state = "code";
    } else {
      output += maskLiterals && char !== "\n" ? " " : char;
      index += 1;
    }
  }
  return output;
}

function importedSymbols(source: string, moduleSpecifier: string): Set<string> {
  const withoutComments = maskNonCode(source, false);
  const symbols = new Set<string>();
  const importPattern = /\bimport\s+(?:type\s+)?\{([\s\S]*?)\}\s+from\s+["']([^"']+)["']\s*;?/g;
  for (const match of withoutComments.matchAll(importPattern)) {
    if (match[2] !== moduleSpecifier) continue;
    for (const part of match[1].split(",")) {
      const normalized = part.trim().replace(/^type\s+/, "");
      const original = normalized.split(/\s+as\s+/)[0]?.trim();
      if (original) symbols.add(original);
    }
  }
  return symbols;
}

function hasExportedFunction(source: string, symbol: string): boolean {
  const code = maskNonCode(source, true);
  const pattern = new RegExp(`\\bexport\\s+(?:async\\s+)?function\\s+${escapeRegExp(symbol)}\\s*(?:<[^>{}]*>)?\\s*\\(`);
  return pattern.test(code);
}

function callExpressionCount(source: string, symbol: string): number {
  const code = maskNonCode(source, true);
  const pattern = new RegExp(`\\b${escapeRegExp(symbol)}\\s*(?:<[^>{}]*>)?\\s*\\(`, "g");
  let count = 0;
  for (const match of code.matchAll(pattern)) {
    const prefix = code.slice(Math.max(0, (match.index ?? 0) - 80), match.index);
    if (/\bfunction\s+$/.test(prefix)) continue;
    count += 1;
  }
  return count;
}

function absoluteRepositoryPath(repositoryRoot: string, relativePath: string): string {
  const root = resolve(repositoryRoot);
  const absolute = resolve(root, relativePath);
  const fromRoot = relative(root, absolute);
  requireCondition(fromRoot !== "" && fromRoot !== ".." && !fromRoot.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`),
    `parity source escapes repository root: ${relativePath}`);
  return absolute;
}

function readRequiredSource(repositoryRoot: string, relativePath: string): Buffer {
  const absolute = absoluteRepositoryPath(repositoryRoot, relativePath);
  requireCondition(existsSync(absolute), `required parity source is missing: ${relativePath}`);
  return readFileSync(absolute);
}

function assertStaticParityProofs(repositoryRoot: string): void {
  const issues: string[] = [];
  for (const proof of SOURCE_PROOFS) {
    let source: string;
    try {
      source = readRequiredSource(repositoryRoot, proof.relativePath).toString("utf8");
    } catch (error) {
      issues.push((error as Error).message);
      continue;
    }
    for (const symbol of proof.exportedFunctions ?? []) {
      if (!hasExportedFunction(source, symbol)) {
        issues.push(`${proof.relativePath}: missing exported function ${symbol}`);
      }
    }
    for (const expectedImport of proof.imports ?? []) {
      const actual = importedSymbols(source, expectedImport.moduleSpecifier);
      for (const symbol of expectedImport.symbols) {
        if (!actual.has(symbol)) {
          issues.push(`${proof.relativePath}: ${symbol} is not a named import from ${expectedImport.moduleSpecifier}`);
        }
      }
    }
    for (const symbol of proof.calls ?? []) {
      if (callExpressionCount(source, symbol) === 0) {
        issues.push(`${proof.relativePath}: ${symbol} is imported/present but is not called`);
      }
    }
  }
  if (issues.length > 0) {
    throw new Imp24ProductionQualificationParityError("production/qualification static parity proof failed", issues);
  }
}

function parityCore(
  implementationSources: Array<{ relativePath: string; bytesSha256: string }>,
): Imp24ProductionQualificationParityCore {
  return {
    schema: IMP24_PRODUCTION_QUALIFICATION_PARITY_SCHEMA,
    status: IMP24_PRODUCTION_QUALIFICATION_PARITY_STATUS,
    artifactPath: IMP24_PRODUCTION_QUALIFICATION_PARITY_ARTIFACT_REL_PATH,
    protocol: IMP24_PRODUCTION_QUALIFICATION_PARITY_PROTOCOL,
    // Never expose the fixed validation blueprint by reference: callers may
    // tamper with a built object in negative tests without mutating the oracle.
    lanes: JSON.parse(canonicalJson(PARITY_LANES)) as Record<
      Imp24ParityLane,
      Imp24ProductionQualificationParityLane
    >,
    implementationSources,
    modelCalls: 0,
    apiCalls: 0,
  };
}

/** Build the canonical parity evidence entirely from current repository bytes. */
export function buildImp24ProductionQualificationParity(args: {
  repositoryRoot: string;
}): Imp24ProductionQualificationParity {
  assertStaticParityProofs(args.repositoryRoot);
  const implementationSources = IMPLEMENTATION_SOURCE_RELATIVE_PATHS
    .map((relativePath) => ({
      relativePath,
      bytesSha256: sha256Hex(readRequiredSource(args.repositoryRoot, relativePath)),
    }))
    .sort((left, right) => left.relativePath.localeCompare(right.relativePath));
  const core = parityCore(implementationSources);
  return Object.freeze({ ...core, paritySha256: hashCanonical(core) });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Structural/self-hash validation; pass repositoryRoot to also re-run source
 * proofs and compare every current source byte hash. */
export function validateImp24ProductionQualificationParity(
  value: unknown,
  options: { repositoryRoot?: string } = {},
): string[] {
  const issues: string[] = [];
  if (!isRecord(value)) return ["parity artifact must be an object"];
  const expectedTopLevelKeys = [
    "apiCalls",
    "artifactPath",
    "implementationSources",
    "lanes",
    "modelCalls",
    "paritySha256",
    "protocol",
    "schema",
    "status",
  ];
  if (canonicalJson(Object.keys(value).sort()) !== canonicalJson(expectedTopLevelKeys)) {
    issues.push("top-level field set mismatch");
  }
  if (value.schema !== IMP24_PRODUCTION_QUALIFICATION_PARITY_SCHEMA) issues.push("schema mismatch");
  if (value.status !== IMP24_PRODUCTION_QUALIFICATION_PARITY_STATUS) issues.push("status mismatch");
  if (value.artifactPath !== IMP24_PRODUCTION_QUALIFICATION_PARITY_ARTIFACT_REL_PATH) issues.push("artifactPath mismatch");
  if (value.protocol !== IMP24_PRODUCTION_QUALIFICATION_PARITY_PROTOCOL) issues.push("protocol mismatch");
  if (value.modelCalls !== 0) issues.push("modelCalls must be zero");
  if (value.apiCalls !== 0) issues.push("apiCalls must be zero");
  if (canonicalJson(value.lanes) !== canonicalJson(PARITY_LANES)) issues.push("lane entrypoints, call chains, or shared symbols drifted");

  if (!Array.isArray(value.implementationSources)) {
    issues.push("implementationSources must be an array");
  } else {
    const expectedPaths = [...IMPLEMENTATION_SOURCE_RELATIVE_PATHS].sort();
    const actualPaths: string[] = [];
    for (const [index, item] of value.implementationSources.entries()) {
      if (!isRecord(item) || typeof item.relativePath !== "string" || typeof item.bytesSha256 !== "string") {
        issues.push(`implementationSources[${index}] is malformed`);
        continue;
      }
      actualPaths.push(item.relativePath);
      if (canonicalJson(Object.keys(item).sort()) !== canonicalJson(["bytesSha256", "relativePath"])) {
        issues.push(`implementationSources[${index}] field set mismatch`);
      }
      if (!SHA256.test(item.bytesSha256)) issues.push(`implementationSources[${index}].bytesSha256 is not a bare lowercase SHA-256`);
    }
    if (canonicalJson(actualPaths) !== canonicalJson([...actualPaths].sort())) issues.push("implementationSources are not sorted by relativePath");
    if (new Set(actualPaths).size !== actualPaths.length) issues.push("implementationSources contain duplicate paths");
    if (canonicalJson(actualPaths) !== canonicalJson(expectedPaths)) issues.push("implementation source inventory drifted");
  }

  if (typeof value.paritySha256 !== "string" || !SHA256.test(value.paritySha256)) {
    issues.push("paritySha256 is not a bare lowercase SHA-256");
  } else {
    const { paritySha256, ...core } = value;
    if (hashCanonical(core) !== paritySha256) issues.push("paritySha256 self-hash mismatch");
  }

  if (options.repositoryRoot !== undefined) {
    try {
      const expected = buildImp24ProductionQualificationParity({ repositoryRoot: options.repositoryRoot });
      if (canonicalJson(value) !== canonicalJson(expected)) issues.push("parity artifact differs from current proved repository implementation");
    } catch (error) {
      issues.push((error as Error).message);
    }
  }
  return [...new Set(issues)];
}

export function verifyImp24ProductionQualificationParity(
  value: unknown,
  options: { repositoryRoot?: string } = {},
): Imp24ProductionQualificationParity {
  const issues = validateImp24ProductionQualificationParity(value, options);
  if (issues.length > 0) {
    throw new Imp24ProductionQualificationParityError("production/qualification parity verification failed", issues);
  }
  return value as Imp24ProductionQualificationParity;
}

export function serializeImp24ProductionQualificationParity(
  value: Imp24ProductionQualificationParity,
): string {
  verifyImp24ProductionQualificationParity(value);
  return canonicalPretty(value);
}

/** The only write boundary in this module. Build/validate/verify remain pure. */
export function materializeImp24ProductionQualificationParity(args: {
  repositoryRoot: string;
}): Imp24ProductionQualificationParityMaterialization {
  const artifact = buildImp24ProductionQualificationParity(args);
  const bytes = serializeImp24ProductionQualificationParity(artifact);
  const absolutePath = absoluteRepositoryPath(
    args.repositoryRoot,
    IMP24_PRODUCTION_QUALIFICATION_PARITY_ARTIFACT_REL_PATH,
  );
  writeFileAtomic(absolutePath, bytes);
  const retainedBytes = readFileSync(absolutePath, "utf8");
  requireCondition(retainedBytes === bytes, "production/qualification parity atomic read-back bytes mismatch");
  const retained = verifyImp24ProductionQualificationParity(JSON.parse(retainedBytes), {
    repositoryRoot: args.repositoryRoot,
  });
  requireCondition(canonicalJson(retained) === canonicalJson(artifact),
    "production/qualification parity atomic read-back artifact mismatch");
  return {
    artifact,
    relativePath: IMP24_PRODUCTION_QUALIFICATION_PARITY_ARTIFACT_REL_PATH,
    absolutePath,
    bytesSha256: sha256Hex(retainedBytes),
    bytes: Buffer.byteLength(retainedBytes, "utf8"),
  };
}
