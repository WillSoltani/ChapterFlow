/**
 * IMP-24D model-free correction-cycle controls.
 *
 * The stable projection deliberately excludes code-bound certification,
 * production-seal, parity, and freeze self hashes. A mechanical transport
 * correction must remint those identities, while every frozen qualification
 * input and fixed smoke call remains byte-for-byte equivalent.
 */

import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

import { canonicalJson, hashCanonical } from "../contracts/contractUtil.js";
import type {
  CandidateAvailabilityV3,
  QualificationFreezeV3,
} from "../bakeoff/migration/roleQualificationRunnerV3.js";

const PIPELINE_REL = "scripts/book/prompts/chapterflow-v24-author-pipeline";
const SMOKE_ROOT_REL = `${PIPELINE_REL}/state/migration-experiments/s16-forward-role-qualification-v3-envelope-transport-smoke`;
const SMOKE_R2_ROOT_REL = `${PIPELINE_REL}/state/migration-experiments/s16-forward-role-qualification-v3-envelope-transport-smoke-r2`;
const QUALIFICATION_R2_ROOT_REL = `${PIPELINE_REL}/state/migration-experiments/s16-forward-role-qualification-v3-envelope-r2`;

export const IMP24D_TRANSPORT_SMOKE_REPORT_JSON_REL_PATH =
  "docs/v25/reports/IMP-24D_TRANSPORT_SMOKE_RESULT.json" as const;
export const IMP24D_TRANSPORT_SMOKE_REPORT_MARKDOWN_REL_PATH =
  "docs/v25/reports/IMP-24D_TRANSPORT_SMOKE_RESULT.md" as const;

export const IMP24D_DETERMINISTIC_REMINT_FILES = new Set([
  "docs/v25/reports/IMP-24_INSTRUMENT_CERTIFICATION.json",
  "docs/v25/reports/IMP-24_INSTRUMENT_CERTIFICATION.md",
  `${PIPELINE_REL}/state/migration-experiments/contracts/imp24/forward-production-instrument-seal.json`,
  `${PIPELINE_REL}/state/migration-experiments/contracts/imp24/instrument-certification-binding.json`,
  `${PIPELINE_REL}/state/migration-experiments/contracts/imp24/production-qualification-parity.json`,
]);

export const IMP24D_MECHANICAL_CORRECTION_SOURCE_FILES = new Set([
  `${PIPELINE_REL}/src/exec/codexTransportConfig.ts`,
]);

export type Imp24DTransportSemanticCallBindingV1 = {
  role: "reader" | "source";
  candidateOrdinal: number;
  profileId: string;
  model: string;
  effort: string;
  sourceScheduleId: string;
  sourceScheduleOrdinal: number;
  caseId: string;
  sourceCaseSha256: string;
  goldSha256: string;
  schemaSha256: string;
  promptSourceSha256: string;
  evidenceEnvelopeSha256: string;
  evidenceEnvelopeBytesSha256: string;
  taskSha256: string;
};

export type Imp24DQualificationSemanticProjectionV1 = {
  schema: "imp24d-qualification-semantic-projection-v1";
  qualification: Pick<QualificationFreezeV3,
    | "schema"
    | "experimentId"
    | "candidateOrderSha256"
    | "corpusBundleSha256"
    | "corpusSnapshotSha256"
    | "corpusCertificationSha256"
    | "thresholdsSha256"
    | "thresholdBytesSha256"
    | "schemaHashesSha256"
    | "promptSourceHashesSha256"
    | "preparedCasesSha256"
    | "scheduleSha256"
    | "maxParallel"
    | "baseMaximumCalls"
    | "hardMaximumCalls"
  >;
  candidateAvailability: Pick<CandidateAvailabilityV3,
    | "schema"
    | "source"
    | "sourceBytesSha256"
    | "policyBytesSha256"
    | "candidateOrderSha256"
    | "entries"
  >;
  calls: [Imp24DTransportSemanticCallBindingV1, Imp24DTransportSemanticCallBindingV1];
};

