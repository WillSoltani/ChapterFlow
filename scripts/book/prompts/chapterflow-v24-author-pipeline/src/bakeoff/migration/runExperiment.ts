/**
 * IMP-11 — the migration-experiment conductor (deterministic phase ladder with
 * durable resume, mirroring runBakeoff's manifest pattern):
 *
 *   seal → qualify → generate → review → metrics → analyze → unblind → decide → report
 *
 * There is NO promote/qc/publish phase — the ladder has no rung that crosses
 * into canonical state, deps are verb-stripped (withMigrationGuards), and every
 * write is experiment-rooted. Before every post-seal phase the seal is
 * re-verified: ANY drift (inputs, stacks, thresholds, schedule, spec) halts
 * with evidence preserved instead of silently mixing conditions (§16 stop 10).
 *
 * Screening → expansion (inst. 14): wave 1 runs + reviews the screening
 * subset; the FROZEN stopping rules are evaluated ONCE on interim metrics and
 * the decision persists (stopping-decision.json — resume reuses it, never
 * re-decides); only an "expand" decision runs the expansion wave.
 *
 * Unblinding order (verification #5): the decision phase refuses to run until
 * the metric tables are frozen (hash recorded in the manifest and re-verified)
 * and the sealed thresholds still hash to the seal — thresholds cannot change
 * after results exist, and no decision artifact can precede frozen metrics.
 */

import { existsSync, readFileSync, readdirSync } from "fs";

import type { AutopilotDeps } from "../../orchestrator/autopilot.js";
import { resolveDeps } from "../../orchestrator/autopilot.js";
import { BAKEOFF_NOISE_BAND } from "../review.js";
import { sha256Hex } from "../paths.js";
import {
  HISTORICAL_BASELINE_55,
  MIGRATION_MANIFEST_SCHEMA,
  type ExperimentSpecV1,
  type MigrationManifestV1,
  type MigrationPhase,
  type MigrationSampleRecordV1,
  type SampleScheduleV1,
  type SealedManifestV1,
} from "./experimentTypes.js";
import { assertNotClosed, migrationForbiddenTokens, MigrationGuardError, rootedPath, rootedWrite, withMigrationGuards, type MigrationRoots, migrationRoots } from "./guards.js";
import { aggregateMetricTables, type MetricTablesV1 } from "./metrics.js";
import {
  DEFAULT_QUAL_THRESHOLDS,
  detectQualificationOverlap,
  loadQualCorpus,
  runJudgeQualification,
} from "./qualification.js";
import { readSealed, readSealedSpec, sealExperiment, verifySealIntact, type SealDeps } from "./spec.js";
import { reviewOneSample } from "./reviewRunner.js";
import { runOneSample } from "./sampleRunner.js";
import {
  assessPrecision,
  effectiveSample,
  effectsReport,
  evaluateStopping,
  clusterBootstrapCI,
  valuesByBlock,
  blockKeyOf,
  METRIC_ACCEPTANCE,
  PRECISION_STATEMENT,
  type PrecisionAssessmentV1,
  type StoppingDecision,
} from "./stats.js";
import {
  buildDecisionFile,
  evaluateProfile,
  MIGRATION_THRESHOLDS_SCHEMA,
  type DecisionFileV1,
  type ProfileEvaluationV1,
  type ProfileThresholdInputsV1,
  type ThresholdsV1,
} from "./thresholds.js";
import type { AuthorIo } from "../../orchestrator/authorRun.js";

// The confirmatory baseline cell is the HISTORICAL 5.5 arm (55-XH,
// HISTORICAL_BASELINE_55), frozen so it never tracks the live baseline after the
// WP-302 flip (WP-501 Part 3).
const BASELINE_CELL_MODEL = HISTORICAL_BASELINE_55;
const BASELINE_CELL_ID = "55-XH";

/** Optional §16 human-adjudication input (human reviewers fill this OUTSIDE
 *  the harness); absent fields evaluate INCONCLUSIVE, never pass. */
export type HumanAdjudicationV1 = {
  schema: "migration-human-adjudication-v1";
  perCell: Record<string, {
    sourcedFabrication?: number;
    sourceFramingAmbiguity?: number;
    quizKeyOrMechanism?: number;
    causalOverreach?: number;
    exactLeakageOrClone?: number;
  }>;
  highSeverityHumanReviewComplete?: boolean;
};

