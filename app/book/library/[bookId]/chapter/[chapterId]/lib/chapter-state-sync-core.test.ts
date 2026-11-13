import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canSendWithKeepalive,
  chapterStatesEqual,
  createChapterStateSync,
  defaultChapterState,
  isRetryableSyncError,
  mergeRefreshedChapterState,
  type PersistedChapterState,
  type ServerChapterCopy,
} from "./chapter-state-sync-core";

type Deferred<T> = { resolve: (value: T) => void; reject: (error: unknown) => void };

function harness() {
  let clock = 0;
  let nextId = 1;
  const timers = new Map<number, { at: number; callback: () => void }>();
  const gets: Deferred<ServerChapterCopy>[] = [];
  const patches: Array<Deferred<ServerChapterCopy> & {
    state: PersistedChapterState;
    keepalive: boolean;
  }> = [];
  const failedChanges: boolean[] = [];
  // The reader's React state, as useChapterState holds it.
  let current: PersistedChapterState = { ...defaultChapterState };

  const sync = createChapterStateSync({
    get: () =>
      new Promise<ServerChapterCopy>((resolve, reject) => gets.push({ resolve, reject })),
    patch: (state, { keepalive }) =>
      new Promise<ServerChapterCopy>((resolve, reject) =>
        patches.push({ resolve, reject, state, keepalive })
      ),
    // React applies the merge on a later render, like setState(prev => ...).
    applyServer: (_server, merge) => {
      queueMicrotask(() => {
        current = merge(current);
        sync.setLocal(current);
      });
    },
    onSyncFailedChange: (failed) => failedChanges.push(failed),
    setTimer: (callback, ms) => {
      const id = nextId++;
      timers.set(id, { at: clock + ms, callback });
      return id;
    },
    clearTimer: (handle) => {
      timers.delete(handle as number);
    },
    now: () => clock,
  });

  const flushPromises = () => new Promise<void>((resolve) => setImmediate(resolve));
  async function advance(ms: number) {
    const until = clock + ms;
    await flushPromises();
    for (;;) {
      const due = [...timers.entries()]
        .filter(([, timer]) => timer.at <= until)
        .sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      timers.delete(due[0]);
      clock = due[1].at;
      due[1].callback();
      await flushPromises();
    }
    clock = until;
    await flushPromises();
  }

  return {
    sync,
    gets,
    patches,
    failedChanges,
    advance,
    flushPromises,
    get current() {
      return current;
    },
    edit(change: Partial<PersistedChapterState>) {
      current = { ...current, ...change };
      sync.setLocal(current);
    },
    /** Hydrate the way useChapterState does: local copy first, then the read. */
    open(local: Partial<PersistedChapterState> = {}) {
      current = { ...defaultChapterState, ...local };
      sync.start();
      sync.setLocal(current);
    },
  };
}

function server(change: Partial<PersistedChapterState>, updatedAt = "2026-11-10T10:00:00.000Z") {
  return { state: { ...defaultChapterState, ...change }, updatedAt };
}

test("a failed read sends no write, retries, and shows the warning after the first retry fails", async () => {
  const h = harness();
  h.open({ notes: "old copy on this device", notesUpdatedAt: "2026-11-01T00:00:00.000Z" });
  assert.equal(h.gets.length, 1);
  h.gets[0]!.reject(new TypeError("Failed to fetch"));
  await h.flushPromises();
  h.edit({ activeTab: "examples" });
  await h.advance(500);
  assert.equal(h.patches.length, 0, "no write before a read has succeeded");
  assert.deepEqual(h.failedChanges, [], "one failure alone does not warn");

  await h.advance(1_000);
  assert.equal(h.gets.length, 2, "the read is retried");
  h.gets[1]!.reject(Object.assign(new Error("down"), { status: 503 }));
  await h.flushPromises();
  assert.deepEqual(h.failedChanges, [true]);
  assert.equal(h.patches.length, 0);

  await h.advance(2_000);
  assert.equal(h.gets.length, 3, "backoff keeps retrying");
  h.gets[2]!.resolve(server({ notes: "account copy", notesUpdatedAt: "2026-11-05T00:00:00.000Z" }));
  await h.flushPromises();
  assert.deepEqual(h.failedChanges, [true, false], "a successful read clears the warning");
  assert.equal(h.current.notes, "account copy", "the newer account notes are kept");
});

test("a refused first read stops and waits for focus", async () => {
  const h = harness();
  h.open();
  h.gets[0]!.reject(Object.assign(new Error("forbidden"), { status: 403 }));
  await h.advance(60_000);
  assert.equal(h.gets.length, 1);
  assert.equal(h.patches.length, 0);
  assert.deepEqual(h.failedChanges, [true]);
  h.sync.refresh();
  assert.equal(h.gets.length, 2);
});

