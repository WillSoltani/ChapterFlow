/**
 * Deterministic IMP-24 role-freeze, pilot, and gold artifact composition.
 *
 * This module has no filesystem, process, model, network, or activation
 * capability. It composes only already-validated V3 qualification evidence and
 * the unchanged frozen IMP-22 content denominator under fresh envelope ids.
 */

import { hashCanonical } from "../contracts/contractUtil.js";
import type { ForwardInputFreezeV1 } from "./forwardInputFreeze.js";
import {
  IMP24_FORWARD_INPUT_EXPERIMENT_IDS,
  type Imp22ForwardInputMaterializationV1,
} from "./forwardInputMaterialization.js";
import {
  assertAcceptedForwardPilotResult,
  validateForwardInputMaterializationBinding,
} from "./forwardLiveArtifactMaterializer.js";
import {
  buildForwardRoleAssignmentFreezeV3,
  validateForwardRoleAssignmentFreezeV3,
  type BuildForwardRoleAssignmentFreezeV3Input,
  type ForwardRoleAssignmentFreezeV3,
} from "./forwardRoleAssignmentFreezeV3.js";
import {
  buildGoldManifestV2Envelope,
  buildPilotManifestV2Envelope,
  GOLD_ENVELOPE_EXPERIMENT_ID,
  PILOT_ENVELOPE_EXPERIMENT_ID,
  type ForwardGoldManifestV1,
  type ForwardPilotManifestV1,
  type ForwardValidationCampaignResultV1,
  type FrozenForwardValidationManifestV1,
} from "./forwardValidationCampaign.js";
import {
  buildForwardGoldEvaluatorInstrument,
  validateForwardGoldEvaluatorInstrument,
  type ForwardGoldEvaluatorInstrumentV1,
} from "./forwardGoldEvaluatorInstrument.js";

export const FORWARD_LIVE_ARTIFACT_BUNDLE_V3_SCHEMA = "imp24-forward-live-artifact-bundle-v3" as const;

const EXTERNAL_CAPABILITIES = Object.freeze({
  publish: false,
  promote: false,
  deploy: false,
  upload: false,
  api: false,
} as const);

export type ForwardLiveArtifactBundleV3 = {
  schema: typeof FORWARD_LIVE_ARTIFACT_BUNDLE_V3_SCHEMA;
  experimentId: "s16-forward-role-qualification-v3-envelope";
  qualificationResultSha256: string;
  instrumentCertificationSha256: string;
  roleAssignmentFreeze: ForwardRoleAssignmentFreezeV3;
  roleAssignmentFreezeSha256: string;
  modelCalls: 0;
  apiCalls: 0;
  networkCalls: 0;
  externalCapabilities: typeof EXTERNAL_CAPABILITIES;
  artifactSha256: string;
};

export type BuildForwardEnvelopePilotArtifactsInput = {
  currentQualification: BuildForwardRoleAssignmentFreezeV3Input;
  roleFreeze: ForwardRoleAssignmentFreezeV3;
  inputFreeze: ForwardInputFreezeV1;
  inputMaterialization: Imp22ForwardInputMaterializationV1;
};

export type ForwardEnvelopeGoldArtifactsV1 = {
  goldEvaluatorConfig: Readonly<ForwardGoldEvaluatorInstrumentV1>;
  goldManifest: FrozenForwardValidationManifestV1<ForwardGoldManifestV1>;
};

export class ForwardLiveArtifactMaterializerV3Error extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ForwardLiveArtifactMaterializerV3Error";
  }
}
function requireCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new ForwardLiveArtifactMaterializerV3Error(message);
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): Readonly<T> {
  if (value !== null && typeof value === "object") {
    const object = value as object;
    if (!seen.has(object)) {
      seen.add(object);
      for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child, seen);
      Object.freeze(object);
    }
  }
  return value;
}

function validateFreshEnvelopeInputs(input: BuildForwardEnvelopePilotArtifactsInput): string {
  validateForwardRoleAssignmentFreezeV3(input.roleFreeze, input.currentQualification);
  requireCondition(
    input.inputMaterialization.pilotExperimentId === IMP24_FORWARD_INPUT_EXPERIMENT_IDS.pilotExperimentId
      && input.inputMaterialization.goldExperimentId === IMP24_FORWARD_INPUT_EXPERIMENT_IDS.goldExperimentId,
    "IMP-24 materialization is not bound to the fresh pilot/gold envelope identities",
  );
  requireCondition(input.inputFreeze.sets.pilotBookIds.length === 2
    && input.inputFreeze.sets.pilotBookIds.includes("radical-candor")
    && input.inputFreeze.sets.pilotBookIds.includes("start-with-why"),
  "IMP-24 pilot content selection differs from the frozen two-book denominator");
  requireCondition(input.inputFreeze.sets.goldBookIds.length === 1
    && input.inputFreeze.sets.goldBookIds[0] === "the-gifts-of-imperfection",
  "IMP-24 gold input differs from the frozen full-book denominator");
  return validateForwardInputMaterializationBinding(input.inputFreeze, input.inputMaterialization);
}

