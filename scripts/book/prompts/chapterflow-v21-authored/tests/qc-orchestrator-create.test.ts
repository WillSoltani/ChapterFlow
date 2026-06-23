import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { resolve } from "path";

import { test } from "./harness.js";
import { makeChapter, STATE_CHAPTERS, STATE_INDEXES, writeCanonicalIndexFixture, writeFixtureBook, writeResearchRunManifestFixture } from "./helpers.js";
import { attestationPath, chapterContentHash, writeAttestation } from "../src/critics/qcAttestation.js";
import { REPO_ROOT } from "../src/lib/chapterPaths.js";
import { createQcOrchestrationRound } from "../src/qc/orchestrator/index.js";
import { orchestratorRoundDir, roundRecordPath, taskCardsDir } from "../src/qc/orchestrator/artifacts.js";
import { reviewPacketPath } from "../src/qc/orchestrator/reviewPacket.js";
import { parseRoundTokens } from "../src/orchestrator/autopilot.js";
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
  for (const n of [1, 2]) rmSync(attestationPath(BOOK, n), { force: true });
  for (const n of [1, 2]) rmSync(resolve(STATE_CHAPTERS, `${BOOK}-ch${String(n).padStart(2, "0")}.v21-native.chapter.json`), { force: true });
  rmSync(resolve(STATE_INDEXES, `${BOOK}.json`), { force: true });
  rmSync(resolve(REPO_ROOT, ".chapterflow/runs", BOOK), { recursive: true, force: true });
  rmSync(orchestratorRoundDir(BOOK, ROUND), { recursive: true, force: true });
  rmSync(keyPackDir(BOOK, ROUND), { recursive: true, force: true });
  rmSync(qcRoundPath(BOOK, ROUND), { force: true });
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
    // Minimal synthetic fixtures intentionally fail book-gate; this test exercises
    // round MECHANICS, so it opts out of the F6a preflight block.
    const result = createQcOrchestrationRound(BOOK, { roundId: ROUND, chapters: [1], allowDirtyPreflight: true });
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
    // M1: the REVIEW-PACKET must carry a plaintext `major` token (it didn't — only the
    // majors.md card did). The autopilot broker parses tokens from HERE, so without it the
    // major reviewer's triage was silently dropped. parseRoundTokens must now find all six.
    const packet = readFileSync(reviewPacketPath(BOOK, ROUND), "utf8");
    const toks = parseRoundTokens(packet);
    for (const role of ["sweep", "keyA", "keyB", "bar", "confirm", "major"]) {
      assert.ok(toks[role], `REVIEW-PACKET must expose a plaintext ${role} token for the broker`);
    }
  } finally {
    if (prev === undefined) delete process.env.CHAPTERFLOW_NO_API_CODEX_QC;
    else process.env.CHAPTERFLOW_NO_API_CODEX_QC = prev;
    cleanup();
  }
});

test("P2: incremental create reviews only changed chapters and carries the rest (sweep stays book-wide)", () => {
  const prev = process.env.CHAPTERFLOW_NO_API_CODEX_QC;
  try {
    process.env.CHAPTERFLOW_NO_API_CODEX_QC = "1";
    setup(); // ch1 + ch2 fixtures + source sidecars
    // ch1 already carries a fresh PUBLISHABLE attestation → must be carried, not re-reviewed.
    writeAttestation({
      schemaVersion: "qc-attest-v1",
      bookId: BOOK,
      chapterNumber: 1,
      chapterId: `${BOOK}-ch01`,
      verdict: "PUBLISHABLE",
      contentHash: chapterContentHash(makeChapter(BOOK, 1)),
      hashVersion: "v2",
      reviewer: "codex-qc:auto:r-old",
      reviewedAt: "2026-01-01T00:00:00.000Z",
      roundId: "r-old",
      roundRole: "attest",
    });
    const result = createQcOrchestrationRound(BOOK, { roundId: ROUND, incremental: true, allowDirtyPreflight: true });
    assert.equal(result.ok, true, result.errors.join("\n"));
    const round = JSON.parse(readFileSync(roundRecordPath(BOOK, ROUND), "utf8"));
    assert.deepEqual(round.chapters, [1, 2], "round still spans the full book so the cross-chapter sweep covers everything");
    assert.deepEqual(round.carriedChapters, [1]);
    assert.deepEqual(round.reviewChapters, [2]);
    // The reviewed chapter gets a bar card; the carried one does not.
    assert.equal(existsSync(resolve(taskCardsDir(BOOK, ROUND), "bar", "ch02.md")), true, "reviewed chapter gets a bar card");
    assert.equal(existsSync(resolve(taskCardsDir(BOOK, ROUND), "bar", "ch01.md")), false, "carried chapter gets NO bar card");
    // The book-wide sweep card is always written.
    assert.equal(existsSync(resolve(taskCardsDir(BOOK, ROUND), "00-sweep.md")), true, "sweep card always written");
  } finally {
    if (prev === undefined) delete process.env.CHAPTERFLOW_NO_API_CODEX_QC;
    else process.env.CHAPTERFLOW_NO_API_CODEX_QC = prev;
    cleanup();
  }
});

