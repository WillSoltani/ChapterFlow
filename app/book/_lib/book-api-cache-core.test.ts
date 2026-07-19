import assert from "node:assert/strict";
import { test } from "node:test";

import {
  beginBookCacheMountLoad,
  createBookCache,
  isBookCacheRefreshEvent,
  type BookCacheEvent,
} from "./book-api-cache-core";

const KEY = "/app/api/book/me/dashboard";

/** A promise whose resolution is controlled by the test, for in-flight timing. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Injectable clock the tests advance by hand. */
function fakeClock(start = 0) {
  let t = start;
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms;
    },
  };
}

test("in-flight dedup: concurrent loads for one key share a single fetch", async () => {
  const clock = fakeClock();
  let calls = 0;
  const gate = deferred<string>();
  const cache = createBookCache({
    ttlMs: 30_000,
    now: clock.now,
    defaultFetcher: () => {
      calls += 1;
      return gate.promise;
    },
  });

  const a = cache.load(KEY);
  const b = cache.load(KEY);
  assert.equal(calls, 1, "second concurrent load must not start a second fetch");

  gate.resolve("V1");
  const [ra, rb] = await Promise.all([a, b]);
  assert.equal(ra, "V1");
  assert.equal(rb, "V1");
  assert.equal(calls, 1);
});

test("TTL: reads within the window skip the network; a stale read refetches", async () => {
  const clock = fakeClock();
  let calls = 0;
  const cache = createBookCache({
    ttlMs: 30_000,
    now: clock.now,
    defaultFetcher: () => {
      calls += 1;
      return Promise.resolve(`V${calls}`);
    },
  });

  assert.equal(await cache.load(KEY), "V1");
  assert.equal(calls, 1);

  // Within the TTL: served from memory, no new fetch.
  clock.advance(10_000);
  assert.equal(await cache.load(KEY), "V1");
  assert.equal(calls, 1);

  // Past the TTL: a normal read revalidates.
  clock.advance(25_000);
  assert.equal(await cache.load(KEY), "V2");
  assert.equal(calls, 2);
});

test("invalidation: dropping a key forces the next read to refetch", async () => {
  const clock = fakeClock();
  let calls = 0;
  const cache = createBookCache({
    ttlMs: 30_000,
    now: clock.now,
    defaultFetcher: () => {
      calls += 1;
      return Promise.resolve(`V${calls}`);
    },
  });

  assert.equal(await cache.load(KEY), "V1");
  cache.invalidate("/app/api/book/me/"); // prefix match
  assert.equal(await cache.load(KEY), "V2", "post-invalidation read must refetch");
  assert.equal(calls, 2);
});

test("invalidation notifies subscribers under the prefix even with no cached entry", () => {
  const clock = fakeClock();
  const cache = createBookCache({
    ttlMs: 30_000,
    now: clock.now,
    defaultFetcher: () => Promise.resolve("V"),
  });
  let notified = 0;
  cache.subscribe(KEY, () => {
    notified += 1;
  });
  cache.invalidate("/app/api/book/me/");
  assert.equal(notified, 1, "a mounted consumer must be told to refetch after invalidation");
});

test("SWR ordering: stale value is served first, fresh value delivered via subscription", async () => {
  const clock = fakeClock();
  let calls = 0;
  const cache = createBookCache({
    ttlMs: 30_000,
    now: clock.now,
    defaultFetcher: () => {
      calls += 1;
      return Promise.resolve(`V${calls}`);
    },
  });

  const seen: unknown[] = [];
  cache.subscribe(KEY, () => {
    seen.push(cache.peek(KEY)?.value);
  });

  // Prime the cache.
  await cache.load(KEY);
  assert.deepEqual(seen, ["V1"], "first successful load notifies with V1");

  // Age it out.
  clock.advance(40_000);
  const stale = cache.peek(KEY);
  assert.deepEqual(stale, { value: "V1", fresh: false }, "stale value is still served synchronously");

  // Stale-while-revalidate: force a background refresh; subscriber gets V2.
  const revalidated = await cache.load(KEY, { force: true });
  assert.equal(revalidated, "V2");
  assert.deepEqual(seen, ["V1", "V2"], "subscriber saw stale-then-fresh in order");
  assert.deepEqual(cache.peek(KEY), { value: "V2", fresh: true });
});

