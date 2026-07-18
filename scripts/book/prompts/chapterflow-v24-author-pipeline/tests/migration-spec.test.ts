/**
 * IMP-11 — experiment spec validation, deterministic blocked scheduling, the
 * seal, and drift detection (tuning a sealed experiment is impossible).
 */

import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { test } from "./harness.js";
import { pipelineRel } from "../src/bakeoff/paths.js";
import { migrationRoots } from "../src/bakeoff/migration/guards.js";
import { buildSampleSchedule } from "../src/bakeoff/migration/schedule.js";
import { sealExperiment, SealError, validateExperimentSpec, verifySealIntact } from "../src/bakeoff/migration/spec.js";
import { confirmatorySpec, mkSealFixture, mkSnapshotStackDir } from "./migration-helpers.js";
import { tmpRoot } from "./model-bakeoff-helpers.js";

test("spec validation: the confirmatory design is exactly the four cells, ≥2 books, all four strata, honest replay rules", () => {
  assert.deepEqual(validateExperimentSpec(confirmatorySpec()), []);

  const oneBook = validateExperimentSpec(confirmatorySpec({ books: [confirmatorySpec().books[0]] }));
  assert.ok(oneBook.some((p) => p.includes("two books")), "confirmatory needs ≥2 books");
  assert.ok(oneBook.some((p) => p.includes("stratum")), "dropping a book also drops strata coverage");

  const wrongCells = validateExperimentSpec(confirmatorySpec({
    cells: confirmatorySpec().cells.map((c) => (c.cellId === "56S-H" ? { ...c, effort: "xhigh" as const } : c)),
  }));
  assert.ok(wrongCells.some((p) => p.includes("56S-H must be gpt-5.6-sol @ high")));

  const twoStacks = validateExperimentSpec(confirmatorySpec({
    stacks: [{ id: "sol-native-v25", source: "current-builders" }, { id: "legacy", source: "current-builders" }],
    cells: confirmatorySpec().cells.map((c, i) => (i === 0 ? { ...c, stackId: "legacy" } : c)),
  }));
  assert.ok(twoStacks.some((p) => p.includes("ONE final stack")), "confirmatory compares model/effort only");

  const badReplay = validateExperimentSpec(confirmatorySpec({
    infraReplay: { maxPerSample: 1, replayableOutcomes: ["provider_safeguard_or_refusal"] },
  }));
  assert.ok(badReplay.some((p) => p.includes("NEVER replayable")), "safeguard/refusal can never be replayed");

  const noPrice = validateExperimentSpec(confirmatorySpec({ priceSnapshot: { "gpt-5.5": null } }));
  assert.ok(noPrice.some((p) => p.includes("priceSnapshot has no entry for gpt-5.6-sol")));

  const badScreen = validateExperimentSpec(confirmatorySpec({ screening: { samplesPerCell: 1, expandWhen: [], maxSamplesPerCell: 2 } }));
  assert.ok(badScreen.some((p) => p.includes("expandWhen")), "screening below the max requires frozen expansion rules");
});

test("diagnostic validation requires the minimum legacy-vs-SOL factorial on BOTH stacks", () => {
  const diag = confirmatorySpec({
    stage: "diagnostic",
    cells: [
      { cellId: "55XH-L", model: "gpt-5.5", effort: "xhigh", stackId: "legacy-v24" },
      { cellId: "55XH-S", model: "gpt-5.5", effort: "xhigh", stackId: "sol-native-v25" },
      { cellId: "56H-L", model: "gpt-5.6-sol", effort: "high", stackId: "legacy-v24" },
      { cellId: "56H-S", model: "gpt-5.6-sol", effort: "high", stackId: "sol-native-v25" },
      { cellId: "56XH-L", model: "gpt-5.6-sol", effort: "xhigh", stackId: "legacy-v24" },
      { cellId: "56XH-S", model: "gpt-5.6-sol", effort: "xhigh", stackId: "sol-native-v25" },
    ],
    stacks: [
      { id: "legacy-v24", source: "snapshot", snapshotDirRelPath: "irrelevant-for-validation", combinedSha256: "0".repeat(64) },
      { id: "sol-native-v25", source: "current-builders" },
    ],
  });
  assert.deepEqual(validateExperimentSpec(diag), []);
  const missingCell = validateExperimentSpec({ ...diag, cells: diag.cells.slice(0, 5) });
  assert.ok(missingCell.some((p) => p.includes("requires gpt-5.6-sol @ xhigh on stack sol-native-v25")));
});

