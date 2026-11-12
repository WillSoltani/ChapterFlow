import { before, test } from "node:test";
import assert from "node:assert/strict";

// A fake page: counts matchMedia 'change' listeners and MutationObservers.
const listeners = new Set<() => void>();
let observers = 0;
let matchMediaCalls = 0;
const g = globalThis as unknown as Record<string, unknown>;
g.window = {
  matchMedia: () => {
    matchMediaCalls++;
    return {
      matches: false,
      addEventListener: (_: string, fn: () => void) => listeners.add(fn),
      removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
    };
  },
};
g.document = { documentElement: { dataset: {} } };
g.MutationObserver = class {
  constructor(private fn: () => void) {}
  observe() {
    observers++;
    mutate = this.fn;
  }
  disconnect() {
    observers--;
  }
};
let mutate: () => void = () => {};

let subscribeReducedMotion: (fn: () => void) => () => void;
before(async () => {
  ({ subscribeReducedMotion } = await import("./usePrefersReducedMotion"));
});

test("one matchMedia listener and one MutationObserver however many subscribers", () => {
  const calls: number[] = [];
  const offs = Array.from({ length: 48 }, (_, i) => subscribeReducedMotion(() => calls.push(i)));
  assert.equal(listeners.size, 1);
  assert.equal(observers, 1);
  assert.equal(matchMediaCalls, 1);
  // a change reaches every subscriber
  for (const fn of listeners) fn();
  assert.equal(calls.length, 48);
  mutate();
  assert.equal(calls.length, 96);
  for (const off of offs.slice(1)) off();
  assert.equal(listeners.size, 1);
  assert.equal(observers, 1);
  offs[0]!();
  assert.equal(listeners.size, 0);
  assert.equal(observers, 0);
});

test("strict mode mount → unmount → mount keeps exactly one subscription", () => {
  const fn = () => {};
  subscribeReducedMotion(fn)();
  const off = subscribeReducedMotion(fn);
  assert.equal(listeners.size, 1);
  assert.equal(observers, 1);
  // a second unsubscribe of the same handle is a no-op
  off();
  off();
  assert.equal(listeners.size, 0);
  assert.equal(observers, 0);
});
