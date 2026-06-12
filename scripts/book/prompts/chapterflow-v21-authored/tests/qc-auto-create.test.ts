import assert from "node:assert/strict";
import { spawnSync } from "child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { resolve } from "path";

import { test } from "./harness.js";
import { PIPELINE_DIR, STATE_CHAPTERS, makeChapter, writeFixtureBook } from "./helpers.js";
import { REPO_ROOT } from "../src/lib/chapterPaths.js";
import { orchestratorRoundDir } from "../src/qc/orchestrator/artifacts.js";
import { keyPackDir } from "../src/qc/manualKeyJudge.js";
import { qcRoundPath } from "../src/qc/qcRound.js";

const BOOK = "zz-fixture-qc-auto-create";
const ROUND = "r-auto-create";
const RUN = "20260612T010000Z";

function sourceSidecar(n: number): any {
  return {
    schemaVersion: "source-v2",
    chapterNumber: n,
    chapterTitle: `Chapter ${n}`,
    centralConcept: { id: `concept${n}`, name: "Fixture concept", plainDefinition: "A concrete unit-test concept." },
    namedExamples: [0, 1, 2].map((i) => ({ id: `ex${i}`, label: `Example ${i}`, summary: `Example ${i} summary.`, hardSpecifics: [`specific ${i}a`, `specific ${i}b`], realWorld: true })),
    testableFacts: Array.from({ length: 9 }, (_, i) => ({
      id: `fact${i}`,
      claim: `Claim ${i} for chapter ${n}.`,
      becauseMechanism: `Mechanism ${i} explains the fixture.`,
      commonError: `Common error ${i}.`,
      errorIsWhy: `The error misses mechanism ${i}.`,
    })),
  };
}

function cleanup(): void {
  for (const n of [1, 2]) rmSync(resolve(STATE_CHAPTERS, `${BOOK}-ch${String(n).padStart(2, "0")}.v21-native.chapter.json`), { force: true });
  rmSync(resolve(REPO_ROOT, ".chapterflow/runs", BOOK), { recursive: true, force: true });
  rmSync(orchestratorRoundDir(BOOK, ROUND), { recursive: true, force: true });
  rmSync(keyPackDir(BOOK, ROUND), { recursive: true, force: true });
  rmSync(qcRoundPath(BOOK, ROUND), { force: true });
}

function setup(): void {
  cleanup();
  writeFixtureBook(STATE_CHAPTERS, [makeChapter(BOOK, 1), makeChapter(BOOK, 2)]);
  const dir = resolve(REPO_ROOT, ".chapterflow/runs", BOOK, RUN, "sidecars/source");
  mkdirSync(dir, { recursive: true });
  for (const n of [1, 2]) writeFileSync(resolve(dir, `ch${String(n).padStart(2, "0")}.source.json`), JSON.stringify(sourceSidecar(n), null, 2), "utf8");
}

function runQcAuto(envOn: boolean): { status: number; out: string } {
  const env = { ...process.env };
  if (envOn) env.CHAPTERFLOW_NO_API_CODEX_QC = "1";
  else delete env.CHAPTERFLOW_NO_API_CODEX_QC;
  const r = spawnSync("npx", ["tsx", "src/cli.ts", "qc-auto", BOOK, "--pass", "--round", ROUND, "--chapters", "1", "--dry-run"], {
    cwd: PIPELINE_DIR,
    env,
    encoding: "utf8",
    timeout: 180_000,
  });
  return { status: r.status ?? -1, out: `${r.stdout ?? ""}\n${r.stderr ?? ""}` };
}

test("qc-auto requires CHAPTERFLOW_NO_API_CODEX_QC=1", () => {
  try {
    cleanup();
    const result = runQcAuto(false);
    assert.equal(result.status, 2);
    assert.match(result.out, /export CHAPTERFLOW_NO_API_CODEX_QC=1/);
  } finally {
    cleanup();
  }
});

test("qc-auto creates round, workflow, task cards, and packs in dry-run manual mode", () => {
  try {
    setup();
    const result = runQcAuto(true);
    assert.equal(result.status, 0, result.out);
    assert.match(result.out, /QC AUTO INCOMPLETE/);
    assert.ok(existsSync(resolve(orchestratorRoundDir(BOOK, ROUND), "qc-auto.workflow.js")));
    assert.ok(existsSync(resolve(orchestratorRoundDir(BOOK, ROUND), "task-cards/00-sweep.md")));
    assert.ok(existsSync(resolve(orchestratorRoundDir(BOOK, ROUND), "task-cards/bar/ch01.md")));
    assert.ok(existsSync(resolve(keyPackDir(BOOK, ROUND), "sweep-pack.json")));
    assert.ok(existsSync(resolve(keyPackDir(BOOK, ROUND), "bar-pack.json")));
  } finally {
    cleanup();
  }
});