test("item B (F1): when ALL chapters carry, a normal incremental round opens NOTHING, but a noSweepCarry confirming round STILL opens to run the fresh book-wide sweep", () => {
  const prev = process.env.CHAPTERFLOW_NO_API_CODEX_QC;
  try {
    process.env.CHAPTERFLOW_NO_API_CODEX_QC = "1";
    setup();
    // BOTH chapters carry a fresh PUBLISHABLE attestation → reviewChapters is empty.
    for (const n of [1, 2]) {
      writeAttestation({
        schemaVersion: "qc-attest-v1", bookId: BOOK, chapterNumber: n, chapterId: `${BOOK}-ch0${n}`,
        verdict: "PUBLISHABLE", contentHash: chapterContentHash(makeChapter(BOOK, n)), hashVersion: "v2",
        reviewer: "codex-qc:auto:r-old", reviewedAt: "2026-01-01T00:00:00.000Z", roundId: "r-old", roundRole: "attest",
      });
    }
    // (a) A normal incremental round has nothing to re-QC → opens no round (today's behavior).
    const skipped = createQcOrchestrationRound(BOOK, { roundId: "r-itemb-skip", incremental: true, allowDirtyPreflight: true });
    assert.equal(skipped.ok, true);
    assert.equal(skipped.roundId, "", "all-carry incremental round opens nothing");
    assert.match(skipped.messages.join("\n"), /nothing to re-QC/);
    // (b) The item-B confirming round (noSweepCarry) MUST open anyway, to run an independent fresh
    // sweep over the frozen book — the F1 fix. Without it the confirming round was dead-on-arrival.
    const opened = createQcOrchestrationRound(BOOK, { roundId: ROUND, incremental: true, noSweepCarry: true, allowDirtyPreflight: true });
    assert.equal(opened.ok, true, opened.errors.join("\n"));
    assert.equal(opened.roundId, ROUND, "the confirming round opens a real round even with an empty review set");
    assert.ok(existsSync(roundRecordPath(BOOK, ROUND)), "round record written");
    assert.ok(existsSync(resolve(taskCardsDir(BOOK, ROUND), "00-sweep.md")), "the fresh book-wide sweep card is written");
    assert.equal(existsSync(resolve(taskCardsDir(BOOK, ROUND), "bar", "ch01.md")), false, "no per-chapter bar card (all chapters carried)");
  } finally {
    if (prev === undefined) delete process.env.CHAPTERFLOW_NO_API_CODEX_QC;
    else process.env.CHAPTERFLOW_NO_API_CODEX_QC = prev;
    rmSync(orchestratorRoundDir(BOOK, "r-itemb-skip"), { recursive: true, force: true });
    cleanup();
  }
});

test("F6a: a book-gate-dirty book is REFUSED a round (no allowDirtyPreflight) and opens none", () => {
  const prev = process.env.CHAPTERFLOW_NO_API_CODEX_QC;
  try {
    process.env.CHAPTERFLOW_NO_API_CODEX_QC = "1";
    setup(); // synthetic 2-chapter fixture fails book-gate (F1/BP7/BP3/…)
    const result = createQcOrchestrationRound(BOOK, { roundId: ROUND, chapters: [1] });
    assert.equal(result.ok, false, "must refuse a round on a book-gate-dirty book");
    assert.match(result.errors.join("\n"), /book-gate BLOCK/);
    assert.equal(result.roundId, "", "no round id is minted when the preflight blocks");
    assert.equal(existsSync(roundRecordPath(BOOK, ROUND)), false, "no round record is written");
  } finally {
    if (prev === undefined) delete process.env.CHAPTERFLOW_NO_API_CODEX_QC;
    else process.env.CHAPTERFLOW_NO_API_CODEX_QC = prev;
    cleanup();
  }
});
