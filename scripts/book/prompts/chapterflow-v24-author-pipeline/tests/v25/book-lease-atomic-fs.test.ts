import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

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

function waitForChild(child: ChildProcess): Promise<{
  readonly code: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly stdout: string;
  readonly stderr: string;
}> {
  return new Promise((done) => {
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk: Buffer | string) => { stdout += chunk.toString(); });
    child.stderr?.on("data", (chunk: Buffer | string) => { stderr += chunk.toString(); });
    child.on("close", (code, signal) => done({ code, signal, stdout, stderr }));
  });
}

async function waitForFile(path: string, childDone: ReturnType<typeof waitForChild>): Promise<void> {
  for (let attempt = 0; attempt < 500; attempt++) {
    if (existsSync(path)) return;
    const outcome = await Promise.race([
      childDone.then((result) => ({ kind: "CHILD" as const, result })),
      new Promise<{ readonly kind: "WAIT" }>((done) => setTimeout(() => done({ kind: "WAIT" }), 10)),
    ]);
    if (outcome.kind === "CHILD") {
      assert.fail(`lock holder exited before ready: ${outcome.result.stderr || outcome.result.stdout}`);
    }
  }
  throw new Error(`timed out waiting for child marker: ${path}`);
}

function fileMetadata(path: string): Record<string, string> {
  const stat = statSync(path, { bigint: true });
  return {
    atimeNs: stat.atimeNs.toString(),
    mtimeNs: stat.mtimeNs.toString(),
    mode: stat.mode.toString(),
    size: stat.size.toString(),
  };
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

requiredTest("dead child owner reclaim serializes three contenders without moving successor lock", async ({ roots }) => {
  const bookId = "dead-owner-book";
  const helper = join(roots.tempRoot, "hold-dead-book-lock.ts");
  const ready = join(roots.tempRoot, "dead-book-lock-ready");
  writeFileSync(helper, `
import { writeFileSync } from "node:fs";

async function main(): Promise<void> {
  const [moduleUrl, booksRoot, bookId, readyPath] = process.argv.slice(2);
  const { createBookWriteLock } = await import(moduleUrl);
  const lock = createBookWriteLock({ booksRoot, timeoutMs: 2_000, pollMs: 1 });
  const result = await lock.run(bookId, async () => {
    writeFileSync(readyPath, "ready\\n");
    await new Promise<void>(() => { setInterval(() => undefined, 1_000); });
    return { ok: true, value: null };
  });
  if (!result.ok) throw new Error(result.error.code + ": " + result.error.message);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
`);

  const moduleUrl = pathToFileURL(resolve("src/books/bookLease.ts")).href;
  const child = spawn(
    process.execPath,
    [...process.execArgv, helper, moduleUrl, roots.booksRoot, bookId, ready],
    { cwd: resolve("."), env: process.env, stdio: ["ignore", "pipe", "pipe"] },
  );
  const childDone = waitForChild(child);
  await waitForFile(ready, childDone);

  const lockPath = bookPaths(roots.booksRoot, bookId).writeLock;
  const deadOwnerBytes = readFileSync(lockPath);
  assert.equal(child.kill("SIGKILL"), true);
  const killed = await childDone;
  assert.equal(killed.code, null, killed.stderr || killed.stdout);
  assert.equal(killed.signal, "SIGKILL", killed.stderr || killed.stdout);
  assert.deepEqual(readFileSync(lockPath), deadOwnerBytes, "SIGKILL must leave dead-owner evidence for reclaim");

  let active = 0;
  let maxActive = 0;
  const contenderResults = await Promise.all(Array.from({ length: 3 }, (_, index) => {
    const contender = createBookWriteLock({ booksRoot: roots.booksRoot, timeoutMs: 3_000, pollMs: 1 });
    return contender.run(bookId, async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      try {
        const successorBytes = readFileSync(lockPath);
        await new Promise((done) => setTimeout(done, 25));
        assert.deepEqual(
          readFileSync(lockPath),
          successorBytes,
          "current successor lock must never move or be overwritten",
        );
        return pass(`contender-${index}`);
      } finally {
        active -= 1;
      }
    });
  }));

  assert.equal(maxActive, 1);
  assert.equal(contenderResults.every((result) => result.ok), true, JSON.stringify(contenderResults));
  assert.equal(existsSync(lockPath), false);
  assert.equal(existsSync(`${lockPath}.claim`), false);
  assert.deepEqual(readdirSync(bookPaths(roots.booksRoot, bookId).locksRoot), []);
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

requiredTest("pointer CAS snapshots validated next before waiting for lock", async ({ roots }) => {
  const bookId = "cas-alias-book";
  const holderEntered = deferred();
  const releaseHolder = deferred();
  const waiterSleeping = deferred();
  const allowWaiterRetry = deferred();
  const holderLock = createBookWriteLock({ booksRoot: roots.booksRoot, timeoutMs: 1_000, pollMs: 1 });
  const waiterLock = createBookWriteLock({
    booksRoot: roots.booksRoot,
    timeoutMs: 1_000,
    pollMs: 1,
    seams: {
      sleep: async () => {
        waiterSleeping.resolve();
        await allowWaiterRetry.promise;
      },
    },
  });
  const store = createCurrentPointerStore({ booksRoot: roots.booksRoot, writeLock: waiterLock });
  const holder = holderLock.run(bookId, async () => {
    holderEntered.resolve();
    await releaseHolder.promise;
    return pass("holder");
  });
  await holderEntered.promise;

  const next = pointer(bookId, "candidate-snapshot", 1, "a");
  const expectedSnapshot = { ...next };
  const cas = store.compareAndSet({ bookId, expectedRevision: 0, next });
  await waiterSleeping.promise;
  const mutableNext = next as unknown as Record<string, string | number>;
  mutableNext.bookId = "mutated-book";
  mutableNext.candidateId = "../escape";
  mutableNext.manifestDigest = "z".repeat(64);
  mutableNext.revision = 99;
  mutableNext.updatedAt = "not-a-time";

  releaseHolder.resolve();
  await holder;
  allowWaiterRetry.resolve();
  const result = await cas;
  assert.deepEqual(result, { ok: true, value: expectedSnapshot });
  assert.deepEqual(await store.read(bookId), { ok: true, value: expectedSnapshot });
  assert.deepEqual(
    JSON.parse(readFileSync(bookPaths(roots.booksRoot, bookId).currentPointer, "utf8")),
    expectedSnapshot,
  );
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

requiredTest("pointer read rejects symlink without outside read or mutation", async ({ roots }) => {
  const lock = createBookWriteLock({ booksRoot: roots.booksRoot, timeoutMs: 500, pollMs: 1 });
  const store = createCurrentPointerStore({ booksRoot: roots.booksRoot, writeLock: lock });
  const bookId = "pointer-symlink-book";
  const outsidePath = join(roots.tempRoot, "outside-current.json");
  const outsideBytes = `${JSON.stringify(pointer(bookId, "outside-candidate", 1, "a"), null, 2)}\n`;
  writeFileSync(outsidePath, outsideBytes);
  const originalMtime = statSync(outsidePath).mtime;
  utimesSync(outsidePath, new Date("2000-01-01T00:00:00.000Z"), originalMtime);
  const before = fileMetadata(outsidePath);

  const pointerPath = bookPaths(roots.booksRoot, bookId).currentPointer;
  mkdirSync(dirname(pointerPath), { recursive: true });
  symlinkSync(outsidePath, pointerPath);
  const result = await store.read(bookId);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "POINTER_CORRUPT");
  assert.deepEqual(fileMetadata(outsidePath), before);
  assert.equal(readFileSync(outsidePath, "utf8"), outsideBytes);
});

finishV25Tests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
