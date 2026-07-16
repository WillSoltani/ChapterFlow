/**
 * IMP-24C deterministic pre-live freeze.
 *
 * This module has no model, auth, network, or provider capability. It consumes
 * the already retained model-free corpus/certification/seal/parity artifacts,
 * derives the remaining physically separated qualification inputs through the
 * production builders, validates the complete graph before writing, and then
 * atomically materializes every derived file with exact read-back checks.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";

import { canonicalJson, hashCanonical, sha256Hex } from "../../contracts/contractUtil.js";
import { writeFileAtomic } from "../../lib/atomicWrite.js";
import { campaignInstrumentChecksEnabled } from "../../lib/campaignInstrumentChecks.js";
import {
  IMP24_FORWARD_PRODUCTION_INSTRUMENT_SEAL_ARTIFACT_REL_PATH,
  verifyRetainedForwardProductionInstrumentSeal,
} from "../../orchestrator/forwardProductionInstrumentSeal.js";
import {
  IMP24_CANDIDATE_AVAILABILITY_POLICY_BYTES_SHA256,
  IMP24_FROZEN_CANDIDATE_AVAILABILITY_POLICY,
} from "../../orchestrator/forwardRoleQualificationLiveV3.js";
import { canonicalPretty } from "./corpusBuilderCore.js";
import { QUIZ_DETERMINISTIC_CHECKER_VERSION } from "./reviewerRoleAssignment.js";
import {
  IMP24_CERTIFICATION_ARTIFACT_PATHS,
  IMP24_INSTRUMENT_CERTIFICATION_STATUS,
  prepareImp24QualificationCases,
  validateImp24InstrumentCertificationBinding,
  type Imp24InstrumentCertificationBinding,
  type Imp24InstrumentCertificationReport,
} from "./imp24InstrumentCertification.js";
import {
  IMP24_ROLE_QUALIFICATION_R1_EXECUTION_ID,
  IMP24_ROLE_QUALIFICATION_ID,
  certifyImp24Corpora,
  type Imp24CorpusAuditPass,
  type Imp24CorpusBundle,
  type Imp24ReviewRole,
} from "./imp24Corpus.js";
import {
  IMP24_PRODUCTION_QUALIFICATION_PARITY_ARTIFACT_REL_PATH,
  verifyImp24ProductionQualificationParity,
  type Imp24ProductionQualificationParity,
} from "./imp24ProductionQualificationParity.js";
import {
  IMP24_BASE_MAXIMUM_CALLS,
  IMP24_FROZEN_ROLE_THRESHOLDS,
  IMP24_HARD_MAXIMUM_CALLS,
  IMP24_MAX_PARALLEL,
  IMP24_ROLE_CANDIDATE_ORDER,
  IMP24_ROLE_CANDIDATE_ORDER_SHA256,
  IMP24_ROLE_QUALIFICATION_CALL_BUDGET_SHA256,
  IMP24_ROLE_QUALIFICATION_CALL_BUDGET_V3,
  buildFrozenRoleQualificationScheduleV3,
  projectPreparedQualificationCasesV3,
  type PreparedQualificationCasesV3,
  type QualificationScheduleEntryV3,
} from "./roleQualificationRunnerV3.js";

export const IMP24C_PRE_LIVE_FREEZE_SCHEMA = "imp24c-pre-live-freeze-v1" as const;
export const IMP24B_PRE_LIVE_FREEZE_STATUS = "FROZEN_MODEL_FREE_PRE_LIVE" as const;
export const IMP24C_STARTING_HEAD = "0ba1b168e350fa5d6c05480a28c7c944411f54ee" as const;
/** Historical 14-contract baseline; never reinterpret this as the recovery head. */
export const IMP24B_STARTING_HEAD = "19e1837e6d6d1f2ebc6997700956fc0798aa21ca" as const;
export const IMP24B_BRANCH = "feat/v25-pipeline-live" as const;
export const IMP24B_DRAFT_PR = 401 as const;

const PIPELINE_REL = "scripts/book/prompts/chapterflow-v24-author-pipeline";
const CONTRACTS_REL = `${PIPELINE_REL}/state/migration-experiments/contracts`;
const IMP24_CONTRACTS_REL = `${CONTRACTS_REL}/imp24`;
const REPORTS_REL = "docs/v25/reports";
const CONTRACT_MANIFEST_REL = `${PIPELINE_REL}/src/contracts/contract-manifest.json`;
const PROTOCOL_DECISION_REL = `${REPORTS_REL}/IMP-24_PROTOCOL_DECISION.md`;
export const IMP24C_DEDICATED_WORKFLOW_REL = ".github/workflows/chapterflow-v25-pipeline.yml" as const;
const IMP24B_CLOSURE_JSON_REL = `${REPORTS_REL}/IMP-24B_ZERO_CALL_LIFECYCLE_CLOSURE.json`;
const IMP24B_CLOSURE_MARKDOWN_REL = `${REPORTS_REL}/IMP-24B_ZERO_CALL_LIFECYCLE_CLOSURE.md`;
const IMP24C_CONTROL_PLANE_CORRECTION_REL = `${REPORTS_REL}/IMP-24C_CONTROL_PLANE_CORRECTION.md`;
const IMP24C_PROTOCOL_NOTE_REL = `${REPORTS_REL}/IMP-24C_PROTOCOL_NOTE.md`;
const IMP24C_MODEL_FREE_LEDGER_JSON_REL = `${REPORTS_REL}/IMP-24C_MODEL_FREE_VERIFICATION_LEDGER.json`;
const IMP24C_MODEL_FREE_LEDGER_MARKDOWN_REL = `${REPORTS_REL}/IMP-24C_MODEL_FREE_VERIFICATION_LEDGER.md`;
const FORWARD_GOLD_SWEEP_SCHEMA_REL = `${CONTRACTS_REL}/schemas/forward-gold-sweep.schema.json`;
const SHA256 = /^[a-f0-9]{64}$/;
const SHA256_TAGGED = /^sha256:[a-f0-9]{64}$/;
const ROLES = ["reader", "source", "quiz"] as const satisfies readonly Imp24ReviewRole[];
const PARTITIONS = ["canary", "holdout"] as const;

export const IMP24C_PRE_LIVE_ARTIFACT_PATHS = {
  readerCanaryCorpus: `${IMP24_CONTRACTS_REL}/corpora/reader-canary.v3-envelope.json`,
  readerHoldoutCorpus: `${IMP24_CONTRACTS_REL}/corpora/reader-holdout.v3-envelope.json`,
  sourceCanaryCorpus: `${IMP24_CONTRACTS_REL}/corpora/source-canary.v3-envelope.json`,
  sourceHoldoutCorpus: `${IMP24_CONTRACTS_REL}/corpora/source-holdout.v3-envelope.json`,
  quizCanaryCorpus: `${IMP24_CONTRACTS_REL}/corpora/quiz-canary.v3-envelope.json`,
  quizHoldoutCorpus: `${IMP24_CONTRACTS_REL}/corpora/quiz-holdout.v3-envelope.json`,
  corpusProvenance: `${IMP24_CONTRACTS_REL}/corpus-provenance.v3-envelope.json`,
  corpusAuditPassA: `${IMP24_CONTRACTS_REL}/corpus-audit-pass-a.v3-envelope.json`,
  corpusAuditPassB: `${IMP24_CONTRACTS_REL}/corpus-audit-pass-b.v3-envelope.json`,
  readerPromptBundle: `${IMP24_CONTRACTS_REL}/prompts/reader-prompt-bundle.v3-envelope.json`,
  sourcePromptBundle: `${IMP24_CONTRACTS_REL}/prompts/source-prompt-bundle.v3-envelope.json`,
  quizPromptBundle: `${IMP24_CONTRACTS_REL}/prompts/quiz-prompt-bundle.v3-envelope.json`,
  schemaInventory: `${IMP24_CONTRACTS_REL}/v2-output-schema-inventory.json`,
  candidateOrder: `${IMP24_CONTRACTS_REL}/candidate-order.v3-envelope.json`,
  candidateAvailabilityPolicy: `${IMP24_CONTRACTS_REL}/candidate-availability-policy.v3-envelope.json`,
  schedule: `${IMP24_CONTRACTS_REL}/qualification-schedule.v3-envelope.json`,
  callBudget: `${IMP24_CONTRACTS_REL}/qualification-call-budget.v3-envelope.json`,
  parityReference: `${IMP24_CONTRACTS_REL}/production-qualification-parity-reference.json`,
  executionSpec: `${PIPELINE_REL}/state/migration-experiments/${IMP24_ROLE_QUALIFICATION_R1_EXECUTION_ID}/execution-spec.json`,
  runbook: `${REPORTS_REL}/IMP-24C_PRE_LIVE_RUNBOOK.md`,
  implementationReport: `${REPORTS_REL}/implementation-report.imp-24.pre-live.json`,
  freezeJson: `${REPORTS_REL}/IMP-24C_PRE_LIVE_FREEZE.json`,
  freezeMarkdown: `${REPORTS_REL}/IMP-24C_PRE_LIVE_FREEZE.md`,
} as const;

