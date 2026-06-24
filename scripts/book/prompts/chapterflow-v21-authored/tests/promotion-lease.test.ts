/**
 * Promotion lease — ownership-safe concurrency unit tests.
 *
 * These pin the lease primitive that replaced promoteBook's broad
 * `recoverPromotionTransactions` delete: only one promotion per book at a time,
 * and a contender displaces a lock ONLY when it can prove the prior owner is
 * dead. Mirrors tests/qc-transaction.test.ts — the same design, applied to the
 * promotion seam. The promoteBook-level integration of the lease (fail-closed
 * promote, owner-proven tx-dir reaping, fault evidence) lives in
 * tests/promote-gate.test.ts where the book fixture already exists.
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from "fs";
import { resolve } from "path";

import { test } from "./harness.js";
import {
  acquirePromotionLease,
  defaultPromotionOwnerLiveness,
  heartbeatPromotionLease,
  leaseStillOwned,
  promotionLockDir,
  promotionLockPath,
  releasePromotionLease,
  type PromotionLease,
  type PromotionLeaseRecord,
} from "../src/promotionLease.js";

const BOOK = "zz-fixture-promotion-lease";
const TX = "tx-fixture";

const T0 = Date.parse("2026-06-23T00:00:00.000Z");
const at = (ms: number): Date => new Date(T0 + ms);

function cleanup(): void {
  // Remove the canonical lock and any `.recovered-*` forensic siblings.
  try {
    for (const name of readdirSync(promotionLockDir())) {
      if (name.startsWith(`${BOOK}.promotion.lock`)) rmSync(resolve(promotionLockDir(), name), { force: true });
    }
  } catch { /* dir may not exist yet */ }
}

function readLock(): PromotionLeaseRecord {
  return JSON.parse(readFileSync(promotionLockPath(BOOK), "utf8")) as PromotionLeaseRecord;
}

test("promotion lease records every required field with a crypto-random owner token", () => {
  try {
    cleanup();
    const lease = acquirePromotionLease(BOOK, TX, { now: at(0), ttlMs: 10_000 });
    const lock = readLock();
    assert.equal(lock.schemaVersion, "promotion-lease-v1");
    assert.equal(lock.bookId, BOOK);
    assert.equal(lock.transactionId, TX);
    assert.equal(lock.pid, process.pid);
    assert.ok(lock.hostname.length > 0, "hostname recorded");
    assert.equal(lock.acquiredAt, at(0).toISOString());
    assert.equal(lock.lastHeartbeatAt, at(0).toISOString());
    assert.equal(lock.expiresAt, at(10_000).toISOString());
    assert.match(lock.ownerToken, /^[0-9a-f]{32}$/, "owner token is 16 random bytes hex");
    assert.equal(lock.ownerToken, lease.ownerToken);
    releasePromotionLease(lease);
  } finally {
    cleanup();
  }
});

test("a second promotion cannot acquire a live (unexpired) lease", () => {
  try {
    cleanup();
    const a = acquirePromotionLease(BOOK, "tx-a", { now: at(0), ttlMs: 10_000 });
    assert.throws(
      // Not expired — liveness is irrelevant, even a "dead" claim must lose.
      () => acquirePromotionLease(BOOK, "tx-b", { now: at(1_000), liveness: () => "dead" }),
      /already active/,
    );
    assert.equal(readLock().ownerToken, a.ownerToken, "live lock is untouched");
    releasePromotionLease(a);
  } finally {
    cleanup();
  }
});

test("a lease older than the TTL but with a live owner cannot be stolen", () => {
  try {
    cleanup();
    // Expires almost immediately, but the owner pid (this very process) is alive.
    const a = acquirePromotionLease(BOOK, "tx-a", { now: at(0), ttlMs: 1 });
    assert.throws(
      // Default probe: same host + this pid answers signal 0 => alive.
      () => acquirePromotionLease(BOOK, "tx-b", { now: at(60 * 60 * 1000) }),
      /still alive/,
    );
    assert.equal(readLock().ownerToken, a.ownerToken, "a live owner keeps its lease past the wall-clock TTL");
    releasePromotionLease(a);
  } finally {
    cleanup();
  }
});

test("an expired lease with a known-dead owner is recovered", () => {
  try {
    cleanup();
    const dead = acquirePromotionLease(BOOK, "tx-dead", { now: at(0), ttlMs: 1 });
    const recovered = acquirePromotionLease(BOOK, "tx-new", { now: at(1_000), liveness: () => "dead" });
    assert.equal(recovered.transactionId, "tx-new", "the dead owner's stale lock was recovered");
    assert.notEqual(recovered.ownerToken, dead.ownerToken);
    assert.equal(recovered.recoveredFrom?.ownerToken, dead.ownerToken, "the displaced dead owner is reported");
    assert.ok(
      readdirSync(promotionLockDir()).some((name) => name.includes(".promotion.lock.recovered-")),
      "the displaced stale lock is retained as forensic evidence",
    );
    releasePromotionLease(recovered);
  } finally {
    cleanup();
  }
});

test("an expired lease whose owner liveness is unknown fails closed", () => {
  try {
    cleanup();
    const a = acquirePromotionLease(BOOK, "tx-a", { now: at(0), ttlMs: 1 });
    assert.throws(
      () => acquirePromotionLease(BOOK, "tx-b", { now: at(1_000), liveness: () => "unknown" }),
      /unknown; failing closed/,
    );
    assert.equal(readLock().ownerToken, a.ownerToken, "unknown liveness must not displace the lock");
    releasePromotionLease(a);
  } finally {
    cleanup();
  }
});

