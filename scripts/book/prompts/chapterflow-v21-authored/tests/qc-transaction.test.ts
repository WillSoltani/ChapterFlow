import assert from "node:assert/strict";
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";

import { test } from "./harness.js";
import { TMP_DIR, cleanTmp } from "./helpers.js";
import { finalizeQcRound } from "../src/qc/orchestrator/finalize.js";
import { appendStatusEvents, readLedgerEvents } from "../src/qc/orchestrator/ledger.js";
import { orchestratorRoundDir } from "../src/qc/orchestrator/artifacts.js";
import { submitQcArtifact } from "../src/qc/orchestrator/index.js";
import {
  acquireQcTransaction,
  commitQcTransaction,
  qcTransactionLockPath,
  type QcTransactionLease,
} from "../src/qc/orchestrator/transaction.js";
import { openQcRound, qcRoundPath } from "../src/qc/qcRound.js";

const BOOK = "zz-fixture-qc-transaction";
const ROUND = "r-transaction";

function cleanup(): void {
  cleanTmp();
  rmSync(orchestratorRoundDir(BOOK, ROUND), { recursive: true, force: true });
  rmSync(qcRoundPath(BOOK, ROUND), { force: true });
}

function withSession<T>(sessionId: string, fn: () => T): T {
  const prev = process.env.CHAPTERFLOW_SESSION_ID;
  try {
    process.env.CHAPTERFLOW_SESSION_ID = sessionId;
    return fn();
  } finally {
    if (prev === undefined) delete process.env.CHAPTERFLOW_SESSION_ID;
    else process.env.CHAPTERFLOW_SESSION_ID = prev;
  }
}

function sweepSubmissionPath(): string {
  const path = resolve(TMP_DIR, "sweep-submission.json");
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify({
    schemaVersion: "qc-sweep-submission-v1",
    bookId: BOOK,
    roundId: ROUND,
    role: "sweep",
    reviewer: "codex-qc:sweep",
    verdict: "PASS",
    checkedFamilies: ["scene_skeleton", "persona_drift", "repeated_unit", "location_stamping"],
    findings: [],
  }, null, 2), "utf8");
  return path;
}

test("QC transaction release is owner-checked", () => {
  try {
    cleanup();
    const lease = acquireQcTransaction(BOOK, ROUND, "finalize");
    const wrongOwner: QcTransactionLease = { ...lease, ownerId: "qctx-someone-else" };
    assert.throws(() => commitQcTransaction(wrongOwner), /owner mismatch/);
    commitQcTransaction(lease);
  } finally {
    cleanup();
  }
});

test("stale QC transaction lock recovers after a crash", () => {
  try {
    cleanup();
    acquireQcTransaction(BOOK, ROUND, "finalize", { now: new Date("2026-06-23T00:00:00.000Z"), ttlMs: 1 });
    const recovered = acquireQcTransaction(BOOK, ROUND, "collect", { now: new Date("2026-06-23T00:00:01.000Z"), ttlMs: 10_000 });
    assert.equal(recovered.operation, "collect");
    commitQcTransaction(recovered);
    const lockDir = dirname(qcTransactionLockPath(BOOK, ROUND));
    assert.ok(readdirSync(lockDir).some((name) => name.includes(".qc-transaction.lock.recovered-")), "stale lock should be retained as recovery evidence");
  } finally {
    cleanup();
  }
});

test("concurrent submit/finalize attempts serialize through the owned transaction", () => {
  try {
    cleanup();
    const { tokens } = openQcRound(BOOK, ROUND);
    const file = sweepSubmissionPath();
    const lease = acquireQcTransaction(BOOK, ROUND, "finalize");
    assert.throws(
      () => withSession("qc-submit-session", () => submitQcArtifact(BOOK, ROUND, "sweep", file, tokens.sweep)),
      /QC transaction already active/,
    );
    commitQcTransaction(lease);
    const result = withSession("qc-submit-session", () => submitQcArtifact(BOOK, ROUND, "sweep", file, tokens.sweep));
    assert.equal(result.ok, true, result.errors.join("\n"));
  } finally {
    cleanup();
  }
});

test("concurrent status/finalize attempts serialize with no lost status event", () => {
  try {
    cleanup();
    const finalizeLease = acquireQcTransaction(BOOK, ROUND, "finalize");
    assert.throws(
      () => appendStatusEvents(BOOK, ROUND, [{ findingId: "qcf-a", status: "still_open", reason: "blocked by active finalize" }]),
      /QC transaction already active/,
    );
    commitQcTransaction(finalizeLease);

    const statusLease = acquireQcTransaction(BOOK, ROUND, "status");
    assert.throws(() => finalizeQcRound(BOOK, ROUND, { dryRun: true }), /QC transaction already active/);
    commitQcTransaction(statusLease);

    const wrote = appendStatusEvents(BOOK, ROUND, [{ findingId: "qcf-a", status: "still_open", reason: "serialized after finalize" }]);
    assert.equal(wrote, 1);
    const events = readLedgerEvents(BOOK, ROUND);
    assert.equal(events.length, 1);
    assert.equal(events[0].event, "status");
  } finally {
    cleanup();
  }
});
