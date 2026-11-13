import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { resetSafeStorageForTests, safeGetItem, safeSetItem } from "./safe-storage";

const g = globalThis as { window?: unknown };
const realWindow = g.window;

afterEach(() => {
  g.window = realWindow;
  resetSafeStorageForTests();
});

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    map,
  };
}

test("reads and writes go to localStorage when it works", () => {
  const storage = memoryStorage();
  g.window = { localStorage: storage };
  assert.equal(safeSetItem("k", "v"), true);
  assert.equal(storage.map.get("k"), "v");
  assert.equal(safeGetItem("k"), "v");
  assert.equal(safeGetItem("missing"), null);
});

test("a full storage never throws and the value is kept for this page", () => {
  const storage = memoryStorage();
  storage.setItem = () => {
    throw new DOMException("full", "QuotaExceededError");
  };
  g.window = { localStorage: storage };
  assert.doesNotThrow(() => safeSetItem("k", "v"));
  assert.equal(safeSetItem("k", "v2"), false);
  assert.equal(safeGetItem("k"), "v2");
});

test("blocked storage (access throws) never throws", () => {
  g.window = {
    get localStorage(): Storage {
      throw new DOMException("blocked", "SecurityError");
    },
  };
  assert.equal(safeGetItem("k"), null);
  assert.equal(safeSetItem("k", "v"), false);
  assert.equal(safeGetItem("k"), "v");
});

test("no window (server render) returns null", () => {
  g.window = undefined;
  assert.equal(safeGetItem("k"), null);
  assert.equal(safeSetItem("k", "v"), false);
});
