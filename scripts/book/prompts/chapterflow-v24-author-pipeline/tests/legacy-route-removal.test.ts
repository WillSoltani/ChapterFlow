import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { test } from "./harness.js";
import { LEGACY_ROUTE_INVENTORY } from "../src/runtime/legacyRouteInventory.js";
import { dealSectionTasks, missingSectionTasks, readSectionTask, sectionTasks } from "../src/sections/sectionTasks.js";

const DISABLED = /LEGACY_ROUTE_DISABLED:V4_APPLICATION_ROUTE_REQUIRED/;

const EXPECTED_INVENTORY_ATOMS = [
  "src/providers/router.ts\tselectProvider\tSTABLE_DISABLED",
  "src/providers/router.ts\tcallModel\tSTABLE_DISABLED",
  "src/providers/router.ts\tpingProvider\tSTABLE_DISABLED",
  "src/providers/cli.ts\tClaudeCliProvider\tSTABLE_DISABLED",
  "src/providers/anthropic-api.ts\tAnthropicApiProvider\tSTABLE_DISABLED",
  "src/providers/openai-api.ts\tOpenAiApiProvider\tSTABLE_DISABLED",
  "src/claudeClient.ts\tcallClaude\tSTABLE_DISABLED",
  "src/claudeClient.ts\tpingClaude\tSTABLE_DISABLED",
  "src/cost-tracker.ts\tcallModel\tSTABLE_DISABLED",
  "src/cost-tracker.ts\twriteCostManifest\tSTABLE_DISABLED",
  "src/cost-tracker.ts\tdefaultCostManifestPath\tSTABLE_DISABLED",
  "src/scratch/run-full-chapter.ts\tmain\tSTABLE_DISABLED",
  "src/agents/writer-hook.ts\trunWriterHook\tSTABLE_DISABLED",
  "src/agents/writer-implementation-plan.ts\trunWriterImplementationPlan\tSTABLE_DISABLED",
  "src/agents/writer-quiz.ts\trunWriterQuiz\tSTABLE_DISABLED",
  "src/curator/exampleSelector.ts\trunExampleCurator\tSTABLE_DISABLED",
  "src/generateChapter.ts\tgenerateChapter\tSTABLE_DISABLED",
  "src/generateChapter.ts\tgenerateKeyTakeaway\tSTABLE_DISABLED",
  "src/generateBook.ts\tgenerateBook\tSTABLE_DISABLED",
  "src/orchestrator/optimizedPipeline.ts\trunOptimizedPipeline\tSTABLE_DISABLED",
  "src/sections/sectionTasks.ts\tdealSectionTasks\tSTABLE_DISABLED",
  "src/sections/sectionTasks.ts\tsectionTasks\tSTABLE_DISABLED",
  "src/sections/sectionTasks.ts\tmissingSectionTasks\tSTABLE_DISABLED",
  "src/sections/sectionTasks.ts\treadSectionTask\tSTABLE_DISABLED",
  "src/orchestrator/repairRouting.ts\tbumpSlotSalt\tREMOVED",
  "src/orchestrator/repairRouting.ts\tredealAndRegenerate\tREMOVED",
  "src/orchestrator/repairRouting.ts\trouteAndExecuteRepairs\tREMOVED",
  "src/orchestrator/repairRouting.ts\tsyncChapterEditsToArtifacts\tREMOVED",
  "src/orchestrator/repairRouting.ts\tgatherRoutableFindings\tREMOVED",
  "src/orchestrator/repairRouting.ts\trunRoutedRedeals\tREMOVED",
  "src/orchestrator/repairRouting.ts\trunArtifactSync\tREMOVED",
  "src/orchestrator/compilerRun.ts\tstampCompilerAssemblyProvenance\tREMOVED",
  "src/orchestrator/compilerRun.ts\tregenerateSectionArtifact\tREMOVED",
  "src/orchestrator/compilerRun.ts\tconvergeAssembly\tREMOVED",
  "src/orchestrator/compilerRun.ts\trunPolishStage\tSTABLE_DISABLED",
  "src/orchestrator/repairRouting.ts\trepairRoutingMode\tPURE_RETAINED",
  "src/orchestrator/repairRouting.ts\tclassifyRepairFindings\tPURE_RETAINED",
  "src/orchestrator/compilerRun.ts\trunRubricPreflight\tINJECTED_V4_RETAINED",
  "src/orchestrator/compilerRun.ts\tdoCompilerWrite\tINJECTED_V4_RETAINED",
  "src/orchestrator/compilerTasks.ts\tsourcePrewriteRepairPrompt\tPURE_RETAINED",
  "src/orchestrator/compilerTasks.ts\tsourcePrewriteRepairPromptRequest\tPURE_RETAINED",
  "src/sections/sectionTasks.ts\tsectionDoNotLines\tPURE_RETAINED",
  "src/sections/sectionTasks.ts\tbuildSectionTaskMarkdown\tPURE_RETAINED",
  "src/review/sourceIntegrityReview.ts\trunSourceIntegrityReview\tINJECTED_V4_RETAINED",
  "src/orchestrator/forwardChapterConductor.ts\trunForwardChapterConductor\tINJECTED_V4_RETAINED",
  "src/cli.ts\tping\tSTABLE_DISABLED",
  "src/cli.ts\tpipeline\tSTABLE_DISABLED",
  "src/cli.ts\tflow\tSTABLE_DISABLED",
  "src/cli.ts\tgenerate-book\tSTABLE_DISABLED",
  "src/cli.ts\tgenerate\tSTABLE_DISABLED",
  "src/app/compilerApplicationPort.ts\tCompilerApplicationPort.run\tINJECTED_V4_RETAINED",
  "src/cli.ts\tbook-autopilot.compiler\tINJECTED_V4_RETAINED",
  "src/providers/router.ts\tresolveProviderName\tPURE_RETAINED",
  "src/providers/router.ts\tresolveModel\tPURE_RETAINED",
  "src/providers/router.ts\tdefaultModelForProviderName\tPURE_RETAINED",
  "src/providers/cli.ts\tClaudeCliProvider.isConfigured\tPURE_RETAINED",
  "src/providers/anthropic-api.ts\tanthropicModelOmitsSamplingFields\tPURE_RETAINED",
  "src/providers/anthropic-api.ts\tAnthropicApiProvider.isConfigured\tPURE_RETAINED",
  "src/providers/openai-api.ts\tOpenAiApiProvider.isConfigured\tPURE_RETAINED",
  "src/claudeClient.ts\tMODEL_FOR_TIER\tPURE_RETAINED",
  "src/cost-tracker.ts\tNOT_METERED_MESSAGE\tPURE_RETAINED",
  "src/cost-tracker.ts\tbeginRun\tPURE_RETAINED",
  "src/cost-tracker.ts\tendRun\tPURE_RETAINED",
  "src/cost-tracker.ts\tgetCurrentStats\tPURE_RETAINED",
  "src/cost-tracker.ts\tformatStats\tPURE_RETAINED",
  "src/orchestrator/compilerTasks.ts\tCOMPILER_SOURCE_REPAIR_PROFILE_ID\tPURE_RETAINED",
  "src/generateChapter.ts\tbuildBriefCacheInputs\tPURE_RETAINED",
  "src/generateChapter.ts\tbuildPlanCacheInputs\tPURE_RETAINED",
  "src/generateChapter.ts\tbuildChapterCacheInputs\tPURE_RETAINED",
  "src/generateChapter.ts\treadingLevels\tPURE_RETAINED",
  "src/generateBook.ts\tloadChapterIndex\tCANONICAL_READ_RETAINED",
] as const;