test("no server row: exactly one write, then nothing until the reader changes something", async () => {
  const h = harness();
  h.open();
  h.gets[0]!.resolve({ state: null, updatedAt: null });
  await h.advance(1_000);
  assert.equal(h.patches.length, 1);
  assert.equal(h.patches[0]!.keepalive, false);
  h.patches[0]!.resolve({ state: h.patches[0]!.state, updatedAt: "2026-11-13T10:00:00.000Z" });
  await h.advance(5_000);
  h.edit({ ...h.current });
  await h.advance(5_000);
  assert.equal(h.patches.length, 1, "an unchanged state is not written again");
});

test("opening a chapter whose server copy matches sends no write", async () => {
  const h = harness();
  h.open({ activeTab: "quiz", readingDepth: "deeper" });
  h.gets[0]!.resolve(server({ activeTab: "quiz", readingDepth: "deeper" }));
  await h.advance(5_000);
  assert.equal(h.patches.length, 0);
});

test("local edits merged into the server copy are pushed once", async () => {
  const h = harness();
  h.open({
    notes: "written offline",
    notesUpdatedAt: "2026-11-12T00:00:00.000Z",
    bookmarkedTakeaways: [2],
    bookmarkedTakeawayTexts: { "2": "Two" },
  });
  h.gets[0]!.resolve(
    server({ bookmarkedTakeaways: [0], bookmarkedTakeawayTexts: { "0": "Zero" }, notes: "older", notesUpdatedAt: "2026-11-01T00:00:00.000Z" })
  );
  await h.advance(1_000);
  assert.equal(h.patches.length, 1);
  const sent = h.patches[0]!.state;
  assert.equal(sent.notes, "written offline");
  assert.deepEqual(sent.bookmarkedTakeaways, [2, 0]);
  h.patches[0]!.resolve({ state: sent, updatedAt: "2026-11-13T10:00:00.000Z" });
  await h.advance(5_000);
  assert.equal(h.patches.length, 1);
});

test("one write in flight; edits made meanwhile go out after it, as the latest state", async () => {
  const h = harness();
  h.open();
  h.gets[0]!.resolve(server({}));
  await h.flushPromises();
  h.edit({ notes: "a", notesUpdatedAt: "2026-11-13T10:00:01.000Z" });
  await h.advance(200);
  assert.equal(h.patches.length, 1);
  h.edit({ notes: "ab", notesUpdatedAt: "2026-11-13T10:00:02.000Z" });
  await h.advance(200);
  h.edit({ notes: "abc", notesUpdatedAt: "2026-11-13T10:00:03.000Z" });
  await h.advance(200);
  assert.equal(h.patches.length, 1, "no second write while the first is in flight");
  h.patches[0]!.resolve({ state: h.patches[0]!.state, updatedAt: "2026-11-13T10:00:01.500Z" });
  await h.flushPromises();
  assert.equal(h.patches.length, 2);
  assert.equal(h.patches[1]!.state.notes, "abc");
});

test("failed writes retry with backoff and warn after the second failure", async () => {
  const h = harness();
  h.open();
  h.gets[0]!.resolve(server({}));
  await h.flushPromises();
  h.edit({ notes: "keep me", notesUpdatedAt: "2026-11-13T10:00:00.000Z" });
  await h.advance(200);
  h.patches[0]!.reject(new TypeError("offline"));
  await h.flushPromises();
  assert.deepEqual(h.failedChanges, []);
  await h.advance(1_000);
  assert.equal(h.patches.length, 2);
  h.patches[1]!.reject(Object.assign(new Error("down"), { status: 500 }));
  await h.flushPromises();
  assert.deepEqual(h.failedChanges, [true]);
  await h.advance(1_999);
  assert.equal(h.patches.length, 2);
  await h.advance(1);
  assert.equal(h.patches.length, 3);
  h.patches[2]!.resolve({ state: h.patches[2]!.state, updatedAt: "2026-11-13T10:00:05.000Z" });
  await h.flushPromises();
  assert.deepEqual(h.failedChanges, [true, false]);
});

test("a refused write is not resent until the state changes", async () => {
  const h = harness();
  h.open();
  h.gets[0]!.resolve(server({}));
  await h.flushPromises();
  h.edit({ notes: "x".repeat(20_001), notesUpdatedAt: "2026-11-13T10:00:00.000Z" });
  await h.advance(200);
  h.patches[0]!.reject(Object.assign(new Error("invalid"), { status: 400, code: "invalid_state" }));
  await h.flushPromises();
  assert.deepEqual(h.failedChanges, [true]);
  await h.advance(60_000);
  assert.equal(h.patches.length, 1);
  h.edit({ notes: "short again", notesUpdatedAt: "2026-11-13T10:01:00.000Z" });
  await h.advance(200);
  assert.equal(h.patches.length, 2);
});

