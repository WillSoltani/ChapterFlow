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

function withSession<T>(sessionId: string | undefined, fn: () => T): T {
  const prev = process.env.CHAPTERFLOW_SESSION_ID;
  try {
    if (sessionId === undefined) delete process.env.CHAPTERFLOW_SESSION_ID;
    else process.env.CHAPTERFLOW_SESSION_ID = sessionId;
    return fn();
  } finally {
    if (prev === undefined) delete process.env.CHAPTERFLOW_SESSION_ID;
    else process.env.CHAPTERFLOW_SESSION_ID = prev;
  }
}

function submissionPath(overrides: Record<string, unknown> = {}): string {
  mkdirSync(TMP_DIR, { recursive: true });
  const path = resolve(TMP_DIR, String(overrides.fileName ?? "sweep-submission.json"));
  const { fileName: _fileName, ...bodyOverrides } = overrides;
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
    ...bodyOverrides,
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
    const result = withSession("qc-submit-session-a", () => submitQcArtifact(BOOK, ROUND, "sweep", submissionPath(), tokens.sweep));
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

test("qc-submit rejects new submissions when the submitter session id is missing", () => {
  try {
    cleanup();
    const { tokens } = openQcRound(BOOK, ROUND);
    const result = withSession(undefined, () => submitQcArtifact(BOOK, ROUND, "sweep", submissionPath(), tokens.sweep));
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /CHAPTERFLOW_SESSION_ID|reviewerSessionId/i);
  } finally {
    cleanup();
  }
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test("qc-submit retry of identical content is idempotent", async () => {
  try {
    cleanup();
    const { tokens } = openQcRound(BOOK, ROUND);
    const file = submissionPath();
    const first = withSession("qc-submit-session-a", () => submitQcArtifact(BOOK, ROUND, "sweep", file, tokens.sweep));
    await sleep(5);
    const second = withSession("qc-submit-session-a", () => submitQcArtifact(BOOK, ROUND, "sweep", file, tokens.sweep));
    assert.equal(first.ok, true, first.errors.join("\n"));
    assert.equal(second.ok, true, second.errors.join("\n"));
    assert.equal(second.path, first.path, "retrying the same logical submission should return the existing content-addressed path");
  } finally {
    cleanup();
  }
});

test("qc-submit rejects different content for the same reviewer identity", () => {
  try {
    cleanup();
    const { tokens } = openQcRound(BOOK, ROUND);
    const firstFile = submissionPath({ fileName: "sweep-a.json" });
    const changedFile = submissionPath({ fileName: "sweep-b.json", reviewer: "codex-qc:sweep", checkedFamilies: ["scene_skeleton", "persona_drift", "repeated_unit", "location_stamping"], notes: "changed content" });
    const first = withSession("qc-submit-session-a", () => submitQcArtifact(BOOK, ROUND, "sweep", firstFile, tokens.sweep));
    const changed = withSession("qc-submit-session-a", () => submitQcArtifact(BOOK, ROUND, "sweep", changedFile, tokens.sweep));
    assert.equal(first.ok, true, first.errors.join("\n"));
    assert.equal(changed.ok, false, "same role/session identity must not overwrite different raw evidence");
    assert.match(changed.errors.join("\n"), /different content|already exists|idempotent/i);
  } finally {
    cleanup();
  }
});
