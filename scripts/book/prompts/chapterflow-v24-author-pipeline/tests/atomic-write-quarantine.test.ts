/**
 * Crash-safety primitives (H5/H6 guard). The PR's "walk-away conductor never wedges" thesis
 * rests on these, so lock them in:
 *  - writeFileAtomic: atomic (tmp+rename), no .tmp leftover, overwrites cleanly.
 *  - quarantineCorruptChapterFiles: a torn chapter is moved aside so loadBookChapters recovers
 *    (treated as missing → re-authored) instead of throwing and wedging the conductor.
 *  - runShipGate: a malformed quiz (missing/null choices, out-of-range correctIndex, non-string
 *    bloomsLevel) yields a FINDING, never an unhandled crash.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, rmdirSync, rmSync, writeFileSync } from "fs";
import { resolve } from "path";

import { test } from "./harness.js";
import { makeChapter, STATE_CHAPTERS, writeFixtureBook } from "./helpers.js";
import { writeFileAtomic } from "../src/lib/atomicWrite.js";
import { quarantineCorruptChapterFiles, loadBookChapters } from "../src/qc/manualKeyJudge.js";
import { CHAPTERS_DIR } from "../src/lib/chapterPaths.js";
import { runShipGate } from "../src/critics/finalGate.js";
import type { ChapterV21 } from "../src/types.js";

const BOOK = "zz-fixture-atomic-quarantine";
const CORRUPT_DIR = resolve(CHAPTERS_DIR, "_corrupt");
const CORRUPT_DIR_EXISTED = existsSync(CORRUPT_DIR);

function cleanup(): void {
  for (const f of readdirSync(CHAPTERS_DIR)) {
    if (f.startsWith(BOOK)) rmSync(resolve(CHAPTERS_DIR, f), { force: true });
  }
  try { for (const f of readdirSync(CORRUPT_DIR)) if (f.startsWith(BOOK)) rmSync(resolve(CORRUPT_DIR, f), { force: true }); } catch { /* none */ }
  if (!CORRUPT_DIR_EXISTED && existsSync(CORRUPT_DIR) && readdirSync(CORRUPT_DIR).length === 0) rmdirSync(CORRUPT_DIR);
}

test("writeFileAtomic writes valid content, overwrites, and leaves no .tmp behind", () => {
  cleanup();
  const p = resolve(CHAPTERS_DIR, `${BOOK}-scratch.json`);
  try {
    writeFileAtomic(p, JSON.stringify({ a: 1 }, null, 2));
    assert.equal(JSON.parse(readFileSync(p, "utf8")).a, 1);
    writeFileAtomic(p, JSON.stringify({ a: 2 }, null, 2)); // overwrite
    assert.equal(JSON.parse(readFileSync(p, "utf8")).a, 2);
    const leftovers = readdirSync(CHAPTERS_DIR).filter((f) => f.startsWith(`${BOOK}-scratch.json.tmp-`));
    assert.equal(leftovers.length, 0, `no .tmp sibling must remain: ${leftovers.join(", ")}`);
  } finally {
    rmSync(p, { force: true });
  }
});

test("quarantineCorruptChapterFiles recovers a torn chapter so loadBookChapters stops throwing", () => {
  const oldWarn = console.warn;
  console.warn = () => {};
  try {
    cleanup();
    const ch = makeChapter(BOOK, 1);
    writeFixtureBook(STATE_CHAPTERS, [ch]);
    // Simulate a SIGKILL mid-write: a truncated chapter JSON.
    const file = resolve(CHAPTERS_DIR, `${BOOK}-ch01.v21-native.chapter.json`);
    writeFileSync(file, '{ "chapterId": "zz-fixture-atomic-quarantine-ch01", "num', "utf8");
    // The wedge: loadBookChapters throws on the torn file.
    assert.throws(() => loadBookChapters(BOOK), /Failed to parse chapter file/);
    // Quarantine moves it aside → treated as missing → re-authored next round.
    const moved = quarantineCorruptChapterFiles(BOOK);
    assert.equal(moved.length, 1, "the torn chapter must be quarantined");
    assert.doesNotThrow(() => loadBookChapters(BOOK), "after quarantine, loadBookChapters must not throw");
    assert.equal(loadBookChapters(BOOK).length, 0, "the quarantined chapter is gone (treated as missing)");
    assert.ok(existsSync(CORRUPT_DIR), "the corrupt bytes are preserved under _corrupt/");
  } finally {
    console.warn = oldWarn;
    cleanup();
  }
});

function quizMutant(mut: (q: any) => void): ChapterV21 {
  const ch = makeChapter(BOOK, 1);
  mut(ch.quiz.questions[0]);
  return ch;
}

test("runShipGate yields a finding (never throws) on a malformed quiz question", () => {
  const oldWarn = console.warn;
  console.warn = () => {};
  try {
    const cases: Array<[string, (q: any) => void]> = [
      ["missing choices", (q) => { delete q.choices; }],
      ["null choices", (q) => { q.choices = null; }],
      ["correctIndex out of range", (q) => { q.correctIndex = 3; }],
      ["correctIndex negative", (q) => { q.correctIndex = -1; }],
      ["non-string bloomsLevel", (q) => { q.bloomsLevel = 3; }],
    ];
    for (const [name, mut] of cases) {
      const ch = quizMutant(mut);
      let report;
      assert.doesNotThrow(() => { report = runShipGate(ch); }, `runShipGate must not throw on ${name}`);
      const all = [...report!.blockers, ...report!.majors, ...report!.minors];
      // The quiz-schema family: A5 (choices/correctIndex structural), A1/A2/A3 (enum validity, incl.
      // the non-string bloomsLevel guard), or any schema.* finding.
      const quizSchema = new Set(["A5", "A1", "A2", "A3"]);
      assert.ok(all.some((f) => quizSchema.has(f.catalogId) || f.catalogId.startsWith("schema")), `${name} must produce a quiz-schema finding, got: ${all.map((f) => f.catalogId).join(", ") || "(none)"}`);
    }
    // And a valid correctIndex of 0 must NOT be flagged (falsy-zero guard).
    const clean = quizMutant((q) => { q.correctIndex = 0; });
    const cleanFindings = [...runShipGate(clean).blockers, ...runShipGate(clean).majors].filter((f) => f.message?.includes("correctIndex"));
    assert.equal(cleanFindings.length, 0, "correctIndex=0 is valid and must not be flagged");
  } finally {
    console.warn = oldWarn;
    cleanup();
  }
});