/** Seal the live V3 result without adapting it to either closed qualification. */
export function buildQualificationAndRoleFreezeArtifactsV3(
  input: BuildForwardRoleAssignmentFreezeV3Input,
): Readonly<ForwardLiveArtifactBundleV3> {
  const roleAssignmentFreeze = buildForwardRoleAssignmentFreezeV3(input);
  const draft = {
    schema: FORWARD_LIVE_ARTIFACT_BUNDLE_V3_SCHEMA,
    experimentId: input.result.experimentId,
    qualificationResultSha256: roleAssignmentFreeze.qualificationResultSha256,
    instrumentCertificationSha256: roleAssignmentFreeze.instrumentCertificationSha256,
    roleAssignmentFreeze,
    roleAssignmentFreezeSha256: roleAssignmentFreeze.freezeSha256,
    modelCalls: 0 as const,
    apiCalls: 0 as const,
    networkCalls: 0 as const,
    externalCapabilities: EXTERNAL_CAPABILITIES,
  };
  return deepFreeze({ ...draft, artifactSha256: hashCanonical(draft) });
}

/** Build the exact eight-coordinate fresh envelope pilot manifest. */
export function buildPilotArtifactsV2Envelope(
  input: BuildForwardEnvelopePilotArtifactsInput,
): FrozenForwardValidationManifestV1<ForwardPilotManifestV1> {
  const inputMaterializationSha256 = validateFreshEnvelopeInputs(input);
  const manifest = buildPilotManifestV2Envelope({
    frozenAtIso: input.inputFreeze.frozenAtIso,
    roleAssignmentSha256: input.roleFreeze.roleAssignmentSha256,
    instrumentManifestSha256: input.roleFreeze.reviewConfig.instrumentManifestSha256,
    thresholdsSha256: input.roleFreeze.reviewConfig.instrumentManifest.thresholdsSha256,
    inputMaterializationSha256,
    productionInstrumentSealSha256: input.roleFreeze.productionInstrumentSealSha256,
    qualificationBookIds: input.inputFreeze.sets.qualificationBookIds,
    books: input.inputFreeze.pilot,
    goldReservedBookIds: input.inputFreeze.sets.goldBookIds,
  });
  requireCondition(manifest.manifest.experimentId === PILOT_ENVELOPE_EXPERIMENT_ID
    && manifest.manifest.targets.length === 8,
  "IMP-24 pilot manifest identity or denominator drift");
  return manifest;
}

/** Build the pinned evaluator and untruncated full-book envelope gold manifest. */
export function buildGoldArtifactsV2Envelope(
  input: BuildForwardEnvelopePilotArtifactsInput & {
    pilotManifest: FrozenForwardValidationManifestV1<ForwardPilotManifestV1>;
    pilotResult: ForwardValidationCampaignResultV1;
  },
): ForwardEnvelopeGoldArtifactsV1 {
  validateFreshEnvelopeInputs(input);
  requireCondition(input.pilotManifest.manifest.experimentId === PILOT_ENVELOPE_EXPERIMENT_ID,
    "IMP-24 gold cannot consume a legacy pilot result");
  assertAcceptedForwardPilotResult(input.pilotManifest, input.pilotResult);
  const goldEvaluatorConfig = buildForwardGoldEvaluatorInstrument({
    repositoryRoot: input.currentQualification.repositoryRoot,
  });
  validateForwardGoldEvaluatorInstrument(goldEvaluatorConfig, {
    repositoryRoot: input.currentQualification.repositoryRoot,
  });
  const goldManifest = buildGoldManifestV2Envelope({
    frozenAtIso: input.inputFreeze.frozenAtIso,
    roleAssignmentSha256: input.roleFreeze.roleAssignmentSha256,
    instrumentManifestSha256: input.roleFreeze.reviewConfig.instrumentManifestSha256,
    thresholdsSha256: input.roleFreeze.reviewConfig.instrumentManifest.thresholdsSha256,
    inputMaterializationSha256: validateForwardInputMaterializationBinding(input.inputFreeze, input.inputMaterialization),
    productionInstrumentSealSha256: input.roleFreeze.productionInstrumentSealSha256,
    qualificationBookIds: input.inputFreeze.sets.qualificationBookIds,
    books: [input.inputFreeze.gold],
    pilotBookIds: input.inputFreeze.sets.pilotBookIds,
    pilotAccepted: true,
    pilotManifestSha256: input.pilotManifest.manifestSha256,
    pilotResultSha256: hashCanonical(input.pilotResult),
    goldEvaluatorInstrumentSha256: goldEvaluatorConfig.instrumentSha256,
  });
  requireCondition(goldManifest.manifest.experimentId === GOLD_ENVELOPE_EXPERIMENT_ID
    && goldManifest.manifest.targets.length === input.inputFreeze.goldChapterCount,
  "IMP-24 gold manifest identity or full-book denominator drift");
  return { goldEvaluatorConfig, goldManifest };
}
