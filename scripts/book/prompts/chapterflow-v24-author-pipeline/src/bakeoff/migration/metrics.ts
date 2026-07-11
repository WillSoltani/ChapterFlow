/**
 * IMP-11 — the §16 metric tables (prompt inst. 12, 18). PURE aggregation over
 * conductor-owned sample records; the tables file is hashed BEFORE any
 * decision artifact exists (the unblinding gate reads that hash).
 *
 * Honesty rules baked in:
 *  - token usage is NOT exposed by the Codex CLI route (verified) — token and
 *    cost fields stay null with an explicit reason; nothing is estimated;
 *  - provider safeguard/refusal is a DISTINCT rate, never folded into
 *    infrastructure noise (the modelPolicy taxonomy is disjoint);
 *  - missing cells stay visible (§16 inst. 17);
 *  - projected repair demand is a FROZEN, versioned formula and is labeled a
 *    projection, never an observed production rate.
 */

import { PROVIDER_OUTCOMES, type ProviderOutcomeV1 } from "../../contracts/routeContracts.js";
import type { DiversityFeaturesV1 } from "../../telemetry/diversityFeatures.js";
import { AUTHOR_WRITE_GATE_RETRIES } from "../../orchestrator/authorRun.js";
import {
  MIGRATION_METRIC_TABLES_SCHEMA,
  REPAIR_PROJECTION_VERSION,
  type ExperimentSpecV1,
  type MigrationSampleRecordV1,
} from "./experimentTypes.js";

export const TOKENS_UNAVAILABLE_REASON =
  "codex CLI exposes no token usage on this route (verified against codexAgent/cost-tracker) — cost is not estimated; the frozen price snapshot applies only when token capture exists (§16)";

export type FeatureShareV1 = { feature: string; maxShare: number; dominantValue: string | null; distinctValues: number };

export type CellMetricsV1 = {
  cellId: string;
  scope: string;
  n: { planned: number; run: number; committed: number; reviewed: number; reviewValid: number };
  firstWritePassRate: number | null;
  acceptanceRate: number | null;
  providerOutcomes: Record<ProviderOutcomeV1, number>;
  replays: number;
  latencyMs: { p50: number | null; p95: number | null };
  critics: {
    c37OverreachMean: number | null;
    c37SceneCompletionMean: number | null;
    c37GenericLeakMean: number | null;
    registerAdvisoriesMean: number | null;
    causalClaimsMean: number | null;
  };
  diversityConcentration: FeatureShareV1[] | null;
  exactCloneCollisions: number;
  quizAdjudication: Record<string, number>;
  judgeAgreement: { doubleReads: number; verdictAgreementRate: number | null; compositeMeanAbsDelta: number | null };
  reviewComposite: { mean: number | null; min: number | null };
  keysCleanRate: number | null;
  mustFixComplaintsMean: number | null;
  projectedRepairPerChapter: number | null;
  tokens: null;
  costPerAcceptedChapterUsd: null;
  costUnavailableReason: string;
};

export type MetricTablesV1 = {
  schema: typeof MIGRATION_METRIC_TABLES_SCHEMA;
  experimentId: string;
  stage: ExperimentSpecV1["stage"];
  generatedAt: string;
  cells: CellMetricsV1[];
  byBook: CellMetricsV1[];
  byStratum: CellMetricsV1[];
  missingCells: Array<{ cellId: string; planned: number; got: number }>;
  unavailableFields: string[];
};

function rate(num: number, den: number): number | null {
  return den > 0 ? num / den : null;
}

function mean(xs: number[]): number | null {
  return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null;
}

/** Nearest-rank percentile on a sorted copy. */
export function percentile(xs: number[], p: number): number | null {
  if (xs.length === 0) return null;
  const sorted = [...xs].sort((a, b) => a - b);
  const rank = Math.min(sorted.length, Math.max(1, Math.ceil((p / 100) * sorted.length)));
  return sorted[rank - 1];
}

