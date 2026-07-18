/**
 * IMP-11 — the migration harness's no-promotion / no-canonical-write firewall
 * (prompt inst. 1; verification #4).
 *
 * Three independent layers, each fail-closed:
 *
 *   1. STATIC — the migration modules never import promotion/publish/autopilot
 *      surfaces (FORBIDDEN_MIGRATION_IMPORT_PATTERNS is consumed by a static
 *      test that greps these sources; a new forbidden import fails the suite).
 *   2. CAPABILITY — withMigrationGuards() strips `runVerb` from the injected
 *      deps entirely: the experiment write path needs NO CLI verb (verified:
 *      authorWriteOneChapter validates in-process through io hooks), so no
 *      promote/publish/qc verb is reachable even by future accident.
 *   3. PATH — every write the harness performs goes through rootedWrite(),
 *      which requires the destination inside the experiment root AND outside
 *      every canonical tree (defense in depth if roots were misconfigured).
 */

import { mkdirSync } from "fs";
import { resolve, sep } from "path";

import type { AutopilotDeps } from "../../orchestrator/autopilot.js";
import { writeFileAtomic, ensureTrailingNewline } from "../../lib/atomicWrite.js";
import { normSlug } from "../../lib/chapterPaths.js";
import { PIPELINE_DIR, modelSlug } from "../paths.js";
import { forbiddenReviewTokens } from "../review.js";
import type { ExperimentSpecV1 } from "./experimentTypes.js";

export class MigrationGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MigrationGuardError";
  }
}

// ── §16 legacy-campaign closure — mechanical resume freeze (IMP-20 §K) ─────────
//
// The §16 GPT-5.6-SOL reviewer-migration campaign is ARCHIVED
// (ARCHIVED_INCONCLUSIVE_REVIEW_INSTRUMENT_MISMATCH): its sealed experiments,
// corpora, and reviewer-qualification instruments are frozen and can never
// resume a live run. This Set is the SINGLE source of truth for the freeze; the
// machine-readable closure record (S16_LEGACY_CAMPAIGN_CLOSURE.json under
// state/migration-experiments) mirrors it, and a Wave-C sync test makes editing
// that JSON alone unable to un-freeze anything. Both experiment-id slugs AND
// corpus/instrument ids are held, because the fail-closed check keys on whichever
// identity reaches a gate-able src/ choke: runMigrationExperiment(experimentId),
// sealNativeReview(corpus.corpusId), runNativeReviewQualification(corpus.corpusId).
// A NEW identity (e.g. s16-reviewer-recovery-v1) is absent → it passes.
export const CLOSED_EXPERIMENT_IDS: ReadonlySet<string> = new Set<string>([
  "diagnostic-stack-2026-07",
  "confirmatory-sol-2026-07",
  "diagnostic-stack-dryrun-2026-07",
  "confirmatory-dryrun-2026-07",
  "layer-n-v2-qualification",
  "s16-layer-n-native-review-v2",
  "stage-q-layer-o-v1",
  "stage-q-layer-o-v2",
  "stage-q-layer-o-v3",
  "layer-n-v1",
]);

/** Fail-closed resume freeze (IMP-20 §K): any CLOSED §16 identity — an
 *  experiment-id slug or a corpus/instrument id — throws before any live work.
 *  There is NO bypass flag; the freeze is exception-free by construction (a
 *  live driver cannot accidentally set an escape hatch). A brand-new experiment
 *  id passes untouched, so the go-forward recovery path is unaffected. */
export function assertNotClosed(id: string): void {
  if (CLOSED_EXPERIMENT_IDS.has(id)) {
    throw new MigrationGuardError(
      `"${id}" belongs to the CLOSED §16 reviewer-migration campaign ` +
        `(ARCHIVED_INCONCLUSIVE_REVIEW_INSTRUMENT_MISMATCH) — it cannot resume. ` +
        `The old seals/corpora/instruments are immutable; start a NEW experiment ` +
        `id instead (see S16_LEGACY_CAMPAIGN_CLOSURE.json).`,
    );
  }
}