test("flush sends unsynced edits at once with keepalive, and skips a clean state", async () => {
  const h = harness();
  h.open();
  h.sync.flush();
  assert.equal(h.patches.length, 0, "nothing is sent before a read succeeded");
  h.gets[0]!.resolve(server({}));
  await h.flushPromises();
  h.sync.flush();
  assert.equal(h.patches.length, 0, "clean state: nothing to send");
  h.edit({ notes: "last words", notesUpdatedAt: "2026-11-13T10:00:00.000Z" });
  h.sync.flush();
  assert.equal(h.patches.length, 1);
  assert.equal(h.patches[0]!.keepalive, true);
  assert.equal(h.patches[0]!.state.notes, "last words");
  h.sync.dispose();
  await h.advance(1_000);
  assert.equal(h.patches.length, 1, "the debounced write was cancelled by the flush");
});

test("refresh re-reads before the next write and keeps notes being typed", async () => {
  const h = harness();
  h.open({ notes: "synced", notesUpdatedAt: "2026-11-13T09:00:00.000Z" });
  h.gets[0]!.resolve(server({ notes: "synced", notesUpdatedAt: "2026-11-13T09:00:00.000Z" }));
  await h.advance(5_000);
  assert.equal(h.patches.length, 0);

  h.edit({ notes: "synced + typing", notesUpdatedAt: "2026-11-13T08:00:00.000Z" });
  h.sync.refresh();
  assert.equal(h.gets.length, 2);
  await h.advance(500);
  assert.equal(h.patches.length, 0, "no write while the re-read is pending");
  h.gets[1]!.resolve(
    server(
      { notes: "from the other device", notesUpdatedAt: "2026-11-13T09:30:00.000Z", bookmarkedTakeaways: [4], bookmarkedTakeawayTexts: { "4": "Four" } },
      "2026-11-13T09:30:00.000Z"
    )
  );
  await h.flushPromises();
  assert.equal(h.current.notes, "synced + typing", "text being typed is never overwritten");
  assert.deepEqual(h.current.bookmarkedTakeaways, [4]);
  await h.advance(200);
  assert.equal(h.patches.length, 1);
  assert.equal(h.patches[0]!.state.notes, "synced + typing");
});

test("refresh takes newer notes from another device when nothing is being typed", async () => {
  const h = harness();
  h.open({ notes: "synced", notesUpdatedAt: "2026-11-13T09:00:00.000Z" });
  h.gets[0]!.resolve(server({ notes: "synced", notesUpdatedAt: "2026-11-13T09:00:00.000Z" }));
  await h.advance(5_000);
  h.sync.refresh();
  h.gets[1]!.resolve(
    server({ notes: "from the other device", notesUpdatedAt: "2026-11-13T09:30:00.000Z" }, "2026-11-13T09:30:00.000Z")
  );
  await h.advance(5_000);
  assert.equal(h.current.notes, "from the other device");
  assert.equal(h.patches.length, 0);
});

test("focus and visible together trigger one re-read", async () => {
  const h = harness();
  h.open();
  h.gets[0]!.resolve(server({}));
  await h.advance(5_000);
  h.sync.refresh();
  h.gets[1]!.resolve(server({}));
  await h.flushPromises();
  h.sync.refresh();
  assert.equal(h.gets.length, 2);
});

test("typed notes survive a merge with newer server notes", () => {
  const typing = { ...defaultChapterState, notes: "new", notesUpdatedAt: "2026-11-13T10:00:00.000Z" };
  const base = { ...defaultChapterState, notes: "old" };
  const merged = mergeRefreshedChapterState(typing, { ...defaultChapterState, notes: "server", notesUpdatedAt: "2026-11-13T11:00:00.000Z" }, base);
  assert.equal(merged.notes, "new");
});

test("helpers: key-order-free equality, keepalive size, retryable errors", () => {
  const a = { ...defaultChapterState, quizAnswers: { q1: 0, q2: 1 } };
  const b = { ...defaultChapterState, quizAnswers: { q2: 1, q1: 0 } };
  assert.equal(chapterStatesEqual(a, b), true);
  assert.equal(chapterStatesEqual(a, { ...a, notes: "x" }), false);
  assert.equal(canSendWithKeepalive("x".repeat(60_000)), true);
  assert.equal(canSendWithKeepalive("é".repeat(30_001)), false);
  assert.equal(isRetryableSyncError(new TypeError("Failed to fetch")), true);
  assert.equal(isRetryableSyncError({ status: 503 }), true);
  assert.equal(isRetryableSyncError({ status: 429 }), true);
  assert.equal(isRetryableSyncError({ status: 400 }), false);
});
