import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_DEVICES_PER_USER,
  MAX_PUSH_FANOUT,
  selectDevicesToEvict,
  type DeviceRowRef,
} from "./device-cap-core";

function row(sk: string, lastSeenAt?: string): DeviceRowRef {
  return { SK: sk, lastSeenAt };
}

test("MAX_PUSH_FANOUT equals the per-user device cap", () => {
  assert.equal(MAX_PUSH_FANOUT, MAX_DEVICES_PER_USER);
});

test("no eviction when at or below the cap (re-register of an existing device)", () => {
  const rows = [row("DEVICE#a", "2026-06-01T00:00:00Z"), row("DEVICE#b", "2026-06-02T00:00:00Z")];
  // Re-registering an existing device must not evict anything.
  assert.deepEqual(selectDevicesToEvict(rows, "DEVICE#a", 5), []);
  // A brand new device (3rd) under a cap of 5 also evicts nothing.
  assert.deepEqual(selectDevicesToEvict(rows, "DEVICE#c", 5), []);
});

test("a new device beyond the cap evicts the OLDEST existing row by lastSeenAt", () => {
  // cap=3, two existing devices, registering a 3rd new one -> still at cap (no evict).
  const two = [row("DEVICE#a", "2026-06-01T00:00:00Z"), row("DEVICE#b", "2026-06-03T00:00:00Z")];
  assert.deepEqual(selectDevicesToEvict(two, "DEVICE#new", 3), []);

  // cap=3, three existing devices, registering a 4th new one -> evict the oldest (a).
  const three = [
    row("DEVICE#a", "2026-06-01T00:00:00Z"), // oldest
    row("DEVICE#b", "2026-06-03T00:00:00Z"),
    row("DEVICE#c", "2026-06-02T00:00:00Z"),
  ];
  const evicted = selectDevicesToEvict(three, "DEVICE#new", 3);
  assert.deepEqual(evicted, [{ SK: "DEVICE#a" }]);
});

test("BEFORE-fix would keep all rows; AFTER-fix bounds rows to the cap", () => {
  // Simulate a user who has registered far more endpoints than the cap.
  const many: DeviceRowRef[] = [];
  for (let i = 0; i < 50; i++) {
    // newer index => newer lastSeenAt
    const ts = new Date(Date.UTC(2026, 5, 1, 0, 0, i)).toISOString();
    many.push(row(`DEVICE#${String(i).padStart(2, "0")}`, ts));
  }
  // Registering one more new endpoint.
  const evicted = selectDevicesToEvict(many, "DEVICE#new", MAX_DEVICES_PER_USER);
  // Post-write count = (50 existing + 1 new) - evicted must equal the cap.
  const postWriteCount = many.length + 1 - evicted.length;
  assert.equal(postWriteCount, MAX_DEVICES_PER_USER);
  // The retained rows are the newest cap-1 existing + the incoming one; the
  // very oldest (DEVICE#00) must be among the evicted.
  assert.ok(evicted.some((e) => e.SK === "DEVICE#00"));
  // The incoming row is never evicted.
  assert.ok(!evicted.some((e) => e.SK === "DEVICE#new"));
});

test("legacy rows without lastSeenAt are evicted first (treated as oldest)", () => {
  const rows = [
    row("DEVICE#legacy"), // no lastSeenAt
    row("DEVICE#recent", "2026-06-10T00:00:00Z"),
  ];
  // cap=2, registering a 3rd new device -> the legacy (timestamp-less) row goes.
  const evicted = selectDevicesToEvict(rows, "DEVICE#new", 2);
  assert.deepEqual(evicted, [{ SK: "DEVICE#legacy" }]);
});

test("re-registering an existing device refreshes its slot without evicting others", () => {
  // At cap (cap=2): re-registering the OLDER device must not evict the newer one;
  // the incoming row is always kept and counts as most-recent.
  const rows = [
    row("DEVICE#old", "2026-06-01T00:00:00Z"),
    row("DEVICE#new", "2026-06-09T00:00:00Z"),
  ];
  assert.deepEqual(selectDevicesToEvict(rows, "DEVICE#old", 2), []);
});

test("duplicate rows in the read are de-duped by SK before ranking", () => {
  const rows = [
    row("DEVICE#a", "2026-06-01T00:00:00Z"),
    row("DEVICE#a", "2026-06-01T00:00:00Z"),
    row("DEVICE#b", "2026-06-02T00:00:00Z"),
  ];
  // Two distinct devices + 1 new = 3, cap 3 -> no eviction.
  assert.deepEqual(selectDevicesToEvict(rows, "DEVICE#c", 3), []);
});

test("incoming SK already present is not double-counted", () => {
  const rows = [
    row("DEVICE#a", "2026-06-01T00:00:00Z"),
    row("DEVICE#b", "2026-06-02T00:00:00Z"),
    row("DEVICE#c", "2026-06-03T00:00:00Z"),
  ];
  // Re-register an existing device at cap=3: count stays 3, nothing evicted.
  assert.deepEqual(selectDevicesToEvict(rows, "DEVICE#b", 3), []);
});
