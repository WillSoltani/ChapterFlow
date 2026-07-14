/**
 * IMP-24D model-free observability-recovery freeze.
 *
 * This lifecycle layer deliberately does not regenerate IMP-24C's historical
 * pre-live artifacts and never creates the r2 state root. It binds the exact r1
 * closure, proves that the semantic qualification denominator is unchanged,
 * and records the current implementation seal/certification/parity that must
 * pass exact-commit CI before the separately authorized transport smoke.
 */

import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import { relative, resolve, sep } from "node:path";

import { canonicalJson, hashCanonical, sha256Hex } from "../../contracts/contractUtil.js";
import { writeFileAtomic } from "../../lib/atomicWrite.js";
import { canonicalPretty } from "./corpusBuilderCore.js";
import {
  IMP24_CERTIFICATION_ARTIFACT_PATHS,
  certifyImp24Instrument,
  validateImp24InstrumentCertificationBinding,
  type Imp24InstrumentCertificationBinding,
} from "./imp24InstrumentCertification.js";
import {
  IMP24C_PRE_LIVE_ARTIFACT_PATHS,
  validateImp24BPreLiveFreeze,
  type Imp24BPreLiveFreeze,
} from "./imp24PreLiveFreeze.js";
import {
  IMP24_ROLE_QUALIFICATION_PROTOCOL_ID,
  IMP24_ROLE_QUALIFICATION_R1_EXECUTION_ID,
  IMP24_ROLE_QUALIFICATION_R2_EXECUTION_ID,
} from "./imp24Corpus.js";
import {
  IMP24_ROLE_CANDIDATE_ORDER_SHA256,
  IMP24_ROLE_QUALIFICATION_CALL_BUDGET_SHA256,
} from "./roleQualificationRunnerV3.js";
import {
  IMP24_CANDIDATE_AVAILABILITY_POLICY_BYTES_SHA256,
} from "../../orchestrator/forwardRoleQualificationLiveV3.js";
import {
  IMP24_FORWARD_PRODUCTION_INSTRUMENT_SEAL_ARTIFACT_REL_PATH,
  verifyRetainedForwardProductionInstrumentSeal,
} from "../../orchestrator/forwardProductionInstrumentSeal.js";

export const IMP24D_OBSERVABILITY_FREEZE_SCHEMA = "imp24d-observability-freeze-v1" as const;
export const IMP24D_OBSERVABILITY_FREEZE_STATUS = "FROZEN_MODEL_FREE_OBSERVABILITY_RECOVERY" as const;
export const IMP24D_STARTING_HEAD = "3b060fb0a7f6e64e04386b84ff6b5a10e42868ec" as const;
export const IMP24D_BRANCH = "feat/v25-pipeline-live" as const;
export const IMP24D_DRAFT_PR = 401 as const;

const PIPELINE_REL = "scripts/book/prompts/chapterflow-v24-author-pipeline";
const REPORTS_REL = "docs/v25/reports";
const R1_STATE_ROOT_REL = `${PIPELINE_REL}/state/migration-experiments/${IMP24_ROLE_QUALIFICATION_R1_EXECUTION_ID}`;
const R2_STATE_ROOT_REL = `${PIPELINE_REL}/state/migration-experiments/${IMP24_ROLE_QUALIFICATION_R2_EXECUTION_ID}`;

export const IMP24D_R1_CLOSURE_PATHS = Object.freeze({
  json: `${REPORTS_REL}/IMP-24C_R1_OBSERVABILITY_GAP.json`,
  markdown: `${REPORTS_REL}/IMP-24C_R1_OBSERVABILITY_GAP.md`,
});

export const IMP24D_OBSERVABILITY_FREEZE_PATHS = Object.freeze({
  json: `${REPORTS_REL}/IMP-24D_OBSERVABILITY_FREEZE.json`,
  markdown: `${REPORTS_REL}/IMP-24D_OBSERVABILITY_FREEZE.md`,
});

export const IMP24D_R1_CLOSURE_BYTES_SHA256 = Object.freeze({
  json: "c54e9bd566043ebb733826dcb7bf8b4098c560c93a54fa322dbc0c29d49c47f4",
  markdown: "50f31e16a266445e8c3d8ab16147046270a973b414dc92408cd6607c9ab051ee",
});

/** These exact Commit-A bytes are historical evidence, not materializer
 * outputs. Pinning them prevents an r2 remint from rewriting r1 history. */
export const IMP24D_HISTORICAL_R1_BINDINGS = Object.freeze({
  preLiveFreezeJson: {
    relativePath: IMP24C_PRE_LIVE_ARTIFACT_PATHS.freezeJson,
    bytesSha256: "06ca9f6e9e191b829efa14244ac038b610d4546230c3a88749f17811d1929eb5",
  },
  preLiveFreezeMarkdown: {
    relativePath: IMP24C_PRE_LIVE_ARTIFACT_PATHS.freezeMarkdown,
    bytesSha256: "5c24c1892fb0a984a9c8bd3d010d88d715f593740c556ca9630c69c0ad327d91",
  },
  preliminaryReport: {
    relativePath: IMP24C_PRE_LIVE_ARTIFACT_PATHS.implementationReport,
    bytesSha256: "7cde3f57fc246e9a323a7ba7d1501cb47f9ef9cf74c6164965d8cb0e571191a2",
  },
  r1ExecutionSpec: {
    relativePath: IMP24C_PRE_LIVE_ARTIFACT_PATHS.executionSpec,
    bytesSha256: "1396924c5f18134531ec8999365dab44258cc340a799497086f3f89f9772ff76",
  },
});

