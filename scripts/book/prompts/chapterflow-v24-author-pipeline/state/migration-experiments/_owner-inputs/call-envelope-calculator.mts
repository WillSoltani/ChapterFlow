/** §16 sealed call-envelope calculator (frozen pre-live).
 *  Derives EXPECTED and SEALED-MAXIMUM live model-invocation counts from an
 *  experiment spec + the frozen code caps. Caps (verified at these sites):
 *   - writer: 1 attempt/sample (firstWriteOnly, authorRun.ts maxAttempts=1)
 *             + <=1 infra replay (spec.infraReplay.maxPerSample===1, never
 *             content/safeguard) => max 2 spawns/sample.
 *   - primary review (persist=true): phase-1 reader <=2 attempts
 *             (authorReview.ts:884) + phase-2 adjudication <=2 attempts
 *             (authorReview.ts:977) => expected 2, max 4 spawns/review.
 *   - agreement read: one per (cell x chapter) when judgePanel>1
 *             (sampleIndex 1), same per-read caps => expected 2, max 4.
 *   - Stage-Q Layer-N (persist=false: phase-1 only): expected 1, max 2 per
 *             (item x judge). Layer-O (owner instrument): expected 1, max 2
 *             per (case x judge) - runner caps attempts at 2.
 *  Usage: npx tsx call-envelope-calculator.mts <spec.json> <layerNItems> <layerOCases=64>
 */
import { readFileSync } from "node:fs";
const spec = JSON.parse(readFileSync(process.argv[2], "utf8"));
const layerN = Number(process.argv[3] ?? 0);
const layerO = Number(process.argv[4] ?? 64);
const chapters = spec.books.reduce((a: number, b: { chapters: unknown[] }) => a + b.chapters.length, 0);
const cells = spec.cells.length;
const judges = spec.judgePanel.length;
const screening = chapters * cells * spec.screening.samplesPerCell;
const full = chapters * cells * spec.samplesPerCell;
const agreePairs = judges > 1 ? chapters * cells : 0;
const exp = {
  writers: screening,
  primaryReviews: screening * 2,
  agreementReviews: agreePairs * 2,
  stageQ_layerO: layerO * judges,
  stageQ_layerN: layerN * judges,
};
const expansionDelta = { writers: full - screening, primaryReviews: (full - screening) * 2 };
const max = {
  writers: full * 2,
  primaryReviews: full * 4,
  agreementReviews: agreePairs * 4,
  stageQ_layerO: layerO * judges * 2,
  stageQ_layerN: layerN * judges * 2,
};
const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);
console.log(JSON.stringify({
  schema: "s16-call-envelope-v1",
  experimentId: spec.experimentId,
  design: { chapters, cells, judges, screeningSamples: screening, fullSamples: full, agreementPairs: agreePairs, layerNItems: layerN, layerOCases: layerO },
  expected: { ...exp, totalScreeningOnly: sum(exp), expansionDeltaIfFired: expansionDelta, totalIfExpanded: sum(exp) + sum(expansionDelta) },
  sealedMaximum: { ...max, TOTAL: sum(max) },
  enforcement: "schedule is sealed & finite; conductor never mints beyond it; expansion only via the frozen stopping rules evaluated ONCE; every per-spawn cap is code-pinned; 0 calls above sealedMaximum.TOTAL are possible without editing sealed files (which verifySealIntact/unblind hash-gates detect)",
}, null, 2));
