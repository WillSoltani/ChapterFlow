import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { test } from "./harness.js";
import type { AutopilotDeps } from "../src/orchestrator/autopilot.js";
import { runPolishStage } from "../src/orchestrator/compilerRun.js";

const DISABLED = /LEGACY_ROUTE_DISABLED:V4_APPLICATION_ROUTE_REQUIRED:compilerRun\.runPolishStage/;

test("legacy compiler assembly repair closure is removed", () => {
  const source = readFileSync(resolve(process.cwd(), "src/orchestrator/compilerRun.ts"), "utf8");
  for (const symbol of [
    "stampCompilerAssemblyProvenance",
    "regenerateSectionArtifact",
    "convergeAssembly",
    "convergeSections",
    "spawnMissingSectionTasks",
    "assemblyRepairPrompt",
    "sectionRepairPrompt",
  ]) {
    assert.doesNotMatch(source, new RegExp(`(?:function|const)\\s+${symbol}\\b`), `${symbol} must stay removed`);
  }
  assert.doesNotMatch(source, /sectionTasks|assemble-sections|validate-sections|deal-section-tasks/);
});

test("legacy polish mutation modes reject before dependency access", async () => {
  const deps = new Proxy({} as AutopilotDeps, {
    get() { throw new Error("legacy polish touched dependencies before rejecting"); },
  });
  await assert.rejects(() => runPolishStage("route-book", deps, 4, () => true, {}, "risk"), DISABLED);
  await assert.rejects(() => runPolishStage("route-book", deps, 4, () => true, {}, "always"), DISABLED);
});

test("legacy polish never mode remains pure no-op", async () => {
  const deps = new Proxy({} as AutopilotDeps, {
    get() { throw new Error("never mode touched dependencies"); },
  });
  assert.equal(await runPolishStage("route-book", deps, 4, () => true, {}, "never"), null);
});