export type MigrationStages = {
  runSample: typeof runOneSample;
  reviewSample: typeof reviewOneSample;
  qualifyJudge: typeof runJudgeQualification;
};

export type RunMigrationOptions = {
  experimentId?: string;
  /** Required for the seal phase (ignored once sealed). */
  specPath?: string;
  /** Required for the qualify phase (a sealed copy is kept thereafter). */
  corpusPath?: string;
  stateRoot?: string;
  maxParallel?: number;
  /** Dry-run only: accept synthetic-label qualifications (§16 requires human). */
  allowSyntheticQualification?: boolean;
  /** Stop after this phase (CLI subverbs map here); default: run the ladder. */
  through?: MigrationPhase;
  deps?: Partial<AutopilotDeps>;
  sealDeps?: Partial<SealDeps>;
  stages?: Partial<MigrationStages>;
  /** Test fixture inputs for sample writers (briefs/packets/plans/voice). */
  ioOverrides?: Partial<AuthorIo>;
  log?: (m: string) => void;
};

export type MigrationOutcome = {
  status: "complete" | "halt" | "stopped-at-phase";
  experimentId: string;
  phase?: MigrationPhase;
  reason?: string;
  decisionLine?: string;
};

function readManifest(roots: MigrationRoots): MigrationManifestV1 | null {
  if (!existsSync(roots.manifestPath)) return null;
  try {
    const m = JSON.parse(readFileSync(roots.manifestPath, "utf8")) as MigrationManifestV1;
    return m.schema === MIGRATION_MANIFEST_SCHEMA ? m : null;
  } catch {
    return null;
  }
}

function writeManifest(roots: MigrationRoots, m: MigrationManifestV1): void {
  m.updatedAt = new Date().toISOString();
  rootedWrite(roots, roots.manifestPath, JSON.stringify(m, null, 2));
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length || 1)) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

function loadRecords(roots: MigrationRoots): MigrationSampleRecordV1[] {
  const dir = rootedPath(roots, "records");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(rootedPath(roots, "records", f), "utf8")) as MigrationSampleRecordV1)
    .sort((a, b) => a.executionOrder - b.executionOrder);
}

// ── The conductor ─────────────────────────────────────────────────────────────

