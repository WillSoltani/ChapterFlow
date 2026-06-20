/**
 * sweepCarryable / carryForwardSweep — the content-addressed sweep carry-forward. A PASS
 * sweep over a byte-IDENTICAL book (same chapter set, same per-chapter content hashes) may
 * be carried onto a new round instead of re-spawning the stochastic codex sweep. ANY change
 * — edited content, an added or removed chapter — forces a fresh sweep (the quality floor).
 */

import assert from "node:assert/strict";
import { rmSync } from "node:fs";

import { test } from "./harness.js";
import { makeChapter } from "./helpers.js";
import { chapterContentHash } from "../src/critics/qcAttestation.js";
import { REQUIRED_SWEEP_FAMILIES, carryForwardSweep, loadSweepRecord, sweepCarryable, sweepRecordPath, type SweepRecord } from "../src/qc/sweep.js";

const BOOK = "zz-fixture-sweep-carry";
const ROUND = "r-prior-sweep";

function passRec(chapters: ReturnType<typeof makeChapter>[], opts: { verdict?: SweepRecord["verdict"]; families?: readonly SweepRecord["checkedFamilies"][number][] } = {}): SweepRecord {
  return {
    schemaVersion: "sweep-attest-v1",
    bookId: BOOK,
    roundId: ROUND,
    verdict: opts.verdict ?? "PASS",
    reviewer: "codex-qc:sweep",
    attestedAt: "2026-01-01T00:00:00.000Z",
    contentHashes: Object.fromEntries(chapters.map((ch) => [String(ch.number), chapterContentHash(ch)])),
    checkedFamilies: [...(opts.families ?? REQUIRED_SWEEP_FAMILIES)],
    findings: [],
  };
}

test("sweepCarryable: a PASS sweep over a byte-identical book carries forward", () => {
  const chapters = [makeChapter(BOOK, 1), makeChapter(BOOK, 2)];
  assert.equal(sweepCarryable(passRec(chapters), chapters), true);
});

test("sweepCarryable: ANY edited chapter forces a fresh sweep", () => {
  const chapters = [makeChapter(BOOK, 1), makeChapter(BOOK, 2)];
  const rec = passRec(chapters);
  const edited2 = JSON.parse(JSON.stringify(chapters[1]));
  edited2.hook = `${edited2.hook} A genuinely new sentence that moves the content hash.`;
  assert.notEqual(chapterContentHash(edited2), chapterContentHash(chapters[1]), "fixture must actually change the hash");
  assert.equal(sweepCarryable(rec, [chapters[0], edited2]), false, "a changed chapter forces a fresh sweep");
});

test("sweepCarryable: an added or removed chapter (set change) forces a fresh sweep", () => {
  const chapters = [makeChapter(BOOK, 1), makeChapter(BOOK, 2)];
  const rec = passRec(chapters);
  assert.equal(sweepCarryable(rec, [...chapters, makeChapter(BOOK, 3)]), false, "added chapter");
  assert.equal(sweepCarryable(rec, [chapters[0]]), false, "removed chapter");
});

test("sweepCarryable: a non-PASS prior, an incomplete family set, or no prior never carries", () => {
  const chapters = [makeChapter(BOOK, 1), makeChapter(BOOK, 2)];
  assert.equal(sweepCarryable(passRec(chapters, { verdict: "REVISE" }), chapters), false, "REVISE never carries");
  assert.equal(sweepCarryable(passRec(chapters, { families: ["scene_skeleton"] }), chapters), false, "incomplete family coverage never carries");
  assert.equal(sweepCarryable(null, chapters), false, "no prior record never carries");
});

test("carryForwardSweep: re-stamps the prior PASS onto a new round without re-judging", () => {
  try {
    const chapters = [makeChapter(BOOK, 1), makeChapter(BOOK, 2)];
    const prior = passRec(chapters);
    carryForwardSweep(BOOK, prior, "r-new-round");
    const loaded = loadSweepRecord(BOOK);
    assert.equal(loaded?.roundId, "r-new-round", "stamped onto the new round");
    assert.equal(loaded?.reviewer, "carry-forward", "marked carry-forward for audit");
    assert.equal(loaded?.verdict, "PASS", "the real prior verdict is preserved");
    assert.deepEqual(loaded?.contentHashes, prior.contentHashes, "the carried hashes still match the book");
  } finally {
    rmSync(sweepRecordPath(BOOK), { force: true });
  }
});
