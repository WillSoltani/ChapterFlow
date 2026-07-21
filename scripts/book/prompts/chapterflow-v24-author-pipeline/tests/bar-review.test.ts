import assert from "node:assert/strict";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { resolve } from "path";

import { attestationPath, chapterContentHash, loadAttestation } from "../src/critics/qcAttestation.js";
import { openQcRound, qcRoundPath } from "../src/qc/qcRound.js";
import { barScoresTemplatePath, validateAndWriteBarAttestations, writeBarPack } from "../src/qc/barReview.js";
import { orchestratorRoundDir, writeConfirmReadArtifact } from "../src/qc/orchestrator/artifacts.js";
import { keyPackDir } from "../src/qc/manualKeyJudge.js";
import type { ChapterV21 } from "../src/types.js";
import { test } from "./harness.js";
import { RUNS_DIR, cleanTmp, makeChapter, STATE_CHAPTERS, STATE_INDEXES, TMP_DIR, writeCanonicalIndexFixture, writeSourceEvidenceFixture } from "./helpers.js";

const BOOK = "zz-fixture-bar-review";
const ROUND = "r-bar-review";

function cleanup(): void {
  for (let n = 1; n <= 3; n++) {
    rmSync(resolve(STATE_CHAPTERS, `${BOOK}-ch${String(n).padStart(2, "0")}.v21-native.chapter.json`), { force: true });
    rmSync(attestationPath(BOOK, n), { force: true });
  }
  rmSync(resolve(STATE_INDEXES, `${BOOK}.json`), { force: true });
  rmSync(resolve(RUNS_DIR, BOOK), { recursive: true, force: true });
  rmSync(keyPackDir(BOOK, ROUND), { recursive: true, force: true });
  rmSync(orchestratorRoundDir(BOOK, ROUND), { recursive: true, force: true });
  rmSync(qcRoundPath(BOOK, ROUND), { force: true });
  cleanTmp();
}

function setup(): ReturnType<typeof openQcRound>["tokens"] {
  cleanup();
  mkdirSync(STATE_CHAPTERS, { recursive: true });
  const chapterSpecs = [];
  const chapterBodies: ChapterV21[] = [];
  for (let n = 1; n <= 2; n++) {
    const ch = makeChapter(BOOK, n);
    chapterSpecs.push({ chapterId: ch.chapterId, number: ch.number, title: ch.title });
    chapterBodies.push(ch);
    writeFileSync(resolve(STATE_CHAPTERS, `${ch.chapterId}.v21-native.chapter.json`), JSON.stringify(ch, null, 2), "utf8");
  }
  writeCanonicalIndexFixture(BOOK, chapterSpecs);
  writeSourceEvidenceFixture(BOOK, chapterSpecs);
  const tokens = openQcRound(BOOK, ROUND).tokens;
  for (const ch of chapterBodies) {
    writeConfirmReadArtifact({
      schemaVersion: "qc-confirm-read-v1",
      bookId: BOOK,
      roundId: ROUND,
      role: "confirm",
      reviewer: "codex-qc:bar-review-confirm-fixture",
      reviewerSessionId: `fixture-bar-confirm-${ch.number}`,
      chapterNumber: ch.number,
      chapterId: ch.chapterId,
      contentHash: chapterContentHash(ch),
      decision: "PUBLISHABLE",
      reason: "Synthetic confirm fixture agrees the chapter is publishable.",
      findings: [],
    });
  }
  return tokens;
}

function writeFilledScores(mutator?: (scores: any) => void): string {
  const raw = JSON.parse(readFileSync(barScoresTemplatePath(BOOK, ROUND), "utf8"));
  for (const ch of raw.chapters) {
    ch.notes = "";
    for (const axis of ch.axes) {
      axis.score = 0.9;
      axis.tier = "PUBLISHABLE";
      axis.hits = [];
    }
  }
  mutator?.(raw);
  mkdirSync(TMP_DIR, { recursive: true });
  const path = resolve(TMP_DIR, `${BOOK}.bar-scores.json`);
  writeFileSync(path, JSON.stringify(raw, null, 2), "utf8");
  return path;
}

