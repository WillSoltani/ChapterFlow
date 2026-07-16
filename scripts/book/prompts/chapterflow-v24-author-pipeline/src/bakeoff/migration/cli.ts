/**
 * IMP-11 — `migration-bakeoff` CLI verb: thin flag parsing over the migration
 * conductor (runExperiment.ts owns all behavior; tests drive it directly).
 *
 * Subverbs map to conductor phases:
 *   plan     — validate a spec + print the deterministic schedule summary (no writes)
 *   seal     — freeze spec/inputs/stacks/thresholds/schedule (Stage-0 of any run)
 *   qualify  — Stage Q judge qualification over a labeled corpus
 *   run      — generate + review (screening wave, frozen stopping, expansion wave)
 *   analyze  — freeze metric tables + effects/precision/overlap analysis
 *   decide   — unblind (refused before frozen metrics) + threshold script + report
 *   status   — print the run manifest
 *
 * This verb NEVER promotes, publishes, repairs, or mutates canonical state —
 * the conductor has no such phase and its deps are verb-stripped.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { relative, resolve } from "path";
import { runPilotRoleReadinessCampaign } from "../../orchestrator/forwardPilotRoleReadinessCampaign.js";

import { validateExperimentSpec } from "./spec.js";
import { buildSampleSchedule } from "./schedule.js";
import {
  migrationRoots,
  assertNotClosed,
  assertNotCanonical,
  CLOSED_EXPERIMENT_IDS,
} from "./guards.js";
import { runMigrationExperiment, type RunMigrationOptions } from "./runExperiment.js";
import type { ExperimentSpecV1, MigrationManifestV1, MigrationPhase } from "./experimentTypes.js";
// IMP-20 WP-C1 — split-lane / §16-recovery CLI subverbs. Every conductor below is
// PURE: no model call, no codex exec, no API/SDK/HTTP; the recovery pilot dry run
// makes ZERO spawns (its planned routes all resolve to the injected test route).
import {
  ROLE_QUALIFICATION_REGISTRY_SCHEMA,
  SPLIT_LANE_CORPUS_CONFIG_SCHEMA,
  type ReviewLaneRole,
  type RoleQualificationRegistryV1,
  type SplitLaneCorpusConfigV1,
} from "./reviewLaneTypes.js";
import { CorpusBuildError, canonicalPretty, readCorpusSpecV2, readMutationSpec } from "./corpusBuilderCore.js";
import { buildReaderCorpus, buildReaderCorpusV2 } from "./readerCorpusBuilder.js";
import { buildImp22SourceCorpus, buildSourceCorpus } from "./sourceCorpusBuilder.js";
import { buildQuizCorpus, buildQuizCorpusV2 } from "./quizCorpusBuilder.js";
import { generateLayerNRetrospective } from "./layerNRetrospective.js";
import { assertRoleSetReady } from "./roleQualification.js";
import {
  RECOVERY_EXPERIMENT_ID,
  RECOVERY_REQUIRED_ROLES,
  buildRecoveryExperimentSpec,
  prepareRecoverySeal,
  runRecoveryPilotDryRun,
  recoveryArtifactFiles,
  type RecoverySpecInputsV1,
} from "./recoveryExperiment.js";
import { PIPELINE_DIR } from "../paths.js";
import { hashCanonical, sha256Hex } from "../../contracts/contractUtil.js";
import { resolveExecutionProfile } from "../../exec/executionEnvelope.js";
import { ROUTE_POLICY_VERSION } from "../../orchestrator/modelPolicy.js";
import { writeFileAtomic } from "../../lib/atomicWrite.js";
import {
  type LiveQualificationPreflightV1,
} from "../../orchestrator/forwardRoleQualificationLive.js";
import {
  type RunForwardLiveCampaignResultV1,
} from "../../orchestrator/forwardLiveValidationDriver.js";
import {
  FORWARD_PRODUCTION_INSTRUMENT_SEAL_ARTIFACT_REL_PATH,
  IMP24_FORWARD_PRODUCTION_INSTRUMENT_SEAL_ARTIFACT_REL_PATH,
  IMP24F_FORWARD_PRODUCTION_INSTRUMENT_SEAL_ARTIFACT_REL_PATH,
  materializeForwardProductionInstrumentSeal,
  verifyRetainedForwardProductionInstrumentSeal,
} from "../../orchestrator/forwardProductionInstrumentSeal.js";
import {
  materializeImp24fCandidateInstrument,
  verifyHistoricalImp24InstrumentIdentity,
  verifyImp24fCandidateInstrument,
} from "./imp24fCandidateInstrument.js";
import { materializeReaderGoldDevPoolSelection } from "./readerGoldDevPool.js";
import { materializeReaderGoldDevDocs } from "./readerGoldDevDocs.js";
import {
  buildRubricAuditReport,
  materializeRubricAuditBatch,
  rubricAuditDirRelPath,
  verifyOwnerRubricAuditRun,
  type RubricAuditBatchManifestV1,
} from "./rubricAuditInstrument.js";
import {
  ingestAdjudicationRecord,
  ingestRaterRecord,
  renderRaterTaskDocument,
  summarizeAudit,
} from "./rubricAuditHarness.js";
import { assembleAuditPackage } from "../auditPackageAssembler.js";
import { materializePilotRoleReadiness, materializePilotRoleReadinessV2, materializePilotRoleReadinessV3, materializePilotRoleReadinessV4, materializePilotRoleReadinessV5, materializePilotRoleReadinessV6 } from "./pilotRoleReadinessInstrument.js";
import {
  buildGoldArtifacts,
  buildPilotArtifacts,
  buildQualificationAndRoleFreezeArtifacts,
  stableForwardArtifactJson,
  type RetainedQualificationSpecV2,
} from "../../orchestrator/forwardLiveArtifactMaterializer.js";
import type { ForwardInputFreezeV1 } from "../../orchestrator/forwardInputFreeze.js";
import {
  materializeImp24ForwardInputs,
  type Imp22ForwardInputMaterializationV1,
} from "../../orchestrator/forwardInputMaterialization.js";
import type { ForwardProductionInstrumentSealV1 } from "../../orchestrator/forwardProductionInstrumentSeal.js";
import type { ForwardRoleAssignmentFreezeV1 } from "../../orchestrator/forwardRoleAssignmentFreeze.js";
import type { RecoveryExperimentSpecV1 } from "./reviewLaneTypes.js";
import {
  IMP24_FROZEN_ROLE_THRESHOLDS,
  type InstrumentCertificationBindingV3,
} from "./roleQualificationRunnerV3.js";
import {
  IMP24_CERTIFICATION_ARTIFACT_PATHS,
  certifyImp24Instrument,
  materializeImp24InstrumentCertification,
} from "./imp24InstrumentCertification.js";
import {
  buildImp24BPreLiveFreeze,
  materializeImp24BPreLiveFreeze,
  verifyImp24CPreLiveFreeze,
} from "./imp24PreLiveFreeze.js";
import {
  buildImp24DObservabilityFreeze,
  materializeImp24DObservabilityFreeze,
  verifyHistoricalImp24DObservabilityFreeze,
  verifyImp24DObservabilityFreeze,
} from "./imp24ObservabilityFreeze.js";
import {
  buildImp24CFinalAttestation,
  materializeImp24CFinalAttestation,
  verifyImp24CFinalAttestation,
  verifyRetainedImp24CFinalAttestation,
} from "./imp24FinalAttestation.js";
import {
  buildImp24DFinalAttestation,
  materializeImp24DFinalAttestation,
  verifyImp24DFinalAttestation,
  verifyRetainedImp24DFinalAttestation,
} from "./imp24DFinalAttestation.js";
import {
  IMP24_ROLE_QUALIFICATION_EXECUTION_ID,
  certifyImp24Corpora,
  type Imp24CorpusBundle,
} from "./imp24Corpus.js";
import type { RecoveryRoleThresholdsV1 } from "./reviewLaneTypes.js";
import {
  IMP24_CANDIDATE_AVAILABILITY_POLICY_BYTES_SHA256,
  IMP24_FROZEN_CANDIDATE_AVAILABILITY_POLICY,
  discoverCandidateAvailabilityV3,
  type CandidateAvailabilityPolicyV3,
  type UnpreparedLiveRoleQualificationInputV3,
} from "../../orchestrator/forwardRoleQualificationLiveV3.js";
import {
  runImp24RoleQualificationCampaignV3,
} from "../../orchestrator/forwardRoleQualificationCampaignV3.js";
import {
  runImp24DTransportSmoke,
} from "../../orchestrator/forwardTransportSmokeCampaignV3.js";
import {
  runImp24ESchemaProbes,
  type Imp24ESchemaProbeCycleNumber,
  type RunImp24ESchemaProbeArgs,
} from "../../orchestrator/imp24eSchemaProbe.js";
import {
  runImp24ETransportSmoke,
  type Imp24ETransportSmokeCycleNumber,
  type RunImp24ETransportSmokeArgs,
} from "../../orchestrator/imp24eTransportSmoke.js";
import {
  materializeImp24DTransportMechanicalCorrection,
  type Imp24DTransportMechanicalDefectClassV1,
} from "../../orchestrator/forwardTransportSmokeEvidenceV3.js";
import {
  materializeImp24GoldV2Envelope,
  materializeImp24PilotV2Envelope,
  runImp24GoldV2EnvelopeLive,
  runImp24PilotV2EnvelopeLive,
} from "./imp24PilotGoldWorkflow.js";
import {
  activateImp24LocalV3,
  recordImp24ActivationFullSuiteV3,
  verifyImp24LocalActivationV3,
} from "./imp24ActivationWorkflow.js";

const USAGE =
  `Usage: migration-bakeoff <plan|seal|qualify|run|analyze|decide|status>\n` +
  `         --experiment <spec.json | experimentId>\n` +
  `         [--corpus <corpus.json>] [--state-root <dir>] [--max-parallel 2]\n` +
  `         [--allow-synthetic-qualification] [--json]\n` +
  `       No-publish migration harness (Stage Q/D/C). Never promotes, never\n` +
  `       repairs, never touches canonical state; activation is IMP-13's package.\n` +
  `\n` +
  `       IMP-20 split-lane / §16-recovery subverbs (all no-model, no-write by\n` +
  `       default; pass --write to persist committed artifacts):\n` +
  `         close-legacy-campaign         verify the mechanical §16 closure freeze\n` +
  `         build-reader-corpus           build the reader role corpus (fail-closed)\n` +
  `         build-source-corpus           build the source role corpus (fail-closed)\n` +
  `         build-quiz-corpus             build the quiz role corpus (fail-closed)\n` +
  `         build-reader-corpus-v2        build IMP-22 reader calibration+holdout\n` +
  `         build-source-corpus-v2        build IMP-22 source calibration+holdout\n` +
  `         build-quiz-corpus-v2          build IMP-22 quiz calibration+holdout\n` +
  `         retrospective                 static Layer-N v2 → split-lane re-projection\n` +
  `         recovery-preflight            build+preflight the recovery spec/seal-prep\n` +
  `         recovery-pilot-dryrun         no-model pilot dry run (ZERO spawns)\n` +
  `\n` +
  `       Historical qualification mutation subverbs (V1/V2 CLOSED; always fail\n` +
  `       with their retained disposition and perform zero auth/model/write activity):\n` +
  `         role-qualification-calibrate | role-qualification-holdout | role-qualification-attest-calibration\n` +
  `       IMP-24 live qualification (ChatGPT-authenticated codex exec; exact retained\n` +
  `       V3 artifacts; require literal --execute-live):\n` +
  `         imp24e-schema-probes --execute-live --head-sha SHA --workflow-run-id ID [--json]\n` +
  `         imp24e-schema-probes-r2 --execute-live --head-sha SHA --workflow-run-id ID [--json]\n` +
  `         imp24e-transport-smoke --execute-live --head-sha SHA --workflow-run-id ID [--models-cache FILE] [--json]\n` +
  `         imp24e-transport-smoke-r2 --execute-live --head-sha SHA --workflow-run-id ID [--models-cache FILE] [--json]\n` +
  `         imp24-transport-smoke-v3 --execute-live --head-sha SHA --workflow-run-id ID [--models-cache FILE] [--json]\n` +
  `         imp24-transport-smoke-v3-r2 --execute-live --head-sha SHA --workflow-run-id ID [--models-cache FILE] [--json]\n` +
  `         imp24-materialize-transport-correction-diagnosis --write --defect-class CLASS --rationale TEXT [--json]\n` +
  `         imp24-role-qualification-v3 --execute-live --head-sha SHA --workflow-run-id ID [--models-cache FILE] [--timeout-ms N] [--json]\n` +
  `         pilot-role-readiness-campaign --execute-live --head-sha SHA --workflow-run-id ID [--models-cache FILE] [--timeout-ms N] [--json]\n` +
  `         imp24-pilot-v2-envelope       run the exact fresh eight-chapter pilot\n` +
  `         imp24-gold-v2-envelope        run the exact fresh 13-chapter gold book\n` +
  `       Closed IMP-22 transition/live subverbs always fail with\n` +
  `       BLOCKED_CALIBRATION_INVALID before any read, write, auth, or call:\n` +
  `         role-qualification-freeze | forward-materialize-pilot-artifacts | forward-materialize-gold-artifacts | forward-pilot | forward-gold\n` +
  `       IMP-22 local read-only/reporting helpers remain available.\n` +
  `         imp24-materialize-pilot-v2-envelope [--write] [--json]\n` +
  `         imp24-materialize-gold-v2-envelope [--write] [--json]\n` +
  `         imp24-record-activation-full-suite-v3 --execute-local-suite --head-sha SHA\n` +
  `         imp24-activate-local-v3 --activate-local --activated-at ISO --head-sha SHA\n` +
  `         imp24-verify-local-activation-v3 --head-sha SHA\n` +
  `       Closed IMP-23 V2 activation subverbs always fail before evidence reads:\n` +
  `         forward-activate-local | forward-verify-local-activation\n` +
  `         forward-materialize-production-instrument-seal [--output FILE] [--write] [--json]\n` +
  `         imp24-materialize-thresholds [--write] [--json]\n` +
  `         imp24-certify-instrument [--write] [--json]\n` +
  `         imp24-materialize-pre-live-freeze [--write|--verify] [--json]\n` +
  `         imp24-materialize-observability-freeze [--write|--verify] [--json]\n` +
  `         imp24-materialize-observability-freeze --verify-historical --observability-commit SHA [--json]\n` +
  `         imp24-materialize-final-attestation --implementation-commit SHA --evidence-commit SHA\n` +
  `           --terminal-result FILE --ci-evidence FILE [--role-assignment FILE]\n` +
  `           [--write|--verify|--verify-retained] [--json]\n` +
  `         imp24d-materialize-final-attestation --implementation-commit SHA --evidence-commit SHA\n` +
  `           [--write|--verify] [--json]\n` +
  `         imp24d-materialize-final-attestation --verify-retained [--json]\n` +
  `         imp24-materialize-forward-inputs [--write] [--state-root DIR] [--json]\n` +
  `           default: ${FORWARD_PRODUCTION_INSTRUMENT_SEAL_ARTIFACT_REL_PATH}`;

/** IMP-20 subverbs handled as their own branches (like `plan`/`status`), each
 *  delegating to a PURE conductor. None makes a model call. */
const SPLIT_LANE_SUBVERBS: ReadonlySet<string> = new Set([
  "close-legacy-campaign",
  "build-reader-corpus",
  "build-source-corpus",
  "build-quiz-corpus",
  "build-reader-corpus-v2",
  "build-source-corpus-v2",
  "build-quiz-corpus-v2",
  "retrospective",
  "recovery-preflight",
  "recovery-pilot-dryrun",
]);