/** Scene-structure concentration over a cell's committed samples (the IMP-06
 *  feature lexicon; concentration semantics mirror diversityLedger's
 *  featureConcentration, computed here over features directly). */
export function featureShares(features: DiversityFeaturesV1[]): FeatureShareV1[] {
  if (features.length === 0) return [];
  const keys = Object.keys(features[0]) as Array<keyof DiversityFeaturesV1>;
  return keys.map((feature) => {
    const counts: Record<string, number> = {};
    for (const f of features) counts[f[feature]] = (counts[f[feature]] ?? 0) + 1;
    let dominantValue: string | null = null;
    let max = 0;
    for (const [value, count] of Object.entries(counts)) {
      if (count > max) { max = count; dominantValue = value; }
    }
    return { feature, maxShare: max / features.length, dominantValue, distinctValues: Object.keys(counts).length };
  });
}

function emptyOutcomeCounts(): Record<ProviderOutcomeV1, number> {
  return Object.fromEntries(PROVIDER_OUTCOMES.map((o) => [o, 0])) as Record<ProviderOutcomeV1, number>;
}

/** The frozen repair-demand projection (REPAIR_PROJECTION_VERSION): expected
 *  extra author sessions per chapter = deterministic-fail share × the
 *  production gate-retry budget + review-fail share × one regeneration.
 *  A projection under the CURRENT routing model — labeled as such. */
export function projectedRepairPerChapter(firstWritePassRate: number | null, acceptanceRate: number | null): number | null {
  if (firstWritePassRate === null) return null;
  const retryDemand = (1 - firstWritePassRate) * AUTHOR_WRITE_GATE_RETRIES;
  const regenDemand = acceptanceRate === null ? 0 : (1 - acceptanceRate) * 1;
  return retryDemand + regenDemand;
}

function aggregateCell(cellId: string, scope: string, records: MigrationSampleRecordV1[], planned: number): CellMetricsV1 {
  const run = records.length;
  const committed = records.filter((r) => r.artifact.contentSha256 !== null);
  const reviewed = records.filter((r) => r.review !== null);
  const reviewValid = reviewed.filter((r) => r.review!.valid);
  const qualitySamples = records.filter((r) => r.outcome.providerOutcome === "content_completed" || r.outcome.firstWriteDeterministicPass);
  const passes = records.filter((r) => r.outcome.firstWriteDeterministicPass);
  const firstWritePassRate = rate(passes.length, qualitySamples.length);
  const accepted = reviewValid.filter((r) => r.review!.pass);
  const acceptanceRate = rate(accepted.length, reviewValid.length);

  const providerOutcomes = emptyOutcomeCounts();
  let replays = 0;
  for (const r of records) {
    providerOutcomes[r.outcome.providerOutcome] += 1;
    if (r.outcome.replayed) replays += 1;
  }

  const durations = records.map((r) => r.outcome.durationMs).filter((d) => Number.isFinite(d) && d > 0);
  const critics = records.map((r) => r.critics).filter((c): c is NonNullable<MigrationSampleRecordV1["critics"]> => c !== null);
  const diversity = critics.map((c) => c.diversity).filter((d): d is DiversityFeaturesV1 => d !== null);

  const hashes = new Map<string, number>();
  for (const r of committed) hashes.set(r.artifact.contentSha256!, (hashes.get(r.artifact.contentSha256!) ?? 0) + 1);
  const exactCloneCollisions = [...hashes.values()].filter((c) => c > 1).reduce((s, c) => s + (c - 1), 0);

  const quizAdjudication: Record<string, number> = {};
  for (const r of reviewed) {
    const k = r.review!.quizAdjudicationStatus || "unknown";
    quizAdjudication[k] = (quizAdjudication[k] ?? 0) + 1;
  }

  const doublePairs = records.filter((r) => r.review && r.agreementReview && r.review.valid && r.agreementReview.valid);
  const verdictAgreements = doublePairs.filter((r) => r.review!.pass === r.agreementReview!.pass);
  const compositeDeltas = doublePairs.map((r) => Math.abs(r.review!.composite - r.agreementReview!.composite));

  const composites = reviewValid.map((r) => r.review!.composite);

  return {
    cellId,
    scope,
    n: { planned, run, committed: committed.length, reviewed: reviewed.length, reviewValid: reviewValid.length },
    firstWritePassRate,
    acceptanceRate,
    providerOutcomes,
    replays,
    latencyMs: { p50: percentile(durations, 50), p95: percentile(durations, 95) },
    critics: {
      c37OverreachMean: mean(critics.map((c) => c.c37Overreach)),
      c37SceneCompletionMean: mean(critics.map((c) => c.c37SceneCompletion)),
      c37GenericLeakMean: mean(critics.map((c) => c.c37GenericLeak)),
      registerAdvisoriesMean: mean(critics.map((c) => c.registerAdvisories)),
      causalClaimsMean: mean(critics.map((c) => c.causalClaims)),
    },
    diversityConcentration: diversity.length ? featureShares(diversity) : null,
    exactCloneCollisions,
    quizAdjudication,
    judgeAgreement: {
      doubleReads: doublePairs.length,
      verdictAgreementRate: rate(verdictAgreements.length, doublePairs.length),
      compositeMeanAbsDelta: mean(compositeDeltas),
    },
    reviewComposite: { mean: mean(composites), min: composites.length ? Math.min(...composites) : null },
    keysCleanRate: rate(reviewValid.filter((r) => r.review!.keysClean).length, reviewValid.length),
    mustFixComplaintsMean: mean(reviewValid.map((r) => r.review!.complaintsMustFix)),
    projectedRepairPerChapter: projectedRepairPerChapter(firstWritePassRate, acceptanceRate),
    tokens: null,
    costPerAcceptedChapterUsd: null,
    costUnavailableReason: TOKENS_UNAVAILABLE_REASON,
  };
}

