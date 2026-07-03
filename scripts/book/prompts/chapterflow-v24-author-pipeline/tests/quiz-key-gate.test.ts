/**
 * Quiz answer-key gate (Phase: Codex-as-both-roles hardening, 2026-06).
 *
 * The model-backed judge (`quiz-judge`) writes a per-chapter result; the sync
 * promote gate enforces it via checkKeyJudge. This pins that enforcement:
 *   - a FRESH result with a flagged wrong key blocks (QC1.wrong_quiz_key);
 *   - a fresh CLEAN result passes;
 *   - missing/stale results are ignored by default (backward compatible) but
 *     block in REQUIRE mode (the single-agent setting);
 *   - recordFromReport maps a judge report and stamps the current content hash.
 */

import assert from "node:assert/strict";
import { rmSync } from "fs";

import { test } from "./harness.js";
import { makeChapter } from "./helpers.js";
import type { ChapterV21 } from "../src/types.js";
import { chapterContentHash } from "../src/critics/qcAttestation.js";
import {
  checkKeyJudge,
  writeKeyJudge,
  loadKeyJudge,
  isKeyJudgeFresh,
  keyJudgePath,
  recordFromReport,
  type FlaggedKey,
} from "../src/critics/quizKeyGate.js";

const BOOK = "zz-fixture-keyjudge";

const SAMPLE_FLAG: FlaggedKey[] = [
  { questionId: "q01", storedIndex: 0, modelIndex: 1, modelCorrectText: "the other choice", reason: "the source supports choice 1" },
];

function writeRec(ch: ChapterV21, flagged: FlaggedKey[]): void {
  writeKeyJudge({
    schemaVersion: "quiz-keyjudge-v1",
    bookId: BOOK,
    chapterNumber: ch.number,
    chapterId: ch.chapterId!,
    judgedAt: "2026-06-12T00:00:00.000Z",
    model: "test-model",
    reviewer: "keyjudge:test",
    contentHash: chapterContentHash(ch),
    hashVersion: "v2",
    questionsJudged: 9,
    flagged,
    review: [],
  });
}

function cleanup(n: number): void {
  rmSync(keyJudgePath(BOOK, n), { force: true });
}

test("checkKeyJudge blocks at promote on a fresh result with a flagged wrong key", () => {
  const ch = makeChapter(BOOK, 1);
  try {
    writeRec(ch, SAMPLE_FLAG);
    const findings = checkKeyJudge(ch, true);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].checkId, "QC1.wrong_quiz_key");
    assert.equal(findings[0].severity, "blocker");
  } finally {
    cleanup(1);
  }
});

test("checkKeyJudge passes a fresh clean result", () => {
  const ch = makeChapter(BOOK, 2);
  try {
    writeRec(ch, []);
    assert.deepEqual(checkKeyJudge(ch, true), []);
  } finally {
    cleanup(2);
  }
});

test("a missing result does not block by default, but DOES in require mode", () => {
  const ch = makeChapter(BOOK, 3);
  cleanup(3); // ensure no stray sidecar from a prior run
  assert.deepEqual(checkKeyJudge(ch, true), [], "default: absence is not a block (backward compatible)");
  const req = checkKeyJudge(ch, true, true);
  assert.equal(req[0].checkId, "QC1.keyjudge_missing", "require mode forces the judge to have run");
});

test("a stale result is ignored by default but blocks in require mode", () => {
  const ch = makeChapter(BOOK, 4);
  try {
    writeRec(ch, SAMPLE_FLAG); // recorded against current content
    const rec = loadKeyJudge(BOOK, 4)!;
    assert.ok(isKeyJudgeFresh(rec, ch), "a freshly written record is fresh");
    ch.title = `${ch.title} (edited)`; // mutate reader-facing content → hash changes → stale
    assert.equal(isKeyJudgeFresh(rec, ch), false);
    assert.deepEqual(checkKeyJudge(ch, true), [], "default: stale flags may be obsolete — do not block");
    assert.equal(checkKeyJudge(ch, true, true)[0].checkId, "QC1.keyjudge_stale", "require mode blocks a stale result");
  } finally {
    cleanup(4);
  }
});

test("recordFromReport maps the judge report and stamps the current content hash", () => {
  const ch = makeChapter(BOOK, 5);
  const report = {
    chapterId: ch.chapterId!,
    questionsJudged: 9,
    flagged: [
      { questionId: "q03", storedIndex: 2, modelIndex: 0, confidence: "high", agree: false, flagged: true, modelCorrectText: "first choice", reason: "because Y" },
    ],
    review: [],
    all: [],
    cost: { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0, calls: 9 },
    model: "judge-model",
  };
  const rec = recordFromReport(report as any, ch, { bookId: BOOK, reviewer: "keyjudge:test", now: "2026-06-12T00:00:00.000Z" });
  assert.equal(rec.contentHash, chapterContentHash(ch), "hash is stamped from the chapter that was judged");
  assert.equal(rec.hashVersion, "v2");
  assert.equal(rec.flagged.length, 1);
  assert.equal(rec.flagged[0].questionId, "q03");
  assert.equal(rec.flagged[0].modelCorrectText, "first choice");
  assert.equal(rec.model, "judge-model");
});
