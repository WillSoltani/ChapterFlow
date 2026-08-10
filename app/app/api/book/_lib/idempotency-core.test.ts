import { test } from "node:test";
import assert from "node:assert/strict";

import {
  InMemoryIdempotencyStore,
  runIdempotent,
  type IdempotencyStore,
  type ReserveResult,
} from "./idempotency-core";

function counter() {
  let calls = 0;
  return {
    get calls() {
      return calls;
    },
    execute: async () => {
      calls += 1;
      return { status: 200, body: { applied: true, call: calls } };
    },
  };
}

// AMEND adversarial acceptance (contract-level): two POSTs with the SAME key +
// SAME account => ONE application + a replayed outcome.
test("same account + key: executes once and replays the stored outcome", async () => {
  const store = new InMemoryIdempotencyStore();
  const work = counter();

  const first = await runIdempotent({
    store,
    accountId: "acct-a",
    key: "mut-1",
    execute: work.execute,
  });
  const second = await runIdempotent({
    store,
    accountId: "acct-a",
    key: "mut-1",
    execute: work.execute,
  });

  assert.equal(work.calls, 1, "the durable write must be applied exactly once");
  assert.equal(first.kind, "applied");
  assert.equal(second.kind, "replayed");
  // The replayed body is byte-identical to the first application's stored body.
  assert.deepEqual(second.body, first.body);
  assert.equal(second.status, first.status);
});

test("different keys for the same account each execute", async () => {
  const store = new InMemoryIdempotencyStore();
  const work = counter();

  await runIdempotent({ store, accountId: "acct-a", key: "mut-1", execute: work.execute });
  await runIdempotent({ store, accountId: "acct-a", key: "mut-2", execute: work.execute });

  assert.equal(work.calls, 2);
});

test("same key across different accounts does not collide (account-scoped)", async () => {
  const store = new InMemoryIdempotencyStore();
  const work = counter();

  await runIdempotent({ store, accountId: "acct-a", key: "mut-1", execute: work.execute });
  await runIdempotent({ store, accountId: "acct-b", key: "mut-1", execute: work.execute });

  assert.equal(work.calls, 2, "one account's key must never replay another's outcome");
});

test("absent or empty key disables dedupe (header is optional)", async () => {
  const store = new InMemoryIdempotencyStore();
  const work = counter();

  await runIdempotent({ store, accountId: "acct-a", key: null, execute: work.execute });
  await runIdempotent({ store, accountId: "acct-a", key: undefined, execute: work.execute });
  await runIdempotent({ store, accountId: "acct-a", key: "   ", execute: work.execute });

  assert.equal(work.calls, 3, "without a key every request executes, as before dedupe");
});

test("a thrown execution releases the key so a later retry re-executes", async () => {
  const store = new InMemoryIdempotencyStore();
  let calls = 0;

  await assert.rejects(
    runIdempotent({
      store,
      accountId: "acct-a",
      key: "mut-1",
      execute: async () => {
        calls += 1;
        throw new Error("transient downstream failure");
      },
    }),
    /transient downstream failure/,
  );

  // The failed key was NOT poisoned: the same key can be retried and applied.
  const retry = await runIdempotent({
    store,
    accountId: "acct-a",
    key: "mut-1",
    execute: async () => {
      calls += 1;
      return { status: 200, body: { applied: true } };
    },
  });

  assert.equal(calls, 2);
  assert.equal(retry.kind, "applied");
});

test("a concurrent in-progress reservation short-circuits without executing", async () => {
  // A store fixed in the "in_progress" state models a duplicate that arrives
  // while the first request is still executing: it must NOT run execute again.
  const inProgressStore: IdempotencyStore = {
    async reserve(): Promise<ReserveResult> {
      return { kind: "in_progress" };
    },
    async complete() {},
    async release() {},
  };
  let calls = 0;

  const result = await runIdempotent({
    store: inProgressStore,
    accountId: "acct-a",
    key: "mut-1",
    execute: async () => {
      calls += 1;
      return { status: 200, body: {} };
    },
  });

  assert.equal(calls, 0, "a concurrent duplicate must not double-apply");
  assert.equal(result.kind, "in_progress");
});

// Guards the durable-store contract InMemoryIdempotencyStore stands in for:
// reserve is single-winner, replay carries the stored outcome verbatim.
test("store: reserve is single-winner and replay returns the stored outcome", async () => {
  const store = new InMemoryIdempotencyStore();

  assert.deepEqual(await store.reserve("acct-a", "k"), { kind: "reserved" });
  assert.deepEqual(await store.reserve("acct-a", "k"), { kind: "in_progress" });

  await store.complete("acct-a", "k", { status: 201, bodyJson: '{"ok":1}' });
  const replay = await store.reserve("acct-a", "k");
  assert.equal(replay.kind, "replay");
  assert.deepEqual(
    replay.kind === "replay" ? replay.outcome : null,
    { status: 201, bodyJson: '{"ok":1}' },
  );
});