/** Historical Stage-Q owner drivers retained for audit readability. These
 * identities are deliberately named here instead of inferred from argv or an
 * artifact path, so each raw launch surface remains bound to the exact closed
 * §16 instrument it once executed. */
export const LEGACY_STAGE_Q_OWNER_DRIVER_IDS = {
  layerOQualification: "stage-q-layer-o-v1",
  layerOV2: "stage-q-layer-o-v2",
  stageQV3: "stage-q-layer-o-v3",
} as const;

export type LegacyStageQOwnerDriverId =
  (typeof LEGACY_STAGE_Q_OWNER_DRIVER_IDS)[keyof typeof LEGACY_STAGE_Q_OWNER_DRIVER_IDS];

/** Import-safe, side-effect-free hard stop for the three historical raw-spawn
 * owner drivers. The old implementation stays readable below each call site,
 * but invocation can never reach argv parsing, corpus reads, output writes, or
 * `spawnCodexAgent`.
 *
 * This always throws. If a future edit accidentally removes the bound id from
 * `CLOSED_EXPERIMENT_IDS`, the fallback throw still refuses execution rather
 * than silently reviving the driver. */
export function assertLegacyStageQOwnerDriverClosed(id: LegacyStageQOwnerDriverId): never {
  try {
    assertNotClosed(id);
  } catch (error) {
    if (error instanceof MigrationGuardError) {
      throw new MigrationGuardError(
        `legacy raw Stage-Q owner driver "${id}" is permanently disabled for forward-only execution. ${error.message}`,
      );
    }
    throw error;
  }

  throw new MigrationGuardError(
    `legacy raw Stage-Q owner driver "${id}" lost its CLOSED_EXPERIMENT_IDS binding; ` +
      `refusing execution until the closed registry is repaired.`,
  );
}

/** Identifiers the migration sources (all files EXCEPT this definition site)
 *  must never contain — the static guard test greps src/bakeoff/migration/*.ts
 *  for these, and additionally scans import lines for promotion/publish modules
 *  and call sites for `.runVerb(` (the harness has no verb capability at all). */
export const FORBIDDEN_MIGRATION_IMPORT_PATTERNS: readonly string[] = [
  "promotion.js",
  "promoteWinner",
  "recordAuthorProvenance",
  "book-autopilot",
  "promoteBook",
  "publishFinal",
];

// ── Experiment roots ──────────────────────────────────────────────────────────

export type MigrationRoots = {
  runRoot: string;
  manifestPath: string;
  specCopyPath: string;
  sealedPath: string;
  schedulePath: string;
  thresholdsCopyPath: string;
  samplesDir: string;
  qualificationDir: string;
  recordsDir: string;
  metricTablesPath: string;
  analysisPath: string;
  decisionPath: string;
  reportMdPath: string;
  evidenceRoot: string;
};

/** Everything a migration experiment writes lives under ONE isolated root —
 *  a SIBLING of state/model-bakeoffs, never inside any canonical tree. */
export function migrationRoots(experimentId: string, stateRoot?: string): MigrationRoots {
  const runRoot = resolve(stateRoot ?? resolve(PIPELINE_DIR, "state"), "migration-experiments", normSlug(experimentId));
  return {
    runRoot,
    manifestPath: resolve(runRoot, "manifest.json"),
    specCopyPath: resolve(runRoot, "spec.sealed.json"),
    sealedPath: resolve(runRoot, "sealed.json"),
    schedulePath: resolve(runRoot, "schedule.json"),
    thresholdsCopyPath: resolve(runRoot, "thresholds.sealed.json"),
    samplesDir: resolve(runRoot, "samples"),
    qualificationDir: resolve(runRoot, "qualification"),
    recordsDir: resolve(runRoot, "records"),
    metricTablesPath: resolve(runRoot, "metric-tables.json"),
    analysisPath: resolve(runRoot, "analysis.json"),
    decisionPath: resolve(runRoot, "decision.json"),
    reportMdPath: resolve(runRoot, "report.md"),
    evidenceRoot: resolve(runRoot, "evidence"),
  };
}