const SCHEMA_PATHS: Record<Imp24ReviewRole, string> = {
  reader: `${CONTRACTS_REL}/schemas/reader-experience-model-output-v2.schema.json`,
  source: `${CONTRACTS_REL}/schemas/source-integrity-model-output-v2.schema.json`,
  quiz: `${CONTRACTS_REL}/schemas/quiz-integrity-model-output-v2.schema.json`,
};

type Partition = (typeof PARTITIONS)[number];
type ArtifactOutputKey = keyof typeof IMP24C_PRE_LIVE_ARTIFACT_PATHS;

export type Imp24BArtifactIdentity = {
  relativePath: string;
  bytesSha256: string;
  bytes: number;
  semanticSha256: string | null;
};

export type Imp24BPreLiveFreezeCore = {
  schema: typeof IMP24C_PRE_LIVE_FREEZE_SCHEMA;
  status: typeof IMP24B_PRE_LIVE_FREEZE_STATUS;
  promptId: "IMP-24C";
  experimentId: typeof IMP24_ROLE_QUALIFICATION_R1_EXECUTION_ID;
  branch: typeof IMP24B_BRANCH;
  draftPr: typeof IMP24B_DRAFT_PR;
  lifecycle: {
    startingLocalHead: typeof IMP24C_STARTING_HEAD;
    startingRemoteHead: typeof IMP24C_STARTING_HEAD;
    implementationCommit: null;
    evidenceCommit: null;
    lifecycleStatus: "PRE_COMMIT_IDENTITIES_NOT_YET_MINTED";
  };
  frozenAssertions: {
    firstLiveCallOccurred: false;
    promptsFrozen: true;
    schemasFrozen: true;
    goldFrozen: true;
    thresholdsFrozen: true;
    candidateOrderFrozen: true;
    casesFrozen: true;
  };
  zeroCallEvidence: { liveCalls: 0; apiCalls: 0; infrastructureReplays: 0; maxPlanEvents: 0 };
  configurationHashes: {
    corpusBundleSha256: string;
    corpusPartitionHashes: Record<Imp24ReviewRole, Record<Partition, string>>;
    corpusAuditAgreementSha256: string;
    promptBundleHashes: Record<Imp24ReviewRole, string>;
    schemaInventorySha256: string;
    thresholdsSha256: string;
    candidateOrderSha256: string;
    candidateAvailabilityPolicySha256: string;
    scheduleSha256: string;
    callBudgetSha256: string;
    productionQualificationParitySha256: string;
    productionInstrumentSealSha256: string;
    certificationSha256: string;
  };
  artifactManifest: Imp24BArtifactIdentity[];
  artifactManifestSha256: string;
  modelCalls: 0;
  apiCalls: 0;
};

export type Imp24BPreLiveFreeze = Imp24BPreLiveFreezeCore & { freezeSha256: string };

export type BuildImp24BPreLiveFreezeOptions = {
  repositoryRoot: string;
  /** Root containing already retained thresholds, corpus, certification, seal, and parity. */
  retainedArtifactRoot?: string;
  /** Destination root. Tests inject a disposable root; production defaults to repositoryRoot. */
  outputRoot?: string;
};

export type Imp24BPreLiveFreezeBuild = {
  freeze: Imp24BPreLiveFreeze;
  outputs: Record<ArtifactOutputKey, { relativePath: string; bytes: string; bytesSha256: string }>;
  modelCalls: 0;
  apiCalls: 0;
};

export type Imp24BPreLiveFreezeMaterialization = {
  schema: "imp24c-pre-live-freeze-materialization-v1";
  freeze: Imp24BPreLiveFreeze;
  outputs: Record<ArtifactOutputKey, { relativePath: string; absolutePath: string; bytesSha256: string; bytes: number }>;
  modelCalls: 0;
  apiCalls: 0;
};

export type Imp24CPreLiveFreezeVerification = {
  schema: "imp24c-pre-live-freeze-verification-v1";
  status: "VERIFIED_BYTE_IDENTICAL_MODEL_FREE_PRE_LIVE";
  freezeSha256: string;
  verifiedOutputCount: number;
  verifiedManifestEntryCount: number;
  writes: 0;
  modelCalls: 0;
  apiCalls: 0;
};

export function validateImp24CDedicatedWorkflowBinding(
  freeze: Imp24BPreLiveFreeze,
  repositoryRoot: string,
): void {
  const bindings = freeze.artifactManifest
    .filter((item) => item.relativePath === IMP24C_DEDICATED_WORKFLOW_REL);
  requireCondition(bindings.length === 1,
    "pre-live freeze must bind exactly one dedicated V25 workflow artifact");
  const workflowBytes = readRequiredBytes(
    repositoryRoot,
    IMP24C_DEDICATED_WORKFLOW_REL,
    "dedicated V25 workflow",
  );
  requireCondition(bindings[0].bytesSha256 === sha256Hex(workflowBytes)
      && bindings[0].bytes === workflowBytes.length,
    "dedicated V25 workflow bytes drifted from the pre-live freeze");
}

export class Imp24BPreLiveFreezeError extends Error {
  constructor(message: string, readonly issues: readonly string[] = []) {
    super(issues.length === 0 ? message : `${message}: ${issues.join("; ")}`);
    this.name = "Imp24BPreLiveFreezeError";
  }
}

function requireCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Imp24BPreLiveFreezeError(message);
}

function readRequiredBytes(root: string, relativePath: string, label: string): Buffer {
  const path = resolve(root, relativePath);
  requireCondition(existsSync(path), `${label} is missing: ${relativePath}`);
  return readFileSync(path);
}

function parseJsonBytes<T>(bytes: Buffer, label: string): T {
  try {
    return JSON.parse(bytes.toString("utf8")) as T;
  } catch (error) {
    throw new Imp24BPreLiveFreezeError(`${label} is not valid JSON`, [(error as Error).message]);
  }
}

function readRequiredJson<T>(root: string, relativePath: string, label: string): { value: T; bytes: Buffer } {
  const bytes = readRequiredBytes(root, relativePath, label);
  return { value: parseJsonBytes<T>(bytes, label), bytes };
}

function identity(relativePath: string, bytes: string | Buffer, semanticSha256: string | null = null): Imp24BArtifactIdentity {
  const buffer = typeof bytes === "string" ? Buffer.from(bytes, "utf8") : bytes;
  if (semanticSha256 !== null) {
    requireCondition(SHA256.test(semanticSha256) || SHA256_TAGGED.test(semanticSha256),
      `${relativePath}: semanticSha256 is not a SHA-256`);
  }
  return { relativePath, bytesSha256: sha256Hex(buffer), bytes: buffer.length, semanticSha256 };
}

function selfHashed<T extends Record<string, unknown>, K extends string>(core: T, key: K): T & Record<K, string> {
  return { ...core, [key]: hashCanonical(core) } as T & Record<K, string>;
}

function partitionArtifact(bundle: Imp24CorpusBundle, role: Imp24ReviewRole, partition: Partition): unknown {
  const corpus = bundle[role];
  const core = {
    schema: "imp24-role-qualification-corpus-partition-v1",
    experimentId: IMP24_ROLE_QUALIFICATION_ID,
    role,
    partition,
    corpusId: corpus.corpusId,
    sourceV2CorpusId: corpus.sourceV2CorpusId,
    sourceV2RawSha256: corpus.sourceV2RawSha256,
    sourceV2SubstantiveCorpusSha256: corpus.sourceV2SubstantiveCorpusSha256,
    payload: corpus[partition],
  };
  return selfHashed(core, "artifactSha256");
}