const EXPECTED_PROMPT_BUNDLE_SHA256 = "4da98a79943739dd223f12f5ff7c33bd238a114f065bdd09bfcffa66925aae00";
const EXPECTED_SCHEMA_BUNDLE_SHA256 = "f88f1b13ba263c670474385635ecd44511aaa07eec31074fe27905307b536798";
const SHA256 = /^[a-f0-9]{64}$/;

type JsonObject = Record<string, unknown>;
type ArtifactBinding = { relativePath: string; bytes: number; bytesSha256: string };
export type FrozenSemanticBindings = Pick<Imp24BPreLiveFreeze["configurationHashes"],
  | "corpusBundleSha256"
  | "corpusPartitionHashes"
  | "corpusAuditAgreementSha256"
  | "promptBundleHashes"
  | "schemaInventorySha256"
  | "thresholdsSha256"
  | "candidateOrderSha256"
  | "candidateAvailabilityPolicySha256"
  | "scheduleSha256"
  | "callBudgetSha256"
>;

export type Imp24DObservabilityFreezeCore = {
  schema: typeof IMP24D_OBSERVABILITY_FREEZE_SCHEMA;
  status: typeof IMP24D_OBSERVABILITY_FREEZE_STATUS;
  promptId: "IMP-24";
  continuationPromptId: "IMP-24D";
  branch: typeof IMP24D_BRANCH;
  draftPullRequest: typeof IMP24D_DRAFT_PR;
  startingHead: typeof IMP24D_STARTING_HEAD;
  protocolId: typeof IMP24_ROLE_QUALIFICATION_PROTOCOL_ID;
  historicalR1: {
    executionId: typeof IMP24_ROLE_QUALIFICATION_R1_EXECUTION_ID;
    disposition: "BLOCKED_OBSERVABILITY_INCOMPLETE";
    mayResume: false;
    mayQualifyProfiles: false;
    stateRoot: typeof R1_STATE_ROOT_REL;
    preLiveFreezeSha256: string;
    historicalArtifacts: ArtifactBinding[];
    closureJson: ArtifactBinding;
    closureMarkdown: ArtifactBinding;
  };
  currentImplementation: {
    productionInstrumentSealSha256: string;
    productionInstrumentSealBytesSha256: string;
    certificationSha256: string;
    certificationBytesSha256: string;
    productionQualificationParitySha256: string;
    productionQualificationParityBytesSha256: string;
  };
  frozenSemantics: FrozenSemanticBindings;
  semanticAssertions: {
    corpusUnchanged: true;
    promptsUnchanged: true;
    schemasUnchanged: true;
    goldUnchanged: true;
    thresholdsUnchanged: true;
    candidateOrderUnchanged: true;
    candidateAvailabilityPolicyUnchanged: true;
    scheduleUnchanged: true;
    callBudgetUnchanged: true;
  };
  successor: {
    executionId: typeof IMP24_ROLE_QUALIFICATION_R2_EXECUTION_ID;
    stateRoot: typeof R2_STATE_ROOT_REL;
    stateRootCreatedByMaterializer: false;
    mayCreateBeforeTransportSmokePass: false;
    transportSmokeRequired: true;
    transportSmokePassedAtFreeze: false;
  };
  capabilities: {
    modelCalls: 0;
    apiCalls: 0;
    publish: false;
    promote: false;
    deploy: false;
    upload: false;
    merge: false;
    forcePush: false;
  };
};

export type Imp24DObservabilityFreeze = Imp24DObservabilityFreezeCore & {
  freezeSha256: string;
};

export type BuildImp24DObservabilityFreezeOptions = {
  repositoryRoot: string;
  retainedArtifactRoot?: string;
  outputRoot?: string;
};

export type VerifyHistoricalImp24DObservabilityFreezeOptions =
  BuildImp24DObservabilityFreezeOptions & {
    /** Exact Commit A that first retained the observability freeze. */
    observabilityImplementationCommit: string;
  };

export type Imp24DHistoricalObservabilityFreezeVerification = {
  status: "VERIFIED_BYTE_IDENTICAL_HISTORICAL_OBSERVABILITY_FREEZE";
  observabilityImplementationCommit: string;
  freezeSha256: string;
  frozenSemanticsSha256: string;
  originalImplementation: Imp24DObservabilityFreeze["currentImplementation"];
  effectiveImplementation: Imp24DObservabilityFreeze["currentImplementation"];
  verifiedOutputCount: 2;
  writes: 0;
  modelCalls: 0;
  apiCalls: 0;
};

export type Imp24DObservabilityFreezeBuild = {
  freeze: Imp24DObservabilityFreeze;
  outputs: Record<keyof typeof IMP24D_OBSERVABILITY_FREEZE_PATHS, {
    relativePath: string;
    bytes: string;
    bytesSha256: string;
  }>;
  modelCalls: 0;
  apiCalls: 0;
};

export class Imp24DObservabilityFreezeError extends Error {
  readonly classification = "STATE_OR_PROVENANCE" as const;
  constructor(message: string) {
    super(message);
    this.name = "Imp24DObservabilityFreezeError";
  }
}

function requireCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Imp24DObservabilityFreezeError(message);
}