export async function runMigrationExperiment(opts: RunMigrationOptions): Promise<MigrationOutcome> {
  const log = opts.log ?? ((m: string) => console.log(m));
  const baseDeps = resolveDeps(opts.deps);
  const deps = withMigrationGuards(baseDeps);
  const stages: MigrationStages = {
    runSample: opts.stages?.runSample ?? runOneSample,
    reviewSample: opts.stages?.reviewSample ?? reviewOneSample,
    qualifyJudge: opts.stages?.qualifyJudge ?? runJudgeQualification,
  };
  const sealDeps: SealDeps = {
    expectedChapterNumbers: opts.sealDeps?.expectedChapterNumbers ?? baseDeps.expectedChapterNumbers,
    ...(opts.sealDeps?.freezeBookInputs ? { freezeBookInputs: opts.sealDeps.freezeBookInputs } : {}),
    ...(opts.sealDeps?.renderCurrentCard ? { renderCurrentCard: opts.sealDeps.renderCurrentCard } : {}),
  };

  // Identity: from opts, or from the spec file when sealing fresh.
  let experimentId = opts.experimentId;
  if (!experimentId && opts.specPath) {
    try { experimentId = (JSON.parse(readFileSync(opts.specPath, "utf8")) as ExperimentSpecV1).experimentId; } catch { /* validated in seal */ }
  }
  if (!experimentId) {
    return { status: "halt", experimentId: "", reason: "no experimentId — pass --experiment <spec.json> (seal) or --id <experimentId> (resume)" };
  }
  // Mechanical resume freeze (IMP-20 §K): a CLOSED §16 experiment id can never
  // resume — this is the exact choke the evidence flagged (completedPhases:['seal']
  // → straight to qualify). Fires BEFORE the run root resolves, so no closed
  // experiment dir is even touched. Fail-closed, exception-free.
  assertNotClosed(experimentId);
  const roots = migrationRoots(experimentId, opts.stateRoot);

  let manifest = readManifest(roots) ?? {
    schema: MIGRATION_MANIFEST_SCHEMA,
    experimentId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    specSha256: "",
    completedPhases: [] as MigrationPhase[],
  };
  const phaseDone = (p: MigrationPhase): boolean => manifest.completedPhases.includes(p);
  const markDone = (p: MigrationPhase): void => {
    if (!manifest.completedPhases.includes(p)) manifest.completedPhases.push(p);
    writeManifest(roots, manifest);
  };
  const halt = (reason: string): MigrationOutcome => {
    manifest.haltReason = reason;
    writeManifest(roots, manifest);
    log(`[migration] HALT: ${reason}`);
    return { status: "halt", experimentId: experimentId!, reason };
  };
  const stopIfThrough = (p: MigrationPhase): MigrationOutcome | null =>
    opts.through === p ? { status: "stopped-at-phase", experimentId: experimentId!, phase: p } : null;

  try {
    // ── seal ──────────────────────────────────────────────────────────────────
    if (!phaseDone("seal")) {
      if (!opts.specPath) return halt("seal requires --experiment <spec.json>");
      const sealed = sealExperiment(opts.specPath, roots, sealDeps);
      manifest.specSha256 = sealed.specSha256;
      markDone("seal");
      log(`[migration] sealed ${experimentId}: ${sealed.books.length} book(s), ${sealed.expectedCells.length} cells, schedule ${sealed.scheduleSha256.slice(0, 12)}`);
    }
    const sealed: SealedManifestV1 = readSealed(roots);
    const spec: ExperimentSpecV1 = readSealedSpec(roots);
    const schedule = JSON.parse(readFileSync(roots.schedulePath, "utf8")) as SampleScheduleV1;
    const thresholds = JSON.parse(readFileSync(roots.thresholdsCopyPath, "utf8")) as ThresholdsV1;
    if (thresholds.schema !== MIGRATION_THRESHOLDS_SCHEMA) return halt("sealed thresholds have the wrong schema");
    const guardSeal = (): string[] => verifySealIntact(roots, sealDeps);
    let stopped = stopIfThrough("seal");
    if (stopped) return stopped;

    // ── qualify ───────────────────────────────────────────────────────────────
    if (!phaseDone("qualify")) {
      const drift = guardSeal();
      if (drift.length > 0) return halt(`seal drift before qualify:\n- ${drift.join("\n- ")}`);
      const corpusPath = opts.corpusPath ?? rootedPath(roots, "qualification", "corpus.sealed.json");
      const corpus = loadQualCorpus(corpusPath);
      rootedWrite(roots, rootedPath(roots, "qualification", "corpus.sealed.json"), JSON.stringify(corpus, null, 2));
      const forbidden = migrationForbiddenTokens(spec);
      const failures: string[] = [];
      for (const judge of spec.judgePanel) {
        const q = await stages.qualifyJudge({
          corpus,
          judge,
          thresholds: DEFAULT_QUAL_THRESHOLDS,
          deps,
          roots,
          forbiddenTokens: forbidden,
          log,
        });
        log(`[migration] qualify ${judge.model}@${judge.effort}: ${q.qualified ? "QUALIFIED" : "NOT QUALIFIED"}${q.dryRunOnly ? " (dry-run-only: synthetic labels)" : ""}`);
        if (!q.qualified) failures.push(`${judge.model}@${judge.effort}`);
      }
      if (failures.length > 0) {
        return halt(`judge panel cannot meet the frozen qualification criteria: ${failures.join(", ")} — stopping before any candidate work (§16 step 3)`);
      }
      markDone("qualify");
    }
    stopped = stopIfThrough("qualify");
    if (stopped) return stopped;

    // ── generate + review (screening wave, then frozen-decision expansion) ────
    const maxParallel = Math.max(1, opts.maxParallel ?? 2);
    const stoppingPath = rootedPath(roots, "stopping-decision.json");
    const runWave = async (expansion: boolean): Promise<void> => {
      const entries = schedule.entries.filter((e) => e.expansion === expansion);
      await mapPool(entries, maxParallel, async (entry) => {
        await stages.runSample({ entry, spec, sealed, roots, deps, ioOverrides: opts.ioOverrides, log });
      });
    };
    const reviewWave = async (): Promise<void> => {
      const records = loadRecords(roots).filter((r) => r.artifact.contentSha256 !== null && r.review === null);
      await mapPool(records, maxParallel, async (record) => {
        await stages.reviewSample({ record, spec, roots, deps, allowSyntheticQualification: opts.allowSyntheticQualification === true, log });
      });
    };

    if (!phaseDone("generate") || !phaseDone("review")) {
      const drift = guardSeal();
      if (drift.length > 0) return halt(`seal drift before generate:\n- ${drift.join("\n- ")}`);

      await runWave(false);
      await reviewWave();

      // Stopping decision: evaluated ONCE on screening interim, then frozen.
      let stopping: StoppingDecision;
      if (existsSync(stoppingPath)) {
        stopping = JSON.parse(readFileSync(stoppingPath, "utf8")) as StoppingDecision;
      } else {
        const screening = loadRecords(roots).filter((r) => r.sampleIndex <= spec.screening.samplesPerCell);
        const interimTables = aggregateMetricTables(spec, screening);
        rootedWrite(roots, rootedPath(roots, "interim-metrics.json"), JSON.stringify(interimTables, null, 2));
        const solCells = spec.cells.filter((c) => c.model !== BASELINE_CELL_MODEL).map((c) => {
          const cell = interimTables.cells.find((x) => x.cellId === c.cellId);
          const screened = screening.filter((r) => r.cellId === c.cellId);
          return {
            cellId: c.cellId,
            upheldHighSeverity: screened.filter((r) => r.review?.valid && !r.review.keysClean).length,
            acceptancePct: cell?.acceptanceRate === null || cell?.acceptanceRate === undefined ? null : cell.acceptanceRate * 100,
            screened: screened.length,
          };
        });
        stopping = evaluateStopping(
          spec.screening.samplesPerCell < spec.samplesPerCell ? spec.screening.expandWhen : ["never-expand"],
          { solCells, minPooledAcceptancePct: thresholds.nonInferiority.minPooledAcceptancePct },
        );
        rootedWrite(roots, stoppingPath, JSON.stringify(stopping, null, 2));
        for (const r of stopping.reasons) log(`[migration] stopping: ${r}`);
      }
      if (stopping.decision === "expand") {
        await runWave(true);
        await reviewWave();
      }
      markDone("generate");
      markDone("review");
    }
    stopped = stopIfThrough("generate") ?? stopIfThrough("review");
    if (stopped) return stopped;

    // ── metrics (frozen BEFORE any decision artifact) ─────────────────────────
    if (!phaseDone("metrics")) {
      const drift = guardSeal();
      if (drift.length > 0) return halt(`seal drift before metrics:\n- ${drift.join("\n- ")}`);
      const tables = aggregateMetricTables(spec, loadRecords(roots));
      const bytes = JSON.stringify(tables, null, 2);
      rootedWrite(roots, roots.metricTablesPath, bytes);
      manifest.metricTablesSha256 = sha256Hex(bytes + "\n");
      markDone("metrics");
      log(`[migration] metric tables frozen (${manifest.metricTablesSha256.slice(0, 12)})`);
    }
    stopped = stopIfThrough("metrics");
    if (stopped) return stopped;

    const records = loadRecords(roots);
    const tables = JSON.parse(readFileSync(roots.metricTablesPath, "utf8")) as MetricTablesV1;

    // ── analyze ───────────────────────────────────────────────────────────────
    if (!phaseDone("analyze")) {
      const drift = guardSeal();
      if (drift.length > 0) return halt(`seal drift before analyze:\n- ${drift.join("\n- ")}`);
      const corpus = loadQualCorpus(rootedPath(roots, "qualification", "corpus.sealed.json"));
      const overlap = detectQualificationOverlap(corpus, records);
      if (overlap.length > 0) {
        return halt(`qualification/candidate overlap detected (${overlap.join(", ")}) — the experiment is invalid (red-team case 1)`);
      }
      const effects = effectsReport(records, spec.cells, sealed.randomizationSeed);
      const sample = effectiveSample(
        records,
        sealed.expectedCells,
        spec.books.reduce((s, b) => s + b.chapters.length, 0) * spec.samplesPerCell,
      );
      const precision: PrecisionAssessmentV1[] = [];
      for (const cell of spec.cells.filter((c) => c.model !== BASELINE_CELL_MODEL)) {
        const cellRecords = records.filter((r) => r.cellId === cell.cellId && r.artifact.contentSha256 !== null);
        const units = new Set(cellRecords.map(blockKeyOf)).size;
        for (const endpoint of spec.precision.primaryEndpoints) {
          precision.push({ ...assessPrecision(endpoint, 0, units), endpointId: `${cell.cellId}::${endpoint.id}` });
        }
      }
      const analysis = { effects, effectiveSample: sample, precision, precisionStatement: PRECISION_STATEMENT, overlapItemIds: overlap };
      rootedWrite(roots, roots.analysisPath, JSON.stringify(analysis, null, 2));
      markDone("analyze");
    }
    stopped = stopIfThrough("analyze");
    if (stopped) return stopped;

    // ── unblind (refused until metrics + thresholds are provably frozen) ─────
    if (!phaseDone("unblind")) {
      if (!manifest.metricTablesSha256) return halt("unblinding refused: metric tables were never frozen");
      const nowHash = sha256Hex(readFileSync(roots.metricTablesPath, "utf8"));
      if (nowHash !== manifest.metricTablesSha256) return halt("unblinding refused: metric tables drifted after freezing");
      if (sha256Hex(readFileSync(roots.thresholdsCopyPath, "utf8")) !== sealed.thresholdsSha256) {
        return halt("unblinding refused: thresholds changed after sealing (inst. 17)");
      }
      manifest.unblindedAt = new Date().toISOString();
      markDone("unblind");
    }
    stopped = stopIfThrough("unblind");
    if (stopped) return stopped;

    // ── decide ────────────────────────────────────────────────────────────────
    let decision: DecisionFileV1;
    if (!phaseDone("decide")) {
      const humanPath = rootedPath(roots, "human-adjudication.json");
      const human = existsSync(humanPath) ? (JSON.parse(readFileSync(humanPath, "utf8")) as HumanAdjudicationV1) : null;
      const analysis = JSON.parse(readFileSync(roots.analysisPath, "utf8")) as { precision: PrecisionAssessmentV1[] };
      const profiles: ProfileEvaluationV1[] = spec.cells
        .filter((c) => c.model !== BASELINE_CELL_MODEL)
        .map((cell) => evaluateProfile(buildProfileInputs(cell, spec, records, tables, human, analysis.precision, sealed.randomizationSeed), thresholds));
      const qualityCompositeByCell: Record<string, number | null> = {};
      for (const c of tables.cells) qualityCompositeByCell[c.cellId] = c.reviewComposite.mean;
      decision = buildDecisionFile({
        experimentId: spec.experimentId,
        specSha256: sealed.specSha256,
        thresholdsSha256: sealed.thresholdsSha256,
        metricTablesSha256: manifest.metricTablesSha256!,
        profiles,
        thresholds,
        qualityCompositeByCell,
      });
      rootedWrite(roots, roots.decisionPath, JSON.stringify(decision, null, 2));
      markDone("decide");
      log(`[migration] ${decision.line}`);
    } else {
      decision = JSON.parse(readFileSync(roots.decisionPath, "utf8")) as DecisionFileV1;
    }
    stopped = stopIfThrough("decide");
    if (stopped) return { ...stopped, decisionLine: decision.line };

    // ── report ────────────────────────────────────────────────────────────────
    if (!phaseDone("report")) {
      rootedWrite(roots, roots.reportMdPath, renderReportMd(spec, sealed, tables, decision));
      markDone("report");
    }
    return { status: "complete", experimentId, decisionLine: decision.line };
  } catch (err) {
    if (err instanceof MigrationGuardError) return halt(err.message);
    throw err;
  }
}

