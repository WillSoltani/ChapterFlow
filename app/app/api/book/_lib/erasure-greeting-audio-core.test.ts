import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildSegmentPlan,
  getSegmentDescriptors,
  userGreetingClipPrefix,
  type NarrationContext,
} from "./audio-narration-core";
import {
  eraseGreetingAudio,
  isGreetingClipName,
  type GreetingAudioErasureDeps,
  type GreetingClipVersion,
} from "./erasure-greeting-audio-core";

// Hard erasure removes a reader's spoken-name greeting clips ("Good evening,
// <name>.") from the versioned content bucket: every stored version and every
// delete marker, for every time of day, and nothing that belongs to anyone else.

const USER_ID = "user-7f3a";
const NAMES = "book-content/audio-segments/names/";
const PREFIXES = [
  `${NAMES}${USER_ID}-morning.`,
  `${NAMES}${USER_ID}-afternoon.`,
  `${NAMES}${USER_ID}-evening.`,
];
const HASH = "0123456789abcdef";

type FakeStore = {
  /** Versions and delete markers in the bucket, by key. */
  entries: GreetingClipVersion[];
  listed: string[];
  deleted: GreetingClipVersion[];
  listError?: (prefix: string) => Error | null;
  deleteError?: (version: GreetingClipVersion) => Error | null;
};

function fakeDeps(store: FakeStore): GreetingAudioErasureDeps {
  return {
    async listVersions(prefix) {
      store.listed.push(prefix);
      const err = store.listError?.(prefix);
      if (err) throw err;
      return store.entries.filter((e) => e.key.startsWith(prefix));
    },
    async deleteVersion(version) {
      const err = store.deleteError?.(version);
      if (err) throw err;
      store.deleted.push(version);
    },
  };
}

function newStore(entries: GreetingClipVersion[]): FakeStore {
  return { entries, listed: [], deleted: [] };
}

function sortVersions(list: GreetingClipVersion[]): string[] {
  return list.map((v) => `${v.key}@${v.versionId}`).sort();
}

test("deletes every version and delete marker of both clip name shapes", async () => {
  const entries: GreetingClipVersion[] = [
    // Fixed name: two object versions and a delete marker.
    { key: `${NAMES}${USER_ID}-morning.mp3`, versionId: "v1" },
    { key: `${NAMES}${USER_ID}-morning.mp3`, versionId: "v2" },
    { key: `${NAMES}${USER_ID}-morning.mp3`, versionId: "marker-1" },
    // Content name: a version and a delete marker.
    { key: `${NAMES}${USER_ID}-evening.${HASH}.mp3`, versionId: "v3" },
    { key: `${NAMES}${USER_ID}-evening.${HASH}.mp3`, versionId: "marker-2" },
    { key: `${NAMES}${USER_ID}-afternoon.fedcba9876543210.mp3`, versionId: "v4" },
  ];
  const store = newStore(entries);

  const result = await eraseGreetingAudio(USER_ID, fakeDeps(store));

  assert.equal(result.outcome, "deleted");
  assert.equal(result.versionsDeleted, entries.length);
  assert.deepEqual(sortVersions(store.deleted), sortVersions(entries));
  assert.equal(result.warning, undefined);
  assert.equal(result.errorName, undefined);
});

test("leaves keys of any other shape under the prefix alone", async () => {
  const strangers: GreetingClipVersion[] = [
    { key: `${NAMES}${USER_ID}-morning.backup.mp3`, versionId: "s1" },
    { key: `${NAMES}${USER_ID}-morning.0123456789abcde.mp3`, versionId: "s2" }, // 15 hex
    { key: `${NAMES}${USER_ID}-morning.0123456789abcdef0.mp3`, versionId: "s3" }, // 17 hex
    { key: `${NAMES}${USER_ID}-morning.0123456789ABCDEF.mp3`, versionId: "s4" }, // upper case
    { key: `${NAMES}${USER_ID}-morning.mp3.bak`, versionId: "s5" },
    { key: `${NAMES}${USER_ID}-morning.${HASH}.mp3/x`, versionId: "s6" },
  ];
  const own = { key: `${NAMES}${USER_ID}-morning.mp3`, versionId: "own" };
  const store = newStore([...strangers, own]);

  const result = await eraseGreetingAudio(USER_ID, fakeDeps(store));

  assert.deepEqual(store.deleted, [own]);
  assert.equal(result.outcome, "deleted");
  assert.equal(result.versionsDeleted, 1);
});

