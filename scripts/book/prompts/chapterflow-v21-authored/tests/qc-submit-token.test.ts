import assert from "node:assert/strict";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { resolve } from "path";

import { test } from "./harness.js";
import { TMP_DIR, cleanTmp } from "./helpers.js";
import { submitQcArtifact } from "../src/qc/orchestrator/index.js";
import { orchestratorRoundDir } from "../src/qc/orchestrator/artifacts.js";
import { openQcRound, qcRoundPath } from "../src/qc/qcRound.js";

const BOOK = "zz-fixture-qc-submit-token";
const ROUND = "r-submit-token";

function cleanup(): void {
  cleanTmp();
  rmSync(orchestratorRoundDir(BOOK, ROUND), { recursive: true, force: true });
  rmSync(qcRoundPath(BOOK, ROUND), { force: true });
}

function submissionPath(): string {
  mkdirSync(TMP_DIR, { recursive: true });
  const path = resolve(TMP_DIR, "sweep-submission.json");
  writeFileSync(path, JSON.stringify({
    schemaVersion: "qc-sweep-submission-v1",
    bookId: BOOK,
    roundId: ROUND,
    role: "sweep",
    reviewer: "codex-qc:sweep",
    token: "should-not-be-stored",
    verdict: "PASS",
    checkedFamilies: ["scene_skeleton", "persona_drift", "repeated_unit", "location_stamping"],
    findings: [],
  }, null, 2), "utf8");
  return path;
}

test("qc-submit rejects missing token", () => {
  try {
    cleanup();
    openQcRound(BOOK, ROUND);
    const result = submitQcArtifact(BOOK, ROUND, "sweep", submissionPath(), "");
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /requires --token/);
  } finally {
    cleanup();
  }
});

test("qc-submit rejects wrong role token", () => {
  try {
    cleanup();
    const { tokens } = openQcRound(BOOK, ROUND);
    const result = submitQcArtifact(BOOK, ROUND, "sweep", submissionPath(), tokens.keyA);
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /Invalid sweep token/);
  } finally {
    cleanup();
  }
});

test("qc-submit accepts correct token and stores metadata without plaintext token", () => {
  try {
    cleanup();
    const { tokens } = openQcRound(BOOK, ROUND);
    const result = submitQcArtifact(BOOK, ROUND, "sweep", submissionPath(), tokens.sweep);
    assert.equal(result.ok, true, result.errors.join("\n"));
    assert.ok(result.path);
    const stored = readFileSync(result.path!, "utf8");
    assert.doesNotMatch(stored, /should-not-be-stored/);
    assert.doesNotMatch(stored, new RegExp(tokens.sweep.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    const meta = readFileSync(`${result.path}.meta.json`, "utf8");
    assert.match(meta, /"roleVerified": true/);
    assert.match(meta, /"verifiedRole": "sweep"/);
    assert.doesNotMatch(meta, new RegExp(tokens.sweep.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  } finally {
    cleanup();
  }
});
