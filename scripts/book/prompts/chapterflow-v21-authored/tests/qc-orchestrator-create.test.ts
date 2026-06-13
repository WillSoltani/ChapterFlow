import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { resolve } from "path";

import { test } from "./harness.js";
import { makeChapter, STATE_CHAPTERS, writeFixtureBook } from "./helpers.js";
import { chapterContentHash } from "../src/critics/qcAttestation.js";
import { REPO_ROOT } from "../src/lib/chapterPaths.js";
import { createQcOrchestrationRound } from "../src/qc/orchestrator/index.js";
import { orchestratorRoundDir, roundRecordPath, taskCardsDir } from "../src/qc/orchestrator/artifacts.js";
import { keyPackDir } from "../src/qc/manualKeyJudge.js";
import { qcRoundPath } from "../src/qc/qcRound.js";

const BOOK = "zz-fixture-qc-orch-create";
const ROUND = "r-orch-create";
const RUN = "20260612T000000Z";

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

test("qc orchestrator create requires no-api Codex QC mode", () => {
  const prev = process.env.CHAPTERFLOW_NO_API_CODEX_QC;
  try {
    delete process.env.CHAPTERFLOW_NO_API_CODEX_QC;
    const result = createQcOrchestrationRound(BOOK, { roundId: ROUND });
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /CHAPTERFLOW_NO_API_CODEX_QC=1/);
  } finally {
    if (prev === undefined) delete process.env.CHAPTERFLOW_NO_API_CODEX_QC;
    else process.env.CHAPTERFLOW_NO_API_CODEX_QC = prev;
    cleanup();
  }
});

test("qc orchestrator create writes round layout, packs, and role task cards", () => {
  const prev = process.env.CHAPTERFLOW_NO_API_CODEX_QC;
  try {
    process.env.CHAPTERFLOW_NO_API_CODEX_QC = "1";
    setup();
    const result = createQcOrchestrationRound(BOOK, { roundId: ROUND, chapters: [1] });
    assert.equal(result.ok, true, result.errors.join("\n"));
    assert.ok(existsSync(roundRecordPath(BOOK, ROUND)));
    assert.ok(existsSync(resolve(taskCardsDir(BOOK, ROUND), "00-sweep.md")));
    assert.ok(existsSync(resolve(taskCardsDir(BOOK, ROUND), "01-keyA.md")));
    assert.ok(existsSync(resolve(taskCardsDir(BOOK, ROUND), "bar", "ch01.md")));
    assert.equal(existsSync(resolve(taskCardsDir(BOOK, ROUND), "confirm", "ch01.md")), false);
    assert.ok(existsSync(resolve(taskCardsDir(BOOK, ROUND), "majors.md")));
    const keyCard = readFileSync(resolve(taskCardsDir(BOOK, ROUND), "01-keyA.md"), "utf8");
    assert.match(keyCard, /Read ONLY the blind key packs and their sourceFacts/);
    assert.match(keyCard, /Never open `state\/chapters`/);
    const barCard = readFileSync(resolve(taskCardsDir(BOOK, ROUND), "bar", "ch01.md"), "utf8");
    const expectedHash = chapterContentHash(makeChapter(BOOK, 1));
    assert.match(barCard, new RegExp(`Required artifact contentHash: ${expectedHash}\\.`));
    assert.doesNotMatch(barCard, new RegExp(`Required artifact contentHash: ${BOOK}-ch01\\.`));
    const round = JSON.parse(readFileSync(roundRecordPath(BOOK, ROUND), "utf8"));
    assert.deepEqual(round.chapters, [1]);
    assert.equal(round.schemaVersion, "qc-orchestrator-round-v1");
  } finally {
    if (prev === undefined) delete process.env.CHAPTERFLOW_NO_API_CODEX_QC;
    else process.env.CHAPTERFLOW_NO_API_CODEX_QC = prev;
    cleanup();
  }
});
