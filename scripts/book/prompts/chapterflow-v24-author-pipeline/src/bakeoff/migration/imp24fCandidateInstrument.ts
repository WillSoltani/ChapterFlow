/**
 * IMP-24F ACTIVE CANDIDATE instrument generation (V25 recovery, 2026-07-15).
 *
 * The IMP-24E terminal campaign (`s16-forward-role-qualification-v3-envelope-final`,
 * ROLE_SET_NOT_READY) retained its seal and certification as singletons under
 * contracts/imp24/. The authorized IMP-24F semantic repair then changed
 * instrument bytes and the prompt-hash recipe, so those retained artifacts can
 * never match current bytes again — they are history. This module gives the
 * repaired instrument its own generation identity:
 *
 *  - a candidate seal + certification binding under contracts/imp24f/, minted
 *    from CURRENT bytes and verified against CURRENT bytes (fail-closed drift);
 *  - a small explicit manifest binding protocol ID, generation, candidate
 *    hashes, the shared frozen inputs (corpus/thresholds are protocol-frozen
 *    and unchanged), and the predecessor's identity with
 *    `mayQualifySuccessor: false` — no V1/V2/V3 freshness, call, holdout, or
 *    disposition can qualify this candidate;
 *  - the standing owner gate `BLOCKED_NEEDS_INDEPENDENT_GOLD` carried
 *    explicitly: this generation has ZERO live evidence by construction and
 *    authorizes no qualification, pilot, gold, or activation.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { hashCanonical } from "../../contracts/contractUtil.js";
import { canonicalPretty } from "./corpusBuilderCore.js";
import { writeFileAtomic } from "../../lib/atomicWrite.js";
import {
  IMP24_CERTIFICATION_ARTIFACT_PATHS,
  certifyImp24Instrument,
  validateImp24InstrumentCertificationBinding,
  type Imp24InstrumentCertificationBinding,
} from "./imp24InstrumentCertification.js";
import {
  IMP24_ROLE_QUALIFICATION_FINAL_EXECUTION_ID,
  IMP24_ROLE_QUALIFICATION_PROTOCOL_ID,
} from "./imp24Corpus.js";
import {
  IMP24_FORWARD_PRODUCTION_INSTRUMENT_SEAL_ARTIFACT_REL_PATH,
  IMP24F_FORWARD_PRODUCTION_INSTRUMENT_SEAL_ARTIFACT_REL_PATH,
  materializeForwardProductionInstrumentSeal,
  verifyHistoricalForwardProductionInstrumentSeal,
  verifyRetainedForwardProductionInstrumentSeal,
} from "../../orchestrator/forwardProductionInstrumentSeal.js";

const PIPELINE_REL = "scripts/book/prompts/chapterflow-v24-author-pipeline";
const PREDECESSOR_FINAL_RESULT_REL_PATH = "docs/v25/reports/ROLE_QUALIFICATION_V3_FINAL_LIVE_RESULT.json";

export const IMP24F_CANDIDATE_INSTRUMENT_MANIFEST_SCHEMA = "imp24f-candidate-instrument-manifest-v1" as const;
/** Generation lineage: imp24f-semantic-repair-1 (IMP-24F semantic repair,
 * superseded in place with zero live evidence) → imp24g-reader-policy-v3-1
 * (owner-ratified D1 reader decision policy v3, 2026-07-15). Candidate
 * generations re-mint in place until one is frozen into a campaign. */
export const IMP24F_CANDIDATE_INSTRUMENT_GENERATION = "imp24g-reader-policy-v3-1" as const;
export const IMP24F_CANDIDATE_STANDING_BLOCKER = "BLOCKED_NEEDS_INDEPENDENT_GOLD" as const;
export const IMP24F_PREDECESSOR_DISPOSITION = "ROLE_SET_NOT_READY" as const;

