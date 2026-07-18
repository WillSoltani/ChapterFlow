import assert from "node:assert/strict";
import { test } from "node:test";

import { createBookCache } from "./book-api-cache-core";

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