test("bar-pack plus bar-attest batch writes fresh publishable attestations", () => {
  const tokens = setup();
  try {
    const pack = writeBarPack(BOOK, ROUND);
    assert.deepEqual(pack.errors, []);
    assert.ok(pack.packPath?.endsWith("bar-pack.json"));
    assert.ok(pack.templatePath?.endsWith("bar-scores.template.json"));

    const scores = writeFilledScores();
    const result = validateAndWriteBarAttestations(BOOK, ROUND, tokens.bar, "codex-qc:bar-review-test", scores);
    assert.deepEqual(result.errors, []);
    assert.equal(result.wrote, 2);
    assert.equal(result.results.every((r) => r.verdict === "PUBLISHABLE"), true);

    const att = loadAttestation(BOOK, 1, readFileSync(attestationPath(BOOK, 1)));
    assert.equal(att?.verdict, "PUBLISHABLE");
    assert.equal(att?.roundId, ROUND);
    assert.equal(att?.roundRole, "bar");

    const repeated = validateAndWriteBarAttestations(BOOK, ROUND, tokens.bar, "codex-qc:bar-review-test", scores);
    assert.deepEqual(repeated.errors, []);
    assert.equal(repeated.wrote, 2);
    const rewritten = loadAttestation(BOOK, 1, readFileSync(attestationPath(BOOK, 1)));
    assert.equal(rewritten?.history?.length, 1, "stored attestation is re-read before history append");
    assert.equal(rewritten?.history?.[0]?.verdict, "PUBLISHABLE");
  } finally {
    cleanup();
  }
});

test("bar-attest batch blocks partial chapter coverage", () => {
  const tokens = setup();
  try {
    writeBarPack(BOOK, ROUND);
    const scores = writeFilledScores((raw) => {
      raw.chapters = raw.chapters.slice(0, 1);
    });
    const result = validateAndWriteBarAttestations(BOOK, ROUND, tokens.bar, "codex-qc:bar-review-test", scores);
    assert.equal(result.wrote, 0);
    assert.match(result.errors.join("\n"), /ch2: missing scores entry/);
  } finally {
    cleanup();
  }
});

test("bar-attest batch blocks stale content hashes after chapter edits", () => {
  const tokens = setup();
  try {
    writeBarPack(BOOK, ROUND);
    const chPath = resolve(STATE_CHAPTERS, `${BOOK}-ch01.v21-native.chapter.json`);
    const ch = JSON.parse(readFileSync(chPath, "utf8"));
    ch.hook += " Edited after the bar pack.";
    writeFileSync(chPath, JSON.stringify(ch, null, 2), "utf8");

    const scores = writeFilledScores();
    const result = validateAndWriteBarAttestations(BOOK, ROUND, tokens.bar, "codex-qc:bar-review-test", scores);
    assert.equal(result.wrote, 0);
    assert.match(result.errors.join("\n"), /contentHash mismatch/);
  } finally {
    cleanup();
  }
});

test("bar-attest batch records REVISE when computed bar is yellow", () => {
  const tokens = setup();
  try {
    writeBarPack(BOOK, ROUND);
    const scores = writeFilledScores((raw) => {
      raw.chapters[0].notes = "example scenes are readable but not yet publishable";
      raw.chapters[0].axes.find((axis: any) => axis.axis === "example_coherence").score = 0.5;
    });
    const result = validateAndWriteBarAttestations(BOOK, ROUND, tokens.bar, "codex-qc:bar-review-test", scores);
    assert.deepEqual(result.errors, []);
    assert.equal(loadAttestation(BOOK, 1, readFileSync(attestationPath(BOOK, 1)))?.verdict, "REVISE");
    assert.equal(loadAttestation(BOOK, 2, readFileSync(attestationPath(BOOK, 2)))?.verdict, "PUBLISHABLE");

    const unchangedFlip = validateAndWriteBarAttestations(
      BOOK,
      ROUND,
      tokens.bar,
      "codex-qc:bar-review-test",
      writeFilledScores(),
    );
    assert.equal(unchangedFlip.wrote, 0);
    assert.match(unchangedFlip.errors.join("\n"), /unchanged REVISE attestation cannot be batch-flipped to PUBLISHABLE/);
  } finally {
    cleanup();
  }
});
