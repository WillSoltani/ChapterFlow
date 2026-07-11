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
