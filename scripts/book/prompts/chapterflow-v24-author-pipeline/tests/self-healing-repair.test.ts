import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync } from "fs";
import { resolve } from "path";

import { test } from "./harness.js";
import { PIPELINE_DIR } from "./helpers.js";
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

test("source-gate failure renders a repair prompt before generation tokens are spent", () => {
  const bookId = "zz-selfheal-pipeline";
  const runId = "zz-selfheal-pipeline-run";
  const repairsDir = resolve(TMP_STATE, "repairs", bookId);
  try {
    rmSync(repairsDir, { recursive: true, force: true });
    const result = writeSelfHealingRepairPrompt({
      bookId,
      title: "Self Heal Pipeline",
      author: "Tester",
      runId,
      stage: "source",
      severity: "blocker",
      chapter: { chapterId: `${bookId}-ch01`, chapterNumber: 1, chapterTitle: "The Missing Source" },
      summary: "Source gate blocked before generation.",
      findings: [{
        id: "SV2.missing_sidecar",
        severity: "blocker",
        unit: "source.sidecar",
        message: "Required source-v2 sidecar is missing.",
        expectedFix: "Create and validate the chapter source-v2 sidecar before authoring.",
      }],
      stateRoot: TMP_STATE,
      createdAt: "2026-07-21T12:00:00.000Z",
    });

    assert.ok(existsSync(result.promptPath), "source repair prompt should be written");
    assert.ok(existsSync(result.reportPath), "source repair report should be written");
    const prompt = readFileSync(result.promptPath, "utf8");
    assert.match(prompt, /stage: `source`/);
    assert.match(prompt, /SV2\.missing_sidecar/);
    assert.match(prompt, /Do not let a writer invent facts/);
    assert.match(prompt, /source-v2-gate zz-selfheal-pipeline/);
  } finally {
    rmSync(repairsDir, { recursive: true, force: true });
  }
});