export const IMP24F_CANDIDATE_ARTIFACT_PATHS = Object.freeze({
  seal: IMP24F_FORWARD_PRODUCTION_INSTRUMENT_SEAL_ARTIFACT_REL_PATH,
  certificationBinding:
    `${PIPELINE_REL}/state/migration-experiments/contracts/imp24f/instrument-certification-binding.json` as const,
  manifest:
    `${PIPELINE_REL}/state/migration-experiments/contracts/imp24f/instrument-candidate-manifest.json` as const,
});

export type Imp24fCandidateInstrumentManifestV1 = {
  schema: typeof IMP24F_CANDIDATE_INSTRUMENT_MANIFEST_SCHEMA;
  protocolId: typeof IMP24_ROLE_QUALIFICATION_PROTOCOL_ID;
  instrumentGeneration: typeof IMP24F_CANDIDATE_INSTRUMENT_GENERATION;
  candidate: {
    sealSha256: string;
    certificationSha256: string;
    promptBundleSha256: string;
    schemaBundleSha256: string;
    thresholdsSha256: string;
    corpusBundleSha256: string;
    productionQualificationParitySha256: string;
    scorerSha256: string;
  };
  sharedFrozenInputs: {
    corpusBundlePath: string;
    thresholdsPath: string;
  };
  predecessor: {
    experimentId: typeof IMP24_ROLE_QUALIFICATION_FINAL_EXECUTION_ID;
    certificationSha256: string;
    sealSha256: string;
    disposition: typeof IMP24F_PREDECESSOR_DISPOSITION;
    superseded: true;
    mayQualifySuccessor: false;
  };
  standingBlocker: typeof IMP24F_CANDIDATE_STANDING_BLOCKER;
  liveEvidence: { modelCalls: 0; apiCalls: 0; holdoutCalls: 0; pilotCalls: 0 };
  manifestSha256: string;
};

export class Imp24fCandidateInstrumentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Imp24fCandidateInstrumentError";
  }
}

function requireCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Imp24fCandidateInstrumentError(message);
}

const SHA256 = /^[a-f0-9]{64}$/;

export function validateImp24fCandidateInstrumentManifest(value: unknown): string[] {
  const issues: string[] = [];
  if (value === null || typeof value !== "object" || Array.isArray(value)) return ["manifest must be an object"];
  const manifest = value as Imp24fCandidateInstrumentManifestV1;
  if (manifest.schema !== IMP24F_CANDIDATE_INSTRUMENT_MANIFEST_SCHEMA) issues.push("manifest schema mismatch");
  if (manifest.protocolId !== IMP24_ROLE_QUALIFICATION_PROTOCOL_ID) issues.push("manifest protocol identity mismatch");
  if (manifest.instrumentGeneration !== IMP24F_CANDIDATE_INSTRUMENT_GENERATION) issues.push("manifest generation identity mismatch");
  for (const label of ["sealSha256", "certificationSha256", "promptBundleSha256", "schemaBundleSha256",
    "thresholdsSha256", "productionQualificationParitySha256", "scorerSha256"] as const) {
    const sha = manifest.candidate?.[label];
    if (typeof sha !== "string" || !SHA256.test(sha)) issues.push(`candidate.${label} is not a bare lowercase SHA-256`);
  }
  // The corpus identity is retained in its self-hashed `sha256:<hex>` form
  // (the exact format the certification binding pins).
  if (typeof manifest.candidate?.corpusBundleSha256 !== "string"
    || !/^sha256:[a-f0-9]{64}$/.test(manifest.candidate.corpusBundleSha256)) {
    issues.push("candidate.corpusBundleSha256 is not the self-hashed corpus identity");
  }
  if (manifest.sharedFrozenInputs?.corpusBundlePath !== IMP24_CERTIFICATION_ARTIFACT_PATHS.corpusBundle
    || manifest.sharedFrozenInputs?.thresholdsPath !== IMP24_CERTIFICATION_ARTIFACT_PATHS.thresholds) {
    issues.push("shared frozen inputs must reference the retained protocol corpus/threshold artifacts");
  }
  if (manifest.predecessor?.experimentId !== IMP24_ROLE_QUALIFICATION_FINAL_EXECUTION_ID) issues.push("predecessor identity mismatch");
  if (manifest.predecessor?.disposition !== IMP24F_PREDECESSOR_DISPOSITION) issues.push("predecessor disposition mismatch");
  if (manifest.predecessor?.superseded !== true) issues.push("predecessor must be recorded as superseded");
  if (manifest.predecessor?.mayQualifySuccessor !== false) {
    issues.push("predecessor.mayQualifySuccessor must be false — historical results can never qualify a successor");
  }
  for (const field of ["certificationSha256", "sealSha256"] as const) {
    if (typeof manifest.predecessor?.[field] !== "string" || !SHA256.test(manifest.predecessor[field])) {
      issues.push(`predecessor.${field} is not a bare lowercase SHA-256`);
    }
  }
  if (manifest.standingBlocker !== IMP24F_CANDIDATE_STANDING_BLOCKER) {
    issues.push("standing independent-reader-gold blocker must remain explicit");
  }
  const live = manifest.liveEvidence ?? ({} as Imp24fCandidateInstrumentManifestV1["liveEvidence"]);
  if (live.modelCalls !== 0 || live.apiCalls !== 0 || live.holdoutCalls !== 0 || live.pilotCalls !== 0) {
    issues.push("candidate generation must record zero live evidence");
  }
  if (typeof manifest.manifestSha256 !== "string" || !SHA256.test(manifest.manifestSha256)) {
    issues.push("manifestSha256 missing");
  } else {
    const { manifestSha256: _ignored, ...core } = manifest;
    if (hashCanonical(core) !== manifest.manifestSha256) issues.push("manifest self-hash mismatch");
  }
  return [...new Set(issues)];
}

