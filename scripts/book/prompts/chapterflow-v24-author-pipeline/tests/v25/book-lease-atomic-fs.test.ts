import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import type { Result } from "../../src/contracts/v4Core.js";
import { createBookWriteLock } from "../../src/books/bookLease.js";
import { bookPaths } from "../../src/books/bookPaths.js";
import { createCurrentPointerStore, type CurrentBookPointer } from "../../src/books/currentPointer.js";
import { createTestRoots } from "../testRoots.js";
import { finishV25Tests, requiredTest } from "./harness.js";

function pointer(
  bookId: string,
  candidateId: string,
  revision: number,
  digestCharacter: string,
): CurrentBookPointer {
  return {
    schemaVersion: "1",
    bookId,
    candidateId,
    manifestDigest: digestCharacter.repeat(64),
    revision,
    updatedAt: `2026-07-20T12:00:0${revision}.000Z`,
  };
}

function pass(value: string): Result<string> {
  return { ok: true, value };
}

function deferred(): { readonly promise: Promise<void>; readonly resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

requiredTest("bounded book lock serializes contenders and busy loser performs no operation write", async ({ roots }) => {
  const holderEntered = deferred();
  const releaseHolder = deferred();
  const holder = createBookWriteLock({ booksRoot: roots.booksRoot, timeoutMs: 500, pollMs: 1 });
  const holderResult = holder.run("lock-book", async () => {
    holderEntered.resolve();
    await releaseHolder.promise;
    return pass("holder");
  });
  await holderEntered.promise;

  let loserCalls = 0;
  const loser = createBookWriteLock({ booksRoot: roots.booksRoot, timeoutMs: 0, pollMs: 1 });
  const loserResult = await loser.run("lock-book", async () => {
    loserCalls += 1;
    return pass("loser");
  });
  assert.equal(loserResult.ok, false);
  if (!loserResult.ok) assert.equal(loserResult.error.code, "LOCK_BUSY");
  assert.equal(loserCalls, 0);

  releaseHolder.resolve();
  assert.deepEqual(await holderResult, pass("holder"));

  const order: string[] = [];
  const secondHolderEntered = deferred();
  const releaseSecondHolder = deferred();
  const sleepReached = deferred();
  const allowRetry = deferred();
  const first = holder.run("lock-book", async () => {
    order.push("first-enter");
    secondHolderEntered.resolve();
    await releaseSecondHolder.promise;
    order.push("first-exit");
    return pass("first");
  });
  await secondHolderEntered.promise;
  const waiter = createBookWriteLock({
    booksRoot: roots.booksRoot,
    timeoutMs: 500,
    pollMs: 1,
    seams: {
      sleep: async () => {
        sleepReached.resolve();
        await allowRetry.promise;
      },
    },
  });
  const second = waiter.run("lock-book", async () => {
    order.push("second-enter");
    return pass("second");
  });
  await sleepReached.promise;
  releaseSecondHolder.resolve();
  await first;
  allowRetry.resolve();
  assert.deepEqual(await second, pass("second"));
  assert.deepEqual(order, ["first-enter", "first-exit", "second-enter"]);

  await assert.rejects(
    holder.run("lock-book", async () => { throw new Error("operation crash"); }),
    /operation crash/,
  );
  assert.deepEqual(await loser.run("lock-book", async () => pass("released-after-throw")), pass("released-after-throw"));
});

requiredTest("same-revision pointer CAS has one winner and one zero-mutation conflict", async ({ roots }) => {
  const lock = createBookWriteLock({ booksRoot: roots.booksRoot, timeoutMs: 1_000, pollMs: 1 });
  const store = createCurrentPointerStore({ booksRoot: roots.booksRoot, writeLock: lock });
  const bookId = "cas-book";
  const initial = await store.compareAndSet({
    bookId,
    expectedRevision: 0,
    next: pointer(bookId, "candidate-1", 1, "a"),
  });
  assert.equal(initial.ok, true);

  const [left, right] = await Promise.all([
    store.compareAndSet({ bookId, expectedRevision: 1, next: pointer(bookId, "candidate-left", 2, "b") }),
    store.compareAndSet({ bookId, expectedRevision: 1, next: pointer(bookId, "candidate-right", 2, "c") }),
  ]);
  const results = [left, right];
  assert.equal(results.filter((result) => result.ok).length, 1);
  const conflict = results.find((result) => !result.ok);
  assert.ok(conflict && !conflict.ok);
  assert.equal(conflict.error.code, "REVISION_CONFLICT");

  const current = await store.read(bookId);
  assert.equal(current.ok, true);
  assert.ok(current.ok && current.value);
  assert.equal(current.value.revision, 2);
  const pointerPath = bookPaths(roots.booksRoot, bookId).currentPointer;
  const beforeConflict = readFileSync(pointerPath);
  const stale = await store.compareAndSet({
    bookId,
    expectedRevision: 1,
    next: pointer(bookId, "candidate-stale", 2, "d"),
  });
  assert.equal(stale.ok, false);
  if (!stale.ok) assert.equal(stale.error.code, "REVISION_CONFLICT");
  assert.deepEqual(readFileSync(pointerPath), beforeConflict);
});

requiredTest("pointer replace faults expose complete old or complete new record", async ({ roots }) => {
  const lock = createBookWriteLock({ booksRoot: roots.booksRoot, timeoutMs: 500, pollMs: 1 });
  const bookId = "pointer-crash-book";
  let armed: "before" | "after" | null = null;
  const store = createCurrentPointerStore({
    booksRoot: roots.booksRoot,
    writeLock: lock,
    atomicSeams: {
      point: (name) => {
        if (armed === "before" && name === "file.before-replace") throw new Error("crash before replace");
        if (armed === "after" && name === "file.after-replace") throw new Error("crash after replace");
      },
    },
  });
  assert.equal((await store.compareAndSet({
    bookId,
    expectedRevision: 0,
    next: pointer(bookId, "candidate-old", 1, "a"),
  })).ok, true);

  armed = "before";
  const beforeFault = await store.compareAndSet({
    bookId,
    expectedRevision: 1,
    next: pointer(bookId, "candidate-new", 2, "b"),
  });
  assert.equal(beforeFault.ok, false);
  if (!beforeFault.ok) assert.equal(beforeFault.error.code, "POINTER_WRITE_FAILED");
  const afterBeforeFault = await store.read(bookId);
  assert.ok(afterBeforeFault.ok && afterBeforeFault.value);
  assert.equal(afterBeforeFault.value.candidateId, "candidate-old");
  assert.equal(afterBeforeFault.value.revision, 1);

  armed = "after";
  const afterFault = await store.compareAndSet({
    bookId,
    expectedRevision: 1,
    next: pointer(bookId, "candidate-new", 2, "b"),
  });
  assert.equal(afterFault.ok, false);
  if (!afterFault.ok) assert.equal(afterFault.error.code, "POINTER_WRITE_FAILED");
  const afterAfterFault = await store.read(bookId);
  assert.ok(afterAfterFault.ok && afterAfterFault.value);
  assert.equal(afterAfterFault.value.candidateId, "candidate-new");
  assert.equal(afterAfterFault.value.revision, 2);
  assert.doesNotThrow(() => JSON.parse(readFileSync(bookPaths(roots.booksRoot, bookId).currentPointer, "utf8")));
});

requiredTest("missing and corrupt pointers block except first expected revision zero", async ({ roots }) => {
  const lock = createBookWriteLock({ booksRoot: roots.booksRoot, timeoutMs: 500, pollMs: 1 });
  const store = createCurrentPointerStore({ booksRoot: roots.booksRoot, writeLock: lock });
  const missingBook = "missing-pointer-book";
  assert.deepEqual(await store.read(missingBook), { ok: true, value: null });
  const wrongFirstRevision = await store.compareAndSet({
    bookId: missingBook,
    expectedRevision: 3,
    next: pointer(missingBook, "candidate-4", 4, "d"),
  });
  assert.equal(wrongFirstRevision.ok, false);
  if (!wrongFirstRevision.ok) assert.equal(wrongFirstRevision.error.code, "REVISION_CONFLICT");

  const corruptBook = "corrupt-pointer-book";
  const corruptPath = bookPaths(roots.booksRoot, corruptBook).currentPointer;
  mkdirSync(dirname(corruptPath), { recursive: true });
  writeFileSync(corruptPath, "{not-json\n");
  const corruptBytes = readFileSync(corruptPath);
  const corruptRead = await store.read(corruptBook);
  assert.equal(corruptRead.ok, false);
  if (!corruptRead.ok) assert.equal(corruptRead.error.code, "POINTER_CORRUPT");
  const corruptCas = await store.compareAndSet({
    bookId: corruptBook,
    expectedRevision: 0,
    next: pointer(corruptBook, "candidate-1", 1, "a"),
  });
  assert.equal(corruptCas.ok, false);
  if (!corruptCas.ok) assert.equal(corruptCas.error.code, "POINTER_CORRUPT");
  assert.deepEqual(readFileSync(corruptPath), corruptBytes);
});

finishV25Tests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
