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
  attestLiveRoleCalibration,
  runLiveRoleCalibration,
  runLiveRoleQualificationHoldout,
  type LiveQualificationPreflightV1,
} from "../../orchestrator/forwardRoleQualificationLive.js";
import {
  runForwardLiveCampaignCliBoundary,
  runForwardLiveCampaignFromExplicitArtifacts,
  type RunForwardLiveCampaignResultV1,
} from "../../orchestrator/forwardLiveValidationDriver.js";
import {
  FORWARD_PRODUCTION_INSTRUMENT_SEAL_ARTIFACT_REL_PATH,
  materializeForwardProductionInstrumentSeal,
} from "../../orchestrator/forwardProductionInstrumentSeal.js";
import {
  buildGoldArtifacts,
  buildPilotArtifacts,
  buildQualificationAndRoleFreezeArtifacts,
  stableForwardArtifactJson,
  type RetainedQualificationSpecV2,
} from "../../orchestrator/forwardLiveArtifactMaterializer.js";
import type { ForwardInputFreezeV1 } from "../../orchestrator/forwardInputFreeze.js";
import type { Imp22ForwardInputMaterializationV1 } from "../../orchestrator/forwardInputMaterialization.js";
import type { ForwardProductionInstrumentSealV1 } from "../../orchestrator/forwardProductionInstrumentSeal.js";
import type { ForwardRoleAssignmentFreezeV1 } from "../../orchestrator/forwardRoleAssignmentFreeze.js";
import type { RecoveryExperimentSpecV1 } from "./reviewLaneTypes.js";
import {
  FORWARD_LOCAL_ACTIVATION_POLICY_REL_PATH,
  buildForwardLocalActivationArtifacts,
} from "../../orchestrator/forwardLocalActivationMaterializer.js";
import {
  FORWARD_LOCAL_STATE_DIR,
  resolveStandardForwardAutopilotControl,
} from "../../orchestrator/forwardLocalAutopilot.js";

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
  `       IMP-22 live qualification subverbs (ChatGPT-authenticated codex exec;\n` +
  `       persist every attempt; require --execute-live):\n` +
  `         role-qualification-calibrate  run the 24-call calibration barrier only [--experiment ID]\n` +
  `         role-qualification-holdout    run holdout from a valid inspected seal [--experiment ID]\n` +
  `         forward-pilot                 run the frozen eight-chapter pilot\n` +
  `         forward-gold                  run the frozen no-publish gold phase\n` +
  `       IMP-22 local inspection subverb (zero model/API calls):\n` +
  `         role-qualification-attest-calibration --inspector ID --confirm-calibration-sha SHA --approve-holdout\n` +
  `         role-qualification-freeze --experiment s16-forward-role-qualification-v2 [--write]\n` +
  `         forward-materialize-pilot-artifacts --experiment s16-forward-role-qualification-v2 [--write]\n` +
  `         forward-materialize-gold-artifacts --experiment s16-forward-role-qualification-v2 [--write]\n` +
  `         forward-activate-local --activate-local --activated-at ISO --head-sha SHA --dedicated-ci-url URL\n` +
  `         forward-verify-local-activation\n` +
  `         forward-materialize-production-instrument-seal [--output FILE] [--write] [--json]\n` +
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
]);

const LIVE_FORWARD_SUBVERBS: ReadonlySet<string> = new Set([
  "forward-pilot",
  "forward-gold",
]);

const LOCAL_QUALIFICATION_SUBVERBS: ReadonlySet<string> = new Set([
  "role-qualification-attest-calibration",
]);

const LOCAL_FORWARD_SUBVERBS: ReadonlySet<string> = new Set([
  "forward-materialize-production-instrument-seal",
  "role-qualification-freeze",
  "forward-materialize-pilot-artifacts",
  "forward-materialize-gold-artifacts",
  "forward-activate-local",
  "forward-verify-local-activation",
]);

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