const EXPECTED_RUNTIME_EXPORTS: Readonly<Record<string, readonly string[]>> = {
  "src/app/compilerApplicationPort.ts": ["CompilerApplicationPort"],
  "src/providers/router.ts": ["resolveProviderName", "selectProvider", "resolveModel", "callModel", "pingProvider", "defaultModelForProviderName"],
  "src/providers/cli.ts": ["ClaudeCliProvider"],
  "src/providers/anthropic-api.ts": ["anthropicModelOmitsSamplingFields", "AnthropicApiProvider"],
  "src/providers/openai-api.ts": ["OpenAiApiProvider"],
  "src/claudeClient.ts": ["callClaude", "pingClaude", "MODEL_FOR_TIER"],
  "src/cost-tracker.ts": ["NOT_METERED_MESSAGE", "beginRun", "endRun", "getCurrentStats", "callModel", "writeCostManifest", "defaultCostManifestPath", "formatStats"],
  "src/scratch/run-full-chapter.ts": ["main"],
  "src/agents/writer-hook.ts": ["runWriterHook"],
  "src/agents/writer-implementation-plan.ts": ["runWriterImplementationPlan"],
  "src/agents/writer-quiz.ts": ["runWriterQuiz"],
  "src/curator/exampleSelector.ts": ["runExampleCurator"],
  "src/generateChapter.ts": ["buildBriefCacheInputs", "buildPlanCacheInputs", "buildChapterCacheInputs", "generateChapter", "readingLevels"],
  "src/generateBook.ts": ["generateBook", "loadChapterIndex"],
  "src/orchestrator/optimizedPipeline.ts": ["runOptimizedPipeline"],
  "src/sections/sectionTasks.ts": ["sectionDoNotLines", "buildSectionTaskMarkdown", "dealSectionTasks", "sectionTasks", "missingSectionTasks", "readSectionTask"],
  "src/orchestrator/compilerTasks.ts": ["COMPILER_SOURCE_REPAIR_PROFILE_ID", "sourcePrewriteRepairPrompt", "sourcePrewriteRepairPromptRequest"],
  "src/review/sourceIntegrityReview.ts": ["runSourceIntegrityReview"],
  "src/orchestrator/forwardChapterConductor.ts": ["runForwardChapterConductor"],
  "src/orchestrator/repairRouting.ts": ["repairRoutingMode", "classifyRepairFindings"],
  "src/orchestrator/compilerRun.ts": ["runPolishStage", "runRubricPreflight", "doCompilerWrite"],
};

