/** IMP-19 — Layer-N v2 LIVE native-review qualification driver.
 *
 *  Runs the SEALED Layer-N v2 qualification (the REAL two-phase reviewOneChapter
 *  path) over the owner-approved 28-item corpus, for each of the three frozen
 *  judges, SERIALLY, on the ChatGPT-authenticated codex-exec route only. No API,
 *  no fallback, no canonical writes.
 *
 *  Modes (PIPE):
 *    npx tsx state/migration-experiments/_owner-inputs/live-native-review-driver.mts preflight
 *      → run every pre-live check (seal integrity, Layer-O v3 freshness, corpus
 *        validation, envelope, env/route invariants) and PRINT the packet. NO spawn.
 *    npx tsx state/migration-experiments/_owner-inputs/live-native-review-driver.mts run
 *      → preflight, then run the live qualification (serial, <=216 reads).
 *
 *  Frozen policy (owner authorization 2026-07-11): serial (one live read at a
 *  time), fixed sealed schedule, frozen corpus/thresholds/judge panel, phase-1
 *  for every item + phase-2 for the frozen 8-item quiz subset, <=1 infra replay
 *  per call (reviewOneChapter's attempt<=2 loop — infra-class only), every attempt
 *  + route sidecar preserved, no canonical production writes.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { resolveDeps } from "../../../src/orchestrator/autopilot.js";
import { migrationRoots, withMigrationGuards } from "../../../src/bakeoff/migration/guards.js";
import { runNativeReviewQualification } from "../../../src/bakeoff/migration/nativeReviewRunner.js";
import {
  assertLayerOPrerequisiteFresh,
  buildNativeReviewInstrumentManifest,
  nativeReviewThresholdsSha256,
} from "../../../src/bakeoff/migration/nativeReviewSeal.js";
import {
  canonicalJson,
  nativeReviewCorpusSha256,
  nativeReviewInstrumentManifestSha256,
  validateNativeReviewCorpusV2,
} from "../../../src/bakeoff/migration/nativeReviewQualification.js";
import type {
  NativeReviewCorpusV2,
  NativeReviewQualificationV2,
  NativeReviewSealV2,
  NativeReviewThresholdsV2,
} from "../../../src/bakeoff/migration/nativeReviewTypes.js";
import type { JudgeSpec } from "../../../src/bakeoff/review.js";

const die = (m: string, code = 1): never => { console.error(`REFUSING: ${m}`); process.exit(code); };
const sha = (s: string): string => createHash("sha256").update(s).digest("hex");

// ── 1. Route / env invariants (identical guard to the live conductor) ─────────
const FORBIDDEN_ENV = ["OPENAI_API_KEY", "CODEX_API_KEY", "OPENAI_BASE_URL", "OPENAI_API_BASE", "ANTHROPIC_API_KEY"];
for (const k of FORBIDDEN_ENV) {
  if (process.env[k] !== undefined) die(`forbidden env var ${k} present — no metered API / fallback route may be reachable`);
}
if (process.env.CHAPTERFLOW_NO_API_CODEX_QC !== "1") die("CHAPTERFLOW_NO_API_CODEX_QC=1 required (subscription codex-exec route only)");

const mode = process.argv[2];
if (mode !== "preflight" && mode !== "run") {
  die("usage: live-native-review-driver.mts <preflight|run> [judgeSlug]", 2);
}
// Optional single-judge filter (e.g. "gpt-5.5@xhigh") — runs ONLY that judge,
// preserving any already-completed judges' evidence in the same experiment root.
// The seal integrity + schedule hashes still cover the FULL panel.
const judgeFilter = process.argv[3];

const OI = resolve("state/migration-experiments/_owner-inputs");
const EXPERIMENT_ID = "layer-n-v2-qualification";

// ── 2. Load sealed inputs ─────────────────────────────────────────────────────
const corpus = JSON.parse(readFileSync(`${OI}/stage-q/layer-n-v2-corpus.json`, "utf8")) as NativeReviewCorpusV2;
const thresholds = JSON.parse(readFileSync(`${OI}/native-review-thresholds.v2.json`, "utf8")) as NativeReviewThresholdsV2;
const seal = JSON.parse(readFileSync(`${OI}/stage-q/STAGE-Q-LAYER-N-V2-SEAL.json`, "utf8")) as NativeReviewSealV2;

// ── 3. Corpus validation (fail-closed BEFORE any spawn) ───────────────────────
const problems = validateNativeReviewCorpusV2(corpus);
if (problems.length) die(`corpus invalid:\n- ${problems.join("\n- ")}`);

// ── 4. Seal integrity: current code + inputs must EXACTLY match the seal ───────
const thresholdsSha256 = nativeReviewThresholdsSha256(thresholds);
const instrumentManifest = buildNativeReviewInstrumentManifest(thresholdsSha256);
const instrumentManifestSha256 = nativeReviewInstrumentManifestSha256(instrumentManifest);
const corpusSha256 = nativeReviewCorpusSha256(corpus);
const judgePanel: JudgeSpec[] = seal.judgePanel.map((j) => ({ model: j.model, effort: j.effort }));
const schedule = judgePanel.flatMap((j) => corpus.items.map((it) => ({ judge: `${j.model}@${j.effort}`, itemId: it.itemId, requiresPhase2: it.requiresPhase2 })));
const scheduleSha256 = sha(canonicalJson(schedule));

const drift: string[] = [];
if (corpusSha256 !== seal.corpusSha256) drift.push(`corpus ${corpusSha256.slice(0, 12)} != sealed ${seal.corpusSha256.slice(0, 12)}`);
if (instrumentManifestSha256 !== seal.instrumentManifestSha256) drift.push(`instrument ${instrumentManifestSha256.slice(0, 12)} != sealed ${seal.instrumentManifestSha256.slice(0, 12)}`);
if (thresholdsSha256 !== seal.thresholdsSha256) drift.push(`thresholds ${thresholdsSha256.slice(0, 12)} != sealed ${seal.thresholdsSha256.slice(0, 12)}`);
if (scheduleSha256 !== seal.scheduleSha256) drift.push(`schedule ${scheduleSha256.slice(0, 12)} != sealed ${seal.scheduleSha256.slice(0, 12)}`);
if (drift.length) die(`seal drift — the code/inputs no longer match the seal:\n- ${drift.join("\n- ")}`);

// ── 5. Layer-O v3 security prerequisite freshness (§1) ────────────────────────
try { assertLayerOPrerequisiteFresh(seal.layerOPrerequisite, OI); }
catch (err) { die(`Layer-O v3 prerequisite STALE: ${(err as Error).message}`); }

// ── 6. Envelope ───────────────────────────────────────────────────────────────
const items = corpus.items.length;
const judges = judgePanel.length;
const phase2Items = corpus.items.filter((i) => i.requiresPhase2).length;
const expectedCalls = items * judges + phase2Items * judges;
const maxCalls = expectedCalls * 2; // <=1 infra replay per call

console.log("=== Layer-N v2 PRE-LIVE CHECKS ===");
console.log("corpusId:", seal.corpusId, "| corpusSha256:", corpusSha256.slice(0, 12));
console.log("instrumentManifestSha256:", instrumentManifestSha256.slice(0, 12), "| thresholdsSha256:", thresholdsSha256.slice(0, 12), "| scheduleSha256:", scheduleSha256.slice(0, 12));
console.log("judgePanel:", judgePanel.map((j) => `${j.model}@${j.effort}`).join(", "));
console.log("Layer-O v3 prereq FRESH:", seal.layerOPrerequisite.qualificationOutcome, "| seal", seal.layerOPrerequisite.sealSha256.slice(0, 12), "| owner", seal.layerOPrerequisite.ownerAdjudicationOutcome);
console.log(`envelope: ${items} items x ${judges} judges = ${items * judges} phase-1 + ${phase2Items} quiz x ${judges} = ${phase2Items * judges} phase-2`);
console.log(`  EXPECTED live reads: ${expectedCalls}   SEALED MAX (<=1 infra replay/call): ${maxCalls}`);
console.log("route: codex_exec_chatgpt_subscription only | forbidden env absent | CHAPTERFLOW_NO_API_CODEX_QC=1");
console.log("ALL PRE-LIVE CHECKS PASSED.");

if (mode === "preflight") {
  console.log("\n[preflight] no spawn performed; no calls consumed. Re-run with `run` to execute the live qualification.");
  process.exit(0);
}

// ── 7. LIVE RUN (serial, real codex-exec deps) ────────────────────────────────
const deps = withMigrationGuards(resolveDeps(undefined));
const roots = migrationRoots(EXPERIMENT_ID);
console.log(`\n=== LIVE RUN — writing ONLY under ${roots.runRoot} (isolated, non-canonical) ===`);

const judgesToRun = judgeFilter
  ? judgePanel.filter((j) => `${j.model}@${j.effort}` === judgeFilter)
  : judgePanel;
if (judgeFilter && judgesToRun.length === 0) die(`judge filter '${judgeFilter}' matches no sealed panel judge (${judgePanel.map((j) => `${j.model}@${j.effort}`).join(", ")})`);
if (judgeFilter) console.log(`[single-judge run] ${judgeFilter} only — other judges' evidence in this experiment root is preserved.`);

const records: NativeReviewQualificationV2[] = [];
for (const judge of judgesToRun) {
  console.log(`\n--- judge ${judge.model}@${judge.effort} (serial) ---`);
  const q = await runNativeReviewQualification({
    corpus, judge, thresholds, instrumentManifest,
    layerOPrerequisite: seal.layerOPrerequisite,
    deps, roots, log: (m: string) => console.log(m),
  });
  records.push(q);
}

// A partial (single-judge) run does NOT produce a panel verdict — the per-judge
// qualification.json is the output; aggregate manually across all judges.
if (judgesToRun.length < judgePanel.length) {
  console.log(`\n=== SINGLE-JUDGE RUN COMPLETE (${records.map((r) => `${r.judge.model}@${r.judge.effort}=${r.qualified ? "QUALIFIED" : "NOT"}`).join(", ")}) — panel verdict deferred to manual aggregation ===`);
  process.exit(0);
}

// ── 8. Preliminary machine verdict (instrument-vs-judge classification is for
//       human adjudication on the preserved evidence — this is only a signal) ──
const allQualified = records.every((r) => r.qualified);
const hashesIntact = records.every((r) => r.corpusSha256 === seal.corpusSha256 && r.instrumentManifestSha256 === seal.instrumentManifestSha256 && r.thresholdsSha256 === seal.thresholdsSha256);
const unresolvedTotal = records.reduce((n, r) => n + r.metrics.unresolvedRequiredCases, 0);
const protocolFloor = Math.min(...records.map((r) => r.metrics.protocolValidityRate));

const verdict = !hashesIntact ? "INSTRUMENT_INVALID (hash drift during run)"
  : allQualified && unresolvedTotal === 0 ? "LAYER_N_V2_PASS"
  : protocolFloor < 0.5 ? "REVIEW: possible INSTRUMENT_INVALID (systematic low protocol validity)"
  : "REVIEW: LAYER_N_V2_JUDGE_NOT_QUALIFIED (instrument valid, >=1 judge missed a threshold)";

const summary = {
  schema: "s16-layer-n-v2-qualification-summary-v1",
  ranAt: new Date().toISOString(),
  sealId: seal.sealId,
  corpusSha256, instrumentManifestSha256, thresholdsSha256, scheduleSha256,
  layerOPrerequisite: seal.layerOPrerequisite,
  expectedCalls, maxCalls,
  judges: records.map((r) => ({
    judge: `${r.judge.model}@${r.judge.effort}`,
    qualified: r.qualified,
    metrics: r.metrics,
    securityStatus: r.securityStatus.status,
  })),
  preliminaryVerdict: verdict,
  note: "Machine verdict only. INSTRUMENT_INVALID vs JUDGE_NOT_QUALIFIED requires human adjudication on the preserved per-item evidence (evidence.json under the experiment root).",
};
const summaryPath = `${OI}/stage-q/LAYER-N-V2-QUALIFICATION-SUMMARY.json`;
writeFileSync(summaryPath, JSON.stringify(summary, null, 2) + "\n");
console.log(`\n=== PRELIMINARY VERDICT: ${verdict} ===`);
console.log("judges:", records.map((r) => `${r.judge.model}@${r.judge.effort}=${r.qualified ? "QUALIFIED" : "NOT"}`).join(", "));
console.log("WROTE", summaryPath);
