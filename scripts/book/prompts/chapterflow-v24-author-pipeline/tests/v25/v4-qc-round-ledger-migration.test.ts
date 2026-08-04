import assert from "node:assert/strict";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { createBookWriteLock } from "../../src/books/bookLease.js";
import type { BookContentReader } from "../../src/books/candidateTypes.js";
import type { ReviewService } from "../../src/review/reviewTypes.js";
import {
  checkQcWriterCutover,
  inspectQcLedgerDryRun,
  qcShadowParity,
  type LegacyQcProjection,
} from "../../src/qc/legacyQcStateAdapter.js";
import { createQcService } from "../../src/qc/qcService.js";
import { qcStoragePaths } from "../../src/qc/qcStore.js";
import type { QcRoundResult } from "../../src/qc/qcTypes.js";
import { finishV25Tests, requiredTest, type TestContext } from "./harness.js";

const unusedReader: BookContentReader = {
  async open() { return { ok: false, error: { code: "UNUSED", message: "unused in ledger tests" } }; },
};
const unusedReview: ReviewService = {
  async screen() { return { ok: false, error: { code: "UNUSED", message: "unused in ledger tests" } }; },
  async reviewCanonical() { return { ok: false, error: { code: "UNUSED", message: "unused in ledger tests" } }; },
  async get() { return { ok: false, error: { code: "UNUSED", message: "unused in ledger tests" } }; },
};

function malformedFixture(context: TestContext, bookId: string): { ledger: string; bytes: Buffer } {
  const ledger = qcStoragePaths(context.roots.booksRoot, bookId).ledger;
  const bytes = Buffer.from('{"schemaVersion":"1","kind":"ROUND"}\nnot-json\n', "utf8");
  mkdirSync(dirname(ledger), { recursive: true });
  writeFileSync(ledger, bytes);
  return { ledger, bytes };
}

function metadata(path: string) {
  const stat = statSync(path, { bigint: true });
  return { mode: stat.mode, size: stat.size, mtimeNs: stat.mtimeNs };
}

function service(context: TestContext, points: string[] = []) {
  return createQcService({
    booksRoot: context.roots.booksRoot,
    contentReader: unusedReader,
    reviewService: unusedReview,
    writeLock: createBookWriteLock({ booksRoot: context.roots.booksRoot, timeoutMs: 2_000, pollMs: 1 }),
    now: () => context.clock.now(),
    repairSeams: { point: (name) => points.push(name), tempSuffix: () => "acceptance" },
  });
}

requiredTest("malformed ledger status and dry-run preserve bytes and metadata", async (context) => {
  const bookId = context.ids.next("book-malformed");
  const fixture = malformedFixture(context, bookId);
  const before = metadata(fixture.ledger);
  const status = await service(context).readStatus(bookId);
  assert.equal(status.ok, false);
  if (!status.ok) assert.equal(status.error.code, "QC_LEDGER_MALFORMED");
  const dryRun = inspectQcLedgerDryRun(readFileSync(fixture.ledger));
  assert.equal(dryRun.ok, false);
  if (!dryRun.ok) assert.equal(dryRun.error.code, "QC_LEDGER_MALFORMED");
  assert.deepEqual(readFileSync(fixture.ledger), fixture.bytes);
  assert.deepEqual(metadata(fixture.ledger), before);
});

requiredTest("named locked repair preserves raw source and performs one replacement", async (context) => {
  const bookId = context.ids.next("book-repair");
  const repairId = context.ids.next("repair");
  const fixture = malformedFixture(context, bookId);
  const points: string[] = [];
  const repaired = await service(context, points).repairLedger({
    bookId,
    repairId,
    expectedRevision: 0,
    confirmation: "REPAIR_QC_LEDGER",
  });
  assert.equal(repaired.ok, true);
  assert.ok(repaired.ok);
  assert.deepEqual(points, ["ledger.after-preserve", "ledger.before-replace", "ledger.after-replace"]);
  assert.deepEqual(readFileSync(repaired.value.preservedSourcePath), fixture.bytes);
  assert.notDeepEqual(readFileSync(fixture.ledger), fixture.bytes);
  assert.equal((await service(context).readStatus(bookId)).ok, true);
});

requiredTest("same expected revision serializes to one repair and one byte-stable conflict", async (context) => {
  const bookId = context.ids.next("book-race");
  const fixture = malformedFixture(context, bookId);
  const qc = service(context);
  const results = await Promise.all([
    qc.repairLedger({ bookId, repairId: context.ids.next("repair"), expectedRevision: 0, confirmation: "REPAIR_QC_LEDGER" }),
    qc.repairLedger({ bookId, repairId: context.ids.next("repair"), expectedRevision: 0, confirmation: "REPAIR_QC_LEDGER" }),
  ]);
  assert.equal(results.filter((result) => result.ok).length, 1);
  const conflict = results.find((result) => !result.ok);
  assert.ok(conflict && !conflict.ok);
  assert.equal(conflict.error.code, "QC_LEDGER_REVISION_CONFLICT");
  const committed = readFileSync(fixture.ledger);
  assert.equal(committed.toString("utf8").trim().split("\n").length, 1);
  const reread = await qc.repairLedger({
    bookId,
    repairId: context.ids.next("repair"),
    expectedRevision: 0,
    confirmation: "REPAIR_QC_LEDGER",
  });
  assert.equal(reread.ok, false);
  assert.deepEqual(readFileSync(fixture.ledger), committed);
});

requiredTest("legacy and V4 shadow projections normalize identically", (context) => {
  const round: QcRoundResult = {
    schemaVersion: "1",
    roundId: context.ids.next("round"),
    candidate: { candidateId: context.ids.next("candidate"), manifestDigest: "digest-parity" },
    reviewId: context.ids.next("review"),
    outcome: "FAIL",
    issues: [{ code: "QC_FIX", severity: "BLOCKER", message: "fixture finding" }],
    completedAt: context.clock.now(),
  };
  const legacy: LegacyQcProjection = {
    bookId: context.ids.next("book-parity"),
    roundId: round.roundId,
    candidate: round.candidate,
    reviewId: round.reviewId,
    outcome: round.outcome,
    issues: round.issues,
  };
  const parity = qcShadowParity(legacy, round);
  assert.equal(parity.ok, true);
  assert.ok(parity.ok);
  assert.deepEqual(parity.value.legacy, parity.value.v4);
});

requiredTest("mixed legacy and V4 writer cutover blocks before mutation", (context) => {
  const bookId = context.ids.next("book-cutover");
  const mixed = checkQcWriterCutover({
    bookId,
    legacyWriterEnabled: true,
    v4WriterEnabled: true,
    cutoverComplete: true,
    v4WriteObserved: false,
  });
  assert.equal(mixed.ok, false);
  if (!mixed.ok) assert.equal(mixed.error.code, "QC_MIXED_WRITERS_BLOCKED");
  const rollbackAfterWrite = checkQcWriterCutover({
    bookId,
    legacyWriterEnabled: true,
    v4WriterEnabled: false,
    cutoverComplete: false,
    v4WriteObserved: true,
  });
  assert.equal(rollbackAfterWrite.ok, false);
  if (!rollbackAfterWrite.ok) assert.equal(rollbackAfterWrite.error.code, "QC_LEGACY_WRITER_AFTER_V4_WRITE");
  assert.deepEqual(checkQcWriterCutover({
    bookId,
    legacyWriterEnabled: false,
    v4WriterEnabled: true,
    cutoverComplete: true,
    v4WriteObserved: true,
  }), { ok: true, value: "V4" });
});

finishV25Tests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