const LIVE_QUALIFICATION_SUBVERBS: ReadonlySet<string> = new Set([
  "role-qualification-calibrate",
  "role-qualification-holdout",
  "imp24-transport-smoke-v3",
  "imp24-transport-smoke-v3-r2",
  "imp24e-transport-smoke",
  "imp24e-transport-smoke-r2",
  "imp24-role-qualification-v3",
  "pilot-role-readiness-campaign",
]);

const IMP24E_SCHEMA_PROBE_SUBVERBS: ReadonlySet<string> = new Set([
  "imp24e-schema-probes",
  "imp24e-schema-probes-r2",
]);

const LIVE_FORWARD_SUBVERBS: ReadonlySet<string> = new Set([
  "forward-pilot",
  "forward-gold",
  "imp24-pilot-v2-envelope",
  "imp24-gold-v2-envelope",
]);

const LOCAL_QUALIFICATION_SUBVERBS: ReadonlySet<string> = new Set([
  "role-qualification-attest-calibration",
]);

const LOCAL_FORWARD_SUBVERBS: ReadonlySet<string> = new Set([
  "forward-materialize-production-instrument-seal",
  "forward-materialize-production-instrument-seal-v2",
  "forward-verify-production-instrument-seal-v2",
  "imp24-materialize-thresholds",
  "imp24-certify-instrument",
  "imp24-materialize-pre-live-freeze",
  "imp24-materialize-observability-freeze",
  "imp24-materialize-transport-correction-diagnosis",
  "imp24-materialize-final-attestation",
  "imp24d-materialize-final-attestation",
  "imp24-materialize-forward-inputs",
  "reader-gold-dev-pool",
  "reader-gold-dev-docs",
  "rubric-audit-batch",
  "rubric-audit-report",
  "rubric-verify-owner-run",
  "rubric-audit-render-task",
  "rubric-audit-ingest",
  "rubric-audit-status",
  "assemble-audit-package",
  "pilot-role-readiness",
  "pilot-role-readiness-v2",
  "pilot-role-readiness-v3",
  "pilot-role-readiness-v4",
  "pilot-role-readiness-v5",
  "pilot-role-readiness-v6",
  "role-qualification-freeze",
  "forward-materialize-pilot-artifacts",
  "forward-materialize-gold-artifacts",
  "imp24-materialize-pilot-v2-envelope",
  "imp24-materialize-gold-v2-envelope",
  "imp24-record-activation-full-suite-v3",
  "imp24-activate-local-v3",
  "imp24-verify-local-activation-v3",
  "forward-activate-local",
  "forward-verify-local-activation",
]);

const IMP24_CLOSED_QUALIFICATION_DISPOSITIONS = Object.freeze({
  "s16-forward-role-qualification-v1": "INVALID_INSTRUMENT_DO_NOT_ATTEST",
  "s16-forward-role-qualification-v2": "BLOCKED_CALIBRATION_INVALID",
  "s16-forward-role-qualification-v3-envelope": "BLOCKED_ZERO_CALL_CONTROL_PLANE_DEFECT",
} as const);

function closedQualificationDisposition(experimentId: string): string | null {
  return Object.prototype.hasOwnProperty.call(IMP24_CLOSED_QUALIFICATION_DISPOSITIONS, experimentId)
    ? IMP24_CLOSED_QUALIFICATION_DISPOSITIONS[experimentId as keyof typeof IMP24_CLOSED_QUALIFICATION_DISPOSITIONS]
    : null;
}

function refuseClosedQualification(subverb: string, experimentId: string, disposition: string): 2 {
  console.error(`${subverb}: ${experimentId} is closed with disposition ${disposition}; canResume=false; mayContributeToQualification=false`);
  return 2;
}

/** Deterministic provenance stamp for regenerated recovery artifacts — reused
 *  verbatim from the WP-B10 committed spec/seal-prep so a `--write` regeneration
 *  is byte-idempotent (never introduces a wall-clock drift). */
const RECOVERY_ARTIFACT_STAMP = "2026-07-12T00:00:00.000Z";

const PHASE_OF_SUBVERB: Record<string, MigrationPhase> = {
  seal: "seal",
  qualify: "qualify",
  run: "review",
  analyze: "analyze",
  decide: "report",
};

function readSpecArg(experiment: string): { spec: ExperimentSpecV1 | null; experimentId: string; specPath?: string } {
  const asPath = resolve(experiment);
  if (existsSync(asPath) && /\.json$/.test(asPath)) {
    try {
      const spec = JSON.parse(readFileSync(asPath, "utf8")) as ExperimentSpecV1;
      return { spec, experimentId: spec.experimentId ?? "", specPath: asPath };
    } catch {
      return { spec: null, experimentId: "" };
    }
  }
  return { spec: null, experimentId: experiment };
}

// ── IMP-20 split-lane / recovery subverb helpers (pure conductors) ────────────

/** The committed A3 contract inputs directory (NON-canonical; outside the
 *  book/chapter trees). Resolved from PIPELINE_DIR, never from ambient env. */
function contractsDir(): string {
  return resolve(PIPELINE_DIR, "state", "migration-experiments", "contracts");
}
function migrationExperimentsDir(): string {
  return resolve(PIPELINE_DIR, "state", "migration-experiments");
}
/** The repo-root book-packages corpus (read-only source for the builders). */
function bookPackagesDir(): string {
  return resolve(PIPELINE_DIR, "..", "..", "..", "..", "book-packages");
}
/** The repo-root docs/v25/reports directory (retrospective artifacts). */
function reportsDir(): string {
  return resolve(PIPELINE_DIR, "..", "..", "..", "..", "docs", "v25", "reports");
}
function sha256OfJsonFile(absPath: string): string {
  return hashCanonical(JSON.parse(readFileSync(absPath, "utf8")));
}

/** Reproduce the WP-B10 `RecoverySpecInputsV1` from the committed A3 files — the
 *  nine instrument hashes (three schema shas, thresholds sha, three corpus-BUILD
 *  spec shas, the execution-profile hash, the route-policy version) plus the
 *  three frozen seeds. hashCanonical(parsed JSON) reproduces the committed spec
 *  byte-for-byte; the seeds are the frozen recovery identity seeds. */
function recoverySpecInputs(): RecoverySpecInputsV1 {
  const c = contractsDir();
  return {
    readerSchemaSha256: sha256OfJsonFile(resolve(c, "schemas", "reader-experience-review.schema.json")),
    sourceSchemaSha256: sha256OfJsonFile(resolve(c, "schemas", "source-integrity-review.schema.json")),
    quizAdjudicationSchemaSha256: sha256OfJsonFile(resolve(c, "schemas", "quiz-integrity-adjudication.schema.json")),
    executionProfileHash: resolveExecutionProfile("chapter-reviewer").profileHash,
    routePolicyVersion: ROUTE_POLICY_VERSION,
    thresholdsSha256: sha256OfJsonFile(resolve(c, "recovery-role-thresholds.v1.json")),
    readerCorpusSha256: sha256OfJsonFile(resolve(c, "reader-corpus-spec.json")),
    sourceCorpusSha256: sha256OfJsonFile(resolve(c, "source-corpus-spec.json")),
    quizCorpusSha256: sha256OfJsonFile(resolve(c, "quiz-corpus-spec.json")),
    randomizationSeed: "s16-recovery-v1-seed-0001",
    pilotSeed: "s16-recovery-v1-pilot-seed-0001",
    diagnosticSeed: "s16-recovery-v1-diagnostic-seed-0001",
  };
}

/** Build the fully data-driven corpus config for a role from the committed
 *  mutation spec (fail-closed if the spec is missing). */
function corpusConfig(role: ReviewLaneRole): SplitLaneCorpusConfigV1 {
  const c = contractsDir();
  const mutationSpecPath = resolve(c, `${role}-corpus-spec.json`);
  const spec = readMutationSpec(mutationSpecPath, role);
  return {
    schema: SPLIT_LANE_CORPUS_CONFIG_SCHEMA,
    role,
    sourceRoots: { bookPackagesDir: bookPackagesDir() },
    mutationSpecPath,
    cleanBaseScoreLedgerPath: resolve(c, "clean-base-score-ledger.v1.json"),
    excludedCandidateBookIds: spec.excludedCandidateBookIds ?? [],
    minRenderBytes: spec.minRenderBytes,
  };
}

/** IMP-22 role specs are additive v2 inputs. Selecting one is explicit
 * at the CLI boundary so no preserved IMP-20 command or evidence is rewritten. */
function corpusConfigV2(role: "reader" | "source" | "quiz"): SplitLaneCorpusConfigV1 {
  const c = contractsDir();
  const mutationSpecPath = resolve(
    c,
    role === "source" ? "imp22-source-corpus-spec.json" : `${role}-corpus-spec.imp22-v2.json`,
  );
  const spec = readCorpusSpecV2(mutationSpecPath, role);
  return {
    schema: SPLIT_LANE_CORPUS_CONFIG_SCHEMA,
    role,
    sourceRoots: { bookPackagesDir: bookPackagesDir() },
    mutationSpecPath,
    cleanBaseScoreLedgerPath: resolve(c, "clean-base-score-ledger.v1.json"),
    excludedCandidateBookIds: spec.excludedCandidateBookIds,
    minRenderBytes: spec.minRenderBytes,
  };
}

/** `close-legacy-campaign` — verify the mechanical §16 closure freeze holds
 *  (read-only): every id in the committed closure `.json` is frozen by the
 *  in-code `assertNotClosed`, the in-code `CLOSED_EXPERIMENT_IDS` set is a superset
 *  of the closure list, and the NEW recovery id is NOT frozen. No write, no model. */
function runCloseLegacyCampaign(json: boolean): number {
  const closurePath = resolve(migrationExperimentsDir(), "S16_LEGACY_CAMPAIGN_CLOSURE.json");
  if (!existsSync(closurePath)) {
    console.error("close-legacy-campaign: closure artifact not present (WP-B8 must land S16_LEGACY_CAMPAIGN_CLOSURE.json).");
    return 1;
  }
  const closure = JSON.parse(readFileSync(closurePath, "utf8")) as {
    status?: string;
    closedExperimentIds?: string[];
    canResume?: boolean;
  };
  const closedIds = closure.closedExperimentIds ?? [];
  const problems: string[] = [];
  for (const id of closedIds) {
    let frozen = false;
    try { assertNotClosed(id); } catch { frozen = true; }
    if (!frozen) problems.push(`closure id "${id}" is NOT frozen by assertNotClosed`);
    if (!CLOSED_EXPERIMENT_IDS.has(id)) problems.push(`closure id "${id}" is absent from in-code CLOSED_EXPERIMENT_IDS`);
  }
  for (const id of CLOSED_EXPERIMENT_IDS) {
    if (!closedIds.includes(id)) problems.push(`in-code closed id "${id}" is absent from the closure .json`);
  }
  let recoveryFrozen = false;
  try { assertNotClosed(RECOVERY_EXPERIMENT_ID); } catch { recoveryFrozen = true; }
  if (recoveryFrozen) problems.push(`the NEW recovery id "${RECOVERY_EXPERIMENT_ID}" must NOT be frozen`);
  const out = {
    status: closure.status ?? "unknown",
    canResume: closure.canResume ?? null,
    closedExperimentIds: closedIds,
    freezeHolds: problems.length === 0,
    problems,
  };
  if (json) console.log(JSON.stringify(out, null, 2));
  else {
    console.log(`[migration] legacy §16 campaign: ${out.status} (canResume=${String(out.canResume)}); ${closedIds.length} closed id(s), freeze ${out.freezeHolds ? "HOLDS" : "BROKEN"}`);
    for (const p of problems) console.log(`  ✗ ${p}`);
  }
  return problems.length === 0 ? 0 : 1;
}

/** `build-{reader,source,quiz}-corpus` — run the PURE hermetic builder over the
 *  committed spec + real 140-eval book packages. Fail-closed: a `CorpusBuildError`
 *  (owner gold pending, spec missing, or an admission refusal) is surfaced, never
 *  substituted with a shrunken corpus. Writes the built corpus + provenance to
 *  the NON-canonical contracts dir only under `--write` (a one-time, git-committed
 *  action outside the leak-guarded suite). */
function runBuildCorpus(role: ReviewLaneRole, write: boolean, json: boolean): number {
  let config: SplitLaneCorpusConfigV1;
  try {
    config = corpusConfig(role);
  } catch (err) {
    if (err instanceof CorpusBuildError) {
      console.error(`build-${role}-corpus: ${err.message}`);
      return 1;
    }
    throw err;
  }
  let result;
  try {
    result =
      role === "reader" ? buildReaderCorpus(config)
      : role === "source" ? buildSourceCorpus(config)
      : buildQuizCorpus(config);
  } catch (err) {
    if (err instanceof CorpusBuildError) {
      // Honest fail-closed boundary (design R-3): the committed specs still
      // depend on owner-authored gold. The builder refuses to fabricate/shrink.
      const detail = err.detail ?? {};
      if (json) console.log(JSON.stringify({ role, built: false, error: err.message, detail }, null, 2));
      else {
        console.error(`build-${role}-corpus: FAIL-CLOSED — ${err.message}`);
        console.error(`  (the builder never substitutes an empty/shrunken corpus; supply the pending owner gold, then rerun with --write)`);
      }
      return 1;
    }
    throw err;
  }
  const corpusPath = resolve(contractsDir(), `${role}-corpus.v1.json`);
  const provPath = resolve(contractsDir(), `${role}-corpus-provenance.v1.json`);
  if (write) {
    assertNotCanonical(corpusPath);
    writeFileAtomic(corpusPath, result.corpusBytes);
    assertNotCanonical(provPath);
    writeFileAtomic(provPath, canonicalPretty(result.provenanceManifest));
  }
  const out = {
    role,
    built: true,
    written: write,
    corpusSha256: result.provenanceManifest.corpusSha256,
    generatedComposition: result.corpus.generatedComposition,
    corpusPath: write ? corpusPath : null,
    provenancePath: write ? provPath : null,
  };
  if (json) console.log(JSON.stringify(out, null, 2));
  else console.log(`[migration] build-${role}-corpus: ${write ? "WROTE" : "DRY (no write; pass --write)"} corpus sha ${out.corpusSha256.slice(0, 12)}… composition ${JSON.stringify(out.generatedComposition)}`);
  return 0;
}

/** `build-{reader,source,quiz}-corpus-v2` materializes an IMP-22 partitioned corpus.
 * The pure builders return canonical bytes; this CLI owns the only optional
 * write and uses distinct filenames so the IMP-20 v1 artifacts stay intact. */
function runBuildCorpusV2(role: "reader" | "source" | "quiz", write: boolean, json: boolean): number {
  let config: SplitLaneCorpusConfigV1;
  try {
    config = corpusConfigV2(role);
  } catch (err) {
    if (err instanceof CorpusBuildError) {
      console.error(`build-${role}-corpus-v2: ${err.message}`);
      return 1;
    }
    throw err;
  }
  let result;
  try {
    result = role === "reader"
      ? buildReaderCorpusV2(config)
      : role === "source"
        ? buildImp22SourceCorpus(config)
        : buildQuizCorpusV2(config);
  } catch (err) {
    if (err instanceof CorpusBuildError) {
      const detail = err.detail ?? {};
      if (json) console.log(JSON.stringify({ role, version: 2, built: false, error: err.message, detail }, null, 2));
      else console.error(`build-${role}-corpus-v2: FAIL-CLOSED — ${err.message}`);
      return 1;
    }
    throw err;
  }
  const corpusPath = resolve(contractsDir(), `${role}-corpus.imp22-v2.json`);
  const provPath = resolve(contractsDir(), `${role}-corpus-provenance.imp22-v2.json`);
  if (write) {
    assertNotCanonical(corpusPath);
    writeFileAtomic(corpusPath, result.corpusBytes);
    assertNotCanonical(provPath);
    writeFileAtomic(provPath, canonicalPretty(result.provenanceManifest));
  }
  const out = {
    role,
    version: 2,
    built: true,
    written: write,
    substantiveCorpusSha256: result.provenanceManifest.substantiveCorpusSha256,
    corpusBytesSha256: result.provenanceManifest.corpusBytesSha256,
    generatedCompositionByPartition: {
      calibration: result.corpus.partitions.calibration.generatedComposition,
      holdout: result.corpus.partitions.holdout.generatedComposition,
    },
    corpusPath: write ? corpusPath : null,
    provenancePath: write ? provPath : null,
  };
  if (json) console.log(JSON.stringify(out, null, 2));
  else console.log(`[migration] build-${role}-corpus-v2: ${write ? "WROTE" : "DRY (no write; pass --write)"} corpus ${out.corpusBytesSha256.slice(0, 19)}… composition ${JSON.stringify(out.generatedCompositionByPartition)}`);
  return 0;
}

