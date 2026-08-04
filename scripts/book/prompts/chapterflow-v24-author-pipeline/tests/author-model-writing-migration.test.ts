import assert from "node:assert/strict";

import { test } from "./harness.js";
import { runWriterHook } from "../src/agents/writer-hook.js";
import { runWriterImplementationPlan } from "../src/agents/writer-implementation-plan.js";
import { runWriterQuiz } from "../src/agents/writer-quiz.js";
import { runExampleCurator } from "../src/curator/exampleSelector.js";
import { callClaude } from "../src/claudeClient.js";
import { callModel, defaultCostManifestPath, writeCostManifest } from "../src/cost-tracker.js";
import { generateBook } from "../src/generateBook.js";
import { generateChapter } from "../src/generateChapter.js";
import { runOptimizedPipeline } from "../src/orchestrator/optimizedPipeline.js";
import { main as runFullChapter } from "../src/scratch/run-full-chapter.js";

const DISABLED = /LEGACY_ROUTE_DISABLED:V4_APPLICATION_ROUTE_REQUIRED/;

test("legacy direct model and writer entrypoints reject with one stable blocker", async () => {
  const routes: Array<() => Promise<unknown>> = [
    () => callClaude({ tier: "writer", system: "system", user: "user" }),
    () => callModel({ tier: "writer", system: "system", user: "user" }),
    () => runWriterHook({} as never),
    () => runWriterImplementationPlan({} as never),
    () => runWriterQuiz({} as never),
    () => runExampleCurator({} as never),
    () => generateChapter({} as never, {} as never),
    () => generateBook({} as never, []),
    () => runFullChapter(),
  ];
  for (const route of routes) await assert.rejects(route(), DISABLED);
  assert.equal(await runOptimizedPipeline([], {} as never), 2);
  assert.throws(() => writeCostManifest(null, "/tmp/legacy-cost.json"), DISABLED);
  assert.throws(() => defaultCostManifestPath("book", "run"), DISABLED);
});
