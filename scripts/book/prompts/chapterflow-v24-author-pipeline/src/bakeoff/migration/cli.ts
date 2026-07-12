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

import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

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
import { CorpusBuildError, canonicalPretty, readMutationSpec } from "./corpusBuilderCore.js";
import { buildReaderCorpus } from "./readerCorpusBuilder.js";
import { buildSourceCorpus } from "./sourceCorpusBuilder.js";
import { buildQuizCorpus } from "./quizCorpusBuilder.js";
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
import { hashCanonical } from "../../contracts/contractUtil.js";
import { resolveExecutionProfile } from "../../exec/executionEnvelope.js";
import { ROUTE_POLICY_VERSION } from "../../orchestrator/modelPolicy.js";
import { writeFileAtomic } from "../../lib/atomicWrite.js";

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
  `         retrospective                 static Layer-N v2 → split-lane re-projection\n` +
  `         recovery-preflight            build+preflight the recovery spec/seal-prep\n` +
  `         recovery-pilot-dryrun         no-model pilot dry run (ZERO spawns)`;

/** IMP-20 subverbs handled as their own branches (like `plan`/`status`), each
 *  delegating to a PURE conductor. None makes a model call. */
const SPLIT_LANE_SUBVERBS: ReadonlySet<string> = new Set([
  "close-legacy-campaign",
  "build-reader-corpus",
  "build-source-corpus",
  "build-quiz-corpus",
  "retrospective",
  "recovery-preflight",
  "recovery-pilot-dryrun",
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
    case "retrospective": return runRetrospective(write, json);
    case "recovery-preflight": return runRecoveryPreflight(write, json);
    case "recovery-pilot-dryrun": return runRecoveryPilotDryRunSubverb(write, json);
    default:
      console.error(USAGE);
      return 2;
  }
}

export async function runMigrationBakeoffCli(args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const json = flags["json"] === true;
  const subverb = args[0] ?? "";
  // IMP-20 split-lane / §16-recovery subverbs are their own no-model branches;
  // they do NOT take --experiment (the recovery id is fixed) and never spawn.
  if (SPLIT_LANE_SUBVERBS.has(subverb)) {
    return runSplitLaneSubverb(subverb, flags);
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