function asObject(value: unknown, label: string): JsonObject {
  requireCondition(value !== null && typeof value === "object" && !Array.isArray(value), `${label} must be an object`);
  return value as JsonObject;
}

function readBytes(root: string, relativePath: string, label: string): Buffer {
  const path = resolve(root, relativePath);
  requireCondition(existsSync(path), `${label} is missing: ${relativePath}`);
  return readFileSync(path);
}

function readJson(root: string, relativePath: string, label: string): { value: JsonObject; bytes: Buffer } {
  const bytes = readBytes(root, relativePath, label);
  let value: unknown;
  try { value = JSON.parse(bytes.toString("utf8")); }
  catch (error) { throw new Imp24DObservabilityFreezeError(`${label} is not JSON: ${(error as Error).message}`); }
  return { value: asObject(value, label), bytes };
}

function readGitBlob(repositoryRoot: string, commit: string, relativePath: string, label: string): Buffer {
  requireCondition(/^[a-f0-9]{40}$/.test(commit), `${label} commit must be an exact lowercase Git SHA`);
  try {
    return execFileSync("git", ["show", `${commit}:${relativePath}`], {
      cwd: resolve(repositoryRoot),
      encoding: "buffer",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (error) {
    throw new Imp24DObservabilityFreezeError(
      `${label} is not a committed blob at ${commit}: ${relativePath}; ${(error as Error).message}`,
    );
  }
}

function requireAncestor(repositoryRoot: string, ancestor: string): void {
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", ancestor, "HEAD"], {
      cwd: resolve(repositoryRoot),
      stdio: ["ignore", "ignore", "pipe"],
    });
  } catch {
    throw new Imp24DObservabilityFreezeError(
      `observability implementation commit is not an ancestor of the current checkout: ${ancestor}`,
    );
  }
}

function binding(root: string, relativePath: string, label: string): ArtifactBinding {
  const bytes = readBytes(root, relativePath, label);
  return { relativePath, bytes: bytes.length, bytesSha256: sha256Hex(bytes) };
}

function validateR1Closure(value: JsonObject): void {
  requireCondition(value.schema === "imp-24c-r1-observability-gap-v1", "r1 closure schema mismatch");
  requireCondition(value.protocolId === IMP24_ROLE_QUALIFICATION_PROTOCOL_ID, "r1 closure protocol mismatch");
  requireCondition(value.executionId === IMP24_ROLE_QUALIFICATION_R1_EXECUTION_ID, "r1 closure execution mismatch");
  requireCondition(value.disposition === "BLOCKED_OBSERVABILITY_INCOMPLETE", "r1 closure disposition mismatch");
  requireCondition(value.branch === IMP24D_BRANCH && value.startingHead === IMP24D_STARTING_HEAD
    && value.draftPullRequest === IMP24D_DRAFT_PR, "r1 closure lifecycle identity mismatch");
  const closure = asObject(value.closure, "r1 closure controls");
  requireCondition(closure.mayResume === false && closure.mayQualifyProfiles === false
    && closure.attemptsImmutable === true && closure.stderrMayBeFabricated === false,
  "r1 closure does not freeze the failed attempts and missing stderr truthfully");
  const counters = asObject(value.counters, "r1 closure counters");
  requireCondition(counters.canaryCallsAttempted === 2 && counters.holdoutCalls === 0
    && counters.brokerRequests === 2 && counters.codexExecInvocations === 2
    && counters.cachedReceipts === 0 && counters.infrastructureReplays === 0
    && counters.maxPlanCapacityEvents === 0 && counters.apiCalls === 0
    && counters.rolesQualified === 0 && counters.successfulStructuredResponses === 0,
  "r1 closure counters differ from the retained two-call observability failure");
  const attempts = value.attempts;
  requireCondition(Array.isArray(attempts) && attempts.length === 2, "r1 closure must bind exactly two attempts");
  const inventory = asObject(value.artifactInventory, "r1 closure artifact inventory");
  requireCondition(inventory.fileCount === 26
    && inventory.recoveryACommittedFileCount === 1
    && inventory.postRecoveryARetainedFileCount === 25
    && inventory.totalBytes === 327951
    && Array.isArray(inventory.files) && inventory.files.length === 26,
  "r1 closure must bind the exact 26-file retained tree (one committed execution spec plus 25 post-A files)");
}

