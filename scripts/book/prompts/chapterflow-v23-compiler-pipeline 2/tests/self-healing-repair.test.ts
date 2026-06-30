import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "fs";
import { resolve } from "path";

import { test } from "./harness.js";
import { PIPELINE_DIR, STATE_INDEXES, runCli } from "./helpers.js";
import {
  errorWithRepairPrompt,
  repairPromptPathFromError,
  writeSelfHealingRepairPrompt,
} from "../src/repair/selfHealingRepair.js";

const TMP_STATE = resolve(PIPELINE_DIR, "tests/.tmp/self-healing-state");

test("writeSelfHealingRepairPrompt emits a detailed markdown prompt and machine-readable sidecar", () => {
  rmSync(TMP_STATE, { recursive: true, force: true });
  mkdirSync(TMP_STATE, { recursive: true });
  const result = writeSelfHealingRepairPrompt({
    bookId: "zz-selfheal",
    title: "Self Heal",
    author: "Tester",
    runId: "r1",
    stage: "ship-gate",
    severity: "blocker",
    chapter: { chapterId: "zz-selfheal-ch01", chapterNumber: 1, chapterTitle: "Broken Chapter" },
    summary: "Ship gate blocked a chapter.",
    findings: [{
      id: "B4",
      severity: "blocker",
      unit: "hook",
      message: "Banned phrase appeared in hook.",
      evidence: "That matters because...",
      expectedFix: "Rewrite the hook without the banned phrase while preserving the claim.",
    }],
    stateRoot: TMP_STATE,
  });

  assert.ok(existsSync(result.promptPath), "markdown prompt must be written");
  assert.ok(existsSync(result.reportPath), "json sidecar must be written");
  const prompt = readFileSync(result.promptPath, "utf8");
  assert.match(prompt, /fresh ChapterFlow repair agent/);
  assert.match(prompt, /Do not weaken gates/);
  assert.match(prompt, /Rewrite the hook without the banned phrase/);
  assert.match(prompt, /author-check state\/chapters\/zz-selfheal-ch01\.v21-native\.chapter\.json/);
  assert.match(prompt, /gate-chapter state\/chapters\/zz-selfheal-ch01\.v21-native\.chapter\.json/);

  const sidecar = JSON.parse(readFileSync(result.reportPath, "utf8"));
  assert.equal(sidecar.schemaVersion, "chapterflow-self-healing-repair-v1");
  assert.equal(sidecar.findings[0].id, "B4");

  const wrapped = errorWithRepairPrompt("blocked", result);
  assert.equal(repairPromptPathFromError(wrapped), result.promptPath);
});

test("pipeline source-gate failure writes a repair prompt before generation tokens are spent", () => {
  const bookId = "zz-selfheal-pipeline";
  const runId = "zz-selfheal-pipeline-run";
  const indexPath = resolve(STATE_INDEXES, `${bookId}.json`);
  const repairsDir = resolve(PIPELINE_DIR, "state", "repairs", bookId);
  try {
    mkdirSync(STATE_INDEXES, { recursive: true });
    rmSync(indexPath, { force: true });
    rmSync(repairsDir, { recursive: true, force: true });
    writeFileSync(indexPath, JSON.stringify([
      { chapterId: `${bookId}-ch01`, chapterNumber: 1, chapterTitle: "The Missing Source" },
    ], null, 2), "utf8");

    const cli = runCli([
      "pipeline",
      bookId,
      "--title", "Self Heal Pipeline",
      "--author", "Tester",
      "--run-id", runId,
      "--skip-research",
      "--allow-doctor-fatal",
      "--no-model-gen",
      "--no-publish",
    ], { CHAPTERFLOW_ALLOW_MODEL_GEN: undefined });

    assert.equal(cli.status, 2, cli.out);
    assert.match(cli.out, /Source gate blocked before generation/);
    assert.match(cli.out, /Repair prompt:/);
    const runRepairDir = resolve(repairsDir, runId);
    const prompts = readdirSync(runRepairDir).filter((f) => f.endsWith(".repair.md"));
    assert.equal(prompts.length, 1, "one source repair prompt should be written");
    const prompt = readFileSync(resolve(runRepairDir, prompts[0]), "utf8");
    assert.match(prompt, /stage: `source`/);
    assert.match(prompt, /SV2\.missing_sidecar/);
    assert.match(prompt, /Do not let a writer invent facts/);
    assert.match(prompt, /source-v2-gate zz-selfheal-pipeline/);
  } finally {
    rmSync(indexPath, { force: true });
    rmSync(repairsDir, { recursive: true, force: true });
  }
});