/** HISTORICAL verification of the retained imp24 (predecessor) instrument
 * identity: binding shape + self-hash, seal self-hash pinned to the binding,
 * and the closed terminal disposition. Never touches current checkout bytes. */
export function verifyHistoricalImp24InstrumentIdentity(args: {
  repositoryRoot: string;
}): Imp24fCandidateInstrumentManifestV1["predecessor"] {
  return loadPredecessorIdentity(resolve(args.repositoryRoot));
}

function loadPredecessorIdentity(repositoryRoot: string): Imp24fCandidateInstrumentManifestV1["predecessor"] {
  const bindingPath = resolve(repositoryRoot, IMP24_CERTIFICATION_ARTIFACT_PATHS.certificationBinding);
  const retainedBinding = JSON.parse(readFileSync(bindingPath, "utf8")) as Imp24InstrumentCertificationBinding;
  const bindingIssues = validateImp24InstrumentCertificationBinding(retainedBinding);
  requireCondition(bindingIssues.length === 0,
    `retained predecessor certification binding is invalid: ${bindingIssues.join("; ")}`);
  const retainedSeal = verifyHistoricalForwardProductionInstrumentSeal({
    outputPath: resolve(repositoryRoot, IMP24_FORWARD_PRODUCTION_INSTRUMENT_SEAL_ARTIFACT_REL_PATH),
    expectedSealSha256: retainedBinding.productionInstrumentSealSha256,
  });
  const finalResult = JSON.parse(readFileSync(
    resolve(repositoryRoot, PREDECESSOR_FINAL_RESULT_REL_PATH), "utf8",
  )) as { status?: unknown; experimentId?: unknown };
  requireCondition(finalResult.status === IMP24F_PREDECESSOR_DISPOSITION
    && finalResult.experimentId === IMP24_ROLE_QUALIFICATION_FINAL_EXECUTION_ID,
  "retained terminal qualification report does not record the closed predecessor identity");
  return {
    experimentId: IMP24_ROLE_QUALIFICATION_FINAL_EXECUTION_ID,
    certificationSha256: retainedBinding.certificationSha256,
    sealSha256: retainedSeal.sealSha256,
    disposition: IMP24F_PREDECESSOR_DISPOSITION,
    superseded: true,
    mayQualifySuccessor: false,
  };
}