test("revalidateSubscribed force-refreshes only keys with a live subscriber", async () => {
  const clock = fakeClock();
  const calls = new Map<string, number>();
  const cache = createBookCache({
    ttlMs: 30_000,
    now: clock.now,
    defaultFetcher: (key) => {
      calls.set(key, (calls.get(key) ?? 0) + 1);
      return Promise.resolve(`${key}:${calls.get(key)}`);
    },
  });

  const subscribed = "/app/api/book/me/dashboard";
  const orphan = "/app/api/book/me/profile";
  await cache.load(subscribed); // calls=1
  await cache.load(orphan); // calls=1
  const unsub = cache.subscribe(subscribed, () => {});

  cache.revalidateSubscribed();
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(calls.get(subscribed), 2, "subscribed key is force-revalidated");
  assert.equal(calls.get(orphan), 1, "key with no subscriber is left untouched");
  unsub();
});

test("a failed revalidation keeps the last-good cached value", async () => {
  const clock = fakeClock();
  let calls = 0;
  const cache = createBookCache({
    ttlMs: 30_000,
    now: clock.now,
    defaultFetcher: () => {
      calls += 1;
      if (calls === 1) return Promise.resolve("V1");
      return Promise.reject(new Error("network down"));
    },
  });

  assert.equal(await cache.load(KEY), "V1");
  clock.advance(40_000);
  await assert.rejects(() => cache.load(KEY, { force: true }), /network down/);
  assert.deepEqual(cache.peek(KEY), { value: "V1", fresh: false }, "cache is not wiped by a failed refresh");
});

test("mount load revalidates a fresh value and still deduplicates concurrent consumers", async () => {
  const clock = fakeClock();
  let calls = 0;
  const gate = deferred<string>();
  const cache = createBookCache({
    ttlMs: 30_000,
    now: clock.now,
    defaultFetcher: () => {
      calls += 1;
      if (calls === 1) return Promise.resolve("V1");
      return gate.promise;
    },
  });

  await cache.load(KEY);
  const first = beginBookCacheMountLoad(cache, KEY);
  const second = beginBookCacheMountLoad(cache, KEY);

  assert.deepEqual(first.initial, { value: "V1", fresh: true });
  assert.deepEqual(second.initial, { value: "V1", fresh: true });
  assert.equal(calls, 2, "fresh mount loads share one forced background request");

  gate.resolve("V2");
  assert.deepEqual(await Promise.all([first.request, second.request]), ["V2", "V2"]);
});

test("background failure and recovery are both broadcast while retaining last-good data", async () => {
  const clock = fakeClock();
  let calls = 0;
  const failure = new Error("network down");
  const cache = createBookCache({
    ttlMs: 30_000,
    now: clock.now,
    defaultFetcher: () => {
      calls += 1;
      if (calls === 1) return Promise.resolve("V1");
      if (calls === 2) return Promise.reject(failure);
      return Promise.resolve("V2");
    },
  });

  await cache.load(KEY);
  const events: BookCacheEvent[] = [];
  cache.subscribe(KEY, (event) => events.push(event));

  await assert.rejects(() => cache.load(KEY, { force: true }), failure);
  assert.deepEqual(cache.peek(KEY), { value: "V1", fresh: true });
  assert.equal(events.length, 1);
  assert.equal(events[0]?.type, "error");
  if (events[0]?.type === "error") assert.equal(events[0].error, failure);

  await cache.load(KEY, { force: true });
  assert.deepEqual(cache.peek(KEY), { value: "V2", fresh: true });
  assert.equal(events.at(-1)?.type, "success", "later success tells hooks to clear the error");
});

