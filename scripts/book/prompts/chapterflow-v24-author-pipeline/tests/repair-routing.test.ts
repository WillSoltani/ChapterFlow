import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { test } from "./harness.js";
import { routeFinding, loadFindingRoutingConfig, validateFindingRoutingConfig } from "../src/qc/findingRouting.js";
import {
  classifyRepairFindings,
  repairRoutingMode,
  type RoutableRepairFinding,
} from "../src/orchestrator/repairRouting.js";

test("repair routing config retains pure finding classification", () => {
  assert.doesNotThrow(() => loadFindingRoutingConfig());
  const config = loadFindingRoutingConfig();
  const route = (finding: Parameters<typeof routeFinding>[0]) => routeFinding(finding, config);
  assert.equal(route({ family: "scene_skeleton", unitId: "ex03" }), "redeal:example-slot");
  assert.equal(route({ family: "repeated_unit", unitId: "q05" }), "redeal:quiz-slot");
  assert.equal(route({ family: "repeated_unit", unitId: "rc02" }), "redeal:card-slot");
  assert.equal(route({ family: "location_stamping", unitId: "ex01" }), "redeal:venue");
  assert.equal(route({ family: "persona_drift", unitId: "ex04" }), "redeal:names");
  assert.equal(route({ repairClass: "templated_source", unitId: "fact.2" }), "escalate:research");
  assert.equal(route({}), "surgical");
});

test("repair routing config rejects unknown lever", () => {
  assert.throws(() => validateFindingRoutingConfig({
    schemaVersion: "finding-routing-v1",
    default: "surgical",
    families: { scene_skeleton: { lever: "redeal:nope" } },
    escalate: { lever: "escalate:research", match: [] },
    unitPatterns: {},
  }), /must be one of/);
});

test("classification is pure and surgical-only fallback forces every finding surgical", () => {
  const findings: readonly RoutableRepairFinding[] = Object.freeze([
    Object.freeze({ findingId: "F-scene", family: "scene_skeleton", unitId: "ex01", chapterNumber: 1 }),
    Object.freeze({ findingId: "F-source", repairClass: "templated_source", unitId: "fact.2", chapterNumber: 2 }),
    Object.freeze({ findingId: "F-local", repairClass: "factual_accuracy", unitId: "q01", chapterNumber: 3 }),
  ]);

  assert.deepEqual(classifyRepairFindings(findings, "enforce").map((item) => item.lever), [
    "redeal:example-slot",
    "escalate:research",
    "surgical",
  ]);
  const fallback = classifyRepairFindings(findings, "surgical-only");
  assert.deepEqual(fallback.map((item) => item.lever), ["surgical", "surgical", "surgical"]);
  assert.deepEqual(fallback.map((item) => item.finding), findings);
});

test("repair routing mode is deterministic and defaults to enforce", () => {
  assert.equal(repairRoutingMode({}), "enforce");
  assert.equal(repairRoutingMode({ CHAPTERFLOW_REPAIR_ROUTING: "enforce" }), "enforce");
  assert.equal(repairRoutingMode({ CHAPTERFLOW_REPAIR_ROUTING: "surgical-only" }), "surgical-only");
  assert.equal(repairRoutingMode({ CHAPTERFLOW_REPAIR_ROUTING: "unexpected" }), "enforce");
});

test("repair routing module contains no mutation executor or legacy filesystem dependency", () => {
  const source = readFileSync(resolve(process.cwd(), "src/orchestrator/repairRouting.ts"), "utf8");
  for (const symbol of [
    "bumpSlotSalt",
    "redealAndRegenerate",
    "routeAndExecuteRepairs",
    "syncChapterEditsToArtifacts",
    "gatherRoutableFindings",
    "runRoutedRedeals",
    "runArtifactSync",
  ]) {
    assert.doesNotMatch(source, new RegExp(`(?:function|const)\\s+${symbol}\\b`), `${symbol} must stay removed`);
  }
  assert.doesNotMatch(source, /sectionTasks|artifactStore|assembleSections|effectiveLedger|appendFileSync|writeJsonFile/);
});
