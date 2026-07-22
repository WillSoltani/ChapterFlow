import assert from "node:assert/strict";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmdirSync, rmSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";

import { test } from "./harness.js";
import { makeChapter, PIPELINE_DIR, STATE_CHAPTERS, runCli, writeFixtureBook } from "./helpers.js";
import { productionManifestSidecarPath, promoteBook } from "../src/promoteBook.js";
import { sourceVerifyRecordPath } from "../src/critics/sourceVerify.js";
import { attestationPath, chapterContentHash, writeAttestation } from "../src/critics/qcAttestation.js";
import { openQcRound, qcRoundPath } from "../src/qc/qcRound.js";
import { orchestratorRoundDir } from "../src/qc/orchestrator/artifacts.js";
import { currentMajorFindings, unresolvedMajors, waiverPath } from "../src/qc/majorDisposition.js";
import { isAdvisoryMajor } from "../src/critics/majorPolicy.js";
import { provenancePath, recordAuthorProvenance } from "../src/qc/sessionProvenance.js";

const BOOK = "zz-fixture-no-api-promote";
const QC_ROUNDS_DIR = dirname(qcRoundPath(BOOK, "r-no-api-artifacts"));
const WAIVERS_DIR = dirname(waiverPath(BOOK));
const QC_ROUNDS_DIR_EXISTED = existsSync(QC_ROUNDS_DIR);
const WAIVERS_DIR_EXISTED = existsSync(WAIVERS_DIR);

function pruneSharedDir(path: string, existedBefore: boolean): void {
  if (!existedBefore && existsSync(path) && readdirSync(path).length === 0) rmdirSync(path);
}

function productionPackagePath(): string {
  return resolve(PIPELINE_DIR, "book-packages", `${BOOK}.v21.json`);
}

function promotionTransactionNames(): string[] {
  const dir = resolve(PIPELINE_DIR, "state", "books", "_transactions");
  try {
    return readdirSync(dir).filter((name) => name.startsWith(`${BOOK}.`)).sort();
  } catch {
    return [];
  }
}

function assertLegacyAuthorityBlocked(report: any): void {
  const qcIds = (report.qcAttestation?.findings ?? []).map((finding: any) => finding.checkId);
  const bookIds = (report.bookGate?.findings ?? []).map((finding: any) => finding.catalogId ?? finding.checkId);
  assert.ok(qcIds.includes("QC0.missing_attestation"), `missing candidate-bound QC blocker: ${qcIds.join(", ")}`);
  assert.ok(bookIds.includes("BOOK_PATTERN_AUDIT_UNBOUND"), `missing candidate-bound pattern-audit blocker: ${bookIds.join(", ")}`);
  assert.equal(existsSync(productionPackagePath()), false, "blocked ambient state must not write a package");
  assert.equal(existsSync(productionManifestSidecarPath(BOOK)), false, "blocked ambient state must not write a manifest sidecar");
  assert.deepEqual(promotionTransactionNames(), [], "blocked ambient state must not create promotion transactions");
}

function cleanup(): void {
  for (const f of readdirSync(STATE_CHAPTERS)) {
    if (f.startsWith(`${BOOK}-ch`)) rmSync(resolve(STATE_CHAPTERS, f), { force: true });
  }
  for (const n of [1, 2, 3]) {
    rmSync(attestationPath(BOOK, n), { force: true });
    rmSync(provenancePath(`${BOOK}-ch${String(n).padStart(2, "0")}`), { force: true });
    rmSync(resolve(PIPELINE_DIR, "state", "qc", `${BOOK}-ch${String(n).padStart(2, "0")}.manual-keyjudge.json`), { force: true });
  }
  rmSync(resolve(PIPELINE_DIR, "state", "qc", `${BOOK}.sweep.json`), { force: true });
  rmSync(resolve(PIPELINE_DIR, "state", "indexes", `${BOOK}.json`), { force: true });
  rmSync(qcRoundPath(BOOK, "r-no-api-artifacts"), { force: true });
  rmSync(qcRoundPath(BOOK, "r-legacy-major"), { force: true });
  rmSync(orchestratorRoundDir(BOOK, "r-no-api-artifacts"), { recursive: true, force: true });
  rmSync(waiverPath(BOOK), { force: true });
  pruneSharedDir(QC_ROUNDS_DIR, QC_ROUNDS_DIR_EXISTED);
  pruneSharedDir(WAIVERS_DIR, WAIVERS_DIR_EXISTED);
  rmSync(resolve(PIPELINE_DIR, "state", "books", `${BOOK}.gate.json`), { force: true });
  rmSync(productionPackagePath(), { force: true });
  rmSync(productionManifestSidecarPath(BOOK), { force: true });
  const transactions = resolve(PIPELINE_DIR, "state", "books", "_transactions");
  for (const name of promotionTransactionNames()) rmSync(resolve(transactions, name), { recursive: true, force: true });
  const blocked = resolve(PIPELINE_DIR, "state", "books", "_blocked");
  try {
    for (const f of readdirSync(blocked)) {
      if (f.startsWith(`${BOOK}.`)) rmSync(resolve(blocked, f), { force: true });
    }
  } catch {}
}