export function aggregateMetricTables(spec: ExperimentSpecV1, records: MigrationSampleRecordV1[]): MetricTablesV1 {
  const plannedPerCell = spec.books.reduce((s, b) => s + b.chapters.length, 0) * spec.samplesPerCell;
  const cells = spec.cells.map((c) => aggregateCell(c.cellId, "pooled", records.filter((r) => r.cellId === c.cellId), plannedPerCell));

  const byBook: CellMetricsV1[] = [];
  for (const b of spec.books) {
    for (const c of spec.cells) {
      byBook.push(aggregateCell(
        c.cellId,
        `book:${b.bookId}`,
        records.filter((r) => r.cellId === c.cellId && r.bookId === b.bookId),
        b.chapters.length * spec.samplesPerCell,
      ));
    }
  }
  const strata = [...new Set(spec.books.flatMap((b) => b.chapters.map((ch) => ch.stratum)))].sort();
  const byStratum: CellMetricsV1[] = [];
  for (const s of strata) {
    const chaptersInStratum = spec.books.reduce((sum, b) => sum + b.chapters.filter((ch) => ch.stratum === s).length, 0);
    for (const c of spec.cells) {
      byStratum.push(aggregateCell(
        c.cellId,
        `stratum:${s}`,
        records.filter((r) => r.cellId === c.cellId && r.stratum === s),
        chaptersInStratum * spec.samplesPerCell,
      ));
    }
  }

  const missingCells = cells
    .filter((c) => c.n.run < c.n.planned)
    .map((c) => ({ cellId: c.cellId, planned: c.n.planned, got: c.n.run }));

  return {
    schema: MIGRATION_METRIC_TABLES_SCHEMA,
    experimentId: spec.experimentId,
    stage: spec.stage,
    generatedAt: new Date().toISOString(),
    cells,
    byBook,
    byStratum,
    missingCells,
    unavailableFields: ["tokens", "costPerAcceptedChapterUsd"],
  };
}