export function buildImp24DQualificationSemanticProjection(args: {
  freeze: QualificationFreezeV3;
  candidateAvailability: CandidateAvailabilityV3;
  calls: readonly [Imp24DTransportSemanticCallBindingV1, Imp24DTransportSemanticCallBindingV1];
}): Imp24DQualificationSemanticProjectionV1 {
  const freeze = args.freeze;
  const availability = args.candidateAvailability;
  return {
    schema: "imp24d-qualification-semantic-projection-v1",
    qualification: {
      schema: freeze.schema,
      experimentId: freeze.experimentId,
      candidateOrderSha256: freeze.candidateOrderSha256,
      corpusBundleSha256: freeze.corpusBundleSha256,
      corpusSnapshotSha256: freeze.corpusSnapshotSha256,
      corpusCertificationSha256: freeze.corpusCertificationSha256,
      thresholdsSha256: freeze.thresholdsSha256,
      thresholdBytesSha256: freeze.thresholdBytesSha256,
      schemaHashesSha256: freeze.schemaHashesSha256,
      promptSourceHashesSha256: freeze.promptSourceHashesSha256,
      preparedCasesSha256: freeze.preparedCasesSha256,
      scheduleSha256: freeze.scheduleSha256,
      maxParallel: freeze.maxParallel,
      baseMaximumCalls: freeze.baseMaximumCalls,
      hardMaximumCalls: freeze.hardMaximumCalls,
    },
    candidateAvailability: {
      schema: availability.schema,
      source: availability.source,
      sourceBytesSha256: availability.sourceBytesSha256,
      policyBytesSha256: availability.policyBytesSha256,
      candidateOrderSha256: availability.candidateOrderSha256,
      entries: availability.entries,
    },
    calls: [args.calls[0], args.calls[1]],
  };
}

export function imp24DQualificationSemanticProjectionSha256(args: {
  freeze: QualificationFreezeV3;
  candidateAvailability: CandidateAvailabilityV3;
  calls: readonly [Imp24DTransportSemanticCallBindingV1, Imp24DTransportSemanticCallBindingV1];
}): string {
  return hashCanonical(buildImp24DQualificationSemanticProjection(args));
}

export type Imp24DBoundedCorrectionCommitProofV1 = {
  schema: "imp24d-bounded-correction-commit-proof-v1";
  observabilityImplementationCommit: string;
  correctionCommit: string;
  changedFiles: string[];
  smokeEvidenceFiles: string[];
  sourceFiles: string[];
  regressionTestFiles: string[];
  deterministicRemintFiles: string[];
  proofSha256: string;
};

function gitLines(repositoryRoot: string, args: string[]): string[] {
  return execFileSync("git", args, {
    cwd: resolve(repositoryRoot),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 64 * 1024 * 1024,
  }).split("\n").map((item) => item.trim()).filter(Boolean).sort();
}

function isRegressionTest(path: string): boolean {
  return path.startsWith(`${PIPELINE_REL}/tests/`)
    && /(?:codex|transport|role-qualification|observability)/i.test(path);
}

function isSmokeEvidence(path: string): boolean {
  return path.startsWith(`${SMOKE_ROOT_REL}/`)
    || path === IMP24D_TRANSPORT_SMOKE_REPORT_JSON_REL_PATH
    || path === IMP24D_TRANSPORT_SMOKE_REPORT_MARKDOWN_REL_PATH;
}

export type Imp24DPlannedCorrectionPathsV1 = Pick<Imp24DBoundedCorrectionCommitProofV1,
  "changedFiles" | "smokeEvidenceFiles" | "sourceFiles" | "regressionTestFiles" | "deterministicRemintFiles">;