test("an authentication failure clears every private entry and blocks late repopulation", async () => {
  const clock = fakeClock();
  const OTHER = "/app/api/book/me/profile";
  const LATE = "/app/api/book/me/is-admin";
  const authFailure = Object.assign(new Error("signed out"), { status: 401 });
  const lateGate = deferred<string>();
  let keyCalls = 0;
  const cache = createBookCache({
    ttlMs: 30_000,
    now: clock.now,
    shouldClearOnError: (error) =>
      typeof error === "object" && error !== null && "status" in error &&
      ((error as { status?: unknown }).status === 401 ||
        (error as { status?: unknown }).status === 403),
    defaultFetcher: (key) => {
      if (key === LATE) return lateGate.promise;
      if (key === KEY) {
        keyCalls += 1;
        return keyCalls === 1 ? Promise.resolve("dashboard-A") : Promise.reject(authFailure);
      }
      return Promise.resolve("profile-A");
    },
  });

  await cache.load(KEY);
  await cache.load(OTHER);
  const lateRequest = cache.load(LATE);
  const keyEvents: BookCacheEvent[] = [];
  const otherEvents: BookCacheEvent[] = [];
  cache.subscribe(KEY, (event) => keyEvents.push(event));
  cache.subscribe(OTHER, (event) => otherEvents.push(event));

  await assert.rejects(() => cache.load(KEY, { force: true }), authFailure);
  assert.equal(cache.peek(KEY), undefined);
  assert.equal(cache.peek(OTHER), undefined);
  assert.equal(keyEvents[0]?.type, "clear");
  assert.equal(keyEvents[1]?.type, "error");
  assert.equal(otherEvents[0]?.type, "clear");

  lateGate.resolve("admin-A");
  assert.equal(await lateRequest, "admin-A");
  assert.equal(cache.peek(LATE), undefined, "a pre-clear request cannot repopulate the cache");
});

test("manual subscribers refresh only for success and explicit invalidation", () => {
  assert.equal(isBookCacheRefreshEvent({ type: "success" }), true);
  assert.equal(isBookCacheRefreshEvent({ type: "invalidate" }), true);
  assert.equal(isBookCacheRefreshEvent({ type: "clear" }), false);
  assert.equal(isBookCacheRefreshEvent({ type: "error", error: new Error("offline") }), false);
});

test("late old-generation rejections cannot clear or notify the current generation", async () => {
  async function runScenario(staleFailure: Error) {
    const AUTH = "/app/api/book/me/dashboard";
    const STALE = "/app/api/book/me/profile";
    const FRESH = "/app/api/book/me/is-admin";
    const authFailure = Object.assign(new Error("signed out"), { status: 401 });
    const staleGate = deferred<string>();
    let authCalls = 0;
    const cache = createBookCache({
      ttlMs: 30_000,
      shouldClearOnError: (error) =>
        typeof error === "object" && error !== null && "status" in error &&
        ((error as { status?: unknown }).status === 401 ||
          (error as { status?: unknown }).status === 403),
      defaultFetcher: (key) => {
        if (key === STALE) return staleGate.promise;
        if (key === AUTH) {
          authCalls += 1;
          return authCalls === 1 ? Promise.resolve("dashboard-A") : Promise.reject(authFailure);
        }
        return Promise.resolve("admin-B");
      },
    });

    await cache.load(AUTH);
    const staleRequest = cache.load(STALE);
    const staleEvents: BookCacheEvent[] = [];
    const freshEvents: BookCacheEvent[] = [];
    cache.subscribe(STALE, (event) => staleEvents.push(event));
    cache.subscribe(FRESH, (event) => freshEvents.push(event));

    await assert.rejects(() => cache.load(AUTH, { force: true }), authFailure);
    await cache.load(FRESH);
    staleEvents.length = 0;
    freshEvents.length = 0;

    staleGate.reject(staleFailure);
    await assert.rejects(() => staleRequest, staleFailure);
    assert.deepEqual(cache.peek(FRESH), { value: "admin-B", fresh: true });
    assert.deepEqual(staleEvents, [], "obsolete failure must not reach current subscribers");
    assert.deepEqual(freshEvents, [], "obsolete auth failure must not clear current subscribers");
  }

  await runScenario(new Error("old request failed"));
  await runScenario(Object.assign(new Error("old session unauthorized"), { status: 401 }));
});

