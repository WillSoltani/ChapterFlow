import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";

import { test } from "./harness.js";
import {
  orchestratorRoundDir,
  repairPromptPath,
  taskCardsDir,
} from "../src/qc/orchestrator/artifacts.js";
import { unsafePublishFiles } from "../src/qc/publishAfterQc.js";

const BOOK = "zz-fixture-publish-token-guard";
const ROUND = "r-token";

function write(path: string, text = "fixture"): string {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text, "utf8");
  return path;
}

function fakeToken(role: string): string {
  return `cfq-${role}-secret`;
}

function cleanup(): void {
  rmSync(dirname(orchestratorRoundDir(BOOK, ROUND)), { recursive: true, force: true });
}

test("publish-after-qc token guard refuses plaintext role tokens", () => {
  cleanup();
  try {
    const tokenFile = write(resolve(orchestratorRoundDir(BOOK, ROUND), "token-bearing.md"), `do not commit ${fakeToken("confirm")}`);
    const unsafe = unsafePublishFiles([tokenFile], { allGreen: true });
    assert.deepEqual(unsafe, [tokenFile]);
  } finally {
    cleanup();
  }
});

test("publish-after-qc token guard refuses task cards, workflow, and all-green repair prompts", () => {
  cleanup();
  try {
    const taskCard = write(resolve(taskCardsDir(BOOK, ROUND), "00-sweep.md"));
    const workflow = write(resolve(orchestratorRoundDir(BOOK, ROUND), "qc-auto.workflow.js"));
    const repairPrompt = write(repairPromptPath(BOOK, ROUND));
    const safeEvidence = write(resolve(orchestratorRoundDir(BOOK, ROUND), "evidence-matrix.json"), "{}");

    const unsafe = new Set(unsafePublishFiles([taskCard, workflow, repairPrompt, safeEvidence], { allGreen: true }));
    assert.ok(unsafe.has(taskCard));
    assert.ok(unsafe.has(workflow));
    assert.ok(unsafe.has(repairPrompt));
    assert.equal(unsafe.has(safeEvidence), false);
  } finally {
    cleanup();
  }
});