async function runLiveQualificationSubverb(
  subverb: string,
  flags: Record<string, string | boolean>,
): Promise<number> {
  if (flags["execute-live"] !== true) {
    console.error(`${subverb}: refusing to make model calls without the explicit --execute-live flag`);
    return 2;
  }
  const json = flags["json"] === true;
  const experimentId = typeof flags.experiment === "string"
    ? flags.experiment.trim()
    : "s16-forward-role-qualification-v1";
  if (!/^s16-forward-role-qualification-v[12]$/.test(experimentId)) {
    console.error(`${subverb}: unsupported qualification experiment identity ${experimentId}`);
    return 2;
  }
  const experimentDir = resolve(migrationExperimentsDir(), experimentId);
  const specPath = resolve(experimentDir, "spec.json");
  const timeoutMs = typeof flags["timeout-ms"] === "string"
    ? Number(flags["timeout-ms"])
    : undefined;
  if (timeoutMs !== undefined && (!Number.isInteger(timeoutMs) || timeoutMs < 1_000)) {
    console.error(`${subverb}: --timeout-ms must be an integer >= 1000`);
    return 2;
  }
  if (subverb === "role-qualification-calibrate") {
    const out = await runLiveRoleCalibration({ specPath, experimentDir, ...(timeoutMs ? { timeoutMs } : {}) });
    const summary = {
      experimentId: out.preflight.experimentId,
      phase: "calibration",
      valid: out.calibration.valid,
      calibrationSha256: out.calibration.calibrationSha256,
      attempts: out.calibration.attempts.length,
      codexExecInvocations: out.callLedger.codexExecInvocations,
      infrastructureReplays: out.callLedger.infrastructureReplays,
      maxPlanCapacityEvents: out.callLedger.maxPlanCapacityEvents,
      safeguardsOrRefusals: out.callLedger.safeguardsOrRefusals,
      apiCallsMade: out.callLedger.apiCallsMade,
      holdoutStarted: false,
    };
    console.log(json ? JSON.stringify(summary, null, 2) : `[migration] IMP-22 calibration: valid=${String(summary.valid)} attempts=${summary.attempts} codexExec=${summary.codexExecInvocations} replays=${summary.infrastructureReplays} api=${summary.apiCallsMade}; holdout NOT started`);
    return summary.valid ? 0 : 1;
  }
  if (subverb === "role-qualification-holdout") {
    const out = await runLiveRoleQualificationHoldout({ specPath, experimentDir, ...(timeoutMs ? { timeoutMs } : {}) });
    const summary = {
      experimentId: out.preflight.experimentId,
      phase: "holdout",
      roleSetReady: out.result.roleSetReady,
      blockedReason: out.result.roleSetBlockedReason,
      selected: out.result.selected,
      holdoutAttempts: out.result.attempts.filter((attempt) => attempt.partition === "holdout").length,
      codexExecInvocations: out.callLedger.codexExecInvocations,
      infrastructureReplays: out.callLedger.infrastructureReplays,
      maxPlanCapacityEvents: out.callLedger.maxPlanCapacityEvents,
      safeguardsOrRefusals: out.callLedger.safeguardsOrRefusals,
      apiCallsMade: out.callLedger.apiCallsMade,
    };
    console.log(json ? JSON.stringify(summary, null, 2) : `[migration] IMP-22 holdout: roleSetReady=${String(summary.roleSetReady)} attempts=${summary.holdoutAttempts} codexExec=${summary.codexExecInvocations} replays=${summary.infrastructureReplays} api=${summary.apiCallsMade}${summary.blockedReason ? ` — ${summary.blockedReason}` : ""}`);
    return summary.roleSetReady ? 0 : 1;
  }
  console.error(USAGE);
  return 2;
}

async function runLiveForwardSubverb(
  subverb: string,
  flags: Record<string, string | boolean>,
): Promise<number> {
  const phase = subverb === "forward-pilot" ? "pilot" : "gold";
  const boundary = await runForwardLiveCampaignCliBoundary({
    phase,
    executeLive: flags["execute-live"] === true,
    execute: async () => {
      const required = [
        "phase-dir", "manifest", "input-freeze", "input-materialization", "production-instrument-seal", "qualification-spec", "calibration-seal", "calibration-inspection",
        "qualification-result", "qualification-bundle", "role-freeze",
        ...(phase === "gold" ? ["gold-evaluator-config"] : []),
      ];
      const missing = required.filter((name) => typeof flags[name] !== "string" || String(flags[name]).trim().length === 0);
      if (missing.length > 0) throw new Error(`${subverb}: missing explicit artifact flag(s): ${missing.map((name) => `--${name}`).join(", ")}`);
      return runForwardLiveCampaignFromExplicitArtifacts({
        expectedKind: phase,
        phaseDir: resolve(flags["phase-dir"] as string),
        manifestPath: resolve(flags["manifest"] as string),
        inputFreezePath: resolve(flags["input-freeze"] as string),
        inputMaterializationPath: resolve(flags["input-materialization"] as string),
        productionInstrumentSealPath: resolve(flags["production-instrument-seal"] as string),
        qualificationSpecPath: resolve(flags["qualification-spec"] as string),
        calibrationSealPath: resolve(flags["calibration-seal"] as string),
        calibrationInspectionPath: resolve(flags["calibration-inspection"] as string),
        qualificationResultPath: resolve(flags["qualification-result"] as string),
        qualificationBundlePath: resolve(flags["qualification-bundle"] as string),
        roleAssignmentFreezePath: resolve(flags["role-freeze"] as string),
        ...(phase === "gold" ? { goldEvaluatorConfigPath: resolve(flags["gold-evaluator-config"] as string) } : {}),
      });
    },
  });
  if (!boundary.executed) {
    console.error(boundary.message);
    return boundary.code;
  }
  const out = boundary.result!;
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
  return summary.accepted ? 0 : 1;
}