function corpusProvenanceArtifact(bundle: Imp24CorpusBundle): unknown {
  const cases = ROLES.flatMap((role) => PARTITIONS.flatMap((partition) =>
    bundle[role][partition].cases.map((item) => {
      const candidate = item as unknown as Record<string, unknown>;
      const imp24 = candidate.imp24 as Record<string, unknown>;
      const provenance = candidate.provenance as Record<string, unknown>;
      return {
        role,
        partition,
        caseId: candidate.caseId,
        substantiveCaseSha256: candidate.substantiveCaseSha256,
        sourceV2CaseId: imp24.v2InputCaseId,
        sourceV2InputCaseSha256: imp24.v2InputCaseSha256,
        caseGovernance: imp24,
        provenance,
        provenanceSha256: hashCanonical({ imp24, provenance }),
      };
    })));
  const core = {
    schema: "imp24-corpus-provenance-v1",
    experimentId: IMP24_ROLE_QUALIFICATION_ID,
    frozenV2Sources: Object.fromEntries(ROLES.map((role) => [role, {
      corpusId: bundle[role].sourceV2CorpusId,
      rawSha256: bundle[role].sourceV2RawSha256,
      substantiveCorpusSha256: bundle[role].sourceV2SubstantiveCorpusSha256,
    }])),
    cases,
    caseCount: cases.length,
  };
  return selfHashed(core, "provenanceSha256");
}

function promptBundle(
  role: Imp24ReviewRole,
  prepared: ReturnType<typeof prepareImp24QualificationCases>,
): unknown {
  const core = {
    schema: "imp24-qualification-prompt-bundle-v1",
    experimentId: IMP24_ROLE_QUALIFICATION_ID,
    role,
    promptSourceSha256: prepared.promptSourceHashes[role],
    schemaSha256: prepared.schemaHashes[role],
    tasks: Object.fromEntries(PARTITIONS.map((partition) => [partition,
      prepared.preparedCases[role][partition].map((item) => ({
        partition,
        caseId: item.caseId,
        task: item.task,
        taskSha256: sha256Hex(item.task),
        evidenceEnvelopeSha256: item.envelope.envelopeSha256,
        evidenceEnvelopeBytesSha256: item.evidenceEnvelopeBytesSha256,
      })),
    ])),
  };
  return selfHashed(core, "promptBundleSha256");
}

function schemaInventory(repositoryRoot: string): unknown {
  const schemas = ROLES.map((role) => {
    const bytes = readRequiredBytes(repositoryRoot, SCHEMA_PATHS[role], `${role} V2 output schema`);
    parseJsonBytes(bytes, `${role} V2 output schema`);
    return { role, relativePath: SCHEMA_PATHS[role], bytesSha256: sha256Hex(bytes), bytes: bytes.length };
  });
  const core = {
    schema: "imp24-v2-output-schema-inventory-v1",
    experimentId: IMP24_ROLE_QUALIFICATION_ID,
    schemas,
  };
  return selfHashed(core, "schemaInventorySha256");
}

function candidateOrderArtifact(): unknown {
  const core = {
    schema: "imp24-candidate-order-v1",
    experimentId: IMP24_ROLE_QUALIFICATION_ID,
    order: IMP24_ROLE_CANDIDATE_ORDER,
    candidateOrderSha256: IMP24_ROLE_CANDIDATE_ORDER_SHA256,
  };
  return selfHashed(core, "artifactSha256");
}

function scheduleArtifact(schedule: QualificationScheduleEntryV3[]): unknown {
  requireCondition(schedule.length === IMP24_BASE_MAXIMUM_CALLS,
    `pre-live schedule must contain ${IMP24_BASE_MAXIMUM_CALLS} entries`);
  const core = {
    schema: "imp24-qualification-schedule-v1",
    experimentId: IMP24_ROLE_QUALIFICATION_ID,
    entryCount: schedule.length,
    entries: schedule,
    scheduleSha256: hashCanonical(schedule),
  };
  return selfHashed(core, "artifactSha256");
}

function callBudgetArtifact(bundle: Imp24CorpusBundle): unknown {
  const profilesPerRole = Object.fromEntries(ROLES.map((role) => [role, IMP24_ROLE_CANDIDATE_ORDER[role].length])) as Record<Imp24ReviewRole, number>;
  const canaries = ROLES.reduce((sum, role) => sum + profilesPerRole[role] * bundle[role].canary.cases.length, 0);
  const holdouts = Object.fromEntries(ROLES.map((role) => [role,
    profilesPerRole[role] * bundle[role].holdout.cases.length,
  ])) as Record<Imp24ReviewRole, number>;
  const baseMaximum = canaries + ROLES.reduce((sum, role) => sum + holdouts[role], 0);
  const core = {
    schema: "imp24-qualification-call-budget-v1",
    experimentId: IMP24_ROLE_QUALIFICATION_ID,
    derivation: {
      profilesPerRole,
      canaries,
      holdouts,
      baseMaximum,
      infrastructureReplayMaximum: baseMaximum,
      hardMaximum: baseMaximum * 2,
    },
    policy: IMP24_ROLE_QUALIFICATION_CALL_BUDGET_V3,
    sequentialStopping: { readerQualifiedProfiles: 2, sourceQualifiedProfiles: 2, quizQualifiedProfiles: 1 },
    maximumIsTarget: false,
    callBudgetSha256: IMP24_ROLE_QUALIFICATION_CALL_BUDGET_SHA256,
  };
  const artifact = selfHashed(core, "artifactSha256");
  requireCondition(canaries === 24 && holdouts.reader === 120 && holdouts.source === 160 && holdouts.quiz === 160,
    "call-budget role derivation drifted from 24/120/160/160");
  requireCondition(baseMaximum === IMP24_BASE_MAXIMUM_CALLS && baseMaximum * 2 === IMP24_HARD_MAXIMUM_CALLS,
    "call-budget total drifted from 464/928");
  requireCondition(hashCanonical(IMP24_ROLE_QUALIFICATION_CALL_BUDGET_V3) === IMP24_ROLE_QUALIFICATION_CALL_BUDGET_SHA256,
    "runner call-budget policy hash drifted");
  return artifact;
}

function parityReferenceArtifact(parity: Imp24ProductionQualificationParity, bytes: Buffer): unknown {
  const core = {
    schema: "imp24-production-qualification-parity-reference-v1",
    experimentId: IMP24_ROLE_QUALIFICATION_ID,
    parityArtifactRelativePath: IMP24_PRODUCTION_QUALIFICATION_PARITY_ARTIFACT_REL_PATH,
    parityArtifactBytesSha256: sha256Hex(bytes),
    paritySha256: parity.paritySha256,
    implementationSourceCount: parity.implementationSources.length,
  };
  return selfHashed(core, "referenceSha256");
}

function successorExecutionSpec(args: {
  corpusBundleSha256: string;
  promptBundleHashes: Record<Imp24ReviewRole, string>;
  schemaInventorySha256: string;
  thresholdsSha256: string;
  candidateOrderSha256: string;
  candidateAvailabilityPolicySha256: string;
  scheduleSha256: string;
  callBudgetSha256: string;
  productionQualificationParitySha256: string;
  productionInstrumentSealSha256: string;
  certificationSha256: string;
}): unknown {
  const core = {
    schema: "imp24c-successor-execution-spec-v1",
    promptId: "IMP-24",
    continuationPromptId: "IMP-24C",
    executionId: IMP24_ROLE_QUALIFICATION_R1_EXECUTION_ID,
    predecessorExecution: {
      executionId: IMP24_ROLE_QUALIFICATION_ID,
      disposition: "BLOCKED_ZERO_CALL_CONTROL_PLANE_DEFECT",
      canResume: false,
      mayQualifyProfiles: false,
      liveCalls: 0,
      apiCalls: 0,
    },
    protocolIdentity: {
      reviewEvidenceEnvelope: "review-evidence-envelope-v1",
      qualificationProtocolId: IMP24_ROLE_QUALIFICATION_ID,
      semanticsChanged: false,
    },
    stateRoot: `${PIPELINE_REL}/state/migration-experiments/${IMP24_ROLE_QUALIFICATION_R1_EXECUTION_ID}`,
    frozenBindings: args,
    routePolicy: {
      authMode: "chatgpt",
      apiKeyPresent: false,
      apiFallbackAllowed: false,
      directHttpOrSdkAllowed: false,
      maxParallel: IMP24_MAX_PARALLEL,
    },
    taskBoundary: {
      authorizedLivePhase: "ROLE_QUALIFICATION_ONLY",
      automaticFollowOnAllowed: false,
      pilot: false,
      gold: false,
      contentDesignScore: false,
      localSolActivation: false,
      publish: false,
      promote: false,
      deploy: false,
      upload: false,
      merge: false,
      forcePush: false,
    },
    liveStateCopiedFromPredecessor: false,
    firstLiveCallOccurred: false,
    modelCalls: 0,
    apiCalls: 0,
  };
  return selfHashed(core, "executionSpecSha256");
}