function validateExactR1Tree(retainedRoot: string, closure: JsonObject): void {
  const root = resolve(retainedRoot, R1_STATE_ROOT_REL);
  requireCondition(existsSync(root), `historical r1 state root is missing: ${R1_STATE_ROOT_REL}`);
  const actual: Array<{ path: string; bytes: number; bytesSha256: string }> = [];
  const walk = (directory: string): void => {
    for (const name of readdirSync(directory).sort()) {
      const path = resolve(directory, name);
      const stat = lstatSync(path);
      requireCondition(!stat.isSymbolicLink(),
        `historical r1 state tree contains a symlink: ${relative(root, path)}`);
      if (stat.isDirectory()) {
        walk(path);
      } else {
        requireCondition(stat.isFile(),
          `historical r1 state tree contains a non-file entry: ${relative(root, path)}`);
        const bytes = readFileSync(path);
        actual.push({
          path: relative(root, path).split(sep).join("/"),
          bytes: bytes.length,
          bytesSha256: sha256Hex(bytes),
        });
      }
    }
  };
  walk(root);
  actual.sort((left, right) => left.path.localeCompare(right.path));

  const inventory = asObject(closure.artifactInventory, "r1 closure artifact inventory");
  requireCondition(Array.isArray(inventory.files), "r1 closure artifact inventory has no files array");
  const declared = inventory.files.map((item, index) => {
    const entry = asObject(item, `r1 closure artifact inventory file ${index}`);
    requireCondition(Object.keys(entry).sort().join("\n") === ["bytes", "bytesSha256", "path"].sort().join("\n")
        && typeof entry.path === "string" && entry.path.length > 0
        && !entry.path.startsWith("/") && !entry.path.split("/").includes("..")
        && Number.isSafeInteger(entry.bytes) && (entry.bytes as number) >= 0
        && typeof entry.bytesSha256 === "string" && SHA256.test(entry.bytesSha256),
    `r1 closure artifact inventory file ${index} is invalid`);
    return {
      path: entry.path as string,
      bytes: entry.bytes as number,
      bytesSha256: entry.bytesSha256 as string,
    };
  }).sort((left, right) => left.path.localeCompare(right.path));
  requireCondition(canonicalJson(actual) === canonicalJson(declared),
    "historical r1 state tree differs byte-for-byte from the immutable closure inventory");
  requireCondition(actual.length === inventory.fileCount
      && actual.reduce((sum, item) => sum + item.bytes, 0) === inventory.totalBytes,
  "historical r1 state tree count/byte total differs from the immutable closure inventory");
}

function projectFrozenSemantics(
  hashes: Imp24BPreLiveFreeze["configurationHashes"],
): FrozenSemanticBindings {
  return {
    corpusBundleSha256: hashes.corpusBundleSha256,
    corpusPartitionHashes: hashes.corpusPartitionHashes,
    corpusAuditAgreementSha256: hashes.corpusAuditAgreementSha256,
    promptBundleHashes: hashes.promptBundleHashes,
    schemaInventorySha256: hashes.schemaInventorySha256,
    thresholdsSha256: hashes.thresholdsSha256,
    candidateOrderSha256: hashes.candidateOrderSha256,
    candidateAvailabilityPolicySha256: hashes.candidateAvailabilityPolicySha256,
    scheduleSha256: hashes.scheduleSha256,
    callBudgetSha256: hashes.callBudgetSha256,
  };
}

function historicalR1Artifacts(retainedRoot: string): ArtifactBinding[] {
  return Object.values(IMP24D_HISTORICAL_R1_BINDINGS).map((expected) => {
    const actual = binding(retainedRoot, expected.relativePath, "historical r1 lifecycle artifact");
    requireCondition(actual.bytesSha256 === expected.bytesSha256,
      `historical r1 lifecycle artifact bytes drifted: ${expected.relativePath}`);
    return actual;
  });
}

function assertSemanticContinuity(args: {
  historical: Imp24BPreLiveFreeze;
  certification: ReturnType<typeof certifyImp24Instrument>;
}): void {
  const historical = args.historical.configurationHashes;
  const current = args.certification.report;
  requireCondition(current.binding.corpusBundleSha256 === historical.corpusBundleSha256,
    "corpus bundle changed across the observability-only recovery");
  requireCondition(canonicalJson(current.frozenInputHashes.corpusPartitions)
    === canonicalJson(historical.corpusPartitionHashes),
  "corpus partitions changed across the observability-only recovery");
  requireCondition(current.binding.promptBundleSha256 === EXPECTED_PROMPT_BUNDLE_SHA256,
    "prompt bundle changed across the observability-only recovery");
  requireCondition(current.binding.schemaBundleSha256 === EXPECTED_SCHEMA_BUNDLE_SHA256,
    "output schema bundle changed across the observability-only recovery");
  requireCondition(current.binding.thresholdsSha256 === historical.thresholdsSha256,
    "thresholds changed across the observability-only recovery");
  requireCondition(current.frozenInputHashes.candidateOrderSha256 === historical.candidateOrderSha256
    && current.frozenInputHashes.candidateOrderSha256 === IMP24_ROLE_CANDIDATE_ORDER_SHA256,
  "candidate order changed across the observability-only recovery");
  requireCondition(IMP24_CANDIDATE_AVAILABILITY_POLICY_BYTES_SHA256
    === historical.candidateAvailabilityPolicySha256,
  "candidate availability policy changed across the observability-only recovery");
  requireCondition(current.frozenInputHashes.scheduleSha256 === historical.scheduleSha256,
    "qualification schedule changed across the observability-only recovery");
  requireCondition(current.frozenInputHashes.callBudgetSha256 === historical.callBudgetSha256
    && current.frozenInputHashes.callBudgetSha256 === IMP24_ROLE_QUALIFICATION_CALL_BUDGET_SHA256,
  "qualification call budget changed across the observability-only recovery");
}