// ── Threshold-input assembly (per SOL profile) ────────────────────────────────

function pct(x: number | null): number | null {
  return x === null ? null : x * 100;
}

function rateOver(records: MigrationSampleRecordV1[], pred: (r: MigrationSampleRecordV1) => boolean, denomPred: (r: MigrationSampleRecordV1) => boolean): number | null {
  const denom = records.filter(denomPred);
  if (denom.length === 0) return null;
  return (denom.filter(pred).length / denom.length) * 100;
}

function cohensKappa(pairs: Array<{ a: boolean; b: boolean }>): number | null {
  if (pairs.length === 0) return null;
  const po = pairs.filter((p) => p.a === p.b).length / pairs.length;
  const paYes = pairs.filter((p) => p.a).length / pairs.length;
  const pbYes = pairs.filter((p) => p.b).length / pairs.length;
  const pe = paYes * pbYes + (1 - paYes) * (1 - pbYes);
  if (pe === 1) return po === 1 ? 1 : 0;
  return (po - pe) / (1 - pe);
}

export function buildProfileInputs(
  cell: ExperimentSpecV1["cells"][number],
  spec: ExperimentSpecV1,
  records: MigrationSampleRecordV1[],
  tables: MetricTablesV1,
  human: HumanAdjudicationV1 | null,
  precision: PrecisionAssessmentV1[],
  seed: string,
): ProfileThresholdInputsV1 {
  const cellTable = tables.cells.find((c) => c.cellId === cell.cellId);
  const baselineTable = tables.cells.find((c) => c.cellId === BASELINE_CELL_ID);
  const cellRecords = records.filter((r) => r.cellId === cell.cellId);
  const baselineRecords = records.filter((r) => r.cellId === BASELINE_CELL_ID);
  const committed = (r: MigrationSampleRecordV1): boolean => r.artifact.contentSha256 !== null && r.critics !== null;

  const acceptanceBlocks = valuesByBlock(records, cell.cellId, METRIC_ACCEPTANCE).blocks;
  const acceptanceCi = clusterBootstrapCI({ blocks: acceptanceBlocks, seed: `${seed}::t3::${cell.cellId}` });

  const framing = (r: MigrationSampleRecordV1): boolean => (r.critics!.c37SceneCompletion + r.critics!.c37GenericLeak) > 0;
  const causal = (r: MigrationSampleRecordV1): boolean => r.critics!.c37Overreach > 0;
  const quizAmbig = (r: MigrationSampleRecordV1): boolean => r.review !== null && r.review.valid && !r.review.keysClean;
  const reviewedValid = (r: MigrationSampleRecordV1): boolean => r.review !== null && r.review.valid;

  const doublePairs = records
    .filter((r) => r.review?.valid && r.agreementReview?.valid)
    .map((r) => ({ a: r.review!.pass, b: r.agreementReview!.pass, delta: Math.abs(r.review!.composite - r.agreementReview!.composite) }));

  const humanCell = human?.perCell?.[cell.cellId] ?? null;
  const precisionSupported: Record<string, boolean> = {};
  for (const p of precision) {
    const [cellId, endpointId] = p.endpointId.split("::");
    if (cellId === cell.cellId && endpointId) precisionSupported[endpointId] = p.supported;
  }

  return {
    cellId: cell.cellId,
    model: cell.model,
    effort: cell.effort,
    // Guard-enforced in-run: any canonical write/unexpected-write/ambient-route
    // event halts the run before a decision exists — reaching decide with N
    // completed phases means zero OBSERVED P0 events in this run.
    p0StateFailures: 0,
    upheldHighSeverity: {
      sourcedFabrication: humanCell?.sourcedFabrication ?? null,
      sourceFramingAmbiguity: humanCell?.sourceFramingAmbiguity ?? null,
      quizKeyOrMechanism: humanCell?.quizKeyOrMechanism ?? null,
      causalOverreach: humanCell?.causalOverreach ?? null,
      exactLeakageOrClone: humanCell?.exactLeakageOrClone ?? (cellTable ? cellTable.exactCloneCollisions : null),
    },
    pooledAcceptancePct: pct(cellTable?.acceptanceRate ?? null),
    acceptanceCiLowerPct: acceptanceCi ? acceptanceCi.lower * 100 : null,
    baselineAcceptancePct: pct(baselineTable?.acceptanceRate ?? null),
    materialRates: {
      sourceFramingPct: { observed: rateOver(cellRecords, framing, committed), baseline: rateOver(baselineRecords, framing, committed) },
      quizAmbiguityPct: { observed: rateOver(cellRecords, quizAmbig, reviewedValid), baseline: rateOver(baselineRecords, quizAmbig, reviewedValid) },
      causalPct: { observed: rateOver(cellRecords, causal, committed), baseline: rateOver(baselineRecords, causal, committed) },
    },
    reviewerReliability: {
      rawAgreement: doublePairs.length ? doublePairs.filter((p) => p.a === p.b).length / doublePairs.length : null,
      chanceCorrected: cohensKappa(doublePairs),
      materialDisagreementPct: doublePairs.length ? (doublePairs.filter((p) => p.delta > BAKEOFF_NOISE_BAND).length / doublePairs.length) * 100 : null,
      highSeverityHumanReviewComplete: human?.highSeverityHumanReviewComplete ?? null,
    },
    repairDemand: {
      projectedPerChapter: cellTable?.projectedRepairPerChapter ?? null,
      baselinePerChapter: baselineTable?.projectedRepairPerChapter ?? null,
    },
    economics: { costPerAcceptedChapterUsd: null, latencyP95Ms: cellTable?.latencyMs.p95 ?? null },
    precisionSupported,
    qualityCompositeMean: cellTable?.reviewComposite.mean ?? null,
  };
}