function runbookMarkdown(): string {
  return [
    "# IMP-24C pre-live runbook",
    "",
    "This runbook covers only the model-free freeze, exact implementation commit, dedicated V25 CI, zero-call preflight, V3 canaries, role holdouts, and role assignment freeze.",
    "",
    "## Before the implementation commit",
    "",
    "1. Run TypeScript, contract validation, focused IMP-24 tests, the full V25 suite, and workflow-equivalent checks in an isolated root.",
    "2. Verify V1 and V2 evidence preservation, zero live calls, zero API calls, the secret guard, private-path scan, merge-marker scan, and tracked-binary scan.",
    "3. Materialize thresholds, the production/qualification parity map, the production seal, model-free certification, and this pre-live freeze in the documented order.",
    "4. Stage only intended source, tests, contracts, schemas, state artifacts, and reports. Never stage runtime debris or authentication material.",
    "5. Commit and push normally to `feat/v25-pipeline-live`; never force-push.",
    "",
    "## Exact-commit gate",
    "",
    "1. Verify draft PR #401 and the remote branch both point to the exact implementation commit.",
    "2. Require `ChapterFlow V25 Pipeline` success on that exact commit.",
    "3. Reconcile every frozen hash from a clean checkout of that exact commit.",
    "4. Stop before any live call if any hash differs or certification is not `CERTIFIED_MODEL_FREE`.",
    "",
    "## Live V3 qualification",
    "",
    "1. Run a zero-call preflight and freeze actual local candidate availability without reordering.",
    "2. Use only ChatGPT-authenticated `codex exec`; API keys, provider fallback, SDK/HTTP routes, and direct provider calls remain prohibited.",
    "3. Run exactly two protocol canaries per available profile/role before its holdout.",
    "4. Run the frozen holdouts with sequential stopping at reader 2, source 2, quiz 1.",
    "5. Permit at most one replay for a frozen typed infrastructure failure; never replay a judgment or protocol failure.",
    "6. Retain every request, envelope, receipt, raw output, resolution, assembled review, ledger entry, metric, and role decision.",
    "",
    "## Mandatory stop boundary",
    "",
    "After qualification, use the dedicated final-attestation materializer. Pre-live verification never owns or writes the terminal implementation-report path.",
    "",
    "This task ends after a valid role assignment freeze or a truthful terminal role-set failure. Do not run a pilot, gold validation, local SOL activation, publication, promotion, deployment, upload, merge, or force-push.",
    "",
  ].join("\n");
}

type ContractManifest = {
  schema: string;
  frozenAtIso: string;
  contracts: Array<{ name: string; version: number; ownerPrompt: string; hash: string }>;
};

/** The IMP-24C pre-live freeze pinned the current contract manifest at exactly
 * 16 contracts (14 pre-existing + the two additive IMP-24 descriptors). */
export const IMP24C_FROZEN_CONTRACT_COUNT = 16 as const;

/** ACTIVE-CANDIDATE assertion (CLOSED campaign instrument, decision ledger
 * L-16; formal retirement in WP-202/203/204): the current manifest must still
 * hold exactly the frozen contract count. Runs only under
 * CHAPTERFLOW_CAMPAIGN_INSTRUMENT_CHECKS=1 so a later WP's additive contract
 * does not break the default suite. */
export function assertImp24cFrozenContractCount(manifest: Pick<ContractManifest, "contracts">): void {
  requireCondition(manifest.contracts.length === IMP24C_FROZEN_CONTRACT_COUNT,
    `current contract manifest must contain exactly ${IMP24C_FROZEN_CONTRACT_COUNT} contracts`);
}

function contractEvidence(repositoryRoot: string): {
  contractCount: number;
  preExistingContractHashesUnchanged: true;
  contractVersions: Record<string, number>;
} {
  const current = parseJsonBytes<ContractManifest>(
    readRequiredBytes(repositoryRoot, CONTRACT_MANIFEST_REL, "current contract manifest"),
    "current contract manifest",
  );
  let baseline: ContractManifest;
  try {
    baseline = JSON.parse(execFileSync("git", ["show", `${IMP24B_STARTING_HEAD}:${CONTRACT_MANIFEST_REL}`], {
      cwd: repositoryRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    })) as ContractManifest;
  } catch (error) {
    throw new Imp24BPreLiveFreezeError("cannot read the starting contract manifest from Git", [(error as Error).message]);
  }
  requireCondition(baseline.contracts.length === 14, "starting contract manifest must contain exactly 14 contracts");
  if (campaignInstrumentChecksEnabled()) {
    // Whole-manifest count is pinned only under the closed-campaign opt-in
    // (ledger L-16). By default the internal-integrity checks below (frozenAtIso,
    // pre-existing contracts unchanged, additive descriptors present) still run.
    assertImp24cFrozenContractCount(current);
  }
  requireCondition(current.frozenAtIso === baseline.frozenAtIso, "contract manifest frozenAtIso drifted");
  const currentByName = new Map(current.contracts.map((item) => [item.name, item]));
  for (const item of baseline.contracts) {
    requireCondition(canonicalJson(currentByName.get(item.name)) === canonicalJson(item),
      `pre-existing contract changed: ${item.name}`);
  }
  requireCondition(currentByName.get("review-evidence-envelope")?.version === 1
    && currentByName.get("review-model-output-v2")?.version === 2,
  "IMP-24 additive contract descriptors are missing or mis-versioned");
  return {
    contractCount: current.contracts.length,
    preExistingContractHashesUnchanged: true,
    contractVersions: Object.fromEntries(
      [...current.contracts]
        .sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0)
        .map((item) => [item.name, item.version]),
    ),
  };
}

function intendedImp24Path(relativePath: string): boolean {
  if (relativePath === IMP24C_DEDICATED_WORKFLOW_REL) return true;
  if (relativePath.startsWith(`${PIPELINE_REL}/src/`) || relativePath.startsWith(`${PIPELINE_REL}/tests/`)) return true;
  if (relativePath.startsWith(`${IMP24_CONTRACTS_REL}/`)) return true;
  if (Object.values(SCHEMA_PATHS).includes(relativePath)) return true;
  if (relativePath === FORWARD_GOLD_SWEEP_SCHEMA_REL) return true;
  if (relativePath === PROTOCOL_DECISION_REL
    || relativePath === `${REPORTS_REL}/IMP-24B_WORKTREE_LEDGER.json`
    || relativePath === `${REPORTS_REL}/IMP-24B_WORKTREE_LEDGER.md`
    || relativePath === IMP24_CERTIFICATION_ARTIFACT_PATHS.reportJson
    || relativePath === IMP24_CERTIFICATION_ARTIFACT_PATHS.reportMarkdown
    || relativePath === `${REPORTS_REL}/IMP-24B_ZERO_CALL_LIFECYCLE_CLOSURE.json`
    || relativePath === `${REPORTS_REL}/IMP-24B_ZERO_CALL_LIFECYCLE_CLOSURE.md`
    || relativePath === `${REPORTS_REL}/IMP-24C_CONTROL_PLANE_CORRECTION.md`
    || relativePath === `${REPORTS_REL}/IMP-24C_PROTOCOL_NOTE.md`
    || relativePath === `${REPORTS_REL}/IMP-24C_MODEL_FREE_VERIFICATION_LEDGER.json`
    || relativePath === `${REPORTS_REL}/IMP-24C_MODEL_FREE_VERIFICATION_LEDGER.md`
    || relativePath === IMP24C_PRE_LIVE_ARTIFACT_PATHS.executionSpec
    || relativePath === IMP24C_PRE_LIVE_ARTIFACT_PATHS.implementationReport
    || relativePath === IMP24C_PRE_LIVE_ARTIFACT_PATHS.freezeJson
    || relativePath === IMP24C_PRE_LIVE_ARTIFACT_PATHS.freezeMarkdown
    || relativePath === IMP24C_PRE_LIVE_ARTIFACT_PATHS.runbook) return true;
  return false;
}

function gitPathLines(repositoryRoot: string, args: string[], label: string): string[] {
  try {
    return execFileSync("git", args, {
      cwd: repositoryRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 16 * 1024 * 1024,
    }).split("\n").map((item) => item.trim()).filter(Boolean);
  } catch (error) {
    throw new Imp24BPreLiveFreezeError(`cannot derive ${label} from Git`, [(error as Error).message]);
  }
}

