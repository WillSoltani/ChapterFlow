/**
 * Phase 5 instrumentation: qc-stats (revision-rate measurement from the
 * attestation record) and the voice bible (per-book charter compiled into
 * authoring prompts).
 */

import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "fs";
import { resolve } from "path";

import { QC_DIR, writeAttestation } from "../src/critics/qcAttestation.js";
import { formatVoiceBible } from "../src/lib/voiceBible.js";
import { test } from "./harness.js";
import { PIPELINE_DIR, runCli } from "./helpers.js";

const BOOK = "zz-fixture-stats";

function att(n: number, verdict: "PUBLISHABLE" | "REVISE", history?: Array<{ verdict: string; reviewer: string }>): void {
  writeAttestation({
    schemaVersion: "qc-attest-v1",
    bookId: BOOK,
    chapterNumber: n,
    chapterId: `${BOOK}-ch${String(n).padStart(2, "0")}`,
    verdict,
    contentHash: "deadbeefdeadbeef",
    hashVersion: "v2",
    reviewer: "harness:test",
    reviewedAt: "2026-06-10T00:00:00.000Z",
    history: history as any,
  });
}

test("qc-stats computes first-pass rate and attempts from attestation history", () => {
  try {
    // ch1: clean first pass. ch2: REVISE → PUBLISHABLE (one redo).
    // ch3: still REVISE after a redo loop start.
    att(1, "PUBLISHABLE");
    att(2, "PUBLISHABLE", [{ verdict: "REVISE", reviewer: "human:a" }]);
    att(3, "REVISE");
    const { status, out } = runCli(["qc-stats", BOOK]);
    assert.equal(status, 0, out.slice(-400));
    assert.match(out, /ch: {2}3/);
    // first-pass = ch1 only (ch2's history starts at REVISE; ch3 is REVISE): 1/3 = 33%
    assert.match(out, /first-pass: 33%/);
    // attempts: ch1=1, ch2=2, ch3=1 → avg 1.33
    assert.match(out, /avg-attempts:1\.33/);
    assert.match(out, /revision rate 67%/);
  } finally {
    for (const n of [1, 2, 3]) rmSync(resolve(QC_DIR, `${BOOK}-ch${String(n).padStart(2, "0")}.qc.json`), { force: true });
  }
});

test("voice bible compiles the brief's charter; absent/stub briefs yield null", () => {
  const briefPath = resolve(PIPELINE_DIR, "state", "briefs", `${BOOK}.brief.json`);
  try {
    assert.equal(formatVoiceBible(BOOK), null, "no brief → no block (fanout omits it)");
    mkdirSync(resolve(PIPELINE_DIR, "state", "briefs"), { recursive: true });
    writeFileSync(
      briefPath,
      JSON.stringify({
        bookId: BOOK,
        voiceCharter: {
          register: "plainspoken",
          person: "second",
          cadence: "short",
          signatureMoves: ["open with a concrete scene"],
          avoidMoves: ["no meta-reference to 'the chapter'"],
        },
        voiceSpecimens: ["You checked the lock twice. That habit is the whole chapter."],
        forbiddenMoves: ["no war metaphors"],
      }),
      "utf8",
    );
    const block = formatVoiceBible(BOOK)!;
    assert.match(block, /plainspoken, second-person, short cadence/);
    assert.match(block, /open with a concrete scene/);
    assert.match(block, /no war metaphors/);
    assert.match(block, /You checked the lock twice/);
  } finally {
    rmSync(briefPath, { force: true });
  }
});
