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

function harness(options: { manualApply?: boolean; account?: string | null } = {}) {
  let clock = 0;
  let account: string | null = options.account === undefined ? "account-a" : options.account;
  const pendingApplies: Array<() => void> = [];
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
      const apply = () => {
        current = merge(current);
        sync.setLocal(current);
      };
      if (options.manualApply) pendingApplies.push(apply);
      else queueMicrotask(apply);
    },
    account: () => account,
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
    /** The signed-in account, as the reader sees it in the browser. */
    setAccount(next: string | null) {
      account = next;
    },
    /** Run the React merges held back by `manualApply`. */
    applyPending() {
      for (const apply of pendingApplies.splice(0)) apply();
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

test("after another account signs in, nothing is read, written or merged", async () => {
  const h = harness();
  h.open({ notes: "account A notes", notesUpdatedAt: "2026-11-13T09:00:00.000Z" });
  h.gets[0]!.resolve(server({ notes: "account A notes", notesUpdatedAt: "2026-11-13T09:00:00.000Z" }));
  await h.advance(5_000);
  h.edit({ notes: "account A notes + more", notesUpdatedAt: "2026-11-13T09:10:00.000Z" });
  h.setAccount("account-b");
  h.sync.refresh();
  await h.advance(5_000);
  assert.equal(h.gets.length, 1, "no read with the other account");
  h.sync.flush();
  await h.advance(5_000);
  assert.equal(h.patches.length, 0, "no write into the other account");
  assert.deepEqual(h.failedChanges, [true], "the reader is told changes stay on this device");
});

test("an account that becomes known mid-session is adopted and keeps syncing", async () => {
  // Sessions from before the owner cookie existed get it on their next refresh.
  const h = harness({ account: null });
  h.open();
  h.gets[0]!.resolve(server({}));
  await h.flushPromises();
  h.setAccount("account-a");
  h.edit({ notes: "typed after the refresh", notesUpdatedAt: "2026-11-13T10:00:00.000Z" });
  await h.advance(200);
  assert.equal(h.patches.length, 1, "the next edit is written");
  assert.equal(h.patches[0]!.state.notes, "typed after the refresh");
  h.patches[0]!.resolve({ state: h.patches[0]!.state, updatedAt: "2026-11-13T10:00:01.000Z" });
  await h.flushPromises();
  h.edit({ notes: "typed after the refresh + more", notesUpdatedAt: "2026-11-13T10:01:00.000Z" });
  h.sync.flush();
  assert.equal(h.patches.length, 2, "the leave-page flush still runs");
  assert.equal(h.patches[1]!.keepalive, true);
  assert.deepEqual(h.failedChanges, []);
});

test("an adopted account that changes again stops syncing and warns", async () => {
  const h = harness({ account: null });
  h.open();
  h.gets[0]!.resolve(server({}));
  await h.flushPromises();
  h.setAccount("account-a");
  h.edit({ activeTab: "examples" });
  await h.advance(200);
  assert.equal(h.patches.length, 1);
  h.patches[0]!.resolve({ state: h.patches[0]!.state, updatedAt: "2026-11-13T10:00:01.000Z" });
  await h.flushPromises();
  h.setAccount("account-b");
  h.edit({ activeTab: "quiz" });
  await h.advance(5_000);
  h.sync.flush();
  assert.equal(h.patches.length, 1, "nothing is written into the other account");
  assert.deepEqual(h.failedChanges, [true], "the reader is told");
});

test("a read that lands after the account changed is not merged or written", async () => {
  const h = harness();
  h.open({ notes: "account A notes", notesUpdatedAt: "2026-11-13T09:00:00.000Z" });
  h.gets[0]!.resolve(server({ notes: "account A notes", notesUpdatedAt: "2026-11-13T09:00:00.000Z" }));
  await h.advance(5_000);
  h.sync.refresh();
  assert.equal(h.gets.length, 2);
  h.setAccount("account-b");
  h.gets[1]!.resolve(server({ notes: "account B notes", notesUpdatedAt: "2026-11-13T10:00:00.000Z" }, "2026-11-13T10:00:00.000Z"));
  await h.advance(5_000);
  assert.equal(h.current.notes, "account A notes", "the other account's copy is not merged");
  h.sync.flush();
  assert.equal(h.patches.length, 0);
});

test("a write retried after the account changed is not sent", async () => {
  const h = harness();
  h.open();
  h.gets[0]!.resolve(server({}));
  await h.flushPromises();
  h.edit({ notes: "account A", notesUpdatedAt: "2026-11-13T10:00:00.000Z" });
  await h.advance(200);
  assert.equal(h.patches.length, 1);
  h.patches[0]!.reject(new TypeError("offline"));
  await h.flushPromises();
  h.setAccount(null);
  await h.advance(60_000);
  h.sync.flush();
  assert.equal(h.patches.length, 1, "no retry and no flush once the account changed");
});

test("an empty read after the account copy was seen never writes the whole state", async () => {
  const h = harness();
  h.open({ notes: "mine", notesUpdatedAt: "2026-11-13T09:00:00.000Z", bookmarkedTakeaways: [1], bookmarkedTakeawayTexts: { "1": "One" } });
  h.gets[0]!.resolve(server({ notes: "mine", notesUpdatedAt: "2026-11-13T09:00:00.000Z", bookmarkedTakeaways: [1], bookmarkedTakeawayTexts: { "1": "One" } }));
  await h.advance(5_000);
  assert.equal(h.patches.length, 0);
  h.sync.refresh();
  h.gets[1]!.resolve({ state: null, updatedAt: null });
  await h.advance(5_000);
  h.sync.flush();
  await h.advance(5_000);
  assert.equal(h.patches.length, 0, "no write-once after a non-empty account copy");
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

// Answers every write with `answer(sent)` until no new write arrives.
async function serveWrites(
  h: ReturnType<typeof harness>,
  answer: (sent: PersistedChapterState) => PersistedChapterState
) {
  for (let answered = 0; answered < 10 && answered < h.patches.length; answered += 1) {
    const write = h.patches[answered]!;
    write.resolve({ state: answer(write.state), updatedAt: `2026-11-13T11:00:${String(answered).padStart(2, "0")}.000Z` });
    await h.advance(5_000);
  }
}

test("a save answered with newer notes from another device takes them, with at most one follow-up write", async () => {
  const h = harness();
  h.open();
  h.gets[0]!.resolve(server({}));
  await h.flushPromises();
  h.edit({
    notes: "mine",
    notesUpdatedAt: "2026-11-13T10:00:00.000Z",
    bookmarkedTakeaways: [1],
    bookmarkedTakeawayTexts: { "1": "One" },
  });
  await h.advance(200);
  assert.equal(h.patches.length, 1);
  // The account keeps the newer notes it already had and returns them.
  await serveWrites(h, (sent) => ({
    ...sent,
    notes: "theirs",
    notesUpdatedAt: "2026-11-13T10:30:00.000Z",
    bookmarkedTakeaways: [1, 3],
    bookmarkedTakeawayTexts: { "1": "One", "3": "Three" },
  }));
  assert.ok(h.patches.length <= 2, `at most one follow-up write (sent ${h.patches.length})`);
  assert.equal(h.current.notes, "theirs");
  assert.deepEqual(h.current.bookmarkedTakeaways, [1, 3]);
});

test("a save answered with different notes keeps notes typed since it was sent", async () => {
  const h = harness();
  h.open();
  h.gets[0]!.resolve(server({}));
  await h.flushPromises();
  h.edit({ notes: "mine", notesUpdatedAt: "2026-11-13T10:00:00.000Z" });
  await h.advance(200);
  h.edit({ notes: "mine, still typing", notesUpdatedAt: "2026-11-13T10:00:05.000Z" });
  h.patches[0]!.resolve({
    state: { ...h.patches[0]!.state, notes: "theirs", notesUpdatedAt: "2026-11-13T10:30:00.000Z" },
    updatedAt: "2026-11-13T11:00:00.000Z",
  });
  await h.flushPromises();
  assert.equal(h.current.notes, "mine, still typing");
});

test("legacy notes the account will not take are not resent in a loop", async () => {
  const h = harness();
  h.open({ notes: "legacy notes", notesUpdatedAt: null });
  h.gets[0]!.resolve(server({ notes: "", notesUpdatedAt: "2026-11-01T00:00:00.000Z" }));
  await h.advance(200);
  assert.equal(h.patches.length, 1);
  await serveWrites(h, (sent) => ({ ...sent, notes: "", notesUpdatedAt: "2026-11-01T00:00:00.000Z" }));
  assert.equal(h.patches.length, 1, "the same state is not sent again");
  assert.equal(h.current.notes, "legacy notes", "the device keeps its notes");
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

test("a successful re-read keeps the warning while a refused state is still unsaved", async () => {
  const h = harness();
  h.open();
  h.gets[0]!.resolve(server({}));
  await h.flushPromises();
  h.edit({ notes: "x".repeat(20_001), notesUpdatedAt: "2026-11-13T10:00:00.000Z" });
  await h.advance(200);
  h.patches[0]!.reject(Object.assign(new Error("invalid"), { status: 400, code: "invalid_state" }));
  await h.flushPromises();
  assert.deepEqual(h.failedChanges, [true]);
  await h.advance(5_000);
  h.sync.refresh();
  h.gets[1]!.resolve(server({}, "2026-11-13T10:00:01.000Z"));
  await h.advance(5_000);
  assert.deepEqual(h.failedChanges, [true], "the warning stays: the changes never reached the account");
});

test("a successful re-read keeps the warning while saves are still failing", async () => {
  const h = harness();
  h.open();
  h.gets[0]!.resolve(server({}));
  await h.flushPromises();
  h.edit({ notes: "keep me", notesUpdatedAt: "2026-11-13T10:00:00.000Z" });
  await h.advance(200);
  h.patches[0]!.reject(new TypeError("offline"));
  await h.flushPromises();
  await h.advance(1_000);
  h.patches[1]!.reject(new TypeError("offline"));
  await h.flushPromises();
  assert.deepEqual(h.failedChanges, [true]);
  await h.advance(1_500);
  h.sync.refresh();
  // The re-read goes first when the retry timer fires.
  await h.advance(500);
  assert.equal(h.gets.length, 2);
  h.gets[1]!.resolve(server({}, "2026-11-13T10:00:01.000Z"));
  await h.flushPromises();
  assert.deepEqual(h.failedChanges, [true], "a read alone does not clear a failing save");
  await h.advance(200);
  assert.equal(h.patches.length, 3);
  h.patches[2]!.resolve({ state: h.patches[2]!.state, updatedAt: "2026-11-13T10:00:02.000Z" });
  await h.flushPromises();
  assert.deepEqual(h.failedChanges, [true, false], "the save that lands clears it");
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

// A debounced save in flight, then a page-hide flush of newer notes.
async function twoSavesInFlight() {
  const h = harness();
  h.open();
  h.gets[0]!.resolve(server({}));
  await h.flushPromises();
  h.edit({ notes: "a", notesUpdatedAt: "2026-11-13T10:00:01.000Z" });
  await h.advance(200);
  assert.equal(h.patches.length, 1);
  h.edit({ notes: "ab", notesUpdatedAt: "2026-11-13T10:00:02.000Z" });
  h.sync.flush();
  assert.equal(h.patches.length, 2);
  assert.equal(h.patches[1]!.keepalive, true);
  h.sync.flush();
  assert.equal(h.patches.length, 2, "a second flush of the state already in flight sends nothing");
  return h;
}

test("an out-of-date save answer that arrives last is ignored", async () => {
  const h = await twoSavesInFlight();
  h.patches[1]!.resolve({ state: h.patches[1]!.state, updatedAt: "2026-11-13T11:00:02.000Z" });
  await h.flushPromises();
  h.patches[0]!.resolve({ state: h.patches[0]!.state, updatedAt: "2026-11-13T11:00:01.000Z" });
  await h.advance(5_000);
  assert.equal(h.patches.length, 2, "nothing is resent");
  assert.equal(h.current.notes, "ab");
});

test("an older state the account stored last is followed by exactly one save of the newer state", async () => {
  const h = await twoSavesInFlight();
  h.patches[1]!.resolve({ state: h.patches[1]!.state, updatedAt: "2026-11-13T11:00:01.000Z" });
  await h.flushPromises();
  h.patches[0]!.resolve({ state: h.patches[0]!.state, updatedAt: "2026-11-13T11:00:02.000Z" });
  await h.advance(5_000);
  assert.equal(h.patches.length, 3);
  assert.equal(h.patches[2]!.state.notes, "ab");
  h.patches[2]!.resolve({ state: h.patches[2]!.state, updatedAt: "2026-11-13T11:00:03.000Z" });
  await h.advance(5_000);
  assert.equal(h.patches.length, 3);
  assert.equal(h.current.notes, "ab");
});

test("a flush between a read landing and the reader's merge sends the merged notes", async () => {
  const h = harness({ manualApply: true });
  h.open({
    notes: "older notes on this device",
    notesUpdatedAt: "2026-11-01T00:00:00.000Z",
    bookmarkedTakeaways: [2],
    bookmarkedTakeawayTexts: { "2": "Two" },
  });
  h.gets[0]!.resolve(
    server({ notes: "newer account notes", notesUpdatedAt: "2026-11-12T00:00:00.000Z", bookmarkedTakeaways: [0], bookmarkedTakeawayTexts: { "0": "Zero" } })
  );
  await h.flushPromises();
  assert.equal(h.current.notes, "older notes on this device", "the reader has not merged yet");
  h.sync.flush();
  assert.equal(h.patches.length, 1);
  assert.equal(h.patches[0]!.state.notes, "newer account notes");
  assert.deepEqual(h.patches[0]!.state.bookmarkedTakeaways, [2, 0]);
  h.applyPending();
  assert.equal(h.current.notes, "newer account notes");
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

test("refresh keeps an un-bookmark and a step change made since the last sync", async () => {
  const h = harness();
  const synced = { activeTab: "quiz" as const, bookmarkedTakeaways: [1], bookmarkedTakeawayTexts: { "1": "One" } };
  h.open(synced);
  h.gets[0]!.resolve(server(synced));
  await h.advance(5_000);
  assert.equal(h.patches.length, 0);
  h.edit({ activeTab: "summary", bookmarkedTakeaways: [], bookmarkedTakeawayTexts: {} });
  h.sync.refresh();
  h.gets[1]!.resolve(server(synced, "2026-11-10T10:00:00.000Z"));
  await h.flushPromises();
  assert.equal(h.current.activeTab, "summary");
  assert.deepEqual(h.current.bookmarkedTakeaways, []);
  await h.advance(200);
  assert.equal(h.patches.length, 1);
  assert.deepEqual(h.patches[0]!.state.bookmarkedTakeaways, []);
  assert.equal(h.patches[0]!.state.activeTab, "summary");
});

test("refresh keeps a quiz retake made since the last sync, and the stricter counters", async () => {
  const h = harness();
  const synced = { quizAnswers: { q1: 2 }, quizResult: { score: 40, passed: false }, quizRetakeCount: 1 };
  h.open(synced);
  h.gets[0]!.resolve(server(synced));
  await h.advance(5_000);
  h.edit({ quizAnswers: {}, quizResult: null, quizRetakeCount: 2 });
  h.sync.refresh();
  h.gets[1]!.resolve(server({ ...synced, quizRetakeCount: 3 }, "2026-11-10T10:00:00.000Z"));
  await h.flushPromises();
  assert.deepEqual(h.current.quizAnswers, {});
  assert.equal(h.current.quizResult, null);
  assert.equal(h.current.quizRetakeCount, 3, "the economy counter keeps the stricter value");
});

test("a late first read keeps notes typed since the chapter opened", async () => {
  const h = harness();
  h.open({ notes: "start", notesUpdatedAt: "2026-11-13T08:00:00.000Z" });
  h.gets[0]!.reject(new TypeError("offline"));
  await h.flushPromises();
  h.edit({ notes: "start, typed offline", notesUpdatedAt: "2026-11-13T08:30:00.000Z" });
  await h.advance(1_000);
  assert.equal(h.gets.length, 2);
  h.gets[1]!.resolve(server({ notes: "other device", notesUpdatedAt: "2026-11-13T09:00:00.000Z" }, "2026-11-13T09:00:00.000Z"));
  await h.flushPromises();
  assert.equal(h.current.notes, "start, typed offline");
  await h.advance(200);
  assert.equal(h.patches.length, 1);
  assert.equal(h.patches[0]!.state.notes, "start, typed offline");
});

test("the first read opens the chapter at the step the account saved", async () => {
  const h = harness();
  h.open();
  h.gets[0]!.resolve(server({ activeTab: "quiz", readingDepth: "deeper" }));
  await h.flushPromises();
  assert.equal(h.current.activeTab, "quiz");
  assert.equal(h.current.readingDepth, "deeper");
  await h.advance(5_000);
  assert.equal(h.patches.length, 0);
});

test("a re-read never moves the reader to the step or depth another device saved", async () => {
  const h = harness();
  h.open();
  h.gets[0]!.resolve(server({}));
  await h.advance(5_000);
  assert.equal(h.patches.length, 0);

  h.sync.refresh();
  h.gets[1]!.resolve(
    server(
      {
        activeTab: "quiz",
        readingDepth: "deeper",
        exampleFilter: "work",
        fontScale: "lg",
        showRecap: true,
        explanationOpen: { q1: true },
        notes: "from the other device",
        notesUpdatedAt: "2026-11-13T09:30:00.000Z",
        bookmarkedTakeaways: [3],
        bookmarkedTakeawayTexts: { "3": "Three" },
      },
      "2026-11-13T09:30:00.000Z"
    )
  );
  await h.flushPromises();
  assert.equal(h.current.activeTab, "summary", "the reader stays on their step");
  assert.equal(h.current.readingDepth, "standard", "the text does not change depth");
  assert.equal(h.current.exampleFilter, "all");
  assert.equal(h.current.fontScale, "md");
  assert.deepEqual(h.current.explanationOpen, {});
  assert.equal(h.current.showRecap, true, "a recap seen on another device stays seen");
  assert.equal(h.current.notes, "from the other device", "notes still arrive");
  assert.deepEqual(h.current.bookmarkedTakeaways, [3], "bookmarks still arrive");
});

test("returning to the tab sends nothing by itself; the reader's next step change is saved", async () => {
  const h = harness();
  h.open();
  h.gets[0]!.resolve(server({}));
  await h.advance(5_000);

  // Another device moved on and saved its step.
  h.sync.refresh();
  h.gets[1]!.resolve(server({ activeTab: "quiz", readingDepth: "deeper" }, "2026-11-13T09:30:00.000Z"));
  await h.advance(5_000);
  assert.equal(h.current.activeTab, "summary");
  assert.equal(h.patches.length, 0, "keeping this device's step is not an edit");

  h.sync.flush();
  assert.equal(h.patches.length, 0, "nor is leaving the page");

  h.edit({ activeTab: "examples" });
  await h.advance(200);
  assert.equal(h.patches.length, 1);
  assert.equal(h.patches[0]!.state.activeTab, "examples");
  assert.equal(h.patches[0]!.state.readingDepth, "standard");
});

test("another device's focus mode does not make this one save when the tab is focused", async () => {
  // Focus mode always stays as this device has it, so a difference there is
  // not an edit either. Toggling it here is, and is saved.
  const h = harness();
  h.open();
  h.gets[0]!.resolve(server({}));
  await h.advance(5_000);

  h.sync.refresh();
  h.gets[1]!.resolve(server({ activeTab: "quiz", focusMode: true }, "2026-11-13T09:30:00.000Z"));
  await h.advance(5_000);
  assert.equal(h.current.focusMode, false);
  assert.equal(h.current.activeTab, "summary");
  assert.equal(h.patches.length, 0);

  h.edit({ focusMode: true });
  await h.advance(200);
  assert.equal(h.patches.length, 1);
  assert.equal(h.patches[0]!.state.focusMode, true);
});

test("a step change made just before returning to the tab is still saved", async () => {
  const h = harness();
  h.open();
  h.gets[0]!.resolve(server({}));
  await h.advance(5_000);

  // The reader moves to Examples; the re-read starts before that was saved.
  h.edit({ activeTab: "examples" });
  h.sync.refresh();
  h.gets[1]!.resolve(server({ activeTab: "quiz" }, "2026-11-13T09:30:00.000Z"));
  await h.advance(5_000);
  assert.equal(h.current.activeTab, "examples");
  assert.equal(h.patches.length, 1, "the reader's own step change reaches the account");
  assert.equal(h.patches[0]!.state.activeTab, "examples");
});

test("a recap seen on this device is still saved after a re-read", async () => {
  const h = harness();
  h.open();
  h.gets[0]!.resolve(server({}));
  await h.advance(5_000);
  h.sync.refresh();
  h.gets[1]!.resolve(server({ activeTab: "quiz" }, "2026-11-13T09:30:00.000Z"));
  await h.advance(5_000);
  h.edit({ showRecap: true });
  await h.advance(200);
  assert.equal(h.patches.length, 1);
  assert.equal(h.patches[0]!.state.showRecap, true);
});

test("after the opening read failed, a late read brings the account's notes but does not move the reader", async () => {
  const h = harness();
  h.open();
  h.gets[0]!.reject(new TypeError("offline"));
  await h.advance(1_000);
  assert.equal(h.gets.length, 2);
  // The reader has been on the page for a while by the time a read succeeds.
  h.gets[1]!.resolve(
    server(
      { activeTab: "quiz", notes: "account notes", notesUpdatedAt: "2026-11-13T09:00:00.000Z" },
      "2026-11-13T09:00:00.000Z"
    )
  );
  await h.advance(5_000);
  assert.equal(h.current.activeTab, "summary", "the reader stays on their step");
  assert.equal(h.current.notes, "account notes");
  assert.equal(h.patches.length, 0);
});

test("a save answered with a different step keeps the reader where they are", async () => {
  const h = harness();
  h.open();
  h.gets[0]!.resolve(server({}));
  await h.advance(5_000);
  h.edit({ bookmarkedTakeaways: [1], bookmarkedTakeawayTexts: { "1": "One" } });
  await h.advance(200);
  assert.equal(h.patches.length, 1);
  h.patches[0]!.resolve(
    server(
      { activeTab: "practice", bookmarkedTakeaways: [1], bookmarkedTakeawayTexts: { "1": "One" } },
      "2026-11-13T10:00:00.000Z"
    )
  );
  await h.flushPromises();
  assert.equal(h.current.activeTab, "summary");
  assert.deepEqual(h.current.bookmarkedTakeaways, [1]);
});

test("a retried opening read that lands before the reader's state is ready still opens at the saved step", async () => {
  // The page is still loading (no state has reached the sync) when the first
  // read fails and its retry succeeds: nobody is reading yet, so the chapter
  // opens where the account left it, and nothing is saved.
  const h = harness();
  h.sync.start();
  h.gets[0]!.reject(new TypeError("offline"));
  await h.advance(1_000);
  assert.equal(h.gets.length, 2);
  h.gets[1]!.resolve(server({ activeTab: "quiz", readingDepth: "deeper" }));
  await h.advance(5_000);
  assert.equal(h.current.activeTab, "quiz");
  assert.equal(h.current.readingDepth, "deeper");
  assert.equal(h.patches.length, 0, "this device's defaults are not saved over the account's step");
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