function exactChangedFileInventory(repositoryRoot: string): string[] {
  const tracked = gitPathLines(repositoryRoot,
    ["diff", "--name-only", IMP24C_STARTING_HEAD, "--"], "tracked IMP-24C changed-file inventory");
  const untracked = gitPathLines(repositoryRoot,
    ["ls-files", "--others", "--exclude-standard"], "untracked IMP-24 changed-file inventory");
  const requiredArtifacts = [
    ...Object.values(IMP24C_PRE_LIVE_ARTIFACT_PATHS),
    IMP24_CERTIFICATION_ARTIFACT_PATHS.corpusBundle,
    IMP24_CERTIFICATION_ARTIFACT_PATHS.certificationBinding,
    IMP24_CERTIFICATION_ARTIFACT_PATHS.legacyClosure,
    IMP24_CERTIFICATION_ARTIFACT_PATHS.productionQualificationParity,
    IMP24_CERTIFICATION_ARTIFACT_PATHS.reportJson,
    IMP24_CERTIFICATION_ARTIFACT_PATHS.reportMarkdown,
    IMP24_CERTIFICATION_ARTIFACT_PATHS.thresholds,
    IMP24_FORWARD_PRODUCTION_INSTRUMENT_SEAL_ARTIFACT_REL_PATH,
    PROTOCOL_DECISION_REL,
    `${REPORTS_REL}/IMP-24B_WORKTREE_LEDGER.json`,
    `${REPORTS_REL}/IMP-24B_WORKTREE_LEDGER.md`,
    IMP24B_CLOSURE_JSON_REL,
    IMP24B_CLOSURE_MARKDOWN_REL,
    `${REPORTS_REL}/IMP-24C_CONTROL_PLANE_CORRECTION.md`,
    `${REPORTS_REL}/IMP-24C_PROTOCOL_NOTE.md`,
    `${REPORTS_REL}/IMP-24C_MODEL_FREE_VERIFICATION_LEDGER.json`,
    `${REPORTS_REL}/IMP-24C_MODEL_FREE_VERIFICATION_LEDGER.md`,
    FORWARD_GOLD_SWEEP_SCHEMA_REL,
    ...Object.values(SCHEMA_PATHS),
  ];
  return [...new Set([...tracked, ...untracked, ...requiredArtifacts].filter(intendedImp24Path))]
    .sort((left, right) => left < right ? -1 : left > right ? 1 : 0);
}

function implementationReport(args: {
  contracts: ReturnType<typeof contractEvidence>;
  certification: Imp24InstrumentCertificationBinding;
  sealSha256: string;
  bundle: Imp24CorpusBundle;
  paritySha256: string;
  filesChanged: string[];
}): unknown {
  return {
    schema: "worker-implementation-report-v1",
    status: "PRE_LIVE_FREEZE",
    promptId: "IMP-24",
    continuationPromptId: "IMP-24C",
    baselineHash: IMP24C_STARTING_HEAD,
    resultHash: args.sealSha256,
    resultHashKind: "production-instrument-seal-sha256",
    contractVersions: args.contracts.contractVersions,
    filesChanged: args.filesChanged,
    requirementsImplemented: [
      {
        requirementId: "IMP24C-R01-CONTROL-PLANE-RECOVERY",
        status: "implemented",
        note: "The corrected CI gate and split pre-live/final-attestation lifecycle are bound into the reminted model-free instrument.",
      },
      {
        requirementId: "IMP24C-R02-EXACT-IMPLEMENTATION-COMMIT-CI",
        status: "deferred",
        deferredTo: "The effective corrected implementation checkpoint, normal push, dedicated V25 CI, and clean-checkout reconciliation that follow this pre-commit artifact freeze. Failed pre-live candidates are retained separately in the worktree ledger and do not satisfy this gate.",
      },
      {
        requirementId: "IMP24C-R03-V3-R1-LIVE-ROLE-QUALIFICATION",
        status: "deferred",
        deferredTo: "The exact-CI-green V3 canary and holdout phase authorized only after clean-checkout reconciliation.",
      },
    ],
    testsRequired: [
      "npx tsc -p . --noEmit",
      "node --import tsx src/cli.ts contract-validate",
      "CHAPTERFLOW_NO_API_CODEX_QC=1 npx tsx tests/run.ts",
      "Dedicated ChapterFlow V25 Pipeline CI on the exact implementation commit",
      "Clean-checkout reconstruction of all pre-live artifact hashes",
    ],
    testsRun: [],
    testResults: { pass: 0, fail: 0, xfail: 0, xpass: 0, skip: 0, xenv: 0, commands: [] },
    gateChanges: [],
    bookSpecificExceptions: [],
    unexpectedWrites: [],
    unresolvedRisks: [
      "The effective corrected implementation checkpoint and its dedicated V25 CI evidence do not exist until after this pre-live freeze is committed; any earlier failed pre-live candidate is non-qualifying.",
      "No reviewer profile or role set is qualified by model-free certification alone.",
    ],
    dependencyAssumptions: [
      "The retained certification, reminted production seal, parity proof, and corpus audits were revalidated from current repository bytes by the pre-live materializer.",
      "The worktree ledger, rather than this deterministic materializer, retains local verification attempts and any failed pre-live candidate evidence.",
      "The effective CI-green implementation checkpoint and evidence commit identities remain null because those qualifying lifecycle identities have not been minted yet.",
      "The completed IMP-24B zero-call lifecycle is immutable and bound by its dedicated closure artifacts.",
    ],
    branch: IMP24B_BRANCH,
    draftPr: IMP24B_DRAFT_PR,
    startingLocalHead: IMP24C_STARTING_HEAD,
    startingRemoteHead: IMP24C_STARTING_HEAD,
    implementationCommit: null,
    evidenceCommit: null,
    lifecycleNote: "No effective CI-green implementation checkpoint or evidence commit exists yet; null is the truthful qualifying lifecycle value, not a placeholder. Failed pre-live candidates remain recorded in the worktree ledger.",
    oldQualificationV1Closed: true,
    oldQualificationV2Closed: true,
    experimentId: IMP24_ROLE_QUALIFICATION_R1_EXECUTION_ID,
    contractCount: args.contracts.contractCount,
    preExistingContractHashesUnchanged: args.contracts.preExistingContractHashesUnchanged,
    productionQualificationParity: true,
    modelFreeInstrumentCertified: true,
    certificationSha256: args.certification.certificationSha256,
    productionSealSha256: args.sealSha256,
    canaryCorpusHashes: Object.fromEntries(ROLES.map((role) => [role, args.bundle[role].canary.substantivePartitionSha256])),
    holdoutCorpusHashes: Object.fromEntries(ROLES.map((role) => [role, args.bundle[role].holdout.substantivePartitionSha256])),
    productionQualificationParitySha256: args.paritySha256,
    canaryCalls: 0,
    holdoutCalls: 0,
    infrastructureReplays: 0,
    maxPlanEvents: 0,
    liveModelCallsMade: 0,
    apiCallsMade: 0,
    apiCalls: 0,
    roleSetReady: false,
    readerPrimary: null,
    readerAudit: null,
    sourcePrimary: null,
    sourceAdjudicator: null,
    quizSemanticAdjudicator: null,
    deterministicQuizChecker: QUIZ_DETERMINISTIC_CHECKER_VERSION,
    dedicatedV25CiImplementationCommit: null,
    dedicatedV25CiEvidenceCommit: null,
    rootCiStatus: "NOT_RUN",
    pilotRun: false,
    goldRun: false,
    localSolActivation: false,
    publishActivated: false,
    promoteActivated: false,
    deploymentActivated: false,
    uploadActivated: false,
    mainMerged: false,
    gateWeakening: false,
    holdoutRelabeling: false,
    outputInformedResampling: false,
    unboundedRetries: false,
    finalDecision: "INCONCLUSIVE",
    blockingIssues: ["V3_LIVE_ROLE_QUALIFICATION_NOT_YET_RUN"],
    remainingRisks: [
      "The effective corrected implementation checkpoint and its dedicated V25 CI evidence do not exist until after this pre-live freeze is committed; any earlier failed pre-live candidate is non-qualifying.",
      "No reviewer profile or role set is qualified by model-free certification alone.",
    ],
  };
}