test("schedule: pure function of the sealed spec — same seed byte-identical, blocked by (book, chapter), expansion flagged, ids opaque", () => {
  const spec = confirmatorySpec({ samplesPerCell: 3, screening: { samplesPerCell: 2, expandWhen: ["expand-if-any-sol-cell-screens-clean"], maxSamplesPerCell: 3 } });
  const a = buildSampleSchedule(spec);
  const b = buildSampleSchedule(spec);
  assert.deepEqual(a, b, "same seed → identical schedule");
  const c = buildSampleSchedule({ ...spec, randomizationSeed: "seed-2" });
  assert.notDeepEqual(a.entries.map((e) => e.blindSampleId), c.entries.map((e) => e.blindSampleId), "a different seed re-randomizes");

  assert.equal(a.entries.length, 4 * 4 * 3, "cells × chapters × samples");
  const byBlock = new Map<string, number[]>();
  for (const e of a.entries) {
    const k = `${e.bookId}:${e.chapterNumber}`;
    byBlock.set(k, [...(byBlock.get(k) ?? []), e.executionOrder]);
  }
  for (const [k, orders] of byBlock) {
    const sorted = [...orders].sort((x, y) => x - y);
    assert.equal(sorted[sorted.length - 1] - sorted[0], orders.length - 1, `block ${k} occupies a contiguous execution range`);
  }
  for (const e of a.entries) {
    assert.equal(e.expansion, e.sampleIndex > 2, "samples beyond the screening subset are expansion entries");
    assert.match(e.blindSampleId, /^[0-9a-f]{12}$/, "blind ids are opaque hashes");
  }
});

test("seal freezes spec/thresholds/schedule/books/stacks/instruments; verifySealIntact reports every drift class", () => {
  const fx = mkSealFixture("cf-mig-seal-");
  const sealed = sealExperiment(fx.specPath, fx.roots, fx.deps);
  assert.equal(sealed.books.length, 2);
  assert.equal(sealed.books[0].totalChapters, 3, "totalChapters is the BOOK INDEX length, not the subset size");
  assert.equal(Object.keys(sealed.stacks[0].cardTemplateSha256).length, 4, "one card template hash per (book, chapter)");
  assert.ok(sealed.instruments.readerRubricVersion.length > 0 && sealed.instruments.contractManifestSha256.length === 64);
  assert.deepEqual(verifySealIntact(fx.roots, fx.deps), [], "freshly sealed = intact");

  // (a) frozen shared input drifts on disk.
  writeFileSync(fx.frozenInputAbs, JSON.stringify({ frozen: "tampered" }) + "\n");
  let drift = verifySealIntact(fx.roots, fx.deps);
  assert.ok(drift.some((d) => d.includes("frozen input drifted")), `input drift detected: ${drift.join(" | ")}`);
  writeFileSync(fx.frozenInputAbs, JSON.stringify({ frozen: true }) + "\n");
  assert.deepEqual(verifySealIntact(fx.roots, fx.deps), []);

  // (b) the CURRENT card builders drift (prompt-stack change after seal).
  drift = verifySealIntact(fx.roots, { ...fx.deps, renderCurrentCard: () => "A DIFFERENT CARD" });
  assert.ok(drift.some((d) => d.includes("card template drifted")), "builder drift is a condition change");

  // (c) sealed thresholds copy is tampered — thresholds cannot change post-seal.
  const original = readFileSync(fx.roots.thresholdsCopyPath, "utf8");
  writeFileSync(fx.roots.thresholdsCopyPath, original.replace("75", "50"));
  drift = verifySealIntact(fx.roots, fx.deps);
  assert.ok(drift.some((d) => d.includes("thresholds copy drifted")), "a relaxed threshold no longer matches its seal");
});

test("seal refuses: chapters outside the index and snapshot stacks that do not hash to their declared pin", () => {
  const fx = mkSealFixture("cf-mig-seal-refuse-");
  assert.throws(
    () => sealExperiment(fx.specPath, migrationRoots("exp-oob", tmpRoot("cf-mig-oob-")), { ...fx.deps, expectedChapterNumbers: () => [1] }),
    /chapters not in the index/,
  );

  const tmp = tmpRoot("cf-mig-snap-");
  const snap = mkSnapshotStackDir(tmp, [
    { bookId: "zz-mig-book-a", n: 1 }, { bookId: "zz-mig-book-a", n: 2 },
    { bookId: "zz-mig-book-b", n: 1 }, { bookId: "zz-mig-book-b", n: 2 },
  ]);
  const spec = confirmatorySpec({
    experimentId: "exp-snap",
    thresholdsRelPath: fx.spec.thresholdsRelPath,
    stacks: [{ id: "sol-native-v25", source: "snapshot", snapshotDirRelPath: snap.relPath, combinedSha256: "0".repeat(64) }],
  });
  const specPath = join(tmp, "spec.json");
  writeFileSync(specPath, JSON.stringify(spec, null, 2) + "\n");
  assert.throws(
    () => sealExperiment(specPath, migrationRoots("exp-snap", join(tmp, "state")), fx.deps),
    (err: Error) => err instanceof SealError && /refusing to seal a drifted stack/.test(err.message),
  );
});
