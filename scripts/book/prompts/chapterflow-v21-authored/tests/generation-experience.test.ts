/**
 * Tests for the generation-experience commands:
 *  - doctor catches chapter-number drift (the AS5–AS12 silent-skip trap)
 *  - book-status reports an honest phase + counts and never claims publishable
 *    for an un-QC'd book
 */

import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "fs";
import { resolve } from "path";

import { test } from "./harness.js";
import { PIPELINE_DIR, STATE_CHAPTERS, makeChapter, runCli, writeFixtureBook } from "./helpers.js";
import { runDoctorChecks } from "../src/lifecycle/doctor.js";
import { computeBookStatus } from "../src/lifecycle/bookStatus.js";

const BOOK = "zz-genexp-fixture";

function cleanup(): void {
  for (let n = 1; n <= 3; n++) {
    rmSync(resolve(STATE_CHAPTERS, `${BOOK}-ch${String(n).padStart(2, "0")}.v21-native.chapter.json`), { force: true });
    rmSync(resolve(PIPELINE_DIR, "state", "qc", `${BOOK}-ch${String(n).padStart(2, "0")}.qc.json`), { force: true });
  }
  rmSync(resolve(PIPELINE_DIR, "state", "guardrails", `${BOOK}.guardrails.md`), { force: true });
}

test("doctor flags duplicate chapter numbers as fatal (intra-book silent-skip trap)", () => {
  try {
    cleanup();
    // Two files, distinct chapterIds, SAME number — the drift that makes AS5–AS12
    // mutually invisible.
    const a = makeChapter(BOOK, 1);
    const b = makeChapter(BOOK, 2, { overrides: { number: 1 } });
    writeFixtureBook(STATE_CHAPTERS, [a, b]);
    const findings = runDoctorChecks(BOOK);
    const chk = findings.find((f) => f.check === "chapter-numbers");
    assert.ok(chk, "doctor must run the chapter-numbers check");
    assert.equal(chk!.level, "fatal");
    assert.match(chk!.message, /duplicate number 1/);
  } finally {
    cleanup();
  }
});

test("doctor: a clean book passes the chapter-numbers check", () => {
  try {
    cleanup();
    writeFixtureBook(STATE_CHAPTERS, [makeChapter(BOOK, 1), makeChapter(BOOK, 2)]);
    const chk = runDoctorChecks(BOOK).find((f) => f.check === "chapter-numbers");
    assert.equal(chk?.level, "ok");
  } finally {
    cleanup();
  }
});

test("book-status: an un-QC'd book is never publishable and points past generation", () => {
  try {
    cleanup();
    writeFixtureBook(STATE_CHAPTERS, [makeChapter(BOOK, 1), makeChapter(BOOK, 2)]);
    const s = computeBookStatus(BOOK);
    assert.equal(s.writtenChapters, 2);
    assert.equal(s.qcdChapters, 0, "no attestations ⇒ zero QC'd");
    assert.equal(s.publishable, false, "no QC ⇒ not publishable");
    // With chapters written, the phase is a quality phase, never the raw
    // research-bibliography ladder position.
    assert.ok(["generating (2/2 written)", "gating", "qc"].includes(s.phase), `unexpected phase: ${s.phase}`);
    // The next command must drive PAST generation (gate / qc-auto), not loop research.
    assert.match(s.nextCommand, /gate-chapter|qc-auto|book-gate/);
  } finally {
    cleanup();
  }
});

test("book-status honors its Exit-0 contract on a corrupt chapter (degrades, never crashes)", () => {
  try {
    cleanup();
    // A valid chapter + a half-written/corrupt sibling (the documented metadata-
    // drift failure mode). loadBookChapters throws; book-status must NOT crash.
    writeFixtureBook(STATE_CHAPTERS, [makeChapter(BOOK, 1)]);
    mkdirSync(STATE_CHAPTERS, { recursive: true });
    writeFileSync(resolve(STATE_CHAPTERS, `${BOOK}-ch02.v21-native.chapter.json`), "{ this is not valid json", "utf8");
    const cli = runCli(["book-status", BOOK]);
    assert.equal(cli.status, 0, "book-status must exit 0 even on a corrupt chapter (it's a status read)");
    assert.match(cli.out, /could not read status|BOOK STATUS/);
    assert.match(cli.out, /doctor/, "should point the operator at doctor to diagnose");
  } finally {
    cleanup();
  }
});