function freezeMarkdown(freeze: Imp24BPreLiveFreeze): string {
  return [
    "# IMP-24C pre-live freeze",
    "",
    `Status: **${freeze.status}**`,
    "",
    `Experiment: \`${freeze.experimentId}\``,
    `Freeze SHA-256: \`${freeze.freezeSha256}\``,
    `Certification SHA-256: \`${freeze.configurationHashes.certificationSha256}\``,
    `Production seal SHA-256: \`${freeze.configurationHashes.productionInstrumentSealSha256}\``,
    `Schedule SHA-256: \`${freeze.configurationHashes.scheduleSha256}\``,
    "",
    "## Frozen state",
    "",
    "- First live call occurred: false.",
    "- Prompts, schemas, gold, thresholds, candidate order, and cases are frozen.",
    "- Live calls: 0. API calls: 0.",
    "- Implementation and evidence commit identities are truthfully null until Git creates them.",
    "- The terminal implementation report is excluded and cannot be overwritten by this freeze.",
    "",
    "## Artifact inventory",
    "",
    "| Artifact | Bytes SHA-256 |",
    "| --- | --- |",
    ...freeze.artifactManifest.map((item) => `| \`${item.relativePath}\` | \`${item.bytesSha256}\` |`),
    "",
    "This freeze authorizes no model call by itself. The exact implementation commit must be pushed, pass dedicated V25 CI, and reconcile from a clean checkout before the zero-call live preflight.",
    "",
  ].join("\n");
}

function semanticHash(value: unknown, field: string): string | null {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    const candidate = (value as Record<string, unknown>)[field];
    if (typeof candidate === "string" && (SHA256.test(candidate) || SHA256_TAGGED.test(candidate))) return candidate;
  }
  return null;
}

function outputRecord(
  values: Partial<Record<ArtifactOutputKey, unknown | string>>,
): Record<ArtifactOutputKey, { relativePath: string; bytes: string; bytesSha256: string }> {
  const out = {} as Record<ArtifactOutputKey, { relativePath: string; bytes: string; bytesSha256: string }>;
  for (const key of Object.keys(IMP24C_PRE_LIVE_ARTIFACT_PATHS) as ArtifactOutputKey[]) {
    requireCondition(values[key] !== undefined, `pre-live output was not built: ${key}`);
    const value = values[key]!;
    const bytes = typeof value === "string" ? value : canonicalPretty(value);
    out[key] = { relativePath: IMP24C_PRE_LIVE_ARTIFACT_PATHS[key], bytes, bytesSha256: sha256Hex(bytes) };
  }
  return out;
}

export function validateImp24BPreLiveFreeze(value: unknown): string[] {
  const issues: string[] = [];
  if (value === null || typeof value !== "object" || Array.isArray(value)) return ["freeze must be an object"];
  const freeze = value as Imp24BPreLiveFreeze;
  if (freeze.schema !== IMP24C_PRE_LIVE_FREEZE_SCHEMA) issues.push("schema mismatch");
  if (freeze.status !== IMP24B_PRE_LIVE_FREEZE_STATUS) issues.push("status mismatch");
  if (freeze.experimentId !== IMP24_ROLE_QUALIFICATION_R1_EXECUTION_ID) issues.push("experiment mismatch");
  if (freeze.lifecycle?.implementationCommit !== null || freeze.lifecycle?.evidenceCommit !== null) issues.push("pre-commit lifecycle IDs must be null");
  if (freeze.frozenAssertions?.firstLiveCallOccurred !== false
    || freeze.frozenAssertions?.promptsFrozen !== true
    || freeze.frozenAssertions?.schemasFrozen !== true
    || freeze.frozenAssertions?.goldFrozen !== true
    || freeze.frozenAssertions?.thresholdsFrozen !== true
    || freeze.frozenAssertions?.candidateOrderFrozen !== true
    || freeze.frozenAssertions?.casesFrozen !== true) issues.push("frozen assertion drift");
  if (freeze.zeroCallEvidence?.liveCalls !== 0 || freeze.zeroCallEvidence?.apiCalls !== 0
    || freeze.zeroCallEvidence?.infrastructureReplays !== 0 || freeze.zeroCallEvidence?.maxPlanEvents !== 0
    || freeze.modelCalls !== 0 || freeze.apiCalls !== 0) issues.push("pre-live call counters are not zero");
  if (!Array.isArray(freeze.artifactManifest)) issues.push("artifact manifest is missing");
  else {
    const paths = freeze.artifactManifest.map((item) => item.relativePath);
    if (new Set(paths).size !== paths.length) issues.push("artifact manifest has duplicate paths");
    if (canonicalJson(paths) !== canonicalJson([...paths].sort())) issues.push("artifact manifest is not sorted");
    for (const item of freeze.artifactManifest) {
      if (!SHA256.test(item.bytesSha256) || !Number.isSafeInteger(item.bytes) || item.bytes < 0) issues.push(`invalid artifact identity: ${item.relativePath}`);
    }
    if (hashCanonical(freeze.artifactManifest) !== freeze.artifactManifestSha256) issues.push("artifact manifest hash mismatch");
  }
  if (!SHA256.test(freeze.freezeSha256)) issues.push("freezeSha256 is not a bare SHA-256");
  else {
    const { freezeSha256: _ignored, ...core } = freeze;
    if (hashCanonical(core) !== freeze.freezeSha256) issues.push("freeze self-hash mismatch");
  }
  return [...new Set(issues)];
}