/** `retrospective` — regenerate the static Layer-N v2 → split-lane retrospective
 *  (PURE; no model, no qualification, no adjudication). Writes the md+json to
 *  docs/v25/reports only under `--write`. */
function runRetrospective(write: boolean, json: boolean): number {
  const { report, markdown, json: jsonStr } = generateLayerNRetrospective();
  if (write) {
    writeFileAtomic(resolve(reportsDir(), "LAYER_N_V2_SPLIT_LANE_RETROSPECTIVE.md"), markdown);
    writeFileAtomic(resolve(reportsDir(), "LAYER_N_V2_SPLIT_LANE_RETROSPECTIVE.json"), jsonStr);
  }
  const out = {
    written: write,
    producesQualification: report.producesQualification,
    totalCaseJudgeViews: report.summary.totalCaseJudgeViews,
    shipBitArtifactCount: report.summary.shipBitArtifactCount,
    sourceDependentFailureCount: report.summary.sourceDependentFailureCount,
    disputedCaseGoldMarkings: report.summary.disputedCaseGoldMarkings,
  };
  if (json) console.log(JSON.stringify(out, null, 2));
  else console.log(`[migration] retrospective: ${write ? "WROTE md+json" : "DRY (no write; pass --write)"} — ${out.totalCaseJudgeViews} case×judge views, producesQualification=${String(out.producesQualification)}`);
  return 0;
}

/** `recovery-preflight` — build the recovery spec from the committed A3 inputs and
 *  prepare (never finalize) the seal against an EMPTY registry, proving the
 *  fail-closed gate: no role-qualified reviewer set exists yet, so the diagnostic
 *  is NOT sealable. No model. Writes spec.json + seal-prep.json only under `--write`. */
function runRecoveryPreflight(write: boolean, json: boolean): number {
  const spec = buildRecoveryExperimentSpec(recoverySpecInputs());
  const emptyRegistry: RoleQualificationRegistryV1 = { schema: ROLE_QUALIFICATION_REGISTRY_SCHEMA, profiles: [] };
  const sealPrep = prepareRecoverySeal(
    spec,
    emptyRegistry,
    RECOVERY_REQUIRED_ROLES,
    { assertRoleSetReady, assertNotClosed },
    RECOVERY_ARTIFACT_STAMP,
  );
  if (write) {
    const dir = resolve(migrationExperimentsDir(), RECOVERY_EXPERIMENT_ID);
    const specPath = resolve(dir, "spec.json");
    const prepPath = resolve(dir, "seal-prep.json");
    assertNotCanonical(specPath);
    writeFileAtomic(specPath, `${JSON.stringify(spec, null, 2)}\n`);
    assertNotCanonical(prepPath);
    writeFileAtomic(prepPath, `${JSON.stringify(sealPrep, null, 2)}\n`);
  }
  const out = {
    written: write,
    experimentId: spec.experimentId,
    specSha256: sealPrep.specSha256,
    instrumentManifestSha256: sealPrep.instrumentManifestSha256,
    sealed: sealPrep.sealed,
    roleQualifiedSetExists: sealPrep.roleQualifiedSetExists,
    sealBlockedReason: sealPrep.sealBlockedReason,
    proposedQualificationCalls: sealPrep.proposedQualificationCalls,
    proposedPilotCalls: sealPrep.proposedPilotCalls,
    proposedHardCeiling: sealPrep.proposedHardCeiling,
    separateAuthorizationRequired: sealPrep.separateAuthorizationRequired,
    imp13Dormant: sealPrep.imp13Dormant,
    productionActivation: sealPrep.productionActivation,
  };
  if (json) console.log(JSON.stringify(out, null, 2));
  else console.log(`[migration] recovery-preflight ${out.experimentId}: sealed=${String(out.sealed)} roleQualifiedSetExists=${String(out.roleQualifiedSetExists)} — proposed ${out.proposedQualificationCalls}+${out.proposedPilotCalls} (ceiling ${out.proposedHardCeiling}); ${write ? "WROTE spec+seal-prep" : "DRY (no write; pass --write)"}`);
  return 0;
}

/** `recovery-pilot-dryrun` — the no-model pilot dry run: builds the 16 candidate
 *  cells, plans every would-be spawn onto the `injected_test_runner` route, and
 *  makes ZERO model calls (an injected spawn double would throw if reached).
 *  Writes the pilot-dryrun artifact under `--write`. */
function runRecoveryPilotDryRunSubverb(write: boolean, json: boolean): number {
  const spec = buildRecoveryExperimentSpec(recoverySpecInputs());
  const dryRun = runRecoveryPilotDryRun(
    spec,
    {
      assertNotClosed,
      onSpawnAttempt: () => {
        throw new Error("recovery-pilot-dryrun made a spawn attempt — a dry run must make ZERO model calls");
      },
    },
    RECOVERY_ARTIFACT_STAMP,
  );
  if (write) {
    const emptyRegistry: RoleQualificationRegistryV1 = { schema: ROLE_QUALIFICATION_REGISTRY_SCHEMA, profiles: [] };
    const sealPrep = prepareRecoverySeal(
      spec,
      emptyRegistry,
      RECOVERY_REQUIRED_ROLES,
      { assertRoleSetReady, assertNotClosed },
      RECOVERY_ARTIFACT_STAMP,
    );
    for (const file of recoveryArtifactFiles(spec, sealPrep, dryRun)) {
      const absPath = resolve(migrationExperimentsDir(), file.relPath);
      assertNotCanonical(absPath);
      writeFileAtomic(absPath, file.bytes);
    }
  }
  const out = {
    written: write,
    experimentId: dryRun.experimentId,
    cellCount: dryRun.cellCount,
    plannedSpawns: dryRun.plannedSpawns.length,
    auditSubsetCells: dryRun.auditSubsetCellIds.length,
    modelCallsMade: dryRun.modelCallsMade,
    apiCallsMade: dryRun.apiCallsMade,
    routeInvariantHeld: dryRun.routeInvariantHeld,
    fixedRoleAssignmentSha256: dryRun.fixedRoleAssignmentSha256,
    imp13Dormant: dryRun.imp13Dormant,
    productionActivation: dryRun.productionActivation,
  };
  if (json) console.log(JSON.stringify(out, null, 2));
  else console.log(`[migration] recovery-pilot-dryrun ${out.experimentId}: ${out.cellCount} cells, ${out.plannedSpawns} planned spawns, modelCalls=${out.modelCallsMade} apiCalls=${out.apiCallsMade}, routeInvariantHeld=${String(out.routeInvariantHeld)}; ${write ? "WROTE pilot-dryrun" : "DRY (no write; pass --write)"}`);
  return dryRun.routeInvariantHeld && dryRun.modelCallsMade === 0 && dryRun.apiCallsMade === 0 ? 0 : 1;
}

/** Dispatch an IMP-20 split-lane / recovery subverb. Returns the process code. */
function runSplitLaneSubverb(subverb: string, flags: Record<string, string | boolean>): number {
  const json = flags["json"] === true;
  const write = flags["write"] === true;
  switch (subverb) {
    case "close-legacy-campaign": return runCloseLegacyCampaign(json);
    case "build-reader-corpus": return runBuildCorpus("reader", write, json);
    case "build-source-corpus": return runBuildCorpus("source", write, json);
    case "build-quiz-corpus": return runBuildCorpus("quiz", write, json);
    case "build-reader-corpus-v2": return runBuildCorpusV2("reader", write, json);
    case "build-source-corpus-v2": return runBuildCorpusV2("source", write, json);
    case "build-quiz-corpus-v2": return runBuildCorpusV2("quiz", write, json);
    case "retrospective": return runRetrospective(write, json);
    case "recovery-preflight": return runRecoveryPreflight(write, json);
    case "recovery-pilot-dryrun": return runRecoveryPilotDryRunSubverb(write, json);
    default:
      console.error(USAGE);
      return 2;
  }
}

export type Imp24RoleQualificationCliArtifactsV3 = {
  corpusBundle: Imp24CorpusBundle;
  certification: InstrumentCertificationBindingV3;
  productionInstrumentSeal: ForwardProductionInstrumentSealV1;
  thresholds: RecoveryRoleThresholdsV1;
  thresholdBytesSha256: string;
};

export type Imp24RoleQualificationCliDepsV3 = {
  repositoryRoot?: string;
  /** Outer CLI boundary supplies its explicit runtime context here. The
   * migration module itself is spec/argv driven and never reads ambient env. */
  modelsCachePath?: string;
  clock?: () => Date;
  loadArtifacts?: (repositoryRoot: string) => Imp24RoleQualificationCliArtifactsV3;
  discoverAvailability?: typeof discoverCandidateAvailabilityV3;
  runCampaign?: typeof runImp24RoleQualificationCampaignV3;
  runTransportSmoke?: typeof runImp24DTransportSmoke;
  runImp24ETransportSmoke?: (
    args: RunImp24ETransportSmokeArgs,
  ) => ReturnType<typeof runImp24ETransportSmoke>;
};

export type Imp24ESchemaProbeCliDepsV1 = {
  repositoryRoot?: string;
  runCampaign?: (
    args: RunImp24ESchemaProbeArgs,
  ) => ReturnType<typeof runImp24ESchemaProbes>;
};

export type MigrationBakeoffCliDepsV1 = {
  imp24RoleQualificationV3?: Imp24RoleQualificationCliDepsV3;
  imp24ESchemaProbes?: Imp24ESchemaProbeCliDepsV1;
};

async function runImp24ESchemaProbeSubverb(
  subverb: string,
  flags: Record<string, string | boolean>,
  deps: Imp24ESchemaProbeCliDepsV1 = {},
): Promise<number> {
  // Literal dry barrier precedes clock, GitHub, auth, filesystem, or model work.
  if (flags["execute-live"] !== true) {
    console.error(`${subverb}: refusing schema-probe calls without literal --execute-live`);
    return 2;
  }
  const allowedFlags = new Set(["execute-live", "head-sha", "workflow-run-id", "json"]);
  const unauthorized = Object.keys(flags).filter((key) => !allowedFlags.has(key));
  if (unauthorized.length > 0) {
    console.error(`${subverb}: unauthorized override(s): ${unauthorized.map((key) => `--${key}`).join(", ")}`);
    return 2;
  }
  const expectedHeadSha = typeof flags["head-sha"] === "string" ? flags["head-sha"].trim() : "";
  const workflowRunId = typeof flags["workflow-run-id"] === "string"
    ? Number(flags["workflow-run-id"])
    : NaN;
  if (!/^[a-f0-9]{40}$/.test(expectedHeadSha)
      || !Number.isSafeInteger(workflowRunId) || workflowRunId <= 0) {
    console.error(`${subverb}: --head-sha <40 lowercase hex> and --workflow-run-id <positive integer> are required`);
    return 2;
  }
  const cycle: Imp24ESchemaProbeCycleNumber = subverb === "imp24e-schema-probes" ? 1 : 2;
  const repositoryRoot = resolve(deps.repositoryRoot ?? resolve(PIPELINE_DIR, "../../../.."));
  const run = deps.runCampaign ?? ((args: RunImp24ESchemaProbeArgs) => runImp24ESchemaProbes(args));
  const result = await run({
    executeLive: true,
    cycle,
    expectedHeadSha,
    workflowRunId,
    repositoryRoot,
  });
  const summary = {
    schema: "imp24e-schema-probe-cli-result-v1",
    cycle,
    status: result.cycleResult?.status ?? "NOT_RUN",
    implementationHeadSha: expectedHeadSha,
    workflowRunId,
    roles: result.cycleResult?.results.map((probe) => ({ role: probe.role, passed: probe.passed })) ?? [],
    brokerRequests: result.cycleResult?.brokerRequests ?? 0,
    codexExecInvocations: result.cycleResult?.codexExecInvocations ?? 0,
    qualificationMetricsIncluded: false,
    modelCalls: result.modelCalls,
    apiCalls: result.apiCalls,
  };
  console.log(flags.json === true ? JSON.stringify(summary, null, 2)
    : `[migration] IMP-24E schema probes cycle ${cycle}: ${summary.status} broker=${summary.brokerRequests} codexExec=${summary.codexExecInvocations} api=0`);
  return result.code;
}

