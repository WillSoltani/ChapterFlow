import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { test } from "./harness.js";
import { PIPELINE_DIR } from "./helpers.js";

const REPO_ROOT = resolve(PIPELINE_DIR, "../../../..");
const PIPELINE_REL = "scripts/book/prompts/chapterflow-v21-authored";
const NODE_ENGINE = ">=20.20.0 <21";
const PACKAGE_MANAGER = "npm@10.8.2";

function readJson(path: string): any {
  assert.ok(existsSync(path), `${path} must exist`);
  return JSON.parse(readFileSync(path, "utf8"));
}

function assertExactVersions(deps: Record<string, string> | undefined, label: string): void {
  assert.ok(deps, `${label} must exist`);
  for (const [name, version] of Object.entries(deps)) {
    assert.doesNotMatch(version, /^[\^~*xX<>]/, `${label}.${name} must be exact, got ${version}`);
  }
}

test("pipeline has one explicit npm workspace package and lockfile contract", () => {
  const rootPkg = readJson(resolve(REPO_ROOT, "package.json"));
  const pipelinePkg = readJson(resolve(PIPELINE_DIR, "package.json"));
  const lock = readJson(resolve(REPO_ROOT, "package-lock.json"));

  assert.equal(rootPkg.packageManager, PACKAGE_MANAGER);
  assert.equal(rootPkg.engines?.node, NODE_ENGINE);
  assert.ok(Array.isArray(rootPkg.workspaces), "root package.json must declare npm workspaces");
  assert.ok(rootPkg.workspaces.includes(PIPELINE_REL), `root workspaces must include ${PIPELINE_REL}`);

  for (const script of ["pipeline:typecheck", "pipeline:test", "pipeline:build", "pipeline:doctor", "pipeline:test:focused"]) {
    assert.ok(rootPkg.scripts?.[script], `root package.json must expose ${script}`);
    assert.match(rootPkg.scripts[script], /--workspace @chapterflow\/v21-authored/, `${script} must target the pipeline workspace`);
  }

  assert.equal(pipelinePkg.name, "@chapterflow/v21-authored");
  assert.equal(pipelinePkg.private, true);
  assert.equal(pipelinePkg.engines?.node, NODE_ENGINE);
  assert.equal(pipelinePkg.packageManager, PACKAGE_MANAGER);
  for (const script of ["typecheck", "test", "build", "doctor", "test:focused", "test:no-api"]) {
    assert.ok(pipelinePkg.scripts?.[script], `pipeline package.json must expose ${script}`);
  }
  assert.match(pipelinePkg.scripts.test, /CHAPTERFLOW_NO_API_CODEX_QC=1/, "pipeline tests must default to no-API mode");
  // Pin tracks package.json/package-lock.json, not a deliberate hold: Dependabot #505
  // bumped both consistently 0.104.1 -> 0.120.0 (app-minor-and-patch group).
  assert.deepEqual(pipelinePkg.optionalDependencies, {
    "@anthropic-ai/sdk": "0.120.0",
    "openai": "6.42.0",
  });
  assertExactVersions(pipelinePkg.devDependencies, "pipeline devDependencies");
  assertExactVersions(pipelinePkg.optionalDependencies, "pipeline optionalDependencies");

  assert.equal(lock.lockfileVersion, 3);
  assert.ok(lock.packages?.[PIPELINE_REL], "root package-lock.json must include the pipeline workspace package");
  assert.equal(lock.packages[PIPELINE_REL].name, "@chapterflow/v21-authored");
  assert.deepEqual(lock.packages[PIPELINE_REL].optionalDependencies, pipelinePkg.optionalDependencies);
});

test("CI and docs run the same clean pipeline workspace commands", () => {
  const ci = readFileSync(resolve(REPO_ROOT, ".github/workflows/ci.yml"), "utf8");
  for (const snippet of [
    "npm ci --include=optional",
    "npm run pipeline:typecheck",
    "npm run pipeline:test",
    "npm run pipeline:doctor",
  ]) {
    assert.match(ci, new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `CI must run: ${snippet}`);
  }

  const readme = readFileSync(resolve(PIPELINE_DIR, "README.md"), "utf8");
  for (const snippet of [
    "npm ci --include=optional",
    "npm run pipeline:typecheck",
    "npm run pipeline:test",
    "npm run pipeline:doctor",
  ]) {
    assert.match(readme, new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `README must document: ${snippet}`);
  }
});