test("isGreetingClipName accepts exactly the fixed and content name shapes", () => {
  const prefix = `${NAMES}${USER_ID}-morning.`;
  assert.equal(isGreetingClipName(`${prefix}mp3`, prefix), true);
  assert.equal(isGreetingClipName(`${prefix}${HASH}.mp3`, prefix), true);
  assert.equal(isGreetingClipName(`${prefix}backup.mp3`, prefix), false);
  assert.equal(isGreetingClipName(`${prefix}${HASH}mp3`, prefix), false);
  assert.equal(isGreetingClipName(`${NAMES}other-morning.mp3`, prefix), false);
});

test("nothing stored gives skipped", async () => {
  const store = newStore([{ key: `${NAMES}someone-else-morning.mp3`, versionId: "x" }]);

  const result = await eraseGreetingAudio(USER_ID, fakeDeps(store));

  assert.equal(result.outcome, "skipped");
  assert.equal(result.versionsDeleted, 0);
  assert.deepEqual(store.deleted, []);
  assert.equal(result.warning, undefined);
});

test("lists exactly the three time-of-day prefixes", async () => {
  const store = newStore([]);

  await eraseGreetingAudio(USER_ID, fakeDeps(store));

  assert.deepEqual([...store.listed].sort(), [...PREFIXES].sort());
});

test("a list error gives failed, and the other prefixes are still deleted", async () => {
  const entries: GreetingClipVersion[] = [
    { key: `${NAMES}${USER_ID}-morning.mp3`, versionId: "v1" },
    { key: `${NAMES}${USER_ID}-evening.mp3`, versionId: "v2" },
  ];
  const store = newStore(entries);
  store.listError = (prefix) =>
    prefix.endsWith("-afternoon.") ? Object.assign(new Error("boom"), { name: "SlowDown" }) : null;

  const result = await eraseGreetingAudio(USER_ID, fakeDeps(store));

  assert.equal(result.outcome, "failed");
  assert.equal(result.versionsDeleted, 2);
  assert.deepEqual(sortVersions(store.deleted), sortVersions(entries));
  assert.equal(result.errorName, "SlowDown");
  assert.equal(
    result.warning,
    "Spoken-name audio clips were NOT fully removed from storage (SlowDown). Run the erasure again to retry.",
  );
});

test("a delete error gives failed and counts only the deletes that succeeded", async () => {
  const first = { key: `${NAMES}${USER_ID}-morning.mp3`, versionId: "v1" };
  const third = { key: `${NAMES}${USER_ID}-evening.${HASH}.mp3`, versionId: "v3" };
  const entries: GreetingClipVersion[] = [
    first,
    { key: `${NAMES}${USER_ID}-morning.mp3`, versionId: "v2" },
    third,
  ];
  const store = newStore(entries);
  store.deleteError = (v) =>
    v.versionId === "v2" ? Object.assign(new Error("denied"), { name: "AccessDenied" }) : null;

  const result = await eraseGreetingAudio(USER_ID, fakeDeps(store));

  assert.equal(result.outcome, "failed");
  assert.equal(result.versionsDeleted, 2);
  assert.deepEqual(sortVersions(store.deleted), sortVersions([first, third]));
  assert.equal(result.errorName, "AccessDenied");
});