function runLocalQualificationSubverb(
  subverb: string,
  flags: Record<string, string | boolean>,
): number {
  if (subverb !== "role-qualification-attest-calibration") return 2;
  const inspectedBy = typeof flags["inspector"] === "string" ? flags["inspector"] : "";
  const experimentId = typeof flags.experiment === "string"
    ? flags.experiment.trim()
    : "s16-forward-role-qualification-v1";
  if (!/^s16-forward-role-qualification-v[12]$/.test(experimentId)) {
    console.error(`${subverb}: unsupported qualification experiment identity ${experimentId}`);
    return 2;
  }
  const confirmedCalibrationSha256 = typeof flags["confirm-calibration-sha"] === "string"
    ? flags["confirm-calibration-sha"]
    : "";
  if (!inspectedBy || !/^[a-f0-9]{64}$/.test(confirmedCalibrationSha256) || flags["approve-holdout"] !== true) {
    console.error(`${subverb}: requires --inspector ID --confirm-calibration-sha <64 lowercase hex> --approve-holdout`);
    return 2;
  }
  const out = attestLiveRoleCalibration({
    experimentDir: resolve(migrationExperimentsDir(), experimentId),
    inspectedBy,
    confirmedCalibrationSha256,
    approveHoldout: true,
    ...(typeof flags["note"] === "string" ? { note: flags["note"] } : {}),
  });
  const summary = {
    experimentId,
    phase: "calibration-inspection",
    decision: out.inspection.decision,
    inspectedBy: out.inspection.inspectedBy,
    calibrationSha256: out.inspection.calibrationSha256,
    inspectedResultsSha256: out.inspection.inspectedResultsSha256,
    inspectionSha256: out.inspection.inspectionSha256,
    inspectedCaseCount: out.inspection.inspectedCaseCount,
    inspectedAttemptCount: out.inspection.inspectedAttemptCount,
    modelCalls: 0,
    apiCalls: 0,
  };
  console.log(flags["json"] === true
    ? JSON.stringify(summary, null, 2)
    : `[migration] IMP-22 calibration inspection: ${summary.decision} by ${summary.inspectedBy}; seal=${summary.calibrationSha256}; model/api calls=0`);
  return 0;
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

function activateForwardLocalArtifacts(flags: Record<string, string | boolean>): number {
  if (flags["activate-local"] !== true) throw new Error("forward-activate-local requires explicit --activate-local");
  if (flags["local-tests-pass"] !== true) throw new Error("forward-activate-local requires --local-tests-pass from the current production tree");
  const activatedAt = typeof flags["activated-at"] === "string" ? flags["activated-at"].trim() : "";
  const headSha = typeof flags["head-sha"] === "string" ? flags["head-sha"].trim() : "";
  const dedicatedCiUrl = typeof flags["dedicated-ci-url"] === "string" ? flags["dedicated-ci-url"].trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}T/.test(activatedAt) || !/^[a-f0-9]{40}$/.test(headSha)
      || !/^https:\/\/github\.com\/[^/]+\/[^/]+\/actions\/runs\/[0-9]+$/.test(dedicatedCiUrl)) {
    throw new Error("forward-activate-local requires --activated-at UTC_ISO --head-sha 40_HEX --dedicated-ci-url GitHub_Actions_URL");
  }
  const qualificationDir = resolve(migrationExperimentsDir(), "s16-forward-role-qualification-v2");
  const pilotDir = resolve(migrationExperimentsDir(), "s16-forward-sol-pilot-v1");
  const goldDir = resolve(migrationExperimentsDir(), "s16-forward-sol-gold-book-v1");
  const materialized = buildForwardLocalActivationArtifacts({
    activationId: typeof flags["activation-id"] === "string" ? flags["activation-id"].trim() : "imp23-sol-local-activation-v1",
    activatedAt,
    qualificationBundle: readJsonFile(resolve(qualificationDir, "live/holdout/qualification-bundle.json")),
    roleAssignmentFreeze: readJsonFile(resolve(qualificationDir, "live/holdout/role-assignment-freeze.json")),
    qualificationPreflight: readJsonFile(resolve(qualificationDir, "live/preflight.json")),
    pilotLiveResult: readJsonFile(resolve(pilotDir, "live-campaign/campaign-result.json")),
    goldLiveResult: readJsonFile(resolve(goldDir, "live-campaign/campaign-result.json")),
  });
  const gateDraft = {
    schema: "imp23-forward-local-activation-gate-evidence-v1",
    headSha,
    localTestsPassed: true,
    localTestsCommand: "CHAPTERFLOW_NO_API_CODEX_QC=1 npx tsx tests/run.ts",
    dedicatedV25CiConclusion: "success",
    dedicatedV25CiUrl: dedicatedCiUrl,
    materializationSha256: materialized.materializationSha256,
    apiCallsMade: 0,
    publish: false,
    promote: false,
    deploy: false,
    upload: false,
  };
  const gateEvidence = { ...gateDraft, gateEvidenceSha256: hashCanonical(gateDraft) };
  let written = 0;
  for (const [relPath, value] of Object.entries(materialized.artifactsByPath)) {
    if (relPath === FORWARD_LOCAL_ACTIVATION_POLICY_REL_PATH) continue;
    if (persistStableArtifact(resolve(FORWARD_LOCAL_STATE_DIR, relPath), value, true)) written += 1;
  }
  if (persistStableArtifact(resolve(FORWARD_LOCAL_STATE_DIR, "activation-gate-evidence.json"), gateEvidence, true)) written += 1;
  if (persistStableArtifact(
    resolve(FORWARD_LOCAL_STATE_DIR, FORWARD_LOCAL_ACTIVATION_POLICY_REL_PATH),
    materialized.artifactsByPath[FORWARD_LOCAL_ACTIVATION_POLICY_REL_PATH],
    true,
  )) written += 1;
  const control = resolveStandardForwardAutopilotControl();
  if (control.runtime.mode !== "FORWARD_ACTIVE") throw new Error("local activation read-back did not resolve FORWARD_ACTIVE");
  console.log(flags.json === true ? JSON.stringify({
    status: control.runtime.mode,
    activationId: control.runtime.policy.activationId,
    selectedProfile: control.runtime.policy.selectedProfile.profileId,
    rollbackProfile: control.runtime.policy.previousProfile.profileId,
    materializationSha256: materialized.materializationSha256,
    gateEvidenceSha256: gateEvidence.gateEvidenceSha256,
    written,
    modelCalls: 0,
    apiCalls: 0,
  }, null, 2) : `[migration] IMP-23 local activation: ${control.runtime.mode} profile=${control.runtime.policy.selectedProfile.profileId} rollback=${control.runtime.policy.previousProfile.profileId} written=${written}`);
  return 0;
}

