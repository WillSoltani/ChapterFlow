import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "fs";
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
  withQcTransaction,
  type QcTransactionLease,
  type QcTransactionRecord,
} from "../src/qc/orchestrator/transaction.js";
import { openQcRound, qcRoundPath } from "../src/qc/qcRound.js";

const BOOK = "zz-fixture-qc-transaction";
const ROUND = "r-transaction";

const T0 = Date.parse("2026-06-23T00:00:00.000Z");
const at = (ms: number): Date => new Date(T0 + ms);

function cleanupRound(round: string): void {
  rmSync(orchestratorRoundDir(BOOK, round), { recursive: true, force: true });
  rmSync(qcRoundPath(BOOK, round), { force: true });
}

function cleanup(...extraRounds: string[]): void {
  cleanTmp();
  for (const round of [ROUND, ...extraRounds]) cleanupRound(round);
}

function readLock(round: string = ROUND): QcTransactionRecord {
  return JSON.parse(readFileSync(qcTransactionLockPath(BOOK, round), "utf8")) as QcTransactionRecord;
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

// ── Lease behavior (TTL recovery + ownerToken-gated release) ──────────────────

test("withQcTransaction SUCCESS path tolerates a successor reclaiming the lock mid-operation (TTL breach) — a slow finalize is not masked by a lock-cleanup throw (I5·W3)", () => {
  try {
    cleanup();
    let ran = false;
    const result = withQcTransaction(BOOK, ROUND, "finalize", (lease) => {
      ran = true;
      // Simulate a successor that recoverStaleLock-renamed our lease after we exceeded DEFAULT_TTL_MS:
      // rewrite the lock with a DIFFERENT ownerToken so our success-path commit cannot match it.
      const rec = JSON.parse(readFileSync(lease.lockPath, "utf8"));
      writeFileSync(lease.lockPath, JSON.stringify({ ...rec, ownerToken: "successor-token" }), "utf8");
      return "finalize-result";
    });
    assert.equal(ran, true);
    assert.equal(result, "finalize-result", "the operation result is returned even though the lock was reclaimed (success-path commit owner-mismatch swallowed, not propagated)");
  } finally {
    rmSync(qcTransactionLockPath(BOOK, ROUND), { force: true });
    cleanup();
  }
});

test("QC transaction release is gated on the on-disk owner token", () => {
  try {
    cleanup();
    const lease = acquireQcTransaction(BOOK, ROUND, "finalize");
    const wrongOwner: QcTransactionLease = { ...lease, ownerToken: "not-the-real-token" };
    assert.throws(() => commitQcTransaction(wrongOwner), /owner mismatch/);
    commitQcTransaction(lease);
    assert.equal(existsSync(qcTransactionLockPath(BOOK, ROUND)), false, "real owner releases the lock");
  } finally {
    cleanup();
  }
});

test("a live (unexpired) lock cannot be displaced", () => {
  try {
    cleanup();
    const lease = acquireQcTransaction(BOOK, ROUND, "finalize", { now: at(0), ttlMs: 10_000 });
    assert.throws(
      () => acquireQcTransaction(BOOK, ROUND, "collect", { now: at(1_000) }),
      /already active/,
    );
    assert.equal(readLock().ownerToken, lease.ownerToken, "live lock is untouched");
    commitQcTransaction(lease);
  } finally {
    cleanup();
  }
});

test("a stale (expired) lock is recovered and retained as forensic evidence", () => {
  try {
    cleanup();
    acquireQcTransaction(BOOK, ROUND, "finalize", { now: at(0), ttlMs: 1 });
    const recovered = acquireQcTransaction(BOOK, ROUND, "collect", { now: at(60 * 60 * 1000) });
    assert.equal(recovered.operation, "collect", "the abandoned stale lock was recovered");
    const lockDir = dirname(qcTransactionLockPath(BOOK, ROUND));
    assert.ok(
      readdirSync(lockDir).some((name) => name.includes(".qc-transaction.lock.recovered-")),
      "the displaced stale lock is retained as forensic evidence",
    );
    commitQcTransaction(recovered);
  } finally {
    cleanup();
  }
});

test("an old lease cannot release a successor's lock", () => {
  try {
    cleanup();
    const stale = acquireQcTransaction(BOOK, ROUND, "finalize", { now: at(0), ttlMs: 1 });
    const successor = acquireQcTransaction(BOOK, ROUND, "collect", { now: at(1_000) });
    assert.notEqual(successor.ownerToken, stale.ownerToken);

    // The displaced owner must not delete or rewrite the successor's lock.
    assert.throws(() => commitQcTransaction(stale), /owner mismatch/);
    assert.equal(readLock().ownerToken, successor.ownerToken, "successor's lock survives the old owner's release");

    commitQcTransaction(successor);
    assert.equal(existsSync(qcTransactionLockPath(BOOK, ROUND)), false);
  } finally {
    cleanup();
  }
});

test("nested same-round transactions reuse the lease and release exactly once", () => {
  try {
    cleanup();
    let outerLease: QcTransactionLease | undefined;
    let innerLease: QcTransactionLease | undefined;
    let lockHeldDuringInner = false;

    const out = withQcTransaction(BOOK, ROUND, "finalize", (outer) => {
      outerLease = outer;
      const inner = withQcTransaction(BOOK, ROUND, "status", (lease) => {
        innerLease = lease;
        lockHeldDuringInner = existsSync(qcTransactionLockPath(BOOK, ROUND));
        return "inner";
      }, { now: at(0) });
      // The nested release must NOT drop the outer lease's lock.
      assert.ok(existsSync(qcTransactionLockPath(BOOK, ROUND)), "outer lease survives the nested return");
      return inner;
    }, { now: at(0) });

    assert.equal(out, "inner");
    assert.equal(innerLease, outerLease, "nested same-round transaction reuses the same lease object");
    assert.ok(lockHeldDuringInner);
    assert.equal(existsSync(qcTransactionLockPath(BOOK, ROUND)), false, "released exactly once after the outer commit");
  } finally {
    cleanup();
  }
});

test("different rounds do not reuse each other's lease", () => {
  const OUTER = "r-outer";
  const INNER = "r-inner";
  try {
    cleanup(OUTER, INNER);
    let outerLease: QcTransactionLease | undefined;
    let innerLease: QcTransactionLease | undefined;

    withQcTransaction(BOOK, OUTER, "finalize", (outer) => {
      outerLease = outer;
      withQcTransaction(BOOK, INNER, "status", (lease) => {
        innerLease = lease;
        // A different round must acquire its OWN distinct lock, not reuse the outer.
        assert.ok(existsSync(qcTransactionLockPath(BOOK, INNER)));
      }, { now: at(0) });
      // The inner round released its own lock; the outer's lock is still held.
      assert.equal(existsSync(qcTransactionLockPath(BOOK, INNER)), false);
      assert.ok(existsSync(qcTransactionLockPath(BOOK, OUTER)));
    }, { now: at(0) });

    assert.notEqual(innerLease!.ownerToken, outerLease!.ownerToken, "distinct rounds get distinct lease tokens");
    assert.equal(innerLease!.roundId, INNER);
    assert.equal(outerLease!.roundId, OUTER);
    assert.equal(existsSync(qcTransactionLockPath(BOOK, OUTER)), false);
    assert.equal(existsSync(qcTransactionLockPath(BOOK, INNER)), false);
  } finally {
    cleanup(OUTER, INNER);
  }
});

// ── Serialization through the owned transaction (behavior preserved) ─────────

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