function parseImp24Artifact<T>(path: string, label: string, retainedBytes?: Buffer): T {
  let parsed: unknown;
  try {
    parsed = JSON.parse((retainedBytes ?? readFileSync(path)).toString("utf8"));
  } catch (error) {
    throw new Error(`${label} is not valid retained JSON at ${path}: ${(error as Error).message}`);
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${label} must be a retained JSON object at ${path}`);
  }
  return parsed as T;
}

/** Load only the fresh IMP-24 V3 artifact identities. This deliberately has no
 * path to V1/V2 qualification attempts, attestations, or role assignments. */
export function loadImp24RoleQualificationCliArtifactsV3(
  repositoryRoot: string,
): Imp24RoleQualificationCliArtifactsV3 {
  const corpusPath = resolve(repositoryRoot, IMP24_CERTIFICATION_ARTIFACT_PATHS.corpusBundle);
  const certificationPath = resolve(repositoryRoot, IMP24_CERTIFICATION_ARTIFACT_PATHS.certificationBinding);
  const productionSealPath = resolve(repositoryRoot, IMP24_FORWARD_PRODUCTION_INSTRUMENT_SEAL_ARTIFACT_REL_PATH);
  const thresholdsPath = resolve(repositoryRoot, IMP24_CERTIFICATION_ARTIFACT_PATHS.thresholds);
  const thresholdBytes = readFileSync(thresholdsPath);
  const thresholds = parseImp24Artifact<RecoveryRoleThresholdsV1>(thresholdsPath, "IMP-24 V3 role thresholds", thresholdBytes);
  if (thresholdBytes.toString("utf8") !== canonicalPretty(IMP24_FROZEN_ROLE_THRESHOLDS)) {
    throw new Error("retained IMP-24 V3 role-threshold bytes differ from the exact canonical frozen artifact");
  }
  return {
    corpusBundle: parseImp24Artifact<Imp24CorpusBundle>(corpusPath, "IMP-24 V3 corpus bundle"),
    certification: parseImp24Artifact<InstrumentCertificationBindingV3>(certificationPath, "IMP-24 model-free certification binding"),
    productionInstrumentSeal: parseImp24Artifact<ForwardProductionInstrumentSealV1>(productionSealPath, "IMP-24 production instrument seal"),
    thresholds,
    thresholdBytesSha256: sha256Hex(thresholdBytes),
  };
}

async function runImp24DTransportSmokeSubverb(
  subverb: "imp24-transport-smoke-v3" | "imp24-transport-smoke-v3-r2",
  flags: Record<string, string | boolean>,
  deps: Imp24RoleQualificationCliDepsV3 = {},
): Promise<number> {
  // Literal first barrier: no file, auth, cache, CLI, gate, network, or model
  // operation occurs in dry/mistyped mode.
  if (flags["execute-live"] !== true) {
    console.error(`${subverb}: refusing to make the fixed diagnostic calls without literal --execute-live`);
    return 2;
  }
  const allowedFlags = new Set([
    "execute-live", "head-sha", "workflow-run-id", "models-cache", "json",
  ]);
  const unauthorizedFlags = Object.keys(flags).filter((key) => !allowedFlags.has(key));
  if (unauthorizedFlags.length > 0) {
    console.error(`${subverb}: unauthorized override(s): ${unauthorizedFlags.map((key) => `--${key}`).join(", ")}`);
    return 2;
  }
  const expectedHeadSha = typeof flags["head-sha"] === "string" ? flags["head-sha"].trim() : "";
  const workflowRunId = typeof flags["workflow-run-id"] === "string" ? Number(flags["workflow-run-id"]) : NaN;
  if (!/^[a-f0-9]{40}$/.test(expectedHeadSha)
      || !Number.isSafeInteger(workflowRunId) || workflowRunId <= 0) {
    console.error(`${subverb}: --head-sha <40 lowercase hex> and --workflow-run-id <positive integer> are required`);
    return 2;
  }
  if (flags["models-cache"] !== undefined && typeof flags["models-cache"] !== "string") {
    console.error(`${subverb}: --models-cache requires a path value`);
    return 2;
  }
  const requestedModelsCachePath = typeof flags["models-cache"] === "string"
    ? flags["models-cache"].trim()
    : (deps.modelsCachePath ?? "").trim();
  if (!requestedModelsCachePath) {
    console.error(`${subverb}: models cache path must be supplied by --models-cache or outer runtime context`);
    return 2;
  }
  const repositoryRoot = resolve(deps.repositoryRoot ?? resolve(PIPELINE_DIR, "../../../.."));
  const result = await (deps.runTransportSmoke ?? runImp24DTransportSmoke)({
    executeLive: true,
    cycle: subverb === "imp24-transport-smoke-v3" ? 1 : 2,
    expectedHeadSha,
    workflowRunId,
    repositoryRoot,
    loadInput: () => {
      const verifiedAtDate = (deps.clock ?? (() => new Date()))();
      if (!(verifiedAtDate instanceof Date) || !Number.isFinite(verifiedAtDate.getTime())) {
        throw new Error(`${subverb}: injected/current clock is invalid`);
      }
      const artifacts = (deps.loadArtifacts ?? loadImp24RoleQualificationCliArtifactsV3)(repositoryRoot);
      const corpusCertification = certifyImp24Corpora(artifacts.corpusBundle);
      const candidateAvailability = (deps.discoverAvailability ?? discoverCandidateAvailabilityV3)({
        policy: IMP24_FROZEN_CANDIDATE_AVAILABILITY_POLICY as CandidateAvailabilityPolicyV3,
        policyBytesSha256: IMP24_CANDIDATE_AVAILABILITY_POLICY_BYTES_SHA256,
        modelsCachePath: resolve(requestedModelsCachePath),
        verifiedAt: verifiedAtDate.toISOString(),
      });
      return {
        experimentId: IMP24_ROLE_QUALIFICATION_EXECUTION_ID,
        corpusBundle: artifacts.corpusBundle,
        corpusCertification,
        certification: artifacts.certification,
        productionInstrumentSeal: artifacts.productionInstrumentSeal,
        candidateAvailability,
        thresholds: artifacts.thresholds,
        thresholdBytesSha256: artifacts.thresholdBytesSha256,
      };
    },
    preflight: {},
  });
  const summary = {
    schema: "imp24d-transport-smoke-cli-result-v1",
    cycle: result.cycle,
    status: result.report?.status ?? "NOT_RUN",
    implementationHeadSha: expectedHeadSha,
    workflowRunId,
    calls: result.cycleResult?.calls.map((call) => ({
      role: call.role,
      profileId: call.profileId,
      passed: call.passed,
      processDiagnosticsRelPath: call.processDiagnosticsRelPath,
    })) ?? [],
    modelCalls: result.modelCalls,
    apiCalls: result.apiCalls,
  };
  console.log(flags.json === true ? JSON.stringify(summary, null, 2)
    : `[migration] IMP-24D transport smoke cycle=${summary.cycle} status=${summary.status} calls=${summary.calls.length} codexExec=${summary.modelCalls} api=0`);
  return result.code;
}

async function runImp24ETransportSmokeSubverb(
  subverb: "imp24e-transport-smoke" | "imp24e-transport-smoke-r2",
  flags: Record<string, string | boolean>,
  deps: Imp24RoleQualificationCliDepsV3 = {},
): Promise<number> {
  // Literal first barrier: a dry or mistyped invocation cannot read artifacts,
  // inspect auth/cache state, collect CI evidence, or cross the model boundary.
  if (flags["execute-live"] !== true) {
    console.error(`${subverb}: refusing the fixed two-call smoke without literal --execute-live`);
    return 2;
  }
  const allowedFlags = new Set([
    "execute-live", "head-sha", "workflow-run-id", "models-cache", "json",
  ]);
  const unauthorizedFlags = Object.keys(flags).filter((key) => !allowedFlags.has(key));
  if (unauthorizedFlags.length > 0) {
    console.error(`${subverb}: unauthorized override(s): ${unauthorizedFlags.map((key) => `--${key}`).join(", ")}`);
    return 2;
  }
  const expectedHeadSha = typeof flags["head-sha"] === "string" ? flags["head-sha"].trim() : "";
  const workflowRunId = typeof flags["workflow-run-id"] === "string"
    ? Number(flags["workflow-run-id"])
    : NaN;
  if (!/^[a-f0-9]{40}$/.test(expectedHeadSha)
      || !Number.isSafeInteger(workflowRunId) || workflowRunId <= 0) {
    console.error(`${subverb}: --head-sha <40 lowercase hex> and --workflow-run-id <positive integer> are required`);
    return 2;
  }
  if (flags["models-cache"] !== undefined && typeof flags["models-cache"] !== "string") {
    console.error(`${subverb}: --models-cache requires a path value`);
    return 2;
  }
  const requestedModelsCachePath = typeof flags["models-cache"] === "string"
    ? flags["models-cache"].trim()
    : (deps.modelsCachePath ?? "").trim();
  if (!requestedModelsCachePath) {
    console.error(`${subverb}: models cache path must be supplied by --models-cache or outer runtime context`);
    return 2;
  }
  const cycle: Imp24ETransportSmokeCycleNumber = subverb === "imp24e-transport-smoke" ? 1 : 2;
  const repositoryRoot = resolve(deps.repositoryRoot ?? resolve(PIPELINE_DIR, "../../../.."));
  const run = deps.runImp24ETransportSmoke
    ?? ((args: RunImp24ETransportSmokeArgs) => runImp24ETransportSmoke(args));
  const result = await run({
    executeLive: true,
    cycle,
    expectedHeadSha,
    workflowRunId,
    repositoryRoot,
    loadInput: () => {
      const verifiedAtDate = (deps.clock ?? (() => new Date()))();
      if (!(verifiedAtDate instanceof Date) || !Number.isFinite(verifiedAtDate.getTime())) {
        throw new Error(`${subverb}: injected/current clock is invalid`);
      }
      const artifacts = (deps.loadArtifacts ?? loadImp24RoleQualificationCliArtifactsV3)(repositoryRoot);
      const corpusCertification = certifyImp24Corpora(artifacts.corpusBundle);
      const candidateAvailability = (deps.discoverAvailability ?? discoverCandidateAvailabilityV3)({
        policy: IMP24_FROZEN_CANDIDATE_AVAILABILITY_POLICY as CandidateAvailabilityPolicyV3,
        policyBytesSha256: IMP24_CANDIDATE_AVAILABILITY_POLICY_BYTES_SHA256,
        modelsCachePath: resolve(requestedModelsCachePath),
        verifiedAt: verifiedAtDate.toISOString(),
      });
      return {
        experimentId: IMP24_ROLE_QUALIFICATION_EXECUTION_ID,
        corpusBundle: artifacts.corpusBundle,
        corpusCertification,
        certification: artifacts.certification,
        productionInstrumentSeal: artifacts.productionInstrumentSeal,
        candidateAvailability,
        thresholds: artifacts.thresholds,
        thresholdBytesSha256: artifacts.thresholdBytesSha256,
      };
    },
    preflight: {},
  });
  const summary = {
    schema: "imp24e-transport-smoke-cli-result-v1",
    cycle: result.cycle,
    status: result.report?.status ?? "NOT_RUN",
    implementationHeadSha: expectedHeadSha,
    workflowRunId,
    calls: result.cycleResult?.calls.map((call) => ({
      role: call.role,
      sourceScheduleId: call.sourceScheduleId,
      profileId: call.profileId,
      passed: call.passed,
      processDiagnosticsRelPath: call.processDiagnosticsRelPath,
    })) ?? [],
    qualificationMetricsIncluded: false,
    qualificationArtifactsCreated: false,
    modelCalls: result.modelCalls,
    apiCalls: result.apiCalls,
  };
  console.log(flags.json === true ? JSON.stringify(summary, null, 2)
    : `[migration] IMP-24E transport smoke cycle=${summary.cycle} status=${summary.status} calls=${summary.calls.length} codexExec=${summary.modelCalls} api=0`);
  return result.code;
}

async function runImp24RoleQualificationV3Subverb(
  flags: Record<string, string | boolean>,
  deps: Imp24RoleQualificationCliDepsV3 = {},
): Promise<number> {
  // This literal barrier is intentionally the first operation. In dry mode no
  // auth, environment, cache, artifact, gate, report, or campaign path is read
  // and no file/model/API operation is possible.
  if (flags["execute-live"] !== true) {
    console.error("imp24-role-qualification-v3: refusing to make model calls without the literal --execute-live flag");
    return 2;
  }

  const expectedHeadSha = typeof flags["head-sha"] === "string" ? flags["head-sha"].trim() : "";
  const workflowRunId = typeof flags["workflow-run-id"] === "string" ? Number(flags["workflow-run-id"]) : NaN;
  if (!/^[a-f0-9]{40}$/.test(expectedHeadSha) || !Number.isSafeInteger(workflowRunId) || workflowRunId <= 0) {
    console.error("imp24-role-qualification-v3: --head-sha <40 lowercase hex> and --workflow-run-id <positive integer> are required");
    return 2;
  }
  if (flags["models-cache"] !== undefined && typeof flags["models-cache"] !== "string") {
    console.error("imp24-role-qualification-v3: --models-cache requires a path value");
    return 2;
  }
  for (const forbiddenOverride of ["auth-json", "codex-binary", "qualification-cache-dir"] as const) {
    if (flags[forbiddenOverride] !== undefined) {
      console.error(`imp24-role-qualification-v3: --${forbiddenOverride} is not an authorized operator override`);
      return 2;
    }
  }
  const timeoutMs = typeof flags["timeout-ms"] === "string" ? Number(flags["timeout-ms"]) : undefined;
  if (timeoutMs !== undefined && (!Number.isInteger(timeoutMs) || timeoutMs < 1_000)) {
    console.error("imp24-role-qualification-v3: --timeout-ms must be an integer >= 1000");
    return 2;
  }
  const requestedModelsCachePath = typeof flags["models-cache"] === "string"
    ? flags["models-cache"].trim()
    : (deps.modelsCachePath ?? "").trim();
  if (!requestedModelsCachePath) {
    console.error("imp24-role-qualification-v3: models cache path must be supplied by --models-cache or the outer CLI runtime context");
    return 2;
  }
  const modelsCachePath = resolve(requestedModelsCachePath);

  const repositoryRoot = resolve(deps.repositoryRoot ?? resolve(PIPELINE_DIR, "../../../.."));
  let loadedInput: UnpreparedLiveRoleQualificationInputV3 | null = null;
  const loadInput = (): UnpreparedLiveRoleQualificationInputV3 => {
    if (loadedInput !== null) return loadedInput;
    const verifiedAtDate = (deps.clock ?? (() => new Date()))();
    if (!(verifiedAtDate instanceof Date) || !Number.isFinite(verifiedAtDate.getTime())) {
      throw new Error("imp24-role-qualification-v3: injected/current clock is invalid");
    }
    const artifacts = (deps.loadArtifacts ?? loadImp24RoleQualificationCliArtifactsV3)(repositoryRoot);
    // This closure is entered by the official campaign only after retained
    // smoke PASS and exact implementation CI. It never inspects V1/V2 runs.
    const corpusCertification = certifyImp24Corpora(artifacts.corpusBundle);
    const candidateAvailability = (deps.discoverAvailability ?? discoverCandidateAvailabilityV3)({
      policy: IMP24_FROZEN_CANDIDATE_AVAILABILITY_POLICY as CandidateAvailabilityPolicyV3,
      policyBytesSha256: IMP24_CANDIDATE_AVAILABILITY_POLICY_BYTES_SHA256,
      modelsCachePath,
      verifiedAt: verifiedAtDate.toISOString(),
    });
    loadedInput = {
      experimentId: IMP24_ROLE_QUALIFICATION_EXECUTION_ID,
      corpusBundle: artifacts.corpusBundle,
      corpusCertification,
      certification: artifacts.certification,
      productionInstrumentSeal: artifacts.productionInstrumentSeal,
      candidateAvailability,
      thresholds: artifacts.thresholds,
      thresholdBytesSha256: artifacts.thresholdBytesSha256,
    };
    return loadedInput;
  };
  const runCampaign = deps.runCampaign ?? runImp24RoleQualificationCampaignV3;
  const campaign = await runCampaign({
    executeLive: true,
    expectedHeadSha,
    workflowRunId,
    repositoryRoot,
    experimentDir: resolve(migrationExperimentsDir(), IMP24_ROLE_QUALIFICATION_EXECUTION_ID),
    loadInput,
    preflight: {},
    ...(timeoutMs !== undefined ? { timeoutMs } : {}),
  });
  if (!campaign.executed) throw new Error("imp24-role-qualification-v3: live campaign unexpectedly returned a dry result");
  const summaryInput = loadInput();
  const summary = {
    schema: "imp24-role-qualification-v3-cli-result-v1",
    experimentId: campaign.result.experimentId,
    implementationHeadSha: expectedHeadSha,
    workflowRunId,
    roleSetReady: campaign.result.roleSetReady,
    blockedReason: campaign.result.roleSetBlockedReason,
    selected: campaign.result.selected,
    candidateAvailabilitySha256: summaryInput.candidateAvailability.availabilitySha256,
    unavailableProfiles: summaryInput.candidateAvailability.entries
      .filter((entry) => entry.status === "UNAVAILABLE")
      .map((entry) => `${entry.role}:${entry.profileId}`),
    baseCallsAttempted: campaign.result.baseCallsAttempted,
    infrastructureReplays: campaign.result.infrastructureReplays,
    maxPlanEvents: campaign.callLedger.maxPlanCapacityEvents,
    totalAttempts: campaign.result.totalAttempts,
    codexExecInvocations: campaign.callLedger.codexExecInvocations,
    cachedReceipts: campaign.callLedger.cachedReceipts,
    roleAssignmentFreezeSha256: campaign.roleAssignmentFreeze?.freezeSha256 ?? null,
    modelCalls: campaign.modelCalls,
    apiCalls: campaign.apiCalls,
    paths: campaign.paths,
  };
  console.log(flags.json === true ? JSON.stringify(summary, null, 2)
    : `[migration] IMP-24 V3 qualification: roleSetReady=${String(summary.roleSetReady)} baseCalls=${summary.baseCallsAttempted} replays=${summary.infrastructureReplays} codexExec=${summary.codexExecInvocations} cached=${summary.cachedReceipts} api=${summary.apiCalls}${summary.blockedReason ? ` — ${summary.blockedReason}` : ""}`);
  return summary.roleSetReady ? 0 : 1;
}

async function runPilotRoleReadinessCampaignSubverb(
  flags: Record<string, string | boolean>,
  deps: Imp24RoleQualificationCliDepsV3 = {},
): Promise<number> {
  // The literal barrier is intentionally the first operation. In dry mode no
  // auth, environment, cache, artifact, gate, report, or campaign path is read
  // and no file/model/API operation is possible.
  if (flags["execute-live"] !== true) {
    console.error("pilot-role-readiness-campaign: refusing to make model calls without the literal --execute-live flag");
    return 2;
  }
  const expectedHeadSha = typeof flags["head-sha"] === "string" ? flags["head-sha"].trim() : "";
  const workflowRunId = typeof flags["workflow-run-id"] === "string" ? Number(flags["workflow-run-id"]) : NaN;
  if (!/^[a-f0-9]{40}$/.test(expectedHeadSha) || !Number.isSafeInteger(workflowRunId) || workflowRunId <= 0) {
    console.error("pilot-role-readiness-campaign: --head-sha <40 lowercase hex> and --workflow-run-id <positive integer> are required");
    return 2;
  }
  if (flags["models-cache"] !== undefined && typeof flags["models-cache"] !== "string") {
    console.error("pilot-role-readiness-campaign: --models-cache requires a path value");
    return 2;
  }
  for (const forbiddenOverride of ["auth-json", "codex-binary", "qualification-cache-dir"] as const) {
    if (flags[forbiddenOverride] !== undefined) {
      console.error(`pilot-role-readiness-campaign: --${forbiddenOverride} is not an authorized operator override`);
      return 2;
    }
  }
  const timeoutMs = typeof flags["timeout-ms"] === "string" ? Number(flags["timeout-ms"]) : undefined;
  if (timeoutMs !== undefined && (!Number.isInteger(timeoutMs) || timeoutMs < 1_000)) {
    console.error("pilot-role-readiness-campaign: --timeout-ms must be an integer >= 1000");
    return 2;
  }
  // Spec-driven, never ambient: the models cache path comes from the flag or
  // the OUTER CLI's runtime context (which resolves the Codex home at its own
  // boundary) — this module never reads the ambient environment.
  const requestedModelsCachePath = typeof flags["models-cache"] === "string"
    ? flags["models-cache"].trim()
    : (deps.modelsCachePath ?? "").trim();
  if (!requestedModelsCachePath) {
    console.error("pilot-role-readiness-campaign: models cache path must be supplied by --models-cache or the outer CLI runtime context");
    return 2;
  }
  const campaign = await runPilotRoleReadinessCampaign({
    executeLive: true,
    expectedHeadSha,
    workflowRunId,
    repositoryRoot: resolve(deps.repositoryRoot ?? resolve(PIPELINE_DIR, "../../../..")),
    modelsCachePath: resolve(requestedModelsCachePath),
    preflight: {},
    ...(timeoutMs !== undefined ? { timeoutMs } : {}),
  });
  if (!campaign.executed) throw new Error("pilot-role-readiness-campaign: live campaign unexpectedly returned a dry result");
  const summary = {
    schema: "pilot-role-readiness-campaign-cli-result-v1",
    experimentId: campaign.result.experimentId,
    implementationHeadSha: expectedHeadSha,
    workflowRunId,
    status: campaign.result.terminalState,
    blockedReason: campaign.result.blockedReason,
    selected: campaign.result.selected,
    qualifiers: campaign.result.qualifiers,
    baseCallsAttempted: campaign.result.baseCallsAttempted,
    infrastructureReplays: campaign.result.infrastructureReplays,
    maxPlanEvents: campaign.callLedger.maxPlanCapacityEvents,
    totalAttempts: campaign.result.totalAttempts,
    codexExecInvocations: campaign.callLedger.codexExecInvocations,
    cachedReceipts: campaign.callLedger.cachedReceipts,
    roleFreezeSha256: campaign.roleFreeze?.freezeSha256 ?? null,
    modelCalls: campaign.modelCalls,
    apiCalls: campaign.apiCalls,
    paths: campaign.paths,
  };
  console.log(flags.json === true ? JSON.stringify(summary, null, 2)
    : `[migration] pilot-role-readiness: ${summary.status} baseCalls=${summary.baseCallsAttempted} replays=${summary.infrastructureReplays} codexExec=${summary.codexExecInvocations} cached=${summary.cachedReceipts} api=${summary.apiCalls}${summary.blockedReason ? ` — ${summary.blockedReason}` : ""}`);
  return campaign.code;
}

async function runLiveQualificationSubverb(
  subverb: string,
  flags: Record<string, string | boolean>,
  imp24Deps: Imp24RoleQualificationCliDepsV3 = {},
): Promise<number> {
  if (subverb === "role-qualification-calibrate" || subverb === "role-qualification-holdout") {
    const experimentId = typeof flags.experiment === "string"
      ? flags.experiment.trim()
      : "s16-forward-role-qualification-v1";
    const disposition = closedQualificationDisposition(experimentId);
    if (disposition) return refuseClosedQualification(subverb, experimentId, disposition);
    console.error(`${subverb}: unsupported qualification experiment identity ${experimentId}`);
    return 2;
  }
  if (flags["execute-live"] !== true) {
    console.error(`${subverb}: refusing to make model calls without the explicit --execute-live flag`);
    return 2;
  }
  if (subverb === "imp24-transport-smoke-v3" || subverb === "imp24-transport-smoke-v3-r2") {
    return runImp24DTransportSmokeSubverb(subverb, flags, imp24Deps);
  }
  if (subverb === "imp24e-transport-smoke" || subverb === "imp24e-transport-smoke-r2") {
    return runImp24ETransportSmokeSubverb(subverb, flags, imp24Deps);
  }
  if (subverb === "imp24-role-qualification-v3") {
    return runImp24RoleQualificationV3Subverb(flags, imp24Deps);
  }
  if (subverb === "pilot-role-readiness-campaign") {
    return runPilotRoleReadinessCampaignSubverb(flags, imp24Deps);
  }
  console.error(USAGE);
  return 2;
}

async function runLiveForwardSubverb(
  subverb: string,
  flags: Record<string, string | boolean>,
): Promise<number> {
  // The closed V2 identity is refused before inspecting execute-live or any
  // caller-supplied artifact path.  It cannot be used to create fresh evidence.
  if (subverb === "forward-pilot" || subverb === "forward-gold") {
    return refuseClosedQualification(subverb, "s16-forward-role-qualification-v2", "BLOCKED_CALIBRATION_INVALID");
  }
  if (flags["execute-live"] !== true) {
    const dry = subverb === "imp24-pilot-v2-envelope"
      ? await runImp24PilotV2EnvelopeLive(flags["execute-live"])
      : await runImp24GoldV2EnvelopeLive(flags["execute-live"]);
    console.error(dry.message);
    return dry.code;
  }
  const forbiddenOverrides = [
    "experiment", "state-root", "phase-dir", "manifest", "input-freeze", "input-materialization",
    "production-instrument-seal", "qualification-spec", "calibration-seal", "calibration-inspection",
    "qualification-result", "qualification-bundle", "role-freeze", "gold-evaluator-config", "auth-json",
    "codex-binary", "timeout-ms", "max-parallel",
  ].filter((name) => flags[name] !== undefined);
  if (forbiddenOverrides.length > 0) {
    console.error(`${subverb}: fixed IMP-24 workflow refuses artifact/route substitution flag(s): ${forbiddenOverrides.map((name) => `--${name}`).join(", ")}`);
    return 2;
  }
  const boundary = subverb === "imp24-pilot-v2-envelope"
    ? await runImp24PilotV2EnvelopeLive(true)
    : await runImp24GoldV2EnvelopeLive(true);
  if (!boundary.executed) throw new Error(`${subverb}: literal live execution unexpectedly returned dry`);
  const out = boundary.result;
  const summary = {
    experimentId: out.campaign.experimentId,
    kind: out.campaign.kind,
    accepted: out.campaign.accepted,
    firstWritePassRate: out.campaign.accounting.firstWritePassRate,
    finalPassRate: out.campaign.accounting.finalPassRate,
    hardFailures: out.campaign.hardFailures,
    codexExecInvocations: out.codexExecInvocations,
    infrastructureReplays: out.infrastructureReplays,
    maxPlanCapacityEvents: out.maxPlanCapacityEvents,
    safeguardsOrRefusals: out.safeguardsOrRefusals,
    apiCallsMade: out.apiCallsMade,
    publish: out.publish,
    promote: out.promote,
    deploy: out.deploy,
    upload: out.upload,
  };
  console.log(flags["json"] === true ? JSON.stringify(summary, null, 2) : `[migration] ${subverb}: accepted=${String(summary.accepted)} first=${summary.firstWritePassRate} final=${summary.finalPassRate} codexExec=${summary.codexExecInvocations} api=${summary.apiCallsMade}`);
  return boundary.code;
}

function runLocalQualificationSubverb(
  subverb: string,
  flags: Record<string, string | boolean>,
): number {
  if (subverb !== "role-qualification-attest-calibration") return 2;
  const experimentId = typeof flags.experiment === "string"
    ? flags.experiment.trim()
    : "s16-forward-role-qualification-v1";
  const disposition = closedQualificationDisposition(experimentId);
  if (disposition) return refuseClosedQualification(subverb, experimentId, disposition);
  console.error(`${subverb}: unsupported qualification experiment identity ${experimentId}`);
  return 2;
}

function readJsonFile<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function filesWithSuffix(root: string, suffix: string): string[] {
  if (!existsSync(root)) return [];
  const out: string[] = [];
  for (const name of readdirSync(root)) {
    const path = resolve(root, name);
    if (statSync(path).isDirectory()) out.push(...filesWithSuffix(path, suffix));
    else if (name.endsWith(suffix)) out.push(path);
  }
  return out.sort((a, b) => a.localeCompare(b));
}

function persistStableArtifact(path: string, value: unknown, write: boolean): boolean {
  const bytes = stableForwardArtifactJson(value);
  if (existsSync(path)) {
    if (readFileSync(path, "utf8") !== bytes) throw new Error(`refusing to replace nonidentical retained artifact ${path}`);
    return false;
  }
  if (!write) return false;
  writeFileAtomic(path, bytes);
  if (readFileSync(path, "utf8") !== bytes) throw new Error(`retained artifact read-back mismatch ${path}`);
  return true;
}

function buildRetainedRouteEvidence(experimentDir: string, preflight: LiveQualificationPreflightV1): {
  value: Record<string, unknown>;
  routeEvidenceSha256: string;
} {
  const calibrationLedgerPath = resolve(experimentDir, "live/calibration/call-ledger.json");
  const holdoutLedgerPath = resolve(experimentDir, "live/holdout/call-ledger.json");
  const calibrationLedger = readJsonFile<Record<string, unknown>>(calibrationLedgerPath);
  const holdoutLedger = readJsonFile<Record<string, unknown>>(holdoutLedgerPath);
  for (const [phase, ledger] of [["calibration", calibrationLedger], ["holdout", holdoutLedger]] as const) {
    if (ledger.experimentId !== preflight.experimentId || ledger.phase !== phase || ledger.apiCallsMade !== 0) {
      throw new Error(`${phase} call ledger does not bind the v2 no-API experiment`);
    }
  }
  const routePaths = filesWithSuffix(resolve(experimentDir, "live"), ".route.json");
  const invocationCount = Number(calibrationLedger.codexExecInvocations) + Number(holdoutLedger.codexExecInvocations);
  if (routePaths.length !== invocationCount) {
    throw new Error(`retained route count ${routePaths.length} differs from codex-exec invocation count ${invocationCount}`);
  }
  const routes = routePaths.map((path) => {
    const route = readJsonFile<Record<string, unknown>>(path);
    if (route.schema !== "route-result-v1"
        || route.executionRoute !== "codex_exec_chatgpt_subscription"
        || route.authMode !== "chatgpt"
        || route.apiKeyPresent !== false
        || route.apiFallbackAllowed !== false
        || route.executionProfileHash !== preflight.executionProfileHash
        || route.routePolicyVersion !== preflight.routePolicyVersion) {
      throw new Error(`retained route is not a current ChatGPT/no-API route: ${path}`);
    }
    return {
      relativePath: relative(experimentDir, path),
      bytesSha256: sha256Hex(readFileSync(path)),
      requestedModel: route.requestedModel,
      requestedEffort: route.requestedEffort,
      outcome: route.outcome,
    };
  });
  const draft = {
    schema: "imp23-forward-live-route-evidence-v1",
    experimentId: preflight.experimentId,
    preflightSha256: hashCanonical(preflight),
    calibrationLedgerSha256: sha256Hex(readFileSync(calibrationLedgerPath)),
    holdoutLedgerSha256: sha256Hex(readFileSync(holdoutLedgerPath)),
    routeCount: routes.length,
    codexExecInvocations: invocationCount,
    apiCallsMade: 0,
    routes,
  };
  const routeEvidenceSha256 = hashCanonical(draft);
  return { value: { ...draft, routeEvidenceSha256 }, routeEvidenceSha256 };
}

function materializeQualificationFreeze(flags: Record<string, string | boolean>): number {
  const experimentId = typeof flags.experiment === "string" ? flags.experiment.trim() : "s16-forward-role-qualification-v2";
  if (experimentId !== "s16-forward-role-qualification-v2") throw new Error("role-qualification-freeze requires the one-time corrected v2 identity");
  const experimentDir = resolve(migrationExperimentsDir(), experimentId);
  const preflight = readJsonFile<LiveQualificationPreflightV1>(resolve(experimentDir, "live/preflight.json"));
  const routes = buildRetainedRouteEvidence(experimentDir, preflight);
  const artifacts = buildQualificationAndRoleFreezeArtifacts({
    spec: readJsonFile<RetainedQualificationSpecV2>(resolve(experimentDir, "spec.json")),
    preflight,
    calibration: readJsonFile(resolve(experimentDir, "live/calibration/calibration-seal.json")),
    inspection: readJsonFile(resolve(experimentDir, "live/calibration/calibration-inspection.json")),
    holdoutResult: readJsonFile(resolve(experimentDir, "live/holdout/qualification-result.json")),
    registry: readJsonFile(resolve(experimentDir, "live/holdout/role-registry.json")),
    baseRecoverySpec: readJsonFile<RecoveryExperimentSpecV1>(resolve(migrationExperimentsDir(), "s16-reviewer-recovery-v1/spec.json")),
    routeEvidenceSha256: routes.routeEvidenceSha256,
  });
  const write = flags.write === true;
  const holdoutDir = resolve(experimentDir, "live/holdout");
  const written = [
    persistStableArtifact(resolve(holdoutDir, "route-evidence.json"), routes.value, write),
    persistStableArtifact(resolve(holdoutDir, "qualification-bundle.json"), artifacts.qualificationBundle, write),
    persistStableArtifact(resolve(holdoutDir, "role-assignment-freeze.json"), artifacts.roleAssignmentFreeze, write),
    persistStableArtifact(resolve(holdoutDir, "qualification-freeze-artifacts.json"), artifacts, write),
  ].filter(Boolean).length;
  console.log(flags.json === true ? JSON.stringify({
    experimentId,
    qualificationBundleSha256: artifacts.qualificationBundleSha256,
    roleAssignmentFreezeSha256: artifacts.roleAssignmentFreezeSha256,
    routeEvidenceSha256: routes.routeEvidenceSha256,
    routeCount: (routes.value.routeCount as number),
    written,
    modelCalls: 0,
    apiCalls: 0,
  }, null, 2) : `[migration] IMP-23 role freeze: bundle=${artifacts.qualificationBundleSha256} freeze=${artifacts.roleAssignmentFreezeSha256} routes=${String(routes.value.routeCount)} written=${written}`);
  return 0;
}

function materializePilotArtifacts(flags: Record<string, string | boolean>): number {
  const qualificationId = typeof flags.experiment === "string" ? flags.experiment.trim() : "s16-forward-role-qualification-v2";
  if (qualificationId !== "s16-forward-role-qualification-v2") throw new Error("pilot artifacts require the corrected v2 qualification");
  const pilotDir = resolve(migrationExperimentsDir(), "s16-forward-sol-pilot-v1");
  const qualificationDir = resolve(migrationExperimentsDir(), qualificationId);
  const manifest = buildPilotArtifacts({
    inputFreeze: readJsonFile<ForwardInputFreezeV1>(resolve(pilotDir, "input-freeze.json")),
    inputMaterialization: readJsonFile<Imp22ForwardInputMaterializationV1>(resolve(pilotDir, "input-materialization.json")),
    roleFreeze: readJsonFile<ForwardRoleAssignmentFreezeV1>(resolve(qualificationDir, "live/holdout/role-assignment-freeze.json")),
    productionInstrumentSeal: readJsonFile<ForwardProductionInstrumentSealV1>(resolve(contractsDir(), "imp22/forward-production-instrument-seal.json")),
  });
  const written = persistStableArtifact(resolve(pilotDir, "validation-manifest.json"), manifest, flags.write === true);
  console.log(flags.json === true ? JSON.stringify({ experimentId: manifest.manifest.experimentId, manifestSha256: manifest.manifestSha256, targets: manifest.manifest.targets.length, written, modelCalls: 0, apiCalls: 0 }, null, 2)
    : `[migration] IMP-23 pilot manifest: sha256=${manifest.manifestSha256} targets=${manifest.manifest.targets.length} written=${String(written)}`);
  return 0;
}

function materializeGoldArtifacts(flags: Record<string, string | boolean>): number {
  const qualificationId = typeof flags.experiment === "string" ? flags.experiment.trim() : "s16-forward-role-qualification-v2";
  if (qualificationId !== "s16-forward-role-qualification-v2") throw new Error("gold artifacts require the corrected v2 qualification");
  const pilotDir = resolve(migrationExperimentsDir(), "s16-forward-sol-pilot-v1");
  const goldDir = resolve(migrationExperimentsDir(), "s16-forward-sol-gold-book-v1");
  const qualificationDir = resolve(migrationExperimentsDir(), qualificationId);
  const pilotOuter = readJsonFile<RunForwardLiveCampaignResultV1>(resolve(pilotDir, "live-campaign/campaign-result.json"));
  if (pilotOuter.apiCallsMade !== 0 || pilotOuter.publish !== false || pilotOuter.promote !== false
      || pilotOuter.deploy !== false || pilotOuter.upload !== false) {
    throw new Error("gold materialization refuses pilot evidence with API or external capability use");
  }
  const artifacts = buildGoldArtifacts({
    inputFreeze: readJsonFile<ForwardInputFreezeV1>(resolve(goldDir, "input-freeze.json")),
    inputMaterialization: readJsonFile<Imp22ForwardInputMaterializationV1>(resolve(goldDir, "input-materialization.json")),
    roleFreeze: readJsonFile<ForwardRoleAssignmentFreezeV1>(resolve(qualificationDir, "live/holdout/role-assignment-freeze.json")),
    productionInstrumentSeal: readJsonFile<ForwardProductionInstrumentSealV1>(resolve(contractsDir(), "imp22/forward-production-instrument-seal.json")),
    pilotManifest: readJsonFile(resolve(pilotDir, "validation-manifest.json")),
    pilotResult: pilotOuter.campaign,
  });
  const write = flags.write === true;
  const written = [
    persistStableArtifact(resolve(goldDir, "gold-evaluator-config.json"), artifacts.goldEvaluatorConfig, write),
    persistStableArtifact(resolve(goldDir, "validation-manifest.json"), artifacts.goldManifest, write),
  ].filter(Boolean).length;
  console.log(flags.json === true ? JSON.stringify({ experimentId: artifacts.goldManifest.manifest.experimentId, manifestSha256: artifacts.goldManifest.manifestSha256, targets: artifacts.goldManifest.manifest.targets.length, goldEvaluatorInstrumentSha256: artifacts.goldEvaluatorConfig.instrumentSha256, written, modelCalls: 0, apiCalls: 0 }, null, 2)
    : `[migration] IMP-23 gold artifacts: manifest=${artifacts.goldManifest.manifestSha256} targets=${artifacts.goldManifest.manifest.targets.length} evaluator=${artifacts.goldEvaluatorConfig.instrumentSha256} written=${written}`);
  return 0;
}

function runLocalForwardSubverb(
  subverb: string,
  flags: Record<string, string | boolean>,
): number {
  if (subverb === "forward-activate-local" || subverb === "forward-verify-local-activation") {
    return refuseClosedQualification(subverb, "s16-forward-role-qualification-v2", "IMP23_V2_ACTIVATION_CLOSED");
  }
  if (subverb === "imp24-record-activation-full-suite-v3"
      || subverb === "imp24-activate-local-v3"
      || subverb === "imp24-verify-local-activation-v3") {
    const forbiddenOverrides = [
      "state-root", "phase-dir", "pilot-phase", "gold-phase", "input-freeze", "role-freeze",
      "qualification-result", "implementation-ci-gate", "full-suite-ledger", "dedicated-ci-url", "local-tests-pass",
    ].filter((name) => flags[name] !== undefined);
    if (forbiddenOverrides.length > 0) {
      console.error(`${subverb}: fixed IMP-24 activation workflow refuses artifact/attestation substitution flag(s): ${forbiddenOverrides.map((name) => `--${name}`).join(", ")}`);
      return 2;
    }
    const headSha = typeof flags["head-sha"] === "string" ? flags["head-sha"].trim() : "";
    if (subverb === "imp24-record-activation-full-suite-v3") {
      const out = recordImp24ActivationFullSuiteV3(flags["execute-local-suite"] === true, headSha);
      console.log(flags.json === true ? JSON.stringify(out, null, 2)
        : `[migration] ${subverb}: ${out.message}${out.executed ? ` ledger=${out.ledgerSha256} attempts=${out.attemptCount}` : ""}`);
      return out.code;
    }
    if (subverb === "imp24-activate-local-v3") {
      const activatedAt = typeof flags["activated-at"] === "string" ? flags["activated-at"].trim() : "";
      const out = activateImp24LocalV3({
        activateLocal: flags["activate-local"] === true,
        expectedHeadSha: headSha,
        activatedAt,
        ...(typeof flags["activation-id"] === "string" ? { activationId: flags["activation-id"] } : {}),
      });
      const summary = {
        schema: out.schema,
        status: "FORWARD_ACTIVE",
        materializationSha256: out.materializationSha256,
        written: out.written,
        modelCalls: out.modelCalls,
        apiCalls: out.apiCalls,
      };
      console.log(flags.json === true ? JSON.stringify(summary, null, 2)
        : `[migration] ${subverb}: FORWARD_ACTIVE materialization=${out.materializationSha256} written=${out.written}`);
      return 0;
    }
    const out = verifyImp24LocalActivationV3(headSha);
    console.log(flags.json === true ? JSON.stringify(out, null, 2)
      : `[migration] ${subverb}: ${out.status} materialization=${out.materializationSha256}`);
    return 0;
  }
  if (subverb === "role-qualification-freeze"
      || subverb === "forward-materialize-pilot-artifacts"
      || subverb === "forward-materialize-gold-artifacts") {
    return refuseClosedQualification(subverb, "s16-forward-role-qualification-v2", "BLOCKED_CALIBRATION_INVALID");
  }
  if (subverb === "imp24-materialize-transport-correction-diagnosis") {
    const allowed = new Set(["write", "defect-class", "rationale", "json"]);
    const unauthorized = Object.keys(flags).filter((key) => !allowed.has(key));
    if (unauthorized.length > 0 || flags.write !== true
        || typeof flags["defect-class"] !== "string"
        || typeof flags.rationale !== "string") {
      console.error(`${subverb}: requires --write --defect-class CLASS --rationale TEXT and rejects all path/input overrides`);
      return 2;
    }
    const repositoryRoot = resolve(PIPELINE_DIR, "../../../..");
    const out = materializeImp24DTransportMechanicalCorrection({
      repositoryRoot,
      defectClass: flags["defect-class"].trim() as Imp24DTransportMechanicalDefectClassV1,
      rationale: flags.rationale,
    });
    const summary = {
      schema: out.record.schema,
      correctionSha256: out.record.correctionSha256,
      defectClass: out.record.defectClass,
      changedFiles: out.record.changedFiles,
      regressionTestFiles: out.record.regressionTestFiles,
      reportSha256: out.report.reportSha256,
      writes: 2,
      modelCalls: 0,
      apiCalls: 0,
    };
    console.log(flags.json === true ? JSON.stringify(summary, null, 2)
      : `[migration] IMP-24D correction diagnosis: ${summary.correctionSha256} files=${summary.changedFiles.length} tests=${summary.regressionTestFiles.length} writes=2 model/api calls=0`);
    return 0;
  }
  if (subverb === "imp24-materialize-pilot-v2-envelope"
      || subverb === "imp24-materialize-gold-v2-envelope") {
    const forbiddenOverrides = [
      "experiment", "state-root", "output", "phase-dir", "manifest", "input-freeze", "input-materialization",
      "production-instrument-seal", "qualification-result", "role-freeze", "gold-evaluator-config",
    ].filter((name) => flags[name] !== undefined);
    if (forbiddenOverrides.length > 0) {
      console.error(`${subverb}: fixed IMP-24 workflow refuses artifact substitution flag(s): ${forbiddenOverrides.map((name) => `--${name}`).join(", ")}`);
      return 2;
    }
    const out = subverb === "imp24-materialize-pilot-v2-envelope"
      ? materializeImp24PilotV2Envelope(flags.write === true)
      : materializeImp24GoldV2Envelope(flags.write === true);
    console.log(flags.json === true ? JSON.stringify(out, null, 2)
      : `[migration] ${subverb}: manifest=${out.manifestSha256} targets=${out.targetCount} written=${out.written} model/api calls=0`);
    return 0;
  }
  if (subverb === "reader-gold-dev-pool") {
    // Prose-blind frozen selection of the development reader-gold candidate
    // pool (owner-ratified D2/D3). Dry = deterministic rebuild + byte-compare
    // against any retained manifest; --write = create-once materialization.
    const repositoryRoot = resolve(PIPELINE_DIR, "../../../..");
    const out = materializeReaderGoldDevPoolSelection({ repositoryRoot, write: flags.write === true });
    console.log(flags.json === true ? JSON.stringify(out, null, 2)
      : `[migration] ${out.poolId}: selection=${out.selectionSha256} chapters=${out.totalSelected} written=${String(out.written)} model/api calls=0`);
    return 0;
  }
  if (subverb === "reader-gold-dev-docs") {
    // Deterministic key-free reader documents for the frozen pool selection.
    // Dry = rebuild + byte-compare against retained docs; --write = create-once.
    const repositoryRoot = resolve(PIPELINE_DIR, "../../../..");
    const out = materializeReaderGoldDevDocs({ repositoryRoot, write: flags.write === true });
    console.log(flags.json === true ? JSON.stringify(out, null, 2)
      : `[migration] ${out.poolId} reader docs: manifest=${out.manifestSha256} docs=${out.docCount} written=${String(out.written)} model/api calls=0`);
    return 0;
  }
  if (subverb === "rubric-audit-batch") {
    // D7 gate instrument (s16-rubric-audit-v1): app-faithful audit documents +
    // per-layer docs + frozen batch manifest with the hidden calibration item.
    // Dry = rebuild + byte-compare; --write = create-once. Zero model calls.
    const repositoryRoot = resolve(PIPELINE_DIR, "../../../..");
    const auditId = typeof flags["audit-id"] === "string" ? flags["audit-id"] : "";
    const packagePath = typeof flags.package === "string" ? flags.package : "";
    const chaptersFlag = typeof flags.chapters === "string" ? flags.chapters : "";
    const purpose = typeof flags.purpose === "string" ? flags.purpose : "";
    const calibrationUnit = typeof flags.calibration === "string" ? flags.calibration : "";
    if (auditId === "" || packagePath === "" || chaptersFlag === "" || purpose === "" || calibrationUnit === "") {
      throw new Error("rubric-audit-batch requires --audit-id --package --chapters --purpose --calibration");
    }
    const chapterNumbers = chaptersFlag.split(",").map((token) => Number(token.trim()));
    const out = materializeRubricAuditBatch({
      repositoryRoot, auditId, purpose, packagePath, chapterNumbers, calibrationUnit,
      write: flags.write === true,
    });
    console.log(flags.json === true ? JSON.stringify(out, null, 2)
      : `[migration] rubric-audit ${out.auditId}: manifest=${out.manifestSha256} chapters=${out.chapterCount} written=${String(out.written)} model/api calls=0`);
    return 0;
  }
  if (subverb === "rubric-audit-report") {
    // Deterministic D7 verdict from retained adjudications: bar (mean/min/core
    // domains/gates/layer independence) + the ±tolerance calibration guard.
    const repositoryRoot = resolve(PIPELINE_DIR, "../../../..");
    const auditId = typeof flags["audit-id"] === "string" ? flags["audit-id"] : "";
    if (auditId === "") throw new Error("rubric-audit-report requires --audit-id");
    const auditDir = resolve(repositoryRoot, rubricAuditDirRelPath(auditId));
    const manifest = JSON.parse(readFileSync(resolve(auditDir, "batch-manifest.json"), "utf8")) as RubricAuditBatchManifestV1;
    const adjudications = new Map<string, Record<string, unknown>>();
    for (const chapter of manifest.chapters) {
      adjudications.set(chapter.unit,
        JSON.parse(readFileSync(resolve(auditDir, `raw/adjudicated/${chapter.unit}.json`), "utf8")) as Record<string, unknown>);
    }
    const calibrationAdjudication = JSON.parse(readFileSync(
      resolve(auditDir, `calibration/${manifest.calibration.unit}.adjudicated.json`), "utf8")) as Record<string, unknown>;
    const report = buildRubricAuditReport({ manifest, adjudications, calibrationAdjudication });
    const reportPath = resolve(auditDir, "report.json");
    const reportBytes = canonicalPretty(report);
    if (existsSync(reportPath)) {
      if (readFileSync(reportPath, "utf8") !== reportBytes) {
        throw new Error("retained rubric-audit report differs from the deterministic rebuild");
      }
    } else if (flags.write === true) {
      writeFileAtomic(reportPath, reportBytes);
    }
    console.log(flags.json === true ? JSON.stringify(report, null, 2)
      : `[migration] rubric-audit ${auditId}: verdict=${report.summary.verdict} mean=${report.summary.mean.toFixed(2)} min=${report.summary.min.toFixed(2)} calibrationΔ=${report.calibration.absDelta.toFixed(2)} model/api calls=0`);
    return report.summary.verdict === "PASS" ? 0 : 1;
  }
  if (subverb === "rubric-audit-render-task" || subverb === "rubric-audit-ingest" || subverb === "rubric-audit-status") {
    // Track C rater harness: render one self-contained rater/adjudicator task,
    // fail-closed ingest a returned record through the EXISTING validators, or
    // summarize per-unit progress. Zero model/api calls; all inputs via flags.
    const repositoryRoot = resolve(PIPELINE_DIR, "../../../..");
    const auditId = typeof flags["audit-id"] === "string" ? flags["audit-id"] : "";
    if (auditId === "") throw new Error(`${subverb} requires --audit-id`);
    const manifestPath = resolve(repositoryRoot, `${rubricAuditDirRelPath(auditId)}/batch-manifest.json`);
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as RubricAuditBatchManifestV1;

    if (subverb === "rubric-audit-status") {
      const status = summarizeAudit({ repositoryRoot, manifest });
      console.log(flags.json === true ? JSON.stringify(status, null, 2)
        : `[migration] rubric-audit ${auditId}: allComplete=${String(status.allComplete)} ${status.units.map((u) => `${u.unit}[${u.missing.length === 0 ? "complete" : `missing ${u.missing.join(",")}`}]`).join(" ")}`);
      return status.allComplete ? 0 : 1;
    }

    const unit = typeof flags.unit === "string" ? flags.unit : "";
    const role = typeof flags.role === "string" ? flags.role : "";
    if (unit === "" || (role !== "primary" && role !== "verification" && role !== "adjudicator")) {
      throw new Error(`${subverb} requires --unit U and --role <primary|verification|adjudicator>`);
    }

    if (subverb === "rubric-audit-render-task") {
      console.log(renderRaterTaskDocument({ repositoryRoot, manifest, unit, role }));
      return 0;
    }

    const file = typeof flags.file === "string" ? flags.file : "";
    if (file === "") throw new Error("rubric-audit-ingest requires --file <json path>");
    const recordText = readFileSync(resolve(file), "utf8");
    try {
      const out = role === "adjudicator"
        ? ingestAdjudicationRecord({ repositoryRoot, manifest, unit, recordText })
        : ingestRaterRecord({ repositoryRoot, manifest, unit, role, recordText });
      console.log(flags.json === true ? JSON.stringify(out, null, 2)
        : `[migration] rubric-audit ${auditId}: ingested ${unit} ${role} → ${out.persistedPath} sealed=${String(out.sealed)} model/api calls=0`);
      return 0;
    } catch (error) {
      console.error(`rubric-audit-ingest: ${(error as Error).message}`);
      return 1;
    }
  }
  if (subverb === "assemble-audit-package") {
    // Build a temporary rubric-audit-ready package from the CURRENT canonical
    // chapter state of an unpublished book (read-only; fail-closed on missing
    // quiz keys/explanations) so it can be passed to rubric-audit-batch --package.
    const bookId = typeof flags.book === "string" ? flags.book : "";
    const out = typeof flags.out === "string" ? flags.out : "";
    if (bookId === "" || out === "") throw new Error("assemble-audit-package requires --book <id> --out <path>");
    try {
      const pkg = assembleAuditPackage({ bookId });
      const outPath = resolve(out);
      writeFileAtomic(outPath, JSON.stringify(pkg, null, 2) + "\n");
      const summary = { schema: "assemble-audit-package-v1", bookId: pkg.book.id, chapters: pkg.chapters.length, outPath, modelCalls: 0, apiCalls: 0 };
      console.log(flags.json === true ? JSON.stringify(summary, null, 2)
        : `[migration] assemble-audit-package ${pkg.book.id}: chapters=${pkg.chapters.length} → ${outPath} model/api calls=0`);
      return 0;
    } catch (error) {
      console.error(`assemble-audit-package: ${(error as Error).message}`);
      return 1;
    }
  }
  if (subverb === "pilot-role-readiness") {
    // s16-forward-pilot-role-readiness-v1 (plan v2 P3): deterministic corpus
    // selection from FROZEN inputs (create-once) + the campaign plan (minted
    // only at launch with --mint-plan --write; bind-once to the candidate
    // instrument). Dry = rebuild + byte-compare. Zero model calls.
    const repositoryRoot = resolve(PIPELINE_DIR, "../../../..");
    const out = materializePilotRoleReadiness({
      repositoryRoot,
      write: flags.write === true,
      mintPlan: flags["mint-plan"] === true,
    });
    console.log(flags.json === true ? JSON.stringify(out, null, 2)
      : `[migration] ${out.experimentId}: corpus=${out.corpusSha256} plan=${out.planSha256 ?? "UNMINTED"} written=${String(out.written)} model/api calls=0`);
    return 0;
  }
  if (subverb === "pilot-role-readiness-v2") {
    // v2 successor (owner directive "Proceed with A"): the byte-stable v1
    // selection re-identified with the frozen canary-gold adjudication
    // overlay embedded. Same create-once / bind-once discipline as v1.
    const repositoryRoot = resolve(PIPELINE_DIR, "../../../..");
    const out = materializePilotRoleReadinessV2({
      repositoryRoot,
      write: flags.write === true,
      mintPlan: flags["mint-plan"] === true,
    });
    console.log(flags.json === true ? JSON.stringify(out, null, 2)
      : `[migration] ${out.experimentId}: corpus=${out.corpusSha256} plan=${out.planSha256 ?? "UNMINTED"} written=${String(out.written)} model/api calls=0`);
    return 0;
  }
  if (subverb === "pilot-role-readiness-v3") {
    // v3 successor (owner: Option B + fresh envelope): v2 + the single
    // craft-map widening (pacing also accepts density). Same create-once /
    // bind-once discipline.
    const repositoryRoot = resolve(PIPELINE_DIR, "../../../..");
    const out = materializePilotRoleReadinessV3({
      repositoryRoot,
      write: flags.write === true,
      mintPlan: flags["mint-plan"] === true,
    });
    console.log(flags.json === true ? JSON.stringify(out, null, 2)
      : `[migration] ${out.experimentId}: corpus=${out.corpusSha256} plan=${out.planSha256 ?? "UNMINTED"} written=${String(out.written)} model/api calls=0`);
    return 0;
  }
  if (subverb === "pilot-role-readiness-v4") {
    // v4 successor (owner packet C): v3 + C1 assembly relaxation + C2 source
    // holdout adjudications + C3 quiz-first execution order.
    const repositoryRoot = resolve(PIPELINE_DIR, "../../../..");
    const out = materializePilotRoleReadinessV4({
      repositoryRoot,
      write: flags.write === true,
      mintPlan: flags["mint-plan"] === true,
    });
    console.log(flags.json === true ? JSON.stringify(out, null, 2)
      : `[migration] ${out.experimentId}: corpus=${out.corpusSha256} plan=${out.planSha256 ?? "UNMINTED"} written=${String(out.written)} model/api calls=0`);
    return 0;
  }
  if (subverb === "pilot-role-readiness-v5") {
    // v5 erratum identity: corrected C2 match string (fact-3-defect);
    // rulings unchanged.
    const repositoryRoot = resolve(PIPELINE_DIR, "../../../..");
    const out = materializePilotRoleReadinessV5({
      repositoryRoot,
      write: flags.write === true,
      mintPlan: flags["mint-plan"] === true,
    });
    console.log(flags.json === true ? JSON.stringify(out, null, 2)
      : `[migration] ${out.experimentId}: corpus=${out.corpusSha256} plan=${out.planSha256 ?? "UNMINTED"} written=${String(out.written)} model/api calls=0`);
    return 0;
  }
  if (subverb === "pilot-role-readiness-v6") {
    // v6: v5 + the packet-E assembly re-slot ruling (readiness-scoped).
    const repositoryRoot = resolve(PIPELINE_DIR, "../../../..");
    const out = materializePilotRoleReadinessV6({
      repositoryRoot,
      write: flags.write === true,
      mintPlan: flags["mint-plan"] === true,
    });
    console.log(flags.json === true ? JSON.stringify(out, null, 2)
      : `[migration] ${out.experimentId}: corpus=${out.corpusSha256} plan=${out.planSha256 ?? "UNMINTED"} written=${String(out.written)} model/api calls=0`);
    return 0;
  }
  if (subverb === "rubric-verify-owner-run") {
    // Re-validate the sealed 2026-07-15 owner audit end-to-end with the TS
    // port (fixture surface for the ±3.0 calibration chain of custody).
    const repositoryRoot = resolve(PIPELINE_DIR, "../../../..");
    const out = verifyOwnerRubricAuditRun({ repositoryRoot });
    console.log(flags.json === true ? JSON.stringify(out, null, 2)
      : `[migration] rubric owner-run ${out.runId}: allValid=${String(out.allValid)} units=${out.units.length} model/api calls=0`);
    if (!out.allValid) throw new Error("owner rubric-audit run failed TS re-validation");
    return 0;
  }
  if (subverb === "imp24-materialize-thresholds") {
    const outputPath = typeof flags.output === "string"
      ? resolve(flags.output)
      : resolve(PIPELINE_DIR, "state/migration-experiments/contracts/imp24/role-thresholds.v3-envelope.json");
    const bytes = canonicalPretty(IMP24_FROZEN_ROLE_THRESHOLDS);
    if (flags.write === true) writeFileAtomic(outputPath, bytes);
    if (flags.write === true || existsSync(outputPath)) {
      const retained = readFileSync(outputPath, "utf8");
      if (retained !== bytes) throw new Error("retained IMP-24 thresholds differ from the exact owner-frozen bytes");
    }
    const out = {
      schema: "imp24-role-threshold-materialization-v1",
      outputPath,
      semanticSha256: hashCanonical(IMP24_FROZEN_ROLE_THRESHOLDS),
      bytesSha256: sha256Hex(bytes),
      written: flags.write === true,
      modelCalls: 0,
      apiCalls: 0,
    };
    console.log(flags.json === true ? JSON.stringify(out, null, 2)
      : `[migration] IMP-24 thresholds: semantic=${out.semanticSha256} bytes=${out.bytesSha256} written=${String(out.written)}`);
    return 0;
  }
  if (subverb === "imp24-certify-instrument") {
    // Instrument-certification lifecycle with EXPLICIT identities (V25
    // recovery): the retained imp24 (predecessor) generation is verified as
    // HISTORY — self-hashes and internal pins only, never against current
    // bytes — while the imp24f ACTIVE CANDIDATE generation is recomputed from
    // and compared against current checkout bytes. --write mints the candidate
    // generation into contracts/imp24f/ and never writes imp22/imp24 paths.
    const repositoryRoot = resolve(PIPELINE_DIR, "../../../..");
    if (flags.write === true) {
      const out = materializeImp24fCandidateInstrument({ repositoryRoot });
      console.log(flags.json === true ? JSON.stringify(out, null, 2)
        : `[migration] IMP-24F candidate instrument minted: generation=${out.instrumentGeneration} seal=${out.candidateSealSha256} binding=${out.candidateCertificationSha256} model/api calls=0`);
    } else {
      const historical = verifyHistoricalImp24InstrumentIdentity({ repositoryRoot });
      const candidate = verifyImp24fCandidateInstrument({ repositoryRoot });
      console.log(flags.json === true ? JSON.stringify({
        status: "VERIFIED_INSTRUMENT_CERTIFICATION_LIFECYCLE",
        historicalPredecessor: historical,
        activeCandidate: candidate,
        written: false,
        modelCalls: 0,
        apiCalls: 0,
      }, null, 2) : `[migration] instrument certification lifecycle VERIFIED — historical imp24 binding=${historical.certificationSha256} (self-hash only); candidate ${candidate.instrumentGeneration} binding=${candidate.candidateCertificationSha256} (current bytes) DRY (pass --write to mint the candidate)`);
    }
    return 0;
  }
  if (subverb === "imp24-materialize-pre-live-freeze") {
    if (flags.output !== undefined || flags["state-root"] !== undefined) {
      console.error("imp24-materialize-pre-live-freeze: fixed authoritative paths reject --output and --state-root");
      return 2;
    }
    if (flags.write === true && flags.verify === true) {
      console.error("imp24-materialize-pre-live-freeze: choose exactly one of --write or --verify");
      return 2;
    }
    const repositoryRoot = resolve(PIPELINE_DIR, "../../../..");
    if (flags.verify === true) {
      const out = verifyImp24CPreLiveFreeze({ repositoryRoot });
      console.log(flags.json === true ? JSON.stringify(out, null, 2)
        : `[migration] IMP-24C pre-live freeze VERIFIED: ${out.freezeSha256} outputs=${out.verifiedOutputCount} writes=0 model/api calls=0`);
    } else if (flags.write === true) {
      const out = materializeImp24BPreLiveFreeze({ repositoryRoot });
      console.log(flags.json === true ? JSON.stringify({
        schema: out.schema,
        status: out.freeze.status,
        freezeSha256: out.freeze.freezeSha256,
        outputCount: Object.keys(out.outputs).length,
        written: true,
        modelCalls: out.modelCalls,
        apiCalls: out.apiCalls,
      }, null, 2) : `[migration] IMP-24C pre-live freeze: ${out.freeze.freezeSha256} outputs=${Object.keys(out.outputs).length} model/api calls=0`);
    } else {
      const out = buildImp24BPreLiveFreeze({ repositoryRoot });
      console.log(flags.json === true ? JSON.stringify({
        status: out.freeze.status,
        freezeSha256: out.freeze.freezeSha256,
        outputCount: Object.keys(out.outputs).length,
        written: false,
        modelCalls: out.modelCalls,
        apiCalls: out.apiCalls,
      }, null, 2) : `[migration] IMP-24C pre-live freeze: ${out.freeze.freezeSha256} outputs=${Object.keys(out.outputs).length} DRY (pass --write or --verify)`);
    }
    return 0;
  }
  if (subverb === "imp24-materialize-observability-freeze") {
    const allowed = new Set([
      "write", "verify", "verify-historical", "observability-commit", "json",
    ]);
    const unauthorized = Object.keys(flags).filter((key) => !allowed.has(key));
    if (unauthorized.length > 0) {
      console.error(`imp24-materialize-observability-freeze: fixed authoritative paths reject override(s): ${unauthorized.map((key) => `--${key}`).join(", ")}`);
      return 2;
    }
    const historical = flags["verify-historical"] === true;
    const modes = [flags.write === true, flags.verify === true, historical].filter(Boolean).length;
    if (modes > 1) {
      console.error("imp24-materialize-observability-freeze: choose at most one of --write, --verify, or --verify-historical");
      return 2;
    }
    const observabilityCommit = typeof flags["observability-commit"] === "string"
      ? flags["observability-commit"].trim()
      : "";
    if (historical !== (observabilityCommit.length > 0)
        || (historical && !/^[a-f0-9]{40}$/.test(observabilityCommit))) {
      console.error("imp24-materialize-observability-freeze: --verify-historical requires exactly one --observability-commit <40 lowercase hex>");
      return 2;
    }
    const repositoryRoot = resolve(PIPELINE_DIR, "../../../..");
    if (historical) {
      const out = verifyHistoricalImp24DObservabilityFreeze({
        repositoryRoot,
        observabilityImplementationCommit: observabilityCommit,
      });
      console.log(flags.json === true ? JSON.stringify(out, null, 2)
        : `[migration] historical IMP-24D observability freeze VERIFIED: ${out.freezeSha256} commit=${out.observabilityImplementationCommit} outputs=${out.verifiedOutputCount} writes=0 model/api calls=0`);
    } else if (flags.verify === true) {
      const out = verifyImp24DObservabilityFreeze({ repositoryRoot });
      console.log(flags.json === true ? JSON.stringify(out, null, 2)
        : `[migration] IMP-24D observability freeze VERIFIED: ${out.freezeSha256} outputs=${out.verifiedOutputCount} writes=0 model/api calls=0`);
    } else if (flags.write === true) {
      const out = materializeImp24DObservabilityFreeze({ repositoryRoot });
      console.log(flags.json === true ? JSON.stringify({
        schema: out.freeze.schema,
        status: out.freeze.status,
        freezeSha256: out.freeze.freezeSha256,
        outputCount: Object.keys(out.outputs).length,
        written: true,
        modelCalls: out.modelCalls,
        apiCalls: out.apiCalls,
      }, null, 2) : `[migration] IMP-24D observability freeze: ${out.freeze.freezeSha256} outputs=${Object.keys(out.outputs).length} model/api calls=0`);
    } else {
      const out = buildImp24DObservabilityFreeze({ repositoryRoot });
      console.log(flags.json === true ? JSON.stringify({
        status: out.freeze.status,
        freezeSha256: out.freeze.freezeSha256,
        outputCount: Object.keys(out.outputs).length,
        written: false,
        modelCalls: out.modelCalls,
        apiCalls: out.apiCalls,
      }, null, 2) : `[migration] IMP-24D observability freeze: ${out.freeze.freezeSha256} outputs=${Object.keys(out.outputs).length} DRY (pass --write or --verify)`);
    }
    return 0;
  }
  if (subverb === "imp24-materialize-final-attestation") {
    if (flags.output !== undefined || flags["state-root"] !== undefined) {
      console.error("imp24-materialize-final-attestation: fixed authoritative paths reject --output and --state-root");
      return 2;
    }
    const modes = [flags.write === true, flags.verify === true, flags["verify-retained"] === true]
      .filter(Boolean).length;
    if (modes > 1) {
      console.error("imp24-materialize-final-attestation: choose at most one of --write, --verify, or --verify-retained");
      return 2;
    }
    const repositoryRoot = resolve(PIPELINE_DIR, "../../../..");
    if (flags["verify-retained"] === true) {
      const out = verifyRetainedImp24CFinalAttestation({ repositoryRoot });
      console.log(flags.json === true ? JSON.stringify(out, null, 2)
        : `[migration] IMP-24C terminal attestation VERIFIED: ${out.attestationSha256} writes=0 model/api calls=0`);
      return 0;
    }
    const stringFlag = (name: string): string => typeof flags[name] === "string" ? (flags[name] as string).trim() : "";
    const implementationCommit = stringFlag("implementation-commit");
    const evidenceCommit = stringFlag("evidence-commit");
    const terminalQualificationResultPath = stringFlag("terminal-result");
    const dedicatedCiEvidencePath = stringFlag("ci-evidence");
    const roleAssignmentPath = stringFlag("role-assignment");
    if ([implementationCommit, evidenceCommit, terminalQualificationResultPath, dedicatedCiEvidencePath]
      .some((value) => value.length === 0)) {
      console.error("imp24-materialize-final-attestation: --implementation-commit, --evidence-commit, --terminal-result, and --ci-evidence are required");
      return 2;
    }
    const options = {
      repositoryRoot,
      implementationCommit,
      evidenceCommit,
      terminalQualificationResultPath,
      dedicatedCiEvidencePath,
      ...(roleAssignmentPath.length === 0 ? {} : { roleAssignmentPath }),
    };
    if (flags.write === true) {
      const out = materializeImp24CFinalAttestation(options);
      console.log(flags.json === true ? JSON.stringify(out, null, 2)
        : `[migration] IMP-24C terminal attestation: ${out.attestationSha256} outputs=${Object.keys(out.outputs).length} model/api calls=0`);
    } else if (flags.verify === true) {
      const out = verifyImp24CFinalAttestation(options);
      console.log(flags.json === true ? JSON.stringify(out, null, 2)
        : `[migration] IMP-24C terminal attestation VERIFIED: ${out.attestationSha256} writes=0 model/api calls=0`);
    } else {
      const out = buildImp24CFinalAttestation(options);
      console.log(flags.json === true ? JSON.stringify({
        schema: out.attestation.schema,
        finalDecision: out.attestation.finalDecision,
        attestationSha256: out.attestation.attestationSha256,
        outputCount: Object.keys(out.outputs).length,
        written: false,
        modelCalls: 0,
        apiCalls: 0,
      }, null, 2) : `[migration] IMP-24C terminal attestation: ${out.attestation.attestationSha256} outputs=${Object.keys(out.outputs).length} DRY (pass --write or --verify)`);
    }
    return 0;
  }
  if (subverb === "imp24d-materialize-final-attestation") {
    if (flags.output !== undefined || flags["state-root"] !== undefined
        || flags["terminal-result"] !== undefined || flags["ci-evidence"] !== undefined
        || flags["role-assignment"] !== undefined) {
      console.error("imp24d-materialize-final-attestation: fixed D evidence and output paths reject path overrides");
      return 2;
    }
    const modes = [flags.write === true, flags.verify === true, flags["verify-retained"] === true]
      .filter(Boolean).length;
    if (modes > 1) {
      console.error("imp24d-materialize-final-attestation: choose at most one of --write, --verify, or --verify-retained");
      return 2;
    }
    const repositoryRoot = resolve(PIPELINE_DIR, "../../../..");
    if (flags["verify-retained"] === true) {
      if (flags["implementation-commit"] !== undefined || flags["evidence-commit"] !== undefined) {
        console.error("imp24d-materialize-final-attestation: --verify-retained reconstructs commit inputs from the retained report");
        return 2;
      }
      const out = verifyRetainedImp24DFinalAttestation({ repositoryRoot });
      console.log(flags.json === true ? JSON.stringify(out, null, 2)
        : `[migration] IMP-24D terminal attestation VERIFIED: ${out.attestationSha256} writes=0 model/api calls=0`);
      return 0;
    }
    const stringFlag = (name: string): string => typeof flags[name] === "string" ? (flags[name] as string).trim() : "";
    const implementationCommit = stringFlag("implementation-commit");
    const evidenceCommit = stringFlag("evidence-commit");
    if (implementationCommit.length === 0 || evidenceCommit.length === 0) {
      console.error("imp24d-materialize-final-attestation: --implementation-commit and --evidence-commit are required");
      return 2;
    }
    const options = { repositoryRoot, implementationCommit, evidenceCommit };
    if (flags.write === true) {
      const out = materializeImp24DFinalAttestation(options);
      console.log(flags.json === true ? JSON.stringify(out, null, 2)
        : `[migration] IMP-24D terminal attestation: ${out.attestationSha256} outputs=${Object.keys(out.outputs).length} model/api calls=0`);
    } else if (flags.verify === true) {
      const out = verifyImp24DFinalAttestation(options);
      console.log(flags.json === true ? JSON.stringify(out, null, 2)
        : `[migration] IMP-24D terminal attestation VERIFIED: ${out.attestationSha256} writes=0 model/api calls=0`);
    } else {
      const out = buildImp24DFinalAttestation(options);
      console.log(flags.json === true ? JSON.stringify({
        schema: out.attestation.schema,
        finalDecision: out.attestation.finalDecision,
        attestationSha256: out.attestation.attestationSha256,
        outputCount: Object.keys(out.outputs).length,
        written: false,
        modelCalls: out.modelCalls,
        apiCalls: out.apiCalls,
      }, null, 2) : `[migration] IMP-24D terminal attestation: ${out.attestation.attestationSha256} outputs=${Object.keys(out.outputs).length} DRY (pass --write or --verify)`);
    }
    return 0;
  }
  if (subverb === "imp24-materialize-forward-inputs") {
    const stateRoot = typeof flags["state-root"] === "string"
      ? resolve(flags["state-root"])
      : migrationExperimentsDir();
    if (flags.write !== true) {
      const out = {
        schema: "imp24-forward-input-materialization-plan-v1",
        stateRoot,
        pilotExperimentId: "s16-forward-sol-pilot-v2-envelope",
        goldExperimentId: "s16-forward-sol-gold-book-v2-envelope",
        written: false,
        modelCalls: 0,
        apiCalls: 0,
      };
      console.log(flags.json === true ? JSON.stringify(out, null, 2)
        : `[migration] IMP-24 fresh input roots planned under ${stateRoot}; DRY (pass --write)`);
      return 0;
    }
    const materialized = materializeImp24ForwardInputs(stateRoot);
    const out = {
      schema: "imp24-forward-input-materialization-result-v1",
      inputFreezeSha256: materialized.freeze.freezeSha256,
      pilotRoot: materialized.pilotRoot,
      goldRoot: materialized.goldRoot,
      pilotExperimentId: materialized.materialization.pilotExperimentId,
      goldExperimentId: materialized.materialization.goldExperimentId,
      pilotChapterCount: materialized.freeze.pilot.flatMap((book) => book.chapters).length,
      goldChapterCount: materialized.freeze.goldChapterCount,
      written: true,
      priorChapterProseUsed: materialized.materialization.priorChapterProseUsed,
      modelCalls: 0,
      apiCalls: 0,
    };
    console.log(flags.json === true ? JSON.stringify(out, null, 2)
      : `[migration] IMP-24 fresh inputs: pilot=${out.pilotChapterCount} gold=${out.goldChapterCount} freeze=${out.inputFreezeSha256}`);
    return 0;
  }
  if (subverb === "forward-verify-production-instrument-seal-v2") {
    // Seal lifecycle with EXPLICIT identities (V25 recovery). With --output,
    // verify exactly that artifact against current bytes (fixture flows).
    // Otherwise verify BOTH generations by name: the imp24f ACTIVE CANDIDATE
    // seal against current checkout bytes, and the retained imp24 HISTORICAL
    // seal by self-hash + its recorded certification pin only.
    if (typeof flags.output === "string") {
      const out = verifyRetainedForwardProductionInstrumentSeal({ outputPath: resolve(flags.output) });
      console.log(flags.json === true
        ? JSON.stringify(out, null, 2)
        : `[migration] production instrument seal verified against current bytes: sha256=${out.sealSha256} files=${out.fileCount} path=${out.outputPath}`);
      return 0;
    }
    const repositoryRoot = resolve(PIPELINE_DIR, "../../../..");
    const candidate = verifyRetainedForwardProductionInstrumentSeal({
      repositoryRoot,
      outputPath: resolve(repositoryRoot, IMP24F_FORWARD_PRODUCTION_INSTRUMENT_SEAL_ARTIFACT_REL_PATH),
    });
    const historical = verifyHistoricalImp24InstrumentIdentity({ repositoryRoot });
    console.log(flags.json === true
      ? JSON.stringify({
        status: "VERIFIED_PRODUCTION_INSTRUMENT_SEAL_LIFECYCLE",
        activeCandidate: candidate,
        historicalPredecessor: historical,
        modelCalls: 0,
        apiCalls: 0,
      }, null, 2)
      : `[migration] production instrument seal lifecycle VERIFIED — candidate imp24f sha256=${candidate.sealSha256} files=${candidate.fileCount} (current bytes); historical imp24 sha256=${historical.sealSha256} (self-hash only)`);
    return 0;
  }
  if (subverb === "forward-materialize-production-instrument-seal-v2") {
    // Default output is the imp24f ACTIVE CANDIDATE seal. The retained imp24
    // seal belongs to the closed final campaign and is never written.
    const outputPath = typeof flags.output === "string"
      ? resolve(flags.output)
      : resolve(PIPELINE_DIR, "state/migration-experiments/contracts/imp24f/forward-production-instrument-seal.json");
    const out = materializeForwardProductionInstrumentSeal({ outputPath, write: flags.write === true });
    console.log(flags.json === true
      ? JSON.stringify(out, null, 2)
      : `[migration] IMP-24F candidate production instrument seal: sha256=${out.sealSha256} files=${out.fileCount} path=${out.outputPath} written=${String(out.written)}`);
    return 0;
  }
  if (subverb !== "forward-materialize-production-instrument-seal") return 2;
  const outputPath = typeof flags.output === "string" ? resolve(flags.output) : undefined;
  const out = materializeForwardProductionInstrumentSeal({
    ...(outputPath ? { outputPath } : {}),
    write: flags.write === true,
  });
  console.log(flags.json === true
    ? JSON.stringify(out, null, 2)
    : `[migration] IMP-22 production instrument seal: sha256=${out.sealSha256} files=${out.fileCount} path=${out.outputPath} written=${String(out.written)} model/api calls=0`);
  return 0;
}

export async function runMigrationBakeoffCli(
  args: string[],
  flags: Record<string, string | boolean>,
  deps: MigrationBakeoffCliDepsV1 = {},
): Promise<number> {
  const json = flags["json"] === true;
  const subverb = args[0] ?? "";
  // IMP-20 split-lane / §16-recovery subverbs are their own no-model branches;
  // they do NOT take --experiment (the recovery id is fixed) and never spawn.
  if (SPLIT_LANE_SUBVERBS.has(subverb)) {
    return runSplitLaneSubverb(subverb, flags);
  }
  if (LOCAL_QUALIFICATION_SUBVERBS.has(subverb)) {
    return runLocalQualificationSubverb(subverb, flags);
  }
  if (LOCAL_FORWARD_SUBVERBS.has(subverb)) {
    return runLocalForwardSubverb(subverb, flags);
  }
  if (IMP24E_SCHEMA_PROBE_SUBVERBS.has(subverb)) {
    return runImp24ESchemaProbeSubverb(subverb, flags, deps.imp24ESchemaProbes);
  }
  if (LIVE_QUALIFICATION_SUBVERBS.has(subverb)) {
    return runLiveQualificationSubverb(subverb, flags, deps.imp24RoleQualificationV3);
  }
  if (LIVE_FORWARD_SUBVERBS.has(subverb)) {
    return runLiveForwardSubverb(subverb, flags);
  }
  const experiment = typeof flags["experiment"] === "string" ? flags["experiment"] : "";
  if (!subverb || !(subverb === "plan" || subverb === "status" || subverb in PHASE_OF_SUBVERB)) {
    console.error(USAGE);
    return 2;
  }
  if (!experiment) {
    console.error(USAGE);
    console.error("migration-bakeoff: --experiment <spec.json|experimentId> is required.");
    return 2;
  }
  const { spec, experimentId, specPath } = readSpecArg(experiment);
  if (!experimentId) {
    console.error(`migration-bakeoff: could not resolve an experiment from "${experiment}"`);
    return 2;
  }

  if (subverb === "plan") {
    if (!spec) {
      console.error("migration-bakeoff plan: --experiment must be a spec .json file");
      return 2;
    }
    const problems = validateExperimentSpec(spec);
    if (problems.length > 0) {
      console.error(`spec INVALID:\n- ${problems.join("\n- ")}`);
      return 1;
    }
    const schedule = buildSampleSchedule(spec);
    const screening = schedule.entries.filter((e) => !e.expansion).length;
    const out = {
      experimentId: spec.experimentId,
      stage: spec.stage,
      cells: spec.cells.length,
      books: spec.books.length,
      chapters: spec.books.reduce((s, b) => s + b.chapters.length, 0),
      samples: schedule.entries.length,
      screeningSamples: screening,
      expansionSamples: schedule.entries.length - screening,
      judges: spec.judgePanel.length,
    };
    console.log(json ? JSON.stringify(out, null, 2) : `[migration] plan ${out.experimentId} (${out.stage}): ${out.samples} samples (${out.screeningSamples} screening + ${out.expansionSamples} expansion) = ${out.cells} cells × ${out.chapters} chapters × per-cell samples across ${out.books} book(s); ${out.judges} judge(s). Spec is VALID.`);
    return 0;
  }

  const stateRoot = typeof flags["state-root"] === "string" ? flags["state-root"] : undefined;
  if (subverb === "status") {
    const roots = migrationRoots(experimentId, stateRoot);
    if (!existsSync(roots.manifestPath)) {
      console.log(json ? JSON.stringify({ experimentId, status: "not-started" }) : `[migration] ${experimentId}: not started`);
      return 0;
    }
    const manifest = JSON.parse(readFileSync(roots.manifestPath, "utf8")) as MigrationManifestV1;
    console.log(json ? JSON.stringify(manifest, null, 2) : `[migration] ${experimentId}: phases done [${manifest.completedPhases.join(", ")}]${manifest.haltReason ? ` — HALT: ${manifest.haltReason}` : ""}`);
    return manifest.haltReason ? 1 : 0;
  }

  const opts: RunMigrationOptions = {
    experimentId,
    ...(specPath ? { specPath } : {}),
    ...(typeof flags["corpus"] === "string" ? { corpusPath: resolve(flags["corpus"] as string) } : {}),
    ...(stateRoot ? { stateRoot } : {}),
    ...(typeof flags["max-parallel"] === "string" ? { maxParallel: Number(flags["max-parallel"]) || 2 } : {}),
    allowSyntheticQualification: flags["allow-synthetic-qualification"] === true,
    through: PHASE_OF_SUBVERB[subverb],
  };
  const outcome = await runMigrationExperiment(opts);
  if (json) {
    console.log(JSON.stringify(outcome, null, 2));
  } else {
    console.log(`[migration] ${outcome.experimentId}: ${outcome.status}${outcome.phase ? ` (through ${outcome.phase})` : ""}${outcome.decisionLine ? `\n${outcome.decisionLine}` : ""}${outcome.reason ? `\n${outcome.reason}` : ""}`);
  }
  return outcome.status === "halt" ? 1 : 0;
}
