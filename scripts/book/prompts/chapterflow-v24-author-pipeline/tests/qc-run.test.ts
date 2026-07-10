/**
 * Phase 2 tooling: quiz-blind / quiz-verify (the mechanical hidden-key
 * protocol) and the qc-run workflow generator.
 *
 * The point of quiz-blind/verify: "cover correctIndex with your hand" was an
 * honor-system sentence in QC-SESSION-PROMPT — the key and explanation sat in
 * the same JSON the reviewer had open. Now the reviewer derives from output
 * that PROVABLY contains no key, and the diff is mechanical.
 */

import assert from "node:assert/strict";
import { spawnSync } from "child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { resolve } from "path";

import { test, xenv } from "./harness.js";
import { cleanTmp, makeChapter, PIPELINE_DIR, runCli, STATE_CHAPTERS, TMP_DIR } from "./helpers.js";

const BOOK = "zz-fixture-blind";

/** The qc-run workflow generator resolves the REAL `daring-greatly` gold corpus (7
 *  chapters + its live rubric); it can't be synthesized without that book, so it is
 *  env-gated on the corpus (F-12) — RUNS where daring-greatly is on disk, xenv on a
 *  bare checkout. (The quiz-blind/quiz-verify tests below stay hermetic — they use a
 *  synthetic makeChapter fixture.) */
function daringGreatlyCorpusPresent(): boolean {
  return existsSync(resolve(STATE_CHAPTERS, "daring-greatly-ch01.v21-native.chapter.json")) &&
    existsSync(resolve(STATE_CHAPTERS, "daring-greatly-ch07.v21-native.chapter.json"));
}

function withChapterFile(fn: (file: string) => void): void {
  mkdirSync(TMP_DIR, { recursive: true });
  const ch = makeChapter(BOOK, 1);
  const file = resolve(TMP_DIR, `${ch.chapterId}.v21-native.chapter.json`);
  writeFileSync(file, JSON.stringify(ch, null, 2), "utf8");
  try {
    fn(file);
  } finally {
    cleanTmp();
  }
}

test("quiz-blind strips the key: no correctIndex/explanation/sourceAnchorId in output", () => {
  withChapterFile((file) => {
    const { status, out } = runCli(["quiz-blind", file]);
    assert.equal(status, 0, out.slice(-400));
    assert.doesNotMatch(out, /correctIndex/);
    assert.doesNotMatch(out, /explanation/);
    assert.doesNotMatch(out, /sourceAnchorId/);
    const payload = JSON.parse(out.slice(out.indexOf("{")));
    assert.equal(payload.questionCount, 9);
    assert.equal(payload.questions[0].questionIndex, 0);
    assert.ok(Array.isArray(payload.questions[0].choices) && payload.questions[0].choices.length === 3);
  });
});

test("quiz-verify: full correct derivation exits 0; one wrong answer exits 1 and names it", () => {
  withChapterFile((file) => {
    const ch = JSON.parse(readFileSync(file, "utf8"));
    const correct = ch.quiz.questions.map((q: any, i: number) => `${i}:${q.correctIndex}`).join(",");
    const ok = runCli(["quiz-verify", file, "--answers", correct]);
    assert.equal(ok.status, 0, ok.out.slice(-400));
    assert.match(ok.out, /9\/9 match/);

    const wrongAnswers = ch.quiz.questions
      .map((q: any, i: number) => `${i}:${i === 4 ? (q.correctIndex + 1) % 3 : q.correctIndex}`)
      .join(",");
    const bad = runCli(["quiz-verify", file, "--answers", wrongAnswers]);
    assert.equal(bad.status, 1);
    assert.match(bad.out, /q4: MISMATCH/);
    assert.match(bad.out, /keyed explanation:/, "adjudicators need the explanation to judge key vs derivation");
  });
});

test("quiz-verify: partial coverage fails (no passing by answering only the easy ones)", () => {
  withChapterFile((file) => {
    const ch = JSON.parse(readFileSync(file, "utf8"));
    const partial = ch.quiz.questions.slice(0, 5).map((q: any, i: number) => `${i}:${q.correctIndex}`).join(",");
    const r = runCli(["quiz-verify", file, "--answers", partial]);
    assert.equal(r.status, 1);
    assert.match(r.out, /MISSING/);
  });
});

xenv("qc-run generates a launchable workflow with live rubric + resolved chapters",
  "needs the `daring-greatly` gold corpus (7 chapters in state/chapters/) — absent on this checkout",
  daringGreatlyCorpusPresent,
  () => {
  const outPath = resolve(PIPELINE_DIR, "state", "qc-runs", "daring-greatly.workflow.js");
  const existed = existsSync(outPath) ? readFileSync(outPath, "utf8") : null;
  try {
    const { status, out } = runCli(["qc-run", "daring-greatly"]);
    assert.equal(status, 0, out.slice(-600));
    assert.match(out, /QC workflow generated/);
    const script = readFileSync(outPath, "utf8");
    assert.match(script, /^export const meta = \{/, "meta must open the script (workflow contract)");
    assert.doesNotMatch(script, /__CONFIG__/, "the CONFIG marker must be substituted");
    const configJson = script.slice(script.indexOf("const CONFIG = ") + "const CONFIG = ".length, script.indexOf("\nconst P ="));
    const config = JSON.parse(configJson);
    assert.equal(config.bookId, "daring-greatly");
    assert.equal(config.chapters.length, 7);
    assert.match(config.rubric.quiz_key_correctness, /Cover correctIndex/, "live rubric from publishableBar must be embedded");
    assert.equal(config.publishableFloor, 85);
    assert.equal(config.goldFile, null, "gold book must not self-anchor");
    assert.match(config.reviewer, /^harness:qc-run-daring-greatly/);

    // Syntax-validate the script the way the Workflow runtime executes it:
    // the body runs inside an async wrapper, so top-level await/return are
    // legal there (bare-module `node --check` would false-fail on `return`).
    const wrapped = "(async () => {" + script.replace("export const meta", "const meta") + "})()";
    const check = spawnSync("node", ["--input-type=module", "--check"], { input: wrapped, encoding: "utf8" });
    assert.equal(check.status, 0, `generated workflow has a syntax error:\n${(check.stderr ?? "").slice(0, 600)}`);
  } finally {
    if (existed !== null) writeFileSync(outPath, existed, "utf8");
    else rmSync(outPath, { force: true });
  }
});
