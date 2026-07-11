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
import { migrationRoots } from "./guards.js";
import { runMigrationExperiment, type RunMigrationOptions } from "./runExperiment.js";
import type { ExperimentSpecV1, MigrationManifestV1, MigrationPhase } from "./experimentTypes.js";

const USAGE =
  `Usage: migration-bakeoff <plan|seal|qualify|run|analyze|decide|status>\n` +
  `         --experiment <spec.json | experimentId>\n` +
  `         [--corpus <corpus.json>] [--state-root <dir>] [--max-parallel 2]\n` +
  `         [--allow-synthetic-qualification] [--json]\n` +
  `       No-publish migration harness (Stage Q/D/C). Never promotes, never\n` +
  `       repairs, never touches canonical state; activation is IMP-13's package.`;

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

export async function runMigrationBakeoffCli(args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const json = flags["json"] === true;
  const subverb = args[0] ?? "";
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