function buildManifest(args: {
  binding: Imp24InstrumentCertificationBinding;
  sealSha256: string;
  predecessor: Imp24fCandidateInstrumentManifestV1["predecessor"];
}): Imp24fCandidateInstrumentManifestV1 {
  const core: Omit<Imp24fCandidateInstrumentManifestV1, "manifestSha256"> = {
    schema: IMP24F_CANDIDATE_INSTRUMENT_MANIFEST_SCHEMA,
    protocolId: IMP24_ROLE_QUALIFICATION_PROTOCOL_ID,
    instrumentGeneration: IMP24F_CANDIDATE_INSTRUMENT_GENERATION,
    candidate: {
      sealSha256: args.sealSha256,
      certificationSha256: args.binding.certificationSha256,
      promptBundleSha256: args.binding.promptBundleSha256,
      schemaBundleSha256: args.binding.schemaBundleSha256,
      thresholdsSha256: args.binding.thresholdsSha256,
      corpusBundleSha256: args.binding.corpusBundleSha256,
      productionQualificationParitySha256: args.binding.productionQualificationParitySha256,
      scorerSha256: args.binding.scorerSha256,
    },
    sharedFrozenInputs: {
      corpusBundlePath: IMP24_CERTIFICATION_ARTIFACT_PATHS.corpusBundle,
      thresholdsPath: IMP24_CERTIFICATION_ARTIFACT_PATHS.thresholds,
    },
    predecessor: args.predecessor,
    standingBlocker: IMP24F_CANDIDATE_STANDING_BLOCKER,
    liveEvidence: { modelCalls: 0, apiCalls: 0, holdoutCalls: 0, pilotCalls: 0 },
  };
  return { ...core, manifestSha256: hashCanonical(core) };
}

export type Imp24fCandidateInstrumentVerificationV1 = {
  schema: "imp24f-candidate-instrument-verification-v1";
  instrumentGeneration: typeof IMP24F_CANDIDATE_INSTRUMENT_GENERATION;
  candidateSealSha256: string;
  candidateCertificationSha256: string;
  manifestSha256: string;
  predecessorCertificationSha256: string;
  comparedToCurrentBytes: true;
  verified: true;
  modelCalls: 0;
  apiCalls: 0;
};

/** Fail-closed ACTIVE-CANDIDATE verification: the candidate seal must match
 * every current instrument byte, the candidate certification must equal a full
 * model-free recomputation from current bytes, and the manifest must bind both
 * plus the closed predecessor. Zero model/API calls. */
export function verifyImp24fCandidateInstrument(args: {
  repositoryRoot: string;
}): Imp24fCandidateInstrumentVerificationV1 {
  const repositoryRoot = resolve(args.repositoryRoot);
  const sealPath = resolve(repositoryRoot, IMP24F_CANDIDATE_ARTIFACT_PATHS.seal);
  const seal = verifyRetainedForwardProductionInstrumentSeal({ repositoryRoot, outputPath: sealPath });

  const recomputed = certifyImp24Instrument({ repositoryRoot, productionSealPath: sealPath });
  const bindingPath = resolve(repositoryRoot, IMP24F_CANDIDATE_ARTIFACT_PATHS.certificationBinding);
  const retainedBindingBytes = readFileSync(bindingPath);
  requireCondition(retainedBindingBytes.toString("utf8") === canonicalPretty(recomputed.report.binding),
    "candidate certification binding differs from the model-free recomputation over current bytes");
  const binding = JSON.parse(retainedBindingBytes.toString("utf8")) as Imp24InstrumentCertificationBinding;

  const manifestPath = resolve(repositoryRoot, IMP24F_CANDIDATE_ARTIFACT_PATHS.manifest);
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Imp24fCandidateInstrumentManifestV1;
  const manifestIssues = validateImp24fCandidateInstrumentManifest(manifest);
  requireCondition(manifestIssues.length === 0, `candidate instrument manifest is invalid: ${manifestIssues.join("; ")}`);
  requireCondition(manifest.candidate.sealSha256 === seal.sealSha256
    && manifest.candidate.certificationSha256 === binding.certificationSha256
    && manifest.candidate.promptBundleSha256 === binding.promptBundleSha256
    && manifest.candidate.schemaBundleSha256 === binding.schemaBundleSha256
    && manifest.candidate.thresholdsSha256 === binding.thresholdsSha256
    && manifest.candidate.corpusBundleSha256 === binding.corpusBundleSha256
    && manifest.candidate.productionQualificationParitySha256 === binding.productionQualificationParitySha256
    && manifest.candidate.scorerSha256 === binding.scorerSha256,
  "candidate instrument manifest does not bind the candidate seal/certification artifacts");

  const predecessor = loadPredecessorIdentity(repositoryRoot);
  requireCondition(manifest.predecessor.certificationSha256 === predecessor.certificationSha256
    && manifest.predecessor.sealSha256 === predecessor.sealSha256,
  "candidate instrument manifest does not bind the retained predecessor identity");
  requireCondition(binding.certificationSha256 !== predecessor.certificationSha256,
    "candidate certification must be a fresh identity, not the predecessor's");

  return {
    schema: "imp24f-candidate-instrument-verification-v1",
    instrumentGeneration: IMP24F_CANDIDATE_INSTRUMENT_GENERATION,
    candidateSealSha256: seal.sealSha256,
    candidateCertificationSha256: binding.certificationSha256,
    manifestSha256: manifest.manifestSha256,
    predecessorCertificationSha256: predecessor.certificationSha256,
    comparedToCurrentBytes: true,
    verified: true,
    modelCalls: 0,
    apiCalls: 0,
  };
}

