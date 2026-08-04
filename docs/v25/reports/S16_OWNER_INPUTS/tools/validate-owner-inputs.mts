/**
 * §16 owner-input validator — one command per input file.
 *
 *   cd scripts/book/prompts/chapterflow-v24-author-pipeline
 *   npx tsx ../../../../docs/v25/reports/S16_OWNER_INPUTS/tools/validate-owner-inputs.mts c1 <corpus.json>
 *   npx tsx ../../../../docs/v25/reports/S16_OWNER_INPUTS/tools/validate-owner-inputs.mts c3 <human-adjudication.json>
 *   npx tsx ../../../../docs/v25/reports/S16_OWNER_INPUTS/tools/validate-owner-inputs.mts c4 <thresholds.json>
 *   npx tsx ../../../../docs/v25/reports/S16_OWNER_INPUTS/tools/validate-owner-inputs.mts spec <experiment-spec.json>
 *
 * Read-only: parses and validates with the SAME pipeline validators the seal
 * uses; never writes. Exit 0 = valid (for c1, additionally reports whether the
 * corpus is human-labeled — synthetic labels force dryRunOnly at qualification).
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const PIPE = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../..", "scripts/book/prompts/chapterflow-v24-author-pipeline");
const [, , kind, file] = process.argv;
if (!kind || !file) {
  console.error("usage: validate-owner-inputs.mts <c1|c3|c4|spec> <file.json>");
  process.exit(2);
}
const bytes = readFileSync(resolve(file), "utf8");
let problems: string[] = [];

if (kind === "c1") {
  const { validateQualCorpus } = await import(`${PIPE}/src/bakeoff/migration/qualification.js`);
  const corpus = JSON.parse(bytes);
  // Structural validation ([] = no experiment-identity tokens yet): the
  // qualify phase re-validates with the sealed experiment's real forbidden
  // token list (stack ids, experiment id, "legacy-v24", …) for blinding.
  problems = validateQualCorpus(corpus, []);
  const synthetic = (corpus.items ?? []).filter((i: { labelProvenance: string }) => i.labelProvenance !== "human").length;
  console.log(`items: ${(corpus.items ?? []).length}; synthetic-labeled: ${synthetic}`);
  if (synthetic > 0) console.log("NOTE: any synthetic-labeled item ⇒ qualification is dryRunOnly ⇒ the live review phase REFUSES it.");
} else if (kind === "c3") {
  const adj = JSON.parse(bytes);
  if (adj.schema !== "migration-human-adjudication-v1") problems.push('schema must be "migration-human-adjudication-v1"');
  if (typeof adj.perCell !== "object" || adj.perCell === null) problems.push("perCell object is required");
  const KEYS = ["sourcedFabrication", "sourceFramingAmbiguity", "quizKeyOrMechanism", "causalOverreach", "exactLeakageOrClone"];
  for (const [cell, counts] of Object.entries(adj.perCell ?? {})) {
    for (const [k, v] of Object.entries(counts as Record<string, unknown>)) {
      if (k.startsWith("_")) continue; // annotation keys are ignored by the harness
      if (!KEYS.includes(k)) problems.push(`perCell["${cell}"].${k} is not a recognized count field`);
      else if (typeof v !== "number" || v < 0 || !Number.isInteger(v)) problems.push(`perCell["${cell}"].${k} must be a non-negative integer (upheld count)`);
    }
  }
  if (adj.highSeverityHumanReviewComplete !== undefined && typeof adj.highSeverityHumanReviewComplete !== "boolean") {
    problems.push("highSeverityHumanReviewComplete must be boolean when present");
  }
  if (adj.highSeverityHumanReviewComplete !== true) {
    console.log("NOTE: highSeverityHumanReviewComplete !== true ⇒ threshold group T8's human-review-complete input stays unmet (INCONCLUSIVE direction).");
  }
} else if (kind === "c4") {
  const { validateThresholds } = await import(`${PIPE}/src/bakeoff/migration/thresholds.js`);
  problems = validateThresholds(bytes);
  const t = JSON.parse(bytes);
  if (t.economics?.maxCostPerAcceptedChapterUsd === null && t.economics?.maxLatencyP95Ms === null) {
    console.log("NOTE: both economics bounds are null ⇒ T10 passes as 'no bound declared' (the ONLY group that passes on missing data — see C5).");
  }
} else if (kind === "spec") {
  const { validateExperimentSpec } = await import(`${PIPE}/src/bakeoff/migration/spec.js`);
  problems = validateExperimentSpec(JSON.parse(bytes));
} else {
  console.error(`unknown kind "${kind}"`);
  process.exit(2);
}

if (problems.length === 0) {
  console.log(`${kind.toUpperCase()} VALID: ${file}`);
} else {
  console.log(`${kind.toUpperCase()} INVALID (${problems.length}):`);
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}