export function classifyImp24DPlannedCorrectionPaths(changed: readonly string[]): Imp24DPlannedCorrectionPathsV1 {
  const changedFiles = [...new Set(changed)].sort();
  const forbiddenRoots = changedFiles.filter((path) =>
    path.startsWith(`${SMOKE_R2_ROOT_REL}/`) || path.startsWith(`${QUALIFICATION_R2_ROOT_REL}/`));
  if (forbiddenRoots.length > 0) {
    throw new Error(`IMP-24D correction created a forbidden post-correction root: ${forbiddenRoots.join(", ")}`);
  }
  const smokeEvidenceFiles = changedFiles.filter(isSmokeEvidence);
  const sourceFiles = changedFiles.filter((path) => IMP24D_MECHANICAL_CORRECTION_SOURCE_FILES.has(path));
  const regressionTestFiles = changedFiles.filter(isRegressionTest);
  const deterministicRemintFiles = changedFiles.filter((path) => IMP24D_DETERMINISTIC_REMINT_FILES.has(path));
  const allowed = new Set([
    ...smokeEvidenceFiles,
    ...sourceFiles,
    ...regressionTestFiles,
    ...deterministicRemintFiles,
  ]);
  const disallowed = changedFiles.filter((path) => !allowed.has(path));
  if (disallowed.length > 0) {
    throw new Error(`mechanical correction exceeds the transport/config allowlist: ${disallowed.join(", ")}`);
  }
  if (sourceFiles.length === 0 || regressionTestFiles.length === 0) {
    throw new Error("mechanical correction requires a transport/config source correction and a regression test");
  }
  if (!smokeEvidenceFiles.some((path) => path.startsWith(`${SMOKE_ROOT_REL}/`))
      || !smokeEvidenceFiles.includes(IMP24D_TRANSPORT_SMOKE_REPORT_JSON_REL_PATH)
      || !smokeEvidenceFiles.includes(IMP24D_TRANSPORT_SMOKE_REPORT_MARKDOWN_REL_PATH)) {
    throw new Error("mechanical correction must retain the failed first smoke cycle and both diagnosis report mirrors");
  }
  return { changedFiles, smokeEvidenceFiles, sourceFiles, regressionTestFiles, deterministicRemintFiles };
}

export function collectImp24DPlannedCorrectionPaths(repositoryRoot: string): Imp24DPlannedCorrectionPathsV1 {
  const tracked = gitLines(repositoryRoot, ["diff", "--name-only", "HEAD", "--"]);
  const untracked = gitLines(repositoryRoot, ["ls-files", "--others", "--exclude-standard"]);
  return classifyImp24DPlannedCorrectionPaths([...tracked, ...untracked]);
}

/** Prove the one authorized correction before CI, cache, auth, root, or model work. */
export function assertImp24DBoundedCorrectionCommit(args: {
  repositoryRoot: string;
  observabilityImplementationCommit: string;
  correctionCommit: string;
}): Imp24DBoundedCorrectionCommitProofV1 {
  const repositoryRoot = resolve(args.repositoryRoot);
  if (args.observabilityImplementationCommit === args.correctionCommit) {
    throw new Error("IMP-24D correction cycle requires a distinct implementation commit");
  }
  const parents = gitLines(repositoryRoot, [
    "rev-list", "--parents", "-n", "1", args.correctionCommit,
  ]);
  const parentFields = parents.join(" ").split(/\s+/).slice(1);
  if (parentFields.length !== 1 || parentFields[0] !== args.observabilityImplementationCommit) {
    throw new Error("IMP-24D correction cycle permits exactly one single-parent direct correction commit");
  }
  const changedFiles = gitLines(repositoryRoot, [
    "diff", "--name-only", args.observabilityImplementationCommit, args.correctionCommit, "--",
  ]);
  const classified = classifyImp24DPlannedCorrectionPaths(changedFiles);
  const core: Omit<Imp24DBoundedCorrectionCommitProofV1, "proofSha256"> = {
    schema: "imp24d-bounded-correction-commit-proof-v1",
    observabilityImplementationCommit: args.observabilityImplementationCommit,
    correctionCommit: args.correctionCommit,
    ...classified,
  };
  return { ...core, proofSha256: hashCanonical(core) };
}

export function sameImp24DBoundedCorrectionProofPaths(
  left: Pick<Imp24DBoundedCorrectionCommitProofV1,
    "changedFiles" | "sourceFiles" | "regressionTestFiles" | "deterministicRemintFiles">,
  right: Pick<Imp24DBoundedCorrectionCommitProofV1,
    "changedFiles" | "sourceFiles" | "regressionTestFiles" | "deterministicRemintFiles">,
): boolean {
  const project = (value: typeof left) => ({
    changedFiles: value.changedFiles,
    sourceFiles: value.sourceFiles,
    regressionTestFiles: value.regressionTestFiles,
    deterministicRemintFiles: value.deterministicRemintFiles,
  });
  return canonicalJson(project(left)) === canonicalJson(project(right));
}