function writeFixtureBookWithIndex(chapters: ReturnType<typeof makeChapter>[]): void {
  writeFixtureBook(STATE_CHAPTERS, chapters);
  const indexPath = resolve(PIPELINE_DIR, "state", "indexes", `${BOOK}.json`);
  mkdirSync(dirname(indexPath), { recursive: true });
  writeFileSync(
    indexPath,
    JSON.stringify(chapters.map((ch) => ({ chapterId: ch.chapterId, chapterNumber: ch.number, chapterTitle: ch.title })), null, 2),
    "utf8",
  );
}

test("no-api promote rejects ambient legacy attestations before deep release gates", () => {
  const prev = process.env.CHAPTERFLOW_NO_API_CODEX_QC;
  const oldWarn = console.warn;
  try {
    console.warn = () => {};
    cleanup();
    const chapters = [1, 2, 3].map((n) => makeChapter(BOOK, n));
    writeFixtureBookWithIndex(chapters);
    for (const ch of chapters) {
      recordAuthorProvenance(ch.chapterId, `author-session-${ch.number}`);
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
        reviewerSessionId: `reviewer-session-${ch.number}`,
      });
    }
    process.env.CHAPTERFLOW_NO_API_CODEX_QC = "1";
    const result = promoteBook({
      bookId: BOOK,
      title: "Fixture",
      author: "Nobody",
      chapters: chapters.map((ch) => ({ chapterId: ch.chapterId, chapterNumber: ch.number, chapterTitle: ch.title })) as any,
    });
    assert.equal(result.promoted, false, "ambient legacy attestations cannot authorize release");
    assert.match(result.reason, /QC0\.missing_attestation/);
    const report = JSON.parse(readFileSync(resolve(PIPELINE_DIR, "state", "books", `${BOOK}.gate.json`), "utf8"));
    assertLegacyAuthorityBlocked(report);
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
    writeFixtureBookWithIndex(chapters);
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
    // The source-REALITY gate is an always-on production invariant (its own report section), not
    // part of the no-API stack — a direct promote-book runs it regardless of mode or env.
    const srIds = (report.sourceReality?.findings ?? []).map((f: any) => f.checkId);
    assert.equal(report.sourceReality?.decision, "invalid", `present rubber-stamp record must yield an "invalid" decision: ${JSON.stringify(report.sourceReality)}`);
    assert.ok(srIds.includes("SV4"), `source-verify rubber-stamp (SV4) blocker missing from promoteBook source-reality gate: ${srIds.join(", ")}`);
    assert.ok((result.sourceRealityBlockerCount ?? 0) > 0, "source-reality blocker count must be > 0");
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
    writeFixtureBookWithIndex([chapter]);
    openQcRound(BOOK, "r-legacy-major");
    // Select a BLOCKING (non-advisory) major — a legacy waiver must not close THOSE.
    // (Advisory majors never block, so a legacy waiver on one is moot; the fixture trips
    // an enforced SEAM major, which is blocking.)
    const finding = currentMajorFindings(BOOK, [chapter]).find((f) => !isAdvisoryMajor(f.checkId));
    assert.ok(finding, "fixture should expose at least one BLOCKING current major");
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
    assert.equal(
      unresolvedMajors(BOOK, [chapter], true).some((f) => f.id === finding.id),
      true,
      "legacy unbound waivers remain auditable but no longer close production-blocking majors",
    );
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

test("no-api promote rejects ambient round-backed PUBLISHABLE state without release mutations", () => {
  const prev = process.env.CHAPTERFLOW_NO_API_CODEX_QC;
  const oldWarn = console.warn;
  try {
    console.warn = () => {};
    cleanup();
    const chapter = makeChapter(BOOK, 1);
    writeFixtureBookWithIndex([chapter]);
    openQcRound(BOOK, "r-no-api-artifacts");
    recordAuthorProvenance(chapter.chapterId, "author-session-artifact-test");
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
      reviewerSessionId: "reviewer-session-artifact-test",
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
    assert.equal(result.promoted, false, "ambient round and PUBLISHABLE attestation cannot authorize release");
    assert.match(result.reason, /QC0\.missing_attestation/);
    const report = JSON.parse(readFileSync(resolve(PIPELINE_DIR, "state", "books", `${BOOK}.gate.json`), "utf8"));
    assertLegacyAuthorityBlocked(report);
  } finally {
    console.warn = oldWarn;
    if (prev === undefined) delete process.env.CHAPTERFLOW_NO_API_CODEX_QC;
    else process.env.CHAPTERFLOW_NO_API_CODEX_QC = prev;
    cleanup();
  }
});
