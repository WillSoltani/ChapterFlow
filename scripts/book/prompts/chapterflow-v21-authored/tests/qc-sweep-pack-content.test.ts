import assert from "node:assert/strict";
import { readFileSync, rmSync } from "fs";
import { resolve } from "path";

import { test } from "./harness.js";
import { STATE_CHAPTERS, makeChapter, writeFixtureBook } from "./helpers.js";
import { keyPackDir } from "../src/qc/manualKeyJudge.js";
import { writeSweepPack } from "../src/qc/sweep.js";

const BOOK = "zz-fixture-sweep-pack";
const ROUND = "r-sweep-pack";

function cleanup(): void {
  rmSync(resolve(STATE_CHAPTERS, `${BOOK}-ch01.v21-native.chapter.json`), { force: true });
  rmSync(keyPackDir(BOOK, ROUND), { recursive: true, force: true });
}

test("sweep-pack contains reader-facing content and omits hidden/internal fields", () => {
  try {
    cleanup();
    writeFixtureBook(STATE_CHAPTERS, [makeChapter(BOOK, 1)]);
    const path = writeSweepPack(BOOK, ROUND);
    const text = readFileSync(path, "utf8");
    const pack = JSON.parse(text);
    const ch = pack.chapters[0];
    assert.equal(ch.chapterNumber, 1);
    assert.ok(ch.hook);
    assert.ok(ch.examples[0].scenario);
    assert.ok(ch.quiz[0].prompt);
    assert.ok(ch.quiz[0].choices.length > 0);
    assert.ok(ch.reviewCards[0].front);
    assert.ok(ch.implementationPlan.coreSkill);
    assert.ok(ch.memorableLines.length > 0);
    assert.doesNotMatch(text, /correctIndex/);
    assert.doesNotMatch(text, /sourceAnchorId/);
    assert.doesNotMatch(text, /planSpec/);
  } finally {
    cleanup();
  }
});