function verifyCurrentImplementationArtifacts(
  repositoryRoot: string,
  retainedRoot: string,
): {
  certification: ReturnType<typeof certifyImp24Instrument>;
  currentImplementation: Imp24DObservabilityFreeze["currentImplementation"];
} {
  const sealPath = resolve(retainedRoot, IMP24_FORWARD_PRODUCTION_INSTRUMENT_SEAL_ARTIFACT_REL_PATH);
  const seal = verifyRetainedForwardProductionInstrumentSeal({ repositoryRoot, outputPath: sealPath });
  const certification = certifyImp24Instrument({
    repositoryRoot,
    corpusBundlePath: resolve(retainedRoot, IMP24_CERTIFICATION_ARTIFACT_PATHS.corpusBundle),
    thresholdsPath: resolve(retainedRoot, IMP24_CERTIFICATION_ARTIFACT_PATHS.thresholds),
    productionSealPath: sealPath,
  });
  const retainedCertification = readJson(retainedRoot, IMP24_CERTIFICATION_ARTIFACT_PATHS.certificationBinding,
    "current model-free certification binding");
  const certificationBinding = retainedCertification.value as unknown as Imp24InstrumentCertificationBinding;
  const certificationIssues = validateImp24InstrumentCertificationBinding(certificationBinding);
  requireCondition(certificationIssues.length === 0,
    `retained current certification is invalid: ${certificationIssues.join("; ")}`);
  requireCondition(canonicalJson(certificationBinding) === canonicalJson(certification.report.binding),
    "retained current certification differs from the model-free recomputation");
  const retainedParity = readJson(retainedRoot, IMP24_CERTIFICATION_ARTIFACT_PATHS.productionQualificationParity,
    "current production/qualification parity");
  requireCondition(canonicalJson(retainedParity.value)
    === canonicalJson(certification.productionQualificationParity),
  "retained current production/qualification parity differs from the model-free recomputation");
  requireCondition(certification.report.binding.productionInstrumentSealSha256 === seal.sealSha256,
    "current certification does not bind the current production seal");
  requireCondition(certification.report.binding.productionQualificationParitySha256
    === certification.productionQualificationParity.paritySha256,
  "current certification does not bind the current production/qualification parity");

  return {
    certification,
    currentImplementation: {
      productionInstrumentSealSha256: seal.sealSha256,
      productionInstrumentSealBytesSha256: seal.artifactBytesSha256,
      certificationSha256: certificationBinding.certificationSha256,
      certificationBytesSha256: sha256Hex(retainedCertification.bytes),
      productionQualificationParitySha256: certification.productionQualificationParity.paritySha256,
      productionQualificationParityBytesSha256: sha256Hex(retainedParity.bytes),
    },
  };
}

function renderMarkdown(freeze: Imp24DObservabilityFreeze): string {
  return [
    "# IMP-24D observability recovery freeze",
    "",
    `Status: **${freeze.status}**`,
    "",
    `Historical execution: \`${freeze.historicalR1.executionId}\` — **${freeze.historicalR1.disposition}**`,
    `Current successor identity: \`${freeze.successor.executionId}\``,
    `Production seal: \`${freeze.currentImplementation.productionInstrumentSealSha256}\``,
    `Model-free certification: \`${freeze.currentImplementation.certificationSha256}\``,
    `Production/qualification parity: \`${freeze.currentImplementation.productionQualificationParitySha256}\``,
    `Freeze SHA-256: \`${freeze.freezeSha256}\``,
    "",
    "The r1 artifacts are historical and immutable. This materializer creates no r2 state root. The r2 root may be created only after both diagnostic transport-smoke calls pass under exact-commit V25 CI.",
    "",
    "Model calls: **0**. API calls: **0**.",
    "",
  ].join("\n");
}

export function validateImp24DObservabilityFreeze(value: unknown): string[] {
  const issues: string[] = [];
  if (value === null || typeof value !== "object" || Array.isArray(value)) return ["freeze must be an object"];
  const freeze = value as Imp24DObservabilityFreeze;
  if (freeze.schema !== IMP24D_OBSERVABILITY_FREEZE_SCHEMA) issues.push("schema mismatch");
  if (freeze.status !== IMP24D_OBSERVABILITY_FREEZE_STATUS) issues.push("status mismatch");
  if (freeze.promptId !== "IMP-24" || freeze.continuationPromptId !== "IMP-24D") issues.push("prompt identity mismatch");
  if (freeze.branch !== IMP24D_BRANCH || freeze.draftPullRequest !== IMP24D_DRAFT_PR
      || freeze.startingHead !== IMP24D_STARTING_HEAD) issues.push("lifecycle identity mismatch");
  if (freeze.protocolId !== IMP24_ROLE_QUALIFICATION_PROTOCOL_ID) issues.push("protocol identity mismatch");
  if (freeze.historicalR1?.executionId !== IMP24_ROLE_QUALIFICATION_R1_EXECUTION_ID
      || freeze.historicalR1?.disposition !== "BLOCKED_OBSERVABILITY_INCOMPLETE"
      || freeze.historicalR1?.mayResume !== false || freeze.historicalR1?.mayQualifyProfiles !== false) {
    issues.push("historical r1 closure mismatch");
  }
  if (freeze.successor?.executionId !== IMP24_ROLE_QUALIFICATION_R2_EXECUTION_ID
      || freeze.successor?.stateRootCreatedByMaterializer !== false
      || freeze.successor?.mayCreateBeforeTransportSmokePass !== false
      || freeze.successor?.transportSmokeRequired !== true
      || freeze.successor?.transportSmokePassedAtFreeze !== false) issues.push("r2 smoke gate mismatch");
  const expectedSemanticAssertions: Imp24DObservabilityFreezeCore["semanticAssertions"] = {
    corpusUnchanged: true,
    promptsUnchanged: true,
    schemasUnchanged: true,
    goldUnchanged: true,
    thresholdsUnchanged: true,
    candidateOrderUnchanged: true,
    candidateAvailabilityPolicyUnchanged: true,
    scheduleUnchanged: true,
    callBudgetUnchanged: true,
  };
  if (canonicalJson(freeze.semanticAssertions) !== canonicalJson(expectedSemanticAssertions)) {
    issues.push("semantic assertion mismatch");
  }
  if (freeze.capabilities?.modelCalls !== 0 || freeze.capabilities?.apiCalls !== 0
      || Object.entries(freeze.capabilities ?? {}).some(([key, item]) =>
        key !== "modelCalls" && key !== "apiCalls" && item !== false)) issues.push("capability boundary mismatch");
  for (const valueSha of [
    freeze.currentImplementation?.productionInstrumentSealSha256,
    freeze.currentImplementation?.productionInstrumentSealBytesSha256,
    freeze.currentImplementation?.certificationSha256,
    freeze.currentImplementation?.certificationBytesSha256,
    freeze.currentImplementation?.productionQualificationParitySha256,
    freeze.currentImplementation?.productionQualificationParityBytesSha256,
    freeze.historicalR1?.preLiveFreezeSha256,
  ]) if (typeof valueSha !== "string" || !SHA256.test(valueSha)) issues.push("invalid SHA-256 binding");
  if (typeof freeze.freezeSha256 !== "string" || !SHA256.test(freeze.freezeSha256)) issues.push("freeze SHA-256 missing");
  else {
    const { freezeSha256: _ignored, ...core } = freeze;
    if (hashCanonical(core) !== freeze.freezeSha256) issues.push("freeze self-hash mismatch");
  }
  return [...new Set(issues)];
}