/** Canonical trees no migration write may ever land in — refused even for
 *  paths that (through misconfiguration) fall inside the experiment root. */
const CANONICAL_WRITE_PREFIXES = [
  "state/chapters",
  "state/provenance",
  "state/books",
  "state/indexes",
  "state/briefs",
  "state/packets",
  "state/plans",
  "state/model-bakeoffs",
  "book-packages",
] as const;

export function assertNotCanonical(absPath: string): void {
  const abs = resolve(absPath);
  for (const prefix of CANONICAL_WRITE_PREFIXES) {
    const root = resolve(PIPELINE_DIR, prefix);
    if (abs === root || abs.startsWith(root + sep)) {
      throw new MigrationGuardError(
        `migration write refused: ${abs} is inside the canonical tree ${prefix} — the harness never mutates canonical state (promotion does not exist here)`,
      );
    }
  }
}

/** Resolve a path INSIDE the experiment root; anything else is refused. */
export function rootedPath(roots: MigrationRoots, ...segments: string[]): string {
  const abs = resolve(roots.runRoot, ...segments);
  if (abs !== roots.runRoot && !abs.startsWith(roots.runRoot + sep)) {
    throw new MigrationGuardError(`migration write refused: ${abs} escapes the experiment root ${roots.runRoot}`);
  }
  assertNotCanonical(abs);
  return abs;
}

/** The ONLY write primitive the migration harness uses. */
export function rootedWrite(roots: MigrationRoots, absPath: string, text: string): void {
  const abs = resolve(absPath);
  if (abs !== roots.runRoot && !abs.startsWith(roots.runRoot + sep)) {
    throw new MigrationGuardError(`migration write refused: ${abs} escapes the experiment root ${roots.runRoot}`);
  }
  assertNotCanonical(abs);
  mkdirSync(resolve(abs, ".."), { recursive: true });
  writeFileAtomic(abs, ensureTrailingNewline(text));
}

// ── Capability guard ──────────────────────────────────────────────────────────

/** Strip the CLI-verb capability from the deps the harness threads downstream.
 *  The write/review instruments validate in-process; a verb call from anywhere
 *  under the migration conductor is a structural violation, not a fallback. */
export function withMigrationGuards(deps: AutopilotDeps): AutopilotDeps {
  return {
    ...deps,
    runVerb: async (args: string[]) => {
      throw new MigrationGuardError(
        `migration harness attempted CLI verb "${args[0] ?? ""}" — the experiment has no verb capability (no promotion, no repair, no publish, no compile)`,
      );
    },
  };
}

/** One-attempt discipline (prompt inst. 9): experiment writer calls must be
 *  first-write-only and must never carry complaint feedback. */
export function assertOneAttemptOpts(opts: { firstWriteOnly?: boolean; complaints?: string[] }): void {
  if (opts.firstWriteOnly !== true) {
    throw new MigrationGuardError("experiment sample must set firstWriteOnly — quality retries are disabled by design");
  }
  if (opts.complaints && opts.complaints.length > 0) {
    throw new MigrationGuardError("experiment sample carries complaint feedback — repair/complaint loops are disabled by design");
  }
}

// ── Blinding vocabulary ───────────────────────────────────────────────────────

/** Identity tokens that must never reach a reviewer in a migration experiment:
 *  the production forbidden set (model ids/slugs/tier words) plus stack ids,
 *  cell ids, stage vocabulary, and the experiment id itself. */
export function migrationForbiddenTokens(spec: ExperimentSpecV1): string[] {
  const pseudo = spec.cells.map((c) => ({ model: c.model, slug: modelSlug(c.model), slot: c.cellId, effort: c.effort }));
  const tokens = new Set<string>(forbiddenReviewTokens(pseudo));
  for (const s of spec.stacks) tokens.add(s.id.toLowerCase());
  for (const extra of ["legacy-v24", "sol-native", "migration-experiment", spec.experimentId.toLowerCase()]) tokens.add(extra);
  return [...tokens];
}
