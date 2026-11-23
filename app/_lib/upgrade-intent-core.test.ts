import assert from "node:assert/strict";
import { test } from "node:test";
import { UPGRADE_RETURN_PATH } from "@/lib/pricing";
import {
  UPGRADE_INTENT_MAX_AGE_MS,
  UPGRADE_INTENT_STORAGE_KEY,
  saveUpgradeIntent,
  takeUpgradeIntentHref,
  upgradeHrefForInterval,
} from "./upgrade-intent-core";

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

const NOW = Date.parse("2026-11-13T12:00:00.000Z");

test("the upgrade link carries the chosen interval to Settings", () => {
  assert.equal(upgradeHrefForInterval("monthly"), `${UPGRADE_RETURN_PATH}&plan=monthly`);
  assert.equal(upgradeHrefForInterval("annual_upfront"), `${UPGRADE_RETURN_PATH}&plan=annual_upfront`);
});

test("a fresh marker sends onboarding to the subscription card, once", () => {
  const storage = memoryStorage();
  saveUpgradeIntent(storage, "annual_upfront", NOW);
  assert.deepEqual(JSON.parse(storage.map.get(UPGRADE_INTENT_STORAGE_KEY)!), {
    interval: "annual_upfront",
    at: NOW,
  });
  assert.equal(
    takeUpgradeIntentHref(storage, NOW + 10 * 60_000),
    `${UPGRADE_RETURN_PATH}&plan=annual_upfront`,
  );
  assert.equal(storage.map.has(UPGRADE_INTENT_STORAGE_KEY), false, "the marker is cleared");
  assert.equal(takeUpgradeIntentHref(storage, NOW + 10 * 60_000), null, "used only once");
});

test("a marker an hour old or older is ignored and cleared", () => {
  const storage = memoryStorage();
  saveUpgradeIntent(storage, "monthly", NOW);
  assert.equal(takeUpgradeIntentHref(storage, NOW + UPGRADE_INTENT_MAX_AGE_MS), null);
  assert.equal(storage.map.has(UPGRADE_INTENT_STORAGE_KEY), false);
});

test("no marker, a malformed marker, an unknown interval or a future stamp gives no link", () => {
  const storage = memoryStorage();
  assert.equal(takeUpgradeIntentHref(storage, NOW), null);
  storage.setItem(UPGRADE_INTENT_STORAGE_KEY, "{not json");
  assert.equal(takeUpgradeIntentHref(storage, NOW), null);
  storage.setItem(UPGRADE_INTENT_STORAGE_KEY, JSON.stringify({ interval: "weekly", at: NOW }));
  assert.equal(takeUpgradeIntentHref(storage, NOW), null);
  storage.setItem(UPGRADE_INTENT_STORAGE_KEY, JSON.stringify({ interval: "monthly", at: NOW + 60_000 }));
  assert.equal(takeUpgradeIntentHref(storage, NOW), null);
});

test("blocked storage never throws", () => {
  const throwing = {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("blocked");
    },
    removeItem: () => {
      throw new Error("blocked");
    },
  };
  assert.doesNotThrow(() => saveUpgradeIntent(throwing, "monthly", NOW));
  assert.equal(takeUpgradeIntentHref(throwing, NOW), null);
  assert.doesNotThrow(() => saveUpgradeIntent(null, "monthly", NOW));
  assert.equal(takeUpgradeIntentHref(null, NOW), null);
});