export function buildImp24BPreLiveFreeze(options: BuildImp24BPreLiveFreezeOptions): Imp24BPreLiveFreezeBuild {
  const repositoryRoot = resolve(options.repositoryRoot);
  const retainedRoot = resolve(options.retainedArtifactRoot ?? repositoryRoot);
  const contracts = contractEvidence(repositoryRoot);

  const corpusInput = readRequiredJson<Imp24CorpusBundle>(
    retainedRoot, IMP24_CERTIFICATION_ARTIFACT_PATHS.corpusBundle, "retained V3 corpus bundle",
  );
  const corpusAudit = certifyImp24Corpora(corpusInput.value);
  const certificationInput = readRequiredJson<Imp24InstrumentCertificationBinding>(
    retainedRoot, IMP24_CERTIFICATION_ARTIFACT_PATHS.certificationBinding, "retained model-free certification binding",
  );
  const bindingIssues = validateImp24InstrumentCertificationBinding(certificationInput.value);
  requireCondition(bindingIssues.length === 0, `retained certification binding is invalid: ${bindingIssues.join("; ")}`);
  const certificationReportInput = readRequiredJson<Imp24InstrumentCertificationReport>(
    retainedRoot, IMP24_CERTIFICATION_ARTIFACT_PATHS.reportJson, "retained model-free certification report",
  );
  requireCondition(certificationReportInput.value.status === IMP24_INSTRUMENT_CERTIFICATION_STATUS,
    "instrument report is not CERTIFIED_MODEL_FREE");
  requireCondition(canonicalJson(certificationReportInput.value.binding) === canonicalJson(certificationInput.value),
    "instrument report and retained certification binding disagree");
  const certificationMarkdownBytes = readRequiredBytes(
    retainedRoot, IMP24_CERTIFICATION_ARTIFACT_PATHS.reportMarkdown, "retained certification Markdown",
  );
  const legacyClosureInput = readRequiredJson<unknown>(
    retainedRoot, IMP24_CERTIFICATION_ARTIFACT_PATHS.legacyClosure, "retained V1/V2 closure",
  );
  requireCondition(hashCanonical(legacyClosureInput.value) === certificationInput.value.legacyEvidenceClosureSha256,
    "retained V1/V2 closure differs from certification binding");

  const sealPath = resolve(retainedRoot, IMP24_FORWARD_PRODUCTION_INSTRUMENT_SEAL_ARTIFACT_REL_PATH);
  const seal = verifyRetainedForwardProductionInstrumentSeal({ repositoryRoot, outputPath: sealPath });
  requireCondition(seal.sealSha256 === certificationInput.value.productionInstrumentSealSha256,
    "production seal differs from certification binding");
  const sealBytes = readFileSync(sealPath);

  const parityInput = readRequiredJson<Imp24ProductionQualificationParity>(
    retainedRoot, IMP24_PRODUCTION_QUALIFICATION_PARITY_ARTIFACT_REL_PATH, "retained production/qualification parity",
  );
  const parity = verifyImp24ProductionQualificationParity(parityInput.value, { repositoryRoot });
  requireCondition(parity.paritySha256 === certificationInput.value.productionQualificationParitySha256,
    "production/qualification parity differs from certification binding");

  const thresholdsInput = readRequiredJson<unknown>(
    retainedRoot, IMP24_CERTIFICATION_ARTIFACT_PATHS.thresholds, "retained role thresholds",
  );
  requireCondition(canonicalJson(thresholdsInput.value) === canonicalJson(IMP24_FROZEN_ROLE_THRESHOLDS),
    "retained thresholds differ from the frozen runner thresholds");
  requireCondition(hashCanonical(thresholdsInput.value) === certificationInput.value.thresholdsSha256,
    "retained threshold semantic hash differs from certification binding");
  requireCondition(corpusInput.value.substantiveBundleSha256 === certificationInput.value.corpusBundleSha256,
    "retained corpus bundle differs from certification binding");

  const prepared = prepareImp24QualificationCases({ repositoryRoot, corpusBundle: corpusInput.value });
  const schedule = buildFrozenRoleQualificationScheduleV3(prepared.preparedCases);
  requireCondition(hashCanonical(schedule) === certificationReportInput.value.frozenInputHashes.scheduleSha256,
    "rebuilt 464-call schedule differs from certification report");
  requireCondition(hashCanonical(projectPreparedQualificationCasesV3(prepared.preparedCases))
    === certificationReportInput.value.frozenInputHashes.preparedCasesSha256,
  "rebuilt prompt/case projection differs from certification report");

  const values: Partial<Record<ArtifactOutputKey, unknown | string>> = {};
  for (const role of ROLES) {
    for (const partition of PARTITIONS) {
      const key = `${role}${partition[0].toUpperCase()}${partition.slice(1)}Corpus` as ArtifactOutputKey;
      values[key] = partitionArtifact(corpusInput.value, role, partition);
    }
  }
  values.corpusProvenance = corpusProvenanceArtifact(corpusInput.value);
  values.corpusAuditPassA = corpusAudit.passA;
  values.corpusAuditPassB = corpusAudit.passB;
  values.readerPromptBundle = promptBundle("reader", prepared);
  values.sourcePromptBundle = promptBundle("source", prepared);
  values.quizPromptBundle = promptBundle("quiz", prepared);
  const schemaInventoryValue = schemaInventory(repositoryRoot);
  values.schemaInventory = schemaInventoryValue;
  values.candidateOrder = candidateOrderArtifact();
  values.candidateAvailabilityPolicy = IMP24_FROZEN_CANDIDATE_AVAILABILITY_POLICY;
  const scheduleValue = scheduleArtifact(schedule);
  values.schedule = scheduleValue;
  values.callBudget = callBudgetArtifact(corpusInput.value);
  values.parityReference = parityReferenceArtifact(parity, parityInput.bytes);
  values.runbook = runbookMarkdown();

  const promptBundleHashes = Object.fromEntries(ROLES.map((role) => {
    const value = values[`${role}PromptBundle` as ArtifactOutputKey] as Record<string, unknown>;
    return [role, String(value.promptBundleSha256)];
  })) as Record<Imp24ReviewRole, string>;
  const schemaInventorySha256 = (schemaInventoryValue as Record<string, unknown>).schemaInventorySha256 as string;
  const scheduleSha256 = (scheduleValue as Record<string, unknown>).scheduleSha256 as string;
  values.executionSpec = successorExecutionSpec({
    corpusBundleSha256: corpusInput.value.substantiveBundleSha256,
    promptBundleHashes,
    schemaInventorySha256,
    thresholdsSha256: certificationInput.value.thresholdsSha256,
    candidateOrderSha256: IMP24_ROLE_CANDIDATE_ORDER_SHA256,
    candidateAvailabilityPolicySha256: IMP24_CANDIDATE_AVAILABILITY_POLICY_BYTES_SHA256,
    scheduleSha256,
    callBudgetSha256: IMP24_ROLE_QUALIFICATION_CALL_BUDGET_SHA256,
    productionQualificationParitySha256: parity.paritySha256,
    productionInstrumentSealSha256: seal.sealSha256,
    certificationSha256: certificationInput.value.certificationSha256,
  });

  const preliminaryOutputs = values as Record<ArtifactOutputKey, unknown | string>;
  const baseIdentities: Imp24BArtifactIdentity[] = [];
  for (const [key, value] of Object.entries(preliminaryOutputs) as Array<[ArtifactOutputKey, unknown | string]>) {
    if (key === "implementationReport" || key === "freezeJson" || key === "freezeMarkdown") continue;
    const bytes = typeof value === "string" ? value : canonicalPretty(value);
    baseIdentities.push(identity(IMP24C_PRE_LIVE_ARTIFACT_PATHS[key], bytes,
      typeof value === "string" ? null : semanticHash(value, [
        "artifactSha256", "provenanceSha256", "agreementProjectionSha256", "promptBundleSha256",
        "schemaInventorySha256", "candidateOrderSha256", "policySha256", "scheduleSha256",
        "callBudgetSha256", "referenceSha256", "executionSpecSha256",
      ].find((field) => semanticHash(value, field) !== null) ?? "")));
  }

  const retainedIdentities = [
    identity(IMP24_CERTIFICATION_ARTIFACT_PATHS.corpusBundle, corpusInput.bytes, corpusInput.value.substantiveBundleSha256),
    identity(IMP24_CERTIFICATION_ARTIFACT_PATHS.certificationBinding, certificationInput.bytes, certificationInput.value.certificationSha256),
    identity(IMP24_CERTIFICATION_ARTIFACT_PATHS.legacyClosure, legacyClosureInput.bytes, certificationInput.value.legacyEvidenceClosureSha256),
    identity(IMP24_PRODUCTION_QUALIFICATION_PARITY_ARTIFACT_REL_PATH, parityInput.bytes, parity.paritySha256),
    identity(IMP24_FORWARD_PRODUCTION_INSTRUMENT_SEAL_ARTIFACT_REL_PATH, sealBytes, seal.sealSha256),
    identity(IMP24_CERTIFICATION_ARTIFACT_PATHS.thresholds, thresholdsInput.bytes, certificationInput.value.thresholdsSha256),
    identity(IMP24_CERTIFICATION_ARTIFACT_PATHS.reportJson, certificationReportInput.bytes, certificationInput.value.certificationSha256),
    identity(IMP24_CERTIFICATION_ARTIFACT_PATHS.reportMarkdown, certificationMarkdownBytes),
    identity(CONTRACT_MANIFEST_REL, readRequiredBytes(repositoryRoot, CONTRACT_MANIFEST_REL, "contract manifest")),
    identity(PROTOCOL_DECISION_REL, readRequiredBytes(repositoryRoot, PROTOCOL_DECISION_REL, "IMP-24 protocol decision")),
    identity(IMP24C_DEDICATED_WORKFLOW_REL,
      readRequiredBytes(repositoryRoot, IMP24C_DEDICATED_WORKFLOW_REL, "dedicated V25 workflow")),
    identity(IMP24B_CLOSURE_JSON_REL,
      readRequiredBytes(repositoryRoot, IMP24B_CLOSURE_JSON_REL, "IMP-24B lifecycle closure JSON")),
    identity(IMP24B_CLOSURE_MARKDOWN_REL,
      readRequiredBytes(repositoryRoot, IMP24B_CLOSURE_MARKDOWN_REL, "IMP-24B lifecycle closure Markdown")),
    identity(IMP24C_CONTROL_PLANE_CORRECTION_REL,
      readRequiredBytes(repositoryRoot, IMP24C_CONTROL_PLANE_CORRECTION_REL, "IMP-24C control-plane correction report")),
    identity(IMP24C_PROTOCOL_NOTE_REL,
      readRequiredBytes(repositoryRoot, IMP24C_PROTOCOL_NOTE_REL, "IMP-24C protocol note")),
    identity(IMP24C_MODEL_FREE_LEDGER_JSON_REL,
      readRequiredBytes(repositoryRoot, IMP24C_MODEL_FREE_LEDGER_JSON_REL, "IMP-24C model-free verification ledger JSON")),
    identity(IMP24C_MODEL_FREE_LEDGER_MARKDOWN_REL,
      readRequiredBytes(repositoryRoot, IMP24C_MODEL_FREE_LEDGER_MARKDOWN_REL, "IMP-24C model-free verification ledger Markdown")),
    ...ROLES.map((role) => identity(SCHEMA_PATHS[role], readRequiredBytes(repositoryRoot, SCHEMA_PATHS[role], `${role} schema`), prepared.schemaHashes[role])),
  ];

  const reportValue = implementationReport({
    contracts,
    certification: certificationInput.value,
    sealSha256: seal.sealSha256,
    bundle: corpusInput.value,
    paritySha256: parity.paritySha256,
    filesChanged: exactChangedFileInventory(repositoryRoot),
  });
  const reportBytes = canonicalPretty(reportValue);
  values.implementationReport = reportValue;
  const artifactManifest = [...baseIdentities, ...retainedIdentities,
    identity(IMP24C_PRE_LIVE_ARTIFACT_PATHS.implementationReport, reportBytes),
  ].sort((left, right) => left.relativePath < right.relativePath ? -1 : left.relativePath > right.relativePath ? 1 : 0);
  requireCondition(new Set(artifactManifest.map((item) => item.relativePath)).size === artifactManifest.length,
    "pre-live artifact manifest contains duplicate paths");

  const partitionHashes = Object.fromEntries(ROLES.map((role) => [role, Object.fromEntries(PARTITIONS.map((partition) => [
    partition, corpusInput.value[role][partition].substantivePartitionSha256,
  ]))])) as Record<Imp24ReviewRole, Record<Partition, string>>;
  const freezeCore: Imp24BPreLiveFreezeCore = {
    schema: IMP24C_PRE_LIVE_FREEZE_SCHEMA,
    status: IMP24B_PRE_LIVE_FREEZE_STATUS,
    promptId: "IMP-24C",
    experimentId: IMP24_ROLE_QUALIFICATION_R1_EXECUTION_ID,
    branch: IMP24B_BRANCH,
    draftPr: IMP24B_DRAFT_PR,
    lifecycle: {
      startingLocalHead: IMP24C_STARTING_HEAD,
      startingRemoteHead: IMP24C_STARTING_HEAD,
      implementationCommit: null,
      evidenceCommit: null,
      lifecycleStatus: "PRE_COMMIT_IDENTITIES_NOT_YET_MINTED",
    },
    frozenAssertions: {
      firstLiveCallOccurred: false,
      promptsFrozen: true,
      schemasFrozen: true,
      goldFrozen: true,
      thresholdsFrozen: true,
      candidateOrderFrozen: true,
      casesFrozen: true,
    },
    zeroCallEvidence: { liveCalls: 0, apiCalls: 0, infrastructureReplays: 0, maxPlanEvents: 0 },
    configurationHashes: {
      corpusBundleSha256: corpusInput.value.substantiveBundleSha256,
      corpusPartitionHashes: partitionHashes,
      corpusAuditAgreementSha256: corpusAudit.agreementSha256,
      promptBundleHashes,
      schemaInventorySha256,
      thresholdsSha256: certificationInput.value.thresholdsSha256,
      candidateOrderSha256: IMP24_ROLE_CANDIDATE_ORDER_SHA256,
      candidateAvailabilityPolicySha256: IMP24_CANDIDATE_AVAILABILITY_POLICY_BYTES_SHA256,
      scheduleSha256,
      callBudgetSha256: IMP24_ROLE_QUALIFICATION_CALL_BUDGET_SHA256,
      productionQualificationParitySha256: parity.paritySha256,
      productionInstrumentSealSha256: seal.sealSha256,
      certificationSha256: certificationInput.value.certificationSha256,
    },
    artifactManifest,
    artifactManifestSha256: hashCanonical(artifactManifest),
    modelCalls: 0,
    apiCalls: 0,
  };
  const freeze: Imp24BPreLiveFreeze = { ...freezeCore, freezeSha256: hashCanonical(freezeCore) };
  const freezeIssues = validateImp24BPreLiveFreeze(freeze);
  requireCondition(freezeIssues.length === 0, `built pre-live freeze is invalid: ${freezeIssues.join("; ")}`);
  validateImp24CDedicatedWorkflowBinding(freeze, repositoryRoot);
  values.freezeJson = freeze;
  values.freezeMarkdown = freezeMarkdown(freeze);

  const outputs = outputRecord(values);
  return { freeze, outputs, modelCalls: 0, apiCalls: 0 };
}

