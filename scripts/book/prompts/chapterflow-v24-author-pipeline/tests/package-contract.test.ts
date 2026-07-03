import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { test } from "./harness.js";
import { PIPELINE_DIR } from "./helpers.js";

const REPO_ROOT = PIPELINE_DIR;
const PACKAGE_NAME = "@chapterflow/v24-author-pipeline";
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
  assert.ok(!rootPkg.workspaces, "v22 optimized artifact is a standalone pipeline package, not a nested workspace");

  for (const script of ["pipeline:typecheck", "pipeline:test", "pipeline:build", "pipeline:doctor", "pipeline:test:focused"]) {
    assert.ok(rootPkg.scripts?.[script], `root package.json must expose ${script}`);
    assert.match(rootPkg.scripts[script], /^npm run /, `${script} must delegate to the local standalone pipeline script`);
  }

  assert.equal(pipelinePkg.name, PACKAGE_NAME);
  assert.equal(pipelinePkg.private, true);
  assert.equal(pipelinePkg.engines?.node, NODE_ENGINE);
  assert.equal(pipelinePkg.packageManager, PACKAGE_MANAGER);
  for (const script of ["typecheck", "test", "build", "doctor", "test:focused", "test:no-api"]) {
    assert.ok(pipelinePkg.scripts?.[script], `pipeline package.json must expose ${script}`);
  }
  assert.match(pipelinePkg.scripts.test, /CHAPTERFLOW_NO_API_CODEX_QC=1/, "pipeline tests must default to no-API mode");
  assert.deepEqual(pipelinePkg.optionalDependencies, {
    "@anthropic-ai/sdk": "0.104.1",
    "openai": "6.42.0",
  });
  assertExactVersions(pipelinePkg.devDependencies, "pipeline devDependencies");
  assertExactVersions(pipelinePkg.optionalDependencies, "pipeline optionalDependencies");

  assert.equal(lock.lockfileVersion, 3);
  assert.ok(lock.packages?.[""], "root package-lock.json must include the standalone pipeline package");
  assert.equal(lock.packages[""].name, PACKAGE_NAME);
  assert.deepEqual(lock.packages[""].optionalDependencies, pipelinePkg.optionalDependencies);
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
