import assert from "node:assert/strict";
import { spawnSync } from "child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmdirSync, rmSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";

import { test } from "./harness.js";
import { PIPELINE_DIR, STATE_CHAPTERS, STATE_INDEXES, makeChapter, makeSourceV2SidecarFixture, writeCanonicalIndexFixture, writeFixtureBook, writeResearchRunManifestFixture } from "./helpers.js";
import { REPO_ROOT } from "../src/lib/chapterPaths.js";
import { orchestratorRoundDir } from "../src/qc/orchestrator/artifacts.js";
import { keyPackDir } from "../src/qc/manualKeyJudge.js";
import { qcRoundPath } from "../src/qc/qcRound.js";

const BOOK = "zz-fixture-qc-auto-create";
const ROUND = "r-auto-create";
const RUN = "20260612T010000Z";
const QC_PACK_BOOK_DIR = dirname(keyPackDir(BOOK, ROUND));
const QC_PACKS_DIR = dirname(QC_PACK_BOOK_DIR);
const QC_ORCHESTRATOR_BOOK_DIR = dirname(orchestratorRoundDir(BOOK, ROUND));
const QC_ORCHESTRATOR_DIR = dirname(QC_ORCHESTRATOR_BOOK_DIR);
const QC_ROUNDS_DIR = dirname(qcRoundPath(BOOK, ROUND));
const QC_PACKS_DIR_EXISTED = existsSync(QC_PACKS_DIR);
const QC_ORCHESTRATOR_DIR_EXISTED = existsSync(QC_ORCHESTRATOR_DIR);
const QC_ROUNDS_DIR_EXISTED = existsSync(QC_ROUNDS_DIR);

function pruneSharedDir(path: string, existedBefore: boolean): void {
  if (!existedBefore && existsSync(path) && readdirSync(path).length === 0) rmdirSync(path);
}

function cleanup(): void {
  for (const n of [1, 2]) rmSync(resolve(STATE_CHAPTERS, `${BOOK}-ch${String(n).padStart(2, "0")}.v21-native.chapter.json`), { force: true });
  rmSync(resolve(STATE_INDEXES, `${BOOK}.json`), { force: true });
  rmSync(resolve(REPO_ROOT, ".chapterflow/runs", BOOK), { recursive: true, force: true });
  rmSync(QC_ORCHESTRATOR_BOOK_DIR, { recursive: true, force: true });
  rmSync(QC_PACK_BOOK_DIR, { recursive: true, force: true });
  rmSync(qcRoundPath(BOOK, ROUND), { force: true });
  pruneSharedDir(QC_ORCHESTRATOR_DIR, QC_ORCHESTRATOR_DIR_EXISTED);
  pruneSharedDir(QC_PACKS_DIR, QC_PACKS_DIR_EXISTED);
  pruneSharedDir(QC_ROUNDS_DIR, QC_ROUNDS_DIR_EXISTED);
}

function setup(): void {
  cleanup();
  const chapters = [makeChapter(BOOK, 1), makeChapter(BOOK, 2)];
  writeFixtureBook(STATE_CHAPTERS, chapters);
  writeCanonicalIndexFixture(BOOK, chapters);
  const dir = resolve(REPO_ROOT, ".chapterflow/runs", BOOK, RUN, "sidecars/source");
  mkdirSync(dir, { recursive: true });
  writeResearchRunManifestFixture({
    runDir: resolve(REPO_ROOT, ".chapterflow/runs", BOOK, RUN),
    bookId: BOOK,
    chapters: chapters.map((ch) => ({ number: ch.number, title: ch.title })),
  });
  for (const chapter of chapters) {
    writeFileSync(
      resolve(dir, `ch${String(chapter.number).padStart(2, "0")}.source.json`),
      `${JSON.stringify(makeSourceV2SidecarFixture({ chapterNumber: chapter.number, chapterTitle: chapter.title }), null, 2)}\n`,
      "utf8",
    );
  }
}

function runQcAuto(envOn: boolean): { status: number; out: string } {
  const env = { ...process.env };
  if (envOn) env.CHAPTERFLOW_NO_API_CODEX_QC = "1";
  else delete env.CHAPTERFLOW_NO_API_CODEX_QC;
  // Synthetic 2-chapter fixture intentionally fails book-gate; this test exercises
  // the qc-auto round MECHANICS, so it opts out of the F6a preflight block.
  const r = spawnSync("npx", ["tsx", "src/cli.ts", "qc-auto", BOOK, "--pass", "--round", ROUND, "--chapters", "1", "--dry-run", "--allow-dirty-preflight"], {
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

test("qc-auto refuses to reuse a stale round after chapter repair", () => {
  try {
    setup();
    const first = runQcAuto(true);
    assert.equal(first.status, 0, first.out);
    const chapterPath = resolve(STATE_CHAPTERS, `${BOOK}-ch01.v21-native.chapter.json`);
    const chapter = JSON.parse(readFileSync(chapterPath, "utf8"));
    chapter.hook = `${chapter.hook} The repair changed this content.`;
    writeFileSync(chapterPath, JSON.stringify(chapter, null, 2), "utf8");
    const reused = runQcAuto(true);
    assert.equal(reused.status, 3, reused.out);
    assert.match(reused.out, /STALE_ROUND/);
    assert.match(reused.out, /This round is stale after repair/);
    assert.match(reused.out, /Start a fresh QC round/);
  } finally {
    cleanup();
  }
});