function runtimeExportNames(source: string): string[] {
  return [...source.matchAll(/^export\s+(?:async\s+)?(?:function|class|const)\s+([A-Za-z_$][\w$]*)/gm)]
    .map((match) => match[1]);
}

test("legacy inventory deep-equals independent path, symbol, and disposition set", () => {
  assert.equal(Object.isFrozen(LEGACY_ROUTE_INVENTORY), true);
  const actual = LEGACY_ROUTE_INVENTORY.flatMap((entry) =>
    entry.symbols.map((symbol) => `${entry.path}\t${symbol}\t${entry.disposition}`)
  ).sort();
  assert.deepEqual(actual, [...EXPECTED_INVENTORY_ATOMS].sort());
});

test("CLI disabled command inventory is derived from exact five-command source set", () => {
  const source = readFileSync(resolve(process.cwd(), "src/cli.ts"), "utf8");
  const declaration = source.match(/const LEGACY_DISABLED_COMMANDS = new Set<string>\(\[([\s\S]*?)\]\);/);
  assert.ok(declaration, "LEGACY_DISABLED_COMMANDS declaration missing");
  const commands = [...declaration[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(commands, ["ping", "pipeline", "flow", "generate-book", "generate"]);

  const inventoried = LEGACY_ROUTE_INVENTORY
    .filter((entry) => entry.path === "src/cli.ts" && entry.disposition === "STABLE_DISABLED")
    .flatMap((entry) => entry.symbols);
  assert.deepEqual(inventoried, commands);
});

test("inventoried runtime exports and retained member seams exist in source", () => {
  for (const [path, expectedNames] of Object.entries(EXPECTED_RUNTIME_EXPORTS)) {
    const source = readFileSync(resolve(process.cwd(), path), "utf8");
    const actualNames = new Set(runtimeExportNames(source));
    for (const name of expectedNames) assert.equal(actualNames.has(name), true, `${path} missing runtime export ${name}`);
  }

  const compilerSource = readFileSync(resolve(process.cwd(), "src/app/compilerApplicationPort.ts"), "utf8");
  assert.match(compilerSource, /export class CompilerApplicationPort[\s\S]*?\n\s+async run\(request: CompilerApplicationRequest\)/);
  for (const [path, provider] of [
    ["src/providers/cli.ts", "ClaudeCliProvider"],
    ["src/providers/anthropic-api.ts", "AnthropicApiProvider"],
    ["src/providers/openai-api.ts", "OpenAiApiProvider"],
  ] as const) {
    const source = readFileSync(resolve(process.cwd(), path), "utf8");
    assert.match(source, new RegExp(`export const ${provider}:[\\s\\S]*?isConfigured\\(\\): boolean`));
  }

  const cliSource = readFileSync(resolve(process.cwd(), "src/cli.ts"), "utf8");
  assert.match(cliSource, /if \(architecture === "compiler"\)[\s\S]*?const compilerPort = resolvedApp\.compiler;[\s\S]*?compiler = \{/);
});

test("legacy section filesystem helpers reject before discovery or write", () => {
  assert.throws(() => dealSectionTasks("route-book"), DISABLED);
  assert.throws(() => sectionTasks("route-book"), DISABLED);
  assert.throws(() => missingSectionTasks("route-book"), DISABLED);
  assert.throws(() => readSectionTask({} as never), DISABLED);
});

test("compiler and review V4 seams retain no legacy provider alias", () => {
  for (const path of ["src/app/compilerApplicationPort.ts", "src/review/sourceIntegrityReview.ts", "src/orchestrator/forwardChapterConductor.ts"]) {
    const source = readFileSync(resolve(process.cwd(), path), "utf8");
    assert.doesNotMatch(source, /\bcallClaude\b|\bcallModel\b|providers\/(?:router|cli|anthropic-api|openai-api)/);
  }
});

test("removed repair closure symbols have no runtime export", () => {
  for (const entry of LEGACY_ROUTE_INVENTORY.filter((item) => item.disposition === "REMOVED")) {
    const source = readFileSync(resolve(process.cwd(), entry.path), "utf8");
    const exports = new Set(runtimeExportNames(source));
    for (const symbol of entry.symbols) assert.equal(exports.has(symbol), false, `${entry.path} still exports removed ${symbol}`);
  }
});

test("autopilot cannot call legacy repair closure and retained compiler seams cannot reach section tasks", () => {
  const autopilot = readFileSync(resolve(process.cwd(), "src/orchestrator/autopilot.ts"), "utf8");
  assert.doesNotMatch(autopilot, /runRoutedRedeals|runArtifactSync|routeAndExecuteRepairs|syncChapterEditsToArtifacts/);

  for (const path of ["src/orchestrator/compilerRun.ts", "src/orchestrator/repairRouting.ts"]) {
    const source = readFileSync(resolve(process.cwd(), path), "utf8");
    assert.doesNotMatch(source, /sections\/sectionTasks|deal-section-tasks|validate-sections|assemble-sections/, `${path} reaches disabled section task closure`);
  }
});
