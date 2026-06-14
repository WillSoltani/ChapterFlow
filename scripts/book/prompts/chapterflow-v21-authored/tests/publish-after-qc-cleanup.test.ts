import assert from "node:assert/strict";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";

import { test } from "./harness.js";
import {
  evidenceMatrixPath,
  orchestratorRoundDir,
  qcSummaryPath,
  repairBriefPath,
  repairLedgerPath,
  repairPromptPath,
  submissionsDir,
  taskCardsDir,
} from "../src/qc/orchestrator/artifacts.js";
import { transientCleanupPlan } from "../src/qc/publishAfterQc.js";

const BOOK = "zz-fixture-publish-cleanup";
const ROUND = "r-cleanup";

function write(path: string, text = "fixture"): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text, "utf8");
}

function fakeToken(role: string): string {
  return `cfq-${role}-secret`;
}

function cleanup(): void {
  rmSync(dirname(orchestratorRoundDir(BOOK, ROUND)), { recursive: true, force: true });
}

test("publish-after-qc transient cleanup removes only task, workflow, repair, input, and token artifacts", () => {
  cleanup();
  try {
    const roundDir = orchestratorRoundDir(BOOK, ROUND);
    write(resolve(taskCardsDir(BOOK, ROUND), "00-sweep.md"), `token ${fakeToken("sweep")}`);
    write(resolve(roundDir, "qc-auto.workflow.js"), "workflow");
    write(repairPromptPath(BOOK, ROUND), "repair prompt");
    write(repairBriefPath(BOOK, ROUND), "repair brief");
    write(resolve(submissionsDir(BOOK, ROUND, "bar"), "ch01.input.json"), "{}");
    write(resolve(submissionsDir(BOOK, ROUND, "bar"), "bar-token.txt"), fakeToken("bar"));
    write(evidenceMatrixPath(BOOK, ROUND), "{}");
    write(qcSummaryPath(BOOK, ROUND), "{}");
    write(repairLedgerPath(BOOK, ROUND), "");

    const plan = transientCleanupPlan(BOOK, ROUND);
    const remove = new Set(plan.remove);
    const preserve = new Set(plan.preserve);

    assert.ok(remove.has(taskCardsDir(BOOK, ROUND)));
    assert.ok(remove.has(resolve(roundDir, "qc-auto.workflow.js")));
    assert.ok(remove.has(repairPromptPath(BOOK, ROUND)));
    assert.ok(remove.has(repairBriefPath(BOOK, ROUND)));
    assert.ok(remove.has(resolve(submissionsDir(BOOK, ROUND, "bar"), "ch01.input.json")));
    assert.ok(remove.has(resolve(submissionsDir(BOOK, ROUND, "bar"), "bar-token.txt")));
    assert.ok(preserve.has(evidenceMatrixPath(BOOK, ROUND)));
    assert.ok(preserve.has(qcSummaryPath(BOOK, ROUND)));
    assert.ok(preserve.has(repairLedgerPath(BOOK, ROUND)));
    assert.equal(plan.remove.some((p) => p === evidenceMatrixPath(BOOK, ROUND)), false);
    assert.equal(plan.remove.some((p) => p === qcSummaryPath(BOOK, ROUND)), false);
    assert.equal(plan.remove.some((p) => p === repairLedgerPath(BOOK, ROUND)), false);
  } finally {
    cleanup();
  }
});

test("publish-after-qc keeps repair handoff files when the ledger still has open findings", () => {
  cleanup();
  try {
    write(repairPromptPath(BOOK, ROUND), "repair prompt");
    write(repairBriefPath(BOOK, ROUND), "repair brief");
    write(repairLedgerPath(BOOK, ROUND), JSON.stringify({
      schemaVersion: "qc-repair-ledger-event-v1",
      event: "finding",
      findingId: "qcf-open",
      bookId: BOOK,
      roundId: ROUND,
      chapterNumber: 1,
      unitId: "examples[0]",
      repairClass: "example_coherence",
      severity: "major",
      quote: "fixture",
      problem: "fixture open finding",
      expectedFix: "fix fixture",
      globalTheme: "example_coherence",
      status: "open",
      sources: [],
      createdAt: "2026-06-13T00:00:00.000Z",
    }) + "\n");

    const plan = transientCleanupPlan(BOOK, ROUND);
    assert.equal(plan.remove.includes(repairPromptPath(BOOK, ROUND)), false);
    assert.equal(plan.remove.includes(repairBriefPath(BOOK, ROUND)), false);
    assert.ok(plan.preserve.includes(repairPromptPath(BOOK, ROUND)));
    assert.ok(plan.preserve.includes(repairBriefPath(BOOK, ROUND)));
  } finally {
    cleanup();
  }
});
