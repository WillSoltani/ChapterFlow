import assert from "node:assert/strict";
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";

import { test } from "./harness.js";
import { makeChapter, PIPELINE_DIR, STATE_CHAPTERS, runCli, writeFixtureBook } from "./helpers.js";
import { promoteBook } from "../src/promoteBook.js";
import { sourceVerifyRecordPath } from "../src/critics/sourceVerify.js";
import { attestationPath, chapterContentHash, writeAttestation } from "../src/critics/qcAttestation.js";
import { openQcRound, qcRoundPath } from "../src/qc/qcRound.js";
import { orchestratorRoundDir } from "../src/qc/orchestrator/artifacts.js";
import { currentMajorFindings, unresolvedMajors, waiverPath } from "../src/qc/majorDisposition.js";

const BOOK = "zz-fixture-no-api-promote";

function cleanup(): void {
  for (const f of readdirSync(STATE_CHAPTERS)) {
    if (f.startsWith(`${BOOK}-ch`)) rmSync(resolve(STATE_CHAPTERS, f), { force: true });
  }
  for (const n of [1, 2, 3]) {
    rmSync(attestationPath(BOOK, n), { force: true });
    rmSync(resolve(PIPELINE_DIR, "state", "qc", `${BOOK}-ch${String(n).padStart(2, "0")}.manual-keyjudge.json`), { force: true });
  }
  rmSync(resolve(PIPELINE_DIR, "state", "qc", `${BOOK}.sweep.json`), { force: true });
  rmSync(qcRoundPath(BOOK, "r-no-api-artifacts"), { force: true });
  rmSync(qcRoundPath(BOOK, "r-legacy-major"), { force: true });
  rmSync(orchestratorRoundDir(BOOK, "r-no-api-artifacts"), { recursive: true, force: true });
  rmSync(waiverPath(BOOK), { force: true });
  rmSync(resolve(PIPELINE_DIR, "state", "books", `${BOOK}.gate.json`), { force: true });
  const blocked = resolve(PIPELINE_DIR, "state", "books", "_blocked");
  try {
    for (const f of readdirSync(blocked)) {
      if (f.startsWith(`${BOOK}.`)) rmSync(resolve(blocked, f), { force: true });
    }
  } catch {}
}

test("no-api promote blocks without source-v2, sweep PASS, manual keyjudge PASS, round-backed attestations, and major dispositions", () => {
  const prev = process.env.CHAPTERFLOW_NO_API_CODEX_QC;
  const oldWarn = console.warn;
  try {
    console.warn = () => {};
    cleanup();
    const chapters = [1, 2, 3].map((n) => {
      const ch = makeChapter(BOOK, n);
      ch.examples[0].scenario =
        `At the kitchen table, a synthetic team repeats the same venue in chapter ${n}. This intentionally creates a current book-gate major for disposition testing.`;
      return ch;
    });
    writeFixtureBook(STATE_CHAPTERS, chapters);
    for (const ch of chapters) {
      writeAttestation({
        schemaVersion: "qc-attest-v1",
        bookId: BOOK,
        chapterNumber: ch.number,
        chapterId: ch.chapterId,
        verdict: "PUBLISHABLE",
        contentHash: chapterContentHash(ch),
        hashVersion: "v2",
        reviewer: "human:legacy",
        reviewedAt: "2026-06-12T00:00:00.000Z",
      });
    }
    process.env.CHAPTERFLOW_NO_API_CODEX_QC = "1";
    const result = promoteBook({
      bookId: BOOK,
      title: "Fixture",
      author: "Nobody",
      chapters: chapters.map((ch) => ({ chapterId: ch.chapterId, chapterNumber: ch.number, chapterTitle: ch.title })) as any,
    });
    assert.equal(result.promoted, false);
    assert.ok(result.noApiBlockerCount > 0, `expected no-api blockers, got ${result.noApiBlockerCount}`);
    const report = JSON.parse(readFileSync(resolve(PIPELINE_DIR, "state", "books", `${BOOK}.gate.json`), "utf8"));
    const noApiIds = (report.noApiCodexQc.findings ?? []).map((f: any) => f.checkId);
    const qcIds = (report.qcAttestation.findings ?? []).map((f: any) => f.checkId);
    assert.ok(noApiIds.some((id: string) => id.startsWith("SV2.")), `source-v2 blocker missing: ${noApiIds.join(", ")}`);
    assert.ok(noApiIds.includes("QC2.manual_keyjudge_missing"), `manual keyjudge blocker missing: ${noApiIds.join(", ")}`);
    assert.ok(noApiIds.includes("QC3.sweep_missing"), `sweep blocker missing: ${noApiIds.join(", ")}`);
    assert.ok(noApiIds.includes("QC4.major_unresolved"), `major disposition blocker missing: ${noApiIds.join(", ")}`);
    assert.ok(qcIds.includes("QC0.no_api_round_missing"), `round-backed attestation blocker missing: ${qcIds.join(", ")}`);
  } finally {
    console.warn = oldWarn;
    if (prev === undefined) delete process.env.CHAPTERFLOW_NO_API_CODEX_QC;
    else process.env.CHAPTERFLOW_NO_API_CODEX_QC = prev;
    cleanup();
  }
});