export function buildImp24DObservabilityFreeze(
  options: BuildImp24DObservabilityFreezeOptions,
): Imp24DObservabilityFreezeBuild {
  const repositoryRoot = resolve(options.repositoryRoot);
  const retainedRoot = resolve(options.retainedArtifactRoot ?? repositoryRoot);
  const historicalInput = readJson(retainedRoot, IMP24C_PRE_LIVE_ARTIFACT_PATHS.freezeJson,
    "historical IMP-24C pre-live freeze");
  const historical = historicalInput.value as unknown as Imp24BPreLiveFreeze;
  const historicalIssues = validateImp24BPreLiveFreeze(historical);
  requireCondition(historicalIssues.length === 0,
    `historical IMP-24C pre-live freeze is invalid: ${historicalIssues.join("; ")}`);
  requireCondition(sha256Hex(historicalInput.bytes)
    === IMP24D_HISTORICAL_R1_BINDINGS.preLiveFreezeJson.bytesSha256,
  "historical IMP-24C pre-live freeze bytes drifted");

  const closure = readJson(retainedRoot, IMP24D_R1_CLOSURE_PATHS.json, "r1 observability closure");
  validateR1Closure(closure.value);
  validateExactR1Tree(retainedRoot, closure.value);
  const closureMarkdown = binding(retainedRoot, IMP24D_R1_CLOSURE_PATHS.markdown, "r1 observability closure Markdown");
  requireCondition(sha256Hex(closure.bytes) === IMP24D_R1_CLOSURE_BYTES_SHA256.json,
    "r1 observability closure JSON bytes drifted");
  requireCondition(closureMarkdown.bytesSha256 === IMP24D_R1_CLOSURE_BYTES_SHA256.markdown,
    "r1 observability closure Markdown bytes drifted");

  const current = verifyCurrentImplementationArtifacts(repositoryRoot, retainedRoot);
  assertSemanticContinuity({ historical, certification: current.certification });

  const core: Imp24DObservabilityFreezeCore = {
    schema: IMP24D_OBSERVABILITY_FREEZE_SCHEMA,
    status: IMP24D_OBSERVABILITY_FREEZE_STATUS,
    promptId: "IMP-24",
    continuationPromptId: "IMP-24D",
    branch: IMP24D_BRANCH,
    draftPullRequest: IMP24D_DRAFT_PR,
    startingHead: IMP24D_STARTING_HEAD,
    protocolId: IMP24_ROLE_QUALIFICATION_PROTOCOL_ID,
    historicalR1: {
      executionId: IMP24_ROLE_QUALIFICATION_R1_EXECUTION_ID,
      disposition: "BLOCKED_OBSERVABILITY_INCOMPLETE",
      mayResume: false,
      mayQualifyProfiles: false,
      stateRoot: R1_STATE_ROOT_REL,
      preLiveFreezeSha256: historical.freezeSha256,
      historicalArtifacts: historicalR1Artifacts(retainedRoot),
      closureJson: {
        relativePath: IMP24D_R1_CLOSURE_PATHS.json,
        bytes: closure.bytes.length,
        bytesSha256: sha256Hex(closure.bytes),
      },
      closureMarkdown,
    },
    currentImplementation: current.currentImplementation,
    frozenSemantics: projectFrozenSemantics(historical.configurationHashes),
    semanticAssertions: {
      corpusUnchanged: true,
      promptsUnchanged: true,
      schemasUnchanged: true,
      goldUnchanged: true,
      thresholdsUnchanged: true,
      candidateOrderUnchanged: true,
      candidateAvailabilityPolicyUnchanged: true,
      scheduleUnchanged: true,
      callBudgetUnchanged: true,
    },
    successor: {
      executionId: IMP24_ROLE_QUALIFICATION_R2_EXECUTION_ID,
      stateRoot: R2_STATE_ROOT_REL,
      stateRootCreatedByMaterializer: false,
      mayCreateBeforeTransportSmokePass: false,
      transportSmokeRequired: true,
      transportSmokePassedAtFreeze: false,
    },
    capabilities: {
      modelCalls: 0,
      apiCalls: 0,
      publish: false,
      promote: false,
      deploy: false,
      upload: false,
      merge: false,
      forcePush: false,
    },
  };
  const freeze: Imp24DObservabilityFreeze = { ...core, freezeSha256: hashCanonical(core) };
  const issues = validateImp24DObservabilityFreeze(freeze);
  requireCondition(issues.length === 0, `built IMP-24D observability freeze is invalid: ${issues.join("; ")}`);
  const jsonBytes = canonicalPretty(freeze);
  const markdownBytes = renderMarkdown(freeze);
  return {
    freeze,
    outputs: {
      json: { relativePath: IMP24D_OBSERVABILITY_FREEZE_PATHS.json, bytes: jsonBytes, bytesSha256: sha256Hex(jsonBytes) },
      markdown: { relativePath: IMP24D_OBSERVABILITY_FREEZE_PATHS.markdown, bytes: markdownBytes, bytesSha256: sha256Hex(markdownBytes) },
    },
    modelCalls: 0,
    apiCalls: 0,
  };
}