export function materializeImp24BPreLiveFreeze(
  options: BuildImp24BPreLiveFreezeOptions,
): Imp24BPreLiveFreezeMaterialization {
  const built = buildImp24BPreLiveFreeze(options);
  const outputRoot = resolve(options.outputRoot ?? options.repositoryRoot);
  const outputs = {} as Imp24BPreLiveFreezeMaterialization["outputs"];
  for (const key of Object.keys(built.outputs) as ArtifactOutputKey[]) {
    const item = built.outputs[key];
    const absolutePath = resolve(outputRoot, item.relativePath);
    writeFileAtomic(absolutePath, item.bytes);
    const retained = readFileSync(absolutePath);
    requireCondition(retained.toString("utf8") === item.bytes, `${key}: atomic read-back bytes differ`);
    requireCondition(sha256Hex(retained) === item.bytesSha256, `${key}: atomic read-back hash differs`);
    outputs[key] = {
      relativePath: item.relativePath,
      absolutePath,
      bytesSha256: item.bytesSha256,
      bytes: retained.length,
    };
  }
  const retainedFreeze = parseJsonBytes<Imp24BPreLiveFreeze>(
    readFileSync(outputs.freezeJson.absolutePath), "retained pre-live freeze",
  );
  const issues = validateImp24BPreLiveFreeze(retainedFreeze);
  requireCondition(issues.length === 0, `retained pre-live freeze is invalid: ${issues.join("; ")}`);
  requireCondition(canonicalJson(retainedFreeze) === canonicalJson(built.freeze),
    "retained pre-live freeze differs from the validated build");
  return {
    schema: "imp24c-pre-live-freeze-materialization-v1",
    freeze: built.freeze,
    outputs,
    modelCalls: 0,
    apiCalls: 0,
  };
}

/**
 * Rebuild the complete pre-live graph in memory and compare it with committed
 * artifacts. This function is deliberately read-only: CI uses it instead of
 * write-mode materialization so a terminal lifecycle attestation can never be
 * replaced (or even opened for writing) during reproduction.
 */
export function verifyImp24CPreLiveFreeze(
  options: BuildImp24BPreLiveFreezeOptions,
): Imp24CPreLiveFreezeVerification {
  const built = buildImp24BPreLiveFreeze(options);
  const repositoryRoot = resolve(options.repositoryRoot);
  const retainedRoot = resolve(options.retainedArtifactRoot ?? repositoryRoot);
  const outputRoot = resolve(options.outputRoot ?? repositoryRoot);

  for (const [key, expected] of Object.entries(built.outputs) as Array<[
    ArtifactOutputKey,
    { relativePath: string; bytes: string; bytesSha256: string },
  ]>) {
    const absolutePath = resolve(outputRoot, expected.relativePath);
    requireCondition(existsSync(absolutePath), `${key}: committed pre-live artifact is missing`);
    const actual = readFileSync(absolutePath);
    requireCondition(actual.toString("utf8") === expected.bytes,
      `${key}: committed pre-live artifact differs byte-for-byte from the deterministic build`);
    requireCondition(sha256Hex(actual) === expected.bytesSha256,
      `${key}: committed pre-live artifact hash differs from the deterministic build`);
  }

  for (const item of built.freeze.artifactManifest) {
    const candidates = [
      resolve(outputRoot, item.relativePath),
      resolve(retainedRoot, item.relativePath),
      resolve(repositoryRoot, item.relativePath),
    ];
    const absolutePath = candidates.find((candidate) => existsSync(candidate));
    requireCondition(absolutePath !== undefined,
      `artifact manifest entry is missing during verification: ${item.relativePath}`);
    const actual = readFileSync(absolutePath);
    requireCondition(actual.length === item.bytes,
      `artifact manifest byte length drift: ${item.relativePath}`);
    requireCondition(sha256Hex(actual) === item.bytesSha256,
      `artifact manifest bytes hash drift: ${item.relativePath}`);
    if (item.semanticSha256 !== null) {
      requireCondition(SHA256.test(item.semanticSha256) || SHA256_TAGGED.test(item.semanticSha256),
        `artifact manifest semantic hash is invalid: ${item.relativePath}`);
    }
  }

  const retainedFreeze = parseJsonBytes<Imp24BPreLiveFreeze>(
    readFileSync(resolve(outputRoot, IMP24C_PRE_LIVE_ARTIFACT_PATHS.freezeJson)),
    "committed IMP-24C pre-live freeze",
  );
  const issues = validateImp24BPreLiveFreeze(retainedFreeze);
  requireCondition(issues.length === 0, `committed pre-live freeze is invalid: ${issues.join("; ")}`);
  requireCondition(canonicalJson(retainedFreeze) === canonicalJson(built.freeze),
    "committed pre-live freeze differs from the in-memory deterministic build");

  return {
    schema: "imp24c-pre-live-freeze-verification-v1",
    status: "VERIFIED_BYTE_IDENTICAL_MODEL_FREE_PRE_LIVE",
    freezeSha256: built.freeze.freezeSha256,
    verifiedOutputCount: Object.keys(built.outputs).length,
    verifiedManifestEntryCount: built.freeze.artifactManifest.length,
    writes: 0,
    modelCalls: 0,
    apiCalls: 0,
  };
}