test("auth generation initialization is inert and an unchanged generation preserves the cache", async () => {
  let calls = 0;
  const cache = createBookCache({
    ttlMs: 30_000,
    defaultFetcher: () => Promise.resolve(`V${++calls}`),
  });

  assert.equal(cache.reconcileAuthGeneration("generation-a"), "initialized");
  assert.equal(await cache.load(KEY), "V1");
  assert.equal(cache.reconcileAuthGeneration("generation-a"), "unchanged");
  assert.equal(await cache.load(KEY), "V1");
  assert.equal(calls, 1, "same-session reconciliation must preserve TTL behavior");
});

test("an A to B auth-generation transition clears all private URLs exactly once", async () => {
  const profile = "/app/api/book/me/profile";
  const cache = createBookCache({
    ttlMs: 30_000,
    defaultFetcher: (key) => Promise.resolve(`${key}:A`),
  });
  cache.reconcileAuthGeneration("generation-a");
  await cache.load(KEY);
  await cache.load(profile);

  const events: BookCacheEvent[] = [];
  cache.subscribe(KEY, (event) => events.push(event));

  assert.equal(cache.reconcileAuthGeneration("generation-b"), "changed");
  assert.equal(cache.peek(KEY), undefined);
  assert.equal(cache.peek(profile), undefined);
  assert.deepEqual(events.map((event) => event.type), ["clear"]);
  assert.equal(cache.reconcileAuthGeneration("generation-b"), "unchanged");
  assert.deepEqual(events.map((event) => event.type), ["clear"]);
});

test("a late A success cannot repopulate the same raw URL after B arrives", async () => {
  const aGate = deferred<string>();
  let calls = 0;
  const cache = createBookCache({
    ttlMs: 30_000,
    defaultFetcher: () => {
      calls += 1;
      return calls === 1 ? aGate.promise : Promise.resolve("dashboard-B");
    },
  });
  cache.reconcileAuthGeneration("generation-a");
  const requestA = cache.load(KEY);

  cache.reconcileAuthGeneration("generation-b");
  aGate.resolve("dashboard-A");
  assert.equal(await requestA, "dashboard-A");
  assert.equal(cache.peek(KEY), undefined);
  assert.equal(await cache.load(KEY), "dashboard-B");
  assert.deepEqual(cache.peek(KEY)?.value, "dashboard-B");
});

test("a late A rejection cannot clear or notify B after explicit generation reconciliation", async () => {
  const aGate = deferred<string>();
  const authFailure = Object.assign(new Error("old unauthorized"), { status: 401 });
  let calls = 0;
  const cache = createBookCache({
    ttlMs: 30_000,
    shouldClearOnError: (error) =>
      typeof error === "object" && error !== null && "status" in error &&
      (error as { status?: unknown }).status === 401,
    defaultFetcher: () => {
      calls += 1;
      return calls === 1 ? aGate.promise : Promise.resolve("dashboard-B");
    },
  });
  cache.reconcileAuthGeneration("generation-a");
  const requestA = cache.load(KEY);
  cache.reconcileAuthGeneration("generation-b");
  await cache.load(KEY);
  const events: BookCacheEvent[] = [];
  cache.subscribe(KEY, (event) => events.push(event));

  aGate.reject(authFailure);
  await assert.rejects(() => requestA, authFailure);
  assert.equal(cache.peek(KEY)?.value, "dashboard-B");
  assert.deepEqual(events, []);
});