function verifyForwardLocalActivation(flags: Record<string, string | boolean>): number {
  const control = resolveStandardForwardAutopilotControl();
  if (control.runtime.mode !== "FORWARD_ACTIVE") throw new Error(`local forward runtime is ${control.runtime.mode}, not FORWARD_ACTIVE`);
  console.log(flags.json === true ? JSON.stringify({
    status: control.runtime.mode,
    activationId: control.runtime.policy.activationId,
    selectedProfile: control.runtime.policy.selectedProfile.profileId,
    rollbackProfile: control.runtime.policy.previousProfile.profileId,
    bindingSha256: control.runtime.binding.bindingSha256,
    modelCalls: 0,
    apiCalls: 0,
  }, null, 2) : `[migration] IMP-23 local activation verified: ${control.runtime.mode} binding=${control.runtime.binding.bindingSha256}`);
  return 0;
}

function runLocalForwardSubverb(
  subverb: string,
  flags: Record<string, string | boolean>,
): number {
  if (subverb === "role-qualification-freeze") return materializeQualificationFreeze(flags);
  if (subverb === "forward-materialize-pilot-artifacts") return materializePilotArtifacts(flags);
  if (subverb === "forward-materialize-gold-artifacts") return materializeGoldArtifacts(flags);
  if (subverb === "forward-activate-local") return activateForwardLocalArtifacts(flags);
  if (subverb === "forward-verify-local-activation") return verifyForwardLocalActivation(flags);
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

export async function runMigrationBakeoffCli(args: string[], flags: Record<string, string | boolean>): Promise<number> {
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
  if (LIVE_QUALIFICATION_SUBVERBS.has(subverb)) {
    return runLiveQualificationSubverb(subverb, flags);
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
