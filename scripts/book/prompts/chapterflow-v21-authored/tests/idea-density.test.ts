/**
 * Idea density (E9 / #12, "over-length / low idea-density") — the REFUTATION PIN.
 *
 * Finding #12 proposed a deterministic gate: fire below a distinct-content-lemma-per-1000-
 * chars floor. This suite is the executable record that NO such floor can ship: across five
 * formulations the real reference books (daring-greatly + start-with-why) sit AT or BELOW the
 * only available defect source (the reverted tiny-habits regen). A floor catching the defect
 * fires HARDER on the gold corpus — the exact "fires on the clean book" trap the calibration
 * law (#2) forbids (cf. the dropped E8 CoefVar arm, the reverted SC9 blocker). So instead of a
 * gate the deterministic half ships PREVENTION (STEP-2 R9 + writer-breakdown) and delegates the
 * JUDGMENT to the `prose_coherence` semantic bar axis (FAILURE-MODES `MB4`, the WT-E clause).
 *
 * These tests fail if a future change makes the lexical measure SEPARATE the defect from the
 * gold — at which point the gate becomes derivable and this pin should be promoted to a real
 * detector. Until then they stop the gate being re-added blind. See critics/prose.ts.
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "fs";
import { resolve } from "path";

import { test, skip } from "./harness.js";
import { goldChapterFiles, STATE_CHAPTERS } from "./helpers.js";
import { REGEN_FIXTURE_PATH } from "./fixtures/regressions.js";
import { measureIdeaDensity } from "../src/critics/prose.js";
import type { ChapterV21 } from "../src/types.js";

function tierTexts(ch: ChapterV21): string[] {
  const b = ch.breakdown ?? ({} as any);
  return (["fastRead", "deepRead", "fullRead"] as const)
    .map((t) => (b as any)[t])
    .filter((s): s is string => typeof s === "string" && s.length > 0);
}

function densitiesFromFiles(files: string[]): ReturnType<typeof measureIdeaDensity>[] {
  const out: ReturnType<typeof measureIdeaDensity>[] = [];
  for (const f of files) {
    const ch = JSON.parse(readFileSync(f, "utf8")) as ChapterV21;
    for (const text of tierTexts(ch)) out.push(measureIdeaDensity(text));
  }
  return out;
}

function regenDensities(): ReturnType<typeof measureIdeaDensity>[] {
  const pkg = JSON.parse(readFileSync(REGEN_FIXTURE_PATH, "utf8")) as { chapters: ChapterV21[] };
  return pkg.chapters.flatMap((ch) => tierTexts(ch).map((t) => measureIdeaDensity(t)));
}

const min = (xs: number[]) => Math.min(...xs);
const max = (xs: number[]) => Math.max(...xs);
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor((xs.length - 1) / 2)];

// ── (a) the measure's SEMANTICS are correct (always-present, CI-safe) ─────────
// Lock the direction so the refutation below is about the corpus, not a broken metric:
// a tier that restates one idea to pad length must read LOWER-density / MORE-stale than a
// tier that keeps introducing new ideas across the same span.

const PADDED =
  "The morning check protects the ledger. The morning check protects the ledger from drift. " +
  "Protecting the ledger each morning is what the morning check does. The morning check, done each " +
  "morning, protects the ledger from drift. Each morning the check protects the ledger. The morning " +
  "ledger check protects against drift. The check, run every morning, protects the ledger from drift again.";

const DENSE =
  "Rina opens the intake desk and spots a mismatched invoice. She traces the timestamp to a vendor " +
  "rebate nobody logged. Quin, downstream, would have shipped it to billing by noon. A single stale " +
  "figure becomes a customer promise, then a training instruction, then a quarterly forecast. The fix " +
  "costs four minutes at the source; the cleanup costs a week once the error reaches the warehouse.";

test("idea density: a padded tier reads less dense and more stale than a varied tier", () => {
  const padded = measureIdeaDensity(PADDED);
  const dense = measureIdeaDensity(DENSE);
  assert.ok(
    padded.typeTokenRatio < dense.typeTokenRatio,
    `padding should lower type-token ratio (padded ${padded.typeTokenRatio.toFixed(3)} vs dense ${dense.typeTokenRatio.toFixed(3)})`,
  );
  assert.ok(
    padded.staleSentenceFraction > dense.staleSentenceFraction,
    `padding should raise the stale-sentence fraction (padded ${padded.staleSentenceFraction.toFixed(3)} vs dense ${dense.staleSentenceFraction.toFixed(3)})`,
  );
});

// ── (b) overlap on the always-present corpora (CI-safe) ───────────────────────
// Even with only the synthetic gold available, the lemma-density ranges of the defect and
// the gold OVERLAP — so no single floor cleanly separates them. (The strong pin, below,
// uses the real gold where the overlap becomes outright inversion.)

test("idea density: regen defect and synthetic-gold lemma-density ranges OVERLAP (no clean floor)", () => {
  const regen = regenDensities().map((d) => d.lemmaDensityPerKchar);
  const synthGold = densitiesFromFiles(goldChapterFiles().flatMap((g) => g.files)).map((d) => d.lemmaDensityPerKchar);
  // Intervals [min,max] intersect ⇒ ∃ no threshold with every-defect < F ≤ every-gold.
  assert.ok(
    max(regen) >= min(synthGold) && min(regen) <= max(synthGold),
    `expected overlapping ranges; regen [${min(regen).toFixed(1)}, ${max(regen).toFixed(1)}] vs synthetic gold [${min(synthGold).toFixed(1)}, ${max(synthGold).toFixed(1)}]`,
  );
});

// ── (c) the STRONG refutation pin — real gold sits AT or BELOW the defect ──────
// Present on authoring machines, ABSENT in CI: guard + skip so a clean checkout never fails.

function goldFilesFor(bookId: string): string[] {
  return existsSync(STATE_CHAPTERS)
    ? readdirSync(STATE_CHAPTERS)
        .filter((f) => f.startsWith(`${bookId}-ch`) && f.endsWith(".v21-native.chapter.json"))
        .map((f) => resolve(STATE_CHAPTERS, f))
    : [];
}

// PRIMARY metric (the floor the finding actually proposed): refuted by EACH book on its own —
// every real reference book reaches at or below the defect's MEDIAN lemma-density, so a floor
// placed to catch the bulk of the defect fires on reference prose.
for (const bookId of ["daring-greatly", "start-with-why"]) {
  const files = goldFilesFor(bookId);
  if (files.length === 0) {
    skip(`idea density refutation (lemma-density floor): ${bookId}`, `no ${bookId} chapters in state/chapters/ on this machine`);
    continue;
  }
  test(`idea density: a lemma-density floor cannot separate the defect from real gold ${bookId} (${files.length} ch)`, () => {
    const goldMin = min(densitiesFromFiles(files).map((d) => d.lemmaDensityPerKchar));
    const regenMedian = median(regenDensities().map((d) => d.lemmaDensityPerKchar));
    assert.ok(
      goldMin <= regenMedian,
      `${bookId}: a lemma-density floor would now separate (gold min ${goldMin.toFixed(1)} > regen median ${regenMedian.toFixed(1)}). The gate may be derivable — promote this pin to a real E9 detector and register it shadow-minor.`,
    );
  });
}

// SECONDARY formulations: refuted by the POOLED gold corpus — type-token ratio dips at/below
// the defect minimum (via daring-greatly) and the stale-sentence fraction runs at/above the
// defect maximum (via start-with-why). No single one fences the defect off.
{
  const files = [...goldFilesFor("daring-greatly"), ...goldFilesFor("start-with-why")];
  if (files.length === 0) {
    skip("idea density refutation (ttr + stale formulations)", "no real gold chapters in state/chapters/ on this machine");
  } else {
    test(`idea density: neither type-token-ratio nor stale-fraction separates the defect from the pooled gold (${files.length} ch)`, () => {
      const gold = densitiesFromFiles(files);
      const regen = regenDensities();
      assert.ok(
        min(gold.map((d) => d.typeTokenRatio)) <= min(regen.map((d) => d.typeTokenRatio)) + 1e-9,
        `a type-token-ratio floor would separate (pooled gold min ${min(gold.map((d) => d.typeTokenRatio)).toFixed(3)} > regen min ${min(regen.map((d) => d.typeTokenRatio)).toFixed(3)}).`,
      );
      assert.ok(
        max(gold.map((d) => d.staleSentenceFraction)) >= max(regen.map((d) => d.staleSentenceFraction)) - 1e-9,
        `a stale-fraction ceiling would separate (pooled gold max ${max(gold.map((d) => d.staleSentenceFraction)).toFixed(3)} < regen max ${max(regen.map((d) => d.staleSentenceFraction)).toFixed(3)}).`,
      );
    });
  }
}
