import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, rmdirSync, rmSync } from "fs";
import { dirname, resolve } from "path";

import { test } from "./harness.js";
import { STATE_CHAPTERS, makeChapter, writeFixtureBook } from "./helpers.js";
import { keyPackDir } from "../src/qc/manualKeyJudge.js";
import { writeSweepPack } from "../src/qc/sweep.js";

const BOOK = "zz-fixture-sweep-pack";
const ROUND = "r-sweep-pack";
const QC_PACK_BOOK_DIR = dirname(keyPackDir(BOOK, ROUND));
const QC_PACKS_DIR = dirname(QC_PACK_BOOK_DIR);
const QC_PACKS_DIR_EXISTED = existsSync(QC_PACKS_DIR);

function cleanup(): void {
  rmSync(resolve(STATE_CHAPTERS, `${BOOK}-ch01.v21-native.chapter.json`), { force: true });
  rmSync(QC_PACK_BOOK_DIR, { recursive: true, force: true });
  if (!QC_PACKS_DIR_EXISTED && existsSync(QC_PACKS_DIR) && readdirSync(QC_PACKS_DIR).length === 0) rmdirSync(QC_PACKS_DIR);
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
    // REGRESSION: the pack must NOT duplicate the 24h-challenge into a phantom `challenge`
    // field. The old `challenge ?? twentyFourHourChallenge` fallback did, and the sweep then
    // correctly flagged "challenge == twentyFourHourChallenge verbatim" as repeated_unit on
    // EVERY chapter — a pack artifact that false-gated whole books.
    assert.ok(ch.implementationPlan.twentyFourHourChallenge, "fixture has a 24h challenge");
    assert.equal(ch.implementationPlan.challenge, undefined, "no phantom `challenge` duplicate of the 24h challenge");
    assert.ok(ch.memorableLines.length > 0);
    assert.doesNotMatch(text, /correctIndex/);
    assert.doesNotMatch(text, /sourceAnchorId/);
    assert.doesNotMatch(text, /planSpec/);
  } finally {
    cleanup();
  }
});
