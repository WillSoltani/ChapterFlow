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
  defaultOwnerLiveness,
  heartbeatQcTransaction,
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

// ── Ownership-safe lease behavior ────────────────────────────────────────────

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

test("a live owner stays protected past the original TTL (same-host liveness gate)", () => {
  try {
    cleanup();
    // Expires almost immediately, but the owner pid (this very process) is alive.
    const lease = acquireQcTransaction(BOOK, ROUND, "finalize", { now: at(0), ttlMs: 1 });
    assert.throws(
      // Default probe: same host + this pid answers signal 0 => alive.
      () => acquireQcTransaction(BOOK, ROUND, "collect", { now: at(60 * 60 * 1000) }),
      /still alive/,
    );
    // The displaced acquirer failed closed without touching the live lock.
    assert.equal(readLock().ownerToken, lease.ownerToken, "live lock is untouched");
    commitQcTransaction(lease);
  } finally {
    cleanup();
  }
});

test("a heartbeat pushes expiresAt forward via an atomic replace", () => {
  try {
    cleanup();
    const lease = acquireQcTransaction(BOOK, ROUND, "finalize", { now: at(0), ttlMs: 10_000 });
    const before = Date.parse(readLock().expiresAt);
    assert.equal(before, T0 + 10_000);

    heartbeatQcTransaction(lease, { now: at(5_000) });
    const after = Date.parse(readLock().expiresAt);
    assert.equal(after, T0 + 5_000 + 10_000, "expiresAt re-extended by the lease ttl from the heartbeat moment");
    assert.ok(after > before);
    assert.equal(Date.parse(readLock().lastHeartbeatAt), T0 + 5_000);
    // The lock is never momentarily absent during a heartbeat.
    assert.ok(existsSync(qcTransactionLockPath(BOOK, ROUND)));

    commitQcTransaction(lease);
  } finally {
    cleanup();
  }
});

test("a second owner cannot steal a live (unexpired) lock even if it claims the owner is dead", () => {
  try {
    cleanup();
    const lease = acquireQcTransaction(BOOK, ROUND, "finalize", { now: at(0), ttlMs: 10_000 });
    assert.throws(
      // Not expired yet, so liveness is irrelevant — a "dead" claim must not win.
      () => acquireQcTransaction(BOOK, ROUND, "collect", { now: at(1_000), liveness: () => "dead" }),
      /already active/,
    );
    assert.equal(readLock().ownerToken, lease.ownerToken);
    commitQcTransaction(lease);
  } finally {
    cleanup();
  }
});

test("a heartbeating owner is protected past the original TTL even when liveness would allow recovery", () => {
  try {
    cleanup();
    const lease = acquireQcTransaction(BOOK, ROUND, "finalize", { now: at(0), ttlMs: 1_000 });
    // Without this heartbeat the lock would be stale (expired at T0+1000) by T0+1500.
    heartbeatQcTransaction(lease, { now: at(900) }); // expires at T0+1900
    assert.throws(
      () => acquireQcTransaction(BOOK, ROUND, "collect", { now: at(1_500), liveness: () => "dead" }),
      /already active/,
    );
    assert.equal(readLock().ownerToken, lease.ownerToken);
    commitQcTransaction(lease);
  } finally {
    cleanup();
  }
});

test("a stale lock with a known-dead owner is recovered", () => {
  try {
    cleanup();
    acquireQcTransaction(BOOK, ROUND, "finalize", { now: at(0), ttlMs: 1 });
    const recovered = acquireQcTransaction(BOOK, ROUND, "collect", { now: at(1_000), liveness: () => "dead" });
    assert.equal(recovered.operation, "collect", "the dead owner's stale lock was recovered");
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

test("a stale lock whose owner liveness is unknown is rejected (fail closed)", () => {
  try {
    cleanup();
    // Injected-unknown strategy.
    const lease = acquireQcTransaction(BOOK, ROUND, "finalize", { now: at(0), ttlMs: 1 });
    assert.throws(
      () => acquireQcTransaction(BOOK, ROUND, "collect", { now: at(1_000), liveness: () => "unknown" }),
      /unknown; failing closed/,
    );
    assert.equal(readLock().ownerToken, lease.ownerToken, "unknown liveness must not displace the lock");
    commitQcTransaction(lease);
  } finally {
    cleanup();
  }
});

test("the default probe treats a remote-host owner as unknown and fails closed", () => {
  try {
    cleanup();
    // Stamp the lock with a host that is not this machine, then acquire with the
    // DEFAULT probe — it cannot prove a remote owner is dead, so it fails closed.
    const lease = acquireQcTransaction(BOOK, ROUND, "finalize", { now: at(0), ttlMs: 1, hostname: "ghost-host-not-here" });
    assert.throws(
      () => acquireQcTransaction(BOOK, ROUND, "collect", { now: at(1_000) }),
      /unknown; failing closed/,
    );
    assert.equal(readLock().ownerToken, lease.ownerToken);
    commitQcTransaction(lease);
  } finally {
    cleanup();
  }
});

test("an old lease cannot release a successor's lock", () => {
  try {
    cleanup();
    const stale = acquireQcTransaction(BOOK, ROUND, "finalize", { now: at(0), ttlMs: 1 });
    const successor = acquireQcTransaction(BOOK, ROUND, "collect", { now: at(1_000), liveness: () => "dead" });
    assert.notEqual(successor.ownerToken, stale.ownerToken);

    // The displaced owner must not delete or rewrite the successor's lock.
    assert.throws(() => commitQcTransaction(stale), /owner mismatch/);
    assert.equal(readLock().ownerToken, successor.ownerToken, "successor's lock survives the old owner's release");

    assert.throws(() => heartbeatQcTransaction(stale, { now: at(2_000) }), /heartbeat owner mismatch/);
    assert.equal(readLock().ownerToken, successor.ownerToken, "successor's lock survives the old owner's heartbeat");

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

test("defaultOwnerLiveness: alive for this pid, unknown for a remote host or missing pid", () => {
  const base: QcTransactionRecord = {
    schemaVersion: "qc-transaction-lock-v2",
    bookId: BOOK,
    roundId: ROUND,
    operation: "finalize",
    ownerId: "qctx-test",
    ownerToken: "token",
    hostname: "this-host",
    pid: process.pid,
    acquiredAt: at(0).toISOString(),
    lastHeartbeatAt: at(0).toISOString(),
    expiresAt: at(1).toISOString(),
  };
  assert.equal(defaultOwnerLiveness(base, "this-host"), "alive");
  assert.equal(defaultOwnerLiveness(base, "some-other-host"), "unknown");
  assert.equal(defaultOwnerLiveness({ ...base, pid: 0 }, "this-host"), "unknown");
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
