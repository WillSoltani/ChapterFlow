import assert from "node:assert/strict";
import { spawnSync } from "child_process";
import { mkdirSync, rmSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";

import { test } from "./harness.js";
import { PIPELINE_DIR, TMP_DIR, cleanTmp, makeChapter } from "./helpers.js";
import { loadAuthorProvenance, provenancePath } from "../src/qc/sessionProvenance.js";

const BOOK = "zz-fixture-author-provenance";
const CHAPTER_ID = `${BOOK}-ch01`;

function cleanup(): void {
  cleanTmp();
  rmSync(provenancePath(CHAPTER_ID), { force: true });
}

test("applyAuthored stamps author provenance for manually accepted chapter content", () => {
  try {
    cleanup();
    const chapterPath = resolve(TMP_DIR, `${CHAPTER_ID}.v21-native.chapter.json`);
    const patchPath = resolve(TMP_DIR, "manual-patch.json");
    mkdirSync(dirname(chapterPath), { recursive: true });
    writeFileSync(chapterPath, JSON.stringify(makeChapter(BOOK, 1), null, 2) + "\n", "utf8");
    writeFileSync(patchPath, JSON.stringify({ coreSkill: "Compare the source note before routing the next visible action." }, null, 2), "utf8");

    const result = spawnSync("npx", ["tsx", "src/scratch/applyAuthored.ts", chapterPath, patchPath], {
      cwd: PIPELINE_DIR,
      encoding: "utf8",
      env: { ...process.env, CHAPTERFLOW_SESSION_ID: "manual-author-session" },
      timeout: 30_000,
    });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.equal(loadAuthorProvenance(CHAPTER_ID)?.authorSessionId, "manual-author-session");
  } finally {
    cleanup();
  }
});

test("applyAuthored refuses manual acceptance without CHAPTERFLOW_SESSION_ID", () => {
  try {
    cleanup();
    const chapterPath = resolve(TMP_DIR, `${CHAPTER_ID}.v21-native.chapter.json`);
    const patchPath = resolve(TMP_DIR, "manual-patch.json");
    mkdirSync(dirname(chapterPath), { recursive: true });
    writeFileSync(chapterPath, JSON.stringify(makeChapter(BOOK, 1), null, 2) + "\n", "utf8");
    writeFileSync(patchPath, JSON.stringify({ coreSkill: "Compare the source note before routing the next visible action." }, null, 2), "utf8");
    const env = { ...process.env };
    delete env.CHAPTERFLOW_SESSION_ID;

    const result = spawnSync("npx", ["tsx", "src/scratch/applyAuthored.ts", chapterPath, patchPath], {
      cwd: PIPELINE_DIR,
      encoding: "utf8",
      env,
      timeout: 30_000,
    });
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /CHAPTERFLOW_SESSION_ID/);
    assert.equal(loadAuthorProvenance(CHAPTER_ID), null);
  } finally {
    cleanup();
  }
});
