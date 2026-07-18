/** V25 recovery — root TypeScript compilation boundary.
 *
 * The root web-app program sweeps the repository with `**​/*.ts` + `**​/*.mts`
 * and compiles pipeline files under root settings (target ES2017, Next global
 * types that make NodeJS.ProcessEnv require NODE_ENV). Two invariants keep the
 * two programs coherent at the same commit:
 *
 *  1. Inert evidence under this pipeline's state/ (frozen owner-input snapshot
 *     sources, halted .mts drivers) is EXCLUDED from the root program — it is
 *     retained evidence, registry-hashed elsewhere, and must never be edited to
 *     satisfy a compiler.
 *  2. Pipeline src/ and tests/ REMAIN part of the root program (the v24
 *     pipeline is not an npm workspace, so root tsc is the only root-side type
 *     coverage) — therefore live pipeline code must not depend on the
 *     @types/node-only shape of NodeJS.ProcessEnv or on post-ES2017 regex
 *     syntax in ways the root program rejects.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { test } from "./harness.js";

const PIPELINE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPOSITORY_ROOT = resolve(PIPELINE_ROOT, "../../../..");
const V24_STATE_EXCLUDE = "scripts/book/prompts/chapterflow-v24-author-pipeline/state/**";

type RootTsconfig = { include?: string[]; exclude?: string[] };

function rootTsconfig(): RootTsconfig {
  return JSON.parse(readFileSync(resolve(REPOSITORY_ROOT, "tsconfig.json"), "utf8")) as RootTsconfig;
}

test("root tsconfig excludes v24 pipeline state/ (inert evidence never compiles as root source)", () => {
  const { exclude } = rootTsconfig();
  assert.ok(Array.isArray(exclude), "root tsconfig must have an exclude array");
  assert.ok(exclude.includes(V24_STATE_EXCLUDE),
    `root tsconfig exclude must contain "${V24_STATE_EXCLUDE}" so retained snapshots under state/ ` +
    "(owner-input .ts/.mts evidence) are never compiled by the web-app program");
});

test("root tsconfig keeps pipeline src/ and tests/ in the root program (no broad scripts/book exclusion)", () => {
  const { include, exclude } = rootTsconfig();
  assert.ok(include?.includes("**/*.ts"), "root include must still sweep **/*.ts");
  for (const pattern of exclude ?? []) {
    assert.ok(!/^scripts\/book\/?\*{0,2}$/.test(pattern) && pattern !== "scripts/book/**" && pattern !== "scripts/**",
      `root tsconfig must not broadly exclude the pipeline (found "${pattern}") — ` +
      "root tsc is the only root-side type coverage of the v24 pipeline");
  }
});

test("live pipeline code does not annotate hermetic env values as NodeJS.ProcessEnv literals", () => {
  // The one historical offender: an empty object literal typed as ProcessEnv
  // fails under the root program (Next requires NODE_ENV). The hermetic env
  // path must use the local HermeticEnvMap alias instead.
  const envelope = readFileSync(resolve(PIPELINE_ROOT, "src/exec/executionEnvelope.ts"), "utf8");
  assert.ok(!/const env:\s*NodeJS\.ProcessEnv\s*=\s*\{\}/.test(envelope),
    "buildHermeticEnv must build a HermeticEnvMap, not an object literal typed NodeJS.ProcessEnv");
  assert.match(envelope, /export type HermeticEnvMap = Record<string, string \| undefined>;/,
    "the local hermetic env map alias must remain exported for spawn-boundary consumers");
});
