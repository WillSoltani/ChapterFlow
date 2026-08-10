import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { InMemoryIdempotencyStore, runIdempotent } from "./idempotency-core";

// Contract proof for the POST /book/me/notebook dedupe wiring (WP-IDEMPOTENCY-01
// / CF2-022). The route's `execute` mints a FRESH `crypto.randomUUID()`
// highlightId per attempt and inserts a row — so `attribute_not_exists(SK)` in
// createHighlight cannot dedupe a retry on its own. This models that exact
// shape: a create closure that mints a new id + increments a persisted-row
// counter, wrapped in `runIdempotent`. It asserts that a retried submit with the
// SAME (account, Idempotency-Key) applies exactly ONCE and replays the first
// entry verbatim (same server-minted id), never creating a second highlight.

interface FakeHighlightStore {
  readonly rows: number;
  create(): { status: number; body: { entry: { id: string } } };
}

/** A stand-in for createHighlight: each call mints a new server-side id and
 * persists a row (increments `rows`), exactly as the real route does. */
function fakeHighlightStore(): FakeHighlightStore {
  let rows = 0;
  return {
    get rows() {
      return rows;
    },
    create() {
      rows += 1;
      const id = randomUUID();
      return { status: 201, body: { entry: { id } } };
    },
  };
}

test("notebook create: same account + key => one highlight row, replayed entry", async () => {
  const store = new InMemoryIdempotencyStore();
  const highlights = fakeHighlightStore();
  const run = () =>
    runIdempotent({
      store,
      accountId: "acct-a",
      key: "mut-notebook-1",
      execute: async () => highlights.create(),
    });

  const first = await run();
  const second = await run();

  // Exactly one durable row despite two same-key POSTs — the double-apply CF2-022
  // exists to close.
  assert.equal(highlights.rows, 1, "a retried create must insert exactly one highlight row");
  assert.equal(first.kind, "applied");
  assert.equal(second.kind, "replayed");
  assert.equal(first.status, 201);
  assert.equal(second.status, 201);
  // The replay returns the FIRST attempt's server-minted id byte-for-byte, so a
  // retry can never surface a second, divergent highlight to the client.
  assert.deepEqual(second.body, first.body);
});

test("notebook create: same key, different accounts each create their own row", async () => {
  const store = new InMemoryIdempotencyStore();
  const highlights = fakeHighlightStore();

  await runIdempotent({
    store,
    accountId: "acct-a",
    key: "shared-key",
    execute: async () => highlights.create(),
  });
  const other = await runIdempotent({
    store,
    accountId: "acct-b",
    key: "shared-key",
    execute: async () => highlights.create(),
  });

  // A key only ever replays the SAME account's outcome; another account with a
  // colliding key still applies.
  assert.equal(highlights.rows, 2);
  assert.equal(other.kind, "applied");
});

test("notebook create: no Idempotency-Key => header-absent client applies every time", async () => {
  const store = new InMemoryIdempotencyStore();
  const highlights = fakeHighlightStore();
  const run = (key: string | null) =>
    runIdempotent({
      store,
      accountId: "acct-a",
      key,
      execute: async () => highlights.create(),
    });

  // Empty/absent key disables dedupe (a backend without the header, or an older
  // client, behaves exactly as before dedupe) — proves the ship-first
  // compatibility posture at the route level.
  await run(null);
  await run("");

  assert.equal(highlights.rows, 2);
});

test("notebook create: a failed insert releases the key so the client may retry", async () => {
  const store = new InMemoryIdempotencyStore();
  const highlights = fakeHighlightStore();
  let failNext = true;

  const run = () =>
    runIdempotent({
      store,
      accountId: "acct-a",
      key: "mut-retryable",
      execute: async () => {
        if (failNext) {
          failNext = false;
          throw new Error("transient dynamo failure");
        }
        return highlights.create();
      },
    });

  await assert.rejects(run(), /transient dynamo failure/);
  // The first attempt threw before persisting; the key is released, so the retry
  // is free to execute and DOES create the row (never poisoned by the failure).
  const retry = await run();
  assert.equal(retry.kind, "applied");
  assert.equal(highlights.rows, 1);
});