export type Imp24fCandidateInstrumentMaterializationV1 = {
  schema: "imp24f-candidate-instrument-materialization-v1";
  instrumentGeneration: typeof IMP24F_CANDIDATE_INSTRUMENT_GENERATION;
  candidateSealSha256: string;
  candidateCertificationSha256: string;
  manifestSha256: string;
  written: true;
  modelCalls: 0;
  apiCalls: 0;
};

/** Mint the candidate generation from CURRENT bytes into contracts/imp24f/
 * (seal, certification binding, manifest), then immediately re-verify the
 * retained artifacts against current bytes. NEVER writes any contracts/imp24
 * or contracts/imp22 path — retained generations are immutable history. */
export function materializeImp24fCandidateInstrument(args: {
  repositoryRoot: string;
}): Imp24fCandidateInstrumentMaterializationV1 {
  const repositoryRoot = resolve(args.repositoryRoot);
  const predecessor = loadPredecessorIdentity(repositoryRoot);

  const sealPath = resolve(repositoryRoot, IMP24F_CANDIDATE_ARTIFACT_PATHS.seal);
  const seal = materializeForwardProductionInstrumentSeal({ repositoryRoot, outputPath: sealPath, write: true });

  const certified = certifyImp24Instrument({ repositoryRoot, productionSealPath: sealPath });
  requireCondition(certified.report.binding.certificationSha256 !== predecessor.certificationSha256,
    "candidate certification unexpectedly reproduced the predecessor identity — nothing to supersede");
  writeFileAtomic(
    resolve(repositoryRoot, IMP24F_CANDIDATE_ARTIFACT_PATHS.certificationBinding),
    canonicalPretty(certified.report.binding),
  );

  const manifest = buildManifest({
    binding: certified.report.binding,
    sealSha256: seal.sealSha256,
    predecessor,
  });
  writeFileAtomic(resolve(repositoryRoot, IMP24F_CANDIDATE_ARTIFACT_PATHS.manifest), canonicalPretty(manifest));

  const verified = verifyImp24fCandidateInstrument({ repositoryRoot });
  requireCondition(verified.candidateSealSha256 === seal.sealSha256
    && verified.manifestSha256 === manifest.manifestSha256,
  "candidate instrument read-back differs from the just-minted artifacts");

  return {
    schema: "imp24f-candidate-instrument-materialization-v1",
    instrumentGeneration: IMP24F_CANDIDATE_INSTRUMENT_GENERATION,
    candidateSealSha256: seal.sealSha256,
    candidateCertificationSha256: certified.report.binding.certificationSha256,
    manifestSha256: manifest.manifestSha256,
    written: true,
    modelCalls: 0,
    apiCalls: 0,
  };
}