export function materializeImp24DObservabilityFreeze(
  options: BuildImp24DObservabilityFreezeOptions,
): Imp24DObservabilityFreezeBuild {
  const repositoryRoot = resolve(options.repositoryRoot);
  const r2Root = resolve(repositoryRoot, R2_STATE_ROOT_REL);
  requireCondition(!existsSync(r2Root),
    "IMP-24D observability freeze must be materialized before the r2 state root exists");
  const built = buildImp24DObservabilityFreeze(options);
  const outputRoot = resolve(options.outputRoot ?? repositoryRoot);
  for (const output of Object.values(built.outputs)) {
    const path = resolve(outputRoot, output.relativePath);
    writeFileAtomic(path, output.bytes);
    requireCondition(readFileSync(path, "utf8") === output.bytes,
      `IMP-24D observability freeze atomic read-back drift: ${output.relativePath}`);
  }
  return built;
}

export function verifyImp24DObservabilityFreeze(
  options: BuildImp24DObservabilityFreezeOptions,
): { status: "VERIFIED_BYTE_IDENTICAL_OBSERVABILITY_FREEZE"; freezeSha256: string; verifiedOutputCount: 2; writes: 0; modelCalls: 0; apiCalls: 0 } {
  const built = buildImp24DObservabilityFreeze(options);
  const outputRoot = resolve(options.outputRoot ?? options.repositoryRoot);
  for (const output of Object.values(built.outputs)) {
    const path = resolve(outputRoot, output.relativePath);
    requireCondition(existsSync(path), `committed observability freeze output is missing: ${output.relativePath}`);
    const retained = readFileSync(path);
    requireCondition(retained.toString("utf8") === output.bytes && sha256Hex(retained) === output.bytesSha256,
      `committed observability freeze output differs byte-for-byte: ${output.relativePath}`);
  }
  return {
    status: "VERIFIED_BYTE_IDENTICAL_OBSERVABILITY_FREEZE",
    freezeSha256: built.freeze.freezeSha256,
    verifiedOutputCount: 2,
    writes: 0,
    modelCalls: 0,
    apiCalls: 0,
  };
}

/**
 * Verify Commit A from a later correction/evidence/final checkout.
 *
 * The retained freeze is deliberately compared to its original Git blobs,
 * while the current seal/certification/parity are recomputed independently.
 * Only the frozen semantic projection is required to remain equal across a
 * deterministic remint; code-bound instrument identities are expected to
 * change after the one permitted mechanical correction.
 */