test("no-api promote enforces the source-verify RECORD gate inside promoteBook (a direct promote-book can't bypass WS-4)", () => {
  const prev = process.env.CHAPTERFLOW_NO_API_CODEX_QC;
  const oldWarn = console.warn;
  const recordPath = sourceVerifyRecordPath(BOOK);
  try {
    console.warn = () => {};
    cleanup();
    const chapters = [1].map((n) => makeChapter(BOOK, n));
    writeFixtureBook(STATE_CHAPTERS, chapters);
    // A PRESENT-but-rubber-stamped record (one identical note over reused sources) must block
    // promotion via promoteBook itself — not just via the publish-after-qc preflight wrapper.
    const items = [1, 2, 3, 4, 5].map((i) => ({ id: `f${i}`, kind: "testable_fact", verdict: "VERIFIED", sourceRef: `https://example.com/${i % 2}`, note: "stamp" }));
    const record = { schemaVersion: "source-verify-record-v1", bookId: BOOK, chapters: [{ chapterNumber: 1, items }] };
    mkdirSync(dirname(recordPath), { recursive: true });
    writeFileSync(recordPath, "```json\n" + JSON.stringify(record) + "\n```\n", "utf8");
    process.env.CHAPTERFLOW_NO_API_CODEX_QC = "1";
    const result = promoteBook({
      bookId: BOOK,
      title: "Fixture",
      author: "Nobody",
      chapters: chapters.map((ch) => ({ chapterId: ch.chapterId, chapterNumber: ch.number, chapterTitle: ch.title })) as any,
    });
    assert.equal(result.promoted, false);
    const report = JSON.parse(readFileSync(resolve(PIPELINE_DIR, "state", "books", `${BOOK}.gate.json`), "utf8"));
    const noApiIds = (report.noApiCodexQc.findings ?? []).map((f: any) => f.checkId);
    assert.ok(noApiIds.includes("SV4"), `source-verify rubber-stamp (SV4) blocker missing from promoteBook: ${noApiIds.join(", ")}`);
  } finally {
    console.warn = oldWarn;
    rmSync(recordPath, { force: true });
    if (prev === undefined) delete process.env.CHAPTERFLOW_NO_API_CODEX_QC;
    else process.env.CHAPTERFLOW_NO_API_CODEX_QC = prev;
    cleanup();
  }
});

test("major dispositions read legacy closed statuses but CLI rejects writing legacy status names", () => {
  const oldWarn = console.warn;
  try {
    console.warn = () => {};
    cleanup();
    const chapter = makeChapter(BOOK, 1);
    writeFixtureBook(STATE_CHAPTERS, [chapter]);
    openQcRound(BOOK, "r-legacy-major");
    const finding = currentMajorFindings(BOOK, [chapter])[0];
    assert.ok(finding, "fixture should expose at least one current major");
    const waiverFile = waiverPath(BOOK);
    mkdirSync(dirname(waiverFile), { recursive: true });
    writeFileSync(waiverFile, JSON.stringify({
      schemaVersion: "major-waivers-v1",
      bookId: BOOK,
      dispositions: [{
        findingId: finding.id,
        status: "waived",
        reason: "Legacy waiver status remains readable for existing waiver files.",
        reviewer: "human:legacy",
        roundId: "r-legacy-major",
        timestamp: "2026-06-12T00:00:00.000Z",
      }],
    }, null, 2) + "\n", "utf8");
    assert.equal(unresolvedMajors(BOOK, [chapter], true).some((f) => f.id === finding.id), false);
    const cli = runCli([
      "major-disposition",
      BOOK,
      "--finding", finding.id,
      "--status", "waived",
      "--reason", "Legacy status names should not be written by the current CLI.",
      "--reviewer", "human:test",
      "--round", "r-legacy-major",
    ]);
    assert.equal(cli.status, 2);
    assert.match(cli.out, /open\|waived_false_positive\|waived_accepted_debt/);
  } finally {
    console.warn = oldWarn;
    cleanup();
  }
});

test("no-api promote requires fresh bar and confirm artifacts for a PUBLISHABLE attestation", () => {
  const prev = process.env.CHAPTERFLOW_NO_API_CODEX_QC;
  const oldWarn = console.warn;
  try {
    console.warn = () => {};
    cleanup();
    const chapter = makeChapter(BOOK, 1);
    writeFixtureBook(STATE_CHAPTERS, [chapter]);
    openQcRound(BOOK, "r-no-api-artifacts");
    writeAttestation({
      schemaVersion: "qc-attest-v1",
      bookId: BOOK,
      chapterNumber: chapter.number,
      chapterId: chapter.chapterId,
      verdict: "PUBLISHABLE",
      contentHash: chapterContentHash(chapter),
      hashVersion: "v2",
      reviewer: "human:artifact-test",
      reviewedAt: "2026-06-12T00:00:00.000Z",
      roundId: "r-no-api-artifacts",
      roundRole: "confirm",
    });
    process.env.CHAPTERFLOW_NO_API_CODEX_QC = "1";
    const result = promoteBook({
      bookId: BOOK,
      title: "Fixture",
      author: "Nobody",
      chapters: [{ chapterId: chapter.chapterId, chapterNumber: chapter.number, chapterTitle: chapter.title }] as any,
    });
    assert.equal(result.promoted, false);
    const report = JSON.parse(readFileSync(resolve(PIPELINE_DIR, "state", "books", `${BOOK}.gate.json`), "utf8"));
    const qcIds = (report.qcAttestation.findings ?? []).map((f: any) => f.checkId);
    assert.ok(qcIds.includes("QC0.bar_read_missing"), `bar artifact blocker missing: ${qcIds.join(", ")}`);
  } finally {
    console.warn = oldWarn;
    if (prev === undefined) delete process.env.CHAPTERFLOW_NO_API_CODEX_QC;
    else process.env.CHAPTERFLOW_NO_API_CODEX_QC = prev;
    cleanup();
  }
});