test("an exhausted time budget gives failed promptly and aborts the signal", async () => {
  const signals: AbortSignal[] = [];
  const deps: GreetingAudioErasureDeps = {
    listVersions(_prefix, signal) {
      signals.push(signal);
      return new Promise<GreetingClipVersion[]>(() => {}); // never settles
    },
    async deleteVersion() {
      throw new Error("not reached");
    },
  };

  const started = Date.now();
  const result = await eraseGreetingAudio(USER_ID, deps, { budgetMs: 20 });
  const elapsed = Date.now() - started;

  assert.equal(result.outcome, "failed");
  assert.equal(result.versionsDeleted, 0);
  assert.ok(elapsed < 1000, `took ${elapsed} ms`);
  assert.ok(signals.length > 0);
  assert.ok(signals.every((s) => s.aborted));
  assert.equal(
    result.warning,
    "Spoken-name audio clips were NOT fully removed from storage (time limit reached). Run the erasure again to retry.",
  );
});

test("the warning and error name never carry the user id, a key, or the error message", async () => {
  const key = `${NAMES}${USER_ID}-morning.mp3`;
  const store = newStore([{ key, versionId: "v1" }]);
  const leaky = Object.assign(new Error(`Access Denied for ${key} (user ${USER_ID})`), {
    name: "AccessDenied",
  });
  store.deleteError = () => leaky;

  const result = await eraseGreetingAudio(USER_ID, fakeDeps(store));

  assert.equal(result.outcome, "failed");
  for (const text of [result.warning ?? "", result.errorName ?? ""]) {
    assert.ok(text.length > 0);
    assert.ok(!text.includes(USER_ID), text);
    assert.ok(!text.includes(key), text);
    assert.ok(!text.includes("Access Denied for"), text);
    assert.ok(!text.includes("\n"), text);
  }
});

test("an error name that is not a plain code is reported as unknown", async () => {
  const key = `${NAMES}${USER_ID}-morning.mp3`;
  const store = newStore([{ key, versionId: "v1" }]);
  store.deleteError = () => Object.assign(new Error("x"), { name: key });

  const withKeyName = await eraseGreetingAudio(USER_ID, fakeDeps(store));
  assert.equal(withKeyName.errorName, "unknown");

  const store2 = newStore([{ key, versionId: "v1" }]);
  store2.deleteError = () => "a thrown string" as unknown as Error;
  const notAnError = await eraseGreetingAudio(USER_ID, fakeDeps(store2));
  assert.equal(notAnError.errorName, "unknown");
  assert.ok(!(notAnError.warning ?? "").includes("a thrown string"));
});

test("never throws, even when a dependency throws synchronously", async () => {
  const deps: GreetingAudioErasureDeps = {
    listVersions() {
      throw new TypeError("sync failure");
    },
    async deleteVersion() {},
  };

  const result = await eraseGreetingAudio(USER_ID, deps);

  assert.equal(result.outcome, "failed");
  assert.equal(result.errorName, "TypeError");
});

test("the key the audio route plays for a named reader is one erasure removes", () => {
  const ctx: NarrationContext = {
    userName: "Ada",
    userId: USER_ID,
    bookId: "some-book",
    bookTitle: "Some Book",
    authorName: "Some Author",
    chapterNumber: 2,
    totalChapters: 10,
    previousChapterScore: null,
    previousChapterScoreBefore: null,
    currentStreak: 0,
    daysSinceLastSession: 0,
    totalChaptersCompleted: 1,
    booksCompleted: 0,
    learningMode: "standard",
    isFirstEverChapter: false,
    isFirstChapterOfBook: false,
    isLastChapterOfBook: false,
    isHalfwayThroughBook: false,
    isWeekend: false,
    isLateNight: false,
    timeOfDay: "afternoon",
  };
  const plan = buildSegmentPlan(ctx);
  const greeting = getSegmentDescriptors(plan, ctx, {}).find((d) => d.type === "userGreeting");

  assert.ok(greeting, "a named reader gets a spoken greeting");
  const prefix = userGreetingClipPrefix(ctx.userId, plan.timeOfDay);
  assert.ok(PREFIXES.includes(prefix), prefix);
  assert.ok(greeting.key.startsWith(prefix), greeting.key);
  assert.equal(isGreetingClipName(greeting.key, prefix), true);
});
