export const LEGACY_ROUTE_DISABLED_CODE = "LEGACY_ROUTE_DISABLED:V4_APPLICATION_ROUTE_REQUIRED" as const;

export type LegacyRouteDisposition =
  | "STABLE_DISABLED"
  | "REMOVED"
  | "PURE_RETAINED"
  | "INJECTED_V4_RETAINED"
  | "CANONICAL_READ_RETAINED";

export type LegacyRouteInventoryEntry = Readonly<{
  path: string;
  symbols: readonly string[];
  disposition: LegacyRouteDisposition;
}>;

export const LEGACY_ROUTE_INVENTORY: readonly LegacyRouteInventoryEntry[] = Object.freeze([
  { path: "src/providers/router.ts", symbols: ["selectProvider", "callModel", "pingProvider"], disposition: "STABLE_DISABLED" },
  { path: "src/providers/cli.ts", symbols: ["ClaudeCliProvider"], disposition: "STABLE_DISABLED" },
  { path: "src/providers/anthropic-api.ts", symbols: ["AnthropicApiProvider"], disposition: "STABLE_DISABLED" },
  { path: "src/providers/openai-api.ts", symbols: ["OpenAiApiProvider"], disposition: "STABLE_DISABLED" },
  { path: "src/claudeClient.ts", symbols: ["callClaude", "pingClaude"], disposition: "STABLE_DISABLED" },
  { path: "src/cost-tracker.ts", symbols: ["callModel", "writeCostManifest", "defaultCostManifestPath"], disposition: "STABLE_DISABLED" },
  { path: "src/scratch/run-full-chapter.ts", symbols: ["main"], disposition: "STABLE_DISABLED" },
  { path: "src/agents/writer-hook.ts", symbols: ["runWriterHook"], disposition: "STABLE_DISABLED" },
  { path: "src/agents/writer-implementation-plan.ts", symbols: ["runWriterImplementationPlan"], disposition: "STABLE_DISABLED" },
  { path: "src/agents/writer-quiz.ts", symbols: ["runWriterQuiz"], disposition: "STABLE_DISABLED" },
  { path: "src/curator/exampleSelector.ts", symbols: ["runExampleCurator"], disposition: "STABLE_DISABLED" },
  { path: "src/generateChapter.ts", symbols: ["generateChapter", "generateKeyTakeaway"], disposition: "STABLE_DISABLED" },
  { path: "src/generateBook.ts", symbols: ["generateBook"], disposition: "STABLE_DISABLED" },
  { path: "src/orchestrator/optimizedPipeline.ts", symbols: ["runOptimizedPipeline"], disposition: "STABLE_DISABLED" },
  { path: "src/sections/sectionTasks.ts", symbols: ["dealSectionTasks", "sectionTasks", "missingSectionTasks", "readSectionTask"], disposition: "STABLE_DISABLED" },
  { path: "src/orchestrator/repairRouting.ts", symbols: ["bumpSlotSalt", "redealAndRegenerate", "routeAndExecuteRepairs", "syncChapterEditsToArtifacts", "gatherRoutableFindings", "runRoutedRedeals", "runArtifactSync"], disposition: "REMOVED" },
  { path: "src/orchestrator/compilerRun.ts", symbols: ["stampCompilerAssemblyProvenance", "regenerateSectionArtifact", "convergeAssembly"], disposition: "REMOVED" },
  { path: "src/orchestrator/compilerRun.ts", symbols: ["runPolishStage"], disposition: "STABLE_DISABLED" },
  { path: "src/orchestrator/repairRouting.ts", symbols: ["repairRoutingMode", "classifyRepairFindings"], disposition: "PURE_RETAINED" },
  { path: "src/orchestrator/compilerRun.ts", symbols: ["runRubricPreflight", "doCompilerWrite"], disposition: "INJECTED_V4_RETAINED" },
  { path: "src/orchestrator/compilerTasks.ts", symbols: ["sourcePrewriteRepairPrompt", "sourcePrewriteRepairPromptRequest"], disposition: "PURE_RETAINED" },
  { path: "src/sections/sectionTasks.ts", symbols: ["sectionDoNotLines"], disposition: "PURE_RETAINED" },
  { path: "src/sections/sectionTasks.ts", symbols: ["buildSectionTaskMarkdown"], disposition: "PURE_RETAINED" },
  { path: "src/review/sourceIntegrityReview.ts", symbols: ["runSourceIntegrityReview"], disposition: "INJECTED_V4_RETAINED" },
  { path: "src/orchestrator/forwardChapterConductor.ts", symbols: ["runForwardChapterConductor"], disposition: "INJECTED_V4_RETAINED" },
  { path: "src/cli.ts", symbols: ["ping", "pipeline", "flow", "generate-book", "research", "generate"], disposition: "STABLE_DISABLED" },
  { path: "src/app/compilerApplicationPort.ts", symbols: ["CompilerApplicationPort.run"], disposition: "INJECTED_V4_RETAINED" },
  { path: "src/cli.ts", symbols: ["book-autopilot.compiler"], disposition: "INJECTED_V4_RETAINED" },
  { path: "src/providers/router.ts", symbols: ["resolveProviderName", "resolveModel", "defaultModelForProviderName"], disposition: "PURE_RETAINED" },
  { path: "src/providers/cli.ts", symbols: ["ClaudeCliProvider.isConfigured"], disposition: "PURE_RETAINED" },
  { path: "src/providers/anthropic-api.ts", symbols: ["anthropicModelOmitsSamplingFields", "AnthropicApiProvider.isConfigured"], disposition: "PURE_RETAINED" },
  { path: "src/providers/openai-api.ts", symbols: ["OpenAiApiProvider.isConfigured"], disposition: "PURE_RETAINED" },
  { path: "src/claudeClient.ts", symbols: ["MODEL_FOR_TIER"], disposition: "PURE_RETAINED" },
  { path: "src/cost-tracker.ts", symbols: ["NOT_METERED_MESSAGE", "beginRun", "endRun", "getCurrentStats", "formatStats"], disposition: "PURE_RETAINED" },
  { path: "src/orchestrator/compilerTasks.ts", symbols: ["COMPILER_SOURCE_REPAIR_PROFILE_ID"], disposition: "PURE_RETAINED" },
  { path: "src/generateChapter.ts", symbols: ["buildBriefCacheInputs", "buildPlanCacheInputs", "buildChapterCacheInputs", "readingLevels"], disposition: "PURE_RETAINED" },
  { path: "src/generateBook.ts", symbols: ["loadChapterIndex"], disposition: "CANONICAL_READ_RETAINED" },
]);

export function legacyRouteDisabled(route: string): Error {
  return new Error(`${LEGACY_ROUTE_DISABLED_CODE}:${route}`);
}