// ── Report ────────────────────────────────────────────────────────────────────

function renderReportMd(spec: ExperimentSpecV1, sealed: SealedManifestV1, tables: MetricTablesV1, decision: DecisionFileV1): string {
  const lines: string[] = [];
  lines.push(`# Migration experiment ${spec.experimentId} (${spec.stage})`);
  lines.push("");
  lines.push(`- Sealed spec: \`${sealed.specSha256.slice(0, 16)}\` · thresholds \`${sealed.thresholdsSha256.slice(0, 16)}\` · schedule \`${sealed.scheduleSha256.slice(0, 16)}\``);
  lines.push(`- Instruments: rubric ${sealed.instruments.readerRubricVersion}, docHash ${sealed.instruments.reviewDocHashVersion}, route policy ${sealed.instruments.routePolicyVersion}`);
  lines.push(`- Books: ${sealed.books.map((b) => `${b.bookId} (${b.totalChapters} ch)`).join(", ")}`);
  lines.push(`- Cells: ${spec.cells.map((c) => `${c.cellId}=${c.model}@${c.effort}/${c.stackId}`).join("; ")}`);
  lines.push("");
  lines.push(`> ${PRECISION_STATEMENT}`);
  lines.push("");
  lines.push("| cell | run/planned | first-write pass | acceptance | p95 latency | safeguard/refusal | replays |");
  lines.push("|---|---|---|---|---|---|---|");
  for (const c of tables.cells) {
    lines.push(`| ${c.cellId} | ${c.n.run}/${c.n.planned} | ${c.firstWritePassRate === null ? "—" : (c.firstWritePassRate * 100).toFixed(1) + "%"} | ${c.acceptanceRate === null ? "—" : (c.acceptanceRate * 100).toFixed(1) + "%"} | ${c.latencyMs.p95 === null ? "—" : Math.round(c.latencyMs.p95 / 1000) + "s"} | ${c.providerOutcomes.provider_safeguard_or_refusal} | ${c.replays} |`);
  }
  lines.push("");
  if (tables.missingCells.length > 0) {
    lines.push(`Missing cells (visible, never imputed): ${tables.missingCells.map((m) => `${m.cellId} ${m.got}/${m.planned}`).join("; ")}`);
    lines.push("");
  }
  lines.push(`Unavailable fields (never estimated): ${tables.unavailableFields.join(", ")}.`);
  lines.push("");
  lines.push("## Threshold verdicts");
  for (const p of decision.profiles) {
    lines.push("");
    lines.push(`### ${p.cellId} (${p.model} @ ${p.effort}) — ${p.qualifies ? "QUALIFIES" : p.blockedBy.length ? `blocked by ${p.blockedBy.join(", ")}` : `inconclusive on ${p.inconclusiveOn.join(", ")}`}`);
    for (const t of p.verdicts) {
      lines.push(`- ${t.id} ${t.title}: **${t.verdict.toUpperCase()}** (${t.observed}; rule: ${t.rule})${t.statisticallySupported ? "" : " — observed gate only, not a population claim"}${t.note ? ` — ${t.note}` : ""}`);
    }
  }
  lines.push("");
  lines.push(`**${decision.line}**`);
  lines.push("");
  lines.push(`Effort recommendation: ${decision.effortRecommendation}`);
  lines.push("");
  lines.push(`Activation: ${decision.activation}.`);
  return lines.join("\n");
}
