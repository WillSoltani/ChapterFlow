/**
 * WP-702 — static guard: the model bake-off PRIMARY judge path carries NO gpt-5.5
 * model literal and NO BASELINE_MODEL judge reference in executable code.
 *
 * Scope: the top-level `src/bakeoff/*.ts` files — the bake-off conductor, the D7
 * primary judge, the selection hierarchy, the advisory-review lane, and the
 * report. The `src/bakeoff/migration/**` subtree is DELIBERATELY excluded: it is
 * the D7 instrument + the historical migration experiments, whose frozen
 * historical-identity sites are allowlisted by the WP-501 forbidden-model gate and
 * must not be disturbed. This guard is about the JUDGE DEFAULT the bake-off wires,
 * which lives only in the top-level files.
 *
 * "no gpt-5.5 model literal" = the MODEL-ID shapes (gpt-5.5 / gpt-5-5 / gpt55 …).
 * A bare "5.5" inside a prose comment or an error string that DOCUMENTS the
 * prohibition ("the prior 5.5 baseline is void") is the established safe idiom and
 * is intentionally allowed — it is not a model literal and wires nothing.
 */

import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import { test } from "./harness.js";
import { PIPELINE_DIR } from "../src/bakeoff/paths.js";
import { D7_SELECTION_BAND } from "../src/bakeoff/d7Judge.js";
import { BAKEOFF_NOISE_BAND } from "../src/bakeoff/review.js";

const BAKEOFF_DIR = resolve(PIPELINE_DIR, "src/bakeoff");

/** The top-level bake-off source files (NOT the migration/ instrument subtree). */
function topLevelBakeoffFiles(): string[] {
  return readdirSync(BAKEOFF_DIR)
    .filter((f) => f.endsWith(".ts"))
    .map((f) => resolve(BAKEOFF_DIR, f));
}

/** Strip line + block comments so the assertion sees EXECUTABLE code only (a
 *  prose comment documenting the 5.5 prohibition is the safe idiom, not a wire). */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

/** gpt-5.5 model-id shapes (never a bare "5.5"). */
const GPT_55_MODEL_LITERAL = /\bgpt[-_]?5[._-]?5\b|\bgpt[-_]?55\b/i;

test("no top-level src/bakeoff file names a gpt-5.5 model literal in executable code", () => {
  for (const file of topLevelBakeoffFiles()) {
    const code = stripComments(readFileSync(file, "utf8"));
    assert.ok(
      !GPT_55_MODEL_LITERAL.test(code),
      `${file} contains a gpt-5.5 model literal in executable code — the bake-off judge is the Claude-side D7 instrument, never gpt-5.5`,
    );
  }
});

test("no top-level src/bakeoff file references BASELINE_MODEL in executable code (the judge never inherits the writer/baseline)", () => {
  for (const file of topLevelBakeoffFiles()) {
    const code = stripComments(readFileSync(file, "utf8"));
    assert.ok(
      !/\bBASELINE_MODEL\b/.test(code),
      `${file} references BASELINE_MODEL in executable code — the judge default must not inherit the baseline/writer model`,
    );
  }
});

test("runBakeoff wires no DEFAULT_JUDGE_MODEL constant bound to BASELINE_MODEL (it was removed)", () => {
  const runBakeoff = stripComments(readFileSync(resolve(BAKEOFF_DIR, "runBakeoff.ts"), "utf8"));
  assert.ok(!/DEFAULT_JUDGE_MODEL/.test(runBakeoff), "the DEFAULT_JUDGE_MODEL default (formerly BASELINE_MODEL) is gone");
  assert.ok(!/import[^;]*BASELINE_MODEL/.test(runBakeoff), "runBakeoff imports no BASELINE_MODEL");
});

test("the D7 selection band is pinned at 2.0 — DISTINCT from the codex advisory ±3.7 noise band", () => {
  assert.equal(D7_SELECTION_BAND, 2.0, "the D7 selection band is 2.0");
  assert.equal(BAKEOFF_NOISE_BAND, 3.7, "the codex advisory panel keeps its own ±3.7 noise band");
  assert.notEqual(D7_SELECTION_BAND, BAKEOFF_NOISE_BAND, "the primary band must not be the codex advisory band");
});