test("the default probe treats a remote-host owner as unknown and fails closed", () => {
  try {
    cleanup();
    const a = acquirePromotionLease(BOOK, "tx-a", { now: at(0), ttlMs: 1, hostname: "ghost-host-not-here" });
    assert.throws(
      () => acquirePromotionLease(BOOK, "tx-b", { now: at(1_000) }),
      /unknown; failing closed/,
    );
    assert.equal(readLock().ownerToken, a.ownerToken);
    releasePromotionLease(a);
  } finally {
    cleanup();
  }
});

test("a heartbeat pushes expiresAt forward via an atomic replace (never momentarily absent)", () => {
  try {
    cleanup();
    const lease = acquirePromotionLease(BOOK, TX, { now: at(0), ttlMs: 10_000 });
    assert.equal(Date.parse(readLock().expiresAt), T0 + 10_000);
    heartbeatPromotionLease(lease, { now: at(5_000) });
    assert.equal(Date.parse(readLock().expiresAt), T0 + 5_000 + 10_000, "re-extended by the lease ttl from the heartbeat moment");
    assert.equal(Date.parse(readLock().lastHeartbeatAt), T0 + 5_000);
    assert.ok(existsSync(promotionLockPath(BOOK)), "the lock is never momentarily absent during a heartbeat");
    releasePromotionLease(lease);
  } finally {
    cleanup();
  }
});

test("a heartbeating owner is protected past the original TTL even when liveness would allow recovery", () => {
  try {
    cleanup();
    const a = acquirePromotionLease(BOOK, "tx-a", { now: at(0), ttlMs: 1_000 });
    heartbeatPromotionLease(a, { now: at(900) }); // expires at T0+1900
    assert.throws(
      () => acquirePromotionLease(BOOK, "tx-b", { now: at(1_500), liveness: () => "dead" }),
      /already active/,
    );
    assert.equal(readLock().ownerToken, a.ownerToken);
    releasePromotionLease(a);
  } finally {
    cleanup();
  }
});

test("release is compare-by-owner-token: a wrong owner cannot remove the lock", () => {
  try {
    cleanup();
    const lease = acquirePromotionLease(BOOK, TX, { now: at(0), ttlMs: 10_000 });
    const wrongOwner: PromotionLease = { ...lease, ownerToken: "not-the-real-token" };
    assert.equal(releasePromotionLease(wrongOwner), false, "wrong owner release is a no-op");
    assert.ok(existsSync(promotionLockPath(BOOK)), "the real owner's lock survives a wrong-owner release");
    assert.equal(releasePromotionLease(lease), true, "the real owner releases");
    assert.equal(existsSync(promotionLockPath(BOOK)), false);
  } finally {
    cleanup();
  }
});

test("an old owner can never remove or overwrite a successor's lock", () => {
  try {
    cleanup();
    const stale = acquirePromotionLease(BOOK, "tx-stale", { now: at(0), ttlMs: 1 });
    const successor = acquirePromotionLease(BOOK, "tx-succ", { now: at(1_000), liveness: () => "dead" });
    assert.notEqual(successor.ownerToken, stale.ownerToken);
    assert.equal(leaseStillOwned(stale), false, "the displaced lease knows it lost the lock");
    assert.equal(leaseStillOwned(successor), true);

    // The displaced owner must not delete the successor's lock...
    assert.equal(releasePromotionLease(stale), false);
    assert.equal(readLock().ownerToken, successor.ownerToken, "successor's lock survives the old owner's release");
    // ...nor overwrite it via a heartbeat.
    assert.throws(() => heartbeatPromotionLease(stale, { now: at(2_000) }), /no longer holds the lock/);
    assert.equal(readLock().ownerToken, successor.ownerToken, "successor's lock survives the old owner's heartbeat");

    assert.equal(releasePromotionLease(successor), true);
    assert.equal(existsSync(promotionLockPath(BOOK)), false);
  } finally {
    cleanup();
  }
});

test("an unreadable / foreign lock is never displaced (fail closed)", () => {
  try {
    cleanup();
    // Simulate a lock the lease cannot parse (truncated / foreign schema).
    const a = acquirePromotionLease(BOOK, "tx-a", { now: at(0), ttlMs: 10_000 });
    // Corrupt the on-disk lock so parseLock returns null.
    rmSync(promotionLockPath(BOOK), { force: true });
    writeFileSync(promotionLockPath(BOOK), "{ not json", "utf8");
    assert.throws(
      () => acquirePromotionLease(BOOK, "tx-b", { now: at(1_000) }),
      /unrecognized owner/,
    );
    // Clean up the corrupt file directly (a no longer owns a parseable lock).
    rmSync(promotionLockPath(BOOK), { force: true });
    void a;
  } finally {
    cleanup();
  }
});

test("defaultPromotionOwnerLiveness: alive for this pid, unknown for a remote host or missing pid", () => {
  const base = { hostname: "this-host", pid: process.pid };
  assert.equal(defaultPromotionOwnerLiveness(base, "this-host"), "alive");
  assert.equal(defaultPromotionOwnerLiveness(base, "some-other-host"), "unknown");
  assert.equal(defaultPromotionOwnerLiveness({ hostname: "this-host", pid: 0 }, "this-host"), "unknown");
});
