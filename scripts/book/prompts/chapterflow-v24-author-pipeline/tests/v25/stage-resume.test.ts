import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import type { Result } from "../../src/contracts/v4Core.js";
import {
  FileRunStore,
  FileStageCoordinator,
  type RunDefinition,
  type StageCheckpoint,
} from "../../src/run-state/index.js";
import { finishV25Tests, requiredTest } from "./harness.js";

function definition(bookId: string, runId: string): RunDefinition {
  return {
    schemaVersion: "1",
    bookId,
    runId,
    commandId: "walk",
    sourceGitSha: "b".repeat(40),
    requiredStages: ["research", "write", "review"],
    requiredInventory: [
      { kind: "PROVENANCE", logicalPath: "provenance/ch01.json", mediaType: "application/json" },
      { kind: "CHAPTER", logicalPath: "chapters/ch01.md", mediaType: "text/markdown" },
    ],
    inputCandidate: { candidateId: "candidate-input", manifestDigest: "1".repeat(64) },
    attemptLimits: { run: 6, byStage: { research: 2, write: 2, review: 2 } },
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

function checkpoint(run: RunDefinition, stageId: string, completedAt: string, status: StageCheckpoint["status"] = "COMPLETED"): StageCheckpoint {
  return {
    schemaVersion: "1",
    bookId: run.bookId,
    runId: run.runId,
    stageId,
    status,
    attemptIds: [],
    completedAt,
  };
}

function expectOk<T>(result: Result<T>): T {
  if (!result.ok) assert.fail(`${result.error.code}: ${result.error.message}`);
  return result.value;
}

function expectCode(result: Result<unknown>, code: string): void {
  assert.equal(result.ok, false, `expected ${code}`);
  if (!result.ok) assert.equal(result.error.code, code);
}

function stagesDir(root: string, run: RunDefinition): string {
  return join(root, "books", run.bookId, "runs", run.runId, "stages");
}

requiredTest("checkpoint replay is byte-idempotent and resume order is deterministic", async ({ roots }) => {
  const run = definition("resume-book", "resume-run");
  expectOk(await new FileRunStore(roots.stateRoot).createRun(run));
  const coordinator = new FileStageCoordinator(roots.stateRoot);
  const first = checkpoint(run, "research", "2026-01-01T00:00:00.010Z");
  expectOk(await coordinator.checkpoint(first));
  const path = join(stagesDir(roots.stateRoot, run), "research.json");
  const bytes = readFileSync(path, "utf8");
  expectOk(await coordinator.checkpoint(first));
  assert.equal(readFileSync(path, "utf8"), bytes);
  expectCode(await coordinator.checkpoint({ ...first, completedAt: "2026-01-01T00:00:00.011Z" }), "CONFLICT");
  assert.equal(readFileSync(path, "utf8"), bytes);

  const plan = expectOk(await coordinator.planResume(run));
  assert.deepEqual(plan, {
    runId: run.runId,
    completedStages: ["research"],
    pendingStages: ["write", "review"],
    cancelled: false,
  });
});

requiredTest("changed run identity conflicts without importing checkpoints", async ({ roots }) => {
  const run = definition("identity-book", "identity-run");
  const coordinator = new FileStageCoordinator(roots.stateRoot);
  expectOk(await new FileRunStore(roots.stateRoot).createRun(run));
  expectOk(await coordinator.checkpoint(checkpoint(run, "research", "2026-01-01T00:00:00.010Z")));
  const before = readFileSync(join(stagesDir(roots.stateRoot, run), "research.json"), "utf8");
  const variants: RunDefinition[] = [
    { ...run, commandId: "other-command" },
    { ...run, sourceGitSha: "c".repeat(40) },
    {
      ...run,
      requiredStages: ["write", "research", "review"],
      attemptLimits: { run: 6, byStage: { write: 2, research: 2, review: 2 } },
    },
    { ...run, requiredInventory: [...run.requiredInventory].reverse() },
    { ...run, inputCandidate: { candidateId: "candidate-other", manifestDigest: "2".repeat(64) } },
    { ...run, attemptLimits: { ...run.attemptLimits, run: 7 } },
  ];
  for (const variant of variants) expectCode(await coordinator.planResume(variant), "CONFLICT");
  assert.equal(readFileSync(join(stagesDir(roots.stateRoot, run), "research.json"), "utf8"), before);
  assert.deepEqual(readdirSync(stagesDir(roots.stateRoot, run)).sort(), ["research.json"]);
});

requiredTest("concurrent disjoint checkpoints persist and conflicting same-stage write has one winner", async ({ roots }) => {
  const run = definition("checkpoint-race-book", "checkpoint-race-run");
  expectOk(await new FileRunStore(roots.stateRoot).createRun(run));
  const left = new FileStageCoordinator(roots.stateRoot);
  const right = new FileStageCoordinator(roots.stateRoot);
  const disjoint = await Promise.all([
    left.checkpoint(checkpoint(run, "research", "2026-01-01T00:00:00.010Z")),
    right.checkpoint(checkpoint(run, "write", "2026-01-01T00:00:00.011Z")),
  ]);
  assert.equal(disjoint.filter((result) => result.ok).length, 2);

  const contenders = await Promise.all([
    left.checkpoint(checkpoint(run, "review", "2026-01-01T00:00:00.012Z", "COMPLETED")),
    right.checkpoint(checkpoint(run, "review", "2026-01-01T00:00:00.013Z", "FAILED")),
  ]);
  assert.equal(contenders.filter((result) => result.ok).length, 1);
  assert.equal(contenders.filter((result) => !result.ok && result.error.code === "CONFLICT").length, 1);
  assert.deepEqual(readdirSync(stagesDir(roots.stateRoot, run)).sort(), ["research.json", "review.json", "write.json"]);
});

finishV25Tests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