export function verifyHistoricalImp24DObservabilityFreeze(
  options: VerifyHistoricalImp24DObservabilityFreezeOptions,
): Imp24DHistoricalObservabilityFreezeVerification {
  const repositoryRoot = resolve(options.repositoryRoot);
  const retainedRoot = resolve(options.retainedArtifactRoot ?? repositoryRoot);
  const outputRoot = resolve(options.outputRoot ?? retainedRoot);
  requireAncestor(repositoryRoot, options.observabilityImplementationCommit);

  const retainedJson = readJson(outputRoot, IMP24D_OBSERVABILITY_FREEZE_PATHS.json,
    "retained historical IMP-24D observability freeze");
  const retainedFreeze = retainedJson.value as unknown as Imp24DObservabilityFreeze;
  const issues = validateImp24DObservabilityFreeze(retainedFreeze);
  requireCondition(issues.length === 0,
    `retained historical IMP-24D observability freeze is invalid: ${issues.join("; ")}`);
  const retainedMarkdown = readBytes(outputRoot, IMP24D_OBSERVABILITY_FREEZE_PATHS.markdown,
    "retained historical IMP-24D observability freeze Markdown");
  requireCondition(retainedMarkdown.toString("utf8") === renderMarkdown(retainedFreeze),
    "retained historical IMP-24D observability freeze Markdown rendering drift");

  const commitJson = readGitBlob(repositoryRoot, options.observabilityImplementationCommit,
    IMP24D_OBSERVABILITY_FREEZE_PATHS.json, "historical observability freeze");
  const commitMarkdown = readGitBlob(repositoryRoot, options.observabilityImplementationCommit,
    IMP24D_OBSERVABILITY_FREEZE_PATHS.markdown, "historical observability freeze Markdown");
  requireCondition(commitJson.equals(retainedJson.bytes) && commitMarkdown.equals(retainedMarkdown),
    "retained observability freeze differs byte-for-byte from the original observability implementation commit");

  const originalSealBytes = readGitBlob(repositoryRoot, options.observabilityImplementationCommit,
    IMP24_FORWARD_PRODUCTION_INSTRUMENT_SEAL_ARTIFACT_REL_PATH, "historical production instrument seal");
  const originalCertificationBytes = readGitBlob(repositoryRoot, options.observabilityImplementationCommit,
    IMP24_CERTIFICATION_ARTIFACT_PATHS.certificationBinding, "historical model-free certification");
  const originalParityBytes = readGitBlob(repositoryRoot, options.observabilityImplementationCommit,
    IMP24_CERTIFICATION_ARTIFACT_PATHS.productionQualificationParity, "historical production/qualification parity");
  const originalSeal = asObject(JSON.parse(originalSealBytes.toString("utf8")), "historical production instrument seal");
  const originalCertification = asObject(JSON.parse(originalCertificationBytes.toString("utf8")),
    "historical model-free certification");
  const originalParity = asObject(JSON.parse(originalParityBytes.toString("utf8")),
    "historical production/qualification parity");
  requireCondition(
    sha256Hex(originalSealBytes) === retainedFreeze.currentImplementation.productionInstrumentSealBytesSha256
      && originalSeal.sealSha256 === retainedFreeze.currentImplementation.productionInstrumentSealSha256
      && sha256Hex(originalCertificationBytes) === retainedFreeze.currentImplementation.certificationBytesSha256
      && originalCertification.certificationSha256 === retainedFreeze.currentImplementation.certificationSha256
      && sha256Hex(originalParityBytes) === retainedFreeze.currentImplementation.productionQualificationParityBytesSha256
      && originalParity.paritySha256 === retainedFreeze.currentImplementation.productionQualificationParitySha256,
    "historical observability freeze instrument bindings differ from the original observability implementation commit",
  );

  const historicalCertification = originalCertification as unknown as Imp24InstrumentCertificationBinding;
  const historicalCertificationIssues = validateImp24InstrumentCertificationBinding(historicalCertification);
  requireCondition(historicalCertificationIssues.length === 0,
    `historical model-free certification is invalid: ${historicalCertificationIssues.join("; ")}`);
  requireCondition(historicalCertification.promptBundleSha256 === EXPECTED_PROMPT_BUNDLE_SHA256,
    "historical observability freeze prompt bundle differs from the pinned IMP-24D certification");
  requireCondition(historicalCertification.schemaBundleSha256 === EXPECTED_SCHEMA_BUNDLE_SHA256,
    "historical observability freeze schema bundle differs from the pinned IMP-24D certification");
  requireCondition(historicalCertification.corpusBundleSha256 === retainedFreeze.frozenSemantics.corpusBundleSha256
      && historicalCertification.thresholdsSha256 === retainedFreeze.frozenSemantics.thresholdsSha256
      && historicalCertification.productionInstrumentSealSha256
        === retainedFreeze.currentImplementation.productionInstrumentSealSha256
      && historicalCertification.productionQualificationParitySha256
        === retainedFreeze.currentImplementation.productionQualificationParitySha256,
  "historical observability freeze differs from its pinned model-free certification bindings");

  const historicalInput = readJson(retainedRoot, IMP24C_PRE_LIVE_ARTIFACT_PATHS.freezeJson,
    "historical IMP-24C pre-live freeze");
  const historical = historicalInput.value as unknown as Imp24BPreLiveFreeze;
  const historicalIssues = validateImp24BPreLiveFreeze(historical);
  requireCondition(historicalIssues.length === 0,
    `historical IMP-24C pre-live freeze is invalid: ${historicalIssues.join("; ")}`);
  requireCondition(sha256Hex(historicalInput.bytes)
    === IMP24D_HISTORICAL_R1_BINDINGS.preLiveFreezeJson.bytesSha256,
  "historical IMP-24C pre-live freeze bytes drifted");
  requireCondition(canonicalJson(projectFrozenSemantics(historical.configurationHashes))
      === canonicalJson(retainedFreeze.frozenSemantics),
  "retained IMP-24D frozen semantics differ from the pinned historical pre-live freeze");

  // IMP-24E may deterministically remint active implementation identities and
  // output schemas. Recompute those bindings independently, but never use them
  // to reinterpret the immutable IMP-24D semantic assertion.
  const effective = verifyCurrentImplementationArtifacts(repositoryRoot, retainedRoot);

  return {
    status: "VERIFIED_BYTE_IDENTICAL_HISTORICAL_OBSERVABILITY_FREEZE",
    observabilityImplementationCommit: options.observabilityImplementationCommit,
    freezeSha256: retainedFreeze.freezeSha256,
    frozenSemanticsSha256: hashCanonical(retainedFreeze.frozenSemantics),
    originalImplementation: retainedFreeze.currentImplementation,
    effectiveImplementation: effective.currentImplementation,
    verifiedOutputCount: 2,
    writes: 0,
    modelCalls: 0,
    apiCalls: 0,
  };
}
