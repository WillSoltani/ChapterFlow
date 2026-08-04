/** IMP-19 — Layer-N v2 PRE-LIVE seal driver (NO model calls, NO canonical writes).
 *  Freezes the full-semantic corpus hash + instrument manifest + thresholds +
 *  schedule + judge panel into a NativeReviewSealV2, and reports the call
 *  envelope. Owner reviews the seal before authorizing any live qualification. */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { canonicalJson, validateNativeReviewCorpusV2 } from "../../../src/bakeoff/migration/nativeReviewQualification.js";
import { sealNativeReview, buildNativeReviewInstrumentManifest, nativeReviewThresholdsSha256 } from "../../../src/bakeoff/migration/nativeReviewSeal.js";
import type { NativeReviewCorpusV2, NativeReviewThresholdsV2 } from "../../../src/bakeoff/migration/nativeReviewTypes.js";
import type { JudgeSpec } from "../../../src/bakeoff/review.js";

const OI = "state/migration-experiments/_owner-inputs";
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

const corpus = JSON.parse(readFileSync(`${OI}/stage-q/layer-n-v2-corpus.json`, "utf8")) as NativeReviewCorpusV2;
const thresholds = JSON.parse(readFileSync(`${OI}/native-review-thresholds.v2.json`, "utf8")) as NativeReviewThresholdsV2;

const problems = validateNativeReviewCorpusV2(corpus);
if (problems.length) { console.error("REFUSING TO SEAL — corpus invalid:\n- " + problems.join("\n- ")); process.exit(1); }

// The same panel as Stage-Q Layer-O v3 / the diagnostic (blinding preserved).
const judgePanel: JudgeSpec[] = [
  { model: "gpt-5.5", effort: "high" },
  { model: "gpt-5.6-sol", effort: "high" },
  { model: "gpt-5.5", effort: "xhigh" },
];

// Deterministic serial schedule: each judge over the corpus in item order.
const schedule = judgePanel.flatMap((j) => corpus.items.map((it) => ({ judge: `${j.model}@${j.effort}`, itemId: it.itemId, requiresPhase2: it.requiresPhase2 })));
const scheduleSha256 = sha(canonicalJson(schedule));

const { seal, instrumentManifest } = sealNativeReview({
  corpus, thresholds, judgePanel, scheduleSha256,
  sealId: "layer-n-v2-2026-07-11",
  sealedAt: "2026-07-11T00:00:00.000Z",
  ownerInputsDir: resolve(OI),
});

writeFileSync(`${OI}/stage-q/STAGE-Q-LAYER-N-V2-SEAL.json`, JSON.stringify(seal, null, 2) + "\n");
writeFileSync(`${OI}/stage-q/STAGE-Q-LAYER-N-V2-INSTRUMENT-MANIFEST.json`, JSON.stringify(instrumentManifest, null, 2) + "\n");

// Call envelope.
const items = corpus.items.length;
const judges = judgePanel.length;
const phase2Items = corpus.items.filter((i) => i.requiresPhase2).length;
const expected = items * judges + phase2Items * judges; // 1 phase-1 + (phase-2 on quiz subset)
const max = items * judges * 2 + phase2Items * judges * 2; // <=2 attempts each

console.log("=== Layer-N v2 seal (pre-live) ===");
console.log("corpusId:", seal.corpusId);
console.log("corpusSha256:", seal.corpusSha256);
console.log("instrumentManifestSha256:", seal.instrumentManifestSha256);
console.log("thresholdsSha256:", seal.thresholdsSha256, "(check:", nativeReviewThresholdsSha256(thresholds).slice(0, 12) + ")");
console.log("scheduleSha256:", seal.scheduleSha256);
console.log("judgePanel:", seal.judgePanel.map((j) => `${j.model}@${j.effort}`).join(", "));
console.log("layerO prereq: seal", seal.layerOPrerequisite.sealSha256.slice(0, 12), "| result", seal.layerOPrerequisite.qualificationResultSha256.slice(0, 12), "| outcome", seal.layerOPrerequisite.qualificationOutcome, "| owner", seal.layerOPrerequisite.ownerAdjudicationOutcome);
console.log(`\ncall envelope: ${items} items x ${judges} judges = ${items * judges} phase-1; +${phase2Items} quiz x ${judges} = ${phase2Items * judges} phase-2`);
console.log(`  EXPECTED live reads: ${expected}   SEALED MAX (<=2 attempts): ${max}`);
console.log("WROTE STAGE-Q-LAYER-N-V2-SEAL.json + STAGE-Q-LAYER-N-V2-INSTRUMENT-MANIFEST.json");
