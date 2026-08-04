/** Validation ONLY (no model): re-score the preserved judge-1 (gpt-5.5@high)
 *  reviews from the buggy-scorer run with the FIXED v2.2 scorer, to confirm the
 *  INSTRUMENT_INVALID fix credits all 8 hard-blockers and does not regress others.
 *  This is NOT the official sealed result (that needs a fresh rerun under the new
 *  seal) — it only checks the scorer fix against real reviews. */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import { scoreNativeReviewJudge, qualifyNativeReviewJudge, type NativeReviewRead } from "../../../src/bakeoff/migration/nativeReviewQualification.js";
import type { NativeReviewCorpusV2, NativeReviewThresholdsV2 } from "../../../src/bakeoff/migration/nativeReviewTypes.js";

const OI = "state/migration-experiments/_owner-inputs";
const J1DIR = resolve("state/migration-experiments/layer-n-v2-qualification/native-review-v2/gpt-5-5-high");
const corpus = JSON.parse(readFileSync(`${OI}/stage-q/layer-n-v2-corpus.json`, "utf8")) as NativeReviewCorpusV2;
const thresholds = JSON.parse(readFileSync(`${OI}/native-review-thresholds.v2.json`, "utf8")) as NativeReviewThresholdsV2;

const reads = new Map<string, NativeReviewRead>();
for (const itemId of readdirSync(J1DIR)) {
  const ev = `${J1DIR}/${itemId}/evidence.json`;
  if (!existsSync(ev)) continue;
  const e = JSON.parse(readFileSync(ev, "utf8")) as { itemId: string; parsedReview: unknown; rawFinalMessage: string | null };
  reads.set(e.itemId, { itemId: e.itemId, review: e.parsedReview as never, rawFinalMessage: e.rawFinalMessage });
}
console.log(`loaded ${reads.size} preserved judge-1 reviews`);

const { metrics, perCase } = scoreNativeReviewJudge(corpus.items, reads);
const { qualified, checks } = qualifyNativeReviewJudge(metrics, thresholds);

console.log("\n=== FIXED-scorer re-score of judge-1 (gpt-5.5@high) ===");
console.log("hardBlockerSensitivity:", metrics.hardBlockerSensitivity.toFixed(3), "(threshold 1.00)");
console.log("quizKeyMismatchDetectionRate:", metrics.quizKeyMismatchDetectionRate.toFixed(3));
console.log("quizAmbiguityDetectionRate:", metrics.quizAmbiguityDetectionRate.toFixed(3));
console.log("cleanPassRate:", metrics.cleanPassRate.toFixed(3));
console.log("nonBlockerCalibrationRate:", metrics.nonBlockerCalibrationRate.toFixed(3));
console.log("observableDefectSensitivity:", metrics.observableDefectSensitivity.toFixed(3));
console.log("protocolValidityRate:", metrics.protocolValidityRate.toFixed(3));
console.log("quoteEvidenceValidityRate:", metrics.quoteEvidenceValidityRate.toFixed(3));
console.log("pairedDirectionalityRate (separate ship-block metric):", metrics.pairedDirectionalityRate.toFixed(3));
console.log("unresolvedRequiredCases:", metrics.unresolvedRequiredCases);
console.log("securityBoundaryPreservationRate:", metrics.securityBoundaryPreservationRate, "| successfulInjectionTakeovers:", metrics.successfulInjectionTakeovers);
console.log("\nFAILING checks:", checks.filter((c) => !c.pass).map((c) => `${c.id}=${c.observed}`).join(", ") || "(none)");
console.log("QUALIFIED (fixed scorer, old reviews):", qualified);

console.log("\n=== hard-blocker per-item (fixed) ===");
for (const p of perCase.filter((x) => x.kind === "reader-visible-hard-blocker")) {
  console.log(`  ${p.detected ? "DET " : "MISS"} ${p.itemId.replace("hardblocker-", "")}  — ${p.note}`);
}
