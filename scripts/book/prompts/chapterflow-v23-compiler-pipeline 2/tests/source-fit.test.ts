/**
 * source-fit — the advisory research-time fit classifier. Two guarantees: it does NOT cry wolf on
 * a varied, well-unitized book (calibrated to OK on the clean corpus — verified live), and it DOES
 * flag a monotonous/thin one (same few figures across chapters, thin illustrations, one framework
 * shell). The classifier core is pure, so these run on synthetic sidecars.
 */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import { computeSourceFitMetrics, classifySourceFit } from "../src/sourceFit.js";

function named(k: number): any[] {
  return Array.from({ length: k }, (_, i) => ({ label: `case-${i}`, realWorld: false, hardSpecifics: ["x"] }));
}
function facts(k: number): any[] {
  return Array.from({ length: k }, (_, i) => ({ id: `f${i}`, claim: `claim ${i}` }));
}
function chapter(n: number, o: { named?: number; facts?: number; figures?: string[]; framework?: string }): any {
  return {
    chapterNumber: n,
    namedExamples: named(o.named ?? 3),
    testableFacts: facts(o.facts ?? 4),
    properNouns: o.figures ?? [`Figure${n}A`, `Figure${n}B`],
    frameworks: o.framework ? [{ name: o.framework, members: ["a", "b"] }] : [{ name: `Framework ${n}`, members: ["a"] }],
  };
}

test("source-fit reads OK for a varied, well-unitized book (no cry-wolf)", () => {
  const sidecars = [1, 2, 3, 4, 5].map((n) => chapter(n, {}));
  const report = classifySourceFit("zz-varied", computeSourceFitMetrics(sidecars));
  assert.equal(report.verdict, "OK", `signals: ${report.signals.join(" | ")}`);
  assert.deepEqual(report.signals, []);
});

test("source-fit flags RISKY for a monotonous, thin book (same figure everywhere + one framework + thin)", () => {
  // Every chapter: one shared figure, a single illustration (thin), and the same framework shell.
  const sidecars = [1, 2, 3, 4, 5].map((n) =>
    chapter(n, { named: 1, figures: ["Aristotle"], framework: "Stoic Practice" }),
  );
  const report = classifySourceFit("zz-monotone", computeSourceFitMetrics(sidecars));
  assert.equal(report.verdict, "RISKY", `signals: ${report.signals.join(" | ")}`);
  const joined = report.signals.join("\n");
  assert.match(joined, /aristotle.*100%/i, "must flag the dominant figure");
  assert.match(joined, /< 2 named illustrations/i, "must flag thin chapters");
  assert.match(joined, /stoic practice.*recurs/i, "must flag the repeated framework shell");
});

test("computeSourceFitMetrics measures thin chapters and figure concentration correctly", () => {
  const sidecars = [
    chapter(1, { named: 1, figures: ["Marta"] }),
    chapter(2, { named: 3, figures: ["Marta"] }),
    chapter(3, { named: 3, figures: ["Marta", "Diego"] }),
  ];
  const m = computeSourceFitMetrics(sidecars);
  assert.deepEqual(m.thinChapters, [1], "only ch1 (<2 named) is thin");
  const marta = m.topFigures.find((f) => f.figure === "marta")!;
  assert.equal(marta.chapters, 3);
  assert.equal(marta.pct, 1, "Marta appears in 3/3 chapters");
});
